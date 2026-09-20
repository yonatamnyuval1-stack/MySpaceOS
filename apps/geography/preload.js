const { contextBridge, ipcRenderer } = require("electron");

const myApp = {
  moduleId: "geography",
  invoke: (channel, args) => ipcRenderer.invoke("myapp-invoke", "geography", channel, args || {}),
};
contextBridge.exposeInMainWorld("myApp", myApp);
try {
  const { attachLocalAuthBridge } = require("../shared/local-auth/preload-bridge");
  attachLocalAuthBridge(contextBridge, ipcRenderer, "geography");
} catch (err) {
  console.error("[geography preload] Local auth bridge failed:", err);
}

try {
  const { attachOsI18n } = require("../shared/i18n/preload-bridge");
  attachOsI18n(contextBridge, ipcRenderer);
} catch (err) {
  console.error("[preload] i18n bridge failed:", err);
}
