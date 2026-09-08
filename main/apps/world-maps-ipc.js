const path = require("path");
const fs = require("fs");
const { app, dialog, BrowserWindow } = require("electron");

const WM_ROOT = path.join(__dirname, "..", "..", "world-maps");
const auth = require(path.join(WM_ROOT, "auth.js"));
const { getLocalAuth } = require("./local-auth");
const { setLocalAuthPrepare } = require("./app-local-auth-ipc");
const { geminiGenerate } = require(path.join(WM_ROOT, "gemini-ipc.js"));

const APP_ID = "world-maps";
const localAuth = getLocalAuth(APP_ID);

const NOMINATIM = "https://nominatim.openstreetmap.org";
const USER_AGENT = "WorldMaps/0.1 (My Space embedded; contact: local)";

const SETTINGS_DEFAULTS = {
  language: "en",
  showMapHint: true,
  showNoteLabels: true,
  showZoomControls: true,
  confirmDelete: true,
};

function localRoot() {
  const profile = require("../myspace-profile");
  return profile.profileScopedPath("world-maps");
}

function syncConfigPath() {
  return path.join(localRoot(), "sync.json");
}

function readSyncConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(syncConfigPath(), "utf8"));
    return { sharedRoot: raw?.sharedRoot ? String(raw.sharedRoot).trim() : "" };
  } catch {
    return { sharedRoot: "" };
  }
}

function writeSyncConfig(cfg) {
  fs.mkdirSync(localRoot(), { recursive: true });
  fs.writeFileSync(
    syncConfigPath(),
    JSON.stringify({ sharedRoot: cfg.sharedRoot || "" }, null, 2),
    "utf8"
  );
}

function getWorldMapsAccountsRoot() {
  const shared = readSyncConfig().sharedRoot;
  if (shared) {
    try {
      fs.mkdirSync(shared, { recursive: true });
      return shared;
    } catch {
    }
  }
  return localRoot();
}

function getWorldMapsLocalRoot() {
  return localRoot();
}

function userDataRoot() {
  return getWorldMapsAccountsRoot();
}

function prepareAuthRoots() {
  const local = localRoot();
  fs.mkdirSync(local, { recursive: true });
  localAuth.setSessionRoot(local);
  const accountsRoot = getWorldMapsAccountsRoot();
  localAuth.setAccountsRoot(accountsRoot);
  auth.setSessionRoot(local);
  auth.setAccountsRoot(accountsRoot);
  return accountsRoot;
}

setLocalAuthPrepare(APP_ID, (authInstance) => {
  const local = localRoot();
  authInstance.setSessionRoot(local);
  authInstance.setAccountsRoot(getWorldMapsAccountsRoot());
  auth.setSessionRoot(local);
  auth.setAccountsRoot(getWorldMapsAccountsRoot());
});

async function copyDirRecursive(src, dest) {
  await fs.promises.mkdir(dest, { recursive: true });
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  for (const ent of entries) {
    const from = path.join(src, ent.name);
    const to = path.join(dest, ent.name);
    if (ent.isDirectory()) await copyDirRecursive(from, to);
    else await fs.promises.copyFile(from, to);
  }
}

async function readUsersStore(root) {
  try {
    const raw = JSON.parse(await fs.promises.readFile(path.join(root, "users.json"), "utf8"));
    return { users: Array.isArray(raw?.users) ? raw.users : [] };
  } catch {
    return { users: [] };
  }
}

