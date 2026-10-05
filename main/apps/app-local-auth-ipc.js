const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");
const { BrowserWindow } = require("electron");
const { getLocalAuth, isLocalAuthChannel } = require("./local-auth");
const identity = require("../myspace-identity");
const profile = require("../myspace-profile");
/** @type {Map<string, (auth: ReturnType<getLocalAuth>) => void | Promise<void>>} */
const prepareHooks = new Map();

function broadcastMyspaceIdentityChanged() {
  const user = identity.getCurrentUser();
  const payload = { user, signedIn: Boolean(user) };
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    try {
      win.webContents.send("myspace-identity-changed", payload);
    } catch {
    }
  }
}
function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function appDirForModule(moduleId) {
  return path.join(__dirname, "..", "..", "apps", moduleId);
}

function readAppManifest(moduleId) {
  const manifestPath = path.join(appDirForModule(moduleId), "manifest.json");
  if (!fs.existsSync(manifestPath)) return null;
  return readJson(manifestPath);
}

function resolveContentRoot(appDir, manifest) {
  if (manifest?.contentRoot) {
    return path.resolve(appDir, manifest.contentRoot);
  }
  return appDir;
}

function resolveAuthPath(appDir, manifest, relPath) {
  const rel = String(relPath || "").trim();
  if (!rel) return null;
  if (path.isAbsolute(rel)) return rel;
  if (rel.startsWith("../") || rel.startsWith("..\\")) {
    return path.resolve(appDir, rel);
  }
  const contentRoot = resolveContentRoot(appDir, manifest);
  return path.join(contentRoot, rel);
}

function hasLocalAuth(moduleId) {
  const manifest = readAppManifest(moduleId);
  return manifest?.auth?.type === "local";
}

function resolveAppEntryUrl(moduleId) {
  const appDir = appDirForModule(moduleId);
  const manifest = readAppManifest(moduleId) || {};
  const appEntry = manifest.auth?.appEntry || "index.html";
  const entryPath = resolveAuthPath(appDir, manifest, appEntry);
  if (!entryPath || !fs.existsSync(entryPath)) return null;
  return pathToFileURL(entryPath).href;
}

function resolveLoginEntryUrl(moduleId) {
  const appDir = appDirForModule(moduleId);
  const manifest = readAppManifest(moduleId) || {};
  const loginRel = manifest.auth?.entry || "../shared/local-auth/login.html";
  const loginPath = resolveAuthPath(appDir, manifest, loginRel);
  if (!loginPath || !fs.existsSync(loginPath)) return null;
  const shared = manifest.auth?.sharedAccounts === true ? "1" : "0";
  const base = pathToFileURL(loginPath).href;
  const q = new URLSearchParams({
    module: moduleId,
    title: manifest.name || moduleId,
    icon: manifest.icon || "📦",
    sub: manifest.description || "",
    shared,
  });
  return `${base}?${q.toString()}`;
}

function setLocalAuthPrepare(moduleId, fn) {
  const id = String(moduleId || "").trim();
  if (typeof fn === "function") prepareHooks.set(id, fn);
  else prepareHooks.delete(id);
}

async function prepareLocalAuth(moduleId) {
  const auth = getLocalAuth(moduleId);
  await fs.promises.mkdir(auth.getLocalRoot(), { recursive: true });
  const hook = prepareHooks.get(moduleId);
  if (hook) {
    await hook(auth);
    return auth;
  }
  auth.setSessionRoot(auth.getLocalRoot());
  auth.setAccountsRoot(auth.getLocalRoot());
  return auth;
}

function appNavigateTo(moduleId) {
  const manifest = readAppManifest(moduleId) || {};
  return manifest.auth?.appEntry || "index.html";
}

function loginNavigateTo(moduleId) {
  const manifest = readAppManifest(moduleId) || {};
  const loginRel = manifest.auth?.entry || "../shared/local-auth/login.html";
  if (loginRel.startsWith("../") || loginRel.startsWith("..\\") || path.isAbsolute(loginRel)) {
    return resolveLoginEntryUrl(moduleId);
  }
  const full = resolveLoginEntryUrl(moduleId);
  if (!full) return loginRel;
  const qIndex = full.indexOf("?");
  const query = qIndex >= 0 ? full.slice(qIndex) : "";
  return `${loginRel.replace(/\\/g, "/")}${query}`;
}

