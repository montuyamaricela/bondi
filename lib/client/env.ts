import { publicRealtimeConfiguration } from '@/lib/configuration';

export { publicRealtimeConfiguration };

export function browserRealtimeConfiguration() {
  return publicRealtimeConfiguration({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
