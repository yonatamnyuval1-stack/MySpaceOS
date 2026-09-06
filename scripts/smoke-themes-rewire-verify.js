const fs = require("fs");
const path = require("path");
const { THEME_CATALOG, LIVE_THEME_APPLY } = require("../main/apps/themes-ipc");

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok: !!ok, detail: detail || null });
}

check("LIVE_THEME_APPLY on", LIVE_THEME_APPLY === true);

const ipc = fs.readFileSync(path.join(__dirname, "..", "main", "apps", "themes-ipc.js"), "utf8");
check("no executeJavaScript in themes-ipc", !/\.executeJavaScript\s*\(/.test(ipc));
check("IPC send present", /wc\.send\("themes:changed"/.test(ipc));

let htmlOk = 0;
let preloadOk = 0;
const bad = [];

for (const id of Object.keys(THEME_CATALOG)) {
  const htmlPath = path.join(__dirname, "..", "apps", id, "index.html");
  const prePath = path.join(__dirname, "..", "apps", id, "preload.js");
  if (!fs.existsSync(htmlPath) || !fs.existsSync(prePath)) {
    bad.push(id + ":missing");
    continue;
  }
  const html = fs.readFileSync(htmlPath, "utf8");
  const pre = fs.readFileSync(prePath, "utf8");
  const hasHtml = /theme-chrome\.css/.test(html) && /theme-runtime\.js/.test(html) && /data-theme-base=/.test(html);
  if (hasHtml) htmlOk++;
  else bad.push(id + ":html");

  const ei = Math.max(pre.indexOf('exposeInMainWorld("myApp"'), pre.indexOf("exposeInMainWorld('myApp'"));
  const ai = pre.search(/Themes bridge failed/);
  const hasAttach = /attachThemesApi/.test(pre) && ai >= 0;
  if (hasAttach && ei >= 0 && ai > ei) preloadOk++;
  else bad.push(id + `:preload(ei=${ei},ai=${ai})`);
}

check("all catalog HTML wired", htmlOk === Object.keys(THEME_CATALOG).length, { htmlOk });
check("all catalog preloads expose-first", preloadOk === Object.keys(THEME_CATALOG).length, { preloadOk });
check("no bad apps", bad.length === 0, { bad: bad.slice(0, 10) });

const failed = checks.filter((c) => !c.ok);
console.log(JSON.stringify({ catalog: Object.keys(THEME_CATALOG).length, checks, failed: failed.map((f) => f.name) }, null, 2));
if (failed.length) {
  process.exit(1);
}
console.log("OK: Themes re-enabled with safe contract");
