const { contextBridge, ipcRenderer } = require("electron");

const myApp = {
  moduleId: "os-bridge",
  invoke: (channel, args) =>
    ipcRenderer.invoke("myapp-invoke", "os-bridge", channel, args || {}),
  onEvent: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("os-bridge-event", handler);
    return () => ipcRenderer.removeListener("os-bridge-event", handler);
  },
};
contextBridge.exposeInMainWorld("myApp", myApp);

try {
  const { attachOsI18n } = require("../shared/i18n/preload-bridge");
  attachOsI18n(contextBridge, ipcRenderer);
} catch (err) {
  console.error("[os-bridge preload] i18n bridge failed:", err);
}
