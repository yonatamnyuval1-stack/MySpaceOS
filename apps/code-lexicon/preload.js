const { contextBridge, ipcRenderer } = require("electron");

const myApp = {
  moduleId: "code-lexicon",
  invoke: (channel, args) => ipcRenderer.invoke("myapp-invoke", "code-lexicon", channel, args || {}),
};
contextBridge.exposeInMainWorld("myApp", myApp);
try {
  const { attachLocalAuthBridge } = require("../shared/local-auth/preload-bridge");
  attachLocalAuthBridge(contextBridge, ipcRenderer, "code-lexicon");
} catch (err) {
  console.error("[code-lexicon preload] Local auth bridge failed:", err);
}
