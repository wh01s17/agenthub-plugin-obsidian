// Generic ACP adapter: any ACP agent is just a command + args (plan §5.1, RF-20).

import type {
  AgentAdapter,
  AgentSession,
  DetectionResult,
  HostBridge,
  SessionOptions,
} from '../../core/AgentAdapter';
import { AgentError } from '../../core/errors';
import type { ResolvedCommand } from '../../process/BinaryResolver';
import { spawnProcess, type ProcessRegistry } from '../../process/ProcessRunner';
import { AcpSession } from './AcpSession';

export interface AcpAgentConfig {
  readonly id: string;
  readonly label: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly env?: Readonly<Record<string, string>>;
  /** Shown when the command is missing, e.g. "npm i -g @agentclientprotocol/codex-acp". */
  readonly installHint?: string;
  /** Shown when the agent asks for authentication, e.g. "Run `codex login`". */
  readonly loginHint?: string;
}

export interface AcpAdapterDeps {
  resolveCommand: (command: string) => Promise<ResolvedCommand | null>;
  registry: ProcessRegistry;
}

export class AcpAdapter implements AgentAdapter {
  constructor(
    private readonly config: AcpAgentConfig,
    private readonly deps: AcpAdapterDeps,
  ) {}

  get id(): string {
    return this.config.id;
  }

  get label(): string {
    return this.config.label;
  }

  async detect(): Promise<DetectionResult> {
    const resolved = await this.deps.resolveCommand(this.config.command);
    if (!resolved) {
      return {
        status: 'missing',
        message: this.config.installHint ?? `Command not found: ${this.config.command}`,
      };
    }
    return { status: 'available', resolvedCommand: resolved.path };
  }

  async createSession(options: SessionOptions, host: HostBridge): Promise<AgentSession> {
    const resolved = await this.deps.resolveCommand(this.config.command);
    if (!resolved) {
      throw new AgentError(
        'missing-binary',
        `Command not found: ${this.config.command}`,
        this.config.installHint,
      );
    }
    const process = spawnProcess(
      {
        command: resolved.path,
        args: [...this.config.args, ...(options.extraArgs ?? [])],
        cwd: options.cwd,
        env: { ...resolved.env, ...this.config.env, ...options.env },
      },
      this.deps.registry,
    );
    host.log.debug(`[${this.config.id}] started ${resolved.path} (pid ${process.pid ?? '?'})`);
    return AcpSession.start({
      process,
      host,
      cwd: options.cwd,
      config: options.config,
      systemPromptAppend: options.systemPromptAppend,
      loginHint: this.config.loginHint,
    });
  }
}
