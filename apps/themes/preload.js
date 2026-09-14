const { contextBridge, ipcRenderer } = require("electron");

const MODULE_ID = "themes";

function invoke(channel, args) {
  return ipcRenderer.invoke("themes", String(channel || "").trim(), args || {});
}

const myApp = {
  moduleId: MODULE_ID,
  themes: {
    catalog: () => invoke("catalog"),
    get: (args) => invoke("get", args || {}),
    set: (args) => invoke("set", args || {}),
    reset: (args) => invoke("reset", args || {}),
    meta: () => invoke("meta"),
  },
};
contextBridge.exposeInMainWorld("myApp", myApp);

try {
  const { attachLinkBridge } = require("../shared/link-preload");
  attachLinkBridge(contextBridge, ipcRenderer, MODULE_ID);
} catch (err) {
  console.error("[themes preload] Link bridge failed:", err);
}

try {
  const { attachOsI18n } = require("../shared/i18n/preload-bridge");
  attachOsI18n(contextBridge, ipcRenderer);
} catch (err) {
  console.error("[themes preload] i18n bridge failed:", err);
}
