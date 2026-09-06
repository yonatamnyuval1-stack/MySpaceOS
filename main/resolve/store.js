const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const MAX_INCIDENTS = 200;

function storePath() {
  return path.join(app.getPath("userData"), "resolve-incidents.json");
}

function defaultState() {
  return { incidents: [], updatedAt: null };
}

function loadState() {
  try {
    const raw = JSON.parse(fs.readFileSync(storePath(), "utf8"));
    const incidents = Array.isArray(raw?.incidents) ? raw.incidents : [];
    return {
      incidents: incidents.slice(0, MAX_INCIDENTS),
      updatedAt: raw?.updatedAt || null,
    };
  } catch (err) {
    if (err && err.code === "ENOENT") return defaultState();
    return defaultState();
  }
}

function saveState(state) {
  const next = {
    incidents: (state.incidents || []).slice(0, MAX_INCIDENTS),
    updatedAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(storePath()), { recursive: true });
  fs.writeFileSync(storePath(), JSON.stringify(next, null, 2), "utf8");
  return next;
}

function uid() {
  return `inc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function addIncident(row) {
  const state = loadState();
  const incident = {
    id: row.id || uid(),
    appId: String(row.appId || "unknown"),
    code: String(row.code || row.kind || "UNKNOWN"),
    kind: String(row.kind || row.code || "UNKNOWN"),
    severity: ["info", "warn", "error"].includes(row.severity) ? row.severity : "error",
    message: String(row.message || "").slice(0, 500),
    category: String(row.category || "unknown"),
    context: row.context && typeof row.context === "object" ? row.context : {},
    caller: row.caller ? String(row.caller) : "",
    playbookId: row.playbookId ? String(row.playbookId) : "",
    status: "open",
    createdAt: row.createdAt || new Date().toISOString(),
    updatedAt: row.updatedAt || row.createdAt || new Date().toISOString(),
    resolvedAt: null,
    applyLog: [],
  };
  state.incidents.unshift(incident);
  if (state.incidents.length > MAX_INCIDENTS) {
    state.incidents.length = MAX_INCIDENTS;
  }
  saveState(state);
  return incident;
}

function updateIncident(id, patch) {
  const state = loadState();
  const idx = state.incidents.findIndex((i) => i.id === id);
  if (idx < 0) return null;
  const prev = state.incidents[idx];
  const next = {
    ...prev,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  state.incidents[idx] = next;
  saveState(state);
  return next;
}

function getIncident(id) {
  return loadState().incidents.find((i) => i.id === id) || null;
}

function listIncidents(filter = {}) {
  let rows = loadState().incidents;
  const status = filter.status ? String(filter.status) : "";
  const appId = filter.appId ? String(filter.appId) : "";
  const q = filter.q ? String(filter.q).trim().toLowerCase() : "";
  if (status) rows = rows.filter((i) => i.status === status);
  if (appId) rows = rows.filter((i) => i.appId === appId);
  if (q) {
    rows = rows.filter((i) =>
      `${i.appId} ${i.code} ${i.message} ${i.category}`.toLowerCase().includes(q)
    );
  }
  const limit = Math.min(100, Math.max(1, parseInt(filter.limit, 10) || 50));
  return rows.slice(0, limit);
}

function clearIncidents(args = {}) {
  const state = loadState();
  if (args.all) {
    state.incidents = [];
    return saveState(state);
  }
  const keepDays = Math.max(1, parseInt(args.olderThanDays, 10) || 30);
  const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
  state.incidents = state.incidents.filter((i) => {
    const t = Date.parse(i.resolvedAt || i.createdAt || "");
    return Number.isFinite(t) && t >= cutoff;
  });
  return saveState(state);
}

module.exports = {
  loadState,
  saveState,
  addIncident,
  updateIncident,
  getIncident,
  listIncidents,
  clearIncidents,
  uid,
};
