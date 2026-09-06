const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const identity = require("./myspace-identity");

const PROFILE_FILES = [
  "user-config.json",
  "app-settings.json",
  "themes-state.json",
  "notifications-prefs.json",
  "shell-engine.json",
];


const SERVICE_FILES = [
  "files-service.json",
  "jobs-platform.json",
  "scheduler-platform.json",
  "mind-platform.json",
  "mind-secrets.json",
  "mind-memory.json",
  "chat-app.json",
  "profiles.json",
  "vault.json",
  "mail-accounts.json",
  "mail-tokens.enc",
  "hub-connections.json",
  "hub-secrets.enc",
  "composio-platform.json",
  "composio-secrets.json",
  "notifications.json",
  "permissions-platform.json",
];

const SERVICE_DIRS = ["workspace", "mail-cache"];

function profilesRoot() {
  return path.join(app.getPath("userData"), "profiles");
}

function profileDir(userId) {
  const id = String(userId || "").trim();
  if (!id) return null;
  return path.join(profilesRoot(), id);
}

function activeProfileDir() {
  const user = identity.getCurrentUser();
  return user ? profileDir(user.id) : null;
}

function profileScopedPath(fileName, userId = null) {
  const name = String(fileName || "").trim();
  if (!name) throw new Error("fileName required");
  const id = userId || identity.getCurrentUser()?.id || null;
  if (id) return path.join(profilesRoot(), id, name);
  return path.join(app.getPath("userData"), name);
}

function migrateMarkerPath() {
  return path.join(profilesRoot(), "MIGRATED.json");
}

function legacyUserConfigCandidates() {
  const packaged = path.join(app.getPath("userData"), "user-config.json");
  const dev = path.join(__dirname, "..", "config", "user-config.json");
  return app.isPackaged ? [packaged] : [dev, packaged];
}

async function ensureProfileDir(userId) {
  const dir = profileDir(userId);
  if (!dir) return null;
  await fs.promises.mkdir(dir, { recursive: true });
  return dir;
}

async function copyIfMissing(src, dest) {
  if (!fs.existsSync(src) || fs.existsSync(dest)) return false;
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  await fs.promises.copyFile(src, dest);
  return true;
}

async function copyDirIfMissing(src, dest) {
  if (!fs.existsSync(src) || fs.existsSync(dest)) return false;
  await fs.promises.mkdir(dest, { recursive: true });
  await fs.promises.cp(src, dest, { recursive: true, force: false, errorOnExist: false });
  return true;
}

async function readMigrateMarker() {
  try {
    return JSON.parse(await fs.promises.readFile(migrateMarkerPath(), "utf8"));
  }
   catch {
    return { migratedProfiles: [], servicesMigratedTo: null };
  }
}

async function writeMigrateMarker(markerData) {
  markerData.updatedAt = new Date().toISOString();
  await fs.promises.mkdir(profilesRoot(), { recursive: true });
  await fs.promises.writeFile(migrateMarkerPath(), JSON.stringify(markerData, null, 2), "utf8");
}

async function migrateInstallDataToProfile(userId) {
  const id = String(userId || "").trim();
  if (!id) return { ok: false, error: "No user id" };

  const dir = await ensureProfileDir(id);
  const markerData = await readMigrateMarker();
  if (!Array.isArray(markerData.migratedProfiles)) markerData.migratedProfiles = [];

  const already = markerData.migratedProfiles.includes(id);
  const copied = [];
  const root = app.getPath("userData");

  if (!already) {
    for (const candidate of legacyUserConfigCandidates()) {
      const dest = path.join(dir, "user-config.json");
      if (await copyIfMissing(candidate, dest)) {
        copied.push("user-config.json");
       break;
      }
    }

    for (const name of PROFILE_FILES) {
      if (name === "user-config.json") continue;
      const src = path.join(root, name);
      const dest = path.join(dir, name);
      if (await copyIfMissing(src, dest)) copied.push(name);
    }

    markerData.migratedProfiles.push(id);
  }

  let servicesCopied = false;
  if (!markerData.servicesMigratedTo) {
    for (const name of SERVICE_FILES) {
      const src = path.join(root, name);
      const dest = path.join(dir, name);
      if (await copyIfMissing(src, dest)) copied.push(name);
    }
    for (const name of SERVICE_DIRS) {
      const src = path.join(root, name);
      const dest = path.join(dir, name);
      if (await copyDirIfMissing(src, dest)) copied.push(`${name}/`);
    }
    markerData.servicesMigratedTo = id;
    servicesCopied = true;
  }

  if (!already || servicesCopied) {
    await writeMigrateMarker(markerData);
  }

  return {
    ok: true,
    profileDir: dir,
    copied,
    alreadyMigrated: already,
    servicesMigratedTo: markerData.servicesMigratedTo,
  };
}

async function onIdentitySignedIn(user) {
  if (!user?.id) return { ok: false };
  return migrateInstallDataToProfile(user.id);
}

function notifyProfileSwitched() {
  const hooks = [];
  try {
    const profilesIpc = require("./apps/profiles-ipc");
    if (typeof profilesIpc.lockVaultForProfileSwitch === "function") {
      hooks.push(profilesIpc.lockVaultForProfileSwitch());
    }
  } catch {
  }
  try {
    const jobsEngine = require("./jobs/engine");
    if (typeof jobsEngine.reloadForProfileSwitch === "function") {
      hooks.push(Promise.resolve(jobsEngine.reloadForProfileSwitch()));
    }
  } catch {
  }
  return Promise.all(hooks.map((h) => Promise.resolve(h).catch(() => null)));
}

module.exports = {
  PROFILE_FILES,
  SERVICE_FILES,
  SERVICE_DIRS,
  profilesRoot,
  profileDir,
  activeProfileDir,
  profileScopedPath,
  ensureProfileDir,
  migrateInstallDataToProfile,
  onIdentitySignedIn,
  notifyProfileSwitched,
  legacyUserConfigCandidates,
};