import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import http from "node:http";
import {
  startProcess,
  stopProcess,
  listProcesses,
  extractUrlFromLogs,
} from "./processManager";
import { createPtySession, getPtySession, killPtySession } from "./ptyManager";
import fs from "node:fs";
import path from "node:path";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/detect-path", (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });

  // Heuristic: search for folder name in current directory and parent directory
  // Prioritize searching within the current directory first (as it's often a subfolder)
  const searchPaths = [
    process.cwd(),
    path.join(process.cwd(), ".."),
    path.join(process.cwd(), "..", ".."),
    // Also check common locations if the IDE is running within a monorepo structure
    path.join(process.cwd(), "projects"),
    path.join(process.cwd(), "workspace"),
  ];

  for (const p of searchPaths) {
    const full = path.join(p, name);
    try {
      if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
        // eslint-disable-next-line no-console
        console.log(`Detected project path for "${name}": ${full}`);
        return res.json({ path: full });
      }
    } catch (e) {
      // Ignore errors for specific paths
    }
  }

  // If we couldn't find it as a direct subfolder, try a recursive search one level deep
  try {
    const entries = fs.readdirSync(process.cwd(), { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const sub = path.join(process.cwd(), entry.name, name);
        if (fs.existsSync(sub) && fs.statSync(sub).isDirectory()) {
          // eslint-disable-next-line no-console
          console.log(
            `Detected project path for "${name}" (recursive): ${sub}`,
          );
          return res.json({ path: sub });
        }
      }
    }
  } catch (e) {}

  // If not found, just return the current working directory as a fallback
  res.json({ path: process.cwd() });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

type WSMessage =
  | { type: "start"; cwd: string; framework?: string; script?: string }
  | { type: "stop"; id: string }
  | { type: "subscribe"; id: string }
  | { type: "pty-start"; id: string; cwd: string; cols?: number; rows?: number }
  | { type: "pty-input"; id: string; data: string }
  | { type: "pty-resize"; id: string; cols: number; rows: number }
  | { type: "pty-kill"; id: string }
  | { type: "ping" };

wss.on("connection", (ws) => {
  ws.on("message", async (raw) => {
    try {
      const msg = JSON.parse(String(raw)) as WSMessage;

      if (msg.type === "start") {
        const proc = await startProcess({
          cwd: msg.cwd,
          framework: msg.framework as any,
          script: msg.script,
        });
        ws.send(
          JSON.stringify({ type: "started", id: proc.id, port: proc.port }),
        );
        proc.child.stdout.on("data", (buf) => {
          const text = String(buf);
          ws.send(
            JSON.stringify({
              type: "log",
              id: proc.id,
              stream: "stdout",
              data: text,
            }),
          );
          const url = extractUrlFromLogs(text);
          if (url) {
            ws.send(JSON.stringify({ type: "url", id: proc.id, url }));
          }
        });
        proc.child.stderr.on("data", (buf) => {
          const text = String(buf);
          ws.send(
            JSON.stringify({
              type: "log",
              id: proc.id,
              stream: "stderr",
              data: text,
            }),
          );
        });
        proc.child.on("exit", (code) => {
          ws.send(JSON.stringify({ type: "stopped", id: proc.id, code }));
        });
      } else if (msg.type === "stop") {
        const ok = stopProcess(msg.id);
        ws.send(JSON.stringify({ type: "stopped", id: msg.id, ok }));
      } else if (msg.type === "pty-start") {
        const session = createPtySession(msg.id, msg.cwd);
        if (msg.cols && msg.rows) {
          session.pty.resize(msg.cols, msg.rows);
        }
        session.pty.onData((data) => {
          ws.send(JSON.stringify({ type: "pty-output", id: msg.id, data }));
        });
        session.pty.onExit(({ exitCode, signal }) => {
          ws.send(
            JSON.stringify({
              type: "pty-stopped",
              id: msg.id,
              exitCode,
              signal,
            }),
          );
        });
      } else if (msg.type === "pty-input") {
        const session = getPtySession(msg.id);
        if (session) {
          // eslint-disable-next-line no-console
          console.log(`PTY Input [${msg.id}]: ${JSON.stringify(msg.data)}`);
          session.pty.write(msg.data);
        }
      } else if (msg.type === "pty-resize") {
        const session = getPtySession(msg.id);
        if (session) {
          session.pty.resize(msg.cols, msg.rows);
        }
      } else if (msg.type === "pty-kill") {
        killPtySession(msg.id);
      } else if (msg.type === "subscribe") {
        // No-op for now; basic single-client streaming
      } else if (msg.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      }
    } catch (e) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: (e as Error).message || "error",
        }),
      );
    }
  });
  ws.send(JSON.stringify({ type: "hello", processes: listProcesses() }));
});

const PORT = process.env.NOVA_BACKEND_PORT
  ? Number(process.env.NOVA_BACKEND_PORT)
  : 3005;
server.listen(PORT, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`Nova backend listening on http://localhost:${PORT}`);
});
