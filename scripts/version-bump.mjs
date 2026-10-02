// After editing package.json, run with npm_package_version=X.Y.Z (plan §8.4).
import { readFileSync, writeFileSync } from 'node:fs';

const targetVersion = process.env.npm_package_version;
if (!targetVersion)
  throw new Error('Ejecutar con npm_package_version=X.Y.Z node scripts/version-bump.mjs.');

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
manifest.version = targetVersion;
writeFileSync('manifest.json', JSON.stringify(manifest, null, 2) + '\n');

const versions = JSON.parse(readFileSync('versions.json', 'utf8'));
versions[targetVersion] = manifest.minAppVersion;
writeFileSync('versions.json', JSON.stringify(versions, null, 2) + '\n');
