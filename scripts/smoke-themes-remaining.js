const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

const tmpDir = path.join(__dirname, "..", ".tmp-theme-smoke");
const runtime = path.join(__dirname, "..", "apps", "shared", "theme-runtime.js");
const chrome = fs.readFileSync(path.join(__dirname, "..", "apps", "shared", "theme-chrome.css"), "utf8");
const filesCss = fs.readFileSync(path.join(__dirname, "..", "apps", "files", "styles.css"), "utf8");
const docsCss = fs.readFileSync(path.join(__dirname, "..", "apps", "docs", "styles.css"), "utf8");

async function runCase(win, html) {
  const file = path.join(tmpDir, `case-${Date.now()}-${Math.random()}.html`);
  fs.writeFileSync(file, html, "utf8");
  await win.loadURL(pathToFileURL(file).href);
  return win.webContents.executeJavaScript(`(() => {
    const bodyBg = () => getComputedStyle(document.body).backgroundColor;
    const btn = document.getElementById("p");
    const base = document.documentElement.getAttribute("data-theme-base");
    const before = bodyBg();
    const target = base === "light" ? "dark" : "light";
    window.MySpaceThemeRuntime.apply({ mode: target, buttons: "soft" });
    void document.body.offsetHeight;
    const after = bodyBg();
    const rad = getComputedStyle(btn).borderRadius;
    return {
      base,
      before,
      after,
      changed: before !== after,
      softPill: parseFloat(rad) >= 20,
      theme: document.documentElement.getAttribute("data-theme"),
      buttons: document.documentElement.getAttribute("data-buttons"),
    };
  })()`);
}

app.whenReady().then(async () => {
  fs.mkdirSync(tmpDir, { recursive: true });
  const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true } });

  const lightBase = `<!DOCTYPE html>
<html data-theme="light" data-theme-base="light" data-buttons="default">
<head><style>${filesCss}</style><style>${chrome}</style>
<script src="${pathToFileURL(runtime).href}?v=1"></script></head>
<body><div class="app-shell"><aside class="sidebar">S</aside>
<button class="btn btn-primary" id="p">Go</button></div></body></html>`;

  const darkBase = `<!DOCTYPE html>
<html data-theme="dark" data-theme-base="dark" data-buttons="default">
<head><style>${docsCss}</style><style>${chrome}</style>
<script src="${pathToFileURL(runtime).href}?v=1"></script></head>
<body><div class="app-shell"><aside class="sidebar">S</aside>
<button class="btn btn-primary" id="p">Go</button></div></body></html>`;

  const a = await runCase(win, lightBase);
  const b = await runCase(win, darkBase);

  const { THEME_CATALOG } = require("../main/apps/themes-ipc");
  const count = Object.keys(THEME_CATALOG).length;
  const lightDefaults = Object.values(THEME_CATALOG).filter((x) => x.defaultMode === "light").length;

  const checks = [
    { name: "files light→dark body", ok: a.changed && a.theme === "dark" },
    { name: "files soft pill", ok: a.softPill },
    { name: "docs dark→light body", ok: b.changed && b.theme === "light" },
    { name: "docs soft pill", ok: b.softPill },
    { name: "catalog size", ok: count >= 40 },
    { name: "light-default apps", ok: lightDefaults >= 10 },
  ];
  const failed = checks.filter((c) => !c.ok);
  console.log(JSON.stringify({ count, lightDefaults, a, b, checks }, null, 2));
  if (failed.length) {
    console.error("FAIL", failed.map((f) => f.name).join("; "));
    app.exit(1);
    return;
  }
  console.log("OK: remaining themes wired");
  app.exit(0);
});