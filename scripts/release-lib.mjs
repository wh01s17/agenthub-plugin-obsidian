// Pure helpers for the adapter bump and the one-click release (plan §8.4, ADR-041).
// The CLIs in scripts/ read and write the files; everything here is text in, text out.

const PIN = /'((?:@[\w.-]+\/)?[\w.-]+)@(\d+\.\d+\.\d+)'/g;

/**
 * Adapter versions pinned in the agent presets of `src/settings/settings.ts`.
 * @param {string} source
 * @returns {{ pkg: string, version: string, label: string }[]}
 */
export function findPins(source) {
  return [...source.matchAll(PIN)].map((match) => {
    const before = source.slice(0, match.index);
    const labels = [...before.matchAll(/label: '([^']+)'/g)];
    return {
      pkg: match[1] ?? '',
      version: match[2] ?? '',
      label: labels.at(-1)?.[1] ?? match[1] ?? '',
    };
  });
}

/**
 * `X.Y.Z` comparison; prereleases are never "newer" (the bump only follows stable versions).
 * @param {string} candidate
 * @param {string} current
 */
export function isNewer(candidate, current) {
  if (!/^\d+\.\d+\.\d+$/.test(candidate)) return false;
  const a = candidate.split('.').map(Number);
  const b = current.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}

/**
 * @param {string} source
 * @param {string} pkg
 * @param {string} from
 * @param {string} to
 */
export function replacePin(source, pkg, from, to) {
  return source.replaceAll(`'${pkg}@${from}'`, `'${pkg}@${to}'`);
}

/**
 * Updates the current-version tables of plan.md (§3 commands and §7 dependencies). The log and the
 * notes of past tasks keep the version they were written with.
 * @param {string} plan
 * @param {string} pkg
 * @param {string} from
 * @param {string} to
 */
export function updatePlanTables(plan, pkg, from, to) {
  return plan
    .split('\n')
    .map((line) => {
      if (line.startsWith('| ') && line.includes(`\`npx -y ${pkg}@${from}\``)) {
        return line.replace(`${pkg}@${from}`, `${pkg}@${to}`);
      }
      if (line.startsWith(`| \`${pkg}\` | ${from} |`)) {
        return line.replace(`| ${from} |`, `| ${to} |`);
      }
      return line;
    })
    .join('\n');
}

/** @param {string} changelog */
function unreleasedBounds(changelog) {
  const start = changelog.indexOf('## [Unreleased]');
  if (start < 0) throw new Error('CHANGELOG.md has no "## [Unreleased]" section.');
  const bodyStart = changelog.indexOf('\n', start) + 1;
  const next = changelog.indexOf('\n## ', bodyStart);
  return { start, bodyStart, end: next < 0 ? changelog.length : next + 1 };
}

/**
 * Adds a bullet under `### <heading>` of `[Unreleased]`. A bullet that mentions `replaceKey` is
 * replaced (a newer bump of the same adapter).
 * @param {string} changelog
 * @param {string} heading
 * @param {string} bullet
 * @param {string} [replaceKey]
 */
export function addChangelogEntry(changelog, heading, bullet, replaceKey) {
  const { bodyStart, end } = unreleasedBounds(changelog);
  let body = changelog.slice(bodyStart, end);
  if (replaceKey) {
    body = body
      .split('\n')
      .filter((line) => !(line.startsWith('- ') && line.includes(replaceKey)))
      .join('\n');
  }
  const marker = `### ${heading}\n\n`;
  const at = body.indexOf(marker);
  if (at >= 0) {
    const insert = at + marker.length;
    body = `${body.slice(0, insert)}${bullet}\n${body.slice(insert)}`;
  } else {
    body = `${body.trimEnd()}\n\n${marker}${bullet}\n\n`;
  }
  return changelog.slice(0, bodyStart) + body.replace(/^\n*/, '\n') + changelog.slice(end);
}

/**
 * @param {string} version `X.Y.Z`
 * @param {'patch' | 'minor'} kind
 */
export function nextVersion(version, kind) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) throw new Error(`Not a release version: ${version}`);
  const [major, minor, patch] = match.slice(1).map(Number);
  return kind === 'minor' ? `${major}.${(minor ?? 0) + 1}.0` : `${major}.${minor}.${(patch ?? 0) + 1}`;
}

/**
 * Turns `[Unreleased]` into `[version] - date` and leaves an empty `[Unreleased]` above it.
 * @param {string} changelog
 * @param {string} version
 * @param {string} date `YYYY-MM-DD`
 */
export function cutChangelog(changelog, version, date) {
  const { start, bodyStart, end } = unreleasedBounds(changelog);
  const body = changelog.slice(bodyStart, end).trim();
  if (!body) throw new Error('CHANGELOG.md: [Unreleased] is empty; nothing to release.');
  return `${changelog.slice(0, start)}## [Unreleased]\n\n## [${version}] - ${date}\n\n${body}\n\n${changelog.slice(end)}`;
}

/**
 * The body of the `[version]` section, used as the GitHub release notes.
 * @param {string} changelog
 * @param {string} version
 */
export function releaseNotes(changelog, version) {
  const heading = `## [${version}]`;
  const start = changelog.indexOf(heading);
  if (start < 0) throw new Error(`CHANGELOG.md has no ${heading} section.`);
  const bodyStart = changelog.indexOf('\n', start) + 1;
  const next = changelog.indexOf('\n## ', bodyStart);
  return changelog.slice(bodyStart, next < 0 ? undefined : next).trim() + '\n';
}
