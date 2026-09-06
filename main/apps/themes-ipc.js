const fs = require("fs");
const path = require("path");
const { loadJsonFile, saveJsonFile } = require("./safe-json-store");
const { userDataDir } = require("./backup-ipc");

const LIVE_THEME_APPLY = true;

const STATE_FILE = "themes-state.json";
const ROOT = path.join(__dirname, "..", "..");

const MODES = [
  { id: "dark", label: "Dark", hint: "Dark chrome" },
  { id: "light", label: "Light", hint: "Bright chrome" },
];

const BUTTONS = [
  { id: "default", label: "Default", hint: "Current buttons" },
  { id: "soft", label: "Soft", hint: "Muted fills" },
  { id: "solid", label: "Solid", hint: "Strong primary" },
  { id: "outline", label: "Outline", hint: "Border-first" },
];

const SERVICE_MARKS = {
  mail: "atom-green", 
  scripts: "atom-cyan",
  "shell-console": "atom-cyan",
  pulse: "atom-violet",
  parts: "atom-violet",
  "msl-protocol": "atom-violet",
  resolve: "atom-violet",
  chat: "atom-rose", 
  "model-flow": "atom-rose",
  files: "atom-white",
  jobs: "atom-white",
  permissions: "atom-white",
  updates: "atom-white",
  network: "atom-white",
  backup: "atom-white",
  storage: "atom-white",
  themes: "atom-white",
  "apps-info": "atom-white",
};

function entry(id, name, icon, extras = {}) {
  const defaultMode = extras.defaultMode || "dark";
  return {
    id,
    name,
    module: id,
    icon,
    defaultMode,
    defaultButtons: "default",
    modes: MODES.map((m) =>
      m.id === defaultMode ? { ...m, hint: "Current default" } : m
    ),
    buttons: BUTTONS,
    ...extras,
  };
}

function loadAppsIndex() {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(ROOT, "config", "apps.json"), "utf8"));
    const map = Object.create(null);
    for (const a of raw.apps || []) {
      if (a?.id) map[a.id] = a;
      if (a?.module) map[a.module] = a;
    }
    return map;
  } catch {
    return Object.create(null);
  }
}

