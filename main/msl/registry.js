const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const MslKey = require("../../apps/shared/msl-key");

function dataPath() {
  return path.join(app.getPath("userData"), "msl-protocol.json");
}

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function defaultState() {
  return { keys: [], injections: {}, updatedAt: null };
}

function normalizeEntry(raw) {
  if (!raw) return null;
  const uri = String(raw.uri || "").trim();
  const parsed = MslKey.parse(uri);
  if (!parsed.ok) return null;
  return {
    id: String(raw.id || uid("key")),
    uri: parsed.uri,
    label: String(raw.label || MslKey.previewLabel(parsed)).trim(),
    capability: parsed.capability,
    input: parsed.input,
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

function normalizeState(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const keys = (Array.isArray(raw.keys) ? raw.keys : []).map(normalizeEntry).filter(Boolean);
  const injections = {};
  const inj = raw.injections && typeof raw.injections === "object" ? raw.injections : {};
  for (const [appId, list] of Object.entries(inj)) {
    const id = String(appId || "").trim();
    if (!id) continue;
    injections[id] = (Array.isArray(list) ? list : [])
      .map((item) => {
        const e = normalizeEntry(item);
        if (!e) return null;
        return { ...e, injectedAt: item.injectedAt || e.createdAt };
      })
      .filter(Boolean)
      .slice(0, 100);
  }
  return { keys: keys.slice(0, 300), injections, updatedAt: raw.updatedAt || null };
}

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(dataPath(), "utf8"));
    return normalizeState(raw);
  } catch (err) {
    if (err && err.code === "ENOENT") return defaultState();
    return defaultState();
  }
}

function save(state) {
  const next = normalizeState({ ...state, updatedAt: new Date().toISOString() });
  fs.mkdirSync(path.dirname(dataPath()), { recursive: true });
  fs.writeFileSync(dataPath(), JSON.stringify(next, null, 2), "utf8");
  return next;
}

const INJECT_TARGETS = [
  {
    id: "studies",
    name: "Studies",
    description: "AI Fill & chat: keys ground school document generation",
  },
  {
    id: "world-maps",
    name: "World Maps",
    description: "Map AI agent: keys ground the model as tools",
  },
  {
    id: "study-deck",
    name: "Study Deck",
    description: "AI card generator: keys feed flashcard content",
  },
  {
    id: "model-flow",
    name: "Model Flow",
    description: "Model Lab planner: keys inform flow planning",
  },
  {
    id: "stocks",
    name: "Stocks",
    description: "AI analysis & chat: keys ground market context",
  },
  {
    id: "day-planner",
    name: "Today",
    description: "AI agenda: keys shape generated tasks",
  },
];

function listLibrary() {
  const state = load();
  return { ok: true, keys: state.keys, updatedAt: state.updatedAt };
}

function saveKey(args = {}) {
  let uri = String(args.uri || "").trim();
  if (!uri && args.capability) {
    try {
      uri = MslKey.build(args.capability, args.input || {});
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
  const entry = normalizeEntry({
    id: args.id,
    uri,
    label: args.label,
    createdAt: args.createdAt,
  });
  if (!entry) return { ok: false, error: "Invalid MSL key" };
  const state = load();
  const idx = state.keys.findIndex((k) => k.id === entry.id || k.uri === entry.uri);
  if (idx >= 0) state.keys[idx] = { ...state.keys[idx], ...entry };
  else state.keys.unshift(entry);
  const saved = save(state);
  return { ok: true, key: entry, keys: saved.keys };
}

function deleteKey(args = {}) {
  const id = String(args.id || "").trim();
  const uri = String(args.uri || "").trim();
  if (!id && !uri) return { ok: false, error: "Missing id or uri" };
  const state = load();
  state.keys = state.keys.filter((k) => k.id !== id && k.uri !== uri);
  const saved = save(state);
  return { ok: true, keys: saved.keys };
}

function listInjections(args = {}) {
  const state = load();
  const appId = String(args.appId || args.app || "").trim();
  if (appId) {
    return {
      ok: true,
      appId,
      keys: state.injections[appId] || [],
      targets: INJECT_TARGETS,
    };
  }
  return { ok: true, injections: state.injections, targets: INJECT_TARGETS };
}

function injectKey(args = {}) {
  const appId = String(args.appId || args.app || "").trim();
  if (!appId) return { ok: false, error: "Missing target appId" };
  if (!INJECT_TARGETS.some((t) => t.id === appId)) {
    return { ok: false, error: `App "${appId}" is not an MSL inject target yet` };
  }
  let uri = String(args.uri || "").trim();
  if (!uri && args.capability) {
    try {
      uri = MslKey.build(args.capability, args.input || {});
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
  const entry = normalizeEntry({ uri, label: args.label, id: args.id });
  if (!entry) return { ok: false, error: "Invalid MSL key" };
  const state = load();
  const list = state.injections[appId] || [];
  const nextItem = { ...entry, injectedAt: new Date().toISOString() };
  const existing = list.findIndex((k) => k.uri === entry.uri);
  if (existing >= 0) list[existing] = nextItem;
  else list.unshift(nextItem);
  state.injections[appId] = list.slice(0, 100);
  // Also keep in library
  if (!state.keys.some((k) => k.uri === entry.uri)) {
    state.keys.unshift(entry);
  }
  const saved = save(state);
  return { ok: true, appId, key: nextItem, keys: saved.injections[appId] };
}

function removeInjection(args = {}) {
  const appId = String(args.appId || args.app || "").trim();
  const id = String(args.id || "").trim();
  const uri = String(args.uri || "").trim();
  if (!appId) return { ok: false, error: "Missing appId" };
  const state = load();
  const list = state.injections[appId] || [];
  state.injections[appId] = list.filter((k) => k.id !== id && k.uri !== uri);
  const saved = save(state);
  return { ok: true, appId, keys: saved.injections[appId] || [] };
}

function clearInjections(args = {}) {
  const appId = String(args.appId || args.app || "").trim();
  if (!appId) return { ok: false, error: "Missing appId" };
  const state = load();
  state.injections[appId] = [];
  const saved = save(state);
  return { ok: true, appId, keys: [] , updatedAt: saved.updatedAt };
}

module.exports = {
  INJECT_TARGETS,
  listLibrary,
  saveKey,
  deleteKey,
  listInjections,
  injectKey,
  removeInjection,
  clearInjections,
  load,
};