import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

const messageInput = z
  .object({
    matchId: z.string().min(1).max(128),
    content: z.string().max(5000).trim().default(''),
    // Legacy clients may send metadata, but only the key is used to resolve it.
    file: z.object({ key: z.string().min(1).max(512) }).optional(),
    clientRequestId: z.uuid().optional(),
  })
  .refine(({ content, file }) => content.length > 0 || !!file);

const attachmentInput = z
  .object({
    key: z.string().min(1).max(512),
    url: z.url().refine((url) => new URL(url).protocol === 'https:'),
    name: z.string().min(1).max(255),
    size: z.number().int().positive(),
    type: z
      .string()
      .max(255)
      .regex(/^(?:image\/[a-z0-9.+-]+|video\/[a-z0-9.+-]+|application\/pdf)$/),
  })
  .refine(({ type, size }) => {
    const limit = type.startsWith('image/')
      ? 8
      : type === 'application/pdf'
        ? 16
        : type.startsWith('video/')
          ? 32
          : 0;
    return limit > 0 && size <= limit * 1024 * 1024;
  });

class MessageWriteError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

export function messageWriteError(error: unknown) {
  return error instanceof MessageWriteError
    ? { status: error.status, error: error.message, code: error.code }
    : { status: 500, error: 'Message could not be sent', code: 'INTERNAL_ERROR' };
}

export async function registerMessageAttachment(userId: string, file: unknown) {
  const parsed = attachmentInput.safeParse(file);
  if (!parsed.success) throw new MessageWriteError('Invalid attachment', 400, 'INVALID_MESSAGE');
  const attachment = await db.messageAttachment.upsert({
    where: { key: parsed.data.key },
    create: { ...parsed.data, userId },
    update: {},
  });
  if (attachment.userId !== userId)
    throw new MessageWriteError('Attachment is unavailable', 400, 'INVALID_MESSAGE');
  return attachment;
}

export async function writeMessage(userId: string, payload: unknown, excludedSocketId?: string) {
  const parsed = messageInput.safeParse(payload);
  if (!parsed.success)
    throw new MessageWriteError(
      'Invalid message (maximum 5000 characters)',
      400,
      'INVALID_MESSAGE',
    );
  const { matchId, content, file, clientRequestId } = parsed.data;
  const operation = clientRequestId ? { senderId: userId, matchId, clientRequestId } : null;
  const replay = async (query: Pick<Prisma.TransactionClient, 'message'>) => {
    if (!operation) return null;
    const existing = await query.message.findUnique({
      where: { senderId_matchId_clientRequestId: operation },
      select: messageSelection,
    });
    if (existing && (existing.content !== content || existing.fileKey !== (file?.key ?? null))) {
      throw new MessageWriteError(
        'This operation ID belongs to a different message',
        409,
        'CONFLICT',
      );
    }
    return existing;
  };
  try {
    return await db.$transaction(
      async (transaction) => {
        // Unmatch waits for accepted sends to commit before it revokes live communication.
        await transaction.$executeRaw`SELECT "id" FROM "Match" WHERE "id" = ${matchId} FOR UPDATE`;
        const match = await transaction.match.findUnique({
          where: { id: matchId },
          select: { user1Id: true, user2Id: true, status: true },
        });
        if (!match) throw new MessageWriteError('Match not found', 404, 'NOT_FOUND');
        if (match.status !== 'ACTIVE' || (match.user1Id !== userId && match.user2Id !== userId))
          throw new MessageWriteError('An active match is required', 403, 'FORBIDDEN');
        const receiverId = match.user1Id === userId ? match.user2Id : match.user1Id;
        const existing = await replay(transaction);
        if (existing) return { message: existing, receiverId, replayed: true };
        const attachment = file
          ? await transaction.messageAttachment.findUnique({ where: { key: file.key } })
          : null;
        if (
          file &&
          (!attachment ||
            attachment.userId !== userId ||
            !attachmentInput.safeParse(attachment).success)
        )
          throw new MessageWriteError('Attachment is unavailable', 400, 'INVALID_MESSAGE');
        const message = await transaction.message.create({
          data: {
            matchId,
            senderId: userId,
            content,
            clientRequestId,
            type: attachment ? (attachment.type.startsWith('image/') ? 'IMAGE' : 'FILE') : 'TEXT',
            fileUrl: attachment?.url ?? null,
            fileKey: attachment?.key ?? null,
            fileName: attachment?.name ?? null,
            fileSize: attachment?.size ?? null,
            fileType: attachment?.type ?? null,
          },
          select: messageSelection,
        });
        const profile = await transaction.profile.findUnique({
          where: { userId },
          select: { name: true },
        });
        const name = profile?.name || 'Someone';
        const notification = await transaction.notification.create({
          data: {
            userId: receiverId,
            title: 'New Message',
            type: 'MESSAGE',
            entityId: matchId,
            actionUrl: `/messages/${matchId}`,
            metadata: { messageId: message.id },
            content:
              message.type === 'IMAGE'
                ? `${name} sent you an image`
                : message.type === 'FILE'
                  ? `${name} sent you a file`
                  : `${name} sent you a message: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
          },
        });
        const recipients = new Map<
          string,
          { userId: string; excludedSocketId?: string; notificationId: string | null }
        >([
          [userId, { userId, excludedSocketId, notificationId: null }],
          [
            receiverId,
            {
              userId: receiverId,
              excludedSocketId: receiverId === userId ? excludedSocketId : undefined,
              notificationId: notification.id,
            },
          ],
        ]);
        await transaction.messageDelivery.createMany({
          data: [...recipients.values()].map((recipient) => ({
            ...recipient,
            messageId: message.id,
          })),
        });
        return { message, receiverId, replayed: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  } catch (error) {
    if (
      operation &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const winner = await replay(db);
      if (winner) {
        const match = await db.match.findUniqueOrThrow({
          where: { id: matchId },
          select: { user1Id: true, user2Id: true, status: true },
        });
        if (match.status !== 'ACTIVE' || (match.user1Id !== userId && match.user2Id !== userId))
          throw new MessageWriteError('An active match is required', 403, 'FORBIDDEN');
        return {
          message: winner,
          receiverId: match.user1Id === userId ? match.user2Id : match.user1Id,
          replayed: true,
        };
      }
    }
    throw error;
  }
}

export function serializeMessage(
  message: Prisma.MessageGetPayload<{ select: typeof messageSelection }>,
) {
  return {
    ...message,
    createdAt: message.createdAt.toISOString(),
    readAt: message.readAt?.toISOString() ?? null,
  };
}

export const messageSelection = {
  id: true,
  matchId: true,
  senderId: true,
  content: true,
  clientRequestId: true,
  type: true,
  fileUrl: true,
  fileKey: true,
  fileName: true,
  fileSize: true,
  fileType: true,
  createdAt: true,
  readAt: true,
  sender: { select: { id: true, name: true, image: true } },
} satisfies Prisma.MessageSelect;
