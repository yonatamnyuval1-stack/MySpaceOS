const path = require("path");
const fs = require("fs");
const { getLocalAuth, setLegacyMigrator } = require("../main/apps/local-auth");

const APP_ID = "world-maps";
const auth = getLocalAuth(APP_ID);

function legacyNotesFile(accountsRoot) {
  return path.join(accountsRoot, "world-maps-notes.json");
}

function legacySettingsFile(accountsRoot) {
  return path.join(accountsRoot, "world-maps-settings.json");
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

async function migrateLegacyData(userId, accountsRoot) {
  const dir = path.join(accountsRoot, "users", userId);
  await fs.promises.mkdir(dir, { recursive: true });

  const notesTarget = path.join(dir, "notes.json");
  const settingsTarget = path.join(dir, "settings.json");

  try {
    await fs.promises.access(notesTarget);
  } catch {
    try {
      const legacy = await readJson(legacyNotesFile(accountsRoot), null);
      if (legacy) {
        const notes = Array.isArray(legacy?.notes) ? legacy.notes : Array.isArray(legacy) ? legacy : [];
        await writeJson(notesTarget, { notes });
      }
    } catch {
    }
  }

  try {
    await fs.promises.access(settingsTarget);
  } catch {
    try {
      const legacy = await readJson(legacySettingsFile(accountsRoot), null);
      if (legacy && typeof legacy === "object") {
        await writeJson(settingsTarget, legacy);
      }
    } catch {
    }
  }
}

setLegacyMigrator(APP_ID, migrateLegacyData);

function notesPath(_userDataRoot) {
  return auth.userDataPath("notes.json");
}

function settingsPath(_userDataRoot) {
  return auth.userDataPath("settings.json");
}

function routesPath(_userDataRoot) {
  return auth.userDataPath("routes.json");
}

function usersFile(userDataRoot) {
  return path.join(userDataRoot, "users.json");
}

function userDir(userDataRoot, userId) {
  return path.join(userDataRoot, "users", userId);
}

module.exports = {
  authStatus: () => auth.authStatus(),
  register: (username, password, remember) => auth.register(username, password, remember),
  login: (username, password, remember) => auth.login(username, password, remember),
  logout: () => auth.logout(),
  tryRestoreSession: () => auth.tryRestoreSession(),
  getCurrentUser: () => auth.getCurrentUser(),
  notesPath,
  settingsPath,
  routesPath,
  setSessionRoot: (root) => auth.setSessionRoot(root),
  setAccountsRoot: (root) => auth.setAccountsRoot(root),
  usersFile,
  userDir,
  MIN_USERNAME: 3,
  MAX_USERNAME: 32,
  MIN_PASSWORD: 6,
};
