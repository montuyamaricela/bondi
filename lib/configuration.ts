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

export function configuredPort(value: string | undefined, setting: string, fallback: number) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535)
    throw new Error(`${setting} must be an integer port from 1 to 65535.`);
  return Number(value);
}
