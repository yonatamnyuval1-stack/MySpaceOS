const { contextBridge, ipcRenderer } = require("electron");

/**
 * Shared preload for apps/shared/local-auth/login.html.
 * Module id comes from ?module= in the login URL (read when APIs are called).
 */
function getModuleId() {
  try {
    const fromQuery = new URLSearchParams(window.location.search).get("module");
    if (fromQuery) return String(fromQuery).trim();
  } catch {
    /* ignore */
  }
  return "";
}

function invoke(channel, args) {
  const moduleId = getModuleId();
  if (!moduleId) {
    return Promise.reject(new Error("Missing module id in login URL"));
  }
  return ipcRenderer.invoke("myapp-invoke", moduleId, channel, args || {});
}

async function withNavigate(result) {
  if (result?.ok && result.navigateTo) {
    window.location.href = result.navigateTo;
  }
  return result;
}

const appAuth = {
  get moduleId() {
    return getModuleId();
  },
  authStatus: () => invoke("auth-status"),
  myspaceStatus: () => invoke("auth-myspace-status"),
  continueWithMyspace: (payload) =>
    invoke("auth-continue-myspace", payload || {}).then(withNavigate),
  register: (payload) => invoke("auth-register", payload).then(withNavigate),
  login: (payload) => invoke("auth-login", payload).then(withNavigate),
  logout: () => invoke("auth-logout").then(withNavigate),
  enterApp: () => invoke("auth-enter-app").then(withNavigate),
  getCurrentUser: () => invoke("auth-current-user"),
};

contextBridge.exposeInMainWorld("appAuth", appAuth);

contextBridge.exposeInMainWorld("myApp", {
  get moduleId() {
    return getModuleId();
  },
  invoke: (channel, args) => invoke(channel, args),
});