function fileExists(rel) {
  try {
    return fs.existsSync(path.join(ROOT, rel.replace(/\//g, path.sep)));
  } catch {
    return false;
  }
}

function resolveIconPath(appId, appsIndex) {
  const mark = SERVICE_MARKS[appId];
  if (mark) {
    const brand = `src/brand/${mark}.png`;
    if (fileExists(brand)) return brand;
  }
  const fromApps = appsIndex[appId];
  if (fromApps?.iconPath) {
    const p = String(fromApps.iconPath).replace(/\\/g, "/").replace(/^\//, "");
    if (fileExists(p)) return p;
  }
  for (const ext of ["png", "svg", "webp"]) {
    const candidate = `apps/${appId}/logo.${ext}`;
    if (fileExists(candidate)) return candidate;
  }
  return null;
}

function enrichDef(def, appsIndex) {
  const iconPath = resolveIconPath(def.id, appsIndex);
  return {
    ...def,
    iconPath: iconPath || def.iconPath || null,
    mark: SERVICE_MARKS[def.id] || def.mark || null,
  };
}

const THEME_CATALOG = {
  studies: entry("studies", "Studies", "📚"),
  "world-clock": entry("world-clock", "Clock", "🕐"),
  notes: entry("notes", "Notes", "📝"),
  tasks: entry("tasks", "Tasks", "✅"),
  contacts: entry("contacts", "Contacts", "👤"),
  translate: entry("translate", "Translate", "🌐"),
  coupons: entry("coupons", "Coupons", "🏷️"),
  profiles: entry("profiles", "Vault", "🔐"),
  history: entry("history", "History", "📜"),
  geography: entry("geography", "Geography", "🌍"),
  builds: entry("builds", "Builds", "🧱"),
  stocks: entry("stocks", "Stocks", "📈"),
  contracts: entry("contracts", "Digital Contracts", "📄"),
  space: entry("space", "Space", "🚀"),
  "code-lexicon": entry("code-lexicon", "Code Lexicon", "⌨️"),
  drift: entry("drift", "Drift", "🌊"),
  "remote-hub": entry("remote-hub", "Remote Hub", "🖥️"),
  "icon-library": entry("icon-library", "Icon Library", "🎨"),
  "study-deck": entry("study-deck", "Study Deck", "🃏"),
  "pi-digits": entry("pi-digits", "Pi Digits", "π"),
  "day-planner": entry("day-planner", "Today", "📅"),
  docs: entry("docs", "Docs", "📖"),
  "flag-quiz": entry("flag-quiz", "Learning Games", "🎮"),
  scripts: entry("scripts", "Scripts", "📜"),
  chat: entry("chat", "Mind", "💬"),
  "os-bridge": entry("os-bridge", "OS Bridge", "🔗"),
  "system-info": entry("system-info", "System Info", "📊"),
  themes: entry("themes", "Themes", "🎨"),
  "model-flow": entry("model-flow", "Model Flow", "✦"),
  "shell-console": entry("shell-console", "Console", "⌨️"),
  files: entry("files", "Files", "📁", { defaultMode: "light" }),
  pulse: entry("pulse", "Pulse", "⬡", { defaultMode: "light" }),
  mail: entry("mail", "Connect", "✉️", { defaultMode: "light" }),
  jobs: entry("jobs", "Jobs", "⚙️", { defaultMode: "light" }),
  resolve: entry("resolve", "Resolve", "🔧", { defaultMode: "light" }),
  updates: entry("updates", "Updates", "↑", { defaultMode: "light" }),
  network: entry("network", "Network", "🌐", { defaultMode: "light" }),
  backup: entry("backup", "Backup", "💾", { defaultMode: "light" }),
  storage: entry("storage", "Storage", "📀", { defaultMode: "light" }),
  permissions: entry("permissions", "Permissions", "🛡️", { defaultMode: "light" }),
  parts: entry("parts", "Parts", "🧩", { defaultMode: "light" }),
  "msl-protocol": entry("msl-protocol", "MSL", "⬡", { defaultMode: "light" }),
  "apps-info": entry("apps-info", "Info", "ℹ️", { defaultMode: "light" }),
};

function statePath() {
  const { profileScopedPath } = require("../myspace-profile");
  const identity = require("../myspace-identity");
  void identity.tryRestoreSession();
  return profileScopedPath(STATE_FILE);
}

function emptyState() {
  return { version: 1, apps: {} };
}

function loadState() {
  const loaded = loadJsonFile(statePath(), { fallback: emptyState() });
  if (!loaded.ok || !loaded.data || typeof loaded.data !== "object") return emptyState();
  return {
    version: 1,
    apps: loaded.data.apps && typeof loaded.data.apps === "object" ? loaded.data.apps : {},
  };
}

function saveState(data) {
  return saveJsonFile(statePath(), data, { allowEmpty: true });
}

function normalizeTheme(appId, raw) {
  const def = THEME_CATALOG[appId];
  if (!def) return null;
  const modeIds = new Set(def.modes.map((m) => m.id));
  const buttonIds = new Set(def.buttons.map((b) => b.id));
  const mode = modeIds.has(raw?.mode) ? raw.mode : def.defaultMode;
  const buttons = buttonIds.has(raw?.buttons) ? raw.buttons : def.defaultButtons;
  return {
    appId,
    mode,
    buttons,
    isDefault: mode === def.defaultMode && buttons === def.defaultButtons,
  };
}

function getTheme(appId) {
  const id = String(appId || "").trim();
  if (!THEME_CATALOG[id]) return { ok: false, error: `No theme support for ${id}` };
  const state = loadState();
  const theme = normalizeTheme(id, state.apps[id] || {});
  const appsIndex = loadAppsIndex();
  return { ok: true, theme, catalog: enrichDef(THEME_CATALOG[id], appsIndex) };
}

function appHtmlPath(appId) {
  return path.join(ROOT, "apps", appId, "index.html");
}

function patchAppHtmlTheme(appId, theme) {
  const file = appHtmlPath(appId);
  if (!fs.existsSync(file)) return { ok: false, reason: "no html" };
  const mode = theme?.mode || "dark";
  const buttons = theme?.buttons || "default";
  let html = fs.readFileSync(file, "utf8");
  const next = html.replace(/<html([^>]*)>/i, (_m, attrs) => {
    let a = attrs || "";
    if (/data-theme=/.test(a)) a = a.replace(/data-theme="[^"]*"/, `data-theme="${mode}"`);
    else a += ` data-theme="${mode}"`;
    if (/data-buttons=/.test(a)) a = a.replace(/data-buttons="[^"]*"/, `data-buttons="${buttons}"`);
    else a += ` data-buttons="${buttons}"`;
    if (mode === "light") {
      if (/\bclass="[^"]*"/.test(a)) {
        a = a.replace(/\bclass="([^"]*)"/, (_cm, cls) => {
          const parts = cls.split(/\s+/).filter(Boolean).filter((c) => c !== "theme-light");
          parts.push("theme-light");
          return `class="${parts.join(" ")}"`;
        });
      } else {
        a += ` class="theme-light"`;
      }
    } else {
      a = a.replace(/\bclass="([^"]*)"/, (_cm, cls) => {
        const parts = cls.split(/\s+/).filter(Boolean).filter((c) => c !== "theme-light");
        return parts.length ? `class="${parts.join(" ")}"` : "";
      });
    }
    return `<html${a}>`;
  });
  if (next !== html) fs.writeFileSync(file, next);
  return { ok: true };
}

