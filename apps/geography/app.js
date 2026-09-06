(function () {
  const PAGE_META = {
    explore: { title: "Explore", subtitle: "Browse countries: flags, facts & rich info" },
    learn: { title: "Learn", subtitle: "Deep in-app profiles: history, culture, economy & places" },
    traveled: { title: "My travels", subtitle: "Countries you've visited: dates, cities & notes" },
  };

  const pages = [window.GeoPages.explore, window.GeoPages.learn, window.GeoPages.traveled];

  const ui = {
    nav: document.getElementById("main-nav"),
    title: document.getElementById("page-title"),
    subtitle: document.getElementById("page-subtitle"),
    brandSub: document.getElementById("brand-sub"),
    topbarActions: document.getElementById("topbar-actions"),
    regionNav: document.getElementById("region-nav"),
  };

  let activePage = pages[0];

  function setPage(pageId) {
    const next = pages.find((p) => p.id === pageId) || pages[0];
    activePage = next;

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

    const meta = PAGE_META[next.id] || PAGE_META.explore;
    ui.title.textContent = meta.title;
    ui.subtitle.textContent = meta.subtitle;
    ui.brandSub.textContent = meta.title;

    ui.topbarActions?.classList.toggle("hidden", next.id !== "explore");
    document.getElementById("region-section-label")?.classList.toggle("hidden", next.id !== "explore");
    ui.regionNav?.classList.toggle("hidden", next.id !== "explore");

    if (next.id !== "learn") window.GeoPages.explore?.closeDetail?.();

    if (next.scan) next.scan();
  }

  function openLearn(countryCode) {
    setPage("learn");
    if (countryCode) window.GeoPages.learn?.openCountry?.(countryCode);
  }

  function openCountry(code) {
    setPage("explore");
    if (code) window.GeoPages.explore?.openDetail?.(code);
  }

  window.GeoApp = { setPage, openLearn, openCountry };

  ui.nav.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-item[data-page]");
    if (!btn || btn.dataset.page === "app-settings") return;
    setPage(btn.dataset.page);
  });

  pages.forEach((p) => {
    if (p.bind) p.bind();
  });

  function refreshForSettings() {
    window.GeoPages.explore?.refreshSettingsView?.();
    window.GeoPages.learn?.scan?.();
    window.GeoPages.traveled?.scan?.();
  }

  window.AppSettingsRuntime?.onApplied?.(() => refreshForSettings());

  setPage("explore");
})();