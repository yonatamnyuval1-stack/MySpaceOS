function scoreFact(fact, userText) {
  let score = fact && fact.pinned ? 50 : 1;
  const q = String(userText || "").toLowerCase().trim();
  if (!q || !fact) return score;
  const hay = (String(fact.text || "") + " " + (fact.tags || []).join(" ")).toLowerCase();
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  for (const w of words) {
    if (hay.includes(w)) score += 4;
  }
  for (const tag of fact.tags || []) {
    if (q.includes(String(tag).toLowerCase())) score += 8;
  }
  return score;
}

function selectRelevantFacts(facts, userText, opts = {}) {
  const list = Array.isArray(facts) ? facts : [];
  const limit = Math.max(1, Math.min(12, Number(opts.limit) || 8));
  if (!list.length) return [];
  const scored = list
    .map((f) => ({ fact: f, score: scoreFact(f, userText) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(b.fact.updatedAt || "").localeCompare(String(a.fact.updatedAt || ""));
    });
  const pinned = scored.filter((x) => x.fact.pinned).map((x) => x.fact);
  const rest = scored
    .filter((x) => !x.fact.pinned)
    .slice(0, Math.max(0, limit - pinned.length))
    .map((x) => x.fact);
  return pinned.concat(rest).slice(0, limit);
}

function formatMemoryBlock(facts, preferences, userText, opts = {}) {
  if (opts.includeMemory === false) return { block: "", ids: [], chars: 0 };
  const selected = selectRelevantFacts(facts, userText, opts);
  const prefLines = Object.entries(preferences || {})
    .filter(([, v]) => v != null && String(v).trim())
    .map(([k, v]) => "- " + k + ": " + String(v).trim());
  const factLines = selected.map((f) => "- " + String(f.text || "").trim());
  const lines = [];
  if (prefLines.length) {
    lines.push("Preferences:");
    lines.push(...prefLines);
  }
  if (factLines.length) {
    if (lines.length) lines.push("");
    lines.push("Relevant memory:");
    lines.push(...factLines);
  }
  const block = lines.length ? "\n\n[Mind Memory]\n" + lines.join("\n") : "";
  return {
    block,
    ids: selected.map((f) => f.id).filter(Boolean),
    chars: block.length,
  };
}

const api = { scoreFact, selectRelevantFacts, formatMemoryBlock };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.PartsMindMemoryRank = api;