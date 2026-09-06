(function () {
  const pages = [window.CouponsPages.wallet];

  const ui = {
    nav: document.getElementById("main-nav"),
    title: document.getElementById("page-title"),
    subtitle: document.getElementById("page-subtitle"),
    brandSub: document.getElementById("brand-sub"),
  };

  let activePage = pages[0];

  function setActivePage(pageId) {
    const next = pages.find((p) => p.id === pageId) || pages[0];
    activePage = next;
    pages.forEach((p) => {
      const on = p.id === next.id;
      if (p.page) {
        p.page.hidden = !on;
        p.page.classList.toggle("active", on);
      }
    });
    ui.nav?.querySelectorAll(".nav-item[data-page]")?.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.page === next.id);
    });
    if (ui.title) ui.title.textContent = "Wallet";
    if (ui.subtitle) ui.subtitle.textContent = "Encrypted coupons & gift codes";
    if (next.scan) next.scan();
  }

  ui.nav?.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-item[data-page]");
    if (!btn) return;
    setActivePage(btn.dataset.page);
  });

  pages.forEach((p) => {
    if (p.bind) p.bind(ui);
  });

  setActivePage("wallet");
  window.CouponsApp = {
    setActivePage,
    openEntry: async (id) => {
      setActivePage("wallet");
      return window.CouponsPages.wallet?.openEntry?.(id);
    },
  };
})();
