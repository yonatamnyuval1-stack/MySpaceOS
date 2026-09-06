window.StocksPages = window.StocksPages || {};

window.StocksPages.dashboard = (function () {
  const { escapeHtml, invoke, formatMoney, formatPct, formatVol, changeClass } = window.Stocks;
  const page = document.getElementById("page-dashboard");
  let refreshTimer = null;
  let currentMode = "stocks";
  let modeConfig = null;

  async function scan() {
    page.classList.add("loading");
    try {
      const data = await invoke("market.watchlist");
      currentMode = data.mode || "stocks";
      modeConfig = data.modeConfig || null;
      render(data);
      if (modeConfig?.showMovers !== false) {
        const movers = await invoke("market.movers", { limit: 5, mode: currentMode });
        renderMovers(movers);
        page.querySelector(".movers-row").hidden = false;
      } else {
        page.querySelector(".movers-row").hidden = true;
      }
      try {
        const alertCheck = await invoke("alerts.check");
        renderAlertBanner(alertCheck.triggered || []);
      } catch (_) {
      }
    } catch (err) {
      page.querySelector("#dash-error").textContent = err.message;
      page.querySelector("#dash-error").hidden = false;
    } finally {
      page.classList.remove("loading");
    }
  }

  function renderIndices(indices) {
    const el = page.querySelector("#indices-row");
    const section = page.querySelector("#indices-section");
    const panel = page.querySelector("#panel-indices");
    if (!el) return;
    const show = modeConfig?.showIndices !== false && (indices || []).length;
    if (section) section.hidden = !show;
    if (panel) panel.hidden = !show;
    if (!show) {
      el.innerHTML = "";
      return;
    }
    el.innerHTML = (indices || [])
      .map((item) => {
        const q = item.quote;
        if (!q) {
          return `<div class="index-card muted"><span>${escapeHtml(item.name)}</span><span>—</span></div>`;
        }
        const cls = changeClass(q.changePct);
        return `<div class="index-card ${cls}">
          <span class="index-name">${escapeHtml(item.name)}</span>
          <span class="index-price">${formatMoney(q.price, q.currency)}</span>
          <span class="index-chg ${cls}">${formatPct(q.changePct)}</span>
        </div>`;
      })
      .join("");
  }

  function renderHeatmap(quotes) {
    const el = page.querySelector("#heatmap");
    if (!el) return;
    el.innerHTML = (quotes || [])
      .map((q) => {
        const cls = changeClass(q.changePct);
        const intensity = Math.min(100, Math.abs(q.changePct) * 15);
        const bg =
          q.changePct >= 0
            ? `rgba(93, 222, 168, ${0.12 + intensity / 200})`
            : `rgba(240, 113, 120, ${0.12 + intensity / 200})`;
        return `<button type="button" class="heat-cell ${cls}" data-symbol="${escapeHtml(q.symbol)}" style="background:${bg}">
          <strong>${escapeHtml(q.symbol)}</strong>
          <span>${formatPct(q.changePct)}</span>
          <small>${formatMoney(q.price, q.currency)}</small>
        </button>`;
      })
      .join("");

    el.querySelectorAll("[data-symbol]").forEach((btn) => {
      btn.addEventListener("click", () => window.StocksApp.openStock(btn.dataset.symbol));
    });
  }

  function renderWatchlist(quotes, watchlist) {
    const tbody = page.querySelector("#watchlist-body");
    const thead = page.querySelector("#watchlist-table thead tr");
    const showCap = modeConfig?.showMarketCap !== false;
    const capCol = page.querySelector("#col-mktcap");
    if (capCol) capCol.hidden = !showCap;

    const quoteMap = Object.fromEntries((quotes || []).map((q) => [q.symbol, q]));
    const symbols = watchlist || [];
    const modeLabel = modeConfig?.label || "watchlist";

    if (!symbols.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="muted">Search above to add symbols · ${escapeHtml(modeLabel)}</td></tr>`;
      return;
    }

    tbody.innerHTML = symbols
      .map((sym) => {
        const q = quoteMap[sym];
        if (!q) {
          return `<tr class="wl-row" data-symbol="${escapeHtml(sym)}"><td><strong>${escapeHtml(sym)}</strong></td><td colspan="6" class="muted">Loading…</td></tr>`;
        }
        const cls = changeClass(q.changePct);
        const typeBadge = q.quoteType ? `<span class="type-badge">${escapeHtml(q.quoteType)}</span>` : "";
        return `<tr class="wl-row ${cls}" data-symbol="${escapeHtml(sym)}" tabindex="0" role="link">
          <td><strong class="sym-link">${escapeHtml(sym)}</strong>${typeBadge}<span class="wl-name">${escapeHtml(q.name)}</span></td>
          <td class="num">${formatMoney(q.price, q.currency)}</td>
          <td class="num ${cls}">${formatPct(q.changePct)}</td>
          <td class="num ${cls}">${q.change >= 0 ? "+" : ""}${q.change?.toFixed(2) ?? "—"}</td>
          <td class="num">${formatVol(q.volume)}</td>
          <td class="num" ${showCap ? "" : "hidden"}>${q.marketCap ? window.Stocks.formatCap(q.marketCap) : "—"}</td>
          <td class="spark-cell"><canvas class="spark" data-spark="${escapeHtml(sym)}" width="100" height="36"></canvas></td>
          <td><button type="button" class="btn btn-ghost btn-sm wl-rm" data-rm="${escapeHtml(sym)}" title="Remove">✕</button></td>
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll(".wl-row[data-symbol]").forEach((row) => {
      const open = () => {
        const sym = row.dataset.symbol;
        if (sym && window.StocksApp?.openStock) window.StocksApp.openStock(sym);
      };
      row.addEventListener("click", (e) => {
        if (e.target.closest(".wl-rm")) return;
        open();
      });
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });
    });

    tbody.querySelectorAll(".wl-rm").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await removeSymbol(btn.dataset.rm);
      });
    });

    loadSparklines(symbols);
  }

  async function loadSparklines(symbols) {
    for (const sym of symbols.slice(0, 20)) {
      try {
        const chart = await invoke("chart.get", { symbol: sym, range: "5d", interval: "1d" });
        const canvas = page.querySelector(`canvas[data-spark="${sym}"]`);
        if (canvas && chart.points?.length) {
          canvas.height = 36;
          canvas.width = 100;
          const q = (await invoke("quote.get", { symbols: [sym] })).quotes?.[0];
          window.StocksCharts.drawSparkline(canvas, chart.points, q?.changePct ?? 0);
        }
      } catch (_) {
      }
    }
  }

  async function removeSymbol(sym) {
    const loaded = await invoke("storage.load");
    const data = loaded.data;
    const mode = data.activeMode || "stocks";
    if (!data.watchlists[mode]) data.watchlists[mode] = [];
    data.watchlists[mode] = data.watchlists[mode].filter((s) => s !== sym);
    await invoke("storage.save", { data });
    await scan();
  }

  function renderAlertBanner(triggered) {
    const el = page.querySelector("#dash-alerts");
    if (!el) return;
    if (!triggered.length) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.innerHTML = triggered
      .map(
        (t) =>
          `<div class="alert-hit">🔔 <strong>${escapeHtml(t.symbol)}</strong> — ${escapeHtml(t.reason)} <button type="button" class="btn btn-ghost btn-sm" data-alert-go="${escapeHtml(t.symbol)}">View</button></div>`
      )
      .join("");
    el.querySelectorAll("[data-alert-go]").forEach((btn) => {
      btn.addEventListener("click", () => window.StocksApp.openStock(btn.dataset.alertGo));
    });
  }

  function renderMovers(movers) {
    const gainEl = page.querySelector("#gainers-list");
    const loseEl = page.querySelector("#losers-list");
    const renderList = (el, list) => {
      el.innerHTML = (list || [])
        .map(
          (q) => `<button type="button" class="mover-item ${changeClass(q.changePct)}" data-symbol="${escapeHtml(q.symbol)}">
          <span>${escapeHtml(q.symbol)}</span>
          <span class="mover-pct">${formatPct(q.changePct)}</span>
        </button>`
        )
        .join("");
      el.querySelectorAll("[data-symbol]").forEach((btn) => {
        btn.addEventListener("click", () => window.StocksApp.openStock(btn.dataset.symbol));
      });
    };
    renderList(gainEl, movers.gainers);
    renderList(loseEl, movers.losers);
  }

  function render(data) {
    page.querySelector("#dash-error").hidden = true;
    const quotes = data.quotes || [];

    page.querySelector("#last-update").textContent = `Updated ${new Date().toLocaleTimeString()} · ${modeConfig?.label || ""}`;

    renderIndices(data.indices);
    renderHeatmap(quotes);
    renderWatchlist(quotes, data.watchlist);
  }

  function bind() {
  }

  function refreshMs() {
    const sec = Number(window.AppSettingsRuntime?.get?.("refreshSeconds"));
    const n = Number.isFinite(sec) && sec > 0 ? sec : 180;
    return n * 1000;
  }

  function scheduleRefresh() {
    clearInterval(refreshTimer);
    const autoOn = window.AppSettingsRuntime?.isOn?.("autoRefresh") ?? true;
    if (!autoOn) return;
    refreshTimer = setInterval(scan, refreshMs());
  }

  function reschedule() {
    scheduleRefresh();
  }

  function activate() {
    scan().then(scheduleRefresh);
  }

  function deactivate() {
    clearInterval(refreshTimer);
  }

  return { id: "dashboard", page, scan, bind, activate, deactivate, reschedule };
})();