async function mergeLocalAccountsIntoShared(sharedPath) {
  await fs.promises.mkdir(sharedPath, { recursive: true });
  const local = localRoot();
  if (path.resolve(local) === path.resolve(sharedPath)) {
    return { ok: true, merged: 0, accountsRoot: sharedPath };
  }

  const localStore = await readUsersStore(local);
  const sharedStore = await readUsersStore(sharedPath);
  const byUsername = new Map();
  for (const u of sharedStore.users) {
    byUsername.set(String(u.username || "").toLowerCase(), u);
  }

  let merged = 0;
  for (const u of localStore.users) {
    const key = String(u.username || "").toLowerCase();
    if (!key || byUsername.has(key)) continue;
    byUsername.set(key, u);
    merged += 1;
    const srcDir = path.join(local, "users", u.id);
    const destDir = path.join(sharedPath, "users", u.id);
    try {
      if (fs.existsSync(srcDir) && !fs.existsSync(destDir)) {
        await copyDirRecursive(srcDir, destDir);
      }
    } catch {
    }
  }

  const users = [...byUsername.values()];
  await fs.promises.mkdir(path.join(sharedPath, "users"), { recursive: true });
  await fs.promises.writeFile(
    path.join(sharedPath, "users.json"),
    JSON.stringify({ users }, null, 2),
    "utf8"
  );
  return { ok: true, merged, total: users.length, accountsRoot: sharedPath };
}

async function getSyncStatus() {
  const local = localRoot();
  const cfg = readSyncConfig();
  const shared = cfg.sharedRoot || "";
  let sharedReachable = false;
  if (shared) {
    try {
      fs.mkdirSync(shared, { recursive: true });
      sharedReachable = true;
    } catch {
      sharedReachable = false;
    }
  }
  const accountsRoot = prepareAuthRoots();
  const store = await readUsersStore(accountsRoot);
  return {
    ok: true,
    localRoot: local,
    sharedRoot: shared,
    sharedEnabled: Boolean(shared),
    sharedReachable,
    accountsRoot,
    accountCount: store.users.length,
    usernames: store.users.map((u) => u.username).filter(Boolean),
  };
}

async function setSharedRoot(folderPath) {
  const shared = String(folderPath || "").trim();
  if (!shared) return { ok: false, error: "Folder path required" };
  try {
    await fs.promises.mkdir(shared, { recursive: true });
  } catch (err) {
    return { ok: false, error: err.message || "Cannot access folder" };
  }
  const merge = await mergeLocalAccountsIntoShared(shared);
  writeSyncConfig({ sharedRoot: shared });
  prepareAuthRoots();
  const status = await getSyncStatus();
  return { ...status, merged: merge.merged };
}

async function clearSharedRoot() {
  writeSyncConfig({ sharedRoot: "" });
  prepareAuthRoots();
  return getSyncStatus();
}

async function pickSharedFolder(event) {
  const win = BrowserWindow.fromWebContents(event?.sender) || BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(win || undefined, {
    title: "Choose shared World Maps folder",
    properties: ["openDirectory", "createDirectory"],
  });
  if (result.canceled || !result.filePaths?.[0]) {
    return { ok: false, canceled: true };
  }
  return setSharedRoot(result.filePaths[0]);
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
    const key =
      item?.place_id != null
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
  if (typeof raw === "string") return String(raw || "").trim();
  if (raw && typeof raw === "object") return String(raw.query || raw.q || "").trim();
  return "";
}

async function handleGeocode(raw) {
  const q = geoQuery(raw);
  if (!q) return [];
  const lang = geoLang(typeof raw === "object" ? raw?.lang : undefined);
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
}

async function handleReverseGeocode(lat, lng, lang) {
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
}

async function handleReverseGeocodeCountry(lat, lng, lang) {
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
  return {
    countryName: addr.country || "",
    countryCode: String(addr.country_code || "").toUpperCase(),
    displayName: data?.display_name || "",
  };
}

