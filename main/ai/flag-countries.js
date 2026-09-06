const fs = require("fs");
const path = require("path");

let cache = null;

function loadFlagCountries() {
  if (cache) return cache;
  const map = new Map();
  try {
    const src = fs.readFileSync(path.join(__dirname, "../../apps/flag-quiz/countries.js"), "utf8");
    for (const m of src.matchAll(/\["([a-z]{2})",\s*"((?:\\.|[^"\\])*)",\s*"((?:\\.|[^"\\])*)"\]/g)) {
      map.set(m[1], {
        code: m[1],
        name: m[2].replace(/\\'/g, "'"),
        nameHe: m[3].replace(/\\'/g, "'"),
      });
    }
  } catch {
  }
  cache = map;
  return map;
}

function resolveFlagCode(code) {
  const c = String(code || "")
    .trim()
    .toLowerCase();
  if (!c) return null;
  return loadFlagCountries().get(c) || null;
}

function enrichPrimaryFlag(flag) {
  if (!flag || typeof flag !== "object") return flag;
  if (flag.flagCountry && flag.flagCode) return flag;
  let code = flag.flagCode;
  if (!code && flag.src) {
    const m = String(flag.src).match(/flagcdn\.com\/(?:[wh]\d+\/)?([a-z]{2})(?:[@./?]|$)/i);
    if (m) code = m[1].toLowerCase();
  }
  if (!code) return flag;
  const hit = resolveFlagCode(code);
  if (!hit) return { ...flag, flagCode: code };
  return {
    ...flag,
    flagCode: code,
    flagCountry: flag.flagCountry || hit.name,
    flagCountryHe: flag.flagCountryHe || hit.nameHe,
    src: flag.src || hit.flag,
  };
}

module.exports = { loadFlagCountries, resolveFlagCode, enrichPrimaryFlag };