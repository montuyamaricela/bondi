import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

function fixture({ environment = true, fail = false } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'bondi-e2e-hook-'));
  const execute = (command, args, expected = 0) => {
    const result = spawnSync(command, args, {
      cwd: directory,
      encoding: 'utf8',
      env: {
        ...process.env,
        LEFTHOOK: '1',
        GIT_INDEX_FILE: join(directory, '.git/index'),
        FEATURE_FAIL: fail ? '1' : '0',
      },
    });
    assert.equal(result.status, expected, `${result.stdout}\n${result.stderr}`);
    return result.stdout + result.stderr;
  };
  for (const path of [
    'tooling',
    'eslint.config.mjs',
    'prettier.config.mjs',
    '.prettierignore',
    'lefthook.yml',
    'scripts/pre-commit-e2e.mjs',
  ]) {
    cpSync(path, join(directory, path), { recursive: true });
  }
  symlinkSync(resolve('node_modules'), join(directory, 'node_modules'), 'dir');
  writeFileSync(
    join(directory, '.gitignore'),
    'node_modules/\n.env.test.local\n.feature-runs.log\n',
  );
  writeFileSync(
    join(directory, 'package.json'),
    JSON.stringify({ private: true, scripts: { 'check:feature': 'node feature-check.cjs' } }),
  );
  writeFileSync(
    join(directory, 'feature-check.cjs'),
    "if (process.env.GIT_INDEX_FILE) process.exit(8); require('node:fs').appendFileSync('.feature-runs.log', 'checked\\n'); process.exit(process.env.FEATURE_FAIL === '1' ? 7 : 0);",
  );
  if (environment)
    writeFileSync(join(directory, '.env.test.local'), readFileSync('.env.test.example', 'utf8'));
  mkdirSync(join(directory, 'app'));
  mkdirSync(join(directory, 'docs'));
  writeFileSync(join(directory, 'app/globals.css'), '@import "tailwindcss";\n');
  writeFileSync(join(directory, 'app/page.tsx'), 'export const value = 1;\n');
  execute('git', ['init', '-q']);
  execute('git', ['add', '.']);
  execute('git', [
    '-c',
    'user.name=Synthetic',
    '-c',
    'user.email=synthetic@example.test',
    'commit',
    '-qm',
    'Fixture',
  ]);
  execute(process.execPath, [resolve('node_modules/lefthook/bin/index.js'), 'install']);
  return {
    directory,
    execute,
    check: (expected = 0) => execute(process.execPath, ['scripts/pre-commit-e2e.mjs'], expected),
    commit: (expected = 0) =>
      execute(
        'git',
        [
          '-c',
          'user.name=Synthetic',
          '-c',
          'user.email=synthetic@example.test',
          'commit',
          '-qm',
          'Change',
        ],
        expected,
      ),
    cleanup: () => rmSync(directory, { recursive: true, force: true }),
  };
}

test('a failed feature check blocks the actual Git commit', () => {
  const f = fixture({ fail: true });
  try {
    const head = f.execute('git', ['rev-parse', 'HEAD']);
    writeFileSync(join(f.directory, 'app/page.tsx'), 'export const value = 2;\n');
    f.execute('git', ['add', 'app/page.tsx']);
    f.commit(1);
    assert.equal(f.execute('git', ['rev-parse', 'HEAD']), head);
    assert.equal(readFileSync(join(f.directory, '.feature-runs.log'), 'utf8'), 'checked\n');
  } finally {
    f.cleanup();
  }
});

test('documentation-only commits skip E2E without requiring test environment setup', () => {
  const f = fixture({ environment: false, fail: true });
  try {
    writeFileSync(join(f.directory, 'docs/note.md'), '# Documentation update\n');
    f.execute('git', ['add', 'docs/note.md']);
    f.commit();
    assert.equal(existsSync(join(f.directory, '.feature-runs.log')), false);
  } finally {
    f.cleanup();
  }
});

for (const operation of ['delete', 'move into docs']) {
  test(`a runtime file ${operation} still requires the feature check`, () => {
    const f = fixture();
    try {
      if (operation === 'delete') f.execute('git', ['rm', 'app/page.tsx']);
      else {
        renameSync(join(f.directory, 'app/page.tsx'), join(f.directory, 'docs/example.tsx'));
        f.execute('git', ['add', '-A']);
      }
      f.commit();
      assert.equal(readFileSync(join(f.directory, '.feature-runs.log'), 'utf8'), 'checked\n');
    } finally {
      f.cleanup();
    }
  });
}

test('runtime commits fail clearly when the dedicated test environment is missing', () => {
  const f = fixture({ environment: false });
  try {
    writeFileSync(join(f.directory, 'app/page.tsx'), 'export const value = 2;\n');
    f.execute('git', ['add', 'app/page.tsx']);
    const output = f.check(1);
    assert.match(output, /Pre-commit E2E/);
    assert.equal(existsSync(join(f.directory, '.feature-runs.log')), false);
  } finally {
    f.cleanup();
  }
});

test('untracked runtime changes block verification rather than test a different source state', () => {
  const f = fixture();
  try {
    writeFileSync(join(f.directory, 'app/page.tsx'), 'export const value = 2;\n');
    f.execute('git', ['add', 'app/page.tsx']);
    writeFileSync(join(f.directory, 'app/untracked.ts'), 'export const unrelated = 1;\n');
    const output = f.check(1);
    assert.match(output, /Pre-commit E2E/);
    assert.equal(existsSync(join(f.directory, '.feature-runs.log')), false);
    assert.equal(
      readFileSync(join(f.directory, 'app/untracked.ts'), 'utf8'),
      'export const unrelated = 1;\n',
    );
  } finally {
    f.cleanup();
  }
});
