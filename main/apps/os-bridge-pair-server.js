const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { EventEmitter } = require("events");
const { app, clipboard, BrowserWindow, nativeImage } = require("electron");

const DEFAULT_PORT = 17834;
const MAX_UPLOAD_BYTES = 40 * 1024 * 1024;
const MAX_CLIPBOARD_IMAGE = 8 * 1024 * 1024;
const CODE_TTL_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const FILE_OFFER_TTL_MS = 2 * 60 * 60 * 1000;
const PAIR_MAX_ATTEMPTS = 5;
const PAIR_LOCKOUT_MS = 60 * 1000;

function bridgeRoot() {
  const profile = require("../myspace-profile");
  return profile.profileScopedPath("os-bridge");
}

function inboxDir() {
  const dir = path.join(bridgeRoot(), "inbox");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function outboxDir() {
  const dir = path.join(bridgeRoot(), "outbox");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function clipHistoryDir() {
  const dir = path.join(bridgeRoot(), "clipboard");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function safeName(name) {
  return String(name || "file")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .slice(0, 120);
}

function scoreLanInterface(name, address) {
  const n = String(name || "").toLowerCase();
  const ip = String(address || "");
  let score = 0;
  if (
    /virtual|vmware|vbox|virtualbox|hyper-v|vethernet|docker|wsl|loopback|bluetooth|teredo|isatap|vpn|tap-windows|radmin|zerotier|hamachi|tailscale|nordlynx|wireguard/.test(
      n
    )
  ) {
    score -= 200;
  }
  if (/wi-?fi|wlan|wireless|wifi|wl/.test(n)) score += 120;
  if (/ethernet|eth|lan|local area/.test(n)) score += 90;
  if (ip.startsWith("192.168.")) score += 100;
  else if (ip.startsWith("10.")) score += 70;
  else if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) score += 25; 
  else score -= 40;
  return score;
}

function lanIPv4Detailed() {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const [name, list] of Object.entries(ifaces || {})) {
    for (const info of list || []) {
      if (!info || info.internal) continue;
      if (!(info.family === "IPv4" || info.family === 4)) continue;
      const address = info.address;
      out.push({
        address,
        name,
        score: scoreLanInterface(name, address),
      });
    }
  }
  out.sort((a, b) => b.score - a.score || a.address.localeCompare(b.address));
  return out;
}

function lanIPv4s() {
  return lanIPv4Detailed().map((x) => x.address);
}

function genCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function genToken() {
  return crypto.randomBytes(24).toString("hex");
}

function guessMime(name) {
  const ext = path.extname(String(name || "")).toLowerCase();
  const map = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".mp4": "video/mp4",
    ".zip": "application/zip",
  };
  return map[ext] || "application/octet-stream";
}

function findOutboxFile(id) {
  const safeId = String(id || "").replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeId) return null;
  const dir = outboxDir();
  const names = fs.readdirSync(dir);
  const match = names.find((n) => n.startsWith(`${safeId}_`) || n.startsWith(`${safeId}.`));
  return match ? path.join(dir, match) : null;
}

function broadcastBridgeEvent(payload) {
  const message = { channel: "os-bridge-event", ...payload };
  try {
    const { webContents } = require("electron");
    for (const wc of webContents.getAllWebContents()) {
      try {
        if (!wc.isDestroyed()) wc.send("os-bridge-event", message);
      } catch {
      }
    }
  } catch {
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue;
      try {
        win.webContents.send("os-bridge-event", message);
      } catch {
      }
    }
  }
  try {
    bridgeEventBus.emit("bridge-event", payload);
  } catch {
  }
}

const bridgeEventBus = new EventEmitter();

