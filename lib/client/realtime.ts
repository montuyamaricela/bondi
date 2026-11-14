import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const credentialSchema = z.object({
  userId: z.string(),
  sessionId: z.string(),
  leaseId: z.string().min(1),
  topic: z.string().regex(/^bondi:[a-f0-9]{64}$/),
  token: z.string().min(1),
  expiresAt: z.iso.datetime(),
});
type Credential = z.infer<typeof credentialSchema>;
export type RealtimeConnectionState = {
  status: 'connecting' | 'connected' | 'disconnected';
  leaseId: string | null;
};

export function subscribeRealtime(
  owner: { userId: string; sessionId: string },
  configuration: { url: string; key: string },
  changed: () => void,
  connectionChanged: (state: RealtimeConnectionState) => void = () => {},
) {
  let active = true;
  let credential: Credential | null = null;
  let client: SupabaseClient | null = null;
  let channel: RealtimeChannel | null = null;
  let pending: Promise<void> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let failures = 0;
  const controller = new AbortController();

  const disconnect = () => {
    if (active) connectionChanged({ status: 'disconnected', leaseId: null });
    channel = null;
    if (client) {
      const previous = client;
      client = null;
      previous.realtime.disconnect();
      void previous.removeAllChannels();
    }
  };
  const schedule = (delay: number) => {
    if (timer) clearTimeout(timer);
    if (active)
      timer = setTimeout(() => {
        void refresh();
      }, delay);
  };
  const retry = () => {
    if (timer) clearTimeout(timer);
    disconnect();
    if (active && ++failures <= 5) schedule(Math.min(failures * 1000, 5000));
  };
  const refresh = (): Promise<void> => {
    if (!active) return Promise.resolve();
    if (pending) return pending;
    pending = (async () => {
      try {
        const response = await fetch('/api/realtime/credential', {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expectedUserId: owner.userId,
            expectedSessionId: owner.sessionId,
            leaseId: credential?.leaseId,
          }),
        });
        if (!active) return;
        if (!response.ok) {
          if ([401, 403, 409].includes(response.status)) {
            credential = null;
            disconnect();
          }
          throw new Error('Subscription credential unavailable.');
        }
        const payload: unknown = await response.json();
        if (!active) return;
        const next = credentialSchema.parse(payload);
        const remaining = Date.parse(next.expiresAt) - Date.now();
        if (
          next.userId !== owner.userId ||
          next.sessionId !== owner.sessionId ||
          remaining <= 1000 ||
          remaining > 95_000 ||
          (credential && (next.leaseId !== credential.leaseId || next.topic !== credential.topic))
        )
          throw new Error('Subscription owner changed.');
        credential = next;
        if (!client) {
          connectionChanged({ status: 'connecting', leaseId: null });
          client = createClient(configuration.url, configuration.key, {
            accessToken: async () =>
              active && credential && Date.parse(credential.expiresAt) > Date.now()
                ? credential.token
                : null,
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
            realtime: {
              reconnectAfterMs: (attempt) =>
                attempt <= 5 ? Math.min(attempt * 1000, 5000) : 30_000,
            },
          });
        }
        const current = client;
        await current.realtime.setAuth(next.token);
        if (!active || current !== client) return;
        if (!channel) {
          channel = current
            .channel(next.topic, { config: { private: true } })
            .on('broadcast', { event: 'changed' }, () => {
              if (active) changed();
            })
            .subscribe((status) => {
              if (!active || current !== client) return;
              if (status === 'SUBSCRIBED') {
                failures = 0;
                connectionChanged({ status: 'connected', leaseId: credential?.leaseId ?? null });
                changed();
              } else if (
                status === 'CHANNEL_ERROR' ||
                status === 'TIMED_OUT' ||
                status === 'CLOSED'
              )
                retry();
            });
        }
        schedule(Math.max(500, remaining - 30_000));
      } catch {
        if (!active) return;
        // Close cached native authorization immediately when renewal cannot be proven.
        retry();
      } finally {
        pending = null;
      }
    })();
    return pending;
  };
  const focus = () => {
    failures = 0;
    void refresh();
  };
  window.addEventListener('focus', focus);
  const visibility = () => {
    if (document.visibilityState === 'visible') focus();
  };
  document.addEventListener('visibilitychange', visibility);
  void refresh();

  return () => {
    active = false;
    controller.abort();
    if (timer) clearTimeout(timer);
    window.removeEventListener('focus', focus);
    document.removeEventListener('visibilitychange', visibility);
    disconnect();
    if (credential)
      void fetch('/api/realtime/credential', {
        method: 'DELETE',
        credentials: 'include',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedUserId: owner.userId,
          expectedSessionId: owner.sessionId,
          leaseId: credential.leaseId,
        }),
      }).catch(() => {});
    credential = null;
  };
}
