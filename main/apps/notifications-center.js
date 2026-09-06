const fs = require("fs");
const path = require("path");
const { app, BrowserWindow, Notification } = require("electron");

const MAX_ITEMS = 80;

const profile = require("../myspace-profile");

function dataPath() {
  return profile.profileScopedPath("notifications.json");
}

function uid() {
  return `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function defaultState() {
  return { items: [], updatedAt: null };
}

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(dataPath(), "utf8"));
    const items = Array.isArray(raw?.items) ? raw.items : [];
    const cleaned = items
      .filter((n) => n && n.id && n.title)
      .filter((n) => n.appId !== "drift" && n.appId !== "study-deck")
      .slice(0, MAX_ITEMS)
      .map((n) => ({
        id: String(n.id),
        appId: String(n.appId || "system"),
        type: String(n.type || "info"),
        title: String(n.title || "").slice(0, 120),
        body: String(n.body || "").slice(0, 400),
        createdAt: n.createdAt || new Date().toISOString(),
        read: n.read === true,
        dedupeKey: n.dedupeKey || null,
        route: n.route && typeof n.route === "object" ? n.route : null,
        priority: n.priority === "high" ? "high" : "normal",
      }));
    if (cleaned.length !== items.length) {
      save({ items: cleaned, updatedAt: raw?.updatedAt || null });
    }
    return {
      items: cleaned,
      updatedAt: raw?.updatedAt || null,
    };
  } catch (err) {
    if (err && err.code === "ENOENT") return defaultState();
    return defaultState();
  }
}

function save(state) {
  const next = {
    items: (state.items || []).slice(0, MAX_ITEMS),
    updatedAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(dataPath()), { recursive: true });
  fs.writeFileSync(dataPath(), JSON.stringify(next, null, 2), "utf8");
  return next;
}

function snapshot(state) {
  const items = state?.items || [];
  const unread = items.filter((n) => !n.read).length;
  return { ok: true, items, unread, updatedAt: state?.updatedAt || null };
}

function broadcast(state) {
  const snap = snapshot(state);
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    try {
      win.webContents.send("notifications-updated", snap);
    } catch {
    }
  }
  return snap;
}

function push(args = {}, opts = {}) {
  const title = String(args.title || "").trim();
  if (!title) return { ok: false, error: "Missing title" };

  const state = load();
  const dedupeKey = args.dedupeKey ? String(args.dedupeKey) : null;
  if (dedupeKey) {
    const existing = state.items.find((n) => n.dedupeKey === dedupeKey);
    if (existing) {
      return { ok: true, item: existing, duplicate: true, ...snapshot(state) };
    }
  }

  const item = {
    id: uid(),
    appId: String(args.appId || "system"),
    type: String(args.type || "info"),
    title: title.slice(0, 120),
    body: String(args.body || "").slice(0, 400),
    createdAt: new Date().toISOString(),
    read: false,
    dedupeKey,
    route: args.route && typeof args.route === "object" ? args.route : null,
    priority: args.priority === "high" ? "high" : "normal",
  };

  state.items.unshift(item);
  const saved = save(state);
  const snap = broadcast(saved);

  const showOs = opts.showOs !== false;
  if (showOs) {
    try {
      const { allowNotify } = require("./focus-gate");
      if (allowNotify({ bypassFocus: opts.bypassFocus === true }) && Notification.isSupported()) {
        new Notification({
          title: item.title,
          body: item.body || undefined,
          silent: false,
        }).show();
      }
    } catch {
    }
  }

  return { ok: true, item, ...snap };
}

function list() {
  return snapshot(load());
}

function markRead(args = {}) {
  const id = String(args.id || "").trim();
  if (!id) return { ok: false, error: "Missing id" };
  const state = load();
  const item = state.items.find((n) => n.id === id);
  if (!item) return { ok: false, error: "Not found" };
  item.read = true;
  return broadcast(save(state));
}

function markAllRead() {
  const state = load();
  for (const n of state.items) n.read = true;
  return broadcast(save(state));
}

function clear(args = {}) {
  const state = load();
  if (args?.readOnly) {
    state.items = state.items.filter((n) => !n.read);
  } else {
    state.items = [];
  }
  return broadcast(save(state));
}

function remove(args = {}) {
  const id = String(args.id || "").trim();
  if (!id) return { ok: false, error: "Missing id" };
  const state = load();
  state.items = state.items.filter((n) => n.id !== id);
  return broadcast(save(state));
}

async function handleNotificationsInvoke(channel, args = {}) {
  switch (channel) {
    case "list":
      return list();
    case "push":
      return push(args, { showOs: args.showOs !== false });
    case "markRead":
      return markRead(args);
    case "markAllRead":
      return markAllRead();
    case "clear":
      return clear(args);
    case "remove":
      return remove(args);
    case "prefs.get": {
      const { getPrefs } = require("./notifications-prefs");
      return getPrefs();
    }
    case "prefs.set": {
      const { setPrefs } = require("./notifications-prefs");
      return setPrefs(args);
    }
    case "blocklist.add": {
      const { addBlockedSender } = require("./notifications-prefs");
      return addBlockedSender(args);
    }
    case "blocklist.remove": {
      const { removeBlockedSender } = require("./notifications-prefs");
      return removeBlockedSender(args);
    }
    default:
      return { ok: false, error: `Unknown notifications channel: ${channel}` };
  }
}

module.exports = {
  push,
  list,
  markRead,
  markAllRead,
  clear,
  remove,
  handleNotificationsInvoke,
  broadcast,
};