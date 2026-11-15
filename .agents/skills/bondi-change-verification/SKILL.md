---
name: bondi-change-verification
description: Verify Bondi runtime, tests, build configuration, and agent harness changes using repository commands and report the coverage actually exercised.
---

# Verify a Bondi change

Inspect `package.json` and the affected callers. Run focused checks while editing.
Lefthook automatically runs `npm run check:feature` for runtime/test/config commits
after staged fixes: full checks, a fresh build, then E2E. The hook loads ignored
`.env.test.local`; see `docs/tooling.md` for setup. It blocks on missing setup,
failed checks, or other unstaged/untracked runtime work that would change the
tested source, including partial staging. Stage or park that work before retrying;
the hook preserves the edits.
Run the same command explicitly with an exported test environment before handing
off an uncommitted feature, including after runtime fixes from review.
Documentation/agent-guidance-only changes use focused formatting/link checks;
other harness changes run `npm run check`.
The check runner includes harness integrity, formatting, behavioral tests, schema validation,
type checks, lint, a fresh build and retired-transport artifact verification. It fails on an unsuccessful step.

Builds generate Prisma artifacts but do not migrate data. Set up a disposable
native Supabase environment explicitly as described in `docs/supabase-testing.md`,
then apply `npm run db:migrate` only to that known disposable target. Application
journeys require its actual project marker; ordinary PostgreSQL supports separate
schema/build/unit evidence. Never substitute a production URL or run seed as part
of verification. README owns runtime setup.

Use `npm run test:e2e` directly only when the build matches the current source.
Add or update journeys for the feature's acceptance behavior. Consult README
for exercised browser/HTTP/native Realtime boundaries and remaining gaps; passing the
existing journey does not establish coverage of every authenticated operation. For auth/profile/match/message changes, use the data-boundary skill
and add focused integration coverage for the changed behavior and rejected access.
Use synthetic data and report a missing database/browser as an unexecuted check.

For repository skill/adapter changes, run `npm run check:harness` and verify native
discovery when the client is available. Static file integrity is distinct from
live discovery and model behavior. For a new skill, check its trigger, links,
resources, and whether instructions work without a global installation.

Before reporting completion, inspect exit codes and retained failure artifacts.
Report successful checks, failures, and coverage gaps separately. Preserve failing
assertions and existing rules; fix their cause or describe the blocker with the
command and evidence. See `docs/agents/clients.md` for client behavior and
`docs/architecture.md` for follow-up structural work.
