import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

test('retirement verification rejects reintroduced source, dependencies and bundled code', () => {
  const root = mkdtempSync(join(tmpdir(), 'bondi-retirement-'));
  const checker = resolve('scripts/check-realtime-retirement.mjs');
  try {
    for (const directory of ['app', 'lib', '.next/static'])
      mkdirSync(join(root, directory), { recursive: true });
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ scripts: { dev: 'next dev', start: 'next start' } }),
    );
    const lock = join(root, 'package-lock.json');
    const source = join(root, 'app/page.tsx');
    const bundle = join(root, '.next/static/app.js');
    writeFileSync(lock, JSON.stringify({ packages: {} }));
    writeFileSync(source, 'export const page = true;');
    writeFileSync(bundle, 'client.channel("owned").on("broadcast", handler);');
    const check = () => spawnSync(process.execPath, [checker], { cwd: root, encoding: 'utf8' });
    assert.equal(check().status, 0);
    const rejects = (pattern) => {
      const result = check();
      assert.equal(result.status, 1);
      assert.match(result.stderr, pattern);
    };
    writeFileSync(source, 'import { io } from "socket.io-client";');
    rejects(/Retired transport reference/);
    writeFileSync(source, 'export const page = true;');
    writeFileSync(lock, JSON.stringify({ packages: { 'node_modules/socket.io-client': {} } }));
    rejects(/Retired dependency/);
    writeFileSync(lock, JSON.stringify({ packages: {} }));
    writeFileSync(bundle, 'fetch("/socket.io/");');
    rejects(/built artifact/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
