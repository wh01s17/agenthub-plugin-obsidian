// Moves the ACP adapters pinned in the agent presets to their latest stable npm version (ADR-041).
// Run by .github/workflows/bump-adapters.yml. Writes `changed` and `title` to $GITHUB_OUTPUT and the
// pull request body to the path given as the first argument.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import {
  addChangelogEntry,
  findPins,
  isNewer,
  replacePin,
  updatePlanTables,
} from './release-lib.mjs';

const SETTINGS = 'src/settings/settings.ts';
const bodyPath = process.argv[2] ?? 'bump-body.md';

/** @param {string} pkg */
async function latest(pkg) {
  const response = await fetch(`https://registry.npmjs.org/${pkg.replace('/', '%2F')}/latest`);
  if (!response.ok) throw new Error(`npm registry: ${pkg} → HTTP ${response.status}`);
  const data = /** @type {{ version?: unknown }} */ (await response.json());
  return typeof data.version === 'string' ? data.version : '';
}

let settings = readFileSync(SETTINGS, 'utf8');
let plan = readFileSync('plan.md', 'utf8');
let changelog = readFileSync('CHANGELOG.md', 'utf8');
const bumps = [];

for (const pin of findPins(settings)) {
  const version = await latest(pin.pkg);
  if (!isNewer(version, pin.version)) {
    console.log(`${pin.pkg}: ${pin.version} is current (latest ${version || '?'})`);
    continue;
  }
  console.log(`${pin.pkg}: ${pin.version} → ${version}`);
  settings = replacePin(settings, pin.pkg, pin.version, version);
  plan = updatePlanTables(plan, pin.pkg, pin.version, version);
  changelog = addChangelogEntry(
    changelog,
    'Changed',
    `- ${pin.label} adapter (\`${pin.pkg}\`) updated to ${version}.`,
    `\`${pin.pkg}\``,
  );
  bumps.push({ ...pin, to: version });
}

const output = process.env.GITHUB_OUTPUT;
if (bumps.length === 0) {
  if (output) appendFileSync(output, 'changed=false\n');
  process.exit(0);
}

writeFileSync(SETTINGS, settings);
writeFileSync('plan.md', plan);
writeFileSync('CHANGELOG.md', changelog);

const title = `chore(deps): bump ${bumps.map((b) => `${b.pkg.split('/').at(-1)} to ${b.to}`).join(', ')} [T13.2]`;
const rows = bumps.map(
  (b) =>
    `| ${b.label} | \`${b.pkg}\` | ${b.version} | [${b.to}](https://www.npmjs.com/package/${b.pkg}/v/${b.to}) |`,
);
writeFileSync(
  bodyPath,
  [
    'New stable versions of the pinned ACP adapters.',
    '',
    '| Agent | Package | From | To |',
    '|---|---|---|---|',
    ...rows,
    '',
    'Lint, unit tests and build passed in the workflow. The unit tests replay recorded sessions of the',
    'previous adapters, so they do not exercise the new ones: before releasing, run',
    '`AGENTHUB_E2E=1 pnpm test tests/e2e` locally (uses your logins).',
    '',
    'Add the **`release`** label to publish a PATCH release (`release:minor` for a MINOR one): the',
    'workflow bumps the version, publishes the release with the CHANGELOG notes and merges this PR.',
  ].join('\n') + '\n',
);
if (output) appendFileSync(output, `changed=true\ntitle=${title}\n`);
