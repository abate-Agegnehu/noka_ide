import net from 'node:net';

export async function findFreePort(start = 3001, max = 100): Promise<number> {
  for (let i = 0; i < max; i++) {
    const port = start + i;
    const ok = await canListen(port);
    if (ok) return port;
  }
  throw new Error('No free port found');
}

function canListen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => {
      resolve(false);
    });
    srv.listen(port, '0.0.0.0', () => {
      srv.close(() => resolve(true));
    });
  });
}
