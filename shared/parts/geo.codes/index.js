function createIndex({ byCode = {}, byName = {} } = {}) {
  const code = Object.create(null);
  const name = Object.create(null);
  for (const [k, v] of Object.entries(byCode || {})) {
    code[String(k).toUpperCase()] = String(v).toUpperCase();
  }
  for (const [k, v] of Object.entries(byName || {})) {
    name[String(k).trim().toLowerCase()] = String(v).toUpperCase();
  }
  return { byCode: code, byName: name };
}

function resolve(ref, index) {
  const raw = String(ref || "").trim();
  if (!raw || !index) return null;
  const upper = raw.toUpperCase();
  if (index.byCode[upper]) return index.byCode[upper];
  const lower = raw.toLowerCase();
  if (index.byName[lower]) return index.byName[lower];
  if (/^[A-Za-z]{2,3}$/.test(raw)) return upper;
  if (raw.length >= 4) {
    for (const [n, code] of Object.entries(index.byName)) {
      if (n.startsWith(lower) || lower.startsWith(n)) return code;
    }
  }
  return null;
}

function isKnownName(ref, index) {
  const raw = String(ref || "").trim().toLowerCase();
  if (!raw || raw.length < 4 || !index) return false;
  if (index.byName[raw]) return true;
  return Object.keys(index.byName).some((n) => n.startsWith(raw) || raw.startsWith(n));
}

const api = { createIndex, resolve, isKnownName };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.PartsGeoCodes = api;