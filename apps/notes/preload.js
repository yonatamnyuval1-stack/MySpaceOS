const { contextBridge, ipcRenderer } = require("electron");

const MODULE_ID = "notes";

function invoke(channel, args) {
  return ipcRenderer.invoke("myapp-invoke", MODULE_ID, channel, args || {});
}

async function withNavigate(result) {
  if (result?.ok && result.navigateTo) {
    window.location.href = result.navigateTo;
  }
  return result;
}

contextBridge.exposeInMainWorld("myApp", {
  moduleId: MODULE_ID,
  invoke,
});

contextBridge.exposeInMainWorld("appAuth", {
  moduleId: MODULE_ID,
  authStatus: () => invoke("auth-status"),
  myspaceStatus: () => invoke("auth-myspace-status"),
  continueWithMyspace: (payload) =>
    invoke("auth-continue-myspace", payload || {}).then(withNavigate),
  register: (payload) => invoke("auth-register", payload).then(withNavigate),
  login: (payload) => invoke("auth-login", payload).then(withNavigate),
  logout: () => invoke("auth-logout").then(withNavigate),
  enterApp: () => invoke("auth-enter-app").then(withNavigate),
  getCurrentUser: () => invoke("auth-current-user"),
});

try {
  const { attachLinkBridge } = require("../shared/link-preload");
  attachLinkBridge(contextBridge, ipcRenderer, MODULE_ID);
} catch (err) {
  console.error("[notes preload] Link bridge failed:", err);
}

try {
  const { attachOsI18n } = require("../shared/i18n/preload-bridge");
  attachOsI18n(contextBridge, ipcRenderer);
} catch (err) {
  console.error("[preload] i18n bridge failed:", err);
}
