import { createUploadthing, type FileRouter } from "uploadthing/next"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

const f = createUploadthing()

// UploadThing File Router
export const uploadRouter = {
  // Profile image uploader - single image for main profile picture
  profileImage: f({ image: { maxFileSize: "8MB", maxFileCount: 1 } })
    .middleware(async () => {
      const headersList = await headers()
      const session = await auth.api.getSession({ headers: headersList })

      if (!session) throw new Error("Unauthorized")

      return { userId: session.user.id }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Profile image upload complete for userId:", metadata.userId)
      console.log("File URL:", file.url)

      return { url: file.url, userId: metadata.userId }
    }),

  // Profile photos uploader - multiple images for profile gallery (up to 6)
  profilePhotos: f({ image: { maxFileSize: "8MB", maxFileCount: 6 } })
    .middleware(async () => {
      const headersList = await headers()
      const session = await auth.api.getSession({ headers: headersList })

      if (!session) throw new Error("Unauthorized")

      return { userId: session.user.id }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Profile photos upload complete for userId:", metadata.userId)
      console.log("File URL:", file.url)

      return { url: file.url, userId: metadata.userId }
    }),
} satisfies FileRouter

export type UploadRouter = typeof uploadRouter
