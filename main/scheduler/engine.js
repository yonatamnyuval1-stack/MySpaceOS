const { BrowserWindow } = require("electron");
const store = require("./store");

let state = store.defaultState();
let timer = null;
let ticking = false;
const firing = new Set();

function broadcast() {
  const payload = snapshot();
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      win.webContents.send("scheduler-updated", payload);
    } catch {
    }
  }
}

function persist() {
  state = store.save(state);
  broadcast();
  return { ok: true, ...snapshot() };
}

function snapshot() {
  const schedules = state.schedules || [];
  const active = schedules.filter((s) => s.enabled);
  const paused = schedules.filter((s) => !s.enabled);
  const next =
    active
      .map((s) => s.nextRunAt)
      .filter(Boolean)
      .sort()[0] || null;
  return {
    ok: true,
    schedules,
    history: state.history || [],
    stats: {
      total: schedules.length,
      active: active.length,
      paused: paused.length,
      nextRunAt: next,
      historyCount: (state.history || []).length,
    },
    updatedAt: state.updatedAt,
  };
}

function findSchedule(id) {
  return (state.schedules || []).find((s) => s.id === id) || null;
}

function parseDurationToken(token) {
  const m = String(token || "")
    .trim()
    .toLowerCase()
    .match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = m[2];
  const mult = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
  return Math.max(5_000, Math.round(n * mult));
}

function nextDailyAt(timeHHMM, from = new Date()) {
  const [hh, mm] = String(timeHHMM)
    .split(":")
    .map((n) => Number(n));
  const d = new Date(from.getTime());
  d.setSeconds(0, 0);
  d.setHours(hh, mm, 0, 0);
  if (d.getTime() <= from.getTime()) d.setDate(d.getDate() + 1);
  return d.toISOString();
}

function computeNextRun(trigger, from = new Date()) {
  if (!trigger) return null;
  if (trigger.type === "interval") {
    return new Date(from.getTime() + trigger.everyMs).toISOString();
  }
  if (trigger.type === "daily") {
    return nextDailyAt(trigger.time, from);
  }
  if (trigger.type === "once") {
    const t = Date.parse(trigger.at);
    if (Number.isNaN(t)) return null;
    return t > from.getTime() ? new Date(t).toISOString() : null;
  }
  return null;
}

function describeTrigger(trigger) {
  if (!trigger) return "";
  if (trigger.type === "interval") {
    const ms = trigger.everyMs;
    if (ms % 86_400_000 === 0) return `every ${ms / 86_400_000}d`;
    if (ms % 3_600_000 === 0) return `every ${ms / 3_600_000}h`;
    if (ms % 60_000 === 0) return `every ${ms / 60_000}m`;
    if (ms % 1000 === 0) return `every ${ms / 1000}s`;
    return `every ${ms}ms`;
  }
  if (trigger.type === "daily") return `daily ${trigger.time}`;
  if (trigger.type === "once") return `at ${trigger.at}`;
  return trigger.type;
}

function describeAction(action) {
  if (!action) return "";
  if (action.kind === "script") return `script ${action.scriptName || action.scriptId}`;
  return action.command || "";
}

