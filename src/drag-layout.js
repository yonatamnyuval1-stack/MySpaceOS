(function () {
  const TILE_W = 88;
  const TILE_H = 92;
  const GAP_X = 10;
  const GAP_Y = 8;
  const MARGIN_X = 20;
  const MARGIN_Y = 16;
  const DRAG_THRESHOLD = 5;
  /** Default icons down each column (shrinks only if the window is shorter). */
  const ICONS_PER_COLUMN = 8;
  const DEFAULT_ORDER = [
    "notes",
    "tasks",
    "day-planner",
    "world-clock",
    "contacts",
    "translate",
    "docs",
    "studies",
    "study-deck",
    "code-lexicon",
    "builds",
    "drift",
    "geography",
    "world-maps",
    "history",
    "space",
    "flag-quiz",
    "pi-digits",
    "stocks",
    "profiles",
    "coupons",
    "contracts",
    "remote-hub",
    "icon-library",
    "edge",
    "vscode",
    "cursor",
    "terminal",
    "docker",
    "github",
  ];

  function getPositions() {
    return window.MySpaceConfig?.getPositions() || {};
  }

  function measureGrid(gridEl) {
    let w = gridEl?.clientWidth || 0;
    let h = gridEl?.clientHeight || 0;
    if (w < 120) {
      w =
        gridEl?.parentElement?.clientWidth ||
        document.getElementById("desktop")?.clientWidth ||
        window.innerWidth ||
        1280;
    }
    if (h < 120) {
      h =
        gridEl?.parentElement?.clientHeight ||
        document.getElementById("desktop")?.clientHeight ||
        Math.max(480, (window.innerHeight || 800) - 64);
    }
    return { width: Math.max(320, w), height: Math.max(320, h) };
  }

  function rowsForHeight(height) {
    const usable = Math.max(1, height - MARGIN_Y * 2);
    const fit = Math.max(1, Math.floor((usable + GAP_Y) / (TILE_H + GAP_Y)));
    return Math.max(1, Math.min(ICONS_PER_COLUMN, fit));
  }

  function cellAt(col, row) {
    return {
      x: MARGIN_X + col * (TILE_W + GAP_X),
      y: MARGIN_Y + row * (TILE_H + GAP_Y),
    };
  }

  function sortIdsForDefault(appIds) {
    const set = new Set(appIds.map(String));
    const ordered = [];
    for (const id of DEFAULT_ORDER) {
      if (set.has(id)) {
        ordered.push(id);
        set.delete(id);
      }
    }
    for (const id of appIds) {
      const s = String(id);
      if (set.has(s)) {
        ordered.push(s);
        set.delete(s);
      }
    }
    return ordered;
  }

  function defaultPositionsForApps(appIds, gridEl) {
    const { height } = measureGrid(gridEl);
    const rows = rowsForHeight(height);
    const ordered = sortIdsForDefault(appIds);
    const map = new Map();
    ordered.forEach((id, index) => {
      map.set(id, cellAt(Math.floor(index / rows), index % rows));
    });
    return map;
  }

  function defaultPosition(index, gridEl) {
    const { height } = measureGrid(gridEl);
    const rows = rowsForHeight(height);
    return cellAt(Math.floor(index / rows), index % rows);
  }

  function hasSavedPosition(positions, id) {
    const p = positions[id];
    return !!(p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)));
  }

  function positionsNeedRelayout(appIds) {
    const positions = getPositions();
    if (!appIds?.length) return true;
    for (const id of appIds) {
      if (!hasSavedPosition(positions, id)) return true;
    }
    return false;
  }

  function fillMissingPositions(gridEl, appIds) {
    const positions = getPositions();
    const defaults = defaultPositionsForApps(appIds, gridEl);
    const taken = new Set();
    for (const id of appIds) {
      const key = String(id);
      if (!hasSavedPosition(positions, key)) continue;
      const p = positions[key];
      taken.add(`${Math.round(Number(p.x))},${Math.round(Number(p.y))}`);
    }
    const freeDefaults = [];
    for (const pos of defaults.values()) {
      const k = `${Math.round(pos.x)},${Math.round(pos.y)}`;
      if (!taken.has(k)) freeDefaults.push(pos);
    }
    let freeIdx = 0;
    let filled = 0;
    appIds.forEach((id, index) => {
      const key = String(id);
      if (hasSavedPosition(positions, key)) return;
      let pos = freeDefaults[freeIdx++];
      if (!pos) pos = defaultPosition(index, gridEl);
      const next = { x: Math.round(pos.x), y: Math.round(pos.y) };
      window.MySpaceConfig?.setPosition?.(key, next.x, next.y);
      filled += 1;
    });
    return filled;
  }

  function applyLayout(gridEl, appIds, { persist, layoutVersion } = {}) {
    const defaults = defaultPositionsForApps(appIds, gridEl);
    const nextPositions = persist ? {} : null;
    appIds.forEach((id, index) => {
      const key = String(id);
      const btn = gridEl?.querySelector?.(`[data-app-id="${CSS.escape(key)}"]`);
      const pos = defaults.get(key) || defaultPosition(index, gridEl);
      if (btn) {
        btn.style.position = "absolute";
        btn.style.left = `${pos.x}px`;
        btn.style.top = `${pos.y}px`;
      }
      if (nextPositions) {
        nextPositions[key] = { x: Math.round(pos.x), y: Math.round(pos.y) };
      }
    });
    if (nextPositions) {
      if (typeof window.MySpaceConfig?.applyPositionsToAllDesktops === "function") {
        window.MySpaceConfig.applyPositionsToAllDesktops(nextPositions, layoutVersion);
      } else {
        const patch = { positions: nextPositions };
        if (layoutVersion != null) patch.desktopIconLayoutVersion = layoutVersion;
        window.MySpaceConfig?.updateSettings?.(patch);
      }
    }
    return defaults;
  }

  function applyPosition(btn, appId, index, gridEl, defaultsMap) {
    btn.style.position = "absolute";
    const saved = getPositions()[appId];
    let pos = null;
    if (saved && Number.isFinite(Number(saved.x)) && Number.isFinite(Number(saved.y))) {
      pos = { x: Number(saved.x), y: Number(saved.y) };
    } else if (defaultsMap instanceof Map) {
      pos = defaultsMap.get(appId) || null;
    }
    if (!pos) pos = defaultPosition(index, gridEl);
    btn.style.left = `${pos.x}px`;
    btn.style.top = `${pos.y}px`;
  }

  function clampPosition(left, top, btn, gridEl) {
    const { width, height } = measureGrid(gridEl);
    const maxL = Math.max(0, width - (btn.offsetWidth || TILE_W));
    const maxT = Math.max(0, height - (btn.offsetHeight || TILE_H));
    return {
      x: Math.min(maxL, Math.max(0, left)),
      y: Math.min(maxT, Math.max(0, top)),
    };
  }

  function shouldSuppressClick(btn) {
    if (btn.__suppressNextClick) {
      btn.__suppressNextClick = false;
      return true;
    }
    return false;
  }

  function enableDrag(btn, appId, gridEl) {
    if (btn.__myspaceDragBound) return;
    btn.__myspaceDragBound = true;
    let pointerActive = false;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;
    btn.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      pointerActive = true;
      dragging = false;
      startX = e.clientX;
      startY = e.clientY;
      originX = parseFloat(btn.style.left) || 0;
      originY = parseFloat(btn.style.top) || 0;
      btn.setPointerCapture(e.pointerId);
    });
    btn.addEventListener("pointermove", (e) => {
      if (!pointerActive) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      if (!dragging) {
        dragging = true;
        btn.classList.add("dragging");
      }
      const next = clampPosition(originX + dx, originY + dy, btn, gridEl);
      btn.style.left = `${next.x}px`;
      btn.style.top = `${next.y}px`;
    });
    const endDrag = (e) => {
      if (!pointerActive) return;
      pointerActive = false;
      if (btn.hasPointerCapture(e.pointerId)) {
        btn.releasePointerCapture(e.pointerId);
      }
      if (dragging) {
        const x = parseFloat(btn.style.left) || 0;
        const y = parseFloat(btn.style.top) || 0;
        window.MySpaceConfig.setPosition(appId, x, y);
        btn.__suppressNextClick = true;
        btn.classList.remove("dragging");
      }
      dragging = false;
    };

    btn.addEventListener("pointerup", endDrag);
    btn.addEventListener("pointercancel", endDrag);
  }

  function relayoutFromAppOrder(gridEl) {
    const apps = (window.MySpaceConfig?.getApps?.() || []).filter(
      (a) => a && a.id !== "welcome" && !a.hidden
    );
    applyLayout(
      gridEl,
      apps.map((a) => a.id),
      { persist: true }
    );
  }

  function relayoutDefaultGroups(gridEl) {
    relayoutFromAppOrder(gridEl);
  }
  window.MySpaceDrag = {
    applyPosition,
    enableDrag,
    shouldSuppressClick,
    relayoutFromAppOrder,
    relayoutDefaultGroups,
    defaultPositionsForApps,
    fillMissingPositions,
    positionsAreBroken: positionsNeedRelayout,
    positionsNeedRelayout,
    applyLayout,
    ICONS_PER_COLUMN,
  };
})();