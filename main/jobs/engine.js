const { BrowserWindow } = require("electron");
const store = require("./store");
const { reportRuntimeFailure } = require("../resolve/report-helper");
const { getState: getFocusState } = require("../apps/focus-gate");
const { push: pushNotification } = require("../apps/notifications-center");
const {
  executeInRenderer,
  executeProgramInRenderer,
} = require("../apps/shell-console-ipc");

let timer = null;
let state = store.load();
const running = new Map();

function mainWindow() {
  return BrowserWindow.getAllWindows().find((w) => !w.isDestroyed()) || null;
}

function snapshot() {
  const capacity = store.normalizeCapacity(state.capacity);
  const jobs = state.jobs || [];
  const queued = jobs.filter((j) => j.status === "queued").length;
  const active = jobs.filter((j) => j.status === "running").length;
  const succeeded = jobs.filter((j) => j.status === "succeeded").length;
  const failed = jobs.filter((j) => j.status === "failed").length;
  const focus = getFocusState();
  const focusOn = !!(focus.enabled && focus.silenceNotifications);
  const poolStats = {};
  for (const id of store.POOL_IDS) {
    const runningCount = jobs.filter((j) => j.status === "running" && jobPool(j, capacity) === id).length;
    const queuedCount = jobs.filter((j) => j.status === "queued" && jobPool(j, capacity) === id).length;
    const max = capacity.pools[id]?.maxConcurrent ?? 0;
    poolStats[id] = {
      running: runningCount,
      queued: queuedCount,
      max,
      free: Math.max(0, max - runningCount),
      pausedByFocus: id === "background" && capacity.pauseWhenFocus && focusOn,
    };
  }
  const budgetLeft =
    capacity.dailyBudgetSeconds > 0
      ? Math.max(0, capacity.dailyBudgetSeconds - capacity.usedBudgetSecondsToday)
      : null;
  return {
    ok: true,
    jobs: jobs.map((j) => ({ ...j })),
    capacity: { ...capacity },
    stats: {
      total: jobs.length,
      queued,
      running: active,
      succeeded,
      failed,
      pausedByFocus: poolStats.background.pausedByFocus,
      budgetLeftSeconds: budgetLeft,
      pools: poolStats,
    },
    updatedAt: state.updatedAt,
  };
}

function persist() {
  state = store.save(state);
  broadcast();
  return snapshot();
}

function broadcast() {
  const payload = snapshot();
  const { webContents } = require("electron");
  for (const wc of webContents.getAllWebContents()) {
    try {
      if (!wc.isDestroyed()) wc.send("jobs-updated", payload);
    } catch {
    }
  }
}

function findJob(id) {
  return state.jobs.find((j) => j.id === id) || null;
}

function canAcceptKind(kind, capacity, { interactive } = {}) {
  if (
    interactive &&
    (kind === "launch" || kind === "shell" || kind === "control" || kind === "program" || kind === "connect")
  ) {
    return true;
  }
  if (kind === "shell") return capacity.allowShell !== false;
  if (kind === "script") return capacity.allowScript !== false;
  if (kind === "program") return capacity.allowProgram !== false;
  if (kind === "host") return capacity.allowHost !== false;
  if (kind === "launch" || kind === "connect") return capacity.allowLaunch !== false;
  if (kind === "delay") return capacity.allowDelay !== false;
  if (kind === "noop" || kind === "control") return true;
  return false;
}

function isConnectJob(job) {
  const appId = String(job.payload?.appId || "").toLowerCase();
  const hay = `${job.kind} ${job.source} ${job.title} ${appId}`.toLowerCase();
  if (job.kind === "connect") return true;
  if (appId === "mail" || appId.startsWith("connect-")) return true;
  if (hay.includes("connect-")) return true;
  if (/\bconnect\b/.test(hay)) return true;
  if (job.kind === "launch" && (hay.includes("mail") || hay.includes("gmail"))) return true;
  return false;
}

function findException(job, capacity) {
  const list = capacity.exceptions || [];
  if (!list.length) return null;
  const hay = `${job.kind} ${job.source} ${job.title} ${job.payload?.appId || ""} ${
    job.payload?.scriptName || ""
  }`.toLowerCase();
  for (const ex of list) {
    if (ex.match && hay.includes(ex.match)) return ex;
  }
  return null;
}

