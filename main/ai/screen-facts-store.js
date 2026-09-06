const factsByModule = new Map();

function publishScreenFacts(moduleId, facts) {
  const id = String(moduleId || "").trim();
  if (!id || !facts || typeof facts !== "object") return false;
  factsByModule.set(id, {
    ...facts,
    moduleId: id,
    publishedAt: Date.now(),
  });
  return true;
}

function getScreenFacts(moduleId, maxAgeMs = 120000) {
  const id = String(moduleId || "").trim();
  if (!id) return null;
  const row = factsByModule.get(id);
  if (!row) return null;
  if (maxAgeMs > 0 && Date.now() - (row.publishedAt || 0) > maxAgeMs) return null;
  return row;
}

function clearScreenFacts(moduleId) {
  factsByModule.delete(String(moduleId || "").trim());
}

module.exports = {
  publishScreenFacts,
  getScreenFacts,
  clearScreenFacts,
};