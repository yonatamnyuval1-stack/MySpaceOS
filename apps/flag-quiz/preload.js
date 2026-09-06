const { contextBridge, ipcRenderer } = require("electron");

const MODULE_ID = "flag-quiz";

const myApp = {
  moduleId: MODULE_ID,
  invoke: (channel, args) =>
    ipcRenderer.invoke("myapp-invoke", MODULE_ID, channel, args || {}),
};
contextBridge.exposeInMainWorld("myApp", myApp);
try {
  const { attachLocalAuthBridge } = require("../shared/local-auth/preload-bridge");
  attachLocalAuthBridge(contextBridge, ipcRenderer, "flag-quiz");
} catch (err) {
  console.error("[flag-quiz preload] Local auth bridge failed:", err);
}
