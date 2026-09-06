(function () {
  let root = null;
  let open = false;
  let activeId = "overview";
  let filter = "";
  let catalog = null;

  function ensureRoot() {
    if (root) return root;
    root = document.createElement("div");
    root.id = "shell-atlas";
    root.className = "shell-atlas hidden";
    root.innerHTML = `
      <aside class="shell-atlas-side">
        <div class="shell-atlas-brand">
          <img src="brand/atom-cyan.png" width="32" height="32" alt="" />
          <div>
            <strong>Shell</strong>
            <span>Language atlas</span>
          </div>
        </div>
        <div class="shell-atlas-search-wrap">
          <input type="search" class="shell-atlas-search" id="shell-atlas-search"
            placeholder="Search language operations…" spellcheck="false" />
        </div>
        <nav class="shell-atlas-nav" id="shell-atlas-nav" aria-label="Shell atlas"></nav>
      </aside>
      <main class="shell-atlas-main">
        <header class="shell-atlas-top">
          <div>
            <h1 id="shell-atlas-title">Shell</h1>
            <p class="lede" id="shell-atlas-lede">Map of My Space Language: grammar and live operations.</p>
          </div>
          <button type="button" class="shell-atlas-close" id="shell-atlas-close">Close</button>
        </header>
        <div class="shell-atlas-body" id="shell-atlas-body"></div>
      </main>`;
    document.body.appendChild(root);

    root.querySelector("#shell-atlas-close")?.addEventListener("click", hide);
    root.querySelector("#shell-atlas-search")?.addEventListener("input", (e) => {
      filter = String(e.target.value || "").trim().toLowerCase();
      paintNav();
    });
    root.querySelector("#shell-atlas-nav")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-entry]");
      if (!btn) return;
      activeId = btn.dataset.entry;
      paint();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && open) hide();
    });
    return root;
  }

  function loadCatalog() {
    catalog = window.MySpaceShellCatalog?.getShellCatalog?.() || {
      entries: [],
      modules: [],
      moduleCount: 0,
    };
  }

  function filteredEntries() {
    const entries = catalog?.entries || [];
    if (!filter) return entries;
    return entries.filter((e) => (e.searchText || e.title || e.id || "").includes(filter));
  }

  function paintNav() {
    const nav = root?.querySelector("#shell-atlas-nav");
    if (!nav) return;
    const entries = filteredEntries();

    function block(label, list) {
      if (!list.length) return "";
      return `<p class="shell-atlas-nav-label">${label}</p>${list
        .map(
          (e) => `<button type="button" class="shell-atlas-nav-item${
            e.id === activeId ? " is-active" : ""
          }" data-entry="${escapeHtml(e.id)}">
            ${escapeHtml(e.title)}
            ${e.alias && e.kind === "module" ? `<span class="muted">${escapeHtml(e.alias)}(…)</span>` : ""}
          </button>`
        )
        .join("")}`;
    }

    const start = entries.filter((e) => e.id === "overview" || e.id === "shell" || e.id === "modules");
    const langCore = entries.filter((e) => e.id === "language" || e.id === "core");
    const platform = entries.filter((e) => e.group === "platform" && e.id !== "shell");
    const apps = entries.filter((e) => e.group === "apps");

    nav.innerHTML =
      block("Start", start) +
      block("Language & core", langCore) +
      block("Platform services", platform) +
      block(`Apps (${apps.length})`, apps);

    if (!entries.length) {
      nav.innerHTML = `<p class="shell-atlas-empty" style="padding:0.75rem">No matches.</p>`;
    }
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function paintBody(entry) {
    const body = root?.querySelector("#shell-atlas-body");
    const title = root?.querySelector("#shell-atlas-title");
    const lede = root?.querySelector("#shell-atlas-lede");
    if (!body || !entry) {
      if (body) body.innerHTML = `<p class="shell-atlas-empty">Select a topic.</p>`;
      return;
    }
    if (title) title.textContent = entry.title;
    if (lede) {
      lede.textContent =
        entry.kind === "module"
          ? `Shell module · primary call ${entry.alias}(…) · live registry`
          : entry.kind === "language"
            ? "Variables, functions, flow, chaining, aliases & when-rules"
            : entry.kind === "core"
              ? "Desktop verbs, discovery, backup, and pack"
              : `${catalog?.moduleCount || 0} modules. generated from the live shell`;
    }

    const chips = [];
    if (entry.alias) chips.push(entry.alias);
    (entry.aliases || []).forEach((a) => {
      if (a !== entry.alias) chips.push(a);
    });
    const chipHtml = chips.length
      ? `<div class="shell-atlas-meta">${chips
          .map((c) => `<span class="shell-atlas-chip">${escapeHtml(c)}</span>`)
          .join("")}</div>`
      : "";

    body.innerHTML =
      chipHtml +
      (entry.sections || [])
        .map((sec) => {
          const paras = (sec.paragraphs || [])
            .filter(Boolean)
            .map((p) => `<p>${escapeHtml(p)}</p>`)
            .join("");
          const items = (sec.items || []).length
            ? `<ul>${sec.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`
            : "";
          return `<section class="shell-atlas-section">
            <h2>${escapeHtml(sec.heading)}</h2>
            ${paras}
            ${items}
          </section>`;
        })
        .join("");
  }

  function paint() {
    paintNav();
    const entries = catalog?.entries || [];
    let entry = entries.find((e) => e.id === activeId);
    if (!entry) {
      const filtered = filteredEntries();
      entry = filtered[0] || entries[0];
      if (entry) activeId = entry.id;
    }
    paintBody(entry);
  }

  function show(route) {
    ensureRoot();
    loadCatalog();
    const raw = String(route?.page || route?.tab || route?.id || "overview")
      .toLowerCase()
      .trim();
    const alias = {
      home: "overview",
      open: "overview",
      panel: "overview",
      runner: "overview",
      reference: "overview",
      help: "overview",
      lang: "language",
      grammar: "language",
      apps: "modules",
      aliases: "language",
      macros: "language",
      when: "language",
      history: "language",
      console: "shell",
    };
    activeId = alias[raw] || raw;
    filter = "";
    const search = root.querySelector("#shell-atlas-search");
    if (search) search.value = "";
    root.classList.remove("hidden");
    open = true;
    paint();
    search?.focus();
  }

  function hide() {
    if (!root) return;
    root.classList.add("hidden");
    open = false;
  }

  function toggle(route) {
    if (open) hide();
    else show(route);
  }

  window.MySpaceShellAtlas = {
    open: show,
    show,
    hide,
    toggle,
    isOpen: () => open,
    refresh: () => {
      if (!open) return;
      loadCatalog();
      paint();
    },
  };
})();