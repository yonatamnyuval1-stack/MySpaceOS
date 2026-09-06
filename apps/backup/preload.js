const { contextBridge, ipcRenderer } = require("electron");

const MODULE_ID = "backup";

function invoke(channel, args) {
  return ipcRenderer.invoke("backup", String(channel || "").trim(), args || {});
}

const myApp = {
  moduleId: MODULE_ID,
  backup: {
    status: () => invoke("status", {}),
    history: (args) => invoke("history", args || {}),
    export: () => invoke("export", {}),
    import: () => invoke("import", {}),
    path: () => invoke("path", {}),
    reveal: (filePath) => invoke("reveal", { path: filePath }),
  },
};
contextBridge.exposeInMainWorld("myApp", myApp);

try {
  const { attachLinkBridge } = require("../shared/link-preload");
  attachLinkBridge(contextBridge, ipcRenderer, MODULE_ID);
} catch (err) {
  console.error("[backup preload] Link bridge failed:", err);
}