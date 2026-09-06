const { app } = require("electron");
const fs = require("fs");
const path = require("path");
const { publishScreenFacts, getScreenFacts } = require("../ai/screen-facts-store");

const {
  setupLocalAuthApp,
  requireSignedIn,
  userStorageRoot,
  registerLegacyMigrator,
  registerSingleFileMigrator,
} = require("./local-auth-app-helper");

const APP_ID = "icon-library";
const auth = setupLocalAuthApp(APP_ID);
registerSingleFileMigrator(APP_ID, "icon-library.json");

const DATA_FILE = () => auth.userDataPath("data.json");

function signedInGuard() {
  return requireSignedIn(auth);
}


function dataPath() {
  return path.join(app.getPath("userData"), "icon-library.json");
}

function defaultState() {
  return {
    favorites: [],
    recent: [],
    custom: [], 
  };
}

function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  return {
    favorites: Array.isArray(raw.favorites)
      ? raw.favorites.filter((x) => typeof x === "string").slice(0, 500)
      : [],
    recent: Array.isArray(raw.recent)
      ? raw.recent.filter((x) => typeof x === "string").slice(0, 40)
      : [],
    custom: Array.isArray(raw.custom) ? raw.custom.slice(0, 200) : [],
  };
}

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(dataPath(), "utf8"));
    return normalize(raw.state || raw);
  } catch (err) {
    if (err && err.code === "ENOENT") return defaultState();
    return defaultState();
  }
}

function save(state) {
  fs.mkdirSync(path.dirname(dataPath()), { recursive: true });
  fs.writeFileSync(
    dataPath(),
    JSON.stringify({ state: normalize(state), updatedAt: new Date().toISOString() }, null, 2),
    "utf8"
  );
}

async function handleIconLibraryInvoke(channel, args = {}) {
  const authErr = signedInGuard();
  if (authErr) return authErr;
  switch (channel) {
    case "library.getState": {
      const state = load();
      return { ok: true, ...state };
    }
    case "favorites.set": {
      const id = String(args.id || "").trim();
      if (!id) return { ok: false, error: "Missing id" };
      const state = load();
      const set = new Set(state.favorites);
      if (args.on) set.add(id);
      else set.delete(id);
      state.favorites = [...set];
      save(state);
      return { ok: true, favorites: state.favorites };
    }
    case "recent.add": {
      const id = String(args.id || "").trim();
      if (!id) return { ok: false, error: "Missing id" };
      const state = load();
      state.recent = [id, ...state.recent.filter((x) => x !== id)].slice(0, 40);
      save(state);
      return { ok: true, recent: state.recent };
    }
    case "screen.publish": {
      publishScreenFacts("icon-library", args || {});
      return { ok: true };
    }
    case "screen.get":
      return { ok: true, facts: getScreenFacts("icon-library") };
    default:
      return { ok: false, error: `Unknown icon-library channel: ${channel}` };
  }
}

module.exports = { handleIconLibraryInvoke };