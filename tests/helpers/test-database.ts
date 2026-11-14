type Environment = Readonly<Record<string, string | undefined>>;
type Target =
  | { native: false; url: string }
  | { native: true; url: string; project: string; marker: string; apiUrl: string };

function databaseUrl(value: string | undefined) {
  try {
    const url = new URL(value ?? '');
    if (
      !['postgresql:', 'postgres:'].includes(url.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      url.hash
    )
      throw new Error();
    return url;
  } catch {
    throw new Error('Tests require an explicitly configured loopback PostgreSQL target.');
  }
}

export function assertTestDatabase(environment: Environment = process.env): Target {
  const url = databaseUrl(environment.DATABASE_URL);
  if (environment.DIRECT_URL !== undefined) {
    const direct = databaseUrl(environment.DIRECT_URL);
    if (
      direct.hostname !== url.hostname ||
      (direct.port || '5432') !== (url.port || '5432') ||
      direct.pathname !== url.pathname
    )
      throw new Error('Test runtime and migration connections must identify the same database.');
  }
  const native = [
    'BONDI_TEST_PROJECT',
    'BONDI_TEST_CONFIRM',
    'BONDI_TEST_MARKER',
    'SUPABASE_TEST_URL',
  ].some((key) => environment[key] !== undefined);
  if (!native) {
    if (!/(?:^|[_-])(?:test|e2e|harness)(?:[_-]|$)/i.test(url.pathname.slice(1)))
      throw new Error('Ordinary PostgreSQL tests require a test, e2e or harness database name.');
    return { native: false, url: environment.DATABASE_URL! };
  }
  if (
    environment.BONDI_TEST_PROJECT !== 'bondi-integration' ||
    environment.BONDI_TEST_CONFIRM !== 'bondi-integration/postgres' ||
    !/^[a-f0-9]{64}$/.test(environment.BONDI_TEST_MARKER ?? '') ||
    environment.SUPABASE_TEST_URL !== 'http://127.0.0.1:54321' ||
    url.hostname !== '127.0.0.1' ||
    url.port !== '54322' ||
    url.pathname !== '/postgres'
  )
    throw new Error(
      'Native tests require the prepared bondi-integration stack and matching marker.',
    );
  return {
    native: true,
    url: environment.DATABASE_URL!,
    project: environment.BONDI_TEST_PROJECT,
    marker: environment.BONDI_TEST_MARKER!,
    apiUrl: environment.SUPABASE_TEST_URL,
  };
}

export function assertNativeMarker(
  target: Extract<Target, { native: true }>,
  record: { project: string; nonce: string; database: string } | undefined,
) {
  if (
    !record ||
    record.project !== target.project ||
    record.nonce !== target.marker ||
    record.database !== 'postgres'
  )
    throw new Error('The native test database marker does not match this prepared environment.');
}
