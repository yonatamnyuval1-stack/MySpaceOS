(function () {
  function faviconUrlForSite(siteUrl) {
    try {
      const host = new URL(siteUrl).hostname;
      return `https://www.google.com/s2/favicons?domain=${host}&sz=128`;
    } catch {
      return null;
    }
  }

  function resolveIconFromConfig(app) {
    if (app.iconData) {
      return app.iconData;
    }
    if (app.iconUrl) {
      return app.iconUrl;
    }
    if (app.iconPath) {
      const normalized = app.iconPath.replace(/\\/g, "/").replace(/^\//, "");
      return normalized;
    }
    if (app.type === "url" && app.url) {
      return faviconUrlForSite(app.url);
    }
    return null;
  }

  function emojiFallback(app) {
    return app.icon || "📦";
  }

  window.MySpaceIcons = {
    faviconUrlForSite,
    resolveIconFromConfig,
    emojiFallback,
  };
})();