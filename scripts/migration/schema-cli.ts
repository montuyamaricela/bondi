import { readFileSync, readdirSync } from 'node:fs';
import {
  captured,
  client,
  configuration,
  confirmProject,
  digest,
  fail,
  MigrationError,
  quoted,
  tables,
  verifyMarker,
} from './environment';

async function main() {
  confirmProject(process.argv.slice(2));
  const local = configuration();
  for (const role of ['source', 'target'] as const) {
    const url = role === 'source' ? local.sourceUrl : local.targetUrl;
    const db = client(url);
    try {
      await verifyMarker(db, local, role);
      const existing = await db.$queryRaw<Array<{ name: string }>>`
        SELECT tablename AS name FROM pg_catalog.pg_tables WHERE schemaname = 'public'`;
      for (const { name } of existing) {
        if (!tables.some((table) => table === name))
          fail('Unreviewed public table blocks rehearsal schema preparation.');
        if (name === '_prisma_migrations') continue;
        const [count] = await db.$queryRawUnsafe<Array<{ count: number }>>(
          `SELECT count(*)::int AS count FROM ${quoted(name)}`,
        );
        if (count.count) fail('Schema preparation requires an empty owned rehearsal database.');
      }
    } finally {
      await db.$disconnect();
    }
    console.log(`Applying committed application migrations explicitly to isolated ${role}.`);
    captured(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'db:migrate'], {
      env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
      timeout: 600_000,
    });
    const migrated = client(url);
    try {
      const ledger = await migrated.$queryRaw<
        Array<{
          migration_name: string;
          checksum: string;
          finished_at: Date | null;
          rolled_back_at: Date | null;
        }>
      >`
        SELECT migration_name, checksum, finished_at, rolled_back_at FROM public._prisma_migrations ORDER BY migration_name`;
      const names = readdirSync('prisma/migrations', { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
      if (
        JSON.stringify(ledger.map((row) => row.migration_name)) !== JSON.stringify(names) ||
        ledger.some(
          (row) =>
            !row.finished_at ||
            row.rolled_back_at ||
            row.checksum !==
              digest(readFileSync(`prisma/migrations/${row.migration_name}/migration.sql`, 'utf8')),
        )
      )
        fail('Applied migration ledger differs from the immutable committed history.');
      console.log(`Verified ${ledger.length} applied migration checksums on isolated ${role}.`);
    } finally {
      await migrated.$disconnect();
    }
  }
  console.log(
    'Explicit schema preparation complete. No fixture seed or application traffic started.',
  );
}
void main().catch((error: unknown) => {
  console.error(
    error instanceof MigrationError
      ? error.message
      : 'Rehearsal schema preparation failed; private diagnostics are omitted.',
  );
  process.exitCode = 1;
});
