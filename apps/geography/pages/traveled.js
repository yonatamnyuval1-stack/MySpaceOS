window.GeoPages = window.GeoPages || {};

window.GeoPages.traveled = (function () {
  const { escapeHtml, invoke, uid, stars, formatNumber, showFlags } = window.Geo;

  const page = document.getElementById("page-traveled");
  const grid = document.getElementById("visited-grid");
  const statsEl = document.getElementById("travel-stats");
  const modal = document.getElementById("visit-modal");
  const modalTitle = document.getElementById("visit-modal-title");
  const modalBody = document.getElementById("visit-modal-body");
  const visitForm = document.getElementById("visit-form");
  const btnAdd = document.getElementById("btn-add-visit");
  const btnDelete = document.getElementById("visit-delete");
  const btnCancel = document.getElementById("visit-cancel");
  const btnModalClose = document.getElementById("visit-modal-close");

  let userData = { visited: [] };
  let countries = [];
  let editingId = null;

  async function ensureCountries() {
    if (countries.length) return;
    try {
      const res = await invoke("countries.list");
      countries = res.countries || [];
    } catch {
      countries = [];
    }
  }

  function countryFlag(code) {
    const c = countries.find((x) => x.code === code);
    return c?.flag || "";
  }

  function countryName(code) {
    const c = countries.find((x) => x.code === code);
    return c?.name || code;
  }

  function renderStats() {
    const visited = userData.visited || [];
    const continents = new Set();
    for (const v of visited) {
      const c = countries.find((x) => x.code === v.countryCode);
      if (c?.continents) c.continents.forEach((ct) => continents.add(ct));
    }
    const total = countries.length || 195;
    statsEl.innerHTML = `
      <div class="stat-card"><span class="stat-val">${visited.length}</span><span class="stat-label">Countries visited</span></div>
      <div class="stat-card"><span class="stat-val">${total ? Math.round((visited.length / total) * 100) : 0}%</span><span class="stat-label">Of the world</span></div>
      <div class="stat-card"><span class="stat-val">${continents.size}</span><span class="stat-label">Continents</span></div>
      <div class="stat-card"><span class="stat-val">${visited.reduce((n, v) => n + (v.visitCount || 1), 0)}</span><span class="stat-label">Total trips</span></div>`;
  }

  function visitCard(v) {
    const flag = showFlags() ? countryFlag(v.countryCode) : "";
    const name = v.countryName || countryName(v.countryCode);
    const cities = (v.cities || []).slice(0, 3).join(", ");
    const flagHtml =
      flag ? `<img class="country-flag" src="${escapeHtml(flag)}" alt="" loading="lazy" onerror="this.style.display='none'" />` : "";
    return `<article class="visited-card" data-id="${escapeHtml(v.id)}">
      <div class="country-card-head">
        ${flagHtml}
        <div>
          <h3>${escapeHtml(name)}</h3>
          <span class="country-sub">${v.firstVisit ? `First: ${escapeHtml(v.firstVisit)}` : "No date"}${v.lastVisit && v.lastVisit !== v.firstVisit ? ` · Last: ${escapeHtml(v.lastVisit)}` : ""}</span>
        </div>
      </div>
      <div class="country-meta">
        ${v.rating ? `<span class="meta-pill">${stars(v.rating)}</span>` : ""}
        ${v.visitCount > 1 ? `<span class="meta-pill">✈ ${v.visitCount}×</span>` : ""}
        ${cities ? `<span class="meta-pill">📍 ${escapeHtml(cities)}</span>` : ""}
      </div>
      ${v.notes ? `<p class="muted" style="margin:8px 0 0;font-size:0.8rem">${escapeHtml(v.notes.slice(0, 120))}${v.notes.length > 120 ? "…" : ""}</p>` : ""}
    </article>`;
  }

  function renderGrid() {
    const list = [...(userData.visited || [])].sort((a, b) =>
      (a.countryName || a.countryCode).localeCompare(b.countryName || b.countryCode)
    );
    if (!list.length) {
      grid.innerHTML = `<p class="empty-msg">No countries logged yet. Click <strong>+ Add country visited</strong> to start your travel map.</p>`;
      return;
    }
    grid.innerHTML = list.map(visitCard).join("");
    grid.querySelectorAll(".visited-card").forEach((el) => {
      el.addEventListener("click", () => openEditModal(el.dataset.id));
    });
  }

  function buildCountryOptions(selectedCode) {
    const used = new Set((userData.visited || []).map((v) => v.countryCode));
    return countries
      .filter((c) => !used.has(c.code) || c.code === selectedCode)
      .map((c) => `<option value="${escapeHtml(c.code)}" ${c.code === selectedCode ? "selected" : ""}>${escapeHtml(c.name)}</option>`)
      .join("");
  }

  function renderModalForm(visit) {
    const isEdit = Boolean(visit?.id);
    const code = visit?.countryCode || "";
    modalBody.innerHTML = `
      <label><span>Country</span>
        <select id="vis-country" ${isEdit ? "disabled" : ""} required>${buildCountryOptions(code)}</select>
      </label>
      <div class="row-2">
        <label><span>First visit</span><input type="date" id="vis-first" value="${escapeHtml(visit?.firstVisit || "")}" /></label>
        <label><span>Last visit</span><input type="date" id="vis-last" value="${escapeHtml(visit?.lastVisit || "")}" /></label>
      </div>
      <label><span>Number of visits</span><input type="number" id="vis-count" min="1" value="${visit?.visitCount || 1}" /></label>
      <label><span>Cities visited (comma-separated)</span><input type="text" id="vis-cities" value="${escapeHtml((visit?.cities || []).join(", "))}" placeholder="Tel Aviv, Paris…" /></label>
      <label><span>Rating (1–5)</span>
        <select id="vis-rating">
          <option value="0">—</option>
          ${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${visit?.rating === n ? "selected" : ""}>${n} ${stars(n)}</option>`).join("")}
        </select>
      </label>
      <label><span>Notes & memories</span><textarea id="vis-notes" placeholder="What did you love? Food, places, tips…">${escapeHtml(visit?.notes || "")}</textarea></label>`;
  }

  function openAddModal(presetCode, presetName) {
    editingId = null;
    modalTitle.textContent = "Add visited country";
    btnDelete.classList.add("hidden");
    renderModalForm(presetCode ? { countryCode: presetCode, countryName: presetName } : null);
    modal.showModal();
  }

  function openEditModal(id) {
    const visit = (userData.visited || []).find((v) => v.id === id);
    if (!visit) return;
    editingId = id;
    modalTitle.textContent = `Edit — ${visit.countryName || countryName(visit.countryCode)}`;
    btnDelete.classList.remove("hidden");
    renderModalForm(visit);
    modal.showModal();
  }

  async function saveVisit() {
    const code = document.getElementById("vis-country")?.value;
    if (!code) return;
    const c = countries.find((x) => x.code === code);
    const entry = {
      id: editingId || uid("vis"),
      countryCode: code,
      countryName: c?.name || code,
      firstVisit: document.getElementById("vis-first")?.value || "",
      lastVisit: document.getElementById("vis-last")?.value || "",
      visitCount: Number(document.getElementById("vis-count")?.value) || 1,
      cities: (document.getElementById("vis-cities")?.value || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      rating: Number(document.getElementById("vis-rating")?.value) || 0,
      notes: document.getElementById("vis-notes")?.value || "",
      updatedAt: new Date().toISOString(),
    };

    let visited = [...(userData.visited || [])];
    if (editingId) {
      const idx = visited.findIndex((v) => v.id === editingId);
      if (idx >= 0) visited[idx] = { ...visited[idx], ...entry };
    } else {
      if (visited.some((v) => v.countryCode === code)) {
        alert("This country is already in your travel log.");
        return;
      }
      entry.createdAt = new Date().toISOString();
      visited.push(entry);
    }

    userData.visited = visited;
    await window.GeoStorage.save(userData);
    modal.close();
    renderStats();
    renderGrid();
    window.GeoPages.explore?.scan();
  }

  async function deleteVisit() {
    if (!editingId || !confirm("Remove this country from your travel log?")) return;
    userData.visited = (userData.visited || []).filter((v) => v.id !== editingId);
    await window.GeoStorage.save(userData);
    modal.close();
    renderStats();
    renderGrid();
    window.GeoPages.explore?.scan();
  }

  async function scan() {
    userData = await window.GeoStorage.get();
    await ensureCountries();
    renderStats();
    renderGrid();
  }

  function bind() {
    btnAdd?.addEventListener("click", () => openAddModal());
    btnCancel?.addEventListener("click", () => modal.close());
    btnModalClose?.addEventListener("click", () => modal.close());
    btnDelete?.addEventListener("click", deleteVisit);
    visitForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      saveVisit();
    });
  }

  return { id: "traveled", page, scan, bind, openAddModal };
})();
