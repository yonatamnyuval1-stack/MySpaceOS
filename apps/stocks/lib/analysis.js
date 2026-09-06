window.StocksAnalysis =
  window.PartsFinanceOhlc ||
  (function () {
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
    function analyze() {
      return {};
    }
    return { sma, analyze, periodReturn: () => null, volatility: () => null, rsi: () => null };
  })();
