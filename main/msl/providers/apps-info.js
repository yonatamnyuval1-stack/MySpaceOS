const { handleAppsInfoInvoke } = require("../../apps/apps-info-ipc");

async function listApps(input = {}) {
  const res = await handleAppsInfoInvoke("catalog.list", {});
  if (!res?.ok) return res;
  const type = String(input.type || "").trim().toLowerCase();
  let apps = res.apps || [];
  if (type) {
    apps = apps.filter((a) => String(a.type || "").toLowerCase() === type);
  }
  const q = String(input.q || input.query || "").trim().toLowerCase();
  if (q) {
    apps = apps.filter((a) => {
      const hay = [a.id, a.name, a.tagline, a.description].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }
  const limit = Math.min(Math.max(Number(input.limit) || 80, 1), 200);
  const slim = apps.slice(0, limit).map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    typeLabel: a.typeLabel,
    icon: a.icon,
    tagline: a.tagline,
    module: a.module,
    lastDataAt: a.lastDataAt || null,
  }));
  return {
    ok: true,
    apps: slim,
    count: slim.length,
    catalogTotal: (res.apps || []).length,
    generatedAt: res.generatedAt || null,
  };
}

async function getApp(input = {}) {
  const id = String(input.id || "").trim();
  if (!id) return { ok: false, error: "Missing app id" };
  const res = await handleAppsInfoInvoke("catalog.detail", { id });
  if (!res?.ok) return res;
  return {
    ok: true,
    app: res.app
      ? {
          id: res.app.id,
          name: res.app.name,
          type: res.app.type,
          icon: res.app.icon,
          description: res.app.description,
          tagline: res.app.tagline,
          module: res.app.module,
        }
      : null,
    profile: res.profile || null,
    live: res.live || null,
    timeline: Array.isArray(res.timeline) ? res.timeline.slice(0, 25) : [],
    storage: Array.isArray(res.storage) ? res.storage.slice(0, 40) : [],
  };
}

async function getDigest(input = {}) {
  const id = String(input.id || "").trim();
  if (!id) return { ok: false, error: "Missing app id" };
  const res = await handleAppsInfoInvoke("catalog.detail", { id });
  if (!res?.ok) return res;
  const live = res.live || { stats: {}, events: [], highlights: [] };
  return {
    ok: true,
    id,
    name: res.app?.name || id,
    stats: live.stats || {},
    events: Array.isArray(live.events) ? live.events.slice(0, 30) : [],
    highlights: Array.isArray(live.highlights) ? live.highlights.slice(0, 20) : [],
    timeline: Array.isArray(res.timeline) ? res.timeline.slice(0, 25) : [],
  };
}

const CAPABILITIES = [
  {
    id: "apps.catalog.list",
    kind: "query",
    provider: "apps-info",
    title: "List My Space apps",
    description: "Catalog of installed/configured apps with taglines",
    handler: listApps,
  },
  {
    id: "apps.catalog.get",
    kind: "query",
    provider: "apps-info",
    title: "Get app details",
    description: "Profile, live digest, and recent timeline for one app",
    handler: getApp,
  },
  {
    id: "apps.digest.get",
    kind: "query",
    provider: "apps-info",
    title: "Get app digest",
    description: "Stats, events, and highlights for one app",
    handler: getDigest,
  },
];

module.exports = { CAPABILITIES };