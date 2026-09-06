const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  nativeImage,
  dialog,
  globalShortcut,
} = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");
const { handleMyAppInvoke, startContractExpiryService } = require("./main/apps/ipc");
const { startCouponsExpiryService } = require("./main/apps/coupons-ipc");
const { handleMslInvoke } = require("./main/msl/broker");
const { handleJobsInvoke, startJobsService } = require("./main/jobs/broker");
const { handleSchedulerInvoke, startSchedulerService } = require("./main/scheduler/broker");
const { handleHostInvoke } = require("./main/apps/host-ipc");
const { handleAppBuilderInvoke, readRegistry } = require("./main/apps/app-builder-ipc");
const { userAppDir } = require("./main/apps/user-app-ipc");
const { handleMindInvoke, startMindService } = require("./main/mind/broker");
const { handleLinkInvoke } = require("./main/link/broker");
const { handlePartsInvoke } = require("./main/parts/broker");
const { handleAiChatInvoke, setAiChatMainWindowGetter } = require("./main/apps/ai-chat-ipc");
const { loadState, saveState, handleShellConsoleInvoke } = require("./main/apps/shell-console-ipc");
const { startReminderService } = require("./main/apps/contacts-ipc");
const { startDayPlannerReminderService } = require("./main/apps/day-planner-ipc");
const { startStocksAlertService } = require("./main/apps/stocks-ipc");
const { handleNotificationsInvoke } = require("./main/apps/notifications-center");
const { startUpdatesService, handleUpdatesInvoke } = require("./main/apps/updates-service");
const { startNetworkService, handleNetworkInvoke } = require("./main/apps/network-service");
const { handleStorageInvoke } = require("./main/apps/storage-ipc");
const { handleThemesInvoke } = require("./main/apps/themes-ipc");
const { handleResolveInvoke } = require("./main/resolve/broker");
const fault = require("./main/fault");
const { handleMailInvoke } = require("./main/mail/mail-ipc");
const { startMailSyncService } = require("./main/mail/mail-sync");
const { handleBackup, applyPendingBackupRestore } = require("./main/apps/backup-ipc");
const { handleAppLifecycle } = require("./main/apps/app-lifecycle-ipc");
const {
  handleSpaceFileInvoke,
  collectSpaceFilesFromArgv,
  registerProtocolClient,
} = require("./main/apps/space-file-ipc");
const { migrateLegacyUserData } = require("./main/apps/safe-json-store");
const { startWorldClockTimerService } = require("./main/apps/world-clock-ipc");
const { startDriftBackgroundService } = require("./main/drift-background");
const { startBuildsBackgroundService } = require("./main/builds-background");
const { scanInstalledPrograms } = require("./main/installed-apps");
const { getFileIconDataUrl } = require("./main/icon-cache");
const { launchExternalApp } = require("./main/launch");
const { focusExternalApp } = require("./main/focus-window");
const { shouldEmbedExecutable } = require("./main/app-rules");
const identity = require("./main/myspace-identity");
const profile = require("./main/myspace-profile");
const {
  startEmbeddedSession,
  updateSessionBounds,
  setSessionVisible,
  focusSession,
  stopSession,
  stopAllSessions,
  fallbackExternal,
  isEmbedAvailable,
} = require("./main/embed-session");

const DEFAULT_CONFIG_PATH = path.join(__dirname, "config", "apps.json");
const USER_DATA_DIR = path.join(app.getPath("appData"), "my-space");
app.setPath("userData", USER_DATA_DIR);
let mainWindow = null;
const spaceWindows = new Set();

function getFocusedSpaceWindow() {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && !focused.isDestroyed() && spaceWindows.has(focused)) return focused;
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;
  return [...spaceWindows].find((w) => w && !w.isDestroyed()) || null;
}

function getUserConfigPath() {
  const user = identity.getCurrentUser();
  if (user?.id) {
    return profile.profileScopedPath("user-config.json", user.id);
  }
  if (app.isPackaged) {
    return path.join(app.getPath("userData"), "user-config.json");
  }
  return path.join(__dirname, "config", "user-config.json");
}

