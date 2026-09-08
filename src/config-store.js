(function () {
  const STORAGE_KEY = "myspace-user-data";
  const PROTECTED_IDS = new Set(["welcome"]);
  const RETIRED_APP_IDS = new Set(["shell-console"]);
  const PLATFORM_HIDDEN_APP_IDS = new Set([
    "welcome",
    "chat",
    "model-flow",
    "mail",
    "scripts",
    "system-info",
    "os-bridge",
    "files",
    "pulse",
    "parts",
    "permissions",
    "msl-protocol",
    "jobs",
    "scheduler",
    "resolve",
    "updates",
    "network",
    "apps-info",
    "backup",
    "storage",
    "themes",
  ]);


  let state = null;
  let api = null;
  const listeners = new Set();

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isLocalInAppUrl(raw) {
    try {
      let url = raw.trim();
      if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
      const host = new URL(url).hostname.toLowerCase();
      return (
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "0.0.0.0" ||
        host.endsWith(".local") ||
        /^192\.168\.\d+\.\d+$/.test(host) ||
        /^10\.\d+\.\d+\.\d+$/.test(host)
      );
    } catch {
      return false;
    }
  }

  function notify() {
    listeners.forEach((fn) => fn(getState()));
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function normalizeApp(app) {
    const entry = { ...app };
    if (entry.type === "external" && entry.path && !entry.paths) {
      entry.paths = [entry.path];
      delete entry.path;
    }
    if (entry.inAppUrl) {
      entry.inAppUrl = String(entry.inAppUrl).trim();
      if (!entry.inAppUrl) {
        delete entry.inAppUrl;
      } else if (!isLocalInAppUrl(entry.inAppUrl)) {
        delete entry.inAppUrl;
      }
    }
    if (entry.hidden) entry.hidden = true;
    else delete entry.hidden;
    return entry;
  }

  function defaultDesktopSpaces() {
    return {
      activeId: "work",
      spaces: [
        {
          id: "study",
          name: "Study",
          wallpaper: "gradient",
          taskbarPins: ["study-deck", "studies", "day-planner", "world-clock", "flag-quiz"],
        },
        {
          id: "work",
          name: "Work",
          wallpaper: "gradient",
          taskbarPins: ["day-planner", "stocks", "contracts", "builds", "contacts"],
        },
        {
          id: "play",
          name: "Play",
          wallpaper: "gradient",
          taskbarPins: ["flag-quiz", "geography", "space", "world-maps", "history"],
        },
      ],
    };
  }

  function normalizeSpaceSession(session) {
    if (!session || typeof session !== "object") return null;
    return {
      version: 1,
      savedAt: Number(session.savedAt) || Date.now(),
      frameOpen: session.frameOpen !== false,
      activeAppId: session.activeAppId || null,
      activeMode: session.activeMode || null,
      snapLeftAppId: session.snapLeftAppId || null,
      snapRightAppId: session.snapRightAppId || null,
      tabs: Array.isArray(session.tabs)
        ? session.tabs
            .filter((t) => t && (t.appId || t.mode === "webview" || t.mode === "panel"))
            .map((t) => ({
              appId: t.appId || null,
              mode: t.mode || null,
              title: t.title || null,
              url: t.url || null,
              module: t.module || null,
              lastPage: t.lastPage || null,
            }))
        : [],
    };
  }

  function normalizeDesktopSpaces(src) {
    const base = defaultDesktopSpaces();
    if (!src || typeof src !== "object") return base;
    const spaces = Array.isArray(src.spaces) && src.spaces.length
      ? src.spaces
          .map((s) => ({
            id: String(s.id || "").trim(),
            name: String(s.name || s.id || "Space").trim(),
            wallpaper: s.wallpaper || "gradient",
            taskbarPins: Array.isArray(s.taskbarPins)
              ? [...new Set(s.taskbarPins.map((id) => String(id)).filter(Boolean))]
              : [],
            positions:
              s.positions && typeof s.positions === "object" ? { ...s.positions } : {},
            session: normalizeSpaceSession(s.session),
          }))
          .filter((s) => s.id)
          .slice(0, 4)
      : base.spaces;
    const activeId = spaces.some((s) => s.id === src.activeId) ? src.activeId : spaces[0].id;
    return { activeId, spaces };
  }

  function normalizeWidgets(src) {
    const s = src && typeof src === "object" ? src : {};
    return {
      enabled: s.enabled !== false,
      clock: s.clock !== false,
      nextTask: s.nextTask !== false,
      stocks: s.stocks !== false,
      symbols: Array.isArray(s.symbols) && s.symbols.length
        ? s.symbols.map(String).slice(0, 6)
        : ["AAPL", "MSFT", "BTC-USD"],
    };
  }

  function normalizePaletteRecents(list) {
    if (!Array.isArray(list)) return [];
    return list
      .filter((x) => x && x.id && x.title)
      .slice(0, 12)
      .map((x) => ({
        kind: x.kind || "app",
        id: String(x.id),
        title: String(x.title),
        subtitle: x.subtitle ? String(x.subtitle) : "",
        icon: x.icon || "⏱",
        at: Number(x.at) || Date.now(),
        appId: x.appId || null,
        route: x.route || null,
      }));
  }

  function normalizeConfig(config) {
    const src = config && typeof config === "object" ? config : {};
    let timezone = src.timezone;
    try {
      timezone = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      timezone = "UTC";
    }
    const apps = (src.apps || [])
      .map(normalizeApp)
      .filter((a) => a && !RETIRED_APP_IDS.has(a.id))
      .map((a) => (PLATFORM_HIDDEN_APP_IDS.has(a.id) ? { ...a, hidden: true } : a));
    const removedAppIds = [
      ...new Set([
        ...(Array.isArray(src.removedAppIds) ? src.removedAppIds : []),
        ...RETIRED_APP_IDS,
      ]),
    ].filter((id) => id !== "msl-protocol");
    const desktopSpaces = normalizeDesktopSpaces(src.desktopSpaces);
    desktopSpaces.spaces = desktopSpaces.spaces.map((space) => ({
      ...space,
      taskbarPins: (space.taskbarPins || []).filter(
        (id) => !RETIRED_APP_IDS.has(id) && id !== "welcome"
      ),
    }));
    return {
      title: src.title || "My Space",
      subtitle: src.subtitle || "",
      wallpaper: src.wallpaper || "gradient",
      wallpaperPlaylist: Array.isArray(src.wallpaperPlaylist)
        ? [...new Set(src.wallpaperPlaylist.map((id) => String(id).trim()).filter(Boolean))].slice(0, 80)
        : [],
      wallpaperRotatedAt: Number(src.wallpaperRotatedAt) > 0 ? Number(src.wallpaperRotatedAt) : null,
      language: src.language || "en",
      locale: src.locale || "en-US",
      timeFormat: src.timeFormat === "24h" ? "24h" : "12h",
      showSeconds: !!src.showSeconds,
      showClock: src.showClock !== false,
      weekStartsOn: src.weekStartsOn === "monday" ? "monday" : "sunday",
      timezone,
      confirmCloseApps: src.confirmCloseApps !== false,
      openWelcomeOnStart: src.openWelcomeOnStart !== false,
      hotCorners: src.hotCorners !== false,
      focusDesktopOnly: src.focusDesktopOnly !== false,
      widgets: normalizeWidgets(src.widgets),
      desktopSpaces,
      paletteRecents: normalizePaletteRecents(src.paletteRecents).filter(
        (x) => !x.appId || (!RETIRED_APP_IDS.has(x.appId) && x.appId !== "welcome")
      ),
      taskbarPins: Array.isArray(src.taskbarPins)
        ? [
            ...new Set(
              src.taskbarPins
                .map((id) => String(id))
                .filter((id) => id && !RETIRED_APP_IDS.has(id) && id !== "welcome")
            ),
          ]
        : [],
      apps,
      positions: src.positions || {},
      removedAppIds,
    };
  }

  function slugify(text) {
    return (
      text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "app"
    );
  }

  function uniqueId(base, apps) {
    let id = slugify(base);
    let n = 1;
    while (apps.some((a) => a.id === id)) {
      id = `${slugify(base)}-${n++}`;
    }
    return id;
  }

  async function init(mySpaceApi, options = {}) {
    api = mySpaceApi;
    const skipLocalMerge = Boolean(options.skipLocalMerge);
    if (skipLocalMerge) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
      }
    }
    let raw = null;
    try {
      raw = await api.getConfig();
    } catch (err) {
      console.error("MySpaceConfig.getConfig failed:", err);
      raw = null;
    }
    const base = normalizeConfig(raw || {});
    const stored = skipLocalMerge ? null : loadFromStorage();

    if (api?.saveUserData) {
      state = base;
      if (stored?.positions && Object.keys(stored.positions).length) {
        state.positions = { ...state.positions, ...stored.positions };
      }
      if (stored?.taskbarPins?.length && !state.taskbarPins?.length) {
        state.taskbarPins = [...stored.taskbarPins];
      }
    } else if (stored?.apps?.length) {
      state = normalizeConfig(stored);
    } else {
      state = { ...base, positions: stored?.positions || base.positions || {} };
    }

    notify();
    return state;
  }

  async function reloadFromProfile() {
    return init(api, { skipLocalMerge: true });
  }

  async function persist() {
    saveToStorage();
    if (api?.saveUserData) {
      await api.saveUserData(state);
    }
    notify();
  }

  function getState() {
    return clone(state);
  }

  function getApps() {
    return clone(state?.apps || []);
  }

  function getSettings() {
    const s = state || normalizeConfig({});
    return {
      title: s.title,
      subtitle: s.subtitle,
      wallpaper: s.wallpaper,
      wallpaperPlaylist: Array.isArray(s.wallpaperPlaylist) ? [...s.wallpaperPlaylist] : [],
      wallpaperRotatedAt: s.wallpaperRotatedAt || null,
      language: s.language,
      locale: s.locale,
      timeFormat: s.timeFormat,
      showSeconds: s.showSeconds,
      showClock: s.showClock,
      weekStartsOn: s.weekStartsOn,
      timezone: s.timezone,
      confirmCloseApps: s.confirmCloseApps,
      openWelcomeOnStart: s.openWelcomeOnStart,
      hotCorners: s.hotCorners !== false,
      focusDesktopOnly: s.focusDesktopOnly !== false,
      widgets: normalizeWidgets(s.widgets),
      desktopSpaces: normalizeDesktopSpaces(s.desktopSpaces),
      taskbarPins: Array.isArray(s.taskbarPins) ? [...s.taskbarPins] : [],
    };
  }

  function getWidgets() {
    return normalizeWidgets(state?.widgets);
  }

  function getDesktopSpaces() {
    return normalizeDesktopSpaces(state?.desktopSpaces);
  }

  function switchDesktopSpace(spaceId, outgoing = null) {
    const pack = normalizeDesktopSpaces(state.desktopSpaces);
    const space = pack.spaces.find((s) => s.id === spaceId);
    if (!space) return { ok: false, error: "Space not found" };
    if (space.id === pack.activeId && !outgoing) {
      return {
        ok: true,
        unchanged: true,
        space: { ...space },
        wallpaper: state.wallpaper,
        taskbarPins: [...(state.taskbarPins || [])],
        session: null,
      };
    }

    const current = pack.spaces.find((s) => s.id === pack.activeId);
    if (current) {
      current.wallpaper = state.wallpaper || current.wallpaper;
      current.taskbarPins = Array.isArray(state.taskbarPins) ? [...state.taskbarPins] : [];
      if (outgoing?.positions && typeof outgoing.positions === "object") {
        current.positions = { ...outgoing.positions };
      }
      if (outgoing?.session && !outgoing.skipSession) {
        current.session = normalizeSpaceSession(outgoing.session);
      }
    }

    pack.activeId = space.id;
    state.desktopSpaces = pack;
    state.wallpaper = space.wallpaper || "gradient";
    state.taskbarPins = [...(space.taskbarPins || [])];
    if (space.positions && typeof space.positions === "object" && Object.keys(space.positions).length) {
      state.positions = { ...space.positions };
    }
    persist();
    return {
      ok: true,
      space: { ...space },
      wallpaper: state.wallpaper,
      taskbarPins: [...state.taskbarPins],
      session: null,
      positions: { ...(state.positions || {}) },
    };
  }

  function getPaletteRecents() {
    return normalizePaletteRecents(state?.paletteRecents);
  }

  function pushPaletteRecent(entry) {
    if (!entry?.id || !entry?.title) return;
    if (entry.appId === "welcome" || entry.id === "app:welcome") return;
    const next = normalizePaletteRecents(state.paletteRecents || []);
    const filtered = next.filter((x) => x.id !== entry.id);
    filtered.unshift({
      kind: entry.kind || "app",
      id: String(entry.id),
      title: String(entry.title),
      subtitle: entry.subtitle ? String(entry.subtitle) : "",
      icon: entry.icon || "⏱",
      at: Date.now(),
      appId: entry.appId || null,
      route: entry.route || null,
    });
    state.paletteRecents = filtered.slice(0, 12);
    persist();
  }

  function getTaskbarPins() {
    return Array.isArray(state?.taskbarPins) ? [...state.taskbarPins] : [];
  }

  function isPinnedToTaskbar(appId) {
    return getTaskbarPins().includes(appId);
  }

  function pinToTaskbar(appId) {
    if (!appId || appId === "welcome") return { ok: false, error: "Cannot pin" };
    if (!state.taskbarPins) state.taskbarPins = [];
    if (state.taskbarPins.includes(appId)) return { ok: true, changed: false };
    state.taskbarPins.push(appId);
    persist();
    return { ok: true, changed: true };
  }

  function unpinFromTaskbar(appId) {
    if (!state.taskbarPins?.length) return { ok: true, changed: false };
    const before = state.taskbarPins.length;
    state.taskbarPins = state.taskbarPins.filter((id) => id !== appId);
    if (state.taskbarPins.length === before) return { ok: true, changed: false };
    persist();
    return { ok: true, changed: true };
  }

  function toggleTaskbarPin(appId) {
    return isPinnedToTaskbar(appId) ? unpinFromTaskbar(appId) : pinToTaskbar(appId);
  }

  function getPositions() {
    return { ...state.positions };
  }

  function setPosition(appId, x, y) {
    state.positions[appId] = { x: Math.round(x), y: Math.round(y) };
    saveToStorage();
    if (api?.saveUserData) {
      api.saveUserData(state);
    }
  }

  async function resetPositions() {
    state.positions = {};
    await persist();
  }

  function updateSettings(patch) {
    Object.assign(state, patch);
    persist();
  }

  function addApp(data) {
    const apps = state.apps;
    const app = normalizeApp({
      id: uniqueId(data.name, apps),
      name: data.name.trim(),
      type: data.type,
      description: data.description?.trim() || "",
      url: data.type === "url" ? data.url?.trim() : undefined,
      paths: data.type === "external" ? data.paths : undefined,
      inAppUrl: data.type === "external" && data.inAppUrl?.trim() ? data.inAppUrl.trim() : undefined,
      icon: data.icon?.trim() || undefined,
      iconUrl: data.iconUrl?.trim() || undefined,
      iconData: data.iconData || undefined,
    });
    state.removedAppIds = (state.removedAppIds || []).filter((id) => id !== app.id);
    apps.push(app);
    persist();
    return app;
  }

  function updateApp(id, data) {
    const app = state.apps.find((a) => a.id === id);
    if (!app) return null;

    if (data.name !== undefined) app.name = data.name.trim();
    if (data.description !== undefined) app.description = data.description.trim();
    if (data.icon !== undefined) app.icon = data.icon.trim() || undefined;
    if (data.iconUrl !== undefined) app.iconUrl = data.iconUrl.trim() || undefined;
    if (data.iconData !== undefined) app.iconData = data.iconData || undefined;

    if (app.type === "url" && data.url !== undefined) {
      app.url = data.url.trim();
    }

    if (app.type === "external" && data.paths !== undefined) {
      app.paths = data.paths;
      delete app.path;
    }

    if (app.type === "external" && data.inAppUrl !== undefined) {
      const trimmed = data.inAppUrl.trim();
      if (trimmed) app.inAppUrl = trimmed;
      else delete app.inAppUrl;
    }

    if (data.hidden !== undefined) {
      if (data.hidden) app.hidden = true;
      else delete app.hidden;
    }

    persist();
    return app;
  }

  function setAppHidden(id, hidden) {
    if (PLATFORM_HIDDEN_APP_IDS.has(id) && !hidden) {
      return null;
    }
    return updateApp(id, { hidden: !!hidden });
  }

  async function removeApp(id) {
    if (PROTECTED_IDS.has(id)) {
      return { ok: false, error: "This app can't be removed." };
    }
    const before = state.apps.length;
    state.apps = state.apps.filter((a) => a.id !== id);
    delete state.positions[id];
    if (state.taskbarPins?.length) {
      state.taskbarPins = state.taskbarPins.filter((pinId) => pinId !== id);
    }
    if (state.apps.length === before) {
      return { ok: false, error: "App not found." };
    }
    if (!state.removedAppIds) state.removedAppIds = [];
    if (!state.removedAppIds.includes(id)) state.removedAppIds.push(id);
    await persist();
    return { ok: true };
  }

  function canRemove(id) {
    return !PROTECTED_IDS.has(id);
  }

  function resetAppPosition(id) {
    if (!state.positions[id]) return { ok: true, changed: false };
    delete state.positions[id];
    saveToStorage();
    if (api?.saveUserData) {
      api.saveUserData(state);
    }
    return { ok: true, changed: true };
  }

  function moveAppToTop(id) {
    if (PROTECTED_IDS.has(id)) {
      return { ok: false, error: "This app can't be moved." };
    }
    const idx = state.apps.findIndex((a) => a.id === id);
    if (idx === -1) return { ok: false, error: "App not found." };
    const [app] = state.apps.splice(idx, 1);
    const insertAt = state.apps[0]?.id === "welcome" ? 1 : 0;
    state.apps.splice(insertAt, 0, app);
    persist();
    return { ok: true };
  }

  function moveAppToBottom(id) {
    if (PROTECTED_IDS.has(id)) {
      return { ok: false, error: "This app can't be moved." };
    }
    const idx = state.apps.findIndex((a) => a.id === id);
    if (idx === -1) return { ok: false, error: "App not found." };
    const [app] = state.apps.splice(idx, 1);
    state.apps.push(app);
    persist();
    return { ok: true };
  }

  function duplicateApp(id) {
    const source = state.apps.find((a) => a.id === id);
    if (!source) return { ok: false, error: "App not found." };
    if (PROTECTED_IDS.has(id)) {
      return { ok: false, error: "This app can't be duplicated." };
    }
    const copy = normalizeApp(clone(source));
    copy.id = uniqueId(`${source.name}-copy`, state.apps);
    copy.name = `${source.name} (copy)`;
    const idx = state.apps.findIndex((a) => a.id === id);
    state.apps.splice(idx + 1, 0, copy);
    persist();
    return { ok: true, app: copy };
  }

  function sortAppsAlphabetically() {
    const pinned = state.apps.filter((a) => a.id === "welcome");
    const rest = state.apps.filter((a) => a.id !== "welcome");
    rest.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    state.apps = [...pinned, ...rest];
    persist();
    return { ok: true };
  }

  async function resetToDefaults() {
    if (!api) return;
    localStorage.removeItem(STORAGE_KEY);
    if (api.resetUserData) {
      await api.resetUserData();
    }
    state = normalizeConfig(await api.getDefaults());
    state.positions = {};
    await persist();
  }

  function exportData() {
    return JSON.stringify(state, null, 2);
  }

  async function importData(jsonText) {
    const parsed = normalizeConfig(JSON.parse(jsonText));
    if (!parsed.apps?.length) {
      throw new Error("Invalid config: missing apps");
    }
    state = parsed;
    await persist();
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  window.MySpaceConfig = {
    init,
    reloadFromProfile,
    persist,
    getState,
    getApps,
    getSettings,
    getWidgets,
    getDesktopSpaces,
    switchDesktopSpace,
    getPaletteRecents,
    pushPaletteRecent,
    getPositions,
    getTaskbarPins,
    isPinnedToTaskbar,
    pinToTaskbar,
    unpinFromTaskbar,
    toggleTaskbarPin,
    setPosition,
    resetPositions,
    updateSettings,
    addApp,
    updateApp,
    setAppHidden,
    removeApp,
    canRemove,
    resetAppPosition,
    moveAppToTop,
    moveAppToBottom,
    duplicateApp,
    sortAppsAlphabetically,
    resetToDefaults,
    exportData,
    importData,
    subscribe,
    PROTECTED_IDS,
  };
})();