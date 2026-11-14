import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const action = process.argv[2];
if (
  !['start', 'stop'].includes(action) ||
  process.argv.length !== 3 ||
  !/^project_id\s*=\s*"bondi-integration"\s*$/m.test(readFileSync('supabase/config.toml', 'utf8'))
) {
  console.error('Use start/stop only for the committed bondi-integration local stack.');
  process.exit(1);
}
const expected = JSON.parse(readFileSync('package.json', 'utf8')).devDependencies.supabase;
const version = spawnSync('npx', ['--no-install', 'supabase', '--version'], { encoding: 'utf8' });
if (version.status !== 0 || version.stdout.trim() !== expected) {
  console.error('The installed Supabase CLI must match the exact package.json pin. Run npm ci.');
  process.exit(1);
}
const args =
  action === 'start'
    ? [
        'start',
        '--exclude',
        'storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor',
      ]
    : ['stop', '--project-id', 'bondi-integration'];
console.log(`${action === 'start' ? 'Starting' : 'Stopping'} the owned bondi-integration stack.`);
// CLI success output includes credentials. Keep it out of application/CI logs.
const result = spawnSync('npx', ['--no-install', 'supabase', ...args], {
  encoding: 'utf8',
  timeout: 600_000,
  maxBuffer: 16 * 1024 * 1024,
});
if (result.status !== 0) {
  console.error(
    `Local Supabase ${action} failed. Check Docker availability, disk space and container health; credential output is omitted.`,
  );
  process.exit(1);
}
console.log(`Owned local Supabase ${action} completed.`);
