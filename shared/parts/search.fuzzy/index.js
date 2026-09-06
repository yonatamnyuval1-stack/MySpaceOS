function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * @param {string} query
 * @param {string} text
 * @returns {number} 0..1
 */
function score(query, text) {
  const q = normalize(query);
  const t = normalize(text);
  if (!q) return 1;
  if (!t) return 0;
  if (t === q) return 1;
  if (t.startsWith(q)) return 0.92;
  if (t.includes(q)) return 0.75;

  let ti = 0;
  let hits = 0;
  for (let i = 0; i < q.length; i++) {
    const ch = q[i];
    const found = t.indexOf(ch, ti);
    if (found < 0) return Math.min(0.35, hits / q.length);
    hits += 1;
    ti = found + 1;
  }
  const density = hits / Math.max(t.length, 1);
  return Math.min(0.7, 0.4 + density * 0.3);
}

/**
 * @template T
 * @param {string} query
 * @param {T[]} items
 * @param {(item: T) => string} [getText]
 * @returns {T[]}
 */
function rank(query, items, getText) {
  const list = Array.isArray(items) ? items : [];
  const textOf = typeof getText === "function" ? getText : (x) => String(x ?? "");
  return list
    .map((item) => ({ item, s: score(query, textOf(item)) }))
    .filter((row) => row.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((row) => row.item);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { score, rank, normalize };
}
if (typeof window !== "undefined") {
  window.PartsSearchFuzzy = { score, rank, normalize };
}