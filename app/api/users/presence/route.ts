import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/session';
import { Errors, handleApiError, readJson } from '@/lib/errors';
import { getNativePresence } from '@/lib/server/native-presence';
import { presenceSnapshotInput } from '@/app/components/features/messaging/presence-input';
import { createAppError } from '@/lib/app-error';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(request.headers);
    if (!session) throw Errors.Unauthorized;
    const input = presenceSnapshotInput.parse(await readJson(request));
    if (input.expectedUserId !== session.user.id || input.expectedSessionId !== session.session.id)
      throw createAppError('Session changed', 409, 'SESSION_CHANGED');
    return NextResponse.json(await getNativePresence(session.user.id, input.userIds), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
