(() => {
  function tt(key, fallback, vars) {
    const I = window.MySpaceI18n;
    if (!I?.t) return fallback || key;
    const v = I.t(key, vars);
    return v === key ? (fallback || key) : v;
  }

  const state = {
    page: "apps",
    apps: [],
    selectedId: null,
    catalog: null,
    toastTimer: null,
    liveApply: false,
  };

  const el = {
    nav: document.getElementById("main-nav"),
    sidebarMeta: document.getElementById("sidebar-meta"),
    gridWrap: document.getElementById("grid-wrap"),
    appGrid: document.getElementById("app-grid"),
    gridEmpty: document.getElementById("grid-empty"),
    appsHead: document.getElementById("apps-head"),
    detail: document.getElementById("app-detail"),
    detailTitle: document.getElementById("detail-title"),
    detailSub: document.getElementById("detail-sub"),
    detailMark: document.getElementById("detail-mark"),
    detailStatus: document.getElementById("detail-status"),
    modeChips: document.getElementById("mode-chips"),
    buttonChips: document.getElementById("button-chips"),
    btnPreview: document.getElementById("btn-preview"),
    btnBack: document.getElementById("btn-back"),
    btnReset: document.getElementById("btn-reset"),
    aboutMeta: document.getElementById("about-meta"),
    toast: document.getElementById("toast"),
  };

  function api() {
    return window.myApp?.themes;
  }

  function toast(msg) {
    if (!el.toast) return;
    el.toast.textContent = msg;
    el.toast.classList.remove("hidden");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => el.toast.classList.add("hidden"), 2200);
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function selectedApp() {
    return state.apps.find((a) => a.id === state.selectedId) || null;
  }

  function setPage(page) {
    state.page = page === "about" ? "about" : "apps";
    document.querySelectorAll(".view").forEach((v) => {
      v.classList.toggle("hidden", v.id !== `view-${state.page}`);
    });
    el.nav?.querySelectorAll("[data-page]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.page === state.page);
    });
    if (state.page === "apps" && state.selectedId) showDetail(state.selectedId);
    else if (state.page === "apps") showGrid();
  }

  function showGrid() {
    state.selectedId = null;
    state.catalog = null;
    el.appsHead?.classList.remove("hidden");
    el.gridWrap?.classList.remove("hidden");
    el.detail?.classList.add("hidden");
    paintGrid();
  }

  function showDetail(appId) {
    const app = state.apps.find((a) => a.id === appId);
    if (!app) {
      showGrid();
      return;
    }
    state.selectedId = appId;
    state.catalog = app;
    el.appsHead?.classList.add("hidden");
    el.gridWrap?.classList.add("hidden");
    el.detail?.classList.remove("hidden");
    paintDetail();
  }

  function themeLabel(theme) {
    if (!theme || theme.isDefault) return tt("service.themes.default", "Default");
    const bits = [];
    if (theme.mode) bits.push(theme.mode);
    if (theme.buttons && theme.buttons !== "default") bits.push(theme.buttons);
    return bits.join(" · ") || tt("service.themes.custom", "Custom");
  }

  function iconSrc(app) {
    const p = String(app?.iconPath || "")
      .replace(/\\/g, "/")
      .replace(/^\//, "");
    if (!p) return null;
    // Themes runs from apps/themes/ — reach repo-root assets
    if (p.startsWith("src/") || p.startsWith("apps/") || p.startsWith("brand/")) {
      return p.startsWith("brand/") ? `../../src/${p}` : `../../${p}`;
    }
    return `../../${p}`;
  }

  function markHtml(app, className) {
    const src = iconSrc(app);
    if (src) {
      return `<span class="${className}"><img src="${escapeHtml(src)}" alt="" /></span>`;
    }
    return `<span class="${className}">${escapeHtml(app.icon || "◇")}</span>`;
  }

  function paintGrid() {
    const list = state.apps || [];
    if (el.sidebarMeta) {
      el.sidebarMeta.textContent =
        list.length === 1
          ? tt("service.themes.sidebarMeta", `${list.length} app themed`, { count: list.length })
          : tt("service.themes.sidebarMetaPlural", `${list.length} apps themed`, { count: list.length });
    }
    if (el.aboutMeta) {
      const live = state.liveApply
        ? tt("service.themes.liveApplyOn", "Live apply: on")
        : tt("service.themes.liveApplyOff", "Live apply: off");
      el.aboutMeta.textContent = list.length
        ? tt("service.themes.aboutSupported", `${live} · ${list.length} apps: ${list.map((a) => a.name).join(", ")}`, {
            live,
            count: list.length,
            names: list.map((a) => a.name).join(", "),
          })
        : `${live} · ${tt("service.themes.noAppsYet", "No apps yet")}`;
    }
    if (el.gridEmpty) el.gridEmpty.classList.toggle("hidden", list.length > 0);
    if (!el.appGrid) return;
    el.appGrid.innerHTML = list
      .map((a) => {
        const custom = a.theme && !a.theme.isDefault;
        return `<button type="button" class="app-card${custom ? " is-custom" : ""}" data-id="${escapeHtml(
          a.id
        )}" role="listitem">
          ${markHtml(a, "app-card-icon")}
          <span class="app-card-name">${escapeHtml(a.name)}</span>
          <span class="app-card-meta">${escapeHtml(themeLabel(a.theme))}</span>
        </button>`;
      })
      .join("");
    el.appGrid.querySelectorAll("[data-id]").forEach((btn) => {
      btn.addEventListener("click", () => showDetail(btn.dataset.id));
    });
  }

  function paintChips(container, options, activeId, kind) {
    if (!container) return;
    container.innerHTML = (options || [])
      .map(
        (o) => `<button type="button" class="chip${o.id === activeId ? " is-active" : ""}" data-kind="${kind}" data-id="${escapeHtml(
          o.id
        )}">${escapeHtml(o.label)}${
          o.hint ? `<small>${escapeHtml(o.hint)}</small>` : ""
        }</button>`
      )
      .join("");
    container.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => void onChip(chip.dataset.kind, chip.dataset.id));
    });
  }

  function paintDetail() {
    const app = selectedApp();
    if (!app) return;
    const theme = app.theme || { mode: app.defaultMode, buttons: app.defaultButtons, isDefault: true };
    if (el.detailTitle) el.detailTitle.textContent = app.name;
    if (el.detailSub) el.detailSub.textContent = tt("service.themes.modeButtons", "Mode & buttons");
    if (el.detailMark) {
      const src = iconSrc(app);
      if (src) {
        el.detailMark.innerHTML = `<img src="${escapeHtml(src)}" alt="" />`;
      } else {
        el.detailMark.textContent = app.icon || "◇";
      }
    }
    if (el.detailStatus) {
      el.detailStatus.textContent = theme.isDefault
        ? tt("service.themes.usingDefault", "Using default appearance")
        : tt("service.themes.customLabel", `Custom · ${themeLabel(theme)}`, { label: themeLabel(theme) });
    }
    paintChips(el.modeChips, app.modes, theme.mode, "mode");
    paintChips(el.buttonChips, app.buttons, theme.buttons, "buttons");
    if (el.btnPreview) {
      el.btnPreview.setAttribute("data-buttons", theme.buttons || "default");
    }
  }

  async function onChip(kind, value) {
    const app = selectedApp();
    if (!app) return;
    const payload = { appId: app.id };
    if (kind === "mode") payload.mode = value;
    if (kind === "buttons") payload.buttons = value;
    if (kind === "mode") payload.buttons = app.theme?.buttons || app.defaultButtons;
    if (kind === "buttons") payload.mode = app.theme?.mode || app.defaultMode;

    const res = await api()?.set?.(payload);
    if (!res?.ok) {
      toast(res?.error || tt("service.themes.couldNotSave", "Could not save"));
      return;
    }
    app.theme = res.theme;
    paintDetail();
    toast(tt("service.themes.saved", `Saved · ${app.name}`, { name: app.name }));
  }

  async function resetSelected() {
    const app = selectedApp();
    if (!app) return;
    const res = await api()?.reset?.({ appId: app.id });
    if (!res?.ok) {
      toast(res?.error || tt("service.themes.couldNotReset", "Could not reset"));
      return;
    }
    app.theme = res.theme;
    paintDetail();
    toast(tt("service.themes.reset", `Reset · ${app.name}`, { name: app.name }));
  }

  async function refresh() {
    try {
      const meta = await api()?.meta?.();
      if (meta?.ok) state.liveApply = !!meta.liveApply;
    } catch {
      state.liveApply = false;
    }
    const res = await api()?.catalog?.();
    if (!res?.ok) {
      toast(res?.error || tt("service.themes.couldNotLoad", "Could not load themes"));
      return;
    }
    state.apps = res.apps || [];
    if (state.selectedId) {
      const still = state.apps.find((a) => a.id === state.selectedId);
      if (still) {
        state.catalog = still;
        paintDetail();
      } else showGrid();
    } else {
      paintGrid();
    }
  }

  function bind() {
    el.nav?.querySelectorAll("[data-page]").forEach((btn) => {
      btn.addEventListener("click", () => setPage(btn.dataset.page));
    });
    el.btnBack?.addEventListener("click", showGrid);
    el.btnReset?.addEventListener("click", () => void resetSelected());
  }

  function applyRoute(route) {
    const page = route?.page;
    if (page === "about") setPage("about");
    else {
      setPage("apps");
      if (route?.appId || route?.id) showDetail(route.appId || route.id);
    }
  }

  window.__myspaceApplyRoute = applyRoute;
  window.ThemesApp = {
    setPage: (page, opts) => {
      setPage(page);
      if (opts?.appId) showDetail(opts.appId);
    },
    applyRoute,
    openApp: (id) => {
      setPage("apps");
      showDetail(id);
    },
    refresh: () => refresh(),
  };

  window.addEventListener("myspace-i18n-applied", () => {
    if (state.selectedId) paintDetail();
    else paintGrid();
  });

  bind();
  setPage("apps");
  void refresh();
})();
