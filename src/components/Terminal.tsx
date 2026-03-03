import React, { useEffect, useRef } from "react";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import { Terminal as TerminalIcon, X, RefreshCw } from "lucide-react";
import { useIDEStore } from "../store/useIDEStore";
import { cn } from "../utils/helpers";
import "xterm/css/xterm.css";

export const Terminal: React.FC = () => {
  const {
    isTerminalOpen,
    toggleTerminal,
    isRunning,
    runtimeProjectPath,
    setRuntimeProjectPath,
    detectProjectPath,
    files,
  } = useIDEStore();

  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  // track last seen root folder id so we can detect project changes even when
  // the folder name stays the same (users may open multiple projects named
  // "project" etc).
  const prevRootIdRef = useRef<string | null>(null);

  // Detect and update project path when the active root folder changes. calling
  // `detectProjectPath` on every change keeps the runtime cwd in sync with the
  // workspace state.
  useEffect(() => {
    const rootFolder = Object.values(files).find((f) => f.parentId === null);
    const rootId = rootFolder?.id || null;

    // If the root folder object changed (new project) or we have no cwd yet,
    // probe for a path on disk.
    if (rootFolder) {
      if (rootId !== prevRootIdRef.current) {
        prevRootIdRef.current = rootId;
        // clear any stale path before attempting detection so that the effect
        // which re‑initializes the terminal will fire properly
        if (runtimeProjectPath) {
          setRuntimeProjectPath(null);
        }
        detectProjectPath(rootFolder.name, { promptOnFail: false });
      } else if (!runtimeProjectPath) {
        // root didn't change but we still don't have a path (initial load)
        detectProjectPath(rootFolder.name, { promptOnFail: false });
      }
    }
  }, [files, runtimeProjectPath, detectProjectPath, setRuntimeProjectPath]);

  // Restart terminal when project path changes
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.dispose();
      xtermRef.current = null;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: "pty-kill", id: "main-terminal" }),
        );
        wsRef.current.close();
      }
    }
  }, [runtimeProjectPath]);

  useEffect(() => {
    if (!isTerminalOpen || !terminalRef.current || xtermRef.current) return;

    let isMounted = true;
    let ws: WebSocket | null = null;
    let term: XTerm | null = null;

    const initializeTerminal = async () => {
      // Find the root folder name from the sidebar files
      const rootFolder = Object.values(files).find((f) => f.parentId === null);
      let cwd = runtimeProjectPath || "";

      if (rootFolder && !runtimeProjectPath) {
        try {
          const detectedPath = await detectProjectPath(rootFolder.name, {
            promptOnFail: false,
          });
          if (detectedPath) {
            cwd = detectedPath;
          }
        } catch (e) {
          console.warn("Backend offline or path detection failed");
        }

        if (!cwd) {
          // relative fallback - backend ptyManager is now smart enough to check siblings
          cwd = rootFolder.name;
        }
      }

      if (!isMounted || !terminalRef.current) return;

      // Initialize xterm
      term = new XTerm({
        theme: {
          background: "#0f172a",
          foreground: "#f8fafc",
          cursor: "#38bdf8",
          selectionBackground: "rgba(56, 189, 248, 0.3)",
        },
        fontSize: 12,
        fontFamily: "JetBrains Mono, monospace",
        cursorBlink: true,
        allowProposedApi: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.loadAddon(new WebLinksAddon());

      term.open(terminalRef.current!);
      fitAddon.fit();
      
      // If we don't have a real path, warn the user in the terminal
      if (!cwd && rootFolder) {
        term.write("\r\n\x1b[33m[Nova Warning]: Local project path for \"" + rootFolder.name + "\" not detected.\x1b[0m");
        term.write("\r\n\x1b[33mThe terminal is running in the IDE root. Click the amber path above to sync.\x1b[0m\r\n\r\n");
      }

      term.focus();

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      // Connect to WebSocket
      ws = new WebSocket(`ws://${window.location.hostname}:3005`);
      wsRef.current = ws;

      const terminalId = "main-terminal";

      ws.onopen = () => {
        if (!ws) return;
        // Start PTY session
        ws.send(
          JSON.stringify({
            type: "pty-start",
            id: terminalId,
            cwd: cwd || "",
            cols: term?.cols,
            rows: term?.rows,
          }),
        );
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "pty-output" && msg.id === terminalId) {
          term?.write(msg.data);
        } else if (msg.type === "error") {
          term?.write(
            "\r\n\x1b[31m[Nova Error]: " + msg.message + "\x1b[0m\r\n",
          );
        }
      };

      ws.onerror = () => {
        term?.write(
          '\r\n\x1b[31m[Nova Error]: Failed to connect to backend server (port 3005). Please ensure the backend is running with "npm run server".\x1b[0m\r\n',
        );
      };

      term.onData((data) => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "pty-input",
              id: terminalId,
              data,
            }),
          );
        }
      });

      term.onResize(({ cols, rows }) => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "pty-resize",
              id: terminalId,
              cols,
              rows,
            }),
          );
        }
      });
    };

    initializeTerminal();

    const handleResize = () => {
      if (fitAddonRef.current) fitAddonRef.current.fit();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      isMounted = false;
      window.removeEventListener("resize", handleResize);
      if (term) term.dispose();
      xtermRef.current = null;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "pty-kill", id: "main-terminal" }));
        ws.close();
      }
    };
  }, [isTerminalOpen, runtimeProjectPath, files, detectProjectPath]);

  if (!isTerminalOpen) return null;

  const activeRoot = Object.values(files).find((f) => f.parentId === null);
  const displayPath = runtimeProjectPath || (activeRoot ? activeRoot.name : "No Project Path");
  const isPathDetected = !!runtimeProjectPath;

  return (
    <div className="h-64 bg-[#0f172a] border-t border-white/5 flex flex-col font-mono text-xs">
      <div className="flex items-center justify-between px-4 py-1.5 bg-slate-900/50 border-b border-white/5">
        <div className="flex items-center gap-2 text-slate-400">
          <TerminalIcon size={12} />
          <span className="font-semibold uppercase tracking-wider text-[10px]">
            System Terminal
          </span>
          <div className="h-3 w-[1px] bg-white/10 mx-1" />
          <span
            className={cn(
              "text-[10px] font-mono truncate max-w-[300px]",
              isPathDetected ? "text-slate-500" : "text-amber-500 font-bold",
            )}
            title={isPathDetected ? runtimeProjectPath! : "Path not detected - Terminal running in relative mode"}
          >
            {displayPath}
          </span>
          <button
            onClick={async () => {
              if (activeRoot) {
                const p = await detectProjectPath(activeRoot.name, {
                  promptOnFail: true,
                });
                if (p) {
                  // The terminal will automatically restart via useEffect
                }
              }
            }}
            className={cn(
              "p-1 hover:bg-white/10 rounded transition-colors ml-1",
              isPathDetected ? "text-slate-500" : "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20",
            )}
            title={isPathDetected ? "Sync Project Path" : "Set Project Path (Required for real runtime)"}
          >
            <RefreshCw size={10} className={cn(!isPathDetected && "animate-pulse")} />
          </button>
          {isRunning && (
            <div className="flex items-center gap-2 ml-4">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[9px] text-green-500 font-bold">
                RUNNING
              </span>
            </div>
          )}
        </div>
        <button
          onClick={toggleTerminal}
          className="text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-hidden p-2" ref={terminalRef} />
    </div>
  );
};