function resolvePool(job, capacity) {
  const ex = findException(job, capacity);
  if (ex?.pool) return ex.pool;
  if (job.pool && store.POOL_IDS.includes(job.pool)) return job.pool;
  if (capacity.connectBoost !== false && isConnectJob(job)) return "connect";
  if (job.kind === "launch" || job.kind === "control") return "interactive";
  if (job.interactive) return "interactive";
  if (job.priority === "low" || job.kind === "delay" || job.source === "msl") return "background";
  if (["shell", "program", "script", "host"].includes(job.kind)) return "shell";
  return "background";
}

function jobPool(job, capacity) {
  return job.pool || resolvePool(job, capacity);
}

function focusBlocks(job, capacity) {
  const pool = jobPool(job, capacity);
  if (pool !== "background") return false;
  if (job.interactive || job.payload?.bypassFocus) return false;
  if (!capacity.pauseWhenFocus) return false;
  const focus = getFocusState();
  return !!(focus.enabled && focus.silenceNotifications);
}

function runningInPool(pool, capacity) {
  return state.jobs.filter(
    (j) => j.status === "running" && jobPool(j, capacity) === pool
  ).length;
}

function globalRunning() {
  return state.jobs.filter((j) => j.status === "running").length;
}

function canStartJob(job, capacity) {
  const pool = jobPool(job, capacity);
  if (focusBlocks(job, capacity)) return false;

  if (
    pool === "background" &&
    capacity.dailyBudgetSeconds > 0 &&
    capacity.usedBudgetSecondsToday >= capacity.dailyBudgetSeconds
  ) {
    return false;

  }
  const max = capacity.pools[pool]?.maxConcurrent ?? 0;
  if (runningInPool(pool, capacity) >= max) {
    if (pool === "connect" && isConnectJob(job) && runningInPool("connect", capacity) < 16) {
      return true;
    }
    return false;
  }

  if (
    pool !== "interactive" &&
    pool !== "connect" &&
    globalRunning() >= (capacity.softGlobalMax || 18)
  ) {
    return false;
  }
  return true;
}

function buildPayload(kind, args) {
  const payload = {};
  if (kind === "shell") {
    payload.command = String(args.command || args.line || "").trim();
  } else if (kind === "program") {
    payload.body = String(args.body || args.program || "").trim();
    payload.stopOnError = args.stopOnError !== false;
  } else if (kind === "script") {
    payload.scriptId = args.scriptId ? String(args.scriptId) : "";
    payload.scriptName = args.scriptName || args.name ? String(args.scriptName || args.name) : "";
  } else if (kind === "launch") {
    payload.appId = String(args.appId || args.id || "").trim();
    payload.route = args.route && typeof args.route === "object" ? args.route : null;
    payload.reuse = args.reuse !== false;
    payload.bypassFocus = true;
  } else if (kind === "connect") {
    payload.appId = String(args.appId || "").trim();
    payload.url = String(args.url || "").trim();
    payload.title = String(args.title || args.name || "").trim();
    payload.preload = args.preload || null;
    payload.iconUrl = args.iconUrl || args.iconSrc || null;
    payload.reuse = args.reuse !== false;
    payload.forceInApp = true;
    payload.bypassFocus = true;
  } else if (kind === "delay") {
    payload.delayMs = Math.max(100, Math.min(600000, Number(args.delayMs || args.ms || 1000) || 1000));
  } else if (kind === "control") {
    payload.command = String(args.command || "").trim();
  } else if (kind === "host") {
    payload.runtime = String(args.runtime || "").trim();
    payload.scriptPath = String(args.scriptPath || args.script || args.file || "").trim();
    payload.args = args.args || args.arg || "";
    payload.cwd = args.cwd ? String(args.cwd) : "";
    payload.wait = args.wait !== false;
    payload.timeoutMs = args.timeoutMs || args.timeout;
  }
  if (args.bypassFocus) payload.bypassFocus = true;
  return payload;
}

function defaultTitle(kind, payload, args) {
  if (args.title) return String(args.title).slice(0, 120);
  if (kind === "shell" || kind === "control") return String(payload.command || kind).slice(0, 80);
  if (kind === "program") {
    const first = String(payload.body || "").trim().split(/\r?\n/).filter(Boolean)[0] || "program";
    return `Program · ${first.slice(0, 60)}`;
  }
  if (kind === "script") return `Script · ${payload.scriptName || payload.scriptId}`;
  if (kind === "launch") return `Launch · ${payload.appId}`;
  if (kind === "connect") return `Connect · ${payload.title || payload.appId || "service"}`;
  if (kind === "delay") return `Delay · ${payload.delayMs}ms`;
  if (kind === "host") {
    return `Host · ${payload.runtime || "?"} ${String(payload.scriptPath || "").replace(/^file:/i, "")}`.slice(
      0,
      120
    );
  }
  return kind;
}

