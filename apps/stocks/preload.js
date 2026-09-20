const { contextBridge, ipcRenderer } = require("electron");

const MODULE_ID = "stocks";

function invoke(channel, args) {
  return ipcRenderer.invoke("myapp-invoke", MODULE_ID, channel, args || {});
}

const myApp = {
  moduleId: MODULE_ID,
  invoke: (channel, args) => invoke(channel, args),
  geminiChat: (messages) => invoke("gemini-chat", messages),
  geminiGenerate: (payload) => invoke("gemini-generate", payload),
  analysisGenerate: (payload) => invoke("analysis.generate", payload),
  analysisGetCached: (payload) => invoke("analysis.getCached", payload),
};
contextBridge.exposeInMainWorld("myApp", myApp);

contextBridge.exposeInMainWorld("stocksAi", {
  invoke: (channel, args) => invoke(channel, args),
  geminiChat: (messages) => invoke("gemini-chat", messages),
  geminiGenerate: (payload) => invoke("gemini-generate", payload),
  analysisGenerate: (payload) => invoke("analysis.generate", payload),
  analysisGetCached: (payload) => invoke("analysis.getCached", payload),
});
try {
  const { attachLocalAuthBridge } = require("../shared/local-auth/preload-bridge");
  attachLocalAuthBridge(contextBridge, ipcRenderer, "stocks");
} catch (err) {
  console.error("[stocks preload] Local auth bridge failed:", err);
}

try {
  const { attachOsI18n } = require("../shared/i18n/preload-bridge");
  attachOsI18n(contextBridge, ipcRenderer);
} catch (err) {
  console.error("[preload] i18n bridge failed:", err);
}
