(() => {
  const groups = window.DOCS_GROUPS || [];
  const pages = window.DOCS_PAGES || {};
  const pageList = window.DOCS_PAGE_LIST || [];

  const ui = {
    groupNav: document.getElementById("group-nav"),
    search: document.getElementById("docs-search"),
    article: document.getElementById("article"),
    toc: document.getElementById("toc"),
    stage: document.getElementById("stage"),
    results: document.getElementById("search-results"),
    crumbs: document.getElementById("crumbs"),
    meta: document.getElementById("sidebar-meta"),
    btnPrev: document.getElementById("btn-prev"),
    btnNext: document.getElementById("btn-next"),
    btnBookmark: document.getElementById("btn-bookmark"),
    btnCopy: document.getElementById("btn-copy"),
    btnBookmarks: document.getElementById("btn-bookmarks"),
  };

  let state = {
    pageId: "overview",
    collapsed: {},
    bookmarks: [],
    query: "",
  };

  const invoke = (channel, args) => {
    try {
      return window.myApp?.invoke?.(channel, args || {}) || Promise.resolve({ ok: false });
    } catch {
      return Promise.resolve({ ok: false });
    }
  };

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function groupById(id) {
    return groups.find((g) => g.id === id) || null;
  }

  function orderedPageIds() {
    const ids = [];
    groups.forEach((g) => g.pages.forEach((pid) => ids.push(pid)));
    return ids.filter((id) => pages[id]);
  }

  function renderNav() {
    ui.groupNav.innerHTML = groups
      .map((g) => {
        const collapsed = state.collapsed[g.id] ? " collapsed" : "";
        const links = g.pages
          .filter((pid) => pages[pid])
          .map((pid) => {
            const pg = pages[pid];
            const active = pid === state.pageId && !state.query ? " active" : "";
            return `<button type="button" class="page-link${active}" data-page="${escapeHtml(
              pid
            )}">${escapeHtml(pg.title)}</button>`;
          })
          .join("");
        return `<div class="group${collapsed}" data-group="${escapeHtml(g.id)}">
          <button type="button" class="group-label" data-toggle-group="${escapeHtml(g.id)}">
            <span class="g-ico" aria-hidden="true">${escapeHtml(g.icon)}</span>
            <span>${escapeHtml(g.label)}</span>
            <span class="g-count">${g.pages.length}</span>
          </button>
          <div class="group-pages">${links}</div>
        </div>`;
      })
      .join("");

    ui.meta.textContent = `${pageList.length} pages · ${groups.length} categories`;
  }

  function renderBlock(block, idx) {
    if (!block) return "";
    if (block.type === "kicker") {
      return `<div class="article-kicker">${escapeHtml(block.text)}</div>`;
    }
    if (block.type === "h2") {
      const id = `h-${idx}`;
      return `<h2 class="block-h2" id="${id}">${escapeHtml(block.text)}</h2>`;
    }
    if (block.type === "p") {
      return `<p class="block-p">${escapeHtml(block.text)}</p>`;
    }
    if (block.type === "ul") {
      return `<ul class="block-ul">${(block.items || [])
        .map((i) => `<li>${escapeHtml(i)}</li>`)
        .join("")}</ul>`;
    }
    if (block.type === "ol") {
      return `<ol class="block-ol">${(block.items || [])
        .map((i) => `<li>${escapeHtml(i)}</li>`)
        .join("")}</ol>`;
    }
    if (block.type === "code") {
      return `<pre class="block-code"><code>${escapeHtml(
        (block.lines || []).join("\n")
      )}</code></pre>`;
    }
    if (block.type === "callout") {
      const label =
        block.tone === "tip" ? "Tip" : block.tone === "warn" ? "Watch out" : "Note";
      return `<div class="callout ${escapeHtml(block.tone || "note")}"><strong>${label}</strong>${escapeHtml(
        block.text
      )}</div>`;
    }
    if (block.type === "table") {
      const head = (block.headers || [])
        .map((h) => `<th>${escapeHtml(h)}</th>`)
        .join("");
      const body = (block.rows || [])
        .map(
          (row) =>
            `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`
        )
        .join("");
      return `<table class="block-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
    }
    return "";
  }

  function renderToc(page) {
    const heads = (page.blocks || []).filter((b) => b.type === "h2");
    if (!heads.length) {
      ui.toc.innerHTML = `<h4>On this page</h4><p style="color:var(--ink-faint);font-size:0.8rem;margin:0">No sections</p>`;
      return;
    }
    ui.toc.innerHTML = `<h4>On this page</h4>${heads
      .map((h, i) => {
        const idx = (page.blocks || []).indexOf(h);
        return `<a href="#h-${idx}" data-toc="${idx}">${escapeHtml(h.text)}</a>`;
      })
      .join("")}`;
  }

  function renderCrumbs(page) {
    const g = groupById(page.group);
    ui.crumbs.innerHTML = `
      <span>${escapeHtml(g?.label || "Docs")}</span>
      <span class="sep">/</span>
      <strong>${escapeHtml(page.title)}</strong>
    `;
  }

  function updateBookmarkBtn() {
    const on = state.bookmarks.includes(state.pageId);
    ui.btnBookmark.textContent = on ? "★" : "☆";
    ui.btnBookmark.title = on ? "Remove bookmark" : "Bookmark";
  }

  function showArticle() {
    ui.results.classList.add("hidden");
    ui.stage.classList.remove("hidden");
    const page = pages[state.pageId] || pages.overview;
    if (!page) return;

    const tags = (page.tags || [])
      .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
      .join("");

    const body = (page.blocks || []).map((b, i) => renderBlock(b, i)).join("");

    ui.article.innerHTML = `
      <h1 class="article-title">${escapeHtml(page.title)}</h1>
      <p class="article-sub">${escapeHtml(page.subtitle || "")}</p>
      <div class="article-tags">${tags}</div>
      ${body}
    `;

    renderToc(page);
    renderCrumbs(page);
    updateBookmarkBtn();
    renderNav();
    ui.article.scrollTop = 0;
  }

  function pageSearchBlob(page) {
    const parts = [page.title, page.subtitle, ...(page.tags || [])];
    (page.blocks || []).forEach((b) => {
      if (b.text) parts.push(b.text);
      if (b.lines) parts.push(b.lines.join(" "));
      if (b.items) parts.push(b.items.join(" "));
      if (b.headers) parts.push(b.headers.join(" "));
      if (b.rows) b.rows.forEach((r) => parts.push(r.join(" ")));
    });
    return parts.join(" ").toLowerCase();
  }

  function runSearch(q) {
    const query = String(q || "").trim().toLowerCase();
    state.query = query;
    if (!query) {
      showArticle();
      return;
    }

    const hits = pageList
      .map((page) => {
        const blob = pageSearchBlob(page);
        const score =
          (page.title.toLowerCase().includes(query) ? 5 : 0) +
          (page.subtitle?.toLowerCase().includes(query) ? 2 : 0) +
          (blob.includes(query) ? 1 : 0);
        return { page, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.page.title.localeCompare(b.page.title));

    ui.stage.classList.add("hidden");
    ui.results.classList.remove("hidden");
    ui.crumbs.innerHTML = `<strong>Search</strong><span class="sep">/</span><span>${escapeHtml(
      query
    )}</span>`;

    if (!hits.length) {
      ui.results.innerHTML = `<h2>No results</h2><p class="block-p">Nothing matched “${escapeHtml(
        query
      )}”.</p>`;
      return;
    }

    ui.results.innerHTML = `<h2>${hits.length} result${hits.length === 1 ? "" : "s"}</h2>${hits
      .map(({ page }) => {
        const g = groupById(page.group);
        return `<button type="button" class="result-card" data-page="${escapeHtml(page.id)}">
          <div class="r-group">${escapeHtml(g?.label || "")}</div>
          <div class="r-title">${escapeHtml(page.title)}</div>
          <div class="r-sub">${escapeHtml(page.subtitle || "")}</div>
        </button>`;
      })
      .join("")}`;
  }

  async function openPage(id, { persist = true } = {}) {
    if (!pages[id]) id = "overview";
    state.pageId = id;
    state.query = "";
    ui.search.value = "";
    const g = groupById(pages[id].group);
    if (g) state.collapsed[g.id] = false;
    showArticle();
    if (persist) {
      await invoke("page.open", { id });
    }
  }

  function neighbor(delta) {
    const ids = orderedPageIds();
    const i = ids.indexOf(state.pageId);
    if (i < 0) return;
    const next = ids[i + delta];
    if (next) openPage(next);
  }

  ui.groupNav.addEventListener("click", (e) => {
    const toggle = e.target.closest("[data-toggle-group]");
    if (toggle) {
      const gid = toggle.getAttribute("data-toggle-group");
      state.collapsed[gid] = !state.collapsed[gid];
      renderNav();
      return;
    }
    const link = e.target.closest("[data-page]");
    if (link) openPage(link.getAttribute("data-page"));
  });

  ui.results.addEventListener("click", (e) => {
    const card = e.target.closest("[data-page]");
    if (card) openPage(card.getAttribute("data-page"));
  });

  ui.search.addEventListener("input", () => {
    const q = ui.search.value;
    if (!q.trim()) {
      state.query = "";
      showArticle();
      return;
    }
    runSearch(q);
  });

  ui.search.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      ui.search.value = "";
      state.query = "";
      showArticle();
    }
  });

  ui.btnPrev.addEventListener("click", () => neighbor(-1));
  ui.btnNext.addEventListener("click", () => neighbor(1));

  ui.btnCopy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(state.pageId);
      ui.btnCopy.textContent = "Copied";
      setTimeout(() => {
        ui.btnCopy.textContent = "Copy id";
      }, 1200);
    } catch {
    }
  });

  ui.btnBookmark.addEventListener("click", async () => {
    const res = await invoke("bookmarks.toggle", { id: state.pageId });
    if (res?.ok && res.data) {
      state.bookmarks = res.data.bookmarks || [];
      updateBookmarkBtn();
    }
  });

  ui.btnBookmarks.addEventListener("click", () => {
    if (!state.bookmarks.length) {
      ui.search.value = "";
      runSearch(" ");
      ui.stage.classList.add("hidden");
      ui.results.classList.remove("hidden");
      ui.results.innerHTML = `<h2>Bookmarks</h2><p class="block-p">No bookmarks yet. open a page and press ★.</p>`;
      ui.crumbs.innerHTML = `<strong>Bookmarks</strong>`;
      return;
    }
    ui.stage.classList.add("hidden");
    ui.results.classList.remove("hidden");
    ui.crumbs.innerHTML = `<strong>Bookmarks</strong>`;
    ui.results.innerHTML = `<h2>Bookmarks</h2>${state.bookmarks
      .map((id) => {
        const page = pages[id];
        if (!page) return "";
        const g = groupById(page.group);
        return `<button type="button" class="result-card" data-page="${escapeHtml(id)}">
          <div class="r-group">${escapeHtml(g?.label || "")}</div>
          <div class="r-title">${escapeHtml(page.title)}</div>
          <div class="r-sub">${escapeHtml(page.subtitle || "")}</div>
        </button>`;
      })
      .join("")}`;
  });

  function setPage(pageId) {
    openPage(pageId || "overview");
  }

  window.DocsApp = {
    setPage,
    setActivePage: setPage,
    openPage: setPage,
    search: (q) => {
      ui.search.value = String(q || "");
      runSearch(ui.search.value);
    },
    showBookmarks: () => {
      ui.btnBookmarks.click();
    },
  };

  async function boot() {
    groups.forEach((g) => {
      state.collapsed[g.id] = g.id !== "start";
    });

    const loaded = await invoke("storage.load");
    if (loaded?.ok && loaded.data) {
      state.bookmarks = loaded.data.bookmarks || [];
      if (loaded.data.lastPageId && pages[loaded.data.lastPageId]) {
        state.pageId = loaded.data.lastPageId;
      }
    }

    const g = groupById(pages[state.pageId]?.group);
    if (g) state.collapsed[g.id] = false;

    renderNav();
    showArticle();
  }

  boot();
})();
