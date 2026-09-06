const path = require("path");
const fs = require("fs");
const { app, Notification, shell } = require("electron");
const {
  setupLocalAuthApp,
  requireSignedIn,
  registerSingleFileMigrator,
} = require("./local-auth-app-helper");

const APP_ID = "world-clock";
const auth = setupLocalAuthApp(APP_ID);
registerSingleFileMigrator(APP_ID, "world-clock.json");

function dataPath() {
  return auth.userDataPath("data.json");
}

function signedInGuard() {
  return requireSignedIn(auth);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

const DEFAULT_POMODORO = {
  settings: {
    workMin: 25,
    shortBreakMin: 5,
    longBreakMin: 15,
    longEvery: 4,
    autoStartBreaks: true,
    autoStartWork: true,
  },
  stats: {
    date: todayKey(),
    completed: 0,
  },
};

function clampMin(val, fallback, min, max) {
  const n = parseInt(val, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizePomodoro(raw) {
  const s = raw?.settings || {};
  const st = raw?.stats || {};
  const date = typeof st.date === "string" ? st.date : todayKey();
  let completed = Math.max(0, parseInt(st.completed, 10) || 0);
  if (date !== todayKey()) completed = 0;
  return {
    settings: {
      workMin: clampMin(s.workMin, 25, 1, 120),
      shortBreakMin: clampMin(s.shortBreakMin, 5, 1, 60),
      longBreakMin: clampMin(s.longBreakMin, 15, 1, 60),
      longEvery: clampMin(s.longEvery, 4, 2, 12),
      autoStartBreaks: s.autoStartBreaks !== false,
      autoStartWork: s.autoStartWork !== false,
    },
    stats: { date: todayKey(), completed },
    pendingStart: Boolean(raw?.pendingStart),
    pendingPause: Boolean(raw?.pendingPause),
    updatedAt: raw?.updatedAt || 0,
  };
}

function normalizeMeetingPlanner(raw) {
  const participants = Array.isArray(raw?.participants) ? raw.participants : [];
  return {
    participants: participants
      .filter((p) => p && typeof p.timezone === "string" && p.timezone.length > 0)
      .slice(0, 8)
      .map((p) => {
        const workStart = clampMin(p.workStart, 9, 0, 23);
        let workEnd = clampMin(p.workEnd, 17, 0, 23);
        if (workEnd <= workStart) workEnd = Math.min(23, workStart + 1);
        const workDays = Array.isArray(p.workDays)
          ? p.workDays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
          : [1, 2, 3, 4, 5];
        return {
          id: String(p.id || p.timezone),
          timezone: p.timezone,
          label: String(p.label || p.timezone),
          workStart,
          workEnd,
          workDays: workDays.length ? workDays : [1, 2, 3, 4, 5],
        };
      }),
    durationMin: clampMin(raw?.durationMin, 60, 15, 240),
    workStart: clampMin(raw?.workStart, 9, 0, 23),
    workEnd: clampMin(raw?.workEnd, 17, 1, 24),
    defaultTitle: typeof raw?.defaultTitle === "string" ? raw.defaultTitle.slice(0, 120) : "Meeting",
    scheduled: Array.isArray(raw?.scheduled)
      ? raw.scheduled
          .filter((e) => e && e.start)
          .slice(0, 50)
          .map((e) => ({
            id: String(e.id || `mtg_${Date.now()}`),
            title: String(e.title || "Meeting").slice(0, 120),
            start: String(e.start),
            durationMin: clampMin(e.durationMin, 60, 15, 240),
            dateStr: String(e.dateStr || ""),
          }))
      : [],
  };
}

function normalizeTimer(raw) {
  if (!raw || typeof raw !== "object") return null;
  const totalSec = Math.max(0, parseInt(raw.totalSec, 10) || 0);
  if (totalSec <= 0 && !raw.updatedAt) return null;
  return {
    totalSec,
    remainingSec: Math.max(0, parseInt(raw.remainingSec, 10) || totalSec),
    label: String(raw.label || "Timer").slice(0, 80),
    running: Boolean(raw.running),
    endAt: Number(raw.endAt) || 0,
    updatedAt: Number(raw.updatedAt) || 0,
  };
}

function normalizeStopwatch(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    running: Boolean(raw.running),
    elapsed: Math.max(0, Number(raw.elapsed) || 0),
    startTime: Number(raw.startTime) || 0,
    laps: Array.isArray(raw.laps) ? raw.laps : [],
    updatedAt: Number(raw.updatedAt) || 0,
  };
}

function normalizeStorage(raw) {
  const favorites = Array.isArray(raw?.favorites) ? raw.favorites : [];
  return {
    favorites: favorites
      .filter((f) => f && typeof f.timezone === "string" && f.timezone.length > 0)
      .map((f) => ({
        id: String(f.id || f.timezone),
        timezone: f.timezone,
        label: String(f.label || f.timezone),
        country: f.country ? String(f.country) : "",
      })),
    pomodoro: normalizePomodoro(raw?.pomodoro || DEFAULT_POMODORO),
    meetingPlanner: normalizeMeetingPlanner(raw?.meetingPlanner),
    timer: normalizeTimer(raw?.timer),
    stopwatch: normalizeStopwatch(raw?.stopwatch),
  };
}

async function loadStorage() {
  try {
    const raw = await fs.promises.readFile(dataPath(), "utf8");
    const data = JSON.parse(raw);
    return { ok: true, data: normalizeStorage(data) };
  } catch (err) {
    if (err && err.code === "ENOENT") {
      return { ok: true, data: normalizeStorage({ favorites: [] }) };
    }
    return { ok: false, error: err.message || "Failed to load" };
  }
}

async function loadStorageSync() {
  return loadStorage();
}

async function saveStorage(args) {
  const payload = normalizeStorage(args?.data ?? args);
  await fs.promises.mkdir(path.dirname(dataPath()), { recursive: true });
  await fs.promises.writeFile(dataPath(), JSON.stringify(payload, null, 2), "utf8");
  return { ok: true };
}

async function saveStorageData(data) {
  return saveStorage({ data });
}

function notify(args) {
  const title = String(args?.title || "Timer finished");
  const body = String(args?.body || "Your timer has ended.");
  const kind = String(args?.kind || "info");
  const inbox = kind === "timer" || kind === "pomodoro";
  const page = kind === "pomodoro" ? "pomodoro" : "timer";
  const bypassFocus = args?.bypassFocus !== false && inbox;

  if (inbox) {
    try {
      const { push } = require("./notifications-center");
      push(
        {
          appId: "world-clock",
          type: kind,
          title,
          body,
          dedupeKey: args?.dedupeKey || `clock:${kind}`,
          route: { page },
          priority: "high",
        },
        { showOs: true, bypassFocus }
      );
      return { ok: true };
    } catch {
    }
  }

  try {
    const { allowNotify } = require("./focus-gate");
    if (!allowNotify({ bypassFocus })) {
      return { ok: true, silenced: true };
    }
  } catch {
  }
  if (Notification.isSupported()) {
    new Notification({ title, body, silent: false }).show();
  }
  return { ok: true };
}

function formatDuration(sec) {
  const n = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function resolveDurationSec(args = {}) {
  const hours = Number(args.hours);
  const minutes = Number(args.minutes);
  const seconds = Number(args.seconds);
  const safeHours = Number.isFinite(hours) && hours > 0 ? hours : 0;
  const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
  const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  let totalSec = Math.round(safeHours * 3600 + safeMinutes * 60 + safeSeconds);
  if ((!Number.isFinite(totalSec) || totalSec <= 0) && args.durationSec != null) {
    const d = Number(args.durationSec);
    if (Number.isFinite(d) && d > 0) totalSec = Math.round(d);
  }
  if (!Number.isFinite(totalSec) || totalSec <= 0) return null;
  return Math.min(totalSec, 24 * 3600);
}

async function mutateStorage(mutator) {
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  const data = normalizeStorage(loaded.data);
  const result = mutator(data);
  if (result?.ok === false) return result;
  const saved = await saveStorageData(data);
  if (!saved.ok) return saved;
  return result || { ok: true, data };
}

async function timerStart(args = {}) {
  const totalSec = resolveDurationSec(args);
  if (!totalSec) {
    return { ok: false, error: "Provide a positive duration" };
  }
  const label = String(args.label || "Timer").slice(0, 80);
  const autoStart = args.autoStart !== false;
  return mutateStorage((data) => {
    data.timer = {
      totalSec,
      remainingSec: totalSec,
      label,
      running: autoStart,
      endAt: autoStart ? Date.now() + totalSec * 1000 : 0,
      updatedAt: Date.now(),
    };
    return {
      ok: true,
      kind: "timer",
      totalSec,
      label,
      running: autoStart,
      display: formatDuration(totalSec),
      page: "timer",
    };
  });
}

async function timerPause() {
  return mutateStorage((data) => {
    const t = data.timer;
    if (!t?.totalSec) return { ok: false, error: "No timer set" };
    if (t.running && t.endAt) {
      t.remainingSec = Math.max(0, Math.ceil((t.endAt - Date.now()) / 1000));
    }
    t.running = false;
    t.endAt = 0;
    t.updatedAt = Date.now();
    return {
      ok: true,
      kind: "timer",
      paused: true,
      remainingSec: t.remainingSec,
      display: formatDuration(t.remainingSec),
      page: "timer",
    };
  });
}

async function timerStop() {
  return mutateStorage((data) => {
    const t = data.timer;
    if (!t?.totalSec) return { ok: false, error: "No timer set" };
    t.running = false;
    t.endAt = 0;
    t.remainingSec = t.totalSec;
    t.updatedAt = Date.now();
    return {
      ok: true,
      kind: "timer",
      stopped: true,
      totalSec: t.totalSec,
      display: formatDuration(t.totalSec),
      page: "timer",
    };
  });
}

async function timerStatus() {
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  const t = loaded.data.timer;
  if (!t?.totalSec) return { ok: true, kind: "timer", empty: true, message: "No timer set" };
  let remainingSec = t.remainingSec;
  if (t.running && t.endAt) {
    remainingSec = Math.max(0, Math.ceil((t.endAt - Date.now()) / 1000));
  }
  return {
    ok: true,
    kind: "timer",
    label: t.label,
    totalSec: t.totalSec,
    remainingSec,
    running: Boolean(t.running && remainingSec > 0),
    display: formatDuration(remainingSec),
  };
}

async function pomodoroStart(args = {}) {
  return mutateStorage((data) => {
    const s = data.pomodoro.settings;
    if (args.workMin != null) s.workMin = clampMin(args.workMin, s.workMin, 1, 120);
    if (args.shortBreakMin != null) s.shortBreakMin = clampMin(args.shortBreakMin, s.shortBreakMin, 1, 60);
    if (args.longBreakMin != null) s.longBreakMin = clampMin(args.longBreakMin, s.longBreakMin, 1, 60);
    if (args.longEvery != null) s.longEvery = clampMin(args.longEvery, s.longEvery, 2, 12);
    data.pomodoro.pendingStart = args.autoStart !== false;
    data.pomodoro.pendingPause = false;
    data.pomodoro.updatedAt = Date.now();
    return {
      ok: true,
      kind: "pomodoro",
      settings: { ...s },
      autoStart: data.pomodoro.pendingStart,
      page: "pomodoro",
    };
  });
}

async function pomodoroPause() {
  return mutateStorage((data) => {
    data.pomodoro.pendingStart = false;
    data.pomodoro.pendingPause = true;
    data.pomodoro.updatedAt = Date.now();
    return { ok: true, kind: "pomodoro", paused: true, page: "pomodoro" };
  });
}

async function stopwatchStart(args = {}) {
  const autoStart = args.autoStart !== false;
  return mutateStorage((data) => {
    data.stopwatch = {
      running: autoStart,
      elapsed: 0,
      startTime: autoStart ? Date.now() : 0,
      laps: [],
      updatedAt: Date.now(),
    };
    return { ok: true, kind: "stopwatch", running: autoStart, page: "stopwatch" };
  });
}

let timerWatch = null;

function startWorldClockTimerService() {
  if (timerWatch) return;
  const tick = async () => {
    try {
      const loaded = await loadStorage();
      if (!loaded.ok) return;
      const t = loaded.data.timer;
      if (!t?.running || !t.endAt) return;
      if (Date.now() < t.endAt) return;
      const label = t.label || "Timer";
      notify({
        title: "Timer finished",
        body: `${label} has ended.`,
        kind: "timer",
        dedupeKey: `clock:timer`,
        bypassFocus: true,
      });
      t.running = false;
      t.remainingSec = 0;
      t.endAt = 0;
      t.updatedAt = Date.now();
      await saveStorage({ data: loaded.data });
    } catch {
    }
  };
  tick();
  timerWatch = setInterval(tick, 10000);
}

function focusEnter(args) {
  const focusGate = require("./focus-gate");
  return focusGate.enter({
    source: args?.source || "pomodoro",
    silenceNotifications: args?.silenceNotifications !== false,
    desktopOnly: args?.desktopOnly !== false,
  });
}

function focusExit() {
  return require("./focus-gate").exit();
}

async function openUrl(args) {
  const url = String(args?.url || "").trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return { ok: false, error: "Invalid URL" };
  }
  await shell.openExternal(url);
  return { ok: true };
}

const CHANNELS = {
  "storage.load": () => loadStorage(),
  "storage.save": (args) => saveStorage(args),
  notify: (args) => notify(args),
  "focus.enter": (args) => focusEnter(args),
  "focus.exit": () => focusExit(),
  "calendar.openUrl": (args) => openUrl(args),
  "timer.start": (args) => timerStart(args),
  "timer.pause": () => timerPause(),
  "timer.stop": () => timerStop(),
  "timer.status": () => timerStatus(),
  "pomodoro.start": (args) => pomodoroStart(args),
  "pomodoro.pause": () => pomodoroPause(),
  "stopwatch.start": (args) => stopwatchStart(args),
};

async function handleWorldClockInvoke(channel, args) {
  const authErr = signedInGuard();
  if (authErr) return authErr;
  const handler = CHANNELS[channel];
  if (!handler) return { ok: false, error: `Unknown channel: ${channel}` };
  try {
    return await handler(args);
  } catch (err) {
    return { ok: false, error: err.message || "Request failed" };
  }
}

module.exports = {
  handleWorldClockInvoke,
  loadStorage,
  loadStorageSync,
  saveStorage,
  saveStorageData,
  normalizeStorage,
  startWorldClockTimerService,
  notify,
  timerStart,
  timerPause,
  timerStop,
  timerStatus,
  pomodoroStart,
  pomodoroPause,
  stopwatchStart,
  formatDuration,
};