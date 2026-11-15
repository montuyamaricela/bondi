import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const retired =
  /socket\.io(?:-client)?|engine\.io|@socket\.io\/|socket-provider|socket-instance|lib\/socket|NEXT_PUBLIC_SOCKET_URL|SOCKET_PORT|NEXT_PUBLIC_SUPABASE_REALTIME|excludedSocketId/;
const failures = [];
function files(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}
const sources = [
  ...files('app'),
  ...files('lib'),
  ...files('prisma/schema'),
  'package.json',
  '.env.example',
  '.env.test.example',
  'playwright.config.ts',
  'scripts/pre-commit-e2e.mjs',
  'scripts/prepare-supabase-test.ts',
].filter((path) => /\.(?:[cm]?[jt]sx?|json|prisma|example)$/.test(path));
for (const path of sources) {
  if (!existsSync(path)) continue;
  readFileSync(path, 'utf8')
    .split('\n')
    .forEach((line, index) => {
      if (retired.test(line)) failures.push(`Retired transport reference: ${path}:${index + 1}`);
    });
}
for (const path of [
  'server.ts',
  'socket-server.ts',
  'lib/socket.ts',
  'tsconfig.server.json',
  'app/api/socket/token/route.ts',
])
  if (existsSync(path)) failures.push(`Retired entry point remains: ${path}`);
const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
if (
  !/^next dev(?:\s|$)/.test(manifest.scripts?.dev ?? '') ||
  !/^next start(?:\s|$)/.test(manifest.scripts?.start ?? '')
)
  failures.push('The application must use standard Next dev/start.');
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
for (const path of Object.keys(lock.packages ?? {})) {
  const name = path.split('node_modules/').at(-1);
  if (/^(?:socket\.io(?:-|$)|engine\.io(?:-|$)|@socket\.io\/)/.test(name))
    failures.push(`Retired dependency remains: ${name}`);
}
const bundles = [...files('.next/static'), ...files('.next/server')].filter((path) =>
  path.endsWith('.js'),
);
if (!bundles.length) failures.push('A fresh production build is required for bundle verification.');
for (const path of bundles)
  if (retired.test(readFileSync(path, 'utf8')))
    failures.push(`Retired transport in built artifact: ${path}`);
if (failures.length) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
console.log(
  `Realtime retirement verified: ${sources.length} source/config files, dependency lock and ${bundles.length} built artifacts.`,
);
