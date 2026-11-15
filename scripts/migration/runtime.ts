import { spawn } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { z } from 'zod';
import {
  artifactRoot,
  configuration,
  fail,
  MigrationError,
  readPrivateJson,
  workdir,
  type MigrationConfiguration,
} from './environment';

export const origin = 'http://127.0.0.1:3100';
const fixtureSchema = z.object({
  project: z.literal('bondi-migration-rehearsal'),
  runId: z.uuid(),
  userIds: z.array(z.string()).length(8),
  emails: z.array(z.email()).length(8),
  password: z.string(),
  matchId: z.string(),
  endedMatchId: z.string(),
  messageId: z.string(),
  clientRequestId: z.uuid(),
  messageContent: z.string(),
  cityIds: z.array(z.string()).length(3),
  historyCount: z.number().int(),
});
export function fixture() {
  const parsed = fixtureSchema.safeParse(readPrivateJson(resolve(artifactRoot, 'fixture.json')));
  const local = configuration();
  if (!parsed.success || parsed.data.runId !== local.runId)
    fail('Synthetic fixture ownership does not match the rehearsal.');
  return parsed.data;
}
export const sessionsFile = resolve(artifactRoot, 'sessions.json');
const sessionsSchema = z.object({
  runId: z.uuid(),
  sessions: z
    .array(z.object({ userId: z.string(), sessionId: z.string(), cookie: z.string().min(1) }))
    .length(3),
});
export function sessions() {
  const parsed = sessionsSchema.safeParse(readPrivateJson(sessionsFile));
  if (!parsed.success || parsed.data.runId !== configuration().runId)
    fail('Captured sessions do not belong to this rehearsal.');
  return parsed.data.sessions;
}
export function runtimeEnvironment(local: MigrationConfiguration, role: 'source' | 'target') {
  const environment: NodeJS.ProcessEnv = { ...process.env };
  for (const name of Object.keys(environment))
    if (name.startsWith('PG') || name.startsWith('BONDI_TEST_')) delete environment[name];
  return {
    ...environment,
    DATABASE_URL: role === 'source' ? local.sourceUrl : local.targetUrl,
    DIRECT_URL: role === 'source' ? local.sourceUrl : local.targetUrl,
    BETTER_AUTH_SECRET: local.authSecret,
    BETTER_AUTH_URL: origin,
    NEXT_PUBLIC_APP_URL: origin,
    NEXT_PUBLIC_SUPABASE_URL: local.apiUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.publicKey,
    SUPABASE_SECRET_KEY: local.secretKey,
    SUPABASE_SIGNING_KEYS_PATH: resolve(workdir, 'supabase/signing_keys.json'),
    SUPABASE_TEST_URL: local.apiUrl,
    SUPABASE_TEST_PUBLIC_KEY: local.publicKey,
    UPLOADTHING_TOKEN: '',
    NEXT_TELEMETRY_DISABLED: '1',
  };
}
export async function startQualificationServer(
  local: MigrationConfiguration,
  role: 'source' | 'target',
) {
  await new Promise<void>((done, reject) => {
    const listener = createServer();
    listener.once('error', () =>
      reject(
        new MigrationError(
          'Qualification port 3100 is occupied; no existing server will be reused.',
        ),
      ),
    );
    listener.listen({ host: '127.0.0.1', port: 3100, exclusive: true }, () =>
      listener.close(() => done()),
    );
  });
  const log = openSync(resolve(artifactRoot, `${role}-${randomUUID()}.log`), 'wx', 0o600);
  const child = spawn(
    process.execPath,
    [
      resolve('node_modules/next/dist/bin/next'),
      'start',
      '--hostname',
      '127.0.0.1',
      '--port',
      '3100',
    ],
    { env: runtimeEnvironment(local, role), stdio: ['ignore', log, log] },
  );
  closeSync(log);
  const exited = new Promise<void>((done) => {
    child.once('close', () => done());
    child.once('error', () => done());
  });
  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    if (child.exitCode === null) child.kill('SIGTERM');
    const timeout = setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');
    }, 5000);
    try {
      await exited;
    } finally {
      clearTimeout(timeout);
    }
  };
  try {
    for (let attempt = 0; attempt < 120; attempt++) {
      if (child.exitCode !== null) fail('Owned qualification server exited; private log retained.');
      try {
        const response = await fetch(`${origin}/login`, { signal: AbortSignal.timeout(2000) });
        if (response.status === 200) return { stop };
      } catch {
        /* Wait only for this owned server's startup. */
      }
      await new Promise((done) => {
        setTimeout(done, 250);
      });
    }
    fail('Owned qualification server did not become ready.');
  } catch (error) {
    await stop();
    throw error;
  }
}
export function cookies(response: Response) {
  const result = response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  if (!result) fail('Legacy sign-in returned no signed session cookie.');
  return result;
}
export async function request(path: string, cookie?: string, init: RequestInit = {}) {
  return fetch(`${origin}${path}`, {
    ...init,
    headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...init.headers },
    signal: AbortSignal.timeout(10_000),
  });
}
