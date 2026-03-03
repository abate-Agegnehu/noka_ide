import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import http from 'node:http';
import { startProcess, stopProcess, listProcesses, extractUrlFromLogs } from './processManager';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

type WSMessage =
  | { type: 'start', cwd: string, framework?: string, script?: string }
  | { type: 'stop', id: string }
  | { type: 'subscribe', id: string }
  | { type: 'ping' };

wss.on('connection', (ws) => {
  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(String(raw)) as WSMessage;
      if (msg.type === 'start') {
        const proc = await startProcess({ cwd: msg.cwd, framework: msg.framework as any, script: msg.script });
        ws.send(JSON.stringify({ type: 'started', id: proc.id, port: proc.port }));
        proc.child.stdout.on('data', (buf) => {
          const text = String(buf);
          ws.send(JSON.stringify({ type: 'log', id: proc.id, stream: 'stdout', data: text }));
          const url = extractUrlFromLogs(text);
          if (url) {
            ws.send(JSON.stringify({ type: 'url', id: proc.id, url }));
          }
        });
        proc.child.stderr.on('data', (buf) => {
          const text = String(buf);
          ws.send(JSON.stringify({ type: 'log', id: proc.id, stream: 'stderr', data: text }));
        });
        proc.child.on('exit', (code) => {
          ws.send(JSON.stringify({ type: 'stopped', id: proc.id, code }));
        });
      } else if (msg.type === 'stop') {
        const ok = stopProcess(msg.id);
        ws.send(JSON.stringify({ type: 'stopped', id: msg.id, ok }));
      } else if (msg.type === 'subscribe') {
        // No-op for now; basic single-client streaming
      } else if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', message: (e as Error).message || 'error' }));
    }
  });
  ws.send(JSON.stringify({ type: 'hello', processes: listProcesses() }));
});

const PORT = process.env.NOVA_BACKEND_PORT ? Number(process.env.NOVA_BACKEND_PORT) : 3005;
server.listen(PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`Nova backend listening on http://localhost:${PORT}`);
});
