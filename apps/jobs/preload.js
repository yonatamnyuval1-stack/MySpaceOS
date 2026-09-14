const { contextBridge, ipcRenderer } = require("electron");

const MODULE_ID = "jobs";

function invoke(channel, args) {
  return ipcRenderer.invoke("jobs", channel, args || {});
}

const myApp = {
  moduleId: MODULE_ID,
  invoke: (channel, args) => invoke(String(channel || "").startsWith("jobs.") ? channel : `jobs.${channel}`, args),
  jobs: {
    list: (args) => invoke("jobs.list", args || {}),
    get: (args) => invoke("jobs.get", typeof args === "string" ? { id: args } : args || {}),
    enqueue: (args) => invoke("jobs.enqueue", args || {}),
    cancel: (args) => invoke("jobs.cancel", typeof args === "string" ? { id: args } : args || {}),
    retry: (args) => invoke("jobs.retry", typeof args === "string" ? { id: args } : args || {}),
    clearFinished: () => invoke("jobs.clearFinished", {}),
    capacity: () => invoke("jobs.capacity.get", {}),
    setCapacity: (args) => invoke("jobs.capacity.set", args || {}),
    stats: () => invoke("jobs.stats", {}),
    onUpdated: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on("jobs-updated", handler);
      return () => ipcRenderer.removeListener("jobs-updated", handler);
    },
  },
};
contextBridge.exposeInMainWorld("myApp", myApp);

try {
  const { attachOsI18n } = require("../shared/i18n/preload-bridge");
  attachOsI18n(contextBridge, ipcRenderer);
} catch (err) {
  console.error("[jobs preload] i18n bridge failed:", err);
}
