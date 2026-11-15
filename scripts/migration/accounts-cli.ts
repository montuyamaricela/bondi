import { existsSync } from 'node:fs';
import {
  client,
  configuration,
  confirmProject,
  fail,
  MigrationError,
  verifyMarker,
  writePrivateJson,
} from './environment';
import {
  cookies,
  fixture,
  origin,
  request,
  sessions,
  sessionsFile,
  startQualificationServer,
} from './runtime';

async function main() {
  confirmProject(process.argv.slice(2));
  const local = configuration();
  const data = fixture();
  const db = client(local.sourceUrl);
  try {
    await verifyMarker(db, local, 'source');
  } finally {
    await db.$disconnect();
  }
  const server = await startQualificationServer(local, 'source');
  try {
    if (existsSync(sessionsFile)) {
      const captured = sessions();
      for (const [index, item] of captured.entries())
        if ((await request('/api/profile', item.cookie)).status !== (index === 2 ? 401 : 200))
          fail('Captured source sessions no longer have their expected valid/expired behavior.');
      console.log('Existing captured source sessions verified; no new sessions created.');
      return;
    }
    const captured = [];
    for (const index of [0, 1, 0]) {
      const signed = await request('/api/auth/sign-in/email', undefined, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.emails[index], password: data.password }),
      });
      if (signed.status !== 200)
        fail('Existing legacy credential could not authenticate on the source.');
      const cookie = cookies(signed);
      const sessionResponse = await request('/api/auth/get-session', cookie);
      const session = await sessionResponse.json();
      if (
        sessionResponse.status !== 200 ||
        session?.user?.id !== data.userIds[index] ||
        typeof session?.session?.id !== 'string'
      )
        fail('Source sign-in did not retain its existing identity.');
      captured.push({ userId: session.user.id, sessionId: session.session.id, cookie });
    }
    const source = client(local.sourceUrl);
    try {
      await source.session.update({
        where: { id: captured[2].sessionId },
        data: { expiresAt: new Date(0) },
      });
    } finally {
      await source.$disconnect();
    }
    for (const [index, item] of captured.entries()) {
      const response = await request('/api/profile', item.cookie);
      if (response.status !== (index === 2 ? 401 : 200))
        fail('Source session expiry controls failed.');
    }
    if ((await request('/api/profile')).status !== 401)
      fail('Anonymous source profile access was allowed.');
    writePrivateJson(sessionsFile, { runId: local.runId, origin, sessions: captured });
    console.log(
      'Existing legacy credentials authenticated; signed sessions and next-request expiry verified privately on source.',
    );
  } finally {
    await server.stop();
  }
}
void main().catch((error: unknown) => {
  console.error(
    error instanceof MigrationError
      ? error.message
      : 'Source account qualification failed; private diagnostics omitted.',
  );
  process.exitCode = 1;
});
