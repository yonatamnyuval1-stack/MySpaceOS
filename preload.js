const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("mySpace", {
  getConfig: () => ipcRenderer.invoke("get-config"),
  getDefaults: () => ipcRenderer.invoke("get-defaults"),
  launchApp: (appEntry) => ipcRenderer.invoke("launch-app", appEntry),
  resolveAppIcon: (appEntry) => ipcRenderer.invoke("resolve-app-icon", appEntry),
  scanInstalledApps: () => ipcRenderer.invoke("scan-installed-apps"),
  pickExecutable: () => ipcRenderer.invoke("pick-executable"),
  validateExternalApp: (data) => ipcRenderer.invoke("validate-external-app", data),
  focusExternalApp: (exePath) => ipcRenderer.invoke("focus-external-app", exePath),
  embedApp: {
    available: () => ipcRenderer.invoke("embed-app", "available"),
    start: (args) => ipcRenderer.invoke("embed-app", "start", args),
    updateBounds: (args) => ipcRenderer.invoke("embed-app", "updateBounds", args),
    setVisible: (args) => ipcRenderer.invoke("embed-app", "setVisible", args),
    focus: (args) => ipcRenderer.invoke("embed-app", "focus", args),
    stop: (args) => ipcRenderer.invoke("embed-app", "stop", args),
    fallbackExternal: (args) => ipcRenderer.invoke("embed-app", "fallbackExternal", args),
  },
  openSystemUrl: (url) => ipcRenderer.invoke("open-system-url", url),
  resolveAppPath: (appEntry) => ipcRenderer.invoke("resolve-app-path", appEntry),
  revealPath: (targetPath, kind) => ipcRenderer.invoke("reveal-path", targetPath, kind),
  saveUserData: (data) => ipcRenderer.invoke("save-user-data", data),
  resetUserData: () => ipcRenderer.invoke("reset-user-data"),
  identity: {
    status: () => ipcRenderer.invoke("myspace-identity", "status"),
    current: () => ipcRenderer.invoke("myspace-identity", "current"),
    register: (payload) => ipcRenderer.invoke("myspace-identity", "register", payload || {}),
    login: (payload) => ipcRenderer.invoke("myspace-identity", "login", payload || {}),
    logout: () => ipcRenderer.invoke("myspace-identity", "logout"),
    onChanged: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on("myspace-identity-changed", handler);
      return () => ipcRenderer.removeListener("myspace-identity-changed", handler);
    },
  },
  uiLanguage: {
    get: () => ipcRenderer.invoke("os-ui-language"),
    getSync: () => {
      try {
        const res = ipcRenderer.sendSync("os-ui-language-sync");
        return res?.language || "en";
      } catch {
        return "en";
      }
    },
    notifyChanged: (language) =>
      ipcRenderer.invoke("os-ui-language-broadcast", { language }),
    onChanged: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on("myspace-language-changed", handler);
      return () => ipcRenderer.removeListener("myspace-language-changed", handler);
    },
  },
  shellEngine: {
    load: () => ipcRenderer.invoke("shell-engine", "load"),
    save: (data) => ipcRenderer.invoke("shell-engine", "save", data),
    execute: (line) => ipcRenderer.invoke("shell-engine", "execute", { line }),
    onUpdated: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on("shell-engine-updated", handler);
      return () => ipcRenderer.removeListener("shell-engine-updated", handler);
    },
  },
  isDesktop: true,
  aiChat: {
    chat: (messages, conversationId) =>
      ipcRenderer.invoke("ai-chat", "chat", { messages, conversationId }),
    newConversation: () => ipcRenderer.invoke("ai-chat", "newConversation"),
    models: () => ipcRenderer.invoke("ai-chat", "models"),
    meta: () => ipcRenderer.invoke("ai-chat", "meta"),
    listTools: () => ipcRenderer.invoke("ai-chat", "listTools"),
    setToolActive: (name, active) =>
      ipcRenderer.invoke("ai-chat", "setToolActive", { name, active }),
  },
  onDriftScanUpdate: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("drift-scan-update", handler);
    return () => ipcRenderer.removeListener("drift-scan-update", handler);
  },
  onShellHotkey: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("shell-hotkey", handler);
    return () => ipcRenderer.removeListener("shell-hotkey", handler);
  },
  onShortcutsHotkey: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("shortcuts-hotkey", handler);
    return () => ipcRenderer.removeListener("shortcuts-hotkey", handler);
  },
  desktopSearch: (query, opts) =>
    ipcRenderer.invoke(
      "desktop-search",
      opts && typeof opts === "object" ? { query, ...opts } : query
    ),
  getMyspaceBrowserHome: () => ipcRenderer.invoke("myspace-browser-home"),
  openNewWindow: () => ipcRenderer.invoke("open-new-window"),
  app: {
    quit: () => ipcRenderer.invoke("app-lifecycle", "quit"),
    restart: () => ipcRenderer.invoke("app-lifecycle", "restart"),
  },
  shellUx: (channel, args) => ipcRenderer.invoke("shell-ux", channel, args),
  onFocusChanged: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("focus-changed", handler);
    return () => ipcRenderer.removeListener("focus-changed", handler);
  },
  notifications: {
    list: () => ipcRenderer.invoke("notifications", "list"),
    markRead: (id) => ipcRenderer.invoke("notifications", "markRead", { id }),
    markAllRead: () => ipcRenderer.invoke("notifications", "markAllRead"),
    clear: (opts) => ipcRenderer.invoke("notifications", "clear", opts || {}),
    remove: (id) => ipcRenderer.invoke("notifications", "remove", { id }),
    prefs: () => ipcRenderer.invoke("notifications", "prefs.get"),
    setPrefs: (data) => ipcRenderer.invoke("notifications", "prefs.set", data || {}),
    blockSender: (email) => ipcRenderer.invoke("notifications", "blocklist.add", { email }),
    unblockSender: (email) => ipcRenderer.invoke("notifications", "blocklist.remove", { email }),
    onUpdated: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on("notifications-updated", handler);
      return () => ipcRenderer.removeListener("notifications-updated", handler);
    },
  },
  updates: {
    status: () => ipcRenderer.invoke("updates", "status"),
    list: (args) => ipcRenderer.invoke("updates", "list", args || {}),
    check: () => ipcRenderer.invoke("updates", "check"),
    apply: (updateId) => ipcRenderer.invoke("updates", "apply", { updateId }),
    skip: (updateId) => ipcRenderer.invoke("updates", "skip", { updateId }),
  },
  network: {
    status: () => ipcRenderer.invoke("network", "status"),
    adapters: () => ipcRenderer.invoke("network", "adapters"),
    ports: (args) => ipcRenderer.invoke("network", "ports", args || {}),
    check: () => ipcRenderer.invoke("network", "check"),
    checks: () => ipcRenderer.invoke("network", "checks"),
    openSettings: () => ipcRenderer.invoke("network", "open-settings"),
  },
  backup: {
    export: () => ipcRenderer.invoke("backup", "export", {}),
    import: () => ipcRenderer.invoke("backup", "import", {}),
    path: () => ipcRenderer.invoke("backup", "path", {}),
    status: () => ipcRenderer.invoke("backup", "status", {}),
    history: (args) => ipcRenderer.invoke("backup", "history", args || {}),
    reveal: (filePath) => ipcRenderer.invoke("backup", "reveal", { path: filePath }),
  },
  storage: {
    status: () => ipcRenderer.invoke("storage", "status"),
    drives: () => ipcRenderer.invoke("storage", "drives"),
    apps: () => ipcRenderer.invoke("storage", "apps"),
    largeFiles: (args) => ipcRenderer.invoke("storage", "large-files", args || {}),
    scan: (args) => ipcRenderer.invoke("storage", "scan", args || {}),
    cancel: () => ipcRenderer.invoke("storage", "cancel"),
    cleanup: () => ipcRenderer.invoke("storage", "cleanup"),
    cleanupDelete: (args) => ipcRenderer.invoke("storage", "cleanup.delete", args || {}),
    path: () => ipcRenderer.invoke("storage", "path"),
    reveal: (filePath) => ipcRenderer.invoke("storage", "reveal", { path: filePath }),
    openSettings: () => ipcRenderer.invoke("storage", "open-settings"),
  },
  themes: {
    catalog: () => ipcRenderer.invoke("themes", "catalog"),
    get: (args) => ipcRenderer.invoke("themes", "get", args || {}),
    set: (args) => ipcRenderer.invoke("themes", "set", args || {}),
    reset: (args) => ipcRenderer.invoke("themes", "reset", args || {}),
  },
  mail: {
    status: () => ipcRenderer.invoke("mail", "status"),
    providers: () => ipcRenderer.invoke("mail", "providers.list"),
    connect: (provider) => ipcRenderer.invoke("mail", "accounts.connect", { provider }),
    disconnect: (accountId) => ipcRenderer.invoke("mail", "accounts.disconnect", { accountId }),
    listMessages: (args) => ipcRenderer.invoke("mail", "messages.list", args || {}),
    getMessage: (args) => ipcRenderer.invoke("mail", "messages.get", args || {}),
    sync: (args) => ipcRenderer.invoke("mail", "sync.now", args || {}),
  },
  spaceFile: {
    open: (filePath) => ipcRenderer.invoke("space-file", "open", { path: filePath }),
    inspect: (filePath) => ipcRenderer.invoke("space-file", "inspect", { path: filePath }),
    export: (args) => ipcRenderer.invoke("space-file", "export", args || {}),
    pick: () => ipcRenderer.invoke("space-file", "pick", {}),
    onOpen: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on("space-file-open", handler);
      return () => ipcRenderer.removeListener("space-file-open", handler);
    },
  },
  scripts: {
    list: () => ipcRenderer.invoke("myapp-invoke", "scripts", "scripts.list", {}),
    run: (nameOrOpts) => {
      const args =
        typeof nameOrOpts === "string"
          ? { name: nameOrOpts }
          : nameOrOpts && typeof nameOrOpts === "object"
            ? nameOrOpts
            : {};
      return ipcRenderer.invoke("myapp-invoke", "scripts", "scripts.run", args);
    },
    get: (nameOrId) =>
      ipcRenderer.invoke("myapp-invoke", "scripts", "scripts.get", {
        name: nameOrId,
        id: nameOrId,
      }),
    create: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "scripts",
        "scripts.create",
        typeof args === "string" ? { name: args } : args || {}
      ),
    update: (args) =>
      ipcRenderer.invoke("myapp-invoke", "scripts", "scripts.update", args || {}),
    set: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "scripts",
        "scripts.set",
        typeof args === "string"
          ? { name: args.split(/\s+/)[0], body: args.slice(args.indexOf(" ") + 1) }
          : args || {}
      ),
    append: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "scripts",
        "scripts.append",
        typeof args === "string"
          ? { name: args.split(/\s+/)[0], text: args.slice(args.indexOf(" ") + 1) }
          : args || {}
      ),
    delete: (nameOrId) =>
      ipcRenderer.invoke("myapp-invoke", "scripts", "scripts.delete", {
        id: nameOrId,
        name: nameOrId,
      }),
    duplicate: (nameOrId) =>
      ipcRenderer.invoke("myapp-invoke", "scripts", "scripts.duplicate", {
        id: nameOrId,
        name: nameOrId,
      }),
    parse: (body) =>
      ipcRenderer.invoke("myapp-invoke", "scripts", "scripts.parse", {
        body: typeof body === "string" ? body : body?.body || "",
      }),
  },
  maps: {
    geocode: (queryOrOpts) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "world-maps",
        "geocode",
        typeof queryOrOpts === "string" ? { query: queryOrOpts } : queryOrOpts || {}
      ),
    reverse: (lat, lng, lang) =>
      ipcRenderer.invoke("myapp-invoke", "world-maps", "reverse-geocode", {
        lat,
        lng,
        lang,
      }),
    country: (lat, lng, lang) =>
      ipcRenderer.invoke("myapp-invoke", "world-maps", "reverse-geocode-country", {
        lat,
        lng,
        lang,
      }),
    notes: () => ipcRenderer.invoke("myapp-invoke", "world-maps", "notes-load", {}),
    routes: () => ipcRenderer.invoke("myapp-invoke", "world-maps", "routes-load", {}),
    authStatus: () => ipcRenderer.invoke("myapp-invoke", "world-maps", "auth-status", {}),
    syncStatus: () => ipcRenderer.invoke("myapp-invoke", "world-maps", "sync-status", {}),
  },

  clock: {
    timerStart: (args) =>
      ipcRenderer.invoke("myapp-invoke", "world-clock", "timer.start", args || {}),
    timerPause: () => ipcRenderer.invoke("myapp-invoke", "world-clock", "timer.pause", {}),
    timerStop: () => ipcRenderer.invoke("myapp-invoke", "world-clock", "timer.stop", {}),
    timerStatus: () => ipcRenderer.invoke("myapp-invoke", "world-clock", "timer.status", {}),
    pomodoroStart: (args) =>
      ipcRenderer.invoke("myapp-invoke", "world-clock", "pomodoro.start", args || {}),
    pomodoroPause: () =>
      ipcRenderer.invoke("myapp-invoke", "world-clock", "pomodoro.pause", {}),
    stopwatchStart: (args) =>
      ipcRenderer.invoke("myapp-invoke", "world-clock", "stopwatch.start", args || {}),
  },
  today: {
    list: () => ipcRenderer.invoke("myapp-invoke", "day-planner", "tasks.list", {}),
    add: (args) => ipcRenderer.invoke("myapp-invoke", "day-planner", "task.add", args || {}),
    update: (args) => ipcRenderer.invoke("myapp-invoke", "day-planner", "task.update", args || {}),
    toggle: (id) =>
      ipcRenderer.invoke("myapp-invoke", "day-planner", "task.toggle", {
        id: typeof id === "object" ? id?.id : id,
      }),
    delete: (id) =>
      ipcRenderer.invoke("myapp-invoke", "day-planner", "task.delete", {
        id: typeof id === "object" ? id?.id : id,
      }),
    snooze: (args) => ipcRenderer.invoke("myapp-invoke", "day-planner", "task.snooze", args || {}),
    clearDone: () => ipcRenderer.invoke("myapp-invoke", "day-planner", "tasks.clearDone", {}),
  },
  stocks: {
    quote: (symbols) =>
      ipcRenderer.invoke("myapp-invoke", "stocks", "quote.get", {
        symbols: Array.isArray(symbols) ? symbols : [symbols].filter(Boolean),
      }),
    setMode: (mode) =>
      ipcRenderer.invoke("myapp-invoke", "stocks", "market.setMode", { mode }),
    modes: () => ipcRenderer.invoke("myapp-invoke", "stocks", "market.modes", {}),
    watchlist: (args) =>
      ipcRenderer.invoke("myapp-invoke", "stocks", "market.watchlist", args || {}),
    watch: (symbol, mode) =>
      ipcRenderer.invoke("myapp-invoke", "stocks", "watchlist.add", { symbol, mode }),
    unwatch: (symbol, mode) =>
      ipcRenderer.invoke("myapp-invoke", "stocks", "watchlist.remove", { symbol, mode }),
    portfolio: () => ipcRenderer.invoke("myapp-invoke", "stocks", "portfolio.get", {}),
    hold: (args) => ipcRenderer.invoke("myapp-invoke", "stocks", "portfolio.set", args || {}),
    alerts: () => ipcRenderer.invoke("myapp-invoke", "stocks", "alerts.list", {}),
    alertAdd: (args) => ipcRenderer.invoke("myapp-invoke", "stocks", "alerts.add", args || {}),
    alertRemove: (args) =>
      ipcRenderer.invoke("myapp-invoke", "stocks", "alerts.remove", args || {}),
    buylist: () => ipcRenderer.invoke("myapp-invoke", "stocks", "buylist.list", {}),
  },
  builds: {
    list: (args) =>
      ipcRenderer.invoke("myapp-invoke", "builds", "projects.list", args || {}),
    get: (args) => {
      const a =
        typeof args === "string" ? { name: args, id: args, project: args } : args || {};
      return ipcRenderer.invoke("myapp-invoke", "builds", "projects.get", a);
    },
    create: (args) =>
      ipcRenderer.invoke("myapp-invoke", "builds", "projects.create", args || {}),
    delete: (args) => {
      const a =
        typeof args === "string" ? { name: args, id: args, project: args } : args || {};
      return ipcRenderer.invoke("myapp-invoke", "builds", "projects.delete", a);
    },
    duplicate: (args) => {
      const a =
        typeof args === "string" ? { name: args, id: args, project: args } : args || {};
      return ipcRenderer.invoke("myapp-invoke", "builds", "projects.duplicate", a);
    },
    rescan: (args) => {
      const a =
        typeof args === "string" ? { name: args, id: args, project: args } : args || {};
      return ipcRenderer.invoke("myapp-invoke", "builds", "projects.rescan", a);
    },
    linkFolder: (args) =>
      ipcRenderer.invoke("myapp-invoke", "builds", "projects.linkFolder", args || {}),
    openFolder: (args) =>
      ipcRenderer.invoke("myapp-invoke", "builds", "folder.open", args || {}),
  },
  vault: {
    status: () => ipcRenderer.invoke("myapp-invoke", "profiles", "vault.status", {}),
    lock: () => ipcRenderer.invoke("myapp-invoke", "profiles", "vault.lock", {}),
    list: () => ipcRenderer.invoke("myapp-invoke", "profiles", "vault.list", {}),
    get: (id) =>
      ipcRenderer.invoke("myapp-invoke", "profiles", "vault.get", {
        id: typeof id === "object" ? id?.id : id,
      }),
    save: (args) => ipcRenderer.invoke("myapp-invoke", "profiles", "vault.save", args || {}),
    delete: (id) =>
      ipcRenderer.invoke("myapp-invoke", "profiles", "vault.delete", {
        id: typeof id === "object" ? id?.id : id,
      }),
    copyPassword: (id) =>
      ipcRenderer.invoke("myapp-invoke", "profiles", "vault.copyPassword", {
        id: typeof id === "object" ? id?.id : id,
      }),
  },
  drift: {
    events: (args) =>
      ipcRenderer.invoke("myapp-invoke", "drift", "events.list", args || {}),
    clearEvents: (args) =>
      ipcRenderer.invoke("myapp-invoke", "drift", "events.clear", args || {}),
    zones: () => ipcRenderer.invoke("myapp-invoke", "drift", "zones.list", {}),
    addZone: (args) =>
      ipcRenderer.invoke("myapp-invoke", "drift", "zones.add", args || {}),
    removeZone: (args) =>
      ipcRenderer.invoke("myapp-invoke", "drift", "zones.remove", args || {}),
    toggleZone: (args) =>
      ipcRenderer.invoke("myapp-invoke", "drift", "zones.toggle", args || {}),
    scan: (args) =>
      ipcRenderer.invoke("myapp-invoke", "drift", "scan.run", args || {}),
    insights: (args) =>
      ipcRenderer.invoke("myapp-invoke", "drift", "insights.get", args || {}),
    settings: (args) =>
      ipcRenderer.invoke("myapp-invoke", "drift", "settings.update", args || {}),
  },
  studyDeck: {
    list: () => ipcRenderer.invoke("myapp-invoke", "study-deck", "decks.list", {}),
    get: (id) =>
      ipcRenderer.invoke("myapp-invoke", "study-deck", "deck.get", {
        id: typeof id === "object" ? id?.id : id,
      }),
    create: (args) =>
      ipcRenderer.invoke("myapp-invoke", "study-deck", "deck.create", args || {}),
    update: (args) =>
      ipcRenderer.invoke("myapp-invoke", "study-deck", "deck.update", args || {}),
    delete: (id) =>
      ipcRenderer.invoke("myapp-invoke", "study-deck", "deck.delete", {
        id: typeof id === "object" ? id?.id : id,
      }),
    addCard: (args) =>
      ipcRenderer.invoke("myapp-invoke", "study-deck", "card.add", args || {}),
    updateCard: (args) =>
      ipcRenderer.invoke("myapp-invoke", "study-deck", "card.update", args || {}),
    deleteCard: (args) =>
      ipcRenderer.invoke("myapp-invoke", "study-deck", "card.delete", args || {}),
    grade: (args) =>
      ipcRenderer.invoke("myapp-invoke", "study-deck", "card.grade", args || {}),
    generate: (args) =>
      ipcRenderer.invoke("myapp-invoke", "study-deck", "cards.generate", args || {}),
  },
  contacts: {
    load: () => ipcRenderer.invoke("myapp-invoke", "contacts", "storage.load", {}),
    save: (args) => ipcRenderer.invoke("myapp-invoke", "contacts", "storage.save", args || {}),
    add: (args) => ipcRenderer.invoke("myapp-invoke", "contacts", "contact.add", args || {}),
    delete: (id) =>
      ipcRenderer.invoke("myapp-invoke", "contacts", "contact.delete", {
        id: typeof id === "object" ? id?.id : id,
      }),
    upcoming: () => ipcRenderer.invoke("myapp-invoke", "contacts", "reminders.upcoming", {}),
    email: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "contacts",
        "email.open",
        typeof args === "string" ? { email: args } : args || {}
      ),
    phone: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "contacts",
        "phone.open",
        typeof args === "string" ? { phone: args } : args || {}
      ),
    sms: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "contacts",
        "sms.open",
        typeof args === "string" ? { phone: args } : args || {}
      ),
  },
  notes: {
    load: () => ipcRenderer.invoke("myapp-invoke", "notes", "storage.load", {}),
    save: (args) => ipcRenderer.invoke("myapp-invoke", "notes", "storage.save", args || {}),
    list: (args) => ipcRenderer.invoke("myapp-invoke", "notes", "notes.list", args || {}),
    search: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "notes",
        "notes.search",
        typeof args === "string" ? { q: args } : args || {}
      ),
    get: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "notes",
        "note.get",
        typeof args === "string" ? { ref: args } : args || {}
      ),
    add: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "notes",
        "note.add",
        typeof args === "string" ? { text: args } : args || {}
      ),
    update: (args) => ipcRenderer.invoke("myapp-invoke", "notes", "note.update", args || {}),
    delete: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "notes",
        "note.delete",
        typeof args === "string" ? { ref: args } : args || {}
      ),
    pin: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "notes",
        "note.pin",
        typeof args === "string" ? { ref: args } : args || {}
      ),
    archive: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "notes",
        "note.archive",
        typeof args === "string" ? { ref: args } : args || {}
      ),
    notebooks: () => ipcRenderer.invoke("myapp-invoke", "notes", "notebooks.list", {}),
    addNotebook: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "notes",
        "notebook.add",
        typeof args === "string" ? { name: args } : args || {}
      ),
  },
  tasks: {
    load: () => ipcRenderer.invoke("myapp-invoke", "tasks", "storage.load", {}),
    snapshot: () => ipcRenderer.invoke("myapp-invoke", "tasks", "snapshot", {}),
    list: (args) => ipcRenderer.invoke("myapp-invoke", "tasks", "items.list", args || {}),
    search: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "tasks",
        "items.search",
        typeof args === "string" ? { q: args } : args || {}
      ),
    get: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "tasks",
        "item.get",
        typeof args === "string" ? { ref: args } : args || {}
      ),
    add: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "tasks",
        "item.add",
        typeof args === "string" ? { text: args } : args || {}
      ),
    update: (args) => ipcRenderer.invoke("myapp-invoke", "tasks", "item.update", args || {}),
    toggle: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "tasks",
        "item.toggle",
        typeof args === "string" ? { ref: args } : args || {}
      ),
    delete: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "tasks",
        "item.delete",
        typeof args === "string" ? { ref: args } : args || {}
      ),
    flag: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "tasks",
        "item.flag",
        typeof args === "string" ? { ref: args } : args || {}
      ),
    move: (args) => ipcRenderer.invoke("myapp-invoke", "tasks", "item.move", args || {}),
    scheduleToday: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "tasks",
        "item.scheduleToday",
        typeof args === "string" ? { ref: args } : args || {}
      ),
    projects: () => ipcRenderer.invoke("myapp-invoke", "tasks", "projects.list", {}),
    addProject: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "tasks",
        "project.add",
        typeof args === "string" ? { name: args } : args || {}
      ),
  },
  chat: {
    list: () => ipcRenderer.invoke("myapp-invoke", "chat", "chat.list", {}),
    get: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "chat",
        "chat.get",
        typeof args === "string" ? { id: args } : args || {}
      ),
    create: (args) => ipcRenderer.invoke("myapp-invoke", "chat", "chat.create", args || {}),
    delete: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "chat",
        "chat.delete",
        typeof args === "string" ? { id: args } : args || {}
      ),
    rename: (args) => ipcRenderer.invoke("myapp-invoke", "chat", "chat.rename", args || {}),
    pin: (args) => ipcRenderer.invoke("myapp-invoke", "chat", "chat.pin", args || {}),
    clear: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "chat",
        "chat.clear",
        typeof args === "string" ? { id: args } : args || {}
      ),
    regenerate: (args) => ipcRenderer.invoke("myapp-invoke", "chat", "chat.regenerate", args || {}),
    send: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "chat",
        "chat.send",
        typeof args === "string" ? { text: args } : args || {}
      ),
    getSettings: () => ipcRenderer.invoke("myapp-invoke", "chat", "chat.settings.get", {}),
    setSettings: (args) =>
      ipcRenderer.invoke("myapp-invoke", "chat", "chat.settings.set", args || {}),
  },
  translate: {
    text: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "translate",
        "translate.text",
        typeof args === "string" ? { text: args } : args || {}
      ),
    detect: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "translate",
        "detect.language",
        typeof args === "string" ? { text: args } : args || {}
      ),
    languages: () => ipcRenderer.invoke("myapp-invoke", "translate", "languages.list", {}),
    load: () => ipcRenderer.invoke("myapp-invoke", "translate", "storage.load", {}),
    addHistory: (args) =>
      ipcRenderer.invoke("myapp-invoke", "translate", "history.add", args || {}),
    batch: (args) =>
      ipcRenderer.invoke("myapp-invoke", "translate", "translate.batch", args || {}),
  },
    sysinfo: {
    system: () => ipcRenderer.invoke("myapp-invoke", "system-info", "system.scan", {}),
    cpu: () => ipcRenderer.invoke("myapp-invoke", "system-info", "cpu.scan", {}),
    memory: () => ipcRenderer.invoke("myapp-invoke", "system-info", "memory.scan", {}),
    storage: () => ipcRenderer.invoke("myapp-invoke", "system-info", "storage.scan", {}),
    processes: () => ipcRenderer.invoke("myapp-invoke", "system-info", "processes.scan", {}),
    network: () => ipcRenderer.invoke("myapp-invoke", "system-info", "network.scan", {}),
    ports: () => ipcRenderer.invoke("myapp-invoke", "system-info", "ports.scan", {}),
    environment: () => ipcRenderer.invoke("myapp-invoke", "system-info", "environment.scan", {}),
    metrics: () => ipcRenderer.invoke("myapp-invoke", "system-info", "metrics.sample", {}),
    diskRoots: () => ipcRenderer.invoke("myapp-invoke", "system-info", "disk.roots", {}),
  },
  remote: {
    load: () => ipcRenderer.invoke("myapp-invoke", "remote-hub", "storage.load", {}),
    save: (args) => ipcRenderer.invoke("myapp-invoke", "remote-hub", "storage.save", args || {}),
    check: (args) =>
      ipcRenderer.invoke("myapp-invoke", "remote-hub", "machines.check", args || {}),
    connect: (args) =>
      ipcRenderer.invoke("myapp-invoke", "remote-hub", "connect", args || {}),
    wake: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "remote-hub",
        "wol.wake",
        typeof args === "string" ? { mac: args } : args || {}
      ),
    scan: (args) =>
      ipcRenderer.invoke("myapp-invoke", "remote-hub", "network.scan", args || {}),
    tools: () => ipcRenderer.invoke("myapp-invoke", "remote-hub", "tools.local", {}),
    tailscaleImport: () =>
      ipcRenderer.invoke("myapp-invoke", "remote-hub", "tailscale.import", {}),
    exportMachines: () =>
      ipcRenderer.invoke("myapp-invoke", "remote-hub", "machines.export", {}),
  },
  osBridge: {
    status: () => ipcRenderer.invoke("myapp-invoke", "os-bridge", "status", {}),
    pairStatus: () => ipcRenderer.invoke("myapp-invoke", "os-bridge", "pair.status", {}),
    pairStart: (args) => ipcRenderer.invoke("myapp-invoke", "os-bridge", "pair.start", args || {}),
    pairStop: () => ipcRenderer.invoke("myapp-invoke", "os-bridge", "pair.stop", {}),
    pairRefreshCode: () => ipcRenderer.invoke("myapp-invoke", "os-bridge", "pair.refreshCode", {}),
    openUrlOnPhone: (url) =>
      ipcRenderer.invoke("myapp-invoke", "os-bridge", "pair.openUrl", { url }),
    places: () => ipcRenderer.invoke("myapp-invoke", "os-bridge", "places.list", {}),
    openPlace: (path) => ipcRenderer.invoke("myapp-invoke", "os-bridge", "places.open", { path }),
    inbox: () => ipcRenderer.invoke("myapp-invoke", "os-bridge", "inbox.list", {}),
    outbox: () => ipcRenderer.invoke("myapp-invoke", "os-bridge", "outbox.list", {}),
    clipboardRead: () => ipcRenderer.invoke("myapp-invoke", "os-bridge", "clipboard.read", {}),
    clipboardSendToPhone: (args) =>
      ipcRenderer.invoke("myapp-invoke", "os-bridge", "clipboard.sendToPhone", args || {}),
    sendFile: (args) => ipcRenderer.invoke("myapp-invoke", "os-bridge", "pair.sendFile", args || {}),
    onEvent: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on("os-bridge-event", handler);
      return () => ipcRenderer.removeListener("os-bridge-event", handler);
    },
  },
  files: {
    status: () => ipcRenderer.invoke("myapp-invoke", "files", "status", {}),
    home: () => ipcRenderer.invoke("myapp-invoke", "files", "home", {}),
    places: () => ipcRenderer.invoke("myapp-invoke", "files", "places.list", {}),
    drives: () => ipcRenderer.invoke("myapp-invoke", "files", "drives.list", {}),
    list: (path, opts) =>
      ipcRenderer.invoke("myapp-invoke", "files", "dir.list", {
        path,
        ...(opts && typeof opts === "object" ? opts : {}),
      }),
    preview: (path) =>
      ipcRenderer.invoke("myapp-invoke", "files", "file.preview", { path }),
    open: (path) => ipcRenderer.invoke("myapp-invoke", "files", "file.open", { path }),
    reveal: (path) => ipcRenderer.invoke("myapp-invoke", "files", "file.reveal", { path }),
    recent: () => ipcRenderer.invoke("myapp-invoke", "files", "recent.list", {}),
    clearRecent: () => ipcRenderer.invoke("myapp-invoke", "files", "recent.clear", {}),
    favorites: () => ipcRenderer.invoke("myapp-invoke", "files", "favorites.list", {}),
    addFavorite: (args) =>
      ipcRenderer.invoke("myapp-invoke", "files", "favorites.add", args || {}),
    removeFavorite: (args) =>
      ipcRenderer.invoke("myapp-invoke", "files", "favorites.remove", args || {}),
    pickFolder: (args) =>
      ipcRenderer.invoke("myapp-invoke", "files", "folder.pick", args || {}),
    pickFile: (args) => ipcRenderer.invoke("myapp-invoke", "files", "file.pick", args || {}),
    mkdir: (args) => ipcRenderer.invoke("myapp-invoke", "files", "dir.create", args || {}),
    workspaceMkdir: (args) =>
      ipcRenderer.invoke("myapp-invoke", "files", "dir.mkdir", args || {}),
    write: (args) => ipcRenderer.invoke("myapp-invoke", "files", "file.write", args || {}),
    workspaceCopy: (args) =>
      ipcRenderer.invoke("myapp-invoke", "files", "file.workspace.copy", args || {}),
    workspaceRoot: () => ipcRenderer.invoke("myapp-invoke", "files", "workspace.root", {}),
    rename: (args) => ipcRenderer.invoke("myapp-invoke", "files", "file.rename", args || {}),
    delete: (args) => ipcRenderer.invoke("myapp-invoke", "files", "file.delete", args || {}),
    copy: (args) => ipcRenderer.invoke("myapp-invoke", "files", "file.copy", args || {}),
    move: (args) => ipcRenderer.invoke("myapp-invoke", "files", "file.move", args || {}),
  },
  studies: {
    load: () => ipcRenderer.invoke("myapp-invoke", "studies", "storage.load", {}),
    save: (args) => ipcRenderer.invoke("myapp-invoke", "studies", "storage.save", args || {}),
  },
  geography: {
    list: (args) =>
      ipcRenderer.invoke("myapp-invoke", "geography", "countries.list", args || {}),
    get: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "geography",
        "countries.get",
        typeof args === "string" ? { code: args, skipWiki: true } : args || {}
      ),
    learn: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "geography",
        "learn.get",
        typeof args === "string" ? { code: args } : args || {}
      ),
    load: () => ipcRenderer.invoke("myapp-invoke", "geography", "storage.load", {}),
  },
  flags: {
    scores: () => ipcRenderer.invoke("myapp-invoke", "flag-quiz", "scores.list", {}),
    clearScores: () => ipcRenderer.invoke("myapp-invoke", "flag-quiz", "scores.clear", {}),
    meta: () => ipcRenderer.invoke("myapp-invoke", "flag-quiz", "meta", {}),
  },
  history: {
    status: () => ipcRenderer.invoke("myapp-invoke", "history", "cache.status", {}),
    figures: () => ipcRenderer.invoke("myapp-invoke", "history", "figures.list", {}),
    events: () => ipcRenderer.invoke("myapp-invoke", "history", "events.list", {}),
    get: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "history",
        "entity.get",
        typeof args === "string" ? { id: args } : args || {}
      ),
    load: () => ipcRenderer.invoke("myapp-invoke", "history", "storage.load", {}),
  },
  space: {
    catalog: (args) =>
      ipcRenderer.invoke("myapp-invoke", "space", "catalog.list", args || {}),
    get: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "space",
        "catalog.get",
        typeof args === "string" ? { id: args, skipWiki: true } : args || {}
      ),
    apod: (args) =>
      ipcRenderer.invoke("myapp-invoke", "space", "apod.today", args || {}),
    missions: (args) =>
      ipcRenderer.invoke("myapp-invoke", "space", "nasa.missions.list", args || {}),
    mission: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "space",
        "nasa.missions.get",
        typeof args === "string" ? { id: args } : args || {}
      ),
    reports: (args) =>
      ipcRenderer.invoke("myapp-invoke", "space", "nasa.reports.list", args || {}),
    report: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "space",
        "nasa.reports.get",
        typeof args === "string" ? { id: args } : args || {}
      ),
  },
  contracts: {
    list: () => ipcRenderer.invoke("myapp-invoke", "contracts", "contracts.list", {}),
    get: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "contracts",
        "contracts.get",
        typeof args === "string" ? { id: args } : args || {}
      ),
    templates: () => ipcRenderer.invoke("myapp-invoke", "contracts", "templates.list", {}),
    upcoming: () => ipcRenderer.invoke("myapp-invoke", "contracts", "expiry.upcoming", {}),
    check: () => ipcRenderer.invoke("myapp-invoke", "contracts", "expiry.check", {}),
  },
  msl: {
    list: () => ipcRenderer.invoke("msl", "msl.list", {}),
    keys: () => ipcRenderer.invoke("msl", "msl.keys.list", {}),
    saveKey: (args) => ipcRenderer.invoke("msl", "msl.keys.save", args || {}),
    deleteKey: (args) => ipcRenderer.invoke("msl", "msl.keys.delete", args || {}),
    invoke: (args) =>
      ipcRenderer.invoke(
        "msl",
        "msl.invoke",
        typeof args === "string" ? { capability: args } : args || {}
      ),
    parse: (args) =>
      ipcRenderer.invoke(
        "msl",
        "msl.key.parse",
        typeof args === "string" ? { uri: args } : args || {}
      ),
    build: (args) => ipcRenderer.invoke("msl", "msl.key.build", args || {}),
    resolve: (args) =>
      ipcRenderer.invoke(
        "msl",
        "msl.key.resolve",
        typeof args === "string" ? { uri: args } : args || {}
      ),
    injectList: (args) => ipcRenderer.invoke("msl", "msl.inject.list", args || {}),
    injectSet: (args) => ipcRenderer.invoke("msl", "msl.inject.set", args || {}),
    injectRemove: (args) => ipcRenderer.invoke("msl", "msl.inject.remove", args || {}),
    injectClear: (args) => ipcRenderer.invoke("msl", "msl.inject.clear", args || {}),
    injectTargets: () => ipcRenderer.invoke("msl", "msl.inject.targets", {}),
  },
  parts: {
    list: (args) => ipcRenderer.invoke("parts", "parts.list", args || {}),
    get: (args) =>
      ipcRenderer.invoke(
        "parts",
        "parts.get",
        typeof args === "string" ? { id: args } : args || {}
      ),
    adopt: (args) => ipcRenderer.invoke("parts", "parts.adopt", args || {}),
    publish: (args) => ipcRenderer.invoke("parts", "parts.publish", args || {}),
    unpublish: (args) => ipcRenderer.invoke("parts", "parts.unpublish", args || {}),
    published: (args) => ipcRenderer.invoke("parts", "parts.published", args || {}),
    targets: () => ipcRenderer.invoke("parts", "parts.targets", {}),
    reload: () => ipcRenderer.invoke("parts", "parts.reload", {}),
  },
  jobs: {
    list: (args) => ipcRenderer.invoke("jobs", "jobs.list", args || {}),
    get: (args) =>
      ipcRenderer.invoke("jobs", "jobs.get", typeof args === "string" ? { id: args } : args || {}),
    enqueue: (args) => ipcRenderer.invoke("jobs", "jobs.enqueue", args || {}),
    run: (args) => ipcRenderer.invoke("jobs", "jobs.run", args || {}),
    cancel: (args) =>
      ipcRenderer.invoke("jobs", "jobs.cancel", typeof args === "string" ? { id: args } : args || {}),
    retry: (args) =>
      ipcRenderer.invoke("jobs", "jobs.retry", typeof args === "string" ? { id: args } : args || {}),
    clearFinished: () => ipcRenderer.invoke("jobs", "jobs.clearFinished", {}),
    capacity: () => ipcRenderer.invoke("jobs", "jobs.capacity.get", {}),
    setCapacity: (args) => ipcRenderer.invoke("jobs", "jobs.capacity.set", args || {}),
    stats: () => ipcRenderer.invoke("jobs", "jobs.stats", {}),
    onUpdated: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on("jobs-updated", handler);
      return () => ipcRenderer.removeListener("jobs-updated", handler);
    },
  },
  scheduler: {
    list: (args) => ipcRenderer.invoke("scheduler", "schedule.list", args || {}),
    get: (args) =>
      ipcRenderer.invoke(
        "scheduler",
        "schedule.get",
        typeof args === "string" ? { id: args } : args || {}
      ),
    add: (args) =>
      ipcRenderer.invoke(
        "scheduler",
        "schedule.add",
        typeof args === "string" ? { spec: args } : args || {}
      ),
    pause: (args) =>
      ipcRenderer.invoke(
        "scheduler",
        "schedule.pause",
        typeof args === "string" ? { id: args } : args || {}
      ),
    resume: (args) =>
      ipcRenderer.invoke(
        "scheduler",
        "schedule.resume",
        typeof args === "string" ? { id: args } : args || {}
      ),
    remove: (args) =>
      ipcRenderer.invoke(
        "scheduler",
        "schedule.remove",
        typeof args === "string" ? { id: args } : args || {}
      ),
    runNow: (args) =>
      ipcRenderer.invoke(
        "scheduler",
        "schedule.runNow",
        typeof args === "string" ? { id: args } : args || {}
      ),
    history: (args) => ipcRenderer.invoke("scheduler", "schedule.history", args || {}),
    clearHistory: () => ipcRenderer.invoke("scheduler", "schedule.clearHistory", {}),
    stats: () => ipcRenderer.invoke("scheduler", "schedule.stats", {}),
    onUpdated: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on("scheduler-updated", handler);
      return () => ipcRenderer.removeListener("scheduler-updated", handler);
    },
  },
  host: {
    run: (args) => ipcRenderer.invoke("host", "host.run", args || {}),
    which: (args) => ipcRenderer.invoke("host", "host.which", args || {}),
    runtimes: () => ipcRenderer.invoke("host", "host.runtimes", {}),
    status: () => ipcRenderer.invoke("host", "status", {}),
  },
  appBuilder: {
    scaffold: (args) => ipcRenderer.invoke("app-builder", "app.scaffold", args || {}),
    register: (args) => ipcRenderer.invoke("app-builder", "app.register", args || {}),
    list: () => ipcRenderer.invoke("app-builder", "app.list", {}),
    status: () => ipcRenderer.invoke("app-builder", "app.status", {}),
    build: (args) => ipcRenderer.invoke("app-builder", "app.pack.build", args || {}),
    pickPack: () => ipcRenderer.invoke("app-builder", "app.pack.pick", {}),
  },
  resolve: {
    report: (args) => ipcRenderer.invoke("resolve", "resolve.report", args || {}),
    ask: (args) => ipcRenderer.invoke("resolve", "resolve.ask", args || {}),
    list: (args) => ipcRenderer.invoke("resolve", "resolve.list", args || {}),
    get: (args) => ipcRenderer.invoke("resolve", "resolve.get", args || {}),
    apply: (args) => ipcRenderer.invoke("resolve", "resolve.apply", args || {}),
    dismiss: (args) => ipcRenderer.invoke("resolve", "resolve.dismiss", args || {}),
    clear: (args) => ipcRenderer.invoke("resolve", "resolve.clear", args || {}),
    status: () => ipcRenderer.invoke("resolve", "resolve.status", {}),
    playbooks: () => ipcRenderer.invoke("resolve", "resolve.playbooks", {}),
    onUpdated: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on("resolve-updated", handler);
      return () => ipcRenderer.removeListener("resolve-updated", handler);
    },
  },
  mind: {
    status: () => ipcRenderer.invoke("mind", "mind.status", {}),
    providers: () => ipcRenderer.invoke("mind", "mind.providers", {}),
    setSettings: (args) => ipcRenderer.invoke("mind", "mind.settings.set", args || {}),
    setKey: (args) => ipcRenderer.invoke("mind", "mind.key.set", args || {}),
    clearKey: (args) => ipcRenderer.invoke("mind", "mind.key.clear", args || {}),
    ask: (args) =>
      ipcRenderer.invoke(
        "mind",
        "mind.ask",
        typeof args === "string" ? { prompt: args } : args || {}
      ),
    chat: (args) => ipcRenderer.invoke("mind", "mind.chat", args || {}),
    test: (args) =>
      ipcRenderer.invoke(
        "mind",
        "mind.test",
        typeof args === "string" ? { provider: args } : args || {}
      ),
    onUpdated: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on("mind-updated", handler);
      return () => ipcRenderer.removeListener("mind-updated", handler);
    },
    memory: {
      list: () => ipcRenderer.invoke("mind", "mind.memory.list", {}),
      add: (args) => ipcRenderer.invoke("mind", "mind.memory.add", args || {}),
      update: (args) => ipcRenderer.invoke("mind", "mind.memory.update", args || {}),
      delete: (args) => ipcRenderer.invoke("mind", "mind.memory.delete", args || {}),
      clear: () => ipcRenderer.invoke("mind", "mind.memory.clear", {}),
      setEnabled: (enabled) => ipcRenderer.invoke("mind", "mind.memory.enabled", { enabled }),
    },
  },
  link: {
    profiles: (args) => ipcRenderer.invoke("link", "link.profiles.list", args || {}),
    profile: (args) =>
      ipcRenderer.invoke(
        "link",
        "link.profiles.get",
        typeof args === "string" ? { moduleId: args } : args || {}
      ),
    routes: (args) => ipcRenderer.invoke("link", "link.routes.list", args || {}),
    declare: (args) => ipcRenderer.invoke("link", "link.routes.declare", args || {}),
    reload: () => ipcRenderer.invoke("link", "link.routes.reload", {}),
    route: (args) =>
      ipcRenderer.invoke(
        "link",
        "link.routes.get",
        typeof args === "string" ? { id: args } : args || {}
      ),
    send: (args) => ipcRenderer.invoke("link", "link.command.send", args || {}),
    publish: (args) => ipcRenderer.invoke("link", "link.event.publish", args || {}),
    subscribe: (args) => ipcRenderer.invoke("link", "link.event.subscribe", args || {}),
    unsubscribe: (args) => ipcRenderer.invoke("link", "link.event.unsubscribe", args || {}),
    register: (args) => ipcRenderer.invoke("link", "link.register", args || {}),
    reply: (args) => ipcRenderer.invoke("link", "link.command.reply", args || {}),
    log: (args) => ipcRenderer.invoke("link", "link.log.list", args || {}),
    clearLog: () => ipcRenderer.invoke("link", "link.log.clear", {}),
    stats: () => ipcRenderer.invoke("link", "link.stats", {}),
    subscriptions: () => ipcRenderer.invoke("link", "link.subscriptions.list", {}),
    onEvent: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on("link-event", handler);
      return () => ipcRenderer.removeListener("link-event", handler);
    },
    onCommand: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on("link-command", handler);
      return () => ipcRenderer.removeListener("link-command", handler);
    },
    onActivity: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on("link-activity", handler);
      return () => ipcRenderer.removeListener("link-activity", handler);
    },
  },
  lexicon: {
    stats: () => ipcRenderer.invoke("myapp-invoke", "code-lexicon", "stats.get", {}),
    categories: () =>
      ipcRenderer.invoke("myapp-invoke", "code-lexicon", "categories.list", {}),
    search: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "code-lexicon",
        "terms.search",
        typeof args === "string" ? { q: args } : args || {}
      ),
    get: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "code-lexicon",
        "terms.get",
        typeof args === "string" ? { id: args, slug: args } : args || {}
      ),
    daily: () => ipcRenderer.invoke("myapp-invoke", "code-lexicon", "terms.daily", {}),
    list: (args) =>
      ipcRenderer.invoke("myapp-invoke", "code-lexicon", "terms.list", args || {}),
  },
  flow: {
    meta: () => ipcRenderer.invoke("myapp-invoke", "model-flow", "flow.meta", {}),
    tools: () => ipcRenderer.invoke("myapp-invoke", "model-flow", "flow.tools", {}),
    history: () => ipcRenderer.invoke("myapp-invoke", "model-flow", "flow.history", {}),
    historyGet: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "model-flow",
        "flow.history.get",
        typeof args === "string" ? { id: args } : args || {}
      ),
    plan: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "model-flow",
        "flow.plan",
        typeof args === "string" ? { task: args } : args || {}
      ),
    normalize: (args) =>
      ipcRenderer.invoke("myapp-invoke", "model-flow", "flow.normalize", args || {}),
    run: (args) =>
      ipcRenderer.invoke("myapp-invoke", "model-flow", "flow.run", args || {}),
    saveAsScript: (args) =>
      ipcRenderer.invoke("myapp-invoke", "model-flow", "flow.saveAsScript", args || {}),
    blank: (args) => ipcRenderer.invoke("myapp-invoke", "model-flow", "flow.blank", args || {}),
    library: () => ipcRenderer.invoke("myapp-invoke", "model-flow", "flow.library.list", {}),
    librarySave: (args) =>
      ipcRenderer.invoke("myapp-invoke", "model-flow", "flow.library.save", args || {}),
    setApiKey: (args) =>
      ipcRenderer.invoke(
        "myapp-invoke",
        "model-flow",
        "flow.setApiKey",
        typeof args === "string" ? { apiKey: args } : args || {}
      ),
    clearApiKey: () =>
      ipcRenderer.invoke("myapp-invoke", "model-flow", "flow.clearApiKey", {}),
  },
  console: {
    aliases: () =>
      ipcRenderer.invoke("myapp-invoke", "shell-console", "aliases.list", {}),
    macros: () => ipcRenderer.invoke("myapp-invoke", "shell-console", "macros.list", {}),
    when: () => ipcRenderer.invoke("myapp-invoke", "shell-console", "when.list", {}),
    history: () =>
      ipcRenderer.invoke("myapp-invoke", "shell-console", "history.list", {}),
  },
  docs: {
    load: () => ipcRenderer.invoke("myapp-invoke", "docs", "storage.load", {}),
    openPage: (id) =>
      ipcRenderer.invoke("myapp-invoke", "docs", "page.open", {
        id: typeof id === "object" ? id?.id : id,
      }),
    toggleBookmark: (id) =>
      ipcRenderer.invoke("myapp-invoke", "docs", "bookmarks.toggle", {
        id: typeof id === "object" ? id?.id : id,
      }),
    meta: () => ipcRenderer.invoke("myapp-invoke", "docs", "meta", {}),
  },
  onMailEvent: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("mail-event", handler);
    return () => ipcRenderer.removeListener("mail-event", handler);
  },
});

try {
  const { attachFaultBridge } = require("./apps/shared/fault-preload");
  attachFaultBridge(contextBridge, ipcRenderer, "desktop");
} catch (err) {
  console.error("[desktop preload] Fault bridge failed:", err);
}
