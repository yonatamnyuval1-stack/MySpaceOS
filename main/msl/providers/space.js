const { handleSpaceInvoke } = require("../../apps/space-ipc");

function slimBody(body) {
  if (!body || typeof body !== "object") return null;
  return {
    id: body.id,
    name: body.name,
    category: body.category,
    type: body.type,
    parentId: body.parentId || null,
    summary: body.summary || body.description || "",
    wikiTitle: body.wikiTitle || null,
    image: body.image || body.thumb || null,
  };
}

async function searchBodies(input = {}) {
  const res = await handleSpaceInvoke("catalog.list", {
    q: input.q || input.query || "",
    category: input.category || "all",
  });
  if (!res?.ok) return res || { ok: false, error: "Space catalog failed" };
  const limit = Math.min(Math.max(Number(input.limit) || 40, 1), 120);
  const bodies = (res.bodies || []).slice(0, limit).map(slimBody).filter(Boolean);
  return {
    ok: true,
    bodies,
    total: bodies.length,
    catalogTotal: (res.bodies || []).length,
    updatedAt: res.updatedAt || null,
  };
}

async function getBody(input = {}) {
  const id = String(input.id || "").trim();
  if (!id) return { ok: false, error: "Missing body id" };
  const res = await handleSpaceInvoke("catalog.get", {
    id,
    skipWiki: !input.includeWiki,
  });
  if (!res?.ok) return res;
  return {
    ok: true,
    body: slimBody(res.body) || res.body,
    children: Array.isArray(res.children) ? res.children.map(slimBody).filter(Boolean) : [],
    wiki: res.wiki || null,
  };
}

async function getWiki(input = {}) {
  const title = String(input.title || "").trim();
  if (!title) return { ok: false, error: "Missing wiki title" };
  return handleSpaceInvoke("wiki.get", { title });
}

async function openLink(input = {}) {
  const url = String(input.url || "").trim();
  if (!url) return { ok: false, error: "Missing url" };
  return handleSpaceInvoke("link.open", { url });
}

const CAPABILITIES = [
  {
    id: "space.bodies.search",
    kind: "query",
    provider: "space",
    title: "Search space bodies",
    description: "Search the Space catalog by name or category",
    handler: searchBodies,
  },
  {
    id: "space.bodies.get",
    kind: "query",
    provider: "space",
    title: "Get space body",
    description: "Fetch one body (planet, moon, star, …) by id",
    handler: getBody,
  },
  {
    id: "space.wiki.get",
    kind: "query",
    provider: "space",
    title: "Space Wikipedia blurb",
    description: "Fetch Wikipedia enrichment for a space topic title",
    handler: getWiki,
  },
  {
    id: "space.link.open",
    kind: "action",
    provider: "space",
    title: "Open space link",
    description: "Open an external URL from Space (NASA, wiki, …)",
    handler: openLink,
  },
];

module.exports = { CAPABILITIES };