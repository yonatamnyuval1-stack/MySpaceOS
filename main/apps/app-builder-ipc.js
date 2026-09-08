const path = require("path");
const fs = require("fs");
const { app, dialog, BrowserWindow } = require("electron");
const { execFile } = require("child_process");
const { promisify } = require("util");
const jobsStore = require("../jobs/store");
const { ensureWorkspaceRoot, resolveWorkspacePath } = require("./files-ipc");
const { userAppsRoot, userAppDir, isUserAppModule } = require("./user-app-ipc");

const execFileAsync = promisify(execFile);

const REGISTRY_FILE = () => {
  const profile = require("../myspace-profile");
  return profile.profileScopedPath("user-apps-registry.json");
};
const ID_RE = /^[a-z][a-z0-9-]{1,31}$/;

function assertAppBuildAllowed() {
  const state = jobsStore.load();
  const cap = jobsStore.normalizeCapacity(state?.capacity);
  if (cap.allowAppBuild === false) {
    return {
      ok: false,
      error: "App build blocked: enable in Permissions → Jobs → Allow app scaffold & build",
    };
  }
  return { ok: true };
}

function readRegistry() {
  try {
    if (fs.existsSync(REGISTRY_FILE())) {
      return JSON.parse(fs.readFileSync(REGISTRY_FILE(), "utf8"));
    }
  } catch {
  }
  return { apps: [], updatedAt: null };
}

function writeRegistry(data) {
  fs.mkdirSync(path.dirname(REGISTRY_FILE()), { recursive: true });
  const next = {
    apps: Array.isArray(data?.apps) ? data.apps : [],
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(REGISTRY_FILE(), JSON.stringify(next, null, 2), "utf8");
  return next;
}

function getUserConfigPath() {
  const profile = require("../myspace-profile");
  const identity = require("../myspace-identity");
  if (identity.getCurrentUser()?.id) {
    return profile.profileScopedPath("user-config.json");
  }
  if (app.isPackaged) {
    return path.join(app.getPath("userData"), "user-config.json");
  }
  return path.join(__dirname, "..", "..", "config", "user-config.json");
}

function readUserConfig() {
  const p = getUserConfigPath();
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
  }
  return { apps: [], removedAppIds: [], positions: {} };
}

function writeUserConfig(cfg) {
  const p = getUserConfigPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(cfg, null, 2), "utf8");
}

