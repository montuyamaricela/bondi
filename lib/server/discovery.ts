import type { Profile } from '@prisma/client';
import { db } from '@/lib/db';
import { calculateDistance } from '@/lib/geolocation';
import { calculateCompatibilityScore } from '@/lib/matching-utils';
import type { DiscoverFiltersFormData } from '@/app/components/features/discover/validation';
import type { DiscoverableProfile } from '@/app/components/features/discover/types';

export async function discoverProfiles(current: Profile, filters: DiscoverFiltersFormData) {
  const ranked: DiscoverableProfile[] = [];
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
        location: true,
        interests: true,
        hobbies: true,
        lookingFor: true,
        relationshipType: true,
        showDistance: true,
        latitude: true,
        longitude: true,
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
      const distance =
        current.latitude !== null &&
        current.longitude !== null &&
        profile.latitude !== null &&
        profile.longitude !== null
          ? calculateDistance(
              { latitude: current.latitude, longitude: current.longitude },
              { latitude: profile.latitude, longitude: profile.longitude },
            )
          : null;
      if (filters.distance !== undefined && (distance === null || distance > filters.distance))
        continue;
      const distanceScore = distance !== null ? Math.max(0, 100 - distance / 5) : 0;
      ranked.push({
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
        photos: profile.user.files,
        compatibilityScore:
          calculateCompatibilityScore(current, profile) * 0.7 + distanceScore * 0.3,
      });
    }
    // Rank all eligible candidates while keeping memory bounded to a batch and ten winners.
    ranked.sort(
      (a, b) =>
        b.compatibilityScore - a.compatibilityScore || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
    ranked.length = Math.min(ranked.length, 10);
    cursor = profiles.at(-1)?.id;
    more = profiles.length === 100;
  }
  return ranked;
}
