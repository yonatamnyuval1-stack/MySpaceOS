const path = require("path");
const fs = require("fs");

const APPS_JSON = path.join(__dirname, "..", "..", "config", "apps.json");

const COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e",
  "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e", "#10b981",
  "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6", "#64748b",
];

const SHELL_REF = {
  welcome: "welcome",
  "system-info": "system-info",
  "world-clock": "clock",
  "remote-hub": "remote-hub",
  studies: "studies",
  "study-deck": "study-deck",
  "day-planner": "day-planner",
  profiles: "profiles",
  stocks: "stocks",
  translate: "translate",
  contacts: "contacts",
  geography: "geography",
  "flag-quiz": "flags",
  history: "history",
  space: "space",
  contracts: "contracts",
  builds: "builds",
  "code-lexicon": "code lexicon",
  drift: "drift",
  "shell-console": "console",
  edge: "edge",
  docker: "docker",
  vscode: "vscode",
  terminal: "terminal",
  cursor: "cursor",
  github: "github",
};

function item(rel, type = "file") {
  const clean = rel.replace(/\\/g, "/");
  const name = clean.split("/").pop() || clean;
  return { path: clean, name, type };
}

function fileExists(root, rel) {
  try {
    return fs.existsSync(path.join(root, ...rel.replace(/\\/g, "/").split("/")));
  } catch {
    return false;
  }
}

function itemsForMyApp(root, moduleId) {
  const items = [];
  const appDir = `apps/${moduleId}`;
  if (fileExists(root, appDir)) {
    items.push(item(appDir, "dir"));
  }
  const ipcRel = `main/apps/${moduleId}-ipc.js`;
  if (fileExists(root, ipcRel)) items.push(item(ipcRel));
  return items;
}

function itemsForApp(root, app) {
  if (app.type === "myapp" && app.module) {
    return itemsForMyApp(root, app.module);
  }
  if (app.type === "builtin" && app.id === "welcome") {
    const items = [item("src/index.html"), item("src/renderer.js"), item("config/apps.json")];
    return items.filter((i) => fileExists(root, i.path));
  }
  if (app.type === "external" || app.type === "url") {
    const items = [item("config/apps.json"), item("main/launch.js"), item("main.js")];
    return items.filter((i) => fileExists(root, i.path));
  }
  return [item("config/apps.json")];
}

function shellRefForApp(app) {
  return SHELL_REF[app.id] || app.id || app.name;
}

function runCommandForApp(app) {
  const ref = shellRefForApp(app);
  const arg = ref.includes(" ") ? `"${ref}"` : ref;
  return `.\\node_modules\\.bin\\electron.cmd . --run ${arg}`;
}

function loadAppsConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(APPS_JSON, "utf8"));
    return Array.isArray(raw.apps) ? raw.apps : [];
  } catch {
    return [];
  }
}

function buildWorldMapsOsSubCategory(rootPath) {
  const root = rootPath || path.join(__dirname, "..", "..");
  const prefix = "world-maps";
  if (!fileExists(root, prefix)) return null;

  const files = [
    "app.js",
    "main.js",
    "preload.js",
    "auth.js",
    "index.html",
    "login.html",
    "login.js",
    "login.css",
    "settings-ui.js",
    "i18n.js",
    "countries-data.js",
    "styles.css",
    "package.json",
    "open.bat",
    "build-installer.bat",
    "install-world-maps.bat",
    "add-world-maps-to-windows.bat",
    "INSTALL.txt",
  ];

  const items = [item(prefix, "dir")];
  for (const f of files) {
    if (fileExists(root, `${prefix}/${f}`)) items.push(item(`${prefix}/${f}`));
  }
  if (fileExists(root, `${prefix}/assets`)) items.push(item(`${prefix}/assets`, "dir"));
  if (fileExists(root, `${prefix}/build`)) items.push(item(`${prefix}/build`, "dir"));

  return {
    id: "subcat_app_world_maps",
    name: "World Maps",
    icon: "🌍",
    color: "#5b9cf5",
    runCwd: "",
    runCommand: "cd world-maps && ..\\node_modules\\.bin\\electron.cmd .",
    items,
  };
}

function buildOperatingSystemSubCategories(rootPath) {
  const root = rootPath || path.join(__dirname, "..", "..");
  const apps = loadAppsConfig();

  const subs = apps.map((app, index) => {
    const name = String(app.name || app.id || "App").trim();
    const id = `subcat_app_${String(app.id || name).replace(/[^a-z0-9_-]+/gi, "_").toLowerCase()}`;
    return {
      id,
      name,
      icon: String(app.icon || "📱").trim() || "📱",
      color: COLORS[index % COLORS.length],
      runCwd: "",
      runCommand: runCommandForApp(app),
      items: itemsForApp(root, app),
    };
  });

  const wm = buildWorldMapsOsSubCategory(root);
  if (wm?.items?.length) subs.push(wm);
  return subs;
}

