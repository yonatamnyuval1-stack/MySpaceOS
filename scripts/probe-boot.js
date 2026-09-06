const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const root = path.join(__dirname, "..");

const DEFAULT_CONFIG_PATH = path.join(root, "config", "apps.json");
function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}
function loadDefaultConfig() {
  return readJson(DEFAULT_CONFIG_PATH);
}
function getUserConfigPath() {
  return path.join(root, "config", "user-config.json");
}
function mergeConfigWithDefaults(userConfig, defaultConfig) {
  const userApps = Array.isArray(userConfig?.apps) ? userConfig.apps : [];
  const defaultApps = Array.isArray(defaultConfig?.apps) ? defaultConfig.apps : [];
  const removedIds = new Set(Array.isArray(userConfig?.removedAppIds) ? userConfig.removedAppIds : []);
  const knownIds = new Set(userApps.map((a) => a.id));
  const mergedApps = [...userApps];
  for (const a of defaultApps) {
    if (knownIds.has(a.id) || removedIds.has(a.id)) continue;
    mergedApps.push(a);
  }
  return {
    ...defaultConfig,
    ...userConfig,
    apps: mergedApps,
    removedAppIds: [...removedIds],
    positions: userConfig?.positions || defaultConfig?.positions || {},
  };
}
function loadActiveConfig() {
  const defaults = loadDefaultConfig();
  const userPath = getUserConfigPath();
  if (fs.existsSync(userPath)) return mergeConfigWithDefaults(readJson(userPath), defaults);
  return defaults;
}

ipcMain.handle("get-config", () => loadActiveConfig());
ipcMain.handle("save-user-data", (_e, data) => {
  fs.writeFileSync(getUserConfigPath(), JSON.stringify(data, null, 2), "utf-8");
  return { ok: true };
});
ipcMain.handle("shell-engine", async () => ({}));
ipcMain.handle("ai-chat", async () => ({}));
ipcMain.handle("embed-app", async () => ({ ok: false }));
ipcMain.handle("resolve-app-icon", async () => null);
ipcMain.handle("scan-installed-apps", async () => []);
ipcMain.handle("get-defaults", () => loadDefaultConfig());

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    backgroundColor: "#0a0e14",
    webPreferences: {
      preload: path.join(root, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  const logs = [];
  win.webContents.on("console-message", (_e, level, message, line, sourceId) => {
    logs.push([level, String(message), String(sourceId || ""), line]);
  });
  await win.loadFile(path.join(root, "src", "index.html"));
  await new Promise((r) => setTimeout(r, 3500));
  const snap = await win.webContents.executeJavaScript(`(async () => {
    const cfg = await window.mySpace.getConfig();
    return {
      tiles: document.querySelectorAll('.app-tile').length,
      apps: window.MySpaceConfig.getApps().length,
      title: window.MySpaceConfig.getSettings().title,
      wallpaper: window.MySpaceConfig.getSettings().wallpaper,
      shellBg: getComputedStyle(document.querySelector('.shell')).backgroundColor,
      shellImg: getComputedStyle(document.querySelector('.shell')).backgroundImage.slice(0, 80),
      taskbar: !!document.querySelector('.taskbar'),
      gridHidden: document.getElementById('app-grid').classList.contains('hidden'),
      cfgApps: cfg && cfg.apps ? cfg.apps.length : -1,
      toasts: [...document.querySelectorAll('.toast')].map(t => t.textContent)
    };
  })()`);
  console.log("SNAP", JSON.stringify(snap, null, 2));
  console.log("ERRS");
  logs.filter((l) => l[0] >= 2).forEach((l) => console.log(JSON.stringify(l)));
  app.exit(snap.tiles > 0 ? 0 : 1);
});
setTimeout(() => {
  console.log("TIMEOUT");
  app.exit(2);
}, 15000);
