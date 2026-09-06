const store = require("./store");
const API_BASE = "https://backend.composio.dev/api/v3.1";
let sdkModulePromise = null;
let cachedClient = null;
let cachedSession = null;
let cachedSessionKey = "";

function requireKey() {
  const apiKey = store.getApiKey();
  if (!apiKey) {
    return { ok: false, error: "Add your Composio API key in Pulse → External" };
  }
  return { ok: true, apiKey };
}

async function rest(pathname, { method = "GET", body, apiKey } = {}) {
  const key = apiKey || store.getApiKey();
  if (!key) return { ok: false, error: "Missing Composio API key" };

  const url = pathname.startsWith("http") ? pathname : `${API_BASE}${pathname}`;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        "x-api-key": key,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    return { ok: false, error: err.message || "Network error contacting Composio" };
  }

  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.message ||
      data?.error ||
      (typeof data?.error === "string" ? data.error : null) ||
      `Composio HTTP ${res.status}`;
    const details = Array.isArray(data?.error?.errors)
      ? data.error.errors.map((e) => (typeof e === "string" ? e : e?.message || JSON.stringify(e))).join("; ")
      : data?.error?.suggested_fix || null;
    return {
      ok: false,
      error: details ? `${String(msg)} — ${details}` : String(msg),
      status: res.status,
      data,
    };
  }
  return { ok: true, data, status: res.status };
}

async function loadSdk() {
  if (!sdkModulePromise) {
    sdkModulePromise = import("@composio/core").catch((err) => {
      sdkModulePromise = null;
      throw err;
    });
  }
  return sdkModulePromise;
}

function invalidateSession() {
  cachedSession = null;
  cachedClient = null;
  cachedSessionKey = "";
}

async function getSdkClient(apiKey) {
  const { Composio } = await loadSdk();
  if (!cachedClient || cachedClient.__key !== apiKey) {
    cachedClient = new Composio({ apiKey });
    cachedClient.__key = apiKey;
    cachedSession = null;
    cachedSessionKey = "";
  }
  return cachedClient;
}

async function getSession(options = {}) {
  const gate = requireKey();
  if (!gate.ok) return gate;

  const settings = store.getSettings();
  const userId = store.getUserId();
  const allowlist = settings.allowlist || [];
  const sessionKey = `${gate.apiKey}|${userId}|${allowlist.join(",")}|${settings.sessionId || ""}`;

  if (cachedSession && cachedSessionKey === sessionKey && !options.forceNew) {
    return { ok: true, session: cachedSession, apiKey: gate.apiKey, userId };
  }

  try {
    const composio = await getSdkClient(gate.apiKey);
    let session = null;

    if (settings.sessionId && !options.forceNew) {
      try {
        session = await composio.use(settings.sessionId);
      } catch {
        session = null;
      }
    }

    if (!session) {
      const createOpts = {};
      if (allowlist.length) createOpts.toolkits = allowlist;
      session = await composio.create(userId, createOpts);
      const sid = session.sessionId || session.session_id || null;
      if (sid) store.setSessionId(sid);
    }

    cachedSession = session;
    cachedSessionKey = sessionKey;
    return { ok: true, session, apiKey: gate.apiKey, userId };
  } catch (err) {
    return {
      ok: false,
      error: err?.message || String(err),
      hint: "SDK session failed",
    };
  }
}

function normalizeToolkit(row) {
  if (!row || typeof row !== "object") return null;
  const slug = String(row.slug || row.toolkit_slug || row.name || row.key || "")
    .trim()
    .toLowerCase();
  if (!slug) return null;
  return {
    slug,
    name: String(row.name || row.displayName || row.display_name || slug),
    description: String(row.description || row.meta?.description || ""),
    logo: row.logo || row.meta?.logo || row.image || null,
    categories: row.categories || row.meta?.categories || [],
  };
}

