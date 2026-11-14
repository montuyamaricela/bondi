'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { refreshLocationProjections } from '@/lib/client/location-cache';
import { api, FetchError } from '@/lib/fetch-wrapper';
import { getCurrentPosition } from '@/lib/client/geolocation';
import {
  clearLegacyLocationDraft,
  LOCATION_CHANGE_KEY,
  notifyLocationChange,
} from '@/lib/client/location-events';
import type { Coordinates } from '@/lib/geolocation';
import type { LocationMode, LocationOwnerState } from '../types';
import type { LocationMutation } from '../validation';

const conflictMessage = 'Location changed. Review the saved settings and choose your action again.';
const ownerMessage = 'Your account or saved settings changed. Reload Settings.';
type Action = LocationMutation['action'];
type PendingFix = { coordinates: Coordinates; revision: number };
type State = {
  userId: string;
  phase: 'idle' | 'requesting' | 'saving';
  action: Action | null;
  mode: LocationMode | null;
  error: string | null;
  success: string | null;
  pending: PendingFix | null;
};
const initial = (userId: string): State => ({
  userId,
  phase: 'idle',
  action: null,
  mode: null,
  error: null,
  success: null,
  pending: null,
});
type Operation = {
  controller: AbortController;
  generation: number;
  userId: string;
  revision: number;
  action: Action;
};

function checkOwner(value: LocationOwnerState, userId: string) {
  if (
    !value ||
    value.userId !== userId ||
    !Number.isInteger(value.revision) ||
    value.revision < 0 ||
    !['OFF', 'DEVICE', 'CITY'].includes(value.mode)
  )
    throw new Error(ownerMessage);
  return value;
}

