const path = require("path");
const fs = require("fs");
const { app, shell } = require("electron");
const { scanStorage } = require("./storage-scan");
const {
  scanDiskLargeFiles,
  scanDiskTree,
  requestCancelDiskScan,
} = require("./disk-scan");
const { FILE_TO_APP, loadJsonFile, saveJsonFile } = require("./safe-json-store");
const { userDataDir } = require("./backup-ipc");
const { formatBytes } = require("./exec-utils");
const { APP_PROFILES } = require("./apps-info-profiles");

const STATE_FILE = "storage-state.json";
const STAGING_DIR = ".backup-restore-staging";

const FOLDER_TO_APP = {
  "world-maps": "world-maps",
  "geography-learn-cache": "geography",
};

const PLATFORM_FILES = new Set([
  "backup-state.json",
  "backup-restore-pending.json",
  "storage-state.json",
  "updates-state.json",
  "shell-engine.json",
  "app-settings.json",
  "notifications.json",
  "system-info-metrics.json",
]);

const PROTECTED_PATHS = new Set([
  STAGING_DIR,
  ".backup-export-tmp",
  "backup-restore-pending.json",
]);

function statePath() {
  return path.join(userDataDir(), STATE_FILE);
}

function loadState() {
  const loaded = loadJsonFile(statePath(), { fallback: { cleanupHistory: [] } });
  if (!loaded.ok || !loaded.data) return { cleanupHistory: [] };
  return {
    cleanupHistory: Array.isArray(loaded.data.cleanupHistory)
      ? loaded.data.cleanupHistory.slice(0, 50)
      : [],
  };
}

function saveState(data) {
  return saveJsonFile(statePath(), data, { allowEmpty: true });
}

function loadAppNames() {
  const map = { platform: "Platform", other: "Other" };
  try {
    const cfgPath = path.join(__dirname, "..", "..", "config", "apps.json");
    const raw = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    for (const a of raw.apps || []) {
      if (a.id) map[a.id] = a.name || a.id;
      if (a.module) map[a.module] = a.name || a.module;
    }
  } catch {
  }
  for (const [id, prof] of Object.entries(APP_PROFILES || {})) {
    if (!map[id] && prof?.tagline) map[id] = prof.tagline.split("—")[0].trim().slice(0, 40) || id;
  }
  return map;
}

