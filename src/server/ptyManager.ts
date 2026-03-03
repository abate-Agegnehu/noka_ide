import * as pty from "node-pty";
import path from "node:path";
import fs from "node:fs";

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

  // Ensure cwd is absolute and exists
  let resolvedCwd = cwd;
  if (resolvedCwd) {
    if (!path.isAbsolute(resolvedCwd)) {
      // Try resolving relative to IDE root
      const directPath = path.resolve(process.cwd(), resolvedCwd);
      // Try resolving as a sibling
      const siblingPath = path.resolve(process.cwd(), "..", resolvedCwd);
      // Try resolving in parent's siblings
      const parentSiblingPath = path.resolve(process.cwd(), "..", "..", resolvedCwd);

      if (fs.existsSync(directPath)) {
        resolvedCwd = directPath;
      } else if (fs.existsSync(siblingPath)) {
        resolvedCwd = siblingPath;
      } else if (fs.existsSync(parentSiblingPath)) {
        resolvedCwd = parentSiblingPath;
      } else {
        // eslint-disable-next-line no-console
        console.warn(`PTY CWD not found at ${directPath} or ${siblingPath}, falling back to IDE root`);
        resolvedCwd = process.cwd();
      }
    } else if (!fs.existsSync(resolvedCwd)) {
      // eslint-disable-next-line no-console
      console.warn(`PTY CWD does not exist: ${resolvedCwd}, falling back to process.cwd()`);
      resolvedCwd = process.cwd();
    }
  } else {
    resolvedCwd = process.cwd();
  }

  try {
    // eslint-disable-next-line no-console
    console.log(
      `Spawning PTY [${id}] with shell: ${shell} in ${resolvedCwd}`,
    );

    ptyProcess = pty.spawn(shell, [], {
      name: "xterm-color",
      cols: 80,
      rows: 24,
      cwd: resolvedCwd,
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
      cwd: resolvedCwd,
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
