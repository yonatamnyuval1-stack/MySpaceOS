const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const localesDir = path.join(root, "apps/shared/i18n/locales");

function wrap(lang, obj) {
  return `(function (root) {
  const messages = ${JSON.stringify(obj, null, 2)};
  root.MySpaceI18nMessages = root.MySpaceI18nMessages || {};
  root.MySpaceI18nMessages.${lang} = messages;
  if (typeof module !== "undefined" && module.exports) module.exports = messages;
})(typeof globalThis !== "undefined" ? globalThis : window);
`;
}

function load(lang) {
  const p = path.join(localesDir, `${lang}.js`);
  delete require.cache[require.resolve(p)];
  return { p, m: { ...require(p) } };
}

const files = [];
function walk(d) {
  if (!fs.existsSync(d)) return;
  for (const n of fs.readdirSync(d)) {
    const p = path.join(d, n);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (n === "node_modules" || n === ".git") continue;
      walk(p);
    } else if (/\.(js|html)$/.test(n)) files.push(p);
  }
}
walk(path.join(root, "src"));
for (const a of [
  "files",
  "jobs",
  "scheduler",
  "themes",
  "permissions",
  "pulse",
  "scripts",
  "updates",
  "network",
  "storage",
  "backup",
  "os-bridge",
  "resolve",
  "msl-protocol",
  "parts",
  "mail",
  "shell-console",
  "system-info",
]) {
  walk(path.join(root, "apps", a));
}

const harvested = {};
const reTt = /\btt\(\s*["']([a-zA-Z][a-zA-Z0-9._-]*)["']\s*,\s*["']([^"\\]*(?:\\.[^"\\]*)*)["']/g;
const reTtTpl = /\btt\(\s*["']([a-zA-Z][a-zA-Z0-9._-]*)["']\s*,\s*`([^`]*)`/g;
const reData = /data-i18n(?:-[a-z]+)?=["']([a-zA-Z][a-zA-Z0-9._-]*)["'][^>]*>([^<]*)</g;
const rePh = /data-i18n-placeholder=["']([a-zA-Z][a-zA-Z0-9._-]*)["'][^>]*placeholder=["']([^"']*)["']/gi;
const rePh2 = /placeholder=["']([^"']*)["'][^>]*data-i18n-placeholder=["']([a-zA-Z][a-zA-Z0-9._-]*)["']/gi;

function unescape(s) {
  return String(s || "")
    .replace(/\\n/g, "\n")
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .trim();
}

for (const f of files) {
  const t = fs.readFileSync(f, "utf8");
  let m;
  while ((m = reTt.exec(t))) {
    const en = unescape(m[2]);
    if (en && !en.includes("${") && en.length < 400) harvested[m[1]] = en;
  }
  while ((m = reTtTpl.exec(t))) {
    const en = unescape(m[2]);
    if (en && !en.includes("${") && en.length < 400) harvested[m[1]] = en;
  }
  while ((m = reData.exec(t))) {
    const en = unescape(m[2]);
    if (en && en.length > 0 && en.length < 400) harvested[m[1]] = en;
  }
  while ((m = rePh.exec(t))) harvested[m[1]] = unescape(m[2]);
  while ((m = rePh2.exec(t))) harvested[m[2]] = unescape(m[1]);
}

function heFromEn(key, en) {
  if (/^(My Space|Mind|MSL|Model Flow|Jobs|Pulse|Connect|UTC)$/i.test(en)) return en;
  const dict = {
    Refresh: "רענון",
    Cancel: "ביטול",
    Save: "שמירה",
    Close: "סגור",
    Open: "פתח",
    Clear: "נקה",
    Delete: "מחיקה",
    Add: "הוסף",
    New: "חדש",
    History: "היסטוריה",
    All: "הכול",
    About: "אודות",
    Search: "חיפוש",
    "Search…": "חיפוש…",
    Loading: "טוען",
    "Loading…": "טוען…",
    Enabled: "פעיל",
    Disabled: "כבוי",
    Back: "חזרה",
    Edit: "עריכה",
    Run: "הרץ",
    Stop: "עצור",
    Apply: "החל",
    Export: "ייצוא",
    Import: "ייבוא",
    Copy: "העתק",
    Reset: "איפוס",
    Done: "הושלם",
    Active: "פעיל",
    Pending: "ממתין",
    Error: "שגיאה",
    OK: "אישור",
    Settings: "הגדרות",
    Devices: "מכשירים",
    Share: "שיתוף",
    Places: "מקומות",
    Host: "מארח",
    Queue: "תור",
    Capacity: "קיבולת",
    Enqueue: "הוסף לתור",
    Retry: "נסה שוב",
    Send: "שלח",
    Test: "בדיקה",
    Try: "נסה",
    Expand: "הרחב",
    Restore: "שחזר",
    Remove: "הסר",
    Saved: "נשמר",
    Copied: "הועתק",
    Failed: "נכשל",
    Ready: "מוכן",
    Current: "נוכחי",
    Overview: "סקירה",
    Status: "סטטוס",
    Filter: "סינון",
    Name: "שם",
    Size: "גודל",
    Modified: "שונה",
    Favorites: "מועדפים",
    Recent: "אחרונים",
    Drives: "כוננים",
    Browse: "עיון",
    Inbox: "דואר נכנס",
    Playbooks: "מדריכים",
    Capabilities: "יכולות",
    Keys: "מפתחות",
    Publish: "פרסום",
    Explore: "עיון",
    Routes: "נתיבים",
    Events: "אירועים",
    Log: "יומן",
    Subscriptions: "מנויים",
    Accounts: "חשבונות",
    Connected: "מחובר",
    Listening: "מאזין",
    Stopped: "עצור",
    Phone: "טלפון",
  };
  if (dict[en]) return dict[en];
  return null;
}

const heMapPath = path.join(__dirname, "i18n-he-harvest.json");
let heMap = {};
if (fs.existsSync(heMapPath)) {
  heMap = JSON.parse(fs.readFileSync(heMapPath, "utf8"));
}

const enPack = load("en");
const hePack = load("he");
let addedEn = 0;
let addedHe = 0;
const stillEn = [];

for (const [key, english] of Object.entries(harvested)) {
  if (enPack.m[key] == null) {
    enPack.m[key] = english;
    addedEn++;
  }
  const mapped = heMap[key] || heFromEn(key, english);
  if (mapped) {
    if (hePack.m[key] == null || hePack.m[key] === english) {
      hePack.m[key] = mapped;
      addedHe++;
    }
  } else if (hePack.m[key] == null) {
    hePack.m[key] = english;
    addedHe++;
  }
  if (hePack.m[key] === english) stillEn.push([key, english]);
}

fs.writeFileSync(enPack.p, wrap("en", enPack.m));
fs.writeFileSync(hePack.p, wrap("he", hePack.m));
fs.writeFileSync(
  path.join(__dirname, "i18n-still-english.json"),
  JSON.stringify(Object.fromEntries(stillEn), null, 2)
);
console.log({
  harvested: Object.keys(harvested).length,
  en: Object.keys(enPack.m).length,
  he: Object.keys(hePack.m).length,
  addedEn,
  addedHe,
  stillEnglish: stillEn.length,
});