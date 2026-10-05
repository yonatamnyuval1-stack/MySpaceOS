#!/usr/bin/env node
"use strict";
const { WebSocketServer } = require("ws");
const { execFile } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const PORT = parseInt(process.env.RH_AGENT_PORT || "8765", 10);
const MAX_W = parseInt(process.env.RH_MAX_WIDTH || "1280", 10);
const JPEG_Q = parseInt(process.env.RH_JPEG_QUALITY || "65", 10);
const FPS = Math.min(15, Math.max(3, parseInt(process.env.RH_FPS || "8", 10)));
const DIR = __dirname;
const CONFIG_PATH = path.join(DIR, "agent-config.json");
const PS = path.join(process.env.WINDIR || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
const CAPTURE = path.join(DIR, "capture.ps1");
const INPUT = path.join(DIR, "input.ps1");

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) || {};
  } catch {
    return {};
  }
}

function writeConfig(next) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), "utf8");
}

function loadOrCreateToken() {
  const fromEnv = String(process.env.RH_AGENT_TOKEN || "").trim();
  if (fromEnv) return fromEnv;
  const cfg = readConfig();
  const existing = String(cfg?.token || "").trim();
  if (existing) return existing;
  const token = crypto.randomBytes(24).toString("base64url");
  writeConfig({ ...cfg, token, createdAt: new Date().toISOString() });
  console.log(
    "My Space Remote Agent: wrote a new token to agent-config.json (token value is not logged). Paste it into Remote Hub → machine → Agent token."
  );
  return token;
}

function resolveBindHost() {
  const fromEnv = String(process.env.RH_AGENT_BIND || process.env.RH_AGENT_HOST || "").trim();
  if (fromEnv === "0.0.0.0" || fromEnv === "::" || fromEnv === "*") return "0.0.0.0";
  if (fromEnv) return fromEnv;
  const cfg = readConfig();
  if (cfg.bindLan === true || cfg.openFirewall === true) return "0.0.0.0";
  return "127.0.0.1";
}
const TOKEN = loadOrCreateToken();
const BIND_HOST = resolveBindHost();
const clients = new Set();
let streaming = false;

function runPs(file, args) {
  return new Promise((resolve, reject) => {
    execFile(
      PS,
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", file, ...args],
      { maxBuffer: 12 * 1024 * 1024, windowsHide: true },
      (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message));
        else resolve(String(stdout || "").trim());
      }
    );
  });
}

function captureScreen() {
  return runPs(CAPTURE, [String(MAX_W), String(JPEG_Q)]);
}

function sendInput(payload) {
  execFile(
    PS,
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", INPUT, JSON.stringify(payload)],
    { windowsHide: true },
    () => {}
  );
}

function parseFrame(raw) {
  const pipe = raw.lastIndexOf("|");
  if (pipe < 0) return null;
  const b64 = raw.slice(pipe + 1);
  const meta = raw.slice(0, pipe).split("|");
  if (meta.length < 4 || b64.length < 80) return null;
  return {
    screenW: parseInt(meta[0], 10),
    screenH: parseInt(meta[1], 10),
    imgW: parseInt(meta[2], 10),
    imgH: parseInt(meta[3], 10),
    data: b64,
  };
}

async function streamLoop() {
  if (streaming) return;
  streaming = true;
  const delay = Math.round(1000 / FPS);
  while (clients.size > 0) {
    try {
      const raw = await captureScreen();
      const frame = parseFrame(raw);
      if (frame) {
        const msg = JSON.stringify({ type: "frame", mime: "image/jpeg", ...frame, ts: Date.now() });
        for (const ws of clients) {
          if (ws.readyState === 1) ws.send(msg);
        }
      }
    } catch (_) {
    }
    await new Promise((r) => setTimeout(r, delay));
  }
  streaming = false;
}
const wss = new WebSocketServer({ port: PORT, host: BIND_HOST });
wss.on("connection", (ws, req) => {
  const url = new URL(req.url || "/", "http://localhost");
  if (url.searchParams.get("token") !== TOKEN) {
    ws.close(1008, "Unauthorized");
    return;
  }
  clients.add(ws);
  ws.send(
    JSON.stringify({
      type: "hello",
      agent: "myspace-remote-agent",
      version: 1,
      port: PORT,
      fps: FPS,
      maxWidth: MAX_W,
    })
  );
  if (!streaming) streamLoop();
  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(String(raw));
      if (msg.type === "input" && msg.action) sendInput(msg);
      if (msg.type === "ping") ws.send(JSON.stringify({ type: "pong", ts: Date.now() }));
    } catch (_) {
    }
  });

  ws.on("close", () => clients.delete(ws));
});
wss.on("listening", () => {
  const scope = BIND_HOST === "127.0.0.1" || BIND_HOST === "::1" ? "loopback only" : "LAN-capable";
  console.log(
    `My Space Remote Agent listening on ws://${BIND_HOST}:${PORT} (${scope}; token configured, not logged)`
  );
  if (BIND_HOST === "127.0.0.1" || BIND_HOST === "::1") {
    console.log(
      "LAN access is off. Re-run install.ps1 and accept the network exposure prompt, or set bindLan=true in agent-config.json."
    );
  }
});
process.on("SIGINT", () => {
  wss.close();
  process.exit(0);
});