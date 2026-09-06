function attachFaultBridge(contextBridge, ipcRenderer, moduleId) {
  const mod = String(moduleId || "unknown").trim() || "unknown";

  const report = (payload) => {
    const body = {
      appId: mod,
      ...(payload && typeof payload === "object" ? payload : {}),
      caller: mod,
      source: (payload && payload.source) || "manual",
    };
    return ipcRenderer.invoke("fault.report", body).catch(() => ({ ok: false }));
  };

  const api = {
    moduleId: mod,
    report,
  };

  try {
    contextBridge.exposeInMainWorld("Fault", api);
  } catch {
  }

  return api;
}

module.exports = { attachFaultBridge };