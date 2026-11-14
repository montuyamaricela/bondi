import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/fetch-wrapper';
import type { CursorPage } from '@/lib/pagination';
import type { Message } from '@/app/components/features/messaging/types';
import {
  addSavedMessages,
  type MessagePages,
} from '@/app/components/features/messaging/message-pages';

export async function refreshRealtimeMessages(client: QueryClient, signal: AbortSignal) {
  if (signal.aborted) return;
  await client.invalidateQueries({ queryKey: ['messages'], type: 'inactive', refetchType: 'none' });
  const queries = client.getQueryCache().findAll({ queryKey: ['messages'], type: 'active' });
  await Promise.all(
    queries.map(async (query) => {
      if (signal.aborted) return;
      const matchId = query.queryKey[1];
      const filter = { queryKey: query.queryKey, exact: true };
      if (
        typeof matchId === 'string' &&
        query.state.fetchStatus === 'fetching' &&
        query.state.fetchMeta?.fetchMore?.direction === 'forward'
      ) {
        // A head refresh must not cancel the user's independently requested older page.
        const head = await api.get<CursorPage<Message>>(
          `/api/messages?${new URLSearchParams({ matchId, limit: '50' })}`,
          { signal },
        );
        if (signal.aborted) return;
        const previous = client.getQueryData<MessagePages>(query.queryKey);
        if (!previous) return;
        const ids = new Set(previous.pages.flatMap(({ items }) => items.map(({ id }) => id)));
        if (head.items.some(({ id }) => ids.has(id))) {
          client.setQueryData<MessagePages>(query.queryKey, (current) =>
            addSavedMessages(matchId, current, head.items),
          );
        } else {
          // A wholly new latest window needs its own cursor, rather than a false history gap.
          await client.cancelQueries(filter);
          if (!signal.aborted) await client.invalidateQueries(filter);
        }
        return;
      }
      await client.cancelQueries(filter);
      if (!signal.aborted) await client.invalidateQueries(filter);
    }),
  );
}