function createJobRecord(args = {}, source = "desktop") {
  const capacity = store.normalizeCapacity(state.capacity);
  const interactive = args.interactive === true;
  const kind = String(
    args.kind ||
      (args.command
        ? "shell"
        : args.body
          ? "program"
          : args.appId
            ? "launch"
            : args.scriptName || args.scriptId
              ? "script"
              : "noop")
  ).toLowerCase();

  if (!canAcceptKind(kind, capacity, { interactive })) {
    return { ok: false, error: `Capacity contract forbids kind "${kind}"` };
  }

  const queued = state.jobs.filter((j) => j.status === "queued").length;
  if (queued >= capacity.maxQueued && !interactive) {
    return { ok: false, error: `Queue full (max ${capacity.maxQueued})` };
  }

  if (
    !interactive &&
    capacity.dailyBudgetSeconds > 0 &&
    capacity.usedBudgetSecondsToday >= capacity.dailyBudgetSeconds &&
    (kind === "delay" || source === "msl" || args.priority === "low")
  ) {
    return { ok: false, error: "Daily background compute budget exhausted" };
  }

  const payload = buildPayload(kind, args);
  if (kind === "shell" || kind === "control") {
    if (!payload.command) return { ok: false, error: "Shell activity needs a command" };
    if (payload.command.length > capacity.maxShellLength) {
      return { ok: false, error: `Command too long (max ${capacity.maxShellLength})` };
    }
  }
  if (kind === "program" && !payload.body) return { ok: false, error: "Program needs a body" };
  if (kind === "script" && !payload.scriptId && !payload.scriptName) {
    return { ok: false, error: "Script needs a name or id" };
  }
  if (kind === "launch" && !payload.appId) return { ok: false, error: "Launch needs appId" };
  if (kind === "connect" && !payload.url) return { ok: false, error: "Connect open needs a url" };
  if (kind === "host") {
    if (!payload.runtime) return { ok: false, error: "Host job needs runtime" };
    if (!payload.scriptPath) return { ok: false, error: "Host job needs scriptPath (file:…)" };
  }

  let priority = args.priority === "high" || args.priority === "low" ? args.priority : "normal";
  if (interactive && priority === "normal") priority = "high";

  const draft = {
    id: store.uid(),
    title: defaultTitle(kind, payload, args),
    kind,
    status: "queued",
    priority,
    interactive: interactive || kind === "connect",
    source: String(args.source || source || "desktop"),
    payload,
    createdAt: new Date().toISOString(),
  };

  if (isConnectJob(draft) || kind === "connect") {
    draft.priority = "high";
    draft.interactive = true;
    draft.source = draft.source === "desktop" ? "connect" : draft.source;
  }

  const ex = findException(draft, capacity);
  if (ex?.priority) draft.priority = ex.priority;
  draft.pool = resolvePool(draft, capacity);

  const job = store.normalizeJob(draft);
  state.jobs.unshift(job);
  persist();
  return { ok: true, job };
}

