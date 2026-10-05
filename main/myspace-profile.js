const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const identity = require("./myspace-identity");
const INSTALL_WIDE_FILES = [
  "mail-oauth.json", 
  "updates-state.json", 
];
const INSTALL_WIDE_DIRS = [
  "myspace-identity", 
];
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
  "scripts.json",
  "model-flow-secrets.json",
  "model-flow-history.json",
  "model-flow-library.json",
  "studies-image-cache.json",
  "ai-tool-prefs.json",
  "resolve-incidents.json",
  "msl-protocol.json",
  "system-info-metrics.json",
  "os-bridge.json",
  "user-apps-registry.json",
  "storage-state.json",
  "backup-state.json",
];

const SERVICE_DIRS = [
  "workspace",
  "mail-cache",
  "os-bridge",
  "user-apps",
  "user-apps-data",
  "exports",
  "world-maps",
];

const LOCAL_AUTH_APP_DIRS = [
  "notes",
  "tasks",
  "builds",
  "stocks",
  "studies",
  "contacts",
  "translate",
  "contracts",
  "world-clock",
  "code-lexicon",
  "drift",
  "remote-hub",
  "coupons",
  "geography",
  "history",
  "space",
  "day-planner",
  "study-deck",
  "docs",
  "icon-library",
  "pi-digits",
  "flag-quiz",
  "world-maps",
];

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

function installWidePath(fileName) {
  const name = String(fileName || "").trim();
  if (!name) throw new Error("fileName required");
  return path.join(app.getPath("userData"), name);
}

function isInstallWideName(name) {
  const n = String(name || "").trim();
  return INSTALL_WIDE_FILES.includes(n) || INSTALL_WIDE_DIRS.includes(n);
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
  return copyIfBetter(src, dest, { onlyMissing: true });
}

async function fileSizeOrNeg(filePath) {
  try {
    return (await fs.promises.stat(filePath)).size;
  } catch {
    return -1;
  }
}
async function copyIfBetter(src, dest, opts = {}) {
  let srcSize = 0;
  try {
    const srcStat = await fs.promises.stat(src);
    if (!srcStat.isFile() || srcStat.size <= 0) return false;
    srcSize = srcStat.size;
  } catch {
    return false;
  }

  const destSize = await fileSizeOrNeg(dest);
  if (opts.onlyMissing) {
    if (destSize >= 0) return false;
  } else if (destSize >= srcSize) {
    return false;
  }

  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  if (destSize >= 0) {
    try {
      await fs.promises.copyFile(dest, `${dest}.pre-heal.bak`);
    } catch {
    }
  }
  await fs.promises.copyFile(src, dest);
  return true;
}

async function copyDirIfMissing(src, dest) {
  try {
    await fs.promises.stat(src);
  } catch {
    return false;
  }

  try {
    await fs.promises.access(dest);
    return false;
  } catch {
    await fs.promises.mkdir(dest, { recursive: true });
    await fs.promises.cp(src, dest, { recursive: true, force: false, errorOnExist: true });
    return true;
  }
}

async function healLocalAuthAppData(userId) {
  const id = String(userId || "").trim();
  if (!id) return [];
  const root = app.getPath("userData");
  const dir = profileDir(id);
  if (!dir) return [];
  const copied = [];
  for (const appName of LOCAL_AUTH_APP_DIRS) {
    const destPath = path.join(dir, appName, "users", id, "data.json");
    const destSize = await fileSizeOrNeg(destPath);
    const candidates = [];
    for (const base of [root, dir]) {
      const usersDir = path.join(base, appName, "users");
      try {
        const entries = await fs.promises.readdir(usersDir, { withFileTypes: true });
        for (const ent of entries) {
          if (!ent.isDirectory()) continue;
          const candidate = path.join(usersDir, ent.name, "data.json");
          const size = await fileSizeOrNeg(candidate);
          if (size > 0) candidates.push({ path: candidate, size });
        }
      } catch {
      }
      const flat = path.join(base, `${appName}.json`);
      const flatSize = await fileSizeOrNeg(flat);
      if (flatSize > 0) candidates.push({ path: flat, size: flatSize });
    }

    if (!candidates.length) continue;
    candidates.sort((a, b) => b.size - a.size);
    const best = candidates[0];
    if (best.size > destSize) {
      if (await copyIfBetter(best.path, destPath)) {
        copied.push(`${appName}/users/${id}/data.json`);
      }
    }
  }

  return copied;
}

