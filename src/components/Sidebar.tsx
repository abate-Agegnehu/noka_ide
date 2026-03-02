import React, { useState, useRef, useEffect } from 'react';
import { useIDEStore, FileNode } from '../store/useIDEStore';
import { cn, getFileIcon } from '../utils/helpers';
import { ChevronRight, ChevronDown, Plus, FolderPlus, Trash2, Edit2, FolderOpen } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface FileTreeItemProps {
  node: FileNode;
  depth: number;
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({ node, depth }) => {
  const { files, setActiveFile, activeFileId, deleteNode, renameNode, createFile, createFolder, toggleFolderOpen } = useIDEStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(node.name);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const children = Object.values(files).filter(f => f.parentId === node.id);
  const isActive = activeFileId === node.id;
  const isExpanded = node.isOpen || false;

  useEffect(() => {
    if (isEditing) {
      setEditName(node.name);
    }
  }, [isEditing, node.name]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.type === 'folder') {
      toggleFolderOpen(node.id);
    } else {
      setActiveFile(node.id);
    }
  };

  const handleRename = () => {
    if (editName.trim() && editName !== node.name) {
      renameNode(node.id, editName);
    }
    setIsEditing(false);
  };

  const handleDelete = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    const confirmMessage = `Are you sure you want to delete ${node.name}?${
      node.type === 'folder' ? '\n\nThis will permanently delete the folder and all its contents.' : ''
    }`;
    
    if (window.confirm(confirmMessage)) {
      deleteNode(node.id);
      setShowMenu(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRename();
    if (e.key === 'Escape') {
      setEditName(node.name);
      setIsEditing(false);
    }
  };

  return (
    <div className="select-none">
      <div
        className={cn(
          "group flex items-center py-1 px-2 cursor-pointer hover:bg-white/5 transition-colors relative",
          isActive && "bg-blue-500/20 text-blue-400 border-l-2 border-blue-500",
          !isActive && "text-slate-400 hover:text-slate-200"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleToggle}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowMenu(true);
        }}
      >
        <span className="mr-1">
          {node.type === 'folder' ? (
            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
            <span className="w-3.5" />
          )}
        </span>
        <span className="mr-2 text-lg leading-none">
          {getFileIcon(node.name, node.type, isExpanded)}
        </span>
        
        {isEditing ? (
          <input
            autoFocus
            className="bg-slate-800 text-slate-200 px-1 py-0.5 outline-none border border-blue-500 rounded w-full text-sm"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="text-sm truncate flex-1">{node.name}</span>
        )}

        <div className="hidden group-hover:flex items-center gap-0.5 ml-auto pr-1">
          {node.type === 'folder' && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); createFile('new-file.js', node.id); if (!isExpanded) toggleFolderOpen(node.id); }}
                className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-blue-400 transition-colors"
                title="New File"
              >
                <Plus size={14} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); createFolder('new-folder', node.id); if (!isExpanded) toggleFolderOpen(node.id); }}
                className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-blue-400 transition-colors"
                title="New Folder"
              >
                <FolderPlus size={14} />
              </button>
            </>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-yellow-400 transition-colors"
            title="Rename"
          >
            <Edit2 size={14} />
          </button>
          <button 
            onClick={handleDelete}
            className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-red-400 transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {showMenu && (
          <div 
            ref={menuRef}
            className="absolute left-full top-0 ml-1 z-50 bg-slate-900 border border-white/10 rounded-lg shadow-2xl py-1 min-w-[140px]"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 flex items-center gap-2"
              onClick={() => { setIsEditing(true); setShowMenu(false); }}
            >
              <Edit2 size={12} /> Rename
            </button>
            <button 
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-red-500/20 text-red-400 hover:text-red-300 flex items-center gap-2"
              onClick={() => handleDelete()}
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        )}
      </div>

      {node.type === 'folder' && isExpanded && (
        <div>
          {children
            .sort((a, b) => {
              if (a.type === b.type) return a.name.localeCompare(b.name);
              return a.type === 'folder' ? -1 : 1;
            })
            .map(child => (
              <FileTreeItem key={child.id} node={child} depth={depth + 1} />
            ))}
        </div>
      )}
    </div>
  );
};

