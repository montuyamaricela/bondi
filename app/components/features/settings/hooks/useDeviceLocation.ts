'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { getCurrentPosition } from '@/lib/client/geolocation';
import type { Coordinates } from '@/lib/geolocation';
import { api, FetchError } from '@/lib/fetch-wrapper';

type SavedLocation = Coordinates & { lastLocationUpdate: string };
type State = {
  userId: string;
  phase: 'idle' | 'requesting' | 'saving';
  error: string | null;
  pending: Coordinates | null;
  saved: SavedLocation | null;
};
const initialState = (userId: string): State => ({
  userId,
  phase: 'idle',
  error: null,
  pending: null,
  saved: null,
});

export function useDeviceLocation(userId: string) {
  const [state, setState] = useState(() => initialState(userId));
  const active = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();
  const router = useRouter();
  const current = state.userId === userId ? state : initialState(userId);

  useEffect(
    () => () => {
      active.current?.abort();
      active.current = null;
    },
    [userId],
  );

  const update = async (retry: boolean) => {
    if (active.current || (retry && !current.pending)) return;
    const controller = new AbortController();
    active.current = controller;
    let coordinates = retry ? current.pending : null;
    let saving = Boolean(coordinates);
    const change = (patch: Partial<State>) => {
      if (!controller.signal.aborted)
        setState((previous) => ({
          ...(previous.userId === userId ? previous : initialState(userId)),
          ...patch,
          userId,
        }));
    };
    change({ phase: saving ? 'saving' : 'requesting', error: null, pending: null });
    try {
      coordinates ??= await getCurrentPosition();
      if (controller.signal.aborted) return;
      saving = true;
      change({ phase: 'saving' });
      const saved = await api.patch<SavedLocation>(
        '/api/profile/location',
        {
          ...coordinates,
          expectedUserId: userId,
        },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      change({ phase: 'idle', error: null, pending: null, saved });
      void queryClient.invalidateQueries({ queryKey: ['discover-profiles'] });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      router.refresh();
    } catch (error) {
      if (controller.signal.aborted) return;
      const accountChanged =
        error instanceof FetchError &&
        error.status === 409 &&
        error.data &&
        typeof error.data === 'object' &&
        'code' in error.data &&
        error.data.code === 'ACCOUNT_CHANGED';
      const expired = error instanceof FetchError && error.status === 401;
      change({
        phase: 'idle',
        pending: saving && !accountChanged && !expired ? coordinates : null,
        error: accountChanged
          ? 'Your account changed. Reload settings before updating location.'
          : expired
            ? 'Your session expired. Sign in again to update location.'
            : saving
              ? 'Your location could not be saved. Retry saving or refresh your device location.'
              : error instanceof Error
                ? error.message
                : 'Your location could not be determined. Please try again.',
      });
    } finally {
      if (active.current === controller) active.current = null;
    }
  };

  return {
    phase: current.phase,
    isLoading: current.phase !== 'idle',
    error: current.error,
    savedLocation: current.saved,
    canRetrySave: current.pending !== null,
    refreshLocation: () => update(false),
    retrySave: () => update(true),
  };
}
