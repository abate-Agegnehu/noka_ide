import React, { useState, useEffect, useMemo } from 'react';
import { useIDEStore } from '../store/useIDEStore';
import { RefreshCw, ExternalLink, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '../utils/helpers';
import * as Babel from '@babel/standalone';

export const Preview: React.FC = () => {
  const { files, previewWidth, setPreviewWidth, isRunning, previewUrl, setPreviewUrl } = useIDEStore();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSimulated, setIsSimulated] = useState(true);
  const [key, setKey] = useState(0);
  const [urlInput, setUrlInput] = useState(previewUrl);

  useEffect(() => {
    setUrlInput(previewUrl);
  }, [previewUrl]);

  // Update previewUrl when input changes (debounced or on blur)
  const handleUrlBlur = () => {
    setPreviewUrl(urlInput);
  };

  const handleUrlKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setPreviewUrl(urlInput);
    }
  };

  // Simple sandbox logic: find index.html and inject other files
  const [sandboxContent, setSandboxContent] = useState('');

  useEffect(() => {
    if (!isRunning) {
      setSandboxContent('');
      return;
    }

    const allFiles = Object.values(files);
    
    // Check if it's a Next.js project
    const packageJsonFile = allFiles.find(f => f.name === 'package.json');
    let isNextJs = false;
    try {
      if (packageJsonFile?.content) {
        const pkg = JSON.parse(packageJsonFile.content);
        isNextJs = !!pkg.dependencies?.next;
      }
    } catch (e) {}

    let indexHtml = allFiles.find(f => f.name === 'index.html' && f.parentId === 'root');
    // If we are in a subfolder (like wecode_vite), try to find index.html there
    if (!indexHtml) {
      // Try to find index.html in any folder that has a package.json (likely a project root)
      const projectRoots = allFiles.filter(f => f.name === 'package.json').map(f => f.parentId);
      indexHtml = allFiles.find(f => f.name === 'index.html' && projectRoots.includes(f.parentId));
    }
    if (!indexHtml) indexHtml = allFiles.find(f => f.name === 'index.html');
    
    if (!indexHtml) {
      if (isNextJs) {
        setSandboxContent('<html><body style="background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; text-align: center;"><div><h1 style="color: #38bdf8;">Next.js Project Detected</h1><p>Next.js requires a server-side runtime. <br/>In this preview, we simulate the static output.</p><p style="font-size: 0.8rem; color: #64748b;">(Full Next.js SSR support is coming soon!)</p></div></body></html>');
      } else {
        setSandboxContent('<html><body style="background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;"><div><h1>No index.html found</h1><p>Create an index.html file to see a preview.</p></div></body></html>');
      }
      return;
    }

    // Identify project root (where package.json is)
    const packageJsonFiles = allFiles.filter(f => f.name === 'package.json');
    const projectRootId = packageJsonFiles.length > 0 ? packageJsonFiles[0].parentId : 'root';

    // Helper to get path relative to project root
    const getPathFromRoot = (fileId: string, rootId: string | null): string => {
      if (fileId === rootId) return '';
      const file = files[fileId];
      if (!file) return '';
      if (!file.parentId || file.parentId === rootId) return file.name;
      const parentPath = getPathFromRoot(file.parentId, rootId);
      return parentPath ? `${parentPath}/${file.name}` : file.name;
    };

    // Create Blob URLs for all JS/TS/JSX/TSX and CSS files to support imports
    const fileBlobs: Record<string, string> = {};
    const scriptFiles = allFiles.filter(f => 
      f.name.endsWith('.js') || f.name.endsWith('.jsx') || 
      f.name.endsWith('.ts') || f.name.endsWith('.tsx') ||
      f.name.endsWith('.css')
    );

    scriptFiles.forEach(f => {
      let content = f.content || '';
      let type = 'text/javascript';
      if (f.name.endsWith('.css')) {
        type = 'text/css';
      } else if (f.name.endsWith('.jsx') || f.name.endsWith('.tsx') || f.name.endsWith('.ts')) {
        try {
          // Transpile code using Babel before creating Blob URL
          const result = Babel.transform(content, {
            presets: [
              ['react', { runtime: 'automatic' }],
              'typescript'
            ],
            filename: f.name,
            sourceMaps: 'inline'
          });
          content = result.code || '';
        } catch (err) {
          console.error(`Babel transpilation error in ${f.name}:`, err);
        }
      }
      
      const blob = new Blob([content], { type });
      const fullPath = getPathFromRoot(f.id, projectRootId);
      fileBlobs[fullPath] = URL.createObjectURL(blob);
    });

    // Cleanup Blobs on next run
    const cleanup = () => {
      Object.values(fileBlobs).forEach(URL.revokeObjectURL);
    };

    let content = indexHtml.content || '';

    // Inject CSS
    const cssFiles = allFiles.filter(f => f.name.endsWith('.css'));
    const cssInjections = cssFiles.map(f => `<style data-filename="${f.name}">${f.content}</style>`).join('\n');
    
    if (content.includes('</head>')) {
      content = content.replace('</head>', `${cssInjections}\n</head>`);
    } else {
      content = `<head>${cssInjections}</head>\n${content}`;
    }

    // Inject JS/TS/JSX/TSX
    scriptFiles.forEach(f => {
      const escapedName = f.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const scriptTagRegex = new RegExp(`<script[^>]*src=["'](?:.*?/)?${escapedName}["'][^>]*></script>`, 'g');
      
      const isTranspiled = f.name.endsWith('.jsx') || f.name.endsWith('.tsx') || f.name.endsWith('.ts');
      
      // Use the transpiled version if available from our blobs creation step
      let scriptContentText = f.content || '';
      if (isTranspiled) {
        try {
          const result = Babel.transform(scriptContentText, {
            presets: [
              ['react', { runtime: 'automatic' }],
              'typescript'
            ],
            filename: f.name,
          });
          scriptContentText = result.code || '';
        } catch (e) {}
      }

      const scriptContent = `<script data-filename="${f.name}" type="module">
        ${scriptContentText}
      </script>`;

      if (scriptTagRegex.test(content)) {
        content = content.replace(scriptTagRegex, scriptContent);
      } else if (['script.js', 'index.js', 'main.js', 'main.tsx', 'index.tsx', 'App.tsx', 'App.jsx', 'main.jsx', 'index.jsx'].includes(f.name)) {
        if (content.includes('</body>')) {
          content = content.replace('</body>', `${scriptContent}\n</body>`);
        } else {
          content += `\n${scriptContent}`;
        }
      }
    });

    // Create an Import Map for local files using Blob URLs
    const localImports: Record<string, string> = {};
    const VIRTUAL_ORIGIN = 'http://localhost:3000';
    
    Object.keys(fileBlobs).forEach(fullPath => {
      const blobUrl = fileBlobs[fullPath];
      const nameWithoutExt = fullPath.replace(/\.(js|jsx|ts|tsx)$/, '');
      
      // 1. Map absolute URLs (most reliable with <base>)
      localImports[`${VIRTUAL_ORIGIN}/${fullPath}`] = blobUrl;
      localImports[`${VIRTUAL_ORIGIN}/${nameWithoutExt}`] = blobUrl;
      
      // 2. Map relative URLs
      localImports[`./${fullPath}`] = blobUrl;
      localImports[`./${nameWithoutExt}`] = blobUrl;
      localImports[fullPath] = blobUrl;
      localImports[nameWithoutExt] = blobUrl;
      
      // 3. Handle src/ prefix removal for convenience
      if (fullPath.startsWith('src/')) {
        const withoutSrc = fullPath.replace('src/', '');
        const nameWithoutExtAndSrc = withoutSrc.replace(/\.(js|jsx|ts|tsx)$/, '');
        localImports[`${VIRTUAL_ORIGIN}/${withoutSrc}`] = blobUrl;
        localImports[`${VIRTUAL_ORIGIN}/${nameWithoutExtAndSrc}`] = blobUrl;
        localImports[`./${withoutSrc}`] = blobUrl;
        localImports[`./${nameWithoutExtAndSrc}`] = blobUrl;
      }
    });

    // Extract dependencies from project's package.json to populate importmap
    const projectDeps: Record<string, string> = {
      "react": "https://esm.sh/react@18?dev",
      "react-dom": "https://esm.sh/react-dom@18?dev",
      "react-dom/client": "https://esm.sh/react-dom@18/client?dev",
      "react/jsx-runtime": "https://esm.sh/react@18/jsx-runtime?dev",
      "react/jsx-dev-runtime": "https://esm.sh/react@18/jsx-dev-runtime?dev",
      "lucide-react": "https://esm.sh/lucide-react"
    };

    try {
      if (packageJsonFile?.content) {
        const pkg = JSON.parse(packageJsonFile.content);
        const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        Object.keys(deps).forEach(dep => {
          if (!projectDeps[dep]) {
            projectDeps[dep] = `https://esm.sh/${dep}`;
            // Also add a trailing-slash entry to support sub-path imports like @mui/material/Tabs
            projectDeps[`${dep}/`] = `https://esm.sh/${dep}/`;
          }
        });
      }
    } catch (e) {}

    const importMap = `
      <script type="importmap">
      {
        "imports": {
          ${Object.entries(projectDeps).map(([k, v]) => `"${k}": "${v}"`).join(',\n          ')},
          ${Object.entries(localImports).map(([k, v]) => `"${k}": "${v}"`).join(',\n          ')}
        }
      }
      </script>
    `;

    const finalErrorHandler = `
      <style>
        #nova-error-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.9);
          color: #ff5555;
          padding: 20px;
          font-family: monospace;
          z-index: 9999;
          display: none;
          overflow: auto;
        }
        #nova-error-overlay h2 { color: #ff5555; margin-top: 0; }
        #nova-error-overlay pre { background: #1a1a1a; padding: 10px; border-radius: 4px; color: #eee; white-space: pre-wrap; word-break: break-all; }
      </style>
      <div id="nova-error-overlay">
        <h2>Runtime Error</h2>
        <pre id="nova-error-content"></pre>
      </div>
      <script>
        window.onerror = function(msg, url, line, col, error) {
          const overlay = document.getElementById('nova-error-overlay');
          const content = document.getElementById('nova-error-content');
          if (overlay && content) {
            overlay.style.display = 'block';
            content.textContent = msg + "\\nat " + line + ":" + col + (url ? "\\nin " + url : "");
          }
          console.error("Sandbox Error: ", msg, url, line, col, error);
          return false;
        };
        window.onunhandledrejection = function(event) {
          const overlay = document.getElementById('nova-error-overlay');
          const content = document.getElementById('nova-error-content');
          if (overlay && content) {
            overlay.style.display = 'block';
            content.textContent = "Unhandled Promise Rejection: " + event.reason;
          }
          console.error("Sandbox Promise Rejection: ", event.reason);
        };
      </script>
    `;

    if (content.includes('<head>')) {
      content = content.replace('<head>', `<head>\n<base href="http://localhost:3000/">\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n${importMap}\n${finalErrorHandler}`);
    } else {
      content = `<base href="http://localhost:3000/">\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n${importMap}\n${finalErrorHandler}\n${content}`;
    }
 
    setSandboxContent(content);
    return cleanup;
  }, [files, isRunning]);

  const handleRefresh = () => setKey(prev => prev + 1);

  return (
    <div 
      className={cn(
        "flex flex-col bg-white border-l border-white/5 h-full relative transition-all",
        isFullscreen ? "fixed inset-0 z-[100] w-full!" : ""
      )}
      style={{ width: isFullscreen ? '100%' : `${previewWidth}px` }}
    >
      <div className="flex items-center justify-between px-4 py-2 bg-slate-100 border-b border-slate-200">
        <div className="flex items-center gap-2 flex-1">
          <div className="flex gap-1.5 mr-2">
            <div className={cn("w-3 h-3 rounded-full", isRunning ? "bg-green-500 animate-pulse" : "bg-red-400")} />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-blue-400" />
          </div>
          <div className="flex-1 max-w-md bg-white border border-slate-300 rounded px-2 py-0.5 flex items-center gap-2 shadow-inner group relative">
            <input 
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onBlur={handleUrlBlur}
              onKeyDown={handleUrlKeyDown}
              className="text-[10px] text-slate-600 font-mono w-full bg-transparent outline-none"
              placeholder="Enter preview URL..."
            />
            <div className="h-3 w-[1px] bg-slate-200" />
            <span className="text-[10px] text-slate-400 truncate font-mono select-none">
              {isRunning ? '/' : ''}
            </span>
            <div className="hidden group-hover:block absolute top-full left-0 mt-2 p-2 bg-slate-800 text-white text-[9px] rounded shadow-xl z-50 w-64">
              Enter the actual URL of your project's development server (e.g., http://localhost:5173).
            </div>
          </div>
          {isRunning && (
            <button
              onClick={() => setIsSimulated(!isSimulated)}
              className={cn(
                "text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tight transition-colors",
                isSimulated ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600"
              )}
              title={isSimulated ? "Switch to real server URL" : "Switch to browser simulation"}
            >
              {isSimulated ? "Simulated" : "Live Server"}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 ml-2">
          <button 
            onClick={handleRefresh}
            className="p-1.5 hover:bg-slate-200 rounded text-slate-500 transition-colors disabled:opacity-30"
            title="Refresh"
            disabled={!isRunning}
          >
            <RefreshCw size={14} />
          </button>
          <button 
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 hover:bg-slate-200 rounded text-slate-500 transition-colors"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button 
            className="p-1.5 hover:bg-slate-200 rounded text-slate-500 transition-colors disabled:opacity-30 relative group"
            title="Open in New Tab"
            disabled={!isRunning}
            onClick={() => alert("This project is running in a browser-simulated environment. It cannot be opened in a new tab because there is no real local server at port 5173.")}
          >
            <ExternalLink size={14} />
            <div className="hidden group-hover:block absolute top-full right-0 mt-2 p-2 bg-slate-800 text-white text-[9px] rounded shadow-xl z-50 w-40">
              Not available in simulation
            </div>
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white relative overflow-hidden">
        {!isRunning ? (
          <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-6 shadow-xl border border-white/5">
              <ExternalLink size={32} className="text-slate-600" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Development Server Stopped</h3>
            <p className="text-sm max-w-xs leading-relaxed">
              Run <code className="bg-slate-800 px-1.5 py-0.5 rounded text-blue-400 font-mono">npm run dev</code> in the terminal to start the project and see the preview.
            </p>
          </div>
        ) : (
          <iframe
            key={isSimulated ? key : previewUrl}
            title="preview"
            className="w-full h-full border-none bg-white"
            src={isSimulated ? undefined : previewUrl}
            srcDoc={isSimulated ? sandboxContent : undefined}
            sandbox="allow-scripts allow-modals allow-forms allow-popups allow-same-origin"
          />
        )}
      </div>

      {!isFullscreen && (
        <div 
          className="absolute left-0 top-0 w-1 h-full cursor-col-resize hover:bg-blue-500/50 transition-colors z-10"
          onMouseDown={(e) => {
            const startX = e.clientX;
            const startWidth = previewWidth;
            const onMouseMove = (moveEvent: MouseEvent) => {
              const newWidth = Math.max(200, Math.min(800, startWidth - (moveEvent.clientX - startX)));
              setPreviewWidth(newWidth);
            };
            const onMouseUp = () => {
              document.removeEventListener('mousemove', onMouseMove);
              document.removeEventListener('mouseup', onMouseUp);
            };
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
          }}
        />
      )}
    </div>
  );
};
