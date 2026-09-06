const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const { encryptTokens, decryptTokens } = require("./mail-crypto");
const { getService } = require("./hub-catalog");
const profile = require("../myspace-profile");

function accountsPath() {
  return profile.profileScopedPath("hub-connections.json");
}

function secretsPath() {
  return profile.profileScopedPath("hub-secrets.enc");
}

function uid() {
  return `hub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function loadAccounts() {
  try {
    const raw = JSON.parse(fs.readFileSync(accountsPath(), "utf8"));
    const list = Array.isArray(raw?.accounts) ? raw.accounts : [];
    return { accounts: list.filter((a) => a && a.id && a.serviceId) };
  } catch {
    return { accounts: [] };
  }
}

function saveAccounts(state) {
  fs.mkdirSync(path.dirname(accountsPath()), { recursive: true });
  fs.writeFileSync(accountsPath(), JSON.stringify({ accounts: state.accounts || [] }, null, 2), "utf8");
}

function loadSecrets() {
  try {
    const blob = fs.readFileSync(secretsPath(), "utf8");
    const data = decryptTokens(blob);
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function saveSecrets(map) {
  fs.mkdirSync(path.dirname(secretsPath()), { recursive: true });
  fs.writeFileSync(secretsPath(), encryptTokens(map || {}), "utf8");
}

function publicAccount(a, hasSecrets) {
  return {
    id: a.id,
    serviceId: a.serviceId,
    displayName: a.displayName,
    status: a.status || "active",
    lastError: a.lastError || null,
    connectedAt: a.connectedAt,
    meta: a.meta && typeof a.meta === "object" ? a.meta : {},
    hasSecrets: Boolean(hasSecrets),
  };
}

function listPublic() {
  const secrets = loadSecrets();
  return loadAccounts().accounts.map((a) => publicAccount(a, Boolean(secrets[a.id])));
}

function upsertAccount(partial) {
  const state = loadAccounts();
  const existing = state.accounts.find((a) => a.id === partial.id);
  const next = {
    ...(existing || {}),
    ...partial,
    id: partial.id || existing?.id || uid(),
    serviceId: String(partial.serviceId || existing?.serviceId || ""),
    displayName: String(partial.displayName || existing?.displayName || ""),
    status: partial.status || existing?.status || "active",
    connectedAt: existing?.connectedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (existing) {
    Object.assign(existing, next);
  } else {
    state.accounts.push(next);
  }
  saveAccounts(state);
  return next;
}

function removeAccount(id) {
  const state = loadAccounts();
  state.accounts = state.accounts.filter((a) => a.id !== id);
  saveAccounts(state);
  const secrets = loadSecrets();
  delete secrets[id];
  saveSecrets(secrets);
}

function setSecrets(id, payload) {
  const secrets = loadSecrets();
  secrets[id] = payload || {};
  saveSecrets(secrets);
}

function findByService(serviceId) {
  return loadAccounts().accounts.filter((a) => a.serviceId === serviceId);
}

function splitFields(service, fields) {
  const spec = service.fields || [];
  const publicMeta = {};
  const secrets = {};
  for (const f of spec) {
    const val = String(fields?.[f.key] ?? "").trim();
    if (f.secret) secrets[f.key] = val;
    else publicMeta[f.key] = val;
  }
  return { publicMeta, secrets };
}

function displayFrom(service, fields) {
  return (
    fields.email ||
    fields.phone ||
    fields.username ||
    fields.handle ||
    fields.pageId ||
    service.name
  );
}

module.exports = {
  uid,
  loadAccounts,
  listPublic,
  upsertAccount,
  removeAccount,
  setSecrets,
  findByService,
  splitFields,
  displayFrom,
  getService,
};
