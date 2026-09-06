window.SpacePages = window.SpacePages || {};

window.SpacePages.aliens = (function () {
  const { escapeHtml, invoke } = window.Space;

  const page = document.getElementById("page-aliens");
  const tabBar = document.getElementById("aliens-tabs");
  const panels = {
    docs: document.getElementById("aliens-panel-docs"),
    overview: document.getElementById("aliens-panel-overview"),
    science: document.getElementById("aliens-panel-science"),
    timeline: document.getElementById("aliens-panel-timeline"),
    cases: document.getElementById("aliens-panel-cases"),
    glossary: document.getElementById("aliens-panel-glossary"),
  };

  let activeTab = "docs";
  let hub = null;
  let docsPack = null;
  let loaded = false;

  const KIND_LABELS = {
    assessment: "Assessment",
    "annual-report": "Annual report",
    historical: "Historical",
    study: "Study",
    oversight: "Oversight",
    "case-resolution": "Case resolution",
    materials: "Materials",
  };

  function setTab(tab) {
    activeTab = tab;
    tabBar?.querySelectorAll("[data-aliens-tab]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.aliensTab === tab);
    });
    Object.entries(panels).forEach(([id, el]) => {
      if (el) el.hidden = id !== tab;
    });
    if (tab === "docs") renderDocs();
    if (tab === "overview") renderOverview();
    if (tab === "science") renderScience();
    if (tab === "timeline") renderTimeline();
    if (tab === "cases") renderCases();
    if (tab === "glossary") renderGlossary();
  }

  async function ensureData() {
    if (loaded && hub && docsPack) return;
    const [hubRes, docsRes] = await Promise.all([invoke("aliens.hub", {}), invoke("uap.docs.list", {})]);
    hub = hubRes.hub;
    docsPack = docsRes;
    loaded = true;
  }

  function toast(msg, isErr) {
    const el = document.getElementById("aliens-toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle("aliens-toast--err", !!isErr);
    el.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add("hidden"), 3200);
  }

  async function openDoc(id) {
    try {
      await invoke("uap.docs.open", { id });
      toast("Opened PDF in your default viewer");
    } catch (err) {
      toast(err.message || "Could not open PDF", true);
    }
  }

  async function saveDoc(id) {
    try {
      const res = await invoke("uap.docs.saveCopy", { id });
      toast(`Saved to Downloads: ${res.path ? res.path.split(/[/\\]/).pop() : "PDF"}`);
    } catch (err) {
      toast(err.message || "Could not save copy", true);
    }
  }

  async function revealDoc(id) {
    try {
      await invoke("uap.docs.reveal", { id });
    } catch (err) {
      toast(err.message || "Could not reveal file", true);
    }
  }

  function docCard(d) {
    const kind = KIND_LABELS[d.kind] || d.kind || "Document";
    const missing = !d.exists;
    return `<article class="aliens-doc-card ${missing ? "aliens-doc-card--missing" : ""}" data-doc="${escapeHtml(d.id)}">
      <div class="aliens-doc-top">
        <span class="aliens-doc-kind">${escapeHtml(kind)}</span>
        <span class="aliens-doc-meta">${escapeHtml(d.date || "—")} · ${escapeHtml(d.sizeLabel || "—")}</span>
      </div>
      <h3>${escapeHtml(d.title)}</h3>
      <p class="aliens-doc-issuer">${escapeHtml(d.issuer || "")}</p>
      <p class="item-desc">${escapeHtml(d.summary || "")}</p>
      <div class="aliens-doc-actions">
        <button type="button" class="btn btn-primary btn-sm" data-act="open" ${missing ? "disabled" : ""}>Open PDF</button>
        <button type="button" class="btn btn-ghost btn-sm" data-act="save" ${missing ? "disabled" : ""}>Download copy</button>
        <button type="button" class="btn btn-ghost btn-sm" data-act="reveal" ${missing ? "disabled" : ""}>Show folder</button>
        ${
          d.officialUrl
            ? `<button type="button" class="btn btn-ghost btn-sm" data-act="official" data-url="${escapeHtml(d.officialUrl)}">Official source</button>`
            : ""
        }
      </div>
      ${missing ? `<p class="aliens-doc-missing">File missing on disk</p>` : ""}
    </article>`;
  }

  function renderDocs() {
    const stats = document.getElementById("aliens-docs-stats");
    const grid = document.getElementById("aliens-docs-grid");
    const note = document.getElementById("aliens-docs-note");
    const ext = document.getElementById("aliens-docs-external");
    if (!docsPack || !grid) return;

    if (note) note.textContent = docsPack.note || "";
    if (stats) {
      stats.innerHTML = `
        <div class="stat-card"><span class="stat-val">${docsPack.available}</span><span class="stat-label">PDFs ready</span></div>
        <div class="stat-card"><span class="stat-val">${docsPack.documents.length}</span><span class="stat-label">Catalogued</span></div>
        <div class="stat-card"><span class="stat-val">UAP</span><span class="stat-label">Unclassified</span></div>
        <div class="stat-card"><span class="stat-val">AARO</span><span class="stat-label">Primary source</span></div>`;
    }

    const kindFilter = document.getElementById("aliens-doc-filter")?.value || "all";
    const q = (document.getElementById("aliens-doc-search")?.value || "").trim().toLowerCase();
    let list = [...(docsPack.documents || [])];
    if (kindFilter !== "all") list = list.filter((d) => d.kind === kindFilter);
    if (q) {
      list = list.filter(
        (d) =>
          (d.title || "").toLowerCase().includes(q) ||
          (d.issuer || "").toLowerCase().includes(q) ||
          (d.summary || "").toLowerCase().includes(q)
      );
    }

    grid.innerHTML = list.map(docCard).join("") || `<p class="empty-msg">No documents match.</p>`;
    grid.querySelectorAll(".aliens-doc-card").forEach((card) => {
      const id = card.dataset.doc;
      card.querySelectorAll("[data-act]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const act = btn.dataset.act;
          if (act === "open") openDoc(id);
          if (act === "save") saveDoc(id);
          if (act === "reveal") revealDoc(id);
          if (act === "official" && btn.dataset.url) invoke("link.open", { url: btn.dataset.url });
        });
      });
    });

    if (ext) {
      const externals = docsPack.externalOnly || [];
      if (!externals.length) {
        ext.innerHTML = "";
        return;
      }
      ext.innerHTML = `<h2 class="section-heading">Also available online</h2>
        ${externals
          .map(
            (x) => `<article class="aliens-doc-card aliens-doc-card--external">
            <h3>${escapeHtml(x.title)}</h3>
            <p class="item-desc">${escapeHtml(x.summary || x.reason || "")}</p>
            <button type="button" class="btn btn-primary btn-sm" data-url="${escapeHtml(x.officialUrl)}">Open official PDF</button>
          </article>`
          )
          .join("")}`;
      ext.querySelectorAll("[data-url]").forEach((btn) => {
        btn.addEventListener("click", () => invoke("link.open", { url: btn.dataset.url }));
      });
    }
  }

  function renderOverview() {
    const el = document.getElementById("aliens-overview-body");
    if (!el || !hub) return;
    const o = hub.overview || {};
    el.innerHTML = `
      <div class="aliens-banner">
        <p class="aliens-disclaimer">${escapeHtml(hub.disclaimer || "")}</p>
      </div>
      <h2 class="aliens-lead-title">${escapeHtml(o.title || "Overview")}</h2>
      <p class="aliens-lead">${escapeHtml(o.lead || "")}</p>
      <div class="aliens-pillars">
        ${(o.pillars || [])
          .map(
            (p) => `<article class="aliens-pillar">
            <h3>${escapeHtml(p.title)}</h3>
            <p>${escapeHtml(p.text)}</p>
          </article>`
          )
          .join("")}
      </div>
      <h2 class="section-heading">What official reports usually conclude</h2>
      <div class="aliens-explain-grid">
        ${(hub.explanations || [])
          .map(
            (x) => `<article class="topic-card">
            <h4>${escapeHtml(x.label)}</h4>
            <p class="item-desc">${escapeHtml(x.text)}</p>
          </article>`
          )
          .join("")}
      </div>
      <h2 class="section-heading">FAQ</h2>
      <div class="aliens-faq">
        ${(hub.faq || [])
          .map(
            (f) => `<details class="aliens-faq-item">
            <summary>${escapeHtml(f.q)}</summary>
            <p>${escapeHtml(f.a)}</p>
          </details>`
          )
          .join("")}
      </div>
      <h2 class="section-heading">Useful links</h2>
      <div class="link-row aliens-links">
        ${(hub.links || [])
          .map((l) => `<button type="button" class="btn btn-ghost btn-sm" data-url="${escapeHtml(l.url)}">${escapeHtml(l.label)} →</button>`)
          .join("")}
      </div>`;
    el.querySelectorAll("[data-url]").forEach((btn) => {
      btn.addEventListener("click", () => invoke("link.open", { url: btn.dataset.url }));
    });
  }

  function renderScience() {
    const el = document.getElementById("aliens-science-body");
    if (!el || !hub) return;
    el.innerHTML = `
      <p class="page-hint">Scientific search for life and technology beyond Earth. separate from military UAP casework.</p>
      <div class="aliens-science-grid">
        ${(hub.science || [])
          .map(
            (s) => `<article class="aliens-science-card">
            <h3>${escapeHtml(s.title)}</h3>
            <p class="item-desc">${escapeHtml(s.summary)}</p>
            <ul class="aliens-bullets">${(s.points || []).map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
          </article>`
          )
          .join("")}
      </div>`;
  }

  function renderTimeline() {
    const el = document.getElementById("aliens-timeline-body");
    if (!el || !hub) return;
    el.innerHTML = `
      <p class="page-hint">Public milestones from Blue Book to AARO, condensed for orientation, not a full archive.</p>
      <ol class="aliens-timeline">
        ${(hub.timeline || [])
          .map(
            (t) => `<li>
            <span class="aliens-tl-year">${escapeHtml(t.year)}</span>
            <div>
              <h3>${escapeHtml(t.title)}</h3>
              <p>${escapeHtml(t.text)}</p>
            </div>
          </li>`
          )
          .join("")}
      </ol>`;
  }

  function renderCases() {
    const el = document.getElementById("aliens-cases-body");
    if (!el || !hub) return;
    el.innerHTML = `
      <p class="page-hint">Famous stories and public cases, labeled by status so culture is not confused with confirmed science.</p>
      <div class="aliens-cases-grid">
        ${(hub.cases || [])
          .map(
            (c) => `<article class="aliens-case-card">
            <div class="aliens-case-head">
              <h3>${escapeHtml(c.name)}</h3>
              <span class="tag-chip">${escapeHtml(c.tag || "")}</span>
            </div>
            <p class="aliens-case-status">${escapeHtml(c.status || "")}</p>
            <p class="item-desc">${escapeHtml(c.text || "")}</p>
          </article>`
          )
          .join("")}
      </div>`;
  }

  function renderGlossary() {
    const el = document.getElementById("aliens-glossary-body");
    if (!el || !hub) return;
    const q = (document.getElementById("aliens-glossary-search")?.value || "").trim().toLowerCase();
    let terms = hub.glossary || [];
    if (q) {
      terms = terms.filter((g) => g.term.toLowerCase().includes(q) || g.def.toLowerCase().includes(q));
    }
    el.innerHTML = `
      <div class="aliens-glossary-list">
        ${terms
          .map(
            (g) => `<div class="aliens-glossary-item">
            <dt>${escapeHtml(g.term)}</dt>
            <dd>${escapeHtml(g.def)}</dd>
          </div>`
          )
          .join("") || `<p class="empty-msg">No terms match.</p>`}
      </div>`;
  }

  async function scan() {
    try {
      await ensureData();
      setTab(activeTab);
    } catch (err) {
      const grid = document.getElementById("aliens-docs-grid");
      if (grid) grid.innerHTML = `<p class="db-err">${escapeHtml(err.message)}</p>`;
    }
  }

  function bind() {
    tabBar?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-aliens-tab]");
      if (!btn) return;
      setTab(btn.dataset.aliensTab);
    });
    document.getElementById("aliens-doc-search")?.addEventListener("input", () => {
      if (activeTab === "docs") renderDocs();
    });
    document.getElementById("aliens-doc-filter")?.addEventListener("change", () => {
      if (activeTab === "docs") renderDocs();
    });
    document.getElementById("aliens-glossary-search")?.addEventListener("input", () => {
      if (activeTab === "glossary") renderGlossary();
    });
  }

  return { id: "aliens", page, scan, bind };
})();