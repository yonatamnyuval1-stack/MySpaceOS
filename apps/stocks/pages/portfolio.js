window.StocksPages = window.StocksPages || {};

window.StocksPages.portfolio = (function () {
  const { escapeHtml, invoke, formatMoney, formatPct, changeClass } = window.Stocks;
  const page = document.getElementById("page-portfolio");

  async function scan() {
    page.classList.add("loading");
    try {
      const res = await invoke("portfolio.get");
      render(res);
    } catch (err) {
      page.querySelector("#portfolio-error").textContent = err.message;
      page.querySelector("#portfolio-error").hidden = false;
    } finally {
      page.classList.remove("loading");
    }
  }

  function weightedDayMove(positions) {
    const total = positions.reduce((s, p) => s + (p.value || 0), 0);
    if (!total) return null;
    let weighted = 0;
    for (const p of positions) {
      weighted += ((p.value || 0) / total) * (Number(p.changePct) || 0);
    }
    return weighted;
  }

  function render(data) {
    page.querySelector("#portfolio-error").hidden = true;
    const s = data.summary || {};
    const positions = data.positions || [];
    const cls = changeClass(s.totalPl);
    const day = weightedDayMove(positions);
    const dayCls = day == null ? "" : changeClass(day);

    page.querySelector("#pf-value").textContent = formatMoney(s.totalValue);
    page.querySelector("#pf-cost").textContent = formatMoney(s.totalCost);
    page.querySelector("#pf-count").textContent = String(positions.length);
    page.querySelector("#pf-list-count").textContent = String(positions.length);

    const plEl = page.querySelector("#pf-pl");
    plEl.textContent = `${formatMoney(s.totalPl)} (${formatPct(s.totalPlPct)})`;
    plEl.className = `stat-val ${cls}`;
    page.querySelector("#pf-summary")?.classList.toggle("is-up", cls === "up");
    page.querySelector("#pf-summary")?.classList.toggle("is-down", cls === "down");

    const dayEl = page.querySelector("#pf-day");
    dayEl.textContent = day == null ? "—" : formatPct(day);
    dayEl.className = `stat-val ${dayCls}`;

    const list = page.querySelector("#portfolio-list");
    if (!positions.length) {
      list.innerHTML = `<div class="empty-state">
        <strong>No holdings yet</strong>
        <p>Add a position with the form, or open any stock and tap <em>+ Portfolio</em>.</p>
      </div>`;
      return;
    }

    const totalValue = s.totalValue || positions.reduce((a, p) => a + (p.value || 0), 0) || 1;

    list.innerHTML = positions
      .map((p) => {
        const plCls = changeClass(p.pl);
        const weight = Math.max(0, Math.min(100, ((p.value || 0) / totalValue) * 100));
        return `<article class="holding-card ${plCls}">
          <div class="holding-top">
            <div class="holding-id">
              <button type="button" class="sym-link" data-go="${escapeHtml(p.symbol)}">${escapeHtml(p.symbol)}</button>
              <span class="wl-name">${escapeHtml(p.name)}</span>
            </div>
            <div class="holding-value">
              <strong>${formatMoney(p.value)}</strong>
              <span class="num ${plCls}">${formatMoney(p.pl)} · ${formatPct(p.plPct)}</span>
            </div>
          </div>
          <div class="holding-meta">
            <span><em>Qty</em> ${escapeHtml(String(p.qty))}</span>
            <span><em>Avg</em> ${formatMoney(p.avgCost)}</span>
            <span><em>Price</em> ${formatMoney(p.price)}</span>
            <span><em>Weight</em> ${weight.toFixed(1)}%</span>
          </div>
          <div class="holding-bar" aria-hidden="true"><i style="width:${weight.toFixed(2)}%"></i></div>
          <div class="holding-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-edit="${escapeHtml(p.symbol)}" data-qty="${p.qty}" data-cost="${p.avgCost}">Edit</button>
            <button type="button" class="btn btn-ghost btn-sm" data-rm="${escapeHtml(p.symbol)}">Remove</button>
          </div>
        </article>`;
      })
      .join("");

    list.querySelectorAll("[data-go]").forEach((btn) => {
      btn.addEventListener("click", () => window.StocksApp.openStock(btn.dataset.go));
    });
    list.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        page.querySelector("#hold-symbol").value = btn.dataset.edit;
        page.querySelector("#hold-qty").value = btn.dataset.qty;
        page.querySelector("#hold-cost").value = btn.dataset.cost;
        page.querySelector("#hold-symbol")?.focus();
      });
    });
    list.querySelectorAll("[data-rm]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await invoke("portfolio.set", { symbol: btn.dataset.rm, qty: 0, avgCost: 0 });
        scan();
      });
    });
  }

  async function saveHolding(e) {
    e?.preventDefault?.();
    const symbol = page.querySelector("#hold-symbol").value.trim().toUpperCase();
    const qty = parseFloat(page.querySelector("#hold-qty").value);
    const avgCost = parseFloat(page.querySelector("#hold-cost").value);
    if (!symbol || Number.isNaN(qty)) return;
    await invoke("portfolio.set", { symbol, qty: qty || 0, avgCost: avgCost || 0 });
    page.querySelector("#hold-symbol").value = "";
    page.querySelector("#hold-qty").value = "";
    page.querySelector("#hold-cost").value = "";
    scan();
  }

  function bind() {
    page.querySelector("#hold-form")?.addEventListener("submit", saveHolding);
  }

  return { id: "portfolio", page, scan, bind };
})();
