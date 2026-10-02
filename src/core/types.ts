// Domain model shared by adapters, sessions and UI. Shaped after ACP (plan §4.3, ADR-002):
// the ACP adapter maps almost 1:1, direct-mode adapters translate their CLI output into it.
// This module must not import `obsidian`.

export type AgentId = string;

/** Why an agent failed, so the UI can explain it in the user's language. */
export type AgentErrorKind =
  'missing-binary' | 'auth' | 'startup' | 'crash' | 'protocol' | 'unsafe-mode';

export type ToolKind =
  'read' | 'edit' | 'delete' | 'move' | 'search' | 'execute' | 'think' | 'fetch' | 'other';

export type ToolStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export type StopReason =
  'end_turn' | 'max_tokens' | 'max_turn_requests' | 'refusal' | 'cancelled' | 'error';

export type ToolContent =
  | { type: 'text'; text: string }
  | { type: 'diff'; path: string; oldText: string | null; newText: string }
  | { type: 'terminal'; output: string; exitCode?: number };

export interface ToolCall {
  id: string;
  title: string;
  kind: ToolKind;
  status: ToolStatus;
  rawInput?: unknown;
  rawOutput?: unknown;
  locations?: { path: string; line?: number }[];
  content?: ToolContent[];
}

export interface PlanEntry {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority?: 'high' | 'medium' | 'low';
}

export interface SlashCommand {
  name: string;
  description?: string;
  inputHint?: string;
}

export interface ModeInfo {
  id: string;
  name: string;
  description?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
}

/** A selectable session setting (mode, model, …) as exposed by ACP `configOptions` (ADR-015). */
export interface ConfigOption {
  id: string;
  name: string;
  description?: string;
  /** `mode` and `model` are the categories observed in S2; others are passed through. */
  category?: string;
  currentValue: string;
  options: { value: string; name: string; description?: string }[];
}

export interface Usage {
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  costUsd?: number;
  /** Context window usage (ACP `usage_update.used` / `size`). */
  contextUsed?: number;
  contextSize?: number;
}

export type AgentEvent =
  | {
      type: 'session.ready';
      nativeSessionId: string;
      configOptions?: ConfigOption[];
      modes?: ModeInfo[];
      currentModeId?: string;
      models?: ModelInfo[];
      currentModelId?: string;
    }
  | { type: 'config'; configOptions: ConfigOption[] }
  /** `messageId` comes from the agent when it sends one (all agents in S2 did). */
  | { type: 'message.chunk'; role: 'assistant' | 'user'; messageId: string; text: string }
  | { type: 'thought.chunk'; messageId: string; text: string }
  | { type: 'message.end'; messageId: string }
  | { type: 'tool.call'; call: ToolCall }
  | { type: 'tool.update'; id: string; patch: Partial<Omit<ToolCall, 'id'>> }
  | { type: 'plan'; entries: PlanEntry[] }
  | { type: 'commands'; commands: SlashCommand[] }
  | { type: 'mode'; currentModeId: string }
  | { type: 'usage'; usage: Usage }
  /** Direct mode without interactive prompts: a tool call the agent was not allowed to run. */
  | { type: 'permission.denied'; toolName: string; toolCallId?: string; input?: unknown }
  | { type: 'turn.end'; stopReason: StopReason }
  | { type: 'error'; message: string; recoverable: boolean; detail?: string; kind?: AgentErrorKind }
  | { type: 'debug'; source: 'stdout' | 'stderr' | 'rpc'; line: string };

export type AgentEventType = AgentEvent['type'];

/** Every event discriminant; kept in sync with `AgentEvent` by a type test. */
export const AGENT_EVENT_TYPES = [
  'session.ready',
  'config',
  'message.chunk',
  'thought.chunk',
  'message.end',
  'tool.call',
  'tool.update',
  'plan',
  'commands',
  'mode',
  'usage',
  'permission.denied',
  'turn.end',
  'error',
  'debug',
] as const satisfies readonly AgentEventType[];

export type PromptBlock =
  | { type: 'text'; text: string }
  /** A vault note or file; `path` is vault-relative, `absPath` absolute. */
  | { type: 'file'; path: string; absPath: string; text?: string }
  | { type: 'selection'; path: string; text: string; fromLine: number; toLine: number }
  | { type: 'image'; mimeType: string; data: string };

export type PermissionOptionKind = 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always';

export interface PermissionRequest {
  id: string;
  toolCall: Pick<ToolCall, 'id' | 'title' | 'kind' | 'rawInput' | 'locations'>;
  options: { id: string; label: string; kind: PermissionOptionKind }[];
}

export type PermissionOutcome =
  { outcome: 'selected'; optionId: string } | { outcome: 'cancelled' };

// ── View state, derived from events by a pure reducer (T2.6) ─────────────────

/** What a notice says, as data: the UI turns it into localized text (`t()`), the core never does. */
export type Notice =
  | { key: 'agentError'; message: string; hint?: string; detail?: string; kind?: AgentErrorKind }
  | { key: 'permissionDenied'; toolName: string }
  /** A stored session was reopened but the agent could not continue its previous context. */
  | { key: 'contextNotRestored' }
  | { key: 'turnStopped'; stopReason: Exclude<StopReason, 'end_turn'> };

export type TranscriptItem =
  | { kind: 'user'; id: string; blocks: PromptBlock[]; at: number }
  | { kind: 'assistant'; id: string; text: string; streaming: boolean }
  | { kind: 'thought'; id: string; text: string; streaming: boolean }
  | { kind: 'tool'; call: ToolCall }
  | { kind: 'plan'; entries: PlanEntry[] }
  | { kind: 'permission'; request: PermissionRequest; resolved?: PermissionOutcome }
  | { kind: 'notice'; id: string; level: 'info' | 'warning' | 'error'; notice: Notice };

export type SessionStatus =
  'idle' | 'starting' | 'running' | 'awaiting-permission' | 'error' | 'closed';

/** Immutable snapshot rendered by the UI; the reducer returns a new object on every change. */
export interface SessionViewState {
  /** AgentHub's own id for the session. */
  readonly localId: string;
  readonly agentId: AgentId;
  /** The agent's id for the conversation, used to resume it. */
  readonly nativeSessionId?: string;
  readonly title: string;
  readonly cwd: string;
  readonly status: SessionStatus;
  readonly items: readonly TranscriptItem[];
  readonly configOptions: readonly ConfigOption[];
  readonly modes?: readonly ModeInfo[];
  readonly currentModeId?: string;
  readonly models?: readonly ModelInfo[];
  readonly currentModelId?: string;
  readonly commands: readonly SlashCommand[];
  readonly usage?: Usage;
}
