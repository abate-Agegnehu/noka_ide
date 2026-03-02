import React from 'react';
import Editor from '@monaco-editor/react';
import { useIDEStore } from '../store/useIDEStore';
import { X } from 'lucide-react';
import { cn, getFileIcon } from '../utils/helpers';

export const CodeEditor: React.FC = () => {
  const { files, activeFileId, openFileIds, setActiveFile, closeFile, updateFileContent } = useIDEStore();
  const activeFile = activeFileId ? files[activeFileId] : null;

  if (!activeFileId || !activeFile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 text-slate-500">
        <div className="text-6xl mb-4 opacity-10">Nova</div>
        <p className="text-sm">Select a file to start editing</p>
        <div className="mt-8 grid grid-cols-2 gap-4 text-xs">
          <div className="p-4 border border-white/5 rounded-lg bg-white/5">
            <p className="font-semibold mb-1 text-slate-400">Quick Start</p>
            <p>Ctrl + P: Search files</p>
            <p>Ctrl + S: Save changes</p>
          </div>
          <div className="p-4 border border-white/5 rounded-lg bg-white/5">
            <p className="font-semibold mb-1 text-slate-400">AI Assistant</p>
            <p>Ctrl + L: Open Chat</p>
            <p>Ask to generate code</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
      {/* Tabs */}
      <div className="flex bg-slate-950 border-b border-white/5 overflow-x-auto no-scrollbar">
        {openFileIds.map(id => {
          const file = files[id];
          if (!file) return null;
          const isActive = activeFileId === id;
          return (
            <div
              key={id}
              className={cn(
                "group flex items-center px-3 py-2 min-w-[120px] max-w-[200px] border-r border-white/5 cursor-pointer transition-colors relative",
                isActive ? "bg-slate-900 text-slate-200" : "bg-slate-950 text-slate-500 hover:bg-slate-900/50 hover:text-slate-400"
              )}
              onClick={() => setActiveFile(id)}
            >
              <span className="mr-2 text-sm">{getFileIcon(file.name, 'file')}</span>
              <span className="text-xs truncate flex-1">{file.name}</span>
              <button
                className={cn(
                  "ml-2 p-0.5 rounded hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity",
                  isActive && "opacity-100"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  closeFile(id);
                }}
              >
                <X size={12} />
              </button>
              {isActive && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500" />}
            </div>
          );
        })}
      </div>

      {/* Editor */}
      <div className="flex-1 relative">
        <Editor
          height="100%"
          language={activeFile.language || 'javascript'}
          theme="vs-dark"
          value={activeFile.content}
          onChange={(value) => updateFileContent(activeFile.id, value || '')}
          options={{
            minimap: { enabled: true },
            fontSize: 14,
            fontFamily: "'JetBrains Mono', monospace",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 16 },
            cursorBlinking: 'smooth',
            smoothScrolling: true,
            lineHeight: 1.6,
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true },
          }}
          loading={<div className="flex items-center justify-center h-full text-slate-500">Loading Editor...</div>}
        />
      </div>
    </div>
  );
};