function normalizeId(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function validateId(id) {
  if (!id || !ID_RE.test(id)) {
    return {
      ok: false,
      error: "App id must be lowercase letters, numbers, hyphens: start with a letter (2–32 chars)",
    };
  }
  const reserved = new Set([
    "host",
    "files",
    "jobs",
    "shell",
    "scripts",
    "platform",
    "system",
    "welcome",
    "docs",
  ]);
  if (reserved.has(id)) return { ok: false, error: `Reserved app id: ${id}` };
  return { ok: true, id };
}

function templateFiles(id, name, template, icon) {
  const display = String(name || id).slice(0, 60);
  const emoji = String(icon || "📦").slice(0, 4);

  const manifest = {
    id,
    name: display,
    version: "0.1.0",
    description: `User-built app — ${display}`,
    userBuilt: true,
  };

  const pulse = {
    profile: { tagline: display, icon: emoji, color: "#7dd3fc" },
    commands: [
      { verb: "open", title: `Open ${display}`, delivery: "ui", input: { page: "string?" } },
      { verb: "list", title: "List items", delivery: "ipc", channel: "items.list" },
      { verb: "add", title: "Add item", delivery: "ipc", channel: "items.add", input: { title: "string", body: "string?" } },
    ],
    events: [],
  };

  const preload = `const { contextBridge, ipcRenderer } = require("electron");
const MODULE_ID = ${JSON.stringify(id)};
contextBridge.exposeInMainWorld("myApp", {
  moduleId: MODULE_ID,
  invoke: (channel, args) =>
    ipcRenderer.invoke("myapp-invoke", MODULE_ID, channel, args || {}),
});
`;

  const indexHtml = `<!DOCTYPE html>
<html lang="en" data-theme="dark" data-theme-base="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${display}</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <span class="brand-icon">${emoji}</span>
          <div>
            <strong>${display}</strong>
            <span class="brand-sub">User app · v0.1</span>
          </div>
        </div>
        <footer class="sidebar-foot">
          <p>Built with My Space Language</p>
        </footer>
      </aside>
      <main class="main">
        <header class="topbar">
          <h1>${display}</h1>
          <p class="subtitle">Your app shell: extend app.js and tools/${id}/</p>
        </header>
        <section class="panel">
          <div class="toolbar">
            <button type="button" class="btn primary" id="btn-add">+ Add item</button>
          </div>
          <p class="hint">Host tool: run from Shell: host(run node file:tools/${id}/main.js)</p>
        </section>
      </main>
    </div>
    <script src="app.js"></script>
  </body>
</html>
`;

  const styles = `:root {
  --bg: #0a0e18;
  --panel: #121828;
  --text: #e8ecf8;
  --muted: #8892ad;
  --accent: #7dd3fc;
  --border: rgba(125, 211, 252, 0.15);
  --font: "Segoe UI", system-ui, sans-serif;
}
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; height: 100%; font-family: var(--font); color: var(--text); background: var(--bg); }
.app-shell { display: grid; grid-template-columns: 220px 1fr; height: 100vh; }
.sidebar { background: var(--panel); border-right: 1px solid var(--border); padding: 1rem; display: flex; flex-direction: column; }
.brand { display: flex; gap: 0.75rem; align-items: center; }
.brand-icon { font-size: 1.75rem; }
.brand-sub { display: block; color: var(--muted); font-size: 0.8rem; }
.sidebar-foot { margin-top: auto; color: var(--muted); font-size: 0.75rem; }
.main { padding: 1.25rem 1.5rem; overflow: auto; }
.topbar h1 { margin: 0 0 0.25rem; font-size: 1.35rem; }
.subtitle { margin: 0 0 1rem; color: var(--muted); }
.panel { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 1rem; }
.toolbar { display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap; }
.btn { border: 1px solid var(--border); background: transparent; color: var(--text); padding: 0.45rem 0.85rem; border-radius: 8px; cursor: pointer; }
.btn.primary { background: rgba(125, 211, 252, 0.15); border-color: var(--accent); }
.item-list { list-style: none; margin: 0; padding: 0; }
.item-list li { padding: 0.65rem 0; border-bottom: 1px solid var(--border); }
.item-list li strong { display: block; }
.item-list li span { color: var(--muted); font-size: 0.85rem; }
.hint { color: var(--muted); font-size: 0.85rem; margin-top: 1rem; white-space: pre-wrap; }
`;

  const appJs = `(() => {
  const api = () => window.myApp;
  const listEl = document.getElementById("item-list");

  async function invoke(ch, args) {
    if (!api()?.invoke) return { ok: false, error: "API unavailable" };
    return api().invoke(ch, args || {});
  }

  async function refresh() {
    const res = await invoke("items.list");
    const items = res?.items || [];
    if (!items.length) {
      listEl.innerHTML = "<li><span>No items yet: add one or extend this app.</span></li>";
      return;
    }
    listEl.innerHTML = items
      .map(
        (it) =>
          "<li><strong>" +
          escapeHtml(it.title) +
          "</strong><span>" +
          escapeHtml(it.body || "") +
          "</span></li>"
      )
      .join("");
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  document.getElementById("btn-add")?.addEventListener("click", async () => {
    await invoke("items.add", {
      title: "New item",
      body: "Created from ${display}",
    });
    refresh();
  });

  window.${toAppGlobal(id)} = { refresh };
  refresh();
})();
`;

  const hostMainJs =
    template === "full"
      ? `console.log("${display} host tool ready");
console.log("Args:", process.argv.slice(2).join(" ") || "(none)");
`
      : `console.log("Hello from ${display}");
`;

  return {
    manifest,
    pulse,
    preload,
    indexHtml,
    styles,
    appJs,
    hostMainJs,
  };
}

function toAppGlobal(id) {
  return `${id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())}App`;
}

async function scaffoldApp(args = {}) {
  const gate = assertAppBuildAllowed();
  if (!gate.ok) return gate;

  const id = normalizeId(args.id || args.name);
  const valid = validateId(id);
  if (!valid.ok) return valid;

  const name = String(args.name || id).trim().slice(0, 60);
  const template = String(args.template || "minimal").toLowerCase();
  const icon = String(args.icon || "📦").slice(0, 4);
  const register = args.register !== false;

  const repoAppDir = path.join(__dirname, "..", "..", "apps", id);
  if (fs.existsSync(repoAppDir)) {
    return { ok: false, error: `App id "${id}" already exists in built-in apps/` };
  }

  const dest = userAppDir(id);
  if (fs.existsSync(dest)) {
    return { ok: false, error: `User app "${id}" already exists. delete user-apps/${id} first` };
  }

  const files = templateFiles(id, name, template, icon);
  fs.mkdirSync(dest, { recursive: true });

  const writeMap = {
    "manifest.json": JSON.stringify(files.manifest, null, 2),
    "pulse.json": JSON.stringify(files.pulse, null, 2),
    "preload.js": files.preload,
    "index.html": files.indexHtml,
    "styles.css": files.styles,
    "app.js": files.appJs,
  };

  for (const [rel, content] of Object.entries(writeMap)) {
    fs.writeFileSync(path.join(dest, rel), content, "utf8");
  }

  const workspace = ensureWorkspaceRoot();
  const toolDir = path.join(workspace, "tools", id);
  fs.mkdirSync(toolDir, { recursive: true });
  fs.writeFileSync(path.join(toolDir, "main.js"), files.hostMainJs, "utf8");

  const entry = {
    id,
    name,
    type: "myapp",
    module: id,
    icon,
    description: files.manifest.description,
    userBuilt: true,
    scaffoldedAt: new Date().toISOString(),
    template,
    path: dest,
    workspaceTool: `tools/${id}/main.js`,
  };

  const reg = readRegistry();
  reg.apps = reg.apps.filter((a) => a.id !== id);
  reg.apps.push(entry);
  writeRegistry(reg);

  let registered = false;
  if (register) {
    const regRes = await registerApp({ id });
    registered = regRes.ok;
  }

  return {
    ok: true,
    app: entry,
    path: dest,
    workspaceTool: path.join(toolDir, "main.js"),
    registered,
    next: [
      `run ${id}`,
      `host(run node file:tools/${id}/main.js)`,
      `app(list)`,
      register ? null : `app(register ${id})`,
    ].filter(Boolean),
  };
}

async function registerApp(args = {}) {
  const gate = assertAppBuildAllowed();
  if (!gate.ok) return gate;

  const id = normalizeId(args.id);
  const valid = validateId(id);
  if (!valid.ok) return valid;

  if (!isUserAppModule(id)) {
    return { ok: false, error: `User app not found: ${id}. Run app(scaffold ${id}) first.` };
  }

  const reg = readRegistry();
  const meta = reg.apps.find((a) => a.id === id);
  const cfg = readUserConfig();
  cfg.apps = Array.isArray(cfg.apps) ? cfg.apps : [];
  cfg.removedAppIds = Array.isArray(cfg.removedAppIds)
    ? cfg.removedAppIds.filter((x) => x !== id)
    : [];

  const entry = {
    id,
    name: meta?.name || id,
    type: "myapp",
    module: id,
    icon: meta?.icon || "📦",
    description: meta?.description || `User-built app — ${id}`,
    userBuilt: true,
  };

  const idx = cfg.apps.findIndex((a) => a.id === id);
  if (idx >= 0) cfg.apps[idx] = { ...cfg.apps[idx], ...entry };
  else cfg.apps.push(entry);

  writeUserConfig(cfg);

  return { ok: true, app: entry, configPath: getUserConfigPath() };
}

function listApps() {
  const reg = readRegistry();
  const apps = (reg.apps || []).map((a) => ({
    ...a,
    installed: isUserAppModule(a.id),
    registered: readUserConfig().apps?.some((x) => x.id === a.id) || false,
  }));
  return { ok: true, apps, count: apps.length };
}

async function compressFolderToZip(folder, zipPath) {
  fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  if (process.platform === "win32") {
    const ps = path.join(
      process.env.WINDIR || "C:\\Windows",
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe"
    );
    const src = folder.replace(/'/g, "''");
    const dst = zipPath.replace(/'/g, "''");
    await execFileAsync(
      ps,
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `Compress-Archive -Path '${src}\\*' -DestinationPath '${dst}' -Force`,
      ],
      { windowsHide: true, timeout: 120000 }
    );
  } else {
    await execFileAsync("zip", ["-r", zipPath, "."], { cwd: folder, timeout: 120000 });
  }
}

async function buildAppPack(args = {}) {
  const gate = assertAppBuildAllowed();
  if (!gate.ok) return gate;

  const id = normalizeId(args.id || args.app);
  const valid = validateId(id);
  if (!valid.ok) return valid;

  if (!isUserAppModule(id)) {
    return { ok: false, error: `User app not found: ${id}` };
  }

  const srcDir = userAppDir(id);
  const profile = require("../myspace-profile");
  const exportsDir = profile.profileScopedPath("exports");
  fs.mkdirSync(exportsDir, { recursive: true });
  const zipPath = path.join(exportsDir, `${id}.myapp.zip`);

  const staging = path.join(exportsDir, `.staging-${id}-${Date.now()}`);
  fs.mkdirSync(staging, { recursive: true });

  try {
    await fs.promises.cp(srcDir, path.join(staging, id), { recursive: true });
    const reg = readRegistry();
    const meta = reg.apps.find((a) => a.id === id) || { id, name: id };
    fs.writeFileSync(
      path.join(staging, "package.json"),
      JSON.stringify(
        {
          format: "myspace.myapp",
          version: 1,
          id,
          name: meta.name,
          exportedAt: new Date().toISOString(),
        },
        null,
        2
      ),
      "utf8"
    );

    const toolResolved = resolveWorkspacePath(`tools/${id}`);
    if (toolResolved.ok && fs.existsSync(toolResolved.path)) {
      await fs.promises.cp(toolResolved.path, path.join(staging, "tools", id), { recursive: true });
    }

    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    await compressFolderToZip(staging, zipPath);
  } finally {
    try {
      await fs.promises.rm(staging, { recursive: true, force: true });
    } catch {
    }
  }

  const st = await fs.promises.stat(zipPath);
  return {
    ok: true,
    id,
    path: zipPath,
    bytes: st.size,
    message: `Packed ${id}.myapp.zip (${st.size} bytes)`,
  };
}

function getParentWindow() {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && !focused.isDestroyed()) return focused;
  return BrowserWindow.getAllWindows().find((w) => !w.isDestroyed()) || null;
}

async function handleAppBuilderInvoke(channel, args = {}) {
  const ch = String(channel || "").trim();

  switch (ch) {
    case "app.scaffold":
    case "scaffold":
      return scaffoldApp(args);

    case "app.register":
    case "register":
      return registerApp(args);

    case "app.list":
    case "list":
      return listApps();

    case "app.status":
    case "status":
      return {
        ok: true,
        userAppsRoot: userAppsRoot(),
        registry: readRegistry(),
        count: readRegistry().apps?.length || 0,
      };

    case "app.pack.build":
    case "pack.build":
    case "build":
      return buildAppPack(args);

    case "app.pack.pick":
    case "pack.pick": {
      const picked = await dialog.showOpenDialog(getParentWindow() || undefined, {
        title: "Choose .myapp.zip",
        filters: [{ name: "My Space App", extensions: ["zip"] }],
        properties: ["openFile"],
      });
      if (picked.canceled || !picked.filePaths?.[0]) return { ok: false, error: "Cancelled" };
      return { ok: true, path: picked.filePaths[0] };
    }

    default:
      return { ok: false, error: `Unknown app-builder channel: ${ch}` };
  }
}

module.exports = {
  handleAppBuilderInvoke,
  scaffoldApp,
  registerApp,
  buildAppPack,
  readRegistry,
  assertAppBuildAllowed,
};