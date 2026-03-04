import { create } from "zustand";
import { persist, createJSONStorage, StateStorage } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import { get, set, del } from "idb-keyval";

// Custom storage for Zustand using IndexedDB
const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const value = await get<string>(name);
    return value ?? null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

export type FileType = "file" | "folder";

export interface FileNode {
  id: string;
  name: string;
  type: FileType;
  parentId: string | null;
  content?: string;
  language?: string;
  isOpen?: boolean;
}

export type ActivePanel = "explorer" | "extensions";

export interface ExtensionItem {
  id: string;
  name: string;
  displayName?: string;
  publisher: string;
  version?: string;
  description?: string;
  iconUrl?: string;
  vsixUrl?: string;
  installedAt: number;
  enabled: boolean;
}

export interface RecentProject {
  name: string;
  path: string;
  lastOpened: number;
}

interface IDEState {
  files: Record<string, FileNode>;
  activeFileId: string | null;
  openFileIds: string[];
  sidebarWidth: number;
  isChatOpen: boolean;
  isTerminalOpen: boolean;
  terminalLogs: string[];
  isRunning: boolean;
  terminals: { id: string; name: string; initialCommand?: string }[];
  activeTerminalId: string | null;
  activePanel: ActivePanel;
  installedExtensions: ExtensionItem[];
  marketplaceResults: ExtensionItem[];
  isFetchingMarketplace: boolean;
  formatOnSave: boolean;
  iconTheme: "emoji" | "material";
  runtimeProjectPath?: string | null;
  runtimeProcessId?: string | null;
  runtimeConnected: boolean;
  recentProjects: RecentProject[];

  // Actions
  addRecentProject: (name: string, path: string) => void;
  removeRecentProject: (path: string) => void;
  validateRecentProjects: () => Promise<void>;
  createFile: (
    name: string,
    parentId: string | null,
    content?: string,
  ) => string;
  createFolder: (name: string, parentId: string | null) => string;
  deleteNode: (id: string) => void;
  renameNode: (id: string, newName: string) => void;
  setActiveFile: (id: string | null) => void;
  closeFile: (id: string) => void;
  updateFileContent: (id: string, content: string) => void;
  setSidebarWidth: (width: number) => void;
  toggleChat: () => void;
  toggleTerminal: () => void;
  addTerminalLog: (log: string) => void;
  clearTerminalLogs: () => void;
  setRunning: (isRunning: boolean) => void;
  addTerminal: (name?: string, initialCommand?: string) => string;
  removeTerminal: (id: string) => void;
  setActiveTerminal: (id: string | null) => void;
  setFiles: (files: Record<string, FileNode>) => void;
  toggleFolderOpen: (id: string) => void;
  importFiles: (newFiles: Record<string, FileNode>) => void;
  importSingleFile: (
    name: string,
    content: string,
    parentId: string | null,
  ) => string;
  setActivePanel: (panel: ActivePanel) => void;
  searchMarketplace: (query: string) => Promise<void>;
  installExtension: (
    ext: Omit<ExtensionItem, "installedAt" | "enabled">,
  ) => void;
  uninstallExtension: (extId: string) => void;
  toggleExtensionEnabled: (extId: string) => void;
  downloadExtension: (extId: string) => Promise<void>;
  setFormatOnSave: (v: boolean) => void;
  setIconTheme: (v: "emoji" | "material") => void;
  setRuntimeProjectPath: (p: string | null) => void;
  setRuntimeConnected: (v: boolean) => void;
  setRuntimeProcessId: (id: string | null) => void;
  detectProjectPath: (
    name: string,
    options?: { promptOnFail?: boolean },
  ) => Promise<string | null>;
  loadProject: (path: string) => Promise<void>;
  closeFolder: () => void;
}

