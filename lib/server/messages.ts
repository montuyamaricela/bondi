import { z } from 'zod';
import { db } from '@/lib/db';

const messageInput = z
  .object({
    matchId: z.string().min(1).max(128),
    content: z.string().max(5000).trim().default(''),
    // Legacy clients may send metadata, but only the key is used to resolve it.
    file: z.object({ key: z.string().min(1).max(512) }).optional(),
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

export async function writeMessage(userId: string, payload: unknown) {
  const parsed = messageInput.safeParse(payload);
  if (!parsed.success)
    throw new MessageWriteError(
      'Invalid message (maximum 5000 characters)',
      400,
      'INVALID_MESSAGE',
    );
  const { matchId, content, file } = parsed.data;
  const match = await db.match.findUnique({
    where: { id: matchId },
    select: { user1Id: true, user2Id: true, status: true },
  });
  if (!match) throw new MessageWriteError('Match not found', 404, 'NOT_FOUND');
  if (match.status !== 'ACTIVE' || (match.user1Id !== userId && match.user2Id !== userId)) {
    throw new MessageWriteError('An active match is required', 403, 'FORBIDDEN');
  }
  const attachment = file
    ? await db.messageAttachment.findUnique({ where: { key: file.key } })
    : null;
  if (
    file &&
    (!attachment || attachment.userId !== userId || !attachmentInput.safeParse(attachment).success)
  ) {
    throw new MessageWriteError('Attachment is unavailable', 400, 'INVALID_MESSAGE');
  }
  const message = await db.message.create({
    data: {
      matchId,
      senderId: userId,
      content,
      type: attachment ? (attachment.type.startsWith('image/') ? 'IMAGE' : 'FILE') : 'TEXT',
      fileUrl: attachment?.url ?? null,
      fileKey: attachment?.key ?? null,
      fileName: attachment?.name ?? null,
      fileSize: attachment?.size ?? null,
      fileType: attachment?.type ?? null,
    },
    select: {
      id: true,
      matchId: true,
      senderId: true,
      content: true,
      type: true,
      fileUrl: true,
      fileKey: true,
      fileName: true,
      fileSize: true,
      fileType: true,
      createdAt: true,
      readAt: true,
      sender: { select: { id: true, name: true, image: true } },
    },
  });
  return { message, receiverId: match.user1Id === userId ? match.user2Id : match.user1Id };
}
