import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { generateKeyPairSync, randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { z } from 'zod';
import {
  project,
  sourceContainer,
  sourceImage,
  artifactRoot,
  configurationFile,
  workdir,
  captured,
  client,
  configuration,
  fail,
  privateDirectory,
  readPrivateJson,
  validateConfiguration,
  verifyMarker,
  writePrivateJson,
  type MigrationConfiguration,
} from './environment';

const ownerFile = resolve(artifactRoot, 'owner.json');
const ownerSchema = z.object({
  project: z.literal(project),
  runId: z.uuid(),
  nonce: z.string().regex(/^[a-f0-9]{64}$/),
  sourcePassword: z.string().min(32),
  authSecret: z.string().min(32),
  createdAt: z.iso.datetime(),
});
const cli = resolve('node_modules/.bin/supabase');
function native(action: string, extra: string[] = []) {
  return captured(cli, [action, '--workdir', workdir, ...extra], { timeout: 600_000 });
}
function inspect(name: string) {
  const result = spawnSync('docker', ['inspect', name, '--format', '{{json .Config.Labels}}'], {
    encoding: 'utf8',
  });
  if (result.error) fail('Docker is unavailable for isolated rehearsal setup.');
  if (result.status !== 0) return null;
  try {
    return z.record(z.string(), z.string()).parse(JSON.parse(result.stdout));
  } catch {
    return fail('Cannot establish Docker resource ownership.');
  }
}
async function portFree(port: number) {
  await new Promise<void>((resolvePort, reject) => {
    const server = createServer();
    server.once('error', () =>
      reject(new Error('Rehearsal ports are occupied; no existing owner will be stopped.')),
    );
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () =>
      server.close(() => resolvePort()),
    );
  });
}
async function marker(url: string, owner: z.infer<typeof ownerSchema>, role: 'source' | 'target') {
  const db = client(url);
  try {
    const [identity] = await db.$queryRaw<
      Array<{ database: string; version: number; native: string | null }>
    >`
      SELECT current_database() AS database, current_setting('server_version_num')::int AS version,
        to_regclass('realtime.messages')::text AS native`;
    if (
      identity.database !== (role === 'source' ? 'bondi_migration_source_test' : 'postgres') ||
      (role === 'target' && (identity.version < 170000 || !identity.native))
    )
      fail('New rehearsal database identity does not match explicit infrastructure setup.');
    await db.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS bondi_rehearsal');
    await db.$executeRawUnsafe('REVOKE ALL ON SCHEMA bondi_rehearsal FROM PUBLIC');
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS bondi_rehearsal.environment (
      singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton), project text NOT NULL,
      "runId" text NOT NULL, nonce text NOT NULL, role text NOT NULL, "apiUrl" text NOT NULL)`);
    await db.$executeRawUnsafe('REVOKE ALL ON bondi_rehearsal.environment FROM PUBLIC');
    await db.$executeRawUnsafe('ALTER TABLE bondi_rehearsal.environment ENABLE ROW LEVEL SECURITY');
    await db.$executeRaw`INSERT INTO bondi_rehearsal.environment
      (singleton, project, "runId", nonce, role, "apiUrl") VALUES
      (true, ${project}, ${owner.runId}, ${owner.nonce}, ${role}, 'http://127.0.0.1:54331')
      ON CONFLICT (singleton) DO NOTHING`;
  } finally {
    await db.$disconnect();
  }
}

export async function prepareLocal() {
  privateDirectory(artifactRoot);
  const expected = JSON.parse(readFileSync('package.json', 'utf8')).devDependencies.supabase;
  if (captured(cli, ['--version']).trim() !== expected)
    fail('Install the exact committed Supabase CLI with npm ci.');
  if (
    !/^project_id\s*=\s*"bondi-migration-rehearsal"\s*$/m.test(
      readFileSync(resolve(workdir, 'supabase/config.toml'), 'utf8'),
    )
  )
    fail('Only the committed migration rehearsal project may be prepared.');
  if (existsSync(configurationFile)) {
    const existing = configuration();
    const source = client(existing.sourceUrl);
    const target = client(existing.targetUrl);
    try {
      await verifyMarker(source, existing, 'source');
      await verifyMarker(target, existing, 'target');
    } finally {
      await source.$disconnect();
      await target.$disconnect();
    }
    console.log('Existing isolated rehearsal identity verified; no keys or markers rotated.');
    return;
  }
  captured('docker', ['info', '--format', '{{.ServerVersion}}']);
  const nativeName = `supabase_db_${project}`;
  if (!existsSync(ownerFile)) {
    if (inspect(sourceContainer) || inspect(nativeName))
      fail('Existing rehearsal resources have no matching private ownership record.');
    await Promise.all([54329, 54330, 54331, 54332].map(portFree));
    writePrivateJson(ownerFile, {
      project,
      runId: randomUUID(),
      nonce: randomBytes(32).toString('hex'),
      sourcePassword: randomBytes(32).toString('hex'),
      authSecret: randomBytes(32).toString('hex'),
      createdAt: new Date().toISOString(),
    });
  }
  const parsed = ownerSchema.safeParse(readPrivateJson(ownerFile));
  if (!parsed.success) fail('Private rehearsal ownership record is invalid.');
  const owner = parsed.data;
  const sourceLabels = inspect(sourceContainer);
  if (sourceLabels && sourceLabels['com.bondi.rehearsal.run'] !== owner.runId)
    fail('The source container belongs to a different owner.');
  if (!sourceLabels) {
    console.log('Creating owned disposable PostgreSQL 14 source on port 54329.');
    captured(
      'docker',
      [
        'run',
        '--detach',
        '--rm',
        '--name',
        sourceContainer,
        '--label',
        `com.bondi.rehearsal.run=${owner.runId}`,
        '--publish',
        '127.0.0.1:54329:5432',
        '--env',
        'POSTGRES_PASSWORD',
        '--env',
        'POSTGRES_DB',
        sourceImage,
      ],
      {
        env: {
          ...process.env,
          POSTGRES_PASSWORD: owner.sourcePassword,
          POSTGRES_DB: 'bondi_migration_source_test',
        },
        timeout: 600_000,
      },
    );
  }
  let ready = false;
  for (let attempt = 0; attempt < 120 && !ready; attempt++) {
    const check = spawnSync(
      'docker',
      [
        'exec',
        sourceContainer,
        'pg_isready',
        '-U',
        'postgres',
        '-d',
        'bondi_migration_source_test',
      ],
      { encoding: 'utf8' },
    );
    ready = check.status === 0;
    if (!ready)
      await new Promise((done) => {
        setTimeout(done, 250);
      });
  }
  if (!ready) fail('Owned rehearsal source did not become ready.');
  if (inspect(nativeName))
    fail(
      'Partial native setup exists without a completed ownership record; inspect it before continuing.',
    );
  const keyFile = resolve(workdir, 'supabase/signing_keys.json');
  if (!existsSync(keyFile)) {
    const keys = Array.from({ length: 2 }, (_, index) => ({
      ...generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ format: 'jwk' }),
      kid: randomUUID(),
      alg: 'ES256',
      use: 'sig',
      key_ops: index ? ['verify'] : ['sign', 'verify'],
      ext: true,
    }));
    writeFileSync(keyFile, JSON.stringify(keys), { flag: 'wx', mode: 0o600 });
  }
  const preparedKeys = z
    .array(
      z.object({
        kty: z.literal('EC'),
        crv: z.literal('P-256'),
        alg: z.literal('ES256'),
        kid: z.string().min(1),
        d: z.string().min(1),
        x: z.string().min(1),
        y: z.string().min(1),
        key_ops: z.array(z.string()),
      }),
    )
    .length(2)
    .safeParse(readPrivateJson(keyFile));
  if (
    !preparedKeys.success ||
    !preparedKeys.data[0].key_ops.includes('sign') ||
    preparedKeys.data[1].key_ops.includes('sign') ||
    !preparedKeys.data[1].key_ops.includes('verify')
  )
    fail('Rehearsal signing keys must be owned private ES256 active/verification-only keys.');
  console.log('Starting separate owned Supabase PostgreSQL 17 target on ports 54331/54332.');
  native('start', [
    '--exclude',
    'storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor',
  ]);
  const status = JSON.parse(native('status', ['--output', 'json']));
  const local: MigrationConfiguration = validateConfiguration({
    ...owner,
    sourceUrl: `postgresql://postgres:${owner.sourcePassword}@127.0.0.1:54329/bondi_migration_source_test`,
    targetUrl: status.DB_URL,
    apiUrl: status.API_URL,
    publicKey: status.PUBLISHABLE_KEY || status.ANON_KEY,
    secretKey: status.SECRET_KEY || status.SERVICE_ROLE_KEY,
  });
  await marker(local.sourceUrl, owner, 'source');
  await marker(local.targetUrl, owner, 'target');
  const source = client(local.sourceUrl);
  const target = client(local.targetUrl);
  try {
    await verifyMarker(source, local, 'source');
    await verifyMarker(target, local, 'target');
  } finally {
    await source.$disconnect();
    await target.$disconnect();
  }
  writePrivateJson(configurationFile, local);
  console.log(
    'Prepared isolated source/target and private ownership markers. No application schema or fixtures applied.',
  );
}

export async function stopLocal() {
  const local = configuration();
  const labels = inspect(sourceContainer);
  if (labels && labels['com.bondi.rehearsal.run'] !== local.runId)
    fail('Source ownership mismatch; nothing stopped.');
  const target = client(local.targetUrl);
  try {
    await verifyMarker(target, local, 'target');
  } finally {
    await target.$disconnect();
  }
  native('stop', ['--project-id', project]);
  if (labels) captured('docker', ['stop', sourceContainer]);
  console.log('Stopped only owned migration rehearsal resources; private backup artifacts remain.');
}
