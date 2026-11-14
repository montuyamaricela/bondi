# Linting, formatting, and Git hooks

Adapted from the supplied local MVP Realty checkout at revision
`f26459caed8e4c9ab5584fd620088286591fc336`, specifically `tooling/eslint-config/`,
`tooling/prettier-config/`, and `lefthook.yml`. That checkout's remote is
`Medianeth/mvp-realty`. The requested `55livingteam/mvp-realty` URL was unavailable
to this connection on 2026-11-14; this is not a claim to have copied that remote.

## Shared configuration

`tooling/eslint-config.mjs` combines Bondi's version-matched Next/TypeScript flat
configs with the source's core JavaScript and full accessibility recommendations,
plus MVP Realty's correctness rules: strict equality, unused-value errors,
safe promise executors, explicit assignment/parameter flow, and unused-disable
reporting. `eslint-config-prettier` runs last so Prettier owns formatting.
`npm run lint` treats warnings as failures; `npm run lint:fix` applies safe fixes.

Environment access is restricted to explicit existing owners, config files,
scripts/tests, and future env modules. MVP Realty already has validated env
modules; Bondi does not yet have that layer. The compatibility list in the shared
config prevents new environment readers from spreading without changing runtime
validation during this tooling migration. Socket.IO's `socket.data` and Node's
response object use documented mutable APIs, so property writes to `socket` and
`res` are the narrow parameter-mutation exceptions.

`tooling/prettier-config.mjs` uses the source's semicolons, single quotes, trailing
commas, two-space indentation, and 100-column width. Tailwind class sorting loads
Bondi's actual v4 stylesheet and handles `cn`, `clsx`, and `cva`. Root configs are
small entry points; this single app does not need pnpm workspace config packages,
Turborepo, Payload rules, or a TypeScript/runtime migration.

`npm run format` formats maintained source/docs; `npm run format:check` checks
them. Generated files, the npm lockfile, imported skills, and third-party snapshots
are excluded. Skill contents are verified by hashes instead of rewritten.

## Hooks and CI

`npm ci`/`npm install` installs Lefthook through the `prepare` script. Restore hooks
with `npm run hooks:install`, and validate configuration with `npm run hooks:validate`.
All commands use locked local binaries; they do not fetch a newer linter.

Pre-commit runs ESLint fixes, then Prettier on applicable staged files and restages
the fixes. It then runs `scripts/pre-commit-e2e.mjs`, which invokes
`npm run check:feature`: full checks, a fresh build, and browser E2E. Commands run
sequentially so verification sees the fixed files. Failed setup, build, or tests
block the commit. Documentation/agent-guidance-only commits skip the expensive gate;
all other paths trigger it, including deletions and code moved into `docs/`.

Lefthook preserves partially staged edits while fixing staged files. Full verification
requires all intended runtime changes staged: partial staging or other
unstaged/untracked runtime files block the gate. Stage or park that work before retrying. It does not stash or discard work itself. Integration
tests exercise partial staging, filenames with spaces, imported-skill exclusions,
actual failed commits, documentation-only skips, and missing configuration.

### Local E2E setup

Copy `.env.test.example` to ignored `.env.test.local`. Set its `DATABASE_URL` to
a disposable test database and keep its origins on `http://127.0.0.1:3100`.
Use synthetic auth credentials and test-only service tokens. The hook requires
the test file's values and loads them over inherited shell settings; it never
falls back to a production database URL from the shell. The file remains local.

Apply database migrations explicitly against that test database before the first
run, and install Chromium with `npx --no-install playwright install chromium`.
The hook never migrates or seeds a database. Missing setup blocks runtime commits
with a setup message. Keep ports 3100 and 3101 free for the hook's owned combined
and standalone servers. The initializer test owns and closes an ephemeral listener.

