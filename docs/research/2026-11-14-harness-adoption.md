# Bondi harness adoption — 2026-11-14

## Scope and source identity

The requested slice is a portable engineering harness and useful skills before
larger structural refactors. Bondi started clean on `main` at `798704d`.
Implementation is on `codex/agent-harness`; no commit or push is implied by setup.

Photo Booth was clean on `staging` at `ee757c6`. Fetched `origin/main`, switched to
`main`, and pulled with `--ff-only`, advancing from `8239b6b` to
`c2b72cb7b05892ee678c4737179dd55897167180`. Verified HEAD equals `origin/main`.
Photo Booth remains on `main`; its code was not adapted here.

The staging checkout had Claude skill adapters, shared role prompts, and client
compatibility documentation absent from updated main. Main already had shared
AGENTS instructions, skill provenance, context handoff, deterministic checks,
and browser/CI workflows. Bondi adapts these patterns; it does not represent every
staging file as a main-branch file.

## Comparison and resulting changes

Photo Booth uses pnpm, static Next export, Workers, browser-media lifecycle tests,
and a camera/export domain. Bondi uses npm, a custom Node server, server-side auth,
PostgreSQL/Prisma, uploads, and Socket.IO. Copying static-export config, Worker
scripts, camera assumptions, tracker identity, or machine paths would be wrong.

The harness adds one shared AGENTS contract, Claude/Copilot entry points,
complete local skills with relative Claude links, hash/license checks, a fail-fast
check runner, initial behavioral/browser tests, explicit migration commands,
setup/runtime documentation, and CI with disposable Postgres. Native models,
compaction settings, accounts, permissions, and plugin hooks remain client-owned.
Static checks do not prove live skill discovery or model compliance.

The old build automatically ran `prisma migrate deploy`; the new build compiles
without migrating a database. Deployment/test setup runs migrations explicitly.
A production build exposed an invalid route export: PhotoUpload imported its
browser helper from a route exporting both server router and client helper.
The router now lives in `lib/server/`, the typed helper in `lib/client/`, and the
route exports GET/POST only. Focused handler tests also caught rejected uploads
returning HTTP 500; all three entry points now use the installed UploadThing
version's supported `FORBIDDEN` code (403). Real uploads have not been qualified.

Per the follow-up request, Matt Pocock's current published 27-skill set (1.3.2,
commit `5863806`) and Ponytail's six skills (5.3.3, commit `96608e0`) replace the
older selected Matt imports. Published files/resources are intact. Photo Booth's
two performance skills retain its pinned snapshot. Revisions, licenses, and hashes
are in `third-party/skills-provenance.json`; [the guide](../agents/skills.md)
documents the flow and Vercel, Better Auth, and Prisma candidates investigated.

The user selected GitHub Issues in `montuyamaricela/bondi`, standard labels, and
one domain-doc context. The connection reports READ access and no push/triage
permission. Creating the first missing label returned HTTP 404. `wontfix` exists;
four other labels still need a write-capable connection. No issues, comments,
or PRs were posted.

## Baseline observations

- No repository-local harness, tests, or CI existed in the initial checkout.
- `CLAUDE.md` was ignored, preventing a tracked shared Claude contract.
- Full lint had six errors and twelve warnings, including effect-driven state
  initialization, unescaped text, and an empty interface. These remain unchanged;
  the harness does not lower severity or hide errors.
- Socket setup is duplicated in three places. The original sample targeted port
  3001 while the combined dev server listened on 3000; the example now targets
  the combined origin. Process-local state still cannot establish delivery
  between processes. Follow-up refactoring must cover it.
- The initial tests do not establish authenticated resource authorization,
  matching, message delivery, upload persistence, or real-device behavior.

## Initial verification evidence (before the linting follow-up)

- `npm run check:harness`: passes for 37 skills, imported hashes/licenses,
  relative Claude adapters, and maintained entry-point links.
