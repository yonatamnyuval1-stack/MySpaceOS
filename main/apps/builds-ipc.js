const path = require("path");
const fs = require("fs");
const { app, shell, clipboard, dialog } = require("electron");
const { formatBytes } = require("./exec-utils");
const { seedOperatingSystemProject, buildOperatingSystemSubCategories, seedWorldMapsProject } = require("./builds-os-seed");
const { reportRuntimeFailure } = require("../resolve/report-helper");

const {
  setupLocalAuthApp,
  requireSignedIn,
  userStorageRoot,
  registerLegacyMigrator,
  registerSingleFileMigrator,
} = require("./local-auth-app-helper");

const APP_ID = "builds";
const auth = setupLocalAuthApp(APP_ID);
registerSingleFileMigrator(APP_ID, "builds.json");

const DATA_FILE = () => auth.userDataPath("data.json");

function signedInGuard() {
  return requireSignedIn(auth);
}


function dataPath() {
  return DATA_FILE();
}

function backupPath() {
  return auth.userDataPath("data.json.bak");
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function salvageBuildsJson(text) {
  if (!text || typeof text !== "string") return null;
  const direct = tryParseJson(text);
  if (direct && typeof direct === "object") return direct;

  const projectsIdx = text.indexOf('"projects"');
  if (projectsIdx < 0) return null;
  const arrStart = text.indexOf("[", projectsIdx);
  if (arrStart < 0) return null;

  const projects = [];
  let i = arrStart + 1;
  while (i < text.length) {
    while (i < text.length && /[\s,]/.test(text[i])) i += 1;
    if (i >= text.length || text[i] === "]") break;
    if (text[i] !== "{") break;

    let depth = 0;
    let inString = false;
    let escape = false;
    const start = i;
    let end = -1;
    for (; i < text.length; i += 1) {
      const ch = text[i];
      if (inString) {
        if (escape) {
          escape = false;
          continue;
        }
        if (ch === "\\") {
          escape = true;
          continue;
        }
        if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          end = i;
          i += 1;
          break;
        }
      }
    }
    if (end < 0) break;
    const obj = tryParseJson(text.slice(start, end + 1));
    if (obj && String(obj.name || "").trim()) projects.push(obj);
  }

  let categories = [];
  const catIdx = text.indexOf('"categories"');
  if (catIdx >= 0) {
    const cStart = text.indexOf("[", catIdx);
    if (cStart >= 0) {
      let depth = 0;
      let inString = false;
      let escape = false;
      let cEnd = -1;
      for (let j = cStart; j < text.length; j += 1) {
        const ch = text[j];
        if (inString) {
          if (escape) {
            escape = false;
            continue;
          }
          if (ch === "\\") {
            escape = true;
            continue;
          }
          if (ch === '"') inString = false;
          continue;
        }
        if (ch === '"') {
          inString = true;
          continue;
        }
        if (ch === "[") depth += 1;
        else if (ch === "]") {
          depth -= 1;
          if (depth === 0) {
            cEnd = j;
            break;
          }
        }
      }
      if (cEnd > cStart) {
        const cats = tryParseJson(text.slice(cStart, cEnd + 1));
        if (Array.isArray(cats)) categories = cats;
      }
    }
  }

  if (!projects.length && !categories.length) return null;
  return {
    categories,
    projects,
    settings: { seeded: true },
    _recoveredFromCorrupt: true,
  };
}

