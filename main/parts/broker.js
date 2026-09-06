const fs = require("fs");
const path = require("path");
const {
  discoverAll,
  findPart,
  readPartFiles,
  listAppModules,
  listPublishedByApp,
  APPS_DIR,
  SHARED_DIR,
} = require("./discover");

function summarize(part) {
  return {
    id: part.id,
    contract: part.contract,
    version: part.version,
    kind: part.kind,
    title: part.title,
    summary: part.summary,
    tags: part.tags,
    api: part.api,
    usage: part.usage,
    mslCapability: part.mslCapability || "",
    files: part.files,
    entry: part.entry,
    origin: part.origin,
    publishedBy: part.moduleId || null,
    publishers: Array.isArray(part.publishers)
      ? part.publishers
      : part.moduleId
        ? [part.moduleId]
        : [],
    publishedAt: part.publishedAt || null,
  };
}

function listParts(args = {}) {
  const q = String(args.q || args.query || "")
    .trim()
    .toLowerCase();
  const kind = String(args.kind || "").trim().toLowerCase();
  const publisher = String(args.app || args.publisher || args.moduleId || "")
    .trim()
    .toLowerCase();
  let parts = discoverAll().map(summarize);
  if (kind) parts = parts.filter((p) => p.kind === kind);
  if (publisher) {
    parts = parts.filter(
      (p) =>
        p.publishedBy === publisher ||
        (p.publishers || []).map((x) => String(x).toLowerCase()).includes(publisher)
    );
  }
  if (q) {
    parts = parts.filter((p) =>
      `${p.id} ${p.title} ${p.summary} ${p.tags.join(" ")} ${(p.publishers || []).join(" ")}`
        .toLowerCase()
        .includes(q)
    );
  }
  return { ok: true, parts, count: parts.length };
}

function getPart(args = {}) {
  const part = findPart(args.id || args.part || args.contract);
  if (!part) return { ok: false, error: "Part not found" };
  const body = readPartFiles(part);
  return {
    ok: true,
    part: summarize(part),
    files: body.ok ? body.files : {},
  };
}

function safeModuleId(id) {
  const s = String(id || "").trim();
  if (!/^[a-z0-9][a-z0-9_-]{0,64}$/i.test(s)) return null;
  return s;
}

function safePartId(id) {
  const s = String(id || "")
    .trim()
    .toLowerCase();
  if (!/^[a-z][a-z0-9]*(\.[a-z0-9-]+)+$/.test(s)) return null;
  return s;
}

