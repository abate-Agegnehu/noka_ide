import React, { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, ChevronRight, X } from 'lucide-react';
import { useIDEStore } from '../store/useIDEStore';

export const Terminal: React.FC = () => {
  const { 
    terminalLogs, 
    addTerminalLog, 
    clearTerminalLogs, 
    files, 
    isTerminalOpen, 
    toggleTerminal,
    isRunning,
    setRunning,
    previewUrl,
    setPreviewUrl
  } = useIDEStore();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const rootFolder = Object.values(files).find(f => f.parentId === null);
  const promptPath = rootFolder ? rootFolder.name : 'project';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput) return;
    
    const cmd = trimmedInput.toLowerCase();
    addTerminalLog(`${promptPath} > ${trimmedInput}`);
    
    // Get package.json if it exists
    const packageJsonFile = Object.values(files).find(f => f.name === 'package.json');
    let packageJson: any = null;
    try {
      if (packageJsonFile?.content) {
        packageJson = JSON.parse(packageJsonFile.content);
      }
    } catch (err) {
      console.error('Failed to parse package.json:', err);
    }

    // Command execution logic
    if (cmd === 'clear' || cmd === 'cls') {
      clearTerminalLogs();
    } else if (cmd === 'help' || cmd === 'h') {
      addTerminalLog('Available commands:');
      addTerminalLog('  help, h        Show this help message');
      addTerminalLog('  clear, cls     Clear terminal output');
      addTerminalLog('  ls, dir        List files in current directory');
      addTerminalLog('  npm run <name> Run a script from package.json');
      addTerminalLog('  npm start      Run the project');
      addTerminalLog('  npm stop       Stop the running project');
      
      if (isRunning) {
        addTerminalLog('');
        addTerminalLog('Server-specific shortcuts:');
        addTerminalLog('  r + enter      Restart the server');
        addTerminalLog('  u + enter      Show server URL');
        addTerminalLog('  q + enter      Stop the server');
      }
      
      addTerminalLog('  date           Show current date and time');
      addTerminalLog('  echo <text>    Print text to terminal');
      addTerminalLog('  pwd            Show current working directory');
    } else if (isRunning && (cmd === 'r' || cmd === 'u' || cmd === 'q')) {
      if (cmd === 'r') {
        addTerminalLog('Restarting server...');
        setTimeout(() => {
          addTerminalLog('Server restarted successfully.');
        }, 500);
      } else if (cmd === 'u') {
        addTerminalLog(`  ➜  Local:   ${previewUrl}/ (Simulated)`);
      } else if (cmd === 'q') {
        setRunning(false);
        addTerminalLog('Stopping development server...');
        addTerminalLog('Server stopped.');
      }
    } else if (cmd === 'ls' || cmd === 'dir') {
      const allFilesList = Object.values(files);
      const currentFiles = allFilesList.filter(f => f.parentId === null || f.parentId === 'root');
      
      if (cmd === 'dir') {
        addTerminalLog(` Directory of ${promptPath}:`);
        addTerminalLog('');
        currentFiles.forEach(f => {
          const type = f.type === 'folder' ? '<DIR>' : '     ';
          addTerminalLog(`${new Date().toLocaleDateString()}  ${new Date().toLocaleTimeString()}    ${type}    ${f.name}`);
        });
      } else {
        const fileNames = currentFiles.map(f => f.name).join('  ');
        addTerminalLog(fileNames || 'No files found');
      }
    } else if (cmd === 'pwd') {
      addTerminalLog(`/${promptPath}`);
    } else if (cmd.startsWith('echo ')) {
      addTerminalLog(trimmedInput.substring(5));
    } else if (cmd.startsWith('npm install') || cmd.startsWith('npm i')) {
      const pkgs = cmd.split(' ').slice(2).join(' ') || 'dependencies';
      addTerminalLog(`Installing ${pkgs}...`);
      setTimeout(() => {
        addTerminalLog('added 42 packages, and audited 43 packages in 2s');
        addTerminalLog('found 0 vulnerabilities');
      }, 1500);
    } else if (cmd.startsWith('npm run ') || cmd === 'npm start') {
      if (isRunning) {
        addTerminalLog('Project is already running!');
      } else {
        let scriptName = cmd === 'npm start' ? 'start' : cmd.replace('npm run ', '');
        const availableScripts = packageJson?.scripts || {};
        
        if (cmd !== 'npm start' && !availableScripts[scriptName]) {
          addTerminalLog(`npm ERR! missing script: ${scriptName}`);
          setInput('');
          return;
        }

        setRunning(true);
        const framework = packageJson?.dependencies?.next ? 'Next.js' : 
                         packageJson?.dependencies?.vite ? 'Vite' : 
                         packageJson?.dependencies?.react ? 'React' : 'Node.js';
        
        addTerminalLog(`Starting ${framework} development server...`);
        addTerminalLog(`> ${availableScripts[scriptName] || (cmd === 'npm start' ? 'node index.js' : 'vite')}`);
        
        setTimeout(() => {
          let url = 'http://localhost:3000';
          if (framework === 'Vite') {
            url = 'http://localhost:5173';
            addTerminalLog('  VITE v5.0.0  ready in 452 ms');
            addTerminalLog(`  ➜  Local:   ${url}/ (Simulated)`);
          } else if (framework === 'Next.js') {
            url = 'http://localhost:3000';
            addTerminalLog(`  ready - started server on 0.0.0.0:3000, url: ${url} (Simulated)`);
          } else {
            url = 'http://localhost:3000';
            addTerminalLog('  Server started successfully on port 3000 (Simulated)');
            addTerminalLog(`  ➜  Local:   ${url}/ (Simulated)`);
          }
          setPreviewUrl(url);
          addTerminalLog('  ➜  Network: use --host to expose');
          addTerminalLog('  ➜  Note: This is a simulated environment. The preview is only available in the Preview tab.');
          addTerminalLog('  ➜  press h + enter to show help');
        }, 800);
      }
    } else if (cmd === 'npm stop') {
      if (!isRunning) {
        addTerminalLog('Project is not running.');
      } else {
        setRunning(false);
        addTerminalLog('Stopping development server...');
        addTerminalLog('Server stopped.');
      }
    } else {
      addTerminalLog(`Command not found: ${cmd}`);
    }
    
    setInput('');
  };

  if (!isTerminalOpen) return null;

  return (
    <div className="h-64 bg-slate-950 border-t border-white/5 flex flex-col font-mono text-xs">
      <div className="flex items-center justify-between px-4 py-1.5 bg-slate-900/50 border-b border-white/5">
        <div className="flex items-center gap-2 text-slate-400">
          <TerminalIcon size={12} />
          <span className="font-semibold uppercase tracking-wider text-[10px]">Terminal</span>
          {isRunning && (
            <div className="flex items-center gap-2 ml-4">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[9px] text-green-500 font-bold">RUNNING</span>
            </div>
          )}
        </div>
        <button 
          onClick={toggleTerminal}
          className="text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X size={12} />
        </button>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-1 text-slate-300"
      >
        {terminalLogs.map((log, i) => (
          <div key={i} className={log.includes(' > ') ? "text-blue-400" : ""}>{log}</div>
        ))}
        <form onSubmit={handleCommand} className="flex items-center gap-1 mt-2">
          <span className="text-blue-400 font-bold whitespace-nowrap">{promptPath}</span>
          <ChevronRight size={14} className="text-slate-500" />
          <input
            autoFocus
            className="flex-1 bg-transparent outline-none text-slate-200"
            value={input}
            placeholder={isRunning ? "Server is running... type 'npm stop' to end" : "Type a command..."}
            onChange={(e) => setInput(e.target.value)}
          />
        </form>
      </div>
    </div>
  );
};
