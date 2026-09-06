function attachLocalAuthBridge(contextBridge, ipcRenderer, moduleId) {
  const id = String(moduleId || "").trim();

  function invoke(channel, args) {
    return ipcRenderer.invoke("myapp-invoke", id, channel, args || {});
  }

  async function withNavigate(result) {
    if (result?.ok && result.navigateTo) {
      window.location.href = result.navigateTo;
    }
    return result;
  }

  contextBridge.exposeInMainWorld("appAuth", {
    moduleId: id,
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
}

module.exports = { attachLocalAuthBridge };
