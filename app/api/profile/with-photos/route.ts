import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/session';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(request.headers);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await db.profile.findUnique({
      where: { userId: session.user.id },
    });

    if (!profile) {
      return NextResponse.json({ profile: null });
    }

    const photos = await db.file.findMany({
      where: { userId: session.user.id },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        url: true,
        key: true,
        name: true,
        size: true,
        type: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      profile: {
        ...profile,
        photos,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
