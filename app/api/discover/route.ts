import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/session';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/errors';
import { recordDiscoveryAction } from '@/lib/server/matching';
import {
  likeActionSchema,
  discoverFiltersSchema,
} from '@/app/components/features/discover/validation';
import { discoverProfiles } from '@/lib/server/discovery';
import { getSocketInstance } from '@/lib/socket-instance';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(request.headers);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;
    const fields = ['minAge', 'maxAge', 'distance'] as const;
    const validation = discoverFiltersSchema.safeParse(
      Object.fromEntries(
        fields.map((key) => {
          const value = params.get(key);
          return [key, value === null ? undefined : /^\d+$/.test(value) ? Number(value) : NaN];
        }),
      ),
    );
    if (!validation.success || fields.some((key) => params.getAll(key).length > 1))
      return NextResponse.json(
        {
          error:
            'Use integer age bounds from 18–100 and a distance from 1–500 km; minimum age must not exceed maximum age.',
          code: 'INVALID_FILTERS',
        },
        { status: 400 },
      );

    const currentUserId = session.user.id;

    const currentUserProfile = await db.profile.findUnique({
      where: { userId: currentUserId },
    });

    if (!currentUserProfile) {
      return NextResponse.json(
        { error: 'Profile not found. Please complete your profile first.' },
        { status: 404 },
      );
    }

    if (
      validation.data.distance !== undefined &&
      (currentUserProfile.latitude === null || currentUserProfile.longitude === null)
    )
      return NextResponse.json(
        {
          error: 'Enable or refresh your location in Settings to use a distance filter.',
          code: 'LOCATION_REQUIRED',
        },
        { status: 422 },
      );
    return NextResponse.json(await discoverProfiles(currentUserProfile, validation.data));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(request.headers);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const validationResult = likeActionSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: validationResult.error.issues,
        },
        { status: 400 },
      );
    }

    const { targetUserId, action } = validationResult.data;
    const outcome = await recordDiscoveryAction(session.user.id, targetUserId, action);
    // Notifications are durable before these best-effort refresh hints leave the process.
    try {
      const io = getSocketInstance();
      for (const notification of outcome.notify) {
        io?.to(`user:${notification.userId}`).emit('notification:new', {
          type: 'MATCH',
          matchId: notification.matchId,
        });
      }
    } catch {
      console.error('Match notification refresh failed after commit');
    }
    return NextResponse.json(outcome.response);
  } catch (error) {
    return handleApiError(error);
  }
}
