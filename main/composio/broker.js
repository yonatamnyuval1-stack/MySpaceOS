const { shell } = require("electron");
const store = require("./store");
const client = require("./client");
const { syncExternalProfiles } = require("./sync");
const { reportRuntimeFailure } = require("../resolve/report-helper");

async function openUrl(url) {
  const u = String(url || "").trim();
  if (!u) return { ok: false, error: "No URL to open" };
  if (!/^https?:\/\//i.test(u)) {
    return { ok: false, error: "Connect URL must be http(s)" };
  }
  try {
    await shell.openExternal(u);
    return { ok: true, url: u };
  } catch (err) {
    reportRuntimeFailure("composio", "OPEN_URL_FAILED", err, { url: u });
    return { ok: false, error: err?.message || "Could not open browser", url: u };
  }
}

async function handleComposioInvoke(channel, args = {}, ctx = {}) {
  const ch = String(channel || "").trim();
  const a = args && typeof args === "object" ? args : {};

  switch (ch) {
    case "status":
      return client.status();

    case "key.set":
    case "setKey": {
      const key = String(a.apiKey || a.key || "").trim();
      if (!key) return { ok: false, error: "apiKey required" };
      client.invalidateSession();
      const saved = store.setApiKey(key);
      return { ok: true, ...saved };
    }

    case "key.clear":
    case "clearKey":
      client.invalidateSession();
      store.clearApiKey();
      return { ok: true, hasKey: false };

    case "settings.get":
      return { ok: true, settings: store.getSettings(), ...(await client.status()) };

    case "settings.set": {
      const patch = {};
      if (a.userId != null) patch.userId = String(a.userId).trim();
      if (a.allowlist != null) {
        patch.allowlist = Array.isArray(a.allowlist)
          ? a.allowlist
          : String(a.allowlist)
              .split(/[,\s]+/)
              .map((x) => x.trim().toLowerCase())
              .filter(Boolean);
      }
      if (a.enabled != null) patch.enabled = a.enabled !== false && a.enabled !== "false";
      const settings = store.saveSettings(patch);
      client.invalidateSession();
      return { ok: true, settings };
    }

    case "toolkits.list":
    case "listToolkits":
      return client.listToolkits(a);

    case "tools.list":
    case "listTools": {
      const toolkit = a.toolkit || a.toolkit_slug || ctx.toolkit || "";
      return client.listTools({ ...a, toolkit });
    }

    case "connections.list":
    case "listConnections":
      return client.listConnections(a);

    case "connect":
    case "openConnect": {
      const toolkit = a.toolkit || a.toolkit_slug || ctx.toolkit || "";
      let res;
      try {
        res = await client.connectToolkit({ ...a, toolkit });
      } catch (err) {
        reportRuntimeFailure("composio", "CONNECT_FAILED", err, { toolkit });
        return { ok: false, error: err?.message || "Connect failed", toolkit };
      }
      if (!res?.ok) return res || { ok: false, error: "Connect failed", toolkit };
      if (a.open === false || !res.url) return res;
      const opened = await openUrl(res.url);
      if (!opened.ok) {
        return {
          ok: true,
          toolkit: res.toolkit,
          url: res.url,
          opened: false,
          warning: opened.error || "Browser did not open",
          connectionId: res.connectionId || null,
          source: res.source,
        };
      }
      return {
        ok: true,
        toolkit: res.toolkit,
        url: res.url,
        opened: true,
        connectionId: res.connectionId || null,
        source: res.source,
      };
    }

    case "execute": {
      let tool = a.tool || a.slug || a.tool_slug || "";
      if (!tool && ctx.toolSlug) tool = ctx.toolSlug;
      return client.executeTool({ ...a, tool });
    }

    case "sync":
    case "profiles.sync": {
      const registry = require("../link/registry");
      return syncExternalProfiles(registry);
    }

    case "session.reset":
      store.setSessionId(null);
      client.invalidateSession();
      return { ok: true, sessionId: null };

    case "session.ensure":
      return client.getSession(a);

    default: {
      if (/^[A-Z0-9_]+$/i.test(ch) && ch.includes("_")) {
        return client.executeTool({
          tool: ch,
          arguments: a.arguments || a.args || a,
        });
      }
      if (ctx.toolSlug) {
        return client.executeTool({
          tool: ctx.toolSlug,
          arguments: a.arguments || a.args || a,
        });
      }
      return { ok: false, error: `Unknown Composio channel: ${ch}` };
    }
  }
}

module.exports = { handleComposioInvoke };