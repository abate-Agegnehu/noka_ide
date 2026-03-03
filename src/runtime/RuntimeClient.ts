export type RuntimeEvent =
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'started', id: string, port: number }
  | { type: 'url', id: string, url: string }
  | { type: 'log', id: string, stream: 'stdout' | 'stderr', data: string }
  | { type: 'stopped', id: string, code?: number }
  | { type: 'error', message: string };

type Listener = (e: RuntimeEvent) => void;

export class RuntimeClient {
  private ws?: WebSocket;
  private listeners: Set<Listener> = new Set();
  private url: string;

  constructor(url = 'ws://localhost:3005') {
    this.url = url;
  }

  on(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: RuntimeEvent) {
    for (const fn of this.listeners) {
      try { fn(e); } catch {}
    }
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => this.emit({ type: 'open' });
    this.ws.onclose = () => this.emit({ type: 'close' });
    this.ws.onmessage = (m) => {
      try {
        const data = JSON.parse(String(m.data));
        if (data?.type === 'started') this.emit({ type: 'started', id: data.id, port: data.port });
        else if (data?.type === 'url') this.emit({ type: 'url', id: data.id, url: data.url });
        else if (data?.type === 'log') this.emit({ type: 'log', id: data.id, stream: data.stream, data: data.data });
        else if (data?.type === 'stopped') this.emit({ type: 'stopped', id: data.id, code: data.code });
        else if (data?.type === 'error') this.emit({ type: 'error', message: data.message });
      } catch {}
    };
  }

  start(cwd: string, framework?: string, script?: string) {
    this.connect();
    this.ws?.send(JSON.stringify({ type: 'start', cwd, framework, script }));
  }

  stop(id: string) {
    this.connect();
    this.ws?.send(JSON.stringify({ type: 'stop', id }));
  }
}
