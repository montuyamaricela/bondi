import { replaceEqualDeep, type InfiniteData } from '@tanstack/react-query';
import type { CursorPage } from '@/lib/pagination';
import type { Message } from './types';
import { mergeSavedMessages } from './message-state';

export type MessagePages = InfiniteData<CursorPage<Message>, string | null>;

export function shareMessagePages(matchId: string, previous: unknown, incoming: unknown) {
  // TanStack also shares the observer's selected array, separately from stored pages.
  if (Array.isArray(incoming)) return replaceEqualDeep(previous, incoming);
  return reconcileMessagePages(
    matchId,
    previous as MessagePages | undefined,
    incoming as MessagePages,
  );
}

export function addSavedMessages(
  matchId: string,
  previous: MessagePages | undefined,
  incoming: Message[],
): MessagePages {
  const pages = previous?.pages.length ? previous.pages : [{ items: [], nextCursor: null }];
  const locations = new Map(
    pages.flatMap((page, index) => page.items.map((message) => [message.id, index] as const)),
  );
  return {
    pageParams: previous?.pages.length ? previous.pageParams : [null],
    pages: pages.map((page, index) => ({
      ...page,
      items: mergeSavedMessages(
        matchId,
        page.items,
        incoming.filter((message) => (locations.get(message.id) ?? 0) === index),
      ),
    })),
  };
}

export function readSavedMessage(
  matchId: string,
  previous: MessagePages | undefined,
  messageId: string,
  readAt: string,
) {
  if (!previous) return previous;
  const updates = previous.pages
    .flatMap((page) => page.items)
    .filter((message) => message.id === messageId)
    .map((message) => ({ ...message, readAt }));
  return updates.length ? addSavedMessages(matchId, previous, updates) : previous;
}

export function reconcileMessagePages(
  matchId: string,
  previous: MessagePages | undefined,
  incoming: MessagePages,
): MessagePages {
  if (!previous) return incoming;
  const known = mergeSavedMessages(
    matchId,
    previous.pages.flatMap((page) => page.items),
  );
  const fresh = mergeSavedMessages(
    matchId,
    incoming.pages.flatMap((page) => page.items),
  );
  const ids = new Set(fresh.map((message) => message.id));
  const newest = fresh.length ? new Date(fresh.at(-1)!.createdAt).getTime() : -Infinity;
  // Reconcile at the whole-query commit: live events can arrive while later pages await.
  const live = known.filter(
    (message) => !ids.has(message.id) && new Date(message.createdAt).getTime() >= newest,
  );
  return {
    ...incoming,
    pages: incoming.pages.map((page, index) => {
      const pageIds = new Set(page.items.map((message) => message.id));
      return {
        ...page,
        items: mergeSavedMessages(
          matchId,
          known.filter((message) => pageIds.has(message.id)),
          page.items,
          index === 0 ? live : [],
        ),
      };
    }),
  };
}
