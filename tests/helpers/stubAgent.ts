// In-memory AgentAdapter for core tests: each prompt runs a scripted function.
import type {
  AgentAdapter,
  AgentCapabilities,
  AgentSession,
  HostBridge,
  SessionOptions,
} from '../../src/core/AgentAdapter';
import type { AgentEvent, PromptBlock, StopReason } from '../../src/core/types';

export interface StubTurn {
  emit: (event: AgentEvent) => void;
  host: HostBridge;
  blocks: PromptBlock[];
  cancelled: () => boolean;
}

export type StubScript = (turn: StubTurn) => Promise<StopReason> | StopReason;

const CAPABILITIES: AgentCapabilities = {
  streaming: true,
  interactivePermissions: true,
  loadSession: false,
  embeddedContext: true,
  images: true,
  configOptions: false,
  slashCommands: false,
  usage: false,
};

export class StubSession implements AgentSession {
  readonly nativeSessionId: string = 'stub-native';
  readonly capabilities: AgentCapabilities = { ...CAPABILITIES };
  restored = false;
  readonly prompts: PromptBlock[][] = [];
  disposed = false;
  setConfigOption?: (id: string, value: string) => Promise<void>;
  private listeners = new Set<(event: AgentEvent) => void>();
  private cancelRequested = false;

  constructor(
    private readonly script: StubScript,
    private readonly host: HostBridge,
  ) {}

  onEvent(listener: (event: AgentEvent) => void) {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  }

  async prompt(blocks: PromptBlock[]): Promise<StopReason> {
    this.prompts.push(blocks);
    this.cancelRequested = false;
    const emit = (event: AgentEvent) => this.listeners.forEach((l) => l(event));
    const stopReason = await this.script({
      emit,
      host: this.host,
      blocks,
      cancelled: () => this.cancelRequested,
    });
    emit({ type: 'turn.end', stopReason });
    return stopReason;
  }

  cancel(): Promise<void> {
    this.cancelRequested = true;
    return Promise.resolve();
  }

  dispose(): Promise<void> {
    this.disposed = true;
    return Promise.resolve();
  }
}

export class StubAdapter implements AgentAdapter {
  readonly sessions: StubSession[] = [];
  readonly options: SessionOptions[] = [];
  readonly resumed: string[] = [];
  failWith: Error | null = null;
  /** Whether `loadSession` keeps the previous context (like ACP resume/load). */
  canRestore = true;
  /** Whether new sessions accept image blocks (ACP `promptCapabilities.image`). */
  images = true;

  constructor(
    private readonly script: StubScript,
    readonly id = 'stub',
    readonly label = 'Stub',
  ) {}

  detect() {
    return Promise.resolve({ status: 'available' as const });
  }

  async loadSession(
    nativeSessionId: string,
    options: SessionOptions,
    host: HostBridge,
  ): Promise<AgentSession> {
    this.resumed.push(nativeSessionId);
    const session = (await this.createSession(options, host)) as StubSession;
    session.restored = this.canRestore;
    return session;
  }

  createSession(options: SessionOptions, host: HostBridge): Promise<AgentSession> {
    this.options.push(options);
    if (this.failWith) return Promise.reject(this.failWith);
    const session = new StubSession(this.script, host);
    session.capabilities.images = this.images;
    this.sessions.push(session);
    return Promise.resolve(session);
  }
}

export const hostServices = {
  vaultBasePath: '/vault',
  env: () => Promise.resolve({}),
  readTextFile: () => Promise.resolve(''),
  writeTextFile: () => Promise.resolve(),
  log: { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} },
};
