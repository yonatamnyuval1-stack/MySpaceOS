const path = require("path");
const Module = require("module");
const root = path.join(__dirname, "..");

process.chdir(root);

const electron = require("electron");
const { app, BrowserWindow } = electron;

const logs = [];
const orig = BrowserWindow;
function PatchedBrowserWindow(options) {
  const win = new orig(options);
  win.webContents.on("console-message", (_e, level, message, line, sourceId) => {
    logs.push({ level, message: String(message), line, sourceId: String(sourceId || "") });
  });
  win.webContents.on("did-finish-load", async () => {
    try {
      await new Promise((r) => setTimeout(r, 2500));
      const snapshot = await win.webContents.executeJavaScript(`({
        title: document.title,
        tileCount: document.querySelectorAll('.app-tile').length,
        apps: window.MySpaceConfig?.getApps?.()?.length ?? -1,
        wallpaper: window.MySpaceConfig?.getSettings?.()?.wallpaper ?? null,
        shellBg: getComputedStyle(document.querySelector('.shell')).backgroundColor,
        taskbarVisible: !!(document.querySelector('.taskbar') && getComputedStyle(document.querySelector('.taskbar')).display !== 'none'),
        appGridHidden: document.getElementById('app-grid')?.classList.contains('hidden') === true,
        errorToast: [...document.querySelectorAll('.toast')].map(t => t.textContent)
      })`);
      console.log("===SNAPSHOT===");
      console.log(JSON.stringify(snapshot, null, 2));
      console.log("===LOGS===");
      logs
        .filter((l) => l.level >= 2 || /error|Error|TypeError|failed/i.test(l.message))
        .forEach((l) => console.log(JSON.stringify(l)));
      app.exit(0);
    } catch (err) {
      console.log("===PROBE_FAIL===");
      console.log(String(err));
      logs.slice(-30).forEach((l) => console.log(JSON.stringify(l)));
      app.exit(1);
    }
  });
  return win;
}
PatchedBrowserWindow.getAllWindows = orig.getAllWindows.bind(orig);
PatchedBrowserWindow.fromId = orig.fromId.bind(orig);
PatchedBrowserWindow.fromWebContents = orig.fromWebContents.bind(orig);

electron.BrowserWindow = PatchedBrowserWindow;

require(path.join(root, "main.js"));

setTimeout(() => {
  console.log("===TIMEOUT===");
  logs.slice(-40).forEach((l) => console.log(JSON.stringify(l)));
  app.exit(2);
}, 20000);