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

While editing, run focused tests for fast feedback. The current forty-two-test browser
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

The delivery cases cover HTTP/socket sends in all three owners without joining a
chat, both participants' inboxes and browser notification preferences, transactional
notification failure rollback and retry, expired-session audiences and unmatch denial.
A real browser selects a library socket owner while HTTP stays on the combined app.
A PostgreSQL completion-failure trigger causes repeated hints; the same owned browser
connection shows one notification and recovers its pending intent after owner restart.
Only the OS notification adapter is replaced; auth, database and socket traffic are real.

The discovery selection cases use actual sessions and PostgreSQL candidates to
exercise eligible candidate 51 and a second 100-row batch, zero coordinates,
mutual preferences across all gender values, private/unknown distance, and handled
or active-match exclusions. Invalid/partial filters and missing-location responses
use the public API. A browser applies a distance filter, follows actionable error
controls and removes the filter without reloading. The old automatic permission
request is suppressed only in this fixture; its lifecycle remains tracked in #35.

Discovery transition cases drag real browser cards and hold actual API response
bodies across accepted like/pass writes and refetches. A/B/C/D stay in order both
before and after shifted feed responses. A scoped PostgreSQL Like-insert failure
leaves the same card centered and usable; retry succeeds. Holding that accepted
POST response keeps the card busy and further gestures cannot submit another write.
No auth, feed result or write is mocked; the fixture removes its failure trigger.

### Pagination verification and budgets

GET history, inbox and received-like pages default to 50 and cap at 100 public
items; selection queries use one extra row for continuation. Pagination uses a
stable timestamp/ID boundary, with no offset or arbitrary history truncation.
The tests traverse 10,000 tied messages and 121 conversations / 120 incoming likes,
exercise anonymous/expired/foreign/former-member access, and validate malformed,
wrong-resource and duplicate cursor parameters. The browser loads older messages,
preserves its visible anchor and draft while a real live message arrives, and
continues both lists. A delayed real inbox search must find an unloaded conversation.
Literal search characters are not SQL wildcards. Native TanStack observer tests
cover stored-page and selected-array sharing as well as live/read-receipt merging.

The representative payload budget is below 1 MiB per page, including a 100-message
fixture whose newest 100 messages contain 5,000 characters each. The measured largest
page was 547,465 bytes. This is a fixture budget, not a byte cap on arbitrary legacy
profile/attachment fields. Gallery invariants remain tracked separately in #34.

The reference selection-query budget is under 100 ms on the local disposable test
database at these fixture sizes; it is not a production latency or CI wall-clock SLA.
After `ANALYZE` on the synthetic fixture, PostgreSQL 14.17 with warm buffers showed
the first/deep 10,000-message queries previously
read 10,000/5,000 rows and sorted, taking 1.516/3.980 ms with 388/323 shared hits.
With `Message_matchId_createdAt_id_idx`, both used index-only scans of 51 rows,
taking 0.035/0.020 ms with 7/9 shared hits. The 121-conversation activity selector
returned 51 rows in 1.459 ms (494 shared hits); the 120-like selector returned 51
in 12.095 ms (483 shared hits). Those are individual SQL selection measurements,
not full HTTP/unread-count/p95 measurements. The browser fixture inserts rows
immediately before collecting plans without forcing an index. Its statistics may
not yet reflect those rows, so its attached planner choice and timings can differ
from the analyzed comparison while the page/payload limits remain fixed. Inbox activity computation still scales
with that participant's eligible matches; no global denormalized activity field or
new search index was introduced without supporting measurements.

Run `npm run test:e2e -- tests/e2e/pagination.spec.ts` after the normal explicit test
migration and fresh build. The owned synthetic fixtures attach current sanitized
`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` plans and payload measurements to the
Playwright report. Historical before-index measurements were captured before adding
the migration; reproducing those requires a separate database at the prior revision.
The migration is additive and must be applied explicitly before deploying the reader.

