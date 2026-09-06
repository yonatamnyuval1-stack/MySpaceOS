function score(hay, q) {
  const h = String(hay || "").toLowerCase();
  const query = String(q || "").toLowerCase();
  if (!query) return 0;
  if (h === query) return 120;
  if (h.startsWith(query)) return 100;
  if (h.includes(query)) return 60;
  const parts = query.split(/\s+/).filter(Boolean);
  if (parts.length && parts.every((p) => h.includes(p))) return 40;
  let qi = 0;
  for (let i = 0; i < h.length && qi < query.length; i++) {
    if (h[i] === query[qi]) qi++;
  }
  if (qi === query.length && query.length >= 3) return 25;
  return 0;
}

function looksLikeTicker(q) {
  return /^[a-z0-9.\-^=]{1,12}$/i.test(q) && /[a-z]/i.test(q);
}

function isAiQuery(raw) {
  const t = String(raw || "").trim();
  return t.startsWith("?") || /^ask(\s+|$)/i.test(t);
}

function aiPromptFrom(raw) {
  return String(raw || "")
    .trim()
    .replace(/^\?\s*/, "")
    .replace(/^ask\s+/i, "")
    .trim();
}

function isShellQuery(raw) {
  const t = String(raw || "").trim();
  if (t.startsWith(">")) return true;
  return /^(run|check|close|focus|open|help|alias|macro|when|pin|unpin|reveal|desktop|settings)\b/i.test(
    t
  );
}

function detectQueryMode(raw) {
  if (isAiQuery(raw)) return { mode: "ai", prompt: aiPromptFrom(raw) };
  if (isShellQuery(raw)) {
    const t = String(raw || "").trim();
    return { mode: "shell", command: t.startsWith(">") ? t.slice(1).trim() : t };
  }
  return { mode: "search", query: String(raw || "").trim() };
}

function rankItems(items, q, { hayFn, boost = 0 } = {}) {
  const query = String(q || "")
    .trim()
    .toLowerCase();
  const out = [];
  for (const item of items || []) {
    const hay = hayFn ? hayFn(item) : item?.title || item?.name || "";
    const rank = score(hay, query);
    if (rank > 0) out.push({ item, rank: rank + boost });
  }
  return out.sort((a, b) => b.rank - a.rank);
}

const api = {
  score,
  looksLikeTicker,
  isAiQuery,
  aiPromptFrom,
  isShellQuery,
  detectQueryMode,
  rankItems,
};

if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.PartsSearchScore = api;