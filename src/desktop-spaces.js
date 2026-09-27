(function () {
  const LOCAL_KEY = "myspace-vd-local-v1";
  const LEGACY_BAG_MAP = { study: "desktop-1", work: "desktop-2", play: "desktop-3" };
  let btn = null;
  let overviewEl = null;
  let overviewOpen = false;
  let hooks = {
    captureSession: null,
    restoreSession: null,
    closeWindows: null,
    refreshDesktop: null,
  };
  let switching = false;
  let localActiveId = null;
  function tt(key, fallback, vars) {
    const I = window.MySpaceI18n;
    if (I?.t) {
      const out = I.t(key, vars);
      if (out && out !== key) return out;
    }
    let s = fallback || key;
    if (vars) {
      Object.keys(vars).forEach((k) => {
        s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(vars[k]));
      });
    }
    return s;
  }

  function catalog() {
    return window.MySpaceConfig?.getDesktopSpaces?.() || { activeId: "desktop-1", spaces: [] };
  }

  function readLocal() {
    try {
      const raw = JSON.parse(sessionStorage.getItem(LOCAL_KEY) || "null");
      if (!raw || typeof raw !== "object") return { activeId: null, bags: {} };
      let bags = raw.bags && typeof raw.bags === "object" ? { ...raw.bags } : {};
      let activeId = raw.activeId || null;
      Object.keys(LEGACY_BAG_MAP).forEach((oldId) => {
        if (bags[oldId] != null && bags[LEGACY_BAG_MAP[oldId]] == null) {
          bags[LEGACY_BAG_MAP[oldId]] = bags[oldId];
        }
        delete bags[oldId];
      });
      if (LEGACY_BAG_MAP[activeId]) activeId = LEGACY_BAG_MAP[activeId];
      return { activeId, bags };
    } catch {
      return { activeId: null, bags: {} };
    }
  }

  function writeLocal(next) {
    try {
      sessionStorage.setItem(LOCAL_KEY, JSON.stringify(next));
    } catch {
    }
  }

  function ensureLocalActive() {
    const pack = catalog();
    const local = readLocal();
    if (localActiveId && pack.spaces.some((s) => s.id === localActiveId)) {
      return localActiveId;
    }
    if (local.activeId && pack.spaces.some((s) => s.id === local.activeId)) {
      localActiveId = local.activeId;
      return localActiveId;
    }
    localActiveId = pack.activeId || pack.spaces[0]?.id || "desktop-1";
    return localActiveId;
  }

  function spaces() {
    const pack = catalog();
    return { activeId: ensureLocalActive(), spaces: pack.spaces };
  }

  function parkBag(spaceId, bag) {
    const local = readLocal();
    local.bags[spaceId] = bag || null;
    local.activeId = spaceId;
    writeLocal(local);
  }

  function takeBag(spaceId) {
    const local = readLocal();
    return local.bags?.[spaceId] || null;
  }

  function dropBag(spaceId) {
    const local = readLocal();
    if (local.bags && spaceId in local.bags) {
      delete local.bags[spaceId];
      writeLocal(local);
    }
  }

  function tabCountFor(spaceId) {
    const active = ensureLocalActive();
    if (spaceId === active) {
      return window.MySpaceWorkspace?.getTabs?.()?.length || 0;
    }
    const bag = takeBag(spaceId);
    return bag?.session?.tabs?.length || 0;
  }

  function ensureButton() {
    if (btn) return btn;
    const tray = document.querySelector(".taskbar-section--tray");
    if (!tray) return null;
    btn = document.createElement("button");
    btn.type = "button";
    btn.id = "btn-space-switch";
    btn.className = "taskbar-space";
    btn.setAttribute("aria-haspopup", "dialog");
    tray.insertBefore(btn, tray.firstChild);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleOverview();
    });
    btn.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openMenu(btn);
    });
    return btn;
  }

  function paint() {
    const pack = spaces();
    const active = pack.spaces.find((s) => s.id === pack.activeId) || pack.spaces[0];
    const el = ensureButton();
    if (!el || !active) return;
    const idx = Math.max(0, pack.spaces.findIndex((s) => s.id === active.id)) + 1;
    el.textContent = active.name || `Desktop ${idx}`;
    el.dataset.spaceId = active.id;
    el.title = tt(
      "shell.taskView.trayTitle",
      "Task View: click for desktops (Ctrl+Alt+Tab)"
    );
    el.setAttribute(
      "aria-label",
      tt("shell.taskView.trayAria", "Desktops: {name}", { name: active.name })
    );
    if (overviewOpen) renderOverview();
  }

  async function switchTo(id) {
    if (switching) return { ok: false };
    const pack = catalog();
    const currentId = ensureLocalActive();
    if (!id || id === currentId) {
      hideOverview();
      return { ok: true, unchanged: true };
    }
    if (!pack.spaces.some((s) => s.id === id)) return { ok: false };
    switching = true;
    try {
      const session =
        typeof hooks.captureSession === "function" ? hooks.captureSession() : null;
      const positions = window.MySpaceConfig?.getPositions?.() || {};
      parkBag(currentId, { session, positions, at: Date.now() });
      if (typeof hooks.closeWindows === "function") {
        hooks.closeWindows();
      }

      const res = window.MySpaceConfig?.switchDesktopSpace?.(id, {
        positions,
        skipSession: true,
      });
      localActiveId = id;
      const local = readLocal();
      local.activeId = id;
      writeLocal(local);
      if (res?.wallpaper) window.MySpaceWallpapers?.apply?.(res.wallpaper);
      window.MySpaceTaskbar?.refresh?.();
      const bag = takeBag(id);
      if (typeof hooks.refreshDesktop === "function") hooks.refreshDesktop();
      else window.__myspaceAiRefreshDesktop?.();
      if (typeof hooks.restoreSession === "function" && bag?.session?.tabs?.length) {
        try {
          await hooks.restoreSession(bag.session);
        } catch (err) {
          console.warn("desktop restore failed:", err);
        }
      } else {
        window.MySpaceWorkspace?.minimizeToDesktop?.();
      }
      paint();
      hideOverview();
      const name = pack.spaces.find((s) => s.id === id)?.name || id;
      window.showMySpaceToast?.(
        tt("shell.taskView.switched", "Desktop: {name}", { name })
      );
      return { ok: true };
    } finally {
      switching = false;
    }
  }

  async function cycle(dir = 1) {
    const pack = spaces();
    if (!pack.spaces.length) return;
    const idx = Math.max(0, pack.spaces.findIndex((s) => s.id === pack.activeId));
    const next = pack.spaces[(idx + dir + pack.spaces.length * 8) % pack.spaces.length];
    await switchTo(next.id);
  }

  async function createDesktop() {
    const pack = spaces();
    if (pack.spaces.length >= 8) {
      window.showMySpaceToast?.(
        tt("shell.taskView.maxDesktops", "Maximum 8 desktops")
      );
      return null;
    }
    const res = window.MySpaceConfig?.createDesktopSpace?.({
      afterId: pack.activeId,
    });
    if (!res?.ok) {
      window.showMySpaceToast?.(res?.error || tt("shell.taskView.createFailed", "Could not create desktop"));
      return null;
    }
    paint();
    renderOverview();
    await switchTo(res.space.id);
    return res.space;
  }

  async function closeDesktop(spaceId) {
    const pack = spaces();
    if (pack.spaces.length <= 1) {
      window.showMySpaceToast?.(
        tt("shell.taskView.keepOne", "Keep at least one desktop")
      );
      return;
    }
    const id = spaceId || pack.activeId;
    const target = pack.spaces.find((s) => s.id === id);
    if (!target) return;
    const tabs = tabCountFor(id);
    if (tabs > 0) {
      const ok = window.confirm(
        tt(
          "shell.taskView.closeConfirm",
          "Close “{name}”? Open apps on this desktop will be discarded.",
          { name: target.name }
        )
      );
      if (!ok) return;
    }
    const wasActive = id === ensureLocalActive();
    if (wasActive && typeof hooks.closeWindows === "function") {
      hooks.closeWindows();
    }
    const res = window.MySpaceConfig?.removeDesktopSpace?.(id);
    if (!res?.ok) {
      window.showMySpaceToast?.(res?.error || tt("shell.taskView.closeFailed", "Could not close desktop"));
      return;
    }
    dropBag(id);
    if (wasActive && res.switchedTo) {
      localActiveId = res.switchedTo.id;
      const local = readLocal();
      local.activeId = res.switchedTo.id;
      writeLocal(local);
      if (res.wallpaper) window.MySpaceWallpapers?.apply?.(res.wallpaper);
      window.MySpaceTaskbar?.refresh?.();
      const bag = takeBag(res.switchedTo.id);
      if (typeof hooks.refreshDesktop === "function") hooks.refreshDesktop();
      if (typeof hooks.restoreSession === "function" && bag?.session?.tabs?.length) {
        try {
          await hooks.restoreSession(bag.session);
        } catch {
        }
      } else {
        window.MySpaceWorkspace?.minimizeToDesktop?.();
      }
    }
    paint();
    if (overviewOpen) renderOverview();
    window.showMySpaceToast?.(
      tt("shell.taskView.closed", "Closed {name}", { name: target.name })
    );
  }

  function renameDesktop(spaceId) {
    const pack = spaces();
    const space = pack.spaces.find((s) => s.id === spaceId);
    if (!space) return;
    const next = window.prompt(
      tt("shell.taskView.renamePrompt", "Rename desktop"),
      space.name
    );
    if (next == null) return;
    const res = window.MySpaceConfig?.renameDesktopSpace?.(spaceId, next);
    if (!res?.ok) {
      window.showMySpaceToast?.(res?.error || tt("shell.taskView.renameFailed", "Could not rename"));
      return;
    }
    paint();
    if (overviewOpen) renderOverview();
  }

  function ensureOverview() {
    if (overviewEl) return overviewEl;
    overviewEl = document.createElement("div");
    overviewEl.id = "task-view";
    overviewEl.className = "task-view hidden";
    overviewEl.setAttribute("hidden", "");
    overviewEl.setAttribute("role", "dialog");
    overviewEl.setAttribute("aria-modal", "true");
    overviewEl.innerHTML = `
      <div class="task-view-backdrop" data-tv-close></div>
      <div class="task-view-panel">
        <header class="task-view-header">
          <h2 class="task-view-title" data-i18n="shell.taskView.title">Desktops</h2>
          <button type="button" class="task-view-new" id="task-view-new" data-i18n="shell.taskView.new">New desktop</button>
        </header>
        <div class="task-view-strip" id="task-view-strip" role="list"></div>
        <p class="task-view-hint" data-i18n="shell.taskView.hint">Ctrl+Alt+←/→ switch · Ctrl+Alt+D new · Esc close</p>
      </div>
    `;
    document.body.appendChild(overviewEl);
    overviewEl.querySelector("[data-tv-close]")?.addEventListener("click", () => hideOverview());
    overviewEl.querySelector("#task-view-new")?.addEventListener("click", () => {
      void createDesktop();
    });
    return overviewEl;
  }

  function renderOverview() {
    const root = ensureOverview();
    const strip = root.querySelector("#task-view-strip");
    const title = root.querySelector(".task-view-title");
    const newBtn = root.querySelector("#task-view-new");
    const hint = root.querySelector(".task-view-hint");
    if (title) title.textContent = tt("shell.taskView.title", "Desktops");
    if (newBtn) newBtn.textContent = tt("shell.taskView.new", "New desktop");
    if (hint) {
      hint.textContent = tt(
        "shell.taskView.hint",
        "Ctrl+Alt+←/→ switch, Ctrl+Alt+D new, Esc close"
      );
    }
    if (!strip) return;
    const pack = spaces();
    strip.innerHTML = "";
    pack.spaces.forEach((space, i) => {
      const active = space.id === pack.activeId;
      const tabs = tabCountFor(space.id);
      const card = document.createElement("div");
      card.className = "task-view-card" + (active ? " is-active" : "");
      card.setAttribute("role", "listitem");
      card.dataset.spaceId = space.id;
      card.tabIndex = 0;
      const preview = document.createElement("button");
      preview.type = "button";
      preview.className = "task-view-preview";
      preview.setAttribute(
        "aria-label",
        tt("shell.taskView.openDesktop", "Open {name}", { name: space.name })
      );
      preview.innerHTML = `
        <span class="task-view-preview-glow" aria-hidden="true"></span>
        <span class="task-view-preview-label">${escapeHtml(space.name)}</span>
        <span class="task-view-preview-meta">${
          tabs
            ? tt("shell.taskView.appsOpen", "{n} open", { n: tabs })
            : tt("shell.taskView.empty", "Empty")
        }</span>
      `;
      preview.addEventListener("click", () => void switchTo(space.id));
      const bar = document.createElement("div");
      bar.className = "task-view-card-bar";
      const nameBtn = document.createElement("button");
      nameBtn.type = "button";
      nameBtn.className = "task-view-card-name";
      nameBtn.textContent = space.name || `Desktop ${i + 1}`;
      nameBtn.title = tt("shell.taskView.rename", "Rename");
      nameBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        renameDesktop(space.id);
      });
      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "task-view-card-close";
      closeBtn.textContent = "×";
      closeBtn.title = tt("shell.taskView.close", "Close desktop");
      closeBtn.disabled = pack.spaces.length <= 1;
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        void closeDesktop(space.id);
      });
      bar.appendChild(nameBtn);
      bar.appendChild(closeBtn);
      card.appendChild(preview);
      card.appendChild(bar);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          void switchTo(space.id);
        }
      });
      strip.appendChild(card);
    });
    const addCard = document.createElement("button");
    addCard.type = "button";
    addCard.className = "task-view-add";
    addCard.disabled = pack.spaces.length >= 8;
    addCard.innerHTML = `<span class="task-view-add-plus">+</span><span>${tt(
      "shell.taskView.new",
      "New desktop"
    )}</span>`;
    addCard.addEventListener("click", () => void createDesktop());
    strip.appendChild(addCard);
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function showOverview() {
    ensureOverview();
    renderOverview();
    overviewEl.removeAttribute("hidden");
    overviewEl.classList.remove("hidden");
    requestAnimationFrame(() => overviewEl.classList.add("is-visible"));
    overviewOpen = true;
    try {
      overviewEl.querySelector(".task-view-card.is-active")?.focus?.({ preventScroll: true });
    } catch {
      overviewEl.querySelector(".task-view-card.is-active")?.focus?.();
    }
  }

  function hideOverview() {
    if (!overviewEl) return;
    overviewEl.classList.remove("is-visible");
    overviewEl.classList.add("hidden");
    overviewEl.setAttribute("hidden", "");
    overviewOpen = false;
  }

  function toggleOverview() {
    if (overviewOpen) hideOverview();
    else showOverview();
  }

  function isOverviewOpen() {
    return overviewOpen;
  }

  function openMenu(anchor) {
    const pack = spaces();
    const rect = anchor.getBoundingClientRect();
    const items = [
      {
        id: "tv:overview",
        label: tt("shell.taskView.title", "Desktops"),
      },
      ...pack.spaces.map((s) => ({
        id: "space:" + s.id,
        label: (s.id === pack.activeId ? "● " : "○ ") + s.name,
      })),
      { id: "tv:new", label: tt("shell.taskView.new", "New desktop") },
    ];
    window.MySpaceContextMenu?.show?.(rect.left, Math.max(8, rect.top - 4), items, (actionId) => {
      if (actionId === "tv:overview") {
        showOverview();
        return;
      }
      if (actionId === "tv:new") {
        void createDesktop();
        return;
      }
      const sid = String(actionId || "").replace(/^space:/, "");
      if (sid) void switchTo(sid);
    });
  }

  function init(nextHooks) {
    hooks = { ...hooks, ...(nextHooks || {}) };
    ensureLocalActive();
    paint();
    window.MySpaceConfig?.subscribe?.(() => paint());
  }
  window.MySpaceDesktopSpaces = {
    init,
    paint,
    switchTo,
    cycle,
    createDesktop,
    closeDesktop,
    renameDesktop,
    showOverview,
    hideOverview,
    toggleOverview,
    isOverviewOpen,
    spaces,
    getActiveId: () => ensureLocalActive(),
  };
})();