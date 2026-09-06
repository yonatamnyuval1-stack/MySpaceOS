const fs = require("fs");
const path = require("path");
const { APP_SETTINGS_SCHEMA } = require("../apps/shared/settings-definitions.js");

const outPath = path.join(__dirname, "..", "apps", "docs", "catalog-deep.js");

function esc(s) {
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, " ");
}

function tableRows(rows) {
  return rows
    .map(
      (r) =>
        `          ["${esc(r[0])}", "${esc(r[1])}", "${esc(r[2])}", "${esc(r[3])}", "${esc(r[4])}"]`
    )
    .join(",\n");
}

const settingsBlocks = [];
settingsBlocks.push(`      kicker("Data"),`);
settingsBlocks.push(
  `      p("This page lists every key in apps/shared/settings-definitions.js: the authoritative schema for per-app Settings panels. Values persist in userData/app-settings.json keyed by app id. Channels: settings.load · settings.set · settings.setMany · settings.schema · settings.reset."),`
);
settingsBlocks.push(
  `      p("Apps without a schema have no settings.* panel. World Maps also keeps some per-user settings under userData/world-maps/ separate from this schema."),`
);
settingsBlocks.push(`      code(["settings", "settings.load via myApp.invoke", "settings.reset"]),`);
settingsBlocks.push(
  `      note("Defaults below are schema defaults. Live UI may coerce types (toggles → boolean, numeric selects → number)."),`
);

for (const [appId, app] of Object.entries(APP_SETTINGS_SCHEMA)) {
  settingsBlocks.push(`      h2("${esc(app.title)} (${esc(appId)})"),`);
  const rows = [];
  for (const sec of app.sections || []) {
    for (const item of sec.items || []) {
      const opts = item.options ? item.options.join(" / ") : "—";
      const extra = item.whenOff ? ` whenOff:${item.whenOff}` : "";
      rows.push([
        item.key,
        item.label,
        `${item.type}${extra}`,
        JSON.stringify(item.default),
        `${item.hint || ""} · options: ${opts} · section: ${sec.label}`,
      ]);
    }
  }
  settingsBlocks.push(`      table(`);
  settingsBlocks.push(`        ["Key", "Label", "Type", "Default", "Hint / options"],`);
  settingsBlocks.push(`        [`);
  settingsBlocks.push(
    rows
      .map(
        (r) =>
          `          ["${esc(r[0])}", "${esc(r[1])}", "${esc(r[2])}", "${esc(r[3])}", "${esc(r[4])}"]`
      )
      .join(",\n")
  );
  settingsBlocks.push(`        ]`);
  settingsBlocks.push(`      ),`);
}

settingsBlocks.push(
  `      tip("Turning mslProvider off is the supported rollback if a published capability misbehaves."),`
);
settingsBlocks.push(
  `      warn("Vault auto-lock and maskSecrets never replace unlocking in the Vault UI: the shell still cannot take a master password."),`
);
settingsBlocks.push(`      h2("Related"),`);
settingsBlocks.push(
  `      p("settings · settings-index · storage · userdata-map · msl-capabilities · architecture."),`
);

const mslCaps = [
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
  ["studies", "studies.export.docx", "action", "Export DOCX"],
];

const mslClients =
  "builds, icon-library, apps-info, space, translate, studies, day-planner, shell-console, contacts, geography, world-clock, stocks, history, world-maps, contracts, profiles, study-deck, flag-quiz, drift, code-lexicon, model-flow, msl-protocol";

const iconCallers =
  "builds, icon-library, apps-info, day-planner, contacts, msl-protocol, studies";

const injectTargets = "studies, world-maps, study-deck, model-flow, stocks, day-planner";

const allowedModules = [
  "system-info",
  "world-clock",
  "remote-hub",
  "studies",
  "study-deck",
  "day-planner",
  "profiles",
  "stocks",
  "translate",
  "contacts",
  "geography",
  "history",
  "space",
  "contracts",
  "builds",
  "code-lexicon",
  "drift",
  "shell-console",
  "scripts",
  "world-maps",
  "flag-quiz",
  "apps-info",
  "model-flow",
  "pi-digits",
  "icon-library",
  "msl-protocol",
  "docs",
];

const userdataFiles = [
  ["user-config.json", "Desktop", "Wallpaper, positions, spaces, pins, removed apps"],
  ["app-settings.json", "All schema apps", "Per-app settings values"],
  ["updates-state.json", "Updates", "Applied/skipped major update ids"],
  ["notifications.json", "Desktop", "Bell inbox"],
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
];

const myspaceNs = [
  ["embedApp", "Embed external windows"],
  ["shellEngine", "Load/save/execute shell engine"],
  ["aiChat", "Desktop AI chat + tools"],
  ["notifications", "Bell inbox"],
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
  ["docs", "Docs bookmarks/pages"],
];

