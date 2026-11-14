import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, mkdtempSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const checker = resolve('scripts/check-harness.mjs');

function withFixture(change) {
  const directory = mkdtempSync(join(tmpdir(), 'bondi-skills-'));
  try {
    for (const path of [
      '.agents',
      '.claude',
      '.github/copilot-instructions.md',
      'third-party',
      'docs',
      'AGENTS.md',
      'CLAUDE.md',
      'README.md',
    ]) {
      cpSync(path, join(directory, path), { recursive: true, verbatimSymlinks: true });
    }
    change(directory);
    return spawnSync(process.execPath, [checker], { cwd: directory, encoding: 'utf8' });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('harness rejects an edited imported skill snapshot', () => {
  const result = withFixture((directory) =>
    appendFileSync(
      join(directory, '.agents/skills/codebase-design/SKILL.md'),
      '\nUnrecorded edit\n',
    ),
  );
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Imported snapshot changed: .agents\/skills\/codebase-design\/SKILL.md/,
  );
});

test('harness rejects a Claude adapter pointing at another skill', () => {
  const result = withFixture((directory) => {
    const link = join(directory, '.claude/skills/codebase-design');
    unlinkSync(link);
    symlinkSync('../../.agents/skills/tdd', link, 'dir');
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Noncanonical Claude link/);
});
