import { spawnSync } from 'node:child_process';
import { configuration, confirmProject, fail, MigrationError } from './environment';
import { runtimeEnvironment } from './runtime';
import { transferState } from './transfer';
try {
  confirmProject(process.argv.slice(2));
  const state = transferState();
  if (state.phase !== 'accepted' || !state.deliveryProven)
    fail('Complete explicit migration/rollback/native recovery before running its browser tests.');
  const result = spawnSync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['exec', '--no', '--', 'playwright', 'test', '--config=playwright.migration.config.ts'],
    { env: runtimeEnvironment(configuration(), 'target'), stdio: 'inherit', timeout: 300_000 },
  );
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(
    error instanceof MigrationError
      ? error.message
      : 'Migration browser runner failed; private diagnostics omitted.',
  );
  process.exitCode = 1;
}