async function readMigrateMarker() {
  try {
    return JSON.parse(await fs.promises.readFile(migrateMarkerPath(), "utf8"));
  } catch {
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
      if (await copyIfBetter(candidate, dest)) {
        copied.push("user-config.json");
        break;
      }
    }
    for (const name of PROFILE_FILES) {
      if (name === "user-config.json") continue;
      const src = path.join(root, name);
      const dest = path.join(dir, name);
      if (await copyIfBetter(src, dest)) copied.push(name);
    }
    markerData.migratedProfiles.push(id);
  }
  for (const name of [...PROFILE_FILES, ...SERVICE_FILES]) {
    const src = path.join(root, name);
    const dest = path.join(dir, name);
    if (await copyIfBetter(src, dest)) copied.push(name);
  }
  const dirs = [...new Set([...SERVICE_DIRS, ...LOCAL_AUTH_APP_DIRS])];
  for (const name of dirs) {
    const src = path.join(root, name);
    const dest = path.join(dir, name);
    if (await copyDirIfMissing(src, dest)) copied.push(`${name}/`);
  }
  const localAuthCopied = await healLocalAuthAppData(id);
  copied.push(...localAuthCopied);
  if (!markerData.servicesMigratedTo) {
    markerData.servicesMigratedTo = id;
  }
  if (!already || copied.length) {
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

async function guestInheritStatus() {
  const markerData = await readMigrateMarker();
  if (markerData.servicesMigratedTo) {
    return {
      willInheritGuestData: false,
      inheritedBy: markerData.servicesMigratedTo,
    };
  }
  return { willInheritGuestData: true, inheritedBy: null };
}

function notifyProfileSwitched() {
  const hooks = [];
  const tryHook = (loader, method) => {
    try {
      const mod = loader();
      if (typeof mod?.[method] === "function") {
        hooks.push(Promise.resolve(mod[method]()));
      }
    } catch (err) {
      console.error(`Failed to load or execute hook for method ${method}.`, err);
    }
  };
  tryHook(() => require("./apps/profiles-ipc"), "lockVaultForProfileSwitch");
  tryHook(() => require("./jobs/engine"), "reloadForProfileSwitch");
  tryHook(() => require("./scheduler/engine"), "reloadForProfileSwitch");
  tryHook(() => require("./apps/chat-ipc"), "reloadForProfileSwitch");
  tryHook(() => require("./apps/coupons-ipc"), "lockForProfileSwitch");
  tryHook(() => require("./apps/local-auth"), "clearAllSessionsMemory");
  tryHook(() => require("./apps/studies-images"), "clearMemoryCache");
  return Promise.all(hooks.map((h) => Promise.resolve(h).catch((err) => {
    console.error("Hook execution error:", err);
    return null;
  })));
}
module.exports = {
  INSTALL_WIDE_FILES,
  INSTALL_WIDE_DIRS,
  PROFILE_FILES,
  SERVICE_FILES,
  SERVICE_DIRS,
  LOCAL_AUTH_APP_DIRS,
  profilesRoot,
  profileDir,
  activeProfileDir,
  profileScopedPath,
  installWidePath,
  isInstallWideName,
  ensureProfileDir,
  migrateInstallDataToProfile,
  onIdentitySignedIn,
  guestInheritStatus,
  notifyProfileSwitched,
  legacyUserConfigCandidates,
};