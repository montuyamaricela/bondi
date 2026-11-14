import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { calculateDistance } from '@/lib/geolocation';
import { calculateCompatibilityScore } from '@/lib/matching-utils';
import type { DiscoverFiltersFormData } from '@/app/components/features/discover/validation';
import type { DiscoverableProfile } from '@/app/components/features/discover/types';
import { effectiveLocation, publicLocation } from '@/lib/location';
import { locationSelect } from '@/lib/server/location';

export async function discoverProfiles(
  current: Prisma.ProfileGetPayload<{ include: { locationCity: true } }>,
  filters: DiscoverFiltersFormData,
) {
  const ranked: Array<{ profile: DiscoverableProfile; score: number }> = [];
  const viewerPoint = effectiveLocation(current);
  let cursor: string | undefined;
  let more = true;
  while (more) {
    const profiles = await db.profile.findMany({
      where: {
        ...(cursor ? { id: { gt: cursor } } : {}),
        userId: { not: current.userId },
        age: { gte: filters.minAge ?? 18, lte: filters.maxAge ?? 100 },
        ...(current.genderPreference === 'EVERYONE' ? {} : { gender: current.genderPreference }),
        genderPreference: {
          in:
            current.gender === 'MALE' || current.gender === 'FEMALE'
              ? ['EVERYONE', current.gender]
              : ['EVERYONE'],
        },
        user: {
          likesReceived: { none: { userId: current.userId } },
          matchesAsUser1: { none: { user2Id: current.userId, status: 'ACTIVE' } },
          matchesAsUser2: { none: { user1Id: current.userId, status: 'ACTIVE' } },
        },
      },
      select: {
        id: true,
        userId: true,
        name: true,
        age: true,
        bio: true,
        gender: true,
        ...locationSelect,
        interests: true,
        hobbies: true,
        lookingFor: true,
        relationshipType: true,
        user: {
          select: {
            files: {
              select: { id: true, url: true, key: true },
              orderBy: [{ order: 'asc' }, { id: 'asc' }],
            },
          },
        },
      },
      orderBy: { id: 'asc' },
      take: 100,
    });
    for (const profile of profiles) {
      const candidatePoint = effectiveLocation(profile);
      const distance =
        viewerPoint && candidatePoint ? calculateDistance(viewerPoint, candidatePoint) : null;
      if (filters.distance !== undefined && (distance === null || distance > filters.distance))
        continue;
      const distanceScore = distance !== null ? Math.max(0, 100 - distance / 5) : 0;
      ranked.push({
        profile: {
          id: profile.id,
          userId: profile.userId,
          name: profile.name,
          age: profile.age,
          bio: profile.bio,
          gender: profile.gender,
          ...publicLocation(profile, viewerPoint),
          interests: profile.interests,
          hobbies: profile.hobbies,
          lookingFor: profile.lookingFor,
          relationshipType: profile.relationshipType,
          showDistance: profile.showDistance,
          photos: profile.user.files,
        },
        score: calculateCompatibilityScore(current, profile) * 0.7 + distanceScore * 0.3,
      });
    }
    // Rank all eligible candidates while keeping memory bounded to a batch and ten winners.
    ranked.sort(
      (a, b) =>
        b.score - a.score ||
        (a.profile.id < b.profile.id ? -1 : a.profile.id > b.profile.id ? 1 : 0),
    );
    ranked.length = Math.min(ranked.length, 10);
    cursor = profiles.at(-1)?.id;
    more = profiles.length === 100;
  }
  return ranked.map(({ profile }) => profile);
}