While editing, run focused tests for fast feedback. The current twenty-four-test browser
suite is small enough for the commit gate; revisit a smaller commit smoke suite
plus fuller CI coverage if the suite grows substantially. CI still runs its own
checks and E2E independently. Add journeys for changed acceptance behavior; the
authenticated journey covers onboarding, mutual likes through the API, live two-user
chat and history, and outsider HTTP/socket denial. A separate legacy-credential
case verifies account/profile preservation and rejected access after upgrades.
The session lifecycle case verifies immediate HTTP rejection after revocation or
expiry with retained signed cache cookies, plus valid session renewal.
The socket lifecycle case exercises the combined, standalone, and library
initializer owners: valid room/message/read behavior and all seven incoming actions
after expiry/revocation. It verifies an auth error, disconnect, and no unauthorized
message/read/typing side effects using real sessions and sockets.
The message-write case verifies runtime payload parsing, the text limit and trimming,
active membership, and attachment ownership/metadata across HTTP and all socket
owners. It calls the trusted upload-completion callback with synthetic files and
checks PostgreSQL records; external storage and webhook signature delivery are not exercised.
The retry case exercises eight concurrent identified operations per transport against
PostgreSQL, conflict rejection and sender/conversation scoping. A browser WebSocket
proxy drops a real saved acknowledgement and closes the connection; retry must
retain the same operation ID, render one saved message, and avoid duplicate
notifications. A rejected write retains its draft too.
The recovery case reconnects an already-populated chat after a socket-only outage,
holds its history response while a live message arrives, and verifies ordered,
duplicate-free convergence and draft preservation. Pure merge tests also cover
timestamp ties, conversation isolation, and non-regressing read receipts.
The matching case uses authenticated HTTP calls and real PostgreSQL transactions,
including a fixture-only notification trigger that injects failure and is removed
in cleanup. It checks rollback/retry, notification preservation/repair, repeated
opposite-direction concurrency, database pair uniqueness, and pass/unmatch rules.
The photo-deletion case verifies HTTP auth/ownership/expired-session/missing-token
behavior, real PostgreSQL references and cleanup failure injection, and actual SDK
response handling through a synthetic fetch adapter. Provider failure retains the
owned reference; confirmed deletion and retry clean it up without touching another
owner's file. External storage network behavior is not exercised.
The onboarding-draft case uses real accounts in one browser to verify same-owner
reload/expiry, normal logout, legacy cleanup and a different account signing in from
another tab. Returning to the original tab refreshes identity without a reload and
must reset private form/image state. Its saved image is synthetic; it does not upload.
The unmatch cases exercise actual sessions, PostgreSQL and all three socket owners:
allowed communication, foreign typing rejection, ended-match updates restricted to
participants, live-action denial, and retained read-only history. Two open browser
chats must both become read-only after one participant unmatches.
The presence cases cover authorized initial snapshots and live audiences in all
three owners, multi-tab aggregation, last disconnect, privacy retraction/re-enable,
unmatch and expired-session filtering. The new presence request also participates
in the session lifecycle matrix (42 rejected actions). Real chat/inbox indicators
exercise navigation and privacy changes through the keyboard-accessible settings.
Four provider lifecycle cases hold real token requests/responses/body parsing across
logout or account changes. They count new Engine.IO handshakes rather than polls or
upgrades, check that a still-valid old session cannot become an orphan connection,
and exercise stable-owner refresh and replacement-session behavior. Date-only clock
control advances the SDK's focus-refresh throttle; network responses and timers
remain real. Authentication and session payloads are not mocked.
The journeys use unique synthetic accounts and targeted cleanup. Use a local database
with a `test`, `e2e`, or `harness` name segment. This is focused coverage, not a full
security audit or coverage of external storage uploads, swipe gestures, idle socket termination, or every
socket lifecycle event. See README for the exercised boundaries.

Pre-push runs type checking, strict lint, and formatting checks. It does not apply
migrations, push on its own, or replace the full verification command. CI runs
`npm run check`, which now includes `format:check` alongside harness integrity,
tests, schema validation, types, lint, and production build. It also runs
`npm run audit:critical`; a critical audit result or registry failure blocks the
gate for review. Audit severities are not claims of exploitability. Lower-severity
findings remain visible and need triage rather than forced major-version fixes.
Browser tests remain
a separate built-app gate.

## Baseline cleanup

The one-time formatter pass normalizes the maintained codebase. Lint repairs
remove unused values, preserve timer behavior without returning timer handles,
and fix escaped text and hook dependencies. Clickable photos, notification items,
step indicators, and modal backdrops use native controls; privacy switches have
accessible labels. Theme state reuses the installed
`next-themes` provider; notification permission subscribes to browser state; match
dialogs mount for a specific match and clean up delayed-close timers. Focused
component and browser tests cover the changed state behavior. No lint rule was
disabled to conceal the previous baseline failures.

Official references:
[Prettier configuration](https://prettier.io/docs/configuration),
[Tailwind sorting](https://github.com/tailwindlabs/prettier-plugin-tailwindcss),
[Lefthook configuration](https://github.com/evilmartians/lefthook/tree/v2.2.2/docs/configuration),
and [next-themes](https://github.com/pacocoursey/next-themes/tree/v0.4.6).