function parseAddSpec(raw) {
  const text = String(raw || "").trim();
  if (!text) return { ok: false, error: "Usage: schedule(add every 1h <command>)" };

  let rest = text;
  let title = null;
  const titleMatch =
    rest.match(/^(?:as|title)\s+"([^"]+)"\s+/i) || rest.match(/^(?:as|title)\s+(\S+)\s+/i);
  if (titleMatch) {
    title = titleMatch[1];
    rest = rest.slice(titleMatch[0].length).trim();
  }

  let via = "jobs";
  if (/^via\s+direct\s+/i.test(rest)) {
    via = "direct";
    rest = rest.replace(/^via\s+direct\s+/i, "").trim();
  } else if (/^via\s+jobs\s+/i.test(rest)) {
    via = "jobs";
    rest = rest.replace(/^via\s+jobs\s+/i, "").trim();
  }

  let trigger = null;
  let actionText = "";

  const every = rest.match(/^every\s+(\S+)\s+(.+)$/i);
  if (every) {
    const everyMs = parseDurationToken(every[1]);
    if (!everyMs) return { ok: false, error: "Bad interval: use every 15m | 1h | 1d" };
    trigger = { type: "interval", everyMs };
    actionText = every[2].trim();
  }

  if (!trigger) {
    const daily = rest.match(/^daily\s+(\d{1,2}:\d{2})\s+(.+)$/i);
    if (daily) {
      trigger = { type: "daily", time: daily[1] };
      actionText = daily[2].trim();
    }
  }

  if (!trigger) {
    const inM = rest.match(/^in\s+(\S+)\s+(.+)$/i);
    if (inM) {
      const ms = parseDurationToken(inM[1]);
      if (!ms) return { ok: false, error: "Bad delay: use in 30m | 1h" };
      trigger = { type: "once", at: new Date(Date.now() + ms).toISOString() };
      actionText = inM[2].trim();
    }
  }

  if (!trigger) {
    const atM = rest.match(/^at\s+(\S+)\s+(.+)$/i);
    if (atM) {
      const parsed = Date.parse(atM[1]);
      if (Number.isNaN(parsed)) return { ok: false, error: "Bad at time: use ISO datetime" };
      trigger = { type: "once", at: new Date(parsed).toISOString() };
      actionText = atM[2].trim();
    }
  }

  if (!trigger || !actionText) {
    return {
      ok: false,
      error:
        "Usage: schedule(add every 1h <cmd>) · schedule(add daily 02:00 <cmd>) · schedule(add in 30m <cmd>) · schedule(add at <iso> <cmd>)",
    };
  }

  let action;
  const scriptMatch = actionText.match(/^scripts?\(\s*run\s+(.+?)\s*\)$/i);
  if (scriptMatch) {
    action = { kind: "script", scriptName: scriptMatch[1].replace(/^["']|["']$/g, "").trim() };
  } else {
    action = { kind: "shell", command: actionText };
  }

  return {
    ok: true,
    title: title || describeAction(action).slice(0, 80),
    trigger,
    action,
    via,
  };
}

function add(args = {}, source = "desktop") {
  let spec = args;
  if (typeof args === "string" || args.spec || args.text) {
    const parsed = parseAddSpec(typeof args === "string" ? args : args.spec || args.text);
    if (!parsed.ok) return parsed;
    spec = { ...parsed, title: args.title || parsed.title, via: args.via || parsed.via };
  }

  if ((state.schedules || []).length >= store.SCHEDULE_LIMIT) {
    return { ok: false, error: `Schedule limit (${store.SCHEDULE_LIMIT}) reached` };
  }

  const trigger = store.normalizeTrigger(spec.trigger);
  const action = store.normalizeAction(spec.action);
  if (!trigger || !action) return { ok: false, error: "Invalid trigger or action" };

  const now = new Date();
  let nextRunAt = null;
  if (trigger.type === "once") {
    nextRunAt = trigger.at;
  } else if (trigger.type === "interval") {
    nextRunAt = computeNextRun(trigger, now);
  } else if (trigger.type === "daily") {
    nextRunAt = nextDailyAt(trigger.time, now);
  }

  const schedule = store.normalizeSchedule({
    id: store.uid(),
    title: spec.title || describeAction(action),
    enabled: true,
    status: "active",
    trigger,
    action,
    via: spec.via,
    nextRunAt,
    runCount: 0,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    source: source || spec.source || "desktop",
  });

  state.schedules = [schedule, ...(state.schedules || [])];
  persist();
  return { ok: true, schedule, ...snapshot() };
}

function list(args = {}) {
  const status = String(args.status || args.filter || "")
    .trim()
    .toLowerCase();
  let schedules = state.schedules || [];
  if (status === "active" || status === "enabled") {
    schedules = schedules.filter((s) => s.enabled);
  } else if (status === "paused" || status === "disabled") {
    schedules = schedules.filter((s) => !s.enabled);
  }
  const q = String(args.q || args.query || "")
    .trim()
    .toLowerCase();
  if (q) {
    schedules = schedules.filter((s) =>
      `${s.title} ${describeTrigger(s.trigger)} ${describeAction(s.action)} ${s.id}`
        .toLowerCase()
        .includes(q)
    );
  }
  const limit = Math.max(1, Math.min(300, Number(args.limit) || 100));
  return { ok: true, schedules: schedules.slice(0, limit), ...snapshot() };
}

function get(args = {}) {
  const schedule = findSchedule(String(args.id || "").trim());
  if (!schedule) return { ok: false, error: "Schedule not found" };
  return { ok: true, schedule };
}

function setEnabled(id, enabled) {
  const schedule = findSchedule(String(id || "").trim());
  if (!schedule) return { ok: false, error: "Schedule not found" };
  schedule.enabled = !!enabled;
  schedule.status = enabled ? "active" : "paused";
  schedule.updatedAt = new Date().toISOString();
  if (enabled && !schedule.nextRunAt) {
    schedule.nextRunAt = computeNextRun(schedule.trigger, new Date());
  }
  persist();
  return { ok: true, schedule, ...snapshot() };
}

function pause(args = {}) {
  return setEnabled(args.id, false);
}

function resume(args = {}) {
  return setEnabled(args.id, true);
}

function remove(args = {}) {
  const id = String(args.id || "").trim();
  if (!id) return { ok: false, error: "Missing id" };
  const before = state.schedules.length;
  state.schedules = (state.schedules || []).filter((s) => s.id !== id);
  if (state.schedules.length === before) return { ok: false, error: "Schedule not found" };
  persist();
  return { ok: true, removed: id, ...snapshot() };
}

function clearHistory() {
  state.history = [];
  return persist();
}

function pushHistory(entry) {
  const row = store.normalizeHistoryEntry(entry);
  if (!row) return;
  state.history = [row, ...(state.history || [])].slice(0, store.HISTORY_LIMIT);
}

async function executeAction(schedule) {
  const action = schedule.action;
  const title = schedule.title || describeAction(action);
  const via = schedule.via || "jobs";

  if (via === "jobs") {
    try {
      const { handleJobsInvoke } = require("../jobs/broker");
      const payload =
        action.kind === "script"
          ? {
              kind: "script",
              title: `Schedule · ${title}`,
              scriptName: action.scriptName,
              scriptId: action.scriptId,
              source: "scheduler",
              priority: "normal",
            }
          : {
              kind: "shell",
              title: `Schedule · ${title}`,
              command: action.command,
              source: "scheduler",
              priority: "normal",
            };
      const res = await handleJobsInvoke("scheduler", "jobs.enqueue", payload);
      if (res?.ok === false) {
        return { ok: false, error: res.error || "Jobs enqueue failed", jobId: null };
      }
      const jobId = res?.job?.id || null;
      const label =
        action.kind === "script"
          ? `Enqueued script · ${action.scriptName || action.scriptId}`
          : `Enqueued · ${action.command}`;
      return { ok: true, message: label, jobId };
    } catch {
    }
  }

  const { executeInRenderer, executeProgramInRenderer } = require("../apps/shell-console-ipc");
  if (action.kind === "script") {
    const { handleScriptsInvoke } = require("../apps/scripts-ipc");
    const got = await handleScriptsInvoke("scripts.get", {
      id: action.scriptId,
      name: action.scriptName,
    });
    if (!got?.ok || !got.script) return { ok: false, error: got?.error || "Script not found" };
    const res = await executeProgramInRenderer(got.script.body, "scheduler");
    return {
      ok: res?.ok !== false,
      message: res?.message || (res?.ok === false ? res.error : `Ran script · ${got.script.name}`),
      error: res?.ok === false ? res.error : undefined,
    };
  }
  const res = await executeInRenderer(action.command, "scheduler");
  return {
    ok: res?.ok !== false,
    message: res?.message || action.command,
    error: res?.ok === false ? res.error : undefined,
  };
}

async function fireSchedule(schedule, { manual = false } = {}) {
  if (!schedule || firing.has(schedule.id)) return { ok: false, error: "Already firing" };
  firing.add(schedule.id);
  const now = new Date();
  try {
    const result = await executeAction(schedule);
    schedule.lastRunAt = now.toISOString();
    schedule.runCount = (schedule.runCount || 0) + 1;
    schedule.lastResult = {
      ok: result.ok !== false,
      message: result.message || result.error || "",
      jobId: result.jobId || null,
      at: schedule.lastRunAt,
    };
    pushHistory({
      scheduleId: schedule.id,
      title: schedule.title,
      at: schedule.lastRunAt,
      ok: result.ok !== false,
      message: result.message || result.error || "",
      jobId: result.jobId || null,
    });

    if (schedule.trigger.type === "once") {
      schedule.enabled = false;
      schedule.status = result.ok !== false ? "done" : "failed";
      schedule.nextRunAt = null;
    } else if (schedule.enabled) {
      schedule.nextRunAt = computeNextRun(schedule.trigger, now);
    }
    schedule.updatedAt = now.toISOString();
    persist();
    return { ok: true, schedule, result, manual };
  } catch (err) {
    schedule.lastRunAt = now.toISOString();
    schedule.lastResult = {
      ok: false,
      message: String(err?.message || err),
      at: schedule.lastRunAt,
    };
    pushHistory({
      scheduleId: schedule.id,
      title: schedule.title,
      at: schedule.lastRunAt,
      ok: false,
      message: String(err?.message || err),
    });
    if (schedule.trigger.type === "once") {
      schedule.enabled = false;
      schedule.status = "failed";
      schedule.nextRunAt = null;
    } else if (schedule.enabled) {
      schedule.nextRunAt = computeNextRun(schedule.trigger, now);
    }
    schedule.updatedAt = now.toISOString();
    persist();
    return { ok: false, error: String(err?.message || err), schedule };
  } finally {
    firing.delete(schedule.id);
  }
}

function runNow(args = {}) {
  const schedule = findSchedule(String(args.id || "").trim());
  if (!schedule) return Promise.resolve({ ok: false, error: "Schedule not found" });
  return fireSchedule(schedule, { manual: true });
}

async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    const now = Date.now();
    const due = (state.schedules || []).filter(
      (s) => s.enabled && s.nextRunAt && Date.parse(s.nextRunAt) <= now && !firing.has(s.id)
    );
    for (const schedule of due.slice(0, 5)) {
      await fireSchedule(schedule);
    }
  } finally {
    ticking = false;
  }
}

