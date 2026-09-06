window.History = (function () {
  const { invoke: ipc } = window.myApp;

  async function invoke(channel, args) {
    const res = await ipc(channel, args);
    if (!res?.ok) throw new Error(res?.error || "Request failed");
    return res;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function uid(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function formatYear(year) {
    if (year == null || Number.isNaN(year)) return "—";
    if (year < 0) return `${Math.abs(year)} BCE`;
    return String(year);
  }

  function lifeSpan(item) {
    if (item.type === "event") return formatYear(item.year);
    const b = formatYear(item.birthYear);
    const d = item.deathYear ? formatYear(item.deathYear) : "present";
    return `${b} – ${d}`;
  }

  function truncate(text, max = 2800) {
    const t = String(text || "").trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max).trim()}…`;
  }

  const ERA_LABELS = {
    ancient: "Ancient",
    medieval: "Medieval",
    early: "Early Modern",
    modern: "18th–19th c.",
    twentieth: "20th Century",
    recent: "1975–2010",
    unknown: "Unknown",
  };

  function eraLabel(id) {
    return ERA_LABELS[id] || id;
  }

  return { invoke, escapeHtml, uid, formatYear, lifeSpan, truncate, eraLabel, ERA_LABELS };
})();