async function dirSize(root, { skipNames = new Set() } = {}) {
  let total = 0;
  async function walk(dir) {
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (skipNames.has(ent.name)) continue;
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

function appIdForFile(name, isDir) {
  if (isDir && FOLDER_TO_APP[name]) return FOLDER_TO_APP[name];
  const base = path.basename(name);
  if (FILE_TO_APP[base]) return FILE_TO_APP[base];
  if (base.endsWith(".json.bak")) {
    const parent = base.replace(/\.bak$/i, "");
    if (FILE_TO_APP[parent]) return FILE_TO_APP[parent];
  }
  if (/^\.corrupt-/.test(base) || base.includes(".corrupt-")) {
    const m = base.match(/^(.+?)\.corrupt-/);
    if (m && FILE_TO_APP[m[1]]) return FILE_TO_APP[m[1]];
  }
  if (PLATFORM_FILES.has(base)) return "platform";
  return "other";
}

async function scanAppsBreakdown() {
  const root = userDataDir();
  const names = loadAppNames();
  const buckets = new Map();

  function add(appId, bytes, fileEntry) {
    if (!buckets.has(appId)) {
      buckets.set(appId, { appId, name: names[appId] || appId, bytes: 0, files: [] });
    }
    const b = buckets.get(appId);
    b.bytes += bytes;
    if (fileEntry && b.files.length < 12) b.files.push(fileEntry);
  }

  let entries;
  try {
    entries = await fs.promises.readdir(root, { withFileTypes: true });
  } catch (err) {
    return { ok: false, error: err?.message || "Could not read userData" };
  }

  for (const ent of entries) {
    const full = path.join(root, ent.name);
    if (PROTECTED_PATHS.has(ent.name)) continue;
    if (ent.isDirectory()) {
      if (ent.name === STAGING_DIR) continue;
      const bytes = await dirSize(full);
      const appId = appIdForFile(ent.name, true);
      add(appId, bytes, {
        name: ent.name + "/",
        path: full,
        bytes,
        sizeLabel: formatBytes(bytes),
        kind: "folder",
      });
      continue;
    }
    try {
      const st = await fs.promises.stat(full);
      const appId = appIdForFile(ent.name, false);
      add(appId, st.size || 0, {
        name: ent.name,
        path: full,
        bytes: st.size || 0,
        sizeLabel: formatBytes(st.size || 0),
        kind: "file",
        modifiedAt: st.mtime.toISOString(),
      });
    } catch {
    }
  }

  const apps = [...buckets.values()]
    .map((a) => ({
      ...a,
      sizeLabel: formatBytes(a.bytes),
      percent: 0,
    }))
    .sort((a, b) => b.bytes - a.bytes);

  const totalBytes = apps.reduce((s, a) => s + a.bytes, 0);
  for (const a of apps) {
    a.percent = totalBytes ? Math.round((a.bytes / totalBytes) * 1000) / 10 : 0;
  }

  return {
    ok: true,
    path: root,
    totalBytes,
    totalLabel: formatBytes(totalBytes),
    appCount: apps.length,
    apps,
    scannedAt: new Date().toISOString(),
  };
}

async function collectCleanupCandidates() {
  const root = userDataDir();
  const candidates = [];

  function push(row) {
    candidates.push({
      id: `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      ...row,
    });
  }

  let entries;
  try {
    entries = await fs.promises.readdir(root, { withFileTypes: true });
  } catch {
    return { ok: true, candidates: [], totalBytes: 0, totalLabel: "0 B" };
  }

  for (const ent of entries) {
    const full = path.join(root, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === ".backup-export-tmp") {
        const bytes = await dirSize(full);
        push({
          path: full,
          name: ent.name + "/",
          bytes,
          sizeLabel: formatBytes(bytes),
          kind: "folder",
          category: "temp",
          safe: true,
          description: "Leftover folder from an interrupted backup export",
        });
      }
      continue;
    }
    const lower = ent.name.toLowerCase();
    if (lower.endsWith(".tmp")) {
      try {
        const st = await fs.promises.stat(full);
        push({
          path: full,
          name: ent.name,
          bytes: st.size || 0,
          sizeLabel: formatBytes(st.size || 0),
          kind: "file",
          category: "temp",
          safe: true,
          description: "Temporary file in userData",
        });
      } catch {
      }
    } else if (/\.corrupt-.*\.bak$/i.test(ent.name) || /^\.corrupt-/i.test(ent.name)) {
      try {
        const st = await fs.promises.stat(full);
        push({
          path: full,
          name: ent.name,
          bytes: st.size || 0,
          sizeLabel: formatBytes(st.size || 0),
          kind: "file",
          category: "corrupt",
          safe: true,
          description: "Quarantined corrupt JSON backup: safe to remove after you verified data",
        });
      } catch {
      }
    } else if (/\.json\.bak$/i.test(ent.name) && !ent.name.includes(".corrupt-")) {
      try {
        const st = await fs.promises.stat(full);
        const live = ent.name.replace(/\.bak$/i, "");
        const livePath = path.join(root, live);
        if (fs.existsSync(livePath)) {
          push({
            path: full,
            name: ent.name,
            bytes: st.size || 0,
            sizeLabel: formatBytes(st.size || 0),
            kind: "file",
            category: "bak",
            safe: true,
            description: `Automatic backup copy: live file ${live} still exists`,
          });
        }
      } catch {
      }
    }
  }

  const metricsPath = path.join(root, "system-info-metrics.json");
  if (fs.existsSync(metricsPath)) {
    try {
      const st = await fs.promises.stat(metricsPath);
      push({
        path: metricsPath,
        name: "system-info-metrics.json",
        bytes: st.size || 0,
        sizeLabel: formatBytes(st.size || 0),
        kind: "file",
        category: "cache",
        safe: true,
        description: "System Info performance history: will rebuild on next sample",
      });
    } catch {
    }
  }

  const geoCache = path.join(root, "geography-learn-cache");
  if (fs.existsSync(geoCache)) {
    const bytes = await dirSize(geoCache);
    if (bytes > 0) {
      push({
        path: geoCache,
        name: "geography-learn-cache/",
        bytes,
        sizeLabel: formatBytes(bytes),
        kind: "folder",
        category: "cache",
        safe: true,
        description: "Geography learn-mode cache: app will refetch as needed",
      });
    }
  }

  const totalBytes = candidates.reduce((s, c) => s + (c.bytes || 0), 0);
  return {
    ok: true,
    candidates,
    totalBytes,
    totalLabel: formatBytes(totalBytes),
    scannedAt: new Date().toISOString(),
  };
}

async function deleteCandidate(targetPath) {
  const full = path.resolve(String(targetPath || ""));
  const root = path.resolve(userDataDir());
  if (!full.startsWith(root)) {
    return { ok: false, error: "Path must be inside My Space userData" };
  }
  const rel = path.relative(root, full);
  if (PROTECTED_PATHS.has(rel.split(path.sep)[0]) || rel.startsWith(STAGING_DIR)) {
    return { ok: false, error: "Protected path: cannot delete" };
  }

  const scan = await collectCleanupCandidates();
  const allowed = (scan.candidates || []).some((c) => path.resolve(c.path) === full);
  if (!allowed) {
    return { ok: false, error: "Not a listed safe cleanup item" };
  }

  let freedBytes = 0;
  try {
    const st = await fs.promises.stat(full);
    if (st.isDirectory()) {
      freedBytes = await dirSize(full);
      await fs.promises.rm(full, { recursive: true, force: true });
    } else {
      freedBytes = st.size || 0;
      await fs.promises.unlink(full);
    }
  } catch (err) {
    return { ok: false, error: err?.message || "Delete failed" };
  }

  const state = loadState();
  state.cleanupHistory.unshift({
    at: new Date().toISOString(),
    path: full,
    name: path.basename(full),
    freedLabel: formatBytes(freedBytes),
  });
  state.cleanupHistory = state.cleanupHistory.slice(0, 50);
  saveState(state);

  return { ok: true, deleted: full, freedLabel: formatBytes(freedBytes) };
}

async function buildStatus() {
  const [drives, apps, userSize] = await Promise.all([
    scanStorage(),
    scanAppsBreakdown(),
    dirSize(userDataDir(), { skipNames: new Set([STAGING_DIR]) }),
  ]);

  const primary =
    (drives.drives || []).find((d) => d.letter === "C") || (drives.drives || [])[0] || null;

  return {
    ok: true,
    scannedAt: new Date().toISOString(),
    hostname: require("os").hostname(),
    platform: process.platform,
    userData: {
      path: userDataDir(),
      bytes: userSize,
      sizeLabel: formatBytes(userSize),
      appCount: apps.appCount || 0,
    },
    drives: drives.drives || [],
    driveSummary: drives.summary || {},
    primaryDrive: primary,
    apps: apps.apps || [],
  };
}

async function openDataFolder() {
  const p = userDataDir();
  const err = await shell.openPath(p);
  return err ? { ok: false, error: err } : { ok: true, path: p };
}

async function revealPath(args) {
  const p = String(args?.path || args?.file || "").trim();
  if (!p) return { ok: false, error: "Path required" };
  shell.showItemInFolder(path.resolve(p));
  return { ok: true };
}

async function openWindowsStorageSettings() {
  if (process.platform !== "win32") {
    return { ok: false, error: "Windows Storage settings are only available on Windows" };
  }
  await shell.openExternal("ms-settings:storagesense");
  return { ok: true };
}

async function handleStorageInvoke(channel, args = {}) {
  const ch = String(channel || "").trim().toLowerCase();

  if (ch === "status") return buildStatus();
  if (ch === "drives") {
    const res = await scanStorage();
    return { ok: true, ...res };
  }
  if (ch === "apps") return scanAppsBreakdown();
  if (ch === "large-files" || ch === "large") {
    const drive = args?.path || args?.drive || "C:\\";
    cancelRequestedReset();
    const res = await scanDiskLargeFiles({ path: drive, maxDepth: args?.maxDepth || 4 });
    return res;
  }
  if (ch === "scan" || ch === "tree") {
    cancelRequestedReset();
    const res = await scanDiskTree({
      path: args?.path || args?.root || "C:\\",
      maxDepth: args?.maxDepth || 3,
      maxChildren: args?.maxChildren || 24,
    });
    return res;
  }
  if (ch === "cancel") {
    requestCancelDiskScan();
    return { ok: true };
  }
  if (ch === "cleanup" || ch === "cleanup.list") {
    const list = await collectCleanupCandidates();
    const state = loadState();
    return { ...list, history: state.cleanupHistory || [] };
  }
  if (ch === "cleanup.delete" || ch === "cleanup.remove") {
    return deleteCandidate(args?.path || args?.id);
  }
  if (ch === "path" || ch === "folder") return openDataFolder();
  if (ch === "reveal") return revealPath(args);
  if (ch === "open-settings" || ch === "settings" || ch === "windows") {
    return openWindowsStorageSettings();
  }
  if (ch === "meta") {
    return {
      ok: true,
      name: "Storage",
      version: "1.0.0",
      userDataPath: userDataDir(),
    };
  }

  return {
    ok: false,
    error: `Unknown storage channel: ${ch}`,
  };
}

function cancelRequestedReset() {
}

module.exports = {
  handleStorageInvoke,
  buildStatus,
  scanAppsBreakdown,
  collectCleanupCandidates,
};
