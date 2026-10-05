const { contextBridge, ipcRenderer } = require("electron");
const myApp = {
  moduleId: "builds",
  invoke: (channel, args) => ipcRenderer.invoke("myapp-invoke", "builds", channel, args || {}),
  onTreeUpdate: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("builds-tree-update", handler);
    return () => ipcRenderer.removeListener("builds-tree-update", handler);
  },
};
contextBridge.exposeInMainWorld("myApp", myApp);
try {
  const { attachLocalAuthBridge } = require("../shared/local-auth/preload-bridge");
  attachLocalAuthBridge(contextBridge, ipcRenderer, "builds");
} catch (err) {
  console.error("[builds preload] Local auth bridge failed:", err);
}
try {
  const { attachOsI18n } = require("../shared/i18n/preload-bridge");
  attachOsI18n(contextBridge, ipcRenderer);
} catch (err) {
  console.error("[preload] i18n bridge failed:", err);
}