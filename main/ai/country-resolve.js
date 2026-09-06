let cache = null;

function loadIndex() {
  if (cache) return cache;
  const byCode = Object.create(null);
  const byName = Object.create(null);
  try {
    const data = require("../../data/space-earth.json");
    for (const c of data.countries || []) {
      const code2 = String(c.code2 || "").toUpperCase();
      const code3 = String(c.code || "").toUpperCase();
      const prefer = code2 || code3;
      if (!prefer) continue;
      if (code2) byCode[code2] = prefer;
      if (code3) byCode[code3] = prefer;
      for (const n of [c.name, c.wikiTitle]) {
        if (!n) continue;
        byName[String(n).trim().toLowerCase()] = prefer;
      }
    }
  } catch {
  }
  cache = { byCode, byName };
  return cache;
}

function resolveCountryRef(ref) {
  const raw = String(ref || "").trim();
  if (!raw) return null;
  const { byCode, byName } = loadIndex();
  const upper = raw.toUpperCase();
  if (byCode[upper]) return byCode[upper];
  const lower = raw.toLowerCase();
  if (byName[lower]) return byName[lower];
  if (/^[A-Za-z]{2,3}$/.test(raw)) return upper;
  if (raw.length >= 4) {
    for (const [name, code] of Object.entries(byName)) {
      if (name.startsWith(lower) || lower.startsWith(name)) return code;
    }
  }
  return null;
}

function isKnownCountryName(ref) {
  const raw = String(ref || "").trim().toLowerCase();
  if (!raw || raw.length < 4) return false;
  const { byName } = loadIndex();
  if (byName[raw]) return true;
  return Object.keys(byName).some((n) => n.startsWith(raw) || raw.startsWith(n));
}

module.exports = {
  resolveCountryRef,
  isKnownCountryName,
  loadIndex,
};