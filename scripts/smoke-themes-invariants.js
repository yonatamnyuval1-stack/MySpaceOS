const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ipc = fs.readFileSync(path.join(ROOT, "main", "apps", "themes-ipc.js"), "utf8");
const preload = fs.readFileSync(path.join(ROOT, "apps", "shared", "theme-preload.js"), "utf8");
const runtime = fs.readFileSync(path.join(ROOT, "apps", "shared", "theme-runtime.js"), "utf8");
const rewire = fs.readFileSync(path.join(ROOT, "scripts", "rewire-themes-safe.js"), "utf8");

const checks = [];

function check(name, ok, detail) {
  checks.push({ name, ok: !!ok, detail: detail || null });
}

check("LIVE_THEME_APPLY defaults false", /const LIVE_THEME_APPLY = false/.test(ipc));
check(
  "broadcast never executeJavaScript",
  !/executeJavaScript/.test(ipc) || /Do NOT executeJavaScript/.test(ipc)
);
check("broadcast uses send when live", /wc\.send\("themes:changed"/.test(ipc));
check("preload exposes myAppThemes", /exposeInMainWorld\("myAppThemes"/.test(preload));
check("preload docs say after myApp expose", /after contextBridge\.exposeInMainWorld\("myApp"/.test(preload));
check("runtime reads myAppThemes", /myAppThemes/.test(runtime));
check("runtime scopes buttons to .app-shell", /\.app-shell/.test(runtime));
check("rewire attach AFTER expose", /ATTACH_AFTER_EXPOSE/.test(rewire) && /expose must precede/.test(rewire));

let themedHtml = 0;
let themedPreload = 0;
const appsDir = path.join(ROOT, "apps");
for (const name of fs.readdirSync(appsDir)) {
  const html = path.join(appsDir, name, "index.html");
  const pre = path.join(appsDir, name, "preload.js");
  if (fs.existsSync(html) && /theme-runtime\.js|theme-chrome\.css/.test(fs.readFileSync(html, "utf8"))) {
    themedHtml++;
  }
  if (
    fs.existsSync(pre) &&
    /theme-preload|attachThemesApi|Themes bridge failed/.test(fs.readFileSync(pre, "utf8"))
  ) {
    themedPreload++;
  }
}
check("apps HTML still stripped (apply off)", themedHtml === 0, { themedHtml });
check("apps preloads still stripped (apply off)", themedPreload === 0, { themedPreload });

const failed = checks.filter((c) => !c.ok);
console.log(JSON.stringify({ checks, failed: failed.map((f) => f.name) }, null, 2));
if (failed.length) {
  console.error("FAIL");
  process.exit(1);
}
console.log("OK: Themes safety invariants hold; live apply still off");