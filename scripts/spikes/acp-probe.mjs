// Spike S2: habla ACP con un agente real y graba todo el tráfico JSON-RPC como fixture.
//
// Uso: node scripts/spikes/acp-probe.mjs <nombre> <comando> [args...]
//   p. ej. node scripts/spikes/acp-probe.mjs gemini gemini --acp
//
// Trabaja sobre una copia temporal de test-vault/ (el agente puede escribir en ella).
// Los permisos se aprueban automáticamente con la primera opción `allow_once`.
// Salida: tests/fixtures/acp/<nombre>/basic.jsonl (rutas personales y emails anonimizados).
import { spawn } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import * as acp from '@agentclientprotocol/sdk';

const [name, command, ...args] = process.argv.slice(2);
if (!name || !command) {
  console.error('uso: acp-probe.mjs <nombre> <comando> [args...]');
  process.exit(2);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const vault = mkdtempSync(join(tmpdir(), 'agenthub-s2-'));
cpSync(join(root, 'test-vault'), vault, {
  recursive: true,
  filter: (src) => !src.includes('.obsidian'),
});

const PROMPT =
  'Lee el archivo Notas/Ideas.md y crea un archivo nuevo llamado resumen.md en la raíz ' +
  'con un resumen de una sola línea de esa nota. Responde en una frase al terminar.';
const TIMEOUT_MS = Number(process.env.PROBE_TIMEOUT_MS ?? 240_000);

const records = [];
const started = Date.now();
const record = (dir, payload) => records.push({ t: Date.now() - started, dir, msg: payload });

const child = spawn(command, args, {
  cwd: vault,
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
});
const stderr = [];
child.stderr.on('data', (chunk) => stderr.push(chunk.toString()));

// Tee de ambos sentidos para grabar el JSON-RPC crudo.
const tap = (dir) => {
  let buffer = '';
  return (chunk) => {
    buffer += chunk.toString();
    let index;
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!line) continue;
      try {
        record(dir, JSON.parse(line));
      } catch {
        record(dir, { nonJsonLine: line });
      }
    }
  };
};
child.stdout.on('data', tap('agent→client'));
const tapOut = tap('client→agent');
const input = new WritableStream({
  write(chunk) {
    tapOut(Buffer.from(chunk));
    return new Promise((ok, fail) => child.stdin.write(chunk, (e) => (e ? fail(e) : ok())));
  },
});
const output = Readable.toWeb(child.stdout);

const summary = {
  agent: name,
  command: [command, ...args].join(' '),
  fsCalls: [],
  permissions: [],
};
const insideVault = (p) => resolve(p).startsWith(vault);

const timer = setTimeout(() => {
  summary.error = `timeout tras ${TIMEOUT_MS} ms`;
  finish(1);
}, TIMEOUT_MS);

try {
  const result = await acp
    .client({ name: 'agenthub-spike' })
    .onRequest(acp.methods.client.session.requestPermission, (ctx) => {
      const { toolCall, options } = ctx.params;
      const choice = options.find((o) => o.kind === 'allow_once') ?? options[0];
      summary.permissions.push({
        title: toolCall.title,
        kinds: options.map((o) => o.kind),
        chose: choice.kind,
      });
      return { outcome: { outcome: 'selected', optionId: choice.optionId } };
    })
    .onRequest(acp.methods.client.fs.readTextFile, (ctx) => {
      summary.fsCalls.push({ method: 'read', path: ctx.params.path });
      if (!insideVault(ctx.params.path)) throw new Error('fuera del vault');
      return { content: readFileSync(ctx.params.path, 'utf8') };
    })
    .onRequest(acp.methods.client.fs.writeTextFile, (ctx) => {
      summary.fsCalls.push({ method: 'write', path: ctx.params.path });
      if (!insideVault(ctx.params.path)) throw new Error('fuera del vault');
      writeFileSync(ctx.params.path, ctx.params.content);
      return {};
    })
    .connectWith(acp.ndJsonStream(input, output), async (ctx) => {
      const init = await ctx.request(acp.methods.agent.initialize, {
        protocolVersion: acp.PROTOCOL_VERSION,
        clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: false },
        clientInfo: { name: 'agenthub-spike', version: '0.0.0' },
      });
      summary.protocolVersion = init.protocolVersion;
      summary.agentCapabilities = init.agentCapabilities;
      summary.authMethods = init.authMethods;
      summary.agentInfo = init.agentInfo;

      return ctx.buildSession(vault).withSession(async (session) => {
        summary.newSession = {
          modes: session.modes,
          keys: Object.keys(session.newSessionResponse),
        };
        const updates = {};
        void session.prompt(PROMPT);
        for (;;) {
          const message = await session.nextUpdate();
          if (message.kind === 'stop') {
            summary.updateCounts = updates;
            return message.response;
          }
          const kind = message.update.sessionUpdate;
          updates[kind] = (updates[kind] ?? 0) + 1;
        }
      });
    });
  summary.stopReason = result.stopReason;
  try {
    summary.resumenMd = readFileSync(join(vault, 'resumen.md'), 'utf8').trim();
  } catch {
    summary.resumenMd = null;
  }
  finish(0);
} catch (error) {
  summary.error = String(error?.message ?? error);
  finish(1);
}

function finish(code) {
  clearTimeout(timer);
  child.kill('SIGTERM');
  summary.durationMs = Date.now() - started;
  summary.stderrTail = stderr.join('').split('\n').slice(-15).join('\n');

  const scrub = (text) =>
    text
      .replaceAll(vault, '/VAULT')
      .replaceAll(homedir(), '~')
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<email>');

  const outDir = join(root, 'tests', 'fixtures', 'acp', name);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, 'basic.jsonl'),
    scrub(records.map((r) => JSON.stringify(r)).join('\n') + '\n'),
  );
  writeFileSync(join(outDir, 'summary.json'), scrub(JSON.stringify(summary, null, 2)) + '\n');
  console.log(scrub(JSON.stringify(summary, null, 2)));
  rmSync(vault, { recursive: true, force: true });
  setTimeout(() => process.exit(code), 200);
}
