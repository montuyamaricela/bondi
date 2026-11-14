import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { endMatch } from '@/lib/server/match-access';
import { notifyMatchEnded } from '@/lib/server/socket-live-match';
import { getSocketInstance } from '@/lib/socket-instance';
import { handleApiError } from '@/lib/errors';

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
    const updatedMatch = await endMatch(session.user.id, matchId);
    notifyMatchEnded(getSocketInstance(), updatedMatch);

    return NextResponse.json({
      success: true,
      matchId: updatedMatch.id,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
