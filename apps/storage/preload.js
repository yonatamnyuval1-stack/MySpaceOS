const { contextBridge, ipcRenderer } = require("electron");

const MODULE_ID = "storage";

function invoke(channel, args) {
  return ipcRenderer.invoke("storage", String(channel || "").trim(), args || {});
}

const myApp = {
  moduleId: MODULE_ID,
  storage: {
    status: () => invoke("status"),
    drives: () => invoke("drives"),
    apps: () => invoke("apps"),
    largeFiles: (args) => invoke("large-files", args || {}),
    scan: (args) => invoke("scan", args || {}),
    cancel: () => invoke("cancel"),
    cleanup: () => invoke("cleanup"),
    cleanupDelete: (args) => invoke("cleanup.delete", args || {}),
    path: () => invoke("path"),
    reveal: (filePath) => invoke("reveal", { path: filePath }),
    openSettings: () => invoke("open-settings"),
  },
};
contextBridge.exposeInMainWorld("myApp", myApp);

try {
  const { attachLinkBridge } = require("../shared/link-preload");
  attachLinkBridge(contextBridge, ipcRenderer, MODULE_ID);
} catch (err) {
  console.error("[storage preload] Link bridge failed:", err);
}

try {
  const { attachOsI18n } = require("../shared/i18n/preload-bridge");
  attachOsI18n(contextBridge, ipcRenderer);
} catch (err) {
  console.error("[storage preload] i18n bridge failed:", err);
}
