import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/session"
import { getProfileByUserId } from "@/lib/server/profile"

// Force middleware to use Node.js runtime to support Prisma
export const runtime = 'nodejs'

// Define public routes that don't require authentication
const publicRoutes = [
  "/login",
  "/signup",
  "/", // Landing page
]

// Define API routes that don't require authentication
const publicApiRoutes = [
  "/api/auth", // Better Auth endpoints
  "/api/uploadthing", // UploadThing endpoints
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if it's an API route
  const isApiRoute = pathname.startsWith("/api/")

  // Check if it's a public API route
  const isPublicApiRoute = publicApiRoutes.some((route) => pathname.startsWith(route))

  // Skip middleware for public API routes (they handle auth internally)
  if (isApiRoute && isPublicApiRoute) {
    return NextResponse.next()
  }

  // Check if the path is a public route
  const isPublicRoute = publicRoutes.some((route) => pathname === route || pathname.startsWith(route + "/"))

  // Get the session
  const session = await getServerSession(request.headers)

  // If user is authenticated but trying to access auth pages, redirect based on profile status
  if (session && (pathname === "/login" || pathname === "/signup")) {
    const profile = await getProfileByUserId(session.user.id)

    if (profile) {
      return NextResponse.redirect(new URL("/discover", request.url))
    } else {
      return NextResponse.redirect(new URL("/profile/setup", request.url))
    }
  }

  // If there's no session and the route is not public, redirect to login
  if (!session && !isPublicRoute) {
    const url = new URL("/login", request.url)
    url.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(url)
  }

  // Continue with the request
  return NextResponse.next()
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*|public/).*)",
  ],
}
