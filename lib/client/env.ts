import { configuredUrl } from '@/lib/configuration';

export function publicRealtimeConfiguration(settings: { url?: string; key?: string }) {
  if (!settings.url && !settings.key) return null;
  const url = configuredUrl(settings.url, 'NEXT_PUBLIC_SUPABASE_URL');
  const key = settings.key;
  if (!key || !(key.startsWith('sb_publishable_') || key.startsWith('eyJ')))
    throw new Error('Supabase Realtime requires a public API key.');
  return { url, key };
}

export function browserRealtimeConfiguration() {
  return publicRealtimeConfiguration({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
