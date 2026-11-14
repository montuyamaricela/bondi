import { db } from '@/lib/db';
import { createAppError } from '@/lib/errors';

type DeleteStoredPhoto = (key: string) => Promise<{ success: boolean; deletedCount: number }>;

export async function deleteProfilePhoto(
  userId: string,
  key: string,
  deleteFromStorage: DeleteStoredPhoto,
) {
  if (typeof key !== 'string' || !key || key.length > 512)
    throw createAppError('Invalid photo key', 400);
  const file = await db.file.findFirst({ where: { userId, key }, select: { id: true } });
  if (!file) throw createAppError('File not found', 404);

  try {
    const result = await deleteFromStorage(key);
    if (!result.success) throw new Error('Storage deletion was not confirmed');
  } catch {
    // Retain the owned key; neither absent configuration nor a failed request proves deletion.
    throw createAppError(
      'Photo deletion could not be completed. Please try again.',
      503,
      'PHOTO_DELETE_RETRY',
    );
  }

  try {
    // A successful zero-count response also confirms an already removed object on retry.
    await db.file.deleteMany({ where: { userId, key } });
  } catch {
    throw createAppError(
      'Photo deletion could not be completed. Please try again.',
      503,
      'PHOTO_DELETE_RETRY',
    );
  }
}
