import { confirmProject, MigrationError } from './environment';
import {
  acceptTargetWrites,
  captureSource,
  reselectTarget,
  restoreCaptured,
  rollbackBeforeWrites,
} from './transfer';
async function main() {
  const [action, ...args] = process.argv.slice(2);
  confirmProject(args);
  if (action === 'capture') await captureSource();
  else if (action === 'prove-failure') await restoreCaptured(true);
  else if (action === 'restore') await restoreCaptured();
  else if (action === 'rollback') await rollbackBeforeWrites();
  else if (action === 'reselect') await reselectTarget();
  else if (action === 'accept') await acceptTargetWrites();
  else
    throw new MigrationError(
      'Use capture/prove-failure/restore/rollback/reselect/accept with explicit project confirmation.',
    );
}
void main().catch((error: unknown) => {
  console.error(
    error instanceof MigrationError
      ? error.message
      : 'Migration operation failed; private diagnostics omitted.',
  );
  process.exitCode = 1;
});
