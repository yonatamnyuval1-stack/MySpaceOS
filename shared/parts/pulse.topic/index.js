function matchTopic(pattern, topic) {
  const p = String(pattern || "").trim();
  const t = String(topic || "").trim();
  if (!p || !t) return false;
  if (p === "*" || p === "#") return true;
  if (p.endsWith(".*")) return t.startsWith(p.slice(0, -1));
  if (p.endsWith("#")) return t.startsWith(p.slice(0, -1));
  return p === t;
}

function filterTopics(patterns, topic) {
  return (Array.isArray(patterns) ? patterns : []).filter((p) => matchTopic(p, topic));
}

const api = { matchTopic, filterTopics };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.PartsPulseTopic = api;
