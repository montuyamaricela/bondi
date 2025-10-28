import { createRouteHandler } from "uploadthing/next"
import { uploadRouter } from "./core"

// UploadThing API route handlers
export const { GET, POST } = createRouteHandler({
  router: uploadRouter,
})
