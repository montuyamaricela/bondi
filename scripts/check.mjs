import { spawnSync } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
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

for (const check of checks) {
  console.log(`\nChecking ${check}`);
  const result = spawnSync(npm, ['run', check], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
  });
  if (result.error) console.error(result.error.message);
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