- `npm test`: 14 tests pass, including check-runner failures, corrupt skill/link
  rejection, pure product behavior, and upload authorization/metadata at the real
  route-handler boundary with mocked session resolution and storage HTTP.
- `npm run typecheck`: passes for Next route types, the app, and Node servers.
- `npm run db:migrate`: all migrations apply to a newly created disposable local
  PostgreSQL database. `db:validate` also passes with its URL configured.
- `npm run build`: production Next and custom-server compilation succeeded after
  the route split. Initial attempts encountered disk exhaustion and a font-loading
  failure; clearing only generated build/npm caches allowed verification to proceed.
- `npm run test:e2e`: all four built-app Chromium journeys pass. The first run
  caught an ambiguous test locator; it now selects the actual product heading by
  accessible name. No product requirement or assertion was removed.
- `git diff --check` and the skill creator validator for both owned skills pass.
- `npm run check`: reaches lint and exits nonzero on the same six existing errors
  and twelve warnings. The standalone build/browser passes do not make this gate
  green. Generated `dist/` and browser artifacts are excluded from source lint.
- Standards review: its upload-coverage finding was repaired and independently
  rechecked with the two focused tests passing. Spec review: no actionable findings.
  These reviews do not replace runtime or authenticated integration evidence.

Actual session expiry, signed upload completion/persistence, authenticated matching,
real-time delivery, and native skill discovery in fresh Codex/Claude/Cursor sessions
remain unqualified. Claude's manifest validator returned success without enumerating
skill contents, so it is not counted as discovery or validation evidence.

The employer-facing README uses an actual screenshot from the local production
build. Git history establishes the first commit as 2025-10-26; the README clearly
separates that origin from November 2026 modernization. No public demo is claimed;
`docs/deployment.md` records the current Node/WebSocket requirements and release gaps.

## Follow-up structural work

Use [the architecture guide](../architecture.md) to scope the next slices: add
session/resource integration coverage, establish one socket runtime owner,
extract server operations through stable interfaces, and separate mixed
browser/server modules as touched. Move directories when it improves tested seams.

## MVP Realty linting follow-up

The user then requested the linter setup from the supplied MVP Realty `tooling/`
directory. Its local checkout is revision `f26459c` with remote
`Medianeth/mvp-realty`; `55livingteam/mvp-realty` could not be resolved through
this connection. The [tooling guide](../tooling.md) records the adapted rules,
formatter, hooks, environment compatibility list, and source provenance.

The formatter normalizes maintained source/docs while imported snapshots remain
byte-for-byte unchanged. Existing lint failures were repaired with focused state
behavior tests. The final `npm run check` passes end to end: 15-skill integrity, formatting,
21 behavioral/harness/component tests, Prisma schema validation, app/server types,
strict lint, and production build. Hook configuration validates and hooks are
installed. The source core-JavaScript and full accessibility recommendations are
explicitly included; negative tests guard against losing them. The built-app suite
now includes the four public/anonymous journeys plus two theme persistence/system
preference journeys. All six built-app browser journeys pass after the final hydration repair below.
This supersedes the initial red lint baseline above, without erasing that history.

## Skill simplification

The user subsequently asked to avoid an oversized skill catalog. Reduced the
repository from 37 skills to 15: the six main Matt workflow phases, six supporting
Matt skills (including the writing reference required by `retro`), Ponytail core,
and the two Bondi verification/data procedures. Removed 22 optional skills, their
Claude adapters, and unused vendored resources. The retained complete upstream
directories and hashes are unchanged; current selection is recorded in provenance.
This supersedes the earlier full-catalog counts and keeps the main flow intact.

## Final theme regression repair

The standards review reproduced a saved-theme hydration mismatch in the Settings
selector after the provider cleanup. Added an SSR-to-hydration regression that
failed on the wrong selected control, then supplied a stable server/initial-client
snapshot before exposing the saved preference. The focused regression now passes
without markup warnings. This is separate from HTML theme-class browser coverage.
