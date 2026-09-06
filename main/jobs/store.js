const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const { reportLoadFailure, reportSaveFailure } = require("../resolve/report-helper");
const profile = require("../myspace-profile");
const { DEFAULT_MAX_WIDTH } = require("../ai/screen-capture");
const { CheckCheck, Cctv, FoldHorizontal, DnaOff, BusFront, FlashlightOff } = require("lucide-static");
const { Http2ServerRequest } = require("http2");
const { normalizeFromBundled } = require("../apps/restcountries-client");
const { createConnection } = require("net");

const POOL_IDS = ["interactive", "shell", "background", "connect"];

function dataPath() {
  return profile.profileScopedPath("jobs-platform.json");
}

function uid(prefix = "job") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function defaultPools() {
  return {
    interactive: { maxConcurrent: 6 },
    shell: { maxConcurrent: 4 },
    background: { maxConcurrent: 2 },
    connect: { maxConcurrent: 10 },
  };
}

function defaultCapacity() {
  return {
    version: 2,
    pools: defaultPools(),
    softGlobalMax: 18,
    maxQueued: 100,
    pauseWhenFocus: true,
    notifyOnDone: true,
    allowShell: true,
    allowScript: true,
    allowLaunch: true,
    allowProgram: true,
    allowDelay: true,
    allowFileWrite: true,
    allowHost: true,
    allowAppBuild: true,
    maxShellLength: 4000,
    dailyBudgetSeconds: 0,
    usedBudgetSecondsToday: 0,
    budgetDay: todayKey(),
    connectBoost: true,
    exceptions: [
      { id: "ex_connect_prefix", match: "connect-", pool: "connect", priority: "high" },
      { id: "ex_connect_word", match: "connect", pool: "connect", priority: "high" },
      { id: "ex_mail", match: "mail", pool: "connect", priority: "high" },
    ],
  };
}

function defaultState() {
  return {
    jobs: [],
    capacity: defaultCapacity(),
    updatedAt: null,
  };
}

function clampInt(n, min, max, fallback) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.round(v)));
}

function normalizePools(raw) {
  const base = defaultPools();
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    interactive: {
      maxConcurrent: clampInt(src.interactive?.maxConcurrent, 2, 12, base.interactive.maxConcurrent),
    },
    shell: {
      maxConcurrent: clampInt(src.shell?.maxConcurrent, 1, 12, base.shell.maxConcurrent),
    },
    background: {
      maxConcurrent: clampInt(src.background?.maxConcurrent, 0, 8, base.background.maxConcurrent),
    },
    connect: {
      maxConcurrent: clampInt(src.connect?.maxConcurrent, 4, 16, base.connect.maxConcurrent),
    },
  };
}

