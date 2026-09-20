const { contextBridge, ipcRenderer } = require("electron");

const myApp = {
  moduleId: "drift",
  invoke: (channel, args) => ipcRenderer.invoke("myapp-invoke", "drift", channel, args || {}),
};
contextBridge.exposeInMainWorld("myApp", myApp);
try {
  const { attachLocalAuthBridge } = require("../shared/local-auth/preload-bridge");
  attachLocalAuthBridge(contextBridge, ipcRenderer, "drift");
} catch (err) {
  console.error("[drift preload] Local auth bridge failed:", err);
}

try {
  const { attachOsI18n } = require("../shared/i18n/preload-bridge");
  attachOsI18n(contextBridge, ipcRenderer);
} catch (err) {
  console.error("[preload] i18n bridge failed:", err);
}
