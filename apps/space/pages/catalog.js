window.SpacePages = window.SpacePages || {};

window.SpacePages.catalog = (function () {
  const { escapeHtml, invoke, categoryLabel } = window.Space;

  const page = document.getElementById("page-catalog");
  const grid = document.getElementById("catalog-grid");
  const statsEl = document.getElementById("catalog-stats");
  const search = document.getElementById("catalog-search");
  const sortSel = document.getElementById("catalog-sort");
  const catNav = document.getElementById("cat-nav");

  let all = [];
  let filterCat = "all";

  function card(b) {
    const thumb = b.image
      ? `<img class="item-thumb" src="${escapeHtml(b.image)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'item-thumb-ph',textContent:'✦'}))" />`
      : `<span class="item-thumb-ph" style="color:${escapeHtml(b.color)}">✦</span>`;
    return `<article class="item-card" data-id="${escapeHtml(b.id)}">
      ${thumb}
      <div class="item-body">
        <h3>${escapeHtml(b.name)}</h3>
        <span class="item-sub">${escapeHtml(categoryLabel(b.category))}</span>
        <p class="item-desc">${escapeHtml((b.description || "").slice(0, 90))}${(b.description || "").length > 90 ? "…" : ""}</p>
      </div>
    </article>`;
  }

  function filtered() {
    const q = (search?.value || "").trim().toLowerCase();
    let list = all;
    if (filterCat !== "all") list = list.filter((b) => b.category === filterCat);
    if (q) {
      list = list.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          (b.description || "").toLowerCase().includes(q) ||
          categoryLabel(b.category).toLowerCase().includes(q)
      );
    }
    const sort = sortSel?.value || "order";
    if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    else list = [...list].sort((a, b) => a.orbitOrder - b.orbitOrder || a.name.localeCompare(b.name));
    return list.slice(0, 500);
  }

  function renderStats() {
    const counts = {};
    for (const b of all) counts[b.category] = (counts[b.category] || 0) + 1;
    statsEl.innerHTML = `
      <div class="stat-card"><span class="stat-val">${all.length}</span><span class="stat-label">Objects</span></div>
      <div class="stat-card"><span class="stat-val">${counts.planet || 0}</span><span class="stat-label">Planets</span></div>
      <div class="stat-card"><span class="stat-val">${counts.moon || 0}</span><span class="stat-label">Moons</span></div>
      <div class="stat-card"><span class="stat-val">${(counts.mission || 0) + (counts.deepsky || 0)}</span><span class="stat-label">Missions & deep sky</span></div>`;
  }

  function renderGrid() {
    const list = filtered();
    if (!list.length) {
      grid.innerHTML = `<p class="empty-msg">No objects match your search.</p>`;
      return;
    }
    grid.innerHTML = list.map(card).join("");
    grid.querySelectorAll(".item-card[data-id]").forEach((el) => {
      el.addEventListener("click", () => window.SpaceDetail.open(el.dataset.id));
    });
  }

  function buildCatNav() {
    const cats = [
      ["all", "All"],
      ["planet", "Planets"],
      ["moon", "Moons"],
      ["dwarf", "Dwarf planets"],
      ["star", "Stars"],
      ["mission", "Missions"],
      ["deepsky", "Deep sky"],
    ];
    catNav.innerHTML = cats
      .map(
        ([id, label]) =>
          `<button type="button" class="nav-item ${id === filterCat ? "active" : ""}" data-cat="${id}">${label}</button>`
      )
      .join("");
    catNav.querySelectorAll("[data-cat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        filterCat = btn.dataset.cat;
        catNav.querySelectorAll("[data-cat]").forEach((b) => b.classList.toggle("active", b === btn));
        renderGrid();
      });
    });
  }

  async function scan() {
    const res = await invoke("catalog.list", {});
    all = res.bodies || [];
    buildCatNav();
    renderStats();
    renderGrid();
  }

  function bind() {
    search?.addEventListener("input", renderGrid);
    sortSel?.addEventListener("change", renderGrid);
  }

  return { id: "catalog", page, scan, bind };
})();
