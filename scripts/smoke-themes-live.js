const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

const tmpDir = path.join(__dirname, "..", ".tmp-theme-smoke");
const tmpHtml = path.join(tmpDir, "notes-live-smoke.html");
const runtimePath = path.join(__dirname, "..", "apps", "shared", "theme-runtime.js");
const chromePath = path.join(__dirname, "..", "apps", "shared", "theme-chrome.css");
const notesCss = fs.readFileSync(path.join(__dirname, "..", "apps", "notes", "styles.css"), "utf8");
const chromeCss = fs.readFileSync(chromePath, "utf8");

app.whenReady().then(async () => {
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(
    tmpHtml,
    `<!DOCTYPE html>
<html lang="en" data-theme="dark" data-buttons="default">
<head>
<meta charset="UTF-8" />
<style>${notesCss}</style>
<style>${chromeCss}</style>
<script src="${pathToFileURL(runtimePath).href}?v=${Date.now()}"></script>
</head>
<body>
<div class="app-shell"><aside class="sidebar">Side</aside>
<main><button class="btn btn-primary" id="p">Save</button></main></div>
</body></html>`,
    "utf8"
  );

  const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true } });
  await win.loadURL(pathToFileURL(tmpHtml).href);

  const result = await win.webContents.executeJavaScript(`(() => {
    const p = document.getElementById("p");
    const side = document.querySelector(".sidebar");
    const darkBg = getComputedStyle(document.body).backgroundColor;
    const darkBtn = getComputedStyle(p).borderRadius;

    window.MySpaceThemeRuntime.apply({ mode: "light", buttons: "soft" });
    void document.body.offsetHeight;

    const lightBg = getComputedStyle(document.body).backgroundColor;
    const lightSide = getComputedStyle(side).backgroundColor;
    const softRad = getComputedStyle(p).borderRadius;
    const softColor = getComputedStyle(p).color;

    window.MySpaceThemeRuntime.apply({ mode: "dark", buttons: "outline" });
    void document.body.offsetHeight;
    const outlineBg = getComputedStyle(p).backgroundColor;
    const outlineBorder = getComputedStyle(p).borderTopColor;

    return {
      darkBg, lightBg, lightSide, darkBtn, softRad, softColor, outlineBg, outlineBorder,
      dataTheme: document.documentElement.getAttribute("data-theme"),
      dataButtons: document.documentElement.getAttribute("data-buttons"),
      lightChanged: lightBg !== darkBg,
      softPill: parseFloat(softRad) >= 20,
      outlineClear: outlineBg === "rgba(0, 0, 0, 0)" || outlineBg === "transparent",
    };
  })()`);

  const checks = [
    { name: "light body changed", ok: result.lightChanged },
    { name: "soft pill", ok: result.softPill },
    { name: "outline transparent", ok: result.outlineClear },
    { name: "attrs", ok: result.dataTheme === "dark" && result.dataButtons === "outline" },
  ];
  const failed = checks.filter((c) => !c.ok);
  console.log(JSON.stringify({ result, checks }, null, 2));
  if (failed.length) {
    console.error("FAIL", failed.map((f) => f.name).join("; "));
    app.exit(1);
    return;
  }
  console.log("OK: live light + buttons");
  app.exit(0);
});
