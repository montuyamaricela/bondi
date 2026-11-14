import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/session';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/errors';
import { recordDiscoveryAction } from '@/lib/server/matching';
import { likeActionSchema } from '@/app/components/features/discover/validation';
import { calculateDistance } from '@/lib/geolocation';
import { getSocketInstance } from '@/lib/socket-instance';
import { calculateCompatibilityScore } from '@/lib/matching-utils';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(request.headers);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const minAge = searchParams.get('minAge');
    const maxAge = searchParams.get('maxAge');
    const maxDistance = searchParams.get('distance');

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

    const alreadyInteractedWith: { targetUserId: string }[] = await db.like.findMany({
      where: { userId: currentUserId },
      select: { targetUserId: true },
    });

    const interactedUserIds = alreadyInteractedWith.map((like) => like.targetUserId);

    const matchedUserIds: { user1Id: string; user2Id: string }[] = await db.match.findMany({
      where: {
        OR: [{ user1Id: currentUserId }, { user2Id: currentUserId }],
        status: 'ACTIVE',
      },
      select: { user1Id: true, user2Id: true },
    });

    const matchedIds = matchedUserIds.flatMap((match) => [match.user1Id, match.user2Id]);

    const excludedIds = [...new Set([...interactedUserIds, ...matchedIds, currentUserId])];

    const ageFilter =
      minAge && maxAge
        ? {
            age: {
              gte: parseInt(minAge),
              lte: parseInt(maxAge),
            },
          }
        : {};

    const genderFilter =
      currentUserProfile.genderPreference && currentUserProfile.genderPreference !== 'EVERYONE'
        ? { gender: currentUserProfile.genderPreference as 'MALE' | 'FEMALE' }
        : {};

    const profiles = await db.profile.findMany({
      where: {
        userId: {
          notIn: excludedIds,
        },
        ...ageFilter,
        ...genderFilter,
      },
      include: {
        user: {
          include: {
            files: {
              orderBy: {
                createdAt: 'asc',
              },
            },
          },
        },
      },
      take: 50,
    });

    const profilesWithScores = profiles
      .map((profile) => {
        let distance: number | null = null;

        if (
          profile.latitude &&
          profile.longitude &&
          currentUserProfile.latitude &&
          currentUserProfile.longitude
        ) {
          distance = calculateDistance(
            { latitude: currentUserProfile.latitude, longitude: currentUserProfile.longitude },
            { latitude: profile.latitude, longitude: profile.longitude },
          );
        }

        if (maxDistance && distance !== null && distance > parseInt(maxDistance)) {
          return null;
        }

        const compatibilityScore = calculateCompatibilityScore(currentUserProfile, profile);

        const distanceScore = distance !== null ? Math.max(0, 100 - distance / 5) : 0;
        const finalScore = compatibilityScore * 0.7 + distanceScore * 0.3;

        return {
          id: profile.id,
          userId: profile.userId,
          name: profile.name,
          age: profile.age,
          bio: profile.bio,
          gender: profile.gender,
          location: profile.location,
          interests: profile.interests,
          hobbies: profile.hobbies,
          lookingFor: profile.lookingFor,
          relationshipType: profile.relationshipType,
          showDistance: profile.showDistance,
          distance: profile.showDistance ? distance : null,
          photos: profile.user.files.map((file) => ({
            id: file.id,
            url: file.url,
            key: file.key,
          })),
          compatibilityScore: finalScore,
        };
      })
      .filter((profile): profile is NonNullable<typeof profile> => profile !== null);

    const rankedProfiles = profilesWithScores
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
      .slice(0, 10);

    return NextResponse.json(rankedProfiles);
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
