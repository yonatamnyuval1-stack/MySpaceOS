const path = require("path");
const fs = require("fs");
const { app, shell, clipboard, dialog, BrowserWindow } = require("electron");
const { exec } = require("child_process");
const { promisify } = require("util");
const { formatBytes } = require("./exec-utils");
const {
  setupLocalAuthApp,
  requireSignedIn,
  registerSingleFileMigrator,
} = require("./local-auth-app-helper");

const APP_ID = "drift";
const auth = setupLocalAuthApp(APP_ID);
registerSingleFileMigrator(APP_ID, "drift.json");

const DATA_FILE = () => auth.userDataPath("data.json");

function signedInGuard() {
  return requireSignedIn(auth);
}

const MYSPACE_ROOT = () => path.join(__dirname, "..", "..");

const execAsync = promisify(exec);

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  "__pycache__",
  ".venv",
  "venv",
  ".cache",
  ".turbo",
  "out",
  "target",
  "vendor",
  ".pnpm-store",
  "win-unpacked",
  ".electron",
  "agent-tools",
  ".cursor",
]);

const SKIP_FILES = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);
const MAX_EVENTS = 2500;
const MAX_SCAN_EVENTS = 180;

const EVENT_TYPES = {
  baseline: { icon: "📸", label: "Baseline" },
  new_folder: { icon: "📁", label: "New folder" },
  new_file: { icon: "📄", label: "New file" },
  modified_file: { icon: "✏️", label: "Modified" },
  deleted_file: { icon: "🗑", label: "Deleted file" },
  deleted_folder: { icon: "🗑", label: "Deleted folder" },
  new_project: { icon: "🆕", label: "New project" },
  myspace_app: { icon: "🏠", label: "My Space app" },
  myspace_config: { icon: "⚙️", label: "My Space config" },
  git_commit: { icon: "⎇", label: "Git commit" },
  scan_complete: { icon: "↻", label: "Scan" },
};

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeWinPath(p) {
  if (!p) return "";
  let s = String(p).trim().replace(/\//g, "\\");
  if (/^[a-zA-Z]$/.test(s)) s = `${s.toUpperCase()}:\\`;
  if (/^[a-zA-Z]:$/.test(s)) s = `${s.toUpperCase()}:\\`;
  return s;
}

async function statSafe(fullPath) {
  try {
    return await fs.promises.stat(fullPath);
  } catch {
    return null;
  }
}

function readJson(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
  }
  return fallback;
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function defaultStorage() {
  const root = MYSPACE_ROOT();
  const userData = app.getPath("userData");
  const zones = [];
  if (fs.existsSync(root)) {
    zones.push({
      id: "zone_myspace",
      label: "My Space project",
      path: root,
      enabled: true,
      createdAt: new Date().toISOString(),
    });
  }
  if (fs.existsSync(userData)) {
    zones.push({
      id: "zone_userdata",
      label: "My Space data",
      path: userData,
      enabled: true,
      createdAt: new Date().toISOString(),
    });
  }
  return {
    zones,
    snapshots: {},
    events: [],
    settings: {
      paused: false,
      maxDepth: 8,
      maxFiles: 12000,
      trackGit: true,
      autoScanOnOpen: true,
      autoScanMinutes: 60,
      lastScanAt: null,
    },
  };
}

function mergeDefaultZones(zones, removedPaths) {
  const list = [...zones];
  const removed = new Set((removedPaths || []).map((p) => normalizeWinPath(p).toLowerCase()).filter(Boolean));
  const defaults = defaultStorage().zones;
  for (const d of defaults) {
    const key = d.path.toLowerCase();
    if (removed.has(key)) continue;
    if (!list.some((z) => z.path.toLowerCase() === key)) {
      list.push({ ...d });
    }
  }
  return list;
}

function normalizeStorage(raw) {
  const base = defaultStorage();
  const removedZonePaths = Array.isArray(raw?.removedZonePaths) ? raw.removedZonePaths : [];
  const zones = mergeDefaultZones(Array.isArray(raw?.zones) ? raw.zones : base.zones, removedZonePaths)
    .map((z) => ({
      id: String(z.id || uid("zone")),
      label: String(z.label || path.basename(z.path) || "Watch zone").trim(),
      path: normalizeWinPath(z.path),
      enabled: z.enabled !== false,
      createdAt: z.createdAt || new Date().toISOString(),
      lastScannedAt: z.lastScannedAt || null,
      lastGitHashes: Array.isArray(z.lastGitHashes) ? z.lastGitHashes.slice(0, 100) : [],
    }))
    .filter((z) => z.path);

  return {
    zones,
    snapshots: raw?.snapshots && typeof raw.snapshots === "object" ? raw.snapshots : {},
    events: Array.isArray(raw?.events) ? raw.events.slice(0, MAX_EVENTS) : [],
    removedZonePaths,
    settings: {
      paused: Boolean(raw?.settings?.paused),
      maxDepth: Math.min(12, Math.max(3, parseInt(raw?.settings?.maxDepth, 10) || 8)),
      maxFiles: Math.min(25000, Math.max(1000, parseInt(raw?.settings?.maxFiles, 10) || 12000)),
      trackGit: raw?.settings?.trackGit !== false,
      autoScanOnOpen: raw?.settings?.autoScanOnOpen !== false,
      autoScanMinutes: Math.min(720, Math.max(0, parseInt(raw?.settings?.autoScanMinutes, 10) || 60)),
      lastScanAt: raw?.settings?.lastScanAt || null,
    },
  };
}

async function loadStorage() {
  const data = normalizeStorage(readJson(DATA_FILE(), null));
  return { ok: true, data };
}

async function saveStorage(args) {
  const data = normalizeStorage(args?.data ?? args);
  data.events = (data.events || []).slice(0, MAX_EVENTS);
  writeJson(DATA_FILE(), data);
  return { ok: true, data };
}

function relPath(root, full) {
  return path.relative(root, full).replace(/\\/g, "/");
}

async function walkZone(rootPath, maxDepth, maxFiles) {
  const entries = new Map();
  const budget = { count: 0 };

  async function walk(dirPath, depth) {
    if (budget.count >= maxFiles) return;

    let list;
    try {
      list = await fs.promises.readdir(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const ent of list) {
      if (budget.count >= maxFiles) break;
      const name = ent.name;
      if (name === "." || name === "..") continue;

      const full = path.join(dirPath, name);
      const rel = relPath(rootPath, full);

      if (ent.isDirectory()) {
        if (SKIP_DIRS.has(name.toLowerCase())) continue;
        budget.count += 1;
        const st = await statSafe(full);
        entries.set(rel, {
          rel,
          isDir: true,
          size: 0,
          mtimeMs: st?.mtimeMs || 0,
        });
        if (depth < maxDepth) await walk(full, depth + 1);
      } else if (ent.isFile()) {
        if (SKIP_FILES.has(name)) continue;
        const st = await statSafe(full);
        if (!st?.isFile()) continue;
        budget.count += 1;
        entries.set(rel, {
          rel,
          isDir: false,
          size: st.size,
          mtimeMs: st.mtimeMs,
        });
      }
    }
  }

  await walk(rootPath, 0);
  return { entries, truncated: budget.count >= maxFiles };
}

function classifyFileEvent(rel, isNew) {
  const lower = rel.toLowerCase();
  const base = path.basename(rel);

  if (lower.includes("apps/") && base === "manifest.json" && isNew) {
    return "myspace_app";
  }
  if (lower.endsWith("config/apps.json") || lower.endsWith("config\\apps.json")) {
    return "myspace_config";
  }
  if (isNew && (base === "package.json" || base === "manifest.json" || base === "Cargo.toml")) {
    return "new_project";
  }
  if (isNew && (lower.endsWith(".json") && lower.includes("config"))) {
    return "modified_file";
  }
  return isNew ? "new_file" : "modified_file";
}

function eventTitle(type, rel, zoneLabel) {
  const name = path.basename(rel) || rel;
  switch (type) {
    case "baseline":
      return `Baseline snapshot — ${zoneLabel}`;
    case "new_folder":
      return `New folder: ${rel}`;
    case "new_project":
      return `New project marker: ${rel}`;
    case "myspace_app":
      return `My Space app detected: ${path.dirname(rel)}`;
    case "myspace_config":
      return "My Space apps registry changed";
    case "git_commit":
      return rel;
    case "deleted_file":
      return `Deleted: ${name}`;
    case "deleted_folder":
      return `Removed folder: ${rel}`;
    case "scan_complete":
      return `Scan complete — ${zoneLabel}`;
    default:
      if (type === "new_file") return `New file: ${name}`;
      if (type === "modified_file") return `Updated: ${name}`;
      return name || zoneLabel;
  }
}

function fullPathForRel(zonePath, rel) {
  if (!zonePath || !rel) return "";
  return path.join(zonePath, ...rel.split("/"));
}

function makeEvent({ type, zoneId, zoneLabel, rel, summary, meta, zonePath }) {
  const info = EVENT_TYPES[type] || { icon: "•", label: type };
  const fullPath = fullPathForRel(zonePath, rel);
  return {
    id: uid("evt"),
    type,
    icon: info.icon,
    typeLabel: info.label,
    title: eventTitle(type, rel || summary || "", zoneLabel),
    summary: summary || "",
    zoneId,
    zoneLabel,
    path: rel || "",
    at: new Date().toISOString(),
    meta: { ...(meta || {}), fullPath },
  };
}

function diffSnapshots(oldSnap, newEntries, zone, truncated) {
  const events = [];
  const oldMap = new Map();
  if (oldSnap?.entries) {
    for (const e of oldSnap.entries) oldMap.set(e.rel, e);
  }

  if (!oldSnap) {
    events.push(
      makeEvent({
        type: "baseline",
        zoneId: zone.id,
        zoneLabel: zone.label,
        zonePath: zone.path,
        summary: `${newEntries.size.toLocaleString()} paths indexed${truncated ? " (partial scan)" : ""}.`,
      })
    );
    return events;
  }

  const added = [];
  const modified = [];

  for (const [rel, entry] of newEntries) {
    const prev = oldMap.get(rel);
    if (!prev) {
      added.push(entry);
    } else if (!entry.isDir && !prev.isDir && entry.mtimeMs > prev.mtimeMs + 500) {
      if (entry.size !== prev.size || entry.mtimeMs !== prev.mtimeMs) modified.push(entry);
    } else if (entry.isDir && !prev.isDir) {
      added.push(entry);
    }
  }

  added.sort((a, b) => a.rel.localeCompare(b.rel));
  modified.sort((a, b) => b.mtimeMs - a.mtimeMs);

  for (const entry of added) {
    if (events.length >= MAX_SCAN_EVENTS) break;
    const type = entry.isDir ? "new_folder" : classifyFileEvent(entry.rel, true);
    events.push(
      makeEvent({
        type,
        zoneId: zone.id,
        zoneLabel: zone.label,
        zonePath: zone.path,
        rel: entry.rel,
        summary: entry.isDir ? "New directory" : formatBytes(entry.size),
        meta: { size: entry.size, isDir: entry.isDir },
      })
    );
  }

  for (const entry of modified) {
    if (events.length >= MAX_SCAN_EVENTS) break;
    const type = classifyFileEvent(entry.rel, false);
    events.push(
      makeEvent({
        type,
        zoneId: zone.id,
        zoneLabel: zone.label,
        zonePath: zone.path,
        rel: entry.rel,
        summary: `Updated · ${formatBytes(entry.size)}`,
        meta: { size: entry.size },
      })
    );
  }

  const deleted = [];
  for (const [rel, prev] of oldMap) {
    if (!newEntries.has(rel)) deleted.push(prev);
  }
  deleted.sort((a, b) => a.rel.localeCompare(b.rel));

  for (const entry of deleted) {
    if (events.length >= MAX_SCAN_EVENTS) break;
    const type = entry.isDir ? "deleted_folder" : "deleted_file";
    events.push(
      makeEvent({
        type,
        zoneId: zone.id,
        zoneLabel: zone.label,
        zonePath: zone.path,
        rel: entry.rel,
        summary: entry.isDir ? "Folder removed" : "File removed",
        meta: { isDir: entry.isDir },
      })
    );
  }

  if (truncated) {
    events.push(
      makeEvent({
        type: "scan_complete",
        zoneId: zone.id,
        zoneLabel: zone.label,
        zonePath: zone.path,
        summary: "Scan hit file limit: some changes may be missing.",
        meta: { truncated: true },
      })
    );
  }

  return events;
}

async function collectGitEvents(zone, data) {
  if (!data.settings.trackGit) return [];
  const gitDir = path.join(zone.path, ".git");
  if (!fs.existsSync(gitDir)) return [];

  try {
    const { stdout } = await execAsync('git log -20 --pretty=format:"%H|%s|%ai"', {
      cwd: zone.path,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    const lines = (stdout || "").trim().split("\n").filter(Boolean);
    const known = new Set(zone.lastGitHashes || []);
    const events = [];
    const newHashes = [];

    for (const line of lines) {
      const [hash, subject, date] = line.split("|");
      if (!hash) continue;
      newHashes.push(hash);
      if (known.has(hash)) continue;
      events.push(
        makeEvent({
          type: "git_commit",
          zoneId: zone.id,
          zoneLabel: zone.label,
          zonePath: zone.path,
          rel: subject || hash.slice(0, 7),
          summary: date ? new Date(date).toLocaleString() : "",
          meta: { hash, subject, date },
        })
      );
    }

    zone.lastGitHashes = newHashes.slice(0, 50);
    return events.slice(0, 15);
  } catch {
    return [];
  }
}

async function scanZone(zone, data) {
  const st = await statSafe(zone.path);
  if (!st?.isDirectory()) {
    return { ok: false, error: `Folder not found: ${zone.path}` };
  }

  const { entries, truncated } = await walkZone(zone.path, data.settings.maxDepth, data.settings.maxFiles);
  const oldSnap = data.snapshots[zone.id] || null;
  const fileEvents = diffSnapshots(oldSnap, entries, zone, truncated);
  const gitEvents = oldSnap ? await collectGitEvents(zone, data) : [];

  data.snapshots[zone.id] = {
    scannedAt: new Date().toISOString(),
    entryCount: entries.size,
    truncated,
    entries: [...entries.values()],
  };

  zone.lastScannedAt = new Date().toISOString();

  const allEvents = [...fileEvents, ...gitEvents];
  if (oldSnap && allEvents.length === 0) {
    allEvents.push(
      makeEvent({
        type: "scan_complete",
        zoneId: zone.id,
        zoneLabel: zone.label,
        zonePath: zone.path,
        summary: "No changes detected since last scan.",
      })
    );
  } else if (oldSnap && fileEvents.length > 0) {
    allEvents.unshift(
      makeEvent({
        type: "scan_complete",
        zoneId: zone.id,
        zoneLabel: zone.label,
        zonePath: zone.path,
        summary: `${fileEvents.length} change(s) detected.`,
        meta: { changeCount: fileEvents.length },
      })
    );
  }

  return { ok: true, events: allEvents, entryCount: entries.size, truncated };
}

const MIN_SCAN_GAP_MS = 5 * 60 * 1000;

async function runScan(args) {
  const loaded = await loadStorage();
  const data = loaded.data;
  if (data.settings.paused) {
    return { ok: false, error: "Drift is paused: resume tracking in Settings." };
  }

  const force = Boolean(args?.force);
  const isAuto = Boolean(args?.auto);
  if (!force && isAuto && data.settings.lastScanAt) {
    const elapsed = Date.now() - new Date(data.settings.lastScanAt).getTime();
    if (elapsed >= 0 && elapsed < MIN_SCAN_GAP_MS) {
      return {
        ok: true,
        skipped: true,
        reason: "recent_scan",
        newEvents: 0,
        lastScanAt: data.settings.lastScanAt,
      };
    }
  }

  const zoneId = String(args?.zoneId || "").trim();
  const targets = zoneId
    ? data.zones.filter((z) => z.id === zoneId && z.enabled)
    : data.zones.filter((z) => z.enabled);

  if (!targets.length) {
    return { ok: false, error: "No watch zones enabled. Add a folder in Zones." };
  }

  const newEvents = [];
  for (const zone of targets) {
    const result = await scanZone(zone, data);
    if (result.ok) newEvents.push(...result.events);
  }

  data.events = [...newEvents, ...data.events].slice(0, MAX_EVENTS);
  data.settings.lastScanAt = new Date().toISOString();
  await saveStorage({ data });

  return {
    ok: true,
    scanned: targets.length,
    newEvents: newEvents.length,
    totalEvents: data.events.length,
    lastScanAt: data.settings.lastScanAt,
  };
}

async function listEvents(args) {
  const { data } = await loadStorage();
  let list = [...data.events];

  const type = String(args?.type || "all");
  const zoneId = String(args?.zoneId || "all");
  const q = String(args?.q || "").trim().toLowerCase();
  const sinceDays = parseInt(args?.sinceDays, 10);

  if (type !== "all") list = list.filter((e) => e.type === type);
  if (zoneId !== "all") list = list.filter((e) => e.zoneId === zoneId);

  if (Number.isFinite(sinceDays) && sinceDays > 0) {
    const cutoff = Date.now() - sinceDays * 86400000;
    list = list.filter((e) => new Date(e.at).getTime() >= cutoff);
  }

  if (q) {
    list = list.filter((e) => {
      const hay = [e.title, e.summary, e.path, e.typeLabel, e.zoneLabel, ...(e.meta ? Object.values(e.meta) : [])]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  const total = list.length;
  const offset = Math.max(0, parseInt(args?.offset, 10) || 0);
  const limit = Math.min(100, Math.max(1, parseInt(args?.limit, 10) || 50));
  const events = list.slice(offset, offset + limit);

  return { ok: true, events, total, offset, limit, eventTypes: EVENT_TYPES };
}

async function getInsights(args) {
  const { data } = await loadStorage();
  const days = Math.min(90, Math.max(7, parseInt(args?.days, 10) || 7));
  const now = Date.now();
  const periodStart = now - days * 86400000;
  const prevStart = periodStart - days * 86400000;
  const dayAgo = now - 86400000;

  const periodEvents = data.events.filter((e) => new Date(e.at).getTime() >= periodStart);
  const prevPeriodEvents = data.events.filter((e) => {
    const t = new Date(e.at).getTime();
    return t >= prevStart && t < periodStart;
  });
  const todayEvents = data.events.filter((e) => new Date(e.at).getTime() >= dayAgo);

  const byType = {};
  const byZone = {};
  const byDay = {};

  for (const e of periodEvents) {
    byType[e.type] = (byType[e.type] || 0) + 1;
    byZone[e.zoneLabel || "Unknown"] = (byZone[e.zoneLabel || "Unknown"] || 0) + 1;
    const day = e.at.slice(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;
  }

  const changePercent =
    prevPeriodEvents.length > 0
      ? Math.round(((periodEvents.length - prevPeriodEvents.length) / prevPeriodEvents.length) * 100)
      : null;

  const zones = data.zones.map((z) => ({
    id: z.id,
    label: z.label,
    path: z.path,
    enabled: z.enabled,
    lastScannedAt: z.lastScannedAt,
    entryCount: data.snapshots[z.id]?.entryCount || 0,
  }));

  return {
    ok: true,
    stats: {
      totalEvents: data.events.length,
      periodDays: days,
      periodEvents: periodEvents.length,
      prevPeriodEvents: prevPeriodEvents.length,
      changePercent,
      weekEvents: periodEvents.length,
      todayEvents: todayEvents.length,
      zones: data.zones.length,
      enabledZones: data.zones.filter((z) => z.enabled).length,
      paused: data.settings.paused,
    },
    byType: Object.entries(byType)
      .map(([type, count]) => ({ type, count, ...EVENT_TYPES[type] }))
      .sort((a, b) => b.count - a.count),
    byZone: Object.entries(byZone)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
    byDay: Object.entries(byDay)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    zones,
  };
}

async function addZone(args) {
  const folder = normalizeWinPath(args?.path || "");
  if (!folder) return { ok: false, error: "Path required" };

  const st = await statSafe(folder);
  if (!st?.isDirectory()) return { ok: false, error: "Not a folder" };

  const { data } = await loadStorage();
  if (data.zones.some((z) => z.path.toLowerCase() === folder.toLowerCase())) {
    return { ok: false, error: "This folder is already watched." };
  }

  const zone = {
    id: uid("zone"),
    label: String(args?.label || path.basename(folder) || "Watch zone").trim(),
    path: folder,
    enabled: true,
    createdAt: new Date().toISOString(),
    lastGitHashes: [],
  };
  data.zones.unshift(zone);
  if (data.removedZonePaths) {
    data.removedZonePaths = data.removedZonePaths.filter(
      (p) => normalizeWinPath(p).toLowerCase() !== folder.toLowerCase()
    );
  }
  await saveStorage({ data });
  return { ok: true, zone };
}

async function removeZone(args) {
  const id = String(args?.id || "").trim();
  const { data } = await loadStorage();
  const zone = data.zones.find((z) => z.id === id);
  if (!zone) return { ok: false, error: "Zone not found" };
  if (!data.removedZonePaths) data.removedZonePaths = [];
  const key = zone.path.toLowerCase();
  if (!data.removedZonePaths.some((p) => normalizeWinPath(p).toLowerCase() === key)) {
    data.removedZonePaths.push(zone.path);
  }
  data.zones = data.zones.filter((z) => z.id !== id);
  delete data.snapshots[id];
  data.events = data.events.filter((e) => e.zoneId !== id);
  await saveStorage({ data });
  return { ok: true };
}

async function toggleZone(args) {
  const id = String(args?.id || "").trim();
  const { data } = await loadStorage();
  const zone = data.zones.find((z) => z.id === id);
  if (!zone) return { ok: false, error: "Zone not found" };
  zone.enabled = args?.enabled !== undefined ? Boolean(args.enabled) : !zone.enabled;
  await saveStorage({ data });
  return { ok: true, zone };
}

async function updateSettings(args) {
  const { data } = await loadStorage();
  if (args?.paused !== undefined) data.settings.paused = Boolean(args.paused);
  if (args?.trackGit !== undefined) data.settings.trackGit = Boolean(args.trackGit);
  if (args?.autoScanOnOpen !== undefined) data.settings.autoScanOnOpen = Boolean(args.autoScanOnOpen);
  if (args?.autoScanMinutes !== undefined) {
    data.settings.autoScanMinutes = Math.min(720, Math.max(0, parseInt(args.autoScanMinutes, 10) || 0));
  }
  await saveStorage({ data });
  return { ok: true, settings: data.settings };
}

async function clearEvents(args) {
  const { data } = await loadStorage();
  if (args?.all) {
    data.events = [];
  } else {
    const days = Math.max(1, parseInt(args?.olderThanDays, 10) || 30);
    const cutoff = Date.now() - days * 86400000;
    data.events = data.events.filter((e) => new Date(e.at).getTime() >= cutoff);
  }
  await saveStorage({ data });
  return { ok: true, remaining: data.events.length };
}

async function pickFolder(args, event) {
  const defaultPath = normalizeWinPath(args?.defaultPath || "");
  const opts = {
    properties: ["openDirectory"],
    title: String(args?.title || "Select folder to watch"),
  };
  if (defaultPath) {
    const st = await statSafe(defaultPath);
    if (st?.isDirectory()) opts.defaultPath = defaultPath;
  }

  const win = event?.sender ? BrowserWindow.fromWebContents(event.sender) : null;
  const parent = win && !win.isDestroyed() ? win : BrowserWindow.getFocusedWindow();
  const result = parent
    ? await dialog.showOpenDialog(parent, opts)
    : await dialog.showOpenDialog(opts);

  if (result.canceled || !result.filePaths?.length) return { ok: true, path: null };
  return { ok: true, path: normalizeWinPath(result.filePaths[0]) };
}

async function revealItem(args) {
  const target = normalizeWinPath(args?.path || "");
  if (!target) return { ok: false, error: "Path required" };
  if (!fs.existsSync(target)) return { ok: false, error: "Path not found" };
  const st = await statSafe(target);
  if (st?.isDirectory()) {
    const err = await shell.openPath(target);
    return err ? { ok: false, error: err } : { ok: true };
  }
  shell.showItemInFolder(target);
  return { ok: true };
}

async function openFolder(args) {
  const folder = normalizeWinPath(args?.path || "");
  if (!folder) return { ok: false, error: "Path required" };
  const err = await shell.openPath(folder);
  if (err) return { ok: false, error: err };
  return { ok: true };
}

async function copyText(args) {
  clipboard.writeText(String(args?.text ?? ""));
  return { ok: true };
}

async function exportData() {
  const { data } = await loadStorage();
  return { ok: true, json: JSON.stringify(data, null, 2) };
}

async function importData(args) {
  let parsed;
  try {
    parsed = typeof args?.json === "string" ? JSON.parse(args.json) : args?.data;
  } catch {
    return { ok: false, error: "Invalid JSON" };
  }
  return saveStorage({ data: parsed });
}

const CHANNELS = {
  "storage.load": () => loadStorage(),
  "storage.save": (args) => saveStorage(args),
  "zones.list": async () => {
    const { data } = await loadStorage();
    return {
      ok: true,
      zones: data.zones.map((z) => ({
        ...z,
        entryCount: data.snapshots[z.id]?.entryCount || 0,
        snapshotAt: data.snapshots[z.id]?.scannedAt || null,
      })),
      settings: data.settings,
    };
  },
  "zones.add": (args) => addZone(args),
  "zones.remove": (args) => removeZone(args),
  "zones.toggle": (args) => toggleZone(args),
  "scan.run": (args) => runScan(args),
  "events.list": (args) => listEvents(args),
  "events.clear": (args) => clearEvents(args),
  "insights.get": (args) => getInsights(args),
  "settings.update": (args) => updateSettings(args),
  "folder.pick": (args) => pickFolder(args),
  "folder.open": (args) => openFolder(args),
  "folder.reveal": (args) => revealItem(args),
  "clipboard.copy": (args) => copyText(args),
  "data.export": () => exportData(),
  "data.import": (args) => importData(args),
};

async function handleDriftInvoke(channel, args, event) {
  const authErr = signedInGuard();
  if (authErr) return authErr;
  const handler = CHANNELS[channel];
  if (!handler) return { ok: false, error: `Unknown channel: ${channel}` };
  try {
    if (channel === "folder.pick") return await handler(args, event);
    return await handler(args);
  } catch (err) {
    return { ok: false, error: err.message || "Request failed" };
  }
}

module.exports = { handleDriftInvoke, runScan, loadStorage };