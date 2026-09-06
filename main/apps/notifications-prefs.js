const fs = require("fs");
const path = require("path");
const { app } = require("electron");

function prefsPath() {
  const { profileScopedPath } = require("../myspace-profile");
  const identity = require("../myspace-identity");
  void identity.tryRestoreSession();
  return profileScopedPath("notifications-prefs.json");
}

function defaultPrefs() {
  return {
    mailAlertsEnabled: true,
    blockedSenders: [],
    updatedAt: null,
  };
}

function normalizeEmail(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return "";
  const m = s.match(/<([^>]+)>/);
  const email = (m ? m[1] : s).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
  return email;
}

function normalizeSenderKey(raw) {
  const email = normalizeEmail(raw);
  if (email) return email;
  const name = String(raw || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (name.length < 2) return "";
  return name;
}

function displayNameFrom(from) {
  return String(from || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function parseSenderEmail(from) {
  return normalizeEmail(from);
}

function loadPrefs() {
  try {
    const raw = JSON.parse(fs.readFileSync(prefsPath(), "utf8"));
    const blocked = Array.isArray(raw?.blockedSenders)
      ? raw.blockedSenders.map(normalizeSenderKey).filter(Boolean)
      : [];
    return {
      mailAlertsEnabled: raw?.mailAlertsEnabled !== false,
      blockedSenders: [...new Set(blocked)],
      updatedAt: raw?.updatedAt || null,
    };
  } catch (err) {
    if (err && err.code === "ENOENT") return defaultPrefs();
    return defaultPrefs();
  }
}

function savePrefs(prefs) {
  const next = {
    mailAlertsEnabled: prefs.mailAlertsEnabled !== false,
    blockedSenders: [...new Set((prefs.blockedSenders || []).map(normalizeSenderKey).filter(Boolean))],
    updatedAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(prefsPath()), { recursive: true });
  fs.writeFileSync(prefsPath(), JSON.stringify(next, null, 2), "utf8");
  return next;
}

function getPrefs() {
  return { ok: true, prefs: loadPrefs() };
}

function setPrefs(args = {}) {
  const current = loadPrefs();
  const next = { ...current };
  if (typeof args.mailAlertsEnabled === "boolean") {
    next.mailAlertsEnabled = args.mailAlertsEnabled;
  }
  if (Array.isArray(args.blockedSenders)) {
    next.blockedSenders = args.blockedSenders;
  }
  return { ok: true, prefs: savePrefs(next) };
}

function addBlockedSender(args = {}) {
  const key = normalizeSenderKey(args.email || args.sender);
  if (!key) return { ok: false, error: "Invalid sender" };
  const current = loadPrefs();
  if (!current.blockedSenders.includes(key)) {
    current.blockedSenders.push(key);
  }
  return { ok: true, prefs: savePrefs(current), email: key };
}

function removeBlockedSender(args = {}) {
  const key = normalizeSenderKey(args.email || args.sender);
  if (!key) return { ok: false, error: "Invalid sender" };
  const current = loadPrefs();
  current.blockedSenders = current.blockedSenders.filter((e) => e !== key);
  return { ok: true, prefs: savePrefs(current), email: key };
}

function shouldNotifyMail(from) {
  const prefs = loadPrefs();
  if (!prefs.mailAlertsEnabled) return false;
  const blocked = prefs.blockedSenders || [];
  if (!blocked.length) return true;
  const email = parseSenderEmail(from);
  const name = displayNameFrom(from);
  if (email && blocked.includes(email)) return false;
  if (name && blocked.includes(name)) return false;
  return true;
}

module.exports = {
  getPrefs,
  setPrefs,
  addBlockedSender,
  removeBlockedSender,
  shouldNotifyMail,
  parseSenderEmail,
  normalizeEmail,
  normalizeSenderKey,
};
