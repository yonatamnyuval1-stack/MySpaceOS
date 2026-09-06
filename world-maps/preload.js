const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("worldMaps", {
  authStatus: () => ipcRenderer.invoke("auth-status"),
  register: (payload) => ipcRenderer.invoke("auth-register", payload),
  login: (payload) => ipcRenderer.invoke("auth-login", payload),
  logout: () => ipcRenderer.invoke("auth-logout"),
  enterApp: () => ipcRenderer.invoke("auth-enter-app"),
  getCurrentUser: () => ipcRenderer.invoke("auth-current-user"),
  geocode: (query, lang, countryCode) => ipcRenderer.invoke("geocode", { query, lang, countryCode }),
  reverseGeocode: (lat, lng, lang) => ipcRenderer.invoke("reverse-geocode", lat, lng, lang),
  reverseGeocodeCountry: (lat, lng, lang) => ipcRenderer.invoke("reverse-geocode-country", lat, lng, lang),
  loadNotes: () => ipcRenderer.invoke("notes-load"),
  saveNotes: (notes) => ipcRenderer.invoke("notes-save-all", notes),
  loadRoutes: () => ipcRenderer.invoke("routes-load"),
  saveRoutes: (routes) => ipcRenderer.invoke("routes-save-all", routes),
  loadSettings: () => ipcRenderer.invoke("settings-load"),
  saveSettings: (data) => ipcRenderer.invoke("settings-save", data),
  geminiChat: (messages) => ipcRenderer.invoke("gemini-chat", messages),
  geminiGenerate: (payload) => ipcRenderer.invoke("gemini-generate", payload),
});
