import {
  captured,
  client,
  configuration,
  confirmProject,
  MigrationError,
  verifyMarker,
} from './environment';
import { runtimeEnvironment } from './runtime';
async function main() {
  confirmProject(process.argv.slice(2));
  const local = configuration();
  const db = client(local.targetUrl);
  try {
    await verifyMarker(db, local, 'target');
  } finally {
    await db.$disconnect();
  }
  console.log(
    'Building standard Next with the isolated rehearsal public configuration. No schema/data operation is run.',
  );
  captured(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
    env: runtimeEnvironment(local, 'target'),
    timeout: 600_000,
  });
  console.log('Rehearsal production build completed.');
}
void main().catch((error: unknown) => {
  console.error(
    error instanceof MigrationError
      ? error.message
      : 'Rehearsal build failed; private diagnostics omitted.',
  );
  process.exitCode = 1;
});
