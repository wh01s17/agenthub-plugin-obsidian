/** Failures the UI explains to the user, each with an actionable hint when possible (plan §4.14). */
export type AgentErrorKind = 'missing-binary' | 'auth' | 'startup' | 'crash' | 'protocol';

export class AgentError extends Error {
  constructor(
    readonly kind: AgentErrorKind,
    message: string,
    /** What the user can do about it, e.g. "Run `codex login` in a terminal". */
    readonly hint?: string,
    /** Extra diagnostics, typically the agent's last stderr lines. */
    readonly detail?: string,
  ) {
    super(message);
    this.name = 'AgentError';
  }
}