export function useLocationControl(userId: string) {
  const client = useQueryClient();
  const key = useMemo(() => ['location', userId] as const, [userId]);
  const [state, setState] = useState(() => initial(userId));
  const active = useRef<Operation | null>(null);
  const generation = useRef(0);
  const disposed = useRef(false);
  const known = useRef<{ userId: string; revision: number } | null>(null);
  const current = state.userId === userId ? state : initial(userId);
  const query = useQuery({
    queryKey: key,
    retry: false,
    refetchOnWindowFocus: 'always',
    queryFn: async ({ signal }) => {
      const saved = checkOwner(
        await api.get<LocationOwnerState>('/api/profile/location', {
          signal,
          cache: 'no-store',
        }),
        userId,
      );
      if (signal.aborted || disposed.current) throw new Error('Location request was cancelled');
      const previous = known.current?.userId === userId ? known.current.revision : null;
      if (previous !== null && saved.revision < previous)
        throw new Error('Reload saved location settings.');
      if (previous !== null && previous !== saved.revision) {
        const interrupted = active.current !== null;
        active.current?.controller.abort();
        active.current = null;
        generation.current++;
        setState((old) => ({
          ...(old.userId === userId ? old : initial(userId)),
          phase: 'idle',
          action: null,
          mode: null,
          pending: null,
          success: null,
          error: interrupted ? conflictMessage : old.error,
        }));
      }
      known.current = { userId, revision: saved.revision };
      return saved;
    },
  });

  useEffect(() => {
    disposed.current = false;
    const changed = (event: StorageEvent) => {
      if (event.key !== LOCATION_CHANGE_KEY) return;
      active.current?.controller.abort();
      active.current = null;
      generation.current++;
      setState({ ...initial(userId), error: conflictMessage });
      void client.resetQueries({ queryKey: key, exact: true });
    };
    window.addEventListener('storage', changed);
    return () => {
      disposed.current = true;
      active.current?.controller.abort();
      active.current = null;
      window.removeEventListener('storage', changed);
      void client.cancelQueries({ queryKey: key, exact: true });
      client.removeQueries({ queryKey: key, exact: true });
    };
  }, [client, key, userId]);

  const chooseMode = (mode: LocationMode) => {
    active.current?.controller.abort();
    active.current = null;
    generation.current++;
    setState({ ...initial(userId), mode });
  };

  const update = async (
    action: Action,
    details: { cityId?: string; showCity?: boolean; showDistance?: boolean } = {},
    retry = false,
  ) => {
    if (active.current && (action !== 'CLEAR' || active.current.action === 'CLEAR')) return;
    const saved = client.getQueryData<LocationOwnerState>(key);
    if (!saved || saved.userId !== userId || disposed.current) return;
    if (retry && (!current.pending || current.pending.revision !== saved.revision)) {
      setState({ ...initial(userId), error: conflictMessage });
      void query.refetch();
      return;
    }
    active.current?.controller.abort();
    const operation: Operation = {
      controller: new AbortController(),
      generation: ++generation.current,
      revision: retry ? current.pending!.revision : saved.revision,
      userId,
      action,
    };
    active.current = operation;
    const owned = () =>
      !disposed.current &&
      !operation.controller.signal.aborted &&
      active.current === operation &&
      operation.generation === generation.current;
    let coordinates = retry ? current.pending!.coordinates : null;
    let saving = action !== 'DEVICE' || Boolean(coordinates);
    setState((old) => ({
      ...(old.userId === userId ? old : initial(userId)),
      action,
      phase: saving ? 'saving' : 'requesting',
      error: null,
      success: null,
      pending: null,
    }));
    try {
      if (action === 'DEVICE') coordinates ??= await getCurrentPosition();
      if (!owned()) return;
      saving = true;
      setState((old) => ({ ...old, phase: 'saving' }));
      const result = checkOwner(
        await api.patch<LocationOwnerState>(
          '/api/profile/location',
          {
            action,
            expectedUserId: userId,
            expectedRevision: operation.revision,
            ...details,
            ...(coordinates ?? {}),
          },
          { signal: operation.controller.signal },
        ),
        userId,
      );
      if (!owned()) return;
      await client.cancelQueries({ queryKey: key, exact: true });
      if (!owned()) return;
      active.current = null;
      known.current = { userId, revision: result.revision };
      client.setQueryData(key, result);
      setState({
        ...initial(userId),
        success: action === 'CLEAR' ? 'Location cleared.' : 'Location settings saved.',
      });
      if (action === 'CLEAR') clearLegacyLocationDraft(userId);
      notifyLocationChange(action === 'CLEAR');
      void refreshLocationProjections(client);
    } catch (error) {
      if (!owned()) return;
      active.current = null;
      const status = error instanceof FetchError ? error.status : null;
      setState((old) => ({
        ...old,
        phase: 'idle',
        action: null,
        success: null,
        pending:
          action === 'DEVICE' && coordinates && (status === null || status >= 500)
            ? { coordinates, revision: operation.revision }
            : null,
        error:
          status === 409
            ? conflictMessage
            : status === 401
              ? 'Your session expired. Sign in again to update location.'
              : !saving && error instanceof Error
                ? error.message
                : action === 'CLEAR'
                  ? 'Location could not be cleared. Retry the clear action.'
                  : action === 'CITY'
                    ? 'City could not be saved. Retry, or select another listed city.'
                    : action === 'VISIBILITY'
                      ? 'Location visibility could not be saved. Please retry.'
                      : 'Your location could not be saved. Retry saving or refresh your device location.',
      }));
      if (status === 409) void query.refetch();
    } finally {
      if (active.current === operation) active.current = null;
    }
  };

  return {
    data: query.error?.message === ownerMessage ? undefined : query.data,
    queryError: query.error,
    isLoading: query.isPending,
    reload: () => query.refetch(),
    ...current,
    selectedMode: current.mode ?? query.data?.mode ?? 'OFF',
    chooseMode,
    capture: () => update('DEVICE'),
    retrySave: () => update('DEVICE', {}, true),
    saveCity: (cityId: string) => update('CITY', { cityId }),
    clear: () => update('CLEAR'),
    visibility: (value: { showCity?: boolean; showDistance?: boolean }) =>
      update('VISIBILITY', value),
  };
}
