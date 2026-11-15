# Bondi architecture

Bondi is a server-rendered Next.js dating app with PostgreSQL/Prisma, Better Auth,
UploadThing, React Query, and Supabase Realtime. It cannot use Photo Booth's static-export
and Cloudflare Worker architecture without a separate runtime redesign.

## Current ownership

- `app/(auth)/` and `app/(main)/` compose authentication and protected pages.
- `app/api/` owns HTTP handlers, authentication checks, input validation, and
  response serialization. Many handlers currently query Prisma directly.
- `app/components/features/` groups auth, profile, discover, matching, messaging,
  settings, layout, and landing components. Feature hooks and contracts live here.
- `app/components/ui/` contains shared shadcn/ui and app-specific primitives;
  `app/components/providers/` owns query, theme, and session-owned Realtime providers.
- `lib/client/` wraps browser requests. `lib/server/profile.ts` is an existing
  server data seam. `lib/auth.ts`, `lib/db.ts`, and `lib/session.ts` wire auth/data.
- `lib/matching-utils.ts`, `lib/geolocation.ts`, and date/initial utilities expose
  reusable calculations. Keep pure computations separate from network effects.
- `prisma/schema/` is a multi-file schema selected by `prisma.config.ts`;
  `prisma/migrations/` is its migration history.
- `lib/server/env.ts` owns validated server configuration; `lib/client/env.ts`
  owns public Supabase URL/key reads, with pure validation in `lib/configuration.ts`.
  Prisma CLI uses a direct/session `DIRECT_URL` (or a non-transaction
  `DATABASE_URL` fallback). Prisma Client explicitly uses `DATABASE_URL` for
  runtime pooling. Neither generation nor build applies migrations. Auth and public
  origins are required in production; configuration failures omit supplied values.
- Standard Next dev/start owns one HTTP listener; browsers connect directly to
  Supabase Realtime. No custom application WebSocket server is required.

## Runtime cautions

Application tables are private to the server connection: the additive RLS/grant
migration denies anonymous/authenticated Data API table access, while server HTTP
operations retain their session/ownership checks. The explicit native Supabase test
stack and its test-only marker schema are described in [native setup](supabase-testing.md).
Prisma owns app migrations; the harness does not modify Supabase-owned native schemas.

The [Supabase subscription owner](realtime.md) uses server-issued ES256
credentials and random, receive-only session leases. Its private native policy
checks the live Better Auth session through a private boolean lookup. Minimal hints
invalidate authorized HTTP queries; neither cached channel permissions nor a JWT
authorize application reads/writes. Chat uses authenticated HTTP commands and
online status uses server liveness with authorized snapshots. Supabase is the sole
live transport. Absent public configuration produces disconnected status; durable
writes still require the installed native dispatcher. The [decision](adr/0001-session-owned-realtime.md)
records privacy constraints and retained authentication/schema ownership.

`lib/server/chat-activity.ts` owns bounded read receipts and ephemeral typing behind
thin match routes. Every operation checks the current session, expected browser
owner and active membership; writes serialize with unmatch. Private typing rows
bind a subscription lease and chat-view UUID, order updates by sequence, and expire
within five seconds. The managed retention job keeps ordering markers until their
parent expires and skips renewal locks. Peer snapshots expose no session/device
metadata. Native chat sends through the existing HTTP persistence operation with
stable retries and guarded draft generations; SDK readiness does not authorize or
gate message persistence. The native provider exposes owned connection/lease status
and explicit retry, while client cleanup aborts activity and late send continuations.

Standard Next listener flags configure the application origin. Infrastructure
preparation and migrations remain explicit, separate operations; builds and starts
do not provision Supabase or apply schema changes.

`lib/session.ts` owns the server session helper; browser components import the
session hook directly from `lib/auth-client.ts` so Prisma/server auth stay out of
browser bundles. Middleware performs server auth/profile lookups. Run browser checks against
a disposable test PostgreSQL instance to keep any session-dependent queries isolated.

