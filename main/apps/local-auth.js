const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const SESSION_DAYS = 30;
const MIN_USERNAME = 3;
const MAX_USERNAME = 32;
const MIN_PASSWORD = 8;
/** @type {Map<string, { userId: string, username: string, remember: boolean }>} */
const sessions = new Map();
/** @type {Map<string, string|null>} */
const sessionRootOverrides = new Map();
/** @type {Map<string, string|null>} */
const accountsRootOverrides = new Map();
/** @type {Map<string, (userId: string, accountsRoot: string) => Promise<void>>} */
const legacyMigrators = new Map();

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64, SCRYPT_OPTS);
}

function createAuthRecord(password) {
  const salt = crypto.randomBytes(16);
  const hash = hashPassword(password, salt);
  return { salt: salt.toString("base64"), hash: hash.toString("base64") };
}

function verifyPassword(password, saltB64, hashB64) {
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const actual = hashPassword(password, salt);
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

function uid() {
  return `u_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function normalizeUsername(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase();
}

function validateUsername(username) {
  if (username.length < MIN_USERNAME || username.length > MAX_USERNAME) {
    return `Username must be ${MIN_USERNAME}–${MAX_USERNAME} characters`;
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    return "Username may only use letters, numbers, and underscore";
  }
  return null;
}

function validatePassword(password) {
  if (String(password || "").length < MIN_PASSWORD) {
    return `Password must be at least ${MIN_PASSWORD} characters`;
  }
  return null;
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.promises.readFile(filePath, "utf8"));
  } catch (err) {
    if (err?.code === "ENOENT") return fallback;
    throw err;
  }
}

async function writeJson(filePath, data) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

function localRoot(appId) {
  const profile = require("../myspace-profile");
  return profile.profileScopedPath(String(appId || "").trim());
}

function getAccountsRoot(appId) {
  return accountsRootOverrides.get(appId) || localRoot(appId);
}

function getSessionRoot(appId) {
  return sessionRootOverrides.get(appId) || localRoot(appId);
}

function usersFile(accountsRoot) {
  return path.join(accountsRoot, "users.json");
}

function sessionFile(appId) {
  return path.join(getSessionRoot(appId), "session.json");
}

function userDir(accountsRoot, userId) {
  return path.join(accountsRoot, "users", userId);
}

function setSessionRoot(appId, root) {
  sessionRootOverrides.set(appId, root ? String(root) : null);
}

function setAccountsRoot(appId, root) {
  accountsRootOverrides.set(appId, root ? String(root) : null);
}

function getCurrentUser(appId) {
  const session = sessions.get(appId);
  if (!session) return null;
  return { id: session.userId, username: session.username };
}

function requireUser(appId) {
  const user = getCurrentUser(appId);
  if (!user) throw new Error("Not signed in");
  return user;
}

function userDataPath(appId, fileName) {
  const user = requireUser(appId);
  const root = getAccountsRoot(appId);
  return path.join(userDir(root, user.id), fileName);
}

async function loadUsersStore(accountsRoot) {
  const store = await readJson(usersFile(accountsRoot), { users: [] });
  if (!Array.isArray(store.users)) store.users = [];
  return store;
}

async function saveUsersStore(accountsRoot, store) {
  await writeJson(usersFile(accountsRoot), store);
}

async function persistSession(appId, remember) {
  const session = sessions.get(appId);
  if (!session) return;
  if (!remember) {
    try {
      await fs.promises.unlink(sessionFile(appId));
    } catch (err) {
      if (err?.code !== "ENOENT") throw err;
    }
    return;
  }
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  await writeJson(sessionFile(appId), {
    userId: session.userId,
    username: session.username,
    expiresAt,
  });
}

async function clearSession(appId) {
  sessions.delete(appId);
  try {
    await fs.promises.unlink(sessionFile(appId));
  } catch (err) {
    if (err?.code !== "ENOENT") throw err;
  }
}

async function tryRestoreSession(appId) {
  const accountsRoot = getAccountsRoot(appId);
  const saved = await readJson(sessionFile(appId), null);
  if (!saved?.userId) return null;
  if (saved.expiresAt && Date.now() > saved.expiresAt) {
    await clearSession(appId);
    return null;
  }
  if (String(saved.userId).startsWith("ms_")) {
    await fs.promises.mkdir(userDir(accountsRoot, saved.userId), { recursive: true });
    sessions.set(appId, {
      userId: saved.userId,
      username: saved.username || saved.userId,
      remember: true,
      source: "myspace",
    });
    return { id: saved.userId, username: saved.username || saved.userId, source: "myspace" };
  }

  const store = await loadUsersStore(accountsRoot);
  const user = store.users.find((u) => u.id === saved.userId);
  if (!user) {
    await clearSession(appId);
    return null;
  }

  sessions.set(appId, {
    userId: user.id,
    username: user.username,
    remember: true,
  });
  return { id: user.id, username: user.username };
}

async function runLegacyMigrator(appId, userId, accountsRoot) {
  const fn = legacyMigrators.get(appId);
  if (!fn) return;
  await fn(userId, accountsRoot);
}

async function authStatus(appId) {
  const accountsRoot = getAccountsRoot(appId);
  const store = await loadUsersStore(accountsRoot);
  const user = getCurrentUser(appId);
  return {
    hasUsers: store.users.length > 0,
    signedIn: Boolean(user),
    user,
  };
}

async function register(appId, usernameRaw, password, remember = false) {
  const username = normalizeUsername(usernameRaw);
  const userErr = validateUsername(username);
  if (userErr) return { ok: false, error: userErr };
  const passErr = validatePassword(password);
  if (passErr) return { ok: false, error: passErr };

  const accountsRoot = getAccountsRoot(appId);
  await fs.promises.mkdir(accountsRoot, { recursive: true });

  const store = await loadUsersStore(accountsRoot);
  if (store.users.some((u) => u.username === username)) {
    return { ok: false, error: "Username already taken" };
  }

  const authRecord = createAuthRecord(password);
  const user = {
    id: uid(),
    username,
    salt: authRecord.salt,
    hash: authRecord.hash,
    createdAt: new Date().toISOString(),
  };

  store.users.push(user);
  await saveUsersStore(accountsRoot, store);
  await fs.promises.mkdir(userDir(accountsRoot, user.id), { recursive: true });
  await runLegacyMigrator(appId, user.id, accountsRoot);

  sessions.set(appId, {
    userId: user.id,
    username: user.username,
    remember: Boolean(remember),
  });
  await persistSession(appId, Boolean(remember));
  return { ok: true, user: { id: user.id, username: user.username } };
}

async function login(appId, usernameRaw, password, remember = false) {
  const username = normalizeUsername(usernameRaw);
  if (!username || !password) {
    return { ok: false, error: "Username and password required" };
  }
  const accountsRoot = getAccountsRoot(appId);
  const store = await loadUsersStore(accountsRoot);
  const user = store.users.find((u) => u.username === username);
  if (!user || !verifyPassword(password, user.salt, user.hash)) {
    return { ok: false, error: "Wrong username or password" };
  }

  await fs.promises.mkdir(userDir(accountsRoot, user.id), { recursive: true });
  await runLegacyMigrator(appId, user.id, accountsRoot);
  sessions.set(appId, {
    userId: user.id,
    username: user.username,
    remember: Boolean(remember),
  });
  await persistSession(appId, remember);
  return { ok: true, user: { id: user.id, username: user.username } };
}

async function logout(appId) {
  await clearSession(appId);
  return { ok: true };
}

async function bindMyspaceSession(appId, { userId, username, remember = false } = {}) {
  const id = String(userId || "").trim();
  const name = normalizeUsername(username) || id;
  if (!id.startsWith("ms_")) {
    return { ok: false, error: "Invalid My Space user id" };
  }
  const accountsRoot = getAccountsRoot(appId);
  await fs.promises.mkdir(userDir(accountsRoot, id), { recursive: true });
  await runLegacyMigrator(appId, id, accountsRoot);
  sessions.set(appId, {
    userId: id,
    username: name,
    remember: Boolean(remember),
    source: "myspace",
  });
  await persistSession(appId, Boolean(remember));
  return { ok: true, user: { id, username: name, source: "myspace" } };
}

function setLegacyMigrator(appId, fn) {
  if (typeof fn === "function") legacyMigrators.set(appId, fn);
  else legacyMigrators.delete(appId);
}

function createLocalAuth(appId) {
  const id = String(appId || "").trim();
  if (!id) throw new Error("appId required");
  return {
    appId: id,
    setSessionRoot: (root) => setSessionRoot(id, root),
    setAccountsRoot: (root) => setAccountsRoot(id, root),
    getLocalRoot: () => localRoot(id),
    getAccountsRoot: () => getAccountsRoot(id),
    getSessionRoot: () => getSessionRoot(id),
    authStatus: () => authStatus(id),
    register: (username, password, remember) => register(id, username, password, remember),
    login: (username, password, remember) => login(id, username, password, remember),
    logout: () => logout(id),
    bindMyspaceSession: (payload) => bindMyspaceSession(id, payload),
    tryRestoreSession: () => tryRestoreSession(id),
    getCurrentUser: () => getCurrentUser(id),
    requireUser: () => requireUser(id),
    userDataPath: (fileName) => userDataPath(id, fileName),
    userDir: (userId) => userDir(getAccountsRoot(id), userId),
    usersFile: () => usersFile(getAccountsRoot(id)),
  };
}

/** @type {Map<string, ReturnType<createLocalAuth>>} */
const authInstances = new Map();

function getLocalAuth(appId) {
  const id = String(appId || "").trim();
  if (!authInstances.has(id)) authInstances.set(id, createLocalAuth(id));
  return authInstances.get(id);
}

const LOCAL_AUTH_CHANNELS = new Set([
  "auth-status",
  "auth-register",
  "auth-login",
  "auth-logout",
  "auth-enter-app",
  "auth-current-user",
  "auth-continue-myspace",
  "auth-myspace-status",
]);

function isLocalAuthChannel(channel) {
  return LOCAL_AUTH_CHANNELS.has(String(channel || "").trim());
}

function clearAllSessionsMemory() {
  sessions.clear();
  return { ok: true };
}

module.exports = {
  createLocalAuth,
  getLocalAuth,
  setLegacyMigrator,
  setSessionRoot,
  setAccountsRoot,
  isLocalAuthChannel,
  clearAllSessionsMemory,
  authStatus,
  register,
  login,
  logout,
  bindMyspaceSession,
  tryRestoreSession,
  getCurrentUser,
  requireUser,
  userDataPath,
  userDir,
  usersFile,
  localRoot,
  getAccountsRoot,
  MIN_USERNAME,
  MAX_USERNAME,
  MIN_PASSWORD,
};