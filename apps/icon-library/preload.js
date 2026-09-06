const { contextBridge, ipcRenderer } = require("electron");

const MODULE_ID = "icon-library";

const myApp = {
  moduleId: MODULE_ID,
  invoke: (channel, args) =>
    ipcRenderer.invoke("myapp-invoke", MODULE_ID, channel, args || {}),
};
contextBridge.exposeInMainWorld("myApp", myApp);
try {
  const { attachLocalAuthBridge } = require("../shared/local-auth/preload-bridge");
  attachLocalAuthBridge(contextBridge, ipcRenderer, "icon-library");
} catch (err) {
  console.error("[icon-library preload] Local auth bridge failed:", err);
}
