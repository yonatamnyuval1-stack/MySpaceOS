const fs = require("fs");
const path = require("path");
const { THEME_CATALOG, LIVE_THEME_APPLY } = require("../main/apps/themes-ipc");

const ipc = fs.readFileSync(path.join(__dirname, "..", "main", "apps", "themes-ipc.js"), "utf8");
const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok: !!ok, detail: detail || null });
}

check("LIVE_THEME_APPLY on", LIVE_THEME_APPLY === true);
check("urlBelongsToApp gate present", /urlBelongsToApp/.test(ipc));
check("patchAppHtmlTheme present", /patchAppHtmlTheme/.test(ipc));
check("requires data-theme-base before live attr write", /data-theme-base/.test(ipc));

let chrome = 0;
let runtime = 0;
let preloadHooks = 0;
for (const id of Object.keys(THEME_CATALOG)) {
  const html = fs.readFileSync(path.join(__dirname, "..", "apps", id, "index.html"), "utf8");
  const pre = fs.readFileSync(path.join(__dirname, "..", "apps", id, "preload.js"), "utf8");
  if (/theme-chrome\.css/.test(html)) chrome++;
  if (/theme-runtime\.js/.test(html)) runtime++;
  if (/theme-preload|attachThemesApi|Themes bridge failed|myAppThemes/.test(pre)) preloadHooks++;
  if (!/exposeInMainWorld\(\s*["']myApp["']/.test(pre) && id !== "myspace-browser") {
    if (!/exposeInMainWorld\(\s*["']myApp["']/.test(pre)) {
      checks.push({ name: `myApp expose ${id}`, ok: false });
    }
  }
}

check("all apps have theme-chrome", chrome === Object.keys(THEME_CATALOG).length, { chrome });
check("no theme-runtime in apps", runtime === 0, { runtime });
check("no themes preload hooks", preloadHooks === 0, { preloadHooks });

const failed = checks.filter((c) => !c.ok);
console.log(JSON.stringify({ catalog: Object.keys(THEME_CATALOG).length, checks, failed: failed.map((f) => f.name) }, null, 2));
if (failed.length) process.exit(1);
console.log("OK: Themes v3 CSS-only live path armed");
