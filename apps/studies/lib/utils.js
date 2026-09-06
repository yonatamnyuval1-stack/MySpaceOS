(function (root) {
  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function uid(prefix) {
    return `${prefix || "doc"}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function formatRelative(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function formatDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function stripHtml(html) {
    const el = document.createElement("div");
    el.innerHTML = html || "";
    return (el.textContent || "").trim();
  }

  function wordCount(html) {
    const text = stripHtml(html);
    if (!text) return 0;
    return text.split(/\s+/).filter(Boolean).length;
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  root.StudiesUtils = {
    pad2,
    escapeHtml,
    uid,
    formatRelative,
    formatDateTime,
    stripHtml,
    wordCount,
    debounce,
  };
})(window);
