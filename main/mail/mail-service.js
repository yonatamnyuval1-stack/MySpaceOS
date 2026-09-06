const {
  uid,
  upsertAccount,
  removeAccount,
  listAccountsPublic,
  getTokens,
  setTokens,
  loadAccounts,
  saveAccounts,
} = require("./mail-store");
const { getProvider, listProviders } = require("./providers");

const TOKEN_SKEW_MS = 60 * 1000;

async function ensureAccessToken(account) {
  const provider = getProvider(account.provider);
  if (!provider) return { ok: false, error: "Unknown mail provider" };

  let tokens = getTokens(account.id);
  if (!tokens) return { ok: false, error: "Account not connected", revoked: true };

  const stillValid =
    tokens.accessToken && tokens.expiresAt && Date.now() + TOKEN_SKEW_MS < Number(tokens.expiresAt);
  if (stillValid) {
    return { ok: true, accessToken: tokens.accessToken, tokens };
  }

  const refreshed = await provider.refreshAccessToken(tokens.refreshToken);
  if (!refreshed.ok) {
    if (refreshed.revoked) {
      upsertAccount({ id: account.id, status: "revoked", lastError: refreshed.error });
    }
    return refreshed;
  }

  tokens = setTokens(account.id, refreshed.tokens);
  upsertAccount({ id: account.id, status: "active", lastError: null });
  return { ok: true, accessToken: tokens.accessToken, tokens };
}

function findAccount(accountId) {
  const state = loadAccounts();
  return state.accounts.find((a) => a.id === accountId) || null;
}

async function connectProvider(providerId) {
  const provider = getProvider(providerId);
  if (!provider) return { ok: false, error: "Unknown provider" };
  if (providerId !== "gmail") {
    return provider.startOAuth();
  }

  const oauth = await provider.startOAuth();
  if (!oauth.ok) return oauth;

  const existing = loadAccounts().accounts.find(
    (a) => a.provider === providerId && a.email.toLowerCase() === oauth.profile.email.toLowerCase()
  );
  const accountId = existing?.id || uid();

  upsertAccount({
    id: accountId,
    provider: providerId,
    email: oauth.profile.email,
    displayName: oauth.profile.displayName || oauth.profile.email,
    lastHistoryId: oauth.profile.historyId || null,
    status: "active",
    lastError: null,
    syncEnabled: true,
    connectedAt: existing?.connectedAt || new Date().toISOString(),
  });
  setTokens(accountId, oauth.tokens);

  return {
    ok: true,
    account: listAccountsPublic().find((a) => a.id === accountId),
    reused: Boolean(existing),
  };
}

async function disconnectAccount(accountId) {
  const account = findAccount(accountId);
  if (!account) return { ok: false, error: "Account not found" };
  removeAccount(accountId);
  return { ok: true, disconnected: accountId };
}

async function accountStatus() {
  return { ok: true, accounts: listAccountsPublic(), providers: listProviders() };
}

async function listMessages(accountId, opts = {}) {
  const account = findAccount(accountId);
  if (!account) return { ok: false, error: "Account not found" };
  const provider = getProvider(account.provider);
  const auth = await ensureAccessToken(account);
  if (!auth.ok) return auth;

  const cache = require("./mail-cache");
  const key = cache.folderKey({
    labelIds: opts.labelIds,
    q: opts.q,
    pageToken: opts.pageToken,
  });

  if (opts.cacheOnly) {
    const cached = cache.getList(accountId, key);
    if (cached?.messages?.length) {
      return { ok: true, ...cached, fromCache: true };
    }
    return { ok: true, messages: [], fromCache: true, empty: true };
  }

  if (provider.id !== "gmail") {
    return provider.listMessages(auth.accessToken, opts);
  }

  const listed = await provider.listMessageIds(auth.accessToken, {
    maxResults: opts.maxResults || 25,
    labelIds: opts.labelIds,
    q: opts.q,
    pageToken: opts.pageToken,
  });
  if (!listed.ok) return listed;

  const { messages: cachedMsgs, missing } = cache.hydrateIds(accountId, listed.ids);
  let fresh = [];
  if (missing.length) {
    const fetched = await provider.listMessages(auth.accessToken, { onlyIds: missing });
    if (!fetched.ok) return fetched;
    fresh = fetched.messages || [];
    cache.putSummaries(accountId, fresh);
  }

  const byId = new Map([...cachedMsgs, ...fresh].map((m) => [m.id, m]));
  const messages = listed.ids.map((id) => byId.get(id)).filter(Boolean);
  const payload = {
    messages,
    nextPageToken: listed.nextPageToken || null,
    resultSizeEstimate: listed.resultSizeEstimate || messages.length,
  };
  cache.putList(accountId, key, payload);
  return { ok: true, ...payload, fromCache: missing.length === 0, fetched: missing.length };
}

