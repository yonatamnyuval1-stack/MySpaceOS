const { contextBridge, ipcRenderer } = require("electron");

const MODULE_ID = "updates";

function invoke(channel, args) {
  return ipcRenderer.invoke("updates", String(channel || "").trim(), args || {});
}

const myApp = {
  moduleId: MODULE_ID,
  updates: {
    list: (args) => invoke("list", args || {}),
    status: () => invoke("status", {}),
    check: () => invoke("check", {}),
    apply: (updateId) => invoke("apply", { updateId }),
    skip: (updateId) => invoke("skip", { updateId }),
  },
};
contextBridge.exposeInMainWorld("myApp", myApp);

try {
  const { attachLinkBridge } = require("../shared/link-preload");
  attachLinkBridge(contextBridge, ipcRenderer, MODULE_ID);
} catch (err) {
  console.error("[updates preload] Link bridge failed:", err);
}
