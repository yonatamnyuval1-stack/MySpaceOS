function sma(points, period) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += points[j].close;
    out.push(sum / period);
  }
  return out;
}

function periodReturn(points) {
  if (points.length < 2) return null;
  const first = points[0].close;
  const last = points[points.length - 1].close;
  if (!first) return null;
  return ((last - first) / first) * 100;
}

function volatility(points) {
  if (points.length < 3) return null;
  const rets = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1].close;
    if (prev) rets.push((points[i].close - prev) / prev);
  }
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
  return Math.sqrt(variance) * 100;
}

function rsi(points, period = 14) {
  if (points.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = points.length - period; i < points.length; i++) {
    const diff = points[i].close - points[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function avgVolume(points) {
  const vols = points.map((p) => p.volume).filter((v) => v != null && v > 0);
  if (!vols.length) return null;
  return vols.reduce((a, b) => a + b, 0) / vols.length;
}

function trendLabel(price, ma) {
  if (price == null || ma == null) return "—";
  const diff = ((price - ma) / ma) * 100;
  if (diff > 1.5) return { text: "Above MA", cls: "up" };
  if (diff < -1.5) return { text: "Below MA", cls: "down" };
  return { text: "Near MA", cls: "flat" };
}

function analyze(points, quote) {
  const closes = points.map((p) => p.close).filter((c) => c != null);
  const ma20 = sma(points, 20);
  const ma50 = sma(points, 50);
  const lastMa20 = ma20[ma20.length - 1];
  const lastMa50 = ma50[ma50.length - 1];
  const price = quote?.price ?? closes[closes.length - 1];
  const periodHigh = closes.length ? Math.max(...closes) : null;
  const periodLow = closes.length ? Math.min(...closes) : null;
  const vol = avgVolume(points);
  const lastVol = points[points.length - 1]?.volume;

  return {
    ma20,
    ma50,
    periodReturn: periodReturn(points),
    volatility: volatility(points),
    rsi: rsi(points),
    periodHigh,
    periodLow,
    avgVolume: vol,
    volumeVsAvg: vol && lastVol ? ((lastVol - vol) / vol) * 100 : null,
    trend20: trendLabel(price, lastMa20),
    trend50: trendLabel(price, lastMa50),
    distFromHigh: periodHigh && price ? ((price - periodHigh) / periodHigh) * 100 : null,
    distFromLow: periodLow && price ? ((price - periodLow) / periodLow) * 100 : null,
  };
}

const financeOhlcApi = { sma, periodReturn, volatility, rsi, avgVolume, trendLabel, analyze };
if (typeof module !== "undefined" && module.exports) module.exports = financeOhlcApi;
if (typeof window !== "undefined") window.PartsFinanceOhlc = financeOhlcApi;