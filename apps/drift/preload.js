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
