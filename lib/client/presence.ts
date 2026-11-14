import { api, FetchError } from '@/lib/fetch-wrapper';
import type { PresenceSnapshot } from '@/app/components/features/messaging/presence-input';

type Owner = { userId: string; sessionId: string };
export function readPresence(owner: Owner, userIds: string[], signal: AbortSignal) {
  return api.post<PresenceSnapshot>(
    '/api/users/presence',
    { expectedUserId: owner.userId, expectedSessionId: owner.sessionId, userIds },
    { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) },
  );
}

export function maintainPresence(
  owner: Owner,
  leaseId: string,
  sequence: { value: number },
  changed: (unavailable: boolean) => void,
) {
  let active = true;
  let paused = false;
  let denied = false;
  const counter = sequence;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  const input = () => ({
    expectedUserId: owner.userId,
    expectedSessionId: owner.sessionId,
    leaseId,
    sequence: ++counter.value,
  });
  const heartbeat = async () => {
    if (!active || paused || denied) return;
    if (timer) clearTimeout(timer);
    const body = input();
    const current = () => active && !paused && counter.value === body.sequence;
    try {
      const result = await api.post<{ accepted: boolean }>('/api/presence', body, {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
      });
      if (current()) changed(!result.accepted);
    } catch (error) {
      if (current()) {
        denied = error instanceof FetchError && [400, 401, 403, 409].includes(error.status);
        changed(true);
      }
    } finally {
      if (current() && !denied) timer = setTimeout(() => void heartbeat(), 20_000);
    }
  };
  const leave = () => {
    if (timer) clearTimeout(timer);
    void api
      .delete('/api/presence', {
        body: JSON.stringify(input()),
        keepalive: true,
        signal: AbortSignal.timeout(5000),
      })
      .catch(() => {});
  };
  const hide = () => {
    paused = true;
    leave();
  };
  const resume = () => {
    if (!paused) return;
    paused = false;
    void heartbeat();
  };
  window.addEventListener('pagehide', hide);
  window.addEventListener('pageshow', resume);
  void heartbeat();
  return () => {
    active = false;
    controller.abort();
    window.removeEventListener('pagehide', hide);
    window.removeEventListener('pageshow', resume);
    leave();
  };
}
