function normalizeEmail(raw) {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (!s) return "";
  const m = s.match(/<([^>]+)>/);
  const email = (m ? m[1] : s).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
  return email;
}

function displayNameFrom(from) {
  return String(from || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeSenderKey(raw) {
  const email = normalizeEmail(raw);
  if (email) return email;
  const name = displayNameFrom(raw);
  if (name.length < 2) return "";
  return name;
}

function parseSenderEmail(from) {
  return normalizeEmail(from);
}

function extractEmail(text) {
  const m = String(text || "").match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return m ? m[0].toLowerCase() : "";
}

function senderKeyFromNotification(n) {
  const direct = String(n?.route?.fromEmail || "")
    .trim()
    .toLowerCase();
  if (direct.includes("@")) return direct;

  const from = String(n?.route?.from || "").trim();
  const fromEmail = extractEmail(from);
  if (fromEmail) return fromEmail;

  const titleEmail = extractEmail(n?.title);
  if (titleEmail) return titleEmail;

  const bodyEmail = extractEmail(n?.body);
  if (bodyEmail) return bodyEmail;

  if (from) {
    const name = displayNameFrom(from);
    if (name.length >= 2) return name;
  }

  const fromName = String(n?.route?.fromName || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (fromName.length >= 2) return fromName;

  const title = String(n?.title || "").trim();
  const namePart = title.split(/\s+[—–-]\s+/)[0]?.trim().toLowerCase();
  if (namePart && namePart.length >= 2 && !namePart.includes("new mail")) return namePart;

  return "";
}

function shouldNotifyMail(from, prefs = {}) {
  if (prefs.mailAlertsEnabled === false) return false;
  const blocked = prefs.blockedSenders || [];
  if (!blocked.length) return true;
  const email = parseSenderEmail(from);
  const name = displayNameFrom(from);
  if (email && blocked.includes(email)) return false;
  if (name && blocked.includes(name)) return false;
  return true;
}

const api = {
  normalizeEmail,
  displayNameFrom,
  normalizeSenderKey,
  parseSenderEmail,
  extractEmail,
  senderKeyFromNotification,
  shouldNotifyMail,
};

if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.PartsNotifSender = api;