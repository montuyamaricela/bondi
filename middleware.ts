import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

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

  // Check if the path is a public route
  const isPublicRoute = publicRoutes.some((route) => pathname === route || pathname.startsWith(route + "/"))

  // Check if it's an API route
  const isApiRoute = pathname.startsWith("/api/")

  // Check if it's a public API route
  const isPublicApiRoute = publicApiRoutes.some((route) => pathname.startsWith(route))

  // Skip middleware for public routes and public API routes
  if (isPublicRoute || (isApiRoute && isPublicApiRoute)) {
    return NextResponse.next()
  }

  // Get the session using Better Auth
  const session = await auth.api.getSession({
    headers: request.headers,
  })

  // If there's no session and the route is not public, redirect to login
  if (!session && !isPublicRoute) {
    const url = new URL("/login", request.url)
    url.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(url)
  }

  // If user is authenticated but trying to access auth pages, redirect to main app
  if (session && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/profile", request.url))
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
