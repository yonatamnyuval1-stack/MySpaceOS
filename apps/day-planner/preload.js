const { contextBridge, ipcRenderer } = require("electron");

const MODULE_ID = "day-planner";

function invoke(channel, args) {
  return ipcRenderer.invoke("myapp-invoke", MODULE_ID, channel, args || {});
}

const myApp = {
  moduleId: MODULE_ID,
  invoke: (channel, args) => invoke(channel, args),
};
contextBridge.exposeInMainWorld("myApp", myApp);
try {
  const { attachLocalAuthBridge } = require("../shared/local-auth/preload-bridge");
  attachLocalAuthBridge(contextBridge, ipcRenderer, "day-planner");
} catch (err) {
  console.error("[day-planner preload] Local auth bridge failed:", err);
}