Cursor comparisons use UTC ISO text cast to the stored `timestamp` type; a raw
Prisma Date parameter is a different timestamp type on this PostgreSQL adapter.
The test checks exact tied-ID boundaries under UTC, Asia/Manila and America/New_York.
See [PostgreSQL timestamp input and conversion](https://www.postgresql.org/docs/16/datatype-datetime.html#DATATYPE-DATETIME-INPUT-TIMESTAMPS)
and [Prisma v6 parameterized raw queries](https://www.prisma.io/docs/orm/v6/prisma-client/using-raw-sql/raw-queries).

### Profile-write verification

Five authenticated profile-write cases cover shared setup/edit limits, malformed
JSON, strict integer age, 1–10 nonblank labels of at most 100 characters, custom
label preservation, anonymous/expired sessions and forged owner IDs. Scoped
PostgreSQL Profile-insert and File-update triggers prove that failed operations
retain the prior account/profile/gallery state and that retry succeeds. Complete
owned photo orders reject duplicates, omissions, stale/foreign keys and an empty
order for a nonempty gallery. Parallel successful writes return each request's
complete profile/order and leave one coherent final result. No storage provider is
called. A browser verifies decimals and cleared ages in both forms and saves a valid
edit through the normal interface. Pure schema tests keep both client forms aligned.

### API-error verification

`tests/e2e/api-errors.spec.ts` uses authenticated synthetic accounts and a scoped
PostgreSQL Profile-update failure. The 500 response contains only a generic message,
code and UUID, echoed in `X-Request-ID`; no injected SQL/path/credential marker escapes.
Account/profile writes roll back, valid retry succeeds, and anonymous/expired writes
remain rejected. A second case sends raw malformed bytes to eight application JSON
handlers, checks 400 and unchanged profile state, then exercises valid location,
privacy, notification and presence requests plus safe validation failure.
`tests/unit/api-errors.test.ts` checks exact redacted logger arguments and generic
non-Error/SyntaxError handling while retaining trusted validation, access, conflict
and photo-deletion-style retry responses. It does not assert third-party SDK logging
or a separate private telemetry pipeline. Raw Prisma query/error logging is disabled.

### Profile-photo quota and ordering verification

`tests/e2e/profile-photos.spec.ts` exercises both actual upload completion callbacks
against PostgreSQL. Twelve concurrent calls accept exactly six registered photos,
with distinct sequential append positions. Owned replay at capacity returns the
same row; foreign claims fail without writes. Repeated single-photo requests use
the same cap; deletion permits another append without reusing a conflicting order.
The authenticated UploadThing handler uses a synthetic token and controlled metadata
fetch to verify remaining-capacity rejection before provider contact, session identity,
anonymous denial and expired-session denial. No real provider asset is contacted.

An authenticated profile reorder is read through discovery, owned/public profiles,
incoming likes, match creation, match list/detail and conversations. A browser checks
the displayed primary photo while intercepting image optimization requests with a
synthetic pixel. Legacy ties resolve by ID. These checks cover gallery registration,
not provider-side orphan cleanup or signed webhook delivery. Uploads that race past
preflight may be rejected at completion after a provider object already exists.

### Explicit location lifecycle verification

`tests/e2e/location-lifecycle.spec.ts` controls one-shot native callbacks while
exercising actual browser navigation, authenticated HTTP and PostgreSQL. Discovery
entry makes zero location calls; Settings Enable saves a fresh fix and its server
timestamp, and returning through the client navigation reloads the invalidated feed
without a document reload. Zero coordinates survive a new Settings mount as last-known.
Native error codes 1/2/3, unsupported geolocation and insecure context have retryable
feedback. A scoped Profile-update trigger proves save failure leaves stored state
unchanged; Retry save succeeds without another geolocation call.

A delayed result after cookies switch accounts receives 409 before writing; refreshing
identity mounts clean account-owned state. Leaving Settings ignores a later callback
without another PATCH. Missing/expired sessions, invalid/out-of-range coordinates and
malformed JSON remain rejected; a forged body owner cannot select another profile.
Native GPS/permission dialogs and mobile hardware are outside these callback-controlled
cases. Browser abort cannot undo an HTTP write already accepted for its original owner.

### Received-like action verification

`tests/e2e/received-like-actions.spec.ts` proves that prior PASS and LIKE directions
are excluded before the page limit, leaving an eligible older incoming like visible.
The authenticated API preserves stored interactions, rejects PASS-to-LIKE changes,
keeps same-action replay idempotent and rejects missing/expired sessions. A query
owner parameter cannot grant another account's list.

The browser first encounters a scoped PostgreSQL Like-insert failure and retains
the actionable card. A successful action then triggers a held real list response;
a second successful pass removes its card while the newer GET is also held. Releasing
the older snapshot cannot restore it, and a reload plus direct API read agree.
The fixture uses normal mutation invalidation rather than changing the application's
disabled window-focus refetch policy. No undo, interaction reset or schema change is
introduced. Existing compound Like uniqueness supports the handled-direction lookup.

### Login destination and recovery verification

`tests/e2e/login-navigation.spec.ts` follows an anonymous protected message path and
query through real sign-in to its authorized chat, and checks an already signed-in
login redirect. A real null profile completes all onboarding steps before returning
to the requested Settings query. A rejected credential attempt performs no profile
read; after valid sign-in a controlled HTTP profile failure offers recovery, avoids
onboarding and preserves the callback. Retry restores the real profile request and
continues without another credential POST. Unsafe callbacks never contact the
reserved external test origin and use the discovery fallback.

Pure tests cover internal paths/queries/explicit fragments, malformed and unsafe
values, auth loops and onboarding URL preservation. A middleware unit adapter injects
a failed profile read after a synthetic session resolution and asserts safe recovery
and redacted logging. That unit adapter and the browser's controlled profile HTTP
failure are distinct from a real PostgreSQL outage; ordinary auth/profile/onboarding
paths use the dedicated database. Runtime builds remain separate from migrations.

### Notification input verification

`tests/e2e/notification-inputs.spec.ts` creates synthetic owned/foreign rows in the
local test database. The list checks default 20, limits 1/100, tied timestamp order,
explicit unread filtering, owner isolation and rejection of negative/nonnumeric/empty/
fractional/scientific/huge limits and duplicate parameters. Native query values stay
bounded before Prisma reads. Anonymous and expired sessions remain unauthorized.

Bulk cases reject invalid/blank/oversized IDs, more than 100 raw entries, invalid
members/booleans and malformed JSON without changing read state. Empty arrays remain
successful no-ops; within-bound duplicates, a single ID and mixed owned/foreign IDs
retain existing ownership behavior. Mark-all modifies only the actor's unread set.
The pre-fix list regression stops at a negative limit returning 200, before reaching
the oversized test values; no production-sized query is used for reproduction.

### Keyboard, dialog and emulated touch verification

`tests/e2e/public-access.spec.ts` follows the landing How we do it anchor with native
Tab/Enter, checks section focus below the fixed navigation, and continues by keyboard
through the single Get started link to signup. It checks internal hash destinations,
the absence of unsupported learning claims, and the still-unauthorized profile API.
The pre-fix regression fails because How we do it has no link destination. This is
public navigation evidence; authenticated onboarding is covered separately.

`tests/e2e/keyboard-controls.spec.ts` uses native Tab/Shift+Tab, Enter, Space and arrow
keys. Password visibility retains its value without submitting login; a named Music
removal preserves other selections and saves the owned profile. Discovery buttons
exercise a scoped PostgreSQL Like-insert failure, retry and an actual held response:
both controls remain disabled until the accepted write resolves, then Like/Pass
records and candidate progression agree. Unique synthetic interests isolate ranking
without deleting other test data.

The photo dialog initially focuses Close, traps forward/backward Tab, navigates/wraps
images, closes by Escape or its button, and restores the opener and body overflow
through repeated openings. A 390×844 Chromium touch context taps discovery actions
with at least 44-pixel targets and navigates/closes photos. Native avatar image URLs
and Next image-optimization requests are both fulfilled with a synthetic pixel in
these cases; no provider asset is used. These checks establish targeted browser
behavior, not assistive-device certification or physical-device coverage.
