(function () {
  let root = null;
  let open = false;
  let tab = "catalog";
  let parts = [];
  let targets = [];
  let filter = "";
  let selectedId = "";
  let detail = null;
  let adoptTarget = "";

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toast(msg) {
    window.showMySpaceToast?.(msg);
  }

  async function refresh() {
    const [listRes, targetsRes] = await Promise.all([
      window.mySpace?.parts?.list?.({ q: filter }),
      window.mySpace?.parts?.targets?.(),
    ]);
    parts = listRes?.ok ? listRes.parts || [] : [];
    targets = targetsRes?.ok ? targetsRes.apps || [] : [];
    if (!adoptTarget && targets.length) adoptTarget = targets[0];
    if (selectedId) {
      const got = await window.mySpace?.parts?.get?.({ id: selectedId });
      detail = got?.ok ? got : null;
    } else {
      detail = null;
    }
    paint();
  }

  function paintTabs() {
    root.querySelectorAll("[data-parts-tab]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.partsTab === tab);
    });
    const search = root.querySelector("#parts-panel-search");
    if (search) {
      search.classList.toggle("is-hidden", tab !== "catalog");
      search.value = filter;
      search.placeholder = "Filter parts…";
    }
  }

  function paintCatalog() {
    const list = root.querySelector("#parts-panel-list");
    const meta = root.querySelector("#parts-panel-meta");
    if (!list) return;
    if (meta) meta.textContent = `${parts.length} parts`;

    if (!parts.length) {
      list.innerHTML = `<p class="parts-panel-empty">No parts yet. Add shared/parts/*/part.json or apps/*/parts.json.</p>`;
      return;
    }

    list.innerHTML = parts
      .map((p) => {
        const on = p.id === selectedId ? " is-selected" : "";
        const tags = (p.tags || []).slice(0, 4).map((t) => `<em>${escapeHtml(t)}</em>`).join(" ");
        return `<article class="parts-panel-row${on}" data-part-id="${escapeHtml(p.id)}">
          <div>
            <strong>${escapeHtml(p.title)}</strong>
            <span class="parts-contract">${escapeHtml(p.contract)}</span>
            <span>${escapeHtml(p.summary || "")}</span>
            <div class="parts-tags"><em>${escapeHtml(p.kind)}</em>${tags}</div>
          </div>
          <div class="parts-panel-row-actions">
            <button type="button" data-open="${escapeHtml(p.id)}">Open</button>
          </div>
        </article>`;
      })
      .join("");

    list.querySelectorAll("[data-open]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        selectedId = btn.dataset.open;
        tab = "detail";
        void refresh();
      });
    });
    list.querySelectorAll("[data-part-id]").forEach((row) => {
      row.addEventListener("click", () => {
        selectedId = row.dataset.partId;
        tab = "detail";
        void refresh();
      });
    });
  }

  function paintDetail() {
    const list = root.querySelector("#parts-panel-list");
    const meta = root.querySelector("#parts-panel-meta");
    if (!list) return;
    const p = detail?.part;
    if (!p) {
      list.innerHTML = `<p class="parts-panel-empty">Select a part from Catalog.</p>`;
      if (meta) meta.textContent = "";
      return;
    }
    if (meta) meta.textContent = p.contract;

    const apiRows = Object.entries(p.api || {})
      .map(([k, v]) => `<li><code>${escapeHtml(k)}</code> — ${escapeHtml(v)}</li>`)
      .join("");
    const fileNames = Object.keys(detail.files || {});
    const filesHtml = fileNames.length
      ? fileNames
          .map(
            (name) =>
              `<details class="parts-file"><summary>${escapeHtml(name)}</summary><pre>${escapeHtml(
                detail.files[name] || ""
              )}</pre></details>`
          )
          .join("")
      : `<p class="parts-panel-empty">No files readable.</p>`;

    const targetOpts = targets
      .map(
        (t) =>
          `<option value="${escapeHtml(t)}"${t === adoptTarget ? " selected" : ""}>${escapeHtml(t)}</option>`
      )
      .join("");

    list.innerHTML = `
      <div class="parts-detail">
        <header class="parts-detail-head">
          <div>
            <h3>${escapeHtml(p.title)}</h3>
            <p class="parts-contract">${escapeHtml(p.contract)} · ${escapeHtml(p.kind)}</p>
            <p>${escapeHtml(p.summary || "")}</p>
          </div>
          <button type="button" data-back>← Catalog</button>
        </header>
        <p class="parts-note">Code is written to drop into other apps without host-app identifiers. Credit (${escapeHtml(
          p.publishedBy || p.origin || "shared"
        )}) is optional.</p>
        ${p.usage ? `<p class="parts-usage"><strong>Usage</strong> <code>${escapeHtml(p.usage)}</code></p>` : ""}
        ${apiRows ? `<ul class="parts-api">${apiRows}</ul>` : ""}
        <div class="parts-adopt">
          <label>Adopt into app
            <select id="parts-adopt-target">${targetOpts}</select>
          </label>
          <button type="button" class="parts-adopt-btn" data-adopt>Copy files</button>
          <button type="button" data-copy-usage>Copy usage</button>
        </div>
        <div class="parts-files">${filesHtml}</div>
      </div>`;

    list.querySelector("[data-back]")?.addEventListener("click", () => {
      tab = "catalog";
      selectedId = "";
      detail = null;
      paint();
    });
    list.querySelector("#parts-adopt-target")?.addEventListener("change", (e) => {
      adoptTarget = e.target.value;
    });
    list.querySelector("[data-adopt]")?.addEventListener("click", async () => {
      const target = adoptTarget || list.querySelector("#parts-adopt-target")?.value;
      const res = await window.mySpace?.parts?.adopt?.({ id: p.id, target });
      if (!res?.ok) {
        toast(res?.error || "Adopt failed");
        return;
      }
      toast(`Adopted into ${res.dest}`);
    });
    list.querySelector("[data-copy-usage]")?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(p.usage || p.contract);
        toast("Copied");
      } catch {
        toast("Copy failed");
      }
    });
  }

  function paintAbout() {
    const list = root.querySelector("#parts-panel-list");
    const meta = root.querySelector("#parts-panel-meta");
    if (meta) meta.textContent = "Link series";
    if (!list) return;
    list.innerHTML = `
      <div class="parts-about">
        <p><strong>Parts</strong> is a catalog of embeddable modules: search helpers, UI fragments, data utilities, that apps can publish and others can copy in.</p>
        <p>Unlike <strong>MSL</strong> (live capability calls) and <strong>Pulse</strong> (messages), Parts is about <em>reusable code</em> written without host-app coupling so it drops cleanly into new or existing apps.</p>
        <ul>
          <li>Shared library: <code>shared/parts/&lt;id&gt;/</code></li>
          <li>App credit (optional): <code>apps/&lt;app&gt;/parts.json</code></li>
          <li>Adopt copies files to <code>apps/&lt;target&gt;/parts/&lt;id&gt;/</code></li>
          <li>Shell: <code>parts(list)</code> · <code>parts(get search.fuzzy)</code> · <code>parts(adopt search.fuzzy into notes)</code></li>
        </ul>
      </div>`;
  }

  function paint() {
    if (!root) return;
    paintTabs();
    if (tab === "catalog") paintCatalog();
    else if (tab === "detail") paintDetail();
    else paintAbout();
  }

  function ensure() {
    if (root) return root;
    root = document.createElement("div");
    root.className = "parts-panel hidden";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Parts");
    root.innerHTML = `
      <div class="parts-panel-shell">
        <header class="parts-panel-head">
          <div class="parts-panel-brand">
            <img src="brand/atom-violet.png" alt="" width="28" height="28" />
            <div>
              <h2>Parts</h2>
              <p>Link — embeddable modules for other apps</p>
            </div>
          </div>
          <button type="button" class="parts-panel-expand" id="parts-panel-expand" title="Expand panel" aria-label="Expand">⤢</button>
          <button type="button" class="parts-panel-close" aria-label="Close">×</button>
        </header>
        <div class="parts-panel-toolbar">
          <div class="parts-panel-tabs">
            <button type="button" data-parts-tab="catalog" class="is-active">Catalog</button>
            <button type="button" data-parts-tab="about">About</button>
          </div>
          <input id="parts-panel-search" type="search" placeholder="Filter parts…" spellcheck="false" />
          <span id="parts-panel-meta" class="parts-panel-meta"></span>
        </div>
        <div class="parts-panel-list" id="parts-panel-list"></div>
        <footer class="parts-panel-foot">
          <span>Shell: parts(panel) · parts(list) · parts(adopt … into &lt;app&gt;)</span>
        </footer>
      </div>`;

    root.querySelector(".parts-panel-close").addEventListener("click", hide);
    root.querySelector("#parts-panel-expand")?.addEventListener("click", () => {
      const shell = root.querySelector(".parts-panel-shell");
      const btn = root.querySelector("#parts-panel-expand");
      const on = shell?.classList.toggle("is-expanded");
      if (btn) {
        btn.title = on ? "Restore panel size" : "Expand panel";
        btn.textContent = on ? "⤡" : "⤢";
      }
    });
    root.addEventListener("click", (e) => {
      if (e.target === root) hide();
    });
    root.querySelectorAll("[data-parts-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        tab = btn.dataset.partsTab;
        if (tab === "catalog") selectedId = "";
        void refresh();
      });
    });
    root.querySelector("#parts-panel-search")?.addEventListener("input", (e) => {
      filter = e.target.value || "";
      void refresh();
    });
    document.body.appendChild(root);
    return root;
  }

  async function show(initial) {
    if (window.MySpaceParts?.open) {
      const page =
        initial === "about"
          ? "about"
          : initial && initial !== "catalog" && initial !== "explore"
            ? "explore"
            : "explore";
      const id =
        initial && !["about", "catalog", "explore", "panel"].includes(String(initial))
          ? String(initial)
          : undefined;
      await window.MySpaceParts.open({ page: id ? "explore" : page, id, part: id });
      return;
    }

    ensure();
    open = true;
    if (initial === "about") tab = "about";
    else if (initial && typeof initial === "string" && initial !== "catalog") {
      selectedId = initial;
      tab = "detail";
    } else {
      tab = "catalog";
    }
    root.classList.remove("hidden");
    await refresh();
    if (tab === "catalog") root.querySelector("#parts-panel-search")?.focus();
  }

  function hide() {
    open = false;
    root?.classList.add("hidden");
  }

  function toggle() {
    if (open) hide();
    else void show();
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) hide();
  });

  window.MySpacePartsPanel = {
    show,
    hide,
    toggle,
    isOpen: () => open,
    refresh,
  };
})();