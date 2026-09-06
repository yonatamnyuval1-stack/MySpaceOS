(function () {
  const TILE_W = 76;
  const TILE_H = 80;
  const GAP = 8;
  const DRAG_THRESHOLD = 5;

  function getPositions() {
    return window.MySpaceConfig?.getPositions() || {};
  }

  function defaultPosition(index, gridEl) {
    const height = gridEl.clientHeight || 600;
    const width = gridEl.clientWidth || 800;
    const rows = Math.max(1, Math.floor((height - 16) / (TILE_H + GAP)));
    const col = Math.floor(index / rows);
    const row = index % rows;
    const x = width - (col + 1) * (TILE_W + GAP) - 12;
    const y = 12 + row * (TILE_H + GAP);
    return { x: Math.max(8, x), y };
  }

  function applyPosition(btn, appId, index, gridEl) {
    btn.style.position = "absolute";
    const saved = getPositions()[appId];
    const pos = saved || defaultPosition(index, gridEl);
    btn.style.left = `${pos.x}px`;
    btn.style.top = `${pos.y}px`;
  }

  function clampPosition(left, top, btn, gridEl) {
    const maxL = Math.max(0, gridEl.clientWidth - btn.offsetWidth);
    const maxT = Math.max(0, gridEl.clientHeight - btn.offsetHeight);
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
    const apps = window.MySpaceConfig?.getApps?.() || [];
    apps.forEach((app, index) => {
      const btn = gridEl.querySelector(`[data-app-id="${CSS.escape(app.id)}"]`);
      if (!btn) return;
      const pos = defaultPosition(index, gridEl);
      btn.style.left = `${pos.x}px`;
      btn.style.top = `${pos.y}px`;
      window.MySpaceConfig.setPosition(app.id, pos.x, pos.y);
    });
  }

  window.MySpaceDrag = {
    applyPosition,
    enableDrag,
    shouldSuppressClick,
    relayoutFromAppOrder,
  };
})();