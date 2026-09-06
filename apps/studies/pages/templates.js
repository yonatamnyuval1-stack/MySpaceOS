(function (root) {
  const { escapeHtml } = root.StudiesUtils;
  const { getAllTemplates, getAllBlocks } = root.StudiesTemplates;

  const PREVIEW_MAP = {
    full: '<span class="wf-cell wf-full"></span>',
    hero: '<span class="wf-cell wf-hero"></span>',
    title: '<span class="wf-cell wf-title"></span>',
    sub: '<span class="wf-cell wf-sub"></span>',
    text: '<span class="wf-cell wf-text"></span>',
    banner: '<span class="wf-cell wf-banner"></span>',
    cols2: '<span class="wf-row"><span class="wf-cell"></span><span class="wf-cell"></span></span>',
    "split-img-text":
      '<span class="wf-row"><span class="wf-cell wf-img"></span><span class="wf-col"><span class="wf-cell wf-title"></span><span class="wf-cell wf-text"></span></span></span>',
    "split-text-img":
      '<span class="wf-row"><span class="wf-col"><span class="wf-cell wf-title"></span><span class="wf-cell wf-text"></span></span><span class="wf-cell wf-img"></span></span>',
    "main-side":
      '<span class="wf-row wf-main-side"><span class="wf-col"><span class="wf-cell wf-title"></span><span class="wf-cell wf-text"></span><span class="wf-cell wf-text"></span></span><span class="wf-col wf-side"><span class="wf-cell wf-img"></span><span class="wf-cell wf-text"></span></span></span>',
    gallery3:
      '<span class="wf-row"><span class="wf-cell wf-img"></span><span class="wf-cell wf-img"></span><span class="wf-cell wf-img"></span></span>',
    profile:
      '<span class="wf-row"><span class="wf-cell wf-img wf-portrait"></span><span class="wf-col"><span class="wf-cell wf-title"></span><span class="wf-cell wf-text"></span><span class="wf-cell wf-text"></span></span></span>',
    compare:
      '<span class="wf-row"><span class="wf-col"><span class="wf-cell wf-img"></span><span class="wf-cell wf-title"></span><span class="wf-cell wf-text"></span></span><span class="wf-col"><span class="wf-cell wf-img"></span><span class="wf-cell wf-title"></span><span class="wf-cell wf-text"></span></span></span>',
    steps3:
      '<span class="wf-row"><span class="wf-col"><span class="wf-cell wf-img"></span><span class="wf-cell wf-sub"></span></span><span class="wf-col"><span class="wf-cell wf-img"></span><span class="wf-cell wf-sub"></span></span><span class="wf-col"><span class="wf-cell wf-img"></span><span class="wf-cell wf-sub"></span></span></span>',
    quote: '<span class="wf-cell wf-quote"></span>',
    instr: '<span class="wf-cell wf-text"></span>',
    figure: '<span class="wf-cell wf-img"></span>',
    answers: '<span class="wf-cell wf-text"></span><span class="wf-cell wf-text"></span>',
    header: '<span class="wf-cell wf-title"></span>',
    obj: '<span class="wf-cell wf-text"></span>',
    proc: '<span class="wf-cell wf-text"></span>',
    fig: '<span class="wf-cell wf-img"></span>',
    analysis: '<span class="wf-cell wf-text"></span>',
    bullets: '<span class="wf-cell wf-text"></span>',
    footer: '<span class="wf-cell wf-sub"></span>',
  };

  function wireframe(preview) {
    const parts = (preview || ["full"]).map((k) => PREVIEW_MAP[k] || `<span class="wf-cell"></span>`);
    return `<div class="tpl-wireframe" aria-hidden="true">${parts.join("")}</div>`;
  }

  const page = {
    id: "templates",
    page: null,

    bind() {
      this.page = document.getElementById("page-templates");
    },

    async activate() {
      await this.render();
    },

    async render() {
      const grid = this.page.querySelector("#templates-grid");
      const pages = getAllTemplates();
      const blocks = getAllBlocks();

      const byCat = {};
      pages.forEach((t) => {
        const c = t.category || "Page";
        (byCat[c] = byCat[c] || []).push(t);
      });

      const pageSections = Object.keys(byCat)
        .map((cat) => {
          const cards = byCat[cat]
            .map(
              (t) => `
            <button type="button" class="template-card template-card--page" data-template="${escapeHtml(t.id)}">
              ${wireframe(t.preview)}
              <h3 class="template-card-name">${escapeHtml(t.name)}</h3>
              <p class="template-card-desc">${escapeHtml(t.description || "")}</p>
              <span class="template-card-cta">Use this page</span>
            </button>`
            )
            .join("");
          return `<h2 class="templates-section-title">${escapeHtml(cat)}</h2>
            <div class="templates-section">${cards}</div>`;
        })
        .join("");

      grid.innerHTML = `
        <p class="templates-lead">Pick a <strong>page layout</strong> with fixed positions for images and text — or insert a <strong>block</strong> into an open document to mix layouts.</p>
        ${pageSections}
        <h2 class="templates-section-title">Mixable blocks</h2>
        <p class="templates-section-hint">Add these into any document from here or via <strong>＋ Layout</strong> in the editor.</p>
        <div class="templates-section">
          ${blocks
            .map(
              (b) => `
            <button type="button" class="template-card template-card--block" data-block="${escapeHtml(b.id)}">
              <span class="template-card-icon" aria-hidden="true">${escapeHtml(b.icon)}</span>
              <h3 class="template-card-name">${escapeHtml(b.name)}</h3>
              <p class="template-card-desc">${escapeHtml(b.description || "")}</p>
              <span class="template-card-cta">Insert block</span>
            </button>`
            )
            .join("")}
        </div>`;

      grid.querySelectorAll("[data-template]").forEach((btn) => {
        btn.addEventListener("click", () => root.StudiesApp.newFromTemplate(btn.dataset.template));
      });
      grid.querySelectorAll("[data-block]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const editor = root.StudiesPages.editor;
          if (!editor?.page || editor.page.hidden || !editor.activeDocId) {
            await root.StudiesApp.newFromTemplate("blank");
          }
          const ed = root.StudiesPages.editor;
          if (ed?.insertLayoutBlock) {
            ed.insertLayoutBlock(btn.dataset.block);
            root.StudiesApp.setActivePage("editor", ed.activeDocId);
          }
        });
      });
    },
  };

  root.StudiesPages = root.StudiesPages || {};
  root.StudiesPages.templates = page;
})(window);
