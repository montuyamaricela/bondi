import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/session';
import { Errors, handleApiError, readJson } from '@/lib/errors';
import { readChatTyping, writeChatTyping } from '@/lib/server/chat-activity';

type Context = { params: Promise<{ matchId: string }> };
export async function GET(request: NextRequest, context: Context) {
  try {
    const session = await getServerSession(request.headers);
    if (!session) throw Errors.Unauthorized;
    const params = request.nextUrl.searchParams;
    if (['expectedUserId', 'expectedSessionId'].some((key) => params.getAll(key).length !== 1))
      throw Errors.BadRequest('Session owner required');
    return NextResponse.json(
      await readChatTyping(
        { userId: session.user.id, sessionId: session.session.id },
        (await context.params).matchId,
        Object.fromEntries(params),
      ),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
export async function POST(request: NextRequest, context: Context) {
  try {
    const session = await getServerSession(request.headers);
    if (!session) throw Errors.Unauthorized;
    return NextResponse.json(
      await writeChatTyping(
        { userId: session.user.id, sessionId: session.session.id },
        (await context.params).matchId,
        await readJson(request),
      ),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
