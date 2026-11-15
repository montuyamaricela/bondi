import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { subscribeRealtime, type RealtimeConnectionState } from '../../lib/client/realtime';

const owner = { userId: 'synthetic-owner', sessionId: 'synthetic-session' };
const payload = {
  ...owner,
  leaseId: 'synthetic-lease',
  topic: `bondi:${'a'.repeat(64)}`,
  closeToken: 'b'.repeat(64),
  token: 'synthetic.token.value',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
};

async function settle() {
  for (let index = 0; index < 12; index++) await Promise.resolve();
}

function fixture(t: TestContext, phase: 'headers' | 'body' = 'headers') {
  const previousFetch = globalThis.fetch;
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const events = new EventTarget();
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const disposers: Array<() => void> = [];
  const states: RealtimeConnectionState[] = [];
  const requests: Array<{
    signal: AbortSignal;
    headers: ReturnType<typeof Promise.withResolvers<Response>>;
    body: ReturnType<typeof Promise.withResolvers<unknown>>;
  }> = [];
  Object.defineProperty(globalThis, 'window', { value: events, configurable: true });
  Object.defineProperty(globalThis, 'document', { value: document, configurable: true });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  globalThis.fetch = async (_input, init) => {
    assert.equal(init?.method, 'POST');
    assert.ok(init.signal);
    const headers = Promise.withResolvers<Response>();
    const body = Promise.withResolvers<unknown>();
    requests.push({ signal: init.signal, headers, body });
    if (phase === 'headers') return headers.promise;
    const response = new Response(null, { status: 200 });
    response.json = () => body.promise;
    return response;
  };
  t.after(() => {
    for (const dispose of disposers) dispose();
    t.mock.timers.reset();
    globalThis.fetch = previousFetch;
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  });
  const start = (identity = owner) => {
    const dispose = subscribeRealtime(
      identity,
      { url: 'http://127.0.0.1:9', key: 'sb_publishable_synthetic' },
      () => {},
      (state) => states.push(state),
    );
    disposers.push(dispose);
    return dispose;
  };
  const release = (index: number) => {
    requests[index].headers.resolve(Response.json(payload));
    requests[index].body.resolve(payload);
  };
  return { events, document, states, requests, start, release };
}

for (const phase of ['headers', 'body'] as const) {
  test(`credential ${phase} deadline frees the pending attempt without aborting its reusable owner`, async (t) => {
    const owned = fixture(t, phase);
    const dispose = owned.start();
    await settle();
    assert.equal(owned.requests.length, 1);
    t.mock.timers.tick(7999);
    await settle();
    assert.equal(owned.requests[0].signal.aborted, false);
    t.mock.timers.tick(1);
    await settle();
    assert.equal(owned.requests[0].signal.aborted, true);
    assert.deepEqual(owned.states.at(-1), { status: 'disconnected', leaseId: null });
    t.mock.timers.tick(1000);
    await settle();
    assert.equal(owned.requests.length, 2);
    assert.equal(owned.requests[1].signal.aborted, false);
    owned.events.dispatchEvent(new Event('focus'));
    owned.document.dispatchEvent(new Event('visibilitychange'));
    await settle();
    assert.equal(owned.requests.length, 2, 'focus cannot duplicate a pending attempt');
    owned.release(0);
    await settle();
    assert.equal(
      owned.states.some(({ status }) => status === 'connecting'),
      false,
    );
    assert.equal(owned.requests[1].signal.aborted, false);
    dispose();
    assert.equal(owned.requests[1].signal.aborted, true);
    owned.release(1);
    t.mock.timers.tick(120_000);
    owned.events.dispatchEvent(new Event('focus'));
    await settle();
    assert.equal(owned.requests.length, 2, 'disposed owners cannot retry');
    assert.equal(
      owned.states.some(({ status }) => status === 'connecting'),
      false,
    );
  });

  test(`disposing held ${phase} clears its deadline and cannot affect a replacement session`, async (t) => {
    const owned = fixture(t, phase);
    const dispose = owned.start();
    await settle();
    t.mock.timers.tick(7999);
    dispose();
    assert.equal(owned.requests[0].signal.aborted, true);
    owned.start({ ...owner, sessionId: 'replacement-session' });
    await settle();
    t.mock.timers.tick(1);
    await settle();
    assert.equal(owned.requests.length, 2);
    assert.equal(owned.requests[1].signal.aborted, false);
    owned.release(0);
    await settle();
    assert.equal(
      owned.states.some(({ status }) => status === 'connecting'),
      false,
    );
    t.mock.timers.tick(7999);
    await settle();
    assert.equal(owned.requests[1].signal.aborted, true);
    assert.deepEqual(owned.states.at(-1), { status: 'disconnected', leaseId: null });
  });
}

test('credential deadlines retain the bounded retry budget and focus can explicitly restart it', async (t) => {
  const owned = fixture(t);
  const dispose = owned.start();
  await settle();
  for (let index = 0; index < 6; index++) {
    assert.equal(owned.requests.length, index + 1);
    t.mock.timers.tick(8000);
    await settle();
    assert.equal(owned.requests[index].signal.aborted, true);
    if (index < 5) {
      t.mock.timers.tick((index + 1) * 1000);
      await settle();
    }
  }
  t.mock.timers.tick(120_000);
  await settle();
  assert.equal(owned.requests.length, 6);
  owned.events.dispatchEvent(new Event('focus'));
  await settle();
  assert.equal(owned.requests.length, 7);
  assert.equal(owned.requests[6].signal.aborted, false);
  dispose();
  assert.equal(owned.requests[6].signal.aborted, true);
});
