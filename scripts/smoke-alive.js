const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const out = path.join(__dirname, "..", ".tmp-theme-smoke", "alive.txt");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, "boot\n");
app.whenReady().then(() => {
  fs.appendFileSync(out, "ready\n");
  const preload = path.join(__dirname, "..", "apps", "history", "preload.js");
  const win = new BrowserWindow({
    show: false,
    webPreferences: { preload, contextIsolation: true, nodeIntegration: false },
  });
  win
    .loadURL("data:text/html,<script>document.title=window.myApp?window.myApp.moduleId:'NONE'</script>")
    .then(async () => {
      const t = await win.webContents.executeJavaScript("document.title");
      fs.appendFileSync(out, "title=" + t + "\n");
      app.exit(t === "history" ? 0 : 1);
    })
    .catch((e) => {
      fs.appendFileSync(out, "err=" + e + "\n");
      app.exit(2);
    });
});