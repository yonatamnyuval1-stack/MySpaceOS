const { contextBridge, ipcRenderer } = require("electron");

const MODULE_ID = "world-maps";

function invoke(channel, args) {
  return ipcRenderer.invoke("myapp-invoke", MODULE_ID, channel, args || {});
}

async function withNavigate(result) {
  if (result?.ok && result.navigateTo) {
    window.location.href = result.navigateTo;
  }
  return result;
}

contextBridge.exposeInMainWorld("myApp", {
  moduleId: MODULE_ID,
  invoke,
});

try {
  const { attachLocalAuthBridge } = require("../shared/local-auth/preload-bridge");
  attachLocalAuthBridge(contextBridge, ipcRenderer, MODULE_ID);
} catch (err) {
  console.error("[world-maps preload] Local auth bridge failed:", err);
}

contextBridge.exposeInMainWorld("worldMaps", {
  authStatus: () => invoke("auth-status"),
  myspaceStatus: () => invoke("auth-myspace-status"),
  continueWithMyspace: (payload) =>
    invoke("auth-continue-myspace", payload || {}).then(withNavigate),
  register: (payload) => invoke("auth-register", payload).then(withNavigate),
  login: (payload) => invoke("auth-login", payload).then(withNavigate),
  logout: () => invoke("auth-logout").then(withNavigate),
  enterApp: () => invoke("auth-enter-app").then(withNavigate),
  getCurrentUser: () => invoke("auth-current-user"),
  geocode: (query, lang, countryCode) =>
    invoke("geocode", { query, lang, countryCode }),
  reverseGeocode: (lat, lng, lang) => invoke("reverse-geocode", { lat, lng, lang }),
  reverseGeocodeCountry: (lat, lng, lang) =>
    invoke("reverse-geocode-country", { lat, lng, lang }),
  loadNotes: () => invoke("notes-load"),
  saveNotes: (notes) => invoke("notes-save-all", notes),
  loadRoutes: () => invoke("routes-load"),
  saveRoutes: (routes) => invoke("routes-save-all", routes),
  loadSettings: () => invoke("settings-load"),
  saveSettings: (data) => invoke("settings-save", data),
  syncStatus: () => invoke("sync-status"),
  syncPickFolder: () => invoke("sync-pick-folder"),
  syncSetFolder: (path) => invoke("sync-set-folder", { path }),
  syncClear: () => invoke("sync-clear"),
  geminiChat: (messages) => invoke("gemini-chat", messages),
  geminiGenerate: (payload) => invoke("gemini-generate", payload),
});

try {
  const { attachLinkBridge } = require("../shared/link-preload");
  attachLinkBridge(contextBridge, ipcRenderer, MODULE_ID);
} catch (err) {
  console.error("[world-maps preload] Link bridge failed:", err);
}

try {
  const { attachOsI18n } = require("../shared/i18n/preload-bridge");
  attachOsI18n(contextBridge, ipcRenderer);
} catch (err) {
  console.error("[preload] i18n bridge failed:", err);
}
