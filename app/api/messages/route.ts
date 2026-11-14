import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { writeMessage, messageWriteError } from '@/lib/server/messages';
import { handleApiError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const matchId = searchParams.get('matchId');

    if (!matchId) {
      return NextResponse.json({ error: 'matchId is required' }, { status: 400 });
    }

    const match = await db.match.findUnique({
      where: { id: matchId },
      select: { user1Id: true, user2Id: true, status: true },
    });

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    if (match.user1Id !== session.user.id && match.user2Id !== session.user.id) {
      return NextResponse.json({ error: 'You are not part of this match' }, { status: 403 });
    }

    const messages = await db.message.findMany({
      where: { matchId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        matchId: true,
        senderId: true,
        content: true,
        type: true,
        fileUrl: true,
        fileKey: true,
        fileName: true,
        fileSize: true,
        fileType: true,
        createdAt: true,
        readAt: true,
        sender: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json(messages);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON', code: 'INVALID_MESSAGE' }, { status: 400 });
    }
    const { message } = await writeMessage(session.user.id, body);
    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    const { status, ...body } = messageWriteError(error);
    return NextResponse.json(body, { status });
  }
}
