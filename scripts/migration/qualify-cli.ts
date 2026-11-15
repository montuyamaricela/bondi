import { confirmProject, MigrationError } from './environment';
import { qualifyReads } from './qualify';
async function main() {
  const [role, ...args] = process.argv.slice(2);
  confirmProject(args);
  if (role !== 'source' && role !== 'target')
    throw new MigrationError('Choose source or target HTTP qualification explicitly.');
  await qualifyReads(role);
}
void main().catch((error: unknown) => {
  console.error(
    error instanceof MigrationError
      ? error.message
      : 'Migration HTTP qualification failed; private diagnostics omitted.',
  );
  process.exitCode = 1;
});
