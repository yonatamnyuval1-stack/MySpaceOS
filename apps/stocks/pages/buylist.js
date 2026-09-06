window.StocksPages = window.StocksPages || {};

window.StocksPages.buylist = (function () {
  const { escapeHtml, invoke, formatMoney, formatPct, changeClass } = window.Stocks;
  const page = document.getElementById("page-buylist");
  let items = [];

  async function scan() {
    page.classList.add("loading");
    try {
      const res = await invoke("buylist.list");
      items = res.buyList || [];
      const symbols = [...new Set(items.filter((i) => !i.done).map((i) => i.symbol))];
      let quotes = [];
      if (symbols.length) {
        const q = await invoke("quote.get", { symbols });
        quotes = q.quotes || [];
      }
      render(items, quotes);
      page.querySelector("#buylist-error").hidden = true;
    } catch (err) {
      page.querySelector("#buylist-error").textContent = err.message;
      page.querySelector("#buylist-error").hidden = false;
    } finally {
      page.classList.remove("loading");
    }
  }

  function progressToTarget(price, target) {
    if (price == null || target == null || !Number.isFinite(price) || !Number.isFinite(target) || target <= 0) {
      return null;
    }
    const ceiling = target * 1.2;
    if (price <= target) return 100;
    if (price >= ceiling) return 0;
    return Math.round(((ceiling - price) / (ceiling - target)) * 100);
  }

  function render(list, quotes) {
    const quoteMap = Object.fromEntries(quotes.map((q) => [q.symbol, q]));
    const pending = list.filter((i) => !i.done);
    const done = list.filter((i) => i.done);
    let atTarget = 0;
    for (const item of pending) {
      const price = quoteMap[item.symbol]?.price;
      if (item.targetPrice != null && price != null && price <= item.targetPrice) atTarget += 1;
    }

    page.querySelector("#buylist-count").textContent = String(pending.length);
    page.querySelector("#buylist-at-target").textContent = String(atTarget);
    page.querySelector("#buylist-bought").textContent = String(done.length);

    const el = page.querySelector("#buylist-items");
    if (!list.length) {
      el.innerHTML = `<div class="empty-state">
        <strong>Your buy list is empty</strong>
        <p>Track symbols you want to buy — add a target price to spot entry moments.</p>
      </div>`;
      return;
    }

    const row = (item) => {
      const q = quoteMap[item.symbol];
      const price = q?.price;
      const chgCls = changeClass(q?.changePct);
      const atTargetNow =
        item.targetPrice != null && price != null && price <= item.targetPrice;
      const prog = progressToTarget(price, item.targetPrice);
      const gap =
        item.targetPrice != null && price != null
          ? ((price - item.targetPrice) / item.targetPrice) * 100
          : null;

      return `<article class="buylist-card ${item.done ? "done" : ""} ${atTargetNow ? "at-target" : ""}">
        <div class="buylist-head">
          <div class="buylist-id">
            <button type="button" class="sym-link" data-go="${escapeHtml(item.symbol)}">${escapeHtml(item.symbol)}</button>
            ${atTargetNow ? `<span class="buylist-badge">At target</span>` : ""}
            ${item.done ? `<span class="buylist-badge buylist-badge--done">Bought</span>` : ""}
          </div>
          <div class="buylist-price-block">
            ${
              price != null
                ? `<span class="buylist-price">${formatMoney(price)}</span>
                   <span class="buylist-chg num ${chgCls}">${formatPct(q.changePct)}</span>`
                : `<span class="muted">No quote</span>`
            }
          </div>
        </div>
        ${item.note ? `<p class="buylist-note">${escapeHtml(item.note)}</p>` : ""}
        ${
          item.targetPrice != null
            ? `<div class="buylist-target-row">
                <span>Target ≤ <strong>${formatMoney(item.targetPrice)}</strong></span>
                ${
                  gap != null
                    ? `<span class="num ${gap <= 0 ? "up" : "down"}">${gap <= 0 ? "≤ target" : `${gap.toFixed(1)}% above`}</span>`
                    : ""
                }
              </div>
              ${
                prog != null && !item.done
                  ? `<div class="buylist-progress" title="Proximity to target"><i style="width:${prog}%"></i></div>`
                  : ""
              }`
            : ""
        }
        <p class="muted buylist-added">Added ${new Date(item.addedAt).toLocaleDateString()}</p>
        <div class="buylist-actions">
          ${item.done ? "" : `<button type="button" class="btn btn-primary btn-sm" data-done="${escapeHtml(item.id)}">Mark bought</button>`}
          <button type="button" class="btn btn-ghost btn-sm" data-rm="${escapeHtml(item.id)}">Remove</button>
        </div>
      </article>`;
    };

    el.innerHTML = `
      ${
        pending.length
          ? `<div class="list-section"><h3 class="list-section-title">To buy <span>${pending.length}</span></h3><div class="buylist-grid">${pending.map(row).join("")}</div></div>`
          : `<div class="empty-state empty-state--sm"><strong>Nothing pending</strong><p>All items are marked purchased — or add a new symbol.</p></div>`
      }
      ${
        done.length
          ? `<div class="list-section"><h3 class="list-section-title muted">Purchased <span>${done.length}</span></h3><div class="buylist-grid">${done.map(row).join("")}</div></div>`
          : ""
      }`;
  }

  function bindEvents() {
    page.querySelector("#buylist-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      addItem();
    });

    page.addEventListener("click", async (e) => {
      const go = e.target.closest("[data-go]");
      if (go) {
        window.StocksApp.openStock(go.dataset.go);
        return;
      }
      const rm = e.target.closest("[data-rm]");
      if (rm) {
        items = items.filter((i) => i.id !== rm.dataset.rm);
        await invoke("buylist.save", { buyList: items });
        scan();
        return;
      }
      const doneBtn = e.target.closest("[data-done]");
      if (doneBtn) {
        const item = items.find((i) => i.id === doneBtn.dataset.done);
        if (item) item.done = true;
        await invoke("buylist.save", { buyList: items });
        scan();
      }
    });
  }

  async function addItem() {
    const symbol = page.querySelector("#buylist-symbol").value.trim().toUpperCase();
    const note = page.querySelector("#buylist-note").value.trim();
    const targetRaw = page.querySelector("#buylist-target").value;
    if (!symbol) return;
    const targetPrice = targetRaw !== "" ? parseFloat(targetRaw) : null;
    items.push({
      id: `bl_${Date.now()}`,
      symbol,
      note,
      targetPrice: Number.isFinite(targetPrice) ? targetPrice : null,
      addedAt: new Date().toISOString(),
      done: false,
    });
    await invoke("buylist.save", { buyList: items });
    page.querySelector("#buylist-symbol").value = "";
    page.querySelector("#buylist-note").value = "";
    page.querySelector("#buylist-target").value = "";
    scan();
  }

  return { id: "buylist", page, scan, bind: bindEvents };
})();