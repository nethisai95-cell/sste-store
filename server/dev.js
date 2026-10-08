import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (process.argv.includes('--https')) {
  process.env.DEV_HTTPS = '1';
  const lan = Object.values(os.networkInterfaces()).flat().find((i) => i.family === 'IPv4' && !i.internal);
  console.log(`\nPhone (same Wi-Fi, accept the certificate warning once): https://${lan?.address ?? '<your-pc-ip>'}:5173\n`);
}
const processes = [
  spawn(process.execPath, ['--watch', 'server/index.js'], { cwd: projectRoot, stdio: 'inherit' }),
  spawn(process.execPath, [path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '0.0.0.0'], {
    cwd: projectRoot,
    stdio: 'inherit',
  }),
];

let stopping = false;

function stop(signal) {
  if (stopping) return;
  stopping = true;
  for (const child of processes) {
    if (child.exitCode === null && child.signalCode === null) child.kill(signal);
  }
}

for (const child of processes) {
  child.on('error', (error) => {
    console.error('Could not start a development process:', error.message);
    stop('SIGTERM');
    process.exitCode = 1;
  });
  child.on('exit', (code, signal) => {
    if (stopping) return;
    stop('SIGTERM');
    process.exitCode = code ?? (signal ? 1 : 0);
  });
}

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));