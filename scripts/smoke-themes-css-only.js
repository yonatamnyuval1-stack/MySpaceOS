const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

const tmpDir = path.join(__dirname, "..", ".tmp-theme-smoke");
const tmpHtml = path.join(tmpDir, "css-only.html");
const chromeCss = fs.readFileSync(path.join(__dirname, "..", "apps", "shared", "theme-chrome.css"), "utf8");
const notesCss = fs.readFileSync(path.join(__dirname, "..", "apps", "notes", "styles.css"), "utf8");

app.whenReady().then(async () => {
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(
    tmpHtml,
    `<!DOCTYPE html>
<html data-theme="dark" data-buttons="default" data-theme-base="dark">
<head>
<style>${notesCss}</style>
<style>${chromeCss}</style>
</head>
<body>
<div class="app-shell"><aside class="sidebar">S</aside>
<button class="btn btn-primary" id="p">Go</button></div>
</body></html>`,
    "utf8"
  );

  const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true } });
  await win.loadURL(pathToFileURL(tmpHtml).href);

  const r = await win.webContents.executeJavaScript(`(() => {
    const before = getComputedStyle(document.body).backgroundColor;
    const root = document.documentElement;
    root.setAttribute("data-theme", "light");
    root.setAttribute("data-buttons", "soft");
    root.classList.add("theme-light");
    void document.body.offsetHeight;
    const after = getComputedStyle(document.body).backgroundColor;
    const rad = getComputedStyle(document.getElementById("p")).borderRadius;
    return {
      before,
      after,
      changed: before !== after,
      softPill: parseFloat(rad) >= 20,
      hasMyApp: typeof window.myApp,
      hasRuntime: typeof window.MySpaceThemeRuntime,
    };
  })()`);

  const notesPreload = path.join(__dirname, "..", "apps", "notes", "preload.js");
  const probeHtml = path.join(tmpDir, "preload-probe.html");
  fs.writeFileSync(probeHtml, "<!DOCTYPE html><html data-theme-base='dark'><body>x</body></html>");
  const win2 = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: notesPreload,
    },
  });
  await win2.loadFile(probeHtml);
  const p = await win2.webContents.executeJavaScript(
    `({ myApp: typeof window.myApp, moduleId: window.myApp && window.myApp.moduleId, themes: typeof window.myAppThemes })`
  );

  const checks = [
    { name: "css light body changed", ok: r.changed },
    { name: "css soft pill", ok: r.softPill },
    { name: "no runtime required", ok: r.hasRuntime === "undefined" },
    { name: "notes preload myApp", ok: p.myApp === "object" && p.moduleId === "notes" },
    { name: "notes no myAppThemes", ok: p.themes === "undefined" },
  ];
  const failed = checks.filter((c) => !c.ok);
  console.log(JSON.stringify({ r, p, checks }, null, 2));
  if (failed.length) {
    console.error("FAIL", failed.map((f) => f.name).join("; "));
    app.exit(1);
    return;
  }
  console.log("OK: CSS-only themes + clean notes preload");
  app.exit(0);
});