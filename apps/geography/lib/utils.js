window.Geo = (function () {
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

  function formatNumber(n) {
    if (n == null || Number.isNaN(n)) return "—";
    return Number(n).toLocaleString();
  }

  function formatArea(km2) {
    if (!km2) return "—";
    if (km2 >= 1_000_000) return `${(km2 / 1_000_000).toFixed(2)}M km²`;
    if (km2 >= 1000) return `${(km2 / 1000).toFixed(1)}k km²`;
    return `${formatNumber(km2)} km²`;
  }

  function regionIcon(region) {
    const map = {
      Africa: "🌍",
      Americas: "🌎",
      Asia: "🌏",
      Europe: "🇪🇺",
      Oceania: "🏝️",
      Antarctic: "🧊",
    };
    return map[region] || "🌐";
  }

  function stars(rating) {
    const r = Math.round(Number(rating) || 0);
    return "★".repeat(r) + "☆".repeat(Math.max(0, 5 - r));
  }

  function truncate(text, max = 320) {
    const t = String(text || "").trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max).trim()}…`;
  }

  function pref(key, fallback = true) {
    if (window.AppSettingsRuntime?.isReady?.()) return window.AppSettingsRuntime.isOn(key);
    if (window.AppSettings) {
      const item = findSchemaItem(key);
      return window.toggleIsOn?.(undefined, item?.default ?? fallback) ?? fallback;
    }
    return fallback;
  }

  function findSchemaItem(key) {
    const appId = window.myApp?.moduleId;
    const schema = window.APP_SETTINGS_SCHEMA?.[appId];
    for (const sec of schema?.sections || []) {
      const item = (sec.items || []).find((i) => i.key === key);
      if (item) return item;
    }
    return null;
  }

  function showFlags() {
    return pref("showFlags", true);
  }

  function richProfiles() {
    return pref("richProfiles", true);
  }

  const REGIONS = ["Africa", "Americas", "Asia", "Europe", "Oceania", "Antarctic"];

  return {
    invoke,
    escapeHtml,
    uid,
    formatNumber,
    formatArea,
    regionIcon,
    stars,
    truncate,
    pref,
    showFlags,
    richProfiles,
    REGIONS,
  };
})();
