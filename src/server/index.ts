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

  console.log(`[FS] Detecting path for project: ${name}`);

  // Heuristic: search for folder name in common locations
  const home = process.env.USERPROFILE || process.env.HOME || "";
  const searchPaths = [
    process.cwd(),
    path.join(process.cwd(), ".."),
    path.join(process.cwd(), "..", ".."),
    path.join(home, "Documents", "Github"),
    path.join(home, "Documents"),
    path.join(home, "Desktop"),
    path.join(home, "Downloads"),
    path.join(home, "Music", "HTML", "react"), // Added specifically for user's structure
    path.join(home, "Music"),
    path.join(home, "repos"),
    path.join(home, "workspace"),
    path.join(home, "projects"),
  ];

  for (const p of searchPaths) {
    if (!fs.existsSync(p)) continue;

    // Check if the directory itself is the target
    if (path.basename(p) === name) {
      console.log(`[FS] Found exact match: ${p}`);
      return res.json({ path: p });
    }

    const full = path.join(p, name);
    try {
      if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
        console.log(`[FS] Detected project path for "${name}": ${full}`);
        return res.json({ path: full });
      }
    } catch (e) {
      // Ignore errors for specific paths
    }
  }

  // Deep search in parent directory (one level up from process.cwd())
  try {
    const parent = path.join(process.cwd(), "..");
    if (fs.existsSync(parent)) {
      console.log(`[FS] Searching in sibling folders of: ${parent}`);
      const entries = fs.readdirSync(parent, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Check if this sibling folder contains the project
          if (entry.name === name) {
            const full = path.join(parent, entry.name);
            console.log(`[FS] Found sibling folder match: ${full}`);
            return res.json({ path: full });
          }
          // Check if the project is a subfolder of this sibling (e.g. monorepo)
          const sub = path.join(parent, entry.name, name);
          if (fs.existsSync(sub) && fs.statSync(sub).isDirectory()) {
            console.log(`[FS] Found sub-sibling match: ${sub}`);
            return res.json({ path: sub });
          }
        }
      }
    }
  } catch (e) {}

  // If not found, try a shallow search in Home subfolders
  const homeSubfolders = ["Music", "Documents", "Downloads", "Desktop"];
  for (const sub of homeSubfolders) {
    const base = path.join(home, sub);
    if (!fs.existsSync(base)) continue;
    try {
      const entries = fs.readdirSync(base, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const full = path.join(base, entry.name, name);
          if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
            console.log(`[FS] Found deep in Home/${sub}: ${full}`);
            return res.json({ path: full });
          }
        }
      }
    } catch (e) {}
  }

  // If not found, don't fallback to process.cwd() here.
  // Returning null allows the frontend to handle fallback behavior or prompt the user.
  console.log(`[FS] No path detected for: ${name}`);
  res.json({ path: null });
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
        const session = createPtySession(msg.id, msg.cwd, (data) => {
          ws.send(JSON.stringify({ type: "pty-output", id: msg.id, data }));
          
          // Automatic URL detection from terminal output
          const url = extractUrlFromLogs(data);
          if (url) {
            ws.send(JSON.stringify({ type: "url", id: "terminal-url", url }));
          }
        });
        if (msg.cols && msg.rows) {
          session.pty.resize(msg.cols, msg.rows);
        }
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
