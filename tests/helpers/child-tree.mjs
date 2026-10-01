// Test helper: prints its pid and a grandchild's pid, then stays alive.
// Args: --ignore-term  ignore SIGTERM (forces SIGKILL)
//       --stderr N     write N numbered lines to stderr first
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
if (args.includes('--ignore-term')) process.on('SIGTERM', () => {});
const stderrCount = Number(args[args.indexOf('--stderr') + 1] ?? 0) || 0;
for (let i = 1; i <= stderrCount; i++) process.stderr.write(`err ${i}\n`);

const grandchild = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
  stdio: 'ignore',
});
process.stdout.write(JSON.stringify({ pid: process.pid, grandchild: grandchild.pid }) + '\n');
process.stdin.on('data', (chunk) => process.stdout.write(`echo:${chunk}`));
setInterval(() => {}, 1000);
