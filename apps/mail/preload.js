const { contextBridge, ipcRenderer } = require("electron");

const MODULE_ID = "mail";

function mailInvoke(action, args) {
  return ipcRenderer.invoke("myapp-invoke", MODULE_ID, action, args || {});
}

const myApp = {
  moduleId: MODULE_ID,
  invoke: (channel, args) => mailInvoke(channel, args),
};
contextBridge.exposeInMainWorld("myApp", myApp);

contextBridge.exposeInMainWorld("mailApi", {
  status: () => mailInvoke("status"),
  configStatus: () => mailInvoke("config.status"),
  providers: () => mailInvoke("providers.list"),
  connect: (provider) => mailInvoke("accounts.connect", { provider }),
  disconnect: (accountId) => mailInvoke("accounts.disconnect", { accountId }),
  listMessages: (args) => mailInvoke("messages.list", args),
  getMessage: (args) => mailInvoke("messages.get", args),
  listLabels: (args) => mailInvoke("labels.list", args),
  sync: (args) => mailInvoke("sync.now", args),
  hubCatalog: () => mailInvoke("hub.catalog"),
  hubList: () => mailInvoke("hub.list"),
  hubConnect: (args) => mailInvoke("hub.connect", args || {}),
  hubDisconnect: (id) => mailInvoke("hub.disconnect", { id }),
  hubOpen: (serviceId) => mailInvoke("hub.open", { serviceId }),
  hubOpenExternal: (serviceId) => mailInvoke("hub.openExternal", { serviceId }),
  hubOpenInShell: (serviceId, opts) =>
    mailInvoke("hub.openInShell", { serviceId, ...(opts && typeof opts === "object" ? opts : {}) }),
  hubEnsure: (serviceId) => mailInvoke("hub.ensure", { serviceId }),
  onEvent: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("mail-event", handler);
    return () => ipcRenderer.removeListener("mail-event", handler);
  },
});
