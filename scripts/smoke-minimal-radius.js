const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

const tmpDir = path.join(__dirname, "..", ".tmp-theme-smoke");
const tmpHtml = path.join(tmpDir, "minimal-btn.html");
const css = fs.readFileSync(path.join(__dirname, "..", "apps", "world-clock", "styles.css"), "utf8");

app.whenReady().then(async () => {
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(
    tmpHtml,
    `<!DOCTYPE html>
<html><head>
<style>
:root { --radius: 10px; --accent: #c9a84a; --accent-dim: rgba(201,168,74,.22); --bg-elevated:#1a2030; --border-strong:#3a4560; --border:#2a3348; --text:#eee; --text-muted:#aaa; }
${css}
</style>
</head><body>
<button class="btn btn-primary" id="p">P</button>
<div class="btn btn-primary" id="d">D</div>
<button id="bare">Bare</button>
</body></html>`,
    "utf8"
  );

  const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true } });
  await win.loadURL(pathToFileURL(tmpHtml).href);

  const result = await win.webContents.executeJavaScript(`(() => {
    const p = document.getElementById("p");
    const d = document.getElementById("d");
    const bare = document.getElementById("bare");

    const before = {
      p: getComputedStyle(p).borderRadius,
      d: getComputedStyle(d).borderRadius,
      bare: getComputedStyle(bare).borderRadius,
    };

    p.style.cssText = "border-radius: 40px !important; color: rgb(1,2,3) !important; background: rgb(4,5,6) !important;";
    d.style.cssText = "border-radius: 40px !important; color: rgb(1,2,3) !important; background: rgb(4,5,6) !important;";
    bare.style.cssText = "border-radius: 40px !important;";

    const styleAttr = p.getAttribute("style");
    const after = {
      pRad: getComputedStyle(p).borderRadius,
      pColor: getComputedStyle(p).color,
      pBg: getComputedStyle(p).backgroundColor,
      dRad: getComputedStyle(d).borderRadius,
      dColor: getComputedStyle(d).color,
      bareRad: getComputedStyle(bare).borderRadius,
      styleAttr,
      pStyleBorderRadius: p.style.borderRadius,
      pStylePriority: p.style.getPropertyPriority("border-radius"),
    };

    // Without clock CSS
    const clean = document.createElement("button");
    clean.id = "clean";
    clean.textContent = "C";
    document.body.appendChild(clean);
    clean.style.cssText = "border-radius: 40px !important;";
    after.cleanRad = getComputedStyle(clean).borderRadius;

    return { before, after };
  })()`);

  console.log(JSON.stringify(result, null, 2));
  app.exit(0);
});