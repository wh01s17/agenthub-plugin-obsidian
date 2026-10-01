// One live ACP session = one agent process (ADR-005). Implements `AgentSession` (plan §5.1).

import * as acp from '@agentclientprotocol/sdk';
import { Readable, Writable } from 'node:stream';
import type {
  AgentCapabilities,
  AgentSession,
  Disposable,
  HostBridge,
} from '../../core/AgentAdapter';
import { AgentError } from '../../core/errors';
import type { AgentEvent, PromptBlock, StopReason } from '../../core/types';
import type { ManagedProcess } from '../../process/ProcessRunner';
import { AcpUpdateMapper, mapConfigOptions, mapPermissionRequest } from './mapping';
import { toContentBlocks } from './promptBlocks';

/** JSON-RPC error code ACP uses for "authentication required". */
const AUTH_REQUIRED_CODE = -32000;
const STARTUP_TIMEOUT_MS = 30_000;
const CANCEL_GRACE_MS = 5_000;

export interface AcpSessionInit {
  process: ManagedProcess;
  host: HostBridge;
  cwd: string;
  /** Config values to apply after `session/new`, keyed by config option id. */
  config?: Record<string, string>;
  /** Prepended to the first prompt (plan §4.8). */
  systemPromptAppend?: string;
  /** Shown when the agent asks for authentication, e.g. "Run `codex login`". */
  loginHint?: string;
}

type Connection = ReturnType<ReturnType<typeof acp.client>['connect']>;

export class AcpSession implements AgentSession {
  private readonly listeners = new Set<(event: AgentEvent) => void>();
  private readonly mapper = new AcpUpdateMapper();
  private readonly pendingPermissions = new Map<string, (cancelled: true) => void>();
  private connection!: Connection;
  private sessionId: string | undefined;
  private caps: AgentCapabilities = {
    streaming: true,
    interactivePermissions: true,
    loadSession: false,
    embeddedContext: false,
    images: false,
    configOptions: false,
    slashCommands: true,
    usage: true,
  };
  private firstPrompt = true;
  private permissionCounter = 0;
  private disposed = false;
  private turnActive = false;
  private crashReported = false;
  /** Kills an agent that ignores `session/cancel`; cleared when the turn ends. */
  private cancelTimer: ReturnType<typeof setTimeout> | undefined;

  private constructor(private readonly init: AcpSessionInit) {}

  /** Spawned process → initialized ACP session, or an `AgentError`. The process is killed on failure. */
  static async start(init: AcpSessionInit): Promise<AcpSession> {
    const session = new AcpSession(init);
    try {
      await session.handshake();
      return session;
    } catch (error) {
      await init.process.kill();
      throw session.explain(error);
    }
  }

  get nativeSessionId(): string | undefined {
    return this.sessionId;
  }

  get capabilities(): AgentCapabilities {
    return this.caps;
  }

  onEvent(listener: (event: AgentEvent) => void): Disposable {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  }

  async prompt(blocks: PromptBlock[]): Promise<StopReason> {
    const sessionId = this.requireSession();
    const prompt = toContentBlocks(this.withInstructions(blocks), {
      embeddedContext: this.caps.embeddedContext,
      images: this.caps.images,
    });
    this.turnActive = true;
    const request = this.connection.agent.request(acp.methods.agent.session.prompt, {
      sessionId,
      prompt,
    });
    const outcome = await Promise.race([
      request.then((response) => ({ kind: 'done' as const, response })),
      this.init.process.exited.then(() => ({ kind: 'exited' as const })),
    ]).catch((error: unknown) => ({ kind: 'failed' as const, error }));
    this.turnActive = false;
    clearTimeout(this.cancelTimer);

    this.emitAll(this.mapper.endTurn());
    // A dead agent usually closes the connection (request fails) just before `exit` arrives.
    const crashed =
      outcome.kind === 'exited' || (outcome.kind === 'failed' && (await this.exitsSoon()));
    if (crashed) this.crashReported = true;
    if (outcome.kind === 'done') {
      const stopReason = outcome.response.stopReason;
      this.emit({ type: 'turn.end', stopReason });
      return stopReason;
    }
    const error =
      crashed || outcome.kind !== 'failed' ? this.crashError() : this.explain(outcome.error);
    this.emit({
      type: 'error',
      message: error.message,
      recoverable: !crashed,
      detail: error.detail ?? error.hint,
    });
    this.emit({ type: 'turn.end', stopReason: 'error' });
    return 'error';
  }

