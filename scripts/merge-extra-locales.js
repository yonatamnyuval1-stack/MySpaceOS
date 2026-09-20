const fs = require("fs");
const path = require("path");

const WORK = path.join(__dirname, "i18n-work");
const LOCALE_DIR = path.join(__dirname, "..", "apps", "shared", "i18n", "locales");

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

require(path.join(LOCALE_DIR, "en.js"));
const en = globalThis.MySpaceI18nMessages.en;
const enKeys = Object.keys(en);

for (const lang of ["ar", "fr", "ru", "es"]) {
  const raw = JSON.parse(fs.readFileSync(path.join(WORK, `${lang}.json`), "utf8"));
  const out = {};
  let missing = 0;
  let same = 0;
  for (const k of enKeys) {
    if (raw[k] == null || raw[k] === "") {
      out[k] = en[k];
      missing++;
    } else {
      out[k] = raw[k];
      if (raw[k] === en[k]) same++;
    }
  }
  fs.writeFileSync(path.join(LOCALE_DIR, `${lang}.js`), wrap(lang, out));
  console.log(lang, "keys", Object.keys(out).length, "missingFilled", missing, "sameAsEn", same);
}
