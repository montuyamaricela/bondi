import assert from 'node:assert/strict';
import { test } from 'node:test';
import { InfiniteQueryObserver, QueryClient } from '@tanstack/react-query';
import {
  addSavedMessages,
  readSavedMessage,
  reconcileMessagePages,
  shareMessagePages,
  type MessagePages,
} from '../../app/components/features/messaging/message-pages';
import { mergeSavedMessages } from '../../app/components/features/messaging/message-state';
import type { Message } from '../../app/components/features/messaging/types';

const matchId = 'synthetic-match';
const message = (id: string, minute = 0): Message => ({
  id,
  matchId,
  senderId: 'synthetic-sender',
  content: id,
  type: 'TEXT',
  createdAt: `2026-11-14T00:${String(minute).padStart(2, '0')}:00.000Z`,
  readAt: null,
});
const pages = (newest: Message[], older: Message[] = []): MessagePages => ({
  pages: [
    { items: newest, nextCursor: 'older' },
    ...(older.length ? [{ items: older, nextCursor: null }] : []),
  ],
  pageParams: [null, ...(older.length ? ['older'] : [])],
});
const all = (data: MessagePages) =>
  mergeSavedMessages(
    matchId,
    data.pages.flatMap((page) => page.items),
  );

test('whole-page reconciliation retains a live arrival and read receipt while an older page awaits', () => {
  const a = message('a');
  const b = message('b', 1);
  const c = message('c', 2);
  const d = message('d', 3);
  const previous = readSavedMessage(
    matchId,
    pages([c, d, message('e', 4)], [a, b]),
    c.id,
    '2026-11-14T00:10:00.000Z',
  );
  const result = reconcileMessagePages(matchId, previous, pages([c, d], [a, b]));
  assert.deepEqual(
    all(result).map((item) => item.id),
    ['a', 'b', 'c', 'd', 'e'],
  );
  assert.equal(all(result).find((item) => item.id === 'c')?.readAt, '2026-11-14T00:10:00.000Z');
  assert.equal(result.pages[0].nextCursor, 'older');
  assert.equal(result.pages[1].nextCursor, null);
});

test('a refreshed latest window excludes obsolete cached rows but retains a late timestamp tie', () => {
  const old = message('old');
  const late = message('b', 4);
  const fresh = message('c', 4);
  const result = reconcileMessagePages(matchId, pages([old, late]), pages([fresh]));
  assert.deepEqual(
    all(result).map((item) => item.id),
    ['b', 'c'],
  );
  assert.equal(result.pages[0].nextCursor, 'older');
});

test('acknowledgements and receipts update the existing page without duplicate or phantom history', () => {
  const first = message('a');
  const newest = message('z', 3);
  const previous = pages([newest], [first]);
  const read = readSavedMessage(matchId, previous, first.id, '2026-11-14T00:10:00.000Z');
  const replay = addSavedMessages(matchId, read, [first, newest, message('next', 4)]);
  assert.equal(replay.pages[0].items.length, 2);
  assert.equal(replay.pages[1].items.length, 1);
  assert.equal(replay.pages[1].items[0].readAt, '2026-11-14T00:10:00.000Z');
  assert.equal(all(replay).length, 3);
  assert.equal(
    readSavedMessage(matchId, undefined, 'missing', '2026-11-14T00:10:00.000Z'),
    undefined,
  );
  assert.equal(
    readSavedMessage(matchId, previous, 'another-conversation', '2026-11-14T00:10:00.000Z'),
    previous,
  );
});

test('the native infinite-query observer shares both pages and selected messages after live writes', async () => {
  const client = new QueryClient();
  const key = ['messages', matchId];
  const observer = new InfiniteQueryObserver(client, {
    queryKey: key,
    initialPageParam: null as string | null,
    queryFn: async () => ({ items: [message('initial')], nextCursor: null as string | null }),
    getNextPageParam: (page) => page.nextCursor,
    structuralSharing: (previous, incoming) => shareMessagePages(matchId, previous, incoming),
    select: (data) => all(data),
    retry: false,
    gcTime: 0,
  });
  const unsubscribe = observer.subscribe(() => {});
  try {
    await observer.refetch();
    client.setQueryData<MessagePages>(key, (previous) =>
      addSavedMessages(matchId, previous, [message('live', 1)]),
    );
    const result = observer.getCurrentResult();
    assert.equal(result.error, null);
    assert.deepEqual(
      result.data?.map((item) => item.id),
      ['initial', 'live'],
    );
    assert.equal(client.getQueryData<MessagePages>(key)?.pages[0].items.length, 2);
  } finally {
    unsubscribe();
    client.clear();
  }
});
