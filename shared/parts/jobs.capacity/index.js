const POOL_IDS = ["interactive", "shell", "background", "connect"];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function clampInt(n, min, max, fallback) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.round(v)));
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
      id: String(item.id || `ex_${merged.length}`),
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

function isConnectJob(job) {
  if (!job) return false;
  if (job.kind === "connect" || job.pool === "connect") return true;
  const hay = `${job.appId || ""} ${job.title || ""} ${job.source || ""}`.toLowerCase();
  return (
    hay.includes("connect") ||
    hay.startsWith("mail") ||
    hay.includes("gmail") ||
    hay.includes("browser")
  );
}

function findException(job, capacity) {
  const hay = `${job?.appId || ""} ${job?.title || ""} ${job?.source || ""}`.toLowerCase();
  const list = capacity?.exceptions || [];
  for (const ex of list) {
    if (ex.match && hay.includes(ex.match)) return ex;
  }
  return null;
}

function resolvePool(job, capacity) {
  if (job?.pool && POOL_IDS.includes(job.pool)) return job.pool;
  const ex = findException(job, capacity);
  if (ex?.pool) return ex.pool;
  if (isConnectJob(job)) return "connect";
  if (job?.kind === "launch") return "interactive";
  if (job?.kind === "shell" || job?.kind === "script" || job?.kind === "program") return "shell";
  return "background";
}

function canStartJob(job, capacity, runningCounts = {}, { focusEnabled = false } = {}) {
  const cap = normalizeCapacity(capacity);
  const pool = resolvePool(job, cap);
  if (cap.pauseWhenFocus && focusEnabled && pool === "background") return false;

  if (
    pool === "background" &&
    cap.dailyBudgetSeconds > 0 &&
    (cap.usedBudgetSecondsToday || 0) >= cap.dailyBudgetSeconds
  ) {
    return false;
  }

  const running = Number(runningCounts[pool] || 0);
  const max = cap.pools[pool]?.maxConcurrent ?? 0;
  if (running >= max) {
    if (pool === "connect" && isConnectJob(job) && running < 16) return true;
    return false;
  }

  const global = Number(runningCounts.global || 0);
  if (pool !== "interactive" && pool !== "connect" && global >= (cap.softGlobalMax || 18)) {
    return false;
  }
  return true;
}

const api = {
  POOL_IDS,
  defaultPools,
  defaultCapacity,
  normalizePools,
  normalizeExceptions,
  normalizeCapacity,
  isConnectJob,
  findException,
  resolvePool,
  canStartJob,
};

if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.PartsJobsCapacity = api;