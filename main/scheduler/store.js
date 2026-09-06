const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const { reportLoadFailure, reportSaveFailure } = require("../resolve/report-helper");

const HISTORY_LIMIT = 80;
const SCHEDULE_LIMIT = 200;

const profile = require("../myspace-profile");

function dataPath() {
  return profile.profileScopedPath("scheduler-platform.json");
}

function uid(prefix = "sch") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function defaultState() {
  return {
    version: 1,
    schedules: [],
    history: [],
    updatedAt: null,
  };
}

function normalizeTrigger(raw) {
  const t = raw && typeof raw === "object" ? raw : {};
  const type = String(t.type || "").trim().toLowerCase();
  if (type === "interval") {
    const everyMs = Math.max(5_000, Math.min(30 * 24 * 60 * 60 * 1000, Number(t.everyMs) || 0));
    if (!everyMs) return null;
    return { type: "interval", everyMs };
  }
  if (type === "daily") {
    const time = String(t.time || "").trim();
    if (!/^\d{1,2}:\d{2}$/.test(time)) return null;
    const [hh, mm] = time.split(":").map((n) => Number(n));
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return { type: "daily", time: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}` };
  }
  if (type === "once" || type === "at" || type === "in") {
    const at = String(t.at || "").trim();
    if (!at || Number.isNaN(Date.parse(at))) return null;
    return { type: "once", at: new Date(at).toISOString() };
  }
  return null;
}

function normalizeAction(raw) {
  const a = raw && typeof raw === "object" ? raw : {};
  const kind = String(a.kind || "shell").trim().toLowerCase();
  if (kind === "script") {
    const scriptName = String(a.scriptName || "").trim();
    const scriptId = String(a.scriptId || "").trim();
    if (!scriptName && !scriptId) return null;
    return { kind: "script", scriptName, scriptId };
  }
  const command = String(a.command || "").trim();
  if (!command) return null;
  return { kind: "shell", command: command.slice(0, 4000) };
}

function normalizeSchedule(raw) {
  if (!raw || typeof raw !== "object") return null;
  const trigger = normalizeTrigger(raw.trigger);
  const action = normalizeAction(raw.action);
  if (!trigger || !action) return null;
  const enabled = raw.enabled !== false && raw.status !== "paused" && raw.status !== "disabled";
  return {
    id: String(raw.id || uid()),
    title: String(raw.title || action.command || action.scriptName || "Schedule").slice(0, 120),
    enabled,
    status: enabled ? "active" : String(raw.status || "paused"),
    trigger,
    action,
    via: String(raw.via || "jobs").toLowerCase() === "direct" ? "direct" : "jobs",
    nextRunAt: raw.nextRunAt ? String(raw.nextRunAt) : null,
    lastRunAt: raw.lastRunAt ? String(raw.lastRunAt) : null,
    lastResult: raw.lastResult && typeof raw.lastResult === "object" ? raw.lastResult : null,
    runCount: Math.max(0, Number(raw.runCount) || 0),
    createdAt: String(raw.createdAt || new Date().toISOString()),
    updatedAt: String(raw.updatedAt || new Date().toISOString()),
    source: String(raw.source || "desktop").slice(0, 64),
  };
}

function normalizeHistoryEntry(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    id: String(raw.id || uid("run")),
    scheduleId: String(raw.scheduleId || ""),
    title: String(raw.title || ""),
    at: String(raw.at || new Date().toISOString()),
    ok: raw.ok !== false,
    message: String(raw.message || raw.error || "").slice(0, 500),
    jobId: raw.jobId ? String(raw.jobId) : null,
  };
}

function normalizeState(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const schedules = (Array.isArray(raw.schedules) ? raw.schedules : [])
    .map(normalizeSchedule)
    .filter(Boolean)
    .slice(0, SCHEDULE_LIMIT);
  const history = (Array.isArray(raw.history) ? raw.history : [])
    .map(normalizeHistoryEntry)
    .filter(Boolean)
    .slice(0, HISTORY_LIMIT);
  return {
    version: 1,
    schedules,
    history,
    updatedAt: raw.updatedAt || null,
  };
}

function load() {
  try {
    if (!fs.existsSync(dataPath())) return defaultState();
    const raw = JSON.parse(fs.readFileSync(dataPath(), "utf8"));
    return normalizeState(raw);
  } catch (err) {
    reportLoadFailure("scheduler", err);
    return defaultState();
  }
}

function save(state) {
  try {
    const next = normalizeState(state);
    next.updatedAt = new Date().toISOString();
    fs.mkdirSync(path.dirname(dataPath()), { recursive: true });
    fs.writeFileSync(dataPath(), JSON.stringify(next, null, 2), "utf8");
    return next;
  } catch (err) {
    reportSaveFailure("scheduler", err);
    return state;
  }
}

module.exports = {
  HISTORY_LIMIT,
  SCHEDULE_LIMIT,
  dataPath,
  uid,
  defaultState,
  normalizeTrigger,
  normalizeAction,
  normalizeSchedule,
  normalizeHistoryEntry,
  normalizeState,
  load,
  save,
};