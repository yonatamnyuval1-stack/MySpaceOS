window.LexiconPages = window.LexiconPages || {};

window.LexiconPages.browse = (function () {
  const {
    escapeHtml,
    invoke,
    debounce,
    levelLabel,
    levelClass,
    categoryMeta,
    CATEGORIES,
    googleUrl,
    mdnUrl,
  } = window.Lexicon;

  const page = document.getElementById("page-browse");
  const grid = document.getElementById("terms-grid");
  const statsEl = document.getElementById("browse-stats");
  const resultsMeta = document.getElementById("results-meta");
  const searchInput = document.getElementById("term-search");
  const levelFilter = document.getElementById("level-filter");
  const sortSelect = document.getElementById("sort-select");
  const categoryNav = document.getElementById("category-nav");
  const detailPanel = document.getElementById("detail-panel");
  const detailBody = document.getElementById("detail-body");
  const detailTitle = document.getElementById("detail-title");
  const detailClose = document.getElementById("detail-close");
  const shell = document.getElementById("app-shell");
  const pager = document.getElementById("pager");
  const btnPrev = document.getElementById("btn-prev");
  const btnNext = document.getElementById("btn-next");
  const pagerLabel = document.getElementById("pager-label");

  let stats = { termCount: 0, categories: [] };
  let userData = { settings: {} };
  let filterCategory = "all";
  let selectedId = null;
  let offset = 0;
  const limit = 60;
  let lastTotal = 0;

  function renderSidebarStats() {
    const el = document.getElementById("sidebar-stats");
    if (el) el.textContent = `${stats.termCount.toLocaleString()} terms · ${stats.categories.length} categories`;
  }

  function renderStats() {
    statsEl.innerHTML = `
      <div class="stat-card"><span class="stat-val">${stats.termCount.toLocaleString()}</span><span class="stat-label">Terms</span></div>
      <div class="stat-card"><span class="stat-val">${stats.categories.length}</span><span class="stat-label">Categories</span></div>
      <div class="stat-card"><span class="stat-val">${filterCategory === "all" ? "All" : categoryMeta(filterCategory).label.split(" ")[0]}</span><span class="stat-label">Filter</span></div>`;
  }

  function renderCategoryNav() {
    const counts = {};
    for (const c of stats.categories) counts[c.id] = c.count;
    const items = CATEGORIES.filter((c) => c.id === "all" || counts[c.id]);
    categoryNav.innerHTML = items
      .map((c) => {
        const active = c.id === filterCategory;
        const count = c.id === "all" ? stats.termCount : counts[c.id] || 0;
        return `<button type="button" class="nav-item ${active ? "active" : ""}" data-cat="${escapeHtml(c.id)}">
          <span class="nav-icon">${c.icon}</span>${escapeHtml(c.label)} <span class="nav-count">${count.toLocaleString()}</span>
        </button>`;
      })
      .join("");
    categoryNav.querySelectorAll("[data-cat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        filterCategory = btn.dataset.cat;
        offset = 0;
        renderCategoryNav();
        loadTerms();
      });
    });
  }

  function termCard(t) {
    const cat = categoryMeta(t.category);
    return `<article class="term-card ${selectedId === t.id ? "selected" : ""}" data-id="${escapeHtml(t.id)}">
      <div class="term-card-head">
        <span class="term-cat-icon">${cat.icon}</span>
        <div class="term-card-titles">
          <h3>${escapeHtml(t.term)}</h3>
          <span class="term-cat">${escapeHtml(cat.label)}</span>
        </div>
      </div>
      <p class="term-preview">${escapeHtml(t.definitionPreview || "")}${(t.definitionPreview || "").length >= 120 ? "…" : ""}</p>
      <div class="term-meta">
        <span class="level-badge ${levelClass(t.level)}">${escapeHtml(levelLabel(t.level))}</span>
        ${t.tags?.length ? `<span class="term-tags">${t.tags.slice(0, 3).map((tag) => escapeHtml(tag)).join(" · ")}</span>` : ""}
      </div>
    </article>`;
  }

  async function loadTerms() {
    grid.innerHTML = `<p class="loading-msg">Loading terms…</p>`;
    try {
      const res = await invoke("terms.list", {
        q: searchInput?.value || "",
        category: filterCategory,
        level: levelFilter?.value || "all",
        sort: sortSelect?.value || "name",
        offset,
        limit,
      });
      lastTotal = res.total;
      resultsMeta.textContent =
        lastTotal === 0
          ? "No terms match your search."
          : `Showing ${offset + 1}–${Math.min(offset + res.terms.length, lastTotal)} of ${lastTotal.toLocaleString()} terms`;

      if (!res.terms.length) {
        grid.innerHTML = `<div class="empty-state"><p>No terms found. Try a different search or category.</p></div>`;
      } else {
        grid.innerHTML = res.terms.map(termCard).join("");
        grid.querySelectorAll(".term-card[data-id]").forEach((card) => {
          card.addEventListener("click", () => openDetail(card.dataset.id));
        });
      }

      const hasPager = lastTotal > limit;
      pager?.classList.toggle("hidden", !hasPager);
      if (hasPager) {
        pagerLabel.textContent = `Page ${Math.floor(offset / limit) + 1} of ${Math.ceil(lastTotal / limit)}`;
        btnPrev.disabled = offset <= 0;
        btnNext.disabled = offset + limit >= lastTotal;
      }
    } catch (err) {
      grid.innerHTML = `<div class="empty-state error"><p>${escapeHtml(err.message)}</p></div>`;
    }
  }

  async function openDetail(id) {
    selectedId = id;
    shell.classList.add("detail-open");
    detailPanel.classList.remove("hidden");
    detailTitle.textContent = "Loading…";
    detailBody.innerHTML = "";

    try {
      const [{ term }, related] = await Promise.all([
        invoke("terms.get", { id }),
        invoke("terms.related", { id }),
      ]);

      detailTitle.textContent = term.term;

      const cat = categoryMeta(term.category);
      const tagHtml = (term.tags || [])
        .map((tag) => `<span class="tag-chip">${escapeHtml(tag)}</span>`)
        .join("");

      const relatedHtml = related.terms?.length
        ? `<section class="detail-section">
            <h4>Related</h4>
            <div class="related-list">${related.terms
              .map(
                (r) =>
                  `<button type="button" class="related-btn" data-id="${escapeHtml(r.id)}">${escapeHtml(r.term)}</button>`
              )
              .join("")}</div>
          </section>`
        : "";

      detailBody.innerHTML = `
        <div class="detail-badges">
          <span class="cat-badge">${cat.icon} ${escapeHtml(cat.label)}</span>
          <span class="level-badge ${levelClass(term.level)}">${escapeHtml(levelLabel(term.level))}</span>
        </div>
        <section class="detail-section">
          <h4>Definition</h4>
          <p class="definition-text">${escapeHtml(term.definition)}</p>
        </section>
        ${
          term.example
            ? `<section class="detail-section"><h4>Example</h4><pre class="example-block">${escapeHtml(term.example)}</pre></section>`
            : ""
        }
        ${tagHtml ? `<section class="detail-section"><h4>Tags</h4><div class="tag-row">${tagHtml}</div></section>` : ""}
        ${relatedHtml}
        <section class="detail-section detail-links">
          <h4>Learn more</h4>
          <button type="button" class="btn btn-ghost btn-sm" data-link="mdn">MDN Search</button>
          <button type="button" class="btn btn-ghost btn-sm" data-link="google">Google</button>
        </section>`;

      detailBody.querySelectorAll(".related-btn").forEach((btn) => {
        btn.addEventListener("click", () => openDetail(btn.dataset.id));
      });
      detailBody.querySelector('[data-link="mdn"]')?.addEventListener("click", () => {
        invoke("link.open", { url: mdnUrl(term.term) });
      });
      detailBody.querySelector('[data-link="google"]')?.addEventListener("click", () => {
        invoke("link.open", { url: googleUrl(term.term) });
      });

      loadTerms();
    } catch (err) {
      detailBody.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
    }
  }

  function closeDetail() {
    selectedId = null;
    shell.classList.remove("detail-open");
    detailPanel.classList.add("hidden");
    loadTerms();
  }

  const debouncedSearch = debounce(() => {
    offset = 0;
    loadTerms();
  }, 250);

  function bind() {
    searchInput?.addEventListener("input", debouncedSearch);
    levelFilter?.addEventListener("change", () => {
      offset = 0;
      loadTerms();
    });
    sortSelect?.addEventListener("change", () => {
      offset = 0;
      loadTerms();
    });
    detailClose?.addEventListener("click", closeDetail);
    btnPrev?.addEventListener("click", () => {
      offset = Math.max(0, offset - limit);
      loadTerms();
    });
    btnNext?.addEventListener("click", () => {
      if (offset + limit < lastTotal) {
        offset += limit;
        loadTerms();
      }
    });
  }

  async function scan() {
    try {
      const [statsRes, user] = await Promise.all([invoke("stats.get"), window.LexiconStorage.load()]);
      stats = statsRes;
      userData = user;
      renderSidebarStats();
      renderStats();
      renderCategoryNav();
      await loadTermOfDay();
      await loadTerms();
    } catch (err) {
      grid.innerHTML = `<div class="empty-state error"><p>${escapeHtml(err.message)}</p></div>`;
    }
  }

  async function loadTermOfDay() {
    try {
      const res = await invoke("terms.daily");
      const t = res.term;
      if (!t) return;
      let banner = page.querySelector("#term-of-day");
      if (!banner) {
        banner = document.createElement("aside");
        banner.id = "term-of-day";
        banner.className = "term-of-day";
        page.insertBefore(banner, statsEl?.nextSibling || page.firstChild);
      }
      banner.innerHTML = `
        <div class="term-of-day-label">Term of the day</div>
        <button type="button" class="term-of-day-btn">
          <strong>${escapeHtml(t.term)}</strong>
          <span>${escapeHtml(String(t.definition || "").slice(0, 120))}${String(t.definition || "").length > 120 ? "…" : ""}</span>
        </button>`;
      banner.querySelector(".term-of-day-btn")?.addEventListener("click", () => openDetail(t.id));
    } catch {
      page.querySelector("#term-of-day")?.remove();
    }
  }

  function setCategory(catId) {
    filterCategory = catId || "all";
    offset = 0;
    renderCategoryNav();
    loadTerms();
  }

  return { id: "browse", page, scan, bind, openDetail, closeDetail, setCategory };
})();