function broadcastMyspaceIdentityChanged() {
  const payload = {
    user: identity.getCurrentUser(),
    signedIn: Boolean(identity.getCurrentUser()),
  };
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    try {
      win.webContents.send("myspace-identity-changed", payload);
    } catch {
    }
  }
}

async function applyIdentitySession(result) {
  if (!result?.ok || !result.user) return result;
  await profile.onIdentitySignedIn(result.user);
  await profile.notifyProfileSwitched();
  broadcastMyspaceIdentityChanged();
  return { ...result, profileDir: profile.profileDir(result.user.id) };
}

function loadActiveConfig() {
  const defaults = loadDefaultConfig();
  const userPath = getUserConfigPath();
  let merged;
  if (fs.existsSync(userPath)) {
    merged = mergeConfigWithDefaults(readJson(userPath), defaults);
  } else {
    merged = defaults;
  }
  return mergeUserBuiltApps(merged);
}

function normalizeUrl(raw) {
  let url = raw?.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url;
}

function isLocalDashboardUrl(raw) {
  try {
    const host = new URL(normalizeUrl(raw)).hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host.endsWith(".local") ||
      /^192\.168\.\d+\.\d+$/.test(host) ||
      /^10\.\d+\.\d+\.\d+$/.test(host)
    );
  } catch {
    return false;
  }
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function loadDefaultConfig() {
  return readJson(DEFAULT_CONFIG_PATH);
}

const RETIRED_APP_IDS = new Set([]);

function stripRetiredAppIds(ids) {
  if (!Array.isArray(ids)) return [];
  return ids.filter((id) => id && !RETIRED_APP_IDS.has(String(id)));
}

function mergeUserBuiltApps(config) {
  const base = config && typeof config === "object" ? config : { apps: [] };
  const apps = Array.isArray(base.apps) ? [...base.apps] : [];
  const known = new Set(apps.map((a) => a.id));
  try {
    const reg = readRegistry();
    for (const entry of reg.apps || []) {
      if (!entry?.id || known.has(entry.id)) continue;
      if (!fs.existsSync(userAppDir(entry.id))) continue;
      apps.push({
        id: entry.id,
        name: entry.name || entry.id,
        type: "myapp",
        module: entry.id,
        icon: entry.icon || "📦",
        description: entry.description || `User-built app — ${entry.id}`,
        userBuilt: true,
      });
      known.add(entry.id);
    }
  } catch {
  }
  return { ...base, apps };
}

function mergeConfigWithDefaults(userConfig, defaultConfig) {
  const userApps = Array.isArray(userConfig?.apps) ? userConfig.apps : [];
  const defaultApps = Array.isArray(defaultConfig?.apps) ? defaultConfig.apps : [];
  const removedIds = new Set(
    Array.isArray(userConfig?.removedAppIds) ? userConfig.removedAppIds : []
  );
  RETIRED_APP_IDS.forEach((id) => removedIds.add(id));
  removedIds.delete("msl-protocol");
  const defaultsById = new Map(defaultApps.map((a) => [a.id, a]));
  const knownIds = new Set(userApps.map((a) => a.id));
  const mergedApps = userApps
    .filter((app) => app && !RETIRED_APP_IDS.has(app.id))
    .map((app) => {
      const def = defaultsById.get(app.id);
      if (!def || def.type !== "myapp") return app;
      const next = {
        ...app,
        name: def.name || app.name,
        module: def.module || app.module,
        description: def.description != null ? def.description : app.description,
        icon: def.icon != null ? def.icon : app.icon,
        iconUrl: def.iconUrl != null ? def.iconUrl : app.iconUrl,
        iconPath: def.iconPath != null ? def.iconPath : app.iconPath,
        iconData: def.iconData != null ? def.iconData : app.iconData,
      };
      if (def.hidden === true || app.hidden === true) next.hidden = true;
      else delete next.hidden;
      return next;
    });
  for (const app of defaultApps) {
    if (knownIds.has(app.id) || removedIds.has(app.id) || RETIRED_APP_IDS.has(app.id)) continue;
    mergedApps.push(app);
  }
  const desktopSpaces = userConfig?.desktopSpaces || defaultConfig?.desktopSpaces;
  let nextSpaces = desktopSpaces;
  if (desktopSpaces && Array.isArray(desktopSpaces.spaces)) {
    nextSpaces = {
      ...desktopSpaces,
      spaces: desktopSpaces.spaces.map((space) => ({
        ...space,
        taskbarPins: stripRetiredAppIds(space.taskbarPins),
      })),
    };
  }
  return {
    ...defaultConfig,
    ...userConfig,
    apps: mergedApps,
    removedAppIds: [...removedIds],
    taskbarPins: stripRetiredAppIds(
      userConfig?.taskbarPins || defaultConfig?.taskbarPins || []
    ),
    desktopSpaces: nextSpaces,
    positions: userConfig?.positions || defaultConfig?.positions || {},
  };
}

