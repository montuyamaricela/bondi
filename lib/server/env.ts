import { configuredPort, configuredUrl } from '../configuration';
import { isIP } from 'node:net';

type Environment = Readonly<Record<string, string | undefined>>;

export function isProduction(environment: Environment = process.env) {
  return environment.NODE_ENV === 'production';
}

export function runtimeDatabaseUrl(environment: Environment = process.env) {
  return configuredUrl(environment.DATABASE_URL, 'DATABASE_URL', true);
}

export function migrationDatabaseUrl(environment: Environment = process.env) {
  const setting = environment.DIRECT_URL === undefined ? 'DATABASE_URL' : 'DIRECT_URL';
  const value = configuredUrl(environment[setting], setting, true);
  const url = new URL(value);
  if (
    url.searchParams.getAll('pgbouncer').some((value) => value.toLowerCase() === 'true') ||
    url.searchParams.getAll('pool_mode').some((value) => value.toLowerCase() === 'transaction') ||
    (url.hostname.toLowerCase().endsWith('.pooler.supabase.com') && url.port === '6543')
  )
    throw new Error('DIRECT_URL must use a direct or session connection, not transaction pooling.');
  return value;
}

function applicationOrigin(environment: Environment, setting: string) {
  return configuredUrl(
    environment[setting] ?? (isProduction(environment) ? undefined : 'http://localhost:3000'),
    setting,
  );
}

export function authEnvironment(environment: Environment = process.env) {
  const secret = environment.BETTER_AUTH_SECRET;
  if (!secret || secret.trim().length < 32)
    throw new Error('BETTER_AUTH_SECRET must contain at least 32 non-padding characters.');
  return { secret, baseURL: applicationOrigin(environment, 'BETTER_AUTH_URL') };
}

export function socketEnvironment(environment: Environment = process.env) {
  if (environment.NEXT_PUBLIC_SOCKET_URL !== undefined)
    configuredUrl(environment.NEXT_PUBLIC_SOCKET_URL, 'NEXT_PUBLIC_SOCKET_URL');
  return {
    clientOrigin: applicationOrigin(environment, 'NEXT_PUBLIC_APP_URL'),
    port: configuredPort(environment.SOCKET_PORT, 'SOCKET_PORT', 3001),
  };
}

export function applicationEnvironment(environment: Environment = process.env) {
  const { clientOrigin } = socketEnvironment(environment);
  const hostname = environment.HOSTNAME ?? 'localhost';
  if (
    !isIP(hostname) &&
    (hostname.length > 253 ||
      !hostname
        .split('.')
        .every((label) => /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label)))
  )
    throw new Error('HOSTNAME must be a hostname or IP address without a scheme or path.');
  return {
    hostname,
    port: configuredPort(environment.PORT, 'PORT', 3000),
    dev: !isProduction(environment),
    clientOrigin,
  };
}

export function realtimeEnvironment(environment: Environment = process.env) {
  if (environment.NEXT_PUBLIC_SUPABASE_REALTIME !== 'true')
    throw new Error('Supabase Realtime is not explicitly enabled.');
  const url = configuredUrl(environment.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL');
  const signingKeysPath = environment.SUPABASE_SIGNING_KEYS_PATH;
  const secretKey = environment.SUPABASE_SECRET_KEY;
  if (!signingKeysPath || !secretKey)
    throw new Error('Supabase Realtime requires private signing-key and server-key configuration.');
  return { url, signingKeysPath, secretKey };
}
