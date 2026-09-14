const { contextBridge, ipcRenderer } = require("electron");

const MODULE_ID = "parts";

function invoke(channel, args) {
  return ipcRenderer.invoke("myapp-invoke", MODULE_ID, channel, args || {});
}

const myApp = {
  moduleId: MODULE_ID,
  invoke,
  parts: {
    list: (args) => invoke("parts.list", args || {}),
    get: (args) =>
      invoke("parts.get", typeof args === "string" ? { id: args } : args || {}),
    adopt: (args) => invoke("parts.adopt", args || {}),
    publish: (args) => invoke("parts.publish", args || {}),
    unpublish: (args) => invoke("parts.unpublish", args || {}),
    published: (args) => invoke("parts.published", args || {}),
    targets: () => invoke("parts.targets", {}),
    reload: () => invoke("parts.reload", {}),
  },
};
contextBridge.exposeInMainWorld("myApp", myApp);

try {
  const { attachOsI18n } = require("../shared/i18n/preload-bridge");
  attachOsI18n(contextBridge, ipcRenderer);
} catch (err) {
  console.error("[parts preload] i18n bridge failed:", err);
}
