const { contextBridge, ipcRenderer } = require("electron");

const myApp = {
  moduleId: "contracts",
  invoke: (channel, args) => ipcRenderer.invoke("myapp-invoke", "contracts", channel, args || {}),
};
contextBridge.exposeInMainWorld("myApp", myApp);
try {
  const { attachLocalAuthBridge } = require("../shared/local-auth/preload-bridge");
  attachLocalAuthBridge(contextBridge, ipcRenderer, "contracts");
} catch (err) {
  console.error("[contracts preload] Local auth bridge failed:", err);
}
