window.StocksPages = window.StocksPages || {};

window.StocksPages.stock = (function () {
  const { escapeHtml, invoke, formatMoney, formatPct, formatVol, formatCap, changeClass, CHART_RANGES } =
    window.Stocks;

  const page = document.getElementById("page-stock");
  let symbol = "";
  let chartRange = "1mo";
  let chartCtrl = null;
  let lastQuote = null;
  let lastPoints = [];

  const chartOpts = {
    mode: "line",
    showMA20: true,
    showMA50: true,
    showVolume: true,
  };

  async function scan(sym) {
    symbol = String(sym || symbol).toUpperCase();
    if (!symbol) return;

    page.hidden = false;
    page.classList.add("loading");
    page.querySelector("#stock-symbol").textContent = symbol;

    try {
      const [quoteRes, chartRes] = await Promise.all([
        invoke("quote.get", { symbols: [symbol] }),
        invoke("chart.get", { symbol, range: chartRange, interval: rangeInterval(chartRange) }),
      ]);
      const q = quoteRes.quotes?.[0];
      if (!q) throw new Error("Quote not found");
      lastQuote = q;
      lastPoints = chartRes.points || [];
      renderQuote(q);
      renderChart(chartRes, q.changePct);
      renderAnalysis(lastPoints, q);
      renderRange52w(q, chartRes.meta);
      renderStats(q, chartRes.meta, lastPoints);
    } catch (err) {
      page.querySelector("#stock-error").textContent = err.message;
      page.querySelector("#stock-error").hidden = false;
    } finally {
      page.classList.remove("loading");
    }
  }

  function rangeInterval(range) {
    return CHART_RANGES.find((r) => r.id === range)?.interval || "1d";
  }

  function renderQuote(q) {
    page.querySelector("#stock-error").hidden = true;
    const cls = changeClass(q.changePct);
    page.querySelector("#stock-name").textContent = q.name;
    page.querySelector("#stock-exchange").textContent = q.exchange || (q.isNasdaq ? "NASDAQ" : "");
    page.querySelector("#stock-price").textContent = formatMoney(q.price, q.currency);
    page.querySelector("#stock-price").className = `stock-price ${cls}`;
    page.querySelector("#stock-change").textContent = `${formatPct(q.changePct)} (${q.change >= 0 ? "+" : ""}${q.change?.toFixed(2)})`;
    page.querySelector("#stock-change").className = `stock-change ${cls}`;
  }

  function ensureChart() {
    const canvas = page.querySelector("#main-chart");
    const tooltip = page.querySelector("#chart-tooltip");
    if (!chartCtrl) {
      chartCtrl = window.StocksCharts.attachInteractiveChart(canvas, tooltip);
    }
    return chartCtrl;
  }

  function renderChart(chartRes, changePct) {
    const ctrl = ensureChart();
    ctrl.setData(chartRes.points || [], changePct);
    ctrl.setOptions(chartOpts);
  }

  function renderAnalysis(points, q) {
    const el = page.querySelector("#analysis-strip");
    const a = window.StocksAnalysis.analyze(points, q);
    const rsi = a.rsi != null ? a.rsi.toFixed(0) : "—";
    const rsiCls = a.rsi == null ? "" : a.rsi >= 70 ? "down" : a.rsi <= 30 ? "up" : "flat";
    const periodRet = a.periodReturn != null ? formatPct(a.periodReturn) : "—";
    const periodCls = changeClass(a.periodReturn);
    const volVs = a.volumeVsAvg != null ? formatPct(a.volumeVsAvg) : "—";
    const volCls = changeClass(a.volumeVsAvg);

    el.innerHTML = `
      <div class="analysis-chip ${periodCls}"><span>Period</span><strong>${escapeHtml(periodRet)}</strong></div>
      <div class="analysis-chip ${a.trend20.cls}"><span>vs MA20</span><strong>${escapeHtml(a.trend20.text)}</strong></div>
      <div class="analysis-chip ${a.trend50.cls}"><span>vs MA50</span><strong>${escapeHtml(a.trend50.text)}</strong></div>
      <div class="analysis-chip ${rsiCls}"><span>RSI(14)</span><strong>${escapeHtml(rsi)}</strong></div>
      <div class="analysis-chip"><span>Volatility</span><strong>${a.volatility != null ? a.volatility.toFixed(2) + "%" : "—"}</strong></div>
      <div class="analysis-chip ${volCls}"><span>Vol vs avg</span><strong>${escapeHtml(volVs)}</strong></div>
      <div class="analysis-chip"><span>Period high</span><strong>${a.periodHigh != null ? formatMoney(a.periodHigh) : "—"}</strong></div>
      <div class="analysis-chip"><span>Period low</span><strong>${a.periodLow != null ? formatMoney(a.periodLow) : "—"}</strong></div>`;
  }

  function renderRange52w(q, meta) {
    const el = page.querySelector("#range-52w");
    const low = q.fiftyTwoWeekLow ?? meta?.fiftyTwoWeekLow;
    const high = q.fiftyTwoWeekHigh ?? meta?.fiftyTwoWeekHigh;
    const price = q.price;
    if (low == null || high == null || price == null || high <= low) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    const pct = Math.max(0, Math.min(100, ((price - low) / (high - low)) * 100));
    el.innerHTML = `
      <div class="range-52w-labels">
        <span>52W low ${formatMoney(low)}</span>
        <span class="muted">Position in 52-week range</span>
        <span>52W high ${formatMoney(high)}</span>
      </div>
      <div class="range-52w-track">
        <div class="range-52w-fill" style="width:${pct.toFixed(1)}%"></div>
        <div class="range-52w-marker" style="left:${pct.toFixed(1)}%" title="${formatMoney(price)}"></div>
      </div>`;
  }

  function renderStats(q, meta, points) {
    const grid = page.querySelector("#stock-stats");
    const a = window.StocksAnalysis.analyze(points, q);
    const items = [
      ["Open", formatMoney(q.open)],
      ["Day high", formatMoney(q.dayHigh)],
      ["Day low", formatMoney(q.dayLow)],
      ["Prev close", formatMoney(q.previousClose)],
      ["Volume", formatVol(q.volume)],
      ["Avg vol (period)", formatVol(a.avgVolume)],
      ["Market cap", formatCap(q.marketCap)],
      ["P/E", q.trailingPE != null ? q.trailingPE.toFixed(2) : "—"],
      ["EPS", q.epsTrailingTwelveMonths != null ? q.epsTrailingTwelveMonths.toFixed(2) : "—"],
      ["Beta", q.beta != null ? q.beta.toFixed(2) : "—"],
      ["Div yield", q.dividendYield != null ? formatPct(q.dividendYield * 100) : "—"],
      ["52W high", formatMoney(q.fiftyTwoWeekHigh || meta?.fiftyTwoWeekHigh)],
      ["52W low", formatMoney(q.fiftyTwoWeekLow || meta?.fiftyTwoWeekLow)],
      ["From period high", a.distFromHigh != null ? formatPct(a.distFromHigh) : "—"],
      ["From period low", a.distFromLow != null ? formatPct(a.distFromLow) : "—"],
    ];
    grid.innerHTML = items
      .map(([k, v]) => `<div class="stat-box"><span>${escapeHtml(k)}</span><strong>${escapeHtml(v)}</strong></div>`)
      .join("");
  }

  function renderRangeTabs() {
    const el = page.querySelector("#chart-ranges");
    el.innerHTML = CHART_RANGES.map(
      (r) =>
        `<button type="button" class="range-btn ${r.id === chartRange ? "active" : ""}" data-range="${r.id}">${r.label}</button>`
    ).join("");
    el.querySelectorAll("[data-range]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        chartRange = btn.dataset.range;
        renderRangeTabs();
        const chartRes = await invoke("chart.get", {
          symbol,
          range: chartRange,
          interval: rangeInterval(chartRange),
        });
        const q = (await invoke("quote.get", { symbols: [symbol] })).quotes?.[0];
        lastQuote = q;
        lastPoints = chartRes.points || [];
        renderChart(chartRes, q?.changePct ?? 0);
        renderAnalysis(lastPoints, q);
        renderRange52w(q, chartRes.meta);
        renderStats(q, chartRes.meta, lastPoints);
      });
    });
  }

  function bindChartToolbar() {
    page.querySelectorAll("[data-chart-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        chartOpts.mode = btn.dataset.chartMode;
        page.querySelectorAll("[data-chart-mode]").forEach((b) => b.classList.toggle("active", b === btn));
        ensureChart().setOptions(chartOpts);
      });
    });
    page.querySelectorAll("[data-chart-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.chartToggle;
        chartOpts[key] = !chartOpts[key];
        btn.classList.toggle("active", chartOpts[key]);
        ensureChart().setOptions(chartOpts);
      });
    });
  }

  function bindKeyboard() {
    document.addEventListener("keydown", (e) => {
      if (page.hidden || !symbol) return;
      const idx = CHART_RANGES.findIndex((r) => r.id === chartRange);
      if (e.key === "ArrowLeft" && idx > 0) {
        page.querySelector(`[data-range="${CHART_RANGES[idx - 1].id}"]`)?.click();
      } else if (e.key === "ArrowRight" && idx < CHART_RANGES.length - 1) {
        page.querySelector(`[data-range="${CHART_RANGES[idx + 1].id}"]`)?.click();
      }
    });
  }

  async function addToWatchlist() {
    const loaded = await invoke("storage.load");
    const data = loaded.data;
    const mode = data.activeMode || "stocks";
    if (!data.watchlists[mode]) data.watchlists[mode] = [];
    if (!data.watchlists[mode].includes(symbol)) data.watchlists[mode].unshift(symbol);
    await invoke("storage.save", { data });
    page.querySelector("#btn-add-wl").textContent = "✓ On watchlist";
  }

  async function addToBuyList() {
    const res = await invoke("buylist.list");
    const list = res.buyList || [];
    if (list.some((i) => i.symbol === symbol && !i.done)) {
      page.querySelector("#btn-add-buylist").textContent = "✓ On buy list";
      return;
    }
    list.unshift({
      id: `bl_${Date.now()}`,
      symbol,
      note: "",
      targetPrice: null,
      addedAt: new Date().toISOString(),
      done: false,
    });
    await invoke("buylist.save", { buyList: list });
    page.querySelector("#btn-add-buylist").textContent = "✓ On buy list";
  }

  function bind() {
    page.querySelector("#stock-back")?.addEventListener("click", () => window.StocksApp.setPage("dashboard"));
    page.querySelector("#btn-add-wl")?.addEventListener("click", addToWatchlist);
    page.querySelector("#btn-ai-analysis")?.addEventListener("click", () => {
      if (symbol) window.StocksApp?.openAiAnalysis?.(symbol);
    });
    page.querySelector("#btn-add-buylist")?.addEventListener("click", addToBuyList);
    page.querySelector("#btn-add-portfolio")?.addEventListener("click", () => {
      page.querySelector("#stock-portfolio-form").hidden = false;
    });
    page.querySelector("#btn-save-stock-hold")?.addEventListener("click", async () => {
      const qty = parseFloat(page.querySelector("#stock-hold-qty").value);
      const avgCost = parseFloat(page.querySelector("#stock-hold-cost").value);
      if (!symbol || !qty) return;
      await invoke("portfolio.set", { symbol, qty, avgCost: avgCost || 0 });
      page.querySelector("#stock-portfolio-form").hidden = true;
      page.querySelector("#btn-add-portfolio").textContent = "✓ Portfolio";
    });
    bindChartToolbar();
    bindKeyboard();
    renderRangeTabs();
  }

  function activate(sym) {
    chartRange = "1mo";
    renderRangeTabs();
    scan(sym);
  }

  return { id: "stock", page, scan, bind, activate };
})();