const { handleHistoryInvoke } = require("../../apps/history-ipc");

function filterByQuery(list, q, fields) {
  const needle = String(q || "").trim().toLowerCase();
  if (!needle) return list;
  return list.filter((item) => {
    const hay = fields.map((f) => String(item?.[f] || "")).join(" ").toLowerCase();
    return hay.includes(needle);
  });
}

async function listFigures(input = {}) {
  const res = await handleHistoryInvoke("figures.list", {});
  if (!res?.ok) return res;
  let figures = res.figures || [];
  figures = filterByQuery(figures, input.q || input.query, ["id", "name", "title", "summary", "era"]);
  const limit = Math.min(Math.max(Number(input.limit) || 60, 1), 200);
  return {
    ok: true,
    figures: figures.slice(0, limit).map((f) => ({
      id: f.id,
      name: f.name || f.title,
      era: f.era || null,
      summary: f.summary || f.blurb || "",
      type: "figure",
    })),
    total: figures.length,
  };
}

async function listEvents(input = {}) {
  const res = await handleHistoryInvoke("events.list", {});
  if (!res?.ok) return res;
  let events = res.events || [];
  events = filterByQuery(events, input.q || input.query, ["id", "name", "title", "summary", "era", "year"]);
  const limit = Math.min(Math.max(Number(input.limit) || 60, 1), 200);
  return {
    ok: true,
    events: events.slice(0, limit).map((e) => ({
      id: e.id,
      name: e.name || e.title,
      year: e.year || null,
      era: e.era || null,
      summary: e.summary || e.blurb || "",
      type: "event",
    })),
    total: events.length,
  };
}

async function getEntity(input = {}) {
  const id = String(input.id || "").trim();
  if (!id) return { ok: false, error: "Missing entity id" };
  return handleHistoryInvoke("entity.get", {
    id,
    type: input.type,
    wikiLang: input.wikiLang,
  });
}

async function openLink(input = {}) {
  const url = String(input.url || "").trim();
  if (!url) return { ok: false, error: "Missing url" };
  return handleHistoryInvoke("link.open", { url });
}

const CAPABILITIES = [
  {
    id: "history.figures.list",
    kind: "query",
    provider: "history",
    title: "List historical figures",
    description: "Figures catalog with optional text filter",
    handler: listFigures,
  },
  {
    id: "history.events.list",
    kind: "query",
    provider: "history",
    title: "List historical events",
    description: "Events catalog with optional text filter",
    handler: listEvents,
  },
  {
    id: "history.entity.get",
    kind: "query",
    provider: "history",
    title: "Get history entity",
    description: "Fetch one figure or event by id (with optional wiki)",
    handler: getEntity,
  },
  {
    id: "history.link.open",
    kind: "action",
    provider: "history",
    title: "Open history link",
    description: "Open an external history/wiki URL",
    handler: openLink,
  },
];

module.exports = { CAPABILITIES };
