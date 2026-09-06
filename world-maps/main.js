const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const auth = require("./auth");
const { registerGeminiIpc } = require("./gemini-ipc");

const NOMINATIM = "https://nominatim.openstreetmap.org";
const USER_AGENT = "WorldMaps/0.1 (personal desktop; contact: local)";

let mainWindow = null;

const SETTINGS_DEFAULTS = {
  language: "en",
  showMapHint: true,
  showNoteLabels: true,
  showZoomControls: true,
  confirmDelete: true,
};

function userDataRoot() {
  return app.getPath("userData");
}

async function loadNotesFile() {
  try {
    const raw = JSON.parse(await fs.promises.readFile(auth.notesPath(userDataRoot()), "utf8"));
    return Array.isArray(raw?.notes) ? raw.notes : [];
  } catch (err) {
    if (err?.code === "ENOENT") return [];
    if (String(err.message || "").includes("Not signed in")) return [];
    throw err;
  }
}


async function loadRoutesFile() {
  try {
    const raw = JSON.parse(await fs.promises.readFile(auth.routesPath(userDataRoot()), "utf8"));
    return Array.isArray(raw?.routes) ? raw.routes : Array.isArray(raw) ? raw : [];
  } catch (err) {
    if (err?.code === "ENOENT") return [];
    if (String(err.message || "").includes("Not signed in")) return [];
    throw err;
  }
}

async function saveRoutesFile(routes) {
  const filePath = auth.routesPath(userDataRoot());
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, JSON.stringify({ routes }, null, 2), "utf8");
}

async function saveNotesFile(notes) {
  const filePath = auth.notesPath(userDataRoot());
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, JSON.stringify({ notes }, null, 2), "utf8");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 720,
    minHeight: 480,
    title: "World Maps",
    backgroundColor: "#0a0c10",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function loadInitialPage() {
  if (!mainWindow) return;
  await auth.tryRestoreSession(userDataRoot());
  await mainWindow.loadFile(path.join(__dirname, "login.html"));
}

async function goToApp() {
  if (!mainWindow) return;
  await mainWindow.loadFile(path.join(__dirname, "index.html"));
}

async function goToLogin() {
  if (!mainWindow) return;
  await mainWindow.loadFile(path.join(__dirname, "login.html"));
}

ipcMain.handle("auth-status", async () => auth.authStatus(userDataRoot()));

ipcMain.handle("auth-register", async (_event, payload) => {
  const result = await auth.register(
    userDataRoot(),
    payload?.username,
    payload?.password,
    Boolean(payload?.remember)
  );
  if (result.ok) await goToApp();
  return result;
});

ipcMain.handle("auth-login", async (_event, payload) => {
  const result = await auth.login(
    userDataRoot(),
    payload?.username,
    payload?.password,
    Boolean(payload?.remember)
  );
  if (result.ok) await goToApp();
  return result;
});

ipcMain.handle("auth-logout", async () => {
  await auth.logout(userDataRoot());
  await goToLogin();
  return { ok: true };
});

ipcMain.handle("auth-enter-app", async () => {
  if (!auth.getCurrentUser()) {
    return { ok: false, error: "Not signed in" };
  }
  await goToApp();
  return { ok: true };
});

ipcMain.handle("auth-current-user", async () => auth.getCurrentUser());

registerGeminiIpc(ipcMain);

function geoLang(raw) {
  const lang = String(typeof raw === "object" && raw?.lang != null ? raw.lang : raw || "")
    .trim()
    .toLowerCase();
  if (lang === "he" || lang === "iw" || lang.startsWith("he-") || lang.startsWith("iw-")) return "he";
  return "en";
}

function hasHebrewScript(text) {
  return /[\u0590-\u05FF]/.test(String(text || ""));
}

async function nominatimSearch(q, lang, countryCode) {
  const url = new URL(`${NOMINATIM}/search`);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "10");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", lang);
  const cc = String(countryCode || "").trim().toLowerCase();
  if (cc && cc !== "unknown") url.searchParams.set("countrycodes", cc);

  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      "Accept-Language": lang,
    },
  });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

