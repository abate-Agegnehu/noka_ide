import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import { findFreePort } from './portManager';
import path from 'node:path';
import fs from 'node:fs';

export interface StartOptions {
  cwd: string;
  framework?: 'vite' | 'next' | 'node' | 'unknown';
  script?: string;
}

export interface ManagedProcess {
  id: string;
  child: ChildProcessWithoutNullStreams;
  port: number;
  url?: string;
  startedAt: number;
}

const procs = new Map<string, ManagedProcess>();

export function listProcesses() {
  return Array.from(procs.values()).map(p => ({ id: p.id, port: p.port, url: p.url, startedAt: p.startedAt }));
}

export async function startProcess(opts: StartOptions) {
  const port = await findFreePort(3001);
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  
  // Ensure cwd is absolute and exists
  let resolvedCwd = opts.cwd;
  if (resolvedCwd) {
    if (!path.isAbsolute(resolvedCwd)) {
      resolvedCwd = path.resolve(process.cwd(), resolvedCwd);
    }
    if (!fs.existsSync(resolvedCwd)) {
      // eslint-disable-next-line no-console
      console.warn(`Dev Process CWD does not exist: ${resolvedCwd}, falling back to process.cwd()`);
      resolvedCwd = process.cwd();
    }
  } else {
    resolvedCwd = process.cwd();
  }

  const framework = opts.framework || 'unknown';
  const env = { ...process.env };
  let command = 'npm';
  let args: string[] = ['run', 'dev'];

  if (framework === 'vite') {
    args = ['run', 'dev', '--', '--port', String(port), '--host', '0.0.0.0'];
  } else if (framework === 'next') {
    args = ['run', 'dev', '--', '-p', String(port)];
  } else if (framework === 'node') {
    // Respect user script if provided
    if (opts.script) {
      command = 'npm';
      args = ['run', opts.script];
    } else {
      command = 'node';
      args = ['index.js'];
    }
    env.PORT = String(port);
    env.HOST = '0.0.0.0';
  } else {
    if (opts.script) {
      command = 'npm';
      args = ['run', opts.script];
    } else {
      args = ['run', 'dev'];
    }
    env.PORT = String(port);
    env.HOST = '0.0.0.0';
  }

  const child = spawn(command, args, { cwd: resolvedCwd, env, shell: process.platform === 'win32' });
  const proc: ManagedProcess = { id, child, port, startedAt: Date.now() };
  procs.set(id, proc);

  child.on('exit', () => {
    procs.delete(id);
  });

  return proc;
}

export function stopProcess(id: string) {
  const p = procs.get(id);
  if (!p) return false;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(p.child.pid), '/f', '/t']);
    } else {
      p.child.kill('SIGTERM');
    }
  } catch {}
  procs.delete(id);
  return true;
}

export function inferFrameworkFromLogs(line: string): string | undefined {
  if (/VITE v\d/i.test(line) || /Local:\s*http:\/\/.*:5\d{3}/i.test(line)) return 'vite';
  if (/started server on .*:3000|ready - started server/i.test(line)) return 'next';
  return undefined;
}

export function extractUrlFromLogs(line: string): string | undefined {
  const m = line.match(/(http:\/\/localhost:\d{2,5})/i);
  return m?.[1];
}
