const crypto = require("crypto");
const { shell } = require("electron");
const { providerConfig } = require("../mail-config");
const { createOAuthLoopback } = require("../oauth-loopback");

const PROVIDER_ID = "gmail";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API_BASE = "https://gmail.googleapis.com/gmail/v1";
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
].join(" ");

function pkcePair() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

function authHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  };
}

async function exchangeCode({ code, redirectUri, verifier }) {
  const cfg = providerConfig(PROVIDER_ID);
  if (!cfg.clientId || !cfg.clientSecret) {
    return { ok: false, error: "Gmail OAuth not configured: add config/mail-oauth.json" };
  }

  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data.error_description || data.error || `Token exchange failed (${res.status})` };
  }

  return {
    ok: true,
    tokens: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || null,
      expiresAt: data.expires_in ? Date.now() + Number(data.expires_in) * 1000 : null,
      scope: data.scope || SCOPES,
      tokenType: data.token_type || "Bearer",
    },
  };
}

async function refreshAccessToken(refreshToken) {
  const cfg = providerConfig(PROVIDER_ID);
  if (!cfg.clientId || !cfg.clientSecret) {
    return { ok: false, error: "Gmail OAuth not configured" };
  }
  if (!refreshToken) return { ok: false, error: "Missing refresh token: reconnect Gmail" };

  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const revoked = data.error === "invalid_grant";
    return {
      ok: false,
      revoked,
      error: data.error_description || data.error || `Refresh failed (${res.status})`,
    };
  }

  return {
    ok: true,
    tokens: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: data.expires_in ? Date.now() + Number(data.expires_in) * 1000 : null,
      scope: data.scope || SCOPES,
      tokenType: data.token_type || "Bearer",
    },
  };
}

