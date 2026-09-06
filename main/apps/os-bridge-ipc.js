const path = require("path");
const fs = require("fs");
const os = require("os");
const { app, shell, clipboard, dialog } = require("electron");
const { exec } = require("child_process");
const { promisify } = require("util");
const { pairServer, inboxDir, outboxDir, clipHistoryDir, lanIPv4s, bridgeEventBus } = require("./os-bridge-pair-server");
const { nativeImage } = require("electron");

const MAX_CLIP_HISTORY = 50;

const execAsync = promisify(exec);
const STORE = () => path.join(app.getPath("userData"), "os-bridge.json");

function readStore() {
  try {
    if (fs.existsSync(STORE())) return JSON.parse(fs.readFileSync(STORE(), "utf8"));
  } catch {
  }
  return null;
}

function writeStore(data) {
  fs.mkdirSync(path.dirname(STORE()), { recursive: true });
  fs.writeFileSync(STORE(), JSON.stringify(data, null, 2), "utf8");
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function defaultPlaces() {
  const home = app.getPath("home");
  const places = [
    { id: "desktop", label: "Desktop", path: app.getPath("desktop"), kind: "system" },
    { id: "downloads", label: "Downloads", path: app.getPath("downloads"), kind: "system" },
    { id: "documents", label: "Documents", path: app.getPath("documents"), kind: "system" },
    { id: "pictures", label: "Pictures", path: app.getPath("pictures"), kind: "system" },
    { id: "home", label: "Home", path: home, kind: "system" },
    { id: "inbox", label: "Phone inbox", path: inboxDir(), kind: "system" },
  ];
  return places.filter((p) => p.path && fs.existsSync(p.path));
}

function loadState() {
  const raw = readStore() || {};
  const system = defaultPlaces();
  const custom = Array.isArray(raw.places)
    ? raw.places.filter((p) => p && p.kind === "custom" && p.path)
    : [];
  return {
    places: [...system, ...custom],
    recentActions: Array.isArray(raw.recentActions) ? raw.recentActions.slice(0, 40) : [],
    clipboardHistory: Array.isArray(raw.clipboardHistory) ? raw.clipboardHistory.slice(0, MAX_CLIP_HISTORY) : [],
    trustedDevices:
      raw.trustedDevices && typeof raw.trustedDevices === "object" ? { ...raw.trustedDevices } : {},
  };
}

function writeFullState(patch = {}) {
  const state = loadState();
  writeStore({
    places: patch.places ?? state.places.filter((p) => p.kind === "custom"),
    recentActions: patch.recentActions ?? state.recentActions,
    clipboardHistory: patch.clipboardHistory ?? state.clipboardHistory,
    trustedDevices: patch.trustedDevices ?? state.trustedDevices,
  });
}

function rememberTrustedDevice(deviceId, name, trusted = true) {
  const state = loadState();
  const id = String(deviceId || "").trim();
  if (!id) return;
  state.trustedDevices[id] = {
    name: String(name || state.trustedDevices[id]?.name || "Phone").slice(0, 120),
    trusted: trusted !== false,
    lastSeen: new Date().toISOString(),
  };
  writeFullState({ trustedDevices: state.trustedDevices });
}

function getSavedDeviceName(deviceId) {
  const id = String(deviceId || "").trim();
  return loadState().trustedDevices[id]?.name || null;
}

pairServer.getSavedDeviceName = getSavedDeviceName;

bridgeEventBus.on("bridge-event", (payload) => {
  if (!payload || typeof payload !== "object") return;
  if (payload.type === "device-paired" && payload.device) {
    rememberTrustedDevice(payload.device.id, payload.device.name, true);
  }
  if (payload.type === "clipboard-from-device") {
    void (async () => {
      if (payload.kind === "image") {
        try {
          const img = clipboard.readImage();
          if (img && !img.isEmpty()) {
            await appendClipboardHistory({
              kind: "image",
              mime: payload.mime || "image/png",
              imageBuffer: img.toPNG(),
              from: "phone",
              deviceId: payload.deviceId || "",
            });
          }
        } catch {
        }
        return;
      }
      const text = clipboard.readText() || payload.preview || "";
      if (!text.trim()) return;
      await appendClipboardHistory({
        kind: "text",
        text,
        preview: payload.preview || text.slice(0, 160),
        from: "phone",
        deviceId: payload.deviceId || "",
      });
    })();
  }
});

async function appendClipboardHistory(entry) {
  const state = loadState();
  const item = {
    id: uid("clip"),
    kind: entry.kind || "text",
    text: entry.text != null ? String(entry.text).slice(0, 8000) : "",
    preview: entry.preview || (entry.text ? String(entry.text).slice(0, 160) : ""),
    mime: entry.mime || "",
    imagePath: entry.imagePath || "",
    size: Number(entry.size) || 0,
    from: entry.from || "pc",
    deviceId: entry.deviceId || "",
    at: new Date().toISOString(),
  };
  if (entry.imageBuffer && entry.imageBuffer.length) {
    const ext = (entry.mime || "image/png").includes("jpeg") ? "jpg" : "png";
    const dest = path.join(clipHistoryDir(), `${item.id}.${ext}`);
    fs.writeFileSync(dest, entry.imageBuffer);
    item.imagePath = dest;
    item.size = entry.imageBuffer.length;
  }
  const next = [item, ...state.clipboardHistory].slice(0, MAX_CLIP_HISTORY);
  writeFullState({ clipboardHistory: next });
  return item;
}

async function listOutbox() {
  const dir = outboxDir();
  const names = await fs.promises.readdir(dir).catch(() => []);
  const files = [];
  for (const name of names) {
    const full = path.join(dir, name);
    try {
      const st = await fs.promises.stat(full);
      if (!st.isFile()) continue;
      files.push({ name, path: full, size: st.size, mtime: st.mtime.toISOString() });
    } catch {
    }
  }
  files.sort((a, b) => String(b.mtime).localeCompare(String(a.mtime)));
  return { ok: true, path: dir, files };
}

function saveCustomPlaces(places) {
  const state = loadState();
  const custom = places.filter((p) => p.kind === "custom");
  writeFullState({
    places: custom,
    recentActions: state.recentActions,
    clipboardHistory: state.clipboardHistory,
    trustedDevices: state.trustedDevices,
  });
}

function pushRecent(entry) {
  const state = loadState();
  const next = [{ ...entry, at: new Date().toISOString() }, ...state.recentActions].slice(0, 40);
  writeFullState({ recentActions: next });
  return next;
}

async function listRemovable() {
  if (process.platform !== "win32") {
    return { ok: true, drives: [] };
  }
  try {
    const ps = `Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,VolumeName,DriveType,Size,FreeSpace | ConvertTo-Json -Compress`;
    const { stdout } = await execAsync(`powershell -NoProfile -Command "${ps}"`, {
      windowsHide: true,
      timeout: 12000,
      maxBuffer: 2 * 1024 * 1024,
    });
    let rows = JSON.parse(stdout || "[]");
    if (!Array.isArray(rows)) rows = rows ? [rows] : [];
    const drives = rows
      .filter((r) => Number(r.DriveType) === 2 || Number(r.DriveType) === 3)
      .map((r) => ({
        id: String(r.DeviceID || "").replace(":", ""),
        label: r.VolumeName ? `${r.VolumeName} (${r.DeviceID})` : String(r.DeviceID),
        path: `${r.DeviceID}\\`,
        driveType: Number(r.DriveType),
        removable: Number(r.DriveType) === 2,
        size: Number(r.Size) || 0,
        free: Number(r.FreeSpace) || 0,
      }))
      .filter((d) => d.path && fs.existsSync(d.path));
    return { ok: true, drives };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), drives: [] };
  }
}