`lib/auth-navigation.ts` owns root-relative callback validation and the onboarding
return URL. It preserves safe internal paths/queries, rejects external/protocol-relative
URLs, backslashes, controls, malformed encoding, nested separator/control escapes and auth/API/onboarding
loops, and falls back to discovery. Middleware retains the requested path and query
when sending anonymous users to login and honors the validated callback for an
already authenticated user with a profile. A failed profile lookup passes through
to login recovery rather than inferring a missing profile; signup failures return
to that recovery page with the safe destination. Logs omit the exception.

The login page passes the server-resolved identity into `LoginForm` for authenticated
recovery. After a successful sign-in the form clears credentials and old profile
caches, then reads a fresh profile independently of cached data. Only an explicit
null profile starts onboarding; a failed/malformed/wrong-owner result offers Retry
profile check and Reload sign-in without resubmitting credentials. Owned abort
controllers suppress late routing/state effects after unmount. Onboarding carries
the same safe destination through its existing success delay and existing-profile
guard. Default flows keep the bare setup URL and return to discovery. These navigation
checks do not replace authorization at protected pages or API operations.

`lib/server/native-presence.ts` owns online status.
Each connected tab refreshes a private `RealtimeLease` liveness deadline through
HTTP every 20 seconds. The server caps it at 60 seconds and at lease/session expiry;
ordered leave/heartbeat requests cannot resurrect an older state. Native snapshots
combine active peer membership, current visibility and live valid sessions/leases.
They expose only visible/online booleans. Private hints refresh peers after normal
join/leave, privacy changes, session deletion and both participants after unmatch.
The provider owns heartbeat timers, request aborts, retry errors and cleanup.
Observers poll every 15 seconds with a five-second request bound, hide stale results
on errors/disconnection/hidden documents and revalidate on focus. Abrupt-loss
detection is bounded rather than instantaneous; the maintained [contract](realtime.md)
records the limits.

Settings carries the server snapshot's account/session identity into its owned
form. Online-visibility writes serialize through one pending operation, include
that captured identity and use the canonical HTTP result. A changed session
refreshes the server snapshot before mounting new settings, while old requests
and late effects are disposed. This does not replace server authorization or
serialize commands from separate clients.

`RealtimeProvider` owns a subscription by account and session. Credential replies
are bound to the expected owner, and cleanup aborts outstanding requests, removes
channels/listeners/timers and closes only its lease. Delayed responses cannot
replace the next owner. Focus revalidates credentials; reconnect refreshes canonical HTTP queries.
Credential POST attempts have an eight-second deadline through body consumption.
Each attempt composes owner disposal with its own cancellation; timeout releases
the pending operation into bounded retry, without aborting the reusable owner.
The cancellation race ignores late parsing and clears its deadline after a complete
body, before SDK setup. No shared request framework or alternate transport is added.

`lib/server/messages.ts` is the authoritative HTTP write operation. It validates
untrusted payloads and owned attachments, locks the active match, and commits the
message, receiver notification and per-user `MessageDelivery` intents together.
Unmatch waits for accepted sends to commit. Identified retries return the canonical
message without duplicating effects; conflicting payloads remain rejected. The
trusted upload callback still registers attachment ownership separately.

