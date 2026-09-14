const { contextBridge, ipcRenderer } = require("electron");

const MODULE_ID = "resolve";

function invoke(channel, args) {
  const ch = String(channel || "").trim();
  const normalized = ch.startsWith("resolve.") ? ch : `resolve.${ch}`;
  return ipcRenderer.invoke("resolve", normalized, args || {});
}

const myApp = {
  moduleId: MODULE_ID,
  invoke: (channel, args) => invoke(channel, args),
  resolve: {
    list: (args) => invoke("list", args || {}),
    get: (args) => invoke("get", args || {}),
    report: (args) => invoke("report", args || {}),
    ask: (args) => invoke("ask", args || {}),
    apply: (args) => invoke("apply", args || {}),
    dismiss: (args) => invoke("dismiss", args || {}),
    clear: (args) => invoke("clear", args || {}),
    status: () => invoke("status", {}),
    playbooks: () => invoke("playbooks", {}),
    onUpdated: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on("resolve-updated", handler);
      return () => ipcRenderer.removeListener("resolve-updated", handler);
    },
  },
};
contextBridge.exposeInMainWorld("myApp", myApp);

try {
  const { attachLinkBridge } = require("../shared/link-preload");
  attachLinkBridge(contextBridge, ipcRenderer, MODULE_ID);
} catch (err) {
  console.error("[resolve preload] Link bridge failed:", err);
}

try {
  const { attachOsI18n } = require("../shared/i18n/preload-bridge");
  attachOsI18n(contextBridge, ipcRenderer);
} catch (err) {
  console.error("[resolve preload] i18n bridge failed:", err);
}
