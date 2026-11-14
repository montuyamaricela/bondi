import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import { createAppError, handleApiError } from '../../lib/errors';

const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('unexpected API errors expose only a correlated generic response and redacted log', async (context) => {
  const logger = context.mock.method(console, 'error', () => {});
  const marker =
    'SELECT synthetic_secret FROM PrivateTable /synthetic/server.ts password=synthetic-only';
  const ids = new Set<string>();
  for (const error of [new Error(marker), new SyntaxError(marker), { private: marker }, null]) {
    const response = handleApiError(error);
    assert.equal(response.status, 500);
    const body = await response.json();
    assert.deepEqual(Object.keys(body).sort(), ['code', 'error', 'requestId']);
    assert.equal(body.error, 'Internal server error');
    assert.equal(body.code, 'INTERNAL_SERVER_ERROR');
    assert.match(body.requestId, requestIdPattern);
    assert.equal(response.headers.get('x-request-id'), body.requestId);
    assert.ok(!ids.has(body.requestId));
    ids.add(body.requestId);
    assert.deepEqual(logger.mock.calls.at(-1)?.arguments, [
      'API request failed',
      { requestId: body.requestId },
    ]);
  }
  assert.equal(logger.mock.callCount(), 4);
});

test('expected API errors retain safe validation, access, conflict and retry contracts without raw logs', async (context) => {
  const logger = context.mock.method(console, 'error', () => {});
  for (const status of [400, 401, 403, 404, 409, 503]) {
    const response = handleApiError(
      createAppError('Safe expected failure', status, 'EXPECTED_FAILURE'),
    );
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), {
      error: 'Safe expected failure',
      code: 'EXPECTED_FAILURE',
    });
  }
  const invalid = z.object({ enabled: z.boolean() }).safeParse({ enabled: 'wrong' });
  assert.equal(invalid.success, false);
  if (invalid.success) return;
  const response = handleApiError(invalid.error);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: 'Validation failed',
    details: [{ path: 'enabled', message: 'Invalid input: expected boolean, received string' }],
  });
  assert.equal(logger.mock.callCount(), 0);
});
