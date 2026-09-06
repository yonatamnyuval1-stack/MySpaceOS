(function (root) {
  const { wordCount, stripHtml } = root.StudiesUtils;

  function parseDocPages(html) {
    const wrap = document.createElement("div");
    wrap.innerHTML = typeof html === "string" ? html : "";
    const sections = Array.from(wrap.querySelectorAll(":scope > section.doc-page"));
    if (sections.length) {
      return sections.map((sec) => ({
        template: sec.getAttribute("data-template") || "blank",
        html: sec.innerHTML || "<p><br></p>",
      }));
    }
    const inner = wrap.innerHTML.trim();
    return [{ template: "blank", html: inner || "<p><br></p>" }];
  }

  function serializeDocPages(pages) {
    return (pages || [])
      .map((p) => {
        const tpl = String(p.template || "blank").replace(/"/g, "");
        return `<section class="doc-page" data-template="${tpl}">${p.html || "<p><br></p>"}</section>`;
      })
      .join("");
  }

  function createEditor(options) {
    const sheetsEl = options.sheetsEl;
    const toolbar = options.toolbar;
    const onChange = options.onChange || (() => {});
    const onStats = options.onStats || (() => {});
    const onPagesChange = options.onPagesChange || (() => {});

    let pages = [{ template: "blank", html: "<p><br></p>" }];
    let activeIndex = 0;
    let fontSize = 16;
    let lineHeight = "1.65";
    let formalMode = false;
    let formalStyle = "academic";

    function emitChange() {
      syncFromDom();
      onChange(getContent());
      const html = pages.map((p) => p.html).join("\n");
      onStats({
        words: wordCount(html),
        chars: stripHtml(html).length,
        pageCount: pages.length,
      });
      onPagesChange(pages.length);
    }

    function syncFromDom() {
      const bodies = sheetsEl.querySelectorAll(".editor-body");
      bodies.forEach((body, i) => {
        if (!pages[i]) return;
        pages[i].html = body.innerHTML;
        pages[i].template = body.dataset.template || pages[i].template || "blank";
      });
    }

    function getActiveBody() {
      const bodies = sheetsEl.querySelectorAll(".editor-body");
      if (!bodies.length) return null;
      const idx = Math.min(Math.max(0, activeIndex), bodies.length - 1);
      return bodies[idx];
    }

    function bindBody(body, index) {
      body.addEventListener("focus", () => {
        activeIndex = index;
        sheetsEl.querySelectorAll(".editor-sheet").forEach((s, i) => {
          s.classList.toggle("is-active", i === index);
        });
      });
      body.addEventListener("input", emitChange);
      body.addEventListener("paste", (e) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text/html") || e.clipboardData.getData("text/plain");
        if (text) document.execCommand("insertHTML", false, text);
        emitChange();
      });
    }

    function applyFormalChrome() {
      sheetsEl.classList.toggle("editor-sheets--formal", formalMode);
      sheetsEl.classList.remove(
        "formal-style-academic",
        "formal-style-business",
        "formal-style-proposal",
        "formal-style-letter"
      );
      if (formalMode) {
        sheetsEl.classList.add(`formal-style-${formalStyle || "academic"}`);
      }
    }

    function renderSheets() {
      const tplNames = root.StudiesTemplates?.getAllTemplates?.() || [];
      const nameOf = (id) => tplNames.find((t) => t.id === id)?.name || id;
      const canRemove = !formalMode && pages.length > 1;

      sheetsEl.replaceChildren();
      applyFormalChrome();

      pages.forEach((p, i) => {
        const article = document.createElement("article");
        article.className = `editor-sheet${i === activeIndex ? " is-active" : ""}${formalMode ? " editor-sheet--formal" : ""}`;
        article.dataset.index = String(i);

        if (!formalMode) {
          const bar = document.createElement("div");
          bar.className = "editor-sheet-bar";

          const pageLabel = document.createElement("span");
          pageLabel.className = "editor-sheet-page";
          pageLabel.textContent = `Page ${i + 1}`;

          const tplLabel = document.createElement("span");
          tplLabel.className = "editor-sheet-tpl";
          tplLabel.textContent = nameOf(p.template);

          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "editor-sheet-remove";
          removeBtn.dataset.remove = String(i);
          removeBtn.title = "Remove page";
          removeBtn.setAttribute("aria-label", "Remove page");
          removeBtn.textContent = "✕";
          removeBtn.disabled = !canRemove;
          removeBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            removePage(i);
          });

          bar.append(pageLabel, tplLabel, removeBtn);
          article.appendChild(bar);
        }

        const pageWrap = document.createElement("div");
        pageWrap.className = "editor-page";

        const body = document.createElement("div");
        body.className = "editor-body";
        body.contentEditable = "true";
        body.spellcheck = true;
        body.dataset.template = formalMode ? "formal" : p.template || "blank";
        body.dataset.index = String(i);
        if (!formalMode) {
          body.style.fontSize = `${fontSize}px`;
          body.style.lineHeight = String(lineHeight);
        }
        body.innerHTML = p.html && String(p.html).trim() ? p.html : "<p><br></p>";

        pageWrap.appendChild(body);
        article.appendChild(pageWrap);
        sheetsEl.appendChild(article);
        bindBody(body, i);
      });

      onPagesChange(pages.length);
    }

    function exec(cmd, val) {
      const body = getActiveBody();
      if (!body) return;
      body.focus();
      document.execCommand(cmd, false, val ?? null);
      emitChange();
    }

    if (toolbar) {
      toolbar.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-cmd]");
        if (!btn) return;
        e.preventDefault();
        const cmd = btn.dataset.cmd;
        const val = btn.dataset.val;
        if (cmd === "createLink") {
          const url = prompt("Link URL:");
          if (url) exec("createLink", url);
          return;
        }
        exec(cmd, val);
      });

      toolbar.addEventListener("change", (e) => {
        const sel = e.target.closest("[data-cmd-select]");
        if (!sel) return;
        exec(sel.dataset.cmdSelect, sel.value);
      });
    }

    function setPages(nextPages) {
      const list = Array.isArray(nextPages) ? nextPages : [];
      pages = list.map((p) => ({
        template: String(p?.template || "blank"),
        html: p?.html && String(p.html).trim() ? p.html : "<p><br></p>",
      }));
      if (!pages.length) pages = [{ template: "blank", html: "<p><br></p>" }];
      activeIndex = 0;
      renderSheets();
      const joined = pages.map((p) => p.html).join("\n");
      onChange(serializeDocPages(pages));
      onStats({
        words: wordCount(joined),
        chars: stripHtml(joined).length,
        pageCount: pages.length,
      });
      onPagesChange(pages.length);
    }

    function setContent(html) {
      setPages(parseDocPages(html));
    }

    function getContent() {
      syncFromDom();
      return serializeDocPages(pages);
    }

    function addPage(templateId, html) {
      if (formalMode) return activeIndex;
      syncFromDom();
      const tpl = templateId || "blank";
      pages.push({
        template: tpl,
        html: html && String(html).trim() ? html : "<p><br></p>",
      });
      activeIndex = pages.length - 1;
      renderSheets();
      emitChange();
      const sheet = sheetsEl.querySelector(`.editor-sheet[data-index="${activeIndex}"]`);
      sheet?.scrollIntoView({ behavior: "smooth", block: "start" });
      getActiveBody()?.focus();
      return activeIndex;
    }

    function setFormal(enabled, styleId) {
      syncFromDom();
      formalMode = !!enabled;
      formalStyle = root.StudiesFormal?.getStyle?.(styleId)?.id || styleId || "academic";
      if (formalMode && pages.length > 1) {
        pages = [
          {
            template: "formal",
            html: pages.map((p) => p.html).join("\n") || "<p><br></p>",
          },
        ];
        activeIndex = 0;
      } else if (formalMode && pages[0]) {
        pages[0].template = "formal";
      }
      renderSheets();
      emitChange();
    }

    function removePage(index) {
      if (pages.length <= 1) return false;
      syncFromDom();
      pages.splice(index, 1);
      activeIndex = Math.min(activeIndex, pages.length - 1);
      renderSheets();
      emitChange();
      return true;
    }

    function insertHtml(html) {
      const body = getActiveBody();
      if (!body) return;
      body.focus();
      const empty = !body.innerHTML.replace(/<br\s*\/?>/gi, "").replace(/<p>\s*<\/p>/gi, "").trim();
      if (empty) body.innerHTML = html;
      else document.execCommand("insertHTML", false, html);
      emitChange();
    }

    function setPageHtml(index, html, templateId) {
      syncFromDom();
      if (!pages[index]) return;
      pages[index].html = html;
      if (templateId) pages[index].template = templateId;
      renderSheets();
      emitChange();
    }

    renderSheets();

    return {
      setContent,
      setPages,
      getContent,
      focus() {
        getActiveBody()?.focus();
      },
      setFontSize(px) {
        fontSize = Number(px) || 16;
        if (formalMode) return;
        sheetsEl.querySelectorAll(".editor-body").forEach((b) => {
          b.style.fontSize = `${fontSize}px`;
        });
      },
      setLineHeight(lh) {
        lineHeight = String(lh || "1.65");
        if (formalMode) return;
        sheetsEl.querySelectorAll(".editor-body").forEach((b) => {
          b.style.lineHeight = lineHeight;
        });
      },
      setFormal,
      isFormal: () => formalMode,
      getFormalStyle: () => formalStyle,
      insertHtml,
      addPage,
      removePage,
      getPageCount: () => pages.length,
      getActiveIndex: () => activeIndex,
      getSheetsRoot: () => sheetsEl,
      getActiveBody,
      setPageHtml,
      exec,
      parseDocPages,
      serializeDocPages,
    };
  }

  function buildExportHtml(title, content, options) {
    const forPdf = Boolean(options && options.forPdf);
    const formal = Boolean(options && options.formal);
    const pages = parseDocPages(content);
    const hasHebrew = /[\u0590-\u05FF]/.test(String(content || "") + String(title || ""));
    const safeTitle = String(title || "Document").replace(/</g, "");

    if (!forPdf || formal) {
      const body = pages
        .map(
          (p, i) =>
            `<section class="export-page">${i > 0 ? '<hr style="page-break-before:always;border:0;margin:2cm 0;" />' : ""}${p.html}</section>`
        )
        .join("\n");
      const formalCss =
        formal && forPdf
          ? `@page { size: Letter; margin: 1in; }
body { max-width: none; margin: 0; font-family: Georgia, "Times New Roman", serif; font-size: 12pt; line-height: 1.8; }
h1 { font-size: 16pt; text-align: center; } h2 { font-size: 13pt; } h3 { font-size: 12pt; font-style: italic; }`
          : `body { font-family: Calibri, "Segoe UI", "David", sans-serif; font-size: 11pt; line-height: 1.5; max-width: 800px; margin: 2cm auto; color: #111; }
h1 { font-size: 18pt; } h2 { font-size: 14pt; } h3 { font-size: 12pt; }`;
      return `<!DOCTYPE html>
<html lang="${hasHebrew ? "he" : "en"}" dir="${hasHebrew ? "rtl" : "auto"}" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
<meta charset="utf-8">
<title>${safeTitle}</title>
<style>
${formalCss}
pre, code { font-family: Consolas, monospace; background: #f5f5f5; padding: 2px 4px; }
pre { padding: 12px; overflow-x: auto; }
blockquote { border-left: 3px solid #ccc; margin-left: 0; padding-left: 12px; color: #555; }
img { max-width: 100%; height: auto; }
figure { margin: 0.8em 0; }
figcaption { font-size: 0.9em; color: #555; margin-top: 0.35em; }
ul { padding-inline-start: 1.4em; }
</style>
</head>
<body>
${body}
</body>
</html>`;
    }

    const pdfBody = pages
      .map(
        (p, i) =>
          `<section class="export-page" data-page="${i + 1}" data-template="${String(p.template || "blank").replace(/"/g, "")}">
  <div class="export-page-inner">${p.html || "<p></p>"}</div>
</section>`
      )
      .join("\n");

    return `<!DOCTYPE html>
<html lang="${hasHebrew ? "he" : "en"}" dir="${hasHebrew ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8">
<title>${safeTitle}</title>
<style>
@page { size: Letter; margin: 0; }
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  background: #fff;
  color: #1a1a1a;
  font-family: "Segoe UI", Calibri, "David", "Arial Hebrew", sans-serif;
  font-size: 16px;
  line-height: 1.65;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.export-page {
  /* Match Studies .editor-page / .editor-body exactly (US Letter) */
  width: 8.5in;
  min-height: 11in;
  padding: 0.75in 0.75in 1in;
  margin: 0 auto;
  background: #fff;
  page-break-after: always;
  break-after: page;
  overflow: visible;
}
.export-page:last-child {
  page-break-after: auto;
  break-after: auto;
}
.export-page-inner {
  width: 100%;
  margin: 0;
}
h1 { font-size: 1.75em; margin: 0 0 0.6em; line-height: 1.25; }
h2 { font-size: 1.35em; margin: 1.2em 0 0.45em; }
h3 { font-size: 1.15em; margin: 1em 0 0.4em; }
p { margin: 0 0 0.75em; }
ul, ol { margin: 0 0 0.85em; padding-inline-start: 1.4em; }
img { max-width: 100%; height: auto; display: block; }
figure { margin: 0.6em 0; }
figcaption, .tpl-slot-caption {
  display: block;
  padding: 8px 0 0;
  font-size: 0.85rem;
  color: #555;
  font-style: italic;
}

/* Hide editor-only chrome */
.tpl-slot-placeholder,
.tpl-slot-media::after,
.tpl-slot-img[hidden] { display: none !important; }
.tpl-slot--image {
  margin: 0.6em 0;
  padding: 0;
  border: none !important;
  background: transparent !important;
  cursor: default !important;
  overflow: hidden;
  border-radius: 8px;
}
.tpl-slot-media { position: relative; min-height: 0; }
.tpl-slot-img { width: 100%; max-height: 420px; object-fit: cover; border-radius: 8px; }
.tpl-slot--text { min-height: 0; }
.tpl-slot--text:empty::before,
.tpl-slot[data-placeholder]:empty::before { content: none !important; }

.tpl-slot--quote,
.tpl-region--pullquote {
  margin: 1.2em 0;
  padding: 0.85em 1.1em;
  border-inline-start: 3px solid #c8c4b8;
  background: #f3f0e8;
  color: #555;
  border-radius: 0 8px 8px 0;
}
.tpl-slot--quote cite { display: block; margin-top: 0.4em; font-size: 0.9em; }

/* Same desktop layouts as Studies editor */
.tpl-page { display: flex; flex-direction: column; gap: 1rem; }
.tpl-region--hero .tpl-slot--image,
.tpl-region--banner .tpl-slot--image,
.tpl-region--poster-hero .tpl-slot--image { margin: 0; }
.tpl-region--hero .tpl-slot-media,
.tpl-region--banner .tpl-slot-media { min-height: 220px; }
.tpl-page--cover .tpl-region--cover-text { text-align: center; padding: 0.5rem 1rem 1rem; }
.tpl-page--cover .tpl-region--hero .tpl-slot-media { min-height: 280px; }
.tpl-page--cover .tpl-slot-img { max-height: 420px; }

.tpl-page--feature {
  display: grid !important;
  grid-template-columns: 1.15fr 1fr !important;
  gap: 1.25rem;
  align-items: start;
}
.tpl-page--feature-right { grid-template-columns: 1fr 1.15fr !important; }
.tpl-page--feature .tpl-slot-media { min-height: 280px; }
.tpl-page--feature .tpl-slot-img { max-height: 420px; }

.tpl-region--cols2,
.tpl-region--row-media-copy,
.tpl-region--row-copy-media,
.tpl-region--lecture-body,
.tpl-page--profile,
.tpl-region--compare,
.tpl-region--steps3,
.tpl-region--gallery3,
.tpl-region--meta-row {
  display: grid !important;
  gap: 1rem;
  align-items: start;
}
.tpl-region--cols2,
.tpl-region--row-media-copy,
.tpl-region--row-copy-media,
.tpl-region--lecture-body { grid-template-columns: 1fr 1fr !important; }

.tpl-page--sidebar {
  display: grid !important;
  grid-template-columns: 1.7fr 0.9fr !important;
  gap: 1.5rem;
  align-items: start;
}
.tpl-region--aside {
  padding: 0.75rem;
  background: #f3f0e8;
  border-radius: 10px;
  border: 1px solid #e4dfd4;
}
.tpl-region--gallery3 { grid-template-columns: repeat(3, 1fr) !important; }
.tpl-region--gallery3 .tpl-slot-media { min-height: 110px; }
.tpl-region--gallery3 .tpl-slot-img { max-height: 160px; }

.tpl-page--profile { grid-template-columns: 0.85fr 1.35fr !important; }
.tpl-region--portrait .tpl-slot-media { min-height: 260px; }

.tpl-region--compare { grid-template-columns: 1fr 1fr !important; }
.tpl-region--steps3 { grid-template-columns: repeat(3, 1fr) !important; }
.tpl-panel, .tpl-step {
  padding: 0.65rem;
  border: 1px solid #e4dfd4;
  border-radius: 10px;
  background: #faf8f3;
}
.tpl-step-num {
  width: 28px; height: 28px; border-radius: 50%;
  background: #2c2c2c; color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.85rem; font-weight: 700; margin-bottom: 0.5rem;
}
.tpl-page--poster { text-align: center; gap: 1.1rem; }
.tpl-page--poster .tpl-slot--list { text-align: start; max-width: 28rem; margin: 0 auto; }
.tpl-region--poster-hero .tpl-slot-media { min-height: 180px; }
.tpl-region--callout {
  padding: 0.75rem 0.9rem;
  border-radius: 10px;
  background: #eef3fc;
  border: 1px solid #d5e2f7;
}
.tpl-region--meta-row { grid-template-columns: 1fr 1fr !important; }
.tpl-page--worksheet h2,
.tpl-page--lab h2,
.tpl-page--lecture h2 {
  font-size: 0.95rem;
  letter-spacing: 0.02em;
  color: #555;
  margin: 0.4rem 0 0.35rem;
}
</style>
</head>
<body>
${pdfBody}
</body>
</html>`;
  }

  function buildRtf(title, content) {
    const text = stripHtml(content).replace(/\\/g, "\\\\").replace(/{/g, "\\{").replace(/}/g, "\\}");
    const lines = text.split("\n").map((l) => l.replace(/\\/g, "\\\\"));
    const body = lines.join("\\par\n");
    return `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Calibri;}}\\f0\\fs24 {\\b ${title.replace(/\\/g, "")}}\\par\\par ${body}}`;
  }

  root.StudiesEditor = {
    createEditor,
    buildExportHtml,
    buildRtf,
    parseDocPages,
    serializeDocPages,
  };
})(window);