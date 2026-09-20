const path = require("path");
const fs = require("fs");
const { app } = require("electron");
const { getLocalAuth, setLegacyMigrator } = require("./local-auth");
const { setLocalAuthPrepare } = require("./app-local-auth-ipc");

function setupLocalAuthApp(appId) {
  const id = String(appId || "").trim();
  const auth = getLocalAuth(id);
  setLocalAuthPrepare(id, (localAuth) => {
    localAuth.setSessionRoot(localAuth.getLocalRoot());
    localAuth.setAccountsRoot(localAuth.getLocalRoot());
  });
  return auth;
}

function requireSignedIn(auth) {
  try {
    auth.requireUser();
    return null;
  } catch {
    return { ok: false, error: "Not signed in" };
  }
}

function userStorageRoot(auth) {
  const user = auth.requireUser();
  return path.join(auth.getAccountsRoot(), "users", user.id);
}

function legacyMigratedFlag(accountsRoot) {
  return path.join(accountsRoot, ".legacy-data-migrated");
}

/**
 * @param {string} appId
 * @param {Array<string|{legacy: string, target?: string}>} legacyFiles
 */
function registerLegacyMigrator(appId, legacyFiles) {
  const mappings = (legacyFiles || []).map((entry) => {
    if (typeof entry === "string") {
      return { legacy: entry, target: entry === "data.json" ? "data.json" : entry };
    }
    return {
      legacy: entry.legacy,
      target: entry.target || entry.legacy,
    };
  });

  setLegacyMigrator(appId, async (userId, accountsRoot) => {
    const flag = legacyMigratedFlag(accountsRoot);
    try {
      await fs.promises.access(flag);
      return;
    } catch {
    }

    const userDir = path.join(accountsRoot, "users", userId);
    await fs.promises.mkdir(userDir, { recursive: true });

    let copied = 0;
    for (const { legacy, target } of mappings) {
      const dest = path.join(userDir, target);
      try {
        await fs.promises.access(dest);
        continue;
      } catch {
      }
      const legacyPath = path.join(app.getPath("userData"), legacy);
      try {
        await fs.promises.copyFile(legacyPath, dest);
        copied += 1;
      } catch (err) {
        if (err?.code !== "ENOENT") throw err;
      }
    }

    await fs.promises.writeFile(
      flag,
      JSON.stringify({
        userId,
        at: new Date().toISOString(),
        copied,
        files: mappings.map((m) => m.target),
      }),
      "utf8"
    );
  });
}

function registerSingleFileMigrator(appId, legacyBasename) {
  registerLegacyMigrator(appId, [{ legacy: legacyBasename, target: "data.json" }]);
}

module.exports = {
  setupLocalAuthApp,
  requireSignedIn,
  userStorageRoot,
  registerLegacyMigrator,
  registerSingleFileMigrator,
  legacyMigratedFlag,
};