async function listInbox() {
  const dir = inboxDir();
  const names = await fs.promises.readdir(dir).catch(() => []);
  const files = [];
  for (const name of names) {
    const full = path.join(dir, name);
    try {
      const st = await fs.promises.stat(full);
      if (!st.isFile()) continue;
      files.push({
        name,
        path: full,
        size: st.size,
        mtime: st.mtime.toISOString(),
      });
    } catch {
    }
  }
  files.sort((a, b) => String(b.mtime).localeCompare(String(a.mtime)));
  return { ok: true, path: dir, files };
}

const HOST_LINKS = [
  { id: "sound", label: "Sound", hint: "Output devices & volume", url: "ms-settings:sound" },
  { id: "display", label: "Display", hint: "Monitors & scaling", url: "ms-settings:display" },
  { id: "bluetooth", label: "Bluetooth", hint: "Paired devices", url: "ms-settings:bluetooth" },
  { id: "printers", label: "Printers", hint: "Printers & scanners", url: "ms-settings:printers" },
  { id: "network", label: "Network", hint: "Wi‑Fi & status", url: "ms-settings:network" },
  { id: "apps", label: "Installed apps", hint: "Windows apps list", url: "ms-settings:appsfeatures" },
  { id: "storage", label: "Storage", hint: "Disk usage", url: "ms-settings:storagesense" },
  { id: "about", label: "About PC", hint: "Device specs", url: "ms-settings:about" },
];

