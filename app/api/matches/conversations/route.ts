import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { readPagination } from '@/lib/server/cursor-pagination';
import { readConversations } from '@/lib/server/conversations';
import { handleApiError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    const params = request.nextUrl.searchParams;
    const search = (params.get('q') ?? '').trim();
    if (search.length > 100 || params.getAll('q').length > 1)
      return NextResponse.json(
        { error: 'Search must be at most 100 characters', code: 'INVALID_SEARCH' },
        { status: 400 },
      );
    const pagination = readPagination(params, 'conversations', userId, search || undefined);
    return NextResponse.json(await readConversations(userId, pagination, search));
  } catch (error) {
    return handleApiError(error);
  }
}
