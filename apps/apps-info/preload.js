const { contextBridge, ipcRenderer } = require("electron");

const MODULE_ID = "apps-info";

const myApp = {
  moduleId: MODULE_ID,
  invoke: (channel, args) => ipcRenderer.invoke("myapp-invoke", MODULE_ID, channel, args || {}),
};
contextBridge.exposeInMainWorld("myApp", myApp);
