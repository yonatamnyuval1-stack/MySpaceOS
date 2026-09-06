(function (root) {
  const { escapeHtml, formatRelative, wordCount } = root.StudiesUtils;
  const { getDocuments } = root.StudiesStorage;
  const { getTemplate, getAllTemplates } = root.StudiesTemplates;

  const page = {
    id: "home",
    page: null,

    bind() {
      this.page = document.getElementById("page-home");
      this.page.querySelector("#home-search").addEventListener("input", () => this.render());

      document.getElementById("btn-new-blank")?.addEventListener("click", () => {
        root.StudiesApp.newFromTemplate("blank");
      });
      document.getElementById("btn-new-formal")?.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleFormalMenu();
      });
      document.getElementById("btn-new-menu")?.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleNewMenu();
      });

      document.addEventListener("app-settings-applied", () => this.render());
    },

    async activate() {
      await this.render();
    },

    formalEnabled() {
      return root.StudiesFormal?.isFormalEnabled?.() !== false;
    },

    hideMenus() {
      const home = document.getElementById("home-new-menu");
      if (home) home.hidden = true;
    },

    toggleFormalMenu() {
      if (!this.formalEnabled()) return;
      const menu = document.getElementById("home-new-menu");
      if (!menu) return;
      if (!menu.hidden && menu.dataset.kind === "formal") {
        menu.hidden = true;
        return;
      }
      const styles = root.StudiesFormal?.STYLES || [];
      menu.dataset.kind = "formal";
      menu.innerHTML =
        `<div class="picker-menu-head">Formal document</div>` +
        styles
          .map(
            (s) =>
              `<button type="button" class="template-pick" data-formal="${escapeHtml(s.id)}">
              <span>${escapeHtml(s.icon)}</span>
              <span class="template-pick-text">
                <strong>${escapeHtml(s.name)}</strong>
                <small>${escapeHtml(s.description || "")}</small>
              </span>
            </button>`
          )
          .join("");
      menu.hidden = false;
      menu.querySelectorAll("[data-formal]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          menu.hidden = true;
          await root.StudiesApp.newFormalDocument(btn.dataset.formal);
        });
      });
      const close = (ev) => {
        if (!menu.contains(ev.target) && ev.target.id !== "btn-new-formal" && ev.target.id !== "btn-new-menu") {
          menu.hidden = true;
          document.removeEventListener("click", close);
        }
      };
      setTimeout(() => document.addEventListener("click", close), 0);
    },

    toggleNewMenu() {
      const menu = document.getElementById("home-new-menu");
      if (!menu) return;
      if (!menu.hidden && menu.dataset.kind === "templates") {
        menu.hidden = true;
        return;
      }
      const templates = getAllTemplates();
      const formalOn = this.formalEnabled();
      const styles = root.StudiesFormal?.STYLES || [];
      menu.dataset.kind = "templates";
      menu.innerHTML =
        `<div class="picker-menu-head">Visual project</div>` +
        templates
          .map(
            (t) =>
              `<button type="button" class="template-pick" data-template="${escapeHtml(t.id)}">
              <span>${escapeHtml(t.icon)}</span>
              <span class="template-pick-text">
                <strong>${escapeHtml(t.name)}</strong>
                <small>${escapeHtml(t.description || "")}</small>
              </span>
            </button>`
          )
          .join("") +
        (formalOn
          ? `<div class="picker-menu-sep">Formal document</div>` +
            styles
              .map(
                (s) =>
                  `<button type="button" class="template-pick" data-formal="${escapeHtml(s.id)}">
              <span>${escapeHtml(s.icon)}</span>
              <span class="template-pick-text">
                <strong>${escapeHtml(s.name)}</strong>
                <small>${escapeHtml(s.description || "")}</small>
              </span>
            </button>`
              )
              .join("")
          : "");
      menu.hidden = false;
      menu.querySelectorAll("[data-template]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          menu.hidden = true;
          await root.StudiesApp.newFromTemplate(btn.dataset.template);
        });
      });
      menu.querySelectorAll("[data-formal]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          menu.hidden = true;
          await root.StudiesApp.newFormalDocument(btn.dataset.formal);
        });
      });
      const close = (ev) => {
        if (!menu.contains(ev.target) && ev.target.id !== "btn-new-menu" && ev.target.id !== "btn-new-formal") {
          menu.hidden = true;
          document.removeEventListener("click", close);
        }
      };
      setTimeout(() => document.addEventListener("click", close), 0);
    },

    async render() {
      const q = this.page.querySelector("#home-search").value.trim().toLowerCase();
      let docs = await getDocuments();
      if (q) {
        docs = docs.filter(
          (d) =>
            d.title.toLowerCase().includes(q) ||
            (d.content && d.content.toLowerCase().includes(q)) ||
            (d.template && d.template.toLowerCase().includes(q)) ||
            (d.docMode && d.docMode.toLowerCase().includes(q))
        );
      }
      docs.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      });

      const formalOn = this.formalEnabled();
      const grid = this.page.querySelector("#doc-grid");
      if (!docs.length) {
        grid.innerHTML = `
          <div class="doc-empty">
            <h2>No documents yet</h2>
            <p>Start a visual page layout or a continuous formal document.</p>
            <div class="doc-empty-actions">
              <button type="button" class="btn btn-primary" id="empty-blank">+ Blank document</button>
              ${formalOn ? `<button type="button" class="btn btn-ghost" id="empty-formal">+ Formal document</button>` : ""}
              <button type="button" class="btn btn-ghost" id="empty-templates">Browse templates</button>
            </div>
          </div>`;
        grid.querySelector("#empty-blank")?.addEventListener("click", () =>
          root.StudiesApp.newFromTemplate("blank")
        );
        grid.querySelector("#empty-formal")?.addEventListener("click", () =>
          root.StudiesApp.newFormalDocument("academic")
        );
        grid.querySelector("#empty-templates")?.addEventListener("click", () =>
          root.StudiesApp.setActivePage("templates")
        );
        return;
      }

      grid.innerHTML = docs
        .map((d) => {
          const isFormal = d.docMode === "formal";
          const tpl = getTemplate(d.template);
          const styleName = isFormal
            ? root.StudiesFormal?.getStyle?.(d.formalStyle)?.name || "Formal"
            : tpl?.name || d.template || "Document";
          const preview = String(d.content || "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 120);
          return `
          <div class="doc-card ${d.pinned ? "is-pinned" : ""} ${isFormal ? "is-formal" : ""}" data-id="${escapeHtml(d.id)}">
            <button type="button" class="doc-card-delete" data-delete="${escapeHtml(d.id)}" title="Delete" aria-label="Delete document">✕</button>
            <button type="button" class="doc-card-open" data-open="${escapeHtml(d.id)}">
              <div class="doc-card-preview" aria-hidden="true">${escapeHtml(preview || "Empty page")}</div>
              <div class="doc-card-meta">
                <strong class="doc-card-title">${d.pinned ? "★ " : ""}${escapeHtml(d.title)}</strong>
                <span class="doc-card-sub">${isFormal ? "Formal · " : ""}${escapeHtml(styleName)} · ${escapeHtml(formatRelative(d.updatedAt))} · ${wordCount(d.content)} words</span>
              </div>
            </button>
          </div>`;
        })
        .join("");

      grid.querySelectorAll("[data-open]").forEach((btn) => {
        btn.addEventListener("click", () => root.StudiesApp.openDocument(btn.dataset.open));
      });
      grid.querySelectorAll("[data-delete]").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const id = btn.dataset.delete;
          const docsNow = await getDocuments();
          const doc = docsNow.find((d) => d.id === id);
          const title = doc?.title || "this document";
          if (!confirm(`Delete "${title}"?`)) return;
          await root.StudiesStorage.deleteDocument(id);
          await this.render();
        });
      });
    },
  };

  root.StudiesPages = root.StudiesPages || {};
  root.StudiesPages.home = page;
})(window);
