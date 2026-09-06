const UNSAFE_WEBVIEW_HOSTS = [
  "google.com",
  "google.co.il",
  "googleusercontent.com",
  "gstatic.com",
  "youtube.com",
  "youtu.be",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "accounts.google.com",
  "login.microsoftonline.com",
  "microsoftonline.com",
  "live.com",
  "office.com",
  "office365.com",
  "outlook.com",
  "hotmail.com",
  "amazon.com",
  "netflix.com",
  "discord.com",
  "zoom.us",
];

function looksLikeUrlQuery(raw) {
  const q = String(raw || "").trim();
  if (!q) return false;
  if (/^(https?|file|about):/i.test(q)) return true;
  if (/^(localhost)(:\d+)?(\/.*)?$/i.test(q)) return true;
  if (/^[\w.-]+\.[a-z]{2,}([/:].*)?$/i.test(q)) return true;
  return false;
}

function normalizeUrl(raw) {
  const url = String(raw || "").trim();
  if (!url) return null;
  if (/^(https?|file|about):/i.test(url)) return url;
  if (/^(localhost)(:\d+)?(\/.*)?$/i.test(url)) return `http://${url}`;
  if (/^[\w.-]+\.[a-z]{2,}([/:].*)?$/i.test(url)) return `https://${url}`;
  return null;
}

function coerceNavigateUrl(raw) {
  if (!looksLikeUrlQuery(raw)) return null;
  return normalizeUrl(raw);
}

function isUnsafeWebviewUrl(rawUrl, extraHosts = []) {
  try {
    let url = String(rawUrl || "").trim();
    if (!url) return false;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    const host = new URL(url).hostname.toLowerCase();
    const blocked = [...UNSAFE_WEBVIEW_HOSTS, ...extraHosts.map(String)];
    return blocked.some((b) => host === b || host.endsWith(`.${b}`));
  } catch {
    return false;
  }
}

const api = {
  UNSAFE_WEBVIEW_HOSTS,
  looksLikeUrlQuery,
  normalizeUrl,
  coerceNavigateUrl,
  isUnsafeWebviewUrl,
};

if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.PartsBrowserUrl = api;