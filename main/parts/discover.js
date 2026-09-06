const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const SHARED_DIR = path.join(ROOT, "shared", "parts");
const APPS_DIR = path.join(ROOT, "apps");
const PLATFORM_PARTS = path.join(ROOT, "config", "platform-parts.json");

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

function normalizePart(raw, { origin = "shared", moduleId = null, baseDir } = {}) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id || "").trim().toLowerCase();
  if (!id || !/^[a-z][a-z0-9]*(\.[a-z0-9-]+)+$/.test(id)) return null;
  const version = Math.max(1, Number(raw.version) || 1);
  const kind = ["util", "ui", "data", "adapter"].includes(raw.kind) ? raw.kind : "util";
  const files = Array.isArray(raw.files)
    ? raw.files.map((f) => String(f).replace(/\\/g, "/")).filter(Boolean)
    : [];
  const entry = String(raw.entry || files[0] || "index.js").replace(/\\/g, "/");
  if (!files.includes(entry)) files.unshift(entry);

  return {
    id,
    version,
    kind,
    title: String(raw.title || id).slice(0, 80),
    summary: String(raw.summary || "").slice(0, 400),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String).slice(0, 12) : [],
    api: raw.api && typeof raw.api === "object" ? raw.api : {},
    usage: String(raw.usage || "").slice(0, 800),
    mslCapability: raw.mslCapability ? String(raw.mslCapability) : "",
    files: [...new Set(files)],
    entry,
    origin,
    moduleId: moduleId || null,
    publisher: raw.publisher ? String(raw.publisher).trim() : null,
    baseDir,
    contract: `parts:${id}@${version}`,
    adopted: Boolean(raw.adoptedAt),
    publishedAt: raw.publishedAt || null,
  };
}

function discoverShared() {
  const out = [];
  for (const name of listDirs(SHARED_DIR)) {
    const baseDir = path.join(SHARED_DIR, name);
    const meta = readJsonSafe(path.join(baseDir, "part.json"));
    const part = normalizePart(meta || { id: name.replace(/-/g, ".") }, {
      origin: "shared",
      baseDir,
    });
    if (part) out.push(part);
  }
  return out;
}

