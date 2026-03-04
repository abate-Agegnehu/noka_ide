import React from 'react';
import Editor from '@monaco-editor/react';
import { useIDEStore } from '../store/useIDEStore';
import { X, Search, ChevronUp, ChevronDown, Type, CaseSensitive, Replace, Check, CheckCheck, ChevronRight } from 'lucide-react';
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

  const [showFind, setShowFind] = React.useState(false);
   const [showReplace, setShowReplace] = React.useState(false);
   const [findQuery, setFindQuery] = React.useState('');
   const [replaceQuery, setReplaceQuery] = React.useState('');
   const [findOptions, setFindOptions] = React.useState({
    isCaseSensitive: false,
    isRegex: false,
    isMatchWholeWord: false,
  });
  const [findMatches, setFindMatches] = React.useState<any[]>([]);
  const [activeMatchIndex, setActiveMatchIndex] = React.useState(-1);
  const findInputRef = React.useRef<HTMLInputElement>(null);
  const decorationsRef = React.useRef<string[]>([]);

  const clearFindDecorations = () => {
    if (editorRef.current) {
      decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, []);
    }
  };

  const updateFindMatches = () => {
    const editor = editorRef.current;
    if (!editor || !findQuery) {
      setFindMatches([]);
      setActiveMatchIndex(-1);
      clearFindDecorations();
      return;
    }

    const model = editor.getModel();
    if (!model) return;

    const matches = model.findMatches(
      findQuery,
      false, // searchOnlyEditableRange
      findOptions.isRegex,
      findOptions.isCaseSensitive,
      findOptions.isMatchWholeWord ? ' ' : null, // wordSeparators
      true // captureMatches
    );

    setFindMatches(matches);
    
    // Highlight all matches
    const newDecorations = matches.map((match: any, idx: number) => ({
      range: match.range,
      options: {
        className: idx === activeMatchIndex ? 'bg-yellow-500/50' : 'bg-blue-500/30',
        inlineClassName: idx === activeMatchIndex ? 'bg-yellow-500/50' : 'bg-blue-500/30',
      },
    }));

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);

    if (matches.length > 0 && activeMatchIndex === -1) {
      setActiveMatchIndex(0);
      editor.revealRangeInCenter(matches[0].range);
    }
  };

  React.useEffect(() => {
    updateFindMatches();
  }, [findQuery, findOptions, activeFileId]);

  React.useEffect(() => {
    const editor = editorRef.current;
    if (editor && findMatches.length > 0 && activeMatchIndex >= 0) {
      const match = findMatches[activeMatchIndex];
      editor.revealRangeInCenter(match.range);
      
      // Update highlights to show active one
      const newDecorations = findMatches.map((m: any, idx: number) => ({
        range: m.range,
        options: {
          className: idx === activeMatchIndex ? 'bg-yellow-500/60 ring-2 ring-yellow-400' : 'bg-blue-500/30',
          inlineClassName: idx === activeMatchIndex ? 'bg-yellow-500/60' : 'bg-blue-500/30',
        },
      }));
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);
    }
  }, [activeMatchIndex]);

  React.useEffect(() => {
    if (!showFind) {
      clearFindDecorations();
    }
  }, [showFind]);

  const handleNextMatch = () => {
    if (findMatches.length === 0) return;
    setActiveMatchIndex((prev) => (prev + 1) % findMatches.length);
  };

  const handlePrevMatch = () => {
     if (findMatches.length === 0) return;
     setActiveMatchIndex((prev) => (prev - 1 + findMatches.length) % findMatches.length);
   };
 
   const handleReplace = () => {
     const editor = editorRef.current;
     if (!editor || findMatches.length === 0 || activeMatchIndex === -1) return;
 
     const match = findMatches[activeMatchIndex];
     const model = editor.getModel();
     if (!model) return;
 
     editor.pushEditOperations(
       'replace',
       [{
         range: match.range,
         text: replaceQuery,
         forceMoveMarkers: true
       }],
       () => null
     );
 
     // Re-scan matches after replace
     updateFindMatches();
   };
 
   const handleReplaceAll = () => {
     const editor = editorRef.current;
     if (!editor || findMatches.length === 0) return;
 
     const model = editor.getModel();
     if (!model) return;
 
     const edits = findMatches.map(match => ({
       range: match.range,
       text: replaceQuery,
       forceMoveMarkers: true
     }));
 
     editor.pushEditOperations(
       'replace-all',
       edits,
       () => null
     );
 
     // Re-scan matches after replace
     updateFindMatches();
   };
 
   const toggleFind = (showReplaceMode = false) => {
     if (!showFind || (showReplaceMode && !showReplace)) {
       const editor = editorRef.current;
       if (editor) {
         const selection = editor.getSelection();
         if (selection && !selection.isEmpty()) {
           const selectedText = editor.getModel().getValueInRange(selection);
           if (selectedText.length < 100) { // arbitrary limit for pre-filling find
             setFindQuery(selectedText);
           }
         }
       }
       setShowFind(true);
       setShowReplace(showReplaceMode);
       setTimeout(() => findInputRef.current?.focus(), 10);
     } else {
       setShowFind(false);
       setShowReplace(false);
       clearFindDecorations();
     }
   };

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

  const performCopy = async () => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    editor.focus();
    const model = editor.getModel();
    if (!model) return;
    const sel = editor.getSelection();
    let text = '';
    if (!sel || sel.isEmpty()) {
      const pos = editor.getPosition();
      const ln = pos?.lineNumber || 1;
      text = model.getLineContent(ln) + (model.getEOL?.() || '\n');
    } else {
      text = model.getValueInRange(sel);
    }
    try {
      const lang = model.getLanguageId?.() || 'plaintext';
      const html = await monaco.editor.colorize(text, lang, { tabSize: (model.getOptions?.().tabSize as number) || 4 });
      const ClipboardItemRef: any = (window as any).ClipboardItem;
      if (navigator.clipboard && (navigator.clipboard as any).write && ClipboardItemRef) {
        const item = new ClipboardItemRef({
          'text/plain': new Blob([text], { type: 'text/plain' }),
          'text/html': new Blob([html], { type: 'text/html' })
        });
        await (navigator.clipboard as any).write([item]);
      } else {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      try { await navigator.clipboard.writeText(text); } catch {}
    }
  };

  const performPaste = async () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const selection = editor.getSelection();
        const model = editor.getModel();
        if (model && selection) {
          editor.executeEdits('clipboard', [{
            range: selection,
            text: text,
            forceMoveMarkers: true
          }]);
          // After paste, trigger auto-indent/format if possible
          editor.getAction('editor.action.formatSelection')?.run();
        }
      }
    } catch (err) {
      console.error('Failed to paste from clipboard:', err);
      // Fallback to default trigger if navigator.clipboard fails
      editor.trigger('keyboard', 'editor.action.clipboardPasteAction', null);
    }
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
      <div className="flex-1 relative group/editor">
        {showFind && (
          <div className="absolute top-4 right-8 z-[60] flex flex-col gap-2 bg-slate-900 border border-white/10 rounded-lg shadow-2xl p-2 animate-in slide-in-from-top-2 duration-200 min-w-[320px]">
            <div className="flex items-center gap-2">
              <button
                className={cn(
                  "p-1 rounded transition-colors",
                  showReplace ? "text-blue-400" : "text-slate-500 hover:text-slate-300"
                )}
                onClick={() => setShowReplace(!showReplace)}
                title="Toggle Replace"
              >
                <ChevronRight size={14} className={cn("transition-transform", showReplace && "rotate-90")} />
              </button>
              
              <div className="flex-1 flex flex-col gap-2">
                <div className="flex items-center gap-1 px-2 py-1 bg-white/5 rounded border border-white/5 focus-within:border-blue-500/50 transition-colors">
                  <Search size={14} className="text-slate-500" />
                  <input
                    ref={findInputRef}
                    type="text"
                    placeholder="Find"
                    className="bg-transparent border-none outline-none text-xs text-slate-200 flex-1 placeholder:text-slate-600"
                    value={findQuery}
                    onChange={(e) => setFindQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (e.shiftKey) handlePrevMatch();
                        else handleNextMatch();
                      }
                      if (e.key === 'Escape') toggleFind();
                    }}
                  />
                  <div className="flex items-center gap-0.5 ml-2">
                    <button
                      className={cn(
                        "p-1 rounded transition-colors",
                        findOptions.isCaseSensitive ? "bg-blue-500/20 text-blue-400" : "hover:bg-white/5 text-slate-500"
                      )}
                      onClick={() => setFindOptions(prev => ({ ...prev, isCaseSensitive: !prev.isCaseSensitive }))}
                      title="Match Case"
                    >
                      <CaseSensitive size={14} />
                    </button>
                    <button
                      className={cn(
                        "p-1 rounded transition-colors",
                        findOptions.isRegex ? "bg-blue-500/20 text-blue-400" : "hover:bg-white/5 text-slate-500"
                      )}
                      onClick={() => setFindOptions(prev => ({ ...prev, isRegex: !prev.isRegex }))}
                      title="Use Regular Expression"
                    >
                      <Type size={14} />
                    </button>
                  </div>
                </div>

                {showReplace && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-white/5 rounded border border-white/5 focus-within:border-blue-500/50 transition-colors">
                    <Replace size={14} className="text-slate-500" />
                    <input
                      type="text"
                      placeholder="Replace"
                      className="bg-transparent border-none outline-none text-xs text-slate-200 flex-1 placeholder:text-slate-600"
                      value={replaceQuery}
                      onChange={(e) => setReplaceQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleReplace();
                        if (e.key === 'Escape') toggleFind();
                      }}
                    />
                    <div className="flex items-center gap-0.5 ml-2">
                      <button
                        className="p-1 hover:bg-white/5 rounded text-slate-400 hover:text-blue-400 transition-colors"
                        onClick={handleReplace}
                        title="Replace"
                        disabled={findMatches.length === 0}
                      >
                        <Check size={14} />
                      </button>
                      <button
                        className="p-1 hover:bg-white/5 rounded text-slate-400 hover:text-blue-400 transition-colors"
                        onClick={handleReplaceAll}
                        title="Replace All"
                        disabled={findMatches.length === 0}
                      >
                        <CheckCheck size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center gap-1 border-l border-white/10 pl-2">
                <div className="text-[10px] text-slate-500 min-w-[40px] text-center">
                  {findMatches.length > 0 ? `${activeMatchIndex + 1}/${findMatches.length}` : 'No results'}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    className="p-1 hover:bg-white/5 rounded text-slate-400 transition-colors disabled:opacity-30"
                    onClick={handlePrevMatch}
                    disabled={findMatches.length === 0}
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    className="p-1 hover:bg-white/5 rounded text-slate-400 transition-colors disabled:opacity-30"
                    onClick={handleNextMatch}
                    disabled={findMatches.length === 0}
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
                <button
                  className="p-1 hover:bg-white/5 rounded text-slate-400 hover:text-white transition-colors"
                  onClick={() => toggleFind()}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
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
              editor.addCommand((monaco?.KeyMod?.CtrlCmd || 0) | (monaco?.KeyCode?.KeyF || 0), () => {
                toggleFind();
              });
              editor.addCommand((monaco?.KeyMod?.CtrlCmd || 0) | (monaco?.KeyCode?.KeyH || 0), () => {
                toggleFind(true);
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
                } else if (data === 'cut' && editorRef.current) {
                  editorRef.current.focus();
                  editorRef.current.trigger('keyboard', 'editor.action.clipboardCutAction', null);
                } else if (data === 'copy' && editorRef.current) {
                  performCopy();
                } else if (data === 'paste' && editorRef.current) {
                  performPaste();
                } else if (data === 'find' && editorRef.current) {
                  toggleFind();
                } else if (data === 'replace' && editorRef.current) {
                  toggleFind(true);
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
            copyWithSyntaxHighlighting: true,
            autoIndent: 'full',
            formatOnPaste: true,
          }}
          loading={<div className="flex items-center justify-center h-full text-slate-500">Loading Editor...</div>}
        />
      </div>
    </div>
  );
};
