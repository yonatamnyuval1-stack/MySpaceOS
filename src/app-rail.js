(() => {
  const RAIL_WIDTH = "64px";
  const RECENT_KEY = "myspace-rail-recent";
  const RECENT_MAX = 5;
  const MARK_SRC = {
    "atom-white": "brand/atom-white.png",
    "atom-green": "brand/atom-green.png",
    "atom-cyan": "brand/atom-cyan.png",
    "atom-violet": "brand/atom-violet.png",
    "atom-rose": "brand/atom-rose.png",
  };

  const SERIES_DEFS = [
    { id: "ai", label: "AI", mark: "atom-rose", hint: "Mind · Flow" },
    { id: "web", label: "Web", mark: "atom-green", hint: "Browser · Connect" },
    { id: "shell", label: "Shell", mark: "atom-cyan", hint: "Language atlas · Scripts runtime" },
    { id: "link", label: "Link", mark: "atom-violet", hint: "MSL · Parts · Pulse · Resolve" },
    {
      id: "platform",
      label: "Platform",
      mark: "atom-white",
      hint: "Files · Jobs · Scheduler · Themes · more",
    },
  ];

  const APP_SERIES = {
    chat: "ai",
    mind: "ai",
    "model-flow": "ai",
    flow: "ai",
    mail: "web",
    connect: "web",
    browser: "web",
    "connect-browser": "web",
    "connect-myspace-browser": "web",
    "shell-console": "shell",
    shell: "shell",
    scripts: "shell",
    pulse: "link",
    msl: "link",
    "msl-protocol": "link",
    parts: "link",
    resolve: "link",
    files: "platform",
    jobs: "platform",
    scheduler: "platform",
    permissions: "platform",
    updates: "platform",
    network: "platform",
    backup: "platform",
    storage: "platform",
    themes: "platform",
    "apps-info": "platform",
    info: "platform",
  };

  const SERVICE_APP_IDS = {
    files: "files",
    jobs: "jobs",
    scheduler: "scheduler",
    permissions: "permissions",
    updates: "updates",
    network: "network",
    backup: "backup",
    storage: "storage",
    themes: "themes",
    info: "apps-info",
    mind: "chat",
    flow: "model flow",
    connect: "mail",
    shell: "shell console",
    scripts: "scripts",
    pulse: "pulse",
    parts: "parts",
    msl: "msl-protocol",
    resolve: "resolve",
    browser: "myspace browser",
    "system-info": "system info",
    bridge: "os bridge",
  };

  let renderToken = 0;
  let catalogCache = null;
  let openSeriesId = null;
  let menuEl = null;

  function isWorkspaceOpen() {
    return !!window.MySpaceWorkspace?.isOpen?.();
  }

  function activeTabInfo() {
    const t = window.MySpaceWorkspace?.getActiveTab?.();
    if (!t) return null;
    return {
      appId: String(t.appId || "").toLowerCase(),
      module: String(t.module || "").toLowerCase(),
    };
  }

  function isFocusedApp(app, active) {
    if (!active || !app) return false;
    const id = String(app.id || "").toLowerCase();
    const mod = String(app.module || "").toLowerCase();
    if (active.appId && (active.appId === id || active.appId === mod)) return true;
    if (active.module && (active.module === id || active.module === mod)) return true;
    return false;
  }

  function currentSeriesId(active) {
    if (!active) return null;
    return APP_SERIES[active.appId] || APP_SERIES[active.module] || null;
  }

  function desktopApps() {
    const apps = window.MySpaceConfig?.getApps?.() || [];
    return apps.filter((a) => a.id !== "welcome" && !a.hidden);
  }

  function appById(appId) {
    if (!appId) return null;
    return desktopApps().find((a) => a.id === appId) || null;
  }

  function readRecentIds() {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      const valid = new Set(desktopApps().map((a) => a.id));
      return parsed.filter((id) => valid.has(id)).slice(0, RECENT_MAX);
    } catch {
      return [];
    }
  }

  function writeRecentIds(ids) {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, RECENT_MAX)));
    } catch {
    }
  }

  function recordRecent(appId) {
    const id = String(appId || "").trim();
    if (!id || id === "welcome") return;
    const app = appById(id);
    if (!app) return;
    const next = [id, ...readRecentIds().filter((x) => x !== id)].slice(0, RECENT_MAX);
    writeRecentIds(next);
    window.dispatchEvent(new CustomEvent("myspace-recent-apps-change"));
  }

  function recentApps() {
    return readRecentIds().map((id) => appById(id)).filter(Boolean);
  }

  function recentSignature() {
    return readRecentIds().join("|");
  }

  async function loadCatalog() {
    if (catalogCache?.services?.length) return catalogCache;
    try {
      if (window.MySpacePlatformCatalog?.loadCatalog) {
        catalogCache = await window.MySpacePlatformCatalog.loadCatalog();
        if (catalogCache?.services?.length) return catalogCache;
      }
    } catch {
    }
    try {
      const res = await fetch(`platform-services.json?t=${Date.now()}`);
      if (res.ok) catalogCache = await res.json();
    } catch {
    }
    return catalogCache || { services: [] };
  }

  function servicesForSeries(seriesId, catalog) {
    const list = catalog?.services || [];
    if (seriesId === "platform" || seriesId === "files") {
      return list.filter((s) => s.tier === "major" && !s.series);
    }
    return list.filter((s) => s.series === seriesId && s.tier === "major");
  }

  function serviceMarkSrc(service) {
    const appKey = SERVICE_APP_IDS[service?.id] || service?.id;
    const apps = window.MySpaceConfig?.getApps?.() || [];
    const app =
      apps.find((a) => a.id === appKey || a.module === appKey) ||
      apps.find((a) => String(a.id || "").toLowerCase() === String(appKey || "").toLowerCase());
    if (app) {
      const fromConfig = window.MySpaceIcons?.resolveIconFromConfig?.(app);
      if (fromConfig) return fromConfig;
    }
    return MARK_SRC[service?.mark] || MARK_SRC["atom-white"];
  }

  async function resolveIconSrc(app) {
    try {
      if (window.mySpace?.resolveAppIcon) {
        const resolved = await window.mySpace.resolveAppIcon(app);
        if (resolved) return resolved;
      }
    } catch {
    }
    return window.MySpaceIcons?.resolveIconFromConfig?.(app) || null;
  }

  function applyIcon(wrap, app, src) {
    wrap.replaceChildren();
    wrap.classList.remove("app-rail-emoji");
    if (src) {
      const img = document.createElement("img");
      img.alt = "";
      img.width = 28;
      img.height = 28;
      img.draggable = false;
      img.src = src;
      img.addEventListener("error", () => {
        wrap.replaceChildren();
        wrap.textContent = window.MySpaceIcons?.emojiFallback?.(app) || app.icon || "◆";
        wrap.classList.add("app-rail-emoji");
      });
      wrap.appendChild(img);
      return;
    }
    wrap.textContent = window.MySpaceIcons?.emojiFallback?.(app) || app.icon || "◆";
    wrap.classList.add("app-rail-emoji");
  }

  function launch(app) {
    if (!app) return;
    closeSeriesMenu();
    recordRecent(app.id);
    if (window.MySpaceDesktop?.launchApp) window.MySpaceDesktop.launchApp(app);
    else if (window.launchMySpaceApp) window.launchMySpaceApp(app);
  }

  function openPlatformService(service, surfaceId) {
    closeSeriesMenu();
    if (!service?.action) return;
    if (window.MySpacePlatformCatalog?.openService) {
      window.MySpacePlatformCatalog.openService(service.action, surfaceId || null, { mode: "full" });
      return;
    }
  }

  async function renderAppButtons(container, apps) {
    if (!container) return;
    container.replaceChildren();
    if (!apps.length) return;

    const token = renderToken;
    const active = activeTabInfo();

    for (const app of apps) {
      if (token !== renderToken) return;
      const focused = isFocusedApp(app, active);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `app-rail-btn${focused ? " is-active" : ""}`;
      btn.dataset.appId = app.id;
      if (app.module) btn.dataset.module = app.module;
      btn.title = app.name || app.id;
      btn.setAttribute("aria-label", app.name || app.id);
      btn.setAttribute("aria-current", focused ? "true" : "false");

      const iconWrap = document.createElement("span");
      iconWrap.className = "app-rail-icon";
      iconWrap.textContent = "…";
      btn.appendChild(iconWrap);
      btn.addEventListener("click", () => launch(app));
      container.appendChild(btn);

      const src = await resolveIconSrc(app);
      if (token !== renderToken) return;
      applyIcon(iconWrap, app, src);
    }
  }

  async function renderRailApps() {
    const recentEl = document.getElementById("app-rail-recent");
    const allEl = document.getElementById("app-rail-all");
    const divider = document.getElementById("app-rail-recent-divider");
    if (!allEl) return;

    const recent = recentApps();
    const recentIds = new Set(recent.map((a) => a.id));
    const rest = desktopApps().filter((a) => !recentIds.has(a.id));

    if (recentEl) {
      await renderAppButtons(recentEl, recent);
    }
    if (divider) {
      const show = recent.length > 0 && rest.length > 0;
      divider.hidden = !show;
      divider.setAttribute("aria-hidden", show ? "false" : "true");
    }
    await renderAppButtons(allEl, rest);
  }

  async function renderApps() {
    await renderRailApps();
  }

  function updateAppActiveStates() {
    const active = activeTabInfo();
    const root = document.getElementById("app-rail-apps");
    if (!root) return;
    root.querySelectorAll(".app-rail-btn").forEach((btn) => {
      const app = {
        id: btn.dataset.appId,
        module: btn.dataset.module || "",
      };
      const focused = isFocusedApp(app, active);
      btn.classList.toggle("is-active", focused);
      btn.setAttribute("aria-current", focused ? "true" : "false");
    });
    updateSeriesCurrentHint();
  }

  function ensureSeriesMenu() {
    if (menuEl) return menuEl;
    menuEl = document.createElement("div");
    menuEl.id = "app-rail-series-menu";
    menuEl.className = "app-rail-series-menu";
    menuEl.hidden = true;
    menuEl.setAttribute("role", "menu");
    document.body.appendChild(menuEl);

    menuEl.addEventListener("click", (e) => {
      const surf = e.target.closest("[data-surface]");
      const svc = e.target.closest("[data-service-action]");
      if (surf) {
        e.preventDefault();
        const action = surf.dataset.serviceAction;
        const surfaceId = surf.dataset.surface;
        const catalog = catalogCache;
        const service = (catalog?.services || []).find((s) => s.action === action);
        if (service) openPlatformService(service, surfaceId);
        return;
      }
      if (svc) {
        e.preventDefault();
        const action = svc.dataset.serviceAction;
        const catalog = catalogCache;
        const service = (catalog?.services || []).find((s) => s.action === action);
        if (service) openPlatformService(service, null);
      }
    });

    document.addEventListener(
      "mousedown",
      (e) => {
        if (!openSeriesId || !menuEl || menuEl.hidden) return;
        if (menuEl.contains(e.target)) return;
        if (e.target.closest?.("#app-rail-services")) return;
        closeSeriesMenu();
      },
      true
    );

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && openSeriesId) {
        e.preventDefault();
        closeSeriesMenu();
      }
    });

    return menuEl;
  }

  function closeSeriesMenu() {
    openSeriesId = null;
    if (menuEl) {
      menuEl.hidden = true;
      menuEl.replaceChildren();
      menuEl.removeAttribute("data-series");
    }
    document.querySelectorAll(".app-rail-series-btn.is-open").forEach((b) => {
      b.classList.remove("is-open");
      b.setAttribute("aria-expanded", "false");
    });
  }

  function positionSeriesMenu(anchor) {
    const menu = ensureSeriesMenu();
    if (!anchor || !menu) return;
    const rect = anchor.getBoundingClientRect();
    const gap = 10;
    menu.style.left = `${Math.round(rect.right + gap)}px`;
    menu.style.top = `${Math.round(rect.top + rect.height / 2)}px`;
    menu.style.transform = "translateY(-50%)";

    requestAnimationFrame(() => {
      const m = menu.getBoundingClientRect();
      let top = rect.top + rect.height / 2 - m.height / 2;
      const pad = 12;
      const maxTop = window.innerHeight - m.height - pad;
      top = Math.max(pad, Math.min(maxTop, top));
      menu.style.top = `${Math.round(top)}px`;
      menu.style.transform = "none";
    });
  }

  function paintSeriesMenu(seriesDef, services) {
    const menu = ensureSeriesMenu();
    menu.dataset.series = seriesDef.id;
    menu.replaceChildren();

    const head = document.createElement("div");
    head.className = "app-rail-series-menu-head";
    const title = document.createElement("span");
    title.className = "app-rail-series-menu-title";
    title.textContent = seriesDef.label;
    const sub = document.createElement("span");
    sub.className = "app-rail-series-menu-sub";
    sub.textContent = seriesDef.hint || "";
    head.append(title, sub);
    menu.appendChild(head);

    if (!services.length) {
      const empty = document.createElement("p");
      empty.className = "app-rail-series-menu-empty";
      empty.textContent = "Nothing here yet";
      menu.appendChild(empty);
      return;
    }

    const list = document.createElement("div");
    list.className = "app-rail-series-menu-list";

    for (const service of services) {
      const row = document.createElement("div");
      row.className = "app-rail-series-menu-item";

      const openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.className = "app-rail-series-menu-open";
      openBtn.setAttribute("role", "menuitem");
      openBtn.dataset.serviceAction = service.action || "";
      openBtn.title =
        window.MySpaceI18n?.platformField?.(service.id, "tagline", service.tagline) ||
        service.tagline ||
        service.name ||
        "";

      const mark = document.createElement("img");
      mark.src = serviceMarkSrc(service);
      mark.alt = "";
      mark.width = 28;
      mark.height = 28;
      mark.draggable = false;
      mark.addEventListener("error", () => {
        mark.src = MARK_SRC[service.mark] || MARK_SRC["atom-white"];
      });

      const text = document.createElement("span");
      text.className = "app-rail-series-menu-text";
      const name = document.createElement("strong");
      name.textContent =
        window.MySpaceI18n?.platformField?.(service.id, "name", service.name) ||
        service.name ||
        service.id;
      const tag = document.createElement("em");
      tag.textContent =
        window.MySpaceI18n?.platformField?.(service.id, "tagline", service.tagline) ||
        service.tagline ||
        "";
      text.append(name, tag);
      openBtn.append(mark, text);
      row.appendChild(openBtn);

      const surfaces = Array.isArray(service.surfaces) ? service.surfaces : [];
      if (surfaces.length) {
        const surfRow = document.createElement("div");
        surfRow.className = "app-rail-series-menu-surfaces";
        for (const surf of surfaces.slice(0, 5)) {
          const sbtn = document.createElement("button");
          sbtn.type = "button";
          sbtn.className = "app-rail-series-menu-surface";
          sbtn.dataset.serviceAction = service.action || "";
          sbtn.dataset.surface = surf.id || "";
          sbtn.title = surf.hint || surf.label || "";
          sbtn.textContent = surf.label || surf.id;
          surfRow.appendChild(sbtn);
        }
        row.appendChild(surfRow);
      }

      list.appendChild(row);
    }

    menu.appendChild(list);
  }

  async function toggleSeriesMenu(seriesDef, anchor) {
    if (openSeriesId === seriesDef.id) {
      closeSeriesMenu();
      return;
    }

    const catalog = await loadCatalog();
    const services = servicesForSeries(seriesDef.id, catalog);
    openSeriesId = seriesDef.id;
    paintSeriesMenu(seriesDef, services);

    document.querySelectorAll(".app-rail-series-btn").forEach((b) => {
      const on = b.dataset.seriesId === seriesDef.id;
      b.classList.toggle("is-open", on);
      b.setAttribute("aria-expanded", on ? "true" : "false");
    });

    const menu = ensureSeriesMenu();
    menu.hidden = false;
    positionSeriesMenu(anchor);
  }

  function updateSeriesCurrentHint() {
    const seriesId = currentSeriesId(activeTabInfo());
    document.querySelectorAll(".app-rail-series-btn").forEach((b) => {
      b.classList.toggle("is-current", !!seriesId && b.dataset.seriesId === seriesId);
    });
  }

  function renderSeries(container) {
    if (!container) return;
    container.replaceChildren();
    closeSeriesMenu();

    for (const def of SERIES_DEFS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `app-rail-series-btn series-${def.id}`;
      btn.dataset.seriesId = def.id;
      btn.title = `${def.label} — ${def.hint}`;
      btn.setAttribute("aria-label", `${def.label} series`);
      btn.setAttribute("aria-haspopup", "menu");
      btn.setAttribute("aria-expanded", "false");

      const img = document.createElement("img");
      img.src = MARK_SRC[def.mark] || MARK_SRC["atom-white"];
      img.alt = "";
      img.width = 28;
      img.height = 28;
      img.draggable = false;
      btn.appendChild(img);

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        void toggleSeriesMenu(def, btn);
      });

      container.appendChild(btn);
    }

    updateSeriesCurrentHint();
  }

  function updateScrollControls() {
    const list = document.getElementById("app-rail-apps");
    const up = document.getElementById("app-rail-up");
    const down = document.getElementById("app-rail-down");
    if (!list || !up || !down) return;
    const max = Math.max(0, list.scrollHeight - list.clientHeight);
    const top = list.scrollTop;
    const canScroll = max > 2;
    up.hidden = !canScroll;
    down.hidden = !canScroll;
    up.disabled = !canScroll || top <= 1;
    down.disabled = !canScroll || top >= max - 1;
  }

  function scrollApps(direction) {
    const list = document.getElementById("app-rail-apps");
    if (!list) return;
    const amount = Math.max(96, Math.floor(list.clientHeight * 0.75));
    const next = Math.max(
      0,
      Math.min(list.scrollHeight - list.clientHeight, list.scrollTop + direction * amount)
    );
    list.scrollTop = next;
    updateScrollControls();
  }

  function setVisible(visible) {
    const rail = document.getElementById("app-rail");
    if (!rail) return;
    rail.classList.toggle("is-visible", visible);
    rail.setAttribute("aria-hidden", visible ? "false" : "true");
    document.documentElement.style.setProperty("--app-rail-width", visible ? RAIL_WIDTH : "0px");
    document.documentElement.classList.toggle("has-app-rail", visible);
    if (!visible) closeSeriesMenu();
  }

  let lastAppsSignature = "";
  let lastRecentSignature = "";

  function appsSignature() {
    return desktopApps()
      .map((a) => a.id)
      .join("|");
  }

  async function refresh() {
    const rail = document.getElementById("app-rail");
    if (!rail) return;

    const visible = isWorkspaceOpen();
    setVisible(visible);
    if (!visible) {
      document.getElementById("app-rail-recent")?.replaceChildren();
      document.getElementById("app-rail-all")?.replaceChildren();
      document.getElementById("app-rail-services")?.replaceChildren();
      lastAppsSignature = "";
      lastRecentSignature = "";
      return;
    }

    const sig = appsSignature();
    const recentSig = recentSignature();
    const servicesEl = document.getElementById("app-rail-services");
    const needsAppsRerender = sig !== lastAppsSignature || recentSig !== lastRecentSignature;
    const needsSeriesRerender = !servicesEl?.childElementCount;

    if (needsAppsRerender) {
      renderToken += 1;
      lastAppsSignature = sig;
      lastRecentSignature = recentSig;
      await renderApps();
    } else {
      updateAppActiveStates();
    }

    if (needsSeriesRerender) {
      renderSeries(servicesEl);
    } else {
      updateSeriesCurrentHint();
    }

    void loadCatalog();

    requestAnimationFrame(() => {
      updateScrollControls();
      requestAnimationFrame(updateScrollControls);
    });
  }

  function bindScroll() {
    const list = document.getElementById("app-rail-apps");
    const up = document.getElementById("app-rail-up");
    const down = document.getElementById("app-rail-down");
    if (!list || !up || !down) return;

    up.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      scrollApps(-1);
    });
    down.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      scrollApps(1);
    });
    list.addEventListener("scroll", updateScrollControls, { passive: true });
    list.addEventListener(
      "wheel",
      (e) => {
        if (list.scrollHeight <= list.clientHeight) return;
        e.preventDefault();
        list.scrollTop += e.deltaY;
        updateScrollControls();
      },
      { passive: false }
    );
    window.addEventListener("resize", () => {
      updateScrollControls();
      if (openSeriesId) {
        const btn = document.querySelector(`.app-rail-series-btn[data-series-id="${openSeriesId}"]`);
        if (btn) positionSeriesMenu(btn);
      }
    });
  }

  function init() {
    const rail = document.getElementById("app-rail");
    if (!rail) return;
    setVisible(false);
    bindScroll();
    refresh();
    window.MySpaceConfig?.subscribe?.(refresh);
    window.addEventListener("myspace-tabs-change", refresh);
    window.addEventListener("myspace-recent-apps-change", refresh);
    window.MySpaceRecentApps = { record: recordRecent, list: readRecentIds };
    window.MySpaceAppRail = { refresh, updateScrollControls, scrollApps, closeSeriesMenu, recordRecent };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();