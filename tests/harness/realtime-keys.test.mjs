import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('explicit native key preparation keeps one active signer, an overlap verifier and stable private material', () => {
  const directory = mkdtempSync(join(tmpdir(), 'bondi-key-test-'));
  const script = fileURLToPath(new URL('../../scripts/prepare-realtime-keys.mjs', import.meta.url));
  const run = () =>
    spawnSync(process.execPath, [script, '--confirm-project', 'bondi-integration'], {
      cwd: directory,
      encoding: 'utf8',
    });
  try {
    mkdirSync(join(directory, 'supabase'));
    writeFileSync(join(directory, 'supabase/config.toml'), 'project_id = "bondi-integration"\n');
    const path = join(directory, 'supabase/signing_keys.json');
    assert.equal(run().status, 0);
    const original = readFileSync(path, 'utf8');
    const keys = JSON.parse(original);
    assert.equal(keys.filter((key) => key.key_ops.includes('sign')).length, 1);
    assert.deepEqual(keys[1].key_ops, ['verify']);
    assert.equal(statSync(path).mode & 0o777, 0o600);
    assert.equal(run().status, 0);
    assert.equal(readFileSync(path, 'utf8') === original, true);
    keys[1].key_ops.push('sign');
    writeFileSync(path, JSON.stringify(keys));
    const invalid = run();
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /one active signer/);
    assert.equal((invalid.stdout + invalid.stderr).includes(keys[0].d), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