function enqueue(args = {}, source = "desktop") {
  const created = createJobRecord({ ...args, interactive: false }, source);
  if (!created.ok) return created;
  void tick();
  return { ok: true, job: created.job, queued: true, ...snapshot() };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function withTimeout(promise, ms, label) {
  const limit = Math.max(500, Number(ms) || 15000);
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label || "Job"} timed out after ${limit}ms`)), limit);
    Promise.resolve(promise).then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (err) => {
        clearTimeout(t);
        reject(err);
      }
    );
  });
}

function recoverStaleRunning(opts = {}) {
  const maxAgeMs = Math.max(5000, Number(opts.maxAgeMs) || 45000);
  const now = Date.now();
  let changed = 0;
  for (const job of state.jobs) {
    if (job.status !== "running") continue;
    const handle = running.get(job.id);
    const started = job.startedAt ? Date.parse(job.startedAt) : 0;
    const age = started ? now - started : maxAgeMs + 1;
    const orphan = !handle;
    const tooOld = age >= maxAgeMs;
    if (!orphan && !tooOld) continue;
    if (handle) handle.abort = true;
    running.delete(job.id);
    job.status = "failed";
    job.error = orphan ? "Interrupted: worker lost" : "Timed out";
    job.finishedAt = new Date().toISOString();
    job.durationMs = started ? Math.max(0, now - started) : null;
    job.result = { ok: false, message: job.error, error: job.error };
    changed += 1;
  }
  return changed;
}

function pruneJobHistory() {
  const keepActive = state.jobs.filter((j) => j.status === "queued" || j.status === "running");
  const finished = state.jobs
    .filter((j) => j.status !== "queued" && j.status !== "running")
    .sort((a, b) => String(b.finishedAt || b.createdAt || "").localeCompare(String(a.finishedAt || a.createdAt || "")))
    .slice(0, 80);
  const next = [...keepActive, ...finished];
  if (next.length === state.jobs.length) return 0;
  const removed = state.jobs.length - next.length;
  state.jobs = next;
  return removed;
}

async function waitUntilStartable(job, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const capacity = store.normalizeCapacity(state.capacity);
    const live = findJob(job.id);
    if (!live || live.status !== "queued") return live;
    if (canStartJob(live, capacity)) return live;
    await sleep(120);
  }
  return findJob(job.id);
}

async function runActivity(args = {}, source = "desktop") {
  const wait = args.wait !== false;
  const interactive = args.interactive === true || args.priority === "high";
  const created = createJobRecord({ ...args, interactive }, source);
  if (!created.ok) return created;

  const job = created.job;
  const capacity = store.normalizeCapacity(state.capacity);

  if (wait) {
    if (!canStartJob(job, capacity)) {
      const waited = await waitUntilStartable(job, Number(args.timeoutMs) || 8000);
      if (!waited || waited.status !== "queued") {
        return {
          ok: waited?.status === "succeeded",
          job: waited,
          message: waited?.result?.message,
          error: waited?.error || "Job did not start",
          ...snapshot(),
        };
      }
      if (!canStartJob(waited, store.normalizeCapacity(state.capacity))) {
        if (interactive || waited.kind === "launch" || waited.kind === "control" || waited.kind === "connect" || isConnectJob(waited)) {
          waited.capacityBypass = true;
          persist();
        } else {
          return {
            ok: false,
            queued: true,
            job: waited,
            error: focusBlocks(waited, capacity)
              ? "Background jobs paused by Focus"
              : "Compute pool full: raise Capacity pools or retry",
            ...snapshot(),
          };
        }
      }
    }
    await runJob(findJob(job.id) || job);
    const live = findJob(job.id) || job;
    return {
      ok: live.status === "succeeded",
      job: live,
      message: live.result?.message || live.error,
      error: live.status === "succeeded" ? null : live.error,
      ...snapshot(),
    };
  }

  void tick();
  return { ok: true, queued: true, job, ...snapshot() };
}

function cancel(args = {}) {
  const id = String(args.id || "").trim();
  if (!id) return { ok: false, error: "Missing job id" };
  const job = findJob(id);
  if (!job) return { ok: false, error: "Job not found" };
  if (["succeeded", "failed", "cancelled"].includes(job.status)) {
    return { ok: false, error: `Job already ${job.status}` };
  }
  if (job.status === "running") {
    const handle = running.get(id);
    if (handle) handle.abort = true;
  }
  job.status = "cancelled";
  job.finishedAt = new Date().toISOString();
  job.error = "Cancelled";
  persist();
  return { ok: true, job, ...snapshot() };
}

function retry(args = {}) {
  const id = String(args.id || "").trim();
  const prev = findJob(id);
  if (!prev) return { ok: false, error: "Job not found" };
  return enqueue(
    {
      kind: prev.kind,
      title: prev.title,
      priority: prev.priority,
      source: prev.source,
      ...prev.payload,
      command: prev.payload?.command,
      body: prev.payload?.body,
      scriptName: prev.payload?.scriptName,
      scriptId: prev.payload?.scriptId,
      appId: prev.payload?.appId,
      route: prev.payload?.route,
      delayMs: prev.payload?.delayMs,
    },
    prev.source || "desktop"
  );
}

function clearFinished() {
  state.jobs = state.jobs.filter((j) => j.status === "queued" || j.status === "running");
  return persist();
}

function getCapacity() {
  return { ok: true, capacity: store.normalizeCapacity(state.capacity), ...snapshot() };
}

function setCapacity(args = {}) {
  state.capacity = store.normalizeCapacity({ ...state.capacity, ...args });
  persist();
  void tick();
  return { ok: true, capacity: { ...state.capacity }, ...snapshot() };
}

function list(args = {}) {
  const status = String(args.status || "").trim().toLowerCase();
  let jobs = state.jobs;
  if (status) jobs = jobs.filter((j) => j.status === status);
  const limit = Math.max(1, Math.min(300, Number(args.limit) || 100));
  return { ok: true, jobs: jobs.slice(0, limit), ...snapshot() };
}

function get(args = {}) {
  const job = findJob(String(args.id || "").trim());
  if (!job) return { ok: false, error: "Job not found" };
  return { ok: true, job };
}

async function loadScriptBody(payload) {
  const { handleScriptsInvoke } = require("../apps/scripts-ipc");
  const res = await handleScriptsInvoke("scripts.get", {
    id: payload.scriptId,
    name: payload.scriptName,
  });
  if (!res?.ok || !res.script) return { ok: false, error: res?.error || "Script not found" };
  return { ok: true, body: res.script.body, name: res.script.name };
}

async function runJob(job) {
  const started = Date.now();
  job.status = "running";
  job.startedAt = new Date().toISOString();
  job.progress = 0;
  persist();

  const handle = { abort: false };
  running.set(job.id, handle);

  try {
    if (handle.abort) throw new Error("Cancelled");
    let result = { ok: true, message: "Done" };

    if (job.kind === "noop") {
      result = { ok: true, message: "No-op completed" };
    } else if (job.kind === "delay") {
      const ms = Number(job.payload?.delayMs) || 1000;
      const step = 50;
      let waited = 0;
      while (waited < ms) {
        if (handle.abort) throw new Error("Cancelled");
        await sleep(Math.min(step, ms - waited));
        waited += step;
        job.progress = Math.min(99, Math.round((waited / ms) * 100));
        if (waited % 250 < step) persist();
      }
      result = { ok: true, message: `Waited ${ms}ms` };
    } else if (job.kind === "shell" || job.kind === "control") {
      result = await executeInRenderer(job.payload.command, "jobs-internal");
    } else if (job.kind === "program") {
      result = await executeProgramInRenderer(job.payload.body, "jobs-internal", {
        stopOnError: job.payload.stopOnError !== false,
      });
    } else if (job.kind === "script") {
      const loaded = await loadScriptBody(job.payload || {});
      if (!loaded.ok) throw new Error(loaded.error || "Script not found");
      result = await executeProgramInRenderer(loaded.body, "jobs-internal", { stopOnError: true });
      if (result?.ok !== false) result.message = result.message || `Script ${loaded.name}`;
    } else if (job.kind === "launch") {
      const win = mainWindow();
      if (!win) throw new Error("My Space window not found");
      const safe = JSON.stringify({
        appId: job.payload.appId,
        route: job.payload.route || null,
        reuse: job.payload.reuse !== false,
      });
      result = await withTimeout(
        win.webContents.executeJavaScript(
          `(async () => window.MySpaceJobsRuntime?.performLaunch?.(${safe}))()`
        ),
        20000,
        "Launch"
      );
      if (!result) result = { ok: false, error: "Launch runtime unavailable" };
    } else if (job.kind === "connect") {
      const win = mainWindow();
      if (!win) throw new Error("My Space window not found");
      const safe = JSON.stringify({
        url: job.payload.url,
        title: job.payload.title || job.title,
        appId: job.payload.appId,
        preload: job.payload.preload || null,
        iconUrl: job.payload.iconUrl || null,
        reuse: job.payload.reuse !== false,
      });
      result = await withTimeout(
        win.webContents.executeJavaScript(
          `(async () => window.MySpaceJobsRuntime?.performConnectOpen?.(${safe}))()`
        ),
        20000,
        "Connect open"
      );
      if (!result) result = { ok: false, error: "Connect runtime unavailable" };
    } else if (job.kind === "host") {
      const { runHostProcess } = require("../apps/host-ipc");
      result = await runHostProcess({ ...job.payload, source: job.source || "jobs" });
    } else {
      throw new Error(`Unknown job kind: ${job.kind}`);
    }

    if (handle.abort) throw new Error("Cancelled");

    job.progress = 100;
    job.durationMs = Date.now() - started;
    job.finishedAt = new Date().toISOString();
    job.result = {
      ok: result?.ok !== false,
      message: String(result?.message || (result?.ok === false ? result?.error : "OK")).slice(0, 400),
      error: result?.ok === false ? String(result?.error || "Failed").slice(0, 400) : null,
    };

    if (result?.ok === false) {
      job.status = "failed";
      job.error = job.result.error;
    } else {
      job.status = "succeeded";
      job.error = null;
    }

    const capacity = store.normalizeCapacity(state.capacity);
    if (capacity.dailyBudgetSeconds > 0 && jobPool(job, capacity) === "background") {
      capacity.usedBudgetSecondsToday += Math.max(1, Math.ceil(job.durationMs / 1000));
      state.capacity = capacity;
    }

    notifyDone(job);
  } catch (err) {
    job.durationMs = Date.now() - started;
    job.finishedAt = new Date().toISOString();
    if (handle.abort || /cancelled/i.test(err?.message || "")) {
      job.status = "cancelled";
      job.error = "Cancelled";
    } else {
      job.status = "failed";
      job.error = String(err?.message || err).slice(0, 400);
      reportRuntimeFailure("jobs", "JOB_RUN_FAILED", err, {
        jobId: job.id,
        kind: job.kind,
        title: job.title,
        source: job.source,
      });
    }
    job.result = { ok: false, message: job.error, error: job.error };
    if (job.status === "failed") notifyDone(job);
  } finally {
    running.delete(job.id);
    persist();
  }
}

function notifyDone(job) {
  const capacity = store.normalizeCapacity(state.capacity);
  if (!capacity.notifyOnDone) return;
  const pool = jobPool(job, capacity);
  if (job.status === "succeeded" && pool !== "background") return;

  const ok = job.status === "succeeded";
  pushNotification(
    {
      appId: "jobs",
      type: ok ? "success" : "error",
      title: ok ? `Job done · ${job.title}` : `Job failed · ${job.title}`,
      body: job.result?.message || job.error || job.kind,
      priority: ok ? "normal" : "high",
      dedupeKey: `jobs-done-${job.id}`,
      route: { kind: "jobs", tab: "queue" },
    },
    { showOs: true }
  );
}

async function tick() {
  const recovered = recoverStaleRunning({ maxAgeMs: 45000 });
  if (recovered) {
    pruneJobHistory();
    persist();
  }
  const capacity = store.normalizeCapacity(state.capacity);
  const queued = state.jobs
    .filter((j) => j.status === "queued")
    .sort((a, b) => {
      const poolRank = (j) => {
        const p = jobPool(j, capacity);
        if (p === "connect") return 0;
        if (p === "interactive") return 1;
        if (p === "shell") return 2;
        return 3;
      };
      const pr = poolRank(a) - poolRank(b);
      if (pr) return pr;
      if (a.priority === "high" && b.priority !== "high") return -1;
      if (b.priority === "high" && a.priority !== "high") return 1;
      if (a.priority === "low" && b.priority !== "low") return 1;
      if (b.priority === "low" && a.priority !== "low") return -1;
      return String(a.createdAt).localeCompare(String(b.createdAt));
    });

  for (const job of queued) {
    if (!canStartJob(job, capacity)) continue;
    void runJob(job);
  }
}

function startJobsService() {
  if (timer) return;
  state = store.load();
  const capacity = store.normalizeCapacity(state.capacity);
  for (const job of state.jobs) {
    if (!job.pool) job.pool = resolvePool(job, capacity);
    if (job.status === "running" || job.status === "queued") {
      const wasQueued = job.status === "queued";
      job.status = wasQueued ? "cancelled" : "failed";
      job.error = wasQueued
        ? "Cancelled: My Space restarted before start"
        : "Interrupted: My Space restarted";
      job.finishedAt = new Date().toISOString();
      job.result = { ok: false, message: job.error, error: job.error };
    }
  }
  state.capacity = capacity;
  pruneJobHistory();
  persist();
  timer = setInterval(() => {
    void tick();
  }, 500);
  void tick();
}

function stopJobsService() {
  if (timer) clearInterval(timer);
  timer = null;
}

function reloadForProfileSwitch() {
  for (const job of state.jobs || []) {
    if (job.status === "running" || job.status === "queued") {
      job.status = "cancelled";
      job.error = "Cancelled: My Space account changed";
      job.finishedAt = new Date().toISOString();
      job.result = { ok: false, message: job.error, error: job.error };
    }
  }
  try {
    persist();
  } catch {
  }
  state = store.load();
  return { ok: true, jobs: (state.jobs || []).length };
}
module.exports = {
  startJobsService,
  stopJobsService,
  reloadForProfileSwitch,
  snapshot,
  enqueue,
  runActivity,
  cancel,
  retry,
  clearFinished,
  list,
  get,
  getCapacity,
  setCapacity,
  tick,
};