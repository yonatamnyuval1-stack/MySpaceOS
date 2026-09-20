const fs = require("fs");
const path = require("path");

const LOCALE_DIR = path.join(__dirname, "..", "apps", "shared", "i18n", "locales");
const WORK = path.join(__dirname, "i18n-work");
fs.mkdirSync(WORK, { recursive: true });

require(path.join(LOCALE_DIR, "en.js"));
const en = { ...globalThis.MySpaceI18nMessages.en };
fs.writeFileSync(path.join(WORK, "en.json"), JSON.stringify(en));
console.log("en keys", Object.keys(en).length);

function wrap(lang, obj) {
  const sorted = {};
  for (const k of Object.keys(obj).sort()) sorted[k] = obj[k];
  return `(function (root) {
  const messages = ${JSON.stringify(sorted, null, 2)};
  root.MySpaceI18nMessages = root.MySpaceI18nMessages || {};
  root.MySpaceI18nMessages.${lang} = messages;
  if (typeof module !== "undefined" && module.exports) module.exports = messages;
})(typeof globalThis !== "undefined" ? globalThis : window);
`;
}

for (const lang of ["ar", "fr", "ru", "es"]) {
  let cur = {};
  const p = path.join(LOCALE_DIR, `${lang}.js`);
  if (fs.existsSync(p)) {
    delete require.cache[require.resolve(p)];
    require(p);
    cur = { ...(globalThis.MySpaceI18nMessages[lang] || {}) };
  }
  const out = { ...en, ...cur };
  for (const k of Object.keys(en)) {
    if (cur[k] != null && cur[k] !== en[k]) out[k] = cur[k];
    else if (out[k] == null) out[k] = en[k];
  }
  fs.writeFileSync(p, wrap(lang, out));
  console.log("seeded", lang);
}