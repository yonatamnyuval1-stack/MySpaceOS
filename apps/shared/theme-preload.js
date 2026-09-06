
function attachThemesApi(contextBridge, ipcRenderer, moduleId, _exposeTargetIgnored) {
  const id = String(moduleId || "").trim();
  if (!id) {
    console.error("[themes] attachThemesApi: missing moduleId");
    return null;
  }

  const api = {
    moduleId: id,
    get: (args) =>
      ipcRenderer.invoke("themes", "get", { appId: id, ...(args || {}) }),
    onChange: (cb) => {
      if (typeof cb !== "function") return () => {};
      const handler = (_event, payload) => {
        try {
          if (!payload) return;
          if (payload.appId && payload.appId !== id) return;
          cb(payload);
        } catch {
        }
      };
      try {
        ipcRenderer.on("themes:changed", handler);
      } catch (err) {
        console.error("[themes] onChange subscribe failed:", err);
        return () => {};
      }
      return () => {
        try {
          ipcRenderer.removeListener("themes:changed", handler);
        } catch {
        }
      };
    },
  };

  try {
    contextBridge.exposeInMainWorld("myAppThemes", api);
  } catch (err) {
    console.warn("[themes] myAppThemes expose skipped:", err?.message || err);
  }

  return api;
}

module.exports = { attachThemesApi };