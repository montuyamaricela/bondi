import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeSavedMessages } from '../../app/components/features/messaging/message-state';
import type { Message } from '../../app/components/features/messaging/types';

const message = (id: string, fields: Partial<Message> = {}): Message => ({
  id,
  matchId: 'synthetic-match',
  senderId: 'synthetic-sender',
  content: id,
  type: 'TEXT',
  createdAt: '2026-11-14T00:00:00.000Z',
  readAt: null,
  ...fields,
});

test('history and live messages converge by identity with deterministic timestamp ties', () => {
  const live = Object.freeze([
    message('b'),
    message('c', { createdAt: '2026-11-14T00:01:00.000Z' }),
  ]);
  const history = Object.freeze([message('a'), message('b')]);
  const merged = mergeSavedMessages('synthetic-match', live, history);
  assert.deepEqual(
    merged.map(({ id }) => id),
    ['a', 'b', 'c'],
  );
  assert.deepEqual(
    live.map(({ id }) => id),
    ['b', 'c'],
  );
  assert.equal(mergeSavedMessages('synthetic-match', merged, history).length, 3);
});

test('an older history response cannot erase a newer live read receipt', () => {
  const readAt = '2026-11-14T00:02:00.000Z';
  const live = message('a', { readAt });
  assert.equal(mergeSavedMessages('synthetic-match', [live], [message('a')])[0].readAt, readAt);
  assert.equal(mergeSavedMessages('synthetic-match', [message('a')], [live])[0].readAt, readAt);
  const newer = '2026-11-14T00:03:00.000Z';
  assert.equal(
    mergeSavedMessages('synthetic-match', [message('a', { readAt: newer })], [live])[0].readAt,
    newer,
  );
});

test('reconciliation excludes messages from another conversation', () => {
  assert.deepEqual(
    mergeSavedMessages('synthetic-match', [
      message('other', { matchId: 'different-match' }),
      message('allowed'),
    ]).map(({ id }) => id),
    ['allowed'],
  );
});
