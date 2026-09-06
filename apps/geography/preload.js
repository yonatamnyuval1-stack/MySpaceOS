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
