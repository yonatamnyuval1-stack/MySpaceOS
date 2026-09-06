window.SpaceOceanfield = (function () {
  const CELL_KM = 14;
  const VIEW_RANGE_KM = 28;
  const MAX_VISIBLE = 10;
  const MIN_LOG = -0.3;
  const MAX_LOG = 4.8;

  const REGIONS = [
    { id: "shallow_reef", name: "Central reef", x: 0, y: 0, radius: 24, zone: "reef" },
    { id: "open_pacific", name: "Open ocean (west)", x: -70, y: 20, radius: 45, zone: "epipelagic" },
    { id: "open_atlantic", name: "Open ocean (east)", x: 70, y: -15, radius: 45, zone: "epipelagic" },
    { id: "twilight", name: "Twilight waters", x: 42, y: -20, radius: 32, zone: "mesopelagic" },
    { id: "twilight_south", name: "Twilight south", x: -30, y: 65, radius: 30, zone: "mesopelagic" },
    { id: "deep_trench", name: "Deep trench (north-east)", x: 55, y: 48, radius: 28, zone: "abyssal" },
    { id: "deep_abyss", name: "Abyssal plain (south-west)", x: -60, y: -70, radius: 28, zone: "abyssal" },
    { id: "kelp_coast", name: "Kelp coast", x: -18, y: -32, radius: 20, zone: "reef" },
    { id: "coral_arc", name: "Coral arc", x: 45, y: 70, radius: 22, zone: "reef" },
    { id: "polar_shallows", name: "Polar shallows", x: -25, y: 85, radius: 20, zone: "reef" },
    { id: "equator_drift", name: "Equatorial drift", x: 15, y: -75, radius: 26, zone: "epipelagic" },
  ];

  function bodyKind(c) {
    const id = c.speciesId || "";
    if (/whale|orca|beluga|narwhal|manatee|dugong|humpback|sperm/.test(id)) return "whale";
    if (/shark|manta/.test(id)) return "shark";
    if (/jelly|man_o_war/.test(id)) return "jelly";
    if (/octopus|squid|cuttlefish|nautilus|vampire_squid/.test(id)) return "cephalopod";
    if (/turtle/.test(id)) return "turtle";
    if (/dolphin|seal|walrus|otter/.test(id)) return "dolphin";
    if (/ray|stingray/.test(id)) return "ray";
    if (/coral|anemone|urchin|starfish|barnacle|tube_worm|sea_cucumber/.test(id)) return "sessile";
    if (/crab|lobster|shrimp|amphipod|isopod|sea_pig/.test(id)) return "crustacean";
    if (/eel|moray|gulper|oarfish|viperfish|dragonfish|barreleye/.test(id)) return "eel";
    return "fish";
  }

  function seedNum(c) {
    let n = 0;
    for (let i = 0; i < (c.id || "").length; i++) n += c.id.charCodeAt(i);
    return n;
  }

  function cellKey(cx, cy) {
    return `${cx},${cy}`;
  }

  function worldToCell(x, y) {
    return { cx: Math.floor(x / CELL_KM), cy: Math.floor(y / CELL_KM) };
  }

  function create(canvas, options = {}) {
    const ctx = canvas.getContext("2d");
    const onSelect = options.onSelect || (() => {});

    let allCreatures = [];
    let spatial = new Map();
    let width = 0;
    let height = 0;
    let cam = { x: 0, y: 0, logZoom: 0.85, depthM: 25 };
    let vel = { x: 0, y: 0 };
    let dragging = false;
    let dragStart = null;
    let pickAtDown = null;
    let hovered = null;
    let showLabels = true;
    let animId = null;
    let bindAbort = null;
    let dragPan = null;
    let isDragging = false;
    let lastVisible = [];
    let time = 0;
    let prevCam = { x: 0, y: 0 };
    let flowSpeed = 0;
    let wakeBubbles = [];

    const particles = [];
    const caustics = [];
    const reefRocks = [];
    const kelpStalks = [];
    const driftLines = [];

    function oceanZoom() {
      return 2 ** cam.logZoom;
    }

    function buildSpatial(list) {
      spatial = new Map();
      for (const c of list) {
        const { cx, cy } = worldToCell(c.x, c.y);
        const key = cellKey(cx, cy);
        if (!spatial.has(key)) spatial.set(key, []);
        spatial.get(key).push(c);
      }
    }

    function distKm(c) {
      return Math.hypot(c.x - cam.x, c.y - cam.y);
    }

    function creaturesInView() {
      const radiusCells = Math.ceil(VIEW_RANGE_KM / CELL_KM);
      const { cx: ccx, cy: ccy } = worldToCell(cam.x, cam.y);
      const candidates = [];

      for (let dx = -radiusCells; dx <= radiusCells; dx++) {
        for (let dy = -radiusCells; dy <= radiusCells; dy++) {
          const list = spatial.get(cellKey(ccx + dx, ccy + dy));
          if (!list) continue;
          for (const c of list) {
            const d = distKm(c);
            if (d <= VIEW_RANGE_KM) candidates.push({ creature: c, distKm: d });
          }
        }
      }

      candidates.sort((a, b) => a.distKm - b.distKm);
      return candidates.slice(0, MAX_VISIBLE);
    }

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      width = Math.max(100, rect.width);
      height = Math.max(100, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (!driftLines.length) {
        for (let i = 0; i < 48; i++) {
          driftLines.push({
            x: Math.random(),
            y: Math.random(),
            len: 0.02 + Math.random() * 0.06,
            ang: Math.random() * Math.PI * 2,
          });
        }
      }
      if (!particles.length) {
        for (let i = 0; i < 140; i++) {
          particles.push({
            x: Math.random(),
            y: Math.random(),
            z: Math.random(),
            s: 0.3 + Math.random() * 1.2,
            drift: Math.random() * Math.PI * 2,
          });
        }
      }
      if (!caustics.length) {
        for (let i = 0; i < 12; i++) {
          caustics.push({
            x: Math.random() * 2 - 1,
            y: Math.random() * 0.5,
            w: 0.15 + Math.random() * 0.25,
            phase: Math.random() * Math.PI * 2,
          });
        }
      }
      if (!reefRocks.length) {
        for (const reg of REGIONS.filter((r) => r.zone === "reef")) {
          for (let i = 0; i < 18; i++) {
            const ang = Math.random() * Math.PI * 2;
            const d = Math.random() * reg.radius;
            reefRocks.push({
              x: reg.x + Math.cos(ang) * d,
              y: reg.y + Math.sin(ang) * d,
              w: 8 + Math.random() * 24,
              h: 6 + Math.random() * 16,
              hue: 10 + Math.random() * 30,
            });
          }
        }
        for (const reg of REGIONS.filter((r) => r.id === "kelp_coast")) {
          for (let i = 0; i < 32; i++) {
            const ang = Math.random() * Math.PI * 2;
            const d = Math.random() * reg.radius;
            kelpStalks.push({
              x: reg.x + Math.cos(ang) * d,
              y: reg.y + Math.sin(ang) * d,
              h: 50 + Math.random() * 100,
              phase: Math.random() * Math.PI * 2,
            });
          }
        }
      }
    }

    function scale() {
      return 3.2 * oceanZoom();
    }

    function projectWorld(wx, wy, layerZ = 1) {
      const s = scale() * layerZ;
      return {
        sx: width / 2 + (wx - cam.x) * s,
        sy: height / 2 + (wy - cam.y) * s,
        s,
      };
    }

    function screenToWorld(sx, sy) {
      const s = scale();
      return {
        x: cam.x + (sx - width / 2) / s,
        y: cam.y + (sy - height / 2) / s,
      };
    }

    function panFactor(shiftKey = false) {
      const base = 0.42 / Math.max(0.25, oceanZoom() ** 0.5);
      return shiftKey ? base * 2.6 : base;
    }

    function setLogZoom(logZ, anchorSx, anchorSy) {
      const before = screenToWorld(anchorSx, anchorSy);
      cam.logZoom = Math.max(MIN_LOG, Math.min(MAX_LOG, logZ));
      cam.depthM = Math.round(8 + 1800 / Math.max(0.4, oceanZoom()));
      const after = screenToWorld(anchorSx, anchorSy);
      cam.x += before.x - after.x;
      cam.y += before.y - after.y;
    }

    function regionAt(x, y) {
      let best = REGIONS[1];
      let bestD = 1e9;
      for (const r of REGIONS) {
        const d = Math.hypot(x - r.x, y - r.y);
        if (d < r.radius && d < bestD) {
          bestD = d;
          best = r;
        }
      }
      return best;
    }

    function depthFactor() {
      return Math.min(1, cam.depthM / 4500);
    }

    function drawWaterColumn() {
      const reg = regionAt(cam.x, cam.y);
      const depthT = depthFactor();
      let top = "#38bdf8";
      let mid = "#0284c7";
      let bot = "#0c4a6e";

      if (reg.zone === "reef" && depthT < 0.55) {
        top = "#67e8f9";
        mid = "#06b6d4";
        bot = "#0e7490";
      } else if (reg.zone === "mesopelagic" || depthT > 0.35) {
        top = "#1e3a8a";
        mid = "#172554";
        bot = "#020617";
      } else if (reg.zone === "abyssal" || depthT > 0.7) {
        top = "#0f172a";
        mid = "#020617";
        bot = "#000000";
      }

      const g = ctx.createLinearGradient(0, 0, 0, height);
      g.addColorStop(0, top);
      g.addColorStop(0.45, mid);
      g.addColorStop(1, bot);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);

      if (depthT < 0.65) {
        const rays = ctx.createLinearGradient(width * 0.3, 0, width * 0.7, height * 0.5);
        rays.addColorStop(0, `rgba(255,255,255,${0.12 * (1 - depthT)})`);
        rays.addColorStop(1, "transparent");
        ctx.fillStyle = rays;
        ctx.fillRect(0, 0, width, height);
      }

      ctx.fillStyle = `rgba(0, 20, 40, ${depthT * 0.35})`;
      ctx.fillRect(0, 0, width, height);
    }

    function flowVector() {
      const vx = vel.x * 18 + (cam.x - prevCam.x) * 6;
      const vy = vel.y * 18 + (cam.y - prevCam.y) * 6;
      return { vx, vy, mag: Math.hypot(vx, vy) };
    }

    function drawReferenceGrid() {
      const depthT = depthFactor();
      const step = 5;
      const s = scale();
      const x0 = Math.floor(cam.x / step) * step;
      const y0 = Math.floor(cam.y / step) * step;
      ctx.strokeStyle = `rgba(180, 220, 255, ${0.07 + (1 - depthT) * 0.05})`;
      ctx.lineWidth = 1;
      for (let wx = x0 - step * 8; wx <= x0 + step * 8; wx += step) {
        const sx = width / 2 + (wx - cam.x) * s;
        if (sx < -20 || sx > width + 20) continue;
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, height);
        ctx.stroke();
      }
      for (let wy = y0 - step * 8; wy <= y0 + step * 8; wy += step) {
        const sy = height / 2 + (wy - cam.y) * s;
        if (sy < -20 || sy > height + 20) continue;
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.lineTo(width, sy);
        ctx.stroke();
      }
    }

    function drawFlowStreaks() {
      const { vx, vy, mag } = flowVector();
      if (mag < 0.02) return;
      const depthT = depthFactor();
      const ang = Math.atan2(vy, vx) + Math.PI;
      for (const ln of driftLines) {
        ln.x += vx * 0.00035 * (0.5 + ln.len * 8);
        ln.y += vy * 0.00035 * (0.5 + ln.len * 8);
        if (ln.x < 0 || ln.x > 1 || ln.y < 0 || ln.y > 1) {
          ln.x = Math.random();
          ln.y = Math.random();
        }
        const wx = cam.x + (ln.x - 0.5) * 50;
        const wy = cam.y + (ln.y - 0.5) * 50;
        const { sx, sy } = projectWorld(wx, wy, 0.7);
        const len = (30 + ln.len * 400) * Math.min(2, mag * 3);
        ctx.strokeStyle = `rgba(200, 235, 255, ${0.12 * Math.min(1, mag) * (1 - depthT * 0.5)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
        ctx.stroke();
      }
    }

    function spawnWake() {
      if (isDragging || flowSpeed < 0.04 || wakeBubbles.length > 40) return;
      if (Math.random() > 0.35) return;
      wakeBubbles.push({
        life: 50 + Math.random() * 30,
        x: (Math.random() - 0.5) * 0.3,
        y: (Math.random() - 0.5) * 0.3,
        r: 2 + Math.random() * 4,
      });
    } 

    function drawWake() {
      const { vx, vy } = flowVector();
      for (let i = wakeBubbles.length - 1; i >= 0; i--) {
        const b = wakeBubbles[i];
        b.life -= 1;
        b.x -= vx * 0.0008;
        b.y -= vy * 0.0008;
        if (b.life <= 0) {
          wakeBubbles.splice(i, 1);
          continue;
        }
        const wx = cam.x + b.x * 8;
        const wy = cam.y + b.y * 8;
        const { sx, sy } = projectWorld(wx, wy, 0.95);
        const a = (b.life / 80) * 0.35;
        ctx.fillStyle = `rgba(220, 245, 255, ${a})`;
        ctx.beginPath();
        ctx.arc(sx, sy, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawParticles() {
      const depthT = depthFactor();
      const { vx, vy } = flowVector();
      for (const p of particles) {
        const px = p.x - vx * 0.00012 * (0.4 + p.z);
        const py = p.y - vy * 0.00012 * (0.4 + p.z);
        const wx = cam.x + (px - 0.5) * 40;
        const wy = cam.y + (py - 0.5) * 40;
        const layer = 0.6 + p.z * 0.5;
        const { sx, sy } = projectWorld(wx, wy, layer);
        if (sx < -4 || sx > width + 4 || sy < -4 || sy > height + 4) continue;
        const alpha = (0.08 + p.z * 0.12) * (1 - depthT * 0.7);
        ctx.fillStyle = `rgba(220, 240, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, p.s * (0.8 + layer * 0.3), 0, Math.PI * 2);
        ctx.fill();
        p.x += Math.cos(p.drift + time * 0.002) * 0.00008;
        p.y += Math.sin(p.drift + time * 0.0015) * 0.00006;
        if (p.x < 0 || p.x > 1) p.x = 1 - p.x;
        if (p.y < 0 || p.y > 1) p.y = 1 - p.y;
      }
    }

    function drawSeafloor() {
      const depthT = depthFactor();
      const yBase = height * (0.78 + depthT * 0.12);
      const reg = regionAt(cam.x, cam.y);

      for (const c of caustics) {
        if (depthT > 0.55) break;
        const wx = cam.x + c.x * 30;
        const wy = cam.y + c.y * 30 + 15;
        const { sx, sy, s } = projectWorld(wx, wy, 0.35);
        const wobble = Math.sin(time * 0.04 + c.phase) * 8;
        const rw = (40 + c.w * 80) * (s / 8);
        ctx.fillStyle = `rgba(255,255,255,${0.04 * (1 - depthT)})`;
        ctx.beginPath();
        ctx.ellipse(sx + wobble, sy + height * 0.15, rw, rw * 0.4, c.phase, 0, Math.PI * 2);
        ctx.fill();
      }

      const sand = ctx.createLinearGradient(0, yBase - 60, 0, height);
      sand.addColorStop(0, "transparent");
      sand.addColorStop(
        0.25,
        reg.zone === "reef" ? "rgba(180, 140, 90, 0.35)" : "rgba(90, 75, 55, 0.28)"
      );
      sand.addColorStop(1, "rgba(25, 18, 12, 0.55)");
      ctx.fillStyle = sand;
      ctx.fillRect(0, yBase - 60, width, height - yBase + 60);

      for (const rock of reefRocks) {
        const { sx, sy, s } = projectWorld(rock.x, rock.y, 0.4);
        if (sx < -60 || sx > width + 60 || sy > height + 40) continue;
        const rw = rock.w * (s / 10);
        const rh = rock.h * (s / 10);
        ctx.fillStyle = `hsla(${rock.hue}, 35%, 32%, 0.55)`;
        ctx.beginPath();
        ctx.ellipse(sx, sy + rh * 0.3, rw, rh, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawKelp() {
      const depthT = depthFactor();
      if (depthT > 0.5) return;
      for (const k of kelpStalks) {
        const { sx, sy, s } = projectWorld(k.x, k.y, 0.55);
        if (sx < -40 || sx > width + 40) continue;
        const sway = Math.sin(time * 0.025 + k.phase) * 14 * (s / 6);
        const h = k.h * (s / 8);
        ctx.strokeStyle = "rgba(22, 120, 70, 0.45)";
        ctx.lineWidth = Math.max(2, s * 0.35);
        ctx.beginPath();
        ctx.moveTo(sx, sy + 10);
        ctx.quadraticCurveTo(sx + sway, sy - h * 0.45, sx + sway * 0.4, sy - h);
        ctx.stroke();
      }
    }

    function swimOffset(c) {
      const seed = c.id.charCodeAt(c.id.length - 1) || 0;
      return {
        dx: Math.sin(time * 0.018 + seed) * 0.6,
        dy: Math.cos(time * 0.014 + seed * 0.7) * 0.35,
      };
    }

    function creatureScreenSize(c, distKm) {
      const base = (c.size || 0.6) * 18;
      const near = Math.max(0.35, 1 - distKm / VIEW_RANGE_KM);
      return base * near * Math.min(2.2, oceanZoom() * 0.5);
    }

    function paintFishBody(px, col, detail) {
      const tailWag = Math.sin(time * 0.06 + detail) * 0.15;
      const grd = ctx.createLinearGradient(-px, 0, px * 1.2, 0);
      grd.addColorStop(0, "rgba(0,0,0,0.15)");
      grd.addColorStop(0.25, col);
      grd.addColorStop(0.85, shadeColor(col, -25));
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.ellipse(0, 0, px * 1.05, px * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-px * 0.95, 0);
      ctx.lineTo(-px * 1.55 + tailWag * px, -px * 0.38);
      ctx.lineTo(-px * 1.55 + tailWag * px, px * 0.38);
      ctx.closePath();
      ctx.fill();
      if (detail > 0.5) {
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath();
        ctx.arc(px * 0.55, -px * 0.12, Math.max(1.5, px * 0.1), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.arc(px * 0.58, -px * 0.1, Math.max(1, px * 0.05), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = shadeColor(col, 30);
        ctx.beginPath();
        ctx.moveTo(0, -px * 0.38);
        ctx.lineTo(px * 0.35, -px * 0.55);
        ctx.lineTo(px * 0.1, -px * 0.32);
        ctx.closePath();
        ctx.fill();
      }
    }

    function shadeColor(hex, amt) {
      const n = parseInt((hex || "#5a8fa8").replace("#", ""), 16) || 0x5a8fa8;
      const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
      const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
      const b = Math.max(0, Math.min(255, (n & 255) + amt));
      return `rgb(${r},${g},${b})`;
    }

    function paintAnimal(kind, px, col, detail, seed) {
      const w = Math.sin(time * 0.04 + seed) * 0.08;
      if (kind === "whale") {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(0, 0, px * 1.8, px * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-px * 1.6, 0);
        ctx.quadraticCurveTo(-px * 2.3, -px * 0.7 + w * px, -px * 2.1, 0);
        ctx.quadraticCurveTo(-px * 2.3, px * 0.7 - w * px, -px * 1.6, 0);
        ctx.fill();
        if (detail > 0.4) {
          ctx.fillStyle = "rgba(200,220,240,0.5)";
          ctx.beginPath();
          ctx.ellipse(px * 0.9, -px * 0.15, px * 0.35, px * 0.12, -0.3, 0, Math.PI * 2);
          ctx.fill();
        }
        return;
      }
      if (kind === "shark") {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(0, 0, px * 1.2, px * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-px, 0);
        ctx.lineTo(-px * 1.5, -px * 0.35);
        ctx.lineTo(-px * 1.5, px * 0.35);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = shadeColor(col, -40);
        ctx.beginPath();
        ctx.moveTo(px * 0.2, -px * 0.32);
        ctx.lineTo(px * 0.55, -px * 0.75);
        ctx.lineTo(px * 0.05, -px * 0.28);
        ctx.closePath();
        ctx.fill();
        return;
      }
      if (kind === "dolphin") {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(0, 0, px * 1.15, px * 0.38, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(px * 0.9, -px * 0.2);
        ctx.quadraticCurveTo(px * 1.35, -px * 0.55, px * 1.1, -px * 0.05);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-px, 0);
        ctx.lineTo(-px * 1.4, -px * 0.45);
        ctx.lineTo(-px * 1.4, px * 0.45);
        ctx.closePath();
        ctx.fill();
        return;
      }
      if (kind === "jelly") {
        const pulse = 1 + Math.sin(time * 0.05 + seed) * 0.08;
        const g = ctx.createRadialGradient(0, -px * 0.2, 0, 0, 0, px * 0.9 * pulse);
        g.addColorStop(0, "rgba(255,255,255,0.35)");
        g.addColorStop(0.5, col);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, px * 0.75 * pulse, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = `rgba(255,255,255,${0.25 * detail})`;
        ctx.lineWidth = 1;
        for (let i = -3; i <= 3; i++) {
          ctx.beginPath();
          ctx.moveTo(i * px * 0.18, px * 0.1);
          ctx.quadraticCurveTo(i * px * 0.22 + w * px, px * 0.9, i * px * 0.15, px * 1.4);
          ctx.stroke();
        }
        return;
      }
      if (kind === "cephalopod") {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(px * 0.15, 0, px * 0.55, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI - Math.PI / 2 + w;
          ctx.beginPath();
          ctx.moveTo(-px * 0.2, 0);
          ctx.quadraticCurveTo(-px * 0.9 + Math.sin(time * 0.08 + i) * px * 0.15, Math.cos(a) * px * 0.5, -px * 1.1, Math.sin(a) * px * 0.35);
          ctx.strokeStyle = shadeColor(col, -20);
          ctx.lineWidth = Math.max(1.5, px * 0.12);
          ctx.stroke();
        }
        return;
      }
      if (kind === "ray") {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(px * 1.1, 0);
        ctx.quadraticCurveTo(0, -px * 0.85, -px * 1.1, 0);
        ctx.quadraticCurveTo(0, px * 0.85, px * 1.1, 0);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-px * 1.3, 0);
        ctx.stroke();
        return;
      }
      if (kind === "turtle") {
        ctx.fillStyle = shadeColor(col, -15);
        ctx.beginPath();
        ctx.ellipse(0, 0, px * 0.85, px * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = shadeColor(col, 20);
        ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * px * 0.35, Math.sin(a) * px * 0.28, px * 0.14, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = col;
        ["-0.95,0.35", "0.95,0.35", "-0.7,-0.4", "0.7,-0.4"].forEach((pair) => {
          const [fx, fy] = pair.split(",").map(Number);
          ctx.beginPath();
          ctx.ellipse(px * fx, px * fy, px * 0.35, px * 0.15, fx > 0 ? 0.4 : -0.4, 0, Math.PI * 2);
          ctx.fill();
        });
        return;
      }
      if (kind === "sessile") {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(0, px * 0.15, px * 0.7, px * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i / 4) * Math.PI * 0.8;
          ctx.strokeStyle = shadeColor(col, 25);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * px * 0.5, Math.sin(a) * px * 0.35 + px * 0.1);
          ctx.lineTo(Math.cos(a) * px * 0.75, Math.sin(a) * px * 0.55 + px * 0.25);
          ctx.stroke();
        }
        return;
      }
      if (kind === "crustacean") {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(0, 0, px * 0.75, px * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = shadeColor(col, -30);
        ctx.lineWidth = 1.5;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(px * 0.5, i * px * 0.2);
          ctx.lineTo(px * 1.1, i * px * 0.45);
          ctx.stroke();
        }
        return;
      }
      if (kind === "eel") {
        ctx.strokeStyle = col;
        ctx.lineWidth = Math.max(2, px * 0.35);
        ctx.lineCap = "round";
        ctx.beginPath();
        for (let i = 0; i <= 8; i++) {
          const t = i / 8;
          const x = px * (1.1 - t * 2.2);
          const y = Math.sin(t * 6 + time * 0.05 + seed) * px * 0.35;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        return;
      }
      paintFishBody(px, col, detail);
    }

    function drawCreature(c, distKm) {
      const swim = swimOffset(c);
      const wx = c.x + swim.dx;
      const wy = c.y + swim.dy;
      const layer = 0.85 + (c.depthM / 5000) * 0.15;
      const { sx, sy } = projectWorld(wx, wy, layer);
      if (sx < -120 || sx > width + 120 || sy < -120 || sy > height + 120) return null;

      const px = creatureScreenSize(c, distKm);
      const depthT = depthFactor();
      const far = distKm > 14;
      const mid = distKm > 6 && distKm <= 14;
      const alpha = far ? 0.28 : mid ? 0.55 : 0.92;
      const angle = Math.atan2(swim.dy, swim.dx + 0.01);
      const col = c.color || "#5a8fa8";
      const kind = bodyKind(c);
      const detail = far ? 0.2 : mid ? 0.55 : 1;
      const seed = seedNum(c);

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(kind === "sessile" ? 0 : angle);
      ctx.globalAlpha = alpha * (1 - depthT * 0.15);

      if (far) {
        ctx.fillStyle = "rgba(12, 35, 55, 0.85)";
        ctx.beginPath();
        ctx.ellipse(0, 0, px * 0.55, px * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        paintAnimal(kind, px, col, detail, seed);
      }
      ctx.restore();

      if (showLabels && distKm < 10 && !far) {
        ctx.font = "11px Segoe UI, system-ui, sans-serif";
        ctx.fillStyle = `rgba(230, 245, 255, ${0.75 * alpha})`;
        ctx.textAlign = "center";
        ctx.fillText(c.name, sx, sy + px + 12);
      }

      return { creature: c, sx, sy, r: px + 10, distKm };
    }

    function drawScene() {
      drawWaterColumn();
      drawReferenceGrid();
      drawSeafloor();
      drawKelp();
      drawFlowStreaks();
      drawParticles();
      drawWake();

      const inView = creaturesInView();
      const visible = [];
      for (const { creature, distKm } of inView) {
        const v = drawCreature(creature, distKm);
        if (v) visible.push(v);
      }
      lastVisible = visible;
      return visible.length;
    }

    function drawHud(count) {
      const reg = regionAt(cam.x, cam.y);
      const depthT = depthFactor();
      const { vx, vy, mag } = flowVector();
      const moving = flowSpeed > 0.015;
      const status = dragging ? "Swimming" : moving ? "Drifting" : "Still";

      ctx.fillStyle = "rgba(2, 12, 28, 0.78)";
      ctx.fillRect(8, 8, 340, 72);
      ctx.font = "12px Segoe UI, system-ui, sans-serif";
      ctx.fillStyle = "#bae6fd";
      ctx.textAlign = "left";
      ctx.fillText(`${reg.name} · ${cam.depthM} m · ${status}`, 16, 26);
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(
        `Position ${cam.x.toFixed(1)}, ${cam.y.toFixed(1)} km · ${count} in view`,
        16,
        42
      );
      const barW = 120;
      const fill = Math.min(1, flowSpeed * 4);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(16, 52, barW, 6);
      ctx.fillStyle = moving ? "#34d399" : "#64748b";
      ctx.fillRect(16, 52, barW * fill, 6);
      ctx.fillStyle = "#7dd3fc";
      ctx.font = "10px Segoe UI, sans-serif";
      ctx.fillText("Movement", 142, 58);

      const cx = width - 36;
      const cy = 36;
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.stroke();
      if (mag > 0.01) {
        ctx.strokeStyle = "#7ee8c8";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx - vx * 40, cy - vy * 40);
        ctx.stroke();
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath();
        ctx.arc(cx, cy, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(width / 2 - 8, height / 2);
      ctx.lineTo(width / 2 + 8, height / 2);
      ctx.moveTo(width / 2, height / 2 - 8);
      ctx.lineTo(width / 2, height / 2 + 8);
      ctx.stroke();

      if (hovered) {
        ctx.font = "12px Segoe UI, system-ui, sans-serif";
        ctx.fillStyle = `rgba(240, 250, 255, ${0.9 - depthT * 0.3})`;
        ctx.textAlign = "left";
        ctx.fillText(hovered.name, 16, height - 14);
      }

      const vig = ctx.createRadialGradient(
        width / 2,
        height / 2,
        width * 0.2,
        width / 2,
        height / 2,
        width * 0.72
      );
      vig.addColorStop(0, "transparent");
      vig.addColorStop(1, `rgba(0, 8, 20, ${0.25 + depthT * 0.35})`);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, width, height);
    }

    function draw() {
      time += 1;
      if (!isDragging && (Math.abs(vel.x) > 0.002 || Math.abs(vel.y) > 0.002)) {
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
      spawnWake();
      const n = drawScene();
      drawHud(n);
    }

    function loop() {
      draw();
      animId = requestAnimationFrame(loop);
    }

    function hitTest(mx, my) {
      let best = null;
      let bestD = 1e9;
      for (const v of lastVisible) {
        const hit = Math.max(v.r + 10, 20);
        const d = Math.hypot(mx - v.sx, my - v.sy);
        if (d < hit && d < bestD) {
          bestD = d;
          best = { type: "creature", id: v.creature.id, name: v.creature.name, speciesId: v.creature.speciesId };
        }
      }
      return best;
    }

    function commitPick(hit) {
      if (!hit) return;
      vel = { x: 0, y: 0 };
      onSelect(hit);
    }

    function bindEvents() {
      if (canvas.dataset.spaceOceanBound) return;
      canvas.dataset.spaceOceanBound = "1";
      bindAbort = new AbortController();
      const { signal } = bindAbort;
      const opt = { signal };

      dragPan = window.SpacePanDrag.attach(canvas, {
        onPanStart(loc) {
          isDragging = true;
          dragging = true;
          vel = { x: 0, y: 0 };
          pickAtDown = hitTest(loc.mx, loc.my);
          const inv = 1 / scale();
          dragPan._start = { camX: cam.x, camY: cam.y, invScale: inv };
        },
        onPanMove({ dx, dy, vx, vy, shift }) {
          const s = dragPan._start;
          if (!s) return;
          const mult = shift ? 2.2 : 1;
          cam.x = s.camX - dx * s.invScale * mult;
          cam.y = s.camY - dy * s.invScale * mult;
          vel.x = -vx * s.invScale * mult * 0.035;
          vel.y = -vy * s.invScale * mult * 0.035;
        },
        onPanEnd({ moved, mx, my }) {
          isDragging = false;
          dragging = false;
          dragPan._start = null;
          if (moved < 5) {
            vel.x = 0;
            vel.y = 0;
          }
          if (moved < 8) commitPick(hitTest(mx, my) || pickAtDown);
          pickAtDown = null;
          hovered = hitTest(mx, my);
          canvas.style.cursor = hovered ? "pointer" : "grab";
        },
        onHover(loc) {
          if (dragPan?.isDragging?.()) return;
          hovered = hitTest(loc.mx, loc.my);
          canvas.style.cursor = hovered ? "pointer" : "grab";
        },
      });
      dragPan.bind();

      canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        setLogZoom(cam.logZoom + -e.deltaY * 0.0018, e.clientX - rect.left, e.clientY - rect.top);
      }, { passive: false, signal });

      window.addEventListener("keydown", (e) => {
        if (e.target.closest("input, textarea, select")) return;
        if (e.key === "Enter" && hovered) {
          commitPick(hovered);
          return;
        }
        const step = 1.2 / panFactor(e.shiftKey);
        if (e.key === "ArrowLeft") {
          cam.x -= step;
          vel.x = -step * 0.08;
        }
        if (e.key === "ArrowRight") {
          cam.x += step;
          vel.x = step * 0.08;
        }
        if (e.key === "ArrowUp") {
          cam.y -= step;
          vel.y = -step * 0.08;
        }
        if (e.key === "ArrowDown") {
          cam.y += step;
          vel.y = step * 0.08;
        }
        if (e.key === "+" || e.key === "=") setLogZoom(cam.logZoom + 0.25, width / 2, height / 2);
        if (e.key === "-") setLogZoom(cam.logZoom - 0.25, width / 2, height / 2);
      }, opt);

      canvas.style.cursor = "grab";
      window.addEventListener("resize", resize, opt);
    }

    function setData(creatureList) {
      allCreatures = creatureList || [];
      buildSpatial(allCreatures);
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
      loop();
    }

    function destroy() {
      pause();
      animId = null;
      dragPan?.destroy();
      dragPan = null;
      bindAbort?.abort();
      bindAbort = null;
      dragging = false;
      isDragging = false;
      hovered = null;
      delete canvas.dataset.spaceOceanBound;
    }

    function resetView() {
      cam = { x: 0, y: 0, logZoom: 0.85, depthM: 25 };
      vel = { x: 0, y: 0 };
      prevCam = { x: cam.x, y: cam.y };
      flowSpeed = 0;
      wakeBubbles = [];
    }

    function setShowLabels(on) {
      showLabels = on;
    }

    function setZoomSlider(val) {
      setLogZoom(val, width / 2, height / 2);
    }

    function getZoomInfo() {
      return { mode: "ocean", logZoom: cam.logZoom, min: MIN_LOG, max: MAX_LOG };
    }

    function jumpToRegion(id) {
      const r = REGIONS.find((x) => x.id === id);
      if (r) {
        cam.x = r.x;
        cam.y = r.y;
        cam.logZoom = r.zone === "abyssal" ? 2.2 : r.zone === "reef" ? 0.75 : 1.1;
        cam.depthM = r.zone === "abyssal" ? 3200 : r.zone === "reef" ? 18 : 120;
      }
    }

    function panByPixels(dx, dy, shift) {
      const mult = (shift ? 2.2 : 1) / scale();
      cam.x -= dx * mult;
      cam.y -= dy * mult;
      vel.x = -dx * mult * 0.02;
      vel.y = -dy * mult * 0.02;
    }

    function pickAtScreen(mx, my) {
      return hitTest(mx, my);
    }

    function commitPickHit(hit) {
      commitPick(hit);
    }

    function setCamXY(x, y) {
      cam.x = x;
      cam.y = y;
    }

    return {
      start,
      pause,
      resume,
      destroy,
      setData,
      resetView,
      setShowLabels,
      setZoomSlider,
      getZoomInfo,
      jumpToRegion,
      panByPixels,
      pickAtScreen,
      commitPickHit,
      setCamXY,
      REGIONS,
    };
  }

  return { create, REGIONS };
})();