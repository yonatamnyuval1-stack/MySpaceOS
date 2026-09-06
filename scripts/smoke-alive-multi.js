const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");

const out = path.join(__dirname, "..", ".tmp-theme-smoke", "alive-multi.txt");
fs.mkdirSync(path.dirname(out), { recursive: true });
const ids = [
  "history",
  "space",
  "notes",
  "tasks",
  "profiles",
  "updates",
  "files",
  "builds",
  "mail",
  "pulse",
  "jobs",
  "storage",
  "backup",
  "chat",
  "docs",
];

app.whenReady().then(async () => {
  const lines = [];
  for (const id of ids) {
    const preload = path.join(__dirname, "..", "apps", id, "preload.js");
    if (!fs.existsSync(preload)) {
      lines.push(id + " MISSING_PRELOAD");
      continue;
    }
    const win = new BrowserWindow({
      show: false,
      webPreferences: { preload, contextIsolation: true, nodeIntegration: false },
    });
    try {
      await win.loadURL(
        "data:text/html,<script>document.title=JSON.stringify({has:!!window.myApp,id:window.myApp&&window.myApp.moduleId,inv:!!(window.myApp&&window.myApp.invoke),keys:window.myApp?Object.keys(window.myApp):[]})</script>"
      );
      const raw = await win.webContents.executeJavaScript("document.title");
      const p = JSON.parse(raw);
      const ok = !!(p.has && (p.inv || (p.keys && p.keys.length)));
      lines.push((ok ? "OK " : "FAIL ") + id + " " + raw);
    } catch (e) {
      lines.push("ERR " + id + " " + (e.message || e));
    }
    win.destroy();
  }
  fs.writeFileSync(out, lines.join("\n"));
  const failed = lines.filter((l) => l.startsWith("FAIL") || l.startsWith("ERR") || l.includes("MISSING"));
  app.exit(failed.length ? 1 : 0);
});