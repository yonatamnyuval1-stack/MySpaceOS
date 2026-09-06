/**
 * Scheduler app preload — time contracts via platform scheduler IPC.
 */
const { contextBridge, ipcRenderer } = require("electron");

const MODULE_ID = "scheduler";

function invoke(channel, args) {
  return ipcRenderer.invoke("scheduler", channel, args || {});
}

const myApp = {
  moduleId: MODULE_ID,
  invoke: (channel, args) =>
    invoke(String(channel || "").startsWith("schedule.") ? channel : `schedule.${channel}`, args),
  scheduler: {
    list: (args) => invoke("schedule.list", args || {}),
    get: (args) =>
      invoke("schedule.get", typeof args === "string" ? { id: args } : args || {}),
    add: (args) => invoke("schedule.add", typeof args === "string" ? { spec: args } : args || {}),
    pause: (args) =>
      invoke("schedule.pause", typeof args === "string" ? { id: args } : args || {}),
    resume: (args) =>
      invoke("schedule.resume", typeof args === "string" ? { id: args } : args || {}),
    remove: (args) =>
      invoke("schedule.remove", typeof args === "string" ? { id: args } : args || {}),
    runNow: (args) =>
      invoke("schedule.runNow", typeof args === "string" ? { id: args } : args || {}),
    history: (args) => invoke("schedule.history", args || {}),
    clearHistory: () => invoke("schedule.clearHistory", {}),
    stats: () => invoke("schedule.stats", {}),
    onUpdated: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on("scheduler-updated", handler);
      return () => ipcRenderer.removeListener("scheduler-updated", handler);
    },
  },
};
contextBridge.exposeInMainWorld("myApp", myApp);
