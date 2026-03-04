import React from 'react';
import { useIDEStore } from '../store/useIDEStore';
import { Search, CaseSensitive, Type, ChevronRight, ChevronDown, FileText, Replace, CheckCheck, Trash2 } from 'lucide-react';
import { cn } from '../utils/helpers';

export const GlobalSearch: React.FC = () => {
  const { 
    searchQuery, 
    setSearchQuery, 
    searchOptions, 
    setSearchOptions, 
    searchResults, 
    isSearching,
    setActiveFile,
    globalReplaceQuery,
    setGlobalReplaceQuery,
    showGlobalReplace,
    toggleGlobalReplace,
    replaceInFiles
  } = useIDEStore();

  const [expandedFiles, setExpandedFiles] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    const bc = new BroadcastChannel('noka-ide-editor-actions');
    bc.onmessage = (event) => {
      if (event.data === 'replaceInFiles') {
        toggleGlobalReplace(true);
      }
    };
    return () => bc.close();
  }, [toggleGlobalReplace]);

  const toggleFile = (id: string) => {
    setExpandedFiles(prev => ({ ...prev, [id]: prev[id] === false }));
  };

  const handleReplaceAll = () => {
    if (!searchQuery) return;
    if (window.confirm(`Replace all occurrences of "${searchQuery}" with "${globalReplaceQuery}" in ${searchResults.length} files?`)) {
      replaceInFiles(globalReplaceQuery);
    }
  };

  const handleReplaceFile = (fileId: string, fileName: string) => {
    if (window.confirm(`Replace all occurrences in ${fileName}?`)) {
      replaceInFiles(globalReplaceQuery, [fileId]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 border-r border-white/5 w-full overflow-hidden">
      <div className="p-4 flex flex-col gap-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Search</h2>
          <button
            className={cn(
              "p-1 rounded transition-colors",
              showGlobalReplace ? "bg-blue-500/20 text-blue-400" : "text-slate-500 hover:text-slate-300"
            )}
            onClick={() => toggleGlobalReplace()}
            title="Toggle Replace"
          >
            <Replace size={14} />
          </button>
        </div>
        
        <div className="flex flex-col gap-2">
          <div className="relative group">
            <Search className="absolute left-2 top-2 text-slate-500" size={14} />
            <input
              type="text"
              className="w-full bg-slate-900 border border-white/5 rounded px-8 py-1.5 text-xs text-slate-200 focus:border-blue-500/50 outline-none transition-colors"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="absolute right-2 top-1.5 flex items-center gap-1">
              <button
                className={cn(
                  "p-1 rounded transition-colors",
                  searchOptions.isCaseSensitive ? "bg-blue-500/20 text-blue-400" : "text-slate-500 hover:text-slate-300"
                )}
                onClick={() => setSearchOptions({ isCaseSensitive: !searchOptions.isCaseSensitive })}
                title="Match Case"
              >
                <CaseSensitive size={14} />
              </button>
              <button
                className={cn(
                  "p-1 rounded transition-colors",
                  searchOptions.isRegex ? "bg-blue-500/20 text-blue-400" : "text-slate-500 hover:text-slate-300"
                )}
                onClick={() => setSearchOptions({ isRegex: !searchOptions.isRegex })}
                title="Use Regular Expression"
              >
                <Type size={14} />
              </button>
            </div>
          </div>

          {showGlobalReplace && (
            <div className="flex items-center gap-2">
              <div className="relative group flex-1">
                <Replace className="absolute left-2 top-2 text-slate-500" size={14} />
                <input
                  type="text"
                  className="w-full bg-slate-900 border border-white/5 rounded px-8 py-1.5 text-xs text-slate-200 focus:border-blue-500/50 outline-none transition-colors"
                  placeholder="Replace..."
                  value={globalReplaceQuery}
                  onChange={(e) => setGlobalReplaceQuery(e.target.value)}
                />
              </div>
              <button
                className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-blue-500/10"
                onClick={handleReplaceAll}
                disabled={!searchQuery || searchResults.length === 0}
                title="Replace All"
              >
                <CheckCheck size={14} />
              </button>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] text-slate-500 uppercase font-semibold pl-1">Include</span>
              <input
                type="text"
                className="w-full bg-slate-900/50 border border-white/5 rounded px-2 py-1 text-[10px] text-slate-400 focus:border-blue-500/50 outline-none"
                placeholder="files to include (e.g. *.ts)"
                value={searchOptions.include}
                onChange={(e) => setSearchOptions({ include: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[9px] text-slate-500 uppercase font-semibold pl-1">Exclude</span>
              <input
                type="text"
                className="w-full bg-slate-900/50 border border-white/5 rounded px-2 py-1 text-[10px] text-slate-400 focus:border-blue-500/50 outline-none"
                placeholder="files to exclude"
                value={searchOptions.exclude}
                onChange={(e) => setSearchOptions({ exclude: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar border-t border-white/5">
        {isSearching ? (
          <div className="px-4 py-3 text-xs text-slate-500 flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            Searching workspace...
          </div>
        ) : searchResults.length === 0 && searchQuery ? (
          <div className="px-4 py-3 text-xs text-slate-500 italic">No results found</div>
        ) : (
          <div className="flex flex-col pb-4">
            {searchResults.map((result) => (
              <div key={result.fileId} className="flex flex-col border-b border-white/5 last:border-0">
                <button
                  className="flex items-center gap-2 px-4 py-2 hover:bg-white/5 text-slate-300 transition-colors w-full text-left group"
                  onClick={() => toggleFile(result.fileId)}
                >
                  {expandedFiles[result.fileId] === true ? <ChevronRight size={12} className="text-slate-500" /> : <ChevronDown size={12} className="text-slate-500" />}
                  <FileText size={14} className="text-blue-400 group-hover:text-blue-300" />
                  <span className="text-xs truncate font-medium">{result.fileName}</span>
                  <div className="flex items-center gap-2 ml-auto">
                    {showGlobalReplace && (
                      <button
                        className="p-1 hover:bg-white/10 rounded text-slate-500 hover:text-blue-400 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReplaceFile(result.fileId, result.fileName);
                        }}
                        title="Replace in this file"
                      >
                        <Replace size={12} />
                      </button>
                    )}
                    <span className="text-[10px] bg-white/5 text-slate-500 px-1.5 py-0.5 rounded-full">{result.matches.length}</span>
                  </div>
                </button>
                
                {expandedFiles[result.fileId] !== true && (
                  <div className="flex flex-col bg-black/20">
                    {result.matches.map((match, idx) => (
                      <button
                        key={`${result.fileId}-${idx}`}
                        className="flex items-start gap-3 pl-8 pr-4 py-1.5 hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors w-full text-left group border-l-2 border-transparent hover:border-blue-500/50"
                        onClick={() => {
                          setActiveFile(result.fileId);
                          const bc = new BroadcastChannel('noka-ide-editor-actions');
                          bc.postMessage({ 
                            type: 'gotoLine', 
                            line: match.line, 
                            start: match.start + 1, // Monaco uses 1-based indexing for columns
                            length: match.length 
                          });
                          bc.close();
                        }}
                      >
                        <span className="text-[10px] text-slate-600 font-mono mt-0.5 min-w-[24px]">{match.line}</span>
                        <span className="text-[11px] truncate font-mono leading-relaxed flex-1">
                          {match.preview.substring(0, Math.max(0, match.start))}
                          <span className="bg-blue-500/30 text-blue-100 rounded-sm ring-1 ring-blue-500/20 px-0.5">
                            {match.preview.substring(match.start, match.start + match.length)}
                          </span>
                          {match.preview.substring(match.start + match.length)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