function discoverAppFolders() {
  const published = [];
  const credits = new Map();
  if (!fs.existsSync(APPS_DIR)) return { published, credits };

  for (const entry of fs.readdirSync(APPS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const moduleId = entry.name;
    const partsRoot = path.join(APPS_DIR, moduleId, "parts");
    if (!fs.existsSync(partsRoot)) continue;

    for (const folder of listDirs(partsRoot)) {
      const baseDir = path.join(partsRoot, folder);
      const meta = readJsonSafe(path.join(baseDir, "part.json"));
      const idHint = (meta && meta.id) || folder.replace(/-/g, ".");
      const part = normalizePart(meta || { id: idHint, files: guessFiles(baseDir) }, {
        origin: "app",
        moduleId,
        baseDir,
      });
      if (!part) continue;

      if (part.adopted) {
        if (!credits.has(part.id)) credits.set(part.id, []);
        credits.get(part.id).push(moduleId);
        continue;
      }

      published.push(part);
      if (!credits.has(part.id)) credits.set(part.id, []);
      credits.get(part.id).push(moduleId);
    }
  }
  return { published, credits };
}

function guessFiles(baseDir) {
  try {
    return fs
      .readdirSync(baseDir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name !== "part.json")
      .map((e) => e.name);
  } catch {
    return ["index.js"];
  }
}

function discoverFromPartsJson() {
  const out = [];
  const credits = new Map();
  if (!fs.existsSync(APPS_DIR)) return { parts: out, credits };

  for (const entry of fs.readdirSync(APPS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const moduleId = entry.name;
    const catalogPath = path.join(APPS_DIR, moduleId, "parts.json");
    const catalog = readJsonSafe(catalogPath);
    if (!catalog) continue;

    const exports = Array.isArray(catalog.exports) ? catalog.exports : [];
    for (const item of exports) {
      if (item?.ref) {
        const ref = String(item.ref)
          .trim()
          .toLowerCase()
          .replace(/^parts:/, "")
          .replace(/@\d+$/, "");
        if (!ref) continue;
        if (!credits.has(ref)) credits.set(ref, []);
        credits.get(ref).push(moduleId);
        continue;
      }
      const relDir = String(item.dir || item.path || `parts/${item.id || ""}`).replace(/\\/g, "/");
      const baseDir = path.isAbsolute(relDir)
        ? relDir
        : path.join(APPS_DIR, moduleId, relDir);
      const localMeta = readJsonSafe(path.join(baseDir, "part.json"));
      if (!localMeta && !fs.existsSync(baseDir)) continue;
      const merged = { ...(localMeta || {}), ...(item || {}) };
      delete merged.adoptedAt;
      delete merged.ref;
      delete merged.dir;
      delete merged.path;
      delete merged.note;
      const part = normalizePart(merged, {
        origin: "app",
        moduleId,
        baseDir,
      });
      if (part) out.push(part);
    }
  }
  return { parts: out, credits };
}

function mergeCredits(into, from) {
  for (const [id, mods] of from) {
    if (!into.has(id)) into.set(id, []);
    into.get(id).push(...mods);
  }
}

function discoverPlatformCredits() {
  const credits = new Map();
  const catalog = readJsonSafe(PLATFORM_PARTS);
  if (!catalog?.services || typeof catalog.services !== "object") return credits;

  for (const [serviceId, items] of Object.entries(catalog.services)) {
    const sid = String(serviceId || "").trim();
    if (!sid || !Array.isArray(items)) continue;
    for (const item of items) {
      const ref = String(item?.ref || "")
        .trim()
        .toLowerCase()
        .replace(/^parts:/, "")
        .replace(/@\d+$/, "");
      if (!ref) continue;
      if (!credits.has(ref)) credits.set(ref, []);
      credits.get(ref).push(sid);
    }
  }
  return credits;
}

function discoverAll() {
  const byId = new Map();
  for (const part of discoverShared()) byId.set(part.id, part);

  const folder = discoverAppFolders();
  const json = discoverFromPartsJson();
  const platform = discoverPlatformCredits();
  const credits = new Map();
  mergeCredits(credits, folder.credits);
  mergeCredits(credits, json.credits);
  mergeCredits(credits, platform);

  for (const part of [...folder.published, ...json.parts]) {
    const prev = byId.get(part.id);
    if (!prev) {
      byId.set(part.id, part);
      continue;
    }
    if (part.version > prev.version) {
      byId.set(part.id, part);
    } else if (part.version === prev.version && prev.origin !== "shared" && part.origin === "app") {
      byId.set(part.id, part);
    }
  }

  for (const [id, part] of byId) {
    const pubs = [...new Set((credits.get(id) || []).filter(Boolean))];
    if (part.publisher && !pubs.includes(part.publisher)) pubs.push(part.publisher);
    if (part.moduleId && !pubs.includes(part.moduleId)) pubs.unshift(part.moduleId);
    part.publishers = pubs;
    if (!part.moduleId && pubs.length) part.moduleId = pubs[0];
  }

  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function findPart(id) {
  const key = String(id || "")
    .trim()
    .toLowerCase()
    .replace(/^parts:/, "")
    .replace(/@\d+$/, "");
  return discoverAll().find((p) => p.id === key) || null;
}

function readPartFiles(part) {
  if (!part?.baseDir) return { ok: false, error: "Part has no files" };
  const files = {};
  for (const rel of part.files || []) {
    const full = path.join(part.baseDir, rel);
    if (!full.startsWith(part.baseDir) || !fs.existsSync(full)) continue;
    try {
      files[rel] = fs.readFileSync(full, "utf8");
    } catch {
    }
  }
  return { ok: true, files, entry: part.entry };
}

function listAppModules() {
  if (!fs.existsSync(APPS_DIR)) return [];
  return fs
    .readdirSync(APPS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((n) => !n.startsWith("."))
    .sort();
}

function listPublishedByApp(moduleId) {
  const id = String(moduleId || "").trim();
  if (!id) return [];
  const partsRoot = path.join(APPS_DIR, id, "parts");
  const out = [];
  if (fs.existsSync(partsRoot)) {
    for (const folder of listDirs(partsRoot)) {
      const baseDir = path.join(partsRoot, folder);
      const meta = readJsonSafe(path.join(baseDir, "part.json"));
      if (meta?.adoptedAt) continue;
      const part = normalizePart(meta || { id: folder.replace(/-/g, "."), files: guessFiles(baseDir) }, {
        origin: "app",
        moduleId: id,
        baseDir,
      });
      if (part) out.push(part);
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

module.exports = {
  discoverAll,
  findPart,
  readPartFiles,
  listAppModules,
  listPublishedByApp,
  SHARED_DIR,
  APPS_DIR,
};