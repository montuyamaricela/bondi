import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/session';
import { getProfileByUserId } from '@/lib/server/profile';
import { safeCallbackUrl, profileSetupDestination } from '@/lib/auth-navigation';

// Force middleware to use Node.js runtime to support Prisma
export const runtime = 'nodejs';

// Define public routes that don't require authentication
const publicRoutes = [
  '/login',
  '/signup',
  '/', // Landing page
];

// Define API routes that don't require authentication
const publicApiRoutes = [
  '/api/auth', // Better Auth endpoints
  '/api/uploadthing', // UploadThing endpoints
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if it's an API route
  const isApiRoute = pathname.startsWith('/api/');

  // Check if it's a public API route
  const isPublicApiRoute = publicApiRoutes.some((route) => pathname.startsWith(route));

  // Skip middleware for public API routes (they handle auth internally)
  if (isApiRoute && isPublicApiRoute) {
    return NextResponse.next();
  }

  // Check if the path is a public route
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + '/'),
  );

  // Get the session
  const session = await getServerSession(request.headers);

  // If user is authenticated but trying to access auth pages, redirect based on profile status
  if (session && (pathname === '/login' || pathname === '/signup')) {
    const values = request.nextUrl.searchParams.getAll('callbackUrl');
    const callbackUrl = safeCallbackUrl(values.length === 1 ? values[0] : undefined);
    try {
      const profile = await getProfileByUserId(session.user.id);
      return NextResponse.redirect(
        new URL(profile ? callbackUrl : profileSetupDestination(callbackUrl), request.url),
      );
    } catch {
      // A failed lookup is not evidence that onboarding is missing.
      console.error('Profile lookup unavailable during authentication redirect');
      if (pathname === '/signup') {
        const login = new URL('/login', request.url);
        login.searchParams.set('callbackUrl', callbackUrl);
        return NextResponse.redirect(login);
      }
      return NextResponse.next();
    }
  }

  // If there's no session and the route is not public
  if (!session && !isPublicRoute) {
    // For API routes, let them handle authentication and return proper error responses
    if (isApiRoute) {
      return NextResponse.next();
    }

    // For non-API routes, redirect to login
    const url = new URL('/login', request.url);
    url.searchParams.set('callbackUrl', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  // Continue with the request
  return NextResponse.next();
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
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|public/).*)',
  ],
};
