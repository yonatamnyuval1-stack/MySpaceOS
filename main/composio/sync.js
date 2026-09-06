const client = require("./client");
const store = require("./store");

function slugToVerb(toolSlug) {
  const raw = String(toolSlug || "").trim();
  if (!raw) return "run";
  const parts = raw.split(/[._-]+/).filter(Boolean);
  if (parts.length <= 1) return raw.toLowerCase().replace(/[^a-z0-9]+/gi, "") || "run";
  const body = parts.slice(1);
  const [first, ...rest] = body.length ? body : parts;
  return (
    String(first).toLowerCase() +
    rest.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("")
  );
}

async function buildToolkitProfile(toolkit, tools) {
  const slug = toolkit.slug || toolkit;
  const name = toolkit.name || slug;
  const cmds = (tools || []).slice(0, 24).map((t) => ({
    verb: slugToVerb(t.slug),
    title: t.name || t.slug,
    description: t.description || `External tool ${t.slug}`,
    delivery: "ipc",
    channel: t.slug,
    broker: "composio",
    input: { arguments: "object?" },
    examples: [`pulse(send composio.${slug} ${slugToVerb(t.slug)})`],
  }));

  cmds.unshift({
    verb: "execute",
    title: "Execute tool",
    description: `Run any ${name} Composio tool by slug`,
    delivery: "ipc",
    channel: "execute",
    broker: "composio",
    input: { tool: "string", arguments: "object?" },
    examples: [`pulse(send composio.${slug} execute tool=…)`],
  });
  cmds.push({
    verb: "openConnect",
    title: "Connect account",
    description: `Open Composio Connect Link for ${name}`,
    delivery: "ipc",
    channel: "connect",
    broker: "composio",
    input: {},
  });
  cmds.push({
    verb: "listTools",
    title: "List tools",
    description: `List ${name} tools`,
    delivery: "ipc",
    channel: "tools.list",
    broker: "composio",
    input: { q: "string?" },
  });

  return {
    profile: {
      tagline: `External · ${name} via Composio`,
      icon: "🔗",
      color: "#a78bfa",
    },
    commands: cmds,
    events: [
      {
        topic: `composio.${slug}.executed`,
        title: "Tool executed",
        description: `Fired after a ${name} tool runs`,
        payload: { tool: "string", ok: "boolean" },
      },
    ],
  };
}

async function syncExternalProfiles(registry) {
  if (!store.getApiKey()) {
    return { ok: false, error: "Composio API key not set", synced: 0 };
  }

  const settings = store.getSettings();
  const conn = await client.listConnections();
  const connected = new Set(
    (conn.ok ? conn.connections : [])
      .map((c) => c.toolkit)
      .filter(Boolean)
  );

  let toolkitSlugs = [...connected];
  if (settings.allowlist.length) {
    toolkitSlugs = [...settings.allowlist];
  }
  if (!toolkitSlugs.length) {
    toolkitSlugs = ["gmail", "github", "slack", "notion", "googlecalendar"];
  }

  toolkitSlugs = [...new Set(toolkitSlugs.map((s) => String(s).toLowerCase()))].slice(0, 12);

  const catalog = await client.listToolkits({ limit: 200 });
  const bySlug = new Map((catalog.ok ? catalog.toolkits : []).map((t) => [t.slug, t]));

  let synced = 0;
  const details = [];

  for (const slug of toolkitSlugs) {
    const meta = bySlug.get(slug) || { slug, name: slug };
    const toolsRes = await client.listTools({ toolkit: slug, limit: 24 });
    const tools = toolsRes.ok ? toolsRes.tools : [];
    const payload = await buildToolkitProfile(meta, tools);
    const moduleId = `composio.${slug}`;
    const res = registry.declareRoutes(moduleId, { ...payload, replace: true });
    if (res.ok) {
      synced += 1;
      details.push({ moduleId, commands: res.commands, tools: tools.length });
    }
  }

  return {
    ok: true,
    synced,
    toolkits: toolkitSlugs,
    connections: conn.ok ? conn.connections : [],
    details,
  };
}

module.exports = { syncExternalProfiles, slugToVerb, buildToolkitProfile };
