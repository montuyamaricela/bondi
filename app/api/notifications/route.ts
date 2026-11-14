import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod';
import { handleApiError, readJson } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const rawLimit = searchParams.get('limit');
    const limit = rawLimit === null ? 20 : /^\d+$/.test(rawLimit) ? Number(rawLimit) : NaN;
    const rawUnreadOnly = searchParams.get('unreadOnly');
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      searchParams.getAll('limit').length > 1 ||
      searchParams.getAll('unreadOnly').length > 1 ||
      (rawUnreadOnly !== null && rawUnreadOnly !== 'true' && rawUnreadOnly !== 'false')
    )
      return NextResponse.json(
        {
          error: 'Use a notification limit from 1–100 and unreadOnly true or false.',
          code: 'INVALID_NOTIFICATION_QUERY',
        },
        { status: 400 },
      );
    const unreadOnly = rawUnreadOnly === 'true';

    const where = {
      userId: session.user.id,
      ...(unreadOnly ? { isRead: false } : {}),
    };

    const notifications = await db.notification.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
    const matchIds = notifications.flatMap((notification) =>
      ['MESSAGE', 'MATCH'].includes(notification.type) && notification.entityId
        ? [notification.entityId]
        : [],
    );
    const liveMatches = matchIds.length
      ? await db.match.findMany({
          where: {
            id: { in: matchIds },
            status: 'ACTIVE',
            OR: [{ user1Id: session.user.id }, { user2Id: session.user.id }],
          },
          select: { id: true },
        })
      : [];
    const active = new Set(liveMatches.map(({ id }) => id));
    return NextResponse.json({
      notifications: notifications.map((notification) => ({
        ...notification,
        canNotify:
          ['MESSAGE', 'MATCH'].includes(notification.type) &&
          !!notification.entityId &&
          active.has(notification.entityId),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const notificationId = z
  .string()
  .min(1)
  .max(128)
  .refine((value) => value.trim().length > 0);
const markAsReadSchema = z.object({
  ids: z.union([notificationId, z.array(notificationId).max(100)]),
  isRead: z.boolean(),
});

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await readJson(request);
    const validated = markAsReadSchema.parse(body);

    const ids = Array.isArray(validated.ids) ? validated.ids : [validated.ids];

    await db.notification.updateMany({
      where: {
        id: { in: ids },
        userId: session.user.id,
      },
      data: {
        isRead: validated.isRead,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 },
      );
    }

    return handleApiError(error);
  }
}
