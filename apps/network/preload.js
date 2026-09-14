const { contextBridge, ipcRenderer } = require("electron");

const MODULE_ID = "network";

function invoke(channel, args) {
  return ipcRenderer.invoke("network", String(channel || "").trim(), args || {});
}

const myApp = {
  moduleId: MODULE_ID,
  network: {
    status: () => invoke("status", {}),
    adapters: () => invoke("adapters", {}),
    ports: (args) => invoke("ports", args || {}),
    check: () => invoke("check", {}),
    checks: () => invoke("checks", {}),
    openSettings: () => invoke("open-settings", {}),
  },
};
contextBridge.exposeInMainWorld("myApp", myApp);

try {
  const { attachLinkBridge } = require("../shared/link-preload");
  attachLinkBridge(contextBridge, ipcRenderer, MODULE_ID);
} catch (err) {
  console.error("[network preload] Link bridge failed:", err);
}

try {
  const { attachOsI18n } = require("../shared/i18n/preload-bridge");
  attachOsI18n(contextBridge, ipcRenderer);
} catch (err) {
  console.error("[network preload] i18n bridge failed:", err);
}