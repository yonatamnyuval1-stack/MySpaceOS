window.HistoryPages = window.HistoryPages || {};

window.HistoryPages.events = (function () {
  const { escapeHtml, invoke, lifeSpan, eraLabel } = window.History;

  const page = document.getElementById("page-events");
  const grid = document.getElementById("events-grid");
  const statsEl = document.getElementById("events-stats");
  const searchInput = document.getElementById("events-search");
  const sortSelect = document.getElementById("events-sort");
  const loadingEl = document.getElementById("events-loading");
  const eraNav = document.getElementById("era-nav");

  let events = [];
  let filterEra = "all";

  function renderEraNav() {
    if (!eraNav) return;
    const counts = {};
    for (const e of events) counts[e.era] = (counts[e.era] || 0) + 1;
    const eras = Object.keys(window.History.ERA_LABELS).filter((id) => id !== "unknown" && counts[id]);
    const items = [{ id: "all", label: "All eras", icon: "🕰" }, ...eras.map((id) => ({ id, label: eraLabel(id), icon: "📅" }))];
    eraNav.innerHTML = items
      .map((g) => {
        const active = g.id === filterEra;
        const count = g.id === "all" ? events.length : counts[g.id] || 0;
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

  function filtered() {
    const q = (searchInput?.value || "").trim().toLowerCase();
    let list = events.filter((e) => {
      if (filterEra !== "all" && e.era !== filterEra) return false;
      if (!q) return true;
      const hay = [e.name, e.location, e.eventType, e.description, e.id].join(" ").toLowerCase();
      return hay.includes(q);
    });
    const sort = sortSelect?.value || "year";
    if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    else list = [...list].sort((a, b) => (a.year || 0) - (b.year || 0));
    return list;
  }

  function card(e) {
    const sel = window.HistoryDetail.getSelectedId() === e.id;
    return `<article class="item-card ${sel ? "selected" : ""}" data-id="${escapeHtml(e.id)}" data-type="event">
      ${e.image ? `<img class="item-thumb" src="${escapeHtml(e.image)}" alt="" loading="lazy" onerror="this.classList.add('hidden')" />` : `<span class="item-thumb-ph">⚔</span>`}
      <div class="item-body">
        <h3>${escapeHtml(e.name)}</h3>
        <span class="item-sub">${escapeHtml(lifeSpan(e))}${e.location ? ` · ${escapeHtml(e.location)}` : ""}</span>
        <div class="item-meta">
          ${e.eventType ? `<span class="meta-pill">${escapeHtml(e.eventType)}</span>` : ""}
          <span class="meta-pill">${escapeHtml(eraLabel(e.era))}</span>
        </div>
      </div>
    </article>`;
  }

  function renderStats() {
    statsEl.innerHTML = `
      <div class="stat-card"><span class="stat-val">${events.length}</span><span class="stat-label">Events</span></div>
      <div class="stat-card"><span class="stat-val">${events.filter((e) => e.image).length}</span><span class="stat-label">With images</span></div>
      <div class="stat-card"><span class="stat-val">${new Set(events.map((e) => e.era)).size}</span><span class="stat-label">Eras</span></div>`;
  }

  function renderGrid() {
    const list = filtered();
    if (!list.length) {
      grid.innerHTML = `<p class="empty-msg">${events.length ? "No matches." : "Build the database first."}</p>`;
      return;
    }
    grid.innerHTML = list.slice(0, 500).map(card).join("");
    if (list.length > 500) {
      grid.innerHTML += `<p class="muted page-hint">Showing 500 of ${list.length} — refine search.</p>`;
    }
    grid.querySelectorAll(".item-card").forEach((el) => {
      el.addEventListener("click", () => window.HistoryDetail.open(el.dataset.id, "event"));
    });
  }

  async function load() {
    loadingEl?.classList.remove("hidden");
    loadingEl.textContent = "Loading events…";
    try {
      const res = await invoke("events.list");
      events = res.events || [];
      renderStats();
      renderEraNav();
      renderGrid();
    } catch (err) {
      events = [];
      grid.innerHTML = `<p class="empty-msg">${escapeHtml(err.message)}</p>`;
    } finally {
      loadingEl?.classList.add("hidden");
    }
  }

  function setEraFilter(era) {
    filterEra = era;
    renderGrid();
  }

  async function scan() {
    await load();
  }

  function bind() {
    searchInput?.addEventListener("input", renderGrid);
    sortSelect?.addEventListener("change", renderGrid);
    window.HistoryDetail.setOnClose(() => renderGrid());
  }

  return { id: "events", page, scan, bind, setEraFilter, getEvents: () => events };
})();
