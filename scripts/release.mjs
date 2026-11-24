// One-click release helpers (plan §8.4, ADR-041), run by .github/workflows/release-on-label.yml.
//   node scripts/release.mjs prepare <patch|minor>   bump package.json/manifest/versions + CHANGELOG
//   node scripts/release.mjs notes <version>         print the CHANGELOG section of <version>
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { cutChangelog, nextVersion, releaseNotes } from './release-lib.mjs';

const [command, arg] = process.argv.slice(2);
/** @param {string} path */
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
/** @param {string} path @param {unknown} data */
const writeJson = (path, data) => writeFileSync(path, JSON.stringify(data, null, 2) + '\n');

if (command === 'prepare') {
  if (arg !== 'patch' && arg !== 'minor') throw new Error('Usage: release.mjs prepare <patch|minor>');
  const pkg = readJson('package.json');
  const version = nextVersion(pkg.version, arg);
  pkg.version = version;
  writeJson('package.json', pkg);
  // Same as scripts/version-bump.mjs.
  const manifest = readJson('manifest.json');
  manifest.version = version;
  writeJson('manifest.json', manifest);
  const versions = readJson('versions.json');
  versions[version] = manifest.minAppVersion;
  writeJson('versions.json', versions);
  const date = new Date().toISOString().slice(0, 10);
  writeFileSync('CHANGELOG.md', cutChangelog(readFileSync('CHANGELOG.md', 'utf8'), version, date));
  console.log(version);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`);
} else if (command === 'notes' && arg) {
  process.stdout.write(releaseNotes(readFileSync('CHANGELOG.md', 'utf8'), arg));
} else {
  throw new Error('Usage: release.mjs prepare <patch|minor> | notes <version>');
}
