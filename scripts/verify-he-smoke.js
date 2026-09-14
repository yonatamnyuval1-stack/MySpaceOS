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

const he = load("he");
const en = load("en");
Object.assign(he.m, {
  "shell.palette.action.connect.title": "חיבור",
  "shell.welcome.changelog.connect.tag": "חיבור",
  "service.jobs.statConnect": "חיבור",
  "service.msl.mintTitle": "הנפקה",
  "service.systemInfo.filterTimeWait": "המתנה",
});
delete he.m["service.mail.composeSoon"];
delete en.m["service.mail.composeSoon"];
fs.writeFileSync(en.p, wrap("en", en.m));
fs.writeFileSync(he.p, wrap("he", he.m));

delete require.cache[require.resolve("../apps/shared/i18n/i18n.js")];
delete require.cache[require.resolve("../apps/shared/i18n/locales/en.js")];
delete require.cache[require.resolve("../apps/shared/i18n/locales/he.js")];
const I = require("../apps/shared/i18n/i18n.js");
require("../apps/shared/i18n/locales/en.js");
require("../apps/shared/i18n/locales/he.js");
I.setLanguage("he", { applyDom: false, applyDocument: false });

const checks = [
  "shell.settings.title",
  "settings.general.title",
  "settings.cat.languages",
  "settings.timezone",
  "shell.welcome.greeting.morning",
  "shell.welcome.tip.0",
  "shell.start.search",
  "shell.palette.placeholder",
  "shell.notifications.markAllRead",
  "platform.files.name",
  "platform.jobs.name",
  "service.scheduler.active",
  "service.updates.checkNow",
  "service.bridge.startPairing",
  "service.mind.placeholder",
  "shell.account.signIn",
  "shell.palette.action.connect.title",
];
for (const k of checks) {
  const v = I.t(k);
  const heChars = /[\u0590-\u05FF]/.test(v);
  console.log(heChars || v === "English" || v === "My Space" ? "OK" : "??", k, "=>", v.slice(0, 72));
}
console.log("rtl", I.isRtl(), "keys", Object.keys(he.m).length);