function safeRelFile(name) {
  const s = String(name || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .trim();
  if (!s || s.includes("..") || path.isAbsolute(s)) return null;
  if (!/^[a-zA-Z0-9._/-]+$/.test(s)) return null;
  return s;
}

function adoptPart(args = {}) {
  const part = findPart(args.id || args.part || args.contract);
  if (!part) return { ok: false, error: "Part not found" };
  const target = safeModuleId(args.target || args.app || args.moduleId);
  if (!target) return { ok: false, error: "target app module id required" };
  const appDir = path.join(APPS_DIR, target);
  if (!fs.existsSync(appDir)) {
    return { ok: false, error: `App folder not found: apps/${target}` };
  }

  const destDir = path.join(appDir, "parts", part.id);
  fs.mkdirSync(destDir, { recursive: true });

  const body = readPartFiles(part);
  if (!body.ok) return body;
  const written = [];
  for (const [rel, content] of Object.entries(body.files || {})) {
    const dest = path.join(destDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content, "utf8");
    written.push(rel);
  }

  fs.writeFileSync(
    path.join(destDir, "part.json"),
    JSON.stringify(
      {
        id: part.id,
        version: part.version,
        kind: part.kind,
        title: part.title,
        summary: part.summary,
        tags: part.tags,
        entry: part.entry,
        files: part.files,
        api: part.api,
        usage: part.usage,
        adoptedAt: new Date().toISOString(),
      },
      null,
      2
    ),
    "utf8"
  );

  return {
    ok: true,
    part: summarize(part),
    target,
    dest: `apps/${target}/parts/${part.id}`,
    files: written,
    hint: `Import from ./parts/${part.id}/${part.entry}`,
  };
}

function listAdoptTargets() {
  return { ok: true, apps: listAppModules() };
}

function readAppCatalog(moduleId) {
  const catalogPath = path.join(APPS_DIR, moduleId, "parts.json");
  const raw = fs.existsSync(catalogPath)
    ? (() => {
        try {
          return JSON.parse(fs.readFileSync(catalogPath, "utf8"));
        } catch {
          return null;
        }
      })()
    : null;
  return {
    path: catalogPath,
    data: raw && typeof raw === "object" ? raw : { note: "Parts published by this app", exports: [] },
  };
}

function writeAppCatalog(moduleId, data) {
  const catalogPath = path.join(APPS_DIR, moduleId, "parts.json");
  fs.writeFileSync(catalogPath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function upsertCatalogExport(moduleId, partId) {
  const { data } = readAppCatalog(moduleId);
  if (!Array.isArray(data.exports)) data.exports = [];
  const dir = `parts/${partId}`;
  const without = data.exports.filter((item) => {
    if (!item || typeof item !== "object") return true;
    if (item.ref) {
      const ref = String(item.ref)
        .toLowerCase()
        .replace(/^parts:/, "")
        .replace(/@\d+$/, "");
      return ref !== partId;
    }
    const id = String(item.id || "").toLowerCase();
    const d = String(item.dir || item.path || "").replace(/\\/g, "/");
    return id !== partId && d !== dir && d !== `parts/${partId}`;
  });
  without.push({ id: partId, dir, note: "Published from Parts app" });
  data.exports = without;
  if (!data.note) data.note = "Parts published by this app";
  writeAppCatalog(moduleId, data);
}

function removeCatalogExport(moduleId, partId) {
  const { path: catalogPath, data } = readAppCatalog(moduleId);
  if (!fs.existsSync(catalogPath)) return;
  if (!Array.isArray(data.exports)) return;
  data.exports = data.exports.filter((item) => {
    if (!item || typeof item !== "object") return true;
    if (item.ref) {
      const ref = String(item.ref)
        .toLowerCase()
        .replace(/^parts:/, "")
        .replace(/@\d+$/, "");
      return ref !== partId;
    }
    const id = String(item.id || "").toLowerCase();
    const d = String(item.dir || item.path || "").replace(/\\/g, "/");
    return id !== partId && d !== `parts/${partId}`;
  });
  writeAppCatalog(moduleId, data);
}

function publishPart(args = {}) {
  const app = safeModuleId(args.app || args.moduleId || args.publisher);
  if (!app) return { ok: false, error: "app module id required" };
  const appDir = path.join(APPS_DIR, app);
  if (!fs.existsSync(appDir)) {
    return { ok: false, error: `App folder not found: apps/${app}` };
  }

  const id = safePartId(args.id || args.part);
  if (!id) {
    return {
      ok: false,
      error: "Invalid part id — use dotted form like notes.helpers or search.fuzzy",
    };
  }

  const filesIn = args.files && typeof args.files === "object" ? args.files : null;
  if (!filesIn || !Object.keys(filesIn).length) {
    return { ok: false, error: "files object required — { \"index.js\": \"…\" }" };
  }

  const fileMap = {};
  for (const [rawName, content] of Object.entries(filesIn)) {
    const rel = safeRelFile(rawName);
    if (!rel) return { ok: false, error: `Invalid file name: ${rawName}` };
    if (typeof content !== "string") {
      return { ok: false, error: `File content must be text: ${rel}` };
    }
    if (content.length > 800_000) {
      return { ok: false, error: `File too large: ${rel}` };
    }
    fileMap[rel] = content;
  }

  const entry = safeRelFile(args.entry) || Object.keys(fileMap)[0];
  if (!fileMap[entry]) {
    return { ok: false, error: `entry file missing from files: ${entry}` };
  }

  const version = Math.max(1, Number(args.version) || 1);
  const kind = ["util", "ui", "data", "adapter"].includes(args.kind) ? args.kind : "util";
  const tags = Array.isArray(args.tags)
    ? args.tags.map(String).slice(0, 12)
    : String(args.tags || "")
        .split(/[, ]+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 12);

  const meta = {
    id,
    version,
    kind,
    title: String(args.title || id).slice(0, 80),
    summary: String(args.summary || "").slice(0, 400),
    tags,
    entry,
    files: Object.keys(fileMap),
    api: args.api && typeof args.api === "object" ? args.api : {},
    usage: String(args.usage || `const mod = require('./parts/${id}');`).slice(0, 800),
    publishedAt: new Date().toISOString(),
  };

  const destDir = path.join(appDir, "parts", id);
  fs.mkdirSync(destDir, { recursive: true });

  const written = [];
  for (const [rel, content] of Object.entries(fileMap)) {
    const dest = path.join(destDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content, "utf8");
    written.push(rel);
  }
  fs.writeFileSync(path.join(destDir, "part.json"), JSON.stringify(meta, null, 2) + "\n", "utf8");

  upsertCatalogExport(app, id);

  if (args.shared === true || args.promote === true) {
    const sharedDir = path.join(SHARED_DIR, id);
    fs.mkdirSync(sharedDir, { recursive: true });
    for (const [rel, content] of Object.entries(fileMap)) {
      const dest = path.join(sharedDir, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, content, "utf8");
    }
    const sharedMeta = { ...meta };
    delete sharedMeta.publishedAt;
    fs.writeFileSync(path.join(sharedDir, "part.json"), JSON.stringify(sharedMeta, null, 2) + "\n", "utf8");
  }

  const part = findPart(id);
  return {
    ok: true,
    part: part ? summarize(part) : meta,
    app,
    dest: `apps/${app}/parts/${id}`,
    files: written,
    shared: Boolean(args.shared || args.promote),
  };
}

function unpublishPart(args = {}) {
  const app = safeModuleId(args.app || args.moduleId || args.publisher);
  if (!app) return { ok: false, error: "app module id required" };
  const id = safePartId(args.id || args.part);
  if (!id) return { ok: false, error: "part id required" };

  const destDir = path.join(APPS_DIR, app, "parts", id);
  if (!fs.existsSync(destDir)) {
    return { ok: false, error: `No published part at apps/${app}/parts/${id}` };
  }

  const meta = (() => {
    try {
      return JSON.parse(fs.readFileSync(path.join(destDir, "part.json"), "utf8"));
    } catch {
      return null;
    }
  })();
  if (meta?.adoptedAt && args.force !== true) {
    return {
      ok: false,
      error: "This folder is an adopt (install), not a publish. Pass force:true to delete anyway.",
    };
  }

  fs.rmSync(destDir, { recursive: true, force: true });
  removeCatalogExport(app, id);

  return { ok: true, app, id, removed: `apps/${app}/parts/${id}` };
}

function listPublished(args = {}) {
  const app = safeModuleId(args.app || args.moduleId);
  if (!app) {
    const apps = listAppModules().map((moduleId) => {
      const parts = listPublishedByApp(moduleId).map(summarize);
      return { app: moduleId, count: parts.length, parts };
    });
    return { ok: true, apps: apps.filter((a) => a.count > 0), all: apps };
  }
  return {
    ok: true,
    app,
    parts: listPublishedByApp(app).map(summarize),
  };
}

async function handlePartsInvoke(channel, args = {}) {
  const ch = String(channel || "").trim();
  switch (ch) {
    case "parts.list":
      return listParts(args);
    case "parts.get":
      return getPart(args);
    case "parts.adopt":
      return adoptPart(args);
    case "parts.publish":
      return publishPart(args);
    case "parts.unpublish":
      return unpublishPart(args);
    case "parts.published":
      return listPublished(args);
    case "parts.targets":
      return listAdoptTargets();
    case "parts.reload":
      return listParts(args);
    default:
      return { ok: false, error: `Unknown parts channel: ${ch}` };
  }
}

module.exports = {
  handlePartsInvoke,
  listParts,
  getPart,
  adoptPart,
  publishPart,
  unpublishPart,
};
