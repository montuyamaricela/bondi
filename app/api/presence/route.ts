import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/session';
import { Errors, handleApiError, readJson } from '@/lib/errors';
import { writePresence } from '@/lib/server/native-presence';

async function handle(request: NextRequest, online: boolean) {
  try {
    const session = await getServerSession(request.headers);
    if (!session) throw Errors.Unauthorized;
    return NextResponse.json(
      await writePresence(
        { userId: session.user.id, sessionId: session.session.id },
        await readJson(request),
        online,
      ),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  return handle(request, true);
}
export async function DELETE(request: NextRequest) {
  return handle(request, false);
}
