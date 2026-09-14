const { contextBridge, ipcRenderer } = require("electron");

const myApp = {
  moduleId: "shell-console",
  invoke: (channel, args) => ipcRenderer.invoke("myapp-invoke", "shell-console", channel, args || {}),
};
contextBridge.exposeInMainWorld("myApp", myApp);

try {
  const { attachOsI18n } = require("../shared/i18n/preload-bridge");
  attachOsI18n(contextBridge, ipcRenderer);
} catch (err) {
  console.error("[shell-console preload] i18n bridge failed:", err);
}