window.SpaceStarfield = (function () {
  const REF_DEPTH = 100;
  const MIN_LOG_GALAXY = -2.2;
  const MAX_LOG_GALAXY = 3.4;

  const COSMOS_LAYERS = [
    { id: "cosmos", name: "Milky Way · wide view", logZoom: -1.7, hint: "Galactic overview · zoom in for more stars" },
    { id: "galaxy", name: "Star map · 5,600+ stars", logZoom: -0.3, hint: "Full catalog · drag to pan · click a star" },
    { id: "zoomed", name: "Close-in star field", logZoom: 1.2, hint: "Denser local view · still the same star catalog" },
  ];

  const GALACTIC_REGIONS = [
    { name: "Milky Way (edge-on band)", x: 0, y: 0, w: 12000, h: 800 },
    { name: "Orion Arm · Sun", x: 0, y: 0, r: 120 },
    { name: "Local Bubble", x: -40, y: 20, r: 80 },
    { name: "Local Group", x: 0, y: 0, r: 200 },
  ];

  const CONSTELLATION_SEGMENTS = [
    ["Betelgeuse", "Bellatrix"],
    ["Bellatrix", "Alnitak"],
    ["Alnitak", "Alnilam"],
    ["Alnilam", "Rigel"],
    ["Betelgeuse", "Rigel"],
    ["Dubhe", "Alioth"],
    ["Sirius", "Procyon"],
    ["Procyon", "Pollux"],
    ["Pollux", "Castor"],
    ["Regulus", "Spica"],
    ["Arcturus", "Spica"],
    ["Vega", "Deneb"],
    ["Altair", "Vega"],
    ["Antares", "Spica"],
    ["Fomalhaut", "Altair"],
    ["Polaris", "Dubhe"],
  ];

  function viewBand(logZoom) {
    if (logZoom < -1.0) return "cosmos";
    return "galaxy";
  }

  function create(canvas, options = {}) {
    const ctx = canvas.getContext("2d");
    let stars = [];
    let starByName = new Map();
    let width = 0;
    let height = 0;
    let cam = { x: 0, y: 0, logZoom: -0.4 };
    let vel = { x: 0, y: 0 };
    let dragPan = null;
    let isDragging = false;
    let pickAtDown = null;
    let hovered = null;
    let showLabels = true;
    let animId = null;
    let bindAbort = null;
    let lastGalaxyVisible = [];
    let flowSpeed = 0;
    let prevCam = { x: 0, y: 0 };
    let drawErrorLogged = false;
    const onSelect = options.onSelect || (() => {});

    function galaxyZoom() {
      return 2 ** cam.logZoom;
    }

    function currentBand() {
      return viewBand(cam.logZoom);
    }

    function resize() {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      width = Math.max(100, rect.width);
      height = Math.max(100, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function projectGalaxy(star) {
      const depth = Math.max(star.z, 0.5);
      const par = REF_DEPTH / depth;
      const z = galaxyZoom() * 0.14;
      const sx = width / 2 + (star.x - cam.x * par) * z * par;
      const sy = height / 2 + (star.y - cam.y * par) * z * par;
      return { sx, sy, par, depth };
    }

    function projectStar(star) {
      return projectGalaxy(star);
    }

    function starRadius(star, par, band) {
      const p = par || 1;
      const base = Math.max(0.8, 6.8 - star.magnitude);
      const r = base * galaxyZoom() * p * 0.22;
      return Math.min(100, Math.max(0.6, r));
    }

    function galaxyPanFactor(shift) {
      const base = 0.72 / Math.max(0.1, galaxyZoom() ** 0.55);
      return base * (shift ? 2.4 : 1);
    }

    function screenToGalaxyCam(sx, sy) {
      const z = galaxyZoom() * 0.14;
      return {
        x: cam.x + (sx - width / 2) / z,
        y: cam.y + (sy - height / 2) / z,
      };
    }

    function setGalaxyLogZoom(logZ, anchorSx, anchorSy) {
      const before = screenToGalaxyCam(anchorSx, anchorSy);
      cam.logZoom = Math.max(MIN_LOG_GALAXY, Math.min(MAX_LOG_GALAXY, logZ));
      const after = screenToGalaxyCam(anchorSx, anchorSy);
      cam.x += before.x - after.x;
      cam.y += before.y - after.y;
    }

    function starPool(band) {
      if (band !== "cosmos") return stars;
      const step = cam.logZoom < -1.5 ? 4 : 2;
      return stars.filter((_, i) => i % step === 0);
    }

    function drawMilkyWayBackdrop() {
      ctx.save();
      ctx.translate(width * 0.5, height * 0.5);
      ctx.rotate(-0.35);
      const g = ctx.createLinearGradient(-width, 0, width, 0);
      g.addColorStop(0, "transparent");
      g.addColorStop(0.35, "rgba(180, 160, 255, 0.06)");
      g.addColorStop(0.5, "rgba(220, 200, 255, 0.14)");
      g.addColorStop(0.65, "rgba(180, 160, 255, 0.06)");
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.fillRect(-width * 0.9, -height * 0.12, width * 1.8, height * 0.24);
      ctx.restore();
    }

    function drawGalacticRegions(band) {
      if (band !== "cosmos" && band !== "galaxy") return;
      ctx.font = "12px Segoe UI, system-ui, sans-serif";
      for (const reg of GALACTIC_REGIONS) {
        const p = projectGalaxy({ x: reg.x, y: reg.y, z: reg.r || 50 });
        if (p.sx < -100 || p.sx > width + 100) continue;
        ctx.strokeStyle = "rgba(126, 184, 255, 0.2)";
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, 20 + (reg.r || 80) * 0.008 * galaxyZoom(), 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        if (showLabels && !isDragging && (band === "cosmos" || galaxyZoom() > 0.35)) {
          ctx.fillStyle = "rgba(180, 210, 255, 0.65)";
          ctx.fillText(reg.name, p.sx + 12, p.sy - 6);
        }
      }
    }

    function drawStarDot(star, sx, sy, r, band) {
      const lite = isDragging || r < 2.2;
      if (!lite) {
        const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 2.5);
        grd.addColorStop(0, star.color || "#fff");
        grd.addColorStop(1, "transparent");
        ctx.globalAlpha = 0.35 + Math.min(0.65, r * 0.08);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(sx, sy, r * 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = star.color || "#fff";
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
      if (showLabels && !isDragging && (star.named || r > 3.5) && (band !== "galaxy" || galaxyZoom() > 0.15)) {
        ctx.font = `${Math.min(13, 9 + r * 0.2)}px Segoe UI, system-ui, sans-serif`;
        ctx.fillStyle = "rgba(220, 230, 255, 0.9)";
        ctx.fillText(star.name, sx + r + 3, sy + 4);
      }
    }

    function drawConstellationLines() {
      if (cam.logZoom < 0.25 || currentBand() === "cosmos") return;
      ctx.strokeStyle = "rgba(126, 184, 255, 0.35)";
      ctx.lineWidth = 1;
      for (const [a, b] of CONSTELLATION_SEGMENTS) {
        const sa = starByName.get(a);
        const sb = starByName.get(b);
        if (!sa || !sb) continue;
        const pa = projectStar(sa);
        const pb = projectStar(sb);
        if (pa.sx < -20 || pa.sx > width + 20 || pb.sx < -20 || pb.sx > width + 20) continue;
        ctx.beginPath();
        ctx.moveTo(pa.sx, pa.sy);
        ctx.lineTo(pb.sx, pb.sy);
        ctx.stroke();
      }
    }

    function drawGalaxyStars(band) {
      const visible = [];
      const pool = starPool(band);
      for (const star of pool) {
        const p = projectStar(star);
        if (p.sx < -40 || p.sx > width + 40 || p.sy < -40 || p.sy > height + 40) continue;
        const r = starRadius(star, p.par, band);
        if (!Number.isFinite(r) || r <= 0) continue;
        drawStarDot(star, p.sx, p.sy, r, band);
        visible.push({ star, sx: p.sx, sy: p.sy, r, depth: p.depth });
      }
      visible.sort((a, b) => a.depth - b.depth);
      lastGalaxyVisible = visible;
      return visible.length;
    }

    function drawGalaxy() {
      ctx.fillStyle = "#020408";
      ctx.fillRect(0, 0, width, height);
      const band = currentBand();

      const g = ctx.createRadialGradient(width * 0.55, height * 0.45, 0, width * 0.5, height * 0.5, width);
      g.addColorStop(0, "rgba(50, 30, 100, 0.15)");
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);

      if (band === "cosmos") drawMilkyWayBackdrop();
      drawGalacticRegions(band);
      const count = drawGalaxyStars(band);
      drawConstellationLines();
      return count;
    }

    function flowVector() {
      const vx = vel.x * 18 + (cam.x - prevCam.x) * 6;
      const vy = vel.y * 18 + (cam.y - prevCam.y) * 6;
      return { vx, vy, mag: Math.hypot(vx, vy) };
    }

    function drawFlowStreaks() {
      const { vx, vy, mag } = flowVector();
      if (mag < 0.02) return;
      const ang = Math.atan2(vy, vx) + Math.PI;
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.rotate(ang);
      for (let i = 0; i < 4; i++) {
        const t = (performance.now() * 0.00008 + i / 4) % 1;
        const x = -width * 0.3 + t * width * 0.6;
        ctx.strokeStyle = `rgba(180, 220, 255, ${0.05 + mag * 0.12})`;
        ctx.beginPath();
        ctx.moveTo(x, -6 + i * 3);
        ctx.lineTo(x + 50, -6 + i * 3);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawOverlay(visibleCount) {
      const band = currentBand();
      const layer = COSMOS_LAYERS.find((l) => l.id === band) || COSMOS_LAYERS[1];
      ctx.fillStyle = "rgba(8, 12, 22, 0.82)";
      ctx.fillRect(8, 8, 380, 72);
      ctx.font = "12px Segoe UI, system-ui, sans-serif";
      ctx.fillStyle = "#a8b4d4";
      const moving = flowSpeed > 0.008;
      ctx.fillText(`${layer.name} · zoom ${cam.logZoom.toFixed(1)} · ${moving ? "Moving" : "Still"}`, 16, 26);
      ctx.fillStyle = "#94a3b8";
      if (stars.length === 0) {
        ctx.fillText("No star data loaded — restart the app or run npm run space:stars", 16, 42);
      } else {
        ctx.fillText(
          `${visibleCount} visible · ${stars.length} stars · pan ${Math.round(cam.x)}, ${Math.round(cam.y)}`,
          16,
          42
        );
      }
      ctx.fillText("Drag to pan · scroll or slider to zoom · click a star", 16, 58);
      const barW = 90;
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(16, 62, barW, 5);
      ctx.fillStyle = moving ? "#34d399" : "#64748b";
      ctx.fillRect(16, 62, barW * Math.min(1, flowSpeed * 4), 5);

      if (hovered?.name) {
        ctx.fillStyle = "rgba(126, 184, 255, 0.9)";
        ctx.fillText(`→ ${hovered.name}`, 16, height - 16);
      }
    }

    function draw() {
      if (!stars.length) {
        ctx.fillStyle = "#020408";
        ctx.fillRect(0, 0, width, height);
        drawOverlay(0);
        return;
      }
      if (!isDragging && (Math.abs(vel.x) > 0.0008 || Math.abs(vel.y) > 0.0008)) {
        cam.x += vel.x;
        cam.y += vel.y;
        vel.x *= 0.94;
        vel.y *= 0.94;
      }
      const dx = cam.x - prevCam.x;
      const dy = cam.y - prevCam.y;
      flowSpeed = flowSpeed * 0.82 + Math.hypot(vel.x, vel.y) * 12 + Math.hypot(dx, dy) * 5;
      prevCam.x = cam.x;
      prevCam.y = cam.y;
      const vis = drawGalaxy();
      drawFlowStreaks();
      drawOverlay(vis);
    }

    function pickAt(mx, my) {
      return hitTestGalaxy(mx, my);
    }

    function hitTestGalaxy(mx, my) {
      const band = currentBand();
      let best = null;
      let bestD = 1e9;
      const pool = lastGalaxyVisible.length
        ? lastGalaxyVisible
        : starPool(band)
            .slice(0, 400)
            .map((star) => {
              const p = projectStar(star);
              const r = starRadius(star, p.par, band);
              return { star, sx: p.sx, sy: p.sy, r };
            })
            .filter((v) => Number.isFinite(v.r));

      for (const v of pool) {
        const hit = Math.max(v.r + 14, v.star.named ? 22 : 14);
        const d = Math.hypot(mx - v.sx, my - v.sy);
        if (d < hit && d < bestD) {
          bestD = d;
          best = { type: "star", id: v.star.id, name: v.star.name || "Star" };
        }
      }
      return best;
    }

    function loop() {
      try {
        draw();
        drawErrorLogged = false;
      } catch (err) {
        if (!drawErrorLogged) {
          console.error("[SpaceStarfield]", err);
          drawErrorLogged = true;
        }
      }
      animId = requestAnimationFrame(loop);
    }

    function setGalaxyZoomSlider(val) {
      setGalaxyLogZoom(val, width / 2, height / 2);
    }

    function setZoomSlider(val) {
      setGalaxyZoomSlider(Math.max(MIN_LOG_GALAXY, Math.min(MAX_LOG_GALAXY, Number(val))));
    }

    function resetView() {
      vel = { x: 0, y: 0 };
      cam = { x: 0, y: 0, logZoom: -0.4 };
    }

    function jumpToLayer(layerId) {
      const layer = COSMOS_LAYERS.find((l) => l.id === layerId);
      if (!layer) return;
      setGalaxyLogZoom(layer.logZoom, width / 2, height / 2);
    }

    function getZoomInfo() {
      return { mode: currentBand(), logZoom: cam.logZoom, min: MIN_LOG_GALAXY, max: MAX_LOG_GALAXY };
    }

    function commitPick(hit) {
      if (!hit?.id || hit.type !== "star") return;
      vel = { x: 0, y: 0 };
      onSelect(hit);
    }

    function bindEvents() {
      if (canvas.dataset.spaceExplorerBound) return;
      canvas.dataset.spaceExplorerBound = "1";
      bindAbort = new AbortController();
      const { signal } = bindAbort;
      const opt = { signal };

      dragPan = window.SpacePanDrag.attach(canvas, {
        onPanStart(loc) {
          isDragging = true;
          vel = { x: 0, y: 0 };
          pickAtDown = pickAt(loc.mx, loc.my);
          dragPan._start = { camX: cam.x, camY: cam.y };
        },
        onPanMove({ dx, dy, vx, vy, shift }) {
          const s = dragPan._start;
          if (!s) return;
          const f = galaxyPanFactor(shift);
          cam.x = s.camX - dx * f;
          cam.y = s.camY - dy * f;
          vel.x = -vx * f * 0.022;
          vel.y = -vy * f * 0.022;
        },
        onPanEnd({ moved, mx, my }) {
          isDragging = false;
          dragPan._start = null;
          if (moved < 5) {
            vel.x = 0;
            vel.y = 0;
          }
          if (moved < 8) commitPick(pickAt(mx, my) || pickAtDown);
          pickAtDown = null;
          hovered = pickAt(mx, my);
          canvas.style.cursor = hovered ? "pointer" : "grab";
        },
        onHover(loc) {
          if (dragPan?.isDragging?.()) return;
          hovered = pickAt(loc.mx, loc.my);
          canvas.style.cursor = hovered ? "pointer" : "grab";
        },
      });
      dragPan.bind();

      canvas.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          const rect = canvas.getBoundingClientRect();
          const sx = e.clientX - rect.left;
          const sy = e.clientY - rect.top;
          const delta = -e.deltaY * 0.0018;
          setGalaxyLogZoom(cam.logZoom + delta * 2.2, sx, sy);
        },
        { passive: false, signal }
      );

      canvas.addEventListener(
        "dblclick",
        (e) => {
          const rect = canvas.getBoundingClientRect();
          const mx = e.clientX - rect.left;
          const my = e.clientY - rect.top;
          const hit = pickAt(mx, my);
          if (hit?.type === "star") commitPick(hit);
          else setGalaxyLogZoom(cam.logZoom + 0.35, mx, my);
        },
        opt
      );

      window.addEventListener(
        "keydown",
        (e) => {
          if (e.target.closest("input, textarea, select")) return;
          if (e.key === "Enter" && hovered?.type === "star") {
            onSelect(hovered);
            return;
          }
          const step = galaxyPanFactor(e.shiftKey) * 0.35;
          if (e.key === "ArrowLeft") cam.x -= step * 8;
          if (e.key === "ArrowRight") cam.x += step * 8;
          if (e.key === "ArrowUp") cam.y -= step * 8;
          if (e.key === "ArrowDown") cam.y += step * 8;
          if (e.key === "+" || e.key === "=") setGalaxyLogZoom(cam.logZoom + 0.35, width / 2, height / 2);
          if (e.key === "-") setGalaxyLogZoom(cam.logZoom - 0.35, width / 2, height / 2);
        },
        opt
      );

      canvas.style.cursor = "grab";
      window.addEventListener("resize", resize, opt);
    }

    function setData(starList) {
      stars = Array.isArray(starList) ? starList : [];
      starByName = new Map();
      for (const s of stars) {
        if (s.named && s.name) starByName.set(s.name, s);
      }
      lastGalaxyVisible = [];
    }

    function pause() {
      if (animId) cancelAnimationFrame(animId);
      animId = null;
    }

    function resume() {
      resize();
      if (!animId) loop();
    }

    function start(options = {}) {
      resize();
      prevCam = { x: cam.x, y: cam.y };
      if (!options.externalInput) bindEvents();
      if (!animId) loop();
    }

    function destroy() {
      pause();
      dragPan?.destroy();
      dragPan = null;
      bindAbort?.abort();
      bindAbort = null;
      delete canvas.dataset.spaceExplorerBound;
    }

    function setShowLabels(on) {
      showLabels = Boolean(on);
    }

    function panByPixels(dx, dy, shift) {
      const f = galaxyPanFactor(shift);
      cam.x -= dx * f;
      cam.y -= dy * f;
      vel.x = -dx * f * 0.028;
      vel.y = -dy * f * 0.028;
    }

    function pickAtScreen(mx, my) {
      return pickAt(mx, my);
    }

    return {
      start,
      pause,
      resume,
      destroy,
      setData,
      resetView,
      jumpToLayer,
      setShowLabels,
      setZoomSlider,
      setGalaxyZoomSlider,
      getZoomInfo,
      panByPixels,
      pickAtScreen,
      commitPick,
      COSMOS_LAYERS,
    };
  }

  return { create, COSMOS_LAYERS };
})();