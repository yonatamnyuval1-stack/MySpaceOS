function formatMoney(n, currency) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(n));
  } catch {
    return Number(n).toFixed(2) + " " + (currency || "USD");
  }
}

function formatPct(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  const sign = v >= 0 ? "+" : "";
  return sign + v.toFixed(2) + "%";
}

function formatVol(n) {
  if (n == null) return "—";
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return String(v);
}

function formatCap(n) {
  if (n == null) return "—";
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  if (v >= 1e12) return "$" + (v / 1e12).toFixed(2) + "T";
  if (v >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  return "$" + v;
}

function changeClass(n) {
  if (n > 0) return "up";
  if (n < 0) return "down";
  return "flat";
}

const moneyFormatApi = { formatMoney, formatPct, formatVol, formatCap, changeClass };
if (typeof module !== "undefined" && module.exports) module.exports = moneyFormatApi;
if (typeof window !== "undefined") window.PartsMoneyFormat = moneyFormatApi;
