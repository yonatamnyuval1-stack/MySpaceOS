const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("myspaceBrowser", {
  getHome: () => ipcRenderer.invoke("myspace-browser-home"),
  listBookmarks: () => ipcRenderer.invoke("myspace-browser-bookmarks"),
  search: (query) => ipcRenderer.invoke("desktop-search", { query, mode: "browser" }),
  open: (item) => {
    ipcRenderer.sendToHost("myspace-browser-open", item);
  },
  navigate: (url) => {
    ipcRenderer.sendToHost("myspace-browser-navigate", { url: String(url || "") });
  },
});
try {
  const { attachOsI18n } = require("../shared/i18n/preload-bridge");
  attachOsI18n(contextBridge, ipcRenderer);
} catch (err) {
  console.error("[myspace-browser preload] i18n bridge failed:", err);
}