import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/session';
import { db } from '@/lib/db';
import { Errors, handleApiError, readJson } from '@/lib/errors';
import {
  canCloseRealtimeLease,
  issueRealtimeCredential,
  realtimeCloseInput,
  realtimeOwnerInput,
} from '@/lib/server/realtime';
import { notifyPresenceChange } from '@/lib/server/native-presence';

async function handle(request: NextRequest, close: boolean) {
  try {
    const session = await getServerSession(request.headers);
    if (close) {
      const input = realtimeCloseInput.parse(await readJson(request));
      const ownsCookie =
        session?.user.id === input.expectedUserId &&
        session?.session.id === input.expectedSessionId;
      if (!ownsCookie && !canCloseRealtimeLease(input))
        throw session ? Errors.Forbidden : Errors.Unauthorized;
      const removed = await db.realtimeLease.deleteMany({
        where: {
          id: input.leaseId,
          userId: input.expectedUserId,
          sessionId: input.expectedSessionId,
        },
      });
      if (removed.count) await notifyPresenceChange(input.expectedUserId);
      return NextResponse.json({ closed: true });
    }
    if (!session) throw Errors.Unauthorized;
    const input = realtimeOwnerInput.parse(await readJson(request));
    return NextResponse.json(
      await issueRealtimeCredential(
        {
          userId: session.user.id,
          sessionId: session.session.id,
        },
        input,
      ),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  const response = await handle(request, false);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function DELETE(request: NextRequest) {
  const response = await handle(request, true);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
