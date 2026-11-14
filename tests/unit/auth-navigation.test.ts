import assert from 'node:assert/strict';
import { test } from 'node:test';
import { safeCallbackUrl, profileSetupDestination } from '../../lib/auth-navigation';

test('safe callback destinations retain internal paths, queries and explicit fragments', () => {
  for (const path of [
    '/',
    '/settings?section=privacy&from=login',
    '/messages/synthetic-match?view=files#latest',
    '/likes?q=caf%C3%A9',
  ])
    assert.equal(safeCallbackUrl(path), path);
  assert.equal(
    safeCallbackUrl('/messages/../settings?section=location'),
    '/settings?section=location',
  );
});

test('unsafe, malformed, ambiguous and auth-loop callbacks fail closed', () => {
  for (const path of [
    null,
    undefined,
    1,
    [],
    ['/settings'],
    '',
    'settings',
    'https://evil.example.test',
    '//evil.example.test',
    '/\\evil.example.test',
    '/settings\\profile',
    '/%5cevil.example.test',
    '/%2f%2fevil.example.test',
    '/%255cevil.example.test',
    '/lo%67in',
    '/messages/../login',
    '/login?callbackUrl=/settings',
    '/signup',
    '/profile/setup',
    '/api/auth/sign-out',
    '/%E0%A4%A',
    '/settings' + String.fromCharCode(0),
    '/settings' + String.fromCharCode(10),
    '/settings' + String.fromCharCode(127),
    '/settings' + 'x'.repeat(2048),
  ])
    assert.equal(safeCallbackUrl(path), '/discover', String(path));
});

test('onboarding carries an explicit safe destination while preserving the default route', () => {
  assert.equal(profileSetupDestination(undefined), '/profile/setup');
  assert.equal(profileSetupDestination('https://evil.example.test'), '/profile/setup');
  const target = '/settings?section=location&from=login';
  const url = new URL(profileSetupDestination(target), 'https://bondi.internal');
  assert.equal(url.pathname, '/profile/setup');
  assert.equal(url.searchParams.get('callbackUrl'), target);
});
