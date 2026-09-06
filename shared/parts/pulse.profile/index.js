function normalizeInput(input) {
  if (!input || typeof input !== "object") return {};
  const out = {};
  for (const [key, val] of Object.entries(input)) {
    out[String(key)] = String(val || "any");
  }
  return out;
}

function normalizeCommand(moduleId, raw) {
  if (!raw || typeof raw !== "object") return null;
  const verb = String(raw.verb || "").trim();
  if (!verb) return null;
  const delivery = raw.delivery === "ui" ? "ui" : "ipc";
  return {
    id: moduleId + "." + verb,
    target: moduleId,
    verb,
    kind: "command",
    delivery,
    channel: delivery === "ipc" ? String(raw.channel || "").trim() : "",
    broker: raw.broker ? String(raw.broker).trim() : "",
    title: String(raw.title || verb),
    description: String(raw.description || ""),
    input: normalizeInput(raw.input),
    inputMap: raw.inputMap && typeof raw.inputMap === "object" ? raw.inputMap : null,
    emit: raw.emit ? String(raw.emit) : "",
    callers: Array.isArray(raw.callers) ? raw.callers.map(String) : null,
    examples: Array.isArray(raw.examples) ? raw.examples.map(String) : [],
    source: "manifest",
  };
}

function normalizeEvent(moduleId, raw) {
  if (!raw || typeof raw !== "object") return null;
  const topic = String(raw.topic || raw.id || "").trim();
  if (!topic) return null;
  const parts = topic.split(".");
  const verb = parts.length > 1 ? parts.slice(1).join(".") : topic;
  return {
    id: topic,
    target: parts[0] || moduleId,
    verb,
    kind: "event",
    title: String(raw.title || topic),
    description: String(raw.description || ""),
    payload: normalizeInput(raw.payload),
    source: "manifest",
  };
}

function normalizeProfile(moduleId, raw) {
  if (!raw || typeof raw !== "object") return null;
  const profile = raw.profile && typeof raw.profile === "object" ? raw.profile : {};
  const commands = (Array.isArray(raw.commands) ? raw.commands : [])
    .map((c) => normalizeCommand(moduleId, c))
    .filter(Boolean);
  const events = (Array.isArray(raw.events) ? raw.events : [])
    .map((e) => normalizeEvent(moduleId, e))
    .filter(Boolean);
  if (!commands.length && !events.length && !profile.tagline) return null;
  return {
    moduleId,
    tagline: String(profile.tagline || ""),
    icon: String(profile.icon || ""),
    color: String(profile.color || ""),
    commands,
    events,
    declaredAt: null,
    source: "manifest",
  };
}

const api = { normalizeInput, normalizeCommand, normalizeEvent, normalizeProfile };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.PartsPulseProfile = api;
