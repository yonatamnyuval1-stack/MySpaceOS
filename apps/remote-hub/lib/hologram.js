window.RemoteHubHologram = (function () {
  const CYAN = { h: 186, s: 92, minL: 42, maxL: 72 };
  const DEFAULT_MS = 2600;

  let overlay = null;
  let canvas = null;
  let captionEl = null;
  let rafId = null;
  let playing = false;

  function ensureDom() {
    if (overlay) return;
    overlay = document.getElementById("holo-overlay");
    canvas = document.getElementById("holo-canvas");
    captionEl = document.getElementById("holo-caption");
  }

  function buildVoxels() {
    const v = [];
    const addBox = (x0, x1, y0, y1, z0, z1, step) => {
      for (let x = x0; x <= x1; x += step) {
        for (let y = y0; y <= y1; y += step) {
          for (let z = z0; z <= z1; z += step) {
            v.push({
              x: x + (Math.random() - 0.5) * 0.15,
              y: y + (Math.random() - 0.5) * 0.15,
              z: z + (Math.random() - 0.5) * 0.15,
              seed: Math.random() * 1000,
              size: 0.85 + Math.random() * 0.5,
            });
          }
        }
      }
    };

    addBox(-6, 6, -1, 0, -4, 4, 1);
    addBox(-5, 5, 0, 18, -3, 3, 1);
    addBox(-1, 1, 2, 14, -2, 2, 2);
    addBox(-7, 7, 19, 24, -2, 2, 1);
    addBox(-6, 6, 20, 23, -1, 1, 1);
    addBox(-4, 4, 12, 13, 3, 4, 1);
    addBox(-4, 4, 12, 13, -4, -3, 1);

    return v;
  }

  const voxels = buildVoxels();

  function rotateY(p, a) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return { x: p.x * c - p.z * s, y: p.y, z: p.x * s + p.z * c };
  }

  function hsla(h, s, l, a) {
    return `hsla(${h},${s}%,${l}%,${a})`;
  }

  function drawFrame(ctx, w, h, angle, t) {
    ctx.clearRect(0, 0, w, h);

    const focal = 420;
    const cx = w / 2;
    const cy = h / 2 + 10;
    const scale = Math.min(w, h) * 0.018;

    const projected = voxels.map((v) => {
      const r = rotateY(v, angle);
      const depth = r.z + 12;
      const persp = focal / (focal + depth);
      return {
        sx: cx + r.x * scale * persp,
        sy: cy - r.y * scale * persp,
        depth,
        seed: v.seed,
        size: v.size * persp,
      };
    });

    projected.sort((a, b) => a.depth - b.depth);

    for (const p of projected) {
      const flicker = 0.65 + 0.35 * Math.sin(t * 0.012 + p.seed);
      const pulse = 0.85 + 0.15 * Math.sin(t * 0.008 + p.depth * 0.3);
      const l = CYAN.minL + (CYAN.maxL - CYAN.minL) * flicker * pulse;
      const a = 0.25 + 0.75 * Math.min(1, (p.depth + 8) / 22);
      const sz = Math.max(1.2, p.size * 2.2);

      ctx.fillStyle = hsla(CYAN.h, CYAN.s, l, a * 0.35);
      ctx.fillRect(p.sx - sz * 0.6, p.sy - sz * 0.6, sz * 1.2, sz * 1.2);

      if (Math.sin(t * 0.05 + p.seed * 2) > 0.92) continue;

      ctx.fillStyle = hsla(CYAN.h, CYAN.s, Math.min(88, l + 12), a);
      ctx.fillRect(p.sx - sz / 2, p.sy - sz / 2, sz, sz);
    }

    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.45);
    g.addColorStop(0, "rgba(0, 220, 255, 0.08)");
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function play(options) {
    ensureDom();
    if (!overlay || !canvas || playing) return Promise.resolve();

    const duration = options?.duration ?? DEFAULT_MS;
    const label = options?.label || "Processing…";

    playing = true;
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    if (captionEl) captionEl.textContent = label;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    function resize() {
      const rect = overlay.getBoundingClientRect();
      const w = Math.max(320, rect.width);
      const h = Math.max(320, rect.height);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w, h };
    }

    let { w, h } = resize();
    const start = performance.now();
    const startAngle = 0;
    const endAngle = Math.PI * 2;

    const onResize = () => {
      ({ w, h } = resize());
    };
    window.addEventListener("resize", onResize);

    function finish() {
      window.removeEventListener("resize", onResize);
      hideOverlay();
    }

    return new Promise((resolve) => {
      function frame(now) {
        if (!playing) {
          finish();
          resolve();
          return;
        }
        const elapsed = now - start;
        const progress = Math.min(1, elapsed / duration);
        const ease = 1 - Math.pow(1 - progress, 2);
        const angle = startAngle + (endAngle - startAngle) * ease;

        drawFrame(ctx, w, h, angle, elapsed);

        if (elapsed < duration) {
          rafId = requestAnimationFrame(frame);
        } else {
          finish();
          resolve();
        }
      }

      rafId = requestAnimationFrame(frame);
    });
  }

  function hideOverlay() {
    playing = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (overlay) {
      overlay.classList.add("hidden");
      overlay.setAttribute("aria-hidden", "true");
    }
  }

  function stop() {
    hideOverlay();
  }

  async function run(label, fn) {
    await play({ label });
    if (typeof fn === "function") return fn();
  }

  return { play, stop, run };
})();
