(() => {
  const state = {
    page: "catalog",
    kind: "all",
    apps: [],
    counts: { all: 0, platform: 0, app: 0, external: 0 },
    filter: "",
    selectedId: null,
  };

  const el = {
    kindNav: document.getElementById("kind-nav"),
    sidebarMeta: document.getElementById("sidebar-meta"),
    countAll: document.getElementById("count-all"),
    countPlatform: document.getElementById("count-platform"),
    countApp: document.getElementById("count-app"),
    countExternal: document.getElementById("count-external"),
    search: document.getElementById("search"),
    btnRefresh: document.getElementById("btn-refresh"),
    pageTitle: document.getElementById("page-title"),
    brandSub: document.getElementById("brand-sub"),
    grid: document.getElementById("app-grid"),
    gridEmpty: document.getElementById("grid-empty"),
    viewGrid: document.getElementById("view-grid"),
    viewDetail: document.getElementById("view-detail"),
    viewAbout: document.getElementById("view-about"),
    btnBack: document.getElementById("btn-back"),
    detailHero: document.getElementById("detail-hero"),
    detailBody: document.getElementById("detail-body"),
  };

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function logoHtml(app, className = "app-logo") {
    if (app.iconData && String(app.iconData).startsWith("data:")) {
      return `<div class="${className}"><img src="${escapeHtml(app.iconData)}" alt="" /></div>`;
    }
    if (app.iconData && /^https?:/i.test(app.iconData)) {
      return `<div class="${className}"><img src="${escapeHtml(app.iconData)}" alt="" /></div>`;
    }
    return `<div class="${className}" aria-hidden="true">${escapeHtml(app.icon || "◆")}</div>`;
  }

  function setPage(page) {
    if (page === "about") {
      state.page = "about";
      state.selectedId = null;
      el.viewGrid?.classList.add("hidden");
      el.viewDetail?.classList.add("hidden");
      el.viewAbout?.classList.remove("hidden");
      el.kindNav?.querySelectorAll(".nav-item").forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.page === "about");
      });
      return;
    }
    if (page === "services") {
      state.kind = "platform";
      showCatalog();
      return;
    }
    if (page === "apps") {
      state.kind = "app";
      showCatalog();
      return;
    }
    if (page === "external") {
      state.kind = "external";
      showCatalog();
      return;
    }
    if (page === "catalog" || page === "grid" || page === "all") {
      state.kind = "all";
      showCatalog();
      return;
    }
    showCatalog();
  }

  function showCatalog() {
    state.page = "catalog";
    state.selectedId = null;
    el.viewAbout?.classList.add("hidden");
    el.viewDetail?.classList.add("hidden");
    el.viewGrid?.classList.remove("hidden");
    el.kindNav?.querySelectorAll(".nav-item").forEach((btn) => {
      if (btn.dataset.page === "about") {
        btn.classList.remove("is-active");
      } else {
        btn.classList.toggle("is-active", btn.dataset.kind === state.kind);
      }
    });
    const titles = {
      all: "Catalog",
      platform: "Services",
      app: "Apps",
      external: "External",
    };
    if (el.pageTitle) el.pageTitle.textContent = titles[state.kind] || "Catalog";
    renderGrid();
    paintChrome();
  }

  function showDetail() {
    state.page = "detail";
    el.viewAbout?.classList.add("hidden");
    el.viewGrid?.classList.add("hidden");
    el.viewDetail?.classList.remove("hidden");
  }

  function paintChrome() {
    const c = state.counts || {};
    if (el.countAll) el.countAll.textContent = String(c.all || state.apps.length || 0);
    if (el.countPlatform) el.countPlatform.textContent = String(c.platform || 0);
    if (el.countApp) el.countApp.textContent = String(c.app || 0);
    if (el.countExternal) el.countExternal.textContent = String(c.external || 0);
    if (el.sidebarMeta) {
      el.sidebarMeta.textContent = `${c.all || state.apps.length} entries · Platform encyclopedia`;
    }
    if (el.brandSub && state.page === "catalog") {
      const n = filteredList().length;
      el.brandSub.textContent = `${n} shown — tap for facts & activity`;
    }
  }
  
  function filteredList() {
    const q = state.filter.trim().toLowerCase();
    return (state.apps || []).filter((a) => {
      if (state.kind !== "all" && a.kind !== state.kind) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        String(a.description || "").toLowerCase().includes(q) ||
        String(a.tagline || "").toLowerCase().includes(q) ||
        String(a.typeLabel || "").toLowerCase().includes(q) ||
        String(a.serviceId || "").toLowerCase().includes(q)
      );
    });
  }

  function renderGrid() {
    const list = filteredList();
    if (!el.grid) return;
    el.grid.innerHTML = list
      .map(
        (a) => `
      <button type="button" class="app-tile" data-id="${escapeHtml(a.id)}" title="${escapeHtml(
          a.description || a.tagline || ""
        )}">
        ${logoHtml(a)}
        <span class="app-name">${escapeHtml(a.name)}</span>
        <span class="app-kind">${escapeHtml(a.kind === "platform" ? "service" : a.kind || "app")}</span>
      </button>`
      )
      .join("");
    el.gridEmpty?.classList.toggle("hidden", list.length > 0);
    paintChrome();
  }

  function section(title, inner) {
    if (!inner) return "";
    return `<section class="section"><h3>${escapeHtml(title)}</h3>${inner}</section>`;
  }

  function statsHtml(stats) {
    const entries = Object.entries(stats || {}).filter(([, v]) => v != null && v !== "");
    if (!entries.length) return "";
    return `<div class="stats">${entries
      .map(([k, v]) => {
        let val = v;
        if (typeof v === "object") val = JSON.stringify(v);
        return `<div class="stat"><span class="k">${escapeHtml(k)}</span><span class="v">${escapeHtml(
          val
        )}</span></div>`;
      })
      .join("")}</div>`;
  }

  function rowsHtml(items, mapFn) {
    if (!items?.length) return `<p>Nothing recorded yet.</p>`;
    return `<div class="timeline">${items.map(mapFn).join("")}</div>`;
  }

  function formatBytes(n) {
    const v = Number(n) || 0;
    if (v < 1024) return `${v} B`;
    if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
    return `${(v / (1024 * 1024)).toFixed(1)} MB`;
  }

  function renderDetail(data) {
    const app = data.app;
    const profile = data.profile || {};

    el.detailHero.innerHTML = `
      ${logoHtml(app)}
      <div>
        <h2>${escapeHtml(app.name)}</h2>
        <p class="tagline">${escapeHtml(profile.tagline || app.description || "")}</p>
        <div class="meta-row">
          <span class="chip accent">${escapeHtml(app.typeLabel || app.type)}</span>
          <span class="chip">id · ${escapeHtml(app.id)}</span>
          ${app.module ? `<span class="chip">module · ${escapeHtml(app.module)}</span>` : ""}
          ${app.serviceId ? `<span class="chip">service · ${escapeHtml(app.serviceId)}</span>` : ""}
          ${app.url ? `<span class="chip">${escapeHtml(app.url)}</span>` : ""}
          ${app.exePath ? `<span class="chip">${app.exeExists ? "installed" : "path missing"}</span>` : ""}
        </div>
      </div>`;

    const about = `
      <p>${escapeHtml(profile.about || app.description || "No description.")}</p>
      ${
        profile.features?.length
          ? `<ul>${profile.features.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>`
          : ""
      }
      ${
        profile.pages?.length
          ? `<p><strong>Surfaces:</strong> ${escapeHtml(profile.pages.join(" · "))}</p>`
          : ""
      }
      ${app.exePath ? `<p><strong>Executable:</strong> ${escapeHtml(app.exePath)}</p>` : ""}
    `;

    const highlights = data.live?.highlights?.length
      ? `<div class="highlights">${data.live.highlights
          .map(
            (h) => `
        <div class="row">
          <div class="main">
            <p class="title">${escapeHtml(h.label)}</p>
            <p class="detail">${escapeHtml(h.value || "")}</p>
          </div>
        </div>`
          )
          .join("")}</div>`
      : "";

    const timeline = rowsHtml(data.timeline, (e) => {
      return `
        <div class="row">
          <div class="main">
            <p class="title"><span class="kind">${escapeHtml(e.kind || "event")}</span>${escapeHtml(
              e.title
            )}</p>
            ${e.detail ? `<p class="detail">${escapeHtml(e.detail)}</p>` : ""}
          </div>
          <div class="when">${escapeHtml(e.atLabel || "")}</div>
        </div>`;
    });

    const storage = data.storage?.length
      ? `<div class="files">${data.storage
          .map(
            (f) => `
        <div class="row">
          <div class="main">
            <p class="title">${escapeHtml(f.name)}</p>
            <p class="detail">${escapeHtml(f.path)}${f.sizeLabel ? " · " + escapeHtml(f.sizeLabel) : ""}</p>
          </div>
          <div class="when">${escapeHtml(f.modifiedAt ? new Date(f.modifiedAt).toLocaleString() : "")}</div>
        </div>`
          )
          .join("")}</div>`
      : `<p>No dedicated storage files found for this entry yet.</p>`;

    const source = data.source
      ? `<p>${data.source.fileCount} source files · ${escapeHtml(
          data.source.sizeLabel
        )} under <code>${escapeHtml(data.source.dir)}</code></p>
         <div class="files">${data.source.files
           .slice(0, 40)
           .map(
             (f) => `
           <div class="row">
             <div class="main"><p class="title">${escapeHtml(f.rel)}</p></div>
             <div class="when">${escapeHtml(formatBytes(f.bytes))}</div>
           </div>`
           )
           .join("")}</div>`
      : "";

    const profilesHtml = (() => {
      const pv = data.profilesView;
      if (!pv?.profiles?.length) return "";
      const cards = pv.profiles
        .map((p, idx) => {
          const stats = Object.entries(p.stats || {})
            .filter(([, v]) => v != null && v !== "")
            .map(
              ([k, v]) =>
                `<span class="chip">${escapeHtml(k)}: ${escapeHtml(
                  typeof v === "object" ? JSON.stringify(v) : v
                )}</span>`
            )
            .join("");
          const sections = (p.sections || [])
            .map((s) => {
              const items = (s.items || [])
                .map(
                  (it) => `
                <div class="row">
                  <div class="main">
                    <p class="title">${escapeHtml(it.title)}</p>
                    ${it.detail ? `<p class="detail">${escapeHtml(it.detail)}</p>` : ""}
                  </div>
                  <div class="when">${escapeHtml(it.at || "")}</div>
                </div>`
                )
                .join("");
              return `<div class="profile-section"><h4>${escapeHtml(s.title)}</h4><div class="highlights">${
                items || "<p>Empty</p>"
              }</div></div>`;
            })
            .join("");
          return `
            <details class="profile-card" ${idx === 0 ? "open" : ""}>
              <summary>
                <span class="profile-name">${escapeHtml(p.name)}</span>
                <span class="chip accent">${escapeHtml(p.badge || "profile")}</span>
                ${p.createdAtLabel ? `<span class="chip">since ${escapeHtml(p.createdAtLabel)}</span>` : ""}
              </summary>
              <div class="profile-body">
                ${stats ? `<div class="meta-row" style="margin-bottom:12px">${stats}</div>` : ""}
                ${sections || "<p>No data in this profile yet.</p>"}
              </div>
            </details>`;
        })
        .join("");
      return section(
        pv.title || "Profiles",
        `${pv.subtitle ? `<p>${escapeHtml(pv.subtitle)}</p>` : ""}<div class="profiles">${cards}</div>`
      );
    })();

    el.detailBody.innerHTML = [
      section("About", about),
      profilesHtml,
      section("Live stats", statsHtml(data.live?.stats)),
      section("Highlights", highlights),
      section("Things that happened", timeline),
      section("Storage on disk", storage),
      data.source ? section("App source files", source) : "",
      data.generatedAt
        ? `<p style="color:var(--muted);font-size:12px;margin:0">Generated ${escapeHtml(
            new Date(data.generatedAt).toLocaleString()
          )}${data.driftRelated ? ` · ${data.driftRelated} related Drift hits` : ""}</p>`
        : "",
    ]
      .filter(Boolean)
      .join("");
  }

  async function loadCatalog() {
    try {
      const res = await window.myApp.invoke("catalog.list");
      if (!res?.ok) throw new Error(res?.error || "Failed to load catalog");
      state.apps = res.apps || [];
      state.counts = res.counts || {
        all: state.apps.length,
        platform: state.apps.filter((a) => a.kind === "platform").length,
        app: state.apps.filter((a) => a.kind === "app").length,
        external: state.apps.filter((a) => a.kind === "external").length,
      };
      if (state.page === "catalog") renderGrid();
      else paintChrome();
    } catch (err) {
      if (el.grid) el.grid.innerHTML = "";
      if (el.gridEmpty) {
        el.gridEmpty.textContent = err.message || "Failed to load";
        el.gridEmpty.classList.remove("hidden");
      }
    }
  }

  async function openApp(id) {
    state.selectedId = id;
    showDetail();
    el.detailHero.innerHTML = `<p class="tagline">Loading…</p>`;
    el.detailBody.innerHTML = "";
    try {
      const res = await window.myApp.invoke("catalog.detail", { id });
      if (!res?.ok) throw new Error(res?.error || "Failed to load detail");
      renderDetail(res);
    } catch (err) {
      el.detailHero.innerHTML = `<h2>Error</h2><p class="tagline">${escapeHtml(
        err.message || "Failed"
      )}</p>`;
    }
  }

  function applyRoute(route) {
    const page = route?.page;
    if (page === "about") setPage("about");
    else if (page === "services" || page === "platform") setPage("services");
    else if (page === "apps") setPage("apps");
    else if (page === "external") setPage("external");
    else if (route?.id) void openApp(route.id);
    else setPage("catalog");
  }

  el.grid?.addEventListener("click", (e) => {
    const tile = e.target.closest(".app-tile");
    if (!tile) return;
    void openApp(tile.dataset.id);
  });

  el.btnBack?.addEventListener("click", () => showCatalog());

  el.search?.addEventListener("input", () => {
    state.filter = el.search.value || "";
    if (state.page === "catalog") renderGrid();
  });

  el.btnRefresh?.addEventListener("click", () => {
    if (state.selectedId) void openApp(state.selectedId);
    else void loadCatalog();
  });

  el.kindNav?.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.page === "about") setPage("about");
      else if (btn.dataset.kind) {
        state.kind = btn.dataset.kind;
        showCatalog();
      }
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.selectedId) showCatalog();
  });

  window.__myspaceApplyRoute = applyRoute;
  window.InfoApp = { setPage, applyRoute, openApp };

  showCatalog();
  void loadCatalog();
})();