  async cancel(): Promise<void> {
    if (!this.sessionId || !this.init.process.running) return;
    this.pendingPermissions.forEach((cancel) => cancel(true));
    this.pendingPermissions.clear();
    await this.connection.agent.notify(acp.methods.agent.session.cancel, {
      sessionId: this.sessionId,
    });
    // An agent that ignores the cancel is stopped; the session can be resumed later.
    if (this.turnActive) {
      clearTimeout(this.cancelTimer);
      this.cancelTimer = setTimeout(() => void this.init.process.kill(), CANCEL_GRACE_MS);
    }
  }

  async setConfigOption(id: string, value: string): Promise<void> {
    const response = await this.connection.agent.request(
      acp.methods.agent.session.setConfigOption,
      { sessionId: this.requireSession(), configId: id, value },
    );
    this.emit({ type: 'config', configOptions: mapConfigOptions(response.configOptions) });
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    clearTimeout(this.cancelTimer);
    this.listeners.clear();
    this.connection?.close();
    await this.init.process.kill();
  }

  // ── setup ──────────────────────────────────────────────────────────────────

  private async handshake(): Promise<void> {
    const { process: proc, host } = this.init;
    proc.onStderrLine((line) => this.emit({ type: 'debug', source: 'stderr', line }));

    // `toWeb()` is typed with Node's own stream generics; the SDK expects the DOM ones (same runtime objects).
    const stream = acp.ndJsonStream(
      Writable.toWeb(proc.stdin) as WritableStream<Uint8Array>,
      Readable.toWeb(proc.stdout) as ReadableStream<Uint8Array>,
    );
    this.connection = acp
      .client({ name: 'agenthub' })
      .onNotification(acp.methods.client.session.update, (ctx) => {
        if (ctx.params.sessionId === this.sessionId)
          this.emitAll(this.mapper.map(ctx.params.update));
      })
      .onRequest(acp.methods.client.session.requestPermission, (ctx) =>
        this.askPermission(ctx.params),
      )
      .onRequest(acp.methods.client.fs.readTextFile, async (ctx) => ({
        content: await host.readTextFile(
          ctx.params.path,
          ctx.params.line ?? undefined,
          ctx.params.limit ?? undefined,
        ),
      }))
      .onRequest(acp.methods.client.fs.writeTextFile, async (ctx) => {
        await host.writeTextFile(ctx.params.path, ctx.params.content);
        return {};
      })
      .connect(stream);

    const init = await this.withStartupGuard(
      this.connection.agent.request(acp.methods.agent.initialize, {
        protocolVersion: acp.PROTOCOL_VERSION,
        clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: false },
        clientInfo: { name: 'agenthub', version: '0.0.1' },
      }),
    );
    const agentCaps = init.agentCapabilities;
    this.caps = {
      ...this.caps,
      loadSession: agentCaps?.loadSession === true,
      embeddedContext: agentCaps?.promptCapabilities?.embeddedContext === true,
      images: agentCaps?.promptCapabilities?.image === true,
    };

    const created = await this.withStartupGuard(
      this.connection.agent.request(acp.methods.agent.session.new, {
        cwd: this.init.cwd,
        mcpServers: [],
      }),
    );
    this.sessionId = created.sessionId;
    let configOptions = mapConfigOptions(created.configOptions);
    for (const [id, value] of Object.entries(this.init.config ?? {})) {
      const option = configOptions.find((o) => o.id === id);
      if (!option || option.currentValue === value) continue;
      const response = await this.connection.agent.request(
        acp.methods.agent.session.setConfigOption,
        { sessionId: created.sessionId, configId: id, value },
      );
      configOptions = mapConfigOptions(response.configOptions);
    }
    this.caps.configOptions = configOptions.length > 0;

