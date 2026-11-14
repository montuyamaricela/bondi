import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const runner = resolve('scripts/check.mjs');
const checks = [
  'check:harness',
  'audit:critical',
  'format:check',
  'test',
  'db:validate',
  'typecheck',
  'lint',
  'build',
];

function runFixture(failingCheck) {
  const directory = mkdtempSync(join(tmpdir(), 'bondi-check-'));
  try {
    writeFileSync(
      join(directory, 'step.cjs'),
      "require('node:fs').appendFileSync('steps.log', process.argv[2] + '\\n'); process.exit(process.argv[2] === process.env.FAIL_CHECK ? 7 : 0);",
    );
    writeFileSync(
      join(directory, 'package.json'),
      JSON.stringify({
        scripts: Object.fromEntries(checks.map((name) => [name, `node step.cjs ${name}`])),
      }),
    );
    const result = spawnSync(process.execPath, [runner], {
      cwd: directory,
      encoding: 'utf8',
      env: { ...process.env, FAIL_CHECK: failingCheck ?? '' },
    });
    return {
      result,
      executed: readFileSync(join(directory, 'steps.log'), 'utf8').trim().split('\n'),
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('verification runs every gate in order when each succeeds', () => {
  const { result, executed } = runFixture();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(executed, checks);
});

test('verification propagates failure and never reaches later gates', () => {
  const { result, executed } = runFixture('typecheck');
  assert.equal(result.status, 7, result.stderr);
  assert.deepEqual(executed, [
    'check:harness',
    'audit:critical',
    'format:check',
    'test',
    'db:validate',
    'typecheck',
  ]);
});
