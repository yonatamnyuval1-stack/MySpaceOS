function parseDurationToSec(raw) {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  if (!s) return null;
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    return Number.isFinite(n) && n > 0 ? n * 60 : null;
  }
  if (/^\d+:\d{2}(:\d{2})?$/.test(s)) {
    const parts = s.split(":").map((x) => parseInt(x, 10));
    if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
    let total = 0;
    if (parts.length === 2) total = parts[0] * 60 + parts[1];
    else total = parts[0] * 3600 + parts[1] * 60 + parts[2];
    return total > 0 ? total : null;
  }
  let total = 0;
  let matched = false;
  const re = /(\d+)(h|hr|hours?|m|min|minutes?|s|sec|seconds?)/gi;
  let m;
  while ((m = re.exec(s))) {
    matched = true;
    const n = parseInt(m[1], 10);
    const u = m[2].toLowerCase();
    if (u.startsWith("h")) total += n * 3600;
    else if (u.startsWith("m")) total += n * 60;
    else total += n;
  }
  if (!matched || total <= 0) return null;
  return Math.min(total, 24 * 3600);
}

function formatDurationSec(sec) {
  const n = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return s ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}

function looksLikeDuration(raw) {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (!s) return false;
  if (/^\d+$/.test(s)) return true;
  if (/^\d+:\d{2}(:\d{2})?$/.test(s)) return true;
  return /^\d+\s*(h|hr|hours?|m|min|minutes?|s|sec|seconds?)/i.test(s);
}

const api = { parseDurationToSec, formatDurationSec, looksLikeDuration };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.PartsShellDuration = api;
