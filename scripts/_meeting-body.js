function pad2(n) {
  return String(n).padStart(2, "0");
}

function zoneCityName(zoneId) {
  const part = String(zoneId || "").split("/").pop() || zoneId;
  return part.replace(/_/g, " ");
}

function localTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (_) {
    return "UTC";
  }
}

function getPartsInZone(date, timeZone) {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = fmt.formatToParts(date);
    const map = {};
    parts.forEach((p) => {
      if (p.type !== "literal") map[p.type] = p.value;
    });
    return {
      year: parseInt(map.year, 10),
      month: parseInt(map.month, 10),
      day: parseInt(map.day, 10),
      hour: parseInt(map.hour, 10) % 24,
      minute: parseInt(map.minute, 10),
      second: parseInt(map.second, 10),
    };
  } catch (_) {
    return null;
  }
}

const WEEKDAY_MAP = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function getOffsetMinutes(date, timeZone) {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = dtf.formatToParts(date);
    const map = {};
    parts.forEach((p) => {
      if (p.type !== "literal") map[p.type] = p.value;
    });
    const hour = parseInt(map.hour, 10) % 24;
    const asUtc = Date.UTC(
      parseInt(map.year, 10),
      parseInt(map.month, 10) - 1,
      parseInt(map.day, 10),
      hour,
      parseInt(map.minute, 10),
      parseInt(map.second, 10)
    );
    return Math.round((asUtc - date.getTime()) / 60000);
  } catch (_) {
    return 0;
  }
}

function getWeekdayInZone(date, timeZone) {
  try {
    const wd = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
    return WEEKDAY_MAP[wd] ?? 0;
  } catch (_) {
    return date.getDay();
  }
}

function findLocalMoment(y, m, d, hour, minute, timeZone) {
  let guess = Date.UTC(y, m - 1, d, hour, minute, 0);
  for (let delta = -16; delta <= 16; delta++) {
    const test = new Date(guess + delta * 3600000);
    const p = getPartsInZone(test, timeZone);
    if (p && p.year === y && p.month === m && p.day === d && p.hour === hour && p.minute === minute) {
      return test;
    }
  }
  return new Date(guess);
}

function parseDateStr(dateStr) {
  const [y, m, d] = String(dateStr || "")
    .split("-")
    .map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function todayDateStr() {
  const n = new Date();
  return `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-${pad2(n.getDate())}`;
}

function clampHour(v, fallback) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(23, Math.max(0, n));
}

function participantScore(slotDate, participant, durationMin) {
  const p = participant;
  const tz = p.timezone;
  const parts = getPartsInZone(slotDate, tz);
  if (!parts) return { score: 0, statusLabel: "Unknown", hour: 0 };

  const workStart = clampHour(p.workStart, 9);
  const workEnd = clampHour(p.workEnd, 17);
  const workDays = Array.isArray(p.workDays) ? p.workDays : [1, 2, 3, 4, 5];

  const endSlot = new Date(slotDate.getTime() + durationMin * 60000);
  const endParts = getPartsInZone(endSlot, tz) || parts;

  let minScore = 100;
  let worstLabel = "Work hours";

  const checkInstant = (instParts, dow) => {
    const hour = instParts.hour + instParts.minute / 60;
    let score = 0;
    let label = "Night";

    if (hour >= workStart && hour < workEnd) {
      score = 100;
      label = "Work hours";
    } else if (hour >= workStart - 1 && hour < workEnd + 1) {
      score = 65;
      label = "Edge of work";
    } else if (hour >= 7 && hour < 22) {
      score = 40;
      label = "Awake";
    } else {
      score = 5;
      label = "Night";
    }

    if (workDays.length && !workDays.includes(dow)) {
      score = Math.round(score * 0.45);
      if (label === "Work hours") label = "Weekend";
    }

    return { score, label, hour };
  };

  const dowStart = getWeekdayInZone(slotDate, tz);
  const s0 = checkInstant(parts, dowStart);
  minScore = s0.score;
  worstLabel = s0.label;

  if (endParts.hour !== parts.hour || endParts.minute !== parts.minute) {
    const dowEnd = getWeekdayInZone(endSlot, tz);
    const s1 = checkInstant(endParts, dowEnd);
    if (s1.score < minScore) {
      minScore = s1.score;
      worstLabel = s1.label;
    }
  }

  return {
    score: minScore,
    statusLabel: worstLabel,
    hour: parts.hour,
    localTime: `${pad2(parts.hour)}:${pad2(parts.minute)}`,
  };
}

