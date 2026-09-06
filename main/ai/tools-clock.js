const path = require("path");
const fs = require("fs");

function getStorageApi() {
  return require("../apps/world-clock-ipc");
}

let countryZones = null;

function getCountryZones() {
  if (countryZones) return countryZones;
  const file = path.join(__dirname, "country-zones.json");
  countryZones = JSON.parse(fs.readFileSync(file, "utf8"));
  return countryZones;
}

function normalizeQuery(q) {
  return String(q || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function zoneCityName(tz) {
  const part = String(tz || "").split("/").pop() || tz;
  return part.replace(/_/g, " ");
}

function searchPlaces(query, limit = 8) {
  const q = normalizeQuery(query);
  if (!q) return [];
  const results = [];
  const seen = new Set();
  const push = (item) => {
    const key = `${item.timezone}|${item.label}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push(item);
  };

  for (const entry of getCountryZones()) {
    if (results.length >= limit) break;
    const countryNorm = normalizeQuery(entry.country);
    const aliasNorm = (entry.aliases || []).map(normalizeQuery).join(" ");
    const hay = `${countryNorm} ${aliasNorm}`;
    if (!hay.includes(q) && !countryNorm.startsWith(q)) continue;
    for (const tz of entry.zones || []) {
      push({
        timezone: tz,
        label: entry.country,
        country: entry.country,
        city: zoneCityName(tz),
        kind: "country",
      });
    }
  }

  if (results.length < limit) {
    try {
      const all = Intl.supportedValuesOf("timeZone");
      for (const tz of all) {
        if (results.length >= limit) break;
        const city = zoneCityName(tz);
        const norm = normalizeQuery(`${tz} ${city} ${tz.replace(/\//g, " ")}`);
        if (norm.includes(q) || normalizeQuery(city).startsWith(q)) {
          push({
            timezone: tz,
            label: city,
            country: tz.split("/")[0],
            city,
            kind: "zone",
          });
        }
      }
    } catch {
    }
  }
  return results.slice(0, limit);
}

function formatInZone(date, timeZone, options) {
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone, ...options }).format(date);
  } catch {
    return null;
  }
}

function getOffsetLabel(date, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    }).formatToParts(date);
    return parts.find((p) => p.type === "timeZoneName")?.value || "";
  } catch {
    return "";
  }
}

function clockGetTime(args) {
  const place = String(args?.place || args?.country || args?.city || "").trim();
  if (!place) return { ok: false, error: "place is required" };
  const matches = searchPlaces(place, 5);
  if (!matches.length) return { ok: false, error: `No timezone found for "${place}"` };
  const now = new Date();
  const primary = matches[0];
  const time24 = formatInZone(now, primary.timezone, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const dateStr = formatInZone(now, primary.timezone, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return {
    ok: true,
    place: primary.label,
    city: primary.city,
    timezone: primary.timezone,
    time: time24,
    date: dateStr,
    offset: getOffsetLabel(now, primary.timezone),
    alternatives: matches.slice(1).map((m) => ({
      label: m.label,
      timezone: m.timezone,
      time: formatInZone(now, m.timezone, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    })),
  };
}

async function mutateStorage(mutator) {
  const { loadStorageSync, saveStorageData, normalizeStorage } = getStorageApi();
  const loaded = await loadStorageSync();
  if (!loaded.ok) return loaded;
  const data = normalizeStorage(loaded.data);
  const result = mutator(data);
  if (result?.ok === false) return result;
  const saved = await saveStorageData(data);
  if (!saved.ok) return saved;
  return result || { ok: true, data };
}

async function clockCreateTimer(args) {
  const minutes = Number(args?.minutes);
  const seconds = Number(args?.seconds);
  const hours = Number(args?.hours);
  const safeHours = Number.isFinite(hours) && hours > 0 ? hours : 0;
  const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
  const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  let totalSec = Math.round(safeHours * 3600 + safeMinutes * 60 + safeSeconds);
  if ((!Number.isFinite(totalSec) || totalSec <= 0) && args?.durationSec != null) {
    const d = Number(args.durationSec);
    if (Number.isFinite(d) && d > 0) totalSec = Math.round(d);
  }
  if (!Number.isFinite(totalSec) || totalSec <= 0) {
    return { ok: false, error: "Provide a positive duration (minutes/seconds/hours)" };
  }
  const label = String(args?.label || "Timer").slice(0, 80);
  const autoStart = args?.autoStart !== false;
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
    };
  });
}

async function clockCreateStopwatch(args) {
  const autoStart = args?.autoStart !== false;
  return mutateStorage((data) => {
    data.stopwatch = {
      running: autoStart,
      elapsed: 0,
      startTime: autoStart ? Date.now() : 0,
      laps: [],
      updatedAt: Date.now(),
    };
    return { ok: true, kind: "stopwatch", running: autoStart };
  });
}

