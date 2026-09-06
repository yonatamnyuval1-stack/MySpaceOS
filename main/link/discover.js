const fs = require("fs");
const path = require("path");

const APPS_DIR = path.join(__dirname, "..", "..", "apps");
const BOOTSTRAP_DIR = path.join(__dirname, "bootstrap");

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

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
    id: `${moduleId}.${verb}`,
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

function loadPulseFile(moduleId, filePath) {
  const raw = readJsonSafe(filePath);
  if (!raw) return null;
  return normalizeProfile(moduleId, raw);
}

function discoverFromApps() {
  const profiles = new Map();
  if (!fs.existsSync(APPS_DIR)) return profiles;

  for (const entry of fs.readdirSync(APPS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const moduleId = entry.name;
    const pulsePath = path.join(APPS_DIR, moduleId, "pulse.json");
    if (!fs.existsSync(pulsePath)) continue;
    const profile = loadPulseFile(moduleId, pulsePath);
    if (profile) profiles.set(moduleId, profile);
  }
  return profiles;
}

function discoverBootstrap() {
  const profiles = new Map();
  if (!fs.existsSync(BOOTSTRAP_DIR)) return profiles;
  for (const file of fs.readdirSync(BOOTSTRAP_DIR)) {
    if (!file.endsWith(".json")) continue;
    const moduleId = file.replace(/\.json$/i, "");
    const profile = loadPulseFile(moduleId, path.join(BOOTSTRAP_DIR, file));
    if (profile) profiles.set(moduleId, profile);
  }
  return profiles;
}

function discoverAll() {
  const merged = new Map();
  for (const [id, profile] of discoverBootstrap()) merged.set(id, profile);
  for (const [id, profile] of discoverFromApps()) merged.set(id, profile);
  return merged;
}

module.exports = {
  discoverAll,
  discoverFromApps,
  normalizeProfile,
  normalizeCommand,
  normalizeEvent,
};
