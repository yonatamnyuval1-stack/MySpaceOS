(() => {
  const Data = window.IconLibraryData;
  const api = () => window.myApp;

  const state = {
    pack: "all",
    query: "",
    favoritesOnly: false,
    favorites: new Set(),
    recent: [],
    selectedId: null,
    size: 48,
    stroke: 2,
    color: "#e8f0ea",
  };

  const $ = (id) => document.getElementById(id);

  function toast(msg) {
    const el = $("toast");
    if (!el) return;
    el.hidden = false;
    el.textContent = msg;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      el.hidden = true;
    }, 1600);
  }

  async function loadState() {
    try {
      const res = await api()?.invoke?.("library.getState");
      if (res?.ok) {
        state.favorites = new Set(Array.isArray(res.favorites) ? res.favorites : []);
        state.recent = Array.isArray(res.recent) ? res.recent : [];
      }
    } catch {
    }
  }

  async function persistFavorite(id, on) {
    try {
      await api()?.invoke?.("favorites.set", { id, on: !!on });
    } catch {
    }
  }

  async function persistRecent(id) {
    try {
      const res = await api()?.invoke?.("recent.add", { id });
      if (res?.ok && Array.isArray(res.recent)) state.recent = res.recent;
    } catch {
    }
  }

  function filtered() {
    let list = Data.search(state.query, state.pack);
    if (state.favoritesOnly) {
      list = list.filter((i) => state.favorites.has(i.id));
    }
    return list;
  }

  function renderPacks() {
    const wrap = $("packs");
    if (!wrap) return;
    wrap.innerHTML = Data.PACKS.map(
      (p) =>
        `<button type="button" class="pack-btn ${p.id === state.pack ? "is-active" : ""}" data-pack="${p.id}">${p.label}</button>`
    ).join("");
    wrap.querySelectorAll("[data-pack]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.pack = btn.getAttribute("data-pack");
        renderPacks();
        renderGrid();
      });
    });
  }

  function renderGrid() {
    const list = filtered();
    const grid = $("icon-grid");
    const empty = $("empty");
    const count = $("count-label");
    if (count) {
      count.textContent = `${list.length} icon${list.length === 1 ? "" : "s"}`;
    }
    if ($("foot-count")) {
      $("foot-count").textContent = `${Data.count} built-in · ${state.favorites.size} favorites`;
    }
    if (!grid) return;
    if (!list.length) {
      grid.innerHTML = "";
      empty?.classList.remove("hidden");
      return;
    }
    empty?.classList.add("hidden");
    grid.innerHTML = list
      .map((icon) => {
        const active = icon.id === state.selectedId ? "is-active" : "";
        const fav = state.favorites.has(icon.id) ? "is-fav" : "";
        return `<button type="button" class="icon-tile ${active} ${fav}" data-id="${icon.id}" title="${icon.name}">
          <span class="tile-svg">${Data.toSvg(icon, { size: 28, strokeWidth: 2 })}</span>
          <p class="tile-name">${icon.name}</p>
        </button>`;
      })
      .join("");
    grid.querySelectorAll("[data-id]").forEach((btn) => {
      btn.addEventListener("click", () => selectIcon(btn.getAttribute("data-id")));
    });
  }

  function selectIcon(id) {
    const icon = Data.getById(id);
    if (!icon) return;
    state.selectedId = id;
    persistRecent(id);
    renderGrid();
    renderPreview();
    publishFacts();
  }

  function renderPreview() {
    const icon = Data.getById(state.selectedId);
    const empty = $("preview-empty");
    const body = $("preview-body");
    if (!icon) {
      empty?.classList.remove("hidden");
      body?.classList.add("hidden");
      return;
    }
    empty?.classList.add("hidden");
    body?.classList.remove("hidden");
    $("preview-stage").innerHTML = Data.toSvg(icon, {
      size: state.size,
      strokeWidth: state.stroke,
      color: state.color,
    });
    $("preview-name").textContent = icon.name;
    $("preview-id").textContent = icon.id;
    $("preview-tags").textContent = [icon.pack, ...(icon.tags || [])].join(" · ");
    const favBtn = $("btn-favorite");
    if (favBtn) {
      const on = state.favorites.has(icon.id);
      favBtn.textContent = on ? "★ Favorited" : "★ Favorite";
      favBtn.classList.toggle("btn-primary", on);
    }
    $("ctrl-size-val").textContent = String(state.size);
    $("ctrl-stroke-val").textContent = String(state.stroke);
  }

  async function copyText(text, okMsg) {
    try {
      await navigator.clipboard.writeText(text);
      toast(okMsg);
    } catch {
      toast("Copy failed");
    }
  }

  function downloadSvg(icon) {
    const svg = Data.toSvg(icon, {
      size: state.size,
      strokeWidth: state.stroke,
      color: state.color,
    });
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${icon.id}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Downloaded SVG");
  }

  function publishFacts() {
    const icon = Data.getById(state.selectedId);
    api()
      ?.invoke?.("screen.publish", {
        app: "icon-library",
        pack: state.pack,
        query: state.query,
        selected: icon
          ? { id: icon.id, name: icon.name, pack: icon.pack, tags: icon.tags }
          : null,
        favoritesCount: state.favorites.size,
        visibleCount: filtered().length,
      })
      .catch?.(() => {});
  }

  function bind() {
    $("search")?.addEventListener("input", (e) => {
      state.query = e.target.value || "";
      renderGrid();
      publishFacts();
    });

    $("btn-favorites-only")?.addEventListener("click", () => {
      state.favoritesOnly = !state.favoritesOnly;
      $("btn-favorites-only")?.classList.toggle("is-active", state.favoritesOnly);
      renderGrid();
    });

    $("btn-about")?.addEventListener("click", () => {
      $("about-note").textContent = Data.ATTRIBUTION || "";
      $("about-dialog")?.showModal();
    });

    $("ctrl-size")?.addEventListener("input", (e) => {
      state.size = Number(e.target.value) || 48;
      renderPreview();
    });
    $("ctrl-stroke")?.addEventListener("input", (e) => {
      state.stroke = Number(e.target.value) || 2;
      renderPreview();
    });
    $("ctrl-color")?.addEventListener("input", (e) => {
      state.color = e.target.value || "#e8f0ea";
      renderPreview();
    });

    $("btn-copy-svg")?.addEventListener("click", () => {
      const icon = Data.getById(state.selectedId);
      if (!icon) return;
      copyText(
        Data.toSvg(icon, { size: state.size, strokeWidth: state.stroke, color: state.color }),
        "SVG copied"
      );
    });
    $("btn-copy-id")?.addEventListener("click", () => {
      if (!state.selectedId) return;
      copyText(state.selectedId, "ID copied");
    });
    $("btn-download")?.addEventListener("click", () => {
      const icon = Data.getById(state.selectedId);
      if (icon) downloadSvg(icon);
    });
    $("btn-favorite")?.addEventListener("click", async () => {
      const id = state.selectedId;
      if (!id) return;
      if (state.favorites.has(id)) state.favorites.delete(id);
      else state.favorites.add(id);
      await persistFavorite(id, state.favorites.has(id));
      renderGrid();
      renderPreview();
      publishFacts();
    });

    $("btn-ai")?.addEventListener("click", () => {
      toast("AI icon generation comes next");
    });

    const mark = Data.getById("sparkles") || Data.getById("house") || Data.ICONS[0];
    if (mark && $("brand-mark")) {
      $("brand-mark").innerHTML = Data.toSvg(mark, { size: 22, strokeWidth: 2 });
    }
  }

  async function init() {
    if (!Data?.ICONS?.length) {
      document.body.innerHTML = "<p style='padding:2rem'>Icon data failed to load.</p>";
      return;
    }
    const settingsSize = Number(window.AppSettingsRuntime?.get?.("defaultSize"));
    if (Number.isFinite(settingsSize) && settingsSize > 0) {
      state.size = settingsSize;
      if ($("ctrl-size")) $("ctrl-size").value = String(settingsSize);
    }
    await loadState();
    bind();
    renderPacks();
    renderGrid();
    const first = state.recent.find((id) => Data.getById(id)) || Data.ICONS[0]?.id;
    if (first) selectIcon(first);
    else publishFacts();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();