(function (root) {
  let cache = null;

  const DEFAULT_MEETING_PLANNER = {
    participants: [],
    durationMin: 60,
    workStart: 9,
    workEnd: 17,
    defaultTitle: "Meeting",
    scheduled: [],
  };

  const DEFAULT_POMODORO = {
    settings: {
      workMin: 25,
      shortBreakMin: 5,
      longBreakMin: 15,
      longEvery: 4,
      autoStartBreaks: true,
      autoStartWork: true,
    },
    stats: { date: new Date().toISOString().slice(0, 10), completed: 0 },
  };

  async function load() {
    if (!window.myApp) return { favorites: [], pomodoro: DEFAULT_POMODORO };
    const res = await window.myApp.invoke("storage.load", {});
    if (res?.ok && res.data) {
      cache = res.data;
      if (!cache.pomodoro) cache.pomodoro = DEFAULT_POMODORO;
      return cache;
    }
    return { favorites: [], pomodoro: DEFAULT_POMODORO };
  }

  async function save(data) {
    cache = data;
    if (!window.myApp) return;
    await window.myApp.invoke("storage.save", { data });
  }

  async function getFavorites() {
    const data = cache || (await load());
    return data.favorites || [];
  }

  async function addFavorite(entry) {
    const data = cache || (await load());
    const favs = data.favorites || [];
    if (favs.some((f) => f.timezone === entry.timezone)) return favs;
    favs.push(entry);
    data.favorites = favs;
    await save(data);
    return favs;
  }

  async function removeFavorite(timezone) {
    const data = cache || (await load());
    data.favorites = (data.favorites || []).filter((f) => f.timezone !== timezone);
    await save(data);
    return data.favorites;
  }

  async function getPomodoro() {
    const data = cache || (await load());
    return data.pomodoro || DEFAULT_POMODORO;
  }

  async function savePomodoro(pomodoro) {
    const data = cache || (await load());
    data.pomodoro = pomodoro;
    await save(data);
    return data.pomodoro;
  }

  function normalizeMeetingPlanner(raw) {
    const MP = root.ClockMeetingPlanner;
    if (!MP) return { ...DEFAULT_MEETING_PLANNER };
    const participants = Array.isArray(raw?.participants)
      ? raw.participants.map((p) => MP.normalizeParticipant(p)).filter(Boolean)
      : [];
    return {
      participants,
      durationMin: clampMin(raw?.durationMin, 60, 15, 240),
      workStart: clampMin(raw?.workStart, 9, 0, 23),
      workEnd: clampMin(raw?.workEnd, 17, 1, 24),
      defaultTitle:
        typeof raw?.defaultTitle === "string" && raw.defaultTitle.trim()
          ? raw.defaultTitle.trim().slice(0, 120)
          : "Meeting",
      scheduled: Array.isArray(raw?.scheduled) ? raw.scheduled : [],
    };
  }

  function clampMin(val, fallback, min, max) {
    const n = parseInt(val, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  async function getMeetingPlanner() {
    const data = cache || (await load());
    return normalizeMeetingPlanner(data.meetingPlanner);
  }

  async function saveMeetingPlanner(planner) {
    const data = cache || (await load());
    data.meetingPlanner = normalizeMeetingPlanner(planner);
    await save(data);
    return data.meetingPlanner;
  }

  async function getTimer() {
    const data = cache || (await load());
    return data.timer || null;
  }

  async function saveTimer(timer) {
    const data = cache || (await load());
    data.timer = timer;
    await save(data);
    return data.timer;
  }

  async function clearTimer() {
    const data = cache || (await load());
    data.timer = null;
    await save(data);
  }

  async function getStopwatch() {
    const data = cache || (await load());
    return data.stopwatch || null;
  }

  async function saveStopwatch(stopwatch) {
    const data = cache || (await load());
    data.stopwatch = stopwatch;
    await save(data);
    return data.stopwatch;
  }

  async function clearStopwatch() {
    const data = cache || (await load());
    data.stopwatch = null;
    await save(data);
  }

  async function consumePomodoroPendingStart() {
    const data = cache || (await load());
    const pending = Boolean(data.pomodoro?.pendingStart);
    if (pending) {
      data.pomodoro.pendingStart = false;
      await save(data);
    }
    return pending;
  }

  async function consumePomodoroPendingPause() {
    const data = cache || (await load());
    const pending = Boolean(data.pomodoro?.pendingPause);
    if (pending) {
      data.pomodoro.pendingPause = false;
      await save(data);
    }
    return pending;
  }

  root.ClockStorage = {
    load,
    save,
    getFavorites,
    addFavorite,
    removeFavorite,
    getPomodoro,
    savePomodoro,
    getMeetingPlanner,
    saveMeetingPlanner,
    getTimer,
    saveTimer,
    clearTimer,
    getStopwatch,
    saveStopwatch,
    clearStopwatch,
    consumePomodoroPendingStart,
    consumePomodoroPendingPause,
  };
})(window);