async function gmailFetch(accessToken, path, query = {}) {
  const url = new URL(`${API_BASE}${path}`);
  for (const [k, v] of Object.entries(query)) {
    if (v == null || v === "") continue;
    if (Array.isArray(v)) {
      for (const item of v) {
        if (item != null && item !== "") url.searchParams.append(k, String(item));
      }
    } else {
      url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url, { headers: authHeaders(accessToken) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data.error?.message || data.error || `Gmail API ${res.status}`;
    return { ok: false, status: res.status, error: err, revoked: res.status === 401 };
  }
  return { ok: true, data };
}

async function getProfile(accessToken) {
  const res = await gmailFetch(accessToken, "/users/me/profile");
  if (!res.ok) return res;
  return {
    ok: true,
    email: res.data.emailAddress,
    historyId: String(res.data.historyId || ""),
    messagesTotal: res.data.messagesTotal,
    threadsTotal: res.data.threadsTotal,
  };
}

function headerValue(headers, name) {
  const hit = (headers || []).find((h) => String(h.name || "").toLowerCase() === name.toLowerCase());
  return hit?.value || "";
}

const SYSTEM_LABEL_NAMES = {
  INBOX: "Inbox",
  STARRED: "Starred",
  SENT: "Sent",
  DRAFT: "Drafts",
  SPAM: "Spam",
  TRASH: "Trash",
  IMPORTANT: "Important",
  UNREAD: "Unread",
  CATEGORY_PERSONAL: "Personal",
  CATEGORY_SOCIAL: "Social",
  CATEGORY_PROMOTIONS: "Promotions",
  CATEGORY_UPDATES: "Updates",
  CATEGORY_FORUMS: "Forums",
};

const LABEL_ORDER = [
  "INBOX",
  "STARRED",
  "IMPORTANT",
  "SENT",
  "DRAFT",
  "CATEGORY_PERSONAL",
  "CATEGORY_SOCIAL",
  "CATEGORY_PROMOTIONS",
  "CATEGORY_UPDATES",
  "CATEGORY_FORUMS",
  "SPAM",
  "TRASH",
];

function labelDisplayName(label) {
  if (SYSTEM_LABEL_NAMES[label.id]) return SYSTEM_LABEL_NAMES[label.id];
  return label.name || label.id;
}

function normalizeLabel(raw) {
  const label = {
    id: String(raw.id || ""),
    name: String(raw.name || raw.id || ""),
    type: String(raw.type || "user"),
    messagesTotal: Number(raw.messagesTotal) || 0,
    messagesUnread: Number(raw.messagesUnread) || 0,
  };
  return { ...label, displayName: labelDisplayName(label) };
}

function sortLabels(labels) {
  const rank = new Map(LABEL_ORDER.map((id, i) => [id, i]));
  return [...labels].sort((a, b) => {
    const ra = rank.has(a.id) ? rank.get(a.id) : 1000;
    const rb = rank.has(b.id) ? rank.get(b.id) : 1000;
    if (ra !== rb) return ra - rb;
    return String(a.displayName).localeCompare(String(b.displayName));
  });
}

function extractBodies(payload) {
  let bodyText = "";
  let bodyHtml = "";
  const walk = (part) => {
    if (!part) return;
    if (part.mimeType === "text/plain" && part.body?.data) {
      bodyText += Buffer.from(part.body.data, "base64url").toString("utf8");
    } else if (part.mimeType === "text/html" && part.body?.data) {
      bodyHtml += Buffer.from(part.body.data, "base64url").toString("utf8");
    }
    (part.parts || []).forEach(walk);
  };
  walk(payload);
  return { bodyText: bodyText.trim(), bodyHtml: bodyHtml.trim() };
}

function sanitizeHtml(html) {
  return String(html || "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

function normalizeMessageSummary(msg) {
  const headers = msg.payload?.headers || msg.headers || [];
  const subject = headerValue(headers, "Subject") || "(No subject)";
  const from =
    headerValue(headers, "From") ||
    headerValue(headers, "Reply-To") ||
    headerValue(headers, "Sender") ||
    "";
  const dateHeader = headerValue(headers, "Date");
  const internalDate = Number(msg.internalDate) || 0;
  const date = dateHeader || (internalDate ? new Date(internalDate).toISOString() : null);
  const snippet = String(msg.snippet || "").slice(0, 400);
  return {
    id: String(msg.id),
    threadId: msg.threadId ? String(msg.threadId) : null,
    subject,
    from,
    date,
    internalDate,
    snippet,
    labelIds: msg.labelIds || [],
    unread: (msg.labelIds || []).includes("UNREAD"),
  };
}

const META_FIELDS = null; 
async function gmailBatchGet(accessToken, ids, { format = "metadata", fields = null } = {}) {
  if (!ids.length) return { ok: true, messages: [] };

  const boundary = `myspace_batch_${Date.now().toString(36)}`;
  const chunks = [];
  for (let i = 0; i < ids.length; i++) {
    const qs = new URLSearchParams({ format });
    if (fields) qs.set("fields", fields);
    chunks.push(
      `--${boundary}\r\n` +
        "Content-Type: application/http\r\n" +
        `Content-ID: <item${i}>\r\n\r\n` +
        `GET /gmail/v1/users/me/messages/${ids[i]}?${qs.toString()} HTTP/1.1\r\n\r\n`
    );
  }
  const body = `${chunks.join("")}--${boundary}--\r\n`;

  try {
    const res = await fetch("https://www.googleapis.com/batch/gmail/v1", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/mixed; boundary=${boundary}`,
      },
      body,
    });
    const text = await res.text();
    if (!res.ok) {
      return gmailParallelGet(accessToken, ids, { format, fields });
    }
    const messages = parseGmailBatchPayload(text);
    if (messages.length) return { ok: true, messages };
    return gmailParallelGet(accessToken, ids, { format, fields });
  } catch {
    return gmailParallelGet(accessToken, ids, { format, fields });
  }
}

function parseGmailBatchPayload(text) {
  const messages = [];
  const parts = String(text || "").split(/\r?\n--/);
  for (const part of parts) {
    const jsonStart = part.indexOf("{");
    const jsonEnd = part.lastIndexOf("}");
    if (jsonStart < 0 || jsonEnd <= jsonStart) continue;
    try {
      const data = JSON.parse(part.slice(jsonStart, jsonEnd + 1));
      if (data?.id && !data.error) messages.push(normalizeMessageSummary(data));
    } catch {
      /* skip */
    }
  }
  return messages;
}

async function gmailParallelGet(accessToken, ids, { format = "metadata", fields = null } = {}) {
  const messages = [];
  const batchSize = 8;
  const query = { format };
  if (fields) query.fields = fields;
  for (let i = 0; i < ids.length; i += batchSize) {
    const chunk = ids.slice(i, i + batchSize);
    const results = await Promise.all(
      chunk.map((id) => gmailFetch(accessToken, `/users/me/messages/${id}`, query))
    );
    for (const res of results) {
      if (res.ok) messages.push(normalizeMessageSummary(res.data));
    }
  }
  return { ok: true, messages };
}

async function fetchMessageMetadataBatch(accessToken, ids) {
  const res = await gmailBatchGet(accessToken, ids, {
    format: "metadata",
    fields: null,
  });
  return res.messages || [];
}

async function listMessageIds(
  accessToken,
  { maxResults = 25, labelIds = ["INBOX"], q = "", pageToken = "" } = {}
) {
  const query = { maxResults: Math.min(Math.max(1, maxResults), 50) };
  if (Array.isArray(labelIds) && labelIds.length) {
    query.labelIds = labelIds;
  }
  if (q) query.q = q;
  if (pageToken) query.pageToken = pageToken;

  const listed = await gmailFetch(accessToken, "/users/me/messages", query);
  if (!listed.ok) return listed;
  return {
    ok: true,
    ids: (listed.data.messages || []).map((m) => m.id).filter(Boolean),
    nextPageToken: listed.data.nextPageToken || null,
    resultSizeEstimate: listed.data.resultSizeEstimate || 0,
  };
}

async function listMessages(
  accessToken,
  { maxResults = 25, labelIds = ["INBOX"], q = "", pageToken = "", onlyIds } = {}
) {
  if (onlyIds?.length) {
    const messages = await fetchMessageMetadataBatch(accessToken, onlyIds);
    return { ok: true, messages };
  }

  const listed = await listMessageIds(accessToken, { maxResults, labelIds, q, pageToken });
  if (!listed.ok) return listed;

  const messages = await fetchMessageMetadataBatch(accessToken, listed.ids);
  return {
    ok: true,
    messages,
    ids: listed.ids,
    nextPageToken: listed.nextPageToken,
    resultSizeEstimate: listed.resultSizeEstimate ?? messages.length,
  };
}

async function listLabels(accessToken) {
  const res = await gmailFetch(accessToken, "/users/me/labels");
  if (!res.ok) return res;
  const labels = sortLabels(
    (res.data.labels || [])
      .map(normalizeLabel)
      .filter((l) => l.id && l.id !== "UNREAD" && l.id !== "CHAT")
  );
  return { ok: true, labels };
}

async function getMessage(accessToken, messageId) {
  const res = await gmailFetch(accessToken, `/users/me/messages/${messageId}`, {
    format: "full",
  });
  if (!res.ok) return res;
  const summary = normalizeMessageSummary(res.data);
  const headers = res.data.payload?.headers || [];
  const to = headerValue(headers, "To");
  const cc = headerValue(headers, "Cc");
  const { bodyText, bodyHtml } = extractBodies(res.data.payload);
  return {
    ok: true,
    message: {
      ...summary,
      to,
      cc,
      bodyText: bodyText.slice(0, 20000),
      bodyHtml: sanitizeHtml(bodyHtml).slice(0, 80000),
    },
  };
}

async function listHistory(accessToken, startHistoryId) {
  const res = await gmailFetch(accessToken, "/users/me/history", {
    startHistoryId,
    historyTypes: "messageAdded",
    maxResults: 100,
  });
  if (!res.ok) {
    if (res.status === 404) return { ok: true, history: [], historyId: startHistoryId, reset: true };
    return res;
  }
  return {
    ok: true,
    history: res.data.history || [],
    historyId: String(res.data.historyId || startHistoryId),
    reset: false,
  };
}

async function startOAuth() {
  const cfg = providerConfig(PROVIDER_ID);
  if (!cfg.clientId || !cfg.clientSecret) {
    return {
      ok: false,
      error:
        "Gmail OAuth not configured. Copy config/mail-oauth.example.json → config/mail-oauth.json and add your Google client credentials.",
    };
  }

  const { verifier, challenge } = pkcePair();
  const state = crypto.randomBytes(16).toString("hex");
  const loopback = await createOAuthLoopback();
  const authParams = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: loopback.redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  const authUrl = `${AUTH_URL}?${authParams.toString()}`;

  try {
    await shell.openExternal(authUrl);
    const result = await loopback.waitForResult();
    if (result.state !== state) {
      return { ok: false, error: "OAuth state mismatch: try again" };
    }
    const exchanged = await exchangeCode({
      code: result.code,
      redirectUri: loopback.redirectUri,
      verifier,
    });
    if (!exchanged.ok) return exchanged;

    const profile = await getProfile(exchanged.tokens.accessToken);
    if (!profile.ok) return profile;

    return {
      ok: true,
      profile: {
        email: profile.email,
        historyId: profile.historyId,
        displayName: profile.email,
      },
      tokens: exchanged.tokens,
    };
  } catch (err) {
    loopback.cancel?.();
    return { ok: false, error: err?.message || String(err) };
  }
}

module.exports = {
  id: PROVIDER_ID,
  label: "Gmail",
  startOAuth,
  refreshAccessToken,
  getProfile,
  listMessages,
  listMessageIds,
  getMessage,
  listHistory,
  listLabels,
  fetchMessageMetadataBatch,
};
