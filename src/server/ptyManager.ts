import * as pty from "node-pty";

const shell =
  process.platform === "win32" ? "powershell.exe" : process.env.SHELL || "bash";
const fallbackShell = process.platform === "win32" ? "cmd.exe" : "sh";

export interface PtySession {
  id: string;
  pty: pty.IPty;
}

const sessions = new Map<string, PtySession>();

export function createPtySession(id: string, cwd: string): PtySession {
  let ptyProcess: pty.IPty;

  try {
    // eslint-disable-next-line no-console
    console.log(
      `Spawning PTY [${id}] with shell: ${shell} in ${cwd || "default"}`,
    );

    ptyProcess = pty.spawn(shell, [], {
      name: "xterm-color",
      cols: 80,
      rows: 24,
      cwd: cwd || process.cwd(),
      env: process.env as any,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `Failed to spawn primary shell (${shell}), trying fallback (${fallbackShell}):`,
      err,
    );

    ptyProcess = pty.spawn(fallbackShell, [], {
      name: "xterm-color",
      cols: 80,
      rows: 24,
      cwd: cwd || process.cwd(),
      env: process.env as any,
    });
  }

  const session = { id, pty: ptyProcess };
  sessions.set(id, session);

  ptyProcess.onExit(() => {
    sessions.delete(id);
  });

  return session;
}

export function getPtySession(id: string): PtySession | undefined {
  return sessions.get(id);
}

export function killPtySession(id: string) {
  const session = sessions.get(id);
  if (session) {
    session.pty.kill();
    sessions.delete(id);
  }
}