function formatSlotInZone(date, timeZone) {
  const p = getPartsInZone(date, timeZone);
  if (!p) return "—";
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

function findBestSlots(options) {
  const {
    participants,
    dateStr,
    durationMin = 60,
    referenceTz,
    stepMin = 30,
    maxResults = 8,
  } = options || {};

  if (!participants?.length) return [];
  const parsed = parseDateStr(dateStr);
  if (!parsed) return [];

  const refTz = referenceTz || localTimeZone();
  const { y, m, d } = parsed;
  const start = findLocalMoment(y, m, d, 0, 0, refTz);
  const end = findLocalMoment(y, m, d, 23, 30, refTz);
  const stepMs = stepMin * 60000;
  const durationMs = durationMin * 60000;

  const slots = [];
  for (let t = start.getTime(); t + durationMs <= end.getTime() + stepMs; t += stepMs) {
    const slotDate = new Date(t);
    const perPerson = participants.map((p) => ({
      id: p.id,
      label: p.label,
      timezone: p.timezone,
      ...participantScore(slotDate, p, durationMin),
    }));
    const minScore = Math.min(...perPerson.map((x) => x.score));
    const avgScore = perPerson.reduce((a, x) => a + x.score, 0) / perPerson.length;

    slots.push({
      start: slotDate,
      score: minScore,
      avgScore,
      allInWork: perPerson.every((x) => x.score >= 100),
      participants: perPerson,
      refLabel: formatSlotInZone(slotDate, refTz),
    });
  }

  slots.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.avgScore - a.avgScore;
  });

  const seen = new Set();
  const unique = [];
  for (const s of slots) {
    if (seen.has(s.refLabel)) continue;
    seen.add(s.refLabel);
    unique.push(s);
    if (unique.length >= maxResults) break;
  }
  return unique;
}

function slotVerdict(slot) {
  if (slot.allInWork) {
    return { level: "great", title: "Great for everyone", hint: "Everyone is within office hours." };
  }
  if (slot.score >= 65) {
    return { level: "ok", title: "Good for most", hint: "Most people are in or near office hours." };
  }
  return { level: "warn", title: "OK with caveats", hint: "Someone may be early, late, or on a weekend." };
}

function normalizeParticipant(raw) {
  if (!raw || typeof raw.timezone !== "string") return null;
  const workDays = Array.isArray(raw.workDays)
    ? raw.workDays.filter((d) => d >= 0 && d <= 6)
    : [1, 2, 3, 4, 5];
  return {
    id: String(raw.id || raw.timezone),
    timezone: raw.timezone,
    label: String(raw.label || zoneCityName(raw.timezone)),
    workStart: clampHour(raw.workStart, 9),
    workEnd: Math.max(clampHour(raw.workEnd, 17), clampHour(raw.workStart, 9) + 1),
    workDays: workDays.length ? workDays : [1, 2, 3, 4, 5],
  };
}

function defaultParticipant(timezone, label) {
  return {
    id: `mp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timezone,
    label: label || zoneCityName(timezone),
    workStart: 9,
    workEnd: 17,
    workDays: [1, 2, 3, 4, 5],
  };
}

const api = {
  pad2,
  zoneCityName,
  localTimeZone,
  getPartsInZone,
  getOffsetMinutes,
  findLocalMoment,
  parseDateStr,
  todayDateStr,
  participantScore,
  findBestSlots,
  formatSlotInZone,
  slotVerdict,
  normalizeParticipant,
  defaultParticipant,
};

if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.PartsClockMeeting = api;