function seedOperatingSystemProject(rootPath) {
  const root = rootPath || path.join(__dirname, "..", "..");
  const subs = buildOperatingSystemSubCategories(root);
  return {
    id: "proj_operating_system",
    name: "Operating System",
    categoryId: "desktop",
    icon: "🖧",
    color: "#6366f1",
    description:
      "One sub-category per My Space app — linked source code and a command that launches that app only.",
    stack: ["Electron", "Node.js", "My Space apps"],
    rootPath: root,
    tags: ["os", "apps", "my-space"],
    notes:
      "Copy command → paste in VS Code terminal. Each line starts with cd to project root, then electron --run <app> opens only that app.",
    subCategories: subs,
    builtAt: new Date().toISOString().slice(0, 10),
    favorite: true,
    watchFolder: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function worldMapsRoot(repoRoot) {
  return path.join(repoRoot || path.join(__dirname, "..", ".."), "world-maps");
}

function itemsForWorldMaps(root) {
  const wm = worldMapsRoot(root);
  const rel = (name) => {
    const abs = path.join(wm, name);
    if (!fs.existsSync(abs)) return null;
    return item(name, fs.statSync(abs).isDirectory() ? "dir" : "file");
  };
  return [
    rel("app.js"),
    rel("main.js"),
    rel("preload.js"),
    rel("auth.js"),
    rel("index.html"),
    rel("login.html"),
    rel("login.js"),
    rel("login.css"),
    rel("settings-ui.js"),
    rel("i18n.js"),
    rel("countries-data.js"),
    rel("styles.css"),
    rel("package.json"),
    rel("open.bat"),
    rel("build-installer.bat"),
    rel("install-world-maps.bat"),
    rel("add-world-maps-to-windows.bat"),
    rel("INSTALL.txt"),
    rel("assets"),
    rel("build"),
  ].filter(Boolean);
}

function seedWorldMapsProject(repoRoot) {
  const root = worldMapsRoot(repoRoot);
  const electronRun = "..\\node_modules\\.bin\\electron.cmd .";
  const allItems = itemsForWorldMaps(repoRoot);

  const pick = (...names) => allItems.filter((i) => names.includes(i.path));

  const subs = [
    {
      id: "subcat_wm_launch",
      name: "Launch",
      icon: "▶",
      color: "#5b9cf5",
      runCommand: electronRun,
      runCwd: "",
      items: pick("open.bat", "package.json", "main.js"),
    },
    {
      id: "subcat_wm_map",
      name: "Map & UI",
      icon: "🗺️",
      color: "#22c55e",
      runCommand: electronRun,
      runCwd: "",
      items: pick("app.js", "index.html", "styles.css", "countries-data.js"),
    },
    {
      id: "subcat_wm_auth",
      name: "Auth & login",
      icon: "🔐",
      color: "#f59e0b",
      runCommand: electronRun,
      runCwd: "",
      items: pick("auth.js", "login.html", "login.js", "login.css", "preload.js"),
    },
    {
      id: "subcat_wm_settings",
      name: "Settings & i18n",
      icon: "⚙",
      color: "#8b5cf6",
      runCommand: electronRun,
      runCwd: "",
      items: pick("settings-ui.js", "i18n.js", "assets"),
    },
    {
      id: "subcat_wm_dist",
      name: "Installer",
      icon: "📦",
      color: "#06b6d4",
      runCommand: "build-installer.bat",
      runCwd: "",
      items: pick("build-installer.bat", "install-world-maps.bat", "INSTALL.txt", "package.json", "build"),
    },
  ];

  return {
    id: "proj_world_maps",
    name: "World Maps",
    categoryId: "desktop",
    icon: "🌍",
    color: "#5b9cf5",
    description:
      "Standalone world map app — OpenStreetMap, map notes, per-user login, Windows installer for distribution.",
    stack: ["Electron", "MapLibre", "OpenStreetMap", "NSIS"],
    rootPath: root,
    repoUrl: "",
    demoUrl: "",
    tags: ["world-maps", "standalone", "electron", "installer", "maps"],
    notes:
      "Separate from My Space shell. Launch → run dev build. Installer → build-installer.bat copies Setup exe to Downloads.",
    links: [
      { id: "lnk_wm_folder", label: "Source folder", url: `file:///${root.replace(/\\/g, "/")}` },
    ],
    fields: [
      { id: "fld_wm_version", key: "Version", value: "1.0.6" },
      { id: "fld_wm_dist", key: "Installer", value: "WorldMapsSetup-1.0.6.exe" },
    ],
    subCategories: subs,
    builtAt: new Date().toISOString().slice(0, 10),
    favorite: true,
    watchFolder: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

module.exports = {
  buildOperatingSystemSubCategories,
  buildWorldMapsOsSubCategory,
  seedOperatingSystemProject,
  seedWorldMapsProject,
};