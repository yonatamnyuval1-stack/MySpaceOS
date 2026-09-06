(function (root) {
  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function pad3(n) {
    return String(n).padStart(3, "0");
  }

  function normalizeQuery(q) {
    return String(q || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function uid() {
    return `clk_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function formatMs(ms) {
    const neg = ms < 0;
    const t = Math.abs(Math.floor(ms));
    const h = Math.floor(t / 3600000);
    const m = Math.floor((t % 3600000) / 60000);
    const s = Math.floor((t % 60000) / 1000);
    const cs = Math.floor((t % 1000) / 10);
    if (h > 0) return `${neg ? "-" : ""}${pad2(h)}:${pad2(m)}:${pad2(s)}`;
    return `${neg ? "-" : ""}${pad2(m)}:${pad2(s)}.${pad2(cs)}`;
  }

  function formatTimerDisplay(totalSec) {
    const t = Math.max(0, Math.floor(totalSec));
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    if (h > 0) return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
    return `${pad2(m)}:${pad2(s)}`;
  }

  root.ClockUtils = {
    pad2,
    pad3,
    normalizeQuery,
    escapeHtml,
    uid,
    formatMs,
    formatTimerDisplay,
  };
})(window);
