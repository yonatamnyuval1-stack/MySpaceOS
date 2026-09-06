(function () {
  const PAGE_META = {
    browse: {
      title: "Builds",
      subtitle: "Everything you've built: projects, docs & code file trees",
    },
    timeline: {
      title: "Timeline",
      subtitle: "All your projects in chronological order",
    },
  };

  const pages = [window.BuildsPages.browse, window.BuildsPages.timeline];

  const ui = {
    shell: document.getElementById("app-shell"),
    nav: document.getElementById("main-nav"),
    title: document.getElementById("page-title"),
    subtitle: document.getElementById("page-subtitle"),
    brandSub: document.getElementById("brand-sub"),
    topbarActions: document.getElementById("topbar-actions"),
    btnAdd: document.getElementById("btn-add-project"),
    btnExport: document.getElementById("btn-export"),
    btnImport: document.getElementById("btn-import"),
  };

  function setActivePage(pageId) {
    if (pageId !== "browse") {
      window.BuildsPages.browse?.closeProjectView?.();
    }

    const next = pages.find((p) => p.id === pageId) || pages[0];

    pages.forEach((p) => {
      const on = p.id === next.id;
      p.page.hidden = !on;
      p.page.classList.toggle("active", on);
    });

    if (pageId === "browse" && window.BuildsPages.browse?.isProjectViewOpen?.()) {
      const browsePage = pages.find((p) => p.id === "browse");
      if (browsePage?.page) browsePage.page.hidden = true;
    }

    ui.nav.querySelectorAll(".nav-item[data-page]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.page === next.id);
    });

    const meta = PAGE_META[next.id] || PAGE_META.browse;
    ui.title.textContent = meta.title;
    ui.subtitle.textContent = meta.subtitle;
    ui.brandSub.textContent = `v1.0 · ${meta.title}`;

    ui.topbarActions?.classList.toggle("hidden", next.id !== "browse");

    if (next.scan) next.scan();
  }

  ui.nav.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-item[data-page]");
    if (!btn || btn.dataset.page === "app-settings") return;
    setActivePage(btn.dataset.page);
  });

  pages.forEach((p) => {
    if (p.bind) p.bind(ui);
  });

  setActivePage("browse");
  window.BuildsApp = {
    setActivePage,
    openProject: (id) => {
      setActivePage("browse");
      window.BuildsPages.browse?.openProject?.(id);
    },
  };
})();