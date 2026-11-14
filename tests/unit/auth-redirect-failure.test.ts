import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { auth } from '../../lib/auth';
import { db } from '../../lib/db';
import { middleware } from '../../middleware';

test('an authenticated profile lookup failure preserves login recovery instead of inferring missing onboarding', async (context) => {
  const now = new Date();
  const session = context.mock.method(auth.api, 'getSession', async () => ({
    user: {
      id: 'synthetic-owner',
      name: 'Synthetic owner',
      email: 'synthetic@example.test',
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
      image: null,
    },
    session: {
      id: 'synthetic-session',
      userId: 'synthetic-owner',
      token: 'synthetic-token',
      expiresAt: new Date(now.getTime() + 86400000),
      createdAt: now,
      updatedAt: now,
      ipAddress: null,
      userAgent: null,
    },
  }));
  const originalFind = db.profile.findUnique;
  Object.assign(db.profile, {
    findUnique: async () => {
      throw new Error('synthetic private query and schema marker');
    },
  });
  const logger = context.mock.method(console, 'error', () => {});
  try {
    const target = '/settings?section=privacy';
    const login = await middleware(
      new NextRequest(`http://127.0.0.1/login?callbackUrl=${encodeURIComponent(target)}`),
    );
    assert.equal(login.headers.get('x-middleware-next'), '1');
    assert.equal(login.headers.get('location'), null);
    const signup = await middleware(
      new NextRequest(`http://127.0.0.1/signup?callbackUrl=${encodeURIComponent(target)}`),
    );
    const redirected = new URL(signup.headers.get('location')!);
    assert.equal(redirected.pathname, '/login');
    assert.equal(redirected.searchParams.get('callbackUrl'), target);
    assert.equal(logger.mock.callCount(), 2);
    for (const call of logger.mock.calls)
      assert.deepEqual(call.arguments, [
        'Profile lookup unavailable during authentication redirect',
      ]);
  } finally {
    session.mock.restore();
    Object.assign(db.profile, { findUnique: originalFind });
  }
});
