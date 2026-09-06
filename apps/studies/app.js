(function () {
  const PAGE_META = {
    home: { title: "Documents", subtitle: "Visual page layouts or continuous formal documents" },
    templates: { title: "Templates", subtitle: "Page layouts with fixed image/text positions — mix blocks as needed" },
    editor: { title: "Editor", subtitle: "Multi-page visual projects or long-form formal writing" },
  };

  const pages = [window.StudiesPages.home, window.StudiesPages.templates, window.StudiesPages.editor];

  const ui = {
    nav: document.getElementById("main-nav"),
    title: document.getElementById("page-title"),
    subtitle: document.getElementById("page-subtitle"),
    brandSub: document.getElementById("brand-sub"),
    topbar: document.getElementById("topbar"),
    topbarActions: document.getElementById("topbar-actions"),
  };

  let activePage = pages[0];

  function setActivePage(pageId, docId) {
    const next = pages.find((p) => p.id === pageId) || pages[0];
    if (activePage && activePage !== next && activePage.deactivate) activePage.deactivate();

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

    const meta = PAGE_META[next.id] || PAGE_META.home;
    ui.title.textContent = meta.title;
    ui.subtitle.textContent = meta.subtitle;
    ui.brandSub.textContent = meta.title;
    const editorMode = next.id === "editor";
    ui.topbar.hidden = editorMode;
    ui.topbarActions.hidden = editorMode;
    document.getElementById("app-shell").classList.toggle("editor-mode", editorMode);
    document.getElementById("content").classList.toggle("content--editor", editorMode);

    if (next.activate) {
      if (next.id === "editor") next.activate(docId);
      else next.activate();
    }
  }

  function goHome() {
    setActivePage("home");
  }

  function openDocument(docId) {
    if (window.StudiesPages.editor) {
      window.StudiesPages.editor.pendingDocId = docId || null;
      window.StudiesPages.editor.activeDocId = docId || null;
    }
    setActivePage("editor", docId);
  }

  async function newFromTemplate(templateId) {
    const tpl = window.StudiesTemplates.getTemplate(templateId || "blank");
    const inner = tpl.id === "blank" ? "<p><br></p>" : tpl.html;
    const content = window.StudiesEditor.serializeDocPages([{ template: tpl.id, html: inner }]);
    const doc = await window.StudiesStorage.createDocument({
      title: tpl.id === "blank" ? "Untitled document" : tpl.name,
      content,
      template: tpl.id,
      docMode: "visual",
    });
    openDocument(doc.id);
    return doc;
  }

  async function newFormalDocument(styleId) {
    if (window.StudiesFormal?.isFormalEnabled?.() === false) {
      return newFromTemplate("blank");
    }
    const style = window.StudiesFormal?.getStyle?.(styleId) || { id: "academic", name: "Academic" };
    const inner = window.StudiesFormal?.starterHtml?.(style.id) || "<p><br></p>";
    const content = window.StudiesEditor.serializeDocPages([{ template: "formal", html: inner }]);
    const doc = await window.StudiesStorage.createDocument({
      title: `Untitled ${String(style.name || "document").toLowerCase()}`,
      content,
      template: "formal",
      docMode: "formal",
      formalStyle: style.id,
    });
    openDocument(doc.id);
    return doc;
  }

  /** @deprecated subject workspaces removed — opens a document or home */
  function openWorkspace(param) {
    if (param && String(param).startsWith("doc")) {
      openDocument(param);
      return;
    }
    goHome();
  }

  ui.nav.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-item[data-page]");
    if (!btn || btn.dataset.page === "app-settings") return;
    setActivePage(btn.dataset.page);
  });

  pages.forEach((p) => {
    if (p.bind) p.bind();
  });

  window.StudiesApp = {
    openWorkspace,
    openDocument,
    newFromTemplate,
    newFormalDocument,
    goHome,
    setActivePage,
  };

  window.MySpaceThemeRuntime?.listen?.("studies");
  void window.MySpaceThemeRuntime?.boot?.("studies");

  window.StudiesStorage.load().then(() => {
    setActivePage("home");
  });
})();
