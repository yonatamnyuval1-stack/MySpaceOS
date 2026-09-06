const { BrowserWindow } = require("electron");

/** @type {Map<number, { caller: string, moduleId: string, topics: Set<string>, webContents: Electron.WebContents }>} */
const windows = new Map();

/** @type {Map<number, Set<string>>} */
const topicSubs = new Map();

function matchTopic(pattern, topic) {
  const p = String(pattern || "").trim();
  const t = String(topic || "").trim();
  if (!p || !t) return false;
  if (p === "*" || p === "#") return true;
  if (p.endsWith(".*")) return t.startsWith(p.slice(0, -1));
  if (p.endsWith("#")) return t.startsWith(p.slice(0, -1));
  return p === t;
}

function cleanupWebContents(wcId) {
  windows.delete(wcId);
  topicSubs.delete(wcId);
}

function registerWindow(webContents, caller, moduleId) {
  if (!webContents || webContents.isDestroyed?.()) {
    return { ok: false, error: "Invalid window" };
  }
  const id = webContents.id;
  const prev = windows.get(id);
  windows.set(id, {
    caller: String(caller || moduleId || "unknown"),
    moduleId: String(moduleId || caller || "unknown"),
    topics: prev?.topics || new Set(),
    webContents,
  });
  webContents.once("destroyed", () => cleanupWebContents(id));
  return { ok: true, moduleId: String(moduleId || caller) };
}

function subscribe(webContents, caller, topics = []) {
  if (!webContents || webContents.isDestroyed?.()) {
    return { ok: false, error: "Invalid window" };
  }
  const id = webContents.id;
  const normalized = [...new Set((topics || []).map((t) => String(t || "").trim()).filter(Boolean))];
  if (!normalized.length) return { ok: false, error: "At least one topic required" };

  const row = windows.get(id) || {
    caller: String(caller || "unknown"),
    moduleId: String(caller || "unknown"),
    topics: new Set(),
    webContents,
  };
  for (const t of normalized) row.topics.add(t);
  windows.set(id, row);
  topicSubs.set(id, row.topics);
  webContents.once("destroyed", () => cleanupWebContents(id));

  return { ok: true, topics: [...row.topics] };
}

function unsubscribe(webContents, topics = []) {
  if (!webContents) return { ok: false, error: "Invalid window" };
  const row = windows.get(webContents.id);
  if (!row) return { ok: true, topics: [] };
  const normalized = (topics || []).map((t) => String(t || "").trim()).filter(Boolean);
  if (!normalized.length) {
    row.topics.clear();
  } else {
    for (const t of normalized) row.topics.delete(t);
  }
  return { ok: true, topics: [...row.topics] };
}

function listSubscriptions() {
  const rows = [];
  for (const [wcId, row] of windows.entries()) {
    if (!row.topics.size) continue;
    rows.push({
      webContentsId: wcId,
      caller: row.caller,
      moduleId: row.moduleId,
      topics: [...row.topics],
    });
  }
  return { ok: true, subscriptions: rows };
}

function getTargetsForTopic(topic) {
  const hits = [];
  for (const [, row] of windows.entries()) {
    if (!row.webContents || row.webContents.isDestroyed()) continue;
    for (const pattern of row.topics) {
      if (matchTopic(pattern, topic)) {
        hits.push(row);
        break;
      }
    }
  }
  return hits;
}

function getWindowsForModule(moduleId) {
  const key = String(moduleId || "").trim();
  const hits = [];
  for (const [, row] of windows.entries()) {
    if (!row.webContents || row.webContents.isDestroyed()) continue;
    if (row.moduleId === key) hits.push(row);
  }
  return hits;
}

function listRegistered() {
  const rows = [];
  for (const [wcId, row] of windows.entries()) {
    if (!row.webContents || row.webContents.isDestroyed()) continue;
    rows.push({
      webContentsId: wcId,
      caller: row.caller,
      moduleId: row.moduleId,
      topics: [...row.topics],
    });
  }
  return { ok: true, windows: rows };
}

module.exports = {
  registerWindow,
  subscribe,
  unsubscribe,
  listSubscriptions,
  listRegistered,
  getTargetsForTopic,
  getWindowsForModule,
  matchTopic,
};