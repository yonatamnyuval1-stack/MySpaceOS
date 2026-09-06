(function () {
  const PAGE_META = {
    figures: { title: "Figures", subtitle: "Historical people: thousands with rich profiles" },
    events: { title: "Events", subtitle: "Wars, revolutions & turning points in history" },
    collection: { title: "My collection", subtitle: "Saved figures and events" },
  };

  const pages = [window.HistoryPages.figures, window.HistoryPages.events, window.HistoryPages.collection];

  const ui = {
    nav: document.getElementById("main-nav"),
    eraNav: document.getElementById("era-nav"),
    title: document.getElementById("page-title"),
    subtitle: document.getElementById("page-subtitle"),
    brandSub: document.getElementById("brand-sub"),
    topbarActions: document.getElementById("topbar-actions"),
    dbStatus: document.getElementById("db-status"),
    btnBuild: document.getElementById("btn-build-db"),
  };

  let activePage = pages[0];
  let sharedEraFilter = "all";

  async function updateDbStatus() {
    try {
      const res = await window.History.invoke("cache.status");
      if (res.loaded) {
        ui.dbStatus.innerHTML = `<p class="db-ok">✓ ${res.figuresCount} figures · ${res.eventsCount} events</p>`;
        ui.btnBuild.textContent = "↻ Refresh database";
      } else {
        ui.dbStatus.innerHTML = `<p class="db-warn">Loading bundled database… or run npm run history:build</p>`;
        ui.btnBuild.textContent = "⬇ Build database";
      }
    } catch {
      ui.dbStatus.innerHTML = "";
    }
  }

  async function buildDatabase() {
    const btn = ui.btnBuild;
    btn.disabled = true;
    btn.textContent = "Building… (3–10 min)";
    ui.dbStatus.innerHTML = `<p class="db-warn">Fetching from Wikidata… 12 queries, ~90s max each. Normal: 3–8 min. If &gt;12 min with no change, close and retry.</p>`;
    try {
      const res = await window.History.invoke("cache.build");
      ui.dbStatus.innerHTML = `<p class="db-ok">✓ ${res.figuresCount} figures · ${res.eventsCount} events</p>`;
      btn.textContent = "↻ Refresh database";
      pages.forEach((p) => p.scan && p.scan());
    } catch (err) {
      ui.dbStatus.innerHTML = `<p class="db-err">${err.message}</p>`;
      alert(err.message);
    } finally {
      btn.disabled = false;
    }
  }

  function setPage(pageId) {
    const next = pages.find((p) => p.id === pageId) || pages[0];
    activePage = next;

    pages.forEach((p) => {
      p.page.hidden = p.id !== next.id;
    });

    ui.nav.querySelectorAll(".nav-item[data-page]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.page === next.id);
    });

    const meta = PAGE_META[next.id] || PAGE_META.figures;
    ui.title.textContent = meta.title;
    ui.subtitle.textContent = meta.subtitle;
    ui.brandSub.textContent = meta.title;

    const showEra = next.id === "figures" || next.id === "events";
    ui.eraNav.classList.toggle("hidden", !showEra);
    ui.topbarActions.classList.toggle("hidden", false);

    if (next.id !== "collection") window.HistoryDetail.close();

    if (next.scan) next.scan();
  }

  ui.nav.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-item[data-page]");
    if (!btn || btn.dataset.page === "app-settings") return;
    setPage(btn.dataset.page);
  });

  ui.btnBuild?.addEventListener("click", buildDatabase);

  pages.forEach((p) => {
    if (p.bind) p.bind();
  });

  updateDbStatus().then(() => {
    window.History.invoke("cache.status").then((s) => {
      if (s.loaded) setPage("figures");
      else setPage("figures");
    });
  });

  setPage("figures");
  window.HistoryApp = {
    setPage,
    openEntity: (id, type) => {
      const t = type === "event" ? "event" : "figure";
      setPage(t === "event" ? "events" : "figures");
      window.HistoryDetail?.open?.(id, t);
    },
  };
})();