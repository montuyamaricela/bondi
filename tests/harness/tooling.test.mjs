import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { ESLint } from 'eslint';

test('shared lint rules reject loose equality, unused values, and new environment owners', async () => {
  const eslint = new ESLint();
  const [result] = await eslint.lintText(
    'const unused = 1; export const check = (value: number) => value == process.env.PORT;',
    { filePath: 'lib/tooling-contract.ts' },
  );
  const rules = new Set(result.messages.map(({ ruleId }) => ruleId));
  assert.ok(rules.has('eqeqeq'));
  assert.ok(rules.has('@typescript-eslint/no-unused-vars'));
  assert.ok(rules.has('no-restricted-syntax'));
});

test('core JavaScript and accessibility recommendations remain enabled', async () => {
  const eslint = new ESLint();
  const [javascript] = await eslint.lintText('export const broken = missingName;', {
    filePath: 'scripts/tooling-contract.mjs',
  });
  assert.ok(javascript.messages.some(({ ruleId }) => ruleId === 'no-undef'));
  const [typescript] = await eslint.lintText(
    'export const broken = () => { if (false) return 1; return 2; };',
    { filePath: 'lib/tooling-contract.ts' },
  );
  assert.ok(typescript.messages.some(({ ruleId }) => ruleId === 'no-constant-condition'));
  const [accessibility] = await eslint.lintText(
    'export const Link = () => <a href="https://example.test" />;',
    { filePath: 'app/components/tooling-contract.tsx' },
  );
  assert.ok(accessibility.messages.some(({ ruleId }) => ruleId === 'jsx-a11y/anchor-has-content'));
});

test('pre-commit formats staged paths with spaces without staging unrelated edits or imported skills', () => {
  const root = process.cwd();
  const directory = mkdtempSync(join(tmpdir(), 'bondi-hooks-'));
  const run = (command, args) => {
    const result = spawnSync(command, args, {
      cwd: directory,
      encoding: 'utf8',
      env: { ...process.env, LEFTHOOK: '1' },
    });
    assert.equal(
      result.status,
      0,
      `${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`,
    );
    return result.stdout;
  };
  try {
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
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ private: true }));
    writeFileSync(join(directory, '.gitignore'), 'node_modules/\n');
    mkdirSync(join(directory, 'app'));
    writeFileSync(join(directory, 'app/globals.css'), '@import "tailwindcss";\n');
    mkdirSync(join(directory, 'lib'));
    const file = 'lib/partially staged.ts';
    const original =
      'export const staged = 1;\n' +
      Array.from({ length: 10 }, (_, index) => `// context ${index}\n`).join('') +
      'export const unstaged = 1;\n';
    writeFileSync(join(directory, file), original);
    run('git', ['init', '-q']);
    run('git', ['add', '.']);
    run('git', [
      '-c',
      'user.name=Synthetic',
      '-c',
      'user.email=synthetic@example.test',
      'commit',
      '-qm',
      'Fixture',
    ]);
    writeFileSync(join(directory, file), original.replace('staged = 1', 'staged=2'));
    run('git', ['add', file]);
    writeFileSync(
      join(directory, file),
      readFileSync(join(directory, file), 'utf8').replace('unstaged = 1', 'unstaged = 2'),
    );
    const imported = '.agents/skills/example/SKILL.md';
    const importedSource = '# Preserve    imported formatting\n';
    mkdirSync(join(directory, '.agents/skills/example'), { recursive: true });
    writeFileSync(join(directory, imported), importedSource);
    run('git', ['add', imported]);
    run(process.execPath, [
      join(root, 'node_modules/lefthook/bin/index.js'),
      'run',
      'pre-commit',
      '--command',
      'eslint',
      '--command',
      'prettier',
    ]);
    const staged = run('git', ['show', `:${file}`]);
    assert.match(staged, /staged = 2;/);
    assert.match(staged, /unstaged = 1;/);
    assert.match(readFileSync(join(directory, file), 'utf8'), /unstaged = 2;/);
    assert.equal(run('git', ['show', `:${imported}`]), importedSource);
    const verification = spawnSync(process.execPath, ['scripts/pre-commit-e2e.mjs'], {
      cwd: directory,
      encoding: 'utf8',
    });
    assert.equal(verification.status, 1);
    assert.match(verification.stderr, /runtime changes staged/);
    assert.match(readFileSync(join(directory, file), 'utf8'), /unstaged = 2;/);
    assert.equal(run('git', ['show', `:${file}`]), staged);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
