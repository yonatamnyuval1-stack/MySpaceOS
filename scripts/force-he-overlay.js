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

const enExtra = {
  "shell.welcome.tip1":
    "Open <kbd>Start (⊞)</kbd> to add programs from your PC: they open inside My Space.",
  "shell.welcome.tip2":
    "Use <kbd>Connect</kbd> for Gmail, messaging, AI, and <kbd>My Space Browser</kbd>.",
  "shell.welcome.tip3":
    "Websites launch in a built-in browser tab; desktop apps can embed in workspace windows.",
  "shell.welcome.tip4":
    "Use Console commands like <kbd>run space</kbd> or <kbd>run builds</kbd> for quick launches.",
  "shell.welcome.tip5": "Pin favorites on the desktop, or use Start / Ctrl+K to find apps.",
  "shell.welcome.goodMorning": "Good morning",
  "shell.welcome.goodAfternoon": "Good afternoon",
  "shell.welcome.goodEvening": "Good evening",
  "shell.welcome.appsInstalled": "{n} apps installed",
  "shell.welcome.openCount": "{n} open now",
  "shell.welcome.available": "{n} available",
  "shell.welcome.nothingOpen": "Nothing open, pick an app to start.",
  "shell.welcome.change.chatTag": "Chat",
  "shell.welcome.change.chat":
    "New Chat app: ChatGPT-style history powered by Mind. run chat · chat(new). Mind Chat (side panel) saves here too.",
  "shell.welcome.change.mindTag": "Mind",
  "shell.welcome.change.mind":
    "Mind is simple: Quick (cheap), Everyday, or Deep (Pro). One Gemini key. Platform → Mind.",
  "shell.welcome.change.mslTag": "MSL",
  "shell.welcome.change.msl":
    "MSL is a built-in platform service (panel + shell): no desktop app tile.",
  "shell.welcome.change.jobsTag": "Jobs",
  "shell.welcome.change.jobs":
    "Jobs is the OS compute runtime. every launch and shell command is a job under the Capacity contract (Platform → Jobs).",
  "shell.welcome.change.platformTag": "Platform",
  "shell.welcome.change.platform":
    "Platform services catalog: OS, Browser, Shell, MSL, Jobs, Mind, and more from the taskbar atom or Welcome → Services.",
  "shell.welcome.change.connectTag": "Connect",
  "shell.welcome.change.connect":
    "Mail hub renamed Connect: catalog of mail, messaging, social, AI, media, tools, and browsers in-app.",
  "shell.welcome.change.browserTag": "Browser",
  "shell.welcome.change.browser":
    "My Space Browser searches apps, Connect services, My Space content, and the web from one home page.",
  "shell.type.app": "App",
  "shell.type.web": "Web",
  "shell.type.program": "Program",
  "shell.type.system": "System",
  "shell.palette.aria": "Command palette",
  "shell.palette.placeholder": "Search everything in My Space…",
  "shell.palette.hint": "Type to search · ? AI (can run actions) · > shell",
  "shell.palette.empty": "No matches",
  "palette.matchedExtra": " · {n} matched",
  "palette.hintResults": "{n} results{extra} · ↑↓ Enter · Esc · > shell · ? AI",
  "settings.timezone.system": "System default ({tz})",
};

