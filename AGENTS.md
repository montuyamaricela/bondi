# Bondi project contract

Prefer evidence over agreement. User requirements define intended behavior;
implementation and observed checks establish what currently works. Report failures
and untested limits accurately.

## Start here

- Read [architecture](docs/architecture.md) for ownership and existing seams.
  Read only task-relevant skills and documents.
- `package.json` owns commands and versions; [README](README.md) owns setup.
  Use npm and the committed lockfile. Builds and tests must run without global
  skills, MCP servers, or a particular AI client.
- [Tooling](docs/tooling.md) owns lint/format/hook conventions. Edit shared configs
  under `tooling/`; preserve imported skill snapshots. Run strict lint and
  formatting checks rather than adding inline suppressions for existing failures.
- For changes spanning features, first record the affected interfaces, acceptance
  behavior, and verification in a short plan. Keep changes reviewable.
- On a resumed session, follow [context handoff](docs/agents/context-handoff.md).

## Boundaries

- Keep Next routes thin. Colocate feature UI, hooks, validation, and types under
  `app/components/features/<feature>/`. Put browser adapters in `lib/client/`,
  server data operations in `lib/server/`, and shared pure logic in `lib/`.
  Improve these boundaries as touched; a directory migration needs its own scope.
- Resolve sessions on the server. Check resource ownership and active match
  membership at each HTTP and Socket.IO entry point. Middleware redirects do not
  authorize API operations. Treat client IDs, room IDs, uploads, and payloads as
  untrusted input.
- Keep Prisma and server auth code out of browser bundles. Preserve cookie,
  session expiry, profile privacy, and location visibility behavior when refactoring.
- Keep credentials, cookies, tokens, private messages, exact locations, and real
  profile data out of logs, fixtures, and committed artifacts. Use synthetic users.
- Reuse local shadcn/ui, Radix, React Hook Form, and Zod patterns; validate writes
  at the server boundary. Give retained sockets/listeners/object URLs cleanup owners.
- `server.ts`, `socket-server.ts`, and `lib/socket.ts` currently duplicate socket
  setup. Inspect all three before changing event behavior; consolidate only with
  equivalent authorization, room, delivery, and disconnect coverage.
- Run database migrations explicitly against a known development/test database.
  Builds and verification must not apply migrations or seed data. Existing
  migrations remain immutable; add a new migration for schema changes.

## Agent skills

- `.agents/skills/` is canonical. Prefer an exact repository skill path over a
  same-named global skill; preserve its invocation policy.
- Use [bondi-change-verification](.agents/skills/bondi-change-verification/SKILL.md)
  for runtime, test, build, and harness changes.
- Use [bondi-data-boundaries](.agents/skills/bondi-data-boundaries/SKILL.md) when
  changing auth, profiles, discovery, uploads, matching, messaging, or sockets.
- `codebase-design` supports structural changes; `diagnosing-bugs` supports bug
  investigation; `domain-modeling` supports resolved terminology and decisions.
  Select review and test-first workflows when relevant;
  install provenance and project adaptations belong in [the skill guide](docs/agents/skills.md).
- Matt workflow configuration: [GitHub tracker](docs/agents/issue-tracker.md),
  [standard triage labels](docs/agents/triage-labels.md), and
  [single-context domain docs](docs/agents/domain.md).
  [The skill guide](docs/agents/skills.md) describes the compact installed main flow.
- Use Ponytail as a simplicity/review lens while preserving user requirements,
  authorization, validation, privacy, accessibility, and required checks.
  Upstream plugin hook/status-band instructions do not apply to this skill-only installation.
- Keep imported skill directories unchanged; update their complete snapshots and
  recorded hashes together. Put Bondi-specific instructions in owned files.
- [Client compatibility](docs/agents/clients.md) describes Claude, Codex, Cursor,
  Copilot, and other clients. Repository files do not grant permissions, install
  tools, or prove a live client loaded instructions.

## Verification and completion

- Run focused checks while iterating. Lefthook automatically runs
  `npm run check:feature` for runtime/test/config commits after staged fixes:
  full checks, a fresh production build, then E2E. Configure the dedicated test
  environment as described in [tooling](docs/tooling.md). Failures block commits.
  Run the same gate explicitly before handing off an uncommitted feature, including
  after runtime repairs from review. Stage or park unrelated runtime work so
  verification covers the intended commit.
  Documentation-only changes use focused formatting/link checks. Inspect actual
  exit codes and artifacts; list blockers separately from successful checks.
- Preserve meaningful assertions and failure paths. Empty suites, skipped tests,
  relaxed rules, and altered expectations do not fix existing failures.
- Separate unit evidence, browser smoke evidence, and authenticated integration
  evidence. Consult [browser coverage](README.md) for exercised
  authenticated journeys and remaining gaps; add cases for changed behavior.
- Hand off the result, verification, and material remaining risks. Keep temporary
  context in ignored local notes; lasting decisions belong in maintained docs.
