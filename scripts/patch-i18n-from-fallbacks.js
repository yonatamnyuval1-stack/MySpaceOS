const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const localesDir = path.join(root, "apps/shared/i18n/locales");

function loadLocale(lang) {
  const p = path.join(localesDir, `${lang}.js`);
  delete require.cache[require.resolve(p)];
  return { path: p, messages: { ...require(p) } };
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

const scanFiles = [
  "src/settings-page.js",
  "src/renderer.js",
  "src/start-menu.js",
  "src/command-palette.js",
  "src/notifications-bell.js",
  "src/platform-catalog.js",
  "src/app-rail.js",
  "src/files-panel.js",
  "src/mind-panel.js",
  "src/link-panel.js",
  "src/bridge-panel.js",
  "src/jobs-panel.js",
  "src/themes-panel.js",
  "src/backup-panel.js",
  "src/storage-panel.js",
  "src/updates-panel.js",
  "src/network-panel.js",
  "src/info-panel.js",
  "src/resolve-panel.js",
  "src/msl-panel.js",
  "src/parts-panel.js",
];

const pairRe = /\btt\(\s*["']([^"']+)["']\s*,\s*["']([^"']*)["']/g;
const pairReTpl = /\btt\(\s*["']([^"']+)["']\s*,\s*`([^`]*)`/g;

const fromCode = {};
for (const rel of scanFiles) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) continue;
  const t = fs.readFileSync(p, "utf8");
  let m;
  while ((m = pairRe.exec(t))) fromCode[m[1]] = m[2];
  while ((m = pairReTpl.exec(t))) fromCode[m[1]] = m[2];
}

const heOverlay = {
  "shell.welcome.tip1": "פתחו את <kbd>התחל (⊞)</kbd> כדי להוסיף תוכניות מהמחשב. הן נפתחות בתוך My Space.",
  "shell.welcome.tip2": "השתמשו ב־<kbd>חיבור</kbd> ל־Gmail, הודעות, AI ו־<kbd>My Space Browser</kbd> (חיפוש אפליקציות ורשת במקום אחד).",
  "shell.welcome.tip3": "אתרים נפתחים בלשונית דפדפן מובנית; אפליקציות שולחן עבודה יכולות להיטמע בחלונות העבודה.",
  "shell.welcome.tip4": "השתמשו בפקודות קונסולה כמו <kbd>run space</kbd> או <kbd>run builds</kbd> להפעלה מהירה.",
  "shell.welcome.tip5": "סמנו מועדפים בשולחן העבודה, או השתמשו בהתחל / Ctrl+K למציאת אפליקציות.",
  "shell.welcome.goodMorning": "בוקר טוב",
  "shell.welcome.goodAfternoon": "צהריים טובים",
  "shell.welcome.goodEvening": "ערב טוב",
  "shell.welcome.appsInstalled": "{n} אפליקציות מותקנות",
  "shell.welcome.openCount": "{n} פתוחות עכשיו",
  "shell.welcome.available": "{n} זמינות",
  "shell.welcome.nothingOpen": "אין כלום פתוח: בחרו אפליקציה להתחלה.",
  "shell.welcome.change.chatTag": "צ׳אט",
  "shell.welcome.change.chat": "אפליקציית צ׳אט חדשה בסגנון ChatGPT על Mind. run chat · chat(new). גם Mind Chat (פאנל צד) נשמר כאן.",
  "shell.welcome.change.mindTag": "Mind",
  "shell.welcome.change.mind": "Mind פשוט: Quick (זול), Everyday, או Deep (Pro). מפתח Gemini אחד. פלטפורמה → Mind.",
  "shell.welcome.change.mslTag": "MSL",
  "shell.welcome.change.msl": "MSL הוא שירות פלטפורמה מובנה : בלי אריח שולחן עבודה.",
  "shell.welcome.change.jobsTag": "Jobs",
  "shell.welcome.change.jobs": "Jobs הוא מנוע החישוב של מערכת ההפעלה. כל הפעלה ופקודת מעטפת היא משימה תחת חוזה הקיבולת (פלטפורמה → Jobs).",
  "shell.welcome.change.platformTag": "פלטפורמה",
  "shell.welcome.change.platform": "קטלוג שירותי פלטפורמה: OS, דפדפן, מעטפת, MSL, Jobs, Mind ועוד — מהאטום בשורת המשימות או Welcome → שירותים.",
  "shell.welcome.change.connectTag": "חיבור",
  "shell.welcome.change.connect": "מרכז הדואר שונה לשם חיבור: קטלוג דואר, הודעות, רשתות, AI, מדיה, כלים ודפדפנים באפליקציה.",
  "shell.welcome.change.browserTag": "דפדפן",
  "shell.welcome.change.browser": "My Space Browser מחפש אפליקציות, שירותי חיבור, תוכן My Space והרשת מדף בית אחד.",
  "shell.type.app": "אפליקציה",
  "shell.type.web": "רשת",
  "shell.type.program": "תוכנית",
  "shell.type.system": "מערכת",
  "shell.start.menu": "תפריט התחל",
  "shell.start.search": "חיפוש אפליקציות…",
  "shell.start.add": "הוסף קיצור…",
  "shell.start.empty": "אין אפליקציות התואמות ל־\"{q}\"",
  "settings.timezone": "אזור זמן",
  "settings.timezoneHint": "משמש לשעון בשורת המשימות ולהצגות זמן.",
  "settings.timezone.system": "ברירת מערכת ({tz})",
  "settings.clockFormat": "פורמט שעון",
  "settings.clockFormatHint": "שעון 12 שעות (AM/PM) או 24 שעות.",
  "settings.clock12": "12 שעות",
  "settings.clock24": "24 שעות",
  "settings.showSeconds": "הצג שניות",
  "settings.showSecondsHint": "כלול שניות בשעון שבשורת המשימות.",
  "settings.firstDay": "יום ראשון בשבוע",
  "settings.firstDayHint": "יום התחלה מועדף ליומנים ותצוגות שבועיות.",
  "settings.sunday": "ראשון",
  "settings.monday": "שני",
  "settings.currentClock": "שעון נוכחי",
  "settings.backgrounds.rotating": "מחליף בין {n} רקעים כל 5 דקות. לחצו להוספה או הסרה.",
  "settings.backgrounds.oneSelected": "נבחר רקע אחד: בחרו לפחות עוד אחד כדי להתחיל סיבוב.",
  "settings.backgrounds.select": "בחרו רקעים לשימוש. עם 2 או יותר הם מתחלפים כל 5 דקות.",
  "settings.general.resetPositionsConfirm": "לאפס את כל מיקומי האייקונים בשולחן העבודה לפריסת ברירת המחדל?",
  "settings.general.resetPositionsDone": "מיקומי האייקונים אופסו",
  "settings.general.exportOk": "הגיבוי יוצא",
  "settings.general.exportFail": "הייצוא נכשל",
  "settings.general.restoreConfirm": "שחזור יחליף את נתוני My Space מקובץ zip ואז יופעל מחדש. להמשיך?",
  "settings.restoreConfirm": "שחזור יחליף את נתוני My Space מקובץ zip ואז יופעל מחדש. להמשיך?",
  "settings.general.restoring": "משחזר…",
  "settings.general.restoreFail": "השחזור נכשל",
  "settings.general.dataFolderOpened": "תיקיית הנתונים נפתחה",
  "settings.general.dataFolderFail": "לא ניתן לפתוח את התיקייה",
  "settings.resetPositionsConfirm": "לאפס את כל מיקומי האייקונים בשולחן העבודה לפריסת ברירת המחדל?",
  "settings.resetPositionsDone": "מיקומי האייקונים אופסו",
  "settings.backupExported": "הגיבוי יוצא",
  "settings.exportFailed": "הייצוא נכשל",
  "settings.restoring": "משחזר…",
  "settings.restoreFailed": "השחזור נכשל",
  "settings.openedDataFolder": "תיקיית הנתונים נפתחה",
  "settings.openFolderFailed": "לא ניתן לפתוח את התיקייה",
  "settings.spaceName": "שם ה־Space",
  "settings.spaceNameHint": "מוצג בשורת המשימות ובכותרת החלון.",
  "settings.tagline": "סלוגן",
  "settings.taglineHint": "שורה קצרה תחת Welcome ומסכים קשורים.",
  "settings.taglinePlaceholder": "סביבת העבודה שלך…",
  "settings.showClock": "הצג שעון בשורת המשימות",
  "settings.showClockHint": "הצג את התאריך והשעה הנוכחיים בצד ימין של שורת המשימות.",
  "settings.showWelcome": "הצג Welcome בהפעלה",
  "settings.showWelcomeHint": "פתח את מרכז השליטה Welcome כש־My Space עולה. Welcome הוא מסך הפעלה, לא אפליקציית שולחן עבודה.",
  "settings.hotCorners": "פינות חמות",
  "settings.hotCornersHint": "הזיזו את הסמן לפינות המסך: שולחן עבודה, פלטה, התחל, קיצורי דרך.",
  "settings.focusHides": "מיקוד מסתיר אייקונים אחרים",
  "settings.focusHidesHint": "בזמן Focus / Pomodoro, הצג רק Today והאפליקציה הפעילה בשולחן העבודה.",
  "settings.confirmClose": "אשר לפני סגירת אפליקציות",
  "settings.confirmCloseHint": "בקש אישור בסגירת חלון אפליקציה פתוח.",
  "settings.activeDesktop": "שולחן עבודה פעיל",
  "settings.activeDesktopHint": "לכל חלון My Space יש שולחנות Study / Work / Play.",
  "settings.resetPositions": "אפס מיקומי אייקונים",
  "settings.desktopLayout": "פריסת שולחן עבודה",
  "settings.desktopLayoutHint": "נקה קואורדינטות אייקונים שמורות וסדר אפליקציות אוטומטית.",
  "settings.exportBackup": "ייצוא גיבוי",
  "settings.restoreBackup": "שחזור גיבוי",
  "settings.openDataFolder": "פתח תיקיית נתונים",
  "settings.backupRestore": "גיבוי ושחזור",
  "settings.backupRestoreHint": "ייצוא או שחזור של ארכיון userData המלא . מעטפת: backup(export).",
  "settings.desktop": "שולחן עבודה",
  "settings.app.application": "אפליקציה",
  "settings.app.hidden": "מוסתרת",
  "settings.app.visible": "גלויה",
  "settings.app.showOnDesktop": "הצג בשולחן העבודה",
  "settings.app.hideFromDesktop": "הסתר משולחן העבודה",
  "settings.app.showOnDesktopHint": "כשמוסתרת, האפליקציה מוסרת משולחן העבודה ומתפריט התחל.",
  "settings.apps.hidden": "מוסתרת",
  "settings.apps.visible": "גלויה",
  "settings.tools.updateFailed": "לא ניתן לעדכן כלי",
  "palette.aria": "פלטת פקודות",
  "palette.placeholder": "חפשו הכול ב־My Space…",
  "palette.hint": "הקלידו לחיפוש · ? AI (יכול להריץ פעולות) · > מעטפת",
  "palette.noMatches": "אין התאמות",
  "palette.empty": "אין התאמות",
};

const aliases = {
  "settings.timezone": "settings.time.zone",
  "settings.timezoneHint": "settings.time.zoneHint",
  "settings.clockFormat": "settings.time.format",
  "settings.clockFormatHint": "settings.time.formatHint",
  "settings.clock12": "settings.time.12h",
  "settings.clock24": "settings.time.24h",
  "settings.showSeconds": "settings.time.showSeconds",
  "settings.showSecondsHint": "settings.time.showSecondsHint",
  "settings.firstDay": "settings.calendar.firstDay",
  "settings.firstDayHint": "settings.calendar.firstDayHint",
  "settings.sunday": "settings.calendar.sunday",
  "settings.monday": "settings.calendar.monday",
  "settings.currentClock": "settings.preview.clock",
  "settings.backgrounds.rotating": "settings.backgrounds.statusRotating",
  "settings.backgrounds.oneSelected": "settings.backgrounds.statusOne",
  "settings.backgrounds.select": "settings.backgrounds.statusNone",
  "settings.app.hidden": "settings.apps.hidden",
  "settings.app.visible": "settings.apps.visible",
  "settings.app.showOnDesktop": "settings.apps.showOnDesktop",
  "settings.app.hideFromDesktop": "settings.apps.hideFromDesktop",
};

const enPack = loadLocale("en");
const hePack = loadLocale("he");

let addedEn = 0;
let addedHe = 0;

for (const [alias, target] of Object.entries(aliases)) {
  if (enPack.messages[target] != null && enPack.messages[alias] == null) {
    enPack.messages[alias] = enPack.messages[target];
    addedEn++;
  }
  if (hePack.messages[target] != null && hePack.messages[alias] == null) {
    hePack.messages[alias] = hePack.messages[target];
    addedHe++;
  }
}

for (const [key, enText] of Object.entries(fromCode)) {
  if (enPack.messages[key] == null) {
    enPack.messages[key] = enText;
    addedEn++;
  }
  if (hePack.messages[key] == null) {
    hePack.messages[key] = heOverlay[key] || enText;
    addedHe++;
  }
}

for (const [key, heText] of Object.entries(heOverlay)) {
  if (enPack.messages[key] == null && fromCode[key]) {
    enPack.messages[key] = fromCode[key];
    addedEn++;
  } else if (enPack.messages[key] == null) {
    continue;
  }
  hePack.messages[key] = heText;
}

for (const key of Object.keys(heOverlay)) {
  if (enPack.messages[key] == null && fromCode[key]) enPack.messages[key] = fromCode[key];
}

fs.writeFileSync(enPack.path, wrap("en", enPack.messages));
fs.writeFileSync(hePack.path, wrap("he", hePack.messages));
console.log("ok", {
  en: Object.keys(enPack.messages).length,
  he: Object.keys(hePack.messages).length,
  addedEn,
  addedHe,
  fromCode: Object.keys(fromCode).length,
});