const initialFiles: Record<string, FileNode> = {
  root: {
    id: "root",
    name: "project",
    type: "folder",
    parentId: null,
    isOpen: true,
  },
  "index-html": {
    id: "index-html",
    name: "index.html",
    type: "file",
    parentId: "root",
    language: "html",
    content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nova App</title>
    <style>
        body {
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: #0f172a;
            color: white;
        }
        h1 { color: #38bdf8; }
        .card {
            background: rgba(255, 255, 255, 0.05);
            padding: 2rem;
            border-radius: 1rem;
            border: 1px solid rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
        }
    </style>
</head>
<body>
    <div class="card">
        <h1>Welcome to Nova IDE</h1>
        <p>Edit this file to see live changes!</p>
        <div id="app"></div>
    </div>
    <script src="script.js"></script>
</body>
</html>`,
  },
  "script-js": {
    id: "script-js",
    name: "script.js",
    type: "file",
    parentId: "root",
    language: "javascript",
    content: `console.log("Hello from Nova IDE!");

const app = document.getElementById('app');
app.innerHTML = '<p>Current time: ' + new Date().toLocaleTimeString() + '</p>';

setInterval(() => {
    app.innerHTML = '<p>Current time: ' + new Date().toLocaleTimeString() + '</p>';
}, 1000);`,
  },
};

export const useIDEStore = create<IDEState>()(
  persist(
    (set, get) => ({
      files: initialFiles,
      activeFileId: "index-html",
      openFileIds: ["index-html"],
      sidebarWidth: 260,
      isChatOpen: false,
      isTerminalOpen: true,
      terminalLogs: [
        "Nova IDE v1.0.0 initialized.",
        'Type "help" to see available commands.',
      ],
      isRunning: false,
      terminals: [],
      activeTerminalId: null,
      activePanel: "explorer",
      installedExtensions: [],
      marketplaceResults: [],
      isFetchingMarketplace: false,
      formatOnSave: false,
      iconTheme: "emoji",
      runtimeProjectPath: null,
      runtimeProcessId: null,
      runtimeConnected: false,
      recentProjects: [],

      addRecentProject: (name, path) => {
        set((state) => {
          const filtered = state.recentProjects.filter((p) => p.path !== path);
          const newList = [
            { name, path, lastOpened: Date.now() },
            ...filtered,
          ].slice(0, 10); // Keep last 10
          return { recentProjects: newList };
        });
      },

      removeRecentProject: (path) => {
        set((state) => ({
          recentProjects: state.recentProjects.filter((p) => p.path !== path),
        }));
      },

      validateRecentProjects: async () => {
        const { recentProjects, removeRecentProject } = get();
        for (const project of recentProjects) {
          try {
            const res = await fetch("http://localhost:3005/api/validate-path", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ path: project.path }),
            });
            const data = await res.json();
            if (!data.exists) {
              removeRecentProject(project.path);
            }
          } catch (e) {
            console.error("Failed to validate path:", project.path, e);
          }
        }
      },

      createFile: (name, parentId, content = "") => {
        const id = uuidv4();
        const extension = name.split(".").pop() || "text";
        const languageMap: Record<string, string> = {
          js: "javascript",
          ts: "typescript",
          tsx: "typescript",
          jsx: "javascript",
          html: "html",
          css: "css",
          json: "json",
          py: "python",
          md: "markdown",
        };

        const newNode: FileNode = {
          id,
          name,
          type: "file",
          parentId,
          content,
          language: languageMap[extension] || "text",
        };

        set((state) => ({
          files: { ...state.files, [id]: newNode },
          activeFileId: id,
          openFileIds: state.openFileIds.includes(id)
            ? state.openFileIds
            : [...state.openFileIds, id],
        }));
        return id;
      },

      createFolder: (name, parentId) => {
        const id = uuidv4();
        const newNode: FileNode = {
          id,
          name,
          type: "folder",
          parentId,
          isOpen: true,
        };
        set((state) => ({
          files: { ...state.files, [id]: newNode },
        }));
        return id;
      },

      deleteNode: (id) => {
        set((state) => {
          const newFiles = { ...state.files };
          const deletedIds: string[] = [];

          const deleteRecursive = (nodeId: string) => {
            deletedIds.push(nodeId);
            Object.values(state.files).forEach((f) => {
              if (f.parentId === nodeId) deleteRecursive(f.id);
            });
            delete newFiles[nodeId];
          };

          deleteRecursive(id);

          const newOpenFileIds = state.openFileIds.filter(
            (fid) => !deletedIds.includes(fid),
          );
          let newActiveId = state.activeFileId;
          if (state.activeFileId && deletedIds.includes(state.activeFileId)) {
            newActiveId =
              newOpenFileIds.length > 0
                ? newOpenFileIds[newOpenFileIds.length - 1]
                : null;
          }

          return {
            files: newFiles,
            openFileIds: newOpenFileIds,
            activeFileId: newActiveId,
          };
        });
      },

      renameNode: (id, newName) => {
        set((state) => ({
          files: {
            ...state.files,
            [id]: { ...state.files[id], name: newName },
          },
        }));
      },

      setActiveFile: (id) => {
        if (!id) {
          set({ activeFileId: null });
          return;
        }
        set((state) => ({
          activeFileId: id,
          openFileIds: state.openFileIds.includes(id)
            ? state.openFileIds
            : [...state.openFileIds, id],
        }));
      },

      closeFile: (id) => {
        set((state) => {
          const newOpenIds = state.openFileIds.filter((fid) => fid !== id);
          let newActiveId = state.activeFileId;
          if (state.activeFileId === id) {
            newActiveId =
              newOpenIds.length > 0 ? newOpenIds[newOpenIds.length - 1] : null;
          }
          return {
            openFileIds: newOpenIds,
            activeFileId: newActiveId,
          };
        });
      },

      updateFileContent: (id, content) => {
        set((state) => ({
          files: {
            ...state.files,
            [id]: { ...state.files[id], content },
          },
        }));
      },

      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
      toggleTerminal: () =>
        set((state) => ({ isTerminalOpen: !state.isTerminalOpen })),
      addTerminalLog: (log) =>
        set((state) => ({
          terminalLogs: [...state.terminalLogs, log],
        })),
      clearTerminalLogs: () => set({ terminalLogs: [] }),
      setRunning: (isRunning) => set({ isRunning }),
      addTerminal: (name, initialCommand) => {
        const id = uuidv4();
        const terminalName = name || `Terminal ${get().terminals.length + 1}`;
        set((state) => ({
          terminals: [
            ...state.terminals,
            { id, name: terminalName, initialCommand },
          ],
          activeTerminalId: id,
          isTerminalOpen: true,
        }));
        return id;
      },
      removeTerminal: (id) =>
        set((state) => {
          const newTerminals = state.terminals.filter((t) => t.id !== id);
          let newActiveId = state.activeTerminalId;
          if (state.activeTerminalId === id) {
            newActiveId =
              newTerminals.length > 0
                ? newTerminals[newTerminals.length - 1].id
                : null;
          }
          return {
            terminals: newTerminals,
            activeTerminalId: newActiveId,
          };
        }),
      setActiveTerminal: (id) => set({ activeTerminalId: id }),
      setFiles: (files) =>
        set((state) => {
          const fileIds = Object.keys(files);
          const newOpenFileIds = state.openFileIds.filter((id) =>
            fileIds.includes(id),
          );
          let newActiveId = state.activeFileId;
          if (state.activeFileId && !fileIds.includes(state.activeFileId)) {
            newActiveId = newOpenFileIds.length > 0 ? newOpenFileIds[0] : null;
          }
          return {
            files,
            openFileIds: newOpenFileIds,
            activeFileId: newActiveId,
          };
        }),
      toggleFolderOpen: (id) =>
        set((state) => ({
          files: {
            ...state.files,
            [id]: { ...state.files[id], isOpen: !state.files[id].isOpen },
          },
        })),
      importFiles: (newFiles) =>
        set((state) => {
          const fileIds = Object.keys(newFiles);
          const indexHtml = fileIds.find(
            (id) => newFiles[id].name === "index.html",
          );
          return {
            files: newFiles,
            openFileIds: indexHtml ? [indexHtml] : [],
            activeFileId: indexHtml || fileIds[0] || null,
          };
        }),
      importSingleFile: (name, content, parentId) => {
        const id = uuidv4();
        const extension = name.split(".").pop() || "text";
        const languageMap: Record<string, string> = {
          js: "javascript",
          ts: "typescript",
          tsx: "typescript",
          jsx: "javascript",
          html: "html",
          css: "css",
          json: "json",
          py: "python",
          md: "markdown",
        };

        const newNode: FileNode = {
          id,
          name,
          type: "file",
          parentId,
          content,
          language: languageMap[extension] || "text",
        };

        set((state) => ({
          files: { ...state.files, [id]: newNode },
          activeFileId: id,
          openFileIds: state.openFileIds.includes(id)
            ? state.openFileIds
            : [...state.openFileIds, id],
        }));
        return id;
      },
      setActivePanel: (panel) => set({ activePanel: panel }),
      setFormatOnSave: (v) => set({ formatOnSave: v }),
      setIconTheme: (v) => set({ iconTheme: v }),
      setRuntimeProjectPath: (p) => set({ runtimeProjectPath: p }),
      setRuntimeConnected: (v) => set({ runtimeConnected: v }),
      setRuntimeProcessId: (id) => set({ runtimeProcessId: id }),
      detectProjectPath: async (name, options = {}) => {
        try {
          const res = await fetch("http://localhost:3005/api/detect-path", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.path) {
              set({ runtimeProjectPath: data.path });
              return data.path;
            }
          }
        } catch (e) {
          console.error("Failed to detect project path:", e);
        }

        if (options?.promptOnFail) {
          const p = window.prompt(
            "Enter local project path to run (absolute path):",
            "C:\\path\\to\\your\\project",
          );
          if (p) {
            set({ runtimeProjectPath: p });
            return p;
          }
        }
        return null;
      },
      loadProject: async (path: string) => {
        try {
          const res = await fetch("http://localhost:3005/api/get-project-files", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.files) {
              set({
                files: data.files,
                runtimeProjectPath: path,
                activeFileId: null,
                openFileIds: [],
              });
              // Find first file to open if any
              const firstFile = Object.values(data.files as Record<string, FileNode>).find(f => f.type === 'file');
              if (firstFile) {
                set({
                  activeFileId: firstFile.id,
                  openFileIds: [firstFile.id]
                });
              }
            }
          } else {
            console.error("Failed to load project files");
          }
        } catch (e) {
          console.error("Error loading project:", e);
        }
      },
      closeFolder: () => {
        set({
          files: initialFiles,
          activeFileId: "index-html",
          openFileIds: ["index-html"],
          runtimeProjectPath: null,
          isRunning: false,
        });
      },
      searchMarketplace: async (query: string) => {
        set({ isFetchingMarketplace: true });
        try {
          const q = query && query.trim().length > 0 ? query.trim() : "popular";
          async function searchOnce(term: string): Promise<ExtensionItem[]> {
            const res = await fetch(
              `https://open-vsx.org/api/-/search?size=24&sortBy=downloadCount&query=${encodeURIComponent(term)}`,
            );
            if (!res.ok) return [];
            const items: any[] = await res.json();
            return (Array.isArray(items) ? items : []).map((it) => {
              const publisher =
                safeString(it.namespace) ||
                safeString(it.publisher) ||
                "unknown";
              const name = safeString(it.name) || "unknown";
              const id = `${publisher}.${name}`;
              const displayName =
                safeString(it.displayName) || safeString(it.title) || name;
              const description = safeString(it.description);
              const version =
                safeString(it.version) || safeString(it.latestVersion);
              const iconUrl = safeString(it.icon) || safeString(it.iconUrl);
              return {
                id,
                name,
                displayName,
                publisher,
                version,
                description,
                iconUrl,
                installedAt: 0,
                enabled: false,
              };
            });
          }
          let results: ExtensionItem[] = await searchOnce(q);
          if (results.length === 0) {
            if (!q.includes(" ")) {
              const fallbacks = [
                `${q} formatter`,
                `${q} format`,
                `format`,
                `formatter`,
              ];
              for (const f of fallbacks) {
                const more = await searchOnce(f);
                if (more.length > 0) {
                  results = more;
                  break;
                }
              }
            }
            if (results.length === 0) {
              try {
                const msResults = await searchVsMarketplace(q);
                if (msResults.length > 0) results = msResults;
              } catch {}
            }
            if (results.length === 0 && /prettier/i.test(q)) {
              results = [
                {
                  id: "esbenp.prettier-vscode",
                  name: "prettier-vscode",
                  displayName: "Prettier - Code formatter",
                  publisher: "esbenp",
                  version: undefined,
                  description: "Code formatter using Prettier",
                  iconUrl:
                    "https://raw.githubusercontent.com/prettier/prettier-logo/master/images/prettier-icon.png",
                  vsixUrl: undefined,
                  installedAt: 0,
                  enabled: false,
                },
              ];
            }
          }
          const dedup: Record<string, ExtensionItem> = {};
          results.forEach((r) => {
            dedup[r.id] = r;
          });
          set({
            marketplaceResults: Object.values(dedup),
            isFetchingMarketplace: false,
          });
        } catch {
          set({ marketplaceResults: [], isFetchingMarketplace: false });
        }
      },
      installExtension: (ext) => {
        set((state) => {
          if (state.installedExtensions.find((e) => e.id === ext.id)) {
            return {};
          }
          const item: ExtensionItem = {
            ...ext,
            installedAt: Date.now(),
            enabled: true,
          };
          const installedExtensions = [...state.installedExtensions, item];
          const iconTheme = computeIconTheme(installedExtensions);
          return { installedExtensions, iconTheme };
        });
      },
      uninstallExtension: (extId) => {
        set((state) => {
          const installedExtensions = state.installedExtensions.filter(
            (e) => e.id !== extId,
          );
          const iconTheme = computeIconTheme(installedExtensions);
          return { installedExtensions, iconTheme };
        });
      },
      toggleExtensionEnabled: (extId) => {
        set((state) => {
          const installedExtensions = state.installedExtensions.map((e) =>
            e.id === extId ? { ...e, enabled: !e.enabled } : e,
          );
          const iconTheme = computeIconTheme(installedExtensions);
          return { installedExtensions, iconTheme };
        });
      },
      downloadExtension: async (extId) => {
        const state = get();
        const ext =
          state.installedExtensions.find((e) => e.id === extId) ||
          state.marketplaceResults.find((e) => e.id === extId);
        if (!ext) return;
        try {
          let url = ext.vsixUrl;
          if (!url) {
            url = await resolveVsixUrl(ext.publisher, ext.name);
          }
          if (!url) {
            const ms = await resolveVsixFromMarketplace(
              ext.publisher,
              ext.name,
            );
            if (ms) url = ms;
          }
          if (!url && ext.id === "esbenp.prettier-vscode") {
            try {
              const r = await fetch(
                "https://api.github.com/repos/prettier/prettier-vscode/releases/latest",
              );
              if (r.ok) {
                const data = await r.json();
                const assets: any[] = data?.assets || [];
                const vsix = assets.find(
                  (a) =>
                    typeof a?.browser_download_url === "string" &&
                    a.browser_download_url.endsWith(".vsix"),
                );
                if (vsix?.browser_download_url) url = vsix.browser_download_url;
              }
            } catch {}
          }
          if (!url) {
            state.addTerminalLog?.(`Unable to resolve VSIX for ${ext.id}`);
            return;
          }
          const res = await fetch(url);
          if (!res.ok) {
            state.addTerminalLog?.(`Download failed for ${ext.id}`);
            return;
          }
          const blob = await res.blob();
          const a = document.createElement("a");
          const objectUrl = URL.createObjectURL(blob);
          const fileName = `${ext.publisher}.${ext.name}-${ext.version || "latest"}.vsix`;
          a.href = objectUrl;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(objectUrl);
          state.addTerminalLog?.(`Downloaded ${fileName}`);
        } catch {
          state.addTerminalLog?.(`Download error for ${ext.id}`);
        }
      },
    }),
    {
      name:
        new URLSearchParams(window.location.search).get("session") ||
        "nova-ide-storage",
      storage: createJSONStorage(() => idbStorage),
    },
  ),
);

