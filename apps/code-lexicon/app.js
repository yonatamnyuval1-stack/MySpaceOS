(function () {
  const PAGE_META = {
    browse: {
      title: "Search",
      subtitle: "Browse 4500+ programming concepts with clear explanations",
    },
    categories: {
      title: "Categories",
      subtitle: "Explore terms organized by topic",
    },
  };

  const pages = [
    window.LexiconPages.browse,
    window.LexiconPages.categories,
  ];

  const ui = {
    shell: document.getElementById("app-shell"),
    nav: document.getElementById("main-nav"),
    categoryNav: document.getElementById("category-nav"),
    catSectionLabel: document.getElementById("cat-section-label"),
    title: document.getElementById("page-title"),
    subtitle: document.getElementById("page-subtitle"),
    brandSub: document.getElementById("brand-sub"),
    sidebarStats: document.getElementById("sidebar-stats"),
  };

  function setActivePage(pageId) {
    const next = pages.find((p) => p.id === pageId) || pages[0];

    pages.forEach((p) => {
      const on = p.id === next.id;
      if (p.page) {
        p.page.hidden = !on;
        p.page.classList.toggle("active", on);
      }
    });

    ui.nav.querySelectorAll(".nav-item[data-page]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.page === next.id);
    });

    const meta = PAGE_META[next.id] || PAGE_META.browse;
    ui.title.textContent = meta.title;
    ui.subtitle.textContent = meta.subtitle;
    ui.brandSub.textContent = meta.title;

    const showFilter = next.id === "browse";
    ui.catSectionLabel?.classList.toggle("hidden", !showFilter);
    ui.categoryNav?.classList.toggle("hidden", !showFilter);

    if (next.id !== "browse") window.LexiconPages.browse?.closeDetail?.();

    if (next.scan) next.scan();
  }

  window.LexiconApp = {
    setActivePage,
    openTerm: (id) => {
      setActivePage("browse");
      window.LexiconPages?.browse?.openDetail?.(id);
    },
  };

  ui.nav.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-item[data-page]");
    if (!btn || btn.dataset.page === "app-settings") return;
    setActivePage(btn.dataset.page);
  });

  pages.forEach((p) => {
    if (p.bind) p.bind(ui);
  });

  setActivePage("browse");
})();