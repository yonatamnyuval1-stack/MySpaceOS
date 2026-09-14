function attachOsI18n(contextBridge, ipcRenderer) {
  function languageFromResult(res) {
    if (typeof res === "string") return res || "en";
    return res?.language || "en";
  }

  contextBridge.exposeInMainWorld("osI18n", {
    getLanguage: async () => {
      try {
        const res = await ipcRenderer.invoke("os-ui-language");
        return languageFromResult(res);
      } catch {
        return "en";
      }
    },

    getLanguageSync: () => {
      try {
        const res = ipcRenderer.sendSync("os-ui-language-sync");
        return languageFromResult(res);
      } catch {
        return "en";
      }
    },
    notifyChanged: (language) => ipcRenderer.invoke("os-ui-language-broadcast", { language }),
    onChanged: (callback) => {
      const handler = (_event, data) => callback(data || {});
      ipcRenderer.on("myspace-language-changed", handler);
      return () => ipcRenderer.removeListener("myspace-language-changed", handler);
    },
  });
}

module.exports = { attachOsI18n };