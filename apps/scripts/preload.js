const { contextBridge, ipcRenderer } = require("electron");

const MODULE_ID = "scripts";

const myApp = {
  moduleId: MODULE_ID,
  invoke: (channel, args) =>
    ipcRenderer.invoke("myapp-invoke", MODULE_ID, channel, args || {}),
};
contextBridge.exposeInMainWorld("myApp", myApp);

contextBridge.exposeInMainWorld("spaceFile", {
  export: (args) => ipcRenderer.invoke("space-file", "export", args || {}),
});
try {
  const { attachOsI18n } = require("../shared/i18n/preload-bridge");
  attachOsI18n(contextBridge, ipcRenderer);
} catch (err) {
  console.error("[scripts preload] i18n bridge failed:", err);
}