function startSchedulerService() {
  state = store.load();
  const now = new Date();
  for (const s of state.schedules || []) {
    if (!s.enabled) continue;
    if (s.trigger?.type === "once") {
      const t = Date.parse(s.trigger.at || s.nextRunAt || "");
      if (!Number.isNaN(t) && t <= now.getTime()) {
        s.enabled = false;
        s.status = "missed";
        s.nextRunAt = null;
        s.lastResult = {
          ok: false,
          message: "Missed while My Space was closed",
          at: now.toISOString(),
        };
      }
    } else if (!s.nextRunAt || Date.parse(s.nextRunAt) <= now.getTime() - 60_000) {
      s.nextRunAt = computeNextRun(s.trigger, now);
    }
  }
  state = store.save(state);
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    void tick();
  }, 1000);
  void tick();
  return snapshot();
}

function stopSchedulerService() {
  if (timer) clearInterval(timer);
  timer = null;
}

function reloadForProfileSwitch() {
  firing.clear();
  state = store.load();
  broadcast();
  return { ok: true, schedules: (state.schedules || []).length };
}

module.exports = {
  startSchedulerService,
  stopSchedulerService,
  reloadForProfileSwitch,
  snapshot,
  list,
  get,
  add,
  pause,
  resume,
  remove,
  runNow,
  clearHistory,
  parseAddSpec,
  describeTrigger,
  describeAction,
  tick,
};