const body = `/**
 * Docs deep reference: settings keys, MSL capabilities, architecture, IPC, userData.
 * Auto-generated settings tables from settings-definitions.js via scripts/generate-docs-deep.js
 * Load AFTER catalog-pages.js and catalog-apps.js
 */
(function () {
  const { P, h2, p, note, tip, warn, code, ul, ol, table, kicker } = window.DocsBlocks;
  const PAGES = window.DOCS_PAGES || (window.DOCS_PAGES = {});
  function add(page) {
    PAGES[page.id] = page;
  }

  add(
    P("settings-complete", "Every settings key", "Full schema from settings-definitions.js", ["data", "settings", "reference"], [
${settingsBlocks.join("\n")}
    ])
  );

  add(
    P("msl-capabilities", "MSL capabilities (complete)", "All 51 published capability ids", ["protocols", "msl", "reference"], [
      kicker("Protocols"),
      p("My Space Link publishes capabilities from provider modules under main/msl/providers/. The broker (main/msl/broker.js) aggregates them, enforces caller allowlists, and honors per-app mslProvider kill-switches from Settings."),
      p("Shell: msl(list) · msl(caps) · msl(keys) · msl(parse msl://…) · msl(open). Minting and injection are primarily done in the MSL Protocol app UI."),
      h2("All capability ids"),
      table(
        ["Provider", "Capability id", "Kind", "Purpose"],
        [
${mslCaps.map((r) => `          ["${r[0]}", "${r[1]}", "${r[2]}", "${esc(r[3])}"]`).join(",\n")}
        ]
      ),
      h2("Who may call"),
      p("MSL_CLIENTS (non-icon caps): ${mslClients}."),
      p("icons.* ALLOWED_CALLERS only: ${iconCallers}."),
      p("Extra gate: Builds calling icons.* also requires settings.mslIcons !== false."),
      h2("Inject targets"),
      p("Keys can be injected into: ${injectTargets}. Injected keys feed AI context gatherers in those apps."),
      h2("Broker channels"),
      code([
        "msl.list · msl.invoke",
        "msl.key.parse · msl.key.build · msl.key.resolve",
        "msl.keys.list · msl.keys.save · msl.keys.delete",
        "msl.inject.list · msl.inject.set · msl.inject.remove · msl.inject.clear · msl.inject.targets",
      ]),
      h2("URI shape"),
      code(["msl:v1/<capability>?param=value", "Built/parsed by apps/shared/msl-key.js"]),
      tip("If a capability is missing from msl(list), check the provider's mslProvider toggle and Restart & Update."),
      warn("Treat minted keys like capability URLs: do not embed secrets inside them."),
      h2("Related"),
      p("msl · msl-providers · app-msl · settings-complete · architecture."),
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
          ["main.js", "Electron main entry — windows, userData path, IPC registration"],
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
      p("Forced to %APPDATA%/my-space (app.setPath('userData', …)). Packaged builds store user-config.json there; see userdata-map for every JSON file."),
      tip("End-user Docs pages live under Apps / Protocols / Data. This page is for builders and deep operators."),
      h2("Related"),
      p("ipc-map · myspace-bridge · userdata-map · settings-complete · msl-capabilities · apps-windows."),
    ])
  );

  add(
    P("ipc-map", "IPC map", "myapp-invoke, ALLOWED_MODULES, settings & MSL channels", ["reference", "architecture", "ipc"], [
      kicker("Reference"),
      p("All myapp traffic goes through ipcMain handle myapp-invoke(moduleId, channel, args). The router in main/apps/ipc.js rejects unknown modules, then dispatches settings.*, msl.*, or the module's *-ipc.js handler."),
      h2("ALLOWED_MODULES (27)"),
      code([${allowedModules.map((m) => `"${m}"`).join(", ")}]),
      note("A module must also exist as apps/<moduleId>/ on disk. msl-protocol relies on the shared msl.* early path rather than a dedicated if-branch."),
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
        "contextBridge.exposeInMainWorld(\\"myApp\\", {",
        "  moduleId: MODULE_ID,",
        "  invoke: (channel, args) =>",
        "    ipcRenderer.invoke(\\"myapp-invoke\\", MODULE_ID, channel, args || {}),",
        "});",
      ]),
      h2("Notable variants"),
      ul([
        "builds/preload.js — myApp.onTreeUpdate for live tree events",
        "stocks/preload.js & studies/preload.js — Gemini / AI helpers",
        "world-maps/preload.js — worldMaps API plus myApp",
      ]),
      h2("System Info channel examples"),
      code([
        "ports.scan · processes.scan · memory.scan · storage.scan · cpu.scan",
        "system.scan · network.scan · environment.scan",
        "disk.roots · disk.scan · disk.largeFiles · disk.cancel",
        "metrics.sample · metrics.history · metrics.clear",
      ]),
      tip("Unknown channel → handler returns ok:false. After upgrades, Restart & Update so preload bridges match main."),
      h2("Related"),
      p("architecture · myspace-bridge · settings-complete · msl-capabilities."),
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
        "isDesktop · desktopSearch · openNewWindow · shellUx",
        "onDriftScanUpdate · onShellHotkey · onShortcutsHotkey · onFocusChanged",
      ]),
      h2("Namespaces"),
      table(
        ["Namespace", "Role"],
        [
${myspaceNs.map((r) => `          ["${r[0]}", "${esc(r[1])}"]`).join(",\n")}
        ]
      ),
      h2("Pattern"),
      code([
        "mySpace.today.list()",
        "mySpace.stocks.quote({ symbol: \\"AAPL\\" })",
        "mySpace.docs.setPage({ page: \\"overview\\" })",
        "// Internally → myapp-invoke(<module>, <channel>, args)",
      ]),
      note("If a namespace is missing after an update, the shell reports API unavailable."),
      h2("Related"),
      p("architecture · ipc-map · cmd-protocol · shell-language."),
    ])
  );

  add(
    P("userdata-map", "userData file map", "Every persistent JSON under %APPDATA%/my-space", ["data", "reference", "storage"], [
      kicker("Data"),
      p("My Space forces Electron userData to %APPDATA%/my-space. Almost all personal state lives here as JSON. Quit the app before copying the folder for backups."),
      h2("Complete file map"),
      table(
        ["File / folder", "Owner", "Contents"],
        [
${userdataFiles.map((r) => `          ["${esc(r[0])}", "${esc(r[1])}", "${esc(r[2])}"]`).join(",\n")}
        ]
      ),
      h2("Bundled (not userData)"),
      ul([
        "config/apps.json: default catalog & wallpaper id",
        "config/updates.json: major update messages",
        "data/code-lexicon.json: bundled lexicon corpus",
      ]),
      tip("Dev mode may use config/user-config.json instead of userData for the desktop overlay: packaged builds use userData/user-config.json."),
      warn("Restoring a backup while My Space is running can corrupt mid-write JSON."),
      h2("Related"),
      p("storage · backups · settings-complete · architecture."),
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
          ["language / locale / timeFormat", "Desktop localization prefs when present"],
          ["widgets / hotCorners / paletteRecents", "Optional desktop chrome state"],
        ]
      ),
      h2("Shell helpers"),
      code(["desktop", "settings", "refresh", "sort", "reset layout", "pin <app>", "unpin <app>", "reveal <app>"]),
      h2("Wallpaper sources"),
      p("Defaults come from config/apps.json wallpaper field and the wallpaper module (MySpaceWallpapers). Spaces can override wallpaper per space when switching."),
      tip("reset layout clears positions without wiping app JSON (Today/Vault/…)."),
      h2("Related"),
      p("desktop · userdata-map · architecture · app-welcome."),
    ])
  );

  add(
    P("updates-system", "Updates system", "Major banners, apply, skip, relaunch", ["reference", "updates"], [
      kicker("Reference"),
      p("My Space does not silently download new binaries from this catalog. config/updates.json is a changelog of major milestones. When a new major entry appears that you have not applied or skipped, a high-priority notification offers Restart & Update."),
      h2("Catalog shape"),
      code([
        "{ \\"updates\\": [{ \\"id\\", \\"version\\", \\"major\\", \\"title\\", \\"body\\", \\"date\\" }] }",
      ]),
      h2("State file"),
      p("userData/updates-state.json tracks appliedIds, skippedIds, pendingApplyId, lastCheckedAt."),
      h2("Bridge"),
      code(["mySpace.updates.status()", "mySpace.updates.check()", "mySpace.updates.apply()", "mySpace.updates.skip()"]),
      h2("Apply flow"),
      ol([
        "User clicks Restart & Update (apply).",
        "pendingApplyId is set; app relaunches.",
        "On next boot the id moves into appliedIds.",
      ]),
      note("Service polls ~60s and may watch the catalog file. This is a relaunch notifier aligned with local code you already have, not an auto-updater CDN."),
      tip("After apply, help <app> and Docs should match the new verbs."),
      h2("Related"),
      p("changelog · troubleshooting · architecture."),
    ])
  );

  add(
    P("apps-json", "config/apps.json", "Catalog entry fields for every pin", ["reference", "architecture", "config"], [
      kicker("Reference"),
      p("config/apps.json is the default desktop catalog. User overlays (removed apps, positions, wallpaper) live in user-config.json and merge at runtime."),
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
      tip("External path failures → fix apps.json or reinstall the tool. Quoted names help: run \\"vs code\\"."),
      h2("Related"),
      p("apps-directory · app-external · desktop-config · architecture."),
    ])
  );

  // Attach groups
  (window.DOCS_GROUPS || []).forEach((g) => {
    (g.pages || []).forEach((pid) => {
      if (PAGES[pid]) PAGES[pid].group = g.id;
    });
  });
  window.DOCS_PAGE_LIST = Object.keys(PAGES).map((id) => PAGES[id]);
})();
`;

fs.writeFileSync(outPath, body);
console.log("Wrote", outPath, "bytes", body.length);