function normalizeTool(row) {
  if (!row || typeof row !== "object") return null;
  const slug = String(row.slug || row.tool_slug || row.name || "").trim();
  if (!slug) return null;
  const toolkit = String(
    row.toolkit || row.toolkit_slug || row.appName || row.app || slug.split("_")[0] || ""
  )
    .trim()
    .toLowerCase();
  return {
    slug,
    name: String(row.name || row.displayName || slug),
    description: String(row.description || ""),
    toolkit,
    input: row.input_parameters || row.inputParameters || row.parameters || row.schema || {},
  };
}

function normalizeAccount(row) {
  if (!row || typeof row !== "object") return null;
  const status = String(row.status || row.state?.val?.status || row.state || row.data?.status || "unknown")
    .trim()
    .toUpperCase();
  const disabled = row.is_disabled === true || row.disabled === true;
  const active = !disabled && (status === "ACTIVE" || status === "SUCCESS" || status === "CONNECTED");
  return {
    id: String(row.id || row.connected_account_id || ""),
    toolkit: String(row.toolkit?.slug || row.toolkit_slug || row.appName || row.app || "")
      .trim()
      .toLowerCase(),
    status: status || "UNKNOWN",
    active,
    createdAt: row.created_at || row.createdAt || null,
  };
}

function isActiveAccount(account) {
  return Boolean(account && account.active);
}

async function listToolkits(args = {}) {
  const gate = requireKey();
  if (!gate.ok) return gate;

  const q = String(args.q || "").trim().toLowerCase();
  const pageSize = Math.min(1000, Math.max(1, parseInt(args.pageSize, 10) || 200));
  const limit = Math.min(2000, Math.max(1, parseInt(args.limit, 10) || 500));
  const cursor = String(args.cursor || "").trim() || null;
  const settings = store.getSettings();
  const allow = settings.allowlist.length ? new Set(settings.allowlist) : null;

  function applyFilters(rows) {
    let out = rows;
    if (q) {
      out = out.filter(
        (t) =>
          t.slug.includes(q) ||
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      );
    }
    if (allow) out = out.filter((t) => allow.has(t.slug));
    return out;
  }

  const all = [];
  let nextCursor = cursor;
  let totalItems = null;
  let pages = 0;
  const maxPages = Math.max(1, Math.ceil(limit / pageSize));

  do {
    const qs = new URLSearchParams();
    qs.set("limit", String(pageSize));
    qs.set("sort_by", "usage");
    if (q) qs.set("search", q);
    if (nextCursor) qs.set("cursor", nextCursor);
    const res = await rest(`/toolkits?${qs}`, { apiKey: gate.apiKey });
    if (!res.ok) {
      if (all.length) break;
      return res;
    }
    const batch = (res.data?.items || res.data?.toolkits || [])
      .map(normalizeToolkit)
      .filter(Boolean);
    all.push(...batch);
    totalItems = res.data?.total_items ?? totalItems;
    nextCursor = res.data?.next_cursor || null;
    pages += 1;
    if (!nextCursor || all.length >= limit) break;
  } while (pages < maxPages);

  const rows = applyFilters(all).slice(0, limit);
  return {
    ok: true,
    toolkits: rows,
    nextCursor: nextCursor || null,
    totalItems: totalItems != null ? Number(totalItems) : rows.length,
    source: "rest",
  };
}

async function listTools(args = {}) {
  const gate = requireKey();
  if (!gate.ok) return gate;

  const toolkit = String(args.toolkit || args.toolkit_slug || args.app || "")
    .trim()
    .toLowerCase();
  const q = String(args.q || "").trim().toLowerCase();
  const limit = Math.min(100, Math.max(1, parseInt(args.limit, 10) || 40));

  try {
    const composio = await getSdkClient(gate.apiKey);
    if (composio.tools?.get) {
      const raw = await composio.tools.get(store.getUserId(), {
        toolkits: toolkit ? [toolkit] : undefined,
        limit,
      });
      let rows = (Array.isArray(raw) ? raw : raw?.items || raw?.tools || [])
        .map(normalizeTool)
        .filter(Boolean);
      if (q) {
        rows = rows.filter(
          (t) =>
            t.slug.toLowerCase().includes(q) ||
            t.name.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q)
        );
      }
      return { ok: true, tools: rows.slice(0, limit), toolkit, source: "sdk" };
    }
  } catch {
  }

  const qs = new URLSearchParams();
  qs.set("limit", String(limit));
  if (toolkit) qs.set("toolkit_slug", toolkit);
  if (q) qs.set("search", q);
  const res = await rest(`/tools?${qs}`, { apiKey: gate.apiKey });
  if (!res.ok) return res;
  let rows = (res.data?.items || res.data?.tools || res.data || [])
    .map(normalizeTool)
    .filter(Boolean);
  if (toolkit) rows = rows.filter((t) => !t.toolkit || t.toolkit === toolkit);
  if (q) {
    rows = rows.filter(
      (t) =>
        t.slug.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
    );
  }
  return { ok: true, tools: rows.slice(0, limit), toolkit, source: "rest" };
}

