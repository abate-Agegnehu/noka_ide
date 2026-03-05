import React, { useState, useRef,useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { Extensions } from "./components/Extensions";
import { GlobalSearch } from "./components/GlobalSearch";
import { CodeEditor } from "./components/CodeEditor";
import { Chat } from "./components/Chat";
import { Terminal } from "./components/Terminal";
import { useIDEStore, FileNode } from "./store/useIDEStore";
import {
  Layout,
  Play,
  Save,
  Settings,
  Search,
  Code2,
  MessageSquare,
  Share2,
  Cpu,
  Box,
  File as FileIcon,
  FolderPlus,
  FilePlus,
  FolderOpen,
  FileCode,
  ExternalLink,
  History,
  ChevronRight,
  FolderMinus,
  MinusSquare,
  LogOut,
  Undo2,
  Redo2,
  Scissors,
  Copy,
  Clipboard,
  SearchCode,
  Replace,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "./utils/helpers";
import { v4 as uuidv4 } from "uuid";
import * as fileModule from "./modules/file";
import * as editModule from "./modules/edit";

export default function App() {
  const {
    isChatOpen,
    toggleChat,
    activeFileId,
    files,
    activePanel,
    setActivePanel,
    runtimeProjectPath,
    setRuntimeProjectPath,
    addTerminalLog,
    setRunning,
    createFile,
    createFolder,
    importFiles,
    importSingleFile,
    isTerminalOpen,
    toggleTerminal,
    isRunning,
    addTerminal,
    activeTerminalId,
    setActiveTerminal,
    recentProjects,
    addRecentProject,
    validateRecentProjects,
    loadProject,
    closeFolder,
  } = useIDEStore();

  useEffect(() => {
    validateRecentProjects();
  }, []);

  useEffect(() => {
    const { runtimeProjectPath, files, addRecentProject } = useIDEStore.getState();
    if (runtimeProjectPath) {
      const rootFolder = Object.values(files).find((f) => f.parentId === null);
      if (rootFolder) {
        addRecentProject(rootFolder.name, runtimeProjectPath);
      }
    }
  }, [runtimeProjectPath]);

  const [isRecentMenuOpen, setIsRecentMenuOpen] = useState(false);

  useEffect(() => {
    const bc = new BroadcastChannel("noka-ide-channel");
    bc.onmessage = (event) => {
      if (event.data === "exit") {
        window.close();
      }
    };
    return () => bc.close();
  }, []);

  const activeFile = activeFileId ? files[activeFileId] : null;
  const lastStartedPortRef = useRef<number | null>(null);

  const handleRunProject = () => {
    if (!isTerminalOpen) toggleTerminal();

    const rootFolder = Object.values(files).find((f) => f.parentId === null);
    const projectName = rootFolder ? rootFolder.name : "project";

    const packageJsonFile = Object.values(files).find(
      (f) => f.name === "package.json",
    );
    let packageJson: any = null;
    try {
      if (packageJsonFile?.content) {
        packageJson = JSON.parse(packageJsonFile.content);
      }
    } catch (err) {
      console.error("Failed to parse package.json:", err);
    }

    if (isRunning) {
      setRunning(false);
      // In a real terminal, we would need to find the terminal running this and kill it
      // For now, we just update the UI state
    } else {
      const scripts = packageJson?.scripts || {};
      const framework = packageJson?.dependencies?.vite
        ? "vite"
        : packageJson?.dependencies?.next
          ? "next"
          : "unknown";
      const scriptToRun = scripts.dev ? "dev" : scripts.start ? "start" : "dev";

      try {
        // Attempt real runtime via backend WS
        // Require a project path on disk; ask once if absent
        let cwd = runtimeProjectPath || "";
        if (!cwd) {
          const p = window.prompt(
            "Enter local project path to run (absolute path):",
            "C:\\path\\to\\your\\project",
          );
          if (!p) return;
          setRuntimeProjectPath(p);
          cwd = p;
        }
        addTerminalLog(`Starting ${projectName} on a free port...`);
        import("./runtime/RuntimeClient").then(({ RuntimeClient }) => {
          const client = new RuntimeClient();
          client.on((e) => {
            if (e.type === "open") addTerminalLog("Connected to runtime");
            if (e.type === "started") {
              setRunning(true);
              addTerminalLog(`Process started (id=${e.id}) on port ${e.port}`);
              lastStartedPortRef.current = e.port;
            }
            if (e.type === "url") {
              try {
                const idePort = window.location.port || "3000";
                const parsed = new URL(e.url);
                let target = e.url;
                if (parsed.port === idePort || parsed.port === "3000") {
                  if (lastStartedPortRef.current) {
                    target = `http://localhost:${lastStartedPortRef.current}`;
                  }
                }
                addTerminalLog(`Detected server URL: ${target}`);
              } catch {
                addTerminalLog(`Detected server URL: ${e.url}`);
              }
            }
            if (e.type === "log") {
              addTerminalLog(e.data.trimEnd());
            }
            if (e.type === "stopped") {
              setRunning(false);
              addTerminalLog("Server stopped.");
            }
            if (e.type === "error") {
              addTerminalLog(`Runtime error: ${e.message}`);
            }
          });
          client.start(cwd, framework, scriptToRun);
        });
      } catch (e) {
        console.error(e);
        addTerminalLog("Failed to start runtime; falling back to simulation.");
        setRunning(true);
        addTerminal(`Run: npm run ${scriptToRun}`, `npm run ${scriptToRun}`);
      }
    }
  };
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const [isEditMenuOpen, setIsEditMenuOpen] = useState(false);
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const editMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleUndo = () => {
    const bc = new BroadcastChannel("noka-ide-editor-actions");
    bc.postMessage("undo");
    bc.close();
    setIsEditMenuOpen(false);
  };

  const handleRedo = () => {
    const bc = new BroadcastChannel("noka-ide-editor-actions");
    bc.postMessage("redo");
    bc.close();
    setIsEditMenuOpen(false);
  };

  const handleCut = () => {
    const bc = new BroadcastChannel("noka-ide-editor-actions");
    bc.postMessage("cut");
    bc.close();
    setIsEditMenuOpen(false);
  };

  const handleCopy = () => {
    const bc = new BroadcastChannel("noka-ide-editor-actions");
    bc.postMessage("copy");
    bc.close();
    setIsEditMenuOpen(false);
  };

  const firstRoot = Object.values(files).find((f) => f.parentId === null);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    await fileModule.handleFileChange(event, firstRoot?.id || null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFolderChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    await fileModule.handleFolderChange(event);
    if (folderInputRef.current) folderInputRef.current.value = "";
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        fileMenuRef.current &&
        !fileMenuRef.current.contains(event.target as Node)
      ) {
        setIsFileMenuOpen(false);
      }
      if (
        editMenuRef.current &&
        !editMenuRef.current.contains(event.target as Node)
      ) {
        setIsEditMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-200 overflow-hidden font-sans selection:bg-blue-500/30">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
        multiple
      />
      <input
        type="file"
        ref={folderInputRef}
        className="hidden"
        onChange={handleFolderChange}
        // @ts-ignore
        webkitdirectory=""
        directory=""
      />

      {/* Top Bar */}
      <header className="h-12 border-b border-white/5 flex items-center justify-between px-4 bg-slate-950 z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Box size={18} className="text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">
              Noka<span className="text-blue-500">IDE</span>
            </span>
          </div>

          <div className="h-4 w-px bg-white/10 mx-2" />

          <div className="flex items-center gap-1 text-xs text-slate-400">
            <div className="relative" ref={fileMenuRef}>
              <span
                className={cn(
                  "hover:text-slate-200 cursor-pointer transition-colors px-2 py-1 rounded",
                  isFileMenuOpen && "text-slate-200 bg-white/5",
                )}
                onClick={() => setIsFileMenuOpen(!isFileMenuOpen)}
              >
                File
              </span>

              <AnimatePresence>
                {isFileMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute top-full left-0 mt-1 w-48 bg-slate-900 border border-white/10 rounded-lg shadow-2xl py-1 z-[100]"
                  >
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center gap-2 transition-colors"
                      onClick={() => { fileModule.createNewWindow(); setIsFileMenuOpen(false); }}
                    >
                      <ExternalLink size={14} className="text-blue-400" />
                      <span>New Window</span>
                    </button>
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center gap-2 transition-colors group relative"
                      onMouseEnter={() => setIsRecentMenuOpen(true)}
                      onMouseLeave={() => setIsRecentMenuOpen(false)}
                    >
                      <History size={14} className="text-blue-400" />
                      <span>Open Recent</span>
                      <ChevronRight size={14} className="ml-auto text-slate-500" />
                      
                      {isRecentMenuOpen && (
                        <div className="absolute left-full top-0 ml-1 w-64 bg-slate-900 border border-white/10 rounded-lg shadow-2xl py-1 z-[110]">
                          {recentProjects.length > 0 ? (
                            recentProjects.map((project) => (
                              <button
                                key={project.path}
                                className="w-full text-left px-3 py-2 hover:bg-white/5 flex flex-col gap-0.5 transition-colors"
                                onClick={async () => {
                                  await fileModule.openRecentProject(project);
                                  setIsFileMenuOpen(false);
                                  setIsRecentMenuOpen(false);
                                }}
                              >
                                <span className="text-[11px] font-medium text-slate-200 truncate">
                                  {project.name}
                                </span>
                                <span className="text-[9px] text-slate-500 truncate font-mono">
                                  {project.path}
                                </span>
                                <span className="text-[8px] text-slate-600">
                                  {new Date(project.lastOpened).toLocaleString()}
                                </span>
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-[10px] text-slate-500 italic">
                              No recent projects
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                    <div className="h-px bg-white/5 my-1" />
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center gap-2 transition-colors"
                      onClick={() => { fileModule.createNewFile(firstRoot?.id || null); setIsFileMenuOpen(false); }}
                    >
                      <FilePlus size={14} className="text-blue-400" />
                      <span>New File</span>
                    </button>
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center gap-2 transition-colors"
                      onClick={() => { fileModule.createNewFolder(firstRoot?.id || null); setIsFileMenuOpen(false); }}
                    >
                      <FolderPlus size={14} className="text-blue-400" />
                      <span>New Folder</span>
                    </button>
                    <div className="h-px bg-white/5 my-1" />
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center gap-2 transition-colors"
                      onClick={() => { fileModule.openFile(fileInputRef, setIsFileMenuOpen); }}
                    >
                      <FileCode size={14} className="text-purple-400" />
                      <span>Open File...</span>
                    </button>
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center gap-2 transition-colors"
                      onClick={() => { fileModule.openFolder(folderInputRef); setIsFileMenuOpen(false); }}
                    >
                      <FolderOpen size={14} className="text-purple-400" />
                      <span>Open Folder...</span>
                    </button>
                    <div className="h-px bg-white/5 my-1" />
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center gap-2 transition-colors text-red-400 hover:text-red-300"
                      onClick={() => {
                        fileModule.closeFolder();
                        setIsFileMenuOpen(false);
                      }}
                    >
                      <FolderMinus size={14} />
                      <span>Close Folder</span>
                    </button>
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center gap-2 transition-colors text-red-400 hover:text-red-300"
                      onClick={() => {
                        fileModule.closeWindow();
                        setIsFileMenuOpen(false);
                      }}
                    >
                      <MinusSquare size={14} />
                      <span>Close Window</span>
                    </button>
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center gap-2 transition-colors text-red-400 hover:text-red-300 font-bold"
                      onClick={() => {
                        fileModule.exit();
                        setIsFileMenuOpen(false);
                      }}
                    >
                      <LogOut size={14} />
                      <span>Exit</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <span className="mx-1 opacity-20">/</span>
            <div className="relative" ref={editMenuRef}>
              <span
                className={cn(
                  "hover:text-slate-200 cursor-pointer transition-colors px-2 py-1 rounded",
                  isEditMenuOpen && "text-slate-200 bg-white/5",
                )}
                onClick={() => setIsEditMenuOpen(!isEditMenuOpen)}
              >
                Edit
              </span>

              <AnimatePresence>
                {isEditMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute top-full left-0 mt-1 w-48 bg-slate-900 border border-white/10 rounded-lg shadow-2xl py-1 z-[100]"
                  >
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center justify-between transition-colors"
                      onClick={() => { editModule.undo(); setIsEditMenuOpen(false); }}
                    >
                      <div className="flex items-center gap-2">
                        <Undo2 size={14} className="text-blue-400" />
                        <span>Undo</span>
                      </div>
                      <span className="text-[10px] text-slate-500">Ctrl+Z</span>
                    </button>
                    <button
                       className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center justify-between transition-colors"
                       onClick={() => { editModule.redo(); setIsEditMenuOpen(false); }}
                     >
                       <div className="flex items-center gap-2">
                         <Redo2 size={14} className="text-blue-400" />
                         <span>Redo</span>
                       </div>
                       <span className="text-[10px] text-slate-500">Ctrl+Y</span>
                    </button>
                    <div className="h-px bg-white/5 my-1" />
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center justify-between transition-colors"
                      onClick={() => { editModule.cut(); setIsEditMenuOpen(false); }}
                    >
                      <div className="flex items-center gap-2">
                        <Scissors size={14} className="text-blue-400" />
                        <span>Cut</span>
                      </div>
                      <span className="text-[10px] text-slate-500">Ctrl+X</span>
                    </button>
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center justify-between transition-colors"
                      onClick={() => { editModule.copy(); setIsEditMenuOpen(false); }}
                    >
                      <div className="flex items-center gap-2 text-slate-200">
                        <Copy size={14} className="text-blue-400" />
                        <span>Copy</span>
                      </div>
                      <span className="text-[10px] text-slate-500">Ctrl+C</span>
                    </button>
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center justify-between transition-colors"
                      onClick={() => { editModule.paste(); setIsEditMenuOpen(false); }}
                    >
                      <div className="flex items-center gap-2 text-slate-200">
                        <Clipboard size={14} className="text-blue-400" />
                        <span>Paste</span>
                      </div>
                      <span className="text-[10px] text-slate-500">Ctrl+V</span>
                    </button>
                    <div className="h-px bg-white/5 my-1" />
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center justify-between transition-colors"
                      onClick={() => { editModule.find(); setIsEditMenuOpen(false); }}
                     >
                       <div className="flex items-center gap-2">
                         <SearchCode size={14} className="text-blue-400" />
                         <span>Find</span>
                       </div>
                       <span className="text-[10px] text-slate-500">Ctrl+F</span>
                    </button>
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center justify-between transition-colors"
                      onClick={() => { editModule.findInFiles(); setIsEditMenuOpen(false); }}
                    >
                      <div className="flex items-center gap-2">
                          <Search size={14} className="text-blue-400" />
                          <span>Find in Files</span>
                        </div>
                        <span className="text-[10px] text-slate-500">Ctrl+Shift+F</span>
                      </button>
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center justify-between transition-colors"
                      onClick={() => { editModule.replaceInFiles(); setIsEditMenuOpen(false); }}
                    >
                      <div className="flex items-center gap-2">
                        <Replace size={14} className="text-blue-400" />
                        <span>Replace in Files</span>
                      </div>
                      <span className="text-[10px] text-slate-500">Ctrl+Shift+H</span>
                    </button>
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center justify-between transition-colors"
                      onClick={() => { editModule.replace(); setIsEditMenuOpen(false); }}
                     >
                       <div className="flex items-center gap-2">
                          <Replace size={14} className="text-blue-400" />
                          <span>Replace</span>
                       </div>
                       <span className="text-[10px] text-slate-500">Ctrl+H</span>
                     </button>
                   </motion.div>
                )}
              </AnimatePresence>
            </div>
            <span className="mx-1 opacity-20">/</span>
            <span className="hover:text-slate-200 cursor-pointer transition-colors px-2 py-1">
              View
            </span>
            <span className="mx-1 opacity-20">/</span>
            <span className="hover:text-slate-200 cursor-pointer transition-colors px-2 py-1">
              Go
            </span>
          </div>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/5 text-xs text-slate-400">
          <Cpu size={14} className="text-blue-400" />
          <span>{activeFile ? activeFile.name : "No file selected"}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="p-2 hover:bg-white/5 rounded-lg text-slate-400 transition-colors"
            title="Search"
          >
            <Search size={18} />
          </button>
          <button
            className="p-2 hover:bg-white/5 rounded-lg text-slate-400 transition-colors"
            title="Settings"
          >
            <Settings size={18} />
          </button>
          <div className="h-6 w-px bg-white/10 mx-1" />
          <button
            onClick={handleRunProject}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shadow-lg",
              isRunning
                ? "bg-red-600 hover:bg-red-500 text-white shadow-red-500/20"
                : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20",
            )}
          >
            {isRunning ? (
              <>
                <X size={14} />
                Stop
              </>
            ) : (
              <>
                <Play size={14} fill="currentColor" />
                Run
              </>
            )}
          </button>
          <button
            className="p-2 hover:bg-white/5 rounded-lg text-slate-400 transition-colors"
            title="Share"
          >
            <Share2 size={18} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Activity Bar */}
        <aside className="w-12 border-r border-white/5 flex flex-col items-center py-4 gap-4 bg-slate-950">
          <button
            className={cn(
              "p-2 transition-colors",
              activePanel === "explorer"
                ? "text-blue-400 bg-blue-500/10 rounded-lg"
                : "text-slate-500 hover:text-slate-300",
            )}
            onClick={() => setActivePanel("explorer")}
            title="Explorer"
          >
            <Layout size={20} />
          </button>
          <button
            className={cn(
              "p-2 transition-colors",
              activePanel === "extensions"
                ? "text-blue-400 bg-blue-500/10 rounded-lg"
                : "text-slate-500 hover:text-slate-300",
            )}
            onClick={() => setActivePanel("extensions")}
            title="Extensions"
          >
            <Box size={20} />
          </button>
          <button
            className={cn(
              "p-2 transition-colors",
              activePanel === "search"
                ? "text-blue-400 bg-blue-500/10 rounded-lg"
                : "text-slate-500 hover:text-slate-300",
            )}
            onClick={() => setActivePanel("search")}
            title="Search"
          >
            <Search size={20} />
          </button>
          <button
            className="p-2 text-slate-500 hover:text-slate-300 transition-colors"
            title="Source Control"
          >
            <Code2 size={20} />
          </button>
          <button
            className={cn(
              "p-2 transition-colors",
              isTerminalOpen
                ? "text-blue-400 bg-blue-500/10 rounded-lg"
                : "text-slate-500 hover:text-slate-300",
            )}
            onClick={toggleTerminal}
            title="Terminal"
          >
            <Layout size={20} className="rotate-180" />
          </button>
          <button
            className={cn(
              "p-2 transition-colors mt-auto",
              isChatOpen
                ? "text-blue-400 bg-blue-500/10 rounded-lg"
                : "text-slate-500 hover:text-slate-300",
            )}
            onClick={toggleChat}
            title="AI Assistant"
          >
            <MessageSquare size={20} />
          </button>
        </aside>

        {/* Sidebar */}
        {activePanel === "explorer" ? (
          <Sidebar />
        ) : activePanel === "search" ? (
          <GlobalSearch />
        ) : (
          <Extensions />
        )}

        {/* Editor & Terminal Area */}
        <main className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 flex overflow-hidden">
            <CodeEditor />
          </div>
          <AnimatePresence>
            {isTerminalOpen && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <Terminal />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* AI Chat Panel */}
        <AnimatePresence>
          {isChatOpen && (
            <motion.div
              initial={{ x: 320 }}
              animate={{ x: 0 }}
              exit={{ x: 320 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="h-full"
            >
              <Chat />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Status Bar */}
      <footer className="h-6 bg-blue-600 flex items-center justify-between px-3 text-[10px] font-medium text-white/90">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 hover:bg-white/10 px-1 rounded cursor-pointer">
            <Code2 size={10} />
            <span>main*</span>
          </div>
          <div className="flex items-center gap-1 hover:bg-white/10 px-1 rounded cursor-pointer">
            <RefreshCw size={10} className="animate-spin-slow" />
            <span>Syncing...</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hover:bg-white/10 px-1 rounded cursor-pointer">
            Ln 1, Col 1
          </div>
          <div className="hover:bg-white/10 px-1 rounded cursor-pointer">
            UTF-8
          </div>
          <div className="hover:bg-white/10 px-1 rounded cursor-pointer">
            {activeFile?.language || "Plain Text"}
          </div>
          <div className="flex items-center gap-1 hover:bg-white/10 px-1 rounded cursor-pointer">
            <Sparkles size={10} />
            <span>Noka AI Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function RefreshCw({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

function Sparkles({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}
