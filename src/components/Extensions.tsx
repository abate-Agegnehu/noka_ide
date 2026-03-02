import React from 'react';
import { useIDEStore, ExtensionItem } from '../store/useIDEStore';
import { cn } from '../utils/helpers';
import { Search, Download, Trash2, ToggleLeft, ToggleRight, Puzzle } from 'lucide-react';

export const Extensions: React.FC = () => {
  const {
    marketplaceResults,
    installedExtensions,
    isFetchingMarketplace,
    searchMarketplace,
    installExtension,
    uninstallExtension,
    toggleExtensionEnabled,
    downloadExtension,
    sidebarWidth,
  } = useIDEStore();
  const [tab, setTab] = React.useState<'marketplace' | 'installed'>('marketplace');
  const [query, setQuery] = React.useState('');
  const searchRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    searchMarketplace('popular');
  }, []);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchMarketplace(query || 'popular');
  };

  const isInstalled = (id: string) => installedExtensions.some(e => e.id === id);

  const toInstallPayload = (e: ExtensionItem): Omit<ExtensionItem, 'installedAt' | 'enabled'> => ({
    id: e.id,
    name: e.name,
    displayName: e.displayName,
    publisher: e.publisher,
    version: e.version,
    description: e.description,
    iconUrl: e.iconUrl,
    vsixUrl: e.vsixUrl
  });

  return (
    <div
      className="flex flex-col bg-slate-950 border-r border-white/5 h-full"
      style={{ width: `${sidebarWidth}px` }}
    >
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Extensions</h2>
          <Puzzle size={16} className="text-slate-400" />
        </div>
        <form onSubmit={onSearch} className="mt-3 relative">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search extensions"
            className="w-full pl-7 pr-3 py-1.5 rounded bg-slate-900 border border-white/10 text-sm text-slate-200 outline-none focus:border-blue-500"
          />
        </form>
        <div className="mt-3 flex gap-2">
          <button
            className={cn(
              'px-2 py-1 text-xs rounded border',
              tab === 'marketplace'
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-slate-900 border-white/10 text-slate-400 hover:text-slate-200'
            )}
            onClick={() => setTab('marketplace')}
          >
            Marketplace
          </button>
          <button
            className={cn(
              'px-2 py-1 text-xs rounded border',
              tab === 'installed'
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-slate-900 border-white/10 text-slate-400 hover:text-slate-200'
            )}
            onClick={() => setTab('installed')}
          >
            Installed ({installedExtensions.length})
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'marketplace' ? (
          <div className="p-2">
            {isFetchingMarketplace && (
              <div className="px-2 py-3 text-xs text-slate-500">Loading...</div>
            )}
            {!isFetchingMarketplace && marketplaceResults.length === 0 && (
              <div className="px-2 py-3 text-xs text-slate-500">No results</div>
            )}
            {marketplaceResults.map((ext) => {
              const installed = isInstalled(ext.id);
              return (
                <div
                  key={ext.id}
                  className="flex items-center gap-2 p-2 hover:bg-white/5 rounded transition-colors"
                >
                  <div className="w-8 h-8 rounded bg-slate-800 border border-white/10 overflow-hidden flex items-center justify-center">
                    {ext.iconUrl ? (
                      <img src={ext.iconUrl} alt={ext.displayName || ext.name} className="w-full h-full object-cover" />
                    ) : (
                      <Puzzle size={16} className="text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-200 truncate">
                      {ext.displayName || ext.name}
                      {ext.version && <span className="ml-2 text-xs text-slate-500">v{ext.version}</span>}
                    </div>
                    <div className="text-xs text-slate-500 truncate">{ext.publisher}</div>
                    {ext.description && (
                      <div className="text-xs text-slate-500 truncate">{ext.description}</div>
                    )}
                  </div>
                  {!installed ? (
                    <button
                      onClick={() => installExtension(toInstallPayload(ext))}
                      className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded"
                    >
                      Install
                    </button>
                  ) : (
                    <button
                      onClick={() => downloadExtension(ext.id)}
                      className="p-2 text-slate-400 hover:text-slate-200"
                      title="Download VSIX"
                    >
                      <Download size={16} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-2">
            {installedExtensions.length === 0 && (
              <div className="px-2 py-3 text-xs text-slate-500">No extensions installed</div>
            )}
            {installedExtensions.map((ext) => (
              <div
                key={ext.id}
                className="flex items-center gap-2 p-2 hover:bg-white/5 rounded transition-colors"
              >
                <div className="w-8 h-8 rounded bg-slate-800 border border-white/10 overflow-hidden flex items-center justify-center">
                  {ext.iconUrl ? (
                    <img src={ext.iconUrl} alt={ext.displayName || ext.name} className="w-full h-full object-cover" />
                  ) : (
                    <Puzzle size={16} className="text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-200 truncate">
                    {ext.displayName || ext.name}
                    {ext.version && <span className="ml-2 text-xs text-slate-500">v{ext.version}</span>}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{ext.publisher}</div>
                  {ext.description && (
                    <div className="text-xs text-slate-500 truncate">{ext.description}</div>
                  )}
                </div>
                <button
                  onClick={() => toggleExtensionEnabled(ext.id)}
                  className="p-2 text-slate-400 hover:text-slate-200"
                  title={ext.enabled ? 'Disable' : 'Enable'}
                >
                  {ext.enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                </button>
                <button
                  onClick={() => downloadExtension(ext.id)}
                  className="p-2 text-slate-400 hover:text-slate-200"
                  title="Download VSIX"
                >
                  <Download size={16} />
                </button>
                <button
                  onClick={() => uninstallExtension(ext.id)}
                  className="p-2 text-red-400 hover:text-red-300"
                  title="Uninstall"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