function mobileHtml(baseUrl, code) {
  const title = "My Space · OS Bridge";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <title>${title}</title>
  <style>
    :root { color-scheme: dark; --bg:#0b0d10; --card:#151920; --line:rgba(255,255,255,.08); --text:#f2f4f7; --muted:#9aa3ad; --acc:#e8ecf1; }
    * { box-sizing: border-box; }
    body { margin:0; font:16px/1.45 system-ui,sans-serif; background:radial-gradient(120% 80% at 50% -10%,#1a2230,var(--bg)); color:var(--text); min-height:100vh; }
    main { max-width:420px; margin:0 auto; padding:1.25rem 1rem 2.5rem; }
    h1 { font-size:1.35rem; margin:0 0 .35rem; letter-spacing:-.02em; }
    .sub { color:var(--muted); margin:0 0 1.25rem; font-size:.92rem; }
    .card { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:1rem; margin:0 0 .85rem; }
    label { display:block; font-size:.78rem; color:var(--muted); margin-bottom:.4rem; text-transform:uppercase; letter-spacing:.04em; }
    input, textarea, button, .file { width:100%; font:inherit; border-radius:12px; border:1px solid var(--line); background:#0e1218; color:var(--text); padding:.75rem .85rem; }
    textarea { min-height:96px; resize:vertical; }
    button { background:var(--acc); color:#111; border:none; font-weight:650; cursor:pointer; margin-top:.65rem; }
    button.secondary { background:transparent; color:var(--text); border:1px solid var(--line); }
    .row { display:flex; gap:.5rem; }
    .row > * { flex:1; }
    .status { font-size:.85rem; color:var(--muted); min-height:1.2em; margin-top:.5rem; }
    .ok { color:#7dcea0; }
    .err { color:#e08b8b; }
    .code { font-size:1.6rem; font-weight:700; letter-spacing:.2em; }
  </style>
</head>
<body>
  <main>
    <h1>OS Bridge</h1>
    <p class="sub">Paired to My Space on your PC · code <span class="code" id="shown-code">${code || "······"}</span></p>

    <div class="card" id="gate">
      <label>Pairing code</label>
      <input id="code" inputmode="numeric" maxlength="6" placeholder="6-digit code" autocomplete="one-time-code" />
      <button type="button" id="btn-pair">Connect</button>
      <p class="status" id="gate-status"></p>
    </div>

    <div id="app" hidden>
      <div class="card">
        <label>Send files to PC</label>
        <input class="file" type="file" id="file" multiple />
        <button type="button" id="btn-upload">Upload to My Space</button>
        <p class="status" id="up-status"></p>
      </div>
      <div class="card">
        <label>From PC</label>
        <p class="sub" style="margin:0">Files and links your computer sends appear here.</p>
        <div id="pc-files"></div>
        <p class="status" id="link-status">Waiting…</p>
        <button type="button" class="secondary" id="btn-open-link" hidden>Open link</button>
      </div>
      <div class="card">
        <label>Clipboard ↔ PC</label>
        <textarea id="clip" placeholder="Paste text to send to your computer"></textarea>
        <input class="file" type="file" id="clip-image" accept="image/*" />
        <div class="row">
          <button type="button" id="btn-clip">Send text</button>
          <button type="button" class="secondary" id="btn-clip-img">Send image</button>
          <button type="button" class="secondary" id="btn-read">Read from PC</button>
        </div>
        <div id="clip-preview" hidden><img id="clip-img" alt="" style="max-width:100%;border-radius:10px;margin-top:.5rem" /></div>
        <p class="status" id="clip-status"></p>
      </div>
      <div class="card">
        <button type="button" class="secondary" id="btn-disconnect">Disconnect this phone</button>
      </div>
    </div>
  </main>
  <script>
    const base = location.origin;
    let token = sessionStorage.getItem("ob_token") || "";
    let pendingUrl = "";
    let pendingFiles = [];
    const $ = (id) => document.getElementById(id);
    const params = new URLSearchParams(location.search);
    const presetCode = (params.get("c") || params.get("code") || "").trim();

    function setStatus(el, text, cls) {
      el.textContent = text || "";
      el.className = "status" + (cls ? " " + cls : "");
    }

    async function api(path, opts = {}) {
      const headers = Object.assign({}, opts.headers || {});
      if (token) headers["X-Bridge-Token"] = token;
      const res = await fetch(base + path, Object.assign({}, opts, { headers }));
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || ("HTTP " + res.status));
      return data;
    }

    function showApp() {
      $("gate").hidden = true;
      $("app").hidden = false;
      poll();
    }

    async function pair() {
      const code = ($("code").value || "").trim();
      setStatus($("gate-status"), "Connecting…");
      try {
        const data = await api("/api/pair", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, name: navigator.userAgent.slice(0, 80) }),
        });
        token = data.token;
        sessionStorage.setItem("ob_token", token);
        if (data.code) $("shown-code").textContent = data.code;
        setStatus($("gate-status"), "Connected", "ok");
        showApp();
      } catch (e) {
        setStatus($("gate-status"), e.message || "Pair failed", "err");
      }
    }

    if (presetCode) {
      $("code").value = presetCode;
      if (presetCode.length === 6) $("shown-code").textContent = presetCode;
    }

    async function upload() {
      const files = $("file").files;
      if (!files?.length) return setStatus($("up-status"), "Choose a file", "err");
      setStatus($("up-status"), "Uploading…");
      try {
        for (const file of files) {
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error("Could not read file"));
            reader.readAsDataURL(file);
          });
          const b64 = String(dataUrl).split(",")[1] || "";
          await api("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: file.name, mime: file.type, dataBase64: b64 }),
          });
        }
        $("file").value = "";
        setStatus($("up-status"), "Saved in OS Bridge inbox on your PC", "ok");
      } catch (e) {
        setStatus($("up-status"), e.message || "Upload failed", "err");
      }
    }

    async function sendClip() {
      const text = $("clip").value || "";
      if (!text.trim()) return setStatus($("clip-status"), "Nothing to send", "err");
      try {
        await api("/api/clipboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        setStatus($("clip-status"), "Sent to PC clipboard", "ok");
      } catch (e) {
        setStatus($("clip-status"), e.message || "Failed", "err");
      }
    }

    async function readClip() {
      try {
        const data = await api("/api/clipboard");
        $("clip").value = data.text || "";
        if (data.hasImage && data.imageBase64) {
          $("clip-preview").hidden = false;
          $("clip-img").src = "data:" + (data.mime || "image/png") + ";base64," + data.imageBase64;
        } else {
          $("clip-preview").hidden = true;
        }
        setStatus($("clip-status"), "Loaded from PC", "ok");
      } catch (e) {
        setStatus($("clip-status"), e.message || "Failed", "err");
      }
    }

    async function sendClipImage() {
      const file = $("clip-image").files?.[0];
      if (!file) return setStatus($("clip-status"), "Choose an image", "err");
      setStatus($("clip-status"), "Sending image…");
      try {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error("Could not read image"));
          reader.readAsDataURL(file);
        });
        const b64 = String(dataUrl).split(",")[1] || "";
        await api("/api/clipboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: b64, mime: file.type || "image/png" }),
        });
        $("clip-image").value = "";
        setStatus($("clip-status"), "Image sent to PC clipboard", "ok");
      } catch (e) {
        setStatus($("clip-status"), e.message || "Failed", "err");
      }
    }

    function renderPcFiles() {
      const box = $("pc-files");
      if (!box) return;
      if (!pendingFiles.length && !pendingUrl) {
        box.innerHTML = "";
        return;
      }
      const fileHtml = pendingFiles.map((f, i) =>
        '<div class="card" style="padding:.65rem;margin:.5rem 0">' +
        '<strong>' + (f.name || "File") + '</strong>' +
        '<div class="sub">' + (f.size ? Math.round(f.size/1024) + ' KB' : '') + '</div>' +
        '<button type="button" class="secondary" data-dl="' + i + '">Download</button></div>'
      ).join("");
      box.innerHTML = fileHtml;
      box.querySelectorAll("[data-dl]").forEach((btn) => {
        btn.onclick = async () => {
          const f = pendingFiles[Number(btn.dataset.dl)];
          if (!f?.downloadPath) return;
          try {
            const res = await fetch(base + f.downloadPath, { headers: { "X-Bridge-Token": token } });
            if (!res.ok) throw new Error("Download failed");
            const blob = await res.blob();
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = f.name || "download";
            a.click();
            URL.revokeObjectURL(a.href);
          } catch (e) {
            setStatus($("link-status"), e.message || "Download failed", "err");
          }
        };
      });
    }

    async function poll() {
      if (!token) return;
      try {
        const data = await api("/api/poll?wait=20");
        const ev = data.event;
        if (ev?.type === "open-url" && ev.url) {
          pendingUrl = ev.url;
          $("link-status").textContent = pendingUrl;
          $("link-status").className = "status ok";
          $("btn-open-link").hidden = false;
        }
        if (ev?.type === "file-offer" && ev.id) {
          pendingFiles.unshift({
            id: ev.id,
            name: ev.name,
            size: ev.size,
            mime: ev.mime,
            downloadPath: ev.downloadPath || ("/api/file/" + ev.id),
          });
          pendingFiles = pendingFiles.slice(0, 8);
          $("link-status").textContent = "New file from PC: " + (ev.name || "file");
          $("link-status").className = "status ok";
          renderPcFiles();
        }
        if (ev?.type === "clipboard-offer") {
          if (ev.kind === "text" && ev.text != null) {
            $("clip").value = ev.text;
            $("clip-preview").hidden = true;
            setStatus($("clip-status"), "Text from PC clipboard", "ok");
          } else if (ev.kind === "image" && ev.imageBase64) {
            $("clip-preview").hidden = false;
            $("clip-img").src = "data:" + (ev.mime || "image/png") + ";base64," + ev.imageBase64;
            setStatus($("clip-status"), "Image from PC: tap and hold to save", "ok");
          }
        }
      } catch (_) { /* ignore */ }
      setTimeout(poll, 400);
    }

    async function disconnect() {
      try {
        await api("/api/disconnect", { method: "POST" });
      } catch (_) { /* ignore */ }
      sessionStorage.removeItem("ob_token");
      token = "";
      $("app").hidden = true;
      $("gate").hidden = false;
      setStatus($("gate-status"), "Disconnected", "ok");
    }

    $("btn-pair").onclick = pair;
    $("btn-upload").onclick = upload;
    $("btn-clip").onclick = sendClip;
    $("btn-clip-img").onclick = sendClipImage;
    $("btn-read").onclick = readClip;
    $("btn-open-link").onclick = () => { if (pendingUrl) location.href = pendingUrl; };
    $("btn-disconnect").onclick = disconnect;
    $("code").addEventListener("keydown", (e) => { if (e.key === "Enter") pair(); });

    if (token) {
      api("/api/session").then((s) => {
        if (s.ok) {
          if (s.code) $("shown-code").textContent = s.code;
          showApp();
        } else {
          sessionStorage.removeItem("ob_token");
          token = "";
          if (presetCode && /^\d{6}$/.test(presetCode)) pair();
        }
      }).catch(() => {
        sessionStorage.removeItem("ob_token");
        token = "";
        if (presetCode && /^\d{6}$/.test(presetCode)) pair();
      });
    } else if (presetCode && /^\d{6}$/.test(presetCode)) {
      pair();
    }
  </script>
