function safeId(raw) {
  return String(raw || "").replace(/[^a-zA-Z0-9_-]/g, "");
}

function matchesPrefix(filename, id) {
  const sid = safeId(id);
  if (!sid) return false;
  const n = String(filename || "");
  return n.startsWith(sid + "_") || n.startsWith(sid + ".");
}

const api = { safeId, matchesPrefix };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.PartsHostSafeId = api;