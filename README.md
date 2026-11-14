# Bondi

A full-stack dating app for creating a profile, discovering people, matching on
mutual likes, and continuing the conversation through real-time messaging.

Built with Next.js, React, TypeScript, PostgreSQL, and Socket.IO.

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

A custom Node server hosts Next and Socket.IO together. This lets HTTP handlers
and connected clients share the socket instance within one process. A separate
socket entry point also exists; consolidating duplicated socket setup behind a
well-tested interface is a documented next step.

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

Requirements: Node.js 22.14 (`.nvmrc`), npm 10.9.2, and a PostgreSQL database.

```bash
git clone https://github.com/montuyamaricela/bondi.git
cd bondi
nvm use
npm ci
cp .env.example .env
```

Fill in `DATABASE_URL` and a random `BETTER_AUTH_SECRET` of at least 32 characters.
Set `UPLOADTHING_TOKEN` to enable uploads. The example uses the combined server
for both the app and sockets at `http://localhost:3000`.

Export the environment before running the custom Node entry points. In macOS/Linux:

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
npm run typecheck        # Next route types, app types, and Node server types
npm run lint             # ESLint
npm run lint:fix         # Apply ESLint fixes
npm run format           # Format maintained source/docs and sort Tailwind classes
npm run format:check     # Check formatting
npm run check:harness    # Skill resources, licenses, hashes, and client links
npm run audit:critical   # Fail on critical advisories; review lower-severity findings
npm run check            # All gates above, schema validation, and build
npm run check:feature    # Before a feature commit: full checks/build, then E2E
```

`npm run build` generates Prisma artifacts and compiles Next plus the Node servers.
It does not apply database migrations. `npm run check` stops at the first failed gate.
It includes a full dependency audit that blocks critical advisories. Remaining
noncritical findings and the checked upgrade boundaries are recorded in the
[dependency baseline review](docs/research/2026-11-14-dependency-baseline.md).

Runtime/test/config commits automatically run `npm run check:feature` after staged
lint/format fixes, blocking the commit if checks, build, or E2E fail. For the hook,
copy `.env.test.example` to `.env.test.local` and configure its disposable test
database; keep the included test origins and synthetic auth secret. Apply test
migrations explicitly and install Chromium before first use. The hook loads this
ignored test configuration automatically. [Tooling setup](docs/tooling.md) explains
partial staging and documentation-only skips. Manual `check:feature` runs use the
exported test environment below.

For browser checks, export a disposable test database and a synthetic auth secret.
Set `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, and `NEXT_PUBLIC_SOCKET_URL` to
`http://127.0.0.1:3100` before building:

```bash
npm run db:migrate
npm run build
npx --no-install playwright install chromium
npm run test:e2e
```

The suite starts the built combined app/socket server on port 3100 and the standalone
socket server on port 3101; keep both ports free. It covers public
pages, themes, anonymous access, and an authenticated journey: two users sign up,
complete profiles, log out/in, mutually like each other, and exchange live messages
that survive reloads. Likes use the real discovery API; onboarding, match navigation,
and chat use the browser. A third authenticated user is denied match/message access
and forged HTTP/socket sends; public profiles omit exact coordinates and auth data.
A separate legacy-credential test signs into a pre-existing account with a password
hash generated by Better Auth 1.3.33, retains its user/account/profile identities,
rejects an incorrect password, and verifies that logout removes access.
A session lifecycle case retains genuine signed cache cookies while revoking or
expiring their backing sessions. The next protected HTTP read/write must reject
them without changing data; valid reads, writes, and session renewal still work.
The socket lifecycle case also exercises the library initializer on an owned
ephemeral port. Across all three owners, it checks real room/message delivery and
read receipts, then rejects all six incoming actions after session revocation or
expiry with an explicit auth error and disconnect. Rejected actions cannot save a
message, change a read receipt, or forward typing.
It also holds a PostgreSQL lock on profile reads while clients connect: room joins
and typing must work before profile initialization finishes in every runtime.
The message-write case exercises HTTP and all three socket owners against the same
validation boundary: malformed/blank/oversized text, the 5,000-character boundary,
active membership, and owned attachment records. It invokes the actual upload
completion callback with synthetic metadata and PostgreSQL, verifies image/PDF/video
limits, and confirms forged client metadata is replaced by the stored values.

Message uploads now register a `MessageAttachment` record separately from profile
gallery files. Apply migrations explicitly before deploying these writers. Existing
messages remain readable; unregistered old upload keys cannot be used for new sends.
The storage network and UploadThing webhook signature path are outside this test.
The retry case sends eight concurrent copies of one operation through each
transport and checks a single PostgreSQL row/canonical ID. Operation IDs are scoped
to sender and conversation; reusing one with different content fails. A real browser
proxy drops a saved acknowledgement and cuts the connection: the draft remains,
retry uses the same ID, and exactly one saved message appears. Explicit server
rejection also retains a retryable draft.

New chat sends keep their draft until a durable acknowledgement. Failed/uncertain
sends can be retried in the open chat using the same operation ID. Legacy callers
without an ID remain supported but cannot receive deduplication guarantees. This
does not guarantee delivery across process crashes or persist drafts across page reloads.
The recovery case disconnects a browser with populated history and a draft, sends
missed messages from its peer, and reconnects without reloading. Room joins are
acknowledged before history refresh. A delayed older HTTP snapshot cannot erase a
newer live message; both views converge in order without duplicates and keep the draft.
The matching case forces a PostgreSQL serialization failure and verifies an actual
transaction retry using a sequence that survives rollback. It also injects a
notification failure and verifies the like,
match, and notifications roll back together. It retries successfully, repairs a
missing notification without replacing an existing read notification, and runs
fifty rounds of eight concurrent opposite-direction/repeated likes. The database
rejects reversed duplicate pairs; passes and unmatched pairs retain their rules.

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
active match. The unmatch cases exercise outsider typing rejection, room eviction,
receipt preservation, session expiry and retained authorized history across all
three socket owners, plus two real open browser chats. Repeated unmatch requests
are safe to retry. The UI leaves the ended live room after HTTP success so its
selected socket owner also reconciles participant state.
Online-status queries return visible presence only for active matches, including
after an unmatch; the same-process singleton cannot expose status to outsiders.

Use a local disposable database whose name contains a `test`, `e2e`, or `harness`
segment. Each run uses unique synthetic emails and cleans up only its own accounts
and matches, including after failures. Unit tests also cover compatibility/ranking,
distance, form validation, and upload-handler access with mocked adapters. External
storage uploads, swipe gestures, idle socket termination, multi-tab presence, mobile layouts, and other browsers remain
outside this E2E coverage.

Failure screenshots and traces go into ignored `test-results/` and
`playwright-report/`. Use `npx --no-install playwright show-report` to inspect them.
CI provisions a disposable PostgreSQL service and runs the same commands.

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

The current runtime needs a Node host with WebSocket support, PostgreSQL, HTTPS,
and UploadThing credentials for uploads. See [deployment preparation](docs/deployment.md)
for environment settings, release commands, and the remaining verification gates.
A live demo link will be added after a deployment is verified.

## Project history

The first commit was on **26 October 2025**. The **November 2026** modernization
adds a portable development harness, repeatable checks, initial automated coverage,
and clearer browser/server boundaries. The original Git history is preserved.
