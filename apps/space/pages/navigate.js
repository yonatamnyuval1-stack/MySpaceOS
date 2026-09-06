window.SpacePages = window.SpacePages || {};

window.SpacePages.navigate = (function () {
  const { invoke, escapeHtml } = window.Space;

  const page = document.getElementById("page-navigate");
  const canvas = document.getElementById("starfield-canvas");
  const wrap = document.querySelector(".starfield-wrap");
  const hint = document.getElementById("nav-hint");
  const selectionBar = document.getElementById("nav-selection");
  const btnReset = document.getElementById("btn-reset-view");
  const btnSolar = document.getElementById("btn-jump-solar");
  const btnGalaxy = document.getElementById("btn-back-galaxy");
  const regionJump = document.getElementById("ocean-region-jump");
  const btnDiveOcean = document.getElementById("btn-dive-ocean");
  const btnZoomIn = document.getElementById("btn-zoom-in");
  const btnZoomOut = document.getElementById("btn-zoom-out");
  const zoomSlider = document.getElementById("zoom-slider");
  const zoomLabel = document.getElementById("zoom-label");
  const toggleLabels = document.getElementById("toggle-labels");
  const realmSwitcher = document.getElementById("realm-switcher");
  const earthJump = document.getElementById("earth-region-jump");
  const cosmosJump = document.getElementById("cosmos-layer-jump");

  let realm = "cosmos";
  let field = null;
  let loadGen = 0;
  let sliderDragging = false;
  let pendingOceanRegion = null;

  const starById = new Map();
  const creatureById = new Map();
  const countryById = new Map();
  const cityById = new Map();
  const placeById = new Map();

  function getStarById(id) {
    return starById.get(id) || null;
  }

  function getCreatureById(id) {
    return creatureById.get(id) || null;
  }

  function getRealm() {
    return realm;
  }

  function destroyField() {
    if (!field) return;
    try {
      field.destroy();
    } catch {
    }
    field = null;
  }

  function syncRealmUi() {
    page?.classList.remove("page--earth-realm", "page--ocean-realm", "page--cosmos-realm", "page--unified-realm");
    wrap?.classList.remove("starfield-wrap--earth", "starfield-wrap--ocean");
    page?.classList.add("page--cosmos-realm");
    hint.textContent = "Space — star map · drag · scroll or slider to zoom · click stars";
    realmSwitcher?.querySelectorAll("[data-realm]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.realm === "cosmos");
    });
    syncZoomUi();
  }

  function showSelectionBar(entity, hit, kind) {
    if (!selectionBar || !entity) return;
    selectionBar.classList.remove("hidden");

    if (kind === "creature") {
      selectionBar.innerHTML = `
        <strong>${escapeHtml(entity.name)}</strong>
        <span class="nav-selection-meta">~${entity.depthM} m depth</span>
        <button type="button" class="btn btn-primary btn-sm" id="nav-open-detail">Learn more →</button>`;
    } else if (kind === "earth") {
      selectionBar.innerHTML = `
        <strong>${escapeHtml(entity.name)}</strong>
        <span class="nav-selection-meta">${escapeHtml(entity.meta || "")}</span>
        <button type="button" class="btn btn-primary btn-sm" id="nav-open-detail">Learn more →</button>`;
    } else {
      selectionBar.innerHTML = `
        <strong>${escapeHtml(entity.name)}</strong>
        <span class="nav-selection-meta">${escapeHtml(entity.constellation || "")} ${entity.distLy ? `· ${entity.distLy} ly` : ""}</span>
        <button type="button" class="btn btn-primary btn-sm" id="nav-open-detail">View details →</button>`;
    }

    document.getElementById("nav-open-detail")?.addEventListener("click", () => {
      if (hit?.id) handleSelect(hit);
    });
  }

  function handleSelect(hit) {
    if (!hit) return;

    if (hit.type === "ocean" && realm === "earth") {
      pendingOceanRegion = hit.oceanRegion || hit.id || "open_pacific";
      loadOcean();
      return;
    }

    if (!hit?.id) return;

    if (hit.type === "country") {
      const c = countryById.get(hit.id) || countryById.get(`country_${hit.code}`);
      showSelectionBar({ name: hit.name, meta: c?.capital || c?.region || "" }, hit, "earth");
      window.SpaceDetail.openEarth({ id: hit.id, code: hit.code, type: "country" });
      return;
    }
    if (hit.type === "city") {
      const city = cityById.get(hit.id);
      showSelectionBar({ name: hit.name, meta: city?.country || "" }, hit, "earth");
      window.SpaceDetail.openEarth({ id: hit.id, type: "city" });
      return;
    }
    if (hit.type === "place") {
      const pl = placeById.get(hit.id);
      showSelectionBar({ name: hit.name, meta: `${pl?.type || "place"} · ${pl?.city || ""}` }, hit, "earth");
      window.SpaceDetail.openEarth({ id: hit.id, type: "place" });
      return;
    }

    if (hit.type === "creature" || String(hit.id).startsWith("creature_")) {
      const c = creatureById.get(hit.id);
      if (!c) return;
      showSelectionBar(c, hit, "creature");
      window.SpaceDetail.openCreature(hit.id, c);
      return;
    }

    if (hit.type === "star" || String(hit.id).startsWith("star_")) {
      const star = starById.get(hit.id);
      if (star) {
        showSelectionBar(star, hit, "star");
        window.SpaceDetail.open(hit.id, star);
        return;
      }
    }

    if (hit.type === "catalog" || realm === "cosmos") {
      window.SpaceDetail.open(hit.id);
    }
  }

  function applyZoom(val) {
    if (!field) return;
    const info = field.getZoomInfo();
    const clamped = Math.max(info.min, Math.min(info.max, Number(val)));
    if (typeof field.setZoomSlider === "function") {
      field.setZoomSlider(clamped);
    } else if (realm === "cosmos" && typeof field.setGalaxyZoomSlider === "function") {
      field.setGalaxyZoomSlider(clamped);
    }
  }

  function syncZoomUi() {
    if (!field || !zoomSlider) return;
    const info = field.getZoomInfo();
    zoomSlider.min = String(info.min);
    zoomSlider.max = String(info.max);
    zoomSlider.step = realm === "earth" ? "0.02" : "0.05";
    zoomSlider.disabled = false;
    if (!sliderDragging) {
      const v = Math.max(info.min, Math.min(info.max, info.logZoom));
      zoomSlider.value = String(v);
    }

    if (zoomLabel) {
      if (realm === "earth") {
        zoomLabel.textContent = `Zoom: ${info.logZoom.toFixed(1)}`;
      } else if (realm === "ocean") {
        zoomLabel.textContent = `Depth · ${info.logZoom.toFixed(1)}`;
      } else {
        zoomLabel.textContent = `Zoom: ${info.logZoom.toFixed(1)} (${info.mode || "stars"})`;
      }
    }

    btnGalaxy?.classList.add("hidden");
    btnSolar?.classList.add("hidden");
  }

  function updateZoomLabelOnly() {
    if (!field || !zoomLabel) return;
    const info = field.getZoomInfo();
    if (realm === "earth") zoomLabel.textContent = `Zoom: ${info.logZoom.toFixed(1)}`;
    else if (realm === "ocean") zoomLabel.textContent = `Depth · ${info.logZoom.toFixed(1)}`;
    else zoomLabel.textContent = `Zoom: ${info.logZoom.toFixed(1)}`;
  }

  function fillCosmosLayers() {
    if (!cosmosJump) return;
    const layers = window.SpaceStarfield?.COSMOS_LAYERS || [];
    cosmosJump.innerHTML =
      `<option value="">Space layer…</option>` +
      layers.map((l) => `<option value="${escapeHtml(l.id)}">${escapeHtml(l.name)}</option>`).join("");
  }

  function fillRegionSelect() {
    if (!regionJump) return;
    const regions = window.SpaceOceanfield?.REGIONS || [];
    regionJump.innerHTML =
      `<option value="">Go to region…</option>` +
      regions.map((r) => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}</option>`).join("");
  }

  function fillEarthJump(res) {
    if (!earthJump) return;
    const items = [];
    for (const c of res.countries || []) {
      items.push({ id: c.id, label: c.name, lon: c.lon, lat: c.lat, log: -0.6 });
    }
    for (const city of res.cities || []) {
      if (!city.capital && (city.population || 0) < 2000000) continue;
      items.push({
        id: city.id,
        label: `${city.name}${city.capital ? " ★" : ""}`,
        lon: city.lon,
        lat: city.lat,
        log: 0.2,
      });
    }
    items.sort((a, b) => a.label.localeCompare(b.label));
    earthJump.innerHTML =
      `<option value="">Go to place…</option>` +
      items
        .slice(0, 220)
        .map(
          (it) =>
            `<option value="${escapeHtml(it.id)}" data-lon="${it.lon}" data-lat="${it.lat}" data-log="${it.log}">${escapeHtml(it.label)}</option>`
        )
        .join("");
  }

  async function loadEarth() {
    const gen = ++loadGen;
    destroyField();
    realm = "earth";
    syncRealmUi();
    hint.textContent = "Loading map…";

    try {
      const res = await invoke("earth.field");
      if (gen !== loadGen) return;

      countryById.clear();
      cityById.clear();
      placeById.clear();
      for (const c of res.countries || []) {
        countryById.set(c.id, c);
        countryById.set(`country_${c.code}`, c);
      }
      for (const c of res.cities || []) cityById.set(c.id, c);
      for (const p of res.places || []) placeById.set(p.id, p);

      fillEarthJump(res);

      if (!window.SpaceEarthfield?.create) {
        hint.textContent = "Map failed to load — refresh the page";
        return;
      }

      field = window.SpaceEarthfield.create(canvas, {
        onSelect: handleSelect,
        onDive(site) {
          pendingOceanRegion = site?.oceanRegion || site?.id || "open_pacific";
          loadOcean();
        },
      });
      field.setData(res);
      field.start();
      syncLabelsToggle();
      syncZoomUi();
      hint.textContent = `${res.countryCount || res.countries?.length || 0} countries · drag the map · scroll = zoom`;
    } catch (err) {
      console.error("[Navigate] loadEarth", err);
      if (gen === loadGen) hint.textContent = `Could not load map: ${err.message || "unknown error"}`;
    }
  }

  async function loadOcean() {
    const gen = ++loadGen;
    destroyField();
    realm = "ocean";
    syncRealmUi();
    hint.textContent = "Loading ocean…";

    try {
      const res = await invoke("ocean.field");
      if (gen !== loadGen) return;

      creatureById.clear();
      for (const c of res.creatures || []) creatureById.set(c.id, c);

      if (!window.SpaceOceanfield?.create) {
        hint.textContent = "Ocean view failed to load. refresh the page";
        return;
      }

      field = window.SpaceOceanfield.create(canvas, { onSelect: handleSelect });
      field.setData(res.creatures || []);
      field.start();
      if (pendingOceanRegion) {
        field.jumpToRegion(pendingOceanRegion);
        pendingOceanRegion = null;
      }
      syncLabelsToggle();
      syncZoomUi();
      hint.textContent = "Ocean — drag to swim · scroll = depth";
    } catch (err) {
      console.error("[Navigate] loadOcean", err);
      if (gen === loadGen) hint.textContent = `Could not load ocean: ${err.message || "unknown error"}`;
    }
  }

  async function loadCosmos() {
    const gen = ++loadGen;
    destroyField();
    realm = "cosmos";
    syncRealmUi();
    hint.textContent = "Loading space…";

    try {
      const starsRes = await invoke("stars.field");
      if (gen !== loadGen) return;

      const list = starsRes.stars || [];
      if (!list.length) {
        hint.textContent = "Star catalog missing.";
        return;
      }

      starById.clear();
      for (const star of list) starById.set(star.id, star);

      if (!window.SpaceStarfield?.create) {
        hint.textContent = "Star map failed to load. refresh the page";
        return;
      }

      field = window.SpaceStarfield.create(canvas, { onSelect: handleSelect });
      field.setData(list);
      field.start();
      field.resetView();
      syncLabelsToggle();
      syncZoomUi();
      hint.textContent = `${list.length} stars, drag the map · scroll or slider to zoom`;
    } catch (err) {
      console.error("[Navigate] loadCosmos", err);
      if (gen === loadGen) {
        hint.textContent = `Could not load stars: ${err.message || "unknown error"}`;
      }
    }
  }

  async function setRealm(next) {
    const target = next === "cosmos" || !next ? "cosmos" : "cosmos";
    if (target === realm && field) return;
    selectionBar?.classList.add("hidden");
    await loadCosmos();
  }

  function syncLabelsToggle() {
    const text = document.getElementById("toggle-labels-text");
    if (text) text.textContent = "Labels";
    if (toggleLabels) {
      toggleLabels.checked = true;
      field?.setShowLabels?.(true);
    }
  }

  async function scan() {
    try {
      fillCosmosLayers();
      await setRealm("cosmos");
      canvas?.focus();
    } catch (err) {
      console.error("[Navigate] scan", err);
      if (hint) hint.textContent = `Navigation error: ${err.message || "unknown error"}`;
    }
  }

  function bind() {
    btnReset?.addEventListener("click", () => {
      field?.resetView?.();
      syncZoomUi();
      selectionBar?.classList.add("hidden");
    });

    cosmosJump?.addEventListener("change", () => {
      const id = cosmosJump.value;
      if (!id) return;
      if (realm !== "cosmos") {
        setRealm("cosmos").then(() => field?.jumpToLayer?.(id));
      } else {
        field?.jumpToLayer?.(id);
      }
      cosmosJump.value = "";
      syncZoomUi();
    });

    btnZoomIn?.addEventListener("click", () => {
      const info = field?.getZoomInfo();
      if (!info) return;
      applyZoom(info.logZoom + 0.25);
      syncZoomUi();
    });

    btnZoomOut?.addEventListener("click", () => {
      const info = field?.getZoomInfo();
      if (!info) return;
      applyZoom(info.logZoom - 0.25);
      syncZoomUi();
    });

    zoomSlider?.addEventListener("pointerdown", () => {
      sliderDragging = true;
    });
    zoomSlider?.addEventListener("pointerup", () => {
      sliderDragging = false;
      syncZoomUi();
    });
    zoomSlider?.addEventListener("input", () => {
      applyZoom(Number(zoomSlider.value));
      updateZoomLabelOnly();
    });
    zoomSlider?.addEventListener("change", () => {
      sliderDragging = false;
      syncZoomUi();
    });

    toggleLabels?.addEventListener("change", () => {
      field?.setShowLabels(toggleLabels.checked);
    });
  }

  return { id: "navigate", page, scan, bind, getStarById, getCreatureById, getRealm, setRealm };
})();
