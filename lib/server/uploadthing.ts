import { createUploadthing, type FileRouter } from 'uploadthing/next';
import { UploadThingError } from 'uploadthing/server';
import { getServerSession } from '@/lib/session';
import { checkProfilePhotoCapacity, registerProfilePhoto } from '@/lib/server/profile-photos';
import { registerMessageAttachment } from '@/lib/server/messages';

const f = createUploadthing();

async function authorizeProfileUpload({ req, files }: { req: Request; files: readonly unknown[] }) {
  const session = await getServerSession(req.headers);
  if (!session?.user) throw new UploadThingError({ code: 'FORBIDDEN', message: 'Unauthorized' });
  await checkProfilePhotoCapacity(session.user.id, files.length);
  return { userId: session.user.id };
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
    .middleware(async ({ req }) => {
      const session = await getServerSession(req.headers);

      if (!session?.user) {
        throw new UploadThingError({ code: 'FORBIDDEN', message: 'Unauthorized' });
      }

      return { userId: session.user.id };
    })
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
