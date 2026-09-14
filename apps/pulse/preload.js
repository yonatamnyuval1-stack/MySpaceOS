const { contextBridge, ipcRenderer } = require("electron");

const MODULE_ID = "pulse";

function invoke(channel, args) {
  return ipcRenderer.invoke("myapp-invoke", MODULE_ID, channel, args || {});
}

const myApp = {
  moduleId: MODULE_ID,
  invoke,
};
contextBridge.exposeInMainWorld("myApp", myApp);

try {
  const commandHandlers = new Map();

  ipcRenderer.invoke("myapp-invoke", MODULE_ID, "link.register", { moduleId: MODULE_ID }).catch(() => {});

  ipcRenderer.on("link-command", async (_event, payload) => {
    if (!payload || payload.target !== MODULE_ID) return;
    const verb = String(payload.verb || "");
    const handler = commandHandlers.get(verb);
    let result = { ok: false, error: `No handler for ${MODULE_ID}.${verb}` };
    try {
      if (handler) result = await handler(payload.args || {}, payload);
    } catch (err) {
      result = { ok: false, error: err?.message || "Command failed" };
    }
    if (payload.requestId) {
      ipcRenderer.invoke("myapp-invoke", MODULE_ID, "link.command.reply", {
        requestId: payload.requestId,
        ok: result?.ok !== false,
        result: result?.result ?? result,
        error: result?.error,
      });
    }
  });

  contextBridge.exposeInMainWorld("Link", {
    moduleId: MODULE_ID,
    declare: (payload) =>
      invoke("link.routes.declare", { moduleId: MODULE_ID, ...(payload || {}) }),
    routes: () => invoke("link.routes.list", {}),
    send: (args) => invoke("link.command.send", args || {}),
    publish: (args) => invoke("link.event.publish", args || {}),
    subscribe: (topics) =>
      invoke("link.event.subscribe", {
        topics: Array.isArray(topics) ? topics : [topics],
      }),
    unsubscribe: (topics) =>
      invoke("link.event.unsubscribe", {
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
  });
} catch (err) {
  console.error("[pulse preload] Link bridge failed:", err);
}
try {
  const { attachOsI18n } = require("../shared/i18n/preload-bridge");
  attachOsI18n(contextBridge, ipcRenderer);
} catch (err) {
  console.error("[pulse preload] i18n bridge failed:", err);
}
