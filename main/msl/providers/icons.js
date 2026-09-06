const path = require("path");

let data = null;

function loadData() {
  if (data) return data;
  require(path.join(__dirname, "..", "..", "..", "apps", "icon-library", "icons-data.js"));
  data = globalThis.IconLibraryData;
  if (!data?.search || !data?.getById) {
    throw new Error("Icon Library catalog failed to load");
  }
  return data;
}

function summarize(icon, opts = {}) {
  if (!icon) return null;
  const D = loadData();
  const size = Number(opts.size) || 24;
  const stroke = Number(opts.strokeWidth) || 2;
  const color = opts.color || "currentColor";
  return {
    id: icon.id,
    name: icon.name,
    pack: icon.pack,
    tags: icon.tags || [],
    svg: D.toSvg(icon, { size, strokeWidth: stroke, color }),
  };
}

async function search(input = {}) {
  const D = loadData();
  const q = String(input.q || input.query || "").trim();
  const pack = String(input.pack || "all").trim() || "all";
  const limit = Math.min(Math.max(Number(input.limit) || 48, 1), 120);
  const size = Number(input.size) || 24;
  const list = D.search(q, pack).slice(0, limit).map((icon) => summarize(icon, { size }));
  return { ok: true, icons: list, total: list.length, catalogSize: D.count };
}

async function get(input = {}) {
  const D = loadData();
  const size = Number(input.size) || 24;
  const stroke = Number(input.strokeWidth) || 2;
  const color = input.color || "currentColor";

  if (Array.isArray(input.ids)) {
    const ids = input.ids.map((id) => String(id || "").trim()).filter(Boolean).slice(0, 200);
    const icons = ids
      .map((id) => D.getById(id))
      .filter(Boolean)
      .map((icon) => summarize(icon, { size, strokeWidth: stroke, color }));
    return { ok: true, icons };
  }

  const id = String(input.id || "").trim();
  if (!id) return { ok: false, error: "Missing icon id" };
  const icon = D.getById(id);
  if (!icon) return { ok: false, error: `Unknown icon: ${id}` };
  return {
    ok: true,
    icon: {
      ...summarize(icon, { size, strokeWidth: stroke, color }),
      paths: icon.paths,
    },
  };
}

async function pick() {
  return {
    ok: true,
    mode: "client-modal",
    search: "icons.search",
    get: "icons.get",
  };
}

const CAPABILITIES = [
  {
    id: "icons.search",
    kind: "query",
    provider: "icon-library",
    title: "Search icons",
    description: "Search the Lucide icon catalog by name, id, pack, or tags",
    handler: search,
  },
  {
    id: "icons.get",
    kind: "query",
    provider: "icon-library",
    title: "Get icon",
    description: "Fetch one or many icons by id",
    handler: get,
  },
  {
    id: "icons.pick",
    kind: "ui",
    provider: "icon-library",
    title: "Pick icon",
    description: "Open an icon picker",
    handler: pick,
  },
];

module.exports = { CAPABILITIES, loadData };
