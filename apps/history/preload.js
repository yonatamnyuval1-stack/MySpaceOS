const { contextBridge, ipcRenderer } = require("electron");

const myApp = {
  moduleId: "history",
  invoke: (channel, args) => ipcRenderer.invoke("myapp-invoke", "history", channel, args || {}),
};
contextBridge.exposeInMainWorld("myApp", myApp);
try {
  const { attachLocalAuthBridge } = require("../shared/local-auth/preload-bridge");
  attachLocalAuthBridge(contextBridge, ipcRenderer, "history");
} catch (err) {
  console.error("[history preload] Local auth bridge failed:", err);
}

try {
  const { attachOsI18n } = require("../shared/i18n/preload-bridge");
  attachOsI18n(contextBridge, ipcRenderer);
} catch (err) {
  console.error("[preload] i18n bridge failed:", err);
}
