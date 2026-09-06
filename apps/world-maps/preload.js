const { contextBridge, ipcRenderer } = require("electron");

function invoke(channel, args) {
  return ipcRenderer.invoke("myapp-invoke", "world-maps", channel, args);
}

async function withNavigate(result) {
  if (result?.ok && result.navigateTo) {
    window.location.href = result.navigateTo;
  }
  return result;
}

contextBridge.exposeInMainWorld("worldMaps", {
  authStatus: () => invoke("auth-status"),
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

contextBridge.exposeInMainWorld("myApp", {
  moduleId: "world-maps",
  invoke: (channel, args) => ipcRenderer.invoke("myapp-invoke", "world-maps", channel, args || {}),
});