async function handleGeminiChat(messages) {
  try {
    const contents = [];
    for (const m of Array.isArray(messages) ? messages.slice(-8) : []) {
      const roleRaw = String(m?.role || "").toLowerCase();
      const role =
        roleRaw === "assistant" || roleRaw === "model"
          ? "model"
          : roleRaw === "user"
            ? "user"
            : null;
      if (!role) continue;
      const text = String(m?.content || "").trim();
      if (!text) continue;
      contents.push({ role, parts: [{ text }] });
    }
    let systemInstruction =
      "You are the World Maps assistant inside My Space. Help with places, routes, geocoding, and map notes.";
    try {
      const { gatherMslAiContext } = require("../msl/ai-context");
      const msl = await gatherMslAiContext("world-maps", { label: "World Maps" });
      if (msl.promptBlock) systemInstruction += msl.promptBlock.slice(0, 10000);
    } catch {
    }
    const res = await geminiGenerate({ contents, systemInstruction });
    if (!res.ok) return res;
    const parts = res.candidate?.content?.parts || [];
    const content = parts
      .map((p) => (typeof p?.text === "string" ? p.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim();
    return { ok: true, content, model: res.model };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

async function handleWorldMapsInvoke(channel, args, event) {
  const root = prepareAuthRoots();

  switch (channel) {
    case "sync-status":
      return getSyncStatus();

    case "sync-pick-folder":
      return pickSharedFolder(event);

    case "sync-set-folder":
      return setSharedRoot(args?.path || args?.sharedRoot);

    case "sync-clear":
      return clearSharedRoot();

    case "geocode":
      return handleGeocode(args);

    case "reverse-geocode":
      return handleReverseGeocode(args?.lat, args?.lng, args?.lang);

    case "reverse-geocode-country":
      return handleReverseGeocodeCountry(args?.lat, args?.lng, args?.lang);

    case "notes-load":
      if (!auth.getCurrentUser()) throw new Error("Not signed in");
      return loadNotesFile();

    case "notes-save-all": {
      if (!auth.getCurrentUser()) throw new Error("Not signed in");
      const list = Array.isArray(args) ? args : Array.isArray(args?.notes) ? args.notes : [];
      await saveNotesFile(list);
      return list;
    }

    case "routes-load":
      if (!auth.getCurrentUser()) throw new Error("Not signed in");
      return loadRoutesFile();

    case "routes-save-all": {
      if (!auth.getCurrentUser()) throw new Error("Not signed in");
      const list = Array.isArray(args) ? args : Array.isArray(args?.routes) ? args.routes : [];
      await saveRoutesFile(list);
      return list;
    }

    case "settings-load": {
      if (!auth.getCurrentUser()) return { ...SETTINGS_DEFAULTS };
      try {
        const raw = JSON.parse(await fs.promises.readFile(auth.settingsPath(root), "utf8"));
        return { ...SETTINGS_DEFAULTS, ...raw };
      } catch (err) {
        if (err?.code === "ENOENT") return { ...SETTINGS_DEFAULTS };
        throw err;
      }
    }

    case "settings-save": {
      if (!auth.getCurrentUser()) throw new Error("Not signed in");
      const merged = { ...SETTINGS_DEFAULTS, ...(args || {}) };
      const filePath = auth.settingsPath(root);
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, JSON.stringify(merged, null, 2), "utf8");
      return merged;
    }

    case "gemini-generate": {
      const payload = { ...(args || {}) };
      try {
        const { gatherMslAiContext } = require("../msl/ai-context");
        const msl = await gatherMslAiContext("world-maps", { label: "World Maps" });
        if (msl.promptBlock) {
          payload.systemInstruction =
            String(payload.systemInstruction || "") + msl.promptBlock.slice(0, 10000);
        }
      } catch {
        /* optional */
      }
      return geminiGenerate(payload);
    }

    case "gemini-chat":
      return handleGeminiChat(args);

    default:
      return { ok: false, error: `Unknown World Maps channel: ${channel}` };
  }
}

function getWorldMapsContentRoot() {
  return WM_ROOT;
}

module.exports = {
  handleWorldMapsInvoke,
  getWorldMapsContentRoot,
  userDataRoot,
  getWorldMapsAccountsRoot,
  getWorldMapsLocalRoot,
};