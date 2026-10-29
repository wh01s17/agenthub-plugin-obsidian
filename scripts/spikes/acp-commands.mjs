// T11.1: lista los slash commands que un agente ACP anuncia (`available_commands_update`) sin enviar prompts.
//
// Uso: node scripts/spikes/acp-commands.mjs <comando> [args...]
//   p. ej. node scripts/spikes/acp-commands.mjs opencode acp
//
// Hace `initialize` + `session/new` sobre una copia temporal de test-vault/ y espera WAIT_MS (8 s por defecto).
// Salida JSON por stdout: { commands: [{name, description, hint}], errors }.
import { spawn } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('uso: acp-commands.mjs <comando> [args...]');
  process.exit(2);
}
const WAIT_MS = Number(process.env.WAIT_MS ?? 8_000);

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const vault = mkdtempSync(join(tmpdir(), 'agenthub-t11-'));
cpSync(join(root, 'test-vault'), vault, { recursive: true, filter: (src) => !src.includes('.obsidian') });

const child = spawn(command, args, { cwd: vault, stdio: ['pipe', 'pipe', 'pipe'] });
const pending = new Map();
let nextId = 1;
let commands = [];
const errors = [];

const send = (msg) => child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...msg })}\n`);
const request = (method, params) =>
  new Promise((ok, fail) => {
    const id = nextId++;
    pending.set(id, { ok, fail });
    send({ id, method, params });
  });

let buffer = '';
child.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
  let index;
  while ((index = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (msg.id !== undefined && pending.has(msg.id) && !msg.method) {
      const { ok, fail } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) fail(new Error(JSON.stringify(msg.error)));
      else ok(msg.result);
    } else if (msg.method && msg.id !== undefined) {
      // Peticiones del agente: no se ejecuta nada.
      send({ id: msg.id, error: { code: -32601, message: 'not supported in probe' } });
    } else if (msg.method === 'session/update') {
      const update = msg.params?.update;
      if (update?.sessionUpdate === 'available_commands_update') {
        commands = (update.availableCommands ?? []).map((c) => ({
          name: c.name,
          description: c.description,
          hint: c.input?.hint,
        }));
      }
    }
  }
});

const finish = (code) => {
  child.kill();
  rmSync(vault, { recursive: true, force: true });
  console.log(JSON.stringify({ commands, errors }, null, 2));
  process.exit(code);
};

try {
  await request('initialize', {
    protocolVersion: 1,
    clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
    clientInfo: { name: 'agenthub-probe', version: '0' },
  });
  await request('session/new', { cwd: vault, mcpServers: [] });
} catch (error) {
  errors.push(String(error));
}
setTimeout(() => finish(0), WAIT_MS);
