const { contextBridge, ipcRenderer } = require("electron");

const myApp = {
  moduleId: "coupons",
  invoke: (channel, args) => ipcRenderer.invoke("myapp-invoke", "coupons", channel, args || {}),
};
contextBridge.exposeInMainWorld("myApp", myApp);
try {
  const { attachLocalAuthBridge } = require("../shared/local-auth/preload-bridge");
  attachLocalAuthBridge(contextBridge, ipcRenderer, "coupons");
} catch (err) {
  console.error("[coupons preload] Local auth bridge failed:", err);
}
