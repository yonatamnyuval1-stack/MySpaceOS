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

try {
  const { attachOsI18n } = require("../shared/i18n/preload-bridge");
  attachOsI18n(contextBridge, ipcRenderer);
} catch (err) {
  console.error("[files preload] i18n bridge failed:", err);
}
