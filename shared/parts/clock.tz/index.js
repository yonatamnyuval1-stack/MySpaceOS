function pad2(n) {
  return String(n).padStart(2, "0");
}

function getAllTimeZones() {
  try {
    if (typeof Intl !== "undefined" && typeof Intl.supportedValuesOf === "function") {
      return Intl.supportedValuesOf("timeZone");
    }
  } catch (_) {
  }
  return ["UTC", "America/New_York", "Europe/London", "Europe/Paris", "Asia/Jerusalem", "Asia/Tokyo"];
}

function zoneCityName(zoneId) {
  const part = String(zoneId || "").split("/").pop() || zoneId;
  return part.replace(/_/g, " ");
}

function formatInZone(date, timeZone, opts) {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone, ...opts }).format(date);
  } catch (_) {
    return "—";
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

function getOffsetLabel(date, timeZone) {
  try {
    const short = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName");
    return short?.value || "";
  } catch (_) {
    return "";
  }
}

function clockAngles(date, timeZone) {
  const p = getPartsInZone(date, timeZone) || {
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
  };
  const h = p.hour % 12;
  const m = p.minute;
  const s = p.second;
  return {
    hour: (h + m / 60) * 30,
    minute: (m + s / 60) * 6,
    second: s * 6,
  };
}

function localTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (_) {
    return "UTC";
  }
}

function formatTime12(d, tz) {
  return formatInZone(d, tz, { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
}
function formatTime24(d, tz) {
  return formatInZone(d, tz, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}
function formatDate(d, tz) {
  return formatInZone(d, tz, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function formatMs(ms) {
  const neg = ms < 0;
  const t = Math.abs(Math.floor(ms));
  const h = Math.floor(t / 3600000);
  const m = Math.floor((t % 3600000) / 60000);
  const s = Math.floor((t % 60000) / 1000);
  const cs = Math.floor((t % 1000) / 10);
  if (h > 0) return (neg ? "-" : "") + pad2(h) + ":" + pad2(m) + ":" + pad2(s);
  return (neg ? "-" : "") + pad2(m) + ":" + pad2(s) + "." + pad2(cs);
}

function formatTimerDisplay(totalSec) {
  const t = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (h > 0) return pad2(h) + ":" + pad2(m) + ":" + pad2(s);
  return pad2(m) + ":" + pad2(s);
}

const api = { pad2, getAllTimeZones, zoneCityName, formatInZone, getPartsInZone, getOffsetLabel, clockAngles, localTimeZone, formatTime12, formatTime24, formatDate, formatMs, formatTimerDisplay };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.PartsClockTz = api;