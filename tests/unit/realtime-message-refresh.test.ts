import assert from 'node:assert/strict';
import { test } from 'node:test';
import { InfiniteQueryObserver, QueryClient } from '@tanstack/react-query';
import { refreshRealtimeMessages } from '../../lib/client/realtime-queries';
import {
  shareMessagePages,
  type MessagePages,
} from '../../app/components/features/messaging/message-pages';
import type { Message } from '../../app/components/features/messaging/types';
import type { CursorPage } from '../../lib/pagination';

const matchId = 'synthetic-refresh-match';
const row = (id: string, minute: number): Message => ({
  id,
  matchId,
  senderId: 'synthetic-peer',
  content: id,
  type: 'TEXT',
  readAt: null,
  createdAt: `2026-11-14T00:0${minute}:00.000Z`,
});

const key = ['messages', matchId];
const older = row('older', 0);
const initial = row('initial', 1);
const live = row('live', 2);
const head: CursorPage<Message> = { items: [initial, live], nextCursor: 'older' };

async function pagination(nextHead = head) {
  const client = new QueryClient();
  const controller = new AbortController();
  client.setQueryData<MessagePages>(key, {
    pages: [{ items: [initial], nextCursor: 'older' }],
    pageParams: [null],
  });
  let release = () => {};
  let olderSignal: AbortSignal | undefined;
  const pendingOlder = new Promise<CursorPage<Message>>((resolve) => {
    release = () => resolve({ items: [older], nextCursor: null });
  });
  const observer = new InfiniteQueryObserver(client, {
    queryKey: key,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => {
      if (pageParam === null) return Promise.resolve(nextHead);
      olderSignal = signal;
      return pendingOlder;
    },
    getNextPageParam: (page) => page.nextCursor,
    structuralSharing: (previous, incoming) => shareMessagePages(matchId, previous, incoming),
    staleTime: Infinity,
    retry: false,
    gcTime: 0,
  });
  const unsubscribe = observer.subscribe(() => {});
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json(nextHead);
  const pending = observer.fetchNextPage();
  assert.ok(olderSignal);
  return {
    client,
    controller,
    olderSignal,
    release,
    pending,
    ids: () =>
      client
        .getQueryData<MessagePages>(key)
        ?.pages.flatMap(({ items }) => items.map(({ id }) => id))
        .sort(),
    close: async () => {
      release();
      await pending;
      controller.abort();
      globalThis.fetch = previousFetch;
      unsubscribe();
      client.clear();
    },
  };
}

test('a native hint refreshes live rows without abandoning an in-flight older page', async () => {
  const fixture = await pagination();
  try {
    const { client, controller, olderSignal } = fixture;
    const unopened = ['messages', 'synthetic-unopened-match'];
    client.setQueryData(unopened, { pages: [], pageParams: [] });
    await refreshRealtimeMessages(client, controller.signal);
    assert.equal(olderSignal.aborted, false, 'the requested older page must remain owned');
    assert.equal(client.getQueryState(unopened)?.isInvalidated, true);
    assert.deepEqual(fixture.ids(), ['initial', 'live']);
    fixture.release();
    await fixture.pending;
    assert.deepEqual(fixture.ids(), ['initial', 'live', 'older']);
  } finally {
    await fixture.close();
  }
});

test('a disjoint latest window retains its cursor instead of joining a history gap', async () => {
  const fixture = await pagination({ items: [live], nextCursor: 'bridge-gap' });
  try {
    await refreshRealtimeMessages(fixture.client, fixture.controller.signal);
    assert.equal(fixture.olderSignal.aborted, true);
    fixture.release();
    await fixture.pending;
    assert.deepEqual(fixture.ids(), ['live']);
    assert.equal(fixture.client.getQueryData<MessagePages>(key)?.pages[0].nextCursor, 'bridge-gap');
  } finally {
    await fixture.close();
  }
});

test('a late head response cannot update messages after subscription ownership ends', async () => {
  const fixture = await pagination();
  try {
    let releaseHead = () => {};
    let started = () => {};
    const headStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    globalThis.fetch = async () => {
      started();
      await new Promise<void>((resolve) => {
        releaseHead = resolve;
      });
      return Response.json(head);
    };
    const refreshing = refreshRealtimeMessages(fixture.client, fixture.controller.signal);
    await headStarted;
    fixture.controller.abort();
    releaseHead();
    await refreshing;
    assert.equal(fixture.olderSignal.aborted, false);
    assert.deepEqual(fixture.ids(), ['initial']);
  } finally {
    await fixture.close();
  }
});
