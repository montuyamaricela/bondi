import { createUploadthing, type FileRouter } from "uploadthing/next"
import { createRouteHandler } from "uploadthing/next"
import { UploadThingError } from "uploadthing/server"
import { getServerSession } from "@/lib/session"
import { db } from "@/lib/db"
import { generateReactHelpers } from "@uploadthing/react"

const f = createUploadthing()

export const uploadRouter = {
  // Profile image uploader - single image for main profile picture
  profileImage: f({ image: { maxFileSize: "8MB", maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      const session = await getServerSession(req.headers)

      if (!session?.user) {
        throw new UploadThingError("Unauthorized")
      }

      return { userId: session.user.id }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const uploadedFile = await db.file.create({
        data: {
          userId: metadata.userId,
          url: file.url,
          key: file.key,
          name: file.name,
          size: file.size,
          type: file.type,
        },
      })

      return { url: file.url, key: file.key, fileId: uploadedFile.id }
    }),

  // Profile photos uploader - multiple images for profile gallery (up to 6)
  profilePhotos: f({ image: { maxFileSize: "8MB", maxFileCount: 6 } })
    .middleware(async ({ req }) => {
      const session = await getServerSession(req.headers)

      if (!session?.user) {
        throw new UploadThingError("Unauthorized")
      }

      return { userId: session.user.id }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const uploadedFile = await db.file.create({
        data: {
          userId: metadata.userId,
          url: file.url,
          key: file.key,
          name: file.name,
          size: file.size,
          type: file.type,
        },
      })

      return { url: file.url, key: file.key, fileId: uploadedFile.id }
    }),
} satisfies FileRouter

export type UploadRouter = typeof uploadRouter

// Export client-side helper for components
export const { useUploadThing } = generateReactHelpers<UploadRouter>()

// UploadThing API route handlers
export const { GET, POST } = createRouteHandler({
  router: uploadRouter,
})
