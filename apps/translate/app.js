(function () {
  const PAGE_META = {
    translate: { title: "Translate", subtitle: "100+ languages · instant translation" },
    history: { title: "History", subtitle: "Recent translations & favorites" },
    phrases: { title: "Phrases", subtitle: "Common phrases by category" },
    batch: { title: "Batch", subtitle: "Translate multiple lines at once" },
    settings: { title: "Settings", subtitle: "Defaults, history & export" },
  };

  const pages = [
    window.TranslatePages.main,
    window.TranslatePages.history,
    window.TranslatePages.phrases,
    window.TranslatePages.batch,
    window.TranslatePages.settings,
  ];

  const ui = {
    nav: document.getElementById("main-nav"),
    title: document.getElementById("page-title"),
    subtitle: document.getElementById("page-subtitle"),
    brandSub: document.getElementById("brand-sub"),
  };

  let activePage = pages[0];

  function setPage(pageId, arg) {
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

    const meta = PAGE_META[next.id] || PAGE_META.translate;
    ui.title.textContent = meta.title;
    ui.subtitle.textContent = meta.subtitle;

    if (next.activate) next.activate(arg);
    else if (next.scan) next.scan(arg);
  }

  function openTranslate(prefill) {
    setPage("translate", prefill);
  }

  ui.nav.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-item[data-page]");
    if (!btn || btn.dataset.page === "app-settings") return;
    setPage(btn.dataset.page);
  });

  pages.forEach((p) => {
    if (p.bind) p.bind();
  });

  window.TranslateApp = { setPage, openTranslate };

  setPage("translate");
})();
