
(function () {
  const { P, h2, p, note, tip, warn, code, ul, ol, table, kicker } = window.DocsBlocks;
  const PAGES = window.DOCS_PAGES || (window.DOCS_PAGES = {});
  function add(page) {
    PAGES[page.id] = page;
  }

  add(
    P("settings-complete", "Every settings key", "Full schema from settings-definitions.js", ["data", "settings", "reference"], [
      kicker("Data"),
      p("This page lists every key in apps/shared/settings-definitions.js: the authoritative schema for per-app Settings panels. Values persist in userData/app-settings.json keyed by app id. Channels: settings.load · settings.set · settings.setMany · settings.schema · settings.reset."),
      p("Apps without a schema have no settings.* panel. World Maps also keeps some per-user settings under userData/world-maps/ separate from this schema."),
      code(["settings", "settings.load via myApp.invoke", "settings.reset"]),
      note("Defaults below are schema defaults. Live UI may coerce types (toggles → boolean, numeric selects → number)."),
      h2("Shared: Interface language (uiLanguage)"),
      p("My Space OS display languages: English, Hebrew, Arabic, French, Russian, Spanish (en / he / ar / fr / ru / es). Hebrew and Arabic are RTL. Product apps get a Language section with key uiLanguage (not the legacy key language)."),
      table(
        ["Key", "Label", "Type", "Default", "Hint / options"],
        [
          ["uiLanguage", "Interface language", "select", "\"system\"", "Follow OS display language, or force one language (RTL for he/ar). options: system / en / he / ar / fr / ru / es · section: Language"]
        ]
      ),
      ul([
        "system = follow desktop OS language; otherwise force that locale for the app UI.",
        "Legacy migration: if uiLanguage is missing and language is a known option (system|en|he|ar|fr|ru|es), settings load copies language → uiLanguage.",
        "Deep dives: i18n-languages, app-ui-language, accounts-local-auth.",
      ]),
      h2("Builds (builds)"),
      table(
        ["Key", "Label", "Type", "Default", "Hint / options"],
        [
          ["autoRefreshEnabled", "Auto-refresh trees", "toggle", "true", "Rescan linked project folders in the background, options: section: Folder sync"],
          ["autoRefreshMinutes", "Refresh interval", "select", "3", "Minutes between automatic tree scans, options: 1 / 2 / 3 / 5 / 10 / 15 / 30 · section: Folder sync"],
          ["watchFolderDefault", "Watch new projects", "toggle", "true", "Enable auto-refresh when linking a folder, options: section: Folder sync"],
          ["showTreeCounts", "Tree file counts", "toggle", "true", "Show file & folder counts in the code tree, options: section: Display"],
          ["confirmDelete", "Confirm delete", "toggle", "true", "Ask before removing a project, options: section: Display"],
          ["mslIcons", "Icon Library via My Space Link", "toggle whenOff:msl-icons-off", "true", "Choose Lucide icons for projects through MSL. Turn off to roll back to emoji-only icons. · options: — · section: Display"],
          ["mslProvider", "Publish Builds over MSL", "toggle", "true", "Allow other apps to list/create projects via MSL. Turn off to roll back. options: section: My Space Link"]
        ]
      ),
      h2("Drift (drift)"),
      table(
        ["Key", "Label", "Type", "Default", "Hint / options"],
        [
          ["backgroundScan", "Background scan", "toggle", "true", "Watch zones for file changes while My Space runs, options: section: Activity scan"],
          ["scanIntervalMinutes", "Scan interval", "select", "5", "Minutes between zone scans, options: 1 / 2 / 5 / 10 / 15 / 30, section: Activity scan"],
          ["desktopNotifications", "Desktop alerts", "toggle", "false", "Notify on notable file activity, options: section: Activity scan"]
        ]
      ),
      h2("Stocks (stocks)"),
      table(
        ["Key", "Label", "Type", "Default", "Hint / options"],
        [
          ["autoRefresh", "Auto-refresh quotes", "toggle", "true", "Update prices while the app is open, options: section: Market data"],
          ["refreshSeconds", "Quote interval", "select", "180", "Seconds between price updates (default 3 min), options: 60 / 120 / 180 / 300, section: Market data"],
          ["showAfterHours", "After-hours data", "toggle", "false", "Include extended hours when available, options: section: Market data"],
          ["uiLayout", "UI layout", "select", "\"organized\"", "Organized = new layout. Classic = exact previous look. options: organized / classic, section: Appearance"],
          ["uiLanguage", "Interface language", "select", "\"system\"", "Follow OS or force a language (RTL for he/ar). options: system / en / he / ar / fr / ru / es, section: Language"],
          ["mslProvider", "Publish Stocks over MSL", "toggle", "true", "Allow other apps to fetch quotes and watchlists via MSL. Turn off to roll back. options: section: My Space Link"]
        ]
      ),
      h2("Contacts (contacts)"),
      table(
        ["Key", "Label", "Type", "Default", "Hint / options"],
        [
          ["birthdayReminders", "Birthday reminders", "toggle", "true", "Desktop notifications for upcoming birthdays, options: section: Reminders"],
          ["reminderDaysBefore", "Remind days before", "select", "1", "How early to alert before a birthday, options: 0 / 1 / 3 / 7, section: Reminders"],
          ["mslProvider", "Publish Contacts over MSL", "toggle", "true", "Allow other apps to list contacts and open email/phone via MSL. Turn off to roll back. · options: — · section: My Space Link"]
        ]
      ),
      h2("Contracts (contracts)"),
      table(
        ["Key", "Label", "Type", "Default", "Hint / options"],
        [
          ["expiryNotifications", "Expiry notifications", "toggle", "true", "Alert when contracts are ending soon, options: section: Expiry alerts"],
          ["expiryDaysAhead", "Days ahead", "select", "30", "How many days before expiry to warn, options: 7 / 14 / 30 / 60 / 90, section: Expiry alerts"]
        ]
      ),
      h2("Console (shell-console)"),
      table(
        ["Key", "Label", "Type", "Default", "Hint / options"],
        [
          ["saveHistory", "Save history", "toggle", "true", "Keep command history between sessions, options: section: Command engine"],
          ["syncFromDesktop", "Sync shell config", "toggle", "true", "Merge shortcuts from desktop shell on open, options: section: Command engine"],
          ["confirmClear", "Confirm clear", "toggle", "true", "Ask before clearing history or rules, options: section: Command engine"]
        ]
      ),
      h2("Translate (translate)"),
      table(
        ["Key", "Label", "Type", "Default", "Hint / options"],
        [
          ["saveHistory", "Save history", "toggle", "true", "Remember recent translations, options: section: Translation"],
          ["autoDetect", "Auto-detect language", "toggle", "true", "Guess source language automatically, options: section: Translation"],
          ["mslProvider", "Publish Translate over MSL", "toggle", "true", "Allow other apps to translate text via MSL. Turn off to roll back. options: section: My Space Link"]
        ]
      ),
      h2("Vault (profiles)"),
      table(
        ["Key", "Label", "Type", "Default", "Hint / options"],
        [
          ["vaultLockMinutes", "Auto-lock vault", "select", "15", "Minutes idle before vault locks, options: 5 / 15 / 30 / 60 / 0, section: Vault"],
          ["maskSecrets", "Mask secrets", "toggle", "true", "Hide vault values until revealed, options: section: Vault"]
        ]
      ),
      h2("Clock (world-clock)"),
      table(
        ["Key", "Label", "Type", "Default", "Hint / options"],
        [
          ["use24Hour", "24-hour format", "toggle", "false", "Show times in 24h instead of AM/PM, options: section: Clock display"],
          ["showSeconds", "Show seconds", "toggle", "true", "Include seconds on live clocks, options: section: Clock display"],
          ["soundAlerts", "Timer sounds", "toggle", "true", "Play sound when timer or pomodoro ends, options: section: Clock display"],
          ["mslProvider", "Publish Clock over MSL", "toggle", "true", "Allow other apps to read favorites and trigger focus via MSL. Turn off to roll back. options: section: My Space Link"]
        ]
      ),
      h2("Geography (geography)"),
      table(
        ["Key", "Label", "Type", "Default", "Hint / options"],
        [
          ["richProfiles", "Rich country profiles", "toggle whenOff:geo-lite-profiles", "true", "Load detailed learn-mode content, options: section: Explore"],
          ["showFlags", "Show flags", "toggle whenOff:geo-hide-flags", "true", "Display country flags in lists and detail views, options: section: Explore"],
          ["mslProvider", "Publish Geography over MSL", "toggle", "true", "Allow other apps to list countries and learn profiles via MSL. Turn off to roll back. options: section: My Space Link"]
        ]
      ),
      h2("Space (space)"),
      table(
        ["Key", "Label", "Type", "Default", "Hint / options"],
        [
          ["lowGraphics", "Low graphics mode", "toggle", "false", "Reduce animations for slower machines, options: section: Viewer"],
          ["autoFetchNasa", "Auto-load NASA", "toggle", "true", "Fetch NASA imagery when opening NASA Lab, options: section: Viewer"],
          ["mslProvider", "Publish Space over MSL", "toggle", "true", "Allow other apps to search bodies and open Space links. Turn off to roll back. · options: — · section: My Space Link"]
        ]
      ),
      h2("Studies (studies)"),
      table(
        ["Key", "Label", "Type", "Default", "Hint / options"],
        [
          ["autosave", "Autosave", "toggle", "true", "Save document edits automatically. options: section: Documents"],
          ["spellCheck", "Spell check hints", "toggle", "false", "Underline possible spelling issues, options: section: Documents"],
          ["formalStudio", "Formal documents (phase 1)", "toggle whenOff:formal-studio-off", "true", "Continuous formal editor, style presets, and DOCX export. Turn off to roll back to classic visual Studies only. · options: — · section: Documents"],
          ["mslProvider", "Publish Studies over MSL", "toggle", "true", "Allow other apps to list documents and export via MSL. Turn off to roll back. options: section: My Space Link"]
        ]
      ),
      h2("Remote Hub (remote-hub)"),
      table(
        ["Key", "Label", "Type", "Default", "Hint / options"],
        [
          ["connectionTimeout", "Timeout (seconds)", "select", "30", "Give up if host does not respond, options: 15 / 30 / 60 / 120, section: Connections"],
          ["savePasswords", "Remember passwords", "toggle", "false", "Store connection passwords locally, options: section: Connections"]
        ]
      ),
      h2("History (history)"),
      table(
        ["Key", "Label", "Type", "Default", "Hint / options"],
        [
          ["compactTimeline", "Compact timeline", "toggle", "false", "Denser event rows in the feed options:  section: Timeline"],
          ["showImages", "Show thumbnails", "toggle", "true", "Load preview images when available options:  section: Timeline"],
          ["mslProvider", "Publish History over MSL", "toggle", "true", "Allow other apps to list figures/events via MSL. Turn off to roll back. · options: — · section: My Space Link"]
        ]
      ),
      h2("Code Lexicon (code-lexicon)"),
      table(
        ["Key", "Label", "Type", "Default", "Hint / options"],
        [
          ["showExamples", "Show examples", "toggle", "true", "Display code examples on term cards. options: section: Reading"],
          ["largeText", "Large text", "toggle", "false", "Increase definition font size, options: section: Reading"]
        ]
      ),
      h2("System Info (system-info)"),
      table(
        ["Key", "Label", "Type", "Default", "Hint / options"],
        [
          ["autoSample", "Auto-sample metrics", "toggle", "true", "Record CPU/RAM samples in Performance Lab, options: section: Metrics"],
          ["sampleIntervalSec", "Sample interval", "select", "5", "Seconds between metric samples, options: 2 / 5 / 10 / 30, section: Metrics"],
          ["hideSystemProcesses", "Hide system processes", "toggle", "false", "Filter low-level Windows processes, options: section: Metrics"]
        ]
      ),
      h2("Learning Games (flag-quiz)"),
      table(
        ["Key", "Label", "Type", "Default", "Hint / options"],
        [
          ["uiLanguage", "Interface language", "select", "\"system\"", "Follow OS or force a language (RTL for he/ar). options: system / en / he / ar / fr / ru / es, section: Language"]
        ]
      ),
      h2("Pi Digits (pi-digits)"),
      table(
        ["Key", "Label", "Type", "Default", "Hint / options"],
        [
          ["targetDigits", "Target digits", "select", "280", "How far you aim to memorize, options: 50 / 100 / 150 / 200 / 280 / 300 / 500, section: Practice"],
          ["defaultChunkSize", "Digits per lesson", "select", "4", "How many new digits to learn at a time, options: 3 / 4 / 5, section: Practice"]
        ]
      ),
      h2("Icon Library (icon-library)"),
      table(
        ["Key", "Label", "Type", "Default", "Hint / options"],
        [
          ["defaultSize", "Default preview size", "select", "48", "Starting size in the preview panel, options: 24 / 32 / 48 / 64 / 96, section: Preview defaults"],
          ["mslProvider", "Publish icons over MSL", "toggle", "true", "Allow other apps to search and pick icons. Turn off to roll back Icon Library as an MSL provider. · options: — · section: My Space Link"]
        ]
      ),
      h2("Info (apps-info)"),
      table(
        ["Key", "Label", "Type", "Default", "Hint / options"],
        [
          ["mslProvider", "Publish app catalog over MSL", "toggle", "true", "Allow other apps to list apps and digests via MSL. Turn off to roll back. · options: — · section: My Space Link"]
        ]
      ),
      h2("Docs (docs)"),
      table(
        ["Key", "Label", "Type", "Default", "Hint / options"],
        [
          ["restoreLastPage", "Restore last page", "toggle", "true", "Reopen the article you were reading, options: section: Reading"]
        ]
      ),
      h2("World Maps (world-maps)"),
      table(
        ["Key", "Label", "Type", "Default", "Hint / options"],
        [
          ["mslProvider", "Publish World Maps over MSL", "toggle", "true", "Allow other apps to geocode and read notes/routes via MSL. Turn off to roll back. · options: — · section: My Space Link"]
        ]
      ),
      h2("Today (day-planner)"),
      table(
        ["Key", "Label", "Type", "Default", "Hint / options"],
        [
          ["mslProvider", "Publish Today over MSL", "toggle", "true", "Allow other apps to list/add tasks via MSL. Turn off to roll back. · options: — · section: My Space Link"]
        ]
      ),
      h2("MSL platform (system service)"),
      p("MSL has no desktop app tile. The broker lives in main/msl/; the desktop uses ipc channel msl with caller desktop. Mint/inject UI is the system panel."),
      tip("Turning mslProvider off is the supported rollback if a published capability misbehaves."),
      warn("Vault auto-lock and maskSecrets never replace unlocking in the Vault UI: the shell still cannot take a master password."),
      note("Product apps listed above also receive uiLanguage via the shared Language section injector even when this page only shows app-specific keys."),
      h2("Related"),
      p("settings, settings-index, i18n-languages, app-ui-language, accounts-local-auth, storage, userdata-map, msl-capabilities, architecture."),
    ])
  );

  add(
    P("msl-capabilities", "MSL capabilities (complete)", "All 55 published capability ids", ["protocols", "msl", "reference"], [
      kicker("Protocols"),
      p("My Space Link publishes capabilities from provider modules under main/msl/providers/. The broker (main/msl/broker.js) aggregates them, enforces caller allowlists, and honors per-app mslProvider kill-switches from Settings."),
      p("Shell: msl(list), msl(caps), msl(keys), msl(parse msl://…), msl(panel). Minting and injection live in the MSL system panel tabs."),
      h2("All capability ids"),
      table(
        ["Provider", "Capability id", "Kind", "Purpose"],
        [
          ["icon-library", "icons.search", "query", "Search icon pack"],
          ["icon-library", "icons.get", "query", "Get icon by id"],
          ["icon-library", "icons.pick", "ui", "Open icon picker modal contract"],
          ["space", "space.bodies.search", "query", "Search celestial bodies"],
          ["space", "space.bodies.get", "query", "Get body details"],
          ["space", "space.wiki.get", "query", "Wiki-style body text"],
          ["space", "space.link.open", "action", "Open a Space link"],
          ["translate", "translate.text", "action", "Translate text"],
          ["translate", "translate.languages.list", "query", "List languages"],
          ["translate", "translate.detect", "query", "Detect language"],
          ["translate", "translate.history.list", "query", "Translation history"],
          ["apps-info", "apps.catalog.list", "query", "List app catalog"],
          ["apps-info", "apps.catalog.get", "query", "Get one app record"],
          ["apps-info", "apps.digest.get", "query", "Get activity digest"],
          ["world-clock", "clock.favorites.list", "query", "List clock favorites"],
          ["world-clock", "clock.pomodoro.get", "query", "Pomodoro status"],
          ["world-clock", "clock.focus.enter", "action", "Enter focus mode"],
          ["world-clock", "clock.calendar.openUrl", "action", "Open calendar URL"],
          ["stocks", "stocks.quote.get", "query", "Quote for symbol"],
          ["stocks", "stocks.search", "query", "Search symbols"],
          ["stocks", "stocks.watchlist.get", "query", "Watchlist"],
          ["stocks", "stocks.portfolio.get", "query", "Portfolio"],
          ["history", "history.figures.list", "query", "List figures"],
          ["history", "history.events.list", "query", "List events"],
          ["history", "history.entity.get", "query", "Get entity"],
          ["history", "history.link.open", "action", "Open history link"],
          ["world-maps", "maps.geocode", "query", "Forward geocode"],
          ["world-maps", "maps.reverseGeocode", "query", "Reverse geocode"],
          ["world-maps", "maps.country.at", "query", "Country at point"],
          ["world-maps", "maps.notes.list", "query", "List map notes"],
          ["world-maps", "maps.routes.list", "query", "List map routes"],
          ["contacts", "contacts.list", "query", "List contacts"],
          ["contacts", "contacts.reminders.upcoming", "query", "Upcoming reminders"],
          ["contacts", "contacts.email.open", "action", "Open mailto"],
          ["contacts", "contacts.phone.open", "action", "Open tel"],
          ["notes", "notes.list", "query", "List notes"],
          ["notes", "notes.search", "query", "Search notes"],
          ["notes", "notes.get", "query", "Get note by id/title"],
          ["notes", "notes.add", "action", "Create a note"],
          ["geography", "geography.countries.list", "query", "List countries"],
          ["geography", "geography.countries.get", "query", "Get country"],
          ["geography", "geography.learn.get", "query", "Learn profile"],
          ["geography", "geography.maps.open", "action", "Open maps for country"],
          ["day-planner", "day-planner.tasks.list", "query", "List tasks"],
          ["day-planner", "day-planner.task.add", "action", "Add task"],
          ["day-planner", "day-planner.task.toggle", "action", "Toggle done"],
          ["day-planner", "day-planner.tasks.generate", "action", "Generate tasks"],
          ["builds", "builds.projects.list", "query", "List projects"],
          ["builds", "builds.projects.get", "query", "Get project"],
          ["builds", "builds.projects.create", "action", "Create project"],
          ["builds", "builds.folder.open", "action", "Open project folder"],
          ["studies", "studies.docs.list", "query", "List documents"],
          ["studies", "studies.docs.get", "query", "Get document"],
          ["studies", "studies.export.pdf", "action", "Export PDF"],
          ["studies", "studies.export.docx", "action", "Export DOCX"]
        ]
      ),
      h2("Who may call"),
      p("MSL_CLIENTS (non-icon caps): builds, icon-library, apps-info, space, translate, studies, day-planner, shell-console, contacts, geography, world-clock, stocks, history, world-maps, contracts, profiles, study-deck, flag-quiz, drift, code-lexicon, model-flow, desktop, shell."),
      p("icons.* ALLOWED_CALLERS only: builds, icon-library, apps-info, day-planner, contacts, desktop, shell, studies."),
      p("Extra gate: Builds calling icons.* also requires settings.mslIcons !== false."),
      h2("Inject targets"),
      p("Keys can be injected into: studies, world-maps, study-deck, model-flow, stocks, day-planner. Injected keys feed AI context gatherers in those apps."),
      h2("Broker channels"),
      code([
        "msl.list, msl.invoke",
        "msl.key.parse, msl.key.build, msl.key.resolve",
        "msl.keys.list, msl.keys.save, msl.keys.delete",
        "msl.inject.list, msl.inject.set, msl.inject.remove, msl.inject.clear, msl.inject.targets",
      ]),
      h2("URI shape"),
      code(["msl:v1/<capability>?param=value", "Built/parsed by apps/shared/msl-key.js"]),
      tip("If a capability is missing from msl(list), check the provider's mslProvider toggle and Restart & Update."),
      warn("Treat minted keys like capability URLs: do not embed secrets inside them."),
      h2("Related"),
      p("msl, msl-providers, app-msl, settings-complete, architecture."),
    ])
  );

  add(
    P("architecture", "System architecture", "Folders, processes, and how pieces connect", ["reference", "architecture", "developers"], [
      kicker("Reference"),
      p("My Space is an Electron app. The desktop window loads the shell UI with root preload.js (window.mySpace). Each first-party myapp opens in its own BrowserWindow with apps/<module>/preload.js (window.myApp). Main process code lives under main/ and routes IPC."),
      h2("Repository map"),
      table(
        ["Path", "Role"],
        [
          ["main.js", "Electron main entry: windows, userData path, IPC registration"],
          ["preload.js", "Desktop bridge → window.mySpace"],
          ["src/shell-commands.js", "Shell language + ROUTE_REGISTRY + command executors"],
          ["src/config-store.js", "Desktop config normalize / persist"],
          ["config/apps.json", "Default catalog, wallpaper, app entries"],
          ["config/updates.json", "Major update banners"],
          ["apps/<module>/", "myapp UI (index.html, styles, app.js, preload.js)"],
          ["main/apps/*-ipc.js", "Per-module IPC handlers"],
          ["main/apps/ipc.js", "ALLOWED_MODULES + myapp-invoke router"],
          ["main/msl/", "MSL broker, providers, registry"],
          ["apps/shared/", "Settings schema, MSL client, shared UI"],
          ["apps/docs/", "This handbook"],
        ]
      ),
      h2("Runtime processes"),
      ol([
        "Main process owns windows, filesystem, encryption boundaries, scans, and brokers.",
        "Desktop renderer is the control plane (pins, wallpaper, shell line, notifications).",
        "Each myapp renderer is sandboxed to myApp.invoke(channel, args) for its moduleId.",
      ]),
      h2("Launch path"),
      code([
        "run builds / mySpace.launchApp",
        "→ resolveMyApp(apps/<module>/)",
        "→ BrowserWindow + apps/<module>/preload.js",
        "→ optional route inject (setPage / setActivePage / …)",
      ]),
      h2("userData root"),
      p("Forced to app.getPath('appData')/my-space (app.setPath('userData', …)). Packaged builds store user-config.json there; see userdata-map for every JSON file."),
      tip("End-user Docs pages live under Apps / Protocols / Data. This page is for builders and deep operators."),
      h2("Related"),
      p("ipc-map, myspace-bridge, userdata-map, settings-complete, msl-capabilities, apps-windows."),
    ])
  );

  add(
    P("ipc-map", "IPC map", "myapp-invoke, ALLOWED_MODULES, settings & MSL channels", ["reference", "architecture", "ipc"], [
      kicker("Reference"),
      p("All myapp traffic goes through ipcMain handle myapp-invoke(moduleId, channel, args). The router in main/apps/ipc.js rejects unknown modules, then dispatches settings.*, msl.*, or the module's *-ipc.js handler."),
      h2("ALLOWED_MODULES (39)"),
      code(["system-info", "world-clock", "remote-hub", "os-bridge", "files", "studies", "study-deck", "day-planner", "profiles", "stocks", "translate", "contacts", "notes", "tasks", "coupons", "chat", "geography", "history", "space", "contracts", "builds", "code-lexicon", "drift", "shell-console", "scripts", "world-maps", "flag-quiz", "apps-info", "model-flow", "pi-digits", "icon-library", "docs", "mail", "pulse", "parts", "permissions", "msl-protocol", "jobs", "resolve"]),
      note("A module must also exist as apps/<moduleId>/ on disk. MSL is not an app module: desktop uses ipcMain handle \"msl\". Platform services themes / network / backup / storage / updates / scheduler use dedicated ipcMain handlers (not this Set); their catalog ids still appear in config/apps.json."),
      h2("Shared channels (any allowed module)"),
      table(
        ["Channel family", "Handler", "Notes"],
        [
          ["settings.load/set/setMany/schema/reset", "app-settings-ipc.js", "Requires schema entry"],
          ["msl.list / msl.invoke / msl.*", "main/msl/broker.js", "Caller = moduleId"],
        ]
      ),
      h2("Canonical app preload"),
      code([
        "contextBridge.exposeInMainWorld(\"myApp\", {",
        "  moduleId: MODULE_ID,",
        "  invoke: (channel, args) =>",
        "    ipcRenderer.invoke(\"myapp-invoke\", MODULE_ID, channel, args || {}),",
        "});",
      ]),
      h2("Notable variants"),
      ul([
        "builds/preload.js: myApp.onTreeUpdate for live tree events",
        "stocks/preload.js & studies/preload.js: Gemini / AI helpers",
        "world-maps/preload.js: worldMaps API plus myApp",
      ]),
      h2("System Info channel examples"),
      code([
        "ports.scan, processes.scan, memory.scan, storage.scan, cpu.scan",
        "system.scan, network.scan, environment.scan",
        "disk.roots, disk.scan, disk.largeFiles, disk.cancel",
        "metrics.sample, metrics.history, metrics.clear",
      ]),
      tip("Unknown channel → handler returns ok:false. After upgrades, Restart & Update so preload bridges match main."),
      h2("Related"),
      p("architecture, myspace-bridge, settings-complete, msl-capabilities."),
    ])
  );

  add(
    P("myspace-bridge", "Desktop mySpace bridge", "Every namespace on window.mySpace", ["reference", "architecture", "shell"], [
      kicker("Reference"),
      p("The desktop window loads root preload.js and exposes window.mySpace. The shell language (src/shell-commands.js) calls these namespaces to run silent verbs and open apps without each command needing its own BrowserWindow."),
      h2("Top-level helpers"),
      ul([
        "getConfig / getDefaults / saveUserData / resetUserData",
        "launchApp / resolveAppIcon / scanInstalledApps / pickExecutable",
        "validateExternalApp / focusExternalApp / openSystemUrl / resolveAppPath / revealPath",
        "isDesktop, desktopSearch, openNewWindow, shellUx",
        "onDriftScanUpdate, onShellHotkey, onShortcutsHotkey, onFocusChanged",
      ]),
      h2("Namespaces"),
      table(
        ["Namespace", "Role"],
        [
          ["embedApp", "Embed external windows"],
          ["shellEngine", "Load/save/execute shell engine"],
          ["aiChat", "Desktop AI chat + tools"],
          ["notifications", "Bell inbox: list/mark/clear, mail prefs & sender blocklist"],
          ["updates", "Major update banner / apply"],
          ["scripts", "Scripts module bridge"],
          ["clock", "Clock timer/pomodoro/stopwatch"],
          ["today", "Today tasks"],
          ["stocks", "Stocks quotes/watchlist/portfolio/alerts"],
          ["builds", "Builds projects"],
          ["vault", "Vault secrets"],
          ["drift", "Drift scan/zones/events"],
          ["studyDeck", "Study Deck"],
          ["contacts", "Contacts"],
          ["notes", "Notes"],
          ["translate", "Translate"],
          ["sysinfo", "System Info scans"],
          ["remote", "Remote Hub"],
          ["studies", "Studies"],
          ["geography", "Geography"],
          ["flags", "Flag quiz / Learning Games"],
          ["history", "History"],
          ["space", "Space"],
          ["contracts", "Contracts"],
          ["msl", "MSL protocol / broker"],
          ["lexicon", "Code Lexicon"],
          ["flow", "Model Flow"],
          ["console", "Console aliases/macros/when"],
          ["docs", "Docs bookmarks/pages"]
        ]
      ),
      h2("Pattern"),
      code([
        "mySpace.today.list()",
        "mySpace.stocks.quote({ symbol: \"AAPL\" })",
        "mySpace.docs.setPage({ page: \"overview\" })",
        "// Internally → myapp-invoke(<module>, <channel>, args)",
      ]),
      note("If a namespace is missing after an update, the shell reports API unavailable."),
      h2("Related"),
      p("architecture, ipc-map, cmd-protocol, shell-language."),
    ])
  );

  add(
    P("userdata-map", "userData file map", "Every persistent JSON under %APPDATA%/my-space", ["data", "reference", "storage"], [
      kicker("Data"),
      p("My Space forces Electron userData to %APPDATA%/my-space. Almost all personal state lives here as JSON. Prefer backup(export) / backup(import), or quit before hand-copying the folder."),
      h2("Complete file map"),
      table(
        ["File / folder", "Owner", "Contents"],
        [
          ["user-config.json", "Desktop", "Wallpaper, positions, spaces, pins, removed apps"],
          ["app-settings.json", "All schema apps", "Per-app settings values"],
          ["updates-state.json", "Updates", "Applied/skipped major update ids"],
          ["notifications.json", "Desktop", "Bell inbox items"],
          ["notifications-prefs.json", "Desktop", "Mail alerts toggle + blocked senders"],
          ["shell-engine.json", "Shell", "Aliases, macros, when, history engine state"],
          ["ai-tool-prefs.json", "AI", "Tool toggles for AI chat"],
          ["world-clock.json", "Clock", "Favorites, timer/pomodoro persistence"],
          ["remote-hub.json", "Remote Hub", "Machines inventory"],
          ["remote-hub-last.rdp", "Remote Hub", "Last RDP file"],
          ["studies.json", "Studies", "Documents & workspaces"],
          ["studies-image-cache.json", "Studies", "Image cache"],
          ["study-deck.json", "Study Deck", "Decks & cards"],
          ["day-planner.json", "Today", "Tasks / agenda"],
          ["profiles.json", "Vault", "Profile metadata"],
          ["vault.json", "Vault", "Encrypted secrets"],
          ["stocks.json", "Stocks", "Watchlist, portfolio, alerts"],
          ["translate.json", "Translate", "History & phrases"],
          ["contacts.json", "Contacts", "People database"],
          ["notes.json", "Notes", "Notebooks & notes"],
          ["geography.json", "Geography", "Travelled / user state"],
          ["geography-countries-cache.json", "Geography", "Country cache"],
          ["flag-quiz-scores.json", "Learning Games", "Scores"],
          ["history.json", "History", "Bookmarks / user state"],
          ["history-cache.json", "History", "Entity cache"],
          ["space.json", "Space", "User space state"],
          ["space-apod-cache.json", "Space", "APOD cache"],
          ["contracts.json", "Contracts", "Contracts library"],
          ["builds.json", "Builds", "Projects (+ .bak)"],
          ["code-lexicon.json", "Lexicon", "User overlay"],
          ["drift.json", "Drift", "Zones & events"],
          ["scripts.json", "Scripts", "Named scripts"],
          ["docs.json", "Docs", "Bookmarks, last page, recent"],
          ["pi-digits.json", "Pi Digits", "Progress / chunks"],
          ["icon-library.json", "Icon Library", "Favorites"],
          ["msl-protocol.json", "MSL", "Keys & injections"],
          ["model-flow-history.json", "Model Flow", "Plan history"],
          ["model-flow-secrets.json", "Model Flow", "Tool secrets"],
          ["system-info-metrics.json", "System Info", "Performance samples"],
          ["world-maps/", "World Maps", "users.json, sync.json, per-user notes/routes/settings"],
          ["chat-app.json", "Chat", "Conversations & settings"],
          ["tasks.json / tasks data", "Tasks", "Projects & next actions"],
          ["coupons-vault.json", "Coupons", "Coupon vault entries"],
          ["coupons-expiry-meta.json", "Coupons", "Expiry metadata"],
          ["os-bridge.json", "OS Bridge", "Pairing / bridge state"],
          ["os-bridge/", "OS Bridge", "Inbox/outbox / clip history dirs"],
          ["permissions-platform.json", "Permissions", "Platform permission grants"],
          ["themes-state.json", "Themes", "Per-app theme preferences"],
          ["backup-state.json", "Backup", "Export/import history"],
          ["backup-restore-pending.json", "Backup", "Staged restore marker"],
          ["storage-state.json", "Storage", "Disk/storage app state"],
          ["scheduler-platform.json", "Scheduler", "Schedules & run history"],
          ["resolve-incidents.json", "Resolve", "Incident / playbook state"]
        ]
      ),
      note("Pulse and Parts are mostly catalog/config driven (apps/*/pulse.json, parts.json, config/platform-parts.json); they may not own a single long-lived userData JSON the way Stocks does."),
      h2("Bundled (not userData)"),
      ul([
        "config/apps.json: default catalog & wallpaper id (includes coupons, pulse, parts, resolve, scheduler, permissions, themes, network, backup, storage, updates, os-bridge, …)",
        "config/updates.json: major update messages",
        "config/resolve-playbooks.json: Resolve playbook catalog",
        "data/code-lexicon.json: bundled lexicon corpus",
      ]),
      tip("Dev mode may use config/user-config.json instead of userData for the desktop overlay: packaged builds use userData/user-config.json."),
      warn("Prefer backup(import) over hand-copying while My Space is running: mid-write JSON can corrupt."),
      h2("Related"),
      p("storage, backups, settings-complete, architecture."),
    ])
  );

  add(
    P("desktop-config", "Desktop config & wallpaper", "user-config fields, spaces, pins, layout", ["desktop", "reference"], [
      kicker("Reference"),
      p("Desktop appearance and layout persist through mySpace.saveUserData → user-config.json (merged over config/apps.json defaults via src/config-store.js)."),
      h2("Important fields"),
      table(
        ["Field", "Meaning"],
        [
          ["wallpaper", "Active wallpaper id"],
          ["wallpaperPlaylist[]", "Rotation list"],
          ["wallpaperRotatedAt", "Last rotation timestamp"],
          ["positions", "Icon coordinates { [appId]: { x, y } }"],
          ["taskbarPins", "Pinned apps"],
          ["removedAppIds[]", "Soft-hidden catalog apps"],
          ["desktopSpaces", "Multi-space: activeId + spaces[{ id, name, wallpaper, pins, positions, session }]"],
          ["language / uiLanguage / locale / timeFormat", "OS display language (en/he/ar/fr/ru/es; RTL for he/ar) and related prefs"],
          ["widgets / hotCorners / paletteRecents", "Optional desktop chrome state"],
        ]
      ),
      h2("Shell helpers"),
      code(["desktop", "settings", "refresh", "sort", "reset layout", "pin <app>", "unpin <app>", "reveal <app>"]),
      h2("Wallpaper sources"),
      p("Defaults come from config/apps.json wallpaper field and the wallpaper module (MySpaceWallpapers). Spaces can override wallpaper per space when switching."),
      tip("reset layout clears positions without wiping app JSON (Today/Vault/…)."),
      h2("Related"),
      p("desktop, userdata-map, architecture, app-welcome."),
    ])
  );

  add(
    P("updates-system", "Updates system", "Major banners, apply, skip, relaunch", ["reference", "updates"], [
      kicker("Reference"),
      p("My Space does not silently download new binaries from this catalog. config/updates.json is a changelog of major milestones. When a new major entry appears that you have not applied or skipped, a high-priority notification offers Restart & Update."),
      h2("Catalog shape"),
      code([
        "{ \"updates\": [{ \"id\", \"version\", \"major\", \"title\", \"body\", \"date\" }] }",
      ]),
      h2("State file"),
      p("userData/updates-state.json tracks appliedIds, skippedIds, pendingApplyId, lastCheckedAt."),
      h2("Bridge"),
      code(["mySpace.updates.status()", "mySpace.updates.check()", "mySpace.updates.apply()", "mySpace.updates.skip()"]),
      h2("Apply flow"),
      ol([
        "User clicks Restart & Update.",
        "pendingApplyId is set; app relaunches.",
        "On next boot the id moves into appliedIds.",
      ]),
      note("Service polls ~60s and may watch the catalog file. This is a relaunch notifier aligned with local code you already have, not an auto-updater CDN."),
      tip("After apply, help <app> and Docs should match the new verbs."),
      h2("Related"),
      p("changelog, troubleshooting, architecture."),
    ])
  );

  add(
    P("apps-json", "config/apps.json", "Catalog entry fields for every pin", ["reference", "architecture", "config"], [
      kicker("Reference"),
      p("config/apps.json is the default desktop catalog. User overlays live in user-config.json and merge at runtime."),
      h2("Root fields"),
      table(
        ["Field", "Meaning"],
        [
          ["title", "Desktop title"],
          ["subtitle", "Tagline"],
          ["wallpaper", "Default wallpaper id"],
          ["apps[]", "Catalog entries"],
        ]
      ),
      h2("Per-app fields"),
      table(
        ["Field", "Used when"],
        [
          ["id", "Stable identity"],
          ["name", "Display name / fuzzy match"],
          ["type", "builtin | myapp | external | url"],
          ["module", "Folder under apps/ for myapps"],
          ["icon", "Emoji/glyph on desktop"],
          ["description", "Catalog blurb"],
          ["paths / path", "external executable candidates (%ENV% ok)"],
          ["url", "type:url opens in browser"],
          ["iconUrl / iconPath / iconData", "Optional custom icons"],
          ["inAppUrl", "Optional embedded dashboard URL"],
          ["hidden / entry", "Runtime / manifest extras"],
        ]
      ),
      tip("External path failures → fix apps.json or reinstall the tool. Quoted names help: run \"vs code\"."),
      h2("Platform & ops module ids"),
      p("Besides classic myapps, the catalog includes platform/ops tiles whose module (or id) fields matter for pins and IPC:"),
      code(["coupons", "pulse", "parts", "resolve", "scheduler", "permissions", "themes", "network", "backup", "storage", "updates", "os-bridge", "files", "jobs", "mail", "chat", "tasks"]),
      note("myapp-invoke ALLOWED_MODULES covers most of these; themes / network / backup / storage / updates / scheduler also (or instead) use dedicated main-process handlers. See ipc-map."),
      h2("Related"),
      p("apps-directory, app-external, desktop-config, ipc-map, architecture."),
    ])
  );

  (window.DOCS_GROUPS || []).forEach((g) => {
    (g.pages || []).forEach((pid) => {
      if (PAGES[pid]) PAGES[pid].group = g.id;
    });
  });
  window.DOCS_PAGE_LIST = Object.keys(PAGES).map((id) => PAGES[id]);
})();