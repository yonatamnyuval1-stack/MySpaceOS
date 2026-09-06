const path = require("path");
const fs = require("fs");
const { app } = require("electron");
const { loadJsonFile, saveJsonFile } = require("./safe-json-store");

function userAppsRoot() {
  return path.join(app.getPath("userData"), "user-apps");
}

function userAppDir(moduleId) {
  return path.join(userAppsRoot(), String(moduleId || "").trim());
}

function dataPath(moduleId) {
  return path.join(app.getPath("userData"), "user-apps-data", `${moduleId}.json`);
}

function isUserAppModule(moduleId) {
  const id = String(moduleId || "").trim();
  if (!id) return false;
  const dir = userAppDir(id);
  return fs.existsSync(path.join(dir, "manifest.json")) || fs.existsSync(path.join(dir, "index.html"));
}

function defaultState() {
  return { items: [], settings: {}, updatedAt: null };
}

function loadState(moduleId) {
  const loaded = loadJsonFile(dataPath(moduleId), { fallback: defaultState() });
  if (!loaded.ok || !loaded.data) return defaultState();
  return {
    items: Array.isArray(loaded.data.items) ? loaded.data.items : [],
    settings: loaded.data.settings && typeof loaded.data.settings === "object" ? loaded.data.settings : {},
    updatedAt: loaded.data.updatedAt || null,
  };
}

function saveState(moduleId, state) {
  const next = {
    items: Array.isArray(state?.items) ? state.items : [],
    settings: state?.settings && typeof state.settings === "object" ? state.settings : {},
    updatedAt: new Date().toISOString(),
  };
  return saveJsonFile(dataPath(moduleId), next, { allowEmpty: true });
}

async function handleUserAppInvoke(moduleId, channel, args = {}) {
  const ch = String(channel || "").trim();
  const id = String(moduleId || "").trim();
  if (!isUserAppModule(id)) {
    return { ok: false, error: `User app not installed: ${id}` };
  }

  switch (ch) {
    case "status":
      return {
        ok: true,
        moduleId: id,
        path: userAppDir(id),
        userApp: true,
      };

    case "data.get":
      return { ok: true, data: loadState(id) };

    case "data.set": {
      const state = {
        items: Array.isArray(args.items) ? args.items : loadState(id).items,
        settings:
          args.settings && typeof args.settings === "object"
            ? args.settings
            : loadState(id).settings,
      };
      saveState(id, state);
      return { ok: true, data: loadState(id) };
    }

    case "items.list":
      return { ok: true, items: loadState(id).items };

    case "items.add": {
      const state = loadState(id);
      const item = {
        id: `item_${Date.now().toString(36)}`,
        title: String(args.title || "Untitled").slice(0, 120),
        body: String(args.body || ""),
        createdAt: new Date().toISOString(),
      };
      state.items = [item, ...state.items].slice(0, 200);
      saveState(id, state);
      return { ok: true, item, items: state.items };
    }

    case "items.delete": {
      const state = loadState(id);
      const target = String(args.id || "").trim();
      state.items = state.items.filter((it) => it.id !== target);
      saveState(id, state);
      return { ok: true, items: state.items };
    }

    case "ping":
      return { ok: true, pong: true, moduleId: id };

    default:
      return { ok: false, error: `Unknown user-app channel: ${ch}` };
  }
}

module.exports = {
  handleUserAppInvoke,
  isUserAppModule,
  userAppsRoot,
  userAppDir,
};