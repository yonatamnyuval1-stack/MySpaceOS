const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const APPS_JSON = path.join(ROOT, "config", "apps.json");

const SERVICE_IDS = new Set([
  "welcome",
  "apps-info",
  "system-info",
  "os-bridge",
  "files",
  "pulse",
  "msl-protocol",
  "parts",
  "permissions",
  "jobs",
  "scheduler",
  "resolve",
  "updates",
  "network",
  "backup",
  "storage",
  "themes",
  "mail",
  "chat",
  "model-flow",
  "profiles",
  "shell-console",
  "scripts",
]);

const ALREADY_DONE = new Set(["notes", "world-maps"]);

function loginHtml(name, icon) {
  const title = String(name).replace(/"/g, "&quot;");
  const logo = icon || "📦";
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;"
    />
    <title>${title}: Sign in</title>
    <link rel="stylesheet" href="../shared/local-auth/login.css" />
  </head>
  <body>
    <div class="login-page">
      <div class="login-bg" aria-hidden="true"></div>
      <main class="login-card" id="login-card">
        <header class="login-head">
          <span class="login-logo" id="login-icon" aria-hidden="true">${logo}</span>
          <h1 id="login-title">${title}</h1>
          <p class="login-sub" id="login-sub">Sign in to continue</p>
        </header>
        <div class="login-welcome hidden" id="login-welcome">
          <p class="login-welcome-text">Welcome back, <strong id="welcome-user"></strong></p>
          <button type="button" class="login-submit" id="btn-continue">Continue</button>
          <button type="button" class="login-link login-switch-account" id="btn-switch">Sign in as someone else</button>
        </div>
        <div id="login-auth-panel">
          <div class="login-tabs" id="login-tabs">
            <button type="button" class="login-tab active" id="tab-signin">Sign in</button>
            <button type="button" class="login-tab" id="tab-register">Create account</button>
          </div>
          <p class="login-first-note hidden" id="login-first-note">No accounts on this PC yet. Create the first account below.</p>
          <form class="login-form" id="login-form" autocomplete="on">
            <label class="login-label" for="login-username">Username</label>
            <input type="text" id="login-username" class="login-input" autocomplete="username" autocapitalize="off" spellcheck="false" required minlength="3" maxlength="32" pattern="[a-zA-Z0-9_]+" />
            <label class="login-label" for="login-password">Password</label>
            <input type="password" id="login-password" class="login-input" autocomplete="current-password" required minlength="6" />
            <label class="login-label hidden" for="login-password2" id="label-password2">Confirm password</label>
            <input type="password" id="login-password2" class="login-input hidden" autocomplete="new-password" minlength="6" />
            <label class="login-check" id="remember-wrap">
              <input type="checkbox" id="login-remember" checked />
              <span>Keep me signed in</span>
            </label>
            <p class="login-error hidden" id="login-error" role="alert"></p>
            <button type="submit" class="login-submit" id="login-submit">Sign in</button>
          </form>
          <p class="login-switch" id="login-switch">
            <span id="switch-text">No account?</span>
            <button type="button" class="login-link" id="switch-mode">Create one</button>
          </p>
          <footer class="login-foot">
            <span class="login-foot-note">Accounts are local to this app · Session stays on this PC</span>
          </footer>
        </div>
      </main>
    </div>
    <script src="../shared/local-auth/login.js"></script>
  </body>
</html>
`;
}

function patchPreload(preloadPath, moduleId) {
  if (!fs.existsSync(preloadPath)) return false;
  let src = fs.readFileSync(preloadPath, "utf8");
  if (src.includes("attachLocalAuthBridge") || src.includes('exposeInMainWorld("appAuth"')) {
    return false;
  }
  const block = `
try {
  const { attachLocalAuthBridge } = require("../shared/local-auth/preload-bridge");
  attachLocalAuthBridge(contextBridge, ipcRenderer, ${JSON.stringify(moduleId)});
} catch (err) {
  console.error("[${moduleId} preload] Local auth bridge failed:", err);
}
`;
  fs.writeFileSync(preloadPath, src.trimEnd() + block, "utf8");
  return true;
}

function main() {
  const cfg = JSON.parse(fs.readFileSync(APPS_JSON, "utf8"));
  const targets = cfg.apps.filter(
    (a) =>
      a.type === "myapp" &&
      !a.hidden &&
      !SERVICE_IDS.has(a.id) &&
      !ALREADY_DONE.has(a.id)
  );

  let loginCount = 0;
  let manifestCount = 0;
  let preloadCount = 0;

  for (const app of targets) {
    const id = app.module || app.id;
    const appDir = path.join(ROOT, "apps", id);
    if (!fs.existsSync(appDir)) {
      console.warn("skip (no dir):", id);
      continue;
    }

    const loginPath = path.join(appDir, "login.html");
    fs.writeFileSync(loginPath, loginHtml(app.name, app.icon), "utf8");
    loginCount += 1;

    const manifestPath = path.join(appDir, "manifest.json");
    let manifest = {};
    if (fs.existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      } catch {
        manifest = { id };
      }
    } else {
      manifest = { id, name: app.name, version: "1.0.0", description: app.description || "" };
    }
    manifest.id = manifest.id || id;
    manifest.name = manifest.name || app.name;
    manifest.icon = manifest.icon || app.icon || "📦";
    manifest.description = manifest.description || app.description || "";
    manifest.auth = {
      type: "local",
      entry: "login.html",
      appEntry: manifest.auth?.appEntry || "index.html",
      sharedAccounts: false,
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
    manifestCount += 1;

    if (patchPreload(path.join(appDir, "preload.js"), id)) preloadCount += 1;
    console.log("ok:", id);
  }

  console.log(`Done: ${loginCount} login.html, ${manifestCount} manifests, ${preloadCount} preloads patched`);
}

main();