    this.emit({
      type: 'session.ready',
      nativeSessionId: created.sessionId,
      configOptions,
      modes: created.modes?.availableModes.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description ?? undefined,
      })),
      currentModeId: created.modes?.currentModeId,
    });

    // A crash while idle is reported here; a crash during a turn is reported by `prompt()`.
    void proc.exited.then(() => {
      // Let a racing `prompt()` claim the crash first.
      setTimeout(() => {
        if (this.disposed || this.turnActive || this.crashReported) return;
        this.crashReported = true;
        const error = this.crashError();
        this.emit({
          type: 'error',
          message: error.message,
          recoverable: false,
          detail: error.detail,
        });
      }, 0);
    });
  }

  private withStartupGuard<T>(request: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new AgentError('startup', 'The agent did not respond in time.')),
        STARTUP_TIMEOUT_MS,
      );
    });
    const exited = this.init.process.exited.then((info): never => {
      throw info.error ?? this.crashError();
    });
    return Promise.race([request, timeout, exited]).finally(() => clearTimeout(timer));
  }

  // ── permissions ────────────────────────────────────────────────────────────

  private async askPermission(params: unknown): Promise<acp.RequestPermissionResponse> {
    const request = mapPermissionRequest(params, `perm-${++this.permissionCounter}`);
    const cancelled = new Promise<{ outcome: 'cancelled' }>((resolve) => {
      this.pendingPermissions.set(request.id, () => resolve({ outcome: 'cancelled' }));
    });
    const outcome = await Promise.race([this.init.host.requestPermission(request), cancelled]);
    this.pendingPermissions.delete(request.id);
    return {
      outcome:
        outcome.outcome === 'selected'
          ? { outcome: 'selected', optionId: outcome.optionId }
          : { outcome: 'cancelled' },
    };
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private withInstructions(blocks: PromptBlock[]): PromptBlock[] {
    const instructions = this.init.systemPromptAppend?.trim();
    if (!this.firstPrompt || !instructions) return blocks;
    this.firstPrompt = false;
    return [{ type: 'text', text: `<instructions>\n${instructions}\n</instructions>` }, ...blocks];
  }

  /** Whether the agent process exits within a short grace period. */
  private async exitsSoon(graceMs = 500): Promise<boolean> {
    if (!this.init.process.running) return true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), graceMs);
    });
    const exited = this.init.process.exited.then(() => true as const);
    const result = await Promise.race([exited, timeout]);
    clearTimeout(timer);
    return result;
  }

  private requireSession(): string {
    if (!this.sessionId || this.disposed)
      throw new AgentError('protocol', 'The session is closed.');
    return this.sessionId;
  }

  private crashError(): AgentError {
    const tail = this.init.process.stderrTail().slice(-15).join('\n');
    return new AgentError(
      'crash',
      'The agent process stopped unexpectedly.',
      undefined,
      tail || undefined,
    );
  }

  /** Turns SDK / JSON-RPC errors into `AgentError`s with hints. */
  private explain(error: unknown): AgentError {
    if (error instanceof AgentError) return error;
    if (error instanceof acp.RequestError && error.code === AUTH_REQUIRED_CODE) {
      return new AgentError('auth', 'The agent needs you to log in.', this.init.loginHint);
    }
    if (hasCode(error, 'ENOENT')) {
      return new AgentError('missing-binary', 'The agent command was not found.');
    }
    const message = error instanceof Error ? error.message : String(error);
    const tail = this.init.process.stderrTail().slice(-15).join('\n');
    return new AgentError('protocol', message, undefined, tail || undefined);
  }

  private emit(event: AgentEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }

  private emitAll(events: AgentEvent[]): void {
    events.forEach((event) => this.emit(event));
  }
}

/** `true` for Node-style errors carrying a given `code`, checked without type assertions. */
function hasCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code;
}
