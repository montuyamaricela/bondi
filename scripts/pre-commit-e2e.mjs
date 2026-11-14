import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

function gitPaths(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    console.error('Pre-commit E2E could not inspect Git changes.');
    process.exit(1);
  }
  return result.stdout.split('\0').filter(Boolean);
}

function isDocumentation(path) {
  return (
    ['docs/', '.agents/', '.claude/skills/', 'third-party/'].some((prefix) =>
      path.startsWith(prefix),
    ) ||
    (!path.includes('/') && path.endsWith('.md')) ||
    ['LICENSE', 'NOTICE', '.github/copilot-instructions.md'].includes(path)
  );
}

// Disabling rename detection includes both names, including code moved into docs/.
const staged = gitPaths(['diff', '--cached', '--name-only', '--no-renames', '-z']);
if (staged.every(isDocumentation)) {
  console.log('Pre-commit E2E skipped: no application, test, or configuration changes staged.');
  process.exit(0);
}

const unstaged = [
  ...gitPaths(['diff', '--name-only', '--no-renames', '-z']),
  ...gitPaths(['ls-files', '--others', '--exclude-standard', '-z']),
].filter((path) => !isDocumentation(path));
if (unstaged.length) {
  console.error(
    'Pre-commit E2E needs the intended runtime changes staged. Stage or park other unstaged/untracked runtime files so the tested source matches the commit.',
  );
  process.exit(1);
}

let testEnvironment;
try {
  testEnvironment = parseEnv(readFileSync('.env.test.local', 'utf8'));
} catch {
  console.error(
    'Pre-commit E2E needs .env.test.local. Copy .env.test.example and configure a disposable test database.',
  );
  process.exit(1);
}
const required = [
  'DATABASE_URL',
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SOCKET_URL',
];
if (
  required.some((name) => !testEnvironment[name]) ||
  testEnvironment.BETTER_AUTH_SECRET.length < 32
) {
  console.error(
    'Pre-commit E2E test configuration is incomplete. Check .env.test.example; use a test auth secret of at least 32 characters.',
  );
  process.exit(1);
}

console.log('Pre-commit: full checks, a fresh build, then E2E. A failure blocks this commit.');
// Git exports checkout-specific variables to hooks; nested test repositories need their own.
const localVariables = spawnSync('git', ['rev-parse', '--local-env-vars'], { encoding: 'utf8' });
if (localVariables.error || localVariables.status !== 0) {
  console.error('Pre-commit E2E could not isolate the test Git environment.');
  process.exit(1);
}
const environment = {
  ...process.env,
  UPLOADTHING_TOKEN: '',
  ...testEnvironment,
  NEXT_TELEMETRY_DISABLED: '1',
};
for (const name of localVariables.stdout.trim().split('\n')) delete environment[name];
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npm, ['run', 'check:feature'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: environment,
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
