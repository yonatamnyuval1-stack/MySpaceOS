window.SpaceUnifiedfield = (function () {
  const W = window.SpaceWorldScale;
  const LOG_TO_SPACE = 3.96;
  const LOG_TO_EARTH = 3.88;
  const LOG_EXIT_OCEAN = 3.82;

  function lonLatToOceanXY(lon, lat) {
    return { x: lon * 9.5, y: lat * 9.5 };
  }

  function create(canvas, options = {}) {
    const onSelect = options.onSelect || (() => {});
    const onBandChange = options.onBandChange || (() => {});

    let worldLog = W.LOG_SURFACE;
    let lon = 12;
    let lat = 32;
    let renderer = "earth";
    let displayBand = "earth";
    let wantOcean = false;

    let earth = null;
    let ocean = null;
    let cosmos = null;
    let active = null;
    let fieldsReady = false;

    let earthData = null;
    let oceanData = null;
    let cosmosData = null;

    let dragPan = null;
    let pickAtDown = null;
    let bindAbort = null;
    let showLabels = true;
    let wheelAccum = 0;
    let uiSyncTimer = null;

    function pullLonLatFromEarth() {
      if (!earth?.getCam) return;
      const c = earth.getCam();
      lon = c.lon;
      lat = c.lat;
    }

    function updateDisplayBand() {
      if (wantOcean) {
        displayBand = "ocean";
        return;
      }
      displayBand = W.bandFromLog(worldLog, displayBand === "ocean" ? "earth" : displayBand, {
        allowOcean: false,
      });
    }

    function syncActiveFromWorld() {
      if (!active) return;
      try {
        if (renderer === "earth" && earth) {
          earth.jumpTo(lon, lat, W.earthLogZoom(worldLog));
        } else if (renderer === "ocean" && ocean) {
          const xy = lonLatToOceanXY(lon, lat);
          ocean.setCamXY(xy.x, xy.y);
        } else if (renderer === "space" && cosmos) {
          cosmos.applyWorldLog(worldLog);
        }
      } catch {
      }
    }

    function ensureFields() {
      if (fieldsReady) return;
      const ext = { externalInput: true };

      earth = window.SpaceEarthfield.create(canvas, {
        onSelect,
        onDive() {
          enterOcean();
        },
      });
      ocean = window.SpaceOceanfield.create(canvas, { onSelect });
      cosmos = window.SpaceStarfield.create(canvas, {
        onSelect,
        onModeChange() {
          scheduleUiSync();
        },
      });

      if (earthData) earth.setData(earthData);
      if (oceanData) ocean.setData(oceanData.creatures || []);
      if (cosmosData) cosmos.setData(cosmosData.stars || [], cosmosData.bodies || []);

      earth.start(ext);
      ocean.start(ext);
      cosmos.start(ext);

      earth.pause();
      ocean.pause();
      cosmos.pause();

      earth.setShowLabels?.(showLabels);
      ocean.setShowLabels?.(showLabels);
      cosmos.setShowLabels?.(showLabels);

      fieldsReady = true;
    }

    function setActiveRenderer(next) {
      if (renderer === next && active) {
        syncActiveFromWorld();
        return;
      }

      ensureFields();

      if (renderer === "earth" && earth) pullLonLatFromEarth();

      earth?.pause?.();
      ocean?.pause?.();
      cosmos?.pause?.();

      renderer = next;
      if (renderer === "earth") {
        earth.resume();
        active = earth;
      } else if (renderer === "ocean") {
        ocean.resume();
        active = ocean;
        const xy = lonLatToOceanXY(lon, lat);
        ocean.setCamXY(xy.x, xy.y);
      } else {
        cosmos.resume();
        active = cosmos;
      }

      syncActiveFromWorld();
      scheduleUiSync(true);
    }

    function resolveRenderer() {
      if (wantOcean) return "ocean";
      if (renderer === "earth") {
        return worldLog >= LOG_TO_SPACE ? "space" : "earth";
      }
      if (renderer === "space") {
        return worldLog < LOG_TO_EARTH ? "earth" : "space";
      }
      if (renderer === "ocean") return "ocean";
      return worldLog < LOG_TO_EARTH ? "earth" : "space";
    }

    function enterOcean() {
      pullLonLatFromEarth();
      wantOcean = true;
      displayBand = "ocean";
      setActiveRenderer("ocean");
    }

    function exitOcean() {
      wantOcean = false;
      worldLog = Math.max(W.LOG_MIN, worldLog);
      updateDisplayBand();
      setActiveRenderer(worldLog >= LOG_TO_SPACE ? "space" : "earth");
    }

    function scheduleUiSync(immediate) {
      if (immediate) {
        onBandChange(getBand());
        return;
      }
      if (uiSyncTimer) return;
      uiSyncTimer = setTimeout(() => {
        uiSyncTimer = null;
        onBandChange(getBand());
      }, 80);
    }

    function applyWorldLog(log, opts = {}) {
      const prevLog = worldLog;

      if (wantOcean) {
        if (log >= LOG_EXIT_OCEAN) {
          wantOcean = false;
          worldLog = W.clampLog(log);
          updateDisplayBand();
          setActiveRenderer(worldLog >= LOG_TO_SPACE ? "space" : "earth");
          return;
        }
        const delta = log - prevLog;
        if (ocean && Math.abs(delta) > 0.0001) {
          const oi = ocean.getZoomInfo();
          ocean.setZoomSlider(oi.logZoom + delta * 3);
        }
        scheduleUiSync();
        return;
      }

      worldLog = W.clampLog(log);
      if (worldLog < W.LOG_MIN) worldLog = W.LOG_MIN;

      updateDisplayBand();
      const nextRenderer = resolveRenderer();
      if (nextRenderer !== renderer) {
        setActiveRenderer(nextRenderer);
      } else if (Math.abs(prevLog - worldLog) > 0.0004) {
        syncActiveFromWorld();
        scheduleUiSync();
      } else {
        scheduleUiSync();
      }
    }

    function getBand() {
      updateDisplayBand();
      const info = W.bandInfo(displayBand);
      const inOcean = renderer === "ocean";
      return {
        id: displayBand,
        worldLog,
        lon,
        lat,
        label: info.name,
        distance: inOcean && ocean?.getZoomInfo
          ? `${ocean.getZoomInfo().label || "underwater"}`
          : W.formatDistance(worldLog),
        hint: inOcean
          ? "Swim · drag to move · scroll up = surface · Esc = exit"
          : renderer === "earth"
            ? "Drag = map · scroll/slider = distance (up = space) · ocean via Dive only"
            : "Drag = pan · scroll/slider = distance in space",
      };
    }

    function bindInput() {
      if (canvas.dataset.spaceUnifiedBound) return;
      canvas.dataset.spaceUnifiedBound = "1";
      bindAbort = new AbortController();
      const { signal } = bindAbort;

      dragPan = window.SpacePanDrag.attach(canvas, {
        onPanStart(loc) {
          pickAtDown = active?.pickAtScreen?.(loc.mx, loc.my) || null;
        },
        onPanMove({ dx, dy, shift }) {
          active?.panByPixels?.(dx, dy, shift);
          if (renderer === "earth") pullLonLatFromEarth();
        },
        onPanEnd({ moved, mx, my }) {
          if (renderer === "earth") pullLonLatFromEarth();
          if (moved < 10 && active?.pickAtScreen) {
            const hit = active.pickAtScreen(mx, my) || pickAtDown;
            if (hit?.type === "ocean") {
              enterOcean();
              return;
            }
            if (hit?.type === "solar-enter") {
              wantOcean = false;
              worldLog = 7.5;
              updateDisplayBand();
              setActiveRenderer("space");
              cosmos?.jumpToSolar?.();
              return;
            }
            if (earth?.commitPick && hit) earth.commitPick(hit);
            else if (ocean?.commitPickHit && hit) ocean.commitPickHit(hit);
            else if (cosmos?.commitPick && hit) cosmos.commitPick(hit);
          }
          pickAtDown = null;
        },
        onHover() {
          canvas.style.cursor = "grab";
        },
      });
      dragPan.bind();

      canvas.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          wheelAccum += -e.deltaY * 0.00022 * (e.shiftKey ? 1.4 : 1);
          if (Math.abs(wheelAccum) < 0.008) return;
          const step = wheelAccum;
          wheelAccum = 0;
          applyWorldLog(worldLog + step);
        },
        { passive: false, signal }
      );

      window.addEventListener(
        "keydown",
        (e) => {
          if (e.target.closest("input, textarea, select")) return;
          const step = 0.045 * (e.shiftKey ? 1.5 : 1);
          if (e.key === "ArrowUp") applyWorldLog(worldLog + step);
          if (e.key === "ArrowDown") applyWorldLog(worldLog - step);
          if (e.key === "Escape") {
            if (renderer === "ocean") exitOcean();
            else applyWorldLog(W.LOG_SURFACE, { force: true });
          }
        },
        { signal }
      );

      canvas.style.cursor = "grab";
    }

    function setData(payload) {
      earthData = payload.earth || null;
      oceanData = payload.ocean || null;
      cosmosData = payload.cosmos || null;
      if (fieldsReady) {
        if (earthData) earth.setData(earthData);
        if (oceanData) ocean.setData(oceanData.creatures || []);
        if (cosmosData) cosmos.setData(cosmosData.stars || [], cosmosData.bodies || []);
      }
    }

    function start() {
      wantOcean = false;
      worldLog = W.LOG_SURFACE;
      displayBand = "earth";
      renderer = "earth";
      ensureFields();
      setActiveRenderer("earth");
      bindInput();
    }

    function destroy() {
      if (uiSyncTimer) clearTimeout(uiSyncTimer);
      dragPan?.destroy();
      dragPan = null;
      earth?.destroy?.();
      ocean?.destroy?.();
      cosmos?.destroy?.();
      earth = ocean = cosmos = active = null;
      fieldsReady = false;
      bindAbort?.abort();
      bindAbort = null;
      delete canvas.dataset.spaceUnifiedBound;
    }

    function resetView() {
      wantOcean = false;
      worldLog = W.LOG_SURFACE;
      lon = 12;
      lat = 32;
      displayBand = "earth";
      setActiveRenderer("earth");
      earth?.resetView?.();
      syncActiveFromWorld();
      scheduleUiSync(true);
    }

    function getZoomInfo() {
      if (renderer === "ocean" && ocean?.getZoomInfo) {
        const o = ocean.getZoomInfo();
        return {
          mode: "ocean",
          logZoom: worldLog,
          min: W.LOG_MIN,
          max: LOG_EXIT_OCEAN - 0.02,
          label: W.formatDistance(worldLog),
          oceanLog: o.logZoom,
        };
      }
      return {
        mode: displayBand,
        logZoom: worldLog,
        min: W.LOG_MIN,
        max: W.LOG_MAX,
        label: W.formatDistance(worldLog),
      };
    }

    function setZoomSlider(v) {
      applyWorldLog(Number(v));
    }

    function setShowLabels(on) {
      showLabels = on;
      earth?.setShowLabels?.(on);
      ocean?.setShowLabels?.(on);
      cosmos?.setShowLabels?.(on);
    }

    function jumpTo(lonDeg, latDeg, log) {
      lon = lonDeg;
      lat = latDeg;
      wantOcean = false;
      if (log != null) {
        worldLog = W.clampLog(log);
        updateDisplayBand();
        setActiveRenderer(resolveRenderer());
      } else {
        syncActiveFromWorld();
      }
      scheduleUiSync(true);
    }

    function jumpToBand(bandId) {
      if (bandId === "ocean") {
        enterOcean();
        return;
      }
      wantOcean = false;
      if (bandId === "earth") {
        worldLog = W.LOG_SURFACE;
        displayBand = "earth";
        setActiveRenderer("earth");
        syncActiveFromWorld();
        scheduleUiSync(true);
        return;
      }
      const target = W.BANDS.find((b) => b.id === bandId);
      if (target) {
        worldLog = W.clampLog((target.logMin + target.logMax) / 2);
        updateDisplayBand();
        setActiveRenderer("space");
      }
    }

    function diveHere() {
      enterOcean();
    }

    function jumpToSolar() {
      wantOcean = false;
      worldLog = 7.5;
      updateDisplayBand();
      setActiveRenderer("space");
      cosmos?.jumpToSolar?.();
      scheduleUiSync(true);
    }

    function enterGalaxy() {
      wantOcean = false;
      worldLog = 13;
      updateDisplayBand();
      setActiveRenderer("space");
      cosmos?.enterGalaxy?.();
      scheduleUiSync(true);
    }

    function jumpToRegion(id) {
      if (ocean?.jumpToRegion) ocean.jumpToRegion(id);
    }

    function getCam() {
      return { lon, lat, worldLog, band: displayBand, renderer };
    }

    return {
      start,
      destroy,
      setData,
      resetView,
      getZoomInfo,
      setZoomSlider,
      setShowLabels,
      jumpTo,
      jumpToBand,
      diveHere,
      jumpToSolar,
      enterGalaxy,
      jumpToRegion,
      getCam,
      getBand,
      setWorldLog: (v) => applyWorldLog(v),
    };
  }

  return { create };
})();