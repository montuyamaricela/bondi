import type { QueryClient } from '@tanstack/react-query';

export async function refreshLocationProjections(client: QueryClient) {
  const predicate = (query: { queryKey: readonly unknown[] }) =>
    ['profile', 'user-profile', 'discover-profiles', 'receivedLikes'].includes(
      String(query.queryKey[0]),
    );
  await client.cancelQueries({ predicate });
  client.removeQueries({ predicate, type: 'inactive' });
  await client.resetQueries({ predicate, type: 'active' });
}
