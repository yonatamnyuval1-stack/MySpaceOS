window.SpaceEarthfield = (function () {
  const KM_PER_DEG = 111.32;
  const MIN_LOG = -2.2;
  const MAX_LOG = 4.5;
  const BASE_PX_PER_DEG = 2.8;

  function hashColor(code) {
    let h = 0;
    for (let i = 0; i < (code || "").length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    return `hsla(${hue}, 42%, 38%, 0.72)`;
  }

  function pointInRing(lon, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      const intersect = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function pointInGeometry(lon, lat, geom) {
    if (!geom) return false;
    if (geom.type === "Polygon") {
      if (!geom.rings?.[0] || !pointInRing(lon, lat, geom.rings[0])) return false;
      for (let r = 1; r < geom.rings.length; r++) {
        if (pointInRing(lon, lat, geom.rings[r])) return false;
      }
      return true;
    }
    if (geom.type === "MultiPolygon") {
      for (const poly of geom.polygons || []) {
        if (poly?.[0] && pointInRing(lon, lat, poly[0])) {
          let inHole = false;
          for (let h = 1; h < poly.length; h++) {
            if (pointInRing(lon, lat, poly[h])) inHole = true;
          }
          if (!inHole) return true;
        }
      }
    }
    return false;
  }

  function computeBbox(geom) {
    let minLon = 180;
    let maxLon = -180;
    let minLat = 90;
    let maxLat = -90;
    const rings = [];
    if (geom?.type === "Polygon") rings.push(...(geom.rings || []));
    if (geom?.type === "MultiPolygon") {
      for (const p of geom.polygons || []) rings.push(...p);
    }
    for (const ring of rings) {
      for (const [lon, lat] of ring) {
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
    }
    return { minLon, maxLon, minLat, maxLat };
  }

  function create(canvas, options = {}) {
    const ctx = canvas.getContext("2d");
    const onSelect = options.onSelect || (() => {});
    const onDive = options.onDive || (() => {});

    let countries = [];
    let cities = [];
    let places = [];
    let oceanSites = [];
    let cityGrid = new Map();
    let placeGrid = new Map();
    const GRID_DEG = 4;
    let width = 0;
    let height = 0;
    let cam = { lon: 10, lat: 20, logZoom: -0.6 };
    let vel = { lon: 0, lat: 0 };
    let dragging = false;
    let dragStart = null;
    let pickAtDown = null;
    let hovered = null;
    let showLabels = true;
    let animId = null;
    let bindAbort = null;
    let dragPan = null;
    let isDragging = false;
    let time = 0;
    let prevCam = { lon: 10, lat: 20 };
    let flowSpeed = 0;
    const imgCache = new Map();
    const lod = { cityThumb: false, places: false, placeThumb: false };

    function syncLod() {
      const z = cam.logZoom;
      if (lod.cityThumb) {
        if (z < 1.55) lod.cityThumb = false;
      } else if (z > 1.85) lod.cityThumb = true;
      if (lod.places) {
        if (z < 0.45) lod.places = false;
      } else if (z > 0.55) lod.places = true;
      if (lod.placeThumb) {
        if (z < 1.3) lod.placeThumb = false;
      } else if (z > 1.5) lod.placeThumb = true;
    }

    function gridKey(lon, lat) {
      return `${Math.floor(lon / GRID_DEG)}_${Math.floor(lat / GRID_DEG)}`;
    }

    function buildGrid(items, target) {
      target.clear();
      for (const item of items) {
        const k = gridKey(item.lon, item.lat);
        if (!target.has(k)) target.set(k, []);
        target.get(k).push(item);
      }
    }

    function itemsInView(grid, v) {
      const out = [];
      const x0 = Math.floor(v.minLon / GRID_DEG);
      const x1 = Math.floor(v.maxLon / GRID_DEG);
      const y0 = Math.floor(v.minLat / GRID_DEG);
      const y1 = Math.floor(v.maxLat / GRID_DEG);
      for (let gx = x0; gx <= x1; gx++) {
        for (let gy = y0; gy <= y1; gy++) {
          const cell = grid.get(`${gx}_${gy}`);
          if (cell) out.push(...cell);
        }
      }
      return out;
    }

    function pxPerDeg() {
      return BASE_PX_PER_DEG * 2 ** cam.logZoom;
    }

    function project(lon, lat) {
      const cosLat = Math.max(0.25, Math.cos((cam.lat * Math.PI) / 180));
      const ppd = pxPerDeg();
      return {
        sx: width / 2 + (lon - cam.lon) * ppd * cosLat,
        sy: height / 2 - (lat - cam.lat) * ppd,
        ppd,
        cosLat,
      };
    }

    function screenToLonLat(sx, sy) {
      const cosLat = Math.max(0.25, Math.cos((cam.lat * Math.PI) / 180));
      const ppd = pxPerDeg();
      return {
        lon: cam.lon + (sx - width / 2) / (ppd * cosLat),
        lat: cam.lat - (sy - height / 2) / ppd,
      };
    }

    function viewBounds() {
      const cosLat = Math.max(0.25, Math.cos((cam.lat * Math.PI) / 180));
      const ppd = pxPerDeg();
      const dLon = width / (ppd * cosLat) / 2 + 2;
      const dLat = height / ppd / 2 + 2;
      return {
        minLon: cam.lon - dLon,
        maxLon: cam.lon + dLon,
        minLat: cam.lat - dLat,
        maxLat: cam.lat + dLat,
      };
    }

    function bboxVisible(bbox) {
      const v = viewBounds();
      return !(bbox.maxLon < v.minLon || bbox.minLon > v.maxLon || bbox.maxLat < v.minLat || bbox.minLat > v.maxLat);
    }

    function panFactor(shiftKey = false) {
      const base = 0.55 / Math.max(0.3, pxPerDeg() / 3);
      return shiftKey ? base * 2.5 : base;
    }

    function landAt(lon, lat) {
      for (const c of countries) {
        if (c.bbox && !bboxVisible(c.bbox)) continue;
        if (c.geometry && pointInGeometry(lon, lat, c.geometry)) return c;
      }
      return null;
    }

    function nearestOceanSite(lon, lat) {
      let best = null;
      let bestD = 1e9;
      for (const s of oceanSites) {
        const d = Math.hypot(s.lon - lon, s.lat - lat);
        if (d < bestD) {
          bestD = d;
          best = s;
        }
      }
      return best;
    }

    function loadImage(url) {
      if (!url) return null;
      if (imgCache.has(url)) return imgCache.get(url);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        img._ready = true;
      };
      img.onerror = () => {
        img._failed = true;
      };
      img.src = url;
      imgCache.set(url, img);
      return img;
    }

    function preloadImages(urls, limit = 96) {
      const seen = new Set();
      for (const url of urls) {
        if (!url || seen.has(url) || seen.size >= limit) continue;
        seen.add(url);
        loadImage(url);
      }
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
    }

    function drawOceanBase() {
      const g = ctx.createLinearGradient(0, 0, 0, height);
      g.addColorStop(0, "#0c4a6e");
      g.addColorStop(0.45, "#0369a1");
      g.addColorStop(1, "#0f172a");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
      const landGlow = ctx.createRadialGradient(width * 0.5, height * 0.55, 0, width * 0.5, height * 0.55, width * 0.65);
      landGlow.addColorStop(0, "rgba(34, 197, 94, 0.04)");
      landGlow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = landGlow;
      ctx.fillRect(0, 0, width, height);
    }

    function drawFlowStreaks() {
      if (isDragging) return;
      const { vx, vy, mag } = flowVector();
      if (mag < 0.02) return;
      const ang = Math.atan2(vy, vx) + Math.PI;
      const cx = width * 0.5;
      const cy = height * 0.5;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      const streaks = 5;
      for (let i = 0; i < streaks; i++) {
        const t = (time * 0.02 + i / streaks) % 1;
        const x = -width * 0.35 + t * width * 0.7;
        ctx.strokeStyle = `rgba(180, 230, 255, ${0.06 + mag * 0.15})`;
        ctx.lineWidth = 1 + i * 0.2;
        ctx.beginPath();
        ctx.moveTo(x, -8 + i * 3);
        ctx.lineTo(x + 40 + mag * 80, -8 + i * 3);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawPath(ring) {
      if (!ring?.length) return;
      const p0 = project(ring[0][0], ring[0][1]);
      ctx.moveTo(p0.sx, p0.sy);
      for (let i = 1; i < ring.length; i++) {
        const p = project(ring[i][0], ring[i][1]);
        ctx.lineTo(p.sx, p.sy);
      }
      ctx.closePath();
    }

    function drawCountries() {
      const v = viewBounds();
      for (const c of countries) {
        if (c.bbox && !bboxVisible(c.bbox)) continue;
        if (!c.geometry) {
          const p = project(c.lon, c.lat);
          const r = Math.max(4, Math.sqrt((c.population || 1) / 800000));
          ctx.fillStyle = hashColor(c.code);
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }
        const fill = hashColor(c.code);
        ctx.fillStyle = fill;
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = cam.logZoom > 1 ? 1.1 : 0.8;
        if (c.geometry.type === "Polygon") {
          for (const ring of c.geometry.rings || []) {
            ctx.beginPath();
            drawPath(ring);
            ctx.fill("evenodd");
            ctx.stroke();
          }
        } else if (c.geometry.type === "MultiPolygon") {
          for (const poly of c.geometry.polygons || []) {
            for (const ring of poly) {
              ctx.beginPath();
              drawPath(ring);
              ctx.fill("evenodd");
              ctx.stroke();
            }
          }
        }
      }
    }

    function cityRadius(pop) {
      return Math.max(2.5, Math.min(9, 2 + Math.log10((pop || 100000) + 1)));
    }

    function drawCountryLabels() {
      if (!showLabels || cam.logZoom < -0.3 || cam.logZoom > 2.2) return;
      const v = viewBounds();
      ctx.font = "11px Segoe UI, system-ui, sans-serif";
      ctx.textAlign = "center";
      for (const c of countries) {
        if (!c.geometry || !c.name) continue;
        if (c.lon < v.minLon || c.lon > v.maxLon || c.lat < v.minLat || c.lat > v.maxLat) continue;
        const p = project(c.lon, c.lat);
        if (p.sx < 20 || p.sx > width - 20 || p.sy < 20 || p.sy > height - 20) continue;
        ctx.fillStyle = "rgba(230, 245, 255, 0.55)";
        ctx.fillText(c.name, p.sx, p.sy);
      }
    }

    function drawThumbAt(p, url, size) {
      if (isDragging) return false;
      const img = loadImage(url);
      if (!img?.complete || !img.naturalWidth || img._failed) return false;
      const s = size;
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, s * 0.5, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, p.sx - s * 0.5, p.sy - s * 0.5, s, s);
      ctx.restore();
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, s * 0.5, 0, Math.PI * 2);
      ctx.stroke();
      return true;
    }

    function drawCities() {
      if (cam.logZoom < -0.8) return;
      const v = viewBounds();
      const visible = itemsInView(cityGrid, v);
      for (const city of visible) {
        if (city.lon < v.minLon || city.lon > v.maxLon || city.lat < v.minLat || city.lat > v.maxLat) continue;
        const p = project(city.lon, city.lat);
        const r = cityRadius(city.population) * Math.min(2, 0.6 + cam.logZoom * 0.35);
        ctx.fillStyle = city.capital ? "rgba(250, 204, 21, 0.9)" : "rgba(255, 255, 255, 0.75)";
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
        ctx.fill();
        if (lod.cityThumb && city.image) {
          drawThumbAt(p, city.image, Math.min(28, r * 4));
        }
        if (showLabels && (cam.logZoom > 0.2 || city.capital)) {
          ctx.font = `${city.capital ? 11 : 10}px Segoe UI, system-ui, sans-serif`;
          ctx.fillStyle = "rgba(240, 250, 255, 0.9)";
          ctx.textAlign = "center";
          ctx.fillText(city.name, p.sx, p.sy - r - 4);
        }
      }
    }

    function drawPlaces() {
      if (!lod.places) return;
      const v = viewBounds();
      const visible = itemsInView(placeGrid, v);
      for (const pl of visible) {
        if (pl.lon < v.minLon || pl.lon > v.maxLon || pl.lat < v.minLat || pl.lat > v.maxLat) continue;
        const p = project(pl.lon, pl.lat);
        const r = 6 + Math.min(8, cam.logZoom * 2);
        if (lod.placeThumb && pl.image) {
          if (drawThumbAt(p, pl.image, Math.min(36, r * 3.5))) {
            if (showLabels && cam.logZoom > 1.6) {
              ctx.font = "10px Segoe UI, sans-serif";
              ctx.fillStyle = "#fef3c7";
              ctx.textAlign = "center";
              ctx.fillText(pl.name, p.sx, p.sy + r + 14);
            }
            continue;
          }
        }
        ctx.fillStyle = pl.type === "street" ? "rgba(251, 191, 36, 0.85)" : "rgba(244, 114, 182, 0.9)";
        ctx.beginPath();
        ctx.moveTo(p.sx, p.sy - r);
        ctx.lineTo(p.sx + r, p.sy + r * 0.6);
        ctx.lineTo(p.sx - r, p.sy + r * 0.6);
        ctx.closePath();
        ctx.fill();
        if (showLabels && cam.logZoom > 1.2) {
          ctx.font = "10px Segoe UI, sans-serif";
          ctx.fillStyle = "#fef3c7";
          ctx.fillText(pl.name, p.sx, p.sy + r + 10);
        }
      }
    }

    function drawGrid() {
      const step = cam.logZoom < 0 ? 10 : cam.logZoom < 2 ? 2 : 0.5;
      const v = viewBounds();
      ctx.strokeStyle = "rgba(180, 220, 255, 0.08)";
      ctx.lineWidth = 1;
      const lon0 = Math.floor(v.minLon / step) * step;
      for (let lon = lon0; lon <= v.maxLon; lon += step) {
        const a = project(lon, v.minLat);
        const b = project(lon, v.maxLat);
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
      }
      const lat0 = Math.floor(v.minLat / step) * step;
      for (let lat = lat0; lat <= v.maxLat; lat += step) {
        const a = project(v.minLon, lat);
        const b = project(v.maxLon, lat);
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
      }
    }

    function flowVector() {
      const vx = vel.lon * 18 + (cam.lon - prevCam.lon) * 6;
      const vy = vel.lat * 18 + (cam.lat - prevCam.lat) * 6;
      return { vx, vy, mag: Math.hypot(vx, vy) };
    }

    function drawHud(overWater) {
      const { mag } = flowVector();
      const moving = flowSpeed > 0.002;
      const ppd = pxPerDeg();
      const kmPerPx = 1 / (ppd * KM_PER_DEG * Math.max(0.25, Math.cos((cam.lat * Math.PI) / 180)));

      ctx.fillStyle = "rgba(2, 12, 28, 0.8)";
      ctx.fillRect(8, 8, 360, 88);
      ctx.font = "12px Segoe UI, system-ui, sans-serif";
      ctx.fillStyle = "#bae6fd";
      ctx.textAlign = "left";
      ctx.fillText(
        `Earth · ${cam.lat.toFixed(2)}°N ${cam.lon.toFixed(2)}°E · ${moving ? "Moving" : "Still"}`,
        16,
        26
      );
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(
        `Scale ~${(kmPerPx * 100).toFixed(0)} km / 100px · zoom ${cam.logZoom.toFixed(1)} · ${places.length} sites`,
        16,
        42
      );
      const barW = 100;
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(16, 52, barW, 6);
      ctx.fillStyle = moving ? "#34d399" : "#64748b";
      ctx.fillRect(16, 52, barW * Math.min(1, flowSpeed * 5), 6);

      if (overWater) {
        ctx.fillStyle = "#7dd3fc";
        ctx.fillText("Ocean — use Dive to enter underwater realm", 16, 72);
      } else if (hovered) {
        ctx.fillStyle = "#fcd34d";
        ctx.fillText(hovered.name, 16, 72);
      }

      const cx = width - 36;
      const cy = 40;
      const { vx, vy } = flowVector();
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.stroke();
      if (mag > 0.002) {
        ctx.strokeStyle = "#7ee8c8";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + vx * 30, cy - vy * 30);
        ctx.stroke();
      }
    }

    function pickAt(sx, sy) {
      const { lon, lat } = screenToLonLat(sx, sy);
      let best = null;
      let bestD = 1e9;

      const v = viewBounds();
      const nearPlaces = cam.logZoom >= 0.4 ? itemsInView(placeGrid, v) : [];
      for (const pl of nearPlaces) {
        const p = project(pl.lon, pl.lat);
        const d = Math.hypot(sx - p.sx, sy - p.sy);
        if (d < 14 && d < bestD) {
          bestD = d;
          best = { type: "place", id: pl.id, name: pl.name, lon: pl.lon, lat: pl.lat };
        }
      }

      const nearCities = itemsInView(cityGrid, v);
      for (const city of nearCities) {
        const p = project(city.lon, city.lat);
        const d = Math.hypot(sx - p.sx, sy - p.sy);
        const hit = cityRadius(city.population) + 8;
        if (d < hit && d < bestD) {
          bestD = d;
          best = { type: "city", id: city.id, name: city.name, country: city.country };
        }
      }

      const land = landAt(lon, lat);
      if (land && bestD > 20) {
        return { type: "country", id: land.id, name: land.name, code: land.code };
      }
      if (!land) {
        return { type: "ocean", lon, lat, name: "Open ocean" };
      }
      return best;
    }

    function draw() {
      time += 1;
      syncLod();
      if (!isDragging && (Math.abs(vel.lon) > 1e-5 || Math.abs(vel.lat) > 1e-5)) {
        cam.lon += vel.lon;
        cam.lat += vel.lat;
        vel.lon *= 0.94;
        vel.lat *= 0.94;
      }
      const dx = cam.lon - prevCam.lon;
      const dy = cam.lat - prevCam.lat;
      flowSpeed = flowSpeed * 0.82 + Math.hypot(vel.lon, vel.lat) * 12 + Math.hypot(dx, dy) * 5;
      prevCam.lon = cam.lon;
      prevCam.lat = cam.lat;

      drawOceanBase();
      drawFlowStreaks();
      drawGrid();
      drawCountries();
      drawCountryLabels();
      drawCities();
      drawPlaces();

      const centerLand = landAt(cam.lon, cam.lat);
      drawHud(!centerLand);
    }

    function loop() {
      draw();
      animId = requestAnimationFrame(loop);
    }

    function setData(data) {
      countries = (data.countries || []).map((c) => ({
        ...c,
        bbox: c.geometry ? computeBbox(c.geometry) : {
          minLon: c.lon - 2,
          maxLon: c.lon + 2,
          minLat: c.lat - 2,
          maxLat: c.lat + 2,
        },
      }));
      cities = data.cities || [];
      places = data.places || [];
      oceanSites = data.oceanSites || [];
      buildGrid(cities, cityGrid);
      buildGrid(places, placeGrid);
      syncLod();
      const urls = [];
      for (const c of cities) {
        if (c.image) urls.push(c.image);
      }
      for (const p of places) {
        if (p.image) urls.push(p.image);
      }
      preloadImages(urls);
    }

    function commitPick(hit) {
      if (!hit) return;
      vel = { lon: 0, lat: 0 };
      if (hit.type === "ocean") {
        const site = nearestOceanSite(hit.lon, hit.lat);
        onDive(site || { id: "pacific", oceanRegion: "open_pacific" });
        return;
      }
      onSelect(hit);
    }

    function bindEvents() {
      if (canvas.dataset.spaceEarthBound) return;
      canvas.dataset.spaceEarthBound = "1";
      bindAbort = new AbortController();
      const { signal } = bindAbort;
      const opt = { signal };

      dragPan = window.SpacePanDrag.attach(canvas, {
        onPanStart(loc) {
          isDragging = true;
          dragging = true;
          vel = { lon: 0, lat: 0 };
          const cosLat = Math.max(0.25, Math.cos((cam.lat * Math.PI) / 180));
          const ppd = pxPerDeg();
          pickAtDown = pickAt(loc.mx, loc.my);
          dragPan._start = { lon: cam.lon, lat: cam.lat, cosLat, ppd };
        },
        onPanMove({ dx, dy, vx, vy, shift, mx, my }) {
          const s = dragPan._start;
          if (!s) return;
          const f = panFactor(shift);
          cam.lon = s.lon - (dx / (s.ppd * s.cosLat)) * f;
          cam.lat = s.lat + (dy / s.ppd) * f;
          vel.lon = -(vx / (s.ppd * s.cosLat)) * f * 0.02;
          vel.lat = (vy / s.ppd) * f * 0.02;
        },
        onPanEnd({ moved, mx, my }) {
          isDragging = false;
          dragging = false;
          dragPan._start = null;
          if (moved < 5) {
            vel.lon = 0;
            vel.lat = 0;
          }
          if (moved < 8) commitPick(pickAt(mx, my) || pickAtDown);
          pickAtDown = null;
          hovered = pickAt(mx, my);
          canvas.style.cursor = hovered?.type === "ocean" ? "cell" : hovered ? "pointer" : "grab";
        },
        onHover(loc) {
          if (dragPan?.isDragging?.()) return;
          hovered = pickAt(loc.mx, loc.my);
          canvas.style.cursor = hovered?.type === "ocean" ? "cell" : hovered ? "pointer" : "grab";
        },
      });
      dragPan.bind();

      canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const before = screenToLonLat(e.clientX - rect.left, e.clientY - rect.top);
        cam.logZoom = Math.max(MIN_LOG, Math.min(MAX_LOG, cam.logZoom + -e.deltaY * 0.002));
        const after = screenToLonLat(e.clientX - rect.left, e.clientY - rect.top);
        cam.lon += before.lon - after.lon;
        cam.lat += before.lat - after.lat;
      }, { passive: false, signal });

      window.addEventListener("keydown", (e) => {
        if (e.target.closest("input, textarea, select")) return;
        const step = 0.35 / panFactor(e.shiftKey);
        if (e.key === "ArrowLeft") cam.lon -= step;
        if (e.key === "ArrowRight") cam.lon += step;
        if (e.key === "ArrowUp") cam.lat += step;
        if (e.key === "ArrowDown") cam.lat -= step;
      }, opt);

      window.addEventListener("resize", resize, opt);
      canvas.style.cursor = "grab";
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
      prevCam = { lon: cam.lon, lat: cam.lat };
      if (!options.externalInput) bindEvents();
      loop();
    }

    function destroy() {
      pause();
      dragPan?.destroy();
      dragPan = null;
      bindAbort?.abort();
      bindAbort = null;
      delete canvas.dataset.spaceEarthBound;
    }

    function resetView() {
      cam = { lon: 10, lat: 20, logZoom: -0.6 };
      vel = { lon: 0, lat: 0 };
      prevCam = { ...cam };
    }

    function setShowLabels(on) {
      showLabels = on;
    }

    function setZoomSlider(val) {
      cam.logZoom = Math.max(MIN_LOG, Math.min(MAX_LOG, val));
    }

    function getZoomInfo() {
      return { mode: "earth", logZoom: cam.logZoom, min: MIN_LOG, max: MAX_LOG };
    }

    function jumpTo(lon, lat, logZ) {
      cam.lon = lon;
      cam.lat = lat;
      if (logZ != null) cam.logZoom = logZ;
    }

    function getCam() {
      return { ...cam };
    }

    function diveHere() {
      const site = nearestOceanSite(cam.lon, cam.lat);
      onDive(site || { id: "pacific", oceanRegion: "open_pacific" });
    }

    function panByPixels(dx, dy, shift) {
      const cosLat = Math.max(0.25, Math.cos((cam.lat * Math.PI) / 180));
      const ppd = pxPerDeg();
      const f = panFactor(shift);
      cam.lon -= (dx / (ppd * cosLat)) * f;
      cam.lat += (dy / ppd) * f;
      vel.lon = -(dx / (ppd * cosLat)) * f * 0.018;
      vel.lat = (dy / ppd) * f * 0.018;
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
      setShowLabels,
      setZoomSlider,
      getZoomInfo,
      jumpTo,
      getCam,
      diveHere,
      panByPixels,
      pickAtScreen,
      commitPick,
    };
  }

  return { create, KM_PER_DEG };
})();