async function listConnections(args = {}) {
  const gate = requireKey();
  if (!gate.ok) return gate;
  const userId = store.getUserId();
  const includeInactive = args.all === true || args.includeInactive === true;

  let rows = null;
  let source = "rest";

  try {
    const composio = await getSdkClient(gate.apiKey);
    if (composio.connectedAccounts?.list) {
      const raw = await composio.connectedAccounts.list({ userIds: [userId] });
      rows = (raw?.items || raw || []).map(normalizeAccount).filter(Boolean);
      source = "sdk";
    }
  } catch {
    rows = null;
  }

  if (!Array.isArray(rows)) {
    const qs = new URLSearchParams();
    qs.set("user_ids", userId);
    const res = await rest(`/connected_accounts?${qs}`, { apiKey: gate.apiKey });
    if (!res.ok) return res;
    rows = (res.data?.items || res.data?.connected_accounts || res.data || [])
      .map(normalizeAccount)
      .filter(Boolean);
    source = "rest";
  }

  const active = rows.filter(isActiveAccount);
  return {
    ok: true,
    connections: includeInactive ? rows : active,
    activeConnections: active,
    userId,
    source,
  };
}

function extractConnectUrl(data) {
  if (!data || typeof data !== "object") return null;
  return (
    data.redirect_url ||
    data.redirectUrl ||
    data.url ||
    data.link ||
    data.connect_link ||
    data.connectLink ||
    data.redirectUri ||
    null
  );
}

async function resolveAuthConfigId(toolkit) {
  const qs = new URLSearchParams({
    toolkit_slug: toolkit,
    limit: "10",
  });
  const listed = await rest(`/auth_configs?${qs}`);
  if (!listed.ok) return listed;

  const items = Array.isArray(listed.data?.items) ? listed.data.items : [];
  const enabled = items.filter((row) => {
    const status = String(row?.status || "ENABLED").toUpperCase();
    return status === "ENABLED" || status === "ACTIVE";
  });
  const pick =
    enabled.find((row) => row?.is_composio_managed) ||
    enabled[0] ||
    items.find((row) => row?.is_composio_managed) ||
    items[0] ||
    null;

  if (pick?.id) {
    return { ok: true, authConfigId: String(pick.id), created: false, authConfig: pick };
  }

  const created = await rest("/auth_configs", {
    method: "POST",
    body: {
      toolkit: { slug: toolkit },
      auth_config: { type: "use_composio_managed_auth" },
    },
  });
  if (!created.ok) {
    return {
      ok: false,
      error:
        created.error ||
        `No auth config for "${toolkit}". Create one in the Composio dashboard, or enable Composio-managed auth.`,
      status: created.status,
      data: created.data,
    };
  }

  const id =
    created.data?.auth_config?.id ||
    created.data?.id ||
    created.data?.auth_config_id ||
    null;
  if (!id) {
    return { ok: false, error: `Created auth config for "${toolkit}" but got no id`, data: created.data };
  }
  return { ok: true, authConfigId: String(id), created: true, authConfig: created.data };
}

