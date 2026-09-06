const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

const tmpDir = path.join(__dirname, "..", ".tmp-theme-smoke");
const tmpHtml = path.join(tmpDir, "apply-safe.html");
const chromeCss = fs.readFileSync(path.join(__dirname, "..", "apps", "shared", "theme-chrome.css"), "utf8");
const notesCss = fs.readFileSync(path.join(__dirname, "..", "apps", "notes", "styles.css"), "utf8");
const runtimeHref = pathToFileURL(path.join(__dirname, "..", "apps", "shared", "theme-runtime.js")).href;

app.whenReady().then(async () => {
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(
    tmpHtml,
    `<!DOCTYPE html>
<html data-theme="dark" data-buttons="default" data-theme-base="dark">
<head>
<style>${notesCss}</style>
<style>${chromeCss}</style>
<script src="${runtimeHref}"></script>
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
    window.myApp = { moduleId: "notes" };
    const before = getComputedStyle(document.body).backgroundColor;
    window.MySpaceThemeRuntime.apply({ mode: "light", buttons: "soft" });
    void document.body.offsetHeight;
    const after = getComputedStyle(document.body).backgroundColor;
    const rad = getComputedStyle(document.getElementById("p")).borderRadius;
    return {
      before,
      after,
      changed: before !== after,
      softPill: parseFloat(rad) >= 20,
      theme: document.documentElement.getAttribute("data-theme"),
      buttons: document.documentElement.getAttribute("data-buttons"),
    };
  })()`);

  console.log(JSON.stringify(r, null, 2));
  const ok = r.changed && r.softPill && r.theme === "light" && r.buttons === "soft";
  if (!ok) {
    console.error("FAIL");
    app.exit(1);
    return;
  }
  console.log("OK");
  app.exit(0);
});
