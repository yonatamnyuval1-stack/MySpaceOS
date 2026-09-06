function expiryState(iso, now = Date.now(), soonDays = 7) {
  if (!iso) return { state: "none", label: "No expiry", daysLeft: null };
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return { state: "none", label: "Invalid date", daysLeft: null };
  const ms = t - Number(now);
  const daysLeft = Math.ceil(ms / 86400000);
  if (ms < 0) return { state: "expired", label: "Expired", daysLeft };
  if (daysLeft <= soonDays) return { state: "soon", label: "Expiring soon", daysLeft };
  return { state: "ok", label: "Valid", daysLeft };
}

const api = { expiryState };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.PartsCouponsExpiry = api;