The [managed database outbox](realtime.md#durable-message-hints) publishes private
invalidations within the persistence transaction and retries due intents through
pg_cron. A hint carries only an opaque random event ID. Dispatch rechecks active
membership and live session leases, verifies native enqueue, and isolates per-intent
failures. Notification effects consume account/session-owned HTTP results, baseline
historical rows and deduplicate new MATCH and MESSAGE IDs; active membership
determines effect eligibility. Browser permissions and saved preferences control
OS/toast effects independently of canonical inbox updates.

Completion records an enqueue attempt, not recipient delivery/read acknowledgement.
Failure before completion leaves the intent retryable, including across owner
restart; repeated frames reconcile by saved message ID and notification ID.
Reconnect refreshes durable inbox/notification queries, and open chats reload
history after joining. Ended matches suppress queued live communication while
retaining authorized history. Historical messages are not backfilled with new
notifications. Completed intents have an operator-managed seven-day bounded pruning
procedure in the native contract; pending work is never pruned.

The session-owned provider refreshes inbox/notification caches on private hints
and connection recovery. Conversation lists no longer remove other consumers'
message listeners. NotificationCenter owns toast/browser effects, deduplicates
identified hints within its owned connection, and preserves stored permission and
notification preferences. Durable inbox/notification state refreshes independently
of those browser preferences. Mounted drafts still reuse their operation ID after
failure; a crash-safe client draft outbox remains a separate feature.

The React Query message cache owns saved chat state as cursor pages. HTTP history,
live messages, saved acknowledgements and read receipts reconcile by message ID,
ordered by creation time then ID. `message-pages.ts` updates an existing page by ID
and reconciles at the whole-query commit, retaining late live arrivals and newer
read receipts while another page awaits. The TanStack sharing adapter handles both
stored pages and selected arrays. Draft/attempt state stays local and separate.
Subscription recovery refreshes HTTP history without match rooms.
On reconnection, sequential page refetches advance the loaded latest-history window;
older history remains available through explicit continuation. Obsolete cached
rows outside that refreshed window are not merged into an apparent history gap.
Loading older messages preserves the visible bubble anchor and does not scroll
the chat to the newest message.
`ChatView` renders query loading, paused/offline and failure states inside the
history area, keeping its draft/composer mounted. Successful empty history is
distinct from an unavailable read. Explicit head retry uses the same owned query
without cancelling an already pending fetch; older-page errors retain their own
continuation. History access denial hides cached rows and enters the existing
refresh recovery, disabling sends independently of subscription readiness.

GET messages, conversations and received likes return `{ items, nextCursor }`.
`lib/server/cursor-pagination.ts` validates a default 50 / maximum 100 item page and
a bounded versioned bookmark tied to the current user, list and history match or
conversation search. Bookmarks grant no access: readers independently resolve the
session and membership/owner predicates, including former participants' history.
Timestamp/ID keysets give tied rows a stable boundary. Parameterized raw comparisons
bind UTC cursor text as `timestamp`, matching the existing timestamp-without-time-zone
columns without session-time-zone conversion.

`message-history.ts` selects recent IDs through the matching compound index before
reading bounded public records, returning each history page in ascending display
order. `conversations.ts` computes latest-message-or-match activity before limiting,
then reads selected matches' existing summaries/unread counts. Inbox substring search
filters the participant's conversations before pagination and binds its bookmark to
the normalized search; a debounced input stays mounted through loading and errors.
`received-likes.ts` excludes the viewer's already handled LIKE/PASS directions before
pagination, while retaining active-match exclusions. Clients expose continuation and retry controls rather than fetching all
pages automatically. Inbox/like pages deduplicate by stable ID when live ordering
changes; invalidation refreshes the loaded window. These reads preserve privacy and stored interactions. Query budgets and measured limits are in `docs/tooling.md`.

A confirmed LIKE/PASS cancels older received-like fetches and removes that target
from every loaded cursor page before invalidating the usual lists. The native
query's abort signal prevents a pre-action snapshot from restoring the card.
Failed writes leave the existing card intact. This changes actionable eligibility
and cache state, not stored interactions: passes are never reset and no undo is added.

Notification list inputs use a strict integer limit from 1–100 (default 20), explicit
`unreadOnly=true|false` and single values for each parameter. Invalid inputs return
400 before the notification query. Latest rows sort by creation time then ID descending.
Bulk read-state writes accept a single opaque ID or at most 100 raw entries; each
ID is nonblank and at most 128 characters. Duplicates within the bound and empty-array
no-ops retain their semantics. All list/update predicates still use the server session
owner; foreign IDs receive the same success response without modification. Mark-all
continues to update the server-selected owned unread set.

`lib/server/match-access.ts` owns member authorization and idempotent unmatching.
Only active members can communicate, while former participants retain authorized
HTTP history. Private refresh hints reach both former participants after commit,
and the provider refetches match status so both chats become read-only.
`lib/app-error.ts` keeps domain error construction independent of HTTP serialization.

`lib/server/matching.ts` owns the mutual-like transition. A transaction-level
PostgreSQL advisory lock serializes writes for the unordered user pair. READ COMMITTED
queries then see the previous lock owner's committed state; broad Serializable
predicate conflicts cannot exhaust normal same-pair retries. The transaction still
commits the like, canonical match and intended durable notifications together,
with a bounded retry for transient database conflicts. Same-action retries return committed state; conflicting
actions remain rejected and unmatched pairs are not recreated. Missing legacy
notifications can be filled without replacing existing IDs/read state. Private
refresh hints happen after commit and their failure cannot falsely reject the write.

SQL migrations enforce unordered match-pair uniqueness (including legacy reversed
orientation) and one MATCH notification per non-null entity/recipient. Schema comments point
to these expression/partial index definitions in migration SQL; tests exercise them
against PostgreSQL. Duplicate preflight checks stop migration
for a separately reviewed repair plan; they do not delete/reassign history.

`lib/server/profile-photos.ts` owns the shared six-photo gallery limit for both
UploadThing profile entry points. Middleware rejects requests exceeding current
remaining capacity before provider authorization. Completion locks the account,
returns the canonical row for an owned replay, checks the total again and appends
a unique next order in one transaction. The profile editor takes the same lock,
so complete reorders and appends serialize. Foreign-key replay claims fail closed.
Raw upload diagnostics are disabled; private filenames and keys are not logged.
All upload entry points share live-session authorization and validate the optional
captured owner headers from `lib/upload-owner.ts` before quota/provider access.
First-party `PhotoUpload` instances are keyed by account/session and use the typed
imperative browser adapter with per-attempt cancellation, including delayed-drop
and completion guards. Accepted provider writes cannot be undone by browser abort.
Every gallery/primary-photo query uses saved order then ID, including discovery,
profiles, matching responses and inboxes. Legacy order ties remain deterministic;
legacy over-cap galleries remain readable/reorderable and reject further additions.
The account-owned editor offers named native earlier/later/delete controls alongside
drag ordering. Both order paths update the same local draft; Save changes still
commits the complete owned set through the profile operation. Position announcements
and bounded focus recovery follow the moved/remaining photo, or the Photos heading
when empty, without stealing focus from another field. A pending deletion guards
other gallery commands. Async completions use the latest owned gallery snapshot,
retaining intervening draft changes and uploads. Upload selection keeps the existing
adapter and exposes its keyboard action, disabled/busy state and focus styling.
The limit governs registered gallery rows. Concurrent provider authorizations are
not reservations: an upload rejected at completion can leave an unregistered remote
object. Provider-side orphan cleanup is outside this metadata repair.

`lib/server/profile-photo-delete.ts` owns photo deletion ordering: validate the key,
resolve an owned File, require storage confirmation, then remove owned metadata.
Missing configuration, SDK failure/negative confirmation and database cleanup failure
surface a retryable error while retaining the key. A confirmed zero-count storage
response permits retry after an earlier remote deletion. The photo manager keeps
the visible photo on failure and offers retry feedback. There is no background queue;
the owned File is the durable cleanup reference until completion.

`lib/profile-validation.ts` owns the shared setup/edit fields: integer age 18–100,
name 2–50 and bio 10–500 characters, existing enums, and 1–10 interest/hobby labels.
Each label is nonblank and at most 100 characters; custom values retain their exact
content. Setup extends those fields with its existing optional image, and edit adds
unique photo-order identifiers. Both numeric inputs keep decimals and cleared values
for validation instead of truncating or substituting an age.

`lib/server/profile.ts` owns profile creation and editing. A per-user row lock
serializes related writes; account name and profile fields commit in one transaction.
When photo order is supplied, it must contain the complete current owned key set,
including an empty set only for an empty gallery. Ownership/set validation, account
name, profile and every order update share the transaction. Missing concurrent file
updates abort it. Returned photos reflect the same transaction. Failed writes leave
prior state intact; explicit conflicts ask the editor to refresh saved photos.
Both profile uploaders enforce the six-photo quota through the shared registration operation.

Onboarding waits for a resolved session before mounting its account-keyed form.
`lib/client/profile-drafts.ts` owns draft key names and cleanup: retain only the
current account's namespace, discard unowned legacy data, and clear all onboarding
drafts on logout. The existing ten-minute storage expiration and form fields remain.
Late form/upload writers cannot recreate drafts after completion/unmount; pending
submission continuations and redirect timers stop when the account form unmounts.
Private values and storage keys are omitted from error logs. Auth identity refresh
on returning to a tab remounts the form when the account changes.

`lib/server/discovery.ts` selects and ranks the feed. The HTTP route validates
integer age/radius filters through the shared schema and requires
an effective Device or City origin for a radius. Database predicates apply both stored gender preferences,
handled-user and active-match exclusions. A deterministic ID cursor scans 100-row
batches, applies distance eligibility and retains only the ten highest scores with
an ID tie-breaker. Eligibility precedes the final limit; memory remains bounded,
although broad discovery still scans all eligible candidates. Consider spatial
indexes/database ranking when measured traffic warrants that optimization.
Zero coordinates are valid; missing distance is excluded only under a radius.
Explicit serialization omits coordinates/auth data and suppresses numeric distance
when hidden. This display setting still allows location to influence ranking.
The browser exposes a settings link or filter removal for LOCATION_REQUIRED and
does not retry deterministic client errors. Device acquisition and saving use the account-owned Settings lifecycle below.

`lib/geolocation.ts` keeps shared coordinates/distance calculations pure;
`lib/client/geolocation.ts` owns the one-shot browser adapter. Device location is
requested only by the Settings Enable/Refresh action, never on discovery entry.
The adapter requires a secure context, normalizes native denial/unavailable/timeout
codes and requests a fresh fix with a ten-second timeout and no background watch.
See [MDN getCurrentPosition](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition)
and [native error codes](https://developer.mozilla.org/en-US/docs/Web/API/GeolocationPositionError/code).

`lib/server/location.ts` owns location reads and all Device/City/Clear/visibility
writes. The session selects the owner; strict payloads require `expectedUserId` and
`expectedRevision`. A transactional compare-and-update increments the revision or
returns 409 without replaying stale coordinates or clearing a newer origin. The
privacy route delegates location visibility to this operation; online-only writes
keep their existing semantics. General profile writes reject legacy free-text
location and cannot change private location fields.

`lib/location.ts` resolves a private effective point with explicit provenance. Device
uses its saved point; City uses an available server-owned catalog point; Off or an
unavailable city has no origin. Filtering/ranking uses unrounded kilometers with an
inclusive radius; only display is rounded. City-based distances explicitly describe
selected-city approximation, including a same-city result. Separate city/distance
visibility controls presentation, not matching. Public profile, match and chat
surfaces keep their existing location omissions. Generic owner profile responses
also omit coordinates, private city references and unconfirmed legacy text; the
owner-only location endpoint returns settings and preview, never raw device points.
Internal distance-weighted ranking scores are not serialized.

The account-owned `useLocationControl` captures the revision before requesting a
fresh native fix, owns HTTP cancellation and ignores stale generations. Save-failure
retry keeps a fix only in memory for the same owner/revision. Mode changes, Clear,
logout and account changes discard it. Successful saves update committed owner state
and refresh profile/discovery/likes projections. Cross-tab storage carries only an
invalidation nonce; query owners revalidate on focus. Clear resets only its initiating
tab's radius. Other tabs retain their filter and receive actionable 422 feedback.
Cancellation cannot undo an already accepted server write; revision checks arbitrate
competing requests. Dates stay last-known/selected, with Unknown for missing legacy
timestamps. No background tracking or automatic expiry is introduced.

The additive location-mode migration preserves valid complete legacy points,
timestamps and distance choices, including zero; invalid/partial points become Off.
Unconfirmed free-text labels stay owner-only until Device/City/Clear replaces them.
New city visibility defaults off. City deletes device point/time atomically; Clear
removes all current profile location values and disables both visibility settings,
retaining only the mutation revision. It preserves matches and conversations. Clear
also sanitizes current account drafts and invalidates active caches; it cannot erase
pre-existing backups, third-party browser/OS storage or already delivered offline
copies. This feature does not implement account deletion.

The discovery page owns the current candidate by user identity, choosing the first
unhandled result instead of advancing an independent array index. Confirmed actions
remain excluded across late refetches and filter changes for the mounted page;
server eligibility still owns persistence. An immediate action guard and the busy
card prevent concurrent submissions. The card returns to its origin until success
replaces it, so rejection retains the same usable candidate. Optional browser match
feedback cannot falsely reject an already committed action.

`lib/errors.ts` preserves intentional AppError responses and validation errors but
returns only `Internal server error`, `INTERNAL_SERVER_ERROR` and a generated
`requestId` for unexpected API failures. The ID is also in `X-Request-ID` and the
redacted log; exception objects, messages and stacks are omitted. Notification,
location, privacy, presence, credential and message HTTP handlers use that same
unexpected-error boundary. Known message errors keep their domain contracts. Raw Prisma logging is disabled so SQL/private values cannot
bypass redaction; these correlation logs do not provide a private exception archive.
`readJson` scopes malformed-body handling to parsing, returning 400 `INVALID_JSON`
in the formerly unguarded application routes. Existing profile/discovery/message
JSON errors retain their existing safe 400 contracts. Authentication runs first.

Discovery exposes native Like/Pass controls alongside the existing drag gestures.
Both paths call the same identity-based action handler and share its immediate guard
and pending state. Visible buttons provide 48-pixel touch height and stay disabled
until a write resolves; rejected actions retain the same candidate. Password visibility
is a named, tabbable native button, and selected-option removal names the actual item.
Those controls and gallery openers retain visible keyboard focus styling.

`Lightbox` uses the local Radix-backed Dialog primitive for focus entry/trapping,
Escape, background isolation and scroll-lock cleanup. Arrow navigation stays on the
dialog content and preserves wraparound. The gallery opens it programmatically, so
the viewer snapshots the prior focused element on mount and restores that connected
opener through `onCloseAutoFocus`. No global key/overflow manager remains in the
viewer. Explicit close/previous/next controls support keyboard and touch.

The landing page describes the implemented shared-interest/hobby/preference matching
and age/distance filters without claiming a learned recommendation model. How we do
it uses a native section anchor; the existing How It Works section accepts keyboard
focus and clears the fixed navigation with a scroll margin. Get started is a single
signup link, without a nested button. Public navigation does not create a session.

`lib/server/location-catalog.ts` owns authenticated city-reference search through the
thin `/api/location/cities` route. The server validates a bounded query and country,
then searches normalized name/ASCII/alias rows through a prefix index, returning at
most 20 disambiguated display records. No user-to-city association or point is part
of that response. An unavailable catalog is distinct from an empty search.

Reference preparation is an explicit maintenance operation documented in
[GeoNames setup](reference-data/geonames.md). Its pinned checksums, normalization and
row validation precede the database transaction; batched upserts and aliases commit
with snapshot metadata. Removed reference rows remain unavailable rather than being
deleted. The same transaction advances City profiles' location revisions so captures
started before maintenance cannot overwrite an updated origin. An unavailable saved
city requires explicit reselection and supplies no hidden matching origin. No
startup/build/test/migration imports reference data.

## Structural work after the harness

1. Extend qualified journeys for live uploads and other uncovered boundaries
   before moving their data code. [Coverage](realtime-retirement.md) distinguishes
   actual native integration from unit and schema/build evidence.
2. Use the [populated transfer/rollback rehearsal](migration-rehearsal.md) before
   separately qualifying a hosted target; local platform tests do not establish
   production cutover.

3. Extract one domain operation at a time from handlers into `lib/server/`, using
   the existing profile operation as a starting point. Keep route contracts stable.
4. Separate mixed browser/server modules and colocate remaining feature contracts
   as callers change. Avoid a wholesale `src/` move with no behavioral benefit.

These are follow-up slices, not completed refactors. The harness establishes the
instructions, discovery, checks, and initial behavioral coverage for doing them.
