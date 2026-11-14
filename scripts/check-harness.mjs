import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, readlinkSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';

const failures = [];
const require = (condition, message) => {
  if (!condition) failures.push(message);
};
const skillRoot = '.agents/skills';
const skills = readdirSync(skillRoot, { withFileTypes: true }).filter((entry) =>
  entry.isDirectory(),
);
require(skills.length > 0, 'No repository skills found');

for (const { name } of skills) {
  const path = `${skillRoot}/${name}/SKILL.md`;
  require(existsSync(path), `Missing ${path}`);
  if (!existsSync(path)) continue;
  const source = readFileSync(path, 'utf8');
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  require(Boolean(frontmatter), `Missing frontmatter: ${path}`);
  require(new RegExp(`^name: ["']?${name}["']?\\s*$`, 'm').test(
    frontmatter?.[1] ?? '',
  ), `Name does not match directory: ${path}`);
  require(/^description:\s*\S/m.test(frontmatter?.[1] ?? ''), `Missing description: ${path}`);
  const adapter = `.claude/skills/${name}`;
  try {
    require(readlinkSync(adapter) ===
      `../../.agents/skills/${name}`, `Noncanonical Claude link: ${adapter}`);
    require(realpathSync(adapter) ===
      realpathSync(`${skillRoot}/${name}`), `Broken Claude link: ${adapter}`);
  } catch {
    failures.push(`Missing or invalid Claude link: ${adapter}`);
  }
}

for (const entry of readdirSync('.claude/skills')) {
  require(skills.some(({ name }) => name === entry), `Orphaned Claude skill: ${entry}`);
}

const provenance = JSON.parse(readFileSync('third-party/skills-provenance.json', 'utf8'));
for (const group of provenance.groups) {
  const recorded = new Set(group.files.map(({ path }) => path));
  for (const name of group.skills) {
    const walk = (directory) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = `${directory}/${entry.name}`;
        if (entry.isDirectory()) walk(path);
        else require(recorded.has(path), `Unrecorded imported resource: ${path}`);
      }
    };
    walk(`${skillRoot}/${name}`);
  }
  require(group.files.some(
    ({ path }) => path === `third-party/${group.name}/LICENSE`,
  ), `Unrecorded license: ${group.name}`);
  for (const { path, sha256 } of group.files) {
    require(resolve(path).startsWith(
      `${process.cwd()}/`,
    ), `Provenance path escapes repository: ${path}`);
    if (!existsSync(path)) {
      failures.push(`Missing imported file: ${path}`);
      continue;
    }
    require(createHash('sha256').update(readFileSync(path)).digest('hex') ===
      sha256, `Imported snapshot changed: ${path}`);
  }
}

for (const path of [
  'AGENTS.md',
  'README.md',
  'docs/architecture.md',
  'docs/agents/clients.md',
  'docs/agents/skills.md',
  'docs/agents/context-handoff.md',
]) {
  require(existsSync(path), `Missing project entry point: ${path}`);
  if (!existsSync(path)) continue;
  const source = readFileSync(path, 'utf8');
  for (const [, target] of source.matchAll(/\]\(([^)]+)\)/g)) {
    if (/^(https?:|#)/.test(target)) continue;
    const destination = new URL(target.split('#')[0], `file://${resolve(path)}`);
    require(existsSync(destination), `Broken local reference in ${path}: ${target}`);
  }
}
require(readFileSync('CLAUDE.md', 'utf8').trim() ===
  '@AGENTS.md', 'Claude entry must import the canonical contract');
require(readFileSync('.github/copilot-instructions.md', 'utf8').includes(
  '../AGENTS.md',
), 'Copilot entry must reference the canonical contract');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(
  `Harness verified: ${skills.length} skills, imported hashes/licenses, client links, and project references.`,
);
