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
