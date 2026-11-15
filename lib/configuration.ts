export function configuredUrl(value: string | undefined, setting: string, database = false) {
  const message = `${setting} must be a valid ${database ? 'PostgreSQL URL with a database name' : 'HTTP(S) origin'}.`;
  if (!value || value !== value.trim()) throw new Error(message);
  try {
    const url = new URL(value);
    if (database) {
      if (
        !['postgres:', 'postgresql:'].includes(url.protocol) ||
        !url.hostname ||
        url.pathname.length < 2 ||
        url.hash
      )
        throw new Error(message);
      return value;
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      throw new Error(message);
    return url.origin;
  } catch {
    // URL parser errors can include the supplied value, including a password.
    throw new Error(message);
  }
}

export function publicSupabaseKey(key: string | undefined): key is string {
  if (!key || key !== key.trim()) return false;
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
  const parts = key.split('.');
  if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) return false;
  try {
    const payload: unknown = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    // Classify legacy keys only; the selected project's endpoint verifies their signature.
    return (
      typeof payload === 'object' &&
      payload !== null &&
      'role' in payload &&
      payload.role === 'anon'
    );
  } catch {
    return false;
  }
}

export function publicRealtimeConfiguration(settings: { url?: string; key?: string }) {
  if (!settings.url && !settings.key) return null;
  const url = configuredUrl(settings.url, 'NEXT_PUBLIC_SUPABASE_URL');
  if (!publicSupabaseKey(settings.key))
    throw new Error('Supabase Realtime requires a public API key.');
  return { url, key: settings.key };
}
