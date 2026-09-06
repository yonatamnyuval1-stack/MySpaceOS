function attachLinkBridge(contextBridge, ipcRenderer, moduleId) {
  const mod = String(moduleId || "").trim();
  if (!mod) return;

  const commandHandlers = new Map();

  ipcRenderer.invoke("myapp-invoke", mod, "link.register", { moduleId: mod }).catch(() => {});

  ipcRenderer.on("link-command", async (_event, payload) => {
    if (!payload || payload.target !== mod) return;
    const verb = String(payload.verb || "");
    const handler = commandHandlers.get(verb);
    let result = { ok: false, error: `No handler for ${mod}.${verb}` };
    try {
      if (handler) {
        result = await handler(payload.args || {}, payload);
      }
    } catch (err) {
      result = { ok: false, error: err?.message || "Command failed" };
    }
    if (payload.requestId) {
      ipcRenderer.invoke("myapp-invoke", mod, "link.command.reply", {
        requestId: payload.requestId,
        ok: result?.ok !== false,
        result: result?.result ?? result,
        error: result?.error,
      });
    }
  });

  const linkApi = {
    moduleId: mod,
    declare: (payload) =>
      ipcRenderer.invoke("myapp-invoke", mod, "link.routes.declare", {
        moduleId: mod,
        ...(payload || {}),
      }),
    routes: () => ipcRenderer.invoke("myapp-invoke", mod, "link.routes.list", {}),
    send: (args) => ipcRenderer.invoke("myapp-invoke", mod, "link.command.send", args || {}),
    publish: (args) => ipcRenderer.invoke("myapp-invoke", mod, "link.event.publish", args || {}),
    subscribe: (topics) =>
      ipcRenderer.invoke("myapp-invoke", mod, "link.event.subscribe", {
        topics: Array.isArray(topics) ? topics : [topics],
      }),
    unsubscribe: (topics) =>
      ipcRenderer.invoke("myapp-invoke", mod, "link.event.unsubscribe", {
        topics: Array.isArray(topics) ? topics : topics ? [topics] : [],
      }),
    onEvent: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on("link-event", handler);
      return () => ipcRenderer.removeListener("link-event", handler);
    },
    onCommand: (verb, callback) => {
      commandHandlers.set(String(verb), callback);
      return () => commandHandlers.delete(String(verb));
    },
    onActivity: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on("link-activity", handler);
      return () => ipcRenderer.removeListener("link-activity", handler);
    },
  };

  contextBridge.exposeInMainWorld("Link", linkApi);

  try {
    const { attachFaultBridge } = require("./fault-preload");
    attachFaultBridge(contextBridge, ipcRenderer, mod);
  } catch (err) {
    console.error("[link preload] Fault bridge failed:", err);
  }
}

module.exports = { attachLinkBridge };