function estimateJsonSize(value) {
  try {
    return JSON.stringify(value)?.length || 0;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

function slimFileTreeForPersist(tree, opts = {}) {
  if (!tree || typeof tree !== "object") return tree || null;
  const maxDepth = Number(opts.maxDepth) || 2;
  const maxChildren = Number(opts.maxChildren) || 120;

  function slimNode(node, depth) {
    if (!node || typeof node !== "object") return null;
    if (node.type === "file") {
      return {
        name: node.name,
        path: node.path,
        type: "file",
        size: node.size,
        sizeLabel: node.sizeLabel,
        ext: node.ext,
      };
    }
    const kids = Array.isArray(node.children) ? node.children : [];
    const out = {
      name: node.name,
      path: node.path,
      type: "dir",
      fileCount: node.fileCount,
      dirCount: node.dirCount,
      characterCount: node.characterCount,
    };
    if (depth >= maxDepth) {
      out.children = [];
      out.truncated = true;
      return out;
    }
    out.children = kids
      .slice(0, maxChildren)
      .map((c) => slimNode(c, depth + 1))
      .filter(Boolean);
    if (kids.length > maxChildren) out.truncated = true;
    return out;
  }

  const children = Array.isArray(tree.children)
    ? tree.children
        .slice(0, maxChildren)
        .map((n) => slimNode(n, 0))
        .filter(Boolean)
    : [];

  return {
    scannedAt: tree.scannedAt || null,
    root: String(tree.root || ""),
    fileCount: Number(tree.fileCount) || 0,
    dirCount: Number(tree.dirCount) || 0,
    characterCount: Number(tree.characterCount) || 0,
    statsVersion: Number(tree.statsVersion) || 0,
    truncated: true,
    children,
  };
}

function prepareProjectsForPersist(projects) {
  const TREE_BUDGET = 180 * 1024;
  return (projects || []).map((p) => {
    if (!p?.fileTree) return p;
    if (estimateJsonSize(p.fileTree) <= TREE_BUDGET) return p;
    return { ...p, fileTree: slimFileTreeForPersist(p.fileTree) };
  });
}

async function writeJsonAtomic(file, data) {
  const dir = path.dirname(file);
  await fs.promises.mkdir(dir, { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  const body = JSON.stringify(data, null, 2);
  await fs.promises.writeFile(tmp, body, "utf8");
  try {
    if (fs.existsSync(file)) {
      await fs.promises.copyFile(file, backupPath());
    }
  } catch {
  }
  try {
    await fs.promises.rename(tmp, file);
  } catch (err) {
    if (err && (err.code === "EEXIST" || err.code === "EPERM" || err.code === "EACCES")) {
      await fs.promises.copyFile(tmp, file);
      await fs.promises.unlink(tmp).catch(() => {});
    } else {
      await fs.promises.unlink(tmp).catch(() => {});
      throw err;
    }
  }
}

const DEFAULT_CATEGORIES = [
  { id: "desktop", name: "Desktop apps", icon: "🖥️", color: "#60a5fa" },
  { id: "web", name: "Web apps", icon: "🌐", color: "#34d399" },
  { id: "scripts", name: "Scripts & tools", icon: "⚙️", color: "#fbbf24" },
  { id: "libraries", name: "Libraries", icon: "📦", color: "#c084fc" },
  { id: "games", name: "Games", icon: "🎮", color: "#f472b6" },
  { id: "experiments", name: "Experiments", icon: "🧪", color: "#fb923c" },
  { id: "other", name: "Other", icon: "📁", color: "#94a3b8" },
];

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  "__pycache__",
  ".venv",
  "venv",
  ".cache",
  ".turbo",
  "out",
  "target",
  "vendor",
  ".pnpm-store",
  "win-unpacked",
  ".electron",
  "agent-tools",
  ".cursor",
]);

const SKIP_FILES = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeWinPath(p) {
  if (!p) return "";
  let s = String(p).trim().replace(/\//g, "\\").replace(/\\+/g, "\\");
  if (/^[a-zA-Z]$/.test(s)) s = `${s.toUpperCase()}:\\`;
  if (/^[a-zA-Z]:$/.test(s)) s = `${s.toUpperCase()}:\\`;
  return s;
}

async function statSafe(fullPath) {
  try {
    return await fs.promises.stat(fullPath);
  } catch {
    return null;
  }
}

function normalizeLink(raw) {
  if (!raw) return null;
  const url = String(raw.url || "").trim();
  const label = String(raw.label || "Link").trim() || "Link";
  if (!url) return null;
  return { id: String(raw.id || uid("lnk")), label, url };
}

function normalizeField(raw) {
  if (!raw) return null;
  const key = String(raw.key || "").trim();
  if (!key) return null;
  return { id: String(raw.id || uid("fld")), key, value: String(raw.value ?? "") };
}

function normalizeTreeNode(raw) {
  if (!raw || !raw.name) return null;
  const type = raw.type === "dir" ? "dir" : "file";
  const node = {
    name: String(raw.name),
    path: String(raw.path || ""),
    type,
  };
  if (type === "file") {
    node.sizeBytes = Number(raw.sizeBytes) || 0;
    node.sizeLabel = raw.sizeLabel || formatBytes(node.sizeBytes);
  }
  if (type === "dir") {
    if (raw.fileCount != null) node.fileCount = Number(raw.fileCount) || 0;
    if (raw.dirCount != null) node.dirCount = Number(raw.dirCount) || 0;
    if (raw.characterCount != null) node.characterCount = Number(raw.characterCount) || 0;
    if (Array.isArray(raw.children)) {
      node.children = raw.children.map(normalizeTreeNode).filter(Boolean);
    }
  }
  return node;
}

function countTreeStats(nodes) {
  let fileCount = 0;
  let dirCount = 0;
  for (const node of nodes || []) {
    if (node.type === "file") {
      fileCount += 1;
    } else if (node.type === "dir") {
      dirCount += 1;
      const nested = countTreeStats(node.children);
      fileCount += nested.fileCount;
      dirCount += nested.dirCount;
    }
  }
  return { fileCount, dirCount };
}

function normalizeFileTree(raw) {
  if (!raw || !Array.isArray(raw.children)) return null;
  const children = raw.children.map(normalizeTreeNode).filter(Boolean);
  const stats = countTreeStats(children);
  const exactFiles = Number(raw.fileCount);
  const exactDirs = Number(raw.dirCount);
  const exactChars = Number(raw.characterCount);
  return {
    scannedAt: raw.scannedAt || null,
    root: String(raw.root || ""),
    fileCount: Number.isFinite(exactFiles) ? exactFiles : stats.fileCount,
    dirCount: Number.isFinite(exactDirs) ? exactDirs : stats.dirCount,
    characterCount: Number.isFinite(exactChars) ? exactChars : 0,
    statsVersion: Number(raw.statsVersion) || 0,
    truncated: Boolean(raw.truncated),
    children,
  };
}

function normalizeSubCategoryItem(raw) {
  if (!raw) return null;
  if (typeof raw === "string") {
    const rel = String(raw).trim().replace(/\\/g, "/").replace(/^\.\//, "");
    if (!rel) return null;
    return {
      path: rel,
      name: rel.split("/").pop() || rel,
      type: rel.includes(".") ? "file" : "dir",
    };
  }
  const rel = String(raw.path || "").trim().replace(/\\/g, "/").replace(/^\.\//, "");
  if (!rel) return null;
  return {
    path: rel,
    name: String(raw.name || rel.split("/").pop() || rel).trim(),
    type: raw.type === "dir" ? "dir" : "file",
  };
}

function normalizeAttachment(raw) {
  if (!raw) return null;
  const filePath = String(raw.path || "").trim();
  if (!filePath) return null;
  const name = String(raw.name || path.basename(filePath)).trim() || path.basename(filePath);
  const type = raw.type === "folder" ? "folder" : "file";
  return {
    id: String(raw.id || uid("att")),
    path: filePath,
    name,
    type,
    description: String(raw.description || "").trim(),
    addedAt: raw.addedAt || new Date().toISOString(),
  };
}

function normalizeSubCategory(raw) {
  if (!raw || !String(raw.name || "").trim()) return null;
  let items = Array.isArray(raw.items) ? raw.items.map(normalizeSubCategoryItem).filter(Boolean) : [];
  if (!items.length && Array.isArray(raw.paths)) {
    items = raw.paths.map(normalizeSubCategoryItem).filter(Boolean);
  }
  return {
    id: String(raw.id || uid("subcat")),
    name: String(raw.name).trim(),
    icon: String(raw.icon || "📂").trim() || "📂",
    color: String(raw.color || "#94a3b8").trim() || "#94a3b8",
    runCommand: String(raw.runCommand || "").trim(),
    runCwd: String(raw.runCwd || "")
      .trim()
      .replace(/\\/g, "/")
      .replace(/^\.\//, ""),
    items,
  };
}

function normalizeProject(raw) {
  if (!raw || !String(raw.name || "").trim()) return null;
  return {
    id: String(raw.id || uid("proj")),
    name: String(raw.name).trim(),
    categoryId: String(raw.categoryId || "other"),
    icon: String(raw.icon || "🏗️").trim() || "🏗️",
    iconId: String(raw.iconId || "").trim(),
    color: String(raw.color || "").trim(),
    description: String(raw.description || "").trim(),
    stack: Array.isArray(raw.stack) ? raw.stack.map((s) => String(s).trim()).filter(Boolean) : [],
    rootPath: String(raw.rootPath || "").trim(),
    repoUrl: String(raw.repoUrl || "").trim(),
    demoUrl: String(raw.demoUrl || "").trim(),
    links: (Array.isArray(raw.links) ? raw.links : []).map(normalizeLink).filter(Boolean),
    fields: (Array.isArray(raw.fields) ? raw.fields : []).map(normalizeField).filter(Boolean),
    tags: Array.isArray(raw.tags) ? raw.tags.map((t) => String(t).trim()).filter(Boolean) : [],
    notes: String(raw.notes || "").trim(),
    fileTree: normalizeFileTree(raw.fileTree),
    attachments: (Array.isArray(raw.attachments) ? raw.attachments : []).map(normalizeAttachment).filter(Boolean),
    subCategories: (
      Array.isArray(raw.subCategories)
        ? raw.subCategories
        : Array.isArray(raw.sections)
          ? raw.sections
          : []
    )
      .map(normalizeSubCategory)
      .filter(Boolean),
    builtAt: String(raw.builtAt || raw.createdAt || "").trim(),
    favorite: Boolean(raw.favorite),
    watchFolder: raw.watchFolder !== false,
    rootMissing: Boolean(raw.rootMissing),
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
  };
}

function normalizeCategory(raw) {
  if (!raw || !String(raw.name || "").trim()) return null;
  return {
    id: String(raw.id || uid("cat")),
    name: String(raw.name).trim(),
    icon: String(raw.icon || "📁").trim() || "📁",
    color: String(raw.color || "#94a3b8").trim(),
  };
}

const MYSPACE_DEFAULT_SUBCATEGORIES = [
  { id: "subcat_history", name: "History", icon: "📜", color: "#a78bfa" },
  { id: "subcat_space", name: "Space", icon: "🌌", color: "#38bdf8" },
  { id: "subcat_shell", name: "Shell", icon: "⌨️", color: "#34d399" },
  { id: "subcat_geography", name: "Geography", icon: "🌍", color: "#4ade80" },
];

function seedMySpaceProject() {
  const root = path.join(__dirname, "..", "..");
  return normalizeProject({
    id: "proj_myspace",
    name: "My Space",
    categoryId: "desktop",
    icon: "🏠",
    color: "#f59e0b",
    description:
      "Personal desktop space on top of Windows: workspace, built-in apps.",
    stack: ["Electron", "Node.js", "JavaScript", "HTML/CSS"],
    rootPath: root,
    repoUrl: "",
    demoUrl: "",
    tags: ["desktop", "electron", "my-space"],
    notes: "Document each app you add here. Use Scan tree to capture the file structure.",
    subCategories: MYSPACE_DEFAULT_SUBCATEGORIES,
    builtAt: "2026-01-01",
    favorite: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

function normalizeRootPath(p) {
  if (!p) return "";
  try {
    return path.normalize(String(p)).toLowerCase().replace(/[/\\]+$/, "");
  } catch {
    return String(p).toLowerCase().replace(/[/\\]+$/, "");
  }
}

function isSameProjectRoot(a, b) {
  const ra = normalizeRootPath(a);
  const rb = normalizeRootPath(b);
  return Boolean(ra && rb && ra === rb);
}

function pickNewerFileTree(a, b) {
  if (!a?.children?.length) return b || null;
  if (!b?.children?.length) return a || null;
  const aAt = Date.parse(a.scannedAt || 0) || 0;
  const bAt = Date.parse(b.scannedAt || 0) || 0;
  return bAt >= aAt ? b : a;
}

function looksLikeOperatingSystemName(name) {
  return /operat(?:ing|ion)\s*system/i.test(String(name || ""));
}

function isOperatingSystemProject(p) {
  if (p.id === "proj_operating_system") return true;
  if (p.id === "proj_myspace") return false;
  return looksLikeOperatingSystemName(p.name);
}

function isWorldMapsProject(p) {
  return p.id === "proj_world_maps";
}

function mergeWorldMapsProject(projects, repoRoot) {
  const idx = projects.findIndex(isWorldMapsProject);
  const existing = idx >= 0 ? projects[idx] : null;
  const seeded = seedWorldMapsProject(repoRoot);

  const mergedSubs = (seeded.subCategories || []).map((sub) => {
    return normalizeSubCategory({
      ...sub,
      items: sub.items,
      runCommand: sub.runCommand || "",
      runCwd: sub.runCwd ?? "",
    });
  });

  const updated = normalizeProject({
    ...seeded,
    ...(existing || {}),
    id: "proj_world_maps",
    name: "World Maps",
    rootPath: seeded.rootPath,
    description: seeded.description,
    notes: seeded.notes,
    stack: seeded.stack,
    tags: seeded.tags,
    links: seeded.links,
    fields: seeded.fields,
    subCategories: mergedSubs,
    fileTree: pickNewerFileTree(existing?.fileTree, seeded.fileTree),
    favorite: existing?.favorite ?? seeded.favorite,
    watchFolder: existing?.watchFolder !== false,
    updatedAt: new Date().toISOString(),
  });

  if (idx >= 0) projects[idx] = updated;
  else projects.push(updated);
  return projects;
}

function migrateProjects(projects) {
  const root = path.join(__dirname, "..", "..");
  const next = projects.map((p) => normalizeProject(p)).filter(Boolean);
  const myspace = next.find((p) => p.id === "proj_myspace");
  const osMatches = next.filter(isOperatingSystemProject);
  const firstOsIdx = next.findIndex(isOperatingSystemProject);
  const base = osMatches.find((p) => p.id === "proj_operating_system") || osMatches[0];

  let updatedOs = normalizeProject({
    ...(base || seedOperatingSystemProject(root)),
    id: "proj_operating_system",
    name: "Operating System",
    rootPath:
      base?.rootPath && fs.existsSync(normalizeWinPath(base.rootPath))
        ? normalizeWinPath(base.rootPath)
        : myspace?.rootPath && fs.existsSync(normalizeWinPath(myspace.rootPath))
          ? normalizeWinPath(myspace.rootPath)
          : root,
    description:
      "One sub-category per My Space app: linked source code and a command that launches that app only.",
    notes:
      "Copy command → paste in VS Code terminal. Opens only the selected app via electron --run <app>.",
    subCategories: buildOperatingSystemSubCategories(root).map((s) => normalizeSubCategory(s)),
  });
  if (
    updatedOs.fileTree?.root &&
    normalizeWinPath(updatedOs.fileTree.root) !== normalizeWinPath(updatedOs.rootPath)
  ) {
    updatedOs.fileTree = {
      ...updatedOs.fileTree,
      root: updatedOs.rootPath,
      statsVersion: 0,
    };
  }

  if (myspace && isSameProjectRoot(myspace.rootPath, updatedOs.rootPath)) {
    updatedOs = normalizeProject({
      ...updatedOs,
      rootPath: updatedOs.rootPath || myspace.rootPath,
      fileTree: pickNewerFileTree(myspace.fileTree, updatedOs.fileTree),
      favorite: updatedOs.favorite || myspace.favorite,
      watchFolder: myspace.watchFolder !== false,
    });
  }

  let withoutOs = next.filter((p) => !isOperatingSystemProject(p));
  if (myspace && isSameProjectRoot(myspace.rootPath, updatedOs.rootPath)) {
    withoutOs = withoutOs.filter((p) => p.id !== "proj_myspace");
  }

  if (firstOsIdx >= 0) {
    withoutOs.splice(Math.min(firstOsIdx, withoutOs.length), 0, updatedOs);
    return mergeWorldMapsProject(withoutOs, root);
  }

  withoutOs.push(updatedOs);
  return mergeWorldMapsProject(withoutOs, root);
}

function normalizeStorage(raw) {
  const categories =
    Array.isArray(raw?.categories) && raw.categories.length
      ? raw.categories.map(normalizeCategory).filter(Boolean)
      : DEFAULT_CATEGORIES.map((c) => ({ ...c }));

  let projects = (Array.isArray(raw?.projects) ? raw.projects : []).map(normalizeProject).filter(Boolean);
  projects = migrateProjects(projects);

  if (!projects.length && !raw?.settings?.seeded) {
    projects = [normalizeProject(seedOperatingSystemProject(path.join(__dirname, "..", "..")))];
  }

  return {
    categories,
    projects,
    settings: {
      lastCategory: String(raw?.settings?.lastCategory || "all"),
      seeded: true,
      autoRefreshEnabled: raw?.settings?.autoRefreshEnabled !== false,
      autoRefreshMinutes: Math.min(
        60,
        Math.max(1, parseInt(raw?.settings?.autoRefreshMinutes, 10) || 3)
      ),
      lastAutoRefreshAt: raw?.settings?.lastAutoRefreshAt || null,
    },
  };
}

function myspaceRepoRoot() {
  return path.join(__dirname, "..", "..");
}

function isDeadLegacyComputerProjectPath(rootPath) {
  const s = String(rootPath || "").replace(/\//g, "\\").toLowerCase();
  return s.includes("computerproject") || s.includes("תיקיה חדשה (2)");
}

function healMissingProjectRoots(projects) {
  const repo = myspaceRepoRoot();
  const repoNm = path.join(repo, "node_modules");
  let changed = false;

  for (const p of projects || []) {
    const root = normalizeWinPath(p.rootPath || p.fileTree?.root || "");
    const missing = !root || !fs.existsSync(root);
    if (!missing && !p.rootMissing) continue;

    let nextRoot = "";
    if (p.id === "proj_operating_system") {
      nextRoot = repo;
    } else if (
      /node_modules/i.test(p.name || "") ||
      /node_modules$/i.test(root) ||
      (isDeadLegacyComputerProjectPath(root) && /node_modules/i.test(root))
    ) {
      nextRoot = fs.existsSync(repoNm) ? repoNm : repo;
    } else if (isDeadLegacyComputerProjectPath(root)) {
      nextRoot = repo;
    }

    if (!nextRoot || !fs.existsSync(nextRoot)) continue;
    if (normalizeWinPath(nextRoot) === root && !p.rootMissing) continue;

    p.rootPath = nextRoot;
    p.rootMissing = false;
    p.updatedAt = new Date().toISOString();
    p.fileTree = {
      ...(p.fileTree || { children: [] }),
      root: nextRoot,
      statsVersion: 0,
      fileCount: 0,
      dirCount: 0,
      characterCount: 0,
      children: Array.isArray(p.fileTree?.children) ? p.fileTree.children : [],
    };
    changed = true;
  }

  return changed;
}

function promoteFolderAttachmentsToCodeRoot(projects) {
  let changed = false;
  for (const p of projects || []) {
    const root = normalizeWinPath(p.rootPath || p.fileTree?.root || "");
    if (root && fs.existsSync(root)) continue;

    const folders = (p.attachments || []).filter((a) => a && a.type === "folder" && a.path);
    for (const att of folders) {
      const candidate = normalizeWinPath(att.path);
      if (!candidate) continue;
      try {
        if (!fs.existsSync(candidate) || !fs.statSync(candidate).isDirectory()) continue;
      } catch {
        continue;
      }
      p.rootPath = candidate;
      p.rootMissing = false;
      if (!Array.isArray(p.fileTree?.children) || !p.fileTree.children.length) {
        p.fileTree = null;
      }
      p.updatedAt = new Date().toISOString();
      changed = true;
      break;
    }
  }
  return changed;
}

function statsNeedRecount(project) {
  const root = normalizeWinPath(project?.rootPath || project?.fileTree?.root || "");
  if (!root || !fs.existsSync(root)) return false;
  const tree = project?.fileTree;
  if (!tree) return true;
  if (Number(tree.statsVersion) !== STATS_VERSION) return true;
  if ((Number(tree.fileCount) || 0) > 0 && !(Number(tree.characterCount) > 0)) return true;
  return false;
}

async function recountExactStatsForProject(project) {
  const root = normalizeWinPath(project.rootPath || project.fileTree?.root || "");
  if (!root) return { ok: false, error: "No folder linked", missing: true };
  const st = await statSafe(root);
  if (!st?.isDirectory()) {
    return { ok: false, error: `Folder missing: ${root}`, missing: true, root };
  }

  const needsFreshTree =
    !Array.isArray(project.fileTree?.children) ||
    project.fileTree.children.length === 0 ||
    Number(project.fileTree?.statsVersion) !== STATS_VERSION ||
    (project.fileTree?.root &&
      normalizeWinPath(project.fileTree.root) !== root);

  if (needsFreshTree) {
    const scan = await scanCodeTree({ path: root });
    if (!scan.ok || !scan.fileTree) {
      return { ok: false, error: scan.error || "Scan failed", root };
    }
    project.fileTree = scan.fileTree;
    project.rootPath = root;
    project.rootMissing = false;
    project.updatedAt = new Date().toISOString();
    return {
      ok: true,
      id: project.id,
      name: project.name,
      fileCount: scan.fileTree.fileCount,
      dirCount: scan.fileTree.dirCount,
      characterCount: scan.fileTree.characterCount,
      root,
      rebuiltTree: true,
    };
  }

  const countMap = new Map();
  const exactTotals = { fileCount: 0, dirCount: 0, characterCount: 0, aborted: false };
  await scanDirectoryCounts(root, countMap, exactTotals);

  const prev = project.fileTree || { children: [], root };
  const children = Array.isArray(prev.children) ? prev.children : [];
  attachCountsToTree(children, countMap);

  project.fileTree = {
    ...prev,
    scannedAt: new Date().toISOString(),
    root,
    fileCount: exactTotals.fileCount,
    dirCount: exactTotals.dirCount,
    characterCount: exactTotals.characterCount,
    statsVersion: STATS_VERSION,
    children,
  };
  project.rootPath = root;
  project.rootMissing = false;
  project.updatedAt = new Date().toISOString();

  return {
    ok: true,
    id: project.id,
    name: project.name,
    fileCount: exactTotals.fileCount,
    dirCount: exactTotals.dirCount,
    characterCount: exactTotals.characterCount,
    root,
  };
}

let statsRecountInProgress = false;

async function recountStaleExactStats(args = {}) {
  if (statsRecountInProgress) {
    return { ok: true, skipped: true, reason: "recount-in-progress" };
  }
  const loaded = await loadStorage({ skipStatsQueue: true });
  if (!loaded.ok) return loaded;

  const force = Boolean(args?.force);
  const data = loaded.data;
  const targets = (data.projects || []).filter((p) => force || statsNeedRecount(p));
  if (!targets.length) return { ok: true, recounted: 0, updated: [], missing: [] };

  statsRecountInProgress = true;
  const updated = [];
  const missing = [];
  let touched = false;
  try {
    for (const project of targets) {
      const res = await recountExactStatsForProject(project);
      if (res.ok) {
        project.rootMissing = false;
        updated.push(res);
        touched = true;
      } else if (res.missing) {
        const wasMissing = Boolean(project.rootMissing);
        project.rootMissing = true;
        missing.push({
          id: project.id,
          name: project.name,
          root: res.root || project.rootPath,
          error: res.error,
        });
        if (!wasMissing) notifyLinkedFolderMissing(project, res.root || project.rootPath);
        touched = true;
      }
    }
    for (const project of data.projects || []) {
      if (targets.some((t) => t.id === project.id)) continue;
      const root = normalizeWinPath(project.rootPath || project.fileTree?.root || "");
      if (!root) continue;
      if (!fs.existsSync(root) && !project.rootMissing) {
        project.rootMissing = true;
        missing.push({ id: project.id, name: project.name, root, error: "Folder missing" });
        notifyLinkedFolderMissing(project, root);
        touched = true;
      }
    }
    if (touched) {
      await saveStorage({ data });
      broadcastTreeUpdate({
        kind: "stats-recount",
        recounted: updated.length,
        updated,
        missing,
        settings: data.settings,
      });
    }
    return { ok: true, recounted: updated.length, updated, missing };
  } finally {
    statsRecountInProgress = false;
  }
}

function queueStaleStatsRecount() {
  setImmediate(() => {
    recountStaleExactStats({}).catch((err) => {
      console.error("[builds] stats recount failed", err);
      reportRuntimeFailure("builds", "STATS_RECOUNT_FAILED", err, { source: "background" });
    });
  });
}

async function ensureWorldMapsTree(data) {
  const wm = (data.projects || []).find((p) => p.id === "proj_world_maps");
  if (!wm) return false;

  const root = normalizeWinPath(wm.rootPath);
  if (!root) return false;
  const st = await statSafe(root);
  if (!st?.isDirectory()) return false;
  if (wm.fileTree?.children?.length && wm.fileTree.fileCount != null) {
    return false;
  }

  const scan = await scanCodeTree({ path: root });
  if (!scan.ok || !scan.fileTree) return false;

  wm.fileTree = scan.fileTree;
  wm.rootPath = root;
  wm.updatedAt = new Date().toISOString();
  return true;
}

function osSubCategoriesDiffer(rawProjects, projects) {
  const rawOs = rawProjects.find((p) => p.id === "proj_operating_system");
  const newOs = (projects || []).find((p) => p.id === "proj_operating_system");
  const snap = (subs) =>
    JSON.stringify(
      (subs || []).map((s) => ({
        id: s.id,
        items: (s.items || []).map((i) => `${i.type}:${i.path}`),
        runCommand: s.runCommand || "",
      }))
    );
  return snap(rawOs?.subCategories) !== snap(newOs?.subCategories);
}

function worldMapsProjectDiffer(rawProjects, projects) {
  const rawWm = rawProjects.find((p) => p.id === "proj_world_maps");
  const newWm = (projects || []).find((p) => p.id === "proj_world_maps");
  const snap = (p) =>
    JSON.stringify({
      subs: (p?.subCategories || []).map((s) => ({
        id: s.id,
        items: (s.items || []).map((i) => `${i.type}:${i.path}`),
      })),
      fileCount: p?.fileTree?.fileCount || 0,
    });
  return snap(rawWm) !== snap(newWm);
}

async function loadStorage(opts = {}) {
  try {
    const fileText = await fs.promises.readFile(dataPath(), "utf8");
    const hadBom = fileText.charCodeAt(0) === 0xfeff;
    const rawText = hadBom ? fileText.slice(1) : fileText;
    let parsed = tryParseJson(rawText);
    let recovered = false;
    if (!parsed) {
      parsed = salvageBuildsJson(rawText);
      recovered = Boolean(parsed);
      if (!parsed) {
        try {
          const bakText = await fs.promises.readFile(backupPath(), "utf8");
          parsed = tryParseJson(bakText) || salvageBuildsJson(bakText);
          recovered = Boolean(parsed);
        } catch {
        }
      }
      if (!parsed) {
        return { ok: false, error: "builds.json is corrupt and could not be recovered" };
      }
    }

    const rawProjects = Array.isArray(parsed?.projects) ? parsed.projects : [];
    const osBefore = rawProjects.filter(isOperatingSystemProject).length;
    const redundantMyspace = rawProjects.some(
      (p) =>
        p.id === "proj_myspace" &&
        rawProjects.some(
          (os) => os.id === "proj_operating_system" && isSameProjectRoot(p.rootPath, os.rootPath)
        )
    );
    const data = normalizeStorage(parsed);
    data.projects = prepareProjectsForPersist(data.projects);
    const rootsHealed = healMissingProjectRoots(data.projects);
    const foldersPromoted = promoteFolderAttachmentsToCodeRoot(data.projects);
    const wmTreeUpdated = await ensureWorldMapsTree(data);
    const osProj = data.projects.find((p) => p.id === "proj_operating_system");
    const hasWmSub = osProj?.subCategories?.some((s) => s.id === "subcat_app_world_maps");
    const rawOs = rawProjects.find((p) => p.id === "proj_operating_system");
    const rawHadWm = rawOs?.subCategories?.some((s) => s.id === "subcat_app_world_maps");
    const wmSubAdded = hasWmSub && !rawHadWm;
    const osSubsChanged = osSubCategoriesDiffer(rawProjects, data.projects);
    const wmChanged = worldMapsProjectDiffer(rawProjects, data.projects);
    const osRootHealed =
      osProj &&
      rawOs &&
      normalizeWinPath(osProj.rootPath) !== normalizeWinPath(rawOs.rootPath || "");
    if (
      recovered ||
      osBefore > 1 ||
      redundantMyspace ||
      hadBom ||
      wmTreeUpdated ||
      wmSubAdded ||
      osSubsChanged ||
      wmChanged ||
      osRootHealed ||
      rootsHealed ||
      foldersPromoted
    ) {
      await writeJsonAtomic(dataPath(), data);
    }
    if (!opts.skipStatsQueue) queueStaleStatsRecount();
    return { ok: true, data, recovered };
  } catch (err) {
    if (err && err.code === "ENOENT") {
      return { ok: true, data: normalizeStorage({}) };
    }
    try {
      const fileText = await fs.promises.readFile(dataPath(), "utf8");
      const parsed = salvageBuildsJson(fileText);
      if (parsed) {
        const data = normalizeStorage(parsed);
        data.projects = prepareProjectsForPersist(data.projects);
        await writeJsonAtomic(dataPath(), data);
        if (!opts.skipStatsQueue) queueStaleStatsRecount();
        return { ok: true, data, recovered: true };
      }
    } catch {
    }
    return { ok: false, error: err.message || "Failed to load" };
  }
}

async function saveStorage(args) {
  const payload = normalizeStorage(args?.data ?? args);
  payload.projects = prepareProjectsForPersist(payload.projects);

  try {
    const existing = await loadStorage({ skipStatsQueue: true });
    if (existing?.ok && Array.isArray(existing.data?.projects)) {
      const diskN = existing.data.projects.length;
      const nextN = (payload.projects || []).length;
      if (diskN > 0 && nextN === 0) {
        return {
          ok: false,
          error: `Refused to save empty builds list over ${diskN} existing projects`,
          data: existing.data,
        };
      }
      if (diskN > nextN) {
        const byId = new Map((payload.projects || []).map((p) => [p.id, p]));
        for (const p of existing.data.projects) {
          if (p?.id && !byId.has(p.id)) byId.set(p.id, p);
        }
        payload.projects = prepareProjectsForPersist([...byId.values()]);
      }
    }
  } catch {
  }

  await writeJsonAtomic(dataPath(), payload);
  return { ok: true, data: payload };
}

function normalizeUrl(raw) {
  let url = String(raw || "").trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url) && !/^file:\/\//i.test(url) && !/^mailto:/i.test(url)) {
    url = `https://${url}`;
  }
  return url;
}

async function openLink(args) {
  const url = normalizeUrl(args?.url);
  if (!url) return { ok: false, error: "URL is required" };
  await shell.openExternal(url);
  return { ok: true };
}

async function openFolder(args) {
  const folder = String(args?.path || "").trim();
  if (!folder) return { ok: false, error: "Path required" };
  const result = await shell.openPath(folder);
  if (result) return { ok: false, error: result };
  return { ok: true };
}

async function pickFolder(args) {
  const defaultPath = normalizeWinPath(args?.defaultPath || "");
  const opts = {
    properties: ["openDirectory"],
    title: String(args?.title || "Select project folder"),
  };
  if (defaultPath) {
    try {
      const st = await statSafe(defaultPath);
      if (st?.isDirectory()) opts.defaultPath = defaultPath;
    } catch {
    }
  }
  const result = await dialog.showOpenDialog(opts);
  if (result.canceled || !result.filePaths?.length) return { ok: true, path: null };
  return { ok: true, path: result.filePaths[0] };
}

async function pickFiles(args) {
  const defaultPath = normalizeWinPath(args?.defaultPath || "");
  const opts = {
    properties: ["openFile", "multiSelections"],
    title: String(args?.title || "Select files"),
    filters: Array.isArray(args?.filters) && args.filters.length ? args.filters : [{ name: "All files", extensions: ["*"] }],
  };
  if (defaultPath) {
    try {
      const st = await statSafe(defaultPath);
      if (st?.isFile()) opts.defaultPath = path.dirname(defaultPath);
      else if (st?.isDirectory()) opts.defaultPath = defaultPath;
    } catch {
    }
  }
  const result = await dialog.showOpenDialog(opts);
  if (result.canceled || !result.filePaths?.length) return { ok: true, paths: [] };
  return { ok: true, paths: result.filePaths };
}

async function openFile(args) {
  const filePath = String(args?.path || "").trim();
  if (!filePath) return { ok: false, error: "Path required" };
  const err = await shell.openPath(filePath);
  if (err) return { ok: false, error: err };
  return { ok: true };
}

async function copyText(args) {
  clipboard.writeText(String(args?.text ?? ""));
  return { ok: true };
}

async function exportData() {
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  return { ok: true, json: JSON.stringify(loaded.data, null, 2) };
}

async function importData(args) {
  let parsed;
  try {
    parsed = typeof args?.json === "string" ? JSON.parse(args.json) : args?.data;
  } catch {
    return { ok: false, error: "Invalid JSON" };
  }
  return saveStorage({ data: parsed });
}

async function countFileCharacters(fullPath) {
  try {
    const st = await fs.promises.stat(fullPath);
    if (!st.isFile()) return 0;
    return st.size || 0;
  } catch {
    return 0;
  }
}

const STATS_VERSION = 2;

async function scanDirectoryCounts(dirPath, countMap, totals, seen) {
  const visited = seen || new Set();
  let realKey = dirPath;
  try {
    realKey = await fs.promises.realpath(dirPath);
  } catch {
  }
  if (visited.has(realKey)) {
    countMap.set(dirPath, { fileCount: 0, dirCount: 0, characterCount: 0 });
    return { fileCount: 0, dirCount: 0, characterCount: 0 };
  }
  visited.add(realKey);

  let fileCount = 0;
  let dirCount = 0;
  let characterCount = 0;

  let entries;
  try {
    entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  } catch {
    countMap.set(dirPath, { fileCount: 0, dirCount: 0, characterCount: 0 });
    return { fileCount: 0, dirCount: 0, characterCount: 0 };
  }

  for (const ent of entries) {
    if (totals.aborted) break;
    const name = ent.name;
    if (name === "." || name === "..") continue;

    const full = path.join(dirPath, name);

    if (ent.isDirectory()) {
      dirCount += 1;
      totals.dirCount += 1;
      const nested = await scanDirectoryCounts(full, countMap, totals, visited);
      fileCount += nested.fileCount;
      dirCount += nested.dirCount;
      characterCount += nested.characterCount;
    } else if (ent.isFile()) {
      fileCount += 1;
      totals.fileCount += 1;
      const chars = await countFileCharacters(full);
      characterCount += chars;
      totals.characterCount += chars;
    } else if (typeof ent.isSymbolicLink === "function" && ent.isSymbolicLink()) {
      const st = await statSafe(full);
      if (st?.isDirectory()) {
        dirCount += 1;
        totals.dirCount += 1;
        const nested = await scanDirectoryCounts(full, countMap, totals, visited);
        fileCount += nested.fileCount;
        dirCount += nested.dirCount;
        characterCount += nested.characterCount;
      } else if (st?.isFile()) {
        fileCount += 1;
        totals.fileCount += 1;
        const chars = await countFileCharacters(full);
        characterCount += chars;
        totals.characterCount += chars;
      }
    }
  }

  countMap.set(dirPath, { fileCount, dirCount, characterCount });
  return { fileCount, dirCount, characterCount };
}

function attachCountsToTree(nodes, countMap) {
  for (const node of nodes || []) {
    if (node.type !== "dir") continue;
    const stats = countMap.get(node.path);
    if (stats) {
      node.fileCount = stats.fileCount;
      node.dirCount = stats.dirCount;
      node.characterCount = stats.characterCount;
    }
    if (node.children?.length) attachCountsToTree(node.children, countMap);
  }
}

async function scanDirTree(dirPath, depth, maxDepth, maxChildren, stats, visitBudget) {
  if (visitBudget.count <= 0) {
    stats.truncated = true;
    return [];
  }

  let entries;
  try {
    entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  const nodes = [];
  for (const ent of entries) {
    if (nodes.length >= maxChildren) {
      stats.truncated = true;
      break;
    }
    if (visitBudget.count <= 0) {
      stats.truncated = true;
      break;
    }

    const name = ent.name;
    if (name === "." || name === "..") continue;

    const full = path.join(dirPath, name);

    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(name.toLowerCase())) continue;
      visitBudget.count -= 1;
      let children = [];
      if (depth < maxDepth) {
        children = await scanDirTree(full, depth + 1, maxDepth, maxChildren, stats, visitBudget);
      } else {
        try {
          const peek = await fs.promises.readdir(full);
          const hasMore = peek.some(
            (n) => n !== "." && n !== ".." && !SKIP_DIRS.has(String(n).toLowerCase())
          );
          if (hasMore) stats.truncated = true;
        } catch {
        }
      }
      nodes.push({
        name,
        path: full,
        type: "dir",
        children,
      });
    } else if (ent.isFile()) {
      if (SKIP_FILES.has(name)) continue;
      const st = await statSafe(full);
      if (!st?.isFile()) continue;
      visitBudget.count -= 1;
      nodes.push({
        name,
        path: full,
        type: "file",
        sizeBytes: st.size,
        sizeLabel: formatBytes(st.size),
      });
    }
  }

  return nodes;
}

async function scanCodeTree(args) {
  const rootPath = normalizeWinPath(args?.path || "");
  if (!rootPath) return { ok: false, error: "Path required" };

  const maxDepth = Math.min(14, Math.max(1, parseInt(args?.maxDepth, 10) || 10));
  const maxChildren = Math.min(300, Math.max(30, parseInt(args?.maxChildren, 10) || 150));
  const visitBudget = { count: 25000 };

  const st = await statSafe(rootPath);
  if (!st?.isDirectory()) {
    return { ok: false, error: `Folder not found: ${rootPath}` };
  }

  const countMap = new Map();
  const exactTotals = { fileCount: 0, dirCount: 0, characterCount: 0, aborted: false };
  await scanDirectoryCounts(rootPath, countMap, exactTotals);

  const stats = { truncated: false };
  const children = await scanDirTree(rootPath, 1, maxDepth, maxChildren, stats, visitBudget);
  attachCountsToTree(children, countMap);

  return {
    ok: true,
    fileTree: {
      scannedAt: new Date().toISOString(),
      root: rootPath,
      fileCount: exactTotals.fileCount,
      dirCount: exactTotals.dirCount,
      characterCount: exactTotals.characterCount,
      statsVersion: STATS_VERSION,
      truncated: stats.truncated,
      children,
    },
  };
}

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif", "heic"]);
const BINARY_EXTS = new Set([
  "exe", "dll", "so", "dylib", "bin", "dat", "o", "obj", "a", "lib", "class", "jar", "war",
  "zip", "7z", "rar", "gz", "tgz", "bz2", "xz", "tar", "iso", "dmg", "pkg",
  "pdf", "doc", "docx", "xls", "xlsx", "xlsm", "ppt", "pptx", "odt", "ods", "odp",
  "mp3", "mp4", "wav", "flac", "avi", "mkv", "mov", "webm", "ogg",
  "woff", "woff2", "ttf", "otf", "eot",
  "pdb", "ilk", "msi", "cab", "apk", "ipa", "wasm",
]);

function fileExt(filePath) {
  return path.extname(String(filePath || "")).replace(/^\./, "").toLowerCase();
}

function decodeTextBuffer(buf) {
  if (!buf || !buf.length) return { text: "", encoding: "utf8" };
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return { text: buf.slice(2).toString("utf16le"), encoding: "utf16le" };
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.alloc(buf.length - 2);
    for (let i = 2; i + 1 < buf.length; i += 2) {
      swapped[i - 2] = buf[i + 1];
      swapped[i - 1] = buf[i];
    }
    return { text: swapped.toString("utf16le"), encoding: "utf16be" };
  }
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return { text: buf.slice(3).toString("utf8"), encoding: "utf8" };
  }
  const sample = buf.subarray(0, Math.min(buf.length, 4096));
  let oddNull = 0;
  let evenNull = 0;
  for (let i = 0; i < sample.length; i += 1) {
    if (sample[i] === 0) {
      if (i % 2 === 0) evenNull += 1;
      else oddNull += 1;
    }
  }
  const pairs = Math.floor(sample.length / 2);
  if (pairs > 8 && oddNull / pairs > 0.6 && evenNull / pairs < 0.15) {
    return { text: buf.toString("utf16le"), encoding: "utf16le" };
  }
  return { text: buf.toString("utf8"), encoding: "utf8" };
}

function looksLikeBinary(buf) {
  if (!buf || !buf.length) return false;
  const sample = buf.subarray(0, Math.min(buf.length, 8192));
  let nulls = 0;
  let weird = 0;
  for (let i = 0; i < sample.length; i += 1) {
    const b = sample[i];
    if (b === 0) nulls += 1;
    else if (b < 7 || (b > 13 && b < 32 && b !== 27)) weird += 1;
  }
  if (nulls / sample.length > 0.02 && nulls > 4) return true;
  if (weird / sample.length > 0.3) return true;
  return false;
}

async function readFilePreview(args) {
  const filePath = String(args?.path || "").trim();
  if (!filePath) return { ok: false, error: "Path required" };

  const maxBytes = Math.min(512 * 1024, Math.max(1024, parseInt(args?.maxBytes, 10) || 128 * 1024));
  const st = await statSafe(filePath);
  if (!st?.isFile()) return { ok: false, error: "Not a file" };

  const ext = fileExt(filePath);
  const base = {
    ok: true,
    path: filePath,
    name: path.basename(filePath),
    ext,
    size: st.size,
    sizeLabel: formatBytes(st.size),
  };

  if (IMAGE_EXTS.has(ext) && st.size <= 8 * 1024 * 1024) {
    const buf = await fs.promises.readFile(filePath);
    const mime =
      ext === "svg"
        ? "image/svg+xml"
        : ext === "png"
          ? "image/png"
          : ext === "gif"
            ? "image/gif"
            : ext === "webp"
              ? "image/webp"
              : ext === "bmp"
                ? "image/bmp"
                : ext === "ico"
                  ? "image/x-icon"
                  : "image/jpeg";
    return {
      ...base,
      image: true,
      dataUrl: `data:${mime};base64,${buf.toString("base64")}`,
      content: null,
    };
  }

  if (BINARY_EXTS.has(ext) && !IMAGE_EXTS.has(ext)) {
    return {
      ...base,
      binary: true,
      content: null,
    };
  }

  const readLen = Math.min(st.size, maxBytes);
  const fh = await fs.promises.open(filePath, "r");
  let buf;
  try {
    buf = Buffer.alloc(readLen);
    const { bytesRead } = await fh.read(buf, 0, readLen, 0);
    buf = buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }

  const decoded = decodeTextBuffer(buf);
  if (decoded.encoding === "utf8" && looksLikeBinary(buf)) {
    return {
      ...base,
      binary: true,
      content: null,
    };
  }

  const truncated = st.size > maxBytes;
  return {
    ...base,
    truncated,
    encoding: decoded.encoding,
    content: decoded.text,
  };
}

function broadcastTreeUpdate(payload) {
  const { webContents } = require("electron");
  for (const wc of webContents.getAllWebContents()) {
    if (!wc.isDestroyed()) {
      wc.send("builds-tree-update", payload);
    }
  }
}

function slimProject(p) {
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    categoryId: p.categoryId,
    icon: p.icon,
    iconId: p.iconId || "",
    color: p.color || "",
    description: p.description || "",
    rootPath: p.rootPath || "",
    repoUrl: p.repoUrl || "",
    demoUrl: p.demoUrl || "",
    stack: p.stack || [],
    tags: p.tags || [],
    favorite: Boolean(p.favorite),
    watchFolder: p.watchFolder !== false,
    builtAt: p.builtAt || "",
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    fileCount: p.fileTree?.fileCount || 0,
    dirCount: p.fileTree?.dirCount || 0,
    subCategoryCount: (p.subCategories || []).length,
    attachmentCount: (p.attachments || []).length,
  };
}

function resolveCategoryId(categories, ref) {
  const raw = String(ref || "").trim();
  if (!raw) return "other";
  const key = raw.toLowerCase();
  const cats = categories || [];
  const byId = cats.find((c) => String(c.id).toLowerCase() === key);
  if (byId) return byId.id;
  const byName = cats.find((c) => String(c.name).toLowerCase() === key);
  if (byName) return byName.id;
  const partial = cats.find((c) => String(c.name).toLowerCase().includes(key));
  if (partial) return partial.id;
  return raw;
}

function findProject(projects, ref) {
  const raw = String(ref || "").trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
  const list = projects || [];
  return (
    list.find((p) => String(p.id).toLowerCase() === key) ||
    list.find((p) => String(p.name).toLowerCase() === key) ||
    list.find((p) => String(p.name).toLowerCase().includes(key)) ||
    null
  );
}

function uniqueCopyName(baseName, projects) {
  const base = `${String(baseName || "Project").trim()} (copy)`;
  const names = new Set((projects || []).map((p) => String(p.name).toLowerCase()));
  if (!names.has(base.toLowerCase())) return base;
  let n = 2;
  while (names.has(`${base} ${n}`.toLowerCase())) n += 1;
  return `${base} ${n}`;
}

async function listProjects(args = {}) {
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  const q = String(args?.q || args?.query || args?.search || "")
    .trim()
    .toLowerCase();
  const categoryRef = String(args?.categoryId || args?.category || "").trim();
  const favoritesOnly = Boolean(args?.favorites || args?.favorite);
  let categoryId = "";
  if (categoryRef) {
    categoryId = resolveCategoryId(loaded.data.categories, categoryRef);
  }

  let projects = loaded.data.projects || [];
  if (favoritesOnly) projects = projects.filter((p) => p.favorite);
  if (categoryId && categoryId !== "all") {
    projects = projects.filter((p) => p.categoryId === categoryId);
  }
  if (q) {
    projects = projects.filter((p) => {
      const hay = [
        p.name,
        p.description,
        p.rootPath,
        p.repoUrl,
        ...(p.stack || []),
        ...(p.tags || []),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  return {
    ok: true,
    count: projects.length,
    categories: (loaded.data.categories || []).map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
    })),
    projects: projects.map(slimProject),
  };
}

async function createProject(args = {}) {
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  const data = loaded.data;
  const name = String(args?.name || "").trim() || "New project";
  const categoryId = resolveCategoryId(
    data.categories,
    args?.categoryId || args?.category || "other"
  );
  const rootPath = normalizeWinPath(args?.rootPath || args?.path || args?.folder || "");
  const stack = Array.isArray(args?.stack)
    ? args.stack
    : String(args?.stack || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
  const tags = Array.isArray(args?.tags)
    ? args.tags
    : String(args?.tags || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

  const project = normalizeProject({
    name,
    categoryId,
    icon: String(args?.icon || "🏗️").trim() || "🏗️",
    iconId: String(args?.iconId || "").trim(),
    color: String(args?.color || "").trim(),
    description: String(args?.description || "").trim(),
    stack,
    rootPath,
    repoUrl: String(args?.repoUrl || args?.repo || "").trim(),
    demoUrl: String(args?.demoUrl || args?.demo || "").trim(),
    tags,
    notes: String(args?.notes || "").trim(),
    favorite: Boolean(args?.favorite),
    watchFolder: args?.watchFolder !== false,
    builtAt: String(args?.builtAt || new Date().toISOString().slice(0, 10)).trim(),
  });

  if (rootPath) {
    const st = await statSafe(rootPath);
    if (st?.isDirectory()) {
      const scan = await scanCodeTree({ path: rootPath });
      if (scan.ok && scan.fileTree) {
        project.fileTree = scan.fileTree;
        project.rootPath = rootPath;
      }
    }
  }

  data.projects.unshift(project);
  await saveStorage({ data });
  const slim = slimProject(project);
  broadcastTreeUpdate({ action: "create", project: slim });
  return { ok: true, project: slim };
}

async function deleteProject(args = {}) {
  const ref = args?.id || args?.projectId || args?.project || args?.name;
  if (!String(ref || "").trim()) {
    return { ok: false, error: "Provide project id or name" };
  }
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  const data = loaded.data;
  const project = findProject(data.projects, ref);
  if (!project) return { ok: false, error: `Project not found: ${ref}` };

  data.projects = data.projects.filter((p) => p.id !== project.id);
  await saveStorage({ data });
  const slim = slimProject(project);
  broadcastTreeUpdate({ action: "delete", project: slim });
  return { ok: true, deleted: slim };
}

async function duplicateProject(args = {}) {
  const ref = args?.id || args?.projectId || args?.project || args?.name;
  if (!String(ref || "").trim()) {
    return { ok: false, error: "Provide project id or name to duplicate" };
  }
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  const data = loaded.data;
  const source = findProject(data.projects, ref);
  if (!source) return { ok: false, error: `Project not found: ${ref}` };

  const now = new Date().toISOString();
  const copy = normalizeProject({
    ...JSON.parse(JSON.stringify(source)),
    id: uid("proj"),
    name: String(args?.name || "").trim() || uniqueCopyName(source.name, data.projects),
    favorite: false,
    createdAt: now,
    updatedAt: now,
  });

  const idx = data.projects.findIndex((p) => p.id === source.id);
  data.projects.splice(idx >= 0 ? idx + 1 : 0, 0, copy);
  await saveStorage({ data });
  const slim = slimProject(copy);
  broadcastTreeUpdate({
    action: "duplicate",
    project: slim,
    sourceId: source.id,
    sourceName: source.name,
  });
  return { ok: true, project: slim, source: slimProject(source) };
}

function detailProject(p) {
  if (!p) return null;
  return {
    ...slimProject(p),
    notes: p.notes || "",
    links: (p.links || []).map((l) => ({ id: l.id, label: l.label, url: l.url })),
    fields: (p.fields || []).map((f) => ({ id: f.id, key: f.key, value: f.value })),
    attachments: (p.attachments || []).map((a) => ({
      id: a.id,
      path: a.path,
      name: a.name,
      type: a.type,
      description: a.description || "",
      addedAt: a.addedAt,
    })),
    subCategories: (p.subCategories || []).map((s) => ({
      id: s.id,
      name: s.name,
      icon: s.icon,
      color: s.color,
      runCommand: s.runCommand || "",
      runCwd: s.runCwd || "",
      itemCount: (s.items || []).length,
      items: (s.items || []).map((i) => ({ path: i.path, name: i.name, type: i.type })),
    })),
    hasFileTree: Boolean(p.fileTree?.children?.length),
  };
}

function parseStringList(value) {
  if (Array.isArray(value)) return value.map((s) => String(s).trim()).filter(Boolean);
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function applyTextEdit(current, args = {}) {
  let text = String(current || "");
  const mode = String(args?.mode || args?.action || "set")
    .trim()
    .toLowerCase();
  const find = args?.find != null ? String(args.find) : args?.search != null ? String(args.search) : null;
  const replacement = args?.replace != null ? String(args.replace) : args?.replacement != null ? String(args.replacement) : "";
  const chunk = args?.text != null ? String(args.text) : args?.content != null ? String(args.content) : args?.notes != null ? String(args.notes) : "";

  if (mode === "set") {
    if (args?.text != null || args?.content != null || args?.notes != null || args?.value != null || args?.description != null) {
      text =
        args?.value != null
          ? String(args.value)
          : args?.description != null && args?.text == null && args?.content == null && args?.notes == null
            ? String(args.description)
            : chunk;
    }
    return { ok: true, text, mode: "set" };
  }

  if (mode === "append" || mode === "add") {
    if (!chunk) return { ok: false, error: "text is required for append" };
    const sep = text && !text.endsWith("\n") ? "\n" : "";
    text = `${text}${sep}${chunk}`;
    return { ok: true, text, mode: "append" };
  }

  if (mode === "prepend") {
    if (!chunk) return { ok: false, error: "text is required for prepend" };
    const sep = text && !chunk.endsWith("\n") ? "\n" : "";
    text = `${chunk}${sep}${text}`;
    return { ok: true, text, mode: "prepend" };
  }

  if (mode === "remove" || mode === "delete") {
    if (find == null || find === "") return { ok: false, error: "find is required for remove" };
    if (!text.includes(find)) return { ok: false, error: `Text not found: ${find.slice(0, 80)}` };
    const all = args?.all !== false;
    text = all ? text.split(find).join("") : text.replace(find, "");
    return { ok: true, text, mode: "remove", removed: find };
  }

  if (mode === "replace" || mode === "replace_all" || mode === "substitute") {
    if (find == null || find === "") return { ok: false, error: "find is required for replace" };
    if (!text.includes(find)) return { ok: false, error: `Text not found: ${find.slice(0, 80)}` };
    const all = mode === "replace_all" || args?.all !== false;
    text = all ? text.split(find).join(replacement) : text.replace(find, replacement);
    return { ok: true, text, mode: "replace", find, replacement };
  }

  return { ok: false, error: `Unknown mode: ${mode}. Use set|append|prepend|remove|replace` };
}

async function loadProjectMutator(ref) {
  if (!String(ref || "").trim()) {
    return { ok: false, error: "Provide project id or name" };
  }
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  const data = loaded.data;
  const project = findProject(data.projects, ref);
  if (!project) return { ok: false, error: `Project not found: ${ref}` };
  return { ok: true, data, project };
}

async function persistProjectMutation(data, project, action, extra = {}) {
  project.updatedAt = new Date().toISOString();
  const idx = data.projects.findIndex((p) => p.id === project.id);
  if (idx >= 0) data.projects[idx] = project;
  await saveStorage({ data });
  const detail = detailProject(project);
  broadcastTreeUpdate({ action, project: slimProject(project), ...extra });
  return { ok: true, project: detail, ...extra };
}

async function getProject(args = {}) {
  const ref = args?.id || args?.projectId || args?.project || args?.name;
  const loaded = await loadProjectMutator(ref);
  if (!loaded.ok) return loaded;
  return { ok: true, project: detailProject(loaded.project) };
}

async function updateProject(args = {}) {
  const ref = args?.id || args?.projectId || args?.project || args?.name;
  const loaded = await loadProjectMutator(ref);
  if (!loaded.ok) return loaded;
  const { data, project } = loaded;
  const changed = [];

  if (args?.newName != null || (args?.title != null && args?.name == null)) {
    const next = String(args.newName || args.title || "").trim();
    if (next) {
      project.name = next;
      changed.push("name");
    }
  } else if (args?.rename != null) {
    const next = String(args.rename).trim();
    if (next) {
      project.name = next;
      changed.push("name");
    }
  }

  if (args?.description != null) {
    project.description = String(args.description);
    changed.push("description");
  }
  if (args?.notes != null && args?.notesMode == null && args?.mode == null) {
    project.notes = String(args.notes);
    changed.push("notes");
  }
  if (args?.categoryId != null || args?.category != null) {
    project.categoryId = resolveCategoryId(data.categories, args.categoryId || args.category);
    changed.push("categoryId");
  }
  if (args?.icon != null) {
    project.icon = String(args.icon).trim() || project.icon;
    changed.push("icon");
  }
  if (args?.color != null) {
    project.color = String(args.color).trim();
    changed.push("color");
  }
  if (args?.repoUrl != null || args?.repo != null) {
    project.repoUrl = String(args.repoUrl ?? args.repo).trim();
    changed.push("repoUrl");
  }
  if (args?.demoUrl != null || args?.demo != null) {
    project.demoUrl = String(args.demoUrl ?? args.demo).trim();
    changed.push("demoUrl");
  }
  if (args?.builtAt != null) {
    project.builtAt = String(args.builtAt).trim();
    changed.push("builtAt");
  }
  if (args?.favorite !== undefined) {
    project.favorite = Boolean(args.favorite);
    changed.push("favorite");
  }
  if (args?.watchFolder !== undefined) {
    project.watchFolder = Boolean(args.watchFolder);
    changed.push("watchFolder");
  }
  if (args?.stack != null) {
    project.stack = parseStringList(args.stack);
    changed.push("stack");
  }
  if (args?.tags != null) {
    project.tags = parseStringList(args.tags);
    changed.push("tags");
  }
  if (args?.rootPath != null || args?.path != null || args?.folder != null) {
    const rootPath = normalizeWinPath(args.rootPath || args.path || args.folder || "");
    project.rootPath = rootPath;
    changed.push("rootPath");
    if (rootPath && args?.scan !== false) {
      const st = await statSafe(rootPath);
      if (st?.isDirectory()) {
        const scan = await scanCodeTree({ path: rootPath });
        if (scan.ok && scan.fileTree) {
          project.fileTree = scan.fileTree;
          changed.push("fileTree");
        }
      }
    }
  }

  if (!changed.length) {
    return {
      ok: false,
      error:
        "No fields to update. Provide name/rename, description, notes, category, icon, stack, tags, repoUrl, demoUrl, favorite, path, etc...",
    };
  }

  return persistProjectMutation(data, project, "update", { changed });
}

async function editProjectNotes(args = {}) {
  const ref = args?.id || args?.projectId || args?.project || args?.name;
  const loaded = await loadProjectMutator(ref);
  if (!loaded.ok) return loaded;
  const { data, project } = loaded;
  const edited = applyTextEdit(project.notes, args);
  if (!edited.ok) return edited;
  project.notes = edited.text;
  return persistProjectMutation(data, project, "edit_notes", {
    notesMode: edited.mode,
    notes: project.notes,
  });
}

async function editProjectDescription(args = {}) {
  const ref = args?.id || args?.projectId || args?.project || args?.name;
  const loaded = await loadProjectMutator(ref);
  if (!loaded.ok) return loaded;
  const { data, project } = loaded;
  const edited = applyTextEdit(project.description, {
    ...args,
    text: args?.text ?? args?.content ?? args?.description,
  });
  if (!edited.ok) return edited;
  project.description = edited.text;
  return persistProjectMutation(data, project, "edit_description", {
    descriptionMode: edited.mode,
    description: project.description,
  });
}

function findAttachment(project, ref) {
  const raw = String(ref || "").trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
  const list = project.attachments || [];
  return (
    list.find((a) => String(a.id).toLowerCase() === key) ||
    list.find((a) => String(a.name).toLowerCase() === key) ||
    list.find((a) => String(a.path).toLowerCase() === key) ||
    list.find((a) => String(a.name).toLowerCase().includes(key)) ||
    list.find((a) => String(a.path).toLowerCase().includes(key)) ||
    null
  );
}

async function addAttachment(args = {}) {
  const ref = args?.id || args?.projectId || args?.project || args?.name;
  const loaded = await loadProjectMutator(ref);
  if (!loaded.ok) return loaded;
  const { data, project } = loaded;

  const paths = [];
  if (Array.isArray(args?.paths)) paths.push(...args.paths);
  if (args?.path) paths.push(args.path);
  if (args?.file) paths.push(args.file);
  if (args?.folder) paths.push(args.folder);
  const uniquePaths = [...new Set(paths.map((p) => normalizeWinPath(p)).filter(Boolean))];
  if (!uniquePaths.length) {
    return { ok: false, error: "Provide path to attach: catalog reference only, disk files are not copied or modified" };
  }

  if (!Array.isArray(project.attachments)) project.attachments = [];
  const existing = new Set(project.attachments.map((a) => String(a.path).toLowerCase()));
  const added = [];
  const skipped = [];

  for (const filePath of uniquePaths) {
    if (existing.has(filePath.toLowerCase())) {
      skipped.push(filePath);
      continue;
    }
    const st = await statSafe(filePath);
    const type =
      args?.type === "folder" || args?.type === "file"
        ? args.type
        : st?.isDirectory()
          ? "folder"
          : "file";
    const att = normalizeAttachment({
      path: filePath,
      name: args?.fileName || args?.attachmentName || path.basename(filePath),
      type,
      description: String(args?.description || args?.note || "").trim(),
    });
    if (!att) continue;
    project.attachments.push(att);
    existing.add(filePath.toLowerCase());
    added.push(att);

    if (att.type === "folder") {
      const currentRoot = normalizeWinPath(project.rootPath || project.fileTree?.root || "");
      if (!currentRoot || !fs.existsSync(currentRoot)) {
        project.rootPath = att.path;
        project.rootMissing = false;
        project.fileTree = null;
      }
    }
  }

  if (!added.length) {
    return {
      ok: false,
      error: skipped.length
        ? `Already attached: ${skipped.join(", ")}`
        : "No valid attachment paths",
      skipped,
    };
  }

  const root = normalizeWinPath(project.rootPath || "");
  if (root && (!project.fileTree?.children?.length) && fs.existsSync(root)) {
    try {
      const scan = await scanCodeTree({ path: root });
      if (scan.ok && scan.fileTree) {
        project.fileTree = scan.fileTree;
        project.rootPath = root;
        project.rootMissing = false;
      }
    } catch {
    }
  }

  return persistProjectMutation(data, project, "add_attachment", {
    added: added.map((a) => ({
      id: a.id,
      path: a.path,
      name: a.name,
      type: a.type,
      description: a.description || "",
    })),
    skipped,
    note: "Attachment is a path reference in Builds catalog only; the file/folder on disk was not modified.",
  });
}

async function removeAttachment(args = {}) {
  const ref = args?.id || args?.projectId || args?.project || args?.name;
  const loaded = await loadProjectMutator(ref);
  if (!loaded.ok) return loaded;
  const { data, project } = loaded;
  const attRef = args?.attachment || args?.attachmentId || args?.file || args?.path || args?.att;
  const att = findAttachment(project, attRef);
  if (!att) return { ok: false, error: `Attachment not found: ${attRef || "(empty)"}` };

  project.attachments = (project.attachments || []).filter((a) => a.id !== att.id);
  return persistProjectMutation(data, project, "remove_attachment", {
    removed: {
      id: att.id,
      path: att.path,
      name: att.name,
      type: att.type,
      description: att.description || "",
    },
    note: "Removed from Builds catalog only; the file/folder on disk was not deleted.",
  });
}

async function updateAttachment(args = {}) {
  const ref = args?.id || args?.projectId || args?.project || args?.name;
  const loaded = await loadProjectMutator(ref);
  if (!loaded.ok) return loaded;
  const { data, project } = loaded;
  const attRef = args?.attachment || args?.attachmentId || args?.file || args?.path || args?.att;
  const att = findAttachment(project, attRef);
  if (!att) return { ok: false, error: `Attachment not found: ${attRef || "(empty)"}` };

  if (args?.description != null || args?.note != null) {
    att.description = String(args.description ?? args.note);
  }
  if (args?.attachmentName != null || args?.fileName != null || args?.newName != null) {
    att.name = String(args.attachmentName || args.fileName || args.newName).trim() || att.name;
  }
  return persistProjectMutation(data, project, "update_attachment", {
    attachment: {
      id: att.id,
      path: att.path,
      name: att.name,
      type: att.type,
      description: att.description || "",
    },
  });
}

function findLink(project, ref) {
  const raw = String(ref || "").trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
  const list = project.links || [];
  return (
    list.find((l) => String(l.id).toLowerCase() === key) ||
    list.find((l) => String(l.label).toLowerCase() === key) ||
    list.find((l) => String(l.url).toLowerCase() === key) ||
    list.find((l) => String(l.label).toLowerCase().includes(key)) ||
    null
  );
}

async function addLink(args = {}) {
  const ref = args?.id || args?.projectId || args?.project || args?.name;
  const loaded = await loadProjectMutator(ref);
  if (!loaded.ok) return loaded;
  const { data, project } = loaded;
  const url = String(args?.url || args?.href || "").trim();
  if (!url) return { ok: false, error: "url is required" };
  const label = String(args?.label || args?.title || url).trim() || url;
  if (!Array.isArray(project.links)) project.links = [];
  const link = normalizeLink({ label, url });
  if (!link) return { ok: false, error: "Invalid link" };
  project.links.push(link);
  return persistProjectMutation(data, project, "add_link", { link });
}

async function removeLink(args = {}) {
  const ref = args?.id || args?.projectId || args?.project || args?.name;
  const loaded = await loadProjectMutator(ref);
  if (!loaded.ok) return loaded;
  const { data, project } = loaded;
  const linkRef = args?.link || args?.linkId || args?.label || args?.url;
  const link = findLink(project, linkRef);
  if (!link) return { ok: false, error: `Link not found: ${linkRef || "(empty)"}` };
  project.links = (project.links || []).filter((l) => l.id !== link.id);
  return persistProjectMutation(data, project, "remove_link", { removed: link });
}

function findField(project, ref) {
  const raw = String(ref || "").trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
  const list = project.fields || [];
  return (
    list.find((f) => String(f.id).toLowerCase() === key) ||
    list.find((f) => String(f.key).toLowerCase() === key) ||
    list.find((f) => String(f.key).toLowerCase().includes(key)) ||
    null
  );
}

async function setField(args = {}) {
  const ref = args?.id || args?.projectId || args?.project || args?.name;
  const loaded = await loadProjectMutator(ref);
  if (!loaded.ok) return loaded;
  const { data, project } = loaded;
  const key = String(args?.key || args?.field || args?.fieldKey || "").trim();
  if (!key) return { ok: false, error: "key is required" };
  const value = args?.value != null ? String(args.value) : "";
  if (!Array.isArray(project.fields)) project.fields = [];
  let field = findField(project, key);
  if (field) {
    field.key = key;
    field.value = value;
  } else {
    field = normalizeField({ key, value });
    if (!field) return { ok: false, error: "Invalid field" };
    project.fields.push(field);
  }
  return persistProjectMutation(data, project, "set_field", { field });
}

async function removeField(args = {}) {
  const ref = args?.id || args?.projectId || args?.project || args?.name;
  const loaded = await loadProjectMutator(ref);
  if (!loaded.ok) return loaded;
  const { data, project } = loaded;
  const fieldRef = args?.field || args?.fieldId || args?.key;
  const field = findField(project, fieldRef);
  if (!field) return { ok: false, error: `Field not found: ${fieldRef || "(empty)"}` };
  project.fields = (project.fields || []).filter((f) => f.id !== field.id);
  return persistProjectMutation(data, project, "remove_field", { removed: field });
}

async function linkProjectFolder(args = {}) {
  const ref = args?.id || args?.projectId || args?.project || args?.name;
  const loaded = await loadProjectMutator(ref);
  if (!loaded.ok) return loaded;
  const { data, project } = loaded;
  const rootPath = normalizeWinPath(args?.path || args?.rootPath || args?.folder || "");
  if (!rootPath) return { ok: false, error: "path is required (absolute folder path)" };
  const st = await statSafe(rootPath);
  if (!st?.isDirectory()) return { ok: false, error: `Folder not found: ${rootPath}` };

  project.rootPath = rootPath;
  if (args?.watchFolder !== undefined) project.watchFolder = Boolean(args.watchFolder);

  let scanned = false;
  if (args?.scan !== false) {
    const scan = await scanCodeTree({ path: rootPath });
    if (scan.ok && scan.fileTree) {
      project.fileTree = scan.fileTree;
      scanned = true;
    }
  }

  return persistProjectMutation(data, project, "link_folder", {
    rootPath,
    scanned,
    note: "Linked folder path in Builds catalog; folder contents on disk were not modified.",
  });
}

async function rescanProjectTree(args = {}) {
  const ref = args?.id || args?.projectId || args?.project || args?.name;
  const loaded = await loadProjectMutator(ref);
  if (!loaded.ok) return loaded;
  const { data, project } = loaded;
  const rootPath = normalizeWinPath(project.rootPath || project.fileTree?.root || args?.path || "");
  if (!rootPath) return { ok: false, error: "Project has no linked folder path" };
  const st = await statSafe(rootPath);
  if (!st?.isDirectory()) return { ok: false, error: `Folder not found: ${rootPath}` };

  const scan = await scanCodeTree({ path: rootPath });
  if (!scan.ok || !scan.fileTree) return scan || { ok: false, error: "Scan failed" };
  project.fileTree = scan.fileTree;
  project.rootPath = rootPath;
  return persistProjectMutation(data, project, "rescan", {
    fileCount: scan.fileTree.fileCount,
    dirCount: scan.fileTree.dirCount,
    scannedAt: scan.fileTree.scannedAt,
    note: "Refreshed Builds file-tree snapshot only; files on disk were not modified.",
  });
}

let refreshInProgress = false;

function notifyLinkedFolderMissing(project, root) {
  try {
    const { push } = require("./notifications-center");
    const name = String(project?.name || "Project").trim() || "Project";
    const pathLabel = String(root || project?.rootPath || "").trim();
    push({
      appId: "builds",
      type: "folder-missing",
      title: "Linked folder missing",
      body: pathLabel ? `${name}: ${pathLabel} is no longer available.` : `${name}: linked folder is missing.`,
      dedupeKey: `builds:missing:${project.id}`,
      route: { projectId: project.id },
      priority: "high",
    });
  } catch {
  }
}

async function refreshLinkedProjectTrees(args = {}) {
  if (refreshInProgress) {
    return { ok: true, skipped: true, reason: "scan-in-progress" };
  }

  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;

  const data = loaded.data;
  const force = Boolean(args?.force);
  if (!force && data.settings.autoRefreshEnabled === false) {
    return { ok: true, skipped: true, reason: "disabled" };
  }

  const targets = (data.projects || []).filter((p) => {
    const root = String(p.rootPath || p.fileTree?.root || "").trim();
    return root && p.watchFolder !== false;
  });

  if (!targets.length) {
    return { ok: true, refreshed: 0, updated: [] };
  }

  refreshInProgress = true;
  const updated = [];
  const missing = [];
  let touched = false;

  try {
    for (const project of targets) {
      const root = normalizeWinPath(project.rootPath || project.fileTree?.root);
      const st = await statSafe(root);
      if (!st?.isDirectory()) {
        if (!project.rootMissing) {
          project.rootMissing = true;
          missing.push({ id: project.id, name: project.name, root, error: "Folder missing" });
          notifyLinkedFolderMissing(project, root);
          touched = true;
        }
        continue;
      }

      if (project.rootMissing) {
        project.rootMissing = false;
        touched = true;
      }

      const scan = await scanCodeTree({ path: root });
      if (!scan.ok || !scan.fileTree) continue;

      project.fileTree = scan.fileTree;
      project.rootPath = root;
      project.updatedAt = new Date().toISOString();
      updated.push({
        id: project.id,
        name: project.name,
        fileCount: scan.fileTree.fileCount || 0,
        dirCount: scan.fileTree.dirCount || 0,
        scannedAt: scan.fileTree.scannedAt,
      });
      touched = true;
    }

    if (touched) {
      data.settings.lastAutoRefreshAt = new Date().toISOString();
      await saveStorage({ data });
      broadcastTreeUpdate({
        refreshed: updated.length,
        updated,
        missing,
        settings: data.settings,
      });
    }

    return { ok: true, refreshed: updated.length, updated, missing, settings: data.settings };
  } finally {
    refreshInProgress = false;
  }
}

const CHANNELS = {
  "storage.load": () => loadStorage(),
  "storage.save": (args) => saveStorage(args),
  "projects.list": (args) => listProjects(args),
  "projects.get": (args) => getProject(args),
  "projects.create": (args) => createProject(args),
  "projects.update": (args) => updateProject(args),
  "projects.delete": (args) => deleteProject(args),
  "projects.duplicate": (args) => duplicateProject(args),
  "projects.editNotes": (args) => editProjectNotes(args),
  "projects.editDescription": (args) => editProjectDescription(args),
  "projects.addAttachment": (args) => addAttachment(args),
  "projects.removeAttachment": (args) => removeAttachment(args),
  "projects.updateAttachment": (args) => updateAttachment(args),
  "projects.addLink": (args) => addLink(args),
  "projects.removeLink": (args) => removeLink(args),
  "projects.setField": (args) => setField(args),
  "projects.removeField": (args) => removeField(args),
  "projects.linkFolder": (args) => linkProjectFolder(args),
  "projects.rescan": (args) => rescanProjectTree(args),
  "links.open": (args) => openLink(args),
  "folder.open": (args) => openFolder(args),
  "folder.pick": (args) => pickFolder(args),
  "file.pick": (args) => pickFiles(args),
  "file.open": (args) => openFile(args),
  "clipboard.copy": (args) => copyText(args),
  "data.export": () => exportData(),
  "data.import": (args) => importData(args),
  "tree.scan": (args) => scanCodeTree(args),
  "trees.refreshAll": (args) => refreshLinkedProjectTrees(args),
  "trees.recountStats": (args) => recountStaleExactStats(args),
  "file.read": (args) => readFilePreview(args),
  "msl.list": (args) => {
    const { handleMslInvoke } = require("../msl/broker");
    return handleMslInvoke("builds", "msl.list", args || {});
  },
  "msl.invoke": (args) => {
    const { handleMslInvoke } = require("../msl/broker");
    return handleMslInvoke("builds", "msl.invoke", args || {});
  },
};

async function handleBuildsInvoke(channel, args) {
  const authErr = signedInGuard();
  if (authErr) return authErr;
  const handler = CHANNELS[channel];
  if (!handler) return { ok: false, error: `Unknown channel: ${channel}` };
  try {
    return await handler(args);
  } catch (err) {
    return { ok: false, error: err.message || "Request failed" };
  }
}

module.exports = {
  handleBuildsInvoke,
  loadStorage,
  saveStorage,
  refreshLinkedProjectTrees,
};