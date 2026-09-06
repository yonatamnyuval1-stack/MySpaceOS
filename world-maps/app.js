(function () {
  const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
  const FALLBACK_STYLE = "https://demotiles.maplibre.org/style.json";
  const RTL_TEXT_PLUGIN = "assets/mapbox-gl-rtl-text.min.js";
  const WORLD_CENTER = [20, 25];
  const WORLD_ZOOM = 1.8;
  const SEARCH_DEBOUNCE_MS = 450;
  const NOTES_SOURCE = "map-notes";
  const NOTES_CIRCLES = "notes-circles";
  const NOTES_LABELS = "notes-labels";
  const ROUTES_SOURCE = "map-routes";
  const ROUTES_LINE = "routes-line";
  const ROUTES_LABELS = "routes-labels";
  const ROUTE_TTL_MS = 2 * 60 * 1000; 
  const ROUTE_MODES = {
    bus: { icon: "🚌", color: "#f59e0b", label: "bus" },
    car: { icon: "🚗", color: "#3b82f6", label: "car" },
    plane: { icon: "✈️", color: "#8b5cf6", label: "plane" },
    ship: { icon: "🚢", color: "#06b6d4", label: "ship" },
  };

  const CATEGORY_META = {
    trail: { icon: "🥾", color: "#f59e0b" },
    nature: { icon: "🌲", color: "#22c55e" },
    hotel: { icon: "🏨", color: "#8b5cf6" },
    beach: { icon: "🏖", color: "#06b6d4" },
    attraction: { icon: "⭐", color: "#ec4899" },
    restaurant: { icon: "🍽", color: "#ef4444" },
  };

  const CATEGORY_ORDER = ["trail", "nature", "hotel", "beach", "attraction", "restaurant"];

  function categoryInfo(id) {
    const meta = CATEGORY_META[id] || CATEGORY_META.attraction;
    return { ...meta, label: window.WMi18n?.categoryLabel?.(id) || id };
  }

  const ui = {
    mapEl: document.getElementById("map"),
    searchForm: document.getElementById("search-form"),
    searchInput: document.getElementById("search-input"),
    searchResults: document.getElementById("search-results"),
    profilesPanel: document.getElementById("profiles-panel"),
    profilesBody: document.getElementById("profiles-body"),
    profilesTitle: document.getElementById("profiles-title"),
    profilesBack: document.getElementById("profiles-back"),
    profilesPanelClose: document.getElementById("profiles-panel-close"),
    profilesSearchWrap: document.getElementById("profiles-search-wrap"),
    profilesSearch: document.getElementById("profiles-search"),
    btnWorld: document.getElementById("btn-world"),
    btnSettings: document.getElementById("btn-settings"),
    settingsOverlay: document.getElementById("settings-overlay"),
    settingsClose: document.getElementById("settings-close"),
    statusCoords: document.getElementById("status-coords"),
    statusPlace: document.getElementById("status-place"),
    statusZoom: document.getElementById("status-zoom"),
    mapHint: document.getElementById("map-hint"),
    contextMenu: document.getElementById("map-context-menu"),
    ctxAddNote: document.getElementById("ctx-add-note"),
    ctxCopyCoords: document.getElementById("ctx-copy-coords"),
    noteModal: document.getElementById("note-modal"),
    noteForm: document.getElementById("note-form"),
    noteModalClose: document.getElementById("note-modal-close"),
    noteCancel: document.getElementById("note-cancel"),
    noteTitle: document.getElementById("note-title"),
    noteModalCoords: document.getElementById("note-modal-coords"),
    categoryGrid: document.getElementById("category-grid"),
  };

  let map = null;
  let searchTimer = null;
  let lastSearchQuery = "";
  let reverseTimer = null;
  let hintHidden = false;
  let notes = [];
  let routes = [];
  const routeTimers = new Map();
  let noteLayerEventsWired = false;
  let activePopup = null;
  let contextLngLat = null;
  let pendingNoteLngLat = null;
  let selectedCategory = "attraction";
  let profilesView = { mode: "countries", countryCode: null };
  let profilesSearchQuery = "";
  let profileAddCategory = "attraction";
  let profileAddTimer = null;
  let profileAddSelection = null;
  let styleSwitching = false;
  let mapStyleFallbackUsed = false;
  let navControl = null;
  let htmlNoteLabels = [];

  function bind(el, event, fn) {
    el?.addEventListener(event, fn);
  }

  function useHtmlNoteLabels() {
    return window.WMi18n?.lang?.() === "he";
  }

  function t(key, vars) {
    return window.WMi18n?.t(key, vars) ?? key;
  }

  function confirmDelete(message) {
    if (window.WMSettings?.get("confirmDelete") === false) return true;
    return confirm(message);
  }

  function applySettingsEffects() {
    const showHint = window.WMSettings.get("showMapHint");
    if (ui.mapHint) {
      if (!showHint) ui.mapHint.classList.add("hidden");
      else if (!hintHidden) ui.mapHint.classList.remove("hidden");
    }
    ui.mapEl?.classList.toggle("hide-maplibre-nav", !window.WMSettings.get("showZoomControls"));

    if (map?.isStyleLoaded() && map.getLayer(NOTES_LABELS)) {
      map.setLayoutProperty(
        NOTES_LABELS,
        "visibility",
        window.WMSettings.get("showNoteLabels") && !useHtmlNoteLabels() ? "visible" : "none"
      );
    }
    syncHtmlNoteLabels();

    renderProfilesPanel();
    const settingsRoot = document.getElementById("settings-root");
    if (settingsRoot?.innerHTML && !ui.settingsOverlay?.classList.contains("hidden")) {
      window.WMSettings.render(settingsRoot);
    }
  }

  function formatCoords(lng, lat) {
    const latDir = lat >= 0 ? "N" : "S";
    const lngDir = lng >= 0 ? "E" : "W";
    return `${Math.abs(lat).toFixed(5)}° ${latDir}, ${Math.abs(lng).toFixed(5)}° ${lngDir}`;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function uid() {
    return `note_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function countryDisplayName(code, fallback) {
    const fb = fallback || t("unknownCountry");
    if (window.WMi18n?.lang?.() === "he" && code && code.length === 2) {
      try {
        const he = new Intl.DisplayNames(["he"], { type: "region" }).of(code.toUpperCase());
        if (he) return he;
      } catch {
      }
    }
    return window.WM_COUNTRIES?.englishName?.(code, fb) || fb;
  }

  function updateControlTitles() {
    if (ui.profilesBack) ui.profilesBack.setAttribute("aria-label", t("back"));
    if (ui.profilesPanelClose) ui.profilesPanelClose.setAttribute("aria-label", t("close"));
    if (ui.settingsClose) ui.settingsClose.setAttribute("aria-label", t("close"));
    if (ui.noteModalClose) ui.noteModalClose.setAttribute("aria-label", t("close"));
  }

  function refreshLanguageUi() {
    buildCategoryGrid();
    renderProfilesPanel();
    updateControlTitles();
    syncNoteLabelMode();
    if (map) {
      map.triggerRepaint();
      const c = map.getCenter();
      updateStatus(c.lng, c.lat);
    }
  }

  function countryFlag(code) {
    if (!code || code === "UNKNOWN") return "🏳";
    const c = code.toUpperCase();
    if (c.length !== 2) return "🏳";
    return String.fromCodePoint(...[...c].map((ch) => 127397 + ch.charCodeAt(0)));
  }

  function hideHint() {
    if (hintHidden || window.WMSettings?.get("showMapHint") === false) return;
    hintHidden = true;
    ui.mapHint?.classList.add("hidden");
  }

  function flyTo(lng, lat, zoom = 12, placeName = "") {
    hideHint();
    map.flyTo({ center: [lng, lat], zoom, speed: 1.4, curve: 1.2 });
    if (placeName) ui.statusPlace.textContent = placeName;
    updateStatus(lng, lat);
  }

  function updateStatus(lng, lat) {
    ui.statusCoords.textContent = formatCoords(lng, lat);
    ui.statusZoom.textContent = `${t("zoom")} ${map.getZoom().toFixed(1)}`;
  }

  function scheduleReverseGeocode(lng, lat) {
    clearTimeout(reverseTimer);
    reverseTimer = setTimeout(async () => {
      try {
        const name = await window.worldMaps.reverseGeocode(lat, lng, window.WMi18n?.lang?.() || "en");
        if (name) ui.statusPlace.textContent = name;
      } catch {
      }
    }, 600);
  }

  function hideContextMenu() {
    ui.contextMenu?.classList.add("hidden");
    contextLngLat = null;
  }

  function showContextMenu(point, lngLat) {
    contextLngLat = lngLat;
    const wrap = ui.mapEl.getBoundingClientRect();
    const left = Math.min(point.x, wrap.width - 200);
    const top = Math.min(point.y, wrap.height - 90);
    ui.contextMenu.style.left = `${Math.max(8, left)}px`;
    ui.contextMenu.style.top = `${Math.max(8, top)}px`;
    ui.contextMenu.classList.remove("hidden");
  }

  function buildCategoryGrid() {
    if (!ui.categoryGrid) return;
    ui.categoryGrid.innerHTML = "";
    for (const id of CATEGORY_ORDER) {
      const cat = categoryInfo(id);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `category-option${id === selectedCategory ? " selected" : ""}`;
      btn.dataset.category = id;
      btn.style.setProperty("--cat-color", cat.color);
      btn.innerHTML = `<span class="category-option-icon">${cat.icon}</span><span>${escapeHtml(cat.label)}</span>`;
      btn.addEventListener("click", () => selectCategory(id));
      ui.categoryGrid.appendChild(btn);
    }
  }

  function selectCategory(id) {
    if (!CATEGORY_META[id]) return;
    selectedCategory = id;
    ui.categoryGrid.querySelectorAll(".category-option").forEach((el) => {
      el.classList.toggle("selected", el.dataset.category === id);
    });
  }

  function openNoteModal(lng, lat) {
    pendingNoteLngLat = { lng, lat };
    ui.noteModalCoords.textContent = formatCoords(lng, lat);
    ui.noteTitle.value = "";
    selectCategory(selectedCategory || "attraction");
    ui.noteModal.showModal();
    setTimeout(() => ui.noteTitle.focus(), 50);
  }

  function closeNoteModal() {
    pendingNoteLngLat = null;
    ui.noteModal.close();
  }

  async function enrichNoteCountry(note) {
    try {
      const info = await window.worldMaps.reverseGeocodeCountry(note.lat, note.lng, window.WMi18n?.lang?.() || "en");
      note.countryCode = info.countryCode || "UNKNOWN";
      note.countryName = countryDisplayName(
        note.countryCode,
        info.countryName || info.displayName?.split(",").pop()?.trim() || "Unknown"
      );
    } catch {
      note.countryCode = note.countryCode || "UNKNOWN";
      note.countryName = note.countryName || "Unknown";
    }
    return note;
  }

  async function backfillCountries() {
    let changed = false;
    for (const note of notes) {
      const english = countryDisplayName(note.countryCode, note.countryName);
      if (note.countryName !== english) {
        note.countryName = english;
        changed = true;
      }
      if (note.countryCode && note.countryName) continue;
      await enrichNoteCountry(note);
      changed = true;
    }
    if (changed) await window.worldMaps.saveNotes(notes);
  }

  function notesGeoJSON() {
    return {
      type: "FeatureCollection",
      features: notes.map((note) => {
        const cat = categoryInfo(note.category);
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [note.lng, note.lat] },
          properties: {
            id: note.id,
            title: note.title,
            category: note.category,
            color: cat.color,
            countryCode: note.countryCode || "UNKNOWN",
          },
        };
      }),
    };
  }

  function syncHtmlNoteLabels() {
    htmlNoteLabels.forEach((m) => m.remove());
    htmlNoteLabels = [];

    if (!map || !useHtmlNoteLabels()) return;
    if (window.WMSettings?.get("showNoteLabels") === false) return;
    if (map.getZoom() < 10) return;

    for (const note of notes) {
      const el = document.createElement("div");
      el.className = "map-note-label";
      el.dir = "auto";
      el.textContent = note.title;
      htmlNoteLabels.push(
        new maplibregl.Marker({ element: el, anchor: "top", offset: [0, 6] })
          .setLngLat([note.lng, note.lat])
          .addTo(map)
      );
    }
  }

  function syncNoteLabelMode() {
    if (!map?.isStyleLoaded()) return;
    if (map.getLayer(NOTES_LABELS)) {
      const show = window.WMSettings?.get("showNoteLabels") !== false && !useHtmlNoteLabels();
      map.setLayoutProperty(NOTES_LABELS, "visibility", show ? "visible" : "none");
    }
    syncHtmlNoteLabels();
  }

  function syncNotesOnMap() {
    if (!map?.isStyleLoaded()) return;
    const src = map.getSource(NOTES_SOURCE);
    if (src) src.setData(notesGeoJSON());
    syncNoteLabelMode();
  }

  function wireNoteLayerEvents() {
    if (noteLayerEventsWired) return;
    noteLayerEventsWired = true;

    map.on("click", NOTES_CIRCLES, (e) => {
      e.originalEvent?.stopPropagation();
      const id = e.features?.[0]?.properties?.id;
      const note = notes.find((n) => n.id === id);
      if (note) showNotePopup(note);
    });

    map.on("mouseenter", NOTES_CIRCLES, () => {
      map.getCanvas().style.cursor = "pointer";
    });

    map.on("mouseleave", NOTES_CIRCLES, () => {
      map.getCanvas().style.cursor = "";
    });
  }

  function ensureNoteLayers() {
    if (!map?.isStyleLoaded()) return;

    const data = notesGeoJSON();

    if (!map.getSource(NOTES_SOURCE)) {
      map.addSource(NOTES_SOURCE, { type: "geojson", data });
    } else {
      map.getSource(NOTES_SOURCE).setData(data);
    }

    if (!map.getLayer(NOTES_CIRCLES)) {
      map.addLayer({
        id: NOTES_CIRCLES,
        type: "circle",
        source: NOTES_SOURCE,
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            4,
            0,
            6,
            4,
            9,
            7,
            12,
            10,
            15,
            13,
            18,
            15,
          ],
          "circle-color": ["get", "color"],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0, 5.5, 0.9, 6, 1, 22, 1],
        },
      });

      map.addLayer({
        id: NOTES_LABELS,
        type: "symbol",
        source: NOTES_SOURCE,
        minzoom: 10,
        layout: {
          "text-field": ["get", "title"],
          "text-size": 11,
          "text-offset": [0, 1.15],
          "text-anchor": "top",
          "text-max-width": 12,
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#e8ecf4",
          "text-halo-color": "#0a0c10",
          "text-halo-width": 1.5,
        },
      });

      wireNoteLayerEvents();
    } else {
      syncNotesOnMap();
    }

    if (map.getLayer(NOTES_LABELS)) {
      map.setLayoutProperty(
        NOTES_LABELS,
        "visibility",
        window.WMSettings?.get("showNoteLabels") !== false && !useHtmlNoteLabels() ? "visible" : "none"
      );
    }
    syncHtmlNoteLabels();
  }

  function filterCountries(countries, query) {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    const codeHits = window.WM_COUNTRIES?.codesMatchingQuery?.(q);
    return countries.filter((c) => {
      const english = countryDisplayName(c.code, c.name);
      if (english.toLowerCase().includes(q)) return true;
      if (c.code.toLowerCase().includes(q)) return true;
      if (c.name.toLowerCase().includes(q)) return true;
      if (codeHits?.has(c.code)) return true;
      return false;
    });
  }

  function groupNotesByCountry() {
    const groups = new Map();
    for (const note of notes) {
      const code = note.countryCode || "UNKNOWN";
      if (!groups.has(code)) {
        groups.set(code, {
          code,
          name: countryDisplayName(code, note.countryName),
          notes: [],
        });
      }
      groups.get(code).notes.push(note);
    }
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "en"));
  }

  function groupNotesByCategory(countryNotes) {
    const byCat = new Map();
    for (const id of CATEGORY_ORDER) byCat.set(id, []);
    for (const note of countryNotes) {
      const key = CATEGORY_META[note.category] ? note.category : "attraction";
      byCat.get(key).push(note);
    }
    return byCat;
  }

  function noteSubtitle(note) {
    if (note.address) return note.address;
    return formatCoords(note.lng, note.lat);
  }

  function buildProfileAddCategories(container, selectedId) {
    if (!container) return;
    container.innerHTML = "";
    for (const id of CATEGORY_ORDER) {
      const cat = categoryInfo(id);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `profile-add-cat${id === selectedId ? " selected" : ""}`;
      btn.dataset.category = id;
      btn.style.setProperty("--cat-color", cat.color);
      btn.title = cat.label;
      btn.textContent = cat.icon;
      btn.addEventListener("click", () => {
        profileAddCategory = id;
        container.querySelectorAll(".profile-add-cat").forEach((el) => {
          el.classList.toggle("selected", el.dataset.category === id);
        });
      });
      container.appendChild(btn);
    }
  }

  function pickGeocodeResult(results, countryCode) {
    if (!Array.isArray(results) || !results.length) return null;
    if (countryCode && countryCode !== "UNKNOWN") {
      const cc = countryCode.toUpperCase();
      const inCountry = results.find(
        (r) => String(r.address?.country_code || "").toUpperCase() === cc
      );
      if (inCountry) return inCountry;
    }
    return results[0];
  }

  async function fetchGeocodeList(query, countryCode) {
    const q = String(query || "").trim();
    if (!q) return [];
    const results = await window.worldMaps.geocode(
      q,
      window.WMi18n?.lang?.() || "en",
      countryCode || null
    );
    return Array.isArray(results) ? results : [];
  }

  function geocodeResultLabel(item) {
    return item.name || item.display_name?.split(",")[0] || "Place";
  }

  function fillGeocodeSuggestions(container, items, onPick) {
    if (!container) return;
    container.innerHTML = "";
    if (!items.length) {
      container.innerHTML = `<div class="search-empty">${escapeHtml(t("noPlaces"))}</div>`;
    } else {
      for (const item of items) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "search-result";
        btn.role = "option";
        const name = geocodeResultLabel(item);
        const meta = item.display_name || "";
        btn.innerHTML = `<span class="search-result-name">${escapeHtml(name)}</span>
          <span class="search-result-meta">${escapeHtml(meta)}</span>`;
        btn.addEventListener("mousedown", (e) => e.preventDefault());
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          onPick(item, btn);
        });
        container.appendChild(btn);
      }
    }
    container.classList.remove("hidden");
  }

  function hideGeocodeSuggestions(container) {
    if (!container) return;
    container.classList.add("hidden");
    container.innerHTML = "";
  }

  async function geocodeAddress(address, countryCode) {
    const results = await fetchGeocodeList(address, countryCode);
    return pickGeocodeResult(results, countryCode);
  }

  function renderProfileAddForm() {
    return `<section class="profile-add-address">
      <h3 class="profile-add-head">📍 ${escapeHtml(t("profileAddByAddress"))}</h3>
      <form class="profile-add-form" id="profile-add-form">
        <div class="profile-add-address-wrap">
          <input type="text" id="profile-add-address" class="field-input profile-add-input" placeholder="${escapeHtml(t("profileAddressPlaceholder"))}" aria-label="${escapeHtml(t("profileAddressPlaceholder"))}" required autocomplete="off" spellcheck="false" />
          <div class="profile-add-suggestions hidden" id="profile-add-suggestions" role="listbox"></div>
        </div>
        <input type="text" id="profile-add-title" class="field-input profile-add-input" placeholder="${escapeHtml(t("profileAddressTitlePlaceholder"))}" aria-label="${escapeHtml(t("profileAddressTitlePlaceholder"))}" maxlength="120" autocomplete="off" spellcheck="false" />
        <div class="profile-add-cats" id="profile-add-cats" aria-label="${escapeHtml(t("categoryLegend"))}"></div>
        <button type="submit" class="btn btn-primary btn-sm profile-add-submit" id="profile-add-submit">${escapeHtml(t("profileAddMarker"))}</button>
        <p class="profile-add-status hidden" id="profile-add-status" role="status"></p>
      </form>
    </section>`;
  }

  async function addNoteFromGeocodeHit(hit, titleEl, country, addressText) {
    const lng = parseFloat(hit.lon);
    const lat = parseFloat(hit.lat);
    const placeName = hit.display_name || hit.name || addressText;
    const title =
      titleEl?.value.trim() ||
      geocodeResultLabel(hit) ||
      addressText.split(",")[0].trim() ||
      placeName;
    const hitCountry = String(hit.address?.country_code || "").toUpperCase();
    const noteCountryCode = country?.code || hitCountry || null;
    const storedAddress = hit.display_name || addressText;

    const note = await addNote(profileAddCategory, title, lng, lat, {
      address: storedAddress,
      countryCode: noteCountryCode,
      countryName: country?.name || countryDisplayName(hitCountry, hit.address?.country || ""),
    });

    flyTo(lng, lat, Math.max(guessZoom(hit), 14), placeName);
    showNotePopup(note);
    ui.statusPlace.textContent = t("profileAddressAdded", { title: note.title });
    if (noteCountryCode) {
      profilesView = { mode: "country", countryCode: noteCountryCode };
    }
    return note;
  }

  function bindProfileAddForm(country) {
    const form = ui.profilesBody?.querySelector("#profile-add-form");
    if (!form) return;

    profileAddSelection = null;
    buildProfileAddCategories(ui.profilesBody.querySelector("#profile-add-cats"), profileAddCategory);

    const addressEl = ui.profilesBody.querySelector("#profile-add-address");
    const titleEl = ui.profilesBody.querySelector("#profile-add-title");
    const statusEl = ui.profilesBody.querySelector("#profile-add-status");
    const submitBtn = ui.profilesBody.querySelector("#profile-add-submit");
    const suggEl = ui.profilesBody.querySelector("#profile-add-suggestions");
    let adding = false;

    const setStatus = (msg, isHint = false) => {
      if (!statusEl) return;
      statusEl.textContent = msg;
      statusEl.classList.toggle("hidden", !msg);
      statusEl.classList.toggle("is-error", false);
      statusEl.classList.toggle("is-hint", isHint && Boolean(msg));
    };

    const clearForm = () => {
      if (addressEl) addressEl.value = "";
      if (titleEl) titleEl.value = "";
      profileAddSelection = null;
      hideGeocodeSuggestions(suggEl);
      setStatus("");
    };

    const commitAdd = async (hit) => {
      if (!hit || adding) return;
      adding = true;
      if (submitBtn) submitBtn.disabled = true;
      hideGeocodeSuggestions(suggEl);
      try {
        const addressText = hit.display_name || geocodeResultLabel(hit);
        await addNoteFromGeocodeHit(hit, titleEl, country, addressText);
        clearForm();
        renderProfilesPanel();
      } catch (err) {
        setStatus(err.message || t("searchFailed"));
      } finally {
        adding = false;
        if (submitBtn) submitBtn.disabled = false;
      }
    };

    const pickSuggestion = (item, btn) => {
      profileAddSelection = item;
      if (addressEl) addressEl.value = item.display_name || geocodeResultLabel(item);
      hideGeocodeSuggestions(suggEl);
      suggEl?.querySelectorAll(".search-result").forEach((el) => el.classList.remove("selected"));
      btn?.classList.add("selected");
      const lng = parseFloat(item.lon);
      const lat = parseFloat(item.lat);
      flyTo(lng, lat, Math.max(guessZoom(item), 14), item.display_name || geocodeResultLabel(item));
      setStatus(t("profileAddressSelected"), true);
      setTimeout(() => titleEl?.focus(), 50);
    };

    const runProfileAddressLookup = async (query) => {
      const q = query.trim();
      if (!q) {
        hideGeocodeSuggestions(suggEl);
        return [];
      }
      suggEl.innerHTML = `<div class="search-empty">${escapeHtml(t("searching"))}</div>`;
      suggEl.classList.remove("hidden");
      const items = await fetchGeocodeList(q, country?.code || null);
      fillGeocodeSuggestions(suggEl, items, pickSuggestion);
      return items;
    };

    addressEl?.addEventListener("input", () => {
      profileAddSelection = null;
      setStatus("");
      clearTimeout(profileAddTimer);
      const val = addressEl.value.trim();
      if (!val) {
        hideGeocodeSuggestions(suggEl);
        return;
      }
      profileAddTimer = setTimeout(() => runProfileAddressLookup(val), SEARCH_DEBOUNCE_MS);
    });

    addressEl?.addEventListener("keydown", (e) => {
      if (e.key === "Escape") hideGeocodeSuggestions(suggEl);
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const address = addressEl?.value.trim();
      if (!address || adding) return;

      if (submitBtn) submitBtn.disabled = true;
      try {
        if (profileAddSelection) {
          await commitAdd(profileAddSelection);
          return;
        }

        setStatus(t("profileAdding"));
        const items = await fetchGeocodeList(address, country?.code || null);
        if (!items.length) {
          suggEl.innerHTML = `<div class="search-empty">${escapeHtml(t("noPlaces"))}</div>`;
          suggEl.classList.remove("hidden");
          setStatus("");
          return;
        }
        fillGeocodeSuggestions(suggEl, items, pickSuggestion);
        setStatus(t("profilePickFromList"), true);
      } catch (err) {
        setStatus(err.message || t("searchFailed"));
      } finally {
        if (!adding && submitBtn) submitBtn.disabled = false;
      }
    });
  }

  function renderProfilesPanel() {
    if (!ui.profilesBody) return;

    if (!notes.length) {
      ui.profilesTitle.textContent = t("profilesTitle");
      ui.profilesBack?.classList.add("hidden");
      ui.profilesSearchWrap?.classList.add("hidden");
      profilesView = { mode: "countries", countryCode: null };
      ui.profilesBody.innerHTML = renderProfileAddForm();
      bindProfileAddForm(null);
      return;
    }

    if (profilesView.mode === "countries") {
      ui.profilesTitle.textContent = t("profilesTitle");
      ui.profilesBack?.classList.add("hidden");
      ui.profilesSearchWrap?.classList.remove("hidden");
      const countries = filterCountries(groupNotesByCountry(), profilesSearchQuery);
      const countryCards = countries.length
        ? countries
            .map((c) => {
              const countLabel = c.notes.length === 1 ? t("marker") : t("markers");
              return `<button type="button" class="country-card" data-country="${escapeHtml(c.code)}">
            <span class="country-card-flag">${countryFlag(c.code)}</span>
            <span class="country-card-text">
              <strong>${escapeHtml(c.name)}</strong>
              <span>${escapeHtml(c.code)} · ${c.notes.length} ${escapeHtml(countLabel)}</span>
            </span>
            <span class="country-card-arrow">›</span>
          </button>`;
            })
            .join("")
        : `<p class="profiles-empty">${escapeHtml(t("profilesNoMatch"))}</p>`;

      ui.profilesBody.innerHTML = `${renderProfileAddForm()}${countryCards}`;
      bindProfileAddForm(null);

      ui.profilesBody.querySelectorAll(".country-card").forEach((btn) => {
        btn.addEventListener("click", () => openCountryProfile(btn.dataset.country));
      });
      return;
    }

    const country = groupNotesByCountry().find((c) => c.code === profilesView.countryCode);
    if (!country) {
      profilesView = { mode: "countries", countryCode: null };
      renderProfilesPanel();
      return;
    }

    ui.profilesTitle.textContent = `${countryFlag(country.code)} ${country.name}`;
    ui.profilesBack?.classList.remove("hidden");
    ui.profilesSearchWrap?.classList.add("hidden");

    const byCat = groupNotesByCategory(country.notes);
    const sections = CATEGORY_ORDER.filter((id) => byCat.get(id)?.length)
      .map((catId) => {
        const cat = categoryInfo(catId);
        const items = byCat
          .get(catId)
          .map(
            (note) => `<div class="profile-note-row">
              <button type="button" class="profile-note-go" data-note-id="${escapeHtml(note.id)}">
                <span class="profile-note-icon">${cat.icon}</span>
                <span class="profile-note-text">
                  <strong>${escapeHtml(note.title)}</strong>
                  <span dir="auto">${escapeHtml(noteSubtitle(note))}</span>
                </span>
              </button>
              <button type="button" class="profile-note-delete" data-note-id="${escapeHtml(note.id)}" title="${escapeHtml(t("delete"))}">✕</button>
            </div>`
          )
          .join("");
        return `<section class="profile-category">
          <h3 class="profile-category-head">${cat.icon} ${escapeHtml(cat.label)}</h3>
          <div class="profile-category-list">${items}</div>
        </section>`;
      })
      .join("");

    ui.profilesBody.innerHTML = `${renderProfileAddForm()}<div class="profile-country-actions">
        <button type="button" class="btn btn-ghost btn-sm" id="profile-fly-country">${escapeHtml(t("viewOnMap"))}</button>
        <button type="button" class="btn btn-ghost btn-sm profile-danger" id="profile-delete-all">${escapeHtml(t("deleteAllInCountry"))}</button>
      </div>${sections}`;

    bindProfileAddForm(country);

    ui.profilesBody.querySelector("#profile-fly-country")?.addEventListener("click", () => {
      const first = country.notes[0];
      if (first) flyTo(first.lng, first.lat, 6, country.name);
    });

    ui.profilesBody.querySelector("#profile-delete-all")?.addEventListener("click", async () => {
      if (!confirmDelete(t("deleteAllConfirm", { count: country.notes.length, country: country.name }))) return;
      const ids = new Set(country.notes.map((n) => n.id));
      notes = notes.filter((n) => !ids.has(n.id));
      await persistNotes();
      profilesView = { mode: "countries", countryCode: null };
      renderProfilesPanel();
    });

    ui.profilesBody.querySelectorAll(".profile-note-go").forEach((btn) => {
      btn.addEventListener("click", () => {
        const note = notes.find((n) => n.id === btn.dataset.noteId);
        if (note) {
          flyTo(note.lng, note.lat, Math.max(map.getZoom(), 14), note.title);
          showNotePopup(note);
        }
      });
    });

    ui.profilesBody.querySelectorAll(".profile-note-delete").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const note = notes.find((n) => n.id === btn.dataset.noteId);
        if (!note) return;
        if (!confirmDelete(t("deleteNoteConfirm", { title: note.title }))) return;
        await deleteNote(note.id);
        if (!notes.some((n) => n.countryCode === profilesView.countryCode)) {
          profilesView = { mode: "countries", countryCode: null };
        }
        renderProfilesPanel();
      });
    });
  }

  function openCountryProfile(countryCode) {
    profilesView = { mode: "country", countryCode };
    renderProfilesPanel();
  }

  function openProfilesPanel() {
    profilesView = { mode: "countries", countryCode: null };
    renderProfilesPanel();
    ui.profilesPanel?.classList.remove("hidden");
  }

  
  function routeModeInfo(mode) {
    const key = String(mode || "").toLowerCase().trim();
    const aliases = { airplane: "plane", flight: "plane", boat: "ship", ferry: "ship", auto: "car", vehicle: "car" };
    const id = ROUTE_MODES[key] ? key : aliases[key] || "car";
    return { id, ...(ROUTE_MODES[id] || ROUTE_MODES.car) };
  }

  function routeUid() {
    return `route_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function toRad(d) {
    return (d * Math.PI) / 180;
  }

  function toDeg(r) {
    return (r * 180) / Math.PI;
  }

  function buildLineCoords(waypoints, mode) {
    const pts = (waypoints || [])
      .map((w) => [Number(w.lng), Number(w.lat)])
      .filter((c) => Number.isFinite(c[0]) && Number.isFinite(c[1]));
    if (pts.length < 2) return pts;
    if (mode !== "plane" || pts.length !== 2) return pts;

    const [a, b] = pts;
    const lat1 = toRad(a[1]);
    const lon1 = toRad(a[0]);
    const lat2 = toRad(b[1]);
    const lon2 = toRad(b[0]);
    const d =
      2 *
      Math.asin(
        Math.sqrt(
          Math.sin((lat2 - lat1) / 2) ** 2 +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2
        )
      );
    if (!Number.isFinite(d) || d < 1e-6) return pts;
    const steps = 24;
    const out = [];
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const A = Math.sin((1 - f) * d) / Math.sin(d);
      const B = Math.sin(f * d) / Math.sin(d);
      const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
      const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
      const z = A * Math.sin(lat1) + B * Math.sin(lat2);
      const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
      const lon = Math.atan2(y, x);
      const midBulge = Math.sin(Math.PI * f) * Math.min(0.15, d * 0.08);
      out.push([toDeg(lon), toDeg(lat + midBulge * 0.35)]);
    }
    out[0] = a;
    out[out.length - 1] = b;
    return out;
  }

  function routeMidpoint(coords) {
    if (!coords?.length) return null;
    const mid = coords[Math.floor(coords.length / 2)];
    return { lng: mid[0], lat: mid[1] };
  }

  function routesGeoJSON() {
    const lineFeatures = [];
    const labelFeatures = [];
    for (const route of routes) {
      const mode = routeModeInfo(route.mode);
      const coords = buildLineCoords(route.waypoints, mode.id);
      if (coords.length < 2) continue;
      lineFeatures.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: coords },
        properties: {
          id: route.id,
          mode: mode.id,
          color: route.color || mode.color,
          duration: route.duration || "",
          label: route.label || "",
        },
      });
      const mid = routeMidpoint(coords);
      if (mid) {
        const duration = String(route.duration || "").trim();
        const text = duration ? `${mode.icon} ${duration}` : mode.icon;
        labelFeatures.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [mid.lng, mid.lat] },
          properties: {
            id: route.id,
            mode: mode.id,
            icon: mode.icon,
            duration,
            text,
            color: route.color || mode.color,
          },
        });
      }
    }
    return {
      lines: { type: "FeatureCollection", features: lineFeatures },
      labels: { type: "FeatureCollection", features: labelFeatures },
    };
  }

  function ensureRouteLayers() {
    if (!map?.isStyleLoaded()) return;
    const data = routesGeoJSON();

    if (!map.getSource(ROUTES_SOURCE)) {
      map.addSource(ROUTES_SOURCE, { type: "geojson", data: data.lines });
    } else {
      map.getSource(ROUTES_SOURCE).setData(data.lines);
    }

    const labelsId = ROUTES_SOURCE + "-labels";
    if (!map.getSource(labelsId)) {
      map.addSource(labelsId, { type: "geojson", data: data.labels });
    } else {
      map.getSource(labelsId).setData(data.labels);
    }

    if (!map.getLayer(ROUTES_LINE)) {
      map.addLayer({
        id: ROUTES_LINE,
        type: "line",
        source: ROUTES_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": ["interpolate", ["linear"], ["zoom"], 3, 2, 8, 3.5, 14, 5],
          "line-opacity": 0.9,
          "line-dasharray": [1.5, 1.8],
        },
      });
    }

    if (!map.getLayer(ROUTES_LABELS)) {
      map.addLayer({
        id: ROUTES_LABELS,
        type: "symbol",
        source: labelsId,
        layout: {
          "text-field": ["get", "text"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 3, 12, 8, 14, 14, 16],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
          "text-anchor": "center",
          "text-offset": [0, 0],
          "text-max-width": 16,
        },
        paint: {
          "text-color": "#f8fafc",
          "text-halo-color": "#0a0c10",
          "text-halo-width": 2,
        },
      });
    }
  }

  async function persistRoutes() {
    if (window.worldMaps?.saveRoutes) {
      await window.worldMaps.saveRoutes(routes);
    }
    ensureRouteLayers();
  }

  
  function clearRouteTimer(id) {
    const t = routeTimers.get(id);
    if (t) {
      clearTimeout(t);
      routeTimers.delete(id);
    }
  }

  function scheduleRouteExpiry(route) {
    if (!route?.id) return;
    clearRouteTimer(route.id);
    const created = Date.parse(route.createdAt || route.expiresAt) || Date.now();
    const expiresAt = Date.parse(route.expiresAt) || created + ROUTE_TTL_MS;
    route.expiresAt = new Date(expiresAt).toISOString();
    const delay = Math.max(0, expiresAt - Date.now());
    const timer = setTimeout(() => {
      routeTimers.delete(route.id);
      const still = routes.some((r) => r.id === route.id);
      if (!still) return;
      routes = routes.filter((r) => r.id !== route.id);
      persistRoutes().catch(() => ensureRouteLayers());
    }, delay);
    routeTimers.set(route.id, timer);
  }

  function purgeExpiredRoutes() {
    const now = Date.now();
    const kept = [];
    let removed = false;
    for (const route of routes) {
      const exp = Date.parse(route.expiresAt || 0);
      const created = Date.parse(route.createdAt || 0) || 0;
      const deadline = Number.isFinite(exp) ? exp : created + ROUTE_TTL_MS;
      if (deadline <= now) {
        clearRouteTimer(route.id);
        removed = true;
        continue;
      }
      if (!route.expiresAt) route.expiresAt = new Date(deadline).toISOString();
      kept.push(route);
      scheduleRouteExpiry(route);
    }
    routes = kept;
    return removed;
  }


  async function loadRoutes() {
    try {
      const loaded = window.worldMaps?.loadRoutes ? await window.worldMaps.loadRoutes() : [];
      routes = Array.isArray(loaded) ? loaded : [];
    } catch {
      routes = [];
    }
    ensureRouteLayers();
  }

  async function addRoute(opts = {}) {
    const mode = routeModeInfo(opts.mode);
    const waypoints = (opts.waypoints || [])
      .map((w) => ({
        lat: Number(w.lat),
        lng: Number(w.lng),
        name: String(w.name || "").trim(),
      }))
      .filter((w) => Number.isFinite(w.lat) && Number.isFinite(w.lng));
    if (waypoints.length < 2) throw new Error("Route needs at least 2 waypoints");
    const now = Date.now();
    const route = {
      id: routeUid(),
      mode: mode.id,
      duration: String(opts.duration || "").trim(),
      label: String(opts.label || "").trim(),
      color: opts.color || mode.color,
      waypoints,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ROUTE_TTL_MS).toISOString(),
    };
    routes.push(route);
    await persistRoutes();
    scheduleRouteExpiry(route);
    return route;
  }

  async function deleteRoute(id) {
    const before = routes.length;
    routes = routes.filter((r) => r.id !== id);
    if (routes.length === before) return false;
    await persistRoutes();
    return true;
  }

  function findRoute(ref) {
    const raw = String(ref || "").trim();
    if (!raw) return null;
    const key = raw.toLowerCase();
    return (
      routes.find((r) => r.id === raw) ||
      routes.find((r) => String(r.label || "").toLowerCase() === key) ||
      routes.find((r) => String(r.duration || "").toLowerCase() === key) ||
      routes.find((r) => String(r.label || "").toLowerCase().includes(key)) ||
      null
    );
  }

  function flyToRoute(route) {
    if (!map || !route?.waypoints?.length) return;
    const mode = routeModeInfo(route.mode);
    const coords = buildLineCoords(route.waypoints, mode.id);
    if (coords.length < 2) {
      const w = route.waypoints[0];
      flyTo(w.lng, w.lat, 8, route.label || route.duration || mode.icon);
      return;
    }
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const [lng, lat] of coords) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: 72, maxZoom: 10, duration: 1200 }
    );
    const place = route.label || `${mode.icon} ${route.duration || ""}`.trim();
    if (place) ui.statusPlace.textContent = place;
  }

  async function updateNote(id, patch = {}) {
    const note = notes.find((n) => n.id === id);
    if (!note) return null;
    if (patch.title != null) {
      const t = String(patch.title).trim();
      if (t) note.title = t;
    }
    if (patch.category != null) {
      const cat = String(patch.category).toLowerCase().trim();
      if (CATEGORY_META[cat]) note.category = cat;
    }
    if (typeof patch.lat === "number" && Number.isFinite(patch.lat)) note.lat = patch.lat;
    if (typeof patch.lng === "number" && Number.isFinite(patch.lng)) note.lng = patch.lng;
    if (patch.address != null) note.address = String(patch.address);
    await persistNotes();
    return note;
  }


  async function persistNotes() {
    await window.worldMaps.saveNotes(notes);
    updateNotesCount();
    ensureNoteLayers();
    renderProfilesPanel();
  }

  function updateNotesCount() {
  }

  function closeActivePopup() {
    activePopup?.remove();
    activePopup = null;
  }

  function showNotePopup(note) {
    closeActivePopup();
    const cat = categoryInfo(note.category);
    const popup = new maplibregl.Popup({ closeOnClick: true, maxWidth: "260px", offset: 14 })
      .setLngLat([note.lng, note.lat])
      .setHTML(
        `<div class="note-popup" dir="auto">
          <div style="font-size:1.2rem;margin-bottom:4px">${cat.icon}</div>
          <strong>${escapeHtml(note.title)}</strong>
          <div style="color:#8b95a8;font-size:12px;margin-top:4px">${escapeHtml(cat.label)}</div>
          ${note.address ? `<div style="color:#8b95a8;font-size:11px;margin-top:4px" dir="auto">${escapeHtml(note.address)}</div>` : ""}
          <div style="color:#8b95a8;font-size:11px;margin-top:4px">${escapeHtml(note.countryName || "")}</div>
          <div style="color:#8b95a8;font-size:11px;margin-top:4px;font-family:monospace">${escapeHtml(formatCoords(note.lng, note.lat))}</div>
          <div class="note-popup-actions">
            <button type="button" class="btn btn-ghost" data-action="goto">${escapeHtml(t("goHere"))}</button>
            <button type="button" class="btn btn-ghost" data-action="delete" style="color:#f07178">${escapeHtml(t("delete"))}</button>
          </div>
        </div>`
      )
      .addTo(map);

    popup.getElement().querySelector('[data-action="goto"]')?.addEventListener("click", () => {
      flyTo(note.lng, note.lat, Math.max(map.getZoom(), 14), note.title);
      popup.remove();
    });

    popup.getElement().querySelector('[data-action="delete"]')?.addEventListener("click", async () => {
      if (!confirmDelete(t("deleteNoteConfirm", { title: note.title }))) return;
      await deleteNote(note.id);
      popup.remove();
      renderProfilesPanel();
    });

    activePopup = popup;
  }

  async function addNote(category, title, lng, lat, opts = {}) {
    const note = {
      id: uid(),
      category,
      title: title.trim(),
      lng,
      lat,
      address: opts.address || "",
      createdAt: new Date().toISOString(),
    };
    if (opts.countryCode) {
      note.countryCode = opts.countryCode;
      note.countryName = countryDisplayName(opts.countryCode, opts.countryName || "");
    } else {
      await enrichNoteCountry(note);
    }
    notes.push(note);
    await persistNotes();
    return note;
  }

  async function deleteNote(id) {
    notes = notes.filter((n) => n.id !== id);
    await persistNotes();
  }

  async function loadNotes() {
    try {
      notes = await window.worldMaps.loadNotes();
      if (!Array.isArray(notes)) notes = [];
    } catch {
      notes = [];
    }
    await backfillCountries();
    updateNotesCount();
    renderProfilesPanel();
    ensureNoteLayers();
  }

  function initMap() {
    return ensureRtlTextPlugin().then(createMap);
  }

  async function ensureRtlTextPlugin() {
    if (ensureRtlTextPlugin.done) return;
    try {
      await maplibregl.setRTLTextPlugin(RTL_TEXT_PLUGIN, false);
      ensureRtlTextPlugin.done = true;
    } catch (err) {
      console.warn("RTL text plugin unavailable:", err.message);
    }
  }
  ensureRtlTextPlugin.done = false;

  function createMap() {
    map = new maplibregl.Map({
      container: ui.mapEl,
      style: MAP_STYLE,
      center: WORLD_CENTER,
      zoom: WORLD_ZOOM,
      minZoom: 1,
      maxZoom: 19,
      attributionControl: false,
      pitchWithRotate: false,
      dragRotate: false,
    });

    map.on("error", (e) => {
      if (styleSwitching || mapStyleFallbackUsed) return;
      if (e?.error?.message && map.getStyle()?.name !== "fallback") {
        console.warn("Primary tiles failed, trying fallback…", e.error.message);
        mapStyleFallbackUsed = true;
        styleSwitching = true;
        map.setStyle(FALLBACK_STYLE);
      }
    });

    map.on("style.load", () => {
      styleSwitching = false;
      ensureNoteLayers();
    });

    map.addControl((navControl = new maplibregl.NavigationControl({ showCompass: false })), "bottom-right");

    map.on("load", () => {
      updateStatus(WORLD_CENTER[0], WORLD_CENTER[1]);
      ensureNoteLayers();
      ensureRouteLayers();
      map.once("idle", () => {
        ensureNoteLayers();
        ensureRouteLayers();
      });
    });

    map.on("move", () => {
      const { lng, lat } = map.getCenter();
      updateStatus(lng, lat);
    });

    map.on("mousemove", (e) => {
      ui.statusCoords.textContent = formatCoords(e.lngLat.lng, e.lngLat.lat);
    });

    map.on("click", (e) => {
      if (map.queryRenderedFeatures(e.point, { layers: [NOTES_CIRCLES] }).length) return;
      hideContextMenu();
      hideHint();
      const { lng, lat } = e.lngLat;
      ui.statusPlace.textContent = t("lookingUpPlace");
      scheduleReverseGeocode(lng, lat);
    });

    map.on("dblclick", (e) => {
      e.preventDefault();
      hideHint();
      map.zoomTo(map.getZoom() + 1.2, { around: e.lngLat, duration: 400 });
    });

    map.on("contextmenu", (e) => {
      e.preventDefault();
      hideHint();
      showContextMenu(e.point, e.lngLat);
    });

    map.on("zoomend", () => {
      const c = map.getCenter();
      updateStatus(c.lng, c.lat);
      syncHtmlNoteLabels();
    });

    map.on("moveend", () => {
      syncHtmlNoteLabels();
    });
  }

  function hideResults() {
    if (!ui.searchResults) return;
    ui.searchResults.classList.add("hidden");
    ui.searchResults.innerHTML = "";
  }

  function showResults(items) {
    if (!ui.searchResults) return;
    fillGeocodeSuggestions(ui.searchResults, items, (item) => {
      ui.searchInput.value = geocodeResultLabel(item);
      hideResults();
      flyTo(parseFloat(item.lon), parseFloat(item.lat), guessZoom(item), item.display_name || "");
    });
  }

  function guessZoom(item) {
    const type = String(item.type || item.addresstype || item.class || "").toLowerCase();
    if (type.includes("country") || type === "administrative") return 5;
    if (type.includes("state") || type.includes("region")) return 7;
    if (type.includes("city") || type.includes("town") || type.includes("village")) return 11;
    if (type.includes("road") || type.includes("house")) return 15;
    return 12;
  }

  async function runSearch(query) {
    const q = query.trim();
    if (!q) {
      hideResults();
      return;
    }
    if (q === lastSearchQuery && !ui.searchResults.classList.contains("hidden")) return;
    lastSearchQuery = q;

    ui.searchResults.innerHTML = `<div class="search-empty">${escapeHtml(t("searching"))}</div>`;
    ui.searchResults.classList.remove("hidden");

    try {
      const results = await window.worldMaps.geocode(q, window.WMi18n?.lang?.() || "en");
      showResults(Array.isArray(results) ? results : []);
    } catch (err) {
      ui.searchResults.innerHTML = `<div class="search-empty">${escapeHtml(err.message || t("searchFailed"))}</div>`;
    }
  }



  function goWorld() {
    hideHint();
    closeActivePopup();
    map.flyTo({ center: WORLD_CENTER, zoom: WORLD_ZOOM, bearing: 0, pitch: 0, speed: 1.2 });
    ui.statusPlace.textContent = t("worldView");
  }

  function wireNotesUi() {
    buildCategoryGrid();

    ui.ctxAddNote?.addEventListener("click", () => {
      if (!contextLngLat) return;
      const { lng, lat } = contextLngLat;
      hideContextMenu();
      openNoteModal(lng, lat);
    });

    ui.ctxCopyCoords?.addEventListener("click", async () => {
      if (!contextLngLat) return;
      const text = formatCoords(contextLngLat.lng, contextLngLat.lat);
      hideContextMenu();
      try {
        await navigator.clipboard.writeText(text);
        ui.statusPlace.textContent = t("coordsCopied");
      } catch {
        ui.statusPlace.textContent = text;
      }
    });

    ui.noteForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = ui.noteTitle.value.trim();
      if (!title || !pendingNoteLngLat) return;
      const { lng, lat } = pendingNoteLngLat;
      const note = await addNote(selectedCategory, title, lng, lat);
      closeNoteModal();
      flyTo(lng, lat, Math.max(map.getZoom(), 14), note.title);
      showNotePopup(note);
      ui.statusPlace.textContent = t("noteAdded", { title: note.title });
    });

    ui.noteModalClose?.addEventListener("click", closeNoteModal);
    ui.noteCancel?.addEventListener("click", closeNoteModal);



    ui.profilesPanelClose?.addEventListener("click", () => ui.profilesPanel?.classList.add("hidden"));

    ui.profilesBack?.addEventListener("click", () => {
      profilesView = { mode: "countries", countryCode: null };
      renderProfilesPanel();
    });

    ui.profilesSearch?.addEventListener("input", () => {
      profilesSearchQuery = ui.profilesSearch.value;
      if (profilesView.mode === "countries") renderProfilesPanel();
    });

    document.addEventListener("click", (e) => {
      if (!ui.contextMenu?.contains(e.target)) hideContextMenu();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") hideContextMenu();
    });
  }

  function wireUi() {
    bind(ui.searchForm, "submit", (e) => {
      e.preventDefault();
      runSearch(ui.searchInput?.value || "");
    });

    bind(ui.searchInput, "input", () => {
      clearTimeout(searchTimer);
      const val = ui.searchInput?.value || "";
      if (!val.trim()) {
        hideResults();
        lastSearchQuery = "";
        return;
      }
      searchTimer = setTimeout(() => runSearch(val), SEARCH_DEBOUNCE_MS);
    });

    bind(ui.searchInput, "keydown", (e) => {
      if (e.key === "Escape") hideResults();
    });

    document.addEventListener("click", (e) => {
      if (!ui.searchResults || ui.searchResults.classList.contains("hidden")) return;
      if (!ui.searchResults.contains(e.target) && e.target !== ui.searchInput) {
        hideResults();
      }
    });
    bind(ui.btnWorld, "click", goWorld);

    bind(ui.btnSettings, "click", () => window.WMSettings.open());
    bind(ui.settingsClose, "click", () => window.WMSettings.close());
    bind(ui.settingsOverlay, "click", (e) => {
      if (e.target === ui.settingsOverlay) window.WMSettings.close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !ui.settingsOverlay?.classList.contains("hidden")) {
        window.WMSettings.close();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.target.matches("input, textarea, select")) return;
      if (!map) return;
      if (e.key === "+" || e.key === "=") map.zoomIn({ duration: 200 });
      if (e.key === "-") map.zoomOut({ duration: 200 });
    });

    wireNotesUi();
  }

  async function boot() {
    await window.WMSettings.load();
    window.WMi18n.setOnApply(refreshLanguageUi);
    window.WMi18n.applyDom();
    window.WMSettings.setOnEffects(applySettingsEffects);



    await initMap();
    wireUi();
    applySettingsEffects();
    await loadNotes();
    await loadRoutes();
  }

  window.WorldMapsMapApi = {
    listNotes: () =>
      notes.map((n) => ({
        id: n.id,
        title: n.title,
        category: n.category,
        lat: n.lat,
        lng: n.lng,
        countryCode: n.countryCode || "",
        countryName: n.countryName || "",
        address: n.address || "",
        createdAt: n.createdAt || "",
      })),
    getNoteById: (id) => notes.find((n) => n.id === id) || null,
    findNoteByTitle: (title) => {
      const q = String(title || "").trim().toLowerCase();
      if (!q) return null;
      return (
        notes.find((n) => String(n.title || "").toLowerCase() === q) ||
        notes.find((n) => String(n.title || "").toLowerCase().includes(q)) ||
        null
      );
    },
    addNote,
    updateNote,
    deleteNote,
    flyTo,
    showNotePopup,
    goWorld,
    listRoutes: () =>
      routes.map((r) => ({
        id: r.id,
        mode: r.mode,
        duration: r.duration || "",
        label: r.label || "",
        waypoints: r.waypoints,
        createdAt: r.createdAt || "",
        expiresAt: r.expiresAt || "",
      })),
    getRouteById: (id) => routes.find((r) => r.id === id) || null,
    findRoute,
    addRoute,
    deleteRoute,
    flyToRoute,
    getMapCenter: () => {
      if (!map) return null;
      const c = map.getCenter();
      return { lng: c.lng, lat: c.lat, zoom: map.getZoom() };
    },
  };

  boot();
})();