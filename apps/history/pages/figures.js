window.HistoryPages = window.HistoryPages || {};

window.HistoryPages.figures = (function () {
  const { escapeHtml, invoke, lifeSpan, eraLabel } = window.History;

  const page = document.getElementById("page-figures");
  const grid = document.getElementById("figures-grid");
  const statsEl = document.getElementById("figures-stats");
  const searchInput = document.getElementById("figures-search");
  const sortSelect = document.getElementById("figures-sort");
  const loadingEl = document.getElementById("figures-loading");
  const eraNav = document.getElementById("era-nav");

  let figures = [];
  let filterEra = "all";

  function filtered() {
    const q = (searchInput?.value || "").trim().toLowerCase();
    let list = figures.filter((f) => {
      if (filterEra !== "all" && f.era !== filterEra) return false;
      if (!q) return true;
      const hay = [f.name, f.occupation, f.country, f.description, f.id].join(" ").toLowerCase();
      return hay.includes(q);
    });
    const sort = sortSelect?.value || "birth";
    if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    else list = [...list].sort((a, b) => (a.birthYear || 0) - (b.birthYear || 0));
    return list;
  }

  function renderEraNav() {
    const counts = {};
    for (const f of figures) counts[f.era] = (counts[f.era] || 0) + 1;
    const eras = Object.keys(window.History.ERA_LABELS).filter((e) => e !== "unknown" && counts[e]);
    const items = [{ id: "all", label: "All eras", icon: "🕰" }, ...eras.map((e) => ({ id: e, label: eraLabel(e), icon: "📅" }))];
    eraNav.innerHTML = items
      .map((g) => {
        const active = g.id === filterEra;
        const count = g.id === "all" ? figures.length : counts[g.id] || 0;
        return `<button type="button" class="nav-item ${active ? "active" : ""}" data-era="${escapeHtml(g.id)}">
          <span class="nav-icon">${g.icon}</span>${escapeHtml(g.label)} <span class="nav-count">${count}</span>
        </button>`;
      })
      .join("");
    eraNav.querySelectorAll("[data-era]").forEach((btn) => {
      btn.addEventListener("click", () => {
        filterEra = btn.dataset.era;
        renderEraNav();
        renderGrid();
      });
    });
  }

  function card(f) {
    const sel = window.HistoryDetail.getSelectedId() === f.id;
    return `<article class="item-card ${sel ? "selected" : ""}" data-id="${escapeHtml(f.id)}" data-type="figure">
      ${f.image ? `<img class="item-thumb" src="${escapeHtml(f.image)}" alt="" loading="lazy" onerror="this.classList.add('hidden')" />` : `<span class="item-thumb-ph">👤</span>`}
      <div class="item-body">
        <h3>${escapeHtml(f.name)}</h3>
        <span class="item-sub">${escapeHtml(lifeSpan(f))}</span>
        <div class="item-meta">
          ${f.occupation ? `<span class="meta-pill">${escapeHtml(f.occupation)}</span>` : ""}
          <span class="meta-pill">${escapeHtml(eraLabel(f.era))}</span>
        </div>
      </div>
    </article>`;
  }

  function renderStats() {
    statsEl.innerHTML = `
      <div class="stat-card"><span class="stat-val">${figures.length}</span><span class="stat-label">Figures</span></div>
      <div class="stat-card"><span class="stat-val">${figures.filter((f) => f.image).length}</span><span class="stat-label">With photos</span></div>
      <div class="stat-card"><span class="stat-val">${new Set(figures.map((f) => f.occupation).filter(Boolean)).size}</span><span class="stat-label">Occupations</span></div>`;
  }

  function renderGrid() {
    const list = filtered();
    if (!list.length) {
      grid.innerHTML = `<p class="empty-msg">${figures.length ? "No matches." : "Build the database first (sidebar button)."}</p>`;
      return;
    }
    grid.innerHTML = list.slice(0, 500).map(card).join("");
    if (list.length > 500) {
      grid.innerHTML += `<p class="muted page-hint">Showing 500 of ${list.length} — refine search to see more.</p>`;
    }
    grid.querySelectorAll(".item-card").forEach((el) => {
      el.addEventListener("click", () => window.HistoryDetail.open(el.dataset.id, "figure"));
    });
  }

  async function load() {
    loadingEl?.classList.remove("hidden");
    loadingEl.textContent = "Loading figures…";
    try {
      const res = await invoke("figures.list");
      figures = res.figures || [];
      renderStats();
      renderEraNav();
      renderGrid();
    } catch (err) {
      figures = [];
      grid.innerHTML = `<p class="empty-msg">${escapeHtml(err.message)}</p>`;
    } finally {
      loadingEl?.classList.add("hidden");
    }
  }

  async function scan() {
    await load();
  }

  function bind() {
    searchInput?.addEventListener("input", renderGrid);
    sortSelect?.addEventListener("change", renderGrid);
    window.HistoryDetail.setOnClose(() => renderGrid());
  }

  return { id: "figures", page, scan, bind, getFigures: () => figures };
})();
