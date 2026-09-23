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

  function tt(key, fallback, vars) {
    const I = window.MySpaceI18n;
    const fb = fallback || key;
    const withVars = (s) => {
      if (!vars) return s;
      return String(s).replace(/\{(\w+)\}/g, (_, k) =>
        vars[k] != null ? String(vars[k]) : `{${k}}`
      );
    };
    if (!I?.t) return withVars(fb);
    const v = I.t(key, vars);
    return v === key ? withVars(fb) : v;
  }

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
      search.placeholder = tt("service.parts.filter", "Filter parts…");
    }
  }

  function paintCatalog() {
    const list = root.querySelector("#parts-panel-list");
    const meta = root.querySelector("#parts-panel-meta");
    if (!list) return;
    if (meta) meta.textContent = tt("service.parts.count", "{count} parts", { count: parts.length });

    if (!parts.length) {
      list.innerHTML = `<p class="parts-panel-empty">${escapeHtml(tt("service.parts.empty", "No parts yet. Add shared/parts/*/part.json or apps/*/parts.json."))}</p>`;
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
            <button type="button" data-open="${escapeHtml(p.id)}">${escapeHtml(tt("service.common.open", "Open"))}</button>
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
      list.innerHTML = `<p class="parts-panel-empty">${escapeHtml(tt("service.parts.selectPart", "Select a part from Catalog."))}</p>`;
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
      : `<p class="parts-panel-empty">${escapeHtml(tt("service.parts.noFiles", "No files readable."))}</p>`;

    const targetOpts = targets
      .map(
        (t) =>
          `<option value="${escapeHtml(t)}"${t === adoptTarget ? " selected" : ""}>${escapeHtml(t)}</option>`
      )
      .join("");

    const credit = p.publishedBy || p.origin || "shared";
    list.innerHTML = `
      <div class="parts-detail">
        <header class="parts-detail-head">
          <div>
            <h3>${escapeHtml(p.title)}</h3>
            <p class="parts-contract">${escapeHtml(p.contract)} · ${escapeHtml(p.kind)}</p>
            <p>${escapeHtml(p.summary || "")}</p>
          </div>
          <button type="button" data-back>${escapeHtml(tt("service.parts.backCatalog", "← Catalog"))}</button>
        </header>
        <p class="parts-note">${escapeHtml(tt("service.parts.creditNote", "Code is written to drop into other apps without host-app identifiers. Credit ({credit}) is optional.", { credit }))}</p>
        ${p.usage ? `<p class="parts-usage"><strong>${escapeHtml(tt("service.common.usage", "Usage"))}</strong> <code>${escapeHtml(p.usage)}</code></p>` : ""}
        ${apiRows ? `<ul class="parts-api">${apiRows}</ul>` : ""}
        <div class="parts-adopt">
          <label>${escapeHtml(tt("service.parts.adoptInto", "Adopt into app"))}
            <select id="parts-adopt-target">${targetOpts}</select>
          </label>
          <button type="button" class="parts-adopt-btn" data-adopt>${escapeHtml(tt("service.parts.copyFiles", "Copy files"))}</button>
          <button type="button" data-copy-usage>${escapeHtml(tt("service.parts.copyUsage", "Copy usage"))}</button>
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
        toast(res?.error || tt("service.parts.adoptFailed", "Adopt failed"));
        return;
      }
      toast(tt("service.parts.adoptedInto", "Adopted into {dest}", { dest: res.dest }));
    });
    list.querySelector("[data-copy-usage]")?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(p.usage || p.contract);
        toast(tt("service.common.copied", "Copied"));
      } catch {
        toast(tt("service.common.copyFailed", "Copy failed"));
      }
    });
  }

  function paintAbout() {
    const list = root.querySelector("#parts-panel-list");
    const meta = root.querySelector("#parts-panel-meta");
    if (meta) meta.textContent = tt("service.parts.linkSeries", "Link series");
    if (!list) return;
    list.innerHTML = `
      <div class="parts-about">
        <p>${escapeHtml(tt("service.parts.aboutP1", "Parts is a catalog of embeddable modules: search helpers, UI fragments, data utilities, that apps can publish and others can copy in."))}</p>
        <p>${escapeHtml(tt("service.parts.aboutP2", "Unlike MSL (live capability calls) and Pulse (messages), Parts is about reusable code written without host-app coupling so it drops cleanly into new or existing apps."))}</p>
        <ul>
          <li><code>${escapeHtml(tt("service.parts.aboutLi1", "Shared library: shared/parts/<id>/"))}</code></li>
          <li><code>${escapeHtml(tt("service.parts.aboutLi2", "App credit (optional): apps/<app>/parts.json"))}</code></li>
          <li><code>${escapeHtml(tt("service.parts.aboutLi3", "Adopt copies files to apps/<target>/parts/<id>/"))}</code></li>
          <li><code>${escapeHtml(tt("service.parts.aboutLi4", "Shell: parts(list) · parts(get search.fuzzy) · parts(adopt search.fuzzy into notes)"))}</code></li>
        </ul>
      </div>`;
  }

  function repaintChrome() {
    if (!root) return;
    root.setAttribute("aria-label", tt("platform.parts.name", "Parts"));
    const brand = root.querySelector(".parts-panel-brand div");
    if (brand) {
      const h2 = brand.querySelector("h2");
      const p = brand.querySelector("p");
      if (h2) h2.textContent = tt("platform.parts.name", "Parts");
      if (p) p.textContent = tt("platform.parts.tagline", "Link — embeddable modules for other apps");
    }
    root.querySelector(".parts-panel-close")?.setAttribute("aria-label", tt("service.common.close", "Close"));
    const expandBtn = root.querySelector("#parts-panel-expand");
    if (expandBtn) {
      const expanded = root.querySelector(".parts-panel-shell")?.classList.contains("is-expanded");
      expandBtn.title = expanded
        ? tt("service.common.restore", "Restore panel size")
        : tt("service.common.expand", "Expand panel");
      expandBtn.setAttribute("aria-label", expandBtn.title);
    }
    const catalogBtn = root.querySelector('[data-parts-tab="catalog"]');
    const aboutBtn = root.querySelector('[data-parts-tab="about"]');
    if (catalogBtn) catalogBtn.textContent = tt("service.parts.catalog", "Catalog");
    if (aboutBtn) aboutBtn.textContent = tt("service.common.about", "About");
    const search = root.querySelector("#parts-panel-search");
    if (search) search.placeholder = tt("service.parts.filter", "Filter parts…");
    const foot = root.querySelector(".parts-panel-foot span");
    if (foot) foot.textContent = tt("service.parts.shellHint", "Shell: parts(panel) · parts(list) · parts(adopt … into <app>)");
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
    root.setAttribute("aria-label", tt("platform.parts.name", "Parts"));
    root.innerHTML = `
      <div class="parts-panel-shell">
        <header class="parts-panel-head">
          <div class="parts-panel-brand">
            <img src="brand/atom-violet.png" alt="" width="28" height="28" />
            <div>
              <h2>${escapeHtml(tt("platform.parts.name", "Parts"))}</h2>
              <p>${escapeHtml(tt("platform.parts.tagline", "Link — embeddable modules for other apps"))}</p>
            </div>
          </div>
          <button type="button" class="parts-panel-expand" id="parts-panel-expand" title="${escapeHtml(tt("service.common.expand", "Expand panel"))}" aria-label="${escapeHtml(tt("service.common.expand", "Expand panel"))}">⤢</button>
          <button type="button" class="parts-panel-close" aria-label="${escapeHtml(tt("service.common.close", "Close"))}">×</button>
        </header>
        <div class="parts-panel-toolbar">
          <div class="parts-panel-tabs">
            <button type="button" data-parts-tab="catalog" class="is-active">${escapeHtml(tt("service.parts.catalog", "Catalog"))}</button>
            <button type="button" data-parts-tab="about">${escapeHtml(tt("service.common.about", "About"))}</button>
          </div>
          <input id="parts-panel-search" type="search" placeholder="${escapeHtml(tt("service.parts.filter", "Filter parts…"))}" spellcheck="false" />
          <span id="parts-panel-meta" class="parts-panel-meta"></span>
        </div>
        <div class="parts-panel-list" id="parts-panel-list"></div>
        <footer class="parts-panel-foot">
          <span>${escapeHtml(tt("service.parts.shellHint", "Shell: parts(panel) · parts(list) · parts(adopt … into <app>)"))}</span>
        </footer>
      </div>`;

    root.querySelector(".parts-panel-close").addEventListener("click", hide);
    root.querySelector("#parts-panel-expand")?.addEventListener("click", () => {
      const shell = root.querySelector(".parts-panel-shell");
      const btn = root.querySelector("#parts-panel-expand");
      const on = shell?.classList.toggle("is-expanded");
      if (btn) {
        btn.title = on ? tt("service.common.restore", "Restore panel size") : tt("service.common.expand", "Expand panel");
        btn.setAttribute("aria-label", btn.title);
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

  window.addEventListener("myspace-i18n-applied", () => {
    if (!open || !root) return;
    repaintChrome();
    paint();
  });

  window.MySpacePartsPanel = {
    show,
    hide,
    toggle,
    isOpen: () => open,
    refresh,
  };
})();