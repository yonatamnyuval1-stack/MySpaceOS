const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const { saveJsonFile, loadJsonFile } = require("../apps/safe-json-store");
const { encryptTokens, decryptTokens } = require("./mail-crypto");
const profile = require("../myspace-profile");

function accountsPath() {
  return profile.profileScopedPath("mail-accounts.json");
}

function tokensPath() {
  return profile.profileScopedPath("mail-tokens.enc");
}

function uid() {
  return `mail_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function defaultAccountsState() {
  return { accounts: [], updatedAt: null };
}

function loadAccounts() {
  const loaded = loadJsonFile(accountsPath(), { fallback: defaultAccountsState() });
  const data = loaded.ok ? loaded.data : defaultAccountsState();
  const accounts = Array.isArray(data?.accounts) ? data.accounts : [];
  return {
    accounts: accounts.map(normalizeAccount).filter(Boolean),
    updatedAt: data?.updatedAt || null,
  };
}

function normalizeAccount(raw) {
  if (!raw?.id || !raw?.provider || !raw?.email) return null;
  return {
    id: String(raw.id),
    provider: String(raw.provider),
    email: String(raw.email),
    displayName: String(raw.displayName || raw.email),
    connectedAt: raw.connectedAt || new Date().toISOString(),
    lastSyncAt: raw.lastSyncAt || null,
    lastHistoryId: raw.lastHistoryId ? String(raw.lastHistoryId) : null,
    syncEnabled: raw.syncEnabled !== false,
    status: raw.status === "error" ? "error" : raw.status === "revoked" ? "revoked" : "active",
    lastError: raw.lastError ? String(raw.lastError).slice(0, 200) : null,
  };
}

function saveAccounts(state) {
  const next = {
    accounts: (state.accounts || []).map(normalizeAccount).filter(Boolean),
    updatedAt: new Date().toISOString(),
  };
  saveJsonFile(accountsPath(), next, { listKey: "accounts", allowEmpty: true });
  return next;
}

function loadTokenMap() {
  try {
    if (!fs.existsSync(tokensPath())) return {};
    const blob = fs.readFileSync(tokensPath(), "utf8");
    const parsed = decryptTokens(blob);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function saveTokenMap(map) {
  fs.mkdirSync(path.dirname(tokensPath()), { recursive: true });
  fs.writeFileSync(tokensPath(), encryptTokens(map || {}), "utf8");
}

function getTokens(accountId) {
  const map = loadTokenMap();
  return map[String(accountId)] || null;
}

function setTokens(accountId, tokens) {
  const map = loadTokenMap();
  map[String(accountId)] = {
    accessToken: tokens.accessToken || null,
    refreshToken: tokens.refreshToken || null,
    expiresAt: tokens.expiresAt || null,
    scope: tokens.scope || null,
    tokenType: tokens.tokenType || "Bearer",
    updatedAt: new Date().toISOString(),
  };
  saveTokenMap(map);
  return map[String(accountId)];
}

function deleteTokens(accountId) {
  const map = loadTokenMap();
  delete map[String(accountId)];
  saveTokenMap(map);
}

function upsertAccount(patch) {
  const state = loadAccounts();
  const id = patch.id || uid();
  const idx = state.accounts.findIndex((a) => a.id === id);
  const prev = idx >= 0 ? state.accounts[idx] : {};
  const next = normalizeAccount({ ...prev, ...patch, id });
  if (!next) return { ok: false, error: "Invalid account" };
  if (idx >= 0) state.accounts[idx] = next;
  else state.accounts.push(next);
  saveAccounts(state);
  return { ok: true, account: next };
}

function removeAccount(accountId) {
  const state = loadAccounts();
  state.accounts = state.accounts.filter((a) => a.id !== accountId);
  saveAccounts(state);
  deleteTokens(accountId);
  return { ok: true };
}

function listAccountsPublic() {
  return loadAccounts().accounts.map((a) => ({
    id: a.id,
    provider: a.provider,
    email: a.email,
    displayName: a.displayName,
    connectedAt: a.connectedAt,
    lastSyncAt: a.lastSyncAt,
    syncEnabled: a.syncEnabled,
    status: a.status,
    lastError: a.lastError,
    hasTokens: Boolean(getTokens(a.id)?.refreshToken || getTokens(a.id)?.accessToken),
  }));
}

module.exports = {
  uid,
  loadAccounts,
  saveAccounts,
  upsertAccount,
  removeAccount,
  getTokens,
  setTokens,
  deleteTokens,
  listAccountsPublic,
};