function expandEnvVars(target) {
  return target.replace(/%([^%]+)%/g, (_, name) => process.env[name] || `%${name}%`);
}

function faviconUrlForSite(siteUrl) {
  try {
    const host = new URL(siteUrl).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=128`;
  } catch {
    return null;
  }
}

function resolveExternalPath(target) {
  const expanded = expandEnvVars(target);
  if (path.isAbsolute(expanded)) {
    return expanded;
  }
  const system32 = path.join(process.env.WINDIR || "C:\\Windows", "System32", expanded);
  if (fs.existsSync(system32)) {
    return system32;
  }
  return expanded;
}

function findExecutable(appEntry) {
  const candidates = appEntry.paths || (appEntry.path ? [appEntry.path] : []);
  for (const candidate of candidates) {
    const resolved = resolveExternalPath(candidate);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }
  if (candidates.length > 0) {
    return resolveExternalPath(candidates[0]);
  }
  return null;
}

async function resolveAppIcon(appEntry) {
  if (appEntry.iconData) {
    return appEntry.iconData;
  }

  if (appEntry.iconUrl) {
    return appEntry.iconUrl;
  }

  if (appEntry.iconPath) {
    const full = path.join(__dirname, appEntry.iconPath);
    if (fs.existsSync(full)) {
      return nativeImage.createFromPath(full).toDataURL();
    }
  }

  if (appEntry.type === "external") {
    const exePath = findExecutable(appEntry);
    if (exePath) {
      return getFileIconDataUrl(exePath);
    }
  }

  if (appEntry.type === "url" && appEntry.url) {
    return faviconUrlForSite(appEntry.url);
  }

  return null;
}

const {
  resolveLoginEntryUrl,
  resolveAppEntryUrl,
  prepareLocalAuth,
} = require("./main/apps/app-local-auth-ipc");

async function resolveMyApp(appEntry) {
  const moduleId = appEntry.module || appEntry.id;
  let appDir = path.join(__dirname, "apps", moduleId);
  const userDir = userAppDir(moduleId);
  if (!fs.existsSync(path.join(appDir, "index.html")) && fs.existsSync(path.join(userDir, "index.html"))) {
    appDir = userDir;
  }
  const manifestPath = path.join(appDir, "manifest.json");

  let entry = appEntry.entry || "index.html";
  let contentRoot = appDir;
  let manifest = null;
  if (fs.existsSync(manifestPath)) {
    manifest = readJson(manifestPath);
    entry = manifest.entry || entry;
    if (manifest.contentRoot) {
      contentRoot = path.resolve(appDir, manifest.contentRoot);
    }
  }

  const preloadPath = path.join(appDir, "preload.js");
  const preloadFile = fs.existsSync(preloadPath) ? pathToFileURL(preloadPath).href : null;

  if (manifest?.auth?.type === "local") {
    const auth = await prepareLocalAuth(moduleId);
    await auth.tryRestoreSession();
    const signedIn = Boolean(auth.getCurrentUser());
    let targetUrl = signedIn ? resolveAppEntryUrl(moduleId) : resolveLoginEntryUrl(moduleId);
    let launchPreload = preloadFile;

    if (!signedIn && targetUrl && /\/shared\/local-auth\/login\.html/i.test(targetUrl)) {
      const sharedPreload = path.join(__dirname, "apps", "shared", "local-auth", "preload.js");
      if (fs.existsSync(sharedPreload)) {
        launchPreload = pathToFileURL(sharedPreload).href;
      }
    }

    if (targetUrl) {
      return {
        ok: true,
        mode: "myapp",
        url: targetUrl,
        preload: launchPreload,
        module: moduleId,
      };
    }
  }

  const entryPath = path.join(contentRoot, entry);
  if (!fs.existsSync(entryPath)) {
    return { ok: false, error: `App "${moduleId}" is not installed` };
  }

  return {
    ok: true,
    mode: "myapp",
    url: pathToFileURL(entryPath).href,
    preload: preloadFile,
    module: moduleId,
  };
}

function parseStartupShellRun(argv = process.argv.slice(1)) {
  const eqArg = argv.find((a) => a.startsWith("--run="));
  if (eqArg) return eqArg.slice(6).trim();
  const idx = argv.indexOf("--run");
  if (idx < 0) return null;
  const parts = [];
  for (let i = idx + 1; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("-") && a !== "-") break;
    parts.push(a);
  }
  return parts.join(" ").trim() || null;
}

let pendingStartupShellRun = parseStartupShellRun();
let pendingSpaceFiles = collectSpaceFilesFromArgv(process.argv);
const gotSingleInstanceLock = app.isPackaged ? app.requestSingleInstanceLock() : true;
if (!gotSingleInstanceLock) {
  app.quit();
}

function deliverSpaceFiles(filePaths) {
  const files = (filePaths || []).filter(Boolean);
  if (!files.length) return;
  const win = getFocusedSpaceWindow() || mainWindow;
  if (!win || win.isDestroyed()) {
    pendingSpaceFiles.push(...files);
    return;
  }
  const send = () => {
    if (win.isDestroyed()) {
      pendingSpaceFiles.push(...files);
      return;
    }
    if (win.isMinimized()) win.restore();
    win.focus();
    win.webContents.send("space-file-open", { paths: files });
  };
  if (win.webContents.isLoading()) {
    win.webContents.once("did-finish-load", () => setTimeout(send, 600));
  } else {
    send();
  }
}

if (gotSingleInstanceLock) {
  app.on("second-instance", (_event, argv) => {
    const files = collectSpaceFilesFromArgv(argv);
    if (files.length) deliverSpaceFiles(files);
    const win = getFocusedSpaceWindow() || mainWindow;
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

function createWindow(options = {}) {
  const win = new BrowserWindow({
    width: options.width || 1366,
    height: options.height || 768,
    minWidth: 960,
    minHeight: 600,
    title: options.secondary ? "My Space — Window" : "My Space",
    backgroundColor: "#0a0e14",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });

  win.once("ready-to-show", () => {
    if (!win.isDestroyed()) win.show();
  });

  spaceWindows.add(win);
  win.on("closed", () => {
    spaceWindows.delete(win);
    if (mainWindow === win) {
      mainWindow = [...spaceWindows].find((w) => w && !w.isDestroyed()) || null;
      setAiChatMainWindowGetter(() => getFocusedSpaceWindow() || mainWindow);
    }
  });

  win.loadFile(path.join(__dirname, "src", "index.html"), {
    query: options.secondary ? { secondary: "1" } : {},
  });

  win.webContents.once("did-finish-load", () => {
    setTimeout(() => {
      if (win.isDestroyed()) return;
      win.webContents
        .executeJavaScript(
          "({ tiles: document.querySelectorAll('.app-tile').length, apps: window.MySpaceConfig?.getApps?.()?.length ?? -1, err: document.body?.dataset?.bootError || null })"
        )
        .then((snap) => console.log("[boot-check]", JSON.stringify(snap)))
        .catch((err) => console.error("[boot-check-fail]", String(err)));
    }, 2500);
  });

  if (!options.secondary && pendingSpaceFiles.length) {
    const files = pendingSpaceFiles.slice();
    pendingSpaceFiles = [];
    win.webContents.once("did-finish-load", () => {
      setTimeout(() => {
        if (win.isDestroyed()) return;
        win.webContents.send("space-file-open", { paths: files });
      }, 900);
    });
  }

  if (!options.secondary && pendingStartupShellRun) {
    const shellLine = pendingStartupShellRun;
    pendingStartupShellRun = null;
    win.webContents.once("did-finish-load", () => {
      setTimeout(() => {
        if (win.isDestroyed()) return;
        const safe = JSON.stringify(shellLine);
        win.webContents
          .executeJavaScript(
            "(async () => window.MySpaceShellBridge?.executeCommand?.(" + safe + ", 'cli'))()"
          )
          .catch(() => {});
      }, 900);
    });
  }

  win.webContents.on("render-process-gone", (_event, details) => {
    if (details.reason === "crashed" || details.reason === "oom") {
      win.reload();
    }
  });

  win.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F11" && input.type === "keyDown") {
      win.setFullScreen(!win.isFullScreen());
    }
    if (input.control && input.shift && input.key === "I" && input.type === "keyDown") {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  if (!options.secondary || !mainWindow || mainWindow.isDestroyed()) {
    mainWindow = win;
  }
  setAiChatMainWindowGetter(() => getFocusedSpaceWindow() || mainWindow);
  return win;
}

ipcMain.handle("get-config", async () => {
  try {
    await identity.tryRestoreSession();
    const cfg = loadActiveConfig();
    if (!cfg || typeof cfg !== "object") {
      console.error("get-config produced invalid config, falling back to defaults");
      return loadDefaultConfig();
    }
    return cfg;
  } catch (err) {
    console.error("get-config failed:", err);
    try {
      return loadDefaultConfig();
    } catch (err2) {
      console.error("loadDefaultConfig failed:", err2);
      return { title: "My Space", subtitle: "", wallpaper: "gradient", apps: [], positions: {}, removedAppIds: [] };
    }
  }
});
ipcMain.handle("get-defaults", () => loadDefaultConfig());
ipcMain.handle("save-user-data", async (_event, data) => {
  await identity.tryRestoreSession();
  const userPath = getUserConfigPath();
  fs.mkdirSync(path.dirname(userPath), { recursive: true });
  fs.writeFileSync(userPath, JSON.stringify(data, null, 2), "utf-8");
  return { ok: true };
});
ipcMain.handle("reset-user-data", async () => {
  await identity.tryRestoreSession();
  const userPath = getUserConfigPath();
  if (fs.existsSync(userPath)) {
    fs.unlinkSync(userPath);
  }
  return { ok: true };
});

ipcMain.handle("myspace-identity", async (_event, action, args = {}) => {
  try {
    switch (String(action || "")) {
      case "status":
        return await identity.authStatus();
      case "current":
        await identity.tryRestoreSession();
        return identity.getCurrentUser();
      case "register": {
        const result = await identity.register(args.username, args.password, args.remember !== false);
        return applyIdentitySession(result);
      }
      case "login": {
        const result = await identity.login(args.username, args.password, Boolean(args.remember));
        return applyIdentitySession(result);
      }
      case "logout": {
        await identity.logout();
        await profile.notifyProfileSwitched();
        broadcastMyspaceIdentityChanged();
        return { ok: true };
      }
      default:
        return { ok: false, error: `Unknown myspace-identity action: ${action}` };
    }
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
});
ipcMain.handle("resolve-app-icon", (_event, appEntry) => resolveAppIcon(appEntry));

ipcMain.handle("scan-installed-apps", async () => {
  const programs = scanInstalledPrograms();
  const slice = programs.slice(0, 400);
  const withIcons = await Promise.all(
    slice.map(async (program) => ({
      ...program,
      iconData: await getFileIconDataUrl(program.paths[0]),
    }))
  );
  return withIcons;
});

ipcMain.handle("validate-external-app", async (_event, data) => {
  const paths = data.paths || [];
  const target = findExecutable({ paths });
  if (!target || !fs.existsSync(target)) {
    return {
      ok: false,
      error: `Program not found: ${paths[0] || "(no path)"}. Use Browse and select the .exe file.`,
    };
  }
  return {
    ok: true,
    paths: [target],
    iconData: await getFileIconDataUrl(target),
  };
});

ipcMain.handle("pick-executable", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    title: "Choose a program",
    filters: [
      { name: "Programs", extensions: ["exe", "bat", "cmd"] },
      { name: "All files", extensions: ["*"] },
    ],
    properties: ["openFile"],
  });

  if (result.canceled || !result.filePaths.length) {
    return { canceled: true };
  }

  const filePath = result.filePaths[0];
  return {
    canceled: false,
    name: path.basename(filePath).replace(/\.(exe|bat|cmd)$/i, ""),
    paths: [filePath],
    iconData: await getFileIconDataUrl(filePath),
  };
});

async function prepareForExternalHandoff(win) {
  const target = win && !win.isDestroyed?.() ? win : mainWindow;
  if (!target || target.isDestroyed?.()) return;
  if (target.isFullScreen()) {
    target.setFullScreen(false);
    await new Promise((r) => setTimeout(r, 150));
  }
}

ipcMain.handle("focus-external-app", async (event, exePath) => {
  if (!exePath) {
    return { ok: false, error: "No program path" };
  }
  const win = BrowserWindow.fromWebContents(event.sender);
  await prepareForExternalHandoff(win);
  return focusExternalApp(exePath);
});

ipcMain.handle("embed-app", async (event, action, args = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  switch (action) {
    case "available":
      return { ok: true, available: isEmbedAvailable() };
    case "start":
      return startEmbeddedSession(win, args);
    case "updateBounds":
      return updateSessionBounds(args.id, win, args.bounds);
    case "setVisible":
      return setSessionVisible(args.id, !!args.visible, args.focus ? win : null);
    case "focus":
      return focusSession(args.id, win);
    case "stop":
      return stopSession(args.id, { close: args.close !== false });
    case "fallbackExternal":
      return fallbackExternal(win, args);
    default:
      return { ok: false, error: `Unknown embed-app action: ${action}` };
  }
});

ipcMain.handle("open-system-url", async (_event, url) => {
  const normalized = normalizeUrl(url);
  if (!normalized) {
    return { ok: false, error: "Invalid URL" };
  }
  await shell.openExternal(normalized);
  return { ok: true, url: normalized };
});

ipcMain.handle("resolve-app-path", async (_event, appEntry) => {
  if (!appEntry || typeof appEntry !== "object") {
    return { ok: false, error: "Invalid app" };
  }

  if (appEntry.type === "myapp") {
    const moduleId = appEntry.module || appEntry.id;
    const appDir = path.join(__dirname, "apps", moduleId);
    if (!fs.existsSync(appDir)) {
      return { ok: false, error: `App folder not found (${moduleId})` };
    }
    return { ok: true, path: appDir, kind: "folder" };
  }


  if (appEntry.type === "external") {
    const target = findExecutable(appEntry);
    if (!target) {
      return { ok: false, error: "Program not found" };
    }
    return { ok: true, path: target, kind: "file" };
  }

  return { ok: false, error: "No path for this shortcut type" };
});

ipcMain.handle("reveal-path", async (_event, targetPath, kind) => {
  if (!targetPath || typeof targetPath !== "string") {
    return { ok: false, error: "Invalid path" };
  }
  if (!fs.existsSync(targetPath)) {
    return { ok: false, error: "Path not found" };
  }

  if (kind === "folder") {
    const err = await shell.openPath(targetPath);
    return err ? { ok: false, error: err } : { ok: true };
  }

  shell.showItemInFolder(targetPath);
  return { ok: true };
});

ipcMain.handle("backup", async (event, action, args) => {
  return handleBackup(action, args || {}, event);
});

ipcMain.handle("space-file", async (event, action, args) => {
  try {
    return await handleSpaceFileInvoke(action, args || {}, event);
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
});

ipcMain.handle("shell-engine", async (_event, action, args) => {
  if (action === "load") return loadState();
  if (action === "save") return saveState(args);
  if (action === "execute") {
    return handleShellConsoleInvoke("command.run", { ...(args || {}), source: "desktop" });
  }
  return { ok: false, error: `Unknown shell-engine action: ${action}` };
});

ipcMain.handle("myapp-invoke", async (event, moduleId, channel, args) => {
  try {
    return await fault.runObserved(moduleId, channel, () =>
      handleMyAppInvoke(moduleId, channel, args, event)
    );
  } catch (err) {
    const msg = err?.message || String(err);
    if (moduleId === "mail" && channel === "accounts.connect" && /destroyed/i.test(msg)) {
      return {
        ok: false,
        error: "Sign-in finished but the Mail window refreshed: checking account…",
        interrupted: true,
      };
    }
    throw err;
  }
});

ipcMain.handle("msl", async (_event, channel, args) => {
  return fault.runObserved("msl", channel, () => handleMslInvoke("desktop", channel, args || {}));
});

ipcMain.handle("jobs", async (_event, channel, args) => {
  return fault.runObserved("jobs", channel, () => handleJobsInvoke("desktop", channel, args || {}));
});

ipcMain.handle("scheduler", async (_event, channel, args) => {
  return fault.runObserved("scheduler", channel, () =>
    handleSchedulerInvoke("desktop", channel, args || {})
  );
});

ipcMain.handle("host", async (_event, channel, args) => {
  return fault.runObserved("host", channel, () => handleHostInvoke(channel, args || {}));
});

ipcMain.handle("app-builder", async (_event, channel, args) => {
  return fault.runObserved("app-builder", channel, () => handleAppBuilderInvoke(channel, args || {}));
});

ipcMain.handle("mind", async (_event, channel, args) => {
  return fault.runObserved("mind", channel, () => handleMindInvoke("desktop", channel, args || {}));
});

ipcMain.handle("link", async (event, channel, args) => {
  return fault.runObserved("link", channel, () =>
    handleLinkInvoke("desktop", channel, args || {}, event)
  );
});

ipcMain.handle("resolve", async (_event, channel, args) => {
  return handleResolveInvoke("desktop", channel, args || {});
});

ipcMain.handle("parts", async (_event, channel, args) => {
  return fault.runObserved("parts", channel, () => handlePartsInvoke(channel, args || {}));
});

ipcMain.handle("ai-chat", async (event, action, args) => {
  return fault.runObserved("ai-chat", action, () => handleAiChatInvoke(action, args || {}, event));
});

ipcMain.handle("launch-app", async (_event, appEntry) => {
  if (appEntry.type === "builtin") {
    return { ok: true, mode: "builtin", builtin: appEntry.id };
  }

  if (appEntry.type === "myapp") {
    return await resolveMyApp(appEntry);
  }

  if (appEntry.type === "url") {
    const url = normalizeUrl(appEntry.url);
    if (!url) {
      return { ok: false, error: "URL is missing" };
    }
    return { ok: true, mode: "webview", url, forceInApp: true };
  }

  if (appEntry.type === "external") {
    const target = findExecutable(appEntry);
    if (!target) {
      return { ok: false, error: "App not found. remove it and add again via Start" };
    }

    const inAppUrl = normalizeUrl(appEntry.inAppUrl);
    if (inAppUrl && isLocalDashboardUrl(inAppUrl)) {
      return { ok: true, mode: "webview", url: inAppUrl, forceInApp: true };
    }

    const iconData = await resolveAppIcon(appEntry);
    const openMode = String(appEntry.openMode || "workspace").toLowerCase();
    const canEmbed = isEmbedAvailable() && shouldEmbedExecutable(target);

    // Shared external-shell protocol for anything that cannot live inside a My Space tab.
    if (openMode === "external" || !canEmbed) {
      return {
        ok: true,
        mode: "external",
        path: target,
        iconData,
        protocol: "external-shell",
        autoLaunch: true,
      };
    }

    return {
      ok: true,
      mode: "embedded",
      path: target,
      iconData,
    };
  }

  return { ok: false, error: "Unknown app type" };
});

const { desktopSearch } = require("./main/apps/desktop-search");
const { getMyspaceBrowserHome } = require("./main/mail/hub-service");

ipcMain.handle("desktop-search", async (_event, query) => {
  try {
    return await desktopSearch(query);
  } catch (err) {
    return { ok: false, error: err?.message || String(err), results: [] };
  }
});

ipcMain.handle("myspace-browser-home", async () => {
  try {
    return getMyspaceBrowserHome();
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
});

ipcMain.handle("open-new-window", () => {
  const win = createWindow({ secondary: true });
  return { ok: true, id: win.id };
});

ipcMain.handle("app-lifecycle", async (_event, action) => {
  try {
    return handleAppLifecycle(action);
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
});

const { handleShellUx } = require("./main/apps/shell-ux-ipc");
ipcMain.handle("shell-ux", async (_event, channel, args) => {
  try {
    return await handleShellUx(channel, args || {});
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
});

ipcMain.handle("notifications", async (_event, channel, args) => {
  try {
    return await handleNotificationsInvoke(channel, args || {});
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
});

ipcMain.handle("updates", async (_event, channel, args) => {
  try {
    return await handleUpdatesInvoke(channel, args || {});
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
});

ipcMain.handle("network", async (_event, channel, args) => {
  try {
    return await handleNetworkInvoke(channel, args || {});
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
});

ipcMain.handle("storage", async (_event, channel, args) => {
  try {
    return await handleStorageInvoke(channel, args || {});
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
});

ipcMain.handle("themes", async (_event, channel, args) => {
  try {
    return await handleThemesInvoke(channel, args || {});
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
});

ipcMain.handle("mail", async (_event, action, args) => {
  try {
    return await handleMailInvoke(action, args || {});
  } catch (err) {
    const msg = err?.message || String(err);
    if (action === "accounts.connect" && /destroyed/i.test(msg)) {
      return {
        ok: false,
        error: "Sign-in finished but the Mail window refreshed: checking account…",
        interrupted: true,
      };
    }
    return { ok: false, error: msg };
  }
});

app.whenReady().then(async () => {
  try {
    fault.install({ ipcMain });
  } catch (err) {
    console.error("Fault protocol install failed:", err);
  }
  try {
    await identity.tryRestoreSession();
  } catch (err) {
    console.error("My Space identity restore failed:", err);
  }
  registerProtocolClient();
  try {
    migrateLegacyUserData();
  } catch (err) {
    console.error("Legacy userData migrate failed:", err);
  }
  try {
    await applyPendingBackupRestore();
  } catch (err) {
    console.error("Backup restore failed:", err);
  }

  createWindow();
  startReminderService();
  startDayPlannerReminderService();
  startContractExpiryService();
  startCouponsExpiryService();
  startStocksAlertService();
  startWorldClockTimerService();
  startDriftBackgroundService(() => getFocusedSpaceWindow() || mainWindow);
  startBuildsBackgroundService();
  startUpdatesService();
  startNetworkService();
  startMailSyncService();
  startJobsService();
  startSchedulerService();
  startMindService();

  try {
    require("./main/mail/hub-sessions").initConnectSessions();
  } catch (err) {
    console.warn("Connect session harden failed:", err?.message || err);
  }

  const emitToFocused = (channel) => {
    const win = getFocusedSpaceWindow();
    if (!win || win.isDestroyed()) return;
    if (win.isMinimized()) win.restore();
    win.focus();
    win.webContents.send(channel);
  };
  try {
    globalShortcut.register("CommandOrControl+K", () => emitToFocused("shell-hotkey"));
    globalShortcut.register("CommandOrControl+Shift+Space", () => emitToFocused("shell-hotkey"));
    globalShortcut.register("CommandOrControl+/", () => emitToFocused("shortcuts-hotkey"));
  } catch (err) {
    console.warn("globalShortcut register failed:", err?.message || err);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  stopAllSessions({ close: true });
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("before-quit", () => {
  stopAllSessions({ close: true });
});