const { contextBridge, ipcRenderer } = require("electron");

const myApp = {
  moduleId: "files",
  invoke: (channel, args) =>
    ipcRenderer.invoke("myapp-invoke", "files", channel, args || {}),
};
contextBridge.exposeInMainWorld("myApp", myApp);

try {
  const { attachLinkBridge } = require("../shared/link-preload");
  attachLinkBridge(contextBridge, ipcRenderer, "files");
} catch (err) {
  console.error("[files preload] Link bridge failed:", err);
}
