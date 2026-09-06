const { discoverAll, normalizeProfile } = require("./discover");

/** @type {Map<string, object>} */
const profiles = new Map();

/** @type {Map<string, object>} */
const commands = new Map();

/** @type {Map<string, object>} */
const events = new Map();

function indexProfile(profile) {
  if (!profile?.moduleId) return;
  profiles.set(profile.moduleId, profile);
  for (const cmd of profile.commands || []) {
    commands.set(cmd.id, cmd);
  }
  for (const evt of profile.events || []) {
    events.set(evt.id, evt);
  }
}

function rebuildIndexes() {
  commands.clear();
  events.clear();
  for (const profile of profiles.values()) {
    for (const cmd of profile.commands || []) commands.set(cmd.id, cmd);
    for (const evt of profile.events || []) events.set(evt.id, evt);
  }
}

function loadDiscovered() {
  profiles.clear();
  for (const [moduleId, profile] of discoverAll()) {
    profiles.set(moduleId, profile);
  }
  rebuildIndexes();
}

loadDiscovered();

function declareRoutes(moduleId, payload = {}) {
  const mod = String(moduleId || "").trim();
  if (!mod) return { ok: false, error: "moduleId required" };

  const incoming = normalizeProfile(mod, payload);
  if (!incoming) return { ok: false, error: "Invalid Pulse declaration" };

  const prev = profiles.get(mod);
  incoming.declaredAt = new Date().toISOString();
  incoming.source = prev?.source === "manifest" ? "manifest+runtime" : "runtime";

  if (prev?.source === "manifest" && !payload.replace) {
    const cmdByVerb = new Map((prev.commands || []).map((c) => [c.verb, c]));
    for (const cmd of incoming.commands || []) cmdByVerb.set(cmd.verb, { ...cmdByVerb.get(cmd.verb), ...cmd, source: "runtime" });
    incoming.commands = [...cmdByVerb.values()];

    const evtByTopic = new Map((prev.events || []).map((e) => [e.id, e]));
    for (const evt of incoming.events || []) evtByTopic.set(evt.id, { ...evtByTopic.get(evt.id), ...evt, source: "runtime" });
    incoming.events = [...evtByTopic.values()];

    incoming.tagline = incoming.tagline || prev.tagline;
    incoming.icon = incoming.icon || prev.icon;
    incoming.color = incoming.color || prev.color;
  }

  profiles.set(mod, incoming);
  rebuildIndexes();
  return {
    ok: true,
    moduleId: mod,
    commands: incoming.commands.length,
    events: incoming.events.length,
  };
}

function listProfiles() {
  return [...profiles.values()].sort((a, b) => a.moduleId.localeCompare(b.moduleId));
}

function getProfile(moduleId) {
  return profiles.get(String(moduleId || "").trim()) || null;
}

function listCommands(filter = {}) {
  let rows = [...commands.values()];
  const target = filter.target ? String(filter.target).trim() : "";
  if (target) rows = rows.filter((r) => r.target === target);
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

function listEvents(filter = {}) {
  let rows = [...events.values()];
  const target = filter.target ? String(filter.target).trim() : "";
  if (target) rows = rows.filter((r) => r.target === target);
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

function findCommand(id) {
  const key = String(id || "").trim();
  if (commands.has(key)) return commands.get(key);
  const parsed = key.match(/^([^.\s]+)\.(.+)$/);
  if (parsed) {
    const alt = `${parsed[1]}.${parsed[2]}`;
    return commands.get(alt) || null;
  }
  return null;
}

function findEvent(id) {
  return events.get(String(id || "").trim()) || null;
}

function reload() {
  loadDiscovered();
  return { ok: true, profiles: profiles.size, commands: commands.size, events: events.size };
}

module.exports = {
  declareRoutes,
  listProfiles,
  getProfile,
  listCommands,
  listEvents,
  findCommand,
  findEvent,
  reload,
};