function normalizeExceptions(list, { connectBoost = true } = {}) {
  const defaults = connectBoost
    ? [
        { id: "ex_connect_prefix", match: "connect-", pool: "connect", priority: "high" },
        { id: "ex_connect_word", match: "connect", pool: "connect", priority: "high" },
        { id: "ex_mail", match: "mail", pool: "connect", priority: "high" },
      ]
    : [];
  const raw = Array.isArray(list) ? list : [];
  const merged = [];
  const seen = new Set();
  for (const item of [...defaults, ...raw]) {
    if (!item || typeof item !== "object") continue;
    const match = String(item.match || item.appId || item.id || "")
      .trim()
      .toLowerCase();
    if (!match || seen.has(match)) continue;
    seen.add(match);
    let pool = String(item.pool || "shell").toLowerCase();
    if (!POOL_IDS.includes(pool)) pool = "shell";
    let priority = String(item.priority || "normal").toLowerCase();
    if (priority !== "high" && priority !== "low") priority = "normal";
    merged.push({
      id: String(item.id || uid("ex")),
      match,
      pool,
      priority,
    });
    if (merged.length >= 12) break;
  }
  return merged;
}
function normalizeCapacity(raw) {
  const base = defaultCapacity();
  const c = raw && typeof raw === "object" ? raw : {};

  let pools = c.pools;
  if (!pools && Number(c.maxConcurrent) > 0) {
    const n = clampInt(c.maxConcurrent, 2, 16, 8);
    pools = {
      interactive: { maxConcurrent: Math.max(2, Math.ceil(n * 0.5)) },
      shell: { maxConcurrent: Math.max(1, Math.ceil(n * 0.35)) },
      background: { maxConcurrent: Math.max(0, Math.floor(n * 0.25)) },
      connect: { maxConcurrent: 10 },
    };
  }
  const next = {
    ...base,
    version: 2,
    pools: normalizePools(pools),
    softGlobalMax: clampInt(c.softGlobalMax, 4, 24, base.softGlobalMax),
    maxQueued: clampInt(c.maxQueued, 20, 300, base.maxQueued),
    pauseWhenFocus: c.pauseWhenFocus !== false,
    notifyOnDone: c.notifyOnDone !== false,
    allowShell: c.allowShell !== false,
    allowScript: c.allowScript !== false,
    allowLaunch: c.allowLaunch !== false,
    allowProgram: c.allowProgram !== false,
    allowDelay: c.allowDelay !== false,
    allowFileWrite: c.allowFileWrite !== false,
    allowHost: c.allowHost !== false,
    allowAppBuild: c.allowAppBuild !== false,
    maxShellLength: clampInt(c.maxShellLength, 200, 12000, base.maxShellLength),
    dailyBudgetSeconds: clampInt(c.dailyBudgetSeconds, 0, 86400, 0),
    usedBudgetSecondsToday: Math.max(0, Number(c.usedBudgetSecondsToday) || 0),
    budgetDay: String(c.budgetDay || todayKey()),
    connectBoost: c.connectBoost !== false,
    exceptions: normalizeExceptions(c.exceptions, { connectBoost: c.connectBoost !== false }),
  };

  if (next.budgetDay !== todayKey()) {
    next.budgetDay = todayKey();
    next.usedBudgetSecondsToday = 0;
  }

  next.maxConcurrent =
    next.pools.interactive.maxConcurrent +
    next.pools.shell.maxConcurrent +
    next.pools.background.maxConcurrent +
    next.pools.connect.maxConcurrent;

  return next;
}

function normalizeJob(raw) {
  if (!raw || typeof raw !== "object") return null;
  const kind = String(raw.kind || "noop").toLowerCase();
  const status = String(raw.status || "queued").toLowerCase();
  let pool = String(raw.pool || "").toLowerCase();
  if (!POOL_IDS.includes(pool)) pool = null;
  return {
    id: String(raw.id || uid()),
    title: String(raw.title || kind).slice(0, 120),
    kind,
    status,
    pool,
    priority: raw.priority === "high" || raw.priority === "low" ? raw.priority : "normal",
    interactive: raw.interactive === true,
    capacityBypass: raw.capacityBypass === true,
    source: String(raw.source || "desktop").slice(0, 64),
    payload: raw.payload && typeof raw.payload === "object" ? { ...raw.payload } : {},
    result: raw.result && typeof raw.result === "object" ? { ...raw.result } : null,
    error: raw.error ? String(raw.error).slice(0, 400) : null,
    progress: Number.isFinite(Number(raw.progress)) ? Number(raw.progress) : null,
    createdAt: raw.createdAt || new Date().toISOString(),
    startedAt: raw.startedAt || null,
    finishedAt: raw.finishedAt || null,
    durationMs: Number.isFinite(Number(raw.durationMs)) ? Number(raw.durationMs) : null,
  };
}

function normalizeState(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const jobs = (Array.isArray(raw.jobs) ? raw.jobs : [])
    .map(normalizeJob)
    .filter(Boolean)
    .slice(0, 400);
  return {
    jobs,
    capacity: normalizeCapacity(raw.capacity),
    updatedAt: raw.updatedAt || null,
  };
}

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(dataPath(), "utf8"));
    return normalizeState(raw);
  } catch (err) {
    if (err && err.code === "ENOENT") return defaultState();
    reportLoadFailure("jobs", { error: err?.message || String(err), corrupt: true }, "jobs");
    return defaultState();
  }
}

function save(state) {
  const next = normalizeState({ ...state, updatedAt: new Date().toISOString() });
  try {
    fs.mkdirSync(path.dirname(dataPath()), { recursive: true });
    fs.writeFileSync(dataPath(), JSON.stringify(next, null, 2), "utf8");
  } catch (err) {
    reportSaveFailure("jobs", { error: err?.message || String(err) }, "jobs");
  }
  return next;
}

module.exports = {
  POOL_IDS,
  uid,
  todayKey,
  defaultCapacity,
  defaultPools,
  defaultState,
  normalizeCapacity,
  normalizeExceptions,
  normalizeJob,
  normalizeState,
  load,
  save,
  dataPath,
};