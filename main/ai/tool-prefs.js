const fs = require("fs");
const path = require("path");
const { app } = require("electron");

function prefsPath() {
  try {
    if (app?.isReady?.() || app?.getPath) {
      const profile = require("../myspace-profile");
      return profile.profileScopedPath("ai-tool-prefs.json");
    }
  } catch {
  }
  return path.join(__dirname, "..", "..", "config", "ai-tool-prefs.json");
}

function loadPrefs() {
  try {
    const raw = fs.readFileSync(prefsPath(), "utf8");
    const data = JSON.parse(raw);
    return {
      disabled: Array.isArray(data?.disabled) ? data.disabled.map(String) : [],
    };
  } catch {
    return { disabled: [] };
  }
}

function savePrefs(prefs) {
  fs.mkdirSync(path.dirname(prefsPath()), { recursive: true });
  fs.writeFileSync(prefsPath(), JSON.stringify(prefs, null, 2), "utf8");
}

function getDisabledToolNames() {
  return loadPrefs().disabled;
}

function getDisabledSet() {
  return new Set(getDisabledToolNames());
}

function isToolEnabled(name) {
  return !getDisabledSet().has(String(name || "").trim());
}

function setToolEnabled(name, enabled) {
  const tool = String(name || "").trim();
  if (!tool) return { ok: false, error: "Tool name required" };
  const prefs = loadPrefs();
  const disabled = new Set(prefs.disabled);
  if (enabled) disabled.delete(tool);
  else disabled.add(tool);
  prefs.disabled = Array.from(disabled).sort();
  savePrefs(prefs);
  return { ok: true, name: tool, active: enabled, disabled: prefs.disabled };
}

function listToolsStatus(defs) {
  const disabled = getDisabledSet();
  return (defs || []).map((t) => ({
    name: t.name,
    description: t.description || "",
    active: !disabled.has(t.name),
  }));
}

module.exports = {
  getDisabledToolNames,
  getDisabledSet,
  isToolEnabled,
  setToolEnabled,
  listToolsStatus,
};