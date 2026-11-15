# Bondi

A full-stack dating app for creating a profile, discovering people, matching on
mutual likes, and continuing the conversation through real-time messaging.

Built with Next.js, React, TypeScript, Supabase Postgres, and Supabase Realtime.

![Bondi landing page captured from a local production build](docs/images/bondi-landing.jpg)

## What the app does

- Email/password registration, login, and profile onboarding.
- Profiles with photos, interests, hobbies, and dating preferences.
- Swipe-based discovery with compatibility ranking and age/location filters.
- Mutual-like matching, likes received, and match management.
- Messaging with attachments, typing events, and read receipts.
- Discovery cards show profile information without an identity-verification claim.
- Profile privacy preferences, online status, and permission-based browser notifications.
- Light, dark, and system themes.

These features are implemented in the application. Automated coverage currently
qualifies a smaller set of behaviors, described under [Verification](#verification).

## Engineering overview

Next.js App Router handles pages and HTTP endpoints. Better Auth manages sessions;
Prisma maps the PostgreSQL domain models. React Query manages server state in the
browser, while React Hook Form and Zod handle form validation. The interface uses
Tailwind CSS v4, shadcn/ui, and Radix primitives. UploadThing handles file uploads.

Standard Next dev/start serves pages and authenticated HTTP operations. Supabase
Realtime provides private session-owned invalidation hints; authorized HTTP reads
supply canonical data. Durable sending does not depend on browser subscription
readiness. [Realtime contracts](docs/realtime.md) describe delivery, privacy and
recovery; no custom WebSocket server or alternate live transport is required.

Feature code is grouped by domain, with browser adapters and server operations
separated where those boundaries are established:

```text
app/
  (auth)/                   Authentication and onboarding pages
  (main)/                   Protected application pages
  api/                      HTTP route handlers
  components/features/      Feature UI, hooks, types, and validation
  components/ui/            Shared UI primitives
lib/
  client/                   Browser request and upload helpers
  server/                   Server data operations and upload router
prisma/
  schema/                   Multi-file database schema
  migrations/               Database migration history
tests/                      Behavioral, harness, and browser tests
scripts/                    Repository verification
```

See [architecture and follow-up work](docs/architecture.md) for runtime ownership,
existing limitations, and the next structural improvements.

## Run locally

Requirements: Node.js 22.14 (`.nvmrc`), npm 10.9.2, and a configured Supabase Database + Realtime target.
Use the [isolated local setup](docs/supabase-testing.md) for development/testing.

```bash
git clone https://github.com/montuyamaricela/bondi.git
cd bondi
nvm use
npm ci
cp .env.example .env
```

Fill in `DATABASE_URL` and a random `BETTER_AUTH_SECRET` of at least 32 characters.
Set `UPLOADTHING_TOKEN` to enable uploads. The application defaults to `http://localhost:3000`. Configure the public
Supabase URL/key and private signing/server keys using the [Realtime contract](docs/realtime.md).

Runtime settings are validated by `lib/server/env.ts`; invalid values name the
setting without printing its contents. Production requires explicit
`BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` origins and a strong auth secret.
Next CLI owns listener hostname/port options. Browser authentication uses the app
origin; live subscriptions connect directly to the configured Supabase origin.
No server secret belongs in `NEXT_PUBLIC_` settings.

For Supabase Postgres, `DATABASE_URL` is the runtime connection. Set `DIRECT_URL`
to the **same database's direct or session-mode connection** for Prisma CLI when
the runtime uses transaction pooling. The CLI refuses a transaction-pool migration
connection; when `DIRECT_URL` is absent, an ordinary local/direct/session
`DATABASE_URL` is used. Prisma Client explicitly uses `DATABASE_URL` even when the
CLI has a different connection. See [Supabase's Prisma connection guide](https://supabase.com/docs/guides/database/prisma).
Connection settings do not provision or migrate a Supabase project.
The [migration tracker](https://github.com/montuyamaricela/bondi/issues/74) separates
application integration, populated migration rehearsal and hosted cutover.

Native Supabase verification uses an explicitly prepared disposable local stack and
an independent CI check. The [private subscription contract](docs/realtime.md)
documents configuration, session ownership, managed durable message hints,
retry/retention limits, HTTP chat commands, server-owned presence and signing-key
rotation. Native chat and online status use authenticated HTTP with private refresh
hints. Missing public configuration reports unavailable live updates; it does not
select another transport.
The [populated migration rehearsal](docs/migration-rehearsal.md) covers explicit transfer,
failed-copy recovery and rollback using separate isolated resources.
See [Supabase test setup](docs/supabase-testing.md) for pinned
tooling, safe target checks, private API-role access and the native test command.

Export the environment before repository database commands and checks. In macOS/Linux:

```bash
set -a
. ./.env
set +a
npm run db:generate
npm run db:migrate
npm run dev
```

Open [localhost:3000](http://localhost:3000). Migrations run only when explicitly
requested. Use a new development database, and review the target URL before
applying migrations. Create schema changes with
`npm run db:migrate:dev -- --name <name>`.

## Verification

```bash
npm test                 # Behavioral tests and harness failure-path tests
npm run typecheck        # Next route types and app types
npm run lint             # ESLint
npm run lint:fix         # Apply ESLint fixes
npm run format           # Format maintained source/docs and sort Tailwind classes
npm run format:check     # Check formatting
npm run check:harness    # Skill resources, licenses, hashes, and client links
npm run audit:critical   # Fail on critical advisories; review lower-severity findings
npm run check            # All gates above, schema validation, and build
npm run check:feature    # Before a feature commit: full checks/build, then E2E
```

`npm run build` generates Prisma artifacts and a standard Next production build.
`npm run check:realtime` then verifies maintained sources, the lockfile and actual
built artifacts contain no retired transport. The full check includes this gate.
It does not apply database migrations. `npm run check` stops at the first failed gate.
It includes a full dependency audit that blocks critical advisories. Remaining
noncritical findings and the checked upgrade boundaries are recorded in the
[dependency baseline review](docs/research/2026-11-14-dependency-baseline.md).

City reference data has a separate, checksummed [GeoNames setup procedure](docs/reference-data/geonames.md).
Migration, startup, build and test commands never download or import that catalog.

Runtime/test/config commits automatically run `npm run check:feature` after staged
lint/format fixes, blocking the commit if checks, build, or E2E fail. For the hook,
deliberately configure `.env.test.local` from the prepared native values documented
in [Supabase test setup](docs/supabase-testing.md). Keep test origins and synthetic
credentials. Apply test migrations explicitly and install Chromium before first
use. The hook loads this ignored test configuration automatically.
[Tooling setup](docs/tooling.md) explains partial staging and documentation-only
skips. Manual `check:feature` runs use that exported native environment.

The browser suite starts one standard Next listener on port 3100. It covers public
pages/themes, anonymous access and actual synthetic-user onboarding, authentication,
mutual matching, chat and history. Outsiders are denied protected HTTP operations
and native private channels. Public projections omit exact coordinates and auth data.
The [retirement evidence map](docs/realtime-retirement.md) records semantic coverage
for the HTTP/native replacement and distinguishes it from ordinary PostgreSQL
schema/build/unit checks.

The public landing journey follows How we do it and Get started using native
keyboard navigation, checks the existing section destinations and fixed-nav offset,
and reaches signup without granting protected profile access. Matching copy describes
shared interests, hobbies and relationship preferences rather than learning from use.
A separate legacy-credential test signs into a pre-existing account with a password
hash generated by Better Auth 1.3.33, retains its user/account/profile identities,
rejects an incorrect password, and verifies that logout removes access.
A session lifecycle case retains genuine signed cache cookies while revoking or
expiring their backing sessions. The next protected HTTP read/write must reject
them without changing data; valid reads, writes, and session renewal still work.
The native action matrix validates every live HTTP operation with a valid session,
then rejects its next request after expiry/revocation without side effects. Message
validation exercises malformed/blank/oversized text, the 5,000-character boundary,
active membership and owned attachment records through canonical HTTP. The actual
upload callback uses synthetic metadata and PostgreSQL; forged client metadata is
replaced by stored values.

Message uploads now register a `MessageAttachment` record separately from profile
gallery files. Apply migrations explicitly before deploying these writers. Existing
messages remain readable; unregistered old upload keys cannot be used for new sends.
The storage network and UploadThing webhook signature path are outside this test.
The retry case sends four independent waves of eight concurrent HTTP copies
of one operation and checks a single PostgreSQL row/canonical ID. Operation IDs are scoped
to sender and conversation; reusing one with different content fails. A real browser
proxy drops the real accepted HTTP response: the draft remains,
retry uses the same ID, and exactly one saved message appears. Explicit server
rejection also retains a retryable draft.

New chat sends keep their draft until a durable acknowledgement. Failed/uncertain
sends can be retried in the open chat using the same operation ID. Legacy callers
without an ID remain supported but cannot receive deduplication guarantees. This
does not guarantee browser receipt or persist drafts across page reloads. The server
recovers incomplete committed delivery attempts after restart.
The recovery case disconnects a browser with populated history and a draft, sends
missed messages from its peer, and reconnects without reloading. Room joins are
acknowledged before history refresh. A delayed older HTTP snapshot cannot erase a
newer live message; both views converge in order without duplicates and keep the draft.
Chat history distinguishes pending/offline, failed, successfully empty and populated
reads. Failed first-page or background refreshes offer Retry messages without
unmounting the composer or removing saved rows; access denial uses Refresh chat and
disables sending. Older-page retry stays separate. The history-error cases use real
synthetic sessions/PostgreSQL with controlled HTTP failures, actual browser offline
mode and a native hint-triggered refresh. They preserve drafts and verify canonical
messages appear once after recovery. Controlled 401/403 replies isolate UI recovery;
the authorization suites separately exercise actual missing/expired/foreign sessions.
The matching case forces a PostgreSQL serialization failure and verifies an actual
transaction retry using a sequence that survives rollback. It also injects a
notification failure and verifies the like,
match, and notifications roll back together. It retries successfully, repairs a
missing notification without replacing an existing read notification, and runs
fifty rounds of eight concurrent opposite-direction/repeated likes. The database
rejects reversed duplicate pairs; passes and unmatched pairs retain their rules.
Matching writes use a transaction-level lock for the unordered user pair and fresh
READ COMMITTED queries after waiting. The like, match and notifications still commit
or roll back together, with bounded retries for transient database failures.

The canonical-matching migration stops if historical duplicate pairs or match
notifications exist. It never deletes or reassigns history. Resolve those findings
with a separately reviewed data-repair plan before applying that migration; no
production data repair is included here.
The photo-deletion case checks authenticated HTTP denial/missing configuration and
retained PostgreSQL ownership references. It uses the real UploadThing SDK with a
synthetic, stateful fetch fixture for provider rejection, thrown failure and confirmed
deletion. A PostgreSQL cleanup failure after remote confirmation leaves the key for
retry; a confirmed already-absent object then permits metadata cleanup. Foreign
photos remain untouched. No live storage service or real asset is used.
The onboarding-draft case verifies same-account reloads, logout cleanup, ten-minute
expiry, account changes across tabs when the session refreshes, and discarding
legacy unowned drafts. Synthetic saved-image data checks image isolation without
uploading an asset. Unit cases verify unrelated preferences survive cleanup and
malformed private data is not printed in storage error logs.

Unmatching keeps existing conversation history readable to its two participants.
Both open chats become read-only; sends, typing and receipt writes require an
active match. Native API and browser cases exercise outsider typing rejection, receipt
preservation, session expiry and retained authorized history. Repeated unmatch is
safe. Both chats become read-only through native private hints and authorized HTTP
reads. Online status is exposed only to visible active matches.

Presence snapshots use server liveness deadlines. A user remains online while any
valid session lease is live. Cases cover two tabs, last-tab departure, privacy
retraction/re-enable, outsider/former-match denial and expired-session filtering.
The owned provider cases hold credential requests/responses/body parsing across
logout/account/session changes, count actual native connections and prove old
owners cannot become orphan subscriptions. Ordinary owner refresh keeps one
connection; a replacement session creates a new owned connection.
Credential attempts time out after eight seconds across headers/body reads, then
use the existing bounded retry and explicit recovery controls. Deterministic clock
tests cover stalls, late replies, retry limits, disposal and replacement owners.
Native browser cases hold genuine signed credential continuations, advance the
controlled clock through timeout, reconnect automatically or explicitly, discard
the late reply and renew the recovered channel. These are local native results,
not hosted-network latency guarantees.

Message delivery cases use HTTP sends outside an open chat, real private native
subscribers, another sender device and expired-session audience denial. Both inboxes
and badges update independently of OS preferences. PostgreSQL notification failure
rolls back the whole send; a completion failure repeats hints without duplicate
notification effects. The recovery case pauses/restarts the managed cron relay,
checks concurrent claims and verifies offline history repair without historical
OS alerts. The bounded outbox case proves 202 real database Broadcast enqueues,
locked-row skipping and ended-match/expired-session suppression. Eligibility
checks retain historical MATCH/MESSAGE rows while suppressing ended/missing/foreign
match effects. Only the OS notification adapter is replaced.

The native retirement case verifies standard Next returns 404 for the removed
endpoints, browsers make zero old transport requests and actual Supabase connections
serve two users. Mutual likes produce live MATCH alerts; stored preferences,
repeated hints, ineligible rows and reload baselines preserve effect deduplication.

Native chat-command cases cover bounded/monotonic receipts, rejected foreign and
ended access, session/lease binding, typing order/expiry and concurrent retention
versus renewal. Real browsers verify HTTP send/read/typing, durable sending with live updates disconnected, explicit native
reconnection, revocation on the next protected request and retained drafts across
timeouts, conversations and account changes. Lost-response retries retain their
operation ID. Only synthetic data is used; ordinary PostgreSQL results cover schema/build/unit compatibility only.

Native presence cases verify owned, sequenced liveness heartbeats, the 60-second
server deadline and lease/session caps, active-match-only audience and hidden
status, expired sessions, logout hints and multi-tab aggregation. Real browsers
exercise graceful leave, delayed privacy snapshots, both chats becoming read-only
after unmatch, visible refresh failures and explicit retry. Native WebSocket loss
is real; expiry and the 15-second observer polling window use a controlled synthetic
deadline/browser clock. A buffered real heartbeat across an SPA account switch
cannot update the new owner or restart the abandoned timer. These are distinct
from waiting a full production lease duration on the wall clock.
The privacy/unmatch journey proves native hints repair both UIs. Repeated native hints cancelling held HTTP reads cannot extend an
unrefreshed online indicator past its independent 20-second display deadline.

The online-visibility control permits one pending save at a time and renders the
returned canonical value. Browser cases hold real writes, attempt rapid keyboard
toggles, verify rollback/retry after a scoped database failure and check a matched
peer's visibility. Controlled canonical/malformed replies exercise response handling.
Account changes, replacement sessions and logout dispose the old settings owner;
old failures cannot roll back or notify the replacement settings. A failed save
shows an explicit refresh action rather than claiming the value was persisted.
An original account-switch assertion also caught liveness surviving a changed
cookie. A signed, delete-only cleanup capability now closes that exact old lease;
native API cases reject forged/rebound proofs and prove it grants no read/write
or heartbeat access. The capability is not persisted in browser storage.

Discovery selection cases cover candidates beyond the original 50-row cutoff and
across deterministic batches, mutual preferences for all gender values, zero and
unknown coordinates, hidden distance, handled/active-match exclusions, invalid and
partial age/radius filters, and missing-location feedback. The browser applies and
removes a distance filter through the live interface. Exact coordinates remain
absent from public results; missing location can still participate without a radius.

Discovery transition cases use real pointer gestures, delayed actual feed/write
responses and a scoped PostgreSQL failure. Like/pass refetches retain candidate
order, rejected swipes leave the original card usable, and pending actions cannot
submit twice. Confirmed candidate identities prevent older feed snapshots from
showing handled profiles again during the mounted page's lifetime.

History, inbox and received-likes GETs use `{ items, nextCursor }` pages (50 by
default, at most 100). Histories initially show the newest page; Load older messages
exposes earlier history while preserving the draft and scroll position. Inboxes and
likes offer Load more controls. Inbox search includes unloaded conversations and
keeps its input available during fetching or retry. Existing history consumers must
read `items`; message POSTs retain their contracts.

Pagination cases walk 10,000 tied history rows and 120+ inbox/like rows without gaps
or duplicates, validate ownership/session/cursor boundaries, and check timestamp
boundaries in three PostgreSQL time zones. Browser cases exercise all continuation
controls, search an unloaded conversation, and retain a live arrival during a held
older-history response. Query-plan and payload-budget attachments are available in
the Playwright report. See [tooling](docs/tooling.md) for the measured fixture budgets.

Profile setup/edit cases exercise the same integer age, name/bio and tag collection
rules through real authenticated writes. Tags accept 1–10 nonblank labels of at most
100 characters, including custom values. Account name, profile and complete owned
photo ordering commit together; a missing/foreign/duplicate/incomplete order is
rejected. PostgreSQL profile/photo-update failures prove rollback and retry, and
parallel edits retain a complete committed result. Browser age inputs keep decimals
and blank values for validation. Existing stored values remain readable; profiles
outside the shared write bounds require correction when edited.

Profile forms capture the account and session that opened them. Setup/edit requests
with stale owners return 409 before writing; malformed or incomplete owner pairs
return 400. Older API callers may still omit both fields. Native HTTP/browser cases
cover shared cookies changing to another account, same-account session replacement,
unchanged profiles after rejection and a held accepted-save response arriving after
the editor switches accounts. Such an acknowledgement cannot route or toast in the
replacement editor. Photo callbacks also stop affecting an unmounted form; a real
provider upload after account replacement is not covered by these local cases.
Authenticated public profile reads use a separate whitelisted response from owner
editing data. They omit private preference/location/privacy fields and owner-only
photo metadata, with private/no-store responses. The shared view has no empty
private-preference section for public readers; owner viewing/editing retains its
actual preference and safe city projection. Two native HTTP/browser cases exercise
public rendering/gallery, real owner save, exact serialized keys across Off/Device/
City visibility states, absent targets and missing/expired sessions. This preserves
the target endpoint's existing field audience; it does not publish additional data.

Keyboard/touch controls supplement discovery gestures with Like/Pass buttons using
the same guarded actions. Password visibility and selected-option removal have
accessible names. The photo viewer uses the shared dialog primitive for initial
focus, trapping, Escape and opener restoration, while arrow keys and navigation
buttons cycle photos. Five browser cases use native Tab/Enter/Space, verify actual
profile/action writes and failure recovery, exercise repeat dialog lifecycle/scroll
cleanup, and tap the controls in an emulated mobile viewport. This targeted evidence
does not certify screen readers or physical mobile devices.
The photo editor adds named Delete and earlier/later controls alongside drag
ordering, with disabled bounds, 44-pixel targets and position announcements. Order
remains a draft until Save changes; deletion is immediate. Four separate browser
cases verify focus across moves/bounds, failed save and real save/reload/main-photo
order, deletion pending/failure/next/last-photo recovery, and continued typing in
another field. Recovery is bound to the initiating button, including controlled
activation that keeps field focus. Successful UI deletions use the real owned server operation with a
controlled storage adapter; real handler failure and existing provider/DB cleanup
tests remain separate. Empty-gallery recovery reaches the named uploader and opens
its file chooser. These cases do not transfer real provider assets.

Notification lists preserve their 20-item default and accept only limits from 1–100.
Bulk read-state changes accept up to 100 nonblank IDs of at most 128 characters;
empty-array updates remain no-ops. Authenticated API cases cover invalid/duplicate
parameters, cap boundaries, deterministic ties, owner-only reads and mixed foreign
IDs, plus missing/expired sessions. Mark-all remains limited to the signed-in owner.

Login preserves a safe internal return path and query through profile resolution
and, when needed, onboarding. External/protocol-relative and auth-loop callbacks
fall back to discovery. A failed profile request offers recovery instead of treating
it as a missing profile; retry checks the profile without posting credentials again.
Browser cases exercise real credential rejection/sign-in, protected message links,
onboarding writes, authenticated redirects and controlled profile-response failures.
Unit cases cover unsafe callback inputs and a middleware lookup-failure adapter;
these controlled faults do not establish database-outage behavior end to end.

Incoming-like cards exclude people the viewer has already liked or passed, before
pagination. A confirmed action removes its card from cached pages while the list
refreshes; failed writes retain the card. Regression cases hold actual old/fresh
responses to verify that a passed card cannot reappear, then confirm absence after
reload. Stored interactions remain intact and passing has no undo.

Settings provides one Location Control Center: explicit Device Enable/Refresh,
City-only search and selection without GPS permission, independent city/distance
visibility, owner preview, and Off/Clear. Dates describe last-known positions or city
selection, including Unknown for legacy missing timestamps. City switches remove
saved device coordinates immediately; Clear removes current location data and
visibility while general discovery remains available. City distances explicitly use
an approximate selected-city center. Hidden values and private ranking scores stay
out of serialized responses. The pinned GeoNames catalog requires an explicit
[setup/import](docs/reference-data/geonames.md); builds and tests do not import it.

`location-modes`, `location-projections`, and `location-lifecycle` browser/API cases
exercise real authenticated PostgreSQL writes, queued compare-and-update races,
all four Device/City distance pairs, exact radius/unrounded filtering, visibility,
preview, clear rollback/retry, catalog failures, cross-tab invalidation, stale saves,
logout and account switches. Native GPS uses controlled callbacks: permission
hardware and operating-system dialogs are not measured. An explicit local PG14
backfill probe covered eight synthetic legacy states and related-data preservation;
CI's fresh PG16 migration is separate evidence. A guarded explicit full catalog
reimport verified reference retention, revision advancement and stale-write rejection.
Clear cannot promise removal from old database backups, browser/OS storage or
already-delivered offline copies. Location history and account deletion are outside
this feature.

Profile-photo cases race twelve completions across both profile uploaders and verify
six saved rows, unique append order, owned replay, foreign rejection, account-local
capacity and slot reuse after deletion. Actual authenticated upload middleware rejects
requests exceeding the remaining total before a controlled provider metadata call.
Saved primary photos agree across discovery, owned/public profiles, incoming likes,
matching responses, matches and inbox; browser profile display follows the same order.
All upload entry points validate a captured account/session pair before quota or
provider access when either owner header is supplied; legacy clients may omit both.
First-party uploaders always supply both and cancel their owned attempt on session
replacement. Native handler/browser cases cover stale and malformed owners, a real
cookie switch, held initiation cancellation and an asynchronous directory-drop
callback after unmount. Storage responses are controlled; no real asset is uploaded.
Legacy ties use an ID tie-breaker. These cases exercise trusted completion callbacks
and synthetic provider requests, rather than live uploads or webhook signatures.
The cap applies to registered gallery rows; unregistered provider objects require a
separate orphan-cleanup policy.

API-error cases inject a synthetic PostgreSQL failure and verify a generic 500,
matching response/log correlation ID, rollback and successful retry. Unit cases
verify redacted logging and retain safe validation/access/conflict/retry contracts.
Malformed raw JSON across eight application handlers returns 400 after authentication;
valid writes still succeed. Unexpected HTTP message errors use the shared internal
error response; expected message errors retain their domain contracts.

Application journeys require the prepared local native Supabase target and its
verified random marker; ordinary unit/schema checks retain their test-name guard. Each run uses unique synthetic emails and cleans up only its own accounts
and matches, including after failures. Unit tests also cover compatibility/ranking,
distance, form validation, and upload-handler access with mocked adapters. External
storage uploads, full wall-clock outage rehearsal, broader device/layout coverage, and other browsers remain
outside this E2E coverage.

Failure screenshots and traces go into ignored `test-results/` and
`playwright-report/`. Use `npx --no-install playwright show-report` to inspect them.
CI retains ordinary PostgreSQL schema/build/unit evidence and runs every
application/native journey on its owned disposable Supabase stack.

Lint, formatting, and Git hooks follow the supplied MVP Realty tooling setup,
adapted for Bondi's npm/Next.js app. `npm ci` installs Lefthook: pre-commit fixes
staged files and verifies runtime changes with a fresh build and E2E; pre-push
checks types, strict lint, and formatting. See
[tooling conventions](docs/tooling.md) for shared config, exclusions, and source
provenance. [The adoption record](docs/research/2026-11-14-harness-adoption.md)
records validation and remaining coverage gaps.

## AI development workflow

The repository carries shared instructions and skills for Codex, Claude Code,
Cursor, and other compatible tools. [AGENTS.md](AGENTS.md) is the canonical project
contract; [client compatibility](docs/agents/clients.md) explains discovery and adapters.
Builds and tests work independently of AI clients, global skills, and MCP servers.

A selected core of Matt Pocock's workflow and Ponytail is installed as pinned local
skill snapshots, with complete resources and licenses:

`grill-with-docs → to-spec → to-tickets → implement → code-review → retro`

Use the phases needed for the task and Ponytail for focused simplification or review. [The workflow guide](docs/agents/skills.md) records versions, invocation,
GitHub tracker configuration, and how to update the snapshots. Imported files are
integrity-checked; client hooks, telemetry, model settings, and permissions remain
outside the shared harness. Refresh the client after installing repository skills.

## Deployment

The runtime needs a standard Next Node host, Supabase Database + Realtime, HTTPS,
and UploadThing credentials for uploads. See [deployment preparation](docs/deployment.md)
for environment settings, release commands, and the remaining verification gates.
A live demo link will be added after a deployment is verified.

The [Supabase release audit](docs/supabase-release-readiness.md) maps the completed
Database + Realtime tickets, native/populated-rehearsal evidence and the explicit
production go/no-go checklist. Better Auth and UploadThing remain in use; no
production cutover is claimed by local/CI checks.

## Project history

The first commit was on **26 October 2025**. The **November 2026** modernization
adds a portable development harness, repeatable checks, initial automated coverage,
and clearer browser/server boundaries. The original Git history is preserved.
