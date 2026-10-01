// Enlaza los artefactos del build en test-vault/.obsidian/plugins/agenthub/ y activa Hot Reload.
import { existsSync, lstatSync, mkdirSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pluginDir = join(root, 'test-vault', '.obsidian', 'plugins', 'agenthub');
mkdirSync(pluginDir, { recursive: true });

for (const file of ['main.js', 'manifest.json', 'styles.css']) {
  const target = join(pluginDir, file);
  if (existsSync(target) || isBrokenLink(target)) unlinkSync(target);
  symlinkSync(join(root, file), target);
  console.log(`enlazado ${file}`);
}

// El plugin Hot Reload (pjeby) recarga los plugins que tienen este archivo.
writeFileSync(join(pluginDir, '.hotreload'), '');
console.log(`listo: ${pluginDir}`);

function isBrokenLink(path) {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}
