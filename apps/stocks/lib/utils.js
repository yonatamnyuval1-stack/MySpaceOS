window.Stocks = window.Stocks || {};

window.Stocks.escapeHtml = function (s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

window.Stocks.invoke = async function (channel, args) {
  if (!window.myApp?.invoke) throw new Error("Open via My Space.");
  const result = await window.myApp.invoke(channel, args || {});
  if (result?.ok === false && result?.error) throw new Error(result.error);
  return result;
};

const money = window.PartsMoneyFormat || {};
window.Stocks.formatMoney =
  money.formatMoney ||
  function (n, currency) {
    if (n == null || Number.isNaN(n)) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  };

window.Stocks.formatPct =
  money.formatPct ||
  function (n) {
    if (n == null || Number.isNaN(n)) return "—";
    const sign = n >= 0 ? "+" : "";
    return `${sign}${n.toFixed(2)}%`;
  };

window.Stocks.formatVol =
  money.formatVol ||
  function (n) {
    if (n == null) return "—";
    if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return String(n);
  };

window.Stocks.formatCap =
  money.formatCap ||
  function (n) {
    if (n == null) return "—";
    if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    return `$${n}`;
  };

window.Stocks.changeClass =
  money.changeClass ||
  function (n) {
    if (n > 0) return "up";
    if (n < 0) return "down";
    return "flat";
  };

window.Stocks.CHART_RANGES = [
  { id: "1d", label: "1D", interval: "5m" },
  { id: "5d", label: "5D", interval: "15m" },
  { id: "1mo", label: "1M", interval: "1d" },
  { id: "3mo", label: "3M", interval: "1d" },
  { id: "6mo", label: "6M", interval: "1d" },
  { id: "1y", label: "1Y", interval: "1d" },
  { id: "5y", label: "5Y", interval: "1wk" },
];
