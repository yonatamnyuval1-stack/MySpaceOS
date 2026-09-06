const { contextBridge, ipcRenderer } = require("electron");

const MODULE_ID = "model-flow";

const myApp = {
  moduleId: MODULE_ID,
  invoke: (channel, args) => ipcRenderer.invoke("myapp-invoke", MODULE_ID, channel, args || {}),
};
contextBridge.exposeInMainWorld("myApp", myApp);

contextBridge.exposeInMainWorld("spaceFile", {
  export: (args) => ipcRenderer.invoke("space-file", "export", args || {}),
});