export const Sidebar: React.FC = () => {
  const { files, sidebarWidth, setSidebarWidth, createFile, createFolder, importFiles } = useIDEStore();
  const firstRoot = Object.values(files).find(f => f.parentId === null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenFolder = async () => {
    // Check if the modern File System Access API is supported
    if ('showDirectoryPicker' in window) {
      try {
        // @ts-ignore
        const directoryHandle = await window.showDirectoryPicker();
        const newFiles: Record<string, FileNode> = {};
        
        const rootId = uuidv4();
        newFiles[rootId] = {
          id: rootId,
          name: directoryHandle.name,
          type: 'folder',
          parentId: null,
          isOpen: true
        };

        const IGNORED_FOLDERS = ['node_modules', '.git', 'dist', 'build', '.next', '.cache'];

        const readDirectory = async (handle: any, parentId: string) => {
          for await (const entry of handle.values()) {
            if (IGNORED_FOLDERS.includes(entry.name)) continue;
            
            const id = uuidv4();
            if (entry.kind === 'file') {
              const file = await entry.getFile();
              const content = await file.text();
              const extension = entry.name.split('.').pop() || 'text';
              const languageMap: Record<string, string> = {
                'js': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
                'jsx': 'javascript', 'html': 'html', 'css': 'css',
                'json': 'json', 'py': 'python', 'md': 'markdown'
              };
              
              newFiles[id] = {
                id,
                name: entry.name,
                type: 'file',
                parentId,
                content,
                language: languageMap[extension] || 'text'
              };
            } else if (entry.kind === 'directory') {
              newFiles[id] = {
                id,
                name: entry.name,
                type: 'folder',
                parentId,
                isOpen: false
              };
              await readDirectory(entry, id);
            }
          }
        };

        await readDirectory(directoryHandle, rootId);
        importFiles(newFiles);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Error opening directory:', err);
          handleFallbackOpen();
        }
      }
    } else {
      handleFallbackOpen();
    }
  };

  const handleFallbackOpen = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    const newFiles: Record<string, FileNode> = {};
    const rootFolderName = fileList[0].webkitRelativePath.split('/')[0] || 'imported-project';
    const rootId = uuidv4();
    
    newFiles[rootId] = {
      id: rootId,
      name: rootFolderName,
      type: 'folder',
      parentId: null,
      isOpen: true
    };

    // Helper to find or create folders in the path
    const folderCache: Record<string, string> = { '': rootId };
    const IGNORED_FOLDERS = ['node_modules', '.git', 'dist', 'build', '.next', '.cache'];
    
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const pathParts = file.webkitRelativePath.split('/');
      
      // Skip files in ignored folders
      if (pathParts.some(part => IGNORED_FOLDERS.includes(part))) continue;
      
      // Remove the root folder name from the path parts
      pathParts.shift();
      
      let currentParentId = rootId;
      let currentPath = '';

      // Create necessary folders
      for (let j = 0; j < pathParts.length - 1; j++) {
        const folderName = pathParts[j];
        currentPath += (currentPath ? '/' : '') + folderName;
        
        if (!folderCache[currentPath]) {
          const folderId = uuidv4();
          newFiles[folderId] = {
            id: folderId,
            name: folderName,
            type: 'folder',
            parentId: currentParentId,
            isOpen: false
          };
          folderCache[currentPath] = folderId;
        }
        currentParentId = folderCache[currentPath];
      }

      // Add the file
      const fileName = pathParts[pathParts.length - 1];
      const content = await file.text();
      const extension = fileName.split('.').pop() || 'text';
      const languageMap: Record<string, string> = {
        'js': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
        'jsx': 'javascript', 'html': 'html', 'css': 'css',
        'json': 'json', 'py': 'python', 'md': 'markdown'
      };

      const fileId = uuidv4();
      newFiles[fileId] = {
        id: fileId,
        name: fileName,
        type: 'file',
        parentId: currentParentId,
        content,
        language: languageMap[extension] || 'text'
      };
    }

    importFiles(newFiles);
    // Clear the input so it can be used again for the same folder
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div 
      className="flex flex-col bg-slate-950 border-r border-white/5 h-full relative"
      style={{ width: `${sidebarWidth}px` }}
    >
      {/* Hidden input for folder fallback */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        // @ts-ignore - webkitdirectory is non-standard but widely supported
        webkitdirectory=""
        directory=""
        onChange={handleFileChange}
      />
      <div className="p-4 flex items-center justify-between border-b border-white/5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Explorer</h2>
        <div className="flex gap-1">
          <button 
            onClick={handleOpenFolder}
            className="p-1.5 hover:bg-white/5 rounded text-slate-400 hover:text-slate-200"
            title="Open Local Folder"
          >
            <FolderOpen size={16} />
          </button>
          <button 
            onClick={() => createFile('new-file.js', firstRoot?.id || null)}
            className="p-1.5 hover:bg-white/5 rounded text-slate-400 hover:text-slate-200"
            title="New File"
          >
            <Plus size={16} />
          </button>
          <button 
            onClick={() => createFolder('new-folder', firstRoot?.id || null)}
            className="p-1.5 hover:bg-white/5 rounded text-slate-400 hover:text-slate-200"
            title="New Folder"
          >
            <FolderPlus size={16} />
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-2">
        {Object.values(files).length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-slate-500 mb-4 italic">No project folders found</p>
            <button 
              onClick={() => createFolder('project', null)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-md transition-colors"
            >
              Create New Project
            </button>
          </div>
        ) : (
          Object.values(files)
            .filter(f => f.parentId === null)
            .map(root => (
              <FileTreeItem key={root.id} node={root} depth={0} />
            ))
        )}
      </div>

      {/* Resize Handle */}
      <div 
        className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-blue-500/50 transition-colors"
        onMouseDown={(e) => {
          const startX = e.clientX;
          const startWidth = sidebarWidth;
          const onMouseMove = (moveEvent: MouseEvent) => {
            const newWidth = Math.max(150, Math.min(500, startWidth + (moveEvent.clientX - startX)));
            setSidebarWidth(newWidth);
          };
          const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
          };
          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
        }}
      />
    </div>
  );
};
