const { handleWorldClockInvoke } = require("../../apps/world-clock-ipc");

async function listFavorites() {
  const res = await handleWorldClockInvoke("storage.load", {});
  if (!res?.ok) return res || { ok: false, error: "Failed to load clock storage" };
  const favorites = Array.isArray(res.data?.favorites) ? res.data.favorites : [];
  return {
    ok: true,
    favorites: favorites.map((f) => ({
      id: f.id,
      label: f.label || f.name || f.city || "",
      timezone: f.timezone || f.tz || "",
      city: f.city || "",
      country: f.country || "",
    })),
    total: favorites.length,
  };
}

async function getPomodoro() {
  const res = await handleWorldClockInvoke("storage.load", {});
  if (!res?.ok) return res || { ok: false, error: "Failed to load clock storage" };
  return { ok: true, pomodoro: res.data?.pomodoro || null, settings: res.data?.settings || null };
}

async function focusEnter(input = {}) {
  return handleWorldClockInvoke("focus.enter", input);
}

async function openCalendarUrl(input = {}) {
  const url = String(input.url || "").trim();
  if (!url) return { ok: false, error: "Missing url" };
  return handleWorldClockInvoke("calendar.openUrl", { url });
}

const CAPABILITIES = [
  {
    id: "clock.favorites.list",
    kind: "query",
    provider: "world-clock",
    title: "List clock favorites",
    description: "Favorite cities/timezones from Clock",
    handler: listFavorites,
  },
  {
    id: "clock.pomodoro.get",
    kind: "query",
    provider: "world-clock",
    title: "Get pomodoro state",
    description: "Current pomodoro / focus settings from Clock storage",
    handler: getPomodoro,
  },
  {
    id: "clock.focus.enter",
    kind: "action",
    provider: "world-clock",
    title: "Enter focus mode",
    description: "Start Clock focus mode",
    handler: focusEnter,
  },
  {
    id: "clock.calendar.openUrl",
    kind: "action",
    provider: "world-clock",
    title: "Open calendar URL",
    description: "Open an external calendar link",
    handler: openCalendarUrl,
  },
];

module.exports = { CAPABILITIES };
