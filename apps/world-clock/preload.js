const { contextBridge, ipcRenderer } = require("electron");

const MODULE_ID = "world-clock";

const myApp = {
  moduleId: MODULE_ID,
  invoke: (channel, args) => ipcRenderer.invoke("myapp-invoke", MODULE_ID, channel, args || {}),
};

contextBridge.exposeInMainWorld("myApp", myApp);
try {
  const { attachLocalAuthBridge } = require("../shared/local-auth/preload-bridge");
  attachLocalAuthBridge(contextBridge, ipcRenderer, "world-clock");
} catch (err) {
  console.error("[world-clock preload] Local auth bridge failed:", err);
}

try {
  const { attachOsI18n } = require("../shared/i18n/preload-bridge");
  attachOsI18n(contextBridge, ipcRenderer);
} catch (err) {
  console.error("[preload] i18n bridge failed:", err);
}
