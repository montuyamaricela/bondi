const fallback = '/discover';
const callbackOrigin = 'https://bondi.internal';

function hasUnsafeCharacters(value: string) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code === 0x5c || code < 32 || code === 127;
  });
}

export function safeCallbackUrl(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length > 2048 ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value !== value.trim() ||
    hasUnsafeCharacters(value)
  )
    return fallback;
  try {
    const url = new URL(value, callbackOrigin);
    const path = decodeURIComponent(url.pathname);
    if (
      url.origin !== callbackOrigin ||
      path.startsWith('//') ||
      hasUnsafeCharacters(path) ||
      /%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(path)
    )
      return fallback;
    if (
      ['/api', '/login', '/signup', '/profile/setup'].some(
        (prefix) => path === prefix || path.startsWith(`${prefix}/`),
      )
    )
      return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function profileSetupDestination(callbackUrl: unknown): string {
  const destination = safeCallbackUrl(callbackUrl);
  return destination === fallback
    ? '/profile/setup'
    : `/profile/setup?${new URLSearchParams({ callbackUrl: destination })}`;
}
