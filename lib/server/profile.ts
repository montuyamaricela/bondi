import { db } from '@/lib/db';
import { createAppError } from '@/lib/app-error';
import type { ProfileFields } from '@/lib/profile-validation';

function profileData(input: ProfileFields) {
  const {
    name,
    age,
    bio,
    gender,
    location,
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
    location,
    interests,
    hobbies,
    lookingFor,
    relationshipType,
    genderPreference,
  };
}

export async function getProfileByUserId(userId: string) {
  return await db.profile.findUnique({
    where: { userId },
  });
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
    const profile = await transaction.profile.update({ where: { userId }, data });
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
    return { ...profile, photos };
  });
}
