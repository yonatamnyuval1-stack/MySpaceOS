const path = require("path");
const fs = require("fs");
const { app, dialog, BrowserWindow, shell } = require("electron");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const STATE_FILE = "backup-state.json";
const PENDING_FILE = "backup-restore-pending.json";
const STAGING_DIR = ".backup-restore-staging";
const HISTORY_LIMIT = 40;

function userDataDir() {
  return app.getPath("userData");
}

function statePath() {
  const profile = require("../myspace-profile");
  return profile.profileScopedPath(STATE_FILE);
}

function pendingPath() {
  return path.join(userDataDir(), PENDING_FILE);
}

function stagingPath() {
  return path.join(userDataDir(), STAGING_DIR);
}

function getUserConfigPath() {
  if (app.isPackaged) {
    return path.join(userDataDir(), "user-config.json");
  }
  return path.join(__dirname, "..", "..", "config", "user-config.json");
}

async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await fs.promises.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(file, data) {
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  await fs.promises.writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

async function loadState() {
  const raw = (await readJson(statePath(), {})) || {};
  const history = Array.isArray(raw.history) ? raw.history : [];
  return {
    lastExportAt: raw.lastExportAt || null,
    lastExportPath: raw.lastExportPath || null,
    lastExportSize: raw.lastExportSize || null,
    lastRestoreAt: raw.lastRestoreAt || null,
    lastRestoreSource: raw.lastRestoreSource || null,
    history,
  };
}

async function saveState(next) {
  const history = Array.isArray(next.history) ? next.history.slice(0, HISTORY_LIMIT) : [];
  const payload = {
    lastExportAt: next.lastExportAt || null,
    lastExportPath: next.lastExportPath || null,
    lastExportSize: next.lastExportSize || null,
    lastRestoreAt: next.lastRestoreAt || null,
    lastRestoreSource: next.lastRestoreSource || null,
    history,
  };
  await writeJson(statePath(), payload);
  return payload;
}

function pushHistory(state, entry) {
  const row = {
    id: `${entry.kind || "event"}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: entry.at || new Date().toISOString(),
    kind: entry.kind || "export",
    path: entry.path || null,
    size: entry.size ?? null,
    sizeLabel: entry.sizeLabel || (entry.size != null ? formatBytes(entry.size) : null),
    note: entry.note || null,
  };
  const history = [row, ...(state.history || [])].slice(0, HISTORY_LIMIT);
  return { ...state, history };
}

async function dirSize(root) {
  let total = 0;
  async function walk(dir) {
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (ent.name === STAGING_DIR) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) await walk(full);
      else {
        try {
          const st = await fs.promises.stat(full);
          total += st.size || 0;
        } catch {
        }
      }
    }
  }
  await walk(root);
  return total;
}

function formatBytes(n) {
  const v = Number(n) || 0;
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  if (v < 1024 * 1024 * 1024) return `${(v / (1024 * 1024)).toFixed(1)} MB`;
  return `${(v / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function parentWindow(event) {
  const from = BrowserWindow.fromWebContents(event?.sender);
  if (from && !from.isDestroyed()) return from;
  return BrowserWindow.getAllWindows().find((w) => !w.isDestroyed()) || null;
}

async function copyFileSafe(src, dest) {
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  await fs.promises.copyFile(src, dest);
}

async function rimraf(target) {
  await fs.promises.rm(target, { recursive: true, force: true });
}

async function copyDirFiltered(src, dest, skipNames = new Set()) {
  await fs.promises.mkdir(dest, { recursive: true });
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  for (const ent of entries) {
    if (skipNames.has(ent.name)) continue;
    const from = path.join(src, ent.name);
    const to = path.join(dest, ent.name);
    if (ent.isDirectory()) await copyDirFiltered(from, to, skipNames);
    else await copyFileSafe(from, to);
  }
}

async function compressFolderToZip(folder, zipPath) {
  const ps = [
    `$ErrorActionPreference='Stop'`,
    `if (Test-Path -LiteralPath '${zipPath.replace(/'/g, "''")}') { Remove-Item -LiteralPath '${zipPath.replace(/'/g, "''")}' -Force }`,
    `Compress-Archive -Path '${path.join(folder, "*").replace(/'/g, "''")}' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`,
  ].join("; ");
  await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps],
    { windowsHide: true, maxBuffer: 20 * 1024 * 1024 }
  );
}

async function expandZipToFolder(zipPath, destFolder) {
  await rimraf(destFolder);
  await fs.promises.mkdir(destFolder, { recursive: true });
  const ps = [
    `$ErrorActionPreference='Stop'`,
    `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destFolder.replace(/'/g, "''")}' -Force`,
  ].join("; ");
  await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps],
    { windowsHide: true, maxBuffer: 20 * 1024 * 1024 }
  );
}

async function buildExportSnapshot(tmpRoot) {
  await rimraf(tmpRoot);
  await fs.promises.mkdir(tmpRoot, { recursive: true });
  const dataRoot = path.join(tmpRoot, "userData");
  await copyDirFiltered(userDataDir(), dataRoot, new Set([STAGING_DIR, PENDING_FILE]));

  const cfg = getUserConfigPath();
  if (fs.existsSync(cfg) && path.resolve(cfg) !== path.resolve(path.join(userDataDir(), "user-config.json"))) {
    await copyFileSafe(cfg, path.join(tmpRoot, "desktop-user-config.json"));
  }

  await writeJson(path.join(tmpRoot, "backup-meta.json"), {
    version: 1,
    createdAt: new Date().toISOString(),
    appVersion: app.getVersion?.() || null,
    userData: userDataDir(),
    packaged: !!app.isPackaged,
  });
}

async function status() {
  const root = userDataDir();
  const exists = fs.existsSync(root);
  const size = exists ? await dirSize(root) : 0;
  const state = await loadState();
  const pending = await readJson(pendingPath(), null);
  return {
    ok: true,
    path: root,
    exists,
    size,
    sizeLabel: formatBytes(size),
    lastExportAt: state.lastExportAt || null,
    lastExportPath: state.lastExportPath || null,
    lastExportSize: state.lastExportSize || null,
    lastExportSizeLabel: state.lastExportSize != null ? formatBytes(state.lastExportSize) : null,
    lastRestoreAt: state.lastRestoreAt || null,
    lastRestoreSource: state.lastRestoreSource || null,
    pendingRestore: Boolean(pending?.pending),
    pendingSource: pending?.sourceZip || null,
    pendingAt: pending?.createdAt || null,
    historyCount: (state.history || []).length,
    configPath: getUserConfigPath(),
    appVersion: app.getVersion?.() || "",
  };
}

async function history(args = {}) {
  const state = await loadState();
  let entries = [...(state.history || [])];
  const kind = String(args.kind || args.filter || "")
    .trim()
    .toLowerCase();
  if (kind === "export" || kind === "restore") {
    entries = entries.filter((e) => e.kind === kind);
  }
  const limit = Math.min(Number(args.limit) || HISTORY_LIMIT, HISTORY_LIMIT);
  return {
    ok: true,
    entries: entries.slice(0, limit),
    count: entries.length,
    lastExportAt: state.lastExportAt,
    lastRestoreAt: state.lastRestoreAt,
  };
}

async function exportBackup(event) {
  const win = parentWindow(event);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const result = await dialog.showSaveDialog(win || undefined, {
    title: "Export My Space backup",
    defaultPath: `my-space-backup-${stamp}.zip`,
    filters: [{ name: "Zip archive", extensions: ["zip"] }],
  });
  if (result.canceled || !result.filePath) {
    return { ok: false, error: "Export cancelled", cancelled: true };
  }

  const zipPath = result.filePath.endsWith(".zip") ? result.filePath : `${result.filePath}.zip`;
  const tmpRoot = path.join(userDataDir(), ".backup-export-tmp");
  try {
    await buildExportSnapshot(tmpRoot);
    await compressFolderToZip(tmpRoot, zipPath);
    let zipSize = 0;
    try {
      zipSize = (await fs.promises.stat(zipPath)).size || 0;
    } catch {
    }
    const at = new Date().toISOString();
    let state = await loadState();
    state = {
      ...state,
      lastExportAt: at,
      lastExportPath: zipPath,
      lastExportSize: zipSize,
    };
    state = pushHistory(state, {
      at,
      kind: "export",
      path: zipPath,
      size: zipSize,
      note: "Full userData export",
    });
    await saveState(state);
    return {
      ok: true,
      path: zipPath,
      size: zipSize,
      sizeLabel: formatBytes(zipSize),
      message: `Backup exported · ${zipPath}`,
    };
  } catch (err) {
    return { ok: false, error: err.message || "Export failed" };
  } finally {
    try {
      await rimraf(tmpRoot);
    } catch {
    }
  }
}

async function importBackup(event) {
  const win = parentWindow(event);
  const result = await dialog.showOpenDialog(win || undefined, {
    title: "Restore My Space backup",
    properties: ["openFile"],
    filters: [{ name: "Zip archive", extensions: ["zip"] }],
  });
  if (result.canceled || !result.filePaths?.length) {
    return { ok: false, error: "Import cancelled", cancelled: true };
  }

  const zipPath = result.filePaths[0];
  const staging = stagingPath();
  try {
    await expandZipToFolder(zipPath, staging);
    const nested = path.join(staging, "userData");
    const payloadRoot = fs.existsSync(nested) ? nested : staging;
    const at = new Date().toISOString();
    await writeJson(pendingPath(), {
      pending: true,
      createdAt: at,
      sourceZip: zipPath,
      payloadRootName: path.basename(payloadRoot) === "userData" ? "userData" : ".",
      hasDesktopConfig: fs.existsSync(path.join(staging, "desktop-user-config.json")),
    });

    let state = await loadState();
    state = pushHistory(state, {
      at,
      kind: "restore",
      path: zipPath,
      note: "Restore staged — applies on restart",
    });
    await saveState(state);

    return {
      ok: true,
      relaunch: true,
      path: zipPath,
      message:
        "Restore staged. My Space will restart and apply the backup.",
    };
  } catch (err) {
    try {
      await rimraf(staging);
    } catch {
    }
    return { ok: false, error: err.message || "Import failed" };
  }
}

async function openDataFolder() {
  const root = userDataDir();
  await fs.promises.mkdir(root, { recursive: true });
  const err = await shell.openPath(root);
  if (err) return { ok: false, error: err };
  return { ok: true, path: root, message: `Opened · ${root}` };
}

async function revealPath(args = {}) {
  const target = String(args.path || args.file || "").trim();
  if (!target) return { ok: false, error: "Missing path" };
  if (!fs.existsSync(target)) return { ok: false, error: "File not found on disk" };
  shell.showItemInFolder(target);
  return { ok: true, path: target };
}

async function applyPendingBackupRestore() {
  const pending = await readJson(pendingPath(), null);
  if (!pending?.pending) return { applied: false };

  const staging = stagingPath();
  if (!fs.existsSync(staging)) {
    await writeJson(pendingPath(), { pending: false, clearedAt: new Date().toISOString() });
    return { applied: false, error: "Staging missing" };
  }

  const nested = path.join(staging, "userData");
  const payloadRoot = fs.existsSync(nested) ? nested : staging;
  const skip = new Set([STAGING_DIR, PENDING_FILE, STATE_FILE, ".backup-export-tmp"]);

  try {
    const entries = await fs.promises.readdir(payloadRoot, { withFileTypes: true });
    for (const ent of entries) {
      if (skip.has(ent.name)) continue;
      if (ent.name === "backup-meta.json" || ent.name === "desktop-user-config.json") continue;
      const from = path.join(payloadRoot, ent.name);
      const to = path.join(userDataDir(), ent.name);
      await rimraf(to);
      if (ent.isDirectory()) await copyDirFiltered(from, to, new Set());
      else await copyFileSafe(from, to);
    }

    const desktopOverlay = path.join(staging, "desktop-user-config.json");
    if (fs.existsSync(desktopOverlay)) {
      await copyFileSafe(desktopOverlay, getUserConfigPath());
    }

    let state = await loadState();
    const at = new Date().toISOString();
    state = {
      ...state,
      lastRestoreAt: at,
      lastRestoreSource: pending.sourceZip || null,
    };
    state = pushHistory(state, {
      at,
      kind: "restore",
      path: pending.sourceZip || null,
      note: "Restore applied after restart",
    });
    await saveState(state);
  } finally {
    try {
      await rimraf(staging);
    } catch {
    }
    try {
      await fs.promises.unlink(pendingPath());
    } catch {
    }
  }

  return { applied: true };
}

async function handleBackup(action, args, event) {
  const act = String(action || args?.action || "").trim().toLowerCase();
  if (act === "status") return status();
  if (act === "history" || act === "list") return history(args || {});
  if (act === "export") return exportBackup(event);
  if (act === "import" || act === "restore") {
    const res = await importBackup(event);
    if (res?.ok && res.relaunch) {
      setTimeout(() => {
        app.relaunch();
        app.exit(0);
      }, 400);
    }
    return res;
  }
  if (act === "path" || act === "folder" || act === "reveal-data") return openDataFolder();
  if (act === "reveal") return revealPath(args || {});
  return {
    ok: false,
    error:
      "Usage: backup(status) · backup(export) · backup(import) · backup(history) · backup(path)",
  };
}

module.exports = {
  handleBackup,
  applyPendingBackupRestore,
  userDataDir,
  getUserConfigPath,
  status,
  history,
};