async function connectToolkit(args = {}) {
  const toolkit = String(args.toolkit || args.toolkit_slug || args.app || "")
    .trim()
    .toLowerCase();
  if (!toolkit) return { ok: false, error: "toolkit required" };

  const gate = requireKey();
  if (!gate.ok) return { ...gate, toolkit };

  try {
    const auth = await resolveAuthConfigId(toolkit);
    if (!auth.ok) return { ...auth, toolkit };

    const body = {
      auth_config_id: auth.authConfigId,
      user_id: store.getUserId(),
    };
    if (args.callbackUrl || args.callback_url) {
      body.callback_url = args.callbackUrl || args.callback_url;
    }

    const res = await rest("/connected_accounts/link", {
      method: "POST",
      body,
    });

    if (!res.ok) {
      return {
        ok: false,
        error: res.error || "Connect link failed",
        toolkit,
        authConfigId: auth.authConfigId,
        status: res.status,
      };
    }

    const url = extractConnectUrl(res.data);
    if (!url) {
      return {
        ok: false,
        error: "Composio returned no connect URL",
        toolkit,
        authConfigId: auth.authConfigId,
        source: "rest",
      };
    }

    return {
      ok: true,
      toolkit,
      url,
      authConfigId: auth.authConfigId,
      connectionId:
        res.data?.connected_account_id ||
        res.data?.id ||
        res.data?.connectedAccountId ||
        null,
      expiresAt: res.data?.expires_at || null,
      source: "rest",
    };
  } catch (err) {
    return {
      ok: false,
      error: err?.message || String(err) || "Connect failed",
      toolkit,
    };
  }
}

async function executeTool(args = {}) {
  const tool = String(args.tool || args.slug || args.tool_slug || args.channel || "").trim();
  if (!tool) return { ok: false, error: "tool required (Composio tool slug)" };

  let input = args.arguments || args.args || args.input || args.params || {};
  if (typeof input === "string") {
    try {
      input = JSON.parse(input);
    } catch {
      return { ok: false, error: "arguments must be an object or JSON string" };
    }
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) input = {};

  const sessionRes = await getSession();
  if (sessionRes.ok && typeof sessionRes.session?.execute === "function") {
    try {
      const result = await sessionRes.session.execute(tool, input);
      return { ok: true, tool, result, source: "session" };
    } catch (err) {
      if (/api key|unauthorized|401/i.test(String(err?.message || ""))) {
        return { ok: false, error: err.message || String(err), tool };
      }
    }
  }

  try {
    const gate = requireKey();
    if (!gate.ok) return gate;
    const composio = await getSdkClient(gate.apiKey);
    if (composio.tools?.execute) {
      const result = await composio.tools.execute(tool, {
        userId: store.getUserId(),
        arguments: input,
        version: args.version || "latest",
      });
      return { ok: true, tool, result, source: "sdk-direct" };
    }
  } catch (err) {
    /* REST */
    if (/api key|unauthorized|401/i.test(String(err?.message || ""))) {
      return { ok: false, error: err.message || String(err), tool };
    }
  }

  const res = await rest(`/tools/execute/${encodeURIComponent(tool)}`, {
    method: "POST",
    body: {
      user_id: store.getUserId(),
      arguments: input,
      version: args.version || "latest",
    },
  });
  if (!res.ok) return { ...res, tool };
  return { ok: true, tool, result: res.data, source: "rest" };
}

async function status() {
  const settings = store.getSettings();
  const hasKey = Boolean(store.getApiKey());
  let connections = [];
  let connectionError = null;
  if (hasKey) {
    const conn = await listConnections();
    if (conn.ok) connections = conn.connections || [];
    else connectionError = conn.error;
  }
  return {
    ok: true,
    enabled: settings.enabled !== false,
    hasKey,
    keyPreview: hasKey ? store.maskKey(store.getApiKey()) : "",
    userId: settings.userId,
    sessionId: settings.sessionId || null,
    allowlist: settings.allowlist || [],
    connections,
    connectionError,
    updatedAt: settings.updatedAt,
  };
}

module.exports = {
  rest,
  getSession,
  invalidateSession,
  listToolkits,
  listTools,
  listConnections,
  connectToolkit,
  executeTool,
  status,
  requireKey,
  isActiveAccount,
};