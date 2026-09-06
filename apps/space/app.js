(function () {
  const PAGE_META = {
    navigate: { title: "Navigate", subtitle: "Stars, solar system & deep space. drag to move, scroll or slider to zoom" },
    catalog: { title: "Catalog", subtitle: "Planets, moons, missions, stars & deep sky" },
    nasa: { title: "NASA Lab", subtitle: "APOD · missions · image library · NEO watch · Mars rovers" },
    reports: { title: "Public Reports", subtitle: "330+ mission reports, decadal surveys & NTRS archive" },
    aliens: { title: "Aliens", subtitle: "Public UAP documents · SETI · science · timeline · cases" },
  };

  const pages = [
    window.SpacePages.navigate,
    window.SpacePages.catalog,
    window.SpacePages.nasa,
    window.SpacePages.reports,
    window.SpacePages.aliens,
  ];

  const ui = {
    nav: document.getElementById("main-nav"),
    main: document.querySelector(".main"),
    title: document.getElementById("page-title"),
    subtitle: document.getElementById("page-subtitle"),
    brandSub: document.getElementById("brand-sub"),
    catNav: document.getElementById("cat-nav"),
    catSection: document.getElementById("cat-section-label"),
  };

  let activePage = pages[0];

  function setPage(pageId) {
    const prev = activePage;
    const next = pages.find((p) => p.id === pageId) || pages[0];
    activePage = next;

    pages.forEach((p) => {
      p.page.hidden = p.id !== next.id;
      p.page.classList.toggle("active", p.id === next.id);
    });

    ui.nav.querySelectorAll(".nav-item[data-page]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.page === next.id);
    });

    const meta = PAGE_META[next.id] || PAGE_META.navigate;
    ui.title.textContent = meta.title;
    ui.subtitle.textContent = meta.subtitle;
    ui.brandSub.textContent = meta.title;

    const showCat = next.id === "catalog";
    ui.catNav.classList.toggle("hidden", !showCat);
    ui.catSection.classList.toggle("hidden", !showCat);
    ui.main?.classList.toggle("main--navigate-page", next.id === "navigate");

    const detailPages = new Set(["navigate", "catalog", "nasa", "reports", "aliens"]);
    if (prev.id !== next.id && !(detailPages.has(prev.id) && detailPages.has(next.id))) {
      window.SpaceDetail.close();
    }

    if (next.scan) next.scan();
  }

  ui.nav.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-item[data-page]");
    if (!btn || btn.dataset.page === "app-settings") return;
    setPage(btn.dataset.page);
  });

  const PAGE_KEYS = {
    "1": "navigate",
    "2": "catalog",
    "3": "nasa",
    "4": "reports",
    "5": "aliens",
  };

  window.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea, select")) return;
    const pageId = PAGE_KEYS[e.key];
    if (!pageId) return;
    setPage(pageId);
  });

  pages.forEach((p) => {
    if (p.bind) p.bind();
  });

  window.SpaceApp = {
    setPage,
    openBody: (id) => {
      setPage("catalog");
      window.SpaceDetail?.open?.(id);
    },
    openMission: (id) => {
      setPage("nasa");
      window.SpaceDetail?.openMission?.(id);
    },
    openReport: (id) => {
      setPage("reports");
      window.SpaceDetail?.openReport?.(id);
    },
  };

  setPage("navigate");
})();