async function handleOsBridgeInvoke(channel, args = {}) {
  const ch = String(channel || "");

  switch (ch) {
    case "meta":
      return {
        ok: true,
        name: "OS Bridge",
        version: 1,
        note: "Host places, share actions, and phone pairing: separate from Remote Hub.",
      };

    case "status": {
      const pair = pairServer.status();
      const inbox = await listInbox();
      const state = loadState();
      return {
        ok: true,
        pair,
        trustedDevices: state.trustedDevices,
        inboxCount: inbox.files?.length || 0,
        inboxPath: inbox.path,
        platform: process.platform,
        hostname: os.hostname(),
      };
    }

    case "places.list": {
      const state = loadState();
      return { ok: true, places: state.places };
    }

    case "places.add": {
      let folder = String(args.path || "").trim();
      if (!folder) {
        const picked = await dialog.showOpenDialog({
          title: "Add folder to OS Bridge",
          properties: ["openDirectory"],
        });
        if (picked.canceled || !picked.filePaths?.[0]) {
          return { ok: false, error: "Cancelled" };
        }
        folder = picked.filePaths[0];
      }
      if (!fs.existsSync(folder)) return { ok: false, error: "Folder not found" };
      const state = loadState();
      if (state.places.some((p) => path.resolve(p.path) === path.resolve(folder))) {
        return { ok: false, error: "Already in places" };
      }
      const place = {
        id: uid("place"),
        label: String(args.label || path.basename(folder) || folder).slice(0, 80),
        path: folder,
        kind: "custom",
      };
      saveCustomPlaces([...state.places.filter((p) => p.kind === "custom"), place]);
      return { ok: true, place, places: loadState().places };
    }

    case "places.remove": {
      const id = String(args.id || "").trim();
      const state = loadState();
      const target = state.places.find((p) => p.id === id);
      if (!target) return { ok: false, error: "Unknown place" };
      if (target.kind !== "custom") return { ok: false, error: "System places cannot be removed" };
      saveCustomPlaces(state.places.filter((p) => p.id !== id && p.kind === "custom"));
      return { ok: true, places: loadState().places };
    }

    case "places.open": {
      const p = String(args.path || "").trim();
      if (!p) return { ok: false, error: "Missing path" };
      const err = await shell.openPath(p);
      if (err) return { ok: false, error: err };
      pushRecent({ kind: "open", path: p });
      return { ok: true };
    }

    case "places.reveal": {
      const p = String(args.path || "").trim();
      if (!p) return { ok: false, error: "Missing path" };
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
        const err = await shell.openPath(p);
        if (err) return { ok: false, error: err };
      } else {
        shell.showItemInFolder(p);
      }
      pushRecent({ kind: "reveal", path: p });
      return { ok: true };
    }

    case "drives.list":
      return listRemovable();

    case "inbox.list":
      return listInbox();

    case "inbox.open": {
      const err = await shell.openPath(inboxDir());
      return err ? { ok: false, error: err } : { ok: true, path: inboxDir() };
    }

    case "inbox.clear": {
      const dir = inboxDir();
      const names = await fs.promises.readdir(dir).catch(() => []);
      for (const name of names) {
        await fs.promises.unlink(path.join(dir, name)).catch(() => {});
      }
      return { ok: true };
    }

    case "pair.status":
      return pairServer.status();

    case "pair.start":
      try {
        return await pairServer.start(args.port);
      } catch (err) {
        return { ok: false, error: err?.message || String(err) };
      }

    case "pair.stop":
      return pairServer.stop();

    case "pair.refreshCode": {
      if (!pairServer.running) {
        try {
          await pairServer.start();
        } catch (err) {
          return { ok: false, error: err?.message || String(err) };
        }
      }
      const code = pairServer.refreshPairCode();
      return { ...pairServer.status(), pairCode: code };
    }

    case "pair.qr": {
      const status = pairServer.status();
      const target = String(args.url || status.primaryUrl || "").trim();
      if (!target) return { ok: false, error: "No pair URL" };
      try {
        const QRCode = require("qrcode");
        const dataUrl = await QRCode.toDataURL(target, {
          width: 220,
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#0b0d10", light: "#ffffff" },
        });
        return { ok: true, dataUrl, url: target };
      } catch (err) {
        return { ok: false, error: err?.message || "Could not build QR" };
      }
    }

    case "pair.openUrl":
      return pairServer.openUrlOnDevices(args.url, { deviceId: args.deviceId });

    case "pair.sendFile": {
      let filePath = String(args.path || "").trim();
      if (!filePath) {
        const picked = await dialog.showOpenDialog({
          title: "Send file to phone",
          properties: ["openFile"],
        });
        if (picked.canceled || !picked.filePaths?.[0]) return { ok: false, error: "Cancelled" };
        filePath = picked.filePaths[0];
      }
      const res = pairServer.sendFileToDevices(filePath, { deviceId: args.deviceId });
      if (res.ok) pushRecent({ kind: "send-file", path: filePath, deviceId: args.deviceId || "all" });
      return res;
    }

    case "devices.revoke":
      return pairServer.revokeDevice(args.deviceId || args.id);

    case "devices.rename": {
      const res = pairServer.renameDevice(args.deviceId || args.id, args.name);
      if (res.ok) rememberTrustedDevice(res.deviceId, res.name, true);
      return res;
    }

    case "devices.trust": {
      rememberTrustedDevice(args.deviceId || args.id, args.name, true);
      return { ok: true };
    }

    case "outbox.list":
      return listOutbox();

    case "outbox.clear": {
      const dir = outboxDir();
      const names = await fs.promises.readdir(dir).catch(() => []);
      for (const name of names) {
        await fs.promises.unlink(path.join(dir, name)).catch(() => {});
      }
      return { ok: true };
    }

    case "clipboard.read": {
      const text = clipboard.readText() || "";
      let hasImage = false;
      let imageDataUrl = "";
      try {
        const img = clipboard.readImage();
        if (img && !img.isEmpty()) {
          hasImage = true;
          imageDataUrl = img.toDataURL();
        }
      } catch {
      }
      return { ok: true, text, hasImage, imageDataUrl };
    }

    case "clipboard.write": {
      const text = String(args.text ?? "");
      clipboard.writeText(text);
      await appendClipboardHistory({ kind: "text", text, from: "pc" });
      pushRecent({ kind: "clipboard-write", length: text.length });
      return { ok: true };
    }

    case "clipboard.writeImage": {
      let buf = null;
      if (args.path && fs.existsSync(args.path)) {
        buf = fs.readFileSync(args.path);
      } else if (args.imageBase64) {
        buf = Buffer.from(String(args.imageBase64), "base64");
      } else {
        const img = clipboard.readImage();
        if (img && !img.isEmpty()) buf = img.toPNG();
      }
      if (!buf?.length) return { ok: false, error: "No image in clipboard" };
      clipboard.writeImage(nativeImage.createFromBuffer(buf));
      await appendClipboardHistory({
        kind: "image",
        mime: args.mime || "image/png",
        imageBuffer: buf,
        from: "pc",
      });
      return { ok: true, size: buf.length };
    }

    case "clipboard.sendToPhone": {
      const deviceId = args.deviceId || null;
      const text = args.text != null ? String(args.text) : clipboard.readText() || "";
      if (text.trim()) {
        const n = pairServer.pushToDevices(
          { type: "clipboard-offer", kind: "text", text },
          { deviceId }
        );
        await appendClipboardHistory({ kind: "text", text, from: "pc", deviceId: deviceId || "phone" });
        return { ok: true, devices: n, kind: "text" };
      }
      const img = clipboard.readImage();
      if (img && !img.isEmpty()) {
        const png = img.toPNG();
        const b64 = png.toString("base64");
        const n = pairServer.pushToDevices(
          {
            type: "clipboard-offer",
            kind: "image",
            imageBase64: b64,
            mime: "image/png",
            size: png.length,
          },
          { deviceId }
        );
        await appendClipboardHistory({
          kind: "image",
          mime: "image/png",
          imageBuffer: png,
          from: "pc",
          deviceId: deviceId || "phone",
        });
        return { ok: true, devices: n, kind: "image" };
      }
      return { ok: false, error: "Clipboard is empty" };
    }

    case "clipboard.history":
      return { ok: true, items: loadState().clipboardHistory };

    case "clipboard.history.clear": {
      const state = loadState();
      for (const item of state.clipboardHistory) {
        if (item.imagePath && fs.existsSync(item.imagePath)) {
          try {
            fs.unlinkSync(item.imagePath);
          } catch {
          }
        }
      }
      writeFullState({ clipboardHistory: [] });
      return { ok: true };
    }

    case "clipboard.history.use": {
      const id = String(args.id || "").trim();
      const item = loadState().clipboardHistory.find((x) => x.id === id);
      if (!item) return { ok: false, error: "History item not found" };
      if (item.kind === "image" && item.imagePath && fs.existsSync(item.imagePath)) {
        const buf = fs.readFileSync(item.imagePath);
        clipboard.writeImage(nativeImage.createFromBuffer(buf));
        return { ok: true, kind: "image" };
      }
      clipboard.writeText(item.text || "");
      return { ok: true, kind: "text", text: item.text || "" };
    }

    case "share.copyPath": {
      const p = String(args.path || "").trim();
      if (!p) return { ok: false, error: "Missing path" };
      clipboard.writeText(p);
      pushRecent({ kind: "copy-path", path: p });
      return { ok: true };
    }

    case "share.openExternal": {
      const url = String(args.url || args.path || "").trim();
      if (!url) return { ok: false, error: "Missing URL" };
      await shell.openExternal(url);
      pushRecent({ kind: "open-external", url });
      return { ok: true };
    }

    case "share.pickFile": {
      const picked = await dialog.showOpenDialog({
        title: "Pick a file",
        properties: ["openFile", "multiSelections"],
      });
      if (picked.canceled) return { ok: false, error: "Cancelled" };
      return { ok: true, paths: picked.filePaths || [] };
    }

    case "share.pickFolder": {
      const picked = await dialog.showOpenDialog({
        title: "Pick a folder",
        properties: ["openDirectory"],
      });
      if (picked.canceled || !picked.filePaths?.[0]) return { ok: false, error: "Cancelled" };
      return { ok: true, path: picked.filePaths[0] };
    }

    case "share.saveClipboard": {
      const text = clipboard.readText() || "";
      if (!text) return { ok: false, error: "Clipboard is empty" };
      const name = `clipboard-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.txt`;
      const dest = path.join(inboxDir(), name);
      fs.writeFileSync(dest, text, "utf8");
      pushRecent({ kind: "save-clipboard", path: dest });
      return { ok: true, path: dest };
    }

    case "host.links":
      return { ok: true, links: HOST_LINKS };

    case "host.open": {
      const id = String(args.id || "").trim();
      const link = HOST_LINKS.find((l) => l.id === id) || null;
      const url = link?.url || String(args.url || "").trim();
      if (!url) return { ok: false, error: "Unknown host link" };
      await shell.openExternal(url);
      pushRecent({ kind: "host", id: link?.id || id, url });
      return { ok: true };
    }

    case "recent.list":
      return { ok: true, recent: loadState().recentActions };

    case "lan.ips":
      return { ok: true, ips: lanIPv4s() };

    default:
      return { ok: false, error: `Unknown OS Bridge action: ${ch}` };
  }
}

module.exports = { handleOsBridgeInvoke, pairServer };
