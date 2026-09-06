(function () {
  const LOCAL_KEY = "myspace-vd-local-v1";

  let btn = null;
  let hooks = {
    captureSession: null,
    restoreSession: null,
    closeWindows: null,
    refreshDesktop: null,
  };
  let switching = false;
  let localActiveId = null;

  function catalog() {
    return window.MySpaceConfig?.getDesktopSpaces?.() || { activeId: "work", spaces: [] };
  }

  function readLocal() {
    try {
      const raw = JSON.parse(sessionStorage.getItem(LOCAL_KEY) || "null");
      if (!raw || typeof raw !== "object") return { activeId: null, bags: {} };
      return {
        activeId: raw.activeId || null,
        bags: raw.bags && typeof raw.bags === "object" ? raw.bags : {},
      };
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
    localActiveId = pack.activeId || pack.spaces[0]?.id || "work";
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

  function ensureButton() {
    if (btn) return btn;
    const tray = document.querySelector(".taskbar-section--tray");
    if (!tray) return null;
    btn = document.createElement("button");
    btn.type = "button";
    btn.id = "btn-space-switch";
    btn.className = "taskbar-space";
    btn.title = "Switch this window's desktop (Study / Work / Play)";
    tray.insertBefore(btn, tray.firstChild);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      cycle();
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
    el.textContent = active.name;
    el.dataset.spaceId = active.id;
  }

  async function switchTo(id) {
    if (switching) return;
    const pack = catalog();
    const currentId = ensureLocalActive();
    if (!id || id === currentId) return;
    if (!pack.spaces.some((s) => s.id === id)) return;

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
      if (bag?.positions && typeof bag.positions === "object") {
        try {
          const state = window.MySpaceConfig?.getState?.();
          if (state) {
            window.MySpaceConfig.updateSettings?.({ positions: { ...bag.positions } });
          }
        } catch {
        }
      }

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
      const name = pack.spaces.find((s) => s.id === id)?.name || id;
      window.showMySpaceToast?.(`Desktop: ${name}`);
    } finally {
      switching = false;
    }
  }

  async function cycle() {
    const pack = spaces();
    if (!pack.spaces.length) return;
    const idx = Math.max(0, pack.spaces.findIndex((s) => s.id === pack.activeId));
    const next = pack.spaces[(idx + 1) % pack.spaces.length];
    await switchTo(next.id);
  }

  function openMenu(anchor) {
    const pack = spaces();
    const rect = anchor.getBoundingClientRect();
    const items = pack.spaces.map((s) => ({
      id: "space:" + s.id,
      label: (s.id === pack.activeId ? "● " : "○ ") + s.name,
    }));
    window.MySpaceContextMenu?.show?.(rect.left, Math.max(8, rect.top - 4), items, (actionId) => {
      const sid = String(actionId || "").replace(/^space:/, "");
      if (sid) switchTo(sid);
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
    spaces,
    getActiveId: () => ensureLocalActive(),
  };
})();
