(function () {
  const ZONE = 14;
  const DWELL_MS = 480;
  const COOLDOWN_MS = 1600;

  let enabled = true;
  let dwellTimer = null;
  let lastCorner = null;
  let lastFireAt = 0;
  let handlers = null;

  function cornerAt(x, y) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (x <= ZONE && y <= ZONE) return "tl";
    if (x >= w - ZONE && y <= ZONE) return "tr";
    if (x <= ZONE && y >= h - ZONE) return "bl";
    if (x >= w - ZONE && y >= h - ZONE) return "br";
    return null;
  }

  function fire(corner) {
    const now = Date.now();
    if (now - lastFireAt < COOLDOWN_MS) return;
    lastFireAt = now;
    if (corner === "tl") handlers?.onDesktop?.();
    else if (corner === "tr") handlers?.onPalette?.();
    else if (corner === "bl") handlers?.onStart?.();
    else if (corner === "br") handlers?.onShortcuts?.();
  }

  function onMove(e) {
    if (!enabled) return;
    if (window.MySpaceCommandPalette?.isOpen?.()) return;
    if (window.MySpaceShellLine?.isOpen?.()) return;
    if (window.MySpaceShortcutsHelp?.isOpen?.()) return;

    const corner = cornerAt(e.clientX, e.clientY);
    if (corner === lastCorner) return;
    lastCorner = corner;
    if (dwellTimer) {
      clearTimeout(dwellTimer);
      dwellTimer = null;
    }
    if (!corner) return;
    dwellTimer = setTimeout(() => {
      dwellTimer = null;
      if (lastCorner === corner) fire(corner);
    }, DWELL_MS);
  }

  function init(nextHandlers) {
    handlers = nextHandlers || {};
    const settings = window.MySpaceConfig?.getSettings?.() || {};
    enabled = settings.hotCorners !== false;
    document.addEventListener("mousemove", onMove, { passive: true });
  }

  function setEnabled(on) {
    enabled = !!on;
  }

  function isEnabled() {
    return enabled;
  }

  window.MySpaceHotCorners = { init, setEnabled, isEnabled };
})();