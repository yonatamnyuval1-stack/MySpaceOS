const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, ".tmp-theme-smoke", "preload-probe.json");

app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("no-sandbox");

app.whenReady().then(async () => {
  const results = [];
  for (const id of ["history", "notes", "space", "updates", "files", "tasks"]) {
    const preload = path.join(ROOT, "apps", id, "preload.js");
    const html = path.join(ROOT, ".tmp-theme-smoke", "one.html");
    fs.mkdirSync(path.dirname(html), { recursive: true });
    fs.writeFileSync(
      html,
      "<!doctype html><script>window.__p={has:!!window.myApp,id:window.myApp&&window.myApp.moduleId,inv:!!(window.myApp&&window.myApp.invoke)}</script>"
    );
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        preload,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });
    try {
      await win.loadFile(html);
      await new Promise((r) => setTimeout(r, 250));
      const p = await win.webContents.executeJavaScript("window.__p");
      results.push({ id, ok: !!(p && p.has && (p.inv || p.id)), p });
    } catch (e) {
      results.push({ id, ok: false, error: String(e.message || e) });
    }
    try {
      win.destroy();
    } catch {
    }
  }
  fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
  process.stdout.write(JSON.stringify(results) + "\n");
  app.exit(results.some((r) => !r.ok) ? 1 : 0);
});
