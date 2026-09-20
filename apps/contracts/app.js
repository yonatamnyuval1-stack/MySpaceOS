(function () {
  const PAGE_META = {
    library: { title: "Contract Library", subtitle: "Formal agreements: create, sign & track" },
    editor: { title: "Edit Contract", subtitle: "Fill all fields required for this agreement" },
    document: { title: "Official Document", subtitle: "Review text and apply signatures" },
    expiring: { title: "Expiry Alerts", subtitle: "Contracts ending soon: desktop notifications" },
  };

  const pages = [
    window.ContractPages.library,
    window.ContractPages.editor,
    window.ContractPages.document,
    window.ContractPages.expiring,
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

    const meta = PAGE_META[next.id] || PAGE_META.library;
    ui.title.textContent = meta.title;
    ui.subtitle.textContent = meta.subtitle;
    ui.brandSub.textContent = meta.title;

    document.getElementById("app-shell")?.classList.toggle("doc-mode", next.id === "document");

    if (next.activate) next.activate(arg);
    else if (next.scan) next.scan(arg);
  }

  function openEditor(id, templateId) {
    setPage("editor", id ? id : { templateId });
  }

  function openDocument(id) {
    setPage("document", id);
  }

  window.ContractsApp = { setPage, openEditor, openDocument };

  ui.nav.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-item[data-page]");
    if (!btn || btn.dataset.page === "app-settings") return;
    setPage(btn.dataset.page);
  });

  pages.forEach((p) => {
    if (p.bind) p.bind();
  });

  setPage("library");
})();