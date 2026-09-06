function formatBytes(n, digits = 1) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return "—";
  if (v < 1024) return Math.round(v) + " B";
  const units = ["KB", "MB", "GB", "TB", "PB"];
  let x = v;
  let i = -1;
  do {
    x /= 1024;
    i += 1;
  } while (x >= 1024 && i < units.length - 1);
  const fixed = x >= 10 || digits === 0 ? x.toFixed(0) : x.toFixed(digits);
  return fixed + " " + units[i];
}

const api = { formatBytes };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.PartsBytesFormat = api;