</body>
</html>`;
}

class PairServer extends EventEmitter {
  constructor() {
    super();
    this.server = null;
    this.port = DEFAULT_PORT;
    this.pairCode = null;
    this.pairCodeExpires = 0;
    this.sessions = new Map();
    this.pairFailByIp = new Map();
    this.running = false;
  }

  clientIp(req) {
    const raw = req?.socket?.remoteAddress || req?.connection?.remoteAddress || "";
    return String(raw).replace(/^::ffff:/, "") || "unknown";
  }

  pairLockoutRemaining(ip) {
    const row = this.pairFailByIp.get(ip);
    if (!row?.lockedUntil) return 0;
    const left = row.lockedUntil - Date.now();
    if (left <= 0) {
      this.pairFailByIp.delete(ip);
      return 0;
    }
    return left;
  }

  recordPairFailure(ip) {
    const row = this.pairFailByIp.get(ip) || { count: 0, lockedUntil: 0 };
    if (row.lockedUntil && row.lockedUntil > Date.now()) return row;
    row.count += 1;
    if (row.count >= PAIR_MAX_ATTEMPTS) {
      row.lockedUntil = Date.now() + PAIR_LOCKOUT_MS;
      row.count = 0;
    }
    this.pairFailByIp.set(ip, row);
    return row;
  }

  clearPairFailures(ip) {
    this.pairFailByIp.delete(ip);
  }

  status() {
    const networks = lanIPv4Detailed();
    const ips = networks.map((n) => n.address);
    const codeActive = this.pairCode && Date.now() < this.pairCodeExpires;
    const devices = [...this.sessions.entries()].map(([token, s]) => ({
      id: s.id,
      name: s.name,
      lastSeen: s.lastSeen,
      createdAt: s.createdAt,
      trusted: !!s.trusted,
    }));
    const urls = ips.map((ip) => {
      const base = `http://${ip}:${this.port}/`;
      return codeActive ? `${base}?c=${this.pairCode}` : base;
    });
    const preferred =
      networks.find((n) => n.score >= 50) || networks[0] || null;
    const primaryIp = preferred?.address || ips[0] || null;
    const primaryUrl = primaryIp
      ? codeActive
        ? `http://${primaryIp}:${this.port}/?c=${this.pairCode}`
        : `http://${primaryIp}:${this.port}/`
      : `http://127.0.0.1:${this.port}/`;
    return {
      ok: true,
      running: this.running,
      port: this.port,
      ips,
      networks,
      urls,
      primaryIp,
      primaryUrl,
      pairCode: codeActive ? this.pairCode : null,
      pairCodeExpires: codeActive ? this.pairCodeExpires : null,
      devices,
      inboxPath: inboxDir(),
      tip: "Phone must be on the same Wi‑Fi. If the page won't load, pick another link below or allow port " + this.port + " in Windows Firewall.",
    };
  }

  refreshPairCode() {
    this.pairCode = genCode();
    this.pairCodeExpires = Date.now() + CODE_TTL_MS;
    return this.pairCode;
  }

  async start(port = DEFAULT_PORT) {
    if (this.running) return this.status();
    this.port = Number(port) || DEFAULT_PORT;
    if (!this.pairCode || Date.now() >= this.pairCodeExpires) this.refreshPairCode();

    await new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => this.handle(req, res));
      this.server.on("error", reject);
      this.server.listen(this.port, "0.0.0.0", () => resolve());
    });
    this.running = true;
    broadcastBridgeEvent({ type: "server", running: true, ...this.status() });
    return this.status();
  }

  async stop() {
    if (!this.server) {
      this.running = false;
      return { ok: true, running: false };
    }
    await new Promise((resolve) => this.server.close(() => resolve()));
    this.server = null;
    this.running = false;
    this.sessions.clear();
    broadcastBridgeEvent({ type: "server", running: false });
    return { ok: true, running: false };
  }

  auth(req) {
    const token = String(req.headers["x-bridge-token"] || "").trim();
    if (!token) return null;
    const session = this.sessions.get(token);
    if (!session) return null;
    if (Date.now() - new Date(session.lastSeen).getTime() > SESSION_TTL_MS) {
      this.sessions.delete(token);
      return null;
    }
    session.lastSeen = new Date().toISOString();
    return session;
  }

  readBody(req, limit = MAX_UPLOAD_BYTES + 1024 * 256) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      req.on("data", (c) => {
        size += c.length;
        if (size > limit) {
          reject(new Error("Payload too large"));
          req.destroy();
          return;
        }
        chunks.push(c);
      });
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", reject);
    });
  }

  sendJson(res, status, obj) {
    const body = JSON.stringify(obj);
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
    });
    res.end(body);
  }

  async handle(req, res) {
    try {
      const url = new URL(req.url || "/", `http://127.0.0.1:${this.port}`);
      if (req.method === "OPTIONS") {
        res.writeHead(405, { Allow: "GET, POST" });
        res.end();
        return;
      }

      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
        const html = mobileHtml(this.status().primaryUrl, this.pairCode || "");
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/status") {
        this.sendJson(res, 200, {
          ok: true,
          running: this.running,
          needsCode: true,
          name: "My Space OS Bridge",
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/pair") {
        const ip = this.clientIp(req);
        const lockLeft = this.pairLockoutRemaining(ip);
        if (lockLeft > 0) {
          const secs = Math.ceil(lockLeft / 1000);
          return this.sendJson(res, 429, {
            ok: false,
            error: `Too many wrong codes — try again in ${secs}s`,
            retryAfterSec: secs,
          });
        }
        const raw = await this.readBody(req, 64 * 1024);
        let body = {};
        try {
          body = JSON.parse(raw.toString("utf8") || "{}");
        } catch {
          return this.sendJson(res, 400, { ok: false, error: "Invalid JSON" });
        }
        const code = String(body.code || "").trim();
        if (!this.pairCode || Date.now() >= this.pairCodeExpires) {
          return this.sendJson(res, 400, { ok: false, error: "Code expired — refresh on PC" });
        }
        if (code !== this.pairCode) {
          const row = this.recordPairFailure(ip);
          if (row.lockedUntil && row.lockedUntil > Date.now()) {
            const secs = Math.ceil((row.lockedUntil - Date.now()) / 1000);
            return this.sendJson(res, 429, {
              ok: false,
              error: `Too many wrong codes — try again in ${secs}s`,
              retryAfterSec: secs,
            });
          }
          const left = PAIR_MAX_ATTEMPTS - row.count;
          return this.sendJson(res, 403, {
            ok: false,
            error: left > 0 ? `Wrong pairing code (${left} tries left)` : "Wrong pairing code",
          });
        }
        this.clearPairFailures(ip);
        const token = genToken();
        const savedName = typeof this.getSavedDeviceName === "function" ? this.getSavedDeviceName(body.deviceId) : null;
        const session = {
          id: body.deviceId && String(body.deviceId).startsWith("dev_") ? String(body.deviceId) : `dev_${Date.now().toString(36)}`,
          name: String(body.name || savedName || "Phone").slice(0, 120),
          createdAt: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
          trusted: !!body.trusted,
          queue: [],
        };
        this.sessions.set(token, session);
        broadcastBridgeEvent({ type: "device-paired", device: { id: session.id, name: session.name } });
        this.sendJson(res, 200, { ok: true, token, code: this.pairCode, deviceId: session.id });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/disconnect") {
        const session = this.auth(req);
        if (!session) return this.sendJson(res, 401, { ok: false, error: "Not paired" });
        for (const [tok, s] of this.sessions.entries()) {
          if (s.id === session.id) {
            this.sessions.delete(tok);
            broadcastBridgeEvent({ type: "device-revoked", deviceId: session.id });
            break;
          }
        }
        return this.sendJson(res, 200, { ok: true });
      }

      if (req.method === "GET" && url.pathname.startsWith("/api/file/")) {
        const session = this.auth(req);
        if (!session) return this.sendJson(res, 401, { ok: false, error: "Not paired" });
        const fileId = url.pathname.slice("/api/file/".length);
        const full = findOutboxFile(fileId);
        if (!full || !fs.existsSync(full)) {
          return this.sendJson(res, 404, { ok: false, error: "File expired or missing" });
        }
        const name = full.split("_").slice(1).join("_") || path.basename(full);
        const mime = guessMime(name);
        res.writeHead(200, {
          "Content-Type": mime,
          "Content-Disposition": `attachment; filename="${safeName(name)}"`,
        });
        fs.createReadStream(full).pipe(res);
        return;
      }

      if (url.pathname === "/api/session") {
        const session = this.auth(req);
        if (!session) return this.sendJson(res, 401, { ok: false, error: "Not paired" });
        return this.sendJson(res, 200, { ok: true, code: this.pairCode, deviceId: session.id, name: session.name });
      }

      if (url.pathname === "/api/clipboard" && req.method === "GET") {
        const session = this.auth(req);
        if (!session) return this.sendJson(res, 401, { ok: false, error: "Not paired" });
        const text = clipboard.readText() || "";
        let hasImage = false;
        let imageBase64 = "";
        let mime = "image/png";
        try {
          const img = clipboard.readImage();
          if (img && !img.isEmpty()) {
            const png = img.toPNG();
            if (png.length && png.length <= MAX_CLIPBOARD_IMAGE) {
              hasImage = true;
              imageBase64 = png.toString("base64");
            }
          }
        } catch {
        }
        return this.sendJson(res, 200, { ok: true, text, hasImage, imageBase64, mime });
      }

      if (url.pathname === "/api/clipboard" && req.method === "POST") {
        const session = this.auth(req);
        if (!session) return this.sendJson(res, 401, { ok: false, error: "Not paired" });
        const raw = await this.readBody(req, 12 * 1024 * 1024);
        let body = {};
        try {
          body = JSON.parse(raw.toString("utf8") || "{}");
        } catch {
          return this.sendJson(res, 400, { ok: false, error: "Invalid JSON" });
        }
        const text = body.text != null ? String(body.text) : null;
        const imageBase64 = String(body.imageBase64 || "");
        const imageMime = String(body.mime || "image/png");
        if (imageBase64) {
          let buf;
          try {
            buf = Buffer.from(imageBase64, "base64");
          } catch {
            return this.sendJson(res, 400, { ok: false, error: "Bad image encoding" });
          }
          if (buf.length > MAX_CLIPBOARD_IMAGE) {
            return this.sendJson(res, 400, { ok: false, error: "Image too large (max 8 MB)" });
          }
          clipboard.writeImage(nativeImage.createFromBuffer(buf));
          broadcastBridgeEvent({
            type: "clipboard-from-device",
            deviceId: session.id,
            kind: "image",
            mime: imageMime,
            size: buf.length,
          });
        }
        if (text !== null) {
          clipboard.writeText(text);
          broadcastBridgeEvent({
            type: "clipboard-from-device",
            deviceId: session.id,
            kind: "text",
            preview: text.slice(0, 120),
            length: text.length,
          });
        }
        return this.sendJson(res, 200, { ok: true });
      }

      if (url.pathname === "/api/upload" && req.method === "POST") {
        const session = this.auth(req);
        if (!session) return this.sendJson(res, 401, { ok: false, error: "Not paired" });
        const raw = await this.readBody(req);
        let body = {};
        try {
          body = JSON.parse(raw.toString("utf8") || "{}");
        } catch {
          return this.sendJson(res, 400, { ok: false, error: "Invalid JSON" });
        }
        const name = safeName(body.name || "upload.bin");
        const b64 = String(body.dataBase64 || "");
        if (!b64) return this.sendJson(res, 400, { ok: false, error: "Missing file data" });
        let buf;
        try {
          buf = Buffer.from(b64, "base64");
        } catch {
          return this.sendJson(res, 400, { ok: false, error: "Bad file encoding" });
        }
        if (buf.length > MAX_UPLOAD_BYTES) {
          return this.sendJson(res, 400, { ok: false, error: "File too large (max 40 MB)" });
        }
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const dest = path.join(inboxDir(), `${stamp}_${name}`);
        fs.writeFileSync(dest, buf);
        broadcastBridgeEvent({
          type: "file-received",
          deviceId: session.id,
          path: dest,
          name,
          size: buf.length,
        });
        try {
          const { push } = require("./notifications-center");
          push({
            appId: "os-bridge",
            title: "File from phone",
            body: name,
            route: { page: "devices" },
          });
        } catch {
        }
        return this.sendJson(res, 200, { ok: true, path: dest, name });
      }

      if (url.pathname === "/api/poll" && req.method === "GET") {
        const session = this.auth(req);
        if (!session) return this.sendJson(res, 401, { ok: false, error: "Not paired" });
        const waitSec = Math.min(25, Math.max(0, Number(url.searchParams.get("wait") || 0)));
        const event = session.queue.shift();
        if (event) return this.sendJson(res, 200, { ok: true, event });
        if (waitSec <= 0) return this.sendJson(res, 200, { ok: true, event: null });
        const started = Date.now();
        const tick = () => {
          const next = session.queue.shift();
          if (next) return this.sendJson(res, 200, { ok: true, event: next });
          if (Date.now() - started >= waitSec * 1000) {
            return this.sendJson(res, 200, { ok: true, event: null });
          }
          setTimeout(tick, 400);
        };
        setTimeout(tick, 400);
        return;
      }

      this.sendJson(res, 404, { ok: false, error: "Not found" });
    } catch (err) {
      this.sendJson(res, 500, { ok: false, error: err?.message || String(err) });
    }
  }

  pushToDevice(deviceId, event) {
    let n = 0;
    for (const session of this.sessions.values()) {
      if (session.id !== deviceId) continue;
      session.queue.push({ ...event, at: new Date().toISOString() });
      if (session.queue.length > 40) session.queue.shift();
      n += 1;
    }
    return n;
  }

  pushToDevices(event, opts = {}) {
    if (opts.deviceId) return this.pushToDevice(opts.deviceId, event);
    let n = 0;
    for (const session of this.sessions.values()) {
      session.queue.push({ ...event, at: new Date().toISOString() });
      if (session.queue.length > 40) session.queue.shift();
      n += 1;
    }
    return n;
  }

  revokeDevice(deviceId) {
    const id = String(deviceId || "").trim();
    if (!id) return { ok: false, error: "Missing device id" };
    for (const [token, session] of this.sessions.entries()) {
      if (session.id === id) {
        this.sessions.delete(token);
        broadcastBridgeEvent({ type: "device-revoked", deviceId: id });
        return { ok: true, deviceId: id };
      }
    }
    return { ok: false, error: "Device not connected" };
  }

  renameDevice(deviceId, name) {
    const id = String(deviceId || "").trim();
    const label = String(name || "").trim().slice(0, 120);
    if (!id || !label) return { ok: false, error: "Device id and name required" };
    for (const session of this.sessions.values()) {
      if (session.id === id) {
        session.name = label;
        broadcastBridgeEvent({ type: "device-renamed", deviceId: id, name: label });
        return { ok: true, deviceId: id, name: label };
      }
    }
    return { ok: false, error: "Device not connected" };
  }

  sendFileToDevices(sourcePath, opts = {}) {
    const src = String(sourcePath || "").trim();
    if (!src || !fs.existsSync(src)) return { ok: false, error: "File not found" };
    const st = fs.statSync(src);
    if (!st.isFile()) return { ok: false, error: "Not a file" };
    if (st.size > MAX_UPLOAD_BYTES) return { ok: false, error: "File too large (max 40 MB)" };
    const id = `f_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
    const name = path.basename(src);
    const dest = path.join(outboxDir(), `${id}_${safeName(name)}`);
    fs.copyFileSync(src, dest);
    const offer = {
      type: "file-offer",
      id,
      name,
      size: st.size,
      mime: guessMime(name),
      downloadPath: `/api/file/${id}`,
      expiresAt: new Date(Date.now() + FILE_OFFER_TTL_MS).toISOString(),
    };
    const n = opts.deviceId
      ? this.pushToDevice(opts.deviceId, offer)
      : this.pushToDevices(offer);
    broadcastBridgeEvent({ type: "file-sent", ...offer, devices: n, deviceId: opts.deviceId || null });
    return { ok: true, id, name, size: st.size, devices: n };
  }

  openUrlOnDevices(url, opts = {}) {
    const u = String(url || "").trim();
    if (!u) return { ok: false, error: "Missing URL" };
    const n = opts.deviceId
      ? this.pushToDevice(opts.deviceId, { type: "open-url", url: u })
      : this.pushToDevices({ type: "open-url", url: u });
    broadcastBridgeEvent({ type: "open-url-queued", url: u, devices: n, deviceId: opts.deviceId || null });
    return { ok: true, devices: n };
  }
}

const pairServer = new PairServer();

module.exports = {
  pairServer,
  bridgeEventBus,
  inboxDir,
  outboxDir,
  clipHistoryDir,
  lanIPv4s,
  lanIPv4Detailed,
  broadcastBridgeEvent,
  findOutboxFile,
  guessMime,
};