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

`lib/socket-instance.ts` stores a process-global singleton so Next route bundles
and the combined custom server share the same instance. Separate processes do not
share it. An HTTP handler emitting through that singleton does not establish
delivery to clients connected to the other process. Unmatch also reconciles the
selected owner through the existing authenticated room-leave action after HTTP
success; there is no cross-process event bus.
HTTP online-status queries restrict results to active matches with visibility
enabled before using that instance. Browser presence snapshots use the selected
socket owner directly, including the optional standalone topology.

`lib/session.ts` owns the server session helper; browser components import the
session hook directly from `lib/auth-client.ts` so Prisma/server auth stay out of
browser bundles. Middleware performs server auth/profile lookups. Run browser checks against
a disposable test PostgreSQL instance to keep any session-dependent queries isolated.

All three socket owners capture the database session ID during an authoritative
handshake and share incoming-action validation in `lib/server/socket-session.ts`.
An invalid/expired/revoked session receives `auth:error` and disconnects before the
action handler runs. Authorization completions stay in packet order. Match policies
live in shared domain handlers. The socket lifecycle test exercises all seven
incoming actions across all three runtimes; idle session termination is not covered.
Protected/disconnect handlers and the user's private room attach before the first
asynchronous presence lookup, so profile initialization cannot drop an immediate join.

`lib/server/presence.ts` counts connected sessions against authoritative database
expiry/ownership and shares snapshots and refreshes across HTTP and the three
socket owners. Events target valid connections of active matches only. Per-user
refreshes serialize within the selected runtime; the process-global queue also
coordinates Next route bundles. Hiding visibility, unmatching and last-connection
disconnect retract status. Privacy HTTP writes notify the combined owner, and
the settings client asks its selected owner to refresh stored state after success.
The shared `useOnlineStatus` hook owns listeners, loads an initial socket snapshot
and ignores late snapshots after newer events. Chat and inbox use that same state.
Different processes do not share connection state without an adapter; choose one
socket topology for the app. Idle expiry is filtered from subsequent queries and
actions, rather than proactively terminating idle sockets.

`SocketProvider` owns a connection by user ID and session ID. Token responses echo
the server-resolved identity so a cookie change cannot connect a different session
under stale client ownership. Abort and disposed checks cover both token awaits;
late callbacks cannot publish connection state or update caches after cleanup.
Cleanup removes the owned socket's listeners and disconnects it. Context exposes
only the current owner's connection; ordinary session-object refreshes keep it,
while a replacement session ID creates a new one. Server handshake and packet
authorization continue independently of this client ownership bookkeeping.

`lib/server/messages.ts` is the shared HTTP/socket write operation. It validates
untrusted payloads and owned attachments, locks the active match, and commits the
message, receiver notification and per-user `MessageDelivery` intents together.
Unmatch waits for accepted sends to commit. Identified retries return the canonical
message without duplicating effects; conflicting payloads remain rejected. The
trusted upload callback still registers attachment ownership separately.

`lib/server/message-delivery.ts` owns the three runtimes' send handlers and delivery
relay. Acknowledgements follow durable commit; legacy callers receive a direct
saved-message response. Each relay claims at most 100 pending user intents using
`FOR UPDATE SKIP LOCKED`, checks active membership and authoritative connected
sessions, then enqueues private message, inbox and notification hints. Sender
connections other than the initiating socket receive the saved message too.
HTTP wakes the combined owner through a process-global registry; a one-second
poll also recovers committed intents in the selected standalone/library owner.
The timer starts with its HTTP listener and stops on close. No external bus is used.
Choose one socket topology for an account's devices; simultaneous separate owners
do not broadcast a single completed user intent to each other's connections.

