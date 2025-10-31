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
      try {
        const session = await getServerSession(req.headers)

        if (!session?.user) {
          console.error("Upload failed: No session found")
          throw new UploadThingError("Unauthorized")
        }

        console.log("Upload authorized for user:", session.user.id)
        return { userId: session.user.id }
      } catch (error) {
        console.error("Upload middleware error:", error)
        throw error
      }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      try {
        console.log("Upload complete, saving to DB:", file.name)

        const maxOrderFile = await db.file.findFirst({
          where: { userId: metadata.userId },
          orderBy: { order: "desc" },
          select: { order: true },
        })

        const nextOrder = (maxOrderFile?.order ?? -1) + 1

        const uploadedFile = await db.file.create({
          data: {
            userId: metadata.userId,
            url: file.url,
            key: file.key,
            name: file.name,
            size: file.size,
            type: file.type,
            order: nextOrder,
          },
        })

        console.log("File saved to DB with ID:", uploadedFile.id)

        return {
          url: file.url,
          key: file.key,
          fileId: uploadedFile.id,
          name: file.name,
          size: file.size,
          type: file.type,
        }
      } catch (error) {
        console.error("Upload onUploadComplete error:", error)
        throw error
      }
    }),

  // Message attachment uploader - images and files for chat messages
  messageAttachment: f({
    image: { maxFileSize: "8MB", maxFileCount: 1 },
    pdf: { maxFileSize: "16MB", maxFileCount: 1 },
    video: { maxFileSize: "32MB", maxFileCount: 1 }
  })
    .middleware(async ({ req }) => {
      const session = await getServerSession(req.headers)

      if (!session?.user) {
        throw new UploadThingError("Unauthorized")
      }

      return { userId: session.user.id }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // Note: We don't store message attachments in the File table
      // They will be stored directly in the Message model
      return {
        url: file.url,
        key: file.key,
        name: file.name,
        size: file.size,
        type: file.type
      }
    }),
} satisfies FileRouter

export type UploadRouter = typeof uploadRouter

// Export client-side helper for components
export const { useUploadThing } = generateReactHelpers<UploadRouter>()

// UploadThing API route handlers
export const { GET, POST } = createRouteHandler({
  router: uploadRouter,
})
