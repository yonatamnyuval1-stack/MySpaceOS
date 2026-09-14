/**
 * Permissions app preload
 */
const { contextBridge, ipcRenderer } = require("electron");

const MODULE_ID = "permissions";

function invoke(channel, args) {
  return ipcRenderer.invoke("myapp-invoke", MODULE_ID, channel, args || {});
}

const myApp = {
  moduleId: MODULE_ID,
  invoke,
  permissions: {
    overview: () => invoke("overview", {}),
    platformGet: () => invoke("platform.get", {}),
    platformSet: (args) => invoke("platform.set", args || {}),
    toolsList: () => invoke("tools.list", {}),
    toolsSet: (args) => invoke("tools.set", args || {}),
    notificationsGet: () => invoke("notifications.get", {}),
    notificationsSet: (args) => invoke("notifications.set", args || {}),
    jobsGet: () => invoke("jobs.get", {}),
    jobsSet: (args) => invoke("jobs.set", args || {}),
    bridgeDevices: () => invoke("bridge.devices", {}),
    externalGet: () => invoke("external.get", {}),
    externalSet: (args) => invoke("external.set", args || {}),
  },
};
contextBridge.exposeInMainWorld("myApp", myApp);

try {
  const { attachOsI18n } = require("../shared/i18n/preload-bridge");
  attachOsI18n(contextBridge, ipcRenderer);
} catch (err) {
  console.error("[permissions preload] i18n bridge failed:", err);
}
