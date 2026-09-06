(function (root) {
  const { escapeHtml, formatRelative, formatDateTime, wordCount } = root.StudiesUtils;
  const { getDocuments, getSettings, saveDocument, createDocument, deleteDocument, exportFile, exportPdf, exportDocx } =
    root.StudiesStorage;
  const { getAllTemplates, getTemplate, getAllBlocks, buildBlock } = root.StudiesTemplates;
  const { createEditor, buildExportHtml, buildRtf, serializeDocPages } = root.StudiesEditor;
  const { extractSlots, applySlotFills, applyFillsByRole, setLocalImage, inventoryPrompt } = root.StudiesSlots;

  function closeMenuOnOutside(menu, keepIds, close) {
    const handler = (e) => {
      if (menu.contains(e.target) || keepIds.some((id) => e.target.id === id || e.target.closest?.(`#${id}`))) {
        return;
      }
      close();
      document.removeEventListener("click", handler);
    };
    setTimeout(() => document.addEventListener("click", handler), 0);
  }

  const page = {
    id: "editor",
    page: null,
    activeDocId: null,
    editor: null,
    saveTimer: null,
    dirty: false,
    sidebarOpen: false,
    focusMode: false,
    pendingDocId: null,

    bind() {
      this.page = document.getElementById("page-editor");
      this.page.classList.add("sidebar-collapsed");

      this.page.querySelector("#ed-back").addEventListener("click", () => root.StudiesApp.goHome());
      this.page.querySelector("#ed-new-doc").addEventListener("click", (e) => {
        e.stopPropagation();
        this.showNewDocMenu();
      });
      this.page.querySelector("#ed-doc-search").addEventListener("input", () => this.renderDocList());
      this.page.querySelector("#ed-delete-doc").addEventListener("click", () => this.deleteActiveDoc());
      this.page.querySelector("#ed-pin-doc").addEventListener("click", () => this.togglePin());
      this.page.querySelector("#ed-export-html").addEventListener("click", () => this.exportHtml());
      this.page.querySelector("#ed-export-rtf").addEventListener("click", () => this.exportRtf());
      this.page.querySelector("#ed-export-pdf")?.addEventListener("click", () => this.exportPdfDoc());
      this.page.querySelector("#ed-export-docx")?.addEventListener("click", () => this.exportDocxDoc());
      this.page.querySelector("#ed-copy").addEventListener("click", () => this.copyRich());
      this.page.querySelector("#editor-formal-style")?.addEventListener("change", (e) => {
        this.setFormalStyle(e.target.value);
      });
      this.page.querySelector("#ed-toggle-sidebar").addEventListener("click", () => this.toggleSidebar());
      this.page.querySelector("#ed-focus-mode").addEventListener("click", () => this.toggleFocusMode());
      this.page.querySelector("#ed-insert-layout")?.addEventListener("click", (e) => {
        e.stopPropagation();
        this.hideAddPageMenu();
        this.showLayoutMenu();
      });
      this.page.querySelector("#ed-add-page")?.addEventListener("click", (e) => {
        e.stopPropagation();
        this.hideLayoutMenu();
        this.showAddPageMenu();
      });
      this.page.querySelector("#ed-add-page-bottom")?.addEventListener("click", (e) => {
        e.stopPropagation();
        this.hideLayoutMenu();
        this.showAddPageMenu(true);
      });
      this.page.querySelector("#ed-ai-fill")?.addEventListener("click", () => {
        window.StudiesAiChat?.openFillComposer?.();
      });
      this.page.querySelector("#ed-fact-check")?.addEventListener("click", () => {
        window.StudiesAiChat?.runFactCheck?.();
      });

      this.page.querySelector("#editor-sheets")?.addEventListener("click", (e) => {
        if (e.target.closest(".tpl-slot-caption") || e.target.closest("[contenteditable='true']")?.classList?.contains("tpl-slot-caption")) {
          return;
        }
        const figure = e.target.closest(".tpl-slot--image");
        if (!figure || !this.page.contains(figure)) return;
        e.preventDefault();
        e.stopPropagation();
        this.pickLocalImageForSlot(figure);
      });

      this.page.addEventListener("click", (e) => {
        if (!this.sidebarOpen) return;
        if (
          e.target.closest(".ed-sidebar") ||
          e.target.closest("#ed-toggle-sidebar") ||
          e.target.closest("#ed-new-doc") ||
          e.target.closest("#ed-template-menu")
        ) {
          return;
        }
        this.toggleSidebar();
      });

      const titleInput = this.page.querySelector("#editor-title");
      titleInput.addEventListener("input", () => {
        this.dirty = true;
        this.scheduleSave();
        this.updateSaveStatus("Unsaved changes…");
      });

      const fontSelect = this.page.querySelector("#editor-font-size");
      fontSelect.addEventListener("change", () => {
        this.editor.setFontSize(Number(fontSelect.value));
        this.dirty = true;
        this.scheduleSave();
      });

      const lhSelect = this.page.querySelector("#editor-line-height");
      lhSelect.addEventListener("change", () => {
        this.editor.setLineHeight(lhSelect.value);
        this.dirty = true;
        this.scheduleSave();
      });

      this.editor = createEditor({
        sheetsEl: this.page.querySelector("#editor-sheets"),
        toolbar: this.page.querySelector("#editor-toolbar"),
        onChange: () => {
          this.dirty = true;
          this.scheduleSave();
        },
        onStats: (s) => {
          this.page.querySelector("#editor-wordcount").textContent = `${s.words} words · ${s.chars} chars`;
          const pagesEl = this.page.querySelector("#editor-pagecount");
          if (pagesEl) {
            pagesEl.textContent = `${s.pageCount || 1} page${(s.pageCount || 1) === 1 ? "" : "s"}`;
          }
          const mins = Math.max(1, Math.ceil(s.words / 200));
          this.page.querySelector("#editor-reading-time").textContent =
            s.words > 0 ? `~${mins} min read` : "";
        },
        onPagesChange: (n) => {
          const pagesEl = this.page.querySelector("#editor-pagecount");
          if (pagesEl) pagesEl.textContent = `${n} page${n === 1 ? "" : "s"}`;
        },
      });

      document.addEventListener("keydown", (e) => this.handleShortcut(e));
    },

    handleShortcut(e) {
      if (this.page.hidden) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === "s") {
        e.preventDefault();
        this.flushSave();
      }
      if (mod && e.key === "\\") {
        e.preventDefault();
        this.toggleSidebar();
      }
      if (mod && e.shiftKey && (e.key === "F" || e.key === "f")) {
        e.preventDefault();
        this.toggleFocusMode();
      }
      if (mod && e.key === "n") {
        e.preventDefault();
        this.showNewDocMenu();
      }
      if (mod && e.shiftKey && (e.key === "P" || e.key === "p")) {
        e.preventDefault();
        this.showAddPageMenu();
      }
    },

    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen;
      this.page.classList.toggle("sidebar-collapsed", !this.sidebarOpen);
      const btn = this.page.querySelector("#ed-toggle-sidebar");
      btn.classList.toggle("active", this.sidebarOpen);
      btn.textContent = this.sidebarOpen ? "✕ Close" : "☰ Docs";
    },

    toggleFocusMode() {
      this.focusMode = !this.focusMode;
      this.page.classList.toggle("focus-mode", this.focusMode);
      const btn = this.page.querySelector("#ed-focus-mode");
      btn.textContent = this.focusMode ? "Exit focus" : "Focus";
      btn.classList.toggle("active", this.focusMode);
    },

    async activate(docId) {
      const openId = docId || this.pendingDocId || this.activeDocId;
      this.pendingDocId = null;
      await this.renderDocList();
      const docs = await getDocuments();
      if (openId && docs.some((d) => d.id === openId)) {
        await this.openDoc(openId);
      } else if (docs.length) {
        const sorted = docs.slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        await this.openDoc(sorted[0].id);
      } else {
        await this.createDoc("blank");
      }
    },

    deactivate() {
      if (this.dirty) this.flushSave();
      if (this.focusMode) this.toggleFocusMode();
      this.hideAddPageMenu();
      this.hideLayoutMenu();
      document.getElementById("app-shell")?.classList.remove("editor-formal");
      this.page.classList.remove("is-formal");
    },

    scheduleSave() {
      clearTimeout(this.saveTimer);
      getSettings().then((s) => {
        this.saveTimer = setTimeout(() => this.flushSave(), s.autoSaveMs || 1500);
      });
    },

    async flushSave() {
      if (!this.activeDocId || !this.dirty) return;
      const docs = await getDocuments();
      const doc = docs.find((d) => d.id === this.activeDocId);
      if (!doc) return;

      doc.title = this.page.querySelector("#editor-title").value.trim() || "Untitled";
      doc.content = this.editor.getContent();
      if (this.editor.isFormal()) {
        doc.docMode = "formal";
        doc.formalStyle = this.editor.getFormalStyle() || "academic";
        doc.template = "formal";
      }
      doc.updatedAt = new Date().toISOString();
      await saveDocument(doc);
      this.dirty = false;
      this.updateSaveStatus(`Saved ${formatRelative(doc.updatedAt)}`);
      await this.renderDocList();
    },

    updateSaveStatus(msg) {
      this.page.querySelector("#editor-save-status").textContent = msg;
    },

    hideLayoutMenu() {
      const menu = this.page.querySelector("#ed-layout-menu");
      if (menu) menu.hidden = true;
    },

    hideAddPageMenu() {
      const menu = this.page.querySelector("#ed-add-page-menu");
      if (menu) menu.hidden = true;
    },

    showNewDocMenu() {
      const menu = this.page.querySelector("#ed-template-menu");
      const templates = getAllTemplates();
      const formalOn = root.StudiesFormal?.isFormalEnabled?.() !== false;
      const formalStyles = root.StudiesFormal?.STYLES || [];
      menu.innerHTML =
        `<div class="picker-menu-head">Visual project</div>` +
        templates
          .map(
            (t) =>
              `<button type="button" class="template-pick" data-template="${escapeHtml(t.id)}"><span>${escapeHtml(t.icon)}</span>
                <span class="template-pick-text"><strong>${escapeHtml(t.name)}</strong><small>${escapeHtml(t.description || "")}</small></span>
              </button>`
          )
          .join("") +
        (formalOn
          ? `<div class="picker-menu-sep">Formal document</div>` +
            formalStyles
              .map(
                (s) =>
                  `<button type="button" class="template-pick" data-formal="${escapeHtml(s.id)}"><span>${escapeHtml(s.icon)}</span>
                    <span class="template-pick-text"><strong>${escapeHtml(s.name)}</strong><small>${escapeHtml(s.description || "")}</small></span>
                  </button>`
              )
              .join("")
          : "");
      menu.hidden = false;
      menu.querySelectorAll("[data-template]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          menu.hidden = true;
          await this.createDoc(btn.dataset.template);
        });
      });
      menu.querySelectorAll("[data-formal]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          menu.hidden = true;
          await this.createFormalDoc(btn.dataset.formal);
        });
      });
      closeMenuOnOutside(menu, ["ed-new-doc"], () => {
        menu.hidden = true;
      });
    },

    showLayoutMenu() {
      const menu = this.page.querySelector("#ed-layout-menu");
      if (!menu) return;
      const blocks = getAllBlocks();
      menu.innerHTML =
        `<div class="picker-menu-head">Insert into current page</div>` +
        blocks
          .map(
            (b) =>
              `<button type="button" class="template-pick" data-block="${escapeHtml(b.id)}"><span>${escapeHtml(b.icon)}</span>
                <span class="template-pick-text"><strong>${escapeHtml(b.name)}</strong><small>${escapeHtml(b.description || "")}</small></span>
              </button>`
          )
          .join("");
      menu.hidden = false;
      menu.querySelectorAll("[data-block]").forEach((btn) => {
        btn.addEventListener("click", () => {
          menu.hidden = true;
          this.insertLayoutBlock(btn.dataset.block);
        });
      });
      closeMenuOnOutside(menu, ["ed-insert-layout"], () => {
        menu.hidden = true;
      });
    },

    showAddPageMenu(nearBottom) {
      const menu = this.page.querySelector("#ed-add-page-menu");
      if (!menu) return;
      menu.classList.toggle("ed-add-page-menu--bottom", !!nearBottom);
      const templates = getAllTemplates();
      menu.innerHTML =
        `<div class="picker-menu-head">Add next page</div>` +
        `<button type="button" class="template-pick template-pick--accent" data-template="blank">
          <span>▢</span>
          <span class="template-pick-text"><strong>Blank page</strong><small>Empty sheet — write freely</small></span>
        </button>` +
        `<div class="picker-menu-sep">Or from a template</div>` +
        templates
          .filter((t) => t.id !== "blank")
          .map(
            (t) =>
              `<button type="button" class="template-pick" data-template="${escapeHtml(t.id)}"><span>${escapeHtml(t.icon)}</span>
                <span class="template-pick-text"><strong>${escapeHtml(t.name)}</strong><small>${escapeHtml(t.description || "")}</small></span>
              </button>`
          )
          .join("");
      menu.hidden = false;
      menu.querySelectorAll("[data-template]").forEach((btn) => {
        btn.addEventListener("click", () => {
          menu.hidden = true;
          this.addPageFromTemplate(btn.dataset.template);
        });
      });
      closeMenuOnOutside(menu, ["ed-add-page", "ed-add-page-bottom"], () => {
        menu.hidden = true;
      });
    },

    addPageFromTemplate(templateId) {
      const tpl = getTemplate(templateId || "blank");
      const html = tpl.id === "blank" ? "<p><br></p>" : tpl.html;
      this.editor.addPage(tpl.id, html);
      this.dirty = true;
      this.scheduleSave();
      this.updateSaveStatus(`Added page · ${tpl.name}`);
    },

    insertLayoutBlock(blockId) {
      const html = buildBlock(blockId);
      if (!html) return;
      this.editor.insertHtml(html);
      this.dirty = true;
      this.scheduleSave();
      this.updateSaveStatus("Block inserted on current page");
    },

    pickLocalImageForSlot(figureEl) {
      if (!figureEl) return;
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/jpeg,image/jpg,image/webp,image/gif";
      input.style.display = "none";
      document.body.appendChild(input);
      input.addEventListener("change", async () => {
        const file = input.files && input.files[0];
        input.remove();
        if (!file) return;
        try {
          const dataUrl = await this.fileToOptimizedDataUrl(file);
          const cap = figureEl.querySelector("[data-slot-role='caption']");
          const keepCaption = (cap?.textContent || "").trim();
          setLocalImage(figureEl, dataUrl, {
            caption: keepCaption && keepCaption.toLowerCase() !== "caption" ? keepCaption : file.name.replace(/\.[^.]+$/, ""),
            alt: file.name,
          });
          this.dirty = true;
          this.scheduleSave();
          this.updateSaveStatus("Image added from your files");
        } catch (err) {
          this.updateSaveStatus(err?.message || "Could not load image");
        }
      });
      input.addEventListener("cancel", () => input.remove());
      input.click();
    },

    fileToOptimizedDataUrl(file, maxWidth = 1600) {
      return new Promise((resolve, reject) => {
        if (!file || !String(file.type || "").startsWith("image/")) {
          reject(new Error("Please choose an image file"));
          return;
        }
        if (file.size > 12 * 1024 * 1024) {
          reject(new Error("Image is too large (max 12MB)"));
          return;
        }
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            const scale = Math.min(1, maxWidth / Math.max(1, img.width));
            const w = Math.max(1, Math.round(img.width * scale));
            const h = Math.max(1, Math.round(img.height * scale));
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, w, h);
            const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
            resolve(canvas.toDataURL(mime, mime === "image/jpeg" ? 0.86 : undefined));
          };
          img.onerror = () => reject(new Error("Invalid image file"));
          img.src = String(reader.result || "");
        };
        reader.readAsDataURL(file);
      });
    },

    getDocumentPlainText() {
      const rootEl = this.editor?.getSheetsRoot?.();
      if (!rootEl) return "";
      const clone = rootEl.cloneNode(true);
      clone.querySelectorAll("script,style").forEach((n) => n.remove());
      const title = this.page.querySelector("#editor-title")?.value || "Untitled";
      const body = root.StudiesUtils.stripHtml(clone.innerHTML || "");
      return `Title: ${title}\n\n${body}`.trim();
    },

    getOpenDocumentContext() {
      const rootEl = this.editor.getSheetsRoot();
      const title = this.page.querySelector("#editor-title")?.value || "Untitled";
      const { slots } = extractSlots(rootEl);
      return {
        docId: this.activeDocId,
        title,
        slots,
        inventory: inventoryPrompt(slots, title),
      };
    },

    applyAiFills(fills) {
      const rootEl = this.editor.getSheetsRoot();
      const result = applySlotFills(rootEl, fills);
      this.dirty = true;
      this.scheduleSave();
      const html = this.editor.getContent();
      const words = root.StudiesUtils.wordCount(html);
      const chars = root.StudiesUtils.stripHtml(html).length;
      this.page.querySelector("#editor-wordcount").textContent = `${words} words · ${chars} chars`;
      this.updateSaveStatus(`AI filled ${result.applied} slot${result.applied === 1 ? "" : "s"}`);
      return result;
    },

    applyAiProject(res) {
      const pages = Array.isArray(res?.pages) ? res.pages : [];
      if (!pages.length) return { ok: false, error: "No pages in project result" };

      const built = [];
      const usedTemplates = [];
      for (const pageSpec of pages) {
        let templateId = String(pageSpec.template || pageSpec.templateId || "feature-left");
        let tpl = getTemplate(templateId);
        if (!tpl || tpl.id === "blank") {
          templateId = "feature-left";
          tpl = getTemplate(templateId);
        }
        const inner = tpl.id === "blank" ? "<p><br></p>" : tpl.html;
        const wrap = document.createElement("div");
        wrap.innerHTML = inner;
        if (pageSpec.fillsByRole && typeof pageSpec.fillsByRole === "object") {
          applyFillsByRole(wrap, pageSpec.fillsByRole);
        } else if (Array.isArray(pageSpec.fills)) {
          applySlotFills(wrap, pageSpec.fills);
        }
        built.push({ template: tpl.id, html: wrap.innerHTML });
        usedTemplates.push(tpl.id);
      }

      if (typeof this.editor.setPages === "function") {
        this.editor.setPages(built);
      } else {
        this.editor.setContent(serializeDocPages(built));
      }
      if (res.title) {
        const titleInput = this.page.querySelector("#editor-title");
        if (titleInput) titleInput.value = res.title;
      }
      this.dirty = true;
      this.scheduleSave();
      const actual = this.editor.getPageCount?.() || built.length;
      this.updateSaveStatus(`AI project · ${actual} pages`);
      if (actual !== built.length) {
        return {
          ok: false,
          error: `Editor shows ${actual} pages after apply (expected ${built.length})`,
        };
      }
      return {
        ok: true,
        summary:
          res.summary ||
          `Created ${built.length} pages (${[...new Set(usedTemplates)].join(", ")}).`,
        pageCount: built.length,
        templates: usedTemplates,
      };
    },

    async fillSlotsWithAi(topic) {
      if (window.StudiesAiChat?.openFillComposer) {
        window.StudiesAiChat.openFillComposer(topic);
        return { ok: true, deferred: true };
      }
      this.updateSaveStatus("AI chat unavailable");
      return { ok: false, error: "AI unavailable" };
    },

    async createDoc(templateId) {
      if (this.dirty) await this.flushSave();
      const tpl = getTemplate(templateId);
      const inner = tpl.id === "blank" ? "<p><br></p>" : tpl.html;
      const content = serializeDocPages([{ template: tpl.id, html: inner }]);
      const doc = await createDocument({
        title: tpl.id === "blank" ? "Untitled document" : tpl.name,
        content,
        template: tpl.id,
        docMode: "visual",
      });
      await this.renderDocList();
      await this.openDoc(doc.id);
      return doc;
    },

    async createFormalDoc(styleId) {
      if (this.dirty) await this.flushSave();
      const style = root.StudiesFormal?.getStyle?.(styleId) || { id: "academic", name: "Academic" };
      const inner = root.StudiesFormal?.starterHtml?.(style.id) || "<p><br></p>";
      const content = serializeDocPages([{ template: "formal", html: inner }]);
      const doc = await createDocument({
        title: `Untitled ${style.name.toLowerCase()}`,
        content,
        template: "formal",
        docMode: "formal",
        formalStyle: style.id,
      });
      await this.renderDocList();
      await this.openDoc(doc.id);
      return doc;
    },

    applyChromeForMode(isFormal) {
      const shell = document.getElementById("app-shell");
      shell?.classList.toggle("editor-formal", !!isFormal);
      this.page.classList.toggle("is-formal", !!isFormal);

      const styleSel = this.page.querySelector("#editor-formal-style");
      if (styleSel) {
        styleSel.hidden = !isFormal;
        if (isFormal) styleSel.value = this.editor.getFormalStyle() || "academic";
      }

      this.page.querySelectorAll(".visual-only").forEach((el) => {
        el.hidden = !!isFormal;
      });
      const addBar = this.page.querySelector(".editor-add-page-bar");
      if (addBar) addBar.hidden = !!isFormal;

      const pagesEl = this.page.querySelector("#editor-pagecount");
      if (pagesEl) {
        pagesEl.hidden = !!isFormal;
        if (isFormal) pagesEl.textContent = "Formal";
      }
    },

    setFormalStyle(styleId) {
      if (!this.editor.isFormal()) return;
      const style = root.StudiesFormal?.getStyle?.(styleId);
      this.editor.setFormal(true, style?.id || styleId);
      this.dirty = true;
      this.scheduleSave();
      this.updateSaveStatus("Unsaved changes…");
    },

    async openDoc(id) {
      if (this.dirty) await this.flushSave();
      const docs = await getDocuments();
      const doc = docs.find((d) => d.id === id);
      if (!doc) return;

      this.activeDocId = doc.id;
      this.page.querySelector("#editor-title").value = doc.title;

      const isFormal = doc.docMode === "formal";
      this.editor.setContent(doc.content);
      this.editor.setFormal(isFormal, doc.formalStyle || "academic");

      const settings = await getSettings();
      const fontSize = settings.fontSize || 16;
      const lineHeight = settings.lineHeight || 1.65;
      this.editor.setFontSize(fontSize);
      this.editor.setLineHeight(lineHeight);
      this.page.querySelector("#editor-font-size").value = String(fontSize);
      this.page.querySelector("#editor-line-height").value = String(lineHeight);
      this.applyChromeForMode(isFormal);
      this.dirty = false;
      this.updateSaveStatus(`Last edited ${formatDateTime(doc.updatedAt)}`);

      this.page.querySelector("#ed-pin-doc").textContent = doc.pinned ? "Unpin" : "Pin";
      this.page.querySelector("#ed-pin-doc").classList.toggle("active", doc.pinned);

      await this.renderDocList();
      this.editor.focus();
    },

    async renderDocList() {
      const q = this.page.querySelector("#ed-doc-search").value.trim().toLowerCase();
      let docs = await getDocuments();
      if (q) {
        docs = docs.filter(
          (d) =>
            d.title.toLowerCase().includes(q) ||
            (d.content && d.content.toLowerCase().includes(q))
        );
      }
      docs.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      });

      const list = this.page.querySelector("#ed-doc-list");
      if (!docs.length) {
        list.innerHTML = `<p class="ed-doc-empty">No documents yet. Click <strong>+ New</strong>.</p>`;
        return;
      }

      list.innerHTML = docs
        .map((d) => {
          const pageCount = (d.content.match(/class="doc-page"/g) || []).length || 1;
          const meta =
            d.docMode === "formal"
              ? `${escapeHtml(formatRelative(d.updatedAt))} · Formal · ${wordCount(d.content)} words`
              : `${escapeHtml(formatRelative(d.updatedAt))} · ${pageCount}p · ${wordCount(d.content)} words`;
          return `
        <button type="button" class="ed-doc-item ${d.id === this.activeDocId ? "active" : ""}" data-id="${escapeHtml(d.id)}">
          ${d.pinned ? '<span class="ed-doc-pin" aria-hidden="true">★</span>' : ""}
          <span class="ed-doc-title">${escapeHtml(d.title)}</span>
          <span class="ed-doc-meta">${meta}</span>
        </button>`;
        })
        .join("");

      list.querySelectorAll(".ed-doc-item").forEach((btn) => {
        btn.addEventListener("click", () => this.openDoc(btn.dataset.id));
      });
    },

    async deleteActiveDoc() {
      if (!this.activeDocId) return;
      const title = this.page.querySelector("#editor-title").value;
      if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
      await deleteDocument(this.activeDocId);
      this.activeDocId = null;
      const docs = await getDocuments();
      await this.renderDocList();
      if (docs.length) await this.openDoc(docs[0].id);
      else root.StudiesApp.goHome();
    },

    async togglePin() {
      if (!this.activeDocId) return;
      const docs = await getDocuments();
      const doc = docs.find((d) => d.id === this.activeDocId);
      if (!doc) return;
      doc.pinned = !doc.pinned;
      await saveDocument(doc);
      this.page.querySelector("#ed-pin-doc").textContent = doc.pinned ? "Unpin" : "Pin";
      this.page.querySelector("#ed-pin-doc").classList.toggle("active", doc.pinned);
      await this.renderDocList();
    },

    async exportHtml() {
      await this.flushSave();
      const title = this.page.querySelector("#editor-title").value || "document";
      const html = buildExportHtml(title, this.editor.getContent());
      const safe = title.replace(/[^\w\s\u0590-\u05FF-]/g, "").trim() || "document";
      await exportFile(`${safe}.html`, html);
      this.updateSaveStatus("Exported HTML");
    },

    async exportRtf() {
      await this.flushSave();
      const title = this.page.querySelector("#editor-title").value || "document";
      const rtf = buildRtf(title, this.editor.getContent());
      const safe = title.replace(/[^\w\s\u0590-\u05FF-]/g, "").trim() || "document";
      await exportFile(`${safe}.rtf`, rtf);
      this.updateSaveStatus("Exported RTF");
    },

    async exportPdfDoc() {
      await this.flushSave();
      const title = this.page.querySelector("#editor-title").value || "document";
      // Prefer live sheet order from the editor so PDF matches what you see.
      const livePages = [];
      const sheets = this.page.querySelectorAll("#editor-sheets .editor-sheet .editor-body");
      if (sheets.length) {
        sheets.forEach((body) => {
          livePages.push({
            template: body.dataset.template || "blank",
            html: body.innerHTML || "<p><br></p>",
          });
        });
      }
      const content = livePages.length
        ? serializeDocPages(livePages)
        : this.editor.getContent();
      const html = buildExportHtml(title, content, {
        forPdf: true,
        formal: this.editor.isFormal(),
      });
      const safe = title.replace(/[^\w\s\u0590-\u05FF-]/g, "").trim() || "document";
      this.updateSaveStatus("Choose where to save the PDF…");
      try {
        const res = await exportPdf(`${safe}.pdf`, html);
        if (res?.cancelled) {
          this.updateSaveStatus("PDF export cancelled");
          return;
        }
        if (!res?.ok) throw new Error(res?.error || "PDF export failed");
        this.updateSaveStatus(`PDF saved · ${res.path}`);
      } catch (err) {
        this.updateSaveStatus(err?.message || "PDF export failed");
      }
    },

    async exportDocxDoc() {
      await this.flushSave();
      const title = this.page.querySelector("#editor-title").value || "document";
      const content = this.editor.getContent();
      if (!root.StudiesDocx?.buildDocxBytes) {
        this.updateSaveStatus("DOCX export unavailable");
        return;
      }
      const bytes = root.StudiesDocx.buildDocxBytes(title, content);
      const base64 = root.StudiesDocx.bytesToBase64(bytes);
      const safe = title.replace(/[^\w\s\u0590-\u05FF-]/g, "").trim() || "document";
      this.updateSaveStatus("Choose where to save the DOCX…");
      try {
        const res = await exportDocx(`${safe}.docx`, base64);
        if (res?.cancelled) {
          this.updateSaveStatus("DOCX export cancelled");
          return;
        }
        if (!res?.ok) throw new Error(res?.error || "DOCX export failed");
        this.updateSaveStatus(`DOCX saved · ${res.path}`);
      } catch (err) {
        this.updateSaveStatus(err?.message || "DOCX export failed");
      }
    },

    async copyRich() {
      await this.flushSave();
      const html = this.editor.getContent();
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([root.StudiesUtils.stripHtml(html)], { type: "text/plain" }),
          }),
        ]);
        this.updateSaveStatus("Copied — paste into Word");
      } catch (_) {
        alert("Copy failed. Use Export instead.");
      }
    },
  };

  root.StudiesPages = root.StudiesPages || {};
  root.StudiesPages.editor = page;
})(window);
