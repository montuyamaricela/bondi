import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { endMatch } from '@/lib/server/match-access';
import { Errors, handleApiError } from '@/lib/errors';
import { publishRealtimeHint } from '@/lib/server/realtime';
import { assertOptionalChatOwner } from '@/lib/server/chat-activity';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { matchId } = await params;
    const payload = await request.text();
    if (payload.trim()) {
      let input: unknown;
      try {
        input = JSON.parse(payload);
      } catch {
        throw Errors.BadRequest('Invalid JSON');
      }
      assertOptionalChatOwner({ userId: session.user.id, sessionId: session.session.id }, input);
    }
    const updatedMatch = await endMatch(session.user.id, matchId);
    await Promise.all(
      [updatedMatch.user1Id, updatedMatch.user2Id].map((userId) =>
        publishRealtimeHint(userId).catch(() => {
          console.error('Ended match refresh unavailable');
        }),
      ),
    );

    return NextResponse.json({
      success: true,
      matchId: updatedMatch.id,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
