# Bondi architecture

Bondi is a server-rendered Next.js dating app with PostgreSQL/Prisma, Better Auth,
UploadThing, React Query, and Socket.IO. It cannot use Photo Booth's static-export
and Cloudflare Worker architecture without a separate runtime redesign.

## Current ownership

- `app/(auth)/` and `app/(main)/` compose authentication and protected pages.
- `app/api/` owns HTTP handlers, authentication checks, input validation, and
  response serialization. Many handlers currently query Prisma directly.
- `app/components/features/` groups auth, profile, discover, matching, messaging,
  settings, layout, and landing components. Feature hooks and contracts live here.
- `app/components/ui/` contains shared shadcn/ui and app-specific primitives;
  `app/components/providers/` owns query, theme, and socket providers.
- `lib/client/` wraps browser requests. `lib/server/profile.ts` is an existing
  server data seam. `lib/auth.ts`, `lib/db.ts`, and `lib/session.ts` wire auth/data.
- `lib/matching-utils.ts`, `lib/geolocation.ts`, and date/initial utilities expose
  reusable calculations. Keep pure computations separate from network effects.
- `prisma/schema/` is a multi-file schema selected by `prisma.config.ts`;
  `prisma/migrations/` is its migration history.
- `server.ts` hosts Next and Socket.IO together. `socket-server.ts` hosts sockets
  separately. `lib/socket.ts` also contains setup logic and shared event types.

## Runtime cautions

The sample environment points sockets at the combined app server on port 3000.
`npm run dev` starts that process. The optional `npm run socket` entry point uses
port 3001; point clients at it only when intentionally choosing that topology.
Choose one topology explicitly before diagnosing real-time delivery.

`lib/socket-instance.ts` stores an in-process singleton. Separate processes do not
share it. An HTTP handler emitting through that singleton does not establish
delivery to clients connected to the other process.

`lib/session.ts` owns the server session helper; browser components import the
session hook directly from `lib/auth-client.ts` so Prisma/server auth stay out of
browser bundles. Middleware performs server auth/profile lookups. Run browser checks against
a disposable test PostgreSQL instance to keep any session-dependent queries isolated.

All three socket owners capture the database session ID during an authoritative
handshake and share incoming-action validation in `lib/server/socket-session.ts`.
An invalid/expired/revoked session receives `auth:error` and disconnects before the
action handler runs. Authorization completions stay in packet order; late profile
initialization stops after disconnect. Match policies remain in the event owners.
The socket lifecycle test exercises this contract in all three runtimes; idle
session termination and broader presence behavior need separate coverage.

## Structural work after the harness

1. Extend the authenticated journey with remaining lifecycle/privacy boundaries,
   uploads, and additional ownership boundaries before moving their data code.
   Current coverage exercises onboarding, mutual matches, live chat/history, and
   outsider match/message denial through the combined server. Separate cases cover
   authoritative HTTP revocation/renewal and event-time socket validity across owners.
2. Define one socket runtime owner; consolidate the three event implementations
   behind tested authorization and delivery interfaces. Exercise two synthetic
   users, a non-member, unmatch, reconnect, typing, and read receipts.
3. Extract one domain operation at a time from handlers into `lib/server/`, using
   the existing profile operation as a starting point. Keep route contracts stable.
4. Separate mixed browser/server modules and colocate remaining feature contracts
   as callers change. Avoid a wholesale `src/` move with no behavioral benefit.

These are follow-up slices, not completed refactors. The harness establishes the
instructions, discovery, checks, and initial behavioral coverage for doing them.
