window.GeoPages = window.GeoPages || {};

window.GeoPages.explore = (function () {
  const { escapeHtml, invoke, formatNumber, formatArea, regionIcon, truncate, REGIONS, showFlags } = window.Geo;

  const page = document.getElementById("page-explore");
  const grid = document.getElementById("countries-grid");
  const statsEl = document.getElementById("explore-stats");
  const searchInput = document.getElementById("country-search");
  const sortSelect = document.getElementById("sort-select");
  const regionNav = document.getElementById("region-nav");
  const loadingEl = document.getElementById("explore-loading");
  const detailPanel = document.getElementById("detail-panel");
  const detailBody = document.getElementById("detail-body");
  const detailTitle = document.getElementById("detail-title");
  const detailClose = document.getElementById("detail-close");
  const shell = document.getElementById("app-shell");
  const btnRefresh = document.getElementById("btn-refresh");

  let countries = [];
  let userData = { visited: [], favorites: [] };
  let filterRegion = "all";
  let selectedCode = null;
  let detailCache = new Map();

  function visitedCodes() {
    return new Set(userData.visited.map((v) => v.countryCode));
  }

  function filteredCountries() {
    const q = (searchInput?.value || "").trim().toLowerCase();
    let list = countries.filter((c) => {
      if (filterRegion !== "all" && c.region !== filterRegion) return false;
      if (!q) return true;
      const hay = [c.name, c.officialName, c.capital, c.region, c.subregion, c.code, c.code2].join(" ").toLowerCase();
      return hay.includes(q);
    });
    const sort = sortSelect?.value || "name";
    if (sort === "population") list = [...list].sort((a, b) => b.population - a.population);
    else if (sort === "area") list = [...list].sort((a, b) => b.area - a.area);
    else list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }

  function renderStats() {
    const visited = visitedCodes();
    const regions = new Set(countries.map((c) => c.region).filter(Boolean));
    statsEl.innerHTML = `
      <div class="stat-card"><span class="stat-val">${countries.length}</span><span class="stat-label">Countries</span></div>
      <div class="stat-card"><span class="stat-val">${regions.size}</span><span class="stat-label">Regions</span></div>
      <div class="stat-card"><span class="stat-val">${visited.size}</span><span class="stat-label">You visited</span></div>
      <div class="stat-card"><span class="stat-val">${countries.length ? Math.round((visited.size / countries.length) * 100) : 0}%</span><span class="stat-label">World covered</span></div>`;
  }

  function renderRegionNav() {
    const counts = {};
    for (const c of countries) counts[c.region] = (counts[c.region] || 0) + 1;
    const items = [{ id: "all", name: "All regions", icon: "🌐" }, ...REGIONS.filter((r) => counts[r]).map((r) => ({ id: r, name: r, icon: regionIcon(r) }))];
    regionNav.innerHTML = items
      .map((g) => {
        const active = g.id === filterRegion;
        const count = g.id === "all" ? countries.length : counts[g.id] || 0;
        return `<button type="button" class="nav-item ${active ? "active" : ""}" data-reg="${escapeHtml(g.id)}">
          <span class="nav-icon">${g.icon}</span>${escapeHtml(g.name)} <span class="nav-count">${count}</span>
        </button>`;
      })
      .join("");
    regionNav.querySelectorAll("[data-reg]").forEach((btn) => {
      btn.addEventListener("click", () => {
        filterRegion = btn.dataset.reg;
        renderRegionNav();
        renderGrid();
      });
    });
  }

  function countryCard(c) {
    const vis = visitedCodes().has(c.code);
    const flagHtml =
      showFlags() && c.flag
        ? `<img class="country-flag" src="${escapeHtml(c.flag)}" alt="" loading="lazy" onerror="this.style.display='none'" />`
        : "";
    return `<article class="country-card ${selectedCode === c.code ? "selected" : ""}" data-code="${escapeHtml(c.code)}">
      <div class="country-card-head">
        ${flagHtml}
        <div>
          <h3>${escapeHtml(c.name)} ${vis ? '<span class="visited-badge">✓</span>' : ""}</h3>
          <span class="country-sub">${escapeHtml(c.capital || "—")} · ${escapeHtml(c.region || "")}</span>
        </div>
      </div>
      <div class="country-meta">
        <span class="meta-pill">👥 ${formatNumber(c.population)}</span>
        <span class="meta-pill">📐 ${formatArea(c.area)}</span>
      </div>
    </article>`;
  }

  function renderGrid() {
    const list = filteredCountries();
    if (!list.length) {
      grid.innerHTML = `<p class="empty-msg">No countries match your search.</p>`;
      return;
    }
    grid.innerHTML = list.map(countryCard).join("");
    grid.querySelectorAll(".country-card").forEach((el) => {
      el.addEventListener("click", () => openDetail(el.dataset.code));
    });
  }

  function infoItem(label, val) {
    if (val == null || val === "" || (Array.isArray(val) && !val.length)) return "";
    return `<div class="info-item"><span class="info-label">${escapeHtml(label)}</span><span class="info-val">${escapeHtml(Array.isArray(val) ? val.join(", ") : String(val))}</span></div>`;
  }

  function renderDetailTabs(c, activeTab = "overview") {
    const images = [];
    if (showFlags() && c.flag) images.push({ url: c.flag, caption: "Flag" });
    if (c.coatOfArms) images.push({ url: c.coatOfArms, caption: "Coat of arms" });

    const phoneCode = c.idd?.root ? `${c.idd.root}${(c.idd.suffixes || []).join(", ")}` : "";
    const langs = (c.languages || []).map((l) => l.name).join(", ");
    const currs = (c.currencies || []).map((cur) => `${cur.name} (${cur.symbol || cur.code})`).join(", ");
    const tz = (c.timezones || []).slice(0, 4).join(", ");
    const borders = (c.borders || []).join(", ");

    const gallery =
      images.length > 0
        ? `<div class="image-gallery">${images
            .map(
              (img) =>
                `<img class="gallery-img" src="${escapeHtml(img.url)}" alt="${escapeHtml(img.caption || "")}" title="${escapeHtml(img.caption || "")}" loading="lazy" />`
            )
            .join("")}</div>`
        : "";

    detailBody.innerHTML = `
      <div class="detail-hero">
        ${showFlags() && c.flag ? `<img class="country-flag country-flag-lg" src="${escapeHtml(c.flag)}" alt="" onerror="this.style.display='none'" />` : ""}
        <h3>${escapeHtml(c.name)}</h3>
        <p class="detail-official">${escapeHtml(c.officialName)}</p>
        ${c.nativeName ? `<p class="detail-official">${escapeHtml(c.nativeName)}</p>` : ""}
      </div>
      ${gallery}
      <div class="detail-tabs">
        <button type="button" class="tab-btn ${activeTab === "overview" ? "active" : ""}" data-tab="overview">Overview</button>
        <button type="button" class="tab-btn ${activeTab === "facts" ? "active" : ""}" data-tab="facts">Facts</button>
        <button type="button" class="tab-btn ${activeTab === "culture" ? "active" : ""}" data-tab="culture">Culture</button>
      </div>
      <div class="tab-pane ${activeTab === "overview" ? "active" : ""}" data-pane="overview">
        <div class="info-grid">
          ${infoItem("Capital", c.capital)}
          ${infoItem("Region", `${c.region}${c.subregion ? ` · ${c.subregion}` : ""}`)}
          ${infoItem("Continents", c.continents)}
          ${infoItem("Population", formatNumber(c.population))}
          ${infoItem("Area", formatArea(c.area))}
          ${infoItem("Density", c.density ? `${formatNumber(c.density)}/km²` : "")}
          ${infoItem("Coordinates", c.latlng?.length ? `${c.latlng[0]}, ${c.latlng[1]}` : "")}
          ${infoItem("Landlocked", c.landlocked ? "Yes" : "No")}
          ${infoItem("UN Member", c.unMember ? "Yes" : "No")}
        </div>
      </div>
      <div class="tab-pane ${activeTab === "facts" ? "active" : ""}" data-pane="facts">
        <div class="info-grid">
          ${infoItem("Country codes", `${c.code} / ${c.code2}`)}
          ${infoItem("Bordering countries", borders || "None / islands")}
          ${infoItem("Time zones", tz)}
          ${infoItem("Top-level domain", c.tld?.join(", "))}
          ${infoItem("Phone code", phoneCode)}
          ${infoItem("Driving side", c.car?.side || "")}
          ${infoItem("Car signs", c.car?.signs?.join(", "))}
          ${infoItem("FIFA code", c.fifa)}
          ${infoItem("Olympic code", c.cioc)}
          ${infoItem("Start of week", c.startOfWeek)}
        </div>
      </div>
      <div class="tab-pane ${activeTab === "culture" ? "active" : ""}" data-pane="culture">
        <div class="info-grid">
          ${infoItem("Languages", langs)}
          ${infoItem("Currencies", currs)}
          ${infoItem("Demonym", c.demonym)}
        </div>
      </div>
      <div class="detail-actions">
        <button type="button" class="btn btn-primary btn-sm" data-learn-more="${escapeHtml(c.code)}">📚 Learn more</button>
        ${c.maps?.googleMaps ? `<button type="button" class="btn btn-sm" data-map="${escapeHtml(c.maps.googleMaps)}">🗺 Google Maps</button>` : ""}
        ${c.maps?.openStreetMaps ? `<button type="button" class="btn btn-sm" data-map="${escapeHtml(c.maps.openStreetMaps)}">🗺 OpenStreetMap</button>` : ""}
        <button type="button" class="btn btn-ghost btn-sm" data-add-visit="${escapeHtml(c.code)}">✈ Mark as visited</button>
      </div>`;

    detailBody.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        detailBody.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
        detailBody.querySelectorAll(".tab-pane").forEach((p) => p.classList.toggle("active", p.dataset.pane === tab));
      });
    });

    detailBody.querySelectorAll("[data-map]").forEach((btn) => {
      btn.addEventListener("click", () => invoke("maps.open", { url: btn.dataset.map }));
    });

    detailBody.querySelector("[data-learn-more]")?.addEventListener("click", () => {
      window.GeoApp?.openLearn?.(c.code);
    });

    detailBody.querySelector("[data-add-visit]")?.addEventListener("click", () => {
      window.GeoPages.traveled?.openAddModal(c.code, c.name);
    });
  }

  async function openDetail(code) {
    selectedCode = code;
    renderGrid();
    detailPanel.classList.remove("hidden");
    shell.classList.add("detail-open");
    detailTitle.textContent = "Loading…";
    detailBody.innerHTML = `<p class="loading-msg">Loading country data…</p>`;

    try {
      let payload = detailCache.get(code);
      if (!payload) {
        const res = await invoke("countries.get", { code, skipWiki: true });
        payload = { country: res.country };
        detailCache.set(code, payload);
      }
      detailTitle.textContent = payload.country.name;
      renderDetailTabs(payload.country);
    } catch (err) {
      detailBody.innerHTML = `<p class="empty-msg">${escapeHtml(err.message)}</p>`;
      detailTitle.textContent = "Error";
    }
  }

  function closeDetail() {
    selectedCode = null;
    detailPanel.classList.add("hidden");
    shell.classList.remove("detail-open");
    renderGrid();
  }

  async function loadCountries(force = false) {
    loadingEl?.classList.remove("hidden");
    grid.innerHTML = "";
    try {
      const res = await invoke("countries.list", { force });
      countries = res.countries || [];
      renderStats();
      renderRegionNav();
      renderGrid();
    } catch (err) {
      grid.innerHTML = `<p class="empty-msg">${escapeHtml(err.message)}</p>`;
    } finally {
      loadingEl?.classList.add("hidden");
    }
  }

  async function scan() {
    userData = await window.GeoStorage.get();
    if (!countries.length) await loadCountries();
    else {
      renderStats();
      renderGrid();
    }
  }

  function bind() {
    searchInput?.addEventListener("input", renderGrid);
    sortSelect?.addEventListener("change", renderGrid);
    detailClose?.addEventListener("click", closeDetail);
    btnRefresh?.addEventListener("click", () => {
      detailCache.clear();
      loadCountries(true);
    });
  }

  function refreshSettingsView() {
    renderGrid();
    if (selectedCode && !detailPanel.classList.contains("hidden")) {
      const payload = detailCache.get(selectedCode);
      if (payload?.country) {
        detailTitle.textContent = payload.country.name;
        renderDetailTabs(payload.country);
      }
    }
  }

  return { id: "explore", page, scan, bind, openDetail, closeDetail, loadCountries, refreshSettingsView };
})();
