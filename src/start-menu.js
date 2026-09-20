(function () {
  let panel = null;
  let searchInput = null;
  let listEl = null;
  let visible = false;
  let handlers = null;
  let anchorEl = null;

  function tt(key, fallback, vars) {
    const I = window.MySpaceI18n;
    const fill = (s) => {
      if (!vars || typeof s !== "string") return s;
      return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
    };
    if (!I?.t) return fill(fallback || key);
    const v = I.t(key, vars);
    return v === key ? fill(fallback || key) : v;
  }

  function applyChrome() {
    if (!panel) return;
    panel.setAttribute("aria-label", tt("shell.start.aria", "Start menu"));
    if (searchInput) {
      searchInput.placeholder = tt("shell.start.search", "Search apps…");
    }
    const addBtn = panel.querySelector('[data-action="add"]');
    const settingsBtn = panel.querySelector('[data-action="settings"]');
    if (addBtn) addBtn.textContent = tt("shell.start.addShortcut", "Add shortcut…");
    if (settingsBtn) settingsBtn.textContent = tt("shell.start.settings", "Settings");
  }

  function ensurePanel() {
    if (panel) return panel;
    panel = document.createElement("div");
    panel.className = "start-menu hidden";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", tt("shell.start.aria", "Start menu"));
    panel.innerHTML = `
      <div class="start-menu-head">
        <span class="start-menu-logo" aria-hidden="true">⊞</span>
        <div class="start-menu-search-wrap">
          <input type="search" class="start-menu-search" placeholder="" autocomplete="off" spellcheck="false" />
        </div>
      </div>
      <div class="start-menu-list" role="listbox"></div>
      <footer class="start-menu-foot">
        <button type="button" class="start-menu-foot-btn" data-action="add"></button>
        <button type="button" class="start-menu-foot-btn" data-action="settings"></button>
      </footer>`;

    searchInput = panel.querySelector(".start-menu-search");
    listEl = panel.querySelector(".start-menu-list");
    applyChrome();

    searchInput.addEventListener("input", () => renderList(searchInput.value));
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        listEl.querySelector(".start-menu-item")?.focus();
      }
    });

    panel.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        close();
        if (action === "add") handlers?.onAdd?.();
        if (action === "settings") handlers?.onSettings?.();
      });
    });

    document.body.appendChild(panel);
    return panel;
  }

  function emojiFor(app) {
    if (app.icon && !String(app.icon).startsWith("http") && !String(app.icon).startsWith("data:")) {
      return app.icon;
    }
    return window.MySpaceIcons?.emojiFallback(app) || "📦";
  }

  function renderList(query) {
    const q = String(query || "").trim().toLowerCase();
    const apps = (window.MySpaceConfig?.getApps() || []).filter((app) => {
      if (app.id === "welcome") return false;
      if (app.hidden) return false;
      if (!q) return true;
      const hay = [app.name, app.description, app.type].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });

    if (!apps.length) {
      const msg = tt("shell.start.empty", 'No apps match "{q}"', { q: query || "" });
      listEl.innerHTML = `<p class="start-menu-empty">${msg}</p>`;
      return;
    }

    listEl.innerHTML = apps
      .map(
        (app) => `<button type="button" class="start-menu-item" data-app-id="${app.id}">
          <span class="start-menu-item-icon">${emojiFor(app)}</span>
          <span class="start-menu-item-text">
            <strong>${app.name}</strong>
            <span>${app.description || app.type || ""}</span>
          </span>
        </button>`
      )
      .join("");

    listEl.querySelectorAll(".start-menu-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const app = apps.find((a) => a.id === btn.dataset.appId);
        close();
        if (app) handlers?.onLaunch?.(app);
      });
    });
  }

  function positionPanel() {
    if (!panel || !anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    panel.style.left = `${Math.max(8, rect.left)}px`;
    panel.style.bottom = `${window.innerHeight - rect.top + 8}px`;
    panel.style.top = "auto";
  }

  function open(anchor, nextHandlers) {
    anchorEl = anchor;
    handlers = nextHandlers;
    const menu = ensurePanel();
    applyChrome();
    renderList("");
    menu.classList.remove("hidden");
    visible = true;
    positionPanel();
    searchInput.value = "";
    requestAnimationFrame(() => searchInput.focus());
    anchorEl?.classList.add("taskbar-start--active");
  }

  function close() {
    if (!panel) return;
    panel.classList.add("hidden");
    visible = false;
    anchorEl?.classList.remove("taskbar-start--active");
    anchorEl = null;
  }

  function toggle(anchor, nextHandlers) {
    if (visible) close();
    else open(anchor, nextHandlers);
  }

  function refresh() {
    if (!panel) return;
    applyChrome();
    if (visible) renderList(searchInput?.value || "");
  }

  document.addEventListener(
    "pointerdown",
    (e) => {
      if (!visible || !panel) return;
      if (panel.contains(e.target) || anchorEl?.contains(e.target)) return;
      close();
    },
    true
  );

  window.addEventListener("resize", () => {
    if (visible) positionPanel();
  });

  window.addEventListener("myspace-i18n-applied", () => {
    if (panel) refresh();
  });

  window.MySpaceStartMenu = { open, close, toggle, isOpen: () => visible, refresh };
})();