async function continueWithMyspace(moduleId, args = {}) {
  await identity.tryRestoreSession();
  let user = identity.getCurrentUser();
  let inheritedGuestData = false;
  if (!user && args?.username && args?.password) {
    const mode = args.mode === "register" ? "register" : "login";
    const before = await profile.guestInheritStatus();
    const result =
      mode === "register"
        ? await identity.register(args.username, args.password, Boolean(args.remember))
        : await identity.login(args.username, args.password, Boolean(args.remember));
    if (!result.ok) return result;
    user = result.user;
    const migration = await profile.onIdentitySignedIn(user);
    await profile.notifyProfileSwitched();
    broadcastMyspaceIdentityChanged();
    inheritedGuestData =
      Boolean(before?.willInheritGuestData) && migration?.servicesMigratedTo === user.id;
  } else if (user?.id) {
    await profile.onIdentitySignedIn(user);
  }
  if (!user) {
    const status = await identity.authStatus();
    const inherit = await profile.guestInheritStatus();
    return {
      ok: false,
      needOsLogin: true,
      hasUsers: status.hasUsers,
      willInheritGuestData: Boolean(inherit.willInheritGuestData),
      error: "Sign in to My Space to continue",
    };
  }
  const manifest = readAppManifest(moduleId) || {};
  const appName = String(manifest.name || moduleId).trim() || moduleId;
  const scopes = [
    {
      id: "profile",
      name: "Account name",
      detail: `Your My Space username (${user.username})`,
    },
    {
      id: "userId",
      name: "Account id",
      detail: "Used so this app keeps your data separate from other accounts",
    },
  ];
  if (!args.consent) {
    return {
      ok: false,
      needConsent: true,
      user: { id: user.id, username: user.username },
      app: { id: moduleId, name: appName, icon: manifest.icon || null },
      scopes,
      inheritedGuestData,
      error: "Allow this app to use your My Space account",
    };
  }
  const auth = await prepareLocalAuth(moduleId);
  const bound = await auth.bindMyspaceSession({
    userId: user.id,
    username: user.username,
    remember: Boolean(args.remember),
  });
  if (!bound.ok) return bound;
  const appUrl = resolveAppEntryUrl(moduleId) || appNavigateTo(moduleId);
  return {
    ok: true,
    user: bound.user,
    myspaceUser: user,
    navigateTo: appUrl || undefined,
    inheritedGuestData,
  };
}

async function handleAppLocalAuthInvoke(moduleId, channel, args = {}) {
  const ch = String(channel || "").trim();
  if (!isLocalAuthChannel(ch)) {
    return { ok: false, error: `Unknown auth channel: ${ch}` };
  }
  if (!hasLocalAuth(moduleId)) {
    return { ok: false, error: "App does not use local auth" };
  }
  const auth = await prepareLocalAuth(moduleId);
  const appUrl = resolveAppEntryUrl(moduleId) || appNavigateTo(moduleId);
  const loginUrl = resolveLoginEntryUrl(moduleId) || loginNavigateTo(moduleId);
  switch (ch) {
    case "auth-status":
      await auth.tryRestoreSession();
      return auth.authStatus();
    case "auth-myspace-status": {
      const status = await identity.authStatus();
      const inherit = await profile.guestInheritStatus();
      return { ...status, ...inherit };
    }
    case "auth-continue-myspace":
      return continueWithMyspace(moduleId, args);
    case "auth-register": {
      const result = await auth.register(args?.username, args?.password, Boolean(args?.remember));
      if (result.ok && appUrl) result.navigateTo = appUrl;
      return result;
    }
    case "auth-login": {
      const result = await auth.login(args?.username, args?.password, Boolean(args?.remember));
      if (result.ok && appUrl) result.navigateTo = appUrl;
      return result;
    }
    case "auth-logout": {
      await auth.logout();
      return { ok: true, navigateTo: loginUrl || undefined };
    }
    case "auth-enter-app": {
      if (!auth.getCurrentUser()) {
        return { ok: false, error: "Not signed in" };
      }
      return { ok: true, navigateTo: appUrl || undefined };
    }
    case "auth-current-user":
      return auth.getCurrentUser();
    default:
      return { ok: false, error: `Unknown auth channel: ${ch}` };
  }
}
module.exports = {
  handleAppLocalAuthInvoke,
  hasLocalAuth,
  readAppManifest,
  resolveAppEntryUrl,
  resolveLoginEntryUrl,
  resolveContentRoot,
  loginNavigateTo,
  appNavigateTo,
  isLocalAuthChannel,
  setLocalAuthPrepare,
  prepareLocalAuth,
  continueWithMyspace,
};