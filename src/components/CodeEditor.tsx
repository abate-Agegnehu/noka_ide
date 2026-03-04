import React from 'react';
import Editor from '@monaco-editor/react';
import { useIDEStore } from '../store/useIDEStore';
import { X } from 'lucide-react';
import { cn, getFileIcon } from '../utils/helpers';

export const CodeEditor: React.FC = () => {
  const { files, activeFileId, openFileIds, setActiveFile, closeFile, updateFileContent, formatOnSave, setFormatOnSave, installedExtensions, iconTheme } = useIDEStore();
  const activeFile = activeFileId ? files[activeFileId] : null;
  const [isFormatting, setIsFormatting] = React.useState(false);
  const [formatError, setFormatError] = React.useState<string | null>(null);
  const monacoRef = React.useRef<any>(null);
  const editorRef = React.useRef<any>(null);
  const disposablesRef = React.useRef<any[]>([]);
  const es7SnippetsRef = React.useRef<any[] | null>(null);

  const loadScript = (src: string) => {
    return new Promise<void>((resolve, reject) => {
      const exists = document.querySelector(`script[data-prettier-src="${src}"]`);
      if (exists) {
        resolve();
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.defer = true;
      s.dataset.prettierSrc = src;
      let done = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        if (ok) resolve();
        else reject(new Error(`failed to load ${src}`));
      };
      s.onload = () => finish(true);
      s.onerror = () => finish(false);
      setTimeout(() => finish(false), 15000);
      document.head.appendChild(s);
    });
  };

  const ensurePrettier = async (need: string[]) => {
    const bases = [
      'https://unpkg.com/prettier@3.2.5',
      'https://cdn.jsdelivr.net/npm/prettier@3.2.5'
    ];
    let lastErr: any = null;
    for (const base of bases) {
      try {
        await loadScript(`${base}/standalone.js`);
        const map: Record<string, string> = {
          babel: `${base}/plugins/babel.js`,
          estree: `${base}/plugins/estree.js`,
          typescript: `${base}/plugins/typescript.js`,
          html: `${base}/plugins/html.js`,
          postcss: `${base}/plugins/postcss.js`,
          markdown: `${base}/plugins/markdown.js`,
        };
        const required = Array.from(new Set([...(need || []), 'estree']));
        for (const k of required) {
          const url = map[k];
          if (url) await loadScript(url);
        }
        const w: any = window as any;
        if (!w.prettier) {
          // Fallback to ESM: inject a module script that assigns to window
          const esmMap: Record<string, string> = {
            babel: `${base}/plugins/babel.mjs`,
            estree: `${base}/plugins/estree.mjs`,
            typescript: `${base}/plugins/typescript.mjs`,
            html: `${base}/plugins/html.mjs`,
            postcss: `${base}/plugins/postcss.mjs`,
            markdown: `${base}/plugins/markdown.mjs`,
          };
          const imports: string[] = [`import * as p from '${base}/standalone.mjs';`];
          const assigns: string[] = [];
          const wanted = Array.from(new Set([...(need || []), 'estree']));
          for (const k of wanted) {
            const m = esmMap[k];
            if (m) {
              imports.push(`import ${k} from '${m}';`);
              assigns.push(k);
            }
          }
          const body =
            `${imports.join('\n')}\n` +
            `window.prettier = (p && (p.default || p)) || p;\n` +
            `window.prettierPlugins = window.prettierPlugins || {};\n` +
            `${assigns.map(a => `window.prettierPlugins['${a}'] = ${a};`).join('\n')}\n`;
          const blob = new Blob([body], { type: 'text/javascript' });
          const url = URL.createObjectURL(blob);
          await new Promise<void>((resolve, reject) => {
            const s = document.createElement('script');
            s.type = 'module';
            s.src = url;
            s.onload = () => { URL.revokeObjectURL(url); resolve(); };
            s.onerror = () => { URL.revokeObjectURL(url); reject(new Error('module load error')); };
            document.head.appendChild(s);
          });
          if (!w.prettier) throw new Error('prettier not found after module load');
        }
        return {
          prettier: w.prettier,
          plugins: w.prettierPlugins || {}
        };
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('Unable to load Prettier');
  };

  const handleFormat = async () => {
    if (!activeFile) return;
    const content = activeFile.content || '';
    const name = activeFile.name.toLowerCase();
    setIsFormatting(true);
    setFormatError(null);
    try {
      let parser = 'babel';
      let needed = ['babel'];
      if (name.endsWith('.ts')) {
        parser = 'typescript';
        needed = ['babel', 'typescript'];
      } else if (name.endsWith('.tsx')) {
        parser = 'babel-ts';
        needed = ['babel'];
      } else if (name.endsWith('.jsx') || name.endsWith('.js')) {
        parser = 'babel';
        needed = ['babel'];
      } else if (name.endsWith('.json')) {
        parser = 'json';
        needed = ['babel'];
      } else if (name.endsWith('.html')) {
        parser = 'html';
        needed = ['babel', 'html'];
      } else if (name.endsWith('.css')) {
        parser = 'css';
        needed = ['babel', 'postcss'];
      } else if (name.endsWith('.md')) {
        parser = 'markdown';
        needed = ['babel', 'markdown'];
      }
      const { prettier, plugins } = await ensurePrettier(needed);
      const arr: any[] = [];
      if (plugins.babel) arr.push(plugins.babel);
      if (plugins.typescript) arr.push(plugins.typescript);
      if (plugins.html) arr.push(plugins.html);
      if (plugins.postcss) arr.push(plugins.postcss);
      if (plugins.markdown) arr.push(plugins.markdown);
      if (plugins.estree) arr.push(plugins.estree);
      const formatted = await prettier.format(content, { parser, plugins: arr });
      updateFileContent(activeFile.id, formatted);
    } catch (e: any) {
      const msg = e?.message || String(e) || 'Format failed';
      setFormatError(msg);
    } finally {
      setIsFormatting(false);
    }
  };

  const clearDisposables = () => {
    for (const d of disposablesRef.current) {
      try { d.dispose?.(); } catch {}
    }
    disposablesRef.current = [];
  };

  const ensureEs7Snippets = async () => {
    if (es7SnippetsRef.current) return es7SnippetsRef.current;
    try {
      const res = await fetch('https://raw.githubusercontent.com/dsznajder/vscode-es7-javascript-react-snippets/master/snippets/snippets.json');
      if (res.ok) {
        const json = await res.json();
        const out: any[] = [];
        Object.keys(json || {}).forEach((k) => {
          const s = json[k];
          if (!s) return;
          const prefixes = Array.isArray(s.prefix) ? s.prefix : [s.prefix];
          out.push({
            label: prefixes[0] || k,
            insertText: Array.isArray(s.body) ? s.body.join('\n') : s.body,
            detail: s.description || 'Snippet',
            sortText: '0' + (prefixes[0] || k)
          });
        });
        es7SnippetsRef.current = out;
        return out;
      }
    } catch {}
    es7SnippetsRef.current = [
      {
        label: 'rafce',
        insertText: "import React from 'react'\n\nexport const ${1:ComponentName} = () => {\n  return (\n    <div>${2}</div>\n  )\n}\n\nexport default ${1:ComponentName}",
        detail: 'React Arrow Function Component Export',
        sortText: '0rafce'
      }
    ];
    return es7SnippetsRef.current;
  };

  React.useEffect(() => {
    if (!monacoRef.current) return;
    clearDisposables();
    const monaco: any = monacoRef.current;
    const hasPrettier = installedExtensions.some(e => e.enabled && /prettier/i.test(e.id) || /prettier/i.test(e.displayName || '') || /prettier/i.test(e.name));
    if (hasPrettier) {
      const languages = ['javascript', 'typescript', 'json', 'css', 'html', 'markdown'];
      for (const lang of languages) {
        const disp = monaco.languages.registerDocumentFormattingEditProvider(lang, {
          provideDocumentFormattingEdits: async (model: any) => {
            const text = model.getValue();
            const name = model.uri?.path || '';
            const fakeFile = name.toLowerCase();
            let parser = 'babel';
            if (fakeFile.endsWith('.ts')) parser = 'typescript';
            else if (fakeFile.endsWith('.tsx')) parser = 'babel-ts';
            else if (fakeFile.endsWith('.json')) parser = 'json';
            else if (fakeFile.endsWith('.css')) parser = 'css';
            else if (fakeFile.endsWith('.html')) parser = 'html';
            else if (fakeFile.endsWith('.md')) parser = 'markdown';
            try {
              const need: string[] = ['babel'];
              if (parser === 'typescript') need.push('typescript');
              if (parser === 'html') need.push('html');
              if (parser === 'css') need.push('postcss');
              if (parser === 'markdown') need.push('markdown');
              const { prettier, plugins } = await ensurePrettier(need);
              const arr: any[] = [];
              if (plugins.babel) arr.push(plugins.babel);
              if (plugins.typescript) arr.push(plugins.typescript);
              if (plugins.html) arr.push(plugins.html);
              if (plugins.postcss) arr.push(plugins.postcss);
              if (plugins.markdown) arr.push(plugins.markdown);
              if (plugins.estree) arr.push(plugins.estree);
              const formatted = await prettier.format(text, { parser, plugins: arr });
              return [
                {
                  range: model.getFullModelRange(),
                  text: formatted
                }
              ];
            } catch {
              return [];
            }
          }
        });
        disposablesRef.current.push(disp);
      }
    }
    const hasEs7 = installedExtensions.some(e => e.enabled && /es7|react.*snippets|dsznajder/i.test(e.id + ' ' + (e.displayName || '') + ' ' + e.name));
    if (hasEs7) {
      const register = async () => {
        const snippets = await ensureEs7Snippets();
        const provider = {
          provideCompletionItems: () => {
            const suggestions = (snippets || []).map((s: any) => ({
              label: s.label,
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: s.insertText,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: s.detail,
              sortText: s.sortText
            }));
            return { suggestions };
          }
        };
        const d1 = monaco.languages.registerCompletionItemProvider('javascript', provider);
        const d2 = monaco.languages.registerCompletionItemProvider('typescript', provider);
        disposablesRef.current.push(d1, d2);
      };
      register();
    }
    return () => {
      clearDisposables();
    };
  }, [installedExtensions]);

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
              <span className="mr-2 text-sm w-4 h-4 flex items-center justify-center">
                {(() => {
                  const icon = getFileIcon(file.name, 'file', false, iconTheme);
                  if (icon.kind === 'emoji') return <span>{icon.text}</span>;
                  return <img src={icon.src} alt="" className="w-4 h-4" crossOrigin="anonymous" />;
                })()}
              </span>
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

      <div className="flex items-center justify-between px-2 py-1 bg-slate-950 border-b border-white/5">
        <div className="text-[10px] text-slate-500">
          {formatError ? <span className="text-red-400">{formatError}</span> : <span>Editor Ready</span>}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[11px] text-slate-400">
            <input
              type="checkbox"
              checked={formatOnSave}
              onChange={(e) => setFormatOnSave(e.target.checked)}
            />
            Format on Save
          </label>
          <button
            onClick={handleFormat}
            disabled={isFormatting}
            className={cn(
              "px-2 py-1 text-[11px] rounded border",
              isFormatting ? "bg-slate-800 text-slate-400 border-white/10" : "bg-blue-600 text-white border-blue-500 hover:bg-blue-500"
            )}
            title="Format with Prettier"
          >
            {isFormatting ? 'Formatting…' : 'Format'}
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 relative">
        <Editor
          height="100%"
          path={activeFile.id}
          language={activeFile.language || 'javascript'}
          theme="vs-dark"
          defaultValue={activeFile.content}
          onChange={(value) => updateFileContent(activeFile.id, value || '')}
          onMount={(editor: any, monaco: any) => {
            try {
              editor.addCommand((monaco?.KeyMod?.CtrlCmd || 0) | (monaco?.KeyCode?.KeyS || 0), () => {
                if (formatOnSave) {
                  handleFormat();
                }
              });
              editor.addCommand(
                (monaco?.KeyMod?.Shift || 0) | (monaco?.KeyMod?.Alt || 0) | (monaco?.KeyCode?.KeyF || 0),
                () => {
                  try {
                    editor.getAction('editor.action.formatDocument')?.run();
                  } catch {
                    handleFormat();
                  }
                }
              );

              // Add listener for custom undo event
              const bc = new BroadcastChannel('noka-ide-editor-actions');
              bc.onmessage = (event) => {
                const data = event.data;
                if (data === 'undo' && editorRef.current) {
                  editorRef.current.trigger('menu', 'undo', null);
                } else if (data === 'redo' && editorRef.current) {
                  editorRef.current.trigger('menu', 'redo', null);
                } else if (data === 'find' && editorRef.current) {
                  editorRef.current.trigger('menu', 'actions.find', null);
                } else if (data?.type === 'close' && monacoRef.current) {
                  // Find and dispose the model for the closed file to clear history
                  const models = monacoRef.current.editor.getModels();
                  const modelToDispose = models.find((m: any) => m.uri.path === `/${data.id}`);
                  if (modelToDispose) {
                    modelToDispose.dispose();
                  }
                }
              };
              disposablesRef.current.push({ dispose: () => bc.close() });
            } catch {}
            editorRef.current = editor;
            monacoRef.current = monaco;
          }}
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
