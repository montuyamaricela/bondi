# HTTP and native Realtime verification after Socket.IO retirement

[#81](https://github.com/montuyamaricela/bondi/issues/81) removes the three custom
socket runtimes, browser provider, token route, dependencies/transitives, listener
configuration and delivery-exclusion metadata. Standard Next dev/start owns one
HTTP listener; Supabase is the sole live transport. Existing migration history is
immutable. Migration 23 drops only the unused delivery column, preserving intents.

## Preserved assertions

Former transport topology duplicates are mapped to authoritative HTTP/native
behavior. The retired socket-session/provider suites have no runtime to exercise;
their authorization and ownership assertions remain covered as follows:

- `tests/supabase/transport-retirement.spec.ts`: valid controls for each live HTTP
  action, then next-request expiry/revocation rejection and no message/read/typing/
  match side effects. Real private subscribers verify the valid peer still receives
  hints while a retired session does not. The same suite verifies removed endpoints
  return 404, zero obsolete browser requests, actual native connections, mutual-like
  MATCH notification effects, preferences, repeated hints, inactive/foreign/missing
  match eligibility and no historical replay on reload.
- `tests/supabase/realtime-provider-lifecycle.spec.ts`: delayed credential fetch/parse,
  logout, changed cookies, same-owner refresh and replacement-session ownership.
  Native presence lifecycle adds signed-close ordering and held heartbeat races.
- `tests/supabase/chat-activity.spec.ts`: bounded/monotonic receipts, foreign/ended
  membership rejection, sequenced short-lived typing, actual browser updates,
  disconnected sending, manual recovery and stale-owner draft protection.
- `tests/supabase/presence-lifecycle.spec.ts`: real multi-tab joins/leaves, deadlines,
  privacy, former-peer denial, unmatch in both chats, cleanup and degraded recovery.
  Server expiry uses controlled fixture deadlines; this is separate from a full
  wall-clock outage rehearsal.
- `tests/e2e/authenticated-journey.spec.ts`: complete synthetic account/profile/
  login/match/chat/history journey, outsider HTTP denial and zero private native
  hints to an outsider. Protected profile projections remain unchanged.
- `tests/e2e/message-validation.spec.ts`: four independent HTTP validation waves
  preserve payload limits, trusted callback registration, attachment provenance,
  forged metadata, actor forgery, expired sessions and ended-match assertions.
- `tests/e2e/message-retry.spec.ts`: four independent eight-request concurrency
  waves preserve canonical IDs, conflicts, sender/conversation scoping and exact
  message/notification counts. A dropped real HTTP response retains the draft and
  request ID for manual retry; database rejection retains the draft too.
- `tests/e2e/message-delivery.spec.ts`: real private off-room subscribers across
  sender/receiver/another sender device/outsider, expired audiences, both inboxes,
  browser preferences, transaction rollback, repeated-hint deduplication and managed
  cron pause/restart recovery. Pending intents survive failure/restart.
- `tests/e2e/chat-recovery.spec.ts`: actual native WebSocket loss, HTTP sending
  during outage, populated-history reconciliation, delayed reads, receipt retention,
  ordering, draft and scroll behavior. Existing pagination cases retain cursor/
  timestamp/ownership and continuation assertions.
- `tests/e2e/location-projections.spec.ts`: original HTTP projection/radius/history
  assertions plus actual minimal native hints. Neither exact coordinates nor a
  private city association is carried by live frames.
- `tests/e2e/presence-lifecycle.spec.ts` and `unmatch-lifecycle.spec.ts`: retained
  browser indicators/navigation/privacy and both open read-only conversations.

These paths name current suites; command output establishes their actual pass/fail
results. A coverage map alone is not verification evidence.

## Required evidence and scope

`npm run check` includes a fresh build and `check:realtime`, which scans maintained
runtime/configuration sources, the committed dependency lock and actual generated
server/browser JavaScript for retired transport references. Its harness regression
requires a failing exit code when source, dependencies or bundles regress. A clean
CI checkout installs with `npm ci` and independently runs the same guard.

The ordinary PostgreSQL CI job proves migration/schema, unit, types, strict lint,
formatting and production-build compatibility. It does not run live application
journeys. Native CI prepares its own Supabase PostgreSQL 17 stack and runs all
retained application journeys plus the non-skipping native authorization/delivery/
owner/privacy tests. Local commit hooks deliberately use that prepared native target.
Infrastructure preparation and migrations remain explicit setup operations.

Synthetic fixtures and OS-notification adapters do not establish external upload
completion, physical GPS, other browsers, a full wall-clock production outage,
hosted capacity or production cutover. The populated migration/rollback rehearsal
and final readiness audit are separate [#82](https://github.com/montuyamaricela/bondi/issues/82)
and [#83](https://github.com/montuyamaricela/bondi/issues/83) deliverables.
