window.SpacePages = window.SpacePages || {};

window.SpacePages.reports = (function () {
  const { escapeHtml, invoke } = window.Space;

  const page = document.getElementById("page-reports");
  const grid = document.getElementById("reports-grid");
  const statsEl = document.getElementById("reports-stats");
  const search = document.getElementById("reports-search");
  const catSel = document.getElementById("reports-category");

  const CAT_LABELS = {
    all: "All",
    "human-spaceflight": "Human spaceflight",
    planetary: "Planetary",
    science: "Science",
    "earth-science": "Earth science",
    "planetary-defense": "Planetary defense",
    policy: "Policy & decadal",
    technology: "Technology",
    reference: "Reference",
  };

  function card(r) {
    return `<article class="report-card" data-report="${escapeHtml(r.id)}">
      <div class="report-card-head">
        <span class="report-year">${escapeHtml(r.year || "")}</span>
        <span class="report-cat">${escapeHtml(CAT_LABELS[r.category] || r.category)}</span>
      </div>
      <h3>${escapeHtml(r.title)}</h3>
      <p class="item-desc">${escapeHtml((r.summary || "").slice(0, 140))}${(r.summary || "").length > 140 ? "…" : ""}</p>
      <div class="tag-row">${(r.tags || []).slice(0, 4).map((t) => `<span class="tag-chip">${escapeHtml(t)}</span>`).join("")}</div>
      <span class="report-open-hint">Open full summary →</span>
    </article>`;
  }

  async function scan() {
    const category = catSel?.value || "all";
    const q = search?.value || "";
    grid.innerHTML = `<p class="muted">Loading public NASA reports…</p>`;
    try {
      const res = await invoke("nasa.reports.list", { category, q });
      const planetary = res.reports.filter((r) => r.category === "planetary").length;
      const human = res.reports.filter((r) => r.category === "human-spaceflight").length;
      statsEl.innerHTML = `
        <div class="stat-card"><span class="stat-val">${res.count}</span><span class="stat-label">Reports</span></div>
        <div class="stat-card"><span class="stat-val">${planetary}</span><span class="stat-label">Planetary</span></div>
        <div class="stat-card"><span class="stat-val">${human}</span><span class="stat-label">Human spaceflight</span></div>
        <div class="stat-card"><span class="stat-val">NTRS</span><span class="stat-label">Open archive</span></div>`;
      grid.innerHTML = res.reports.map(card).join("") || `<p class="empty-msg">No reports match.</p>`;
      grid.querySelectorAll("[data-report]").forEach((el) => {
        el.addEventListener("click", () => window.SpaceDetail.openReport(el.dataset.report));
      });
    } catch (err) {
      grid.innerHTML = `<p class="db-err">${escapeHtml(err.message)}</p>`;
    }
  }

  function bind() {
    search?.addEventListener("input", scan);
    catSel?.addEventListener("change", scan);
  }

  return { id: "reports", page, scan, bind };
})();