const heExtra = {
  "shell.welcome.tip1":
    "פתחו את <kbd>התחל (⊞)</kbd> כדי להוסיף תוכניות מהמחשב: הן נפתחות בתוך My Space.",
  "shell.welcome.tip2":
    "השתמשו ב־<kbd>חיבור</kbd> ל־Gmail, הודעות, AI ו־<kbd>My Space Browser</kbd> .",
  "shell.welcome.tip3":
    "אתרים נפתחים בלשונית דפדפן מובנית; אפליקציות שולחן עבודה יכולות להיטמע בחלונות העבודה.",
  "shell.welcome.tip4":
    "השתמשו בפקודות קונסולה כמו <kbd>run space</kbd> או <kbd>run builds</kbd> להפעלה מהירה.",
  "shell.welcome.tip5": "סמנו מועדפים בשולחן העבודה, או השתמשו בהתחל / Ctrl+K למציאת אפליקציות.",
  "shell.welcome.goodMorning": "בוקר טוב",
  "shell.welcome.goodAfternoon": "צהריים טובים",
  "shell.welcome.goodEvening": "ערב טוב",
  "shell.welcome.appsInstalled": "{n} אפליקציות מותקנות",
  "shell.welcome.openCount": "{n} פתוחות עכשיו",
  "shell.welcome.available": "{n} זמינות",
  "shell.welcome.nothingOpen": "אין כלום פתוח. בחרו אפליקציה להתחלה.",
  "shell.welcome.change.chatTag": "צ׳אט",
  "shell.welcome.change.chat":
    "אפליקציית צ׳אט חדשה בסגנון ChatGPT על Mind. run chat · chat(new). גם Mind Chat (פאנל צד) נשמר כאן.",
  "shell.welcome.change.mindTag": "Mind",
  "shell.welcome.change.mind":
    "Mind פשוט: Quick (זול), Everyday, או Deep (Pro). מפתח Gemini אחד. פלטפורמה → Mind.",
  "shell.welcome.change.mslTag": "MSL",
  "shell.welcome.change.msl":
    "MSL הוא שירות פלטפורמה מובנה : בלי אריח שולחן עבודה.",
  "shell.welcome.change.jobsTag": "Jobs",
  "shell.welcome.change.jobs":
    "Jobs הוא מנוע החישוב של מערכת ההפעלה. כל הפעלה ופקודת מעטפת היא משימה תחת חוזה הקיבולת (פלטפורמה → Jobs).",
  "shell.welcome.change.platformTag": "פלטפורמה",
  "shell.welcome.change.platform":
    "קטלוג שירותי פלטפורמה: OS, דפדפן, מעטפת, MSL, Jobs, Mind ועוד. מהאטום בשורת המשימות או Welcome → שירותים.",
  "shell.welcome.change.connectTag": "חיבור",
  "shell.welcome.change.connect":
    "מרכז הדואר שונה לשם חיבור: קטלוג דואר, הודעות, רשתות, AI, מדיה, כלים ודפדפנים באפליקציה.",
  "shell.welcome.change.browserTag": "דפדפן",
  "shell.welcome.change.browser":
    "My Space Browser מחפש אפליקציות, שירותי חיבור, תוכן My Space והרשת מדף בית אחד.",
  "shell.type.app": "אפליקציה",
  "shell.type.web": "רשת",
  "shell.type.program": "תוכנית",
  "shell.type.system": "מערכת",
  "shell.palette.aria": "פלטת פקודות",
  "shell.palette.placeholder": "חפשו הכול ב־My Space…",
  "shell.palette.hint": "הקלידו לחיפוש · ? AI (יכול להריץ פעולות) · > מעטפת",
  "shell.palette.empty": "אין התאמות",
  "palette.matchedExtra": " · {n} התאמות",
  "palette.hintResults": "{n} תוצאות{extra} · ↑↓ Enter · Esc · > מעטפת · ? AI",
  "settings.timezone.system": "ברירת מערכת ({tz})",
  "shell.palette.action.askAi.title": "Mind Chat…",
  "shell.palette.action.askAi.subtitle": "עוזר צד · כלים · או הקלידו ? שאלה",
  "shell.palette.action.add.title": "הוסף תוכנית",
  "shell.palette.action.add.subtitle": "התקנת קיצור דרך",
  "shell.palette.action.settings.title": "הגדרות",
  "shell.palette.action.settings.subtitle": "הגדרות My Space",
  "shell.palette.action.desktop.title": "הצג שולחן עבודה",
  "shell.palette.action.desktop.subtitle": "מזער חלונות",
  "shell.palette.action.focus.title": "מצב מיקוד",
  "shell.palette.action.focus.subtitle": "השתק התראות · Today + אפליקציה פעילה",
  "shell.palette.action.spaceCycle.title": "החלף שולחן עבודה",
  "shell.palette.action.spaceCycle.subtitle": "מחזור Study / Work / Play",
  "shell.palette.action.newWindow.title": "חלון My Space חדש",
  "shell.palette.action.newWindow.subtitle": "פתח חלון שולחן עבודה שני",
  "shell.palette.action.shortcuts.title": "קיצורי מקלדת",
  "shell.palette.action.shortcuts.subtitle": "גיליון Ctrl+/",
  "shell.palette.action.msl.title": "MSL — My Space Link",
  "shell.palette.action.msl.subtitle": "אוטובוס יכולות · פאנל",
  "shell.palette.action.parts.title": "Parts — GitHub בין אפליקציות",
  "shell.palette.action.parts.subtitle": "קישור · חקר ואימוץ מודולים",
  "shell.palette.action.jobs.title": "Jobs — מנוע חישוב",
  "shell.palette.action.jobs.subtitle": "תור · קיבולת · אפליקציה מלאה",
  "shell.palette.action.scheduler.title": "Scheduler — מנוע זמן",
  "shell.palette.action.scheduler.subtitle": "לוחות פעילים · היסטוריה · schedule(…)",
  "shell.palette.action.mind.title": "Mind Chat",
  "shell.palette.action.mind.subtitle": "סדרת AI · שיחות · היסטוריה",
  "shell.palette.action.mindSetup.title": "הגדרת Mind",
  "shell.palette.action.mindSetup.subtitle": "מפתח API · מודלים Quick / Everyday / Deep",
  "shell.palette.action.flow.title": "Model Flow",
  "shell.palette.action.flow.subtitle": "סדרת AI · תכנון · אישור · הרצה",
  "shell.palette.action.connect.title": "חיבור",
  "shell.palette.action.connect.subtitle": "סדרת רשת · דואר, הודעות, דפדפנים",
  "shell.palette.action.shellAtlas.title": "מעטפת — אטלס פקודות",
  "shell.palette.action.shellAtlas.subtitle": "מפה מלאה של פקודות חיות",
  "shell.palette.action.shell.title": "פקודת מעטפת…",
  "shell.palette.action.shell.subtitle": "פתח שורת פקודה קלאסית · או הקלידו >",
  "shell.palette.action.snap.title": "הצמד זה לצד זה",
  "shell.palette.action.snap.subtitle": "פצל שתי אפליקציות פתוחות",
};

const en = load("en");
const he = load("he");
Object.assign(en.m, enExtra);
Object.assign(he.m, heExtra);

const cp = fs.readFileSync(path.join(__dirname, "..", "src/command-palette.js"), "utf8");
const re = /\btt\(\s*"([^"]+)"\s*,\s*"([^"]*)"/g;
let m;
while ((m = re.exec(cp))) {
  if (en.m[m[1]] == null) en.m[m[1]] = m[2];
}

fs.writeFileSync(en.p, wrap("en", en.m));
fs.writeFileSync(he.p, wrap("he", he.m));
console.log("en", Object.keys(en.m).length, "he", Object.keys(he.m).length);
console.log("tip1", he.m["shell.welcome.tip1"].slice(0, 48));
console.log("morning", he.m["shell.welcome.goodMorning"]);
console.log("palette", he.m["shell.palette.placeholder"]);