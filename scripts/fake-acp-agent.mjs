#!/usr/bin/env node
// Simulated ACP agent for development and tests (plan §9). No network, no tokens.
//
// Uso: node scripts/fake-acp-agent.mjs [--scenario <nombre>] [--delay <ms>] [--no-resume]
// Escenarios (también se pueden pedir por prompt: "/scenario <nombre>"):
//   echo           responde con el texto recibido, en chunks
//   stream-long    ~20 KB de Markdown en chunks pequeños
//   tools          tool calls de lectura, terminal (estilo Codex) y diff
//   permissions    pide permiso para editar; respeta la decisión
//   plan           plan con entradas que van completándose
//   slow           escribe durante ~10 s (para probar cancelar)
//   crash          muere a mitad de turno (exit 3)
//   auth-required  session/new falla con "auth required"
// Las formas de los mensajes imitan lo grabado en tests/fixtures/acp/ (S2).
import { Readable, Writable } from 'node:stream';
import * as acp from '@agentclientprotocol/sdk';

const argv = process.argv.slice(2);
const option = (name, fallback) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : fallback;
};
const defaultScenario = option('scenario', 'echo');
const delayMs = Number(option('delay', '15'));
const resumable = !argv.includes('--no-resume');

const CONFIG_OPTIONS = () => [
  {
    id: 'mode',
    name: 'Mode',
    category: 'mode',
    type: 'select',
    currentValue: state.mode,
    options: [
      { value: 'manual', name: 'Manual', description: 'Ask before changes' },
      { value: 'auto', name: 'Auto', description: 'Never ask' },
    ],
  },
  {
    id: 'model',
    name: 'Model',
    category: 'model',
    type: 'select',
    currentValue: state.model,
    options: [
      { value: 'fake-small', name: 'Fake small' },
      { value: 'fake-large', name: 'Fake large' },
    ],
  },
];

const state = { mode: 'manual', model: 'fake-small', sessions: new Map(), counter: 0 };
const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('aborted'));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new Error('aborted'));
    });
  });
const nextId = (prefix) => `${prefix}_${++state.counter}`;

acp
  .agent({ name: 'fake-acp-agent' })
  .onRequest(acp.methods.agent.initialize, () => ({
    protocolVersion: acp.PROTOCOL_VERSION,
    agentCapabilities: {
      loadSession: false,
      sessionCapabilities: resumable ? { resume: {} } : {},
      promptCapabilities: { image: false, embeddedContext: true },
      mcpCapabilities: { http: false, sse: false },
    },
    authMethods:
      defaultScenario === 'auth-required'
        ? [{ id: 'fake-login', name: 'Fake login', description: 'Run `fake login`' }]
        : [],
    agentInfo: { name: 'fake-acp-agent', title: 'Fake agent', version: '0.0.0' },
  }))
  .onRequest(acp.methods.agent.session.new, () => {
    if (defaultScenario === 'auth-required') throw acp.RequestError.authRequired();
    const sessionId = nextId('sess');
    state.sessions.set(sessionId, { abort: null });
    return { sessionId, configOptions: CONFIG_OPTIONS() };
  })
  .onRequest(acp.methods.agent.session.resume, (ctx) => {
    // A fresh process: pretend the conversation continues under the same id.
    state.sessions.set(ctx.params.sessionId, { abort: null });
    return { configOptions: CONFIG_OPTIONS() };
  })
  .onRequest(acp.methods.agent.session.setConfigOption, (ctx) => {
    const { configId, value } = ctx.params;
    if (configId === 'mode') state.mode = String(value);
    if (configId === 'model') state.model = String(value);
    return { configOptions: CONFIG_OPTIONS() };
  })
  .onNotification(acp.methods.agent.session.cancel, (ctx) => {
    state.sessions.get(ctx.params.sessionId)?.abort?.abort();
  })
  .onRequest(acp.methods.agent.session.prompt, async (ctx) => {
    const session = state.sessions.get(ctx.params.sessionId);
    if (!session) throw acp.RequestError.resourceNotFound(ctx.params.sessionId);
    session.abort = new AbortController();
    const signal = session.abort.signal;
    const text = ctx.params.prompt
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
    const scenario = /^\/scenario (\S+)/.exec(text)?.[1] ?? defaultScenario;
    const update = (u) =>
      ctx.client.notify(acp.methods.client.session.update, {
        sessionId: ctx.params.sessionId,
        update: u,
      });
    try {
      await runScenario(scenario, { text, update, signal, ctx });
      await update({ sessionUpdate: 'usage_update', used: 1234, size: 200000 });
      return { stopReason: 'end_turn' };
    } catch (error) {
      if (signal.aborted) return { stopReason: 'cancelled' };
      throw error;
    } finally {
      session.abort = null;
    }
  })
  .connect(acp.ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin)));

