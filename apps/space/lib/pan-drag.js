window.SpacePanDrag = (function () {
  function attach(canvas, handlers) {
    const { onPanStart, onPanMove, onPanEnd, onHover, shouldIgnore } = handlers;
    let dragging = false;
    let dragStart = null;
    let last = null;
    let abort = null;

    function local(e) {
      const rect = canvas.getBoundingClientRect();
      return {
        mx: e.clientX - rect.left,
        my: e.clientY - rect.top,
        shift: e.shiftKey,
      };
    }

    function down(e) {
      if (e.button !== 0) return;
      if (shouldIgnore?.(e)) return;
      e.preventDefault();
      dragging = true;
      dragStart = { x: e.clientX, y: e.clientY };
      last = { x: e.clientX, y: e.clientY };
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
      }
      onPanStart?.(local(e), dragStart);
      canvas.style.cursor = "grabbing";
    }

    function move(e) {
      const loc = local(e);
      if (!dragging || !dragStart) {
        onHover?.(loc);
        return;
      }
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      const vx = last ? e.clientX - last.x : 0;
      const vy = last ? e.clientY - last.y : 0;
      last = { x: e.clientX, y: e.clientY };
      onPanMove?.({ dx, dy, vx, vy, shift: e.shiftKey, ...loc });
    }

    function up(e) {
      if (!dragging) return;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
      }
      const moved = dragStart ? Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y) : 0;
      onPanEnd?.({ moved, ...local(e) });
      dragging = false;
      dragStart = null;
      last = null;
      onHover?.(local(e));
    }

    function bind() {
      if (abort) return;
      abort = new AbortController();
      const { signal } = abort;
      const opt = { signal };
      canvas.addEventListener("pointerdown", down, opt);
      canvas.addEventListener("pointermove", move, opt);
      canvas.addEventListener("pointerup", up, opt);
      canvas.addEventListener("pointercancel", up, opt);
    }

    function destroy() {
      abort?.abort();
      abort = null;
      dragging = false;
    }

    return { bind, destroy, isDragging: () => dragging };
  }

  return { attach };
})();