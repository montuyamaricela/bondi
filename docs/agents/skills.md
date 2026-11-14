# Core agent workflow

Bondi keeps 15 repository skills: 12 Matt Pocock skills, Ponytail's core skill, and
two Bondi procedures. The earlier 37-skill catalog was trimmed at the user's
request. Each retained directory includes its required resources and metadata.

## Main flow

Use the phases needed for the size of the task:

1. `grill-with-docs`: clarify the idea and record resolved terminology/decisions.
2. `to-spec`: turn the agreed behavior into a buildable specification.
3. `to-tickets`: split larger work into small, dependency-aware tickets.
4. `implement`: work through an agreed ticket with tests.
5. `code-review`: independently assess documented standards and the specification.
6. `retro`: improve the development environment after useful lessons emerge.

Small fixes can go directly to implementation and verification. The supporting
skills are `grilling`, `domain-modeling`, `codebase-design`, `tdd`,
`diagnosing-bugs`, and `writing-for-agents`. They are retained because the main
flow calls them or because they support everyday structural/debugging work.

For runtime, test, or configuration commits, Lefthook runs `npm run check:feature`
automatically after staged fixes (full checks, a fresh build, then E2E). Resolve
review findings and repeat verification after runtime repairs. Handing off an
uncommitted feature uses the same command explicitly. Documentation/agent-guidance
commits use focused checks. See [tooling](../tooling.md) for dedicated test setup.

Use `ponytail` for the smallest complete solution. It complements the required
validation, privacy boundaries, and checks; it does not replace them.
`bondi-change-verification` owns the actual repository checks, while
`bondi-data-boundaries` covers sessions, ownership, privacy, and socket delivery.

The [GitHub tracker](issue-tracker.md), [label vocabulary](triage-labels.md), and
[domain-doc layout](domain.md) remain configured. Four missing remote labels still
require a write-capable GitHub connection. Installing skills does not invoke a
workflow, publish tickets, commit changes, or authorize other external writes.

## Discovery and provenance

`.agents/skills/` is canonical, with relative Claude links in `.claude/skills/`.
Codex uses `$skill-name`; Claude/Cursor use `/skill-name` where supported. Prefer
exact local paths if a global plugin has the same name. Preserve the retained
upstream invocation policies; [client behavior](clients.md) differs by host.

The retained Matt snapshot is manifest 1.3.2 at
`5863806dd4e15c63174bee4e7515a4256792ecfa`; Ponytail is 5.3.3 at
`96608e078b2d5ea607c5c3b8b5a54d1c1fba6846`, both checked on 2026-11-14.
`third-party/skills-provenance.json` records the selected files and hashes.
Upstream manifests and licenses are retained as provenance, not installed plugins.
No status-band hooks, telemetry, global settings, or automatic updater are added.

Extra review/audit/reporting modes, orchestration, marketing, performance, and
specialist helpers were removed. Add a specialist only when a concrete task needs
it: inspect a pinned complete directory and license, add its Claude link, and
record its provenance. Sources: [Matt Pocock](https://github.com/mattpocock/skills)
and [Ponytail](https://github.com/DietrichGebert/ponytail).

Run `npm run check:harness` after any skill change. Formatting excludes imported
skills; their contents are checked against recorded hashes instead. Static
integrity checks do not prove live client discovery or model behavior.
