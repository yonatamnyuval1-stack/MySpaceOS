const { contextBridge, ipcRenderer } = require("electron");

const myApp = {
  moduleId: "shell-console",
  invoke: (channel, args) => ipcRenderer.invoke("myapp-invoke", "shell-console", channel, args || {}),
};
contextBridge.exposeInMainWorld("myApp", myApp);