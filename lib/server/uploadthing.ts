import { createUploadthing, type FileRouter } from 'uploadthing/next';
import { UploadThingError } from 'uploadthing/server';
import { getServerSession } from '@/lib/session';
import { checkProfilePhotoCapacity, registerProfilePhoto } from '@/lib/server/profile-photos';
import { registerMessageAttachment } from '@/lib/server/messages';
import { UPLOAD_USER_HEADER, UPLOAD_SESSION_HEADER } from '@/lib/upload-owner';

const f = createUploadthing();

async function authorizeUpload(req: Request) {
  const session = await getServerSession(req.headers);
  if (!session?.user) throw new UploadThingError({ code: 'FORBIDDEN', message: 'Unauthorized' });
  const userId = req.headers.get(UPLOAD_USER_HEADER);
  const sessionId = req.headers.get(UPLOAD_SESSION_HEADER);
  // Older API clients may omit both; first-party uploaders always send the pair.
  if (userId !== null || sessionId !== null) {
    if (!userId || !sessionId || userId.length > 128 || sessionId.length > 128)
      throw new UploadThingError({ code: 'BAD_REQUEST', message: 'Invalid upload owner' });
    if (userId !== session.user.id || sessionId !== session.session.id)
      throw new UploadThingError({ code: 'FORBIDDEN', message: 'Your upload session changed' });
  }
  return { userId: session.user.id };
}

async function authorizeProfileUpload({ req, files }: { req: Request; files: readonly unknown[] }) {
  const owner = await authorizeUpload(req);
  await checkProfilePhotoCapacity(owner.userId, files.length);
  return owner;
}

export const uploadRouter = {
  // Both entry points count toward the same owned gallery limit.
  profileImage: f({ image: { maxFileSize: '8MB', maxFileCount: 1 } })
    .middleware(authorizeProfileUpload)
    .onUploadComplete(async ({ metadata, file }) => {
      const saved = await registerProfilePhoto(metadata.userId, file);
      return { url: saved.url, key: saved.key, fileId: saved.id };
    }),
  profilePhotos: f({ image: { maxFileSize: '8MB', maxFileCount: 6 } })
    .middleware(authorizeProfileUpload)
    .onUploadComplete(async ({ metadata, file }) => {
      const saved = await registerProfilePhoto(metadata.userId, file);
      return {
        url: saved.url,
        key: saved.key,
        fileId: saved.id,
        name: saved.name,
        size: saved.size,
        type: saved.type,
      };
    }),

  // Message attachment uploader - images and files for chat messages
  messageAttachment: f({
    image: { maxFileSize: '8MB', maxFileCount: 1 },
    pdf: { maxFileSize: '16MB', maxFileCount: 1 },
    video: { maxFileSize: '32MB', maxFileCount: 1 },
  })
    .middleware(({ req }) => authorizeUpload(req))
    .onUploadComplete(async ({ metadata, file }) => {
      const attachment = await registerMessageAttachment(metadata.userId, {
        key: file.key,
        url: file.ufsUrl,
        name: file.name,
        size: file.size,
        type: file.type,
      });
      return {
        url: attachment.url,
        key: attachment.key,
        name: attachment.name,
        size: attachment.size,
        type: attachment.type,
      };
    }),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