function safeString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function computeIconTheme(installed: ExtensionItem[]): "emoji" | "material" {
  const hasMaterial = installed.some((e) => {
    const id = (e.id || "").toLowerCase();
    const name = (e.name || "").toLowerCase();
    const dn = (e.displayName || "").toLowerCase();
    const pub = (e.publisher || "").toLowerCase();
    return (
      e.enabled &&
      (id.includes("material-icon-theme") ||
        dn.includes("material icon theme") ||
        (pub === "pkief" &&
          (name.includes("material") || dn.includes("material"))))
    );
  });
  return hasMaterial ? "material" : "emoji";
}

async function resolveVsixUrl(
  publisher: string,
  name: string,
): Promise<string | undefined> {
  try {
    const res = await fetch(
      `https://open-vsx.org/api/${encodeURIComponent(publisher)}/${encodeURIComponent(name)}/latest`,
    );
    if (!res.ok) return undefined;
    const data = await res.json();
    const files = data?.files || data?.assets || {};
    const dl = files.download || files.vsix;
    if (typeof dl === "string") return dl;
    return undefined;
  } catch {
    return undefined;
  }
}

async function searchVsMarketplace(query: string): Promise<ExtensionItem[]> {
  try {
    const body = {
      filters: [
        {
          criteria: [
            { filterType: 10, value: query },
            { filterType: 12, value: "Microsoft.VisualStudio.Code" },
          ],
          pageNumber: 1,
          pageSize: 24,
          sortBy: 0,
          sortOrder: 0,
        },
      ],
      assetTypes: [],
      flags: 914,
    };
    const res = await fetch(
      "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json;api-version=7.1-preview.1",
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) return [];
    const data = await res.json();
    const exts: any[] = data?.results?.[0]?.extensions || [];
    const out: ExtensionItem[] = exts.map((e) => {
      const publisher = e?.publisher?.publisherName || "unknown";
      const name = e?.extensionName || "extension";
      const id = `${publisher}.${name}`;
      const displayName = e?.displayName || name;
      const description = e?.shortDescription || "";
      const version = e?.versions?.[0]?.version;
      let iconUrl: string | undefined;
      try {
        const files: any[] = e?.versions?.[0]?.files || [];
        const icon = files.find(
          (f) =>
            typeof f?.assetType === "string" &&
            f.assetType.toLowerCase().includes("icon"),
        );
        iconUrl = icon?.source;
      } catch {}
      let vsixUrl: string | undefined;
      try {
        const files: any[] = e?.versions?.[0]?.files || [];
        const vsix = files.find(
          (f) => f.assetType === "Microsoft.VisualStudio.Services.VSIXPackage",
        );
        vsixUrl = vsix?.source;
      } catch {}
      return {
        id,
        name,
        displayName,
        publisher,
        version,
        description,
        iconUrl,
        vsixUrl,
        installedAt: 0,
        enabled: false,
      };
    });
    return out;
  } catch {
    return [];
  }
}

async function resolveVsixFromMarketplace(
  publisher: string,
  name: string,
): Promise<string | undefined> {
  const items = await searchVsMarketplace(`${publisher}.${name}`);
  const match = items.find(
    (i) =>
      i.publisher.toLowerCase() === publisher.toLowerCase() &&
      i.name.toLowerCase() === name.toLowerCase(),
  );
  return match?.vsixUrl;
}
