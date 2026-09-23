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