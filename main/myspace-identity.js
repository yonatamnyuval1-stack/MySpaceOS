const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const SCRYPT_OPTS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const SESSION_DAYS = 30;
const MIN_USERNAME = 3;
const MAX_USERNAME = 32;
const MIN_PASSWORD = 6;

/** @type {{ userId: string, username: string, remember: boolean } | null} */
let session = null;

function identityRoot() {
  return path.join(app.getPath("userData"), "myspace-identity");
}

function usersFile() {
  return path.join(identityRoot(), "users.json");
}

function sessionFile() {
  return path.join(identityRoot(), "session.json");
}

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
  return crypto.timingSafeEqual(expected, actual);
}

function msUid() {
  return `ms_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
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

async function loadUsersStore() {
  const store = await readJson(usersFile(), { users: [] });
  if (!Array.isArray(store.users)) store.users = [];
  return store;
}

async function saveUsersStore(store) {
  await writeJson(usersFile(), store);
}

function getCurrentUser() {
  if (!session) return null;
  return { id: session.userId, username: session.username };
}

function isMyspaceUserId(userId) {
  return String(userId || "").startsWith("ms_");
}

async function persistSession(remember) {
  if (!session) return;
  if (!remember) {
    try {
      await fs.promises.unlink(sessionFile());
    } catch (err) {
      if (err?.code !== "ENOENT") throw err;
    }
    return;
  }
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  await writeJson(sessionFile(), {
    userId: session.userId,
    username: session.username,
    expiresAt,
  });
}

async function clearSession() {
  session = null;
  try {
    await fs.promises.unlink(sessionFile());
  } catch (err) {
    if (err?.code !== "ENOENT") throw err;
  }
}

async function tryRestoreSession() {
  const saved = await readJson(sessionFile(), null);
  if (!saved?.userId) {
    session = null;
    return null;
  }
  if (saved.expiresAt && Date.now() > saved.expiresAt) {
    await clearSession();
    return null;
  }
  const store = await loadUsersStore();
  const user = store.users.find((u) => u.id === saved.userId);
  if (!user) {
    await clearSession();
    return null;
  }
  session = {
    userId: user.id,
    username: user.username,
    remember: true,
  };
  return getCurrentUser();
}

async function authStatus() {
  await tryRestoreSession();
  const store = await loadUsersStore();
  const user = getCurrentUser();
  return {
    hasUsers: store.users.length > 0,
    signedIn: Boolean(user),
    user,
  };
}

async function register(usernameRaw, password, remember = true) {
  const username = normalizeUsername(usernameRaw);
  const userErr = validateUsername(username);
  if (userErr) return { ok: false, error: userErr };
  const passErr = validatePassword(password);
  if (passErr) return { ok: false, error: passErr };

  await fs.promises.mkdir(identityRoot(), { recursive: true });
  const store = await loadUsersStore();
  if (store.users.some((u) => u.username === username)) {
    return { ok: false, error: "Username already taken" };
  }

  const authRecord = createAuthRecord(password);
  const user = {
    id: msUid(),
    username,
    salt: authRecord.salt,
    hash: authRecord.hash,
    createdAt: new Date().toISOString(),
  };
  store.users.push(user);
  await saveUsersStore(store);

  session = {
    userId: user.id,
    username: user.username,
    remember: Boolean(remember),
  };
  await persistSession(Boolean(remember));

  return { ok: true, user: { id: user.id, username: user.username } };
}

async function login(usernameRaw, password, remember = false) {
  const username = normalizeUsername(usernameRaw);
  if (!username || !password) {
    return { ok: false, error: "Password and username required" };
  }
  const store = await loadUsersStore();
  const user = store.users.find((u) => u.username === username);
  if (!user || !verifyPassword(password, user.salt, user.hash)) {
    return { ok: false, error: "Wrong password or username" };
  }
  session = {
    userId: user.id,
    username: user.username,
    remember: Boolean(remember),
  };
  await persistSession(Boolean(remember));
  return { ok: true, user: { id: user.id, username: user.username } };
}

async function logout() {
  await clearSession();
  return { ok: true };
}

module.exports = {
  authStatus,
  register,
  login,
  logout,
  tryRestoreSession,
  getCurrentUser,
  isMyspaceUserId,
  identityRoot,
  MIN_USERNAME,
  MAX_USERNAME,
  MIN_PASSWORD,
};