function urlBelongsToApp(url, appId) {
  const u = String(url || "");
  if (!u || !appId) return false;
  const id = String(appId);
  const patterns = [
    `/apps/${id}/`,
    `\\apps\\${id}\\`,
    `/apps/${id}?`,
    `/apps/${id}#`,
    `apps%2F${id}%2F`,
    `apps/${id}/index`,
  ];
  return patterns.some((p) => u.includes(p));
}

function broadcastTheme(appId, theme) {
  const id = String(appId || "").trim();
  if (!id || !theme) return;

  try {
    patchAppHtmlTheme(id, theme);
  } catch {
  }

  if (!LIVE_THEME_APPLY) return;

  let webContents;
  try {
    ({ webContents } = require("electron"));
  } catch {
    return;
  }
  if (!webContents?.getAllWebContents) return;

  const mode = theme.mode || "dark";
  const buttons = theme.buttons || "default";
  const applyScript = `(() => {
    try {
      const root = document.documentElement;
      if (!root || !root.hasAttribute("data-theme-base")) return false;
      root.setAttribute("data-theme", ${JSON.stringify(mode)});
      root.setAttribute("data-buttons", ${JSON.stringify(buttons)});
      root.classList.toggle("theme-light", ${JSON.stringify(mode)} === "light");
      return true;
    } catch (e) {
      return false;
    }
  })()`;

  for (const wc of webContents.getAllWebContents()) {
    try {
      if (wc.isDestroyed()) continue;
      let url = "";
      try {
        url = wc.getURL();
      } catch {
        continue;
      }
      if (!urlBelongsToApp(url, id)) continue;
      Promise.resolve(wc.executeJavaScript(applyScript, true)).catch(() => {});
    } catch {
    }
  }
}

function setTheme(args = {}) {
  const id = String(args.appId || args.id || "").trim();
  const def = THEME_CATALOG[id];
  if (!def) return { ok: false, error: `No theme support for ${id}` };

  const state = loadState();
  const next = normalizeTheme(id, {
    mode: args.mode ?? state.apps[id]?.mode,
    buttons: args.buttons ?? state.apps[id]?.buttons,
  });

  if (next.isDefault) {
    delete state.apps[id];
  } else {
    state.apps[id] = { mode: next.mode, buttons: next.buttons };
  }
  const saved = saveState(state);
  if (!saved.ok) return { ok: false, error: saved.error || "Could not save theme" };

  broadcastTheme(id, next);
  return { ok: true, theme: next, catalog: enrichDef(def, loadAppsIndex()) };
}

function resetTheme(args = {}) {
  const id = String(args.appId || args.id || "").trim();
  if (!THEME_CATALOG[id]) return { ok: false, error: `No theme support for ${id}` };
  const state = loadState();
  delete state.apps[id];
  const saved = saveState(state);
  if (!saved.ok) return { ok: false, error: saved.error || "Could not reset" };
  const theme = normalizeTheme(id, {});
  broadcastTheme(id, theme);
  return { ok: true, theme, catalog: enrichDef(THEME_CATALOG[id], loadAppsIndex()) };
}

function listCatalog() {
  const state = loadState();
  const appsIndex = loadAppsIndex();
  const apps = Object.values(THEME_CATALOG).map((def) => {
    const theme = normalizeTheme(def.id, state.apps[def.id] || {});
    return {
      ...enrichDef(def, appsIndex),
      theme,
    };
  });
  return {
    ok: true,
    apps,
    count: apps.length,
    supported: Object.keys(THEME_CATALOG),
  };
}

async function handleThemesInvoke(channel, args = {}) {
  const ch = String(channel || "").trim().toLowerCase();
  if (ch === "catalog" || ch === "list") return listCatalog();
  if (ch === "get") return getTheme(args.appId || args.id || args.module);
  if (ch === "set") return setTheme(args);
  if (ch === "reset") return resetTheme(args);
  if (ch === "meta") {
    return {
      ok: true,
      name: "Themes",
      version: "1.4.0",
      liveApply: LIVE_THEME_APPLY,
      applyPath: "css-attrs",
      preloadHooks: false,
      supported: Object.keys(THEME_CATALOG),
      count: Object.keys(THEME_CATALOG).length,
    };
  }
  return { ok: false, error: `Unknown themes channel: ${ch}` };
}

module.exports = {
  handleThemesInvoke,
  THEME_CATALOG,
  getTheme,
  setTheme,
  LIVE_THEME_APPLY,
};