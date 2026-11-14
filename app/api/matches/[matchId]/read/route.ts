import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/session';
import { Errors, handleApiError, readJson } from '@/lib/errors';
import { markChatRead } from '@/lib/server/chat-activity';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ matchId: string }> },
) {
  try {
    const session = await getServerSession(request.headers);
    if (!session) throw Errors.Unauthorized;
    return NextResponse.json(
      await markChatRead(
        { userId: session.user.id, sessionId: session.session.id },
        (await context.params).matchId,
        await readJson(request),
      ),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
