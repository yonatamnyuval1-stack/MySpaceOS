function pad(n) {
  return String(n).padStart(2, "0");
}

function localTodayISO(d = new Date()) {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

function localNowHM(d = new Date()) {
  return pad(d.getHours()) + ":" + pad(d.getMinutes());
}

function addDaysLocal(iso, days) {
  const d = new Date(String(iso) + "T12:00:00");
  if (Number.isNaN(d.getTime())) return localTodayISO();
  d.setDate(d.getDate() + Number(days || 0));
  return localTodayISO(d);
}

function formatLongDate(iso) {
  try {
    return new Date(String(iso) + "T12:00:00").toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatTimeLabel(hm) {
  if (!hm) return "Anytime";
  try {
    const [h, m] = hm.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return hm;
  }
}

function hourKey(hm) {
  if (!hm) return "anytime";
  return String(hm).slice(0, 2) + ":00";
}

function dueLabel(iso, today = localTodayISO()) {
  if (!iso) return "";
  if (iso === today) return "Today";
  if (iso === addDaysLocal(today, 1)) return "Tomorrow";
  try {
    return new Date(String(iso) + "T12:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function dueDateForWhen(when, today = localTodayISO()) {
  if (when === "tomorrow") return addDaysLocal(today, 1);
  if (when === "later") return addDaysLocal(today, 3);
  return today;
}

function defaultComposerTime(d = new Date()) {
  const x = new Date(d);
  x.setMinutes(Math.ceil(x.getMinutes() / 15) * 15, 0, 0);
  if (x.getMinutes() === 60) x.setHours(x.getHours() + 1, 0, 0, 0);
  return pad(x.getHours()) + ":" + pad(x.getMinutes());
}

function groupByHour(items, getTime = (it) => it.time || it.hm) {
  const buckets = new Map();
  for (const item of items || []) {
    const key = hourKey(getTime(item));
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(item);
  }
  return [...buckets.entries()]
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    .map(([hour, rows]) => ({ hour, items: rows }));
}

const api = { localTodayISO, localNowHM, addDaysLocal, formatLongDate, formatTimeLabel, hourKey, dueLabel, dueDateForWhen, defaultComposerTime, groupByHour };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.PartsDateAgenda = api;