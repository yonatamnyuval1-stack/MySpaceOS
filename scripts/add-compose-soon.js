const fs = require("fs");
const path = require("path");
const localesDir = path.join(__dirname, "..", "apps/shared/i18n/locales");

function load(lang) {
  const p = path.join(localesDir, `${lang}.js`);
  delete require.cache[require.resolve(p)];
  return { p, m: { ...require(p) } };
}

function wrap(lang, obj) {
  return `(function (root) {
  const messages = ${JSON.stringify(obj, null, 2)};
  root.MySpaceI18nMessages = root.MySpaceI18nMessages || {};
  root.MySpaceI18nMessages.${lang} = messages;
  if (typeof module !== "undefined" && module.exports) module.exports = messages;
})(typeof globalThis !== "undefined" ? globalThis : window);
`;
}

const en = load("en");
const he = load("he");
en.m["service.mail.composeSoon"] = "Coming soon";
he.m["service.mail.composeSoon"] = "בקרוב";
fs.writeFileSync(en.p, wrap("en", en.m));
fs.writeFileSync(he.p, wrap("he", he.m));
console.log("ok", Object.keys(en.m).length, Object.keys(he.m).length);