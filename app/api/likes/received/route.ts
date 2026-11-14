import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/session';
import { readPagination } from '@/lib/server/cursor-pagination';
import { readReceivedLikes } from '@/lib/server/received-likes';
import { handleApiError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(request.headers);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pagination = readPagination(request.nextUrl.searchParams, 'likes', session.user.id);
    return NextResponse.json(await readReceivedLikes(session.user.id, pagination));
  } catch (error) {
    return handleApiError(error);
  }
}
