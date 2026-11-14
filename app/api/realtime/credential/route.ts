import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/session';
import { db } from '@/lib/db';
import { Errors, handleApiError, readJson } from '@/lib/errors';
import { issueRealtimeCredential, realtimeOwnerInput } from '@/lib/server/realtime';

async function handle(request: NextRequest, close: boolean) {
  try {
    const session = await getServerSession(request.headers);
    if (!session) throw Errors.Unauthorized;
    const input = realtimeOwnerInput.parse(await readJson(request));
    if (close) {
      if (
        input.expectedUserId !== session.user.id ||
        input.expectedSessionId !== session.session.id
      )
        throw Errors.Forbidden;
      if (!input.leaseId) throw Errors.BadRequest('Subscription required');
      await db.realtimeLease.deleteMany({
        where: {
          id: input.leaseId,
          userId: session.user.id,
          sessionId: session.session.id,
        },
      });
      return NextResponse.json({ closed: true });
    }
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