async function getMessage(accountId, messageId) {
  const account = findAccount(accountId);
  if (!account) return { ok: false, error: "Account not found" };
  const provider = getProvider(account.provider);
  const cache = require("./mail-cache");
  const cached = cache.getBody(accountId, messageId);
  if (cached && (cached.bodyHtml || cached.bodyText)) {
    return { ok: true, message: cached, fromCache: true };
  }

  const auth = await ensureAccessToken(account);
  if (!auth.ok) return auth;
  const res = await provider.getMessage(auth.accessToken, messageId);
  if (res.ok && res.message) cache.putBodies(accountId, res.message);
  return res;
}

async function listLabels(accountId, opts = {}) {
  const account = findAccount(accountId);
  if (!account) return { ok: false, error: "Account not found" };
  const provider = getProvider(account.provider);
  if (!provider.listLabels) return { ok: false, error: "Labels not supported for this provider" };

  const cache = require("./mail-cache");
  const cached = cache.getLabels(accountId);
  if (opts.cacheOnly && cached?.length) {
    return { ok: true, labels: cached, fromCache: true };
  }

  const auth = await ensureAccessToken(account);
  if (!auth.ok) {
    if (cached?.length) return { ok: true, labels: cached, fromCache: true };
    return auth;
  }
  const res = await provider.listLabels(auth.accessToken);
  if (res.ok) cache.putLabels(accountId, res.labels);
  else if (cached?.length) return { ok: true, labels: cached, fromCache: true };
  return res;
}

async function syncAccount(accountId, { notify = false } = {}) {
  const account = findAccount(accountId);
  if (!account || !account.syncEnabled) return { ok: false, error: "Account not found or sync disabled" };
  if (account.provider !== "gmail") return { ok: false, error: "Sync not implemented for this provider yet" };

  const provider = getProvider(account.provider);
  const auth = await ensureAccessToken(account);
  if (!auth.ok) return auth;

  const profile = await provider.getProfile(auth.accessToken);
  if (!profile.ok) {
    upsertAccount({ id: account.id, status: "error", lastError: profile.error });
    return profile;
  }

  let newMessages = [];
  const prevHistoryId = account.lastHistoryId;

  if (!prevHistoryId) {
    upsertAccount({
      id: account.id,
      lastHistoryId: profile.historyId,
      lastSyncAt: new Date().toISOString(),
      status: "active",
      lastError: null,
    });
    return { ok: true, accountId, initialized: true, newCount: 0 };
  }

  const hist = await provider.listHistory(auth.accessToken, prevHistoryId);
  if (!hist.ok) {
    upsertAccount({ id: account.id, status: "error", lastError: hist.error });
    return hist;
  }

  const messageIds = new Set();
  for (const block of hist.history || []) {
    for (const added of block.messagesAdded || []) {
      const id = added.message?.id;
      if (id) messageIds.add(id);
    }
  }

  for (const id of messageIds) {
    const msg = await provider.getMessage(auth.accessToken, id);
    if (msg.ok) newMessages.push(msg.message);
  }

  upsertAccount({
    id: account.id,
    lastHistoryId: hist.historyId || profile.historyId,
    lastSyncAt: new Date().toISOString(),
    status: "active",
    lastError: null,
  });

  if (notify && newMessages.length) {
    try {
      const { pushNewMailNotifications } = require("./mail-notify");
      pushNewMailNotifications(account, newMessages);
    } catch {
    }
  }

  return { ok: true, accountId, newCount: newMessages.length, messages: newMessages };
}

async function syncAll({ notify = true } = {}) {
  const accounts = loadAccounts().accounts.filter((a) => a.syncEnabled && a.status !== "revoked");
  const results = [];
  for (const account of accounts) {
    try {
      results.push(await syncAccount(account.id, { notify }));
    } catch (err) {
      results.push({ ok: false, accountId: account.id, error: err?.message || String(err) });
    }
  }
  return { ok: true, results };
}

module.exports = {
  connectProvider,
  disconnectAccount,
  accountStatus,
  listMessages,
  getMessage,
  listLabels,
  syncAccount,
  syncAll,
  ensureAccessToken,
  findAccount,
};
