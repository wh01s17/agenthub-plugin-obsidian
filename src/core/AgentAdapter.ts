// Contract between the core and each agent integration (plan §4.4).
// This module must not import `obsidian`: host features arrive through `HostBridge`.

import type {
  AgentEvent,
  AgentId,
  PermissionOutcome,
  PermissionRequest,
  PromptBlock,
  StopReason,
} from './types';

export interface Disposable {
  dispose(): void;
}

export interface Logger {
  error(message: string, ...data: unknown[]): void;
  warn(message: string, ...data: unknown[]): void;
  info(message: string, ...data: unknown[]): void;
  debug(message: string, ...data: unknown[]): void;
}

/** What adapters may ask of the host (Obsidian), implemented by `HostBridgeImpl`. */
export interface HostBridge {
  /** Absolute path of the vault root. */
  readonly vaultBasePath: string;
  /** Environment for child processes, resolved per ADR-017. */
  env(): Promise<NodeJS.ProcessEnv>;
  /** Reads a text file, preferring unsaved editor content for open vault notes. */
  readTextFile(absPath: string, line?: number, limit?: number): Promise<string>;
  /** Writes a text file through the Vault API when it is inside the vault (path-guarded). */
  writeTextFile(absPath: string, content: string): Promise<void>;
  /** Shows the request to the user and resolves with their choice. */
  requestPermission(request: PermissionRequest): Promise<PermissionOutcome>;
  readonly log: Logger;
}

export interface AgentCapabilities {
  /** Text arrives as deltas (false for `codex exec`). */
  streaming: boolean;
  interactivePermissions: boolean;
  /** Can reopen a past session with its history. */
  loadSession: boolean;
  /** Accepts file contents embedded in the prompt. */
  embeddedContext: boolean;
  images: boolean;
  /** Exposes `configOptions` (mode, model, …). */
  configOptions: boolean;
  slashCommands: boolean;
  usage: boolean;
}

export interface DetectionResult {
  status: 'available' | 'missing' | 'error';
  version?: string;
  /** Absolute path of the resolved binary or command. */
  resolvedCommand?: string;
  /** Installation or troubleshooting hint for the user. */
  message?: string;
}

export interface SessionOptions {
  cwd: string;
  /** Initial values for config options, keyed by option id (e.g. `{ mode: 'plan' }`). */
  config?: Record<string, string>;
  /** Vault instructions appended to the agent's system prompt or first message (plan §4.8). */
  systemPromptAppend?: string;
  /** Extra CLI arguments (direct mode only). */
  extraArgs?: string[];
  env?: Record<string, string>;
}

export interface AgentSession {
  /** May only be known after the first turn in direct mode. */
  readonly nativeSessionId: string | undefined;
  readonly capabilities: AgentCapabilities;
  onEvent(listener: (event: AgentEvent) => void): Disposable;
  /** Runs one turn; resolves when it ends. */
  prompt(blocks: PromptBlock[]): Promise<StopReason>;
  cancel(): Promise<void>;
  /** Preferred way to change mode or model (ADR-015). */
  setConfigOption?(id: string, value: string): Promise<void>;
  /** Stops the agent process and releases resources. */
  dispose(): Promise<void>;
}

export interface AgentAdapter {
  readonly id: AgentId;
  readonly label: string;
  detect(host: HostBridge): Promise<DetectionResult>;
  createSession(options: SessionOptions, host: HostBridge): Promise<AgentSession>;
  loadSession?(
    nativeSessionId: string,
    options: SessionOptions,
    host: HostBridge,
  ): Promise<AgentSession>;
}
