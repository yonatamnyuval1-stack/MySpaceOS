const { observe } = require("./observe");

const FAULT_PREFIX = "__MS_FAULT__";
const injected = new WeakSet();

const INJECT_SCRIPT = `(() => {
  if (window.__msFaultInstalled) return;
  window.__msFaultInstalled = true;
  function report(payload) {
    try {
      console.error("${FAULT_PREFIX}" + JSON.stringify(payload));
    } catch (_) {}
  }
  window.addEventListener("error", (e) => {
    report({
      source: "renderer.error",
      type: "error",
      message: e.message || "Script error",
      filename: e.filename || "",
      lineno: e.lineno || 0,
      colno: e.colno || 0,
      stack: e.error && e.error.stack ? String(e.error.stack) : "",
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    report({
      source: "renderer.unhandledrejection",
      type: "unhandledrejection",
      message: String((r && r.message) || r || "Unhandled rejection"),
      stack: r && r.stack ? String(r.stack) : "",
    });
  });
})();`;

function isFirstPartyUrl(url) {
  const u = String(url || "").trim();
  if (!u || u === "about:blank") return false;
  if (/^file:/i.test(u)) {
    return (
      /[/\\]apps[/\\]/i.test(u) ||
      /[/\\]src[/\\]index\.html/i.test(u) ||
      /myspace-browser/i.test(u)
    );
  }
  return false;
}

function isFirstPartyContents(contents) {
  try {
    return isFirstPartyUrl(contents.getURL?.() || "");
  } catch {
    return false;
  }
}

function appIdFromContents(contents) {
  try {
    const url = String(contents.getURL?.() || "");
    const m = url.match(/[/\\]apps[/\\]([^/\\?#]+)[/\\]/i);
    if (m) return m[1];
    if (/[/\\]src[/\\]index\.html/i.test(url)) return "desktop";
    if (/myspace-browser/i.test(url)) return "myspace-browser";
  } catch {
  }
  return "unknown";
}

function parseFaultConsole(message) {
  if (typeof message !== "string" || !message.startsWith(FAULT_PREFIX)) return null;
  try {
    return JSON.parse(message.slice(FAULT_PREFIX.length));
  } catch {
    return null;
  }
}

function attachToContents(contents) {
  if (!contents || contents.isDestroyed?.()) return;
  if (injected.has(contents)) return;
  injected.add(contents);

  const safeObserve = (payload) => {
    try {
      observe(payload);
    } catch {
    }
  };

  const inject = () => {
    if (contents.isDestroyed()) return;
    if (!isFirstPartyContents(contents)) return;
    contents.executeJavaScript(INJECT_SCRIPT, true).catch(() => {});
  };

  contents.on("dom-ready", inject);
  contents.on("did-finish-load", inject);

  contents.on("console-message", (_event, level, message) => {
    if (!isFirstPartyContents(contents)) return;

    const parsed = parseFaultConsole(message);
    if (parsed) {
      const appId = parsed.appId || appIdFromContents(contents);
      safeObserve({
        ...parsed,
        appId,
        source: parsed.source || "renderer.error",
        caller: appId,
      });
      return;
    }
    if (level >= 3 && typeof message === "string") {
      const lower = message.toLowerCase();
      if (
        lower.includes("uncaught") ||
        lower.includes("typeerror") ||
        lower.includes("referenceerror") ||
        lower.includes("syntaxerror")
      ) {
        safeObserve({
          source: "renderer.error",
          appId: appIdFromContents(contents),
          message: message.slice(0, 500),
          caller: "console",
        });
      }
    }
  });

  contents.on("render-process-gone", (_event, details) => {
    const firstParty = isFirstPartyContents(contents);
    let appId = firstParty ? appIdFromContents(contents) : "webview";
    if (!firstParty) {
      try {
        const u = String(contents.getURL?.() || "");
        if (/^https?:/i.test(u)) {
          const host = new URL(u).hostname.replace(/^www\./, "");
          if (host) appId = `web:${host}`;
        }
      } catch {
      }
    }
    safeObserve({
      source: "contents.render-process-gone",
      appId,
      message: `Renderer process gone (${details?.reason || "unknown"})`,
      context: { reason: details?.reason, exitCode: details?.exitCode, firstParty },
      severity: "error",
    });
  });

  contents.on("unresponsive", () => {
    if (!isFirstPartyContents(contents)) return;
    safeObserve({
      source: "contents.unresponsive",
      appId: appIdFromContents(contents),
      message: "Page became unresponsive",
      severity: "warn",
    });
  });

  contents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    if (errorCode === -3) return; 
    if (!isFirstPartyUrl(validatedURL) && !isFirstPartyContents(contents)) return;
    safeObserve({
      source: "contents.did-fail-load",
      appId: appIdFromContents(contents),
      message: errorDescription || `Load failed (${errorCode})`,
      context: { errorCode, url: validatedURL },
      severity: "error",
    });
  });
}

function installContentsHooks() {
  const { app } = require("electron");
  app.on("web-contents-created", (_event, contents) => {
    attachToContents(contents);
  });
}

module.exports = {
  installContentsHooks,
  attachToContents,
  appIdFromContents,
  isFirstPartyUrl,
  FAULT_PREFIX,
};