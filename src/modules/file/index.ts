import { v4 as uuidv4 } from "uuid";
import { useIDEStore, FileNode } from "../../store/useIDEStore";

const IGNORED_FOLDERS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".cache",
];

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

const getLanguage = (filename: string): string => {
  const extension = filename.split(".").pop() || "text";
  return languageMap[extension] || "text";
};

export const createNewWindow = () => {
  window.open(window.location.origin + "?session=" + uuidv4(), "_blank");
};

export const openRecentProject = async (project: { name: string; path: string }) => {
  const { loadProject, addRecentProject } = useIDEStore.getState();
  await loadProject(project.path);
  addRecentProject(project.name, project.path);
};

export const createNewFile = (parentId: string | null) => {
  const { createFile } = useIDEStore.getState();
  createFile("new-file.js", parentId);
};

export const createNewFolder = (parentId: string | null) => {
  const { createFolder } = useIDEStore.getState();
  createFolder("new-folder", parentId);
};

export const openFile = (
  fileInputRef: React.RefObject<HTMLInputElement>,
  setOpen: (open: boolean) => void,
) => {
  fileInputRef.current?.click();
  setOpen(false);
};

export const openFolder = async (
  folderInputRef: React.RefObject<HTMLInputElement>,
) => {
  if ("showDirectoryPicker" in window) {
    try {
      // @ts-ignore - File System Access API
      const directoryHandle = await window.showDirectoryPicker();
      const newFiles: Record<string, FileNode> = {};

      const rootId = uuidv4();
      newFiles[rootId] = {
        id: rootId,
        name: directoryHandle.name,
        type: "folder",
        parentId: null,
        isOpen: true,
      };

      const readDirectory = async (handle: any, parentId: string) => {
        for await (const entry of handle.values()) {
          if (IGNORED_FOLDERS.includes(entry.name)) continue;

          const id = uuidv4();
          if (entry.kind === "file") {
            const file = await entry.getFile();
            const content = await file.text();

            newFiles[id] = {
              id,
              name: entry.name,
              type: "file",
              parentId,
              content,
              language: getLanguage(entry.name),
            };
          } else if (entry.kind === "directory") {
            newFiles[id] = {
              id,
              name: entry.name,
              type: "folder",
              parentId,
              isOpen: false,
            };
            await readDirectory(entry, id);
          }
        }
      };

      await readDirectory(directoryHandle, rootId);
      const { importFiles } = useIDEStore.getState();
      importFiles(newFiles);

      const rootFolder = Object.values(newFiles).find(
        (f) => f.parentId === null,
      );
      if (rootFolder) {
        import("../../store/useIDEStore").then(({ useIDEStore }) => {
          useIDEStore.getState().detectProjectPath(rootFolder.name);
        });
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("Error opening directory:", err);
        folderInputRef.current?.click();
      }
    }
  } else {
    folderInputRef.current?.click();
  }
};

export const handleFileChange = async (
  event: React.ChangeEvent<HTMLInputElement>,
  firstRootId: string | null,
) => {
  const fileList = event.target.files;
  if (!fileList || fileList.length === 0) return;

  const { importSingleFile } = useIDEStore.getState();

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const content = await file.text();
    await importSingleFile(file.name, content, firstRootId);
  }
};

export const handleFolderChange = async (
  event: React.ChangeEvent<HTMLInputElement>,
) => {
  const fileList = event.target.files;
  if (!fileList || fileList.length === 0) return;

  const newFiles: Record<string, FileNode> = {};
  const rootFolderName =
    fileList[0].webkitRelativePath.split("/")[0] || "imported-project";
  const rootId = uuidv4();

  newFiles[rootId] = {
    id: rootId,
    name: rootFolderName,
    type: "folder",
    parentId: null,
    isOpen: true,
  };

  const folderCache: Record<string, string> = { "": rootId };

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const pathParts = file.webkitRelativePath.split("/");

    if (pathParts.some((part) => IGNORED_FOLDERS.includes(part))) continue;

    pathParts.shift();

    let currentParentId = rootId;
    let currentPath = "";

    for (let j = 0; j < pathParts.length - 1; j++) {
      const folderName = pathParts[j];
      currentPath += (currentPath ? "/" : "") + folderName;

      if (!folderCache[currentPath]) {
        const folderId = uuidv4();
        newFiles[folderId] = {
          id: folderId,
          name: folderName,
          type: "folder",
          parentId: currentParentId,
          isOpen: false,
        };
        folderCache[currentPath] = folderId;
      }
      currentParentId = folderCache[currentPath];
    }

    const fileName = pathParts[pathParts.length - 1];
    const content = await file.text();

    const fileId = uuidv4();
    newFiles[fileId] = {
      id: fileId,
      name: fileName,
      type: "file",
      parentId: currentParentId,
      content,
      language: getLanguage(fileName),
    };
  }

  const { importFiles } = useIDEStore.getState();
  importFiles(newFiles);

  const rootFolder = Object.values(newFiles).find((f) => f.parentId === null);
  if (rootFolder) {
    import("../../store/useIDEStore").then(({ useIDEStore }) => {
      useIDEStore.getState().detectProjectPath(rootFolder.name);
    });
  }
};

export const closeFolder = () => {
  const { closeFolder } = useIDEStore.getState();
  closeFolder();
};

export const closeWindow = () => {
  if (window.confirm("Are you sure you want to close this window? Any unsaved changes will be lost.")) {
    window.close();
  }
};

export const exit = async () => {
  if (window.confirm("Are you sure you want to exit? This will close all windows and stop all background processes.")) {
    try {
      const bc = new BroadcastChannel("noka-ide-channel");
      bc.postMessage("exit");
      bc.close();

      await fetch("http://localhost:3005/api/shutdown", { method: "POST" });

      window.close();
    } catch (e) {
      console.error("Exit error:", e);
      window.location.href = "about:blank";
    }
  }
};