function mergeGeocodeResults(primary, secondary, limit = 10) {
  const out = [];
  const seen = new Set();
  for (const item of [...(primary || []), ...(secondary || [])]) {
    const key = item?.place_id != null
      ? `id:${item.place_id}`
      : `${item?.lat},${item?.lon},${item?.display_name || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

function geoQuery(raw) {
  if (typeof raw === "string") return raw;
  return String(raw?.query || raw?.q || "").trim();
}

ipcMain.handle("geocode", async (_event, raw) => {
  const q = geoQuery(raw);
  if (!q) return [];

  const lang = geoLang(raw);
  const explicitCc =
    typeof raw === "object" && raw?.countryCode ? String(raw.countryCode).trim().toLowerCase() : "";
  const cc = explicitCc && explicitCc !== "unknown" ? explicitCc : "";

  if (!cc && hasHebrewScript(q)) {
    const ilResults = await nominatimSearch(q, "he", "il");
    if (ilResults.length >= 5) return ilResults;
    const globalResults = await nominatimSearch(q, lang, "");
    return mergeGeocodeResults(ilResults, globalResults, 10);
  }

  return nominatimSearch(q, lang, cc);
});

ipcMain.handle("reverse-geocode", async (_event, lat, lng, lang) => {
  const url = new URL(`${NOMINATIM}/reverse`);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "json");
  url.searchParams.set("zoom", "14");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", geoLang(lang));

  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      "Accept-Language": geoLang(lang),
    },
  });

  if (!res.ok) throw new Error(`Reverse lookup failed (${res.status})`);
  const data = await res.json();
  return data?.display_name || "";
});

ipcMain.handle("reverse-geocode-country", async (_event, lat, lng, lang) => {
  const url = new URL(`${NOMINATIM}/reverse`);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "json");
  url.searchParams.set("zoom", "5");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", geoLang(lang));

  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      "Accept-Language": geoLang(lang),
    },
  });

  if (!res.ok) throw new Error(`Country lookup failed (${res.status})`);
  const data = await res.json();
  const addr = data?.address || {};
  const countryName = addr.country || "";
  const countryCode = String(addr.country_code || "").toUpperCase();
  return { countryName, countryCode, displayName: data?.display_name || "" };
});

ipcMain.handle("notes-load", async () => {
  if (!auth.getCurrentUser()) throw new Error("Not signed in");
  return loadNotesFile();
});

ipcMain.handle("notes-save-all", async (_event, notes) => {
  if (!auth.getCurrentUser()) throw new Error("Not signed in");
  const list = Array.isArray(notes) ? notes : [];
  await saveNotesFile(list);
  return list;
});

ipcMain.handle("routes-load", async () => {
  if (!auth.getCurrentUser()) throw new Error("Not signed in");
  return loadRoutesFile();
});

ipcMain.handle("routes-save-all", async (_event, routes) => {
  if (!auth.getCurrentUser()) throw new Error("Not signed in");
  const list = Array.isArray(routes) ? routes : [];
  await saveRoutesFile(list);
  return list;
});

ipcMain.handle("settings-load", async () => {
  if (!auth.getCurrentUser()) return { ...SETTINGS_DEFAULTS };
  try {
    const raw = JSON.parse(await fs.promises.readFile(auth.settingsPath(userDataRoot()), "utf8"));
    return { ...SETTINGS_DEFAULTS, ...raw };
  } catch (err) {
    if (err?.code === "ENOENT") return { ...SETTINGS_DEFAULTS };
    throw err;
  }
});

ipcMain.handle("settings-save", async (_event, data) => {
  if (!auth.getCurrentUser()) throw new Error("Not signed in");
  const merged = { ...SETTINGS_DEFAULTS, ...(data || {}) };
  const filePath = auth.settingsPath(userDataRoot());
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, JSON.stringify(merged, null, 2), "utf8");
  return merged;
});

app.whenReady().then(async () => {
  createWindow();
  await loadInitialPage();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", async () => {
  if (!mainWindow) {
    createWindow();
    await loadInitialPage();
  }
});
