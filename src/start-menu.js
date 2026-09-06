(function () {
  let panel = null;
  let searchInput = null;
  let listEl = null;
  let visible = false;
  let handlers = null;
  let anchorEl = null;

  function ensurePanel() {
    if (panel) return panel;

    panel = document.createElement("div");
    panel.className = "start-menu hidden";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Start menu");
    panel.innerHTML = `
      <div class="start-menu-head">
        <span class="start-menu-logo" aria-hidden="true">⊞</span>
        <div class="start-menu-search-wrap">
          <input type="search" class="start-menu-search" placeholder="Search apps…" autocomplete="off" spellcheck="false" />
        </div>
      </div>
      <div class="start-menu-list" role="listbox"></div>
      <footer class="start-menu-foot">
        <button type="button" class="start-menu-foot-btn" data-action="add">Add shortcut…</button>
        <button type="button" class="start-menu-foot-btn" data-action="settings">Settings</button>
      </footer>`;

    searchInput = panel.querySelector(".start-menu-search");
    listEl = panel.querySelector(".start-menu-list");

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
      listEl.innerHTML = `<p class="start-menu-empty">No apps match "${query || ""}"</p>`;
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

  window.MySpaceStartMenu = { open, close, toggle, isOpen: () => visible };
})();