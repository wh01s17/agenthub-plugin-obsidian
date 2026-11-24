// Types for the tests (scripts are plain ESM run by Node).
export interface Pin {
  pkg: string;
  version: string;
  label: string;
}
export function findPins(source: string): Pin[];
export function isNewer(candidate: string, current: string): boolean;
export function replacePin(source: string, pkg: string, from: string, to: string): string;
export function updatePlanTables(plan: string, pkg: string, from: string, to: string): string;
export function addChangelogEntry(
  changelog: string,
  heading: string,
  bullet: string,
  replaceKey?: string,
): string;
export function nextVersion(version: string, kind: 'patch' | 'minor'): string;
export function cutChangelog(changelog: string, version: string, date: string): string;
export function releaseNotes(changelog: string, version: string): string;
