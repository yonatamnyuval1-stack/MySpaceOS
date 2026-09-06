const { contextBridge, ipcRenderer } = require("electron");

const MODULE_ID = "remote-hub";

const myApp = {
  moduleId: MODULE_ID,
  invoke: (channel, args) => ipcRenderer.invoke("myapp-invoke", MODULE_ID, channel, args || {}),
};
contextBridge.exposeInMainWorld("myApp", myApp);
try {
  const { attachLocalAuthBridge } = require("../shared/local-auth/preload-bridge");
  attachLocalAuthBridge(contextBridge, ipcRenderer, "remote-hub");
} catch (err) {
  console.error("[remote-hub preload] Local auth bridge failed:", err);
}
