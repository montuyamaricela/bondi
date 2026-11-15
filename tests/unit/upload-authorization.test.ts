import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { NextRequest } from 'next/server';
import { createRouteHandler } from 'uploadthing/next';
import { auth } from '../../lib/auth';
import { db } from '../../lib/db';
import { uploadRouter } from '../../lib/server/uploadthing';
import { UPLOAD_USER_HEADER, UPLOAD_SESSION_HEADER } from '../../lib/upload-owner';

const token = Buffer.from(
  JSON.stringify({ apiKey: 'sk_synthetic_test_key', appId: 'synthetic', regions: ['sea1'] }),
).toString('base64');

function uploadRequest(slug: string, cookie?: string, owner: Record<string, string> = {}) {
  return new NextRequest(`http://localhost/api/uploadthing?slug=${slug}&actionType=upload`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...owner },
    body: JSON.stringify({
      files: [{ name: 'synthetic.png', size: 100, type: 'image/png' }],
      input: null,
    }),
  });
}

test('all upload entry points reject missing or unresolved expired sessions before contacting storage', async () => {
  const session = mock.method(auth.api, 'getSession', async () => null);
  let storageRequests = 0;
  const handler = createRouteHandler({
    router: uploadRouter,
    config: {
      token,
      isDev: false,
      logLevel: 'Error',
      fetch: async () => {
        storageRequests++;
        return Response.json({ ok: true });
      },
    },
  });
  try {
    for (const slug of ['profileImage', 'profilePhotos', 'messageAttachment']) {
      for (const cookie of [undefined, 'better-auth.session_token=synthetic-expired']) {
        const response = await handler.POST(uploadRequest(slug, cookie));
        assert.equal(response.status, 403, `${slug} must reject a null resolved session`);
      }
    }
    assert.equal(storageRequests, 0);
  } finally {
    session.mock.restore();
  }
});

test('uploads bind captured owners before capacity/provider access and use only server metadata', async () => {
  const originalCount = db.file.count;
  const count = mock.fn(async () => 0);
  Object.assign(db.file, { count });
  const now = new Date('2026-11-14T00:00:00Z');
  const session = mock.method(auth.api, 'getSession', async () => ({
    user: {
      id: 'synthetic-user',
      name: 'Synthetic',
      email: 'synthetic@example.test',
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
      image: null,
    },
    session: {
      id: 'synthetic-session',
      userId: 'synthetic-user',
      token: 'synthetic-token',
      expiresAt: new Date('2026-11-15T00:00:00Z'),
      createdAt: now,
      updatedAt: now,
      ipAddress: null,
      userAgent: null,
    },
  }));
  const requests: Request[] = [];
  const handler = createRouteHandler({
    router: uploadRouter,
    config: {
      token,
      isDev: false,
      logLevel: 'Error',
      handleDaemonPromise: 'await',
      fetch: async (input, init) => {
        requests.push(new Request(input, init));
        return Response.json({ ok: true });
      },
    },
  });
  try {
    const response = await handler.POST(uploadRequest('profileImage'));
    assert.equal(response.status, 200);
    const links = await response.json();
    assert.equal(links.length, 1);
    assert.equal(links[0].name, 'synthetic.png');
    assert.equal(requests.length, 1);
    assert.equal(new URL(requests[0].url).pathname, '/route-metadata');
    const payload = await requests[0].json();
    assert.deepEqual(payload.metadata, { userId: 'synthetic-user' });
    const expected = {
      [UPLOAD_USER_HEADER]: 'synthetic-user',
      [UPLOAD_SESSION_HEADER]: 'synthetic-session',
    };
    const invalid: Array<{ headers: Record<string, string>; status: number }> = [
      { headers: { ...expected, [UPLOAD_USER_HEADER]: 'another-user' }, status: 403 },
      { headers: { ...expected, [UPLOAD_SESSION_HEADER]: 'old-session' }, status: 403 },
      { headers: { [UPLOAD_USER_HEADER]: 'synthetic-user' }, status: 400 },
      { headers: { [UPLOAD_SESSION_HEADER]: 'synthetic-session' }, status: 400 },
      { headers: { ...expected, [UPLOAD_SESSION_HEADER]: '' }, status: 400 },
      { headers: { ...expected, [UPLOAD_USER_HEADER]: 'x'.repeat(129) }, status: 400 },
    ];
    const capacityCalls = count.mock.calls.length;
    for (const slug of ['profileImage', 'profilePhotos', 'messageAttachment']) {
      for (const invalidOwner of invalid) {
        const denied = await handler.POST(uploadRequest(slug, undefined, invalidOwner.headers));
        assert.equal(denied.status, invalidOwner.status);
      }
    }
    assert.equal(requests.length, 1);
    assert.equal(count.mock.calls.length, capacityCalls);
    const accepted = await handler.POST(uploadRequest('profilePhotos', undefined, expected));
    assert.equal(accepted.status, 200);
    assert.deepEqual((await requests[1].json()).metadata, { userId: 'synthetic-user' });
  } finally {
    session.mock.restore();
    Object.assign(db.file, { count: originalCount });
  }
});
