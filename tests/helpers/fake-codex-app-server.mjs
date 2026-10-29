#!/usr/bin/env node
// Stand-in for `codex app-server` (ADR-040): answers `initialize` and `account/rateLimits/read`.
import { createInterface } from 'node:readline';

const mode = process.env.FAKE_CODEX_MODE ?? 'ok';
createInterface({ input: process.stdin }).on('line', (line) => {
  const message = JSON.parse(line);
  if (message.id === undefined) return;
  if (mode === 'silent') return;
  const result =
    message.method === 'initialize'
      ? { userAgent: 'fake' }
      : {
          rateLimits: {
            primary: { usedPercent: 3, windowDurationMins: 300, resetsAt: 1793257112 },
            secondary: { usedPercent: 20, windowDurationMins: 10080, resetsAt: 1793803807 },
          },
        };
  process.stdout.write(`${JSON.stringify({ id: message.id, result })}\n`);
});
