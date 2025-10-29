/**
 * Session Management Utilities
 *
 * Better Auth provides different methods for accessing sessions:
 * - Client Components: Use `useSession()` hook
 * - Server Components/API Routes/Middleware: Use `getServerSession()`
 */

import { auth } from "@/lib/auth"
import type { Session } from "@/lib/auth"

/**
 * Get session on the server side
 *
 * Use this in:
 * - Server Components
 * - API Routes
 * - Middleware
 * - Server Actions
 *
 * @param headers - Request headers from Next.js
 * @returns Session object or null
 *
 * @example
 * // In Server Component
 * import { getServerSession } from "@/lib/session"
 *
 * export default async function MyPage() {
 *   const session = await getServerSession(
 *     await import('next/headers').then(m => m.headers())
 *   )
 * }
 *
 * @example
 * // In API Route
 * import { getServerSession } from "@/lib/session"
 *
 * export async function GET(request: NextRequest) {
 *   const session = await getServerSession(request.headers)
 * }
 *
 * @example
 * // In Middleware
 * import { getServerSession } from "@/lib/session"
 *
 * export async function middleware(request: NextRequest) {
 *   const session = await getServerSession(request.headers)
 * }
 */
export async function getServerSession(headers: Headers): Promise<Session | null> {
  const session = await auth.api.getSession({ headers })
  return session
}

/**
 * For Client Components, use the hook directly:
 *
 * @example
 * 'use client'
 *
 * import { useSession } from '@/lib/auth-client'
 *
 * export function MyComponent() {
 *   const { data: session, isPending, error } = useSession()
 *
 *   if (isPending) return <div>Loading...</div>
 *   if (error) return <div>Error: {error.message}</div>
 *   if (!session) return <div>Not logged in</div>
 *
 *   return <div>Welcome, {session.user.name}!</div>
 * }
 */
export { useSession } from "@/lib/auth-client"
