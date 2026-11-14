import type { UploadedFileData } from 'uploadthing/types';
import { UploadThingError } from 'uploadthing/server';
import { db } from '@/lib/db';

const maxProfilePhotos = 6;
const capacityError = () =>
  new UploadThingError({
    code: 'BAD_REQUEST',
    message: 'You can save up to 6 profile photos. Refresh your gallery and try again.',
  });

export async function checkProfilePhotoCapacity(userId: string, requested: number) {
  const count = await db.file.count({ where: { userId } });
  if (count + requested > maxProfilePhotos) throw capacityError();
}

export async function registerProfilePhoto(userId: string, file: UploadedFileData) {
  return db.$transaction(async (transaction) => {
    // Share the profile editor's account lock so appends and reorders serialize.
    const users = await transaction.$queryRaw<
      Array<{ id: string }>
    >`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    if (!users.length)
      throw new UploadThingError({ code: 'FORBIDDEN', message: 'Account unavailable' });
    const existing = await transaction.file.findFirst({
      where: { key: file.key },
      orderBy: { id: 'asc' },
    });
    if (existing) {
      if (existing.userId !== userId)
        throw new UploadThingError({ code: 'FORBIDDEN', message: 'Photo unavailable' });
      return existing;
    }
    if ((await transaction.file.count({ where: { userId } })) >= maxProfilePhotos)
      throw capacityError();
    const last = await transaction.file.findFirst({
      where: { userId },
      orderBy: [{ order: 'desc' }, { id: 'desc' }],
      select: { order: true },
    });
    return transaction.file.create({
      data: {
        userId,
        url: file.ufsUrl,
        key: file.key,
        name: file.name,
        size: file.size,
        type: file.type,
        order: (last?.order ?? -1) + 1,
      },
    });
  });
}
