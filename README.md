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
npm run check            # All gates above, schema validation, and build
npm run check:feature    # Before a feature commit: full checks/build, then E2E
```

`npm run build` generates Prisma artifacts and compiles Next plus the Node servers.
It does not apply database migrations. `npm run check` stops at the first failed gate.

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

The suite starts the built combined app/socket server on port 3100. It covers public
pages, themes, anonymous access, and one authenticated journey: two users sign up,
complete profiles, log out/in, mutually like each other, and exchange live messages
that survive reloads. Likes use the real discovery API; onboarding, match navigation,
and chat use the browser. A third authenticated user is denied match/message access
and forged HTTP/socket sends; public profiles omit exact coordinates and auth data.

Use a local disposable database whose name contains a `test`, `e2e`, or `harness`
segment. Each run uses unique synthetic emails and cleans up only its own accounts
and matches, including after failures. Unit tests also cover compatibility/ranking,
distance, form validation, and upload-handler access with mocked adapters. Upload
completion, swipe gestures, session expiry, mobile layouts, and other browsers remain
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
