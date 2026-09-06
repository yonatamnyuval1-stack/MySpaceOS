const path = require("path");
const fs = require("fs");
const { app } = require("electron");
const { APP_SETTINGS_SCHEMA, mergeAppSettings } = require("../../apps/shared/settings-definitions");

function dataPath() {
  const { profileScopedPath } = require("../myspace-profile");
  const identity = require("../myspace-identity");
  void identity.tryRestoreSession();
  return profileScopedPath("app-settings.json");
}

function defaultsForApp(appId) {
  const schema = APP_SETTINGS_SCHEMA[appId];
  return mergeAppSettings(schema, {});
}

function normalizeAppSettings(appId, raw) {
  const schema = APP_SETTINGS_SCHEMA[appId];
  if (!schema) return {};
  return mergeAppSettings(schema, raw);
}

async function loadAllSettings() {
  try {
    const raw = JSON.parse(await fs.promises.readFile(dataPath(), "utf8"));
    const out = {};
    for (const appId of Object.keys(APP_SETTINGS_SCHEMA)) {
      out[appId] = normalizeAppSettings(appId, raw[appId]);
    }
    return out;
  } catch (err) {
    if (err && err.code === "ENOENT") {
      const out = {};
      for (const appId of Object.keys(APP_SETTINGS_SCHEMA)) {
        out[appId] = defaultsForApp(appId);
      }
      return out;
    }
    throw err;
  }
}

async function saveAllSettings(all) {
  await fs.promises.mkdir(path.dirname(dataPath()), { recursive: true });
  await fs.promises.writeFile(dataPath(), JSON.stringify(all, null, 2), "utf8");
}

async function loadAppSettings(appId) {
  const all = await loadAllSettings();
  return all[appId] || defaultsForApp(appId);
}

async function setAppSettings(appId, patch) {
  const all = await loadAllSettings();
  all[appId] = normalizeAppSettings(appId, { ...(all[appId] || {}), ...patch });
  await saveAllSettings(all);
  return { ok: true, settings: all[appId] };
}

async function handleAppSettingsInvoke(appId, channel, args) {
  if (!APP_SETTINGS_SCHEMA[appId]) {
    return { ok: false, error: "No settings for this app" };
  }

  switch (channel) {
    case "settings.load":
      return { ok: true, settings: await loadAppSettings(appId), schema: APP_SETTINGS_SCHEMA[appId] };
    case "settings.set": {
      const key = String(args?.key || "");
      if (!key) return { ok: false, error: "Missing key" };
      return setAppSettings(appId, { [key]: args.value });
    }
    case "settings.setMany":
      if (!args?.patch || typeof args.patch !== "object") {
        return { ok: false, error: "Missing patch" };
      }
      return setAppSettings(appId, args.patch);
    case "settings.schema":
      return { ok: true, schema: APP_SETTINGS_SCHEMA[appId] };
    case "settings.reset": {
      const all = await loadAllSettings();
      all[appId] = defaultsForApp(appId);
      await saveAllSettings(all);
      return { ok: true, settings: all[appId] };
    }
    default:
      return { ok: false, error: `Unknown settings channel: ${channel}` };
  }
}

module.exports = {
  handleAppSettingsInvoke,
  loadAppSettings,
  loadAllSettings,
};