Completion records an enqueue attempt, not recipient delivery/read acknowledgement.
Failure before completion leaves the intent retryable, including across owner
restart; repeated frames reconcile by saved message ID and notification ID.
Reconnect refreshes durable inbox/notification queries, and open chats reload
history after joining. Ended matches suppress queued live communication while
retaining authorized history. Historical messages are not backfilled with new
notifications; delivery rows have no new automatic retention policy.

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
Each socket owner acknowledges an authorized room join before history refresh.
On reconnection, sequential page refetches advance the loaded latest-history window;
older history remains available through explicit continuation. Obsolete cached
rows outside that refreshed window are not merged into an apparent history gap.
Loading older messages preserves the visible bubble anchor and does not scroll
the chat to the newest message.

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
`received-likes.ts` pages the existing incoming-like audience, retaining active-match
exclusions. Clients expose continuation and retry controls rather than fetching all
pages automatically. Inbox/like pages deduplicate by stable ID when live ordering
changes; invalidation refreshes the loaded window. These reads do not change
eligibility or retention. Query budgets and measured limits are in `docs/tooling.md`.

`lib/server/match-access.ts` owns member authorization and idempotent unmatching.
`lib/server/socket-live-match.ts` shares the room/read/typing handlers across the
three owners: only active members can communicate, while former participants
retain authorized HTTP history. Unmatch publishes a participant-private status
update and evicts the live room. The UI also leaves that room after HTTP success;
the selected socket owner checks the stored status before reconciling its clients.
The provider updates match state and both open chats become read-only. Session
validation and listener registration ordering still apply before these handlers.
`lib/app-error.ts` keeps domain error construction independent of Next HTTP imports
so the same checks work in standalone socket processes.

`lib/server/matching.ts` owns the mutual-like transition. A transaction-level
PostgreSQL advisory lock serializes writes for the unordered user pair. READ COMMITTED
queries then see the previous lock owner's committed state; broad Serializable
predicate conflicts cannot exhaust normal same-pair retries. The transaction still
commits the like, canonical match and intended durable notifications together,
with a bounded retry for transient database conflicts. Same-action retries return committed state; conflicting
actions remain rejected and unmatched pairs are not recreated. Missing legacy
notifications can be filled without replacing existing IDs/read state. Socket
refresh hints happen after commit and their failure cannot falsely reject the write.

SQL migrations enforce unordered match-pair uniqueness (including legacy reversed
orientation) and one MATCH notification per non-null entity/recipient. Schema comments point
to these expression/partial index definitions in migration SQL; tests exercise them
against PostgreSQL. Duplicate preflight checks stop migration
for a separately reviewed repair plan; they do not delete/reassign history.

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
The six-photo upload quota and callback ordering remain the separate #34 slice.

Onboarding waits for a resolved session before mounting its account-keyed form.
`lib/client/profile-drafts.ts` owns draft key names and cleanup: retain only the
current account's namespace, discard unowned legacy data, and clear all onboarding
drafts on logout. The existing ten-minute storage expiration and form fields remain.
Late form/upload writers cannot recreate drafts after completion/unmount; pending
submission continuations and redirect timers stop when the account form unmounts.
Private values and storage keys are omitted from error logs. Auth identity refresh
on returning to a tab remounts the form when the account changes.

`lib/server/discovery.ts` selects and ranks the feed. The HTTP route validates
integer age/radius filters through the shared schema and requires saved viewer
coordinates for a radius. Database predicates apply both stored gender preferences,
handled-user and active-match exclusions. A deterministic ID cursor scans 100-row
batches, applies distance eligibility and retains only the ten highest scores with
an ID tie-breaker. Eligibility precedes the final limit; memory remains bounded,
although broad discovery still scans all eligible candidates. Consider spatial
indexes/database ranking when measured traffic warrants that optimization.
Zero coordinates are valid; missing distance is excluded only under a radius.
Explicit serialization omits coordinates/auth data and suppresses numeric distance
when hidden. This display setting still allows location to influence ranking.
The browser exposes a settings link or filter removal for LOCATION_REQUIRED and
does not retry deterministic client errors. Location acquisition remains a separate
slice (#35).

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
location, privacy, presence, socket-token and message HTTP handlers use that same
unexpected-error boundary. Known message errors and socket acknowledgements keep
their domain contracts. Raw Prisma logging is disabled so SQL/private values cannot
bypass redaction; these correlation logs do not provide a private exception archive.
`readJson` scopes malformed-body handling to parsing, returning 400 `INVALID_JSON`
in the formerly unguarded application routes. Existing profile/discovery/message
JSON errors retain their existing safe 400 contracts. Authentication runs first.

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
