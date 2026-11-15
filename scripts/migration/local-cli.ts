import { confirmProject, MigrationError } from './environment';
import { prepareLocal, stopLocal } from './local';

async function main() {
  const [action, ...args] = process.argv.slice(2);
  confirmProject(args);
  if (action === 'prepare') await prepareLocal();
  else if (action === 'stop') await stopLocal();
  else
    throw new MigrationError(
      'Use prepare or stop with the explicit rehearsal project confirmation.',
    );
}
void main().catch((error: unknown) => {
  console.error(
    error instanceof MigrationError
      ? error.message
      : 'Rehearsal setup failed; private diagnostics are omitted.',
  );
  process.exitCode = 1;
});
