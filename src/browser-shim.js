(function () {
  if (navigator.userAgent.includes("Electron")) {
    return;
  }

  if (window.mySpace) {
    return;
  }

  document.body.classList.add("browser-preview");

  window.mySpace = {
    async getConfig() {
      const res = await fetch("/config/apps.json");
      if (!res.ok) throw new Error("Failed to load config/apps.json");
      return res.json();
    },

    async getDefaults() {
      const res = await fetch("/config/apps.json");
      return res.json();
    },

    async resolveAppIcon(app) {
      if (app.iconData) return app.iconData;
      return window.MySpaceIcons.resolveIconFromConfig(app);
    },

    async launchApp(app) {
      if (app.type === "builtin") {
        return { ok: true, mode: "builtin", builtin: app.id };
      }
      if (app.type === "url") {
        let url = app.url?.trim();
        if (!url) return { ok: false, error: "URL is missing" };
        if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
        return { ok: true, mode: "webview", url, forceInApp: true };
      }
      if (app.type === "external" && app.inAppUrl?.trim()) {
        let url = app.inAppUrl.trim();
        if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
        try {
          const host = new URL(url).hostname.toLowerCase();
          const local =
            host === "localhost" || host === "127.0.0.1" || host.endsWith(".local");
          if (local) return { ok: true, mode: "webview", url };
        } catch {
        }
      }
      return {
        ok: false,
        error: "Programs only work in open.bat. you are in browser preview",
      };
    },
  };
})();
