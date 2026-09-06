(function () {
  const PAGE_META = {
    vault: {
      title: "Vault",
      subtitle: "Encrypted passwords & secrets",
    },
  };

  const pages = [window.ProfilesPages.vault];

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
      p.page.hidden = !on;
      p.page.classList.toggle("active", on);
    });

    ui.nav?.querySelectorAll(".nav-item[data-page]")?.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.page === next.id);
    });

    const meta = PAGE_META[next.id] || PAGE_META.vault;
    if (ui.title) ui.title.textContent = meta.title;
    if (ui.subtitle) ui.subtitle.textContent = meta.subtitle;
    if (ui.brandSub) ui.brandSub.textContent = `v1.0 · ${meta.title}`;

    document.getElementById("app-shell")?.classList.add("vault-page");

    if (next.scan) next.scan();
  }

  ui.nav?.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-item[data-page]");
    if (!btn || btn.dataset.page === "app-settings") return;
    setActivePage(btn.dataset.page);
  });

  pages.forEach((p) => {
    if (p.bind) p.bind(ui);
  });

  setActivePage("vault");
  window.ProfilesApp = {
    setActivePage,
    openEntry: async (id) => {
      setActivePage("vault");
      return window.ProfilesPages.vault?.openEntry?.(id);
    },
  };
})();
