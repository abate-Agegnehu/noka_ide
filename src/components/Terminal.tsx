import React, { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import { Terminal as TerminalIcon, X, RefreshCw, Plus } from "lucide-react";
import { useIDEStore } from "../store/useIDEStore";
import { cn } from "../utils/helpers";
import "xterm/css/xterm.css";

interface TerminalInstance {
  id: string;
  term: XTerm;
  fitAddon: FitAddon;
  ws: WebSocket;
  element: HTMLDivElement;
}

export const Terminal: React.FC = () => {
  const {
    isTerminalOpen,
    toggleTerminal,
    isRunning,
    runtimeProjectPath,
    setRuntimeProjectPath,
    detectProjectPath,
    files,
    terminals,
    activeTerminalId,
    addTerminal,
    removeTerminal,
    setActiveTerminal,
  } = useIDEStore();

  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const instancesRef = useRef<Record<string, TerminalInstance>>({});
  const prevRootIdRef = useRef<string | null>(null);

  // Initialize first terminal if none exist
  useEffect(() => {
    if (terminals.length === 0) {
      addTerminal("Terminal 1");
    }
  }, [terminals.length, addTerminal]);

  // Detect project path
  useEffect(() => {
    const rootFolder = Object.values(files).find((f) => f.parentId === null);
    const rootId = rootFolder?.id || null;

    if (rootFolder) {
      if (rootId !== prevRootIdRef.current) {
        prevRootIdRef.current = rootId;
        if (runtimeProjectPath) {
          setRuntimeProjectPath(null);
        }
        detectProjectPath(rootFolder.name, { promptOnFail: false });
      } else if (!runtimeProjectPath) {
        detectProjectPath(rootFolder.name, { promptOnFail: false });
      }
    }
  }, [files, runtimeProjectPath, detectProjectPath, setRuntimeProjectPath]);

  // Clean up terminal instances when project path changes
  useEffect(() => {
    Object.values(instancesRef.current).forEach((instance) => {
      instance.term.dispose();
      if (instance.ws.readyState === WebSocket.OPEN) {
        instance.ws.send(JSON.stringify({ type: "pty-kill", id: instance.id }));
        instance.ws.close();
      }
      instance.element.remove();
    });
    instancesRef.current = {};
  }, [runtimeProjectPath]);

  // Manage terminal instances for each tab
  useEffect(() => {
    if (!isTerminalOpen || !terminalContainerRef.current) return;

    terminals.forEach((t) => {
      if (instancesRef.current[t.id]) return;

      const term = new XTerm({
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

      // Create a hidden container for each terminal
      const el = document.createElement("div");
      el.style.width = "100%";
      el.style.height = "100%";
      el.style.display = t.id === activeTerminalId ? "block" : "none";
      terminalContainerRef.current?.appendChild(el);

      term.open(el);
      fitAddon.fit();

      const ws = new WebSocket(`ws://${window.location.hostname}:3005`);

      ws.onopen = () => {
        const rootFolder = Object.values(files).find((f) => f.parentId === null);
        const cwd = runtimeProjectPath || (rootFolder ? rootFolder.name : "");
        ws.send(
          JSON.stringify({
            type: "pty-start",
            id: t.id,
            cwd: cwd || "",
            cols: term.cols,
            rows: term.rows,
          }),
        );
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "pty-output" && msg.id === t.id) {
          term.write(msg.data);
        } else if (msg.type === "url") {
          // Update preview URL and state in the store
          const store = useIDEStore.getState();
          store.setPreviewUrl(msg.url);
          store.setRunning(true);
        }
      };

      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "pty-input", id: t.id, data }));
        }
      });

      term.onResize(({ cols, rows }) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "pty-resize", id: t.id, cols, rows }));
        }
      });

      instancesRef.current[t.id] = { id: t.id, term, fitAddon, ws, element: el };
    });

    // Update visibility and focus
    Object.keys(instancesRef.current).forEach((id) => {
      const instance = instancesRef.current[id];
      if (instance.element) {
        instance.element.style.display = id === activeTerminalId ? "block" : "none";
        if (id === activeTerminalId) {
          setTimeout(() => {
            instance.term.focus();
            instance.fitAddon.fit();
          }, 0);
        }
      }
    });

    // Cleanup removed terminals
    const currentIds = terminals.map((t) => t.id);
    Object.keys(instancesRef.current).forEach((id) => {
      if (!currentIds.includes(id)) {
        const instance = instancesRef.current[id];
        instance.term.dispose();
        if (instance.ws.readyState === WebSocket.OPEN) {
          instance.ws.send(JSON.stringify({ type: "pty-kill", id }));
          instance.ws.close();
        }
        instance.element.remove();
        delete instancesRef.current[id];
      }
    });
  }, [terminals, activeTerminalId, isTerminalOpen, files, runtimeProjectPath]);

  useEffect(() => {
    const handleResize = () => {
      Object.values(instancesRef.current).forEach((inst) => inst.fitAddon.fit());
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!isTerminalOpen) return null;

  const activeRoot = Object.values(files).find((f) => f.parentId === null);
  const displayPath = runtimeProjectPath || (activeRoot ? activeRoot.name : "No Project Path");
  const isPathDetected = !!runtimeProjectPath;

  return (
    <div className="h-64 bg-[#0f172a] border-t border-white/5 flex flex-col font-mono text-xs">
      <div className="flex items-center justify-between px-2 bg-slate-900/50 border-b border-white/5 h-8">
        <div className="flex items-center gap-1 h-full overflow-x-auto no-scrollbar">
          {terminals.map((t) => (
            <div
              key={t.id}
              onClick={() => setActiveTerminal(t.id)}
              className={cn(
                "flex items-center gap-2 px-3 h-full cursor-pointer border-r border-white/5 min-w-[120px] transition-colors relative group",
                activeTerminalId === t.id
                  ? "bg-[#0f172a] text-blue-400"
                  : "hover:bg-white/5 text-slate-500"
              )}
            >
              <TerminalIcon size={12} />
              <span className="truncate max-w-[80px]">{t.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeTerminal(t.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/10 rounded ml-auto"
              >
                <X size={10} />
              </button>
              {activeTerminalId === t.id && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500" />
              )}
            </div>
          ))}
          <button
            onClick={() => addTerminal()}
            className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded mx-1"
            title="Add New Terminal"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="flex items-center gap-2 px-4">
          <span
            className={cn(
              "text-[10px] font-mono truncate max-w-[200px]",
              isPathDetected ? "text-slate-500" : "text-amber-500 font-bold"
            )}
            title={isPathDetected ? runtimeProjectPath! : "Path not detected"}
          >
            {displayPath}
          </span>
          <button
            onClick={async () => {
              if (activeRoot) {
                await detectProjectPath(activeRoot.name, { promptOnFail: true });
              }
            }}
            className={cn(
              "p-1 hover:bg-white/10 rounded transition-colors",
              isPathDetected ? "text-slate-500" : "text-amber-500"
            )}
          >
            <RefreshCw size={10} className={cn(!isPathDetected && "animate-pulse")} />
          </button>
          <div className="h-4 w-[1px] bg-white/10 mx-1" />
          <button
            onClick={toggleTerminal}
            className="text-slate-500 hover:text-slate-300 p-1"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-2" ref={terminalContainerRef} />
    </div>
  );
};

