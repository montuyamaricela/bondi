'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSession } from '@/lib/auth-client';
import { LOCATION_CHANGE_KEY } from '@/lib/client/location-events';
import { refreshLocationProjections } from '@/lib/client/location-cache';

export function QueryProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession();
  const previousOwner = useRef<string | null | undefined>(undefined);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  useLayoutEffect(() => {
    if (isPending) return;
    const owner = session?.user.id ?? null;
    if (previousOwner.current !== undefined && previousOwner.current !== owner) {
      queryClient.removeQueries({ type: 'inactive' });
      void queryClient.resetQueries({ type: 'active' });
    }
    previousOwner.current = owner;
  }, [isPending, session?.user.id, queryClient]);

  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === LOCATION_CHANGE_KEY) void refreshLocationProjections(queryClient);
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
