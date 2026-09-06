const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

const tmpDir = path.join(__dirname, "..", ".tmp-theme-smoke");
const tmpHtml = path.join(tmpDir, "clock-btn-smoke.html");
const runtimePath = path.join(__dirname, "..", "apps", "shared", "theme-runtime.js");
const css = fs.readFileSync(path.join(__dirname, "..", "apps", "world-clock", "styles.css"), "utf8");

async function measure(win, buttons) {
  return win.webContents.executeJavaScript(`(() => {
    window.MySpaceThemeRuntime.apply({ mode: "dark", buttons: ${JSON.stringify(buttons)} });
    void document.body.offsetHeight;
    const p = document.getElementById("p");
    const cs = getComputedStyle(p);
    const styleEl = document.getElementById("myspace-theme-buttons");
    return {
      buttons: ${JSON.stringify(buttons)},
      dataButtons: document.documentElement.getAttribute("data-buttons"),
      hasStyle: !!styleEl,
      radius: cs.borderRadius,
      color: cs.color,
      bg: cs.backgroundColor,
      border: cs.borderTopColor,
    };
  })()`);
}

app.whenReady().then(async () => {
  fs.mkdirSync(tmpDir, { recursive: true });
  const html = `<!DOCTYPE html>
<html lang="en" data-theme="dark" data-buttons="default">
<head>
<meta charset="UTF-8" />
<style id="app-css">
:root {
  --radius: 10px;
  --accent: #c9a84a;
  --accent-dim: rgba(201, 168, 74, 0.22);
  --bg-elevated: #1a2030;
  --bg-hover: #243049;
  --border-strong: #3a4560;
  --border: #2a3348;
  --text: #e8ecf4;
  --text-muted: #9aa3b5;
}
${css}
</style>
<script src="${pathToFileURL(runtimePath).href}?v=${Date.now()}"></script>
</head>
<body>
  <button class="btn btn-primary" id="p">Primary</button>
  <button class="btn btn-ghost" id="g">Ghost</button>
</body>
</html>`;
  fs.writeFileSync(tmpHtml, html, "utf8");

  const win = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  await win.loadURL(pathToFileURL(tmpHtml).href + "?v=" + Date.now());

  const def = await measure(win, "default");
  const soft = await measure(win, "soft");
  const solid = await measure(win, "solid");
  const outline = await measure(win, "outline");

  const softRad = parseFloat(soft.radius);
  const solidRad = parseFloat(solid.radius);
  const checks = [
    { name: "default clears style", ok: !def.hasStyle },
    { name: "soft injects style", ok: soft.hasStyle },
    { name: "soft pill radius", ok: softRad >= 20 },
    { name: "soft primary color changed", ok: soft.color !== def.color },
    { name: "soft primary bg changed", ok: soft.bg !== def.bg },
    { name: "solid smaller radius", ok: solidRad > 0 && solidRad <= 8 },
    { name: "outline transparent bg", ok: outline.bg === "rgba(0, 0, 0, 0)" || outline.bg === "transparent" },
    { name: "outline accent-ish border", ok: outline.border !== "rgba(0, 0, 0, 0)" && outline.border !== def.border },
  ];

  const failed = checks.filter((c) => !c.ok);
  console.log(JSON.stringify({ def, soft, solid, outline, checks }, null, 2));
  if (failed.length) {
    console.error("FAIL:", failed.map((f) => f.name).join("; "));
    app.exit(1);
    return;
  }
  console.log("OK: button themes apply");
  app.exit(0);
});