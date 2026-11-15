import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { handleApiError, readJson } from '@/lib/errors';
import { getNativePresence } from '@/lib/server/native-presence';

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await readJson(request);
    const userIds =
      body && typeof body === 'object' && 'userIds' in body ? body.userIds : undefined;

    if (
      !Array.isArray(userIds) ||
      userIds.length > 100 ||
      userIds.some((id) => typeof id !== 'string' || !id || id.length > 128)
    ) {
      return NextResponse.json(
        { error: 'userIds must contain at most 100 valid IDs' },
        { status: 400 },
      );
    }

    const statuses = await getNativePresence(session.user.id, userIds);
    const onlineUsers = Object.fromEntries(
      Object.entries(statuses).map(([id, status]) => [id, status.visible && status.online]),
    );

    return NextResponse.json(onlineUsers);
  } catch (error) {
    return handleApiError(error);
  }
}
