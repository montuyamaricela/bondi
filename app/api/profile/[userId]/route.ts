import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/session';
import { getPublicProfileByUserId } from '@/lib/server/profile';
import { handleApiError } from '@/lib/errors';
import type { PublicProfileResponse } from '@/app/components/features/profile/types';

const privateHeaders = { 'Cache-Control': 'private, no-store' };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const session = await getServerSession(request.headers);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders });
    }

    const { userId } = await params;

    const profile = await getPublicProfileByUserId(userId);

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404, headers: privateHeaders },
      );
    }

    return NextResponse.json({ profile } satisfies PublicProfileResponse, {
      headers: privateHeaders,
    });
  } catch (error) {
    const response = handleApiError(error);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }
}
