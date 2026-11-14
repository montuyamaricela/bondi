# Agent client compatibility

`AGENTS.md` and `.agents/skills/<name>/SKILL.md` are shared project sources.
Commands run in the shell with npm, independently of client features.

## Codex

Codex loads `AGENTS.md` and discovers `.agents/skills/`. Invoke a skill with
`$skill-name`, or point to its exact file. In a fresh session, ask the client to
identify the project contract and available repository skills. No model,
permission, compaction-window, or machine-specific configuration is imposed here.

## Claude Code

`CLAUDE.md` imports `@AGENTS.md`. Each `.claude/skills/<name>` is a relative Git
symlink to the complete canonical skill directory, including references/scripts.
Use `/skill-name`. Confirm loaded instructions with `/memory` and available skills
with `/help` in a fresh session; check your client version if discovery differs.
Newer Claude versions can load `AGENTS.md` natively, but the import also supports
versions that require `CLAUDE.md`.

## Cursor

Cursor supports root `AGENTS.md` and discovers `.agents/skills/` directly. It also
supports Claude compatibility paths; avoid adding another full copy of the skills
under `.cursor/skills/`. Confirm the skills in the fresh client's customization
UI or slash-command list. There is no duplicated always-on Cursor rule to maintain.

## Copilot and other tools

`.github/copilot-instructions.md` points to `AGENTS.md`. Other tools can load the
same file manually and use the Agent Skills format if supported. Native skill
discovery, invocation policy, and tools differ across clients; manual file loading
is the fallback, not evidence of automatic compatibility.

## Verify the adapters

Run `npm run check:harness` to verify skill names, hashes, licenses, links, and
entry points. Add a relative `.claude/skills/` link when adding a canonical skill.
Git clones must preserve symlinks. On Windows, enable Developer Mode/symlink
support before checkout, or copy complete skill directories locally and verify
discovery. Plain text files containing link targets are not skill directories.

Static checks establish file integrity. They do not prove model compliance or a
running session's discovery. Permissions, global skills, MCP servers, hooks,
account connections, and native compaction settings remain client-owned. Imported
`agents/openai.yaml` policies apply to Codex; Claude and Cursor may differ. The
owned verification skill documents explicit entry points for project checks.

Official references checked 2026-11-14:
[Codex instructions](https://developers.openai.com/codex/guides/agents-md/),
[Codex skills](https://developers.openai.com/codex/skills/),
[Claude memory](https://code.claude.com/docs/en/memory),
[Claude skills](https://code.claude.com/docs/en/skills),
[Cursor rules](https://cursor.com/docs/rules), and
[Cursor skills](https://cursor.com/docs/skills).
