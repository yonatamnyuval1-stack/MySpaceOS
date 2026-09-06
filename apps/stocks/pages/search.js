window.StocksPages = window.StocksPages || {};

window.StocksPages.search = (function () {
  const { escapeHtml, invoke } = window.Stocks;
  const page = document.getElementById("page-search");
  let debounce = null;
  let currentMode = "stocks";
  let modeConfig = null;

  function inputEl() {
    return document.getElementById("top-search");
  }

  function resultsEl() {
    return document.getElementById("top-search-results");
  }

  async function loadMode() {
    const loaded = await invoke("storage.load");
    currentMode = loaded.data?.activeMode || "stocks";
    modeConfig = window.StocksModes?.getMode(currentMode) || null;
    const input = inputEl();
    if (input && modeConfig?.searchPlaceholder) {
      input.placeholder = modeConfig.searchPlaceholder;
    }
  }

  function hideResults() {
    const el = resultsEl();
    if (el) {
      el.hidden = true;
      el.innerHTML = "";
    }
  }

  async function doSearch() {
    await loadMode();
    const q = (inputEl()?.value || "").trim();
    const results = resultsEl();
    if (!results) return;

    if (!q) {
      hideResults();
      return;
    }

    results.hidden = false;
    results.innerHTML = `<p class="muted top-search-status">Searching…</p>`;
    try {
      const res = await invoke("search", { query: q, mode: currentMode });
      const list = res.results || [];
      if (!list.length) {
        results.innerHTML = `<p class="muted top-search-status">No matches</p>`;
        return;
      }
      results.innerHTML = list
        .map(
          (r) => `<article class="top-search-row">
          <button type="button" class="top-search-main" data-view="${escapeHtml(r.symbol)}">
            <strong>${escapeHtml(r.symbol)}</strong>
            <span class="type-badge">${escapeHtml(r.type || r.quoteType || "")}</span>
            <span class="search-name">${escapeHtml(r.name)}</span>
            <span class="search-ex">${escapeHtml(r.exchange)}</span>
          </button>
          <button type="button" class="btn btn-primary btn-sm" data-add="${escapeHtml(r.symbol)}">+</button>
        </article>`
        )
        .join("");

      results.querySelectorAll("[data-view]").forEach((btn) => {
        btn.addEventListener("click", () => {
          window.StocksApp.openStock(btn.dataset.view);
          hideResults();
          if (inputEl()) inputEl().value = "";
        });
      });

      results.querySelectorAll("[data-add]").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          await addSymbol(btn.dataset.add);
          btn.textContent = "✓";
          btn.disabled = true;
          if (window.StocksPages?.dashboard?.scan) {
            await window.StocksPages.dashboard.scan();
          }
        });
      });
    } catch (err) {
      results.innerHTML = `<p class="bad top-search-status">${escapeHtml(err.message)}</p>`;
    }
  }

  async function addSymbol(sym) {
    const loaded = await invoke("storage.load");
    const data = loaded.data;
    const mode = data.activeMode || "stocks";
    if (!data.watchlists[mode]) data.watchlists[mode] = [];
    const s = sym.toUpperCase();
    if (!data.watchlists[mode].includes(s)) data.watchlists[mode].unshift(s);
    await invoke("storage.save", { data });
  }

  function bind() {
    const input = inputEl();
    if (!input) return;

    input.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(doSearch, 300);
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        hideResults();
        input.blur();
      }
      if (e.key === "Enter") {
        e.preventDefault();
        doSearch();
      }
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".topbar-search-wrap")) hideResults();
    });
  }

  function activate() {
  }

  function scan() {
  }

  return { id: "search", page, scan, bind, activate };
})();