async function clockCreatePomodoro(args) {
  return mutateStorage((data) => {
    const s = data.pomodoro.settings;
    if (args?.workMin != null) s.workMin = clamp(args.workMin, 1, 120, s.workMin);
    if (args?.shortBreakMin != null) s.shortBreakMin = clamp(args.shortBreakMin, 1, 60, s.shortBreakMin);
    if (args?.longBreakMin != null) s.longBreakMin = clamp(args.longBreakMin, 1, 60, s.longBreakMin);
    if (args?.longEvery != null) s.longEvery = clamp(args.longEvery, 2, 12, s.longEvery);
    data.pomodoro.pendingStart = args?.autoStart !== false;
    data.pomodoro.updatedAt = Date.now();
    return {
      ok: true,
      kind: "pomodoro",
      settings: { ...s },
      autoStart: data.pomodoro.pendingStart,
    };
  });
}

async function clockScheduleMeeting(args) {
  const title = String(args?.title || "Meeting").trim().slice(0, 120) || "Meeting";
  const durationMin = clamp(args?.durationMin ?? 60, 15, 240, 60);
  let startDate = null;
  if (args?.start) {
    startDate = new Date(args.start);
  } else if (args?.date && args?.time) {
    startDate = new Date(`${args.date}T${args.time}`);
  } else if (args?.when) {
    startDate = new Date(args.when);
  }
  if (!startDate || Number.isNaN(startDate.getTime())) {
    return {
      ok: false,
      error: "Provide start as ISO datetime, or date+time",
    };
  }
  const entry = {
    id: `mtg_${Date.now()}`,
    title,
    start: startDate.toISOString(),
    durationMin,
    dateStr: startDate.toISOString().slice(0, 10),
  };
  return mutateStorage((data) => {
    const scheduled = Array.isArray(data.meetingPlanner.scheduled)
      ? data.meetingPlanner.scheduled
      : [];
    scheduled.unshift(entry);
    data.meetingPlanner.scheduled = scheduled.slice(0, 50);
    if (args?.defaultTitle) {
      data.meetingPlanner.defaultTitle = String(args.defaultTitle).slice(0, 120);
    }
    return { ok: true, meeting: entry };
  });
}

function clamp(val, min, max, fallback) {
  const n = parseInt(val, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function formatDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const CLOCK_TOOL_DEFS = [
  {
    name: "clock_get_time",
    description: "Get the current local time in a country or city worldwide",
    parameters: {
      type: "object",
      properties: {
        place: { type: "string", description: "Country or city name" },
      },
      required: ["place"],
    },
  },
  {
    name: "clock_create_timer",
    description: "Create a countdown timer in the Clock app",
    parameters: {
      type: "object",
      properties: {
        minutes: { type: "number", description: "Minutes" },
        seconds: { type: "number", description: "Extra seconds" },
        hours: { type: "number", description: "Hours" },
        label: { type: "string", description: "Optional timer label" },
        autoStart: { type: "boolean", description: "Start immediately (default true)" },
      },
    },
  },
  {
    name: "clock_create_stopwatch",
    description: "Create/reset a stopwatch in the Clock app",
    parameters: {
      type: "object",
      properties: {
        autoStart: { type: "boolean", description: "Start immediately" },
      },
    },
  },
  {
    name: "clock_create_pomodoro",
    description: "Configure and optionally start a pomodoro focus session",
    parameters: {
      type: "object",
      properties: {
        workMin: { type: "number" },
        shortBreakMin: { type: "number" },
        longBreakMin: { type: "number" },
        longEvery: { type: "number" },
        autoStart: { type: "boolean", description: "Start focus session " },
      },
    },
  },
  {
    name: "clock_schedule_meeting",
    description: "Save a meeting/appointment in the Clock meeting planner",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        start: { type: "string", description: "ISO datetime" },
        date: { type: "string", description: "YYYY-MM-DD" },
        time: { type: "string", description: "HH:MM" },
        when: { type: "string", description: "Natural datetime parseable by Date" },
        durationMin: { type: "number" },
      },
    },
  },
];

async function executeClockTool(name, args, ctx) {
  let result;
  switch (name) {
    case "clock_get_time":
      result = clockGetTime(args);
      break;
    case "clock_create_timer":
      result = await clockCreateTimer(args);
      break;
    case "clock_create_stopwatch":
      result = await clockCreateStopwatch(args);
      break;
    case "clock_create_pomodoro":
      result = await clockCreatePomodoro(args);
      break;
    case "clock_schedule_meeting":
      result = await clockScheduleMeeting(args);
      break;
    default:
      result = { ok: false, error: `Unknown clock tool: ${name}` };
  }

  if (
    result?.ok &&
    ctx?.openClockPage &&
    ["clock_create_timer", "clock_create_stopwatch", "clock_create_pomodoro", "clock_schedule_meeting"].includes(
      name
    )
  ) {
    const page =
      name === "clock_create_timer"
        ? "timer"
        : name === "clock_create_stopwatch"
          ? "stopwatch"
          : name === "clock_create_pomodoro"
            ? "pomodoro"
            : "meetings";
    try {
      await ctx.openClockPage(page);
      result.openedPage = page;
    } catch (err) {
      result.openWarning = err.message || String(err);
    }
  }
  return result;
}

module.exports = {
  CLOCK_TOOL_DEFS,
  executeClockTool,
  clockGetTime,
  searchPlaces,
};