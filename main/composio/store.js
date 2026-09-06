const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const profile = require("../myspace-profile");

function settingsPath() {
  return profile.profileScopedPath("composio-platform.json");
}

function secretsPath() {
  return profile.profileScopedPath("composio-secrets.json");
}

function defaultSettings() {
  return {
    version: 1,
    userId: "myspace-local",
    sessionId: null,
    allowlist: [],
    enabled: true,
    updatedAt: null,
  };
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback();
    return { ...fallback(), ...JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch {
    return fallback();
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function getSettings() {
  const s = readJson(settingsPath(), defaultSettings);
  s.userId = String(s.userId || "myspace-local").trim() || "myspace-local";
  s.allowlist = Array.isArray(s.allowlist)
    ? s.allowlist.map((x) => String(x).trim().toLowerCase()).filter(Boolean)
    : [];
  s.enabled = s.enabled !== false;
  return s;
}

function saveSettings(patch = {}) {
  const next = { ...getSettings(), ...patch, updatedAt: new Date().toISOString() };
  if (patch.allowlist) {
    next.allowlist = Array.isArray(patch.allowlist)
      ? patch.allowlist.map((x) => String(x).trim().toLowerCase()).filter(Boolean)
      : [];
  }
  writeJson(settingsPath(), next);
  return next;
}

function getApiKey() {
  const secrets = readJson(secretsPath(), () => ({}));
  return String(secrets.apiKey || "").trim() || null;
}

function setApiKey(apiKey) {
  const key = String(apiKey || "").trim();
  const secrets = readJson(secretsPath(), () => ({}));
  if (!key) delete secrets.apiKey;
  else secrets.apiKey = key;
  writeJson(secretsPath(), secrets);
  saveSettings({ sessionId: null });
  return { ok: true, hasKey: Boolean(key), keyPreview: maskKey(key) };
}

function clearApiKey() {
  return setApiKey("");
}

function maskKey(key) {
  const k = String(key || "");
  if (k.length < 8) return k ? "••••" : "";
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}

function getUserId() {
  return getSettings().userId;
}

function setSessionId(sessionId) {
  return saveSettings({ sessionId: sessionId ? String(sessionId) : null });
}

module.exports = {
  getSettings,
  saveSettings,
  getApiKey,
  setApiKey,
  clearApiKey,
  maskKey,
  getUserId,
  setSessionId,
};