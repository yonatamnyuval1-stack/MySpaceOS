const path = require("path");
const fs = require("fs");
const { app, shell, clipboard } = require("electron");
const {
  deriveKey,
  encryptJson,
  decryptJson,
  verifyPassword,
  createAuthRecord,
} = require("./vault-crypto");
const profile = require("../myspace-profile");
const identity = require("../myspace-identity");

function dataPath() {
  return profile.profileScopedPath("profiles.json");
}

function vaultPath() {
  return profile.profileScopedPath("vault.json");
}

function userConfigPath() {
  return path.join(__dirname, "..", "..", "config", "user-config.json");
}

const DEFAULT_CATEGORIES = [
  { id: "general", name: "General", icon: "📁", color: "#8b9dc3" },
  { id: "accounts", name: "Accounts", icon: "🔐", color: "#ffb74d" },
  { id: "projects", name: "Projects", icon: "🚀", color: "#6ec6ff" },
  { id: "people", name: "People", icon: "👤", color: "#f48fb1" },
  { id: "tools", name: "Tools & apps", icon: "🛠", color: "#80cbc4" },
  { id: "websites", name: "Websites", icon: "🌐", color: "#b388ff" },
  { id: "finance", name: "Finance", icon: "💰", color: "#aed581" },
];

let vaultSession = null;

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function readConfigVaultPassword() {
  try {
    const cfg = JSON.parse(fs.readFileSync(userConfigPath(), "utf8"));
    return cfg?.vault?.masterPassword || null;
  } catch {
    return null;
  }
}