async function say(update, signal, text, size = 12) {
  const messageId = nextId('msg');
  for (let i = 0; i < text.length; i += size) {
    await update({
      sessionUpdate: 'agent_message_chunk',
      messageId,
      content: { type: 'text', text: text.slice(i, i + size) },
    });
    await sleep(delayMs, signal);
  }
}

async function runScenario(name, { text, update, signal, ctx }) {
  switch (name) {
    case 'echo':
      return say(update, signal, `Recibido: ${text}`);
    case 'stream-long': {
      const paragraph =
        '## Sección\n\nTexto de **prueba** con `código`, [[Notas/Ideas]] y una lista:\n\n- uno\n- dos\n\n';
      return say(update, signal, paragraph.repeat(200), 400);
    }
    case 'tools': {
      await say(update, signal, 'Voy a revisar archivos.');
      const read = nextId('call');
      await update({
        sessionUpdate: 'tool_call',
        toolCallId: read,
        title: 'Read Notas/Ideas.md',
        kind: 'read',
        status: 'in_progress',
        locations: [{ path: 'Notas/Ideas.md', line: 1 }],
        rawInput: { file_path: 'Notas/Ideas.md' },
      });
      await sleep(delayMs, signal);
      await update({
        sessionUpdate: 'tool_call_update',
        toolCallId: read,
        status: 'completed',
        content: [{ type: 'content', content: { type: 'text', text: '# Ideas\n\n1. Resumir' } }],
      });
      const exec = nextId('exec');
      await update({
        sessionUpdate: 'tool_call',
        toolCallId: exec,
        title: 'ls Notas',
        kind: 'execute',
        status: 'in_progress',
        content: [{ type: 'terminal', terminalId: exec }],
        rawInput: { command: 'ls Notas' },
      });
      await update({
        sessionUpdate: 'tool_call_update',
        toolCallId: exec,
        status: 'completed',
        _meta: {
          terminal_output_delta: { data: 'Ideas.md\nProyecto Alfa.md\n', terminal_id: exec },
          terminal_exit: { exit_code: 0, signal: null, terminal_id: exec },
        },
      });
      await update({
        sessionUpdate: 'tool_call',
        toolCallId: nextId('edit'),
        title: 'Editing files',
        kind: 'edit',
        status: 'completed',
        content: [{ type: 'diff', path: 'resumen.md', oldText: null, newText: 'Resumen.\n' }],
      });
      return say(update, signal, 'Listo.');
    }
    case 'permissions': {
      const toolCallId = nextId('call');
      const toolCall = {
        toolCallId,
        title: 'Write resumen.md',
        kind: 'edit',
        status: 'pending',
        locations: [{ path: 'resumen.md' }],
        rawInput: { file_path: 'resumen.md', content: 'Resumen.\n' },
      };
      await update({ sessionUpdate: 'tool_call', ...toolCall });
      const response = await ctx.client.request(acp.methods.client.session.requestPermission, {
        sessionId: ctx.params.sessionId,
        toolCall,
        options: [
          { optionId: 'allow', name: 'Allow', kind: 'allow_once' },
          { optionId: 'always', name: 'Always allow', kind: 'allow_always' },
          { optionId: 'reject', name: 'Reject', kind: 'reject_once' },
        ],
      });
      const outcome = response.outcome;
      const allowed = outcome.outcome === 'selected' && outcome.optionId !== 'reject';
      await update({
        sessionUpdate: 'tool_call_update',
        toolCallId,
        status: allowed ? 'completed' : 'failed',
      });
      return say(update, signal, allowed ? 'Archivo escrito.' : 'Permiso denegado.');
    }
    case 'plan': {
      const entries = ['Leer notas', 'Agrupar ideas', 'Escribir resumen'].map((content) => ({
        content,
        status: 'pending',
        priority: 'medium',
      }));
      for (let i = 0; i <= entries.length; i++) {
        await update({
          sessionUpdate: 'plan',
          entries: entries.map((entry, j) => ({
            ...entry,
            status: j < i ? 'completed' : j === i ? 'in_progress' : 'pending',
          })),
        });
        await sleep(delayMs * 3, signal);
      }
      return say(update, signal, 'Plan completado.');
    }
    case 'slow':
      for (let i = 1; i <= 100; i++) {
        await say(update, signal, `línea ${i}\n`, 100);
        await sleep(100, signal);
      }
      return;
    case 'crash':
      await say(update, signal, 'Empiezo y…');
      process.stderr.write('fake-acp-agent: simulated crash\n');
      process.exit(3);
      return;
    default:
      return say(update, signal, `Escenario desconocido: ${name}`);
  }
}
