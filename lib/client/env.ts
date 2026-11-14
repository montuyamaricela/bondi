import { configuredUrl } from '@/lib/configuration';

export function publicSocketUrl(
  settings: { socketUrl?: string; appUrl?: string },
  currentOrigin: string,
) {
  if (settings.socketUrl !== undefined)
    return configuredUrl(settings.socketUrl, 'NEXT_PUBLIC_SOCKET_URL');
  if (settings.appUrl !== undefined) return configuredUrl(settings.appUrl, 'NEXT_PUBLIC_APP_URL');
  return configuredUrl(currentOrigin, 'Application origin');
}

export function browserSocketUrl() {
  return publicSocketUrl(
    {
      socketUrl: process.env.NEXT_PUBLIC_SOCKET_URL,
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
    },
    window.location.origin,
  );
}

export function browserRealtimeConfiguration() {
  if (process.env.NEXT_PUBLIC_SUPABASE_REALTIME !== 'true') return null;
  const url = configuredUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL');
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key || !(key.startsWith('sb_publishable_') || key.startsWith('eyJ')))
    throw new Error('Supabase Realtime requires a public API key.');
  return { url, key };
}