async function loadVaultFile() {
  try {
    const raw = await fs.promises.readFile(vaultPath(), "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
}

async function saveVaultFile(data) {
  await fs.promises.mkdir(path.dirname(vaultPath()), { recursive: true });
  await fs.promises.writeFile(vaultPath(), JSON.stringify(data, null, 2), "utf8");
}

async function ensureVaultInitialized() {
  let file = await loadVaultFile();
  if (file?.auth?.salt && file?.auth?.hash) return file;

  // Per My Space account: do not seed vault from install-wide config password.
  // Each signed-in OS user creates their own master password on first unlock.
  if (identity.getCurrentUser()?.id) return file;

  const configPw = readConfigVaultPassword();
  if (!configPw) return file;

  const auth = createAuthRecord(configPw);
  const key = deriveKey(configPw, Buffer.from(auth.salt, "base64"));
  file = { auth, cipher: encryptJson(key, []) };
  await saveVaultFile(file);
  return file;
}

function normalizeVaultEntry(raw) {
  if (!raw || !String(raw.name || "").trim()) return null;
  return {
    id: String(raw.id || uid("vault")),
    name: String(raw.name).trim(),
    username: String(raw.username || "").trim(),
    password: String(raw.password || ""),
    url: String(raw.url || "").trim(),
    notes: String(raw.notes || "").trim(),
    icon: String(raw.icon || "🔑").trim() || "🔑",
    category: String(raw.category || "general").trim(),
    tags: Array.isArray(raw.tags) ? raw.tags.map((t) => String(t).trim()).filter(Boolean) : [],
    favorite: Boolean(raw.favorite),
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

function requireVaultSession() {
  if (!vaultSession?.key) throw new Error("Vault is locked");
  return vaultSession;
}

async function vaultStatus() {
  await ensureVaultInitialized();
  const file = await loadVaultFile();
  return {
    ok: true,
    initialized: Boolean(file?.auth?.salt),
    unlocked: Boolean(vaultSession?.key),
    entryCount: vaultSession?.entries?.length ?? null,
  };
}

async function vaultUnlock(args) {
  await ensureVaultInitialized();
  let file = (await loadVaultFile()) || {};
  const password = String(args?.password || "");
  if (!password) return { ok: false, error: "Password required" };

  if (!file?.auth?.salt) {
    file.auth = createAuthRecord(password);
    file.cipher = encryptJson(deriveKey(password, Buffer.from(file.auth.salt, "base64")), []);
    await saveVaultFile(file);
  }

  const ok = verifyPassword(password, file.auth.salt, file.auth.hash);
  if (!ok) return { ok: false, error: "Wrong password" };

  const key = deriveKey(password, Buffer.from(file.auth.salt, "base64"));
  let entries = [];
  if (file.cipher) {
    try {
      entries = decryptJson(key, file.cipher);
    } catch {
      return { ok: false, error: "Vault data corrupted" };
    }
  }

  vaultSession = { key, entries: entries.map(normalizeVaultEntry).filter(Boolean), unlockedAt: Date.now() };
  return { ok: true, entries: sortVaultEntries(vaultSession.entries).map(publicVaultEntry) };
}

function publicVaultEntry(e) {
  return { ...e, password: e.password ? "••••••••" : "" };
}

function sortVaultEntries(list) {
  return [...(list || [])].sort((a, b) =>
    String(a?.name || "").localeCompare(String(b?.name || ""), undefined, {
      sensitivity: "base",
      numeric: true,
    })
  );
}

async function vaultLock() {
  vaultSession = null;
  return { ok: true };
}

function lockVaultForProfileSwitch() {
  vaultSession = null;
  return { ok: true };
}

async function persistVaultEntries() {
  const session = requireVaultSession();
  const file = await loadVaultFile();
  file.cipher = encryptJson(session.key, session.entries);
  await saveVaultFile(file);
}

async function vaultList() {
  const session = requireVaultSession();
  return { ok: true, entries: sortVaultEntries(session.entries).map(publicVaultEntry) };
}

async function vaultGet(args) {
  const session = requireVaultSession();
  const entry = session.entries.find((e) => e.id === args?.id);
  if (!entry) return { ok: false, error: "Not found" };
  return { ok: true, entry };
}

async function vaultSave(args) {
  const session = requireVaultSession();
  const entry = normalizeVaultEntry(args?.entry || args);
  if (!entry) return { ok: false, error: "Invalid entry" };

  const idx = session.entries.findIndex((e) => e.id === entry.id);
  if (idx >= 0) {
    entry.createdAt = session.entries[idx].createdAt;
    session.entries[idx] = entry;
  } else {
    session.entries.unshift(entry);
  }
  entry.updatedAt = new Date().toISOString();
  await persistVaultEntries();
  return { ok: true, entry: publicVaultEntry(entry) };
}

async function vaultDelete(args) {
  const session = requireVaultSession();
  session.entries = session.entries.filter((e) => e.id !== args?.id);
  await persistVaultEntries();
  return { ok: true };
}

async function vaultCopyPassword(args) {
  const session = requireVaultSession();
  const entry = session.entries.find((e) => e.id === args?.id);
  if (!entry?.password) return { ok: false, error: "No password" };
  clipboard.writeText(entry.password);
  return { ok: true };
}

function normalizeLink(raw) {
  if (!raw) return null;
  const url = String(raw.url || "").trim();
  const label = String(raw.label || "Link").trim() || "Link";
  if (!url) return null;
  return { id: String(raw.id || uid("lnk")), label, url };
}

function normalizeField(raw) {
  if (!raw) return null;
  const key = String(raw.key || "").trim();
  if (!key) return null;
  return { id: String(raw.id || uid("fld")), key, value: String(raw.value ?? "") };
}

function normalizeProfile(raw) {
  if (!raw || !String(raw.name || "").trim()) return null;
  return {
    id: String(raw.id || uid("prof")),
    name: String(raw.name).trim(),
    categoryId: String(raw.categoryId || "general"),
    icon: String(raw.icon || "◆").trim() || "◆",
    color: String(raw.color || "").trim(),
    description: String(raw.description || "").trim(),
    localPath: String(raw.localPath || "").trim(),
    relatedProfileIds: Array.isArray(raw.relatedProfileIds)
      ? raw.relatedProfileIds.map(String).filter(Boolean)
      : [],
    links: (Array.isArray(raw.links) ? raw.links : []).map(normalizeLink).filter(Boolean),
    fields: (Array.isArray(raw.fields) ? raw.fields : []).map(normalizeField).filter(Boolean),
    tags: Array.isArray(raw.tags) ? raw.tags.map((t) => String(t).trim()).filter(Boolean) : [],
    notes: String(raw.notes || "").trim(),
    favorite: Boolean(raw.favorite),
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
  };
}

function normalizeCategory(raw) {
  if (!raw || !String(raw.name || "").trim()) return null;
  return {
    id: String(raw.id || uid("cat")),
    name: String(raw.name).trim(),
    icon: String(raw.icon || "📁").trim() || "📁",
    color: String(raw.color || "#8b9dc3").trim(),
  };
}

function normalizeStorage(raw) {
  const categories =
    Array.isArray(raw?.categories) && raw.categories.length
      ? raw.categories.map(normalizeCategory).filter(Boolean)
      : DEFAULT_CATEGORIES.map((c) => ({ ...c }));

  const profiles = (Array.isArray(raw?.profiles) ? raw.profiles : [])
    .map(normalizeProfile)
    .filter(Boolean);

  return {
    categories,
    profiles,
    settings: {
      lastCategory: String(raw?.settings?.lastCategory || "all"),
    },
  };
}

async function loadStorage() {
  try {
    const raw = await fs.promises.readFile(dataPath(), "utf8");
    return { ok: true, data: normalizeStorage(JSON.parse(raw)) };
  } catch (err) {
    if (err && err.code === "ENOENT") {
      return { ok: true, data: normalizeStorage({}) };
    }
    return { ok: false, error: err.message || "Failed to load" };
  }
}

async function saveStorage(args) {
  const payload = normalizeStorage(args?.data ?? args);
  await fs.promises.mkdir(path.dirname(dataPath()), { recursive: true });
  await fs.promises.writeFile(dataPath(), JSON.stringify(payload, null, 2), "utf8");
  return { ok: true, data: payload };
}

function normalizeUrl(raw) {
  let url = String(raw || "").trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url) && !/^file:\/\//i.test(url) && !/^mailto:/i.test(url)) {
    url = `https://${url}`;
  }
  return url;
}

async function openLink(args) {
  const url = normalizeUrl(args?.url);
  if (!url) return { ok: false, error: "URL is required" };
  await shell.openExternal(url);
  return { ok: true };
}

async function openFolder(args) {
  const folder = String(args?.path || "").trim();
  if (!folder) return { ok: false, error: "Path required" };
  const result = await shell.openPath(folder);
  if (result) return { ok: false, error: result };
  return { ok: true };
}

async function copyText(args) {
  clipboard.writeText(String(args?.text ?? ""));
  return { ok: true };
}

async function exportData() {
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  return { ok: true, json: JSON.stringify(loaded.data, null, 2) };
}

async function importData(args) {
  let parsed;
  try {
    parsed = typeof args?.json === "string" ? JSON.parse(args.json) : args?.data;
  } catch {
    return { ok: false, error: "Invalid JSON" };
  }
  return saveStorage({ data: parsed });
}

const CHANNELS = {
  "storage.load": () => loadStorage(),
  "storage.save": (args) => saveStorage(args),
  "links.open": (args) => openLink(args),
  "folder.open": (args) => openFolder(args),
  "clipboard.copy": (args) => copyText(args),
  "data.export": () => exportData(),
  "data.import": (args) => importData(args),
  "vault.status": () => vaultStatus(),
  "vault.unlock": (args) => vaultUnlock(args),
  "vault.lock": () => vaultLock(),
  "vault.list": () => vaultList(),
  "vault.get": (args) => vaultGet(args),
  "vault.save": (args) => vaultSave(args),
  "vault.delete": (args) => vaultDelete(args),
  "vault.copyPassword": (args) => vaultCopyPassword(args),
};

async function handleProfilesInvoke(channel, args) {
  const handler = CHANNELS[channel];
  if (!handler) return { ok: false, error: `Unknown channel: ${channel}` };
  try {
    return await handler(args);
  } catch (err) {
    return { ok: false, error: err.message || "Request failed" };
  }
}

module.exports = { handleProfilesInvoke, lockVaultForProfileSwitch };
