const { contextBridge, ipcRenderer } = require("electron");

const myApp = {
  moduleId: "contacts",
  invoke: (channel, args) => ipcRenderer.invoke("myapp-invoke", "contacts", channel, args || {}),
};
contextBridge.exposeInMainWorld("myApp", myApp);

try {
  const { attachLinkBridge } = require("../shared/link-preload");
  attachLinkBridge(contextBridge, ipcRenderer, "contacts");
} catch (err) {
  console.error("[contacts preload] Link bridge failed:", err);
}
try {
  const { attachLocalAuthBridge } = require("../shared/local-auth/preload-bridge");
  attachLocalAuthBridge(contextBridge, ipcRenderer, "contacts");
} catch (err) {
  console.error("[contacts preload] Local auth bridge failed:", err);
}
