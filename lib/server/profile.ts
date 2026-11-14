import { db } from '@/lib/db';
import { createAppError } from '@/lib/app-error';
import type { ProfileFields } from '@/lib/profile-validation';
import type { Prisma } from '@prisma/client';
import { publicLocation } from '@/lib/location';

export function profileForOwner(
  profile: Prisma.ProfileGetPayload<{ include: { locationCity: true } }>,
) {
  return {
    id: profile.id,
    userId: profile.userId,
    name: profile.name,
    age: profile.age,
    bio: profile.bio,
    gender: profile.gender,
    interests: profile.interests,
    hobbies: profile.hobbies,
    lookingFor: profile.lookingFor,
    relationshipType: profile.relationshipType,
    genderPreference: profile.genderPreference,
    showOnlineStatus: profile.showOnlineStatus,
    showDistance: profile.showDistance,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    ...publicLocation(profile),
  };
}

function profileData(input: ProfileFields) {
  const {
    name,
    age,
    bio,
    gender,
    interests,
    hobbies,
    lookingFor,
    relationshipType,
    genderPreference,
  } = input;
  return {
    name,
    age,
    bio,
    gender,
    interests,
    hobbies,
    lookingFor,
    relationshipType,
    genderPreference,
  };
}

export async function getProfileByUserId(userId: string) {
  const profile = await db.profile.findUnique({
    where: { userId },
    include: { locationCity: true },
  });
  return profile ? profileForOwner(profile) : null;
}

export async function createProfile(userId: string, input: ProfileFields) {
  const data = profileData(input);
  return db.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    if (await transaction.profile.findUnique({ where: { userId }, select: { id: true } }))
      throw createAppError('Profile already exists', 400, 'PROFILE_EXISTS');
    await transaction.user.update({ where: { id: userId }, data: { name: data.name } });
    return transaction.profile.create({ data: { ...data, userId } });
  });
}

export async function updateProfile(
  userId: string,
  input: ProfileFields & { photoKeys?: string[] },
) {
  const data = profileData(input);
  return db.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    if (!(await transaction.profile.findUnique({ where: { userId }, select: { id: true } })))
      throw createAppError('Profile not found', 404, 'NOT_FOUND');
    if (input.photoKeys !== undefined) {
      const files = await transaction.file.findMany({ where: { userId }, select: { key: true } });
      const keys = new Set(files.map((file) => file.key));
      if (
        keys.size !== files.length ||
        input.photoKeys.length !== files.length ||
        new Set(input.photoKeys).size !== input.photoKeys.length ||
        input.photoKeys.some((key) => !keys.has(key))
      )
        throw createAppError(
          'Your saved photos changed. Refresh and try again.',
          400,
          'INVALID_PHOTO_ORDER',
        );
    }
    await transaction.user.update({ where: { id: userId }, data: { name: data.name } });
    const profile = await transaction.profile.update({
      where: { userId },
      data,
      include: { locationCity: true },
    });
    for (const [order, key] of (input.photoKeys ?? []).entries()) {
      const updated = await transaction.file.updateMany({
        where: { userId, key },
        data: { order },
      });
      if (updated.count !== 1)
        throw createAppError(
          'Saved photos changed. Refresh and try again.',
          409,
          'PHOTO_ORDER_CHANGED',
        );
    }
    const photos = await transaction.file.findMany({
      where: { userId },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    });
    return { ...profileForOwner(profile), photos };
  });
}
