(function () {
  const RUN_RE = /^run\s+([a-z0-9_-]+)(?:\(([^)]*)\))?$/i;
  const CLOSE_RE = /^close(?:\s+(all|[a-z0-9_-]+))?$/i;
  const ALIAS_SET_RE = /^alias\s+([a-z0-9_-]+)\s*=\s*(.+)$/i;
  const ALIAS_REMOVE_RE = /^alias\s+(?:remove|rm)\s+([a-z0-9_-]+)$/i;
  const MACRO_SET_RE = /^macro\s+([a-z0-9_-]+)\s*=\s*(.+)$/i;
  const MACRO_RUN_RE = /^macro\s+([a-z0-9_-]+)$/i;
  const MACRO_REMOVE_RE = /^macro\s+(?:remove|rm)\s+([a-z0-9_-]+)$/i;
  const WHEN_SET_RE = /^when\s+([a-z0-9_-]+)\(([^)]+)\)\s+(.+)$/i;
  const WHEN_REMOVE_RE = /^when\s+(?:remove|rm)\s+([a-z0-9_-]+)$/i;
  const CHECK_RE = /^check(?:\s+(.+))?$/i;
  const FOCUS_RE = /^focus\s+([a-z0-9_-]+)$/i;
  const OPEN_RE = /^open\s+(.+)$/i;
  const PIN_RE = /^pin\s+([a-z0-9_-]+)$/i;
  const UNPIN_RE = /^unpin\s+([a-z0-9_-]+)$/i;
  const REVEAL_RE = /^reveal\s+([a-z0-9_-]+)$/i;
  const HELP_APP_RE = /^help\s+([a-z0-9_-]+)$/i;
  const IF_THEN = " then ";
  const IF_ELSE = " else ";
  const MAX_LOOP_COUNT = 25;
  const MAX_WHILE_ITERATIONS = 25;

  const ROUTE_REGISTRY = {
    "system-info": {
      app: "SysInfoApp",
      method: "setActivePage",
      pages: ["system", "cpu", "memory", "storage", "disk", "performance", "processes", "network", "ports", "environment"],
      aliases: ["sysinfo", "sys"],
      commands: true,
      examples: [
        "sysinfo(scan)",
        "sys(cpu)",
        "sys(memory)",
        "sysinfo(processes)",
        "sysinfo(network)",
        "sysinfo(open cpu)",
        "sys(help)",
      ],
    },
    docs: {
      app: "DocsApp",
      method: "setPage",
      pages: [
        "overview",
        "mental-model",
        "how-to-read-docs",
        "quick-start",
        "desktop",
        "navigation",
        "shell-language",
        "shell-chaining",
        "shell-flow",
        "shell-vars",
        "shell-functions",
        "shell-shortcuts",
        "shell-check",
        "shell-discovery",
        "shell-errors",
        "cmd-protocol",
        "apps-directory",
        "apps-windows",
        "app-welcome",
        "app-info",
        "app-docs",
        "app-sysinfo",
        "app-clock",
        "app-today",
        "app-tasks",
        "app-vault",
        "app-contacts",
        "app-notes",
        "app-chat",
        "app-stocks",
        "app-builds",
        "app-drift",
        "app-remote",
        "app-studies",
        "app-decks",
        "app-translate",
        "app-geo",
        "app-maps",
        "app-flags",
        "app-pi",
        "app-history",
        "app-space",
        "app-lexicon",
        "app-contracts",
        "app-msl",
        "app-jobs",
        "app-mind",
        "app-icons",
        "app-flow",
        "app-console",
        "app-scripts",
        "app-external",
        "msl",
        "msl-providers",
        "msl-capabilities",
        "routes",
        "silent-actions",
        "sync-if-open",
        "aliases-macros",
        "when-rules",
        "scripts-app",
        "model-flow",
        "automation-patterns",
        "storage",
        "userdata-map",
        "vault-security",
        "settings",
        "settings-index",
        "settings-complete",
        "backups",
        "recipe-morning",
        "recipe-focus",
        "recipe-dev",
        "recipe-travel",
        "recipe-eod",
        "recipe-weekly",
        "recipe-remote",
        "command-index",
        "architecture",
        "ipc-map",
        "myspace-bridge",
        "apps-json",
        "desktop-config",
        "updates-system",
        "glossary",
        "faq",
        "troubleshooting",
        "changelog",
      ],
      aliases: ["documentation", "handbook", "helpdocs"],
      bare: "page",
      commands: true,
      examples: [
        "docs(overview)",
        "docs(search timer)",
        "docs(open app-clock)",
        "docs(open settings-complete)",
        "docs(open msl-capabilities)",
        "docs(open architecture)",
        "docs(list)",
        "docs(bookmarks)",
        "docs(help)",
      ],
    },
    "world-clock": {
      app: "ClockApp",
      method: "setActivePage",
      pages: ["local", "world", "meetings", "timer", "pomodoro", "stopwatch"],
      aliases: ["clock"],
      deep: {
        timer: "startTimer",
        pomodoro: "startPomodoro",
        stopwatch: "startStopwatch",
      },
      commands: true,
      examples: [
        "clock(timer 25m)",
        "clock(pomodoro start)",
        "clock(stopwatch)",
        "clock(timer pause)",
        "run clock(world)",
      ],
    },
    "remote-hub": {
      app: "RemoteHubApp",
      method: "setActivePage",
      pages: ["machines", "quick", "network", "enable"],
      aliases: ["remote"],
      deep: { machines: "openMachine", machine: "openMachine" },
      commands: true,
      examples: [
        "remote(list)",
        "remote(search office)",
        "remote(check)",
        "remote(open Office)",
        "remote(connect Office ssh)",
        "remote(wake Office)",
        "remote(scan)",
        "remote(network)",
      ],
    },
    "os-bridge": {
      app: "OsBridgeApp",
      method: "setActivePage",
      pages: ["devices", "places", "actions", "host"],
      aliases: ["osbridge", "bridge"],
      commands: true,
      examples: [
        "bridge(open)",
        "bridge(devices)",
        "bridge(places)",
        "bridge(share)",
        "bridge(host)",
        "bridge(pair)",
        "bridge(help)",
      ],
    },
    files: {
      app: "FilesApp",
      method: "setActivePage",
      pages: ["browse", "recent", "favorites", "downloads", "documents"],
      aliases: ["file", "explorer"],
      commands: true,
      examples: [
        "files(panel)",
        "files(open)",
        "files(full)",
        "files(downloads)",
        "files(write tools/hello.txt body:Hello)",
        "files(mkdir tools)",
        "files(help)",
      ],
    },
    studies: {
      app: "StudiesApp",
      method: "setActivePage",
      pages: ["home", "templates", "editor"],
      deep: { editor: "openDocument", document: "openDocument", workspace: "openWorkspace" },
      commands: true,
      examples: [
        "studies(list)",
        "studies(search thesis)",
        "studies(open My Notes)",
        "studies(templates)",
        "studies(home)",
        "studies(new)",
      ],
    },
    "study-deck": {
      app: "StudyDeckApp",
      method: "setPage",
      pages: ["home", "deck", "study"],
      aliases: ["studydeck", "flashcards", "decks", "studiesdeck", "study-deck"],
      deep: { study: "setPage", deck: "openDeck" },
      commands: true,
      examples: [
        "decks(list)",
        "studydeck(open Biology)",
        "studydeck(study Biology)",
        "decks(add Biology | Mitochondria | Powerhouse)",
        "decks(new Chemistry)",
        "flashcards(list)",
      ],
    },
    "day-planner": {
      app: "DayPlannerApp",
      method: "setPage",
      pages: ["home", "today", "tomorrow", "later", "done", "all"],
      aliases: ["today", "planner", "dayplanner"],
      commands: true,
      examples: [
        "today(add Buy milk)",
        "today(add Call Dana 15:00)",
        "today(add Ship report tomorrow)",
        "today(done Buy milk)",
        "today(list)",
        "today(list tomorrow)",
        "today(clear done)",
      ],
    },
    tasks: {
      app: "TasksApp",
      method: "setPage",
      pages: ["inbox", "today", "upcoming", "next", "waiting", "someday", "flagged", "all", "done"],
      aliases: ["gtd", "todo", "lists", "projects"],
      deep: { inbox: "openTask", task: "openTask", open: "openTask" },
      commands: true,
      examples: [
        "tasks(add Buy milk @next)",
        "gtd(list inbox)",
        "todo(done Buy milk)",
        "tasks(project Website)",
        "tasks(schedule Buy milk)",
        "tasks(help)",
      ],
    },
    profiles: {
      app: "ProfilesApp",
      method: "setActivePage",
      pages: ["vault"],
      aliases: ["vault"],
      deep: { vault: "openEntry", entry: "openEntry" },
      commands: true,
      examples: [
        "vault(list)",
        "vault(search gmail)",
        "vault(open Gmail)",
        "vault(add Work Email)",
        "vault(copy Gmail)",
        "vault(status)",
        "vault(lock)",
      ],
    },
    stocks: {
      app: "StocksApp",
      method: "setPage",
      pages: ["dashboard", "portfolio", "alerts", "buylist", "stock", "ai-analysis"],
      ticker: true,
      modes: ["stocks", "metals", "forex", "crypto", "intl", "etf-index", "etf-sector", "etf-bonds", "energy", "commodities", "indices", "reit", "rates", "emerging"],
      bare: "ticker",
      commands: true,
      examples: [
        "stocks(AAPL)",
        "stocks(watch TSLA)",
        "stocks(quote NVDA)",
        "stocks(alert AAPL > 200)",
        "stocks(mode crypto)",
        "stocks(list)",
        "stocks(portfolio)",
      ],
    },
    translate: {
      app: "TranslateApp",
      method: "setPage",
      pages: ["translate", "history", "phrases", "batch", "settings"],
      deep: { translate: "openTranslate" },
      bare: "text",
      commands: true,
      examples: [
        "translate(hello)",
        "translate(bonjour -> en)",
        "translate(שלום)",
        "translate(text:shalom, from:he, to:en)",
        "translate(detect bonjour)",
        "translate(languages)",
        "translate(history)",
        "translate(open phrases)",
      ],
    },
    contacts: {
      app: "ContactsApp",
      method: "setPage",
      pages: ["browse", "reminders", "groups"],
      deep: { browse: "openContact", contact: "openContact" },
      commands: true,
      examples: [
        "contacts(list)",
        "contacts(search Dana)",
        "contacts(add Dana | dana@mail.com)",
        "contacts(upcoming)",
        "contacts(email Dana)",
        "contacts(open Dana)",
        "contacts(groups)",
      ],
    },
    notes: {
      app: "NotesApp",
      method: "setPage",
      pages: ["all", "pinned", "archive"],
      aliases: ["note"],
      deep: { all: "openNote", note: "openNote", browse: "openNote" },
      commands: true,
      examples: [
        "notes(list)",
        "notes(search meeting)",
        "notes(add Buy milk #errands)",
        "notes(pin Buy milk)",
        "notes(archive Buy milk)",
        "notes(open Buy milk)",
        "notes(help)",
      ],
    },
    chat: {
      app: "ChatApp",
      method: "openChat",
      pages: ["home", "settings", "memory"],
      aliases: ["aichat", "mindchat"],
      deep: { home: "newChat", settings: "openSettings", memory: "setPage" },
      commands: true,
      examples: [
        "chat(new)",
        "chat(list)",
        "chat(settings)",
        "chat(open)",
        "chat(help)",
      ],
    },
    mail: {
      app: "MySpaceConnectHub",
      method: "show",
      pages: ["hub", "catalog", "home"],
      aliases: ["connect"],
      commands: false,
    },
    geography: {
      app: "GeoApp",
      method: "setPage",
      pages: ["explore", "learn", "traveled"],
      aliases: ["geo"],
      deep: { learn: "openLearn", explore: "openCountry", country: "openCountry" },
      bare: "country",
      commands: true,
      examples: [
        "geo(list)",
        "geo(search Israel)",
        "geo(get IL)",
        "geo(open Togo)",
        "geo(learn Japan)",
        "geo(traveled)",
        "geography(IL)",
      ],
    },
    "flag-quiz": {
      app: "FlagQuizApp",
      method: "setPage",
      pages: ["home", "quiz", "scores"],
      aliases: ["flags", "flagquiz", "flag-learn"],
      deep: { quiz: "startQuiz" },
      commands: true,
      examples: [
        "flags(scores)",
        "flags(quiz)",
        "flags(start)",
        "flags(home)",
        "flag-quiz(meta)",
      ],
    },
    history: {
      app: "HistoryApp",
      method: "setPage",
      pages: ["figures", "events", "collection"],
      deep: { figures: "openEntity", events: "openEntity", collection: "openEntity" },
      commands: true,
      examples: [
        "history(list figures)",
        "history(list events)",
        "history(search Napoleon)",
        "history(get Q762)",
        "history(open Napoleon)",
        "history(bookmarks)",
        "history(status)",
      ],
    },
    space: {
      app: "SpaceApp",
      method: "setPage",
      pages: ["navigate", "catalog", "nasa", "reports", "aliens"],
      views: ["cosmos", "ocean", "earth"],
      deep: { catalog: "openBody", nasa: "openMission", reports: "openReport" },
      commands: true,
      examples: [
        "space(apod)",
        "space(search Mars)",
        "space(get earth)",
        "space(missions)",
        "space(reports)",
        "space(ocean)",
        "space(open Mars)",
        "space(catalog)",
      ],
    },
    contracts: {
      app: "ContractsApp",
      method: "setPage",
      pages: ["library", "editor", "document", "expiring"],
      deep: { editor: "openEditor", document: "openDocument" },
      commands: true,
      examples: [
        "contracts(list)",
        "contracts(templates)",
        "contracts(upcoming)",
        "contracts(open Lease)",
        "contracts(editor)",
        "contracts(expiring)",
      ],
    },
    "msl-protocol": {
      app: "MslApp",
      platform: true,
      method: "applyRoute",
      pages: ["caps", "keys", "mint", "inject", "about"],
      aliases: ["msl", "link-protocol"],
      commands: true,
      examples: [
        "msl(open)",
        "msl(list)",
        "msl(caps)",
        "msl(keys)",
        "msl(mint)",
        "msl(inject)",
        "msl(help)",
      ],
    },
    parts: {
      app: "PartsApp",
      platform: true,
      method: "applyRoute",
      pages: ["explore", "catalog", "about", "repo", "publish"],
      aliases: ["part", "forge"],
      commands: true,
      examples: [
        "parts(panel)",
        "parts(list)",
        "parts(get search.fuzzy)",
        "parts(adopt search.fuzzy into notes)",
        "parts(publish)",
        "parts(help)",
      ],
    },
    permissions: {
      app: "PermissionsApp",
      platform: true,
      method: "applyRoute",
      pages: ["overview", "tools", "notifications", "jobs", "bridge", "external", "about"],
      aliases: ["permission", "perms", "acl", "access"],
      commands: true,
      examples: [
        "permissions(open)",
        "permissions(tools)",
        "permissions(jobs)",
        "permissions(bridge)",
        "permissions(help)",
        "perms(overview)",
      ],
    },
    pulse: {
      app: "PulseApp",
      method: "applyRoute",
      pages: ["directory", "activity", "log", "external"],
      platform: true,
      aliases: ["link", "link-bus", "bus"],
      commands: true,
      examples: [
        "pulse(open)",
        "pulse(directory)",
        "pulse(external)",
        "pulse(send notes create title=Hi)",
        "pulse(send resolve report appId:notes code:LOAD_FAILED)",
        "pulse(send composio status)",
        "pulse(pub pulse.ping message=hi)",
        "pulse(log)",
        "pulse(help)",
      ],
    },
    resolve: {
      app: "ResolveApp",
      platform: true,
      method: "applyRoute",
      pages: ["inbox", "playbooks", "about"],
      aliases: ["fix", "triage", "troubleshoot"],
      commands: true,
      examples: [
        "resolve(open)",
        "resolve(status)",
        "resolve(list)",
        "resolve(ask notes LOAD_FAILED)",
        "pulse(send resolve report appId:scripts code:LOAD_FAILED)",
        "resolve(help)",
      ],
    },
    updates: {
      app: "UpdatesApp",
      platform: true,
      method: "applyRoute",
      pages: ["pending", "history", "about"],
      aliases: ["update", "changelog", "release"],
      commands: true,
      examples: [
        "updates(open)",
        "updates(pending)",
        "updates(history)",
        "updates(status)",
        "updates(check)",
        "updates(help)",
      ],
    },
    network: {
      app: "NetworkApp",
      platform: true,
      method: "applyRoute",
      pages: ["status", "adapters", "ports", "about"],
      aliases: ["net", "lan", "wifi", "connectivity"],
      commands: true,
      examples: [
        "network(open)",
        "network(status)",
        "network(check)",
        "network(adapters)",
        "network(ports)",
        "network(help)",
      ],
    },
    info: {
      app: "InfoApp",
      platform: true,
      method: "applyRoute",
      pages: ["catalog", "services", "apps", "external", "about"],
      aliases: ["apps-info", "catalog", "encyclopedia"],
      commands: true,
      examples: [
        "info(open)",
        "info(services)",
        "info(apps)",
        "info(about)",
        "info(help)",
      ],
    },
    backup: {
      app: "BackupApp",
      platform: true,
      method: "applyRoute",
      pages: ["status", "history", "about"],
      aliases: ["backups"],
      commands: true,
      examples: [
        "backup(open)",
        "backup(status)",
        "backup(export)",
        "backup(import)",
        "backup(history)",
        "backup(help)",
      ],
    },
    storage: {
      app: "StorageApp",
      platform: true,
      method: "applyRoute",
      pages: ["status", "apps", "large-files", "cleanup", "about"],
      aliases: ["disks", "disk-usage", "userdata"],
      commands: true,
      examples: [
        "storage(open)",
        "storage(status)",
        "storage(apps)",
        "storage(large C:)",
        "storage(cleanup)",
        "storage(path)",
        "storage(help)",
      ],
    },
    themes: {
      app: "ThemesApp",
      platform: true,
      method: "applyRoute",
      pages: ["apps", "about"],
      aliases: ["theme", "appearance", "colors"],
      commands: true,
      examples: [
        "themes(open)",
        "themes(notes light)",
        "themes(files dark)",
        "themes(today light)",
        "themes(list)",
        "themes(help)",
      ],
    },
    jobs: {
      app: "JobsApp",
      platform: true,
      method: "applyRoute",
      pages: ["queue", "active", "done", "enqueue", "capacity", "about"],
      aliases: ["job", "compute"],
      commands: true,
      examples: [
        "jobs(open)",
        "jobs(list)",
        "jobs(run msl(list))",
        "jobs(capacity)",
        "jobs(help)",
      ],
    },
    scheduler: {
      app: "SchedulerApp",
      platform: true,
      method: "applyRoute",
      pages: ["active", "all", "history", "new", "about"],
      aliases: ["schedule", "cron", "timer"],
      commands: true,
      examples: [
        "schedule(open)",
        "schedule(list)",
        "schedule(add every 1h backup(status))",
        "schedule(add daily 02:00 scripts(run nightly))",
        "schedule(help)",
      ],
    },
    host: {
      app: null,
      platform: true,
      method: null,
      pages: [],
      aliases: [],
      commands: true,
      examples: [
        "host(run node file:tools/gen.js)",
        "host(run python file:tools/x.py args:--verbose)",
        "host(runtimes)",
        "host(help)",
      ],
    },
    app: {
      app: null,
      platform: true,
      method: null,
      pages: [],
      aliases: ["myapp"],
      commands: true,
      examples: [
        "app(scaffold todo name:My Todo)",
        "app(register todo)",
        "app(list)",
        "app(help)",
      ],
    },
    mind: {
      app: null,
      platform: true,
      method: null,
      pages: ["ask", "setup"],
      aliases: ["ai", "gemini", "llm"],
      commands: true,
      examples: [
        "mind(panel)",
        "mind(ask What is Focus mode?)",
        "mind(quick tag this)",
        "mind(think Plan a weekly review)",
        "mind(help)",
      ],
    },
    builds: {
      app: "BuildsApp",
      method: "setActivePage",
      pages: ["browse", "timeline"],
      deep: { browse: "openProject", project: "openProject" },
      commands: true,
      examples: [
        "builds(list)",
        "builds(list web)",
        "builds(open Operating System)",
        "builds(new My App)",
        "builds(timeline)",
        "builds(folder My App)",
        "builds(rescan My App)",
      ],
    },
    "code-lexicon": {
      app: "LexiconApp",
      method: "setActivePage",
      pages: ["browse", "categories"],
      aliases: ["lexicon", "codelexicon"],
      deep: { browse: "openTerm", term: "openTerm" },
      bare: "term",
      commands: true,
      examples: [
        "lexicon(search promise)",
        "lexicon(get closure)",
        "lexicon(daily)",
        "lexicon(stats)",
        "lexicon(open promise)",
        "lexicon(categories)",
      ],
    },
    drift: {
      app: "DriftApp",
      method: "setActivePage",
      pages: ["activity", "zones", "insights"],
      deep: { activity: "openEvent", event: "openEvent" },
      commands: true,
      examples: [
        "drift(scan)",
        "drift(list)",
        "drift(list today)",
        "drift(search config)",
        "drift(zones)",
        "drift(insights)",
        "drift(pause)",
        "drift(open <eventId>)",
      ],
    },
    "model-flow": {
      app: "ModelFlowApp",
      method: "setPage",
      pages: ["studio", "history", "library", "tools", "connection"],
      aliases: ["modelflow", "flow", "zapier"],
      commands: true,
      examples: [
        "flow(meta)",
        "flow(tools)",
        "flow(history)",
        "flow(plan Send weekly digest email)",
        "flow(open)",
        "flow(help)",
      ],
    },
    "shell-console": {
      app: null,
      platform: true,
      method: null,
      pages: ["overview", "language", "core", "modules"],
      aliases: ["console", "shell", "atlas"],
      commands: true,
      examples: [
        "shell(open)",
        "shell(language)",
        "shell(core)",
        "shell(modules)",
        "console(open)",
        "shell(help)",
      ],
    },
    scripts: {
      app: "ScriptsApp",
      method: "openScript",
      pages: [],
      bare: "script",
      aliases: ["script", "long-commands"],
      commands: true,
      examples: [
        "scripts(list)",
        "scripts(run morning)",
        "scripts(set nightly backup(status))",
        "scripts(append nightly schedule(list))",
        "scripts(open morning)",
        "scripts(new focus)",
        "scripts(help)",
      ],
    },
    "world-maps": {
      app: "WorldMapsApp",
      method: "setActivePage",
      pages: ["map"],
      aliases: ["worldmaps", "maps"],
      commands: true,
      examples: [
        "maps(geocode Tel Aviv)",
        "maps(notes)",
        "maps(routes)",
        "maps(open)",
        "maps(help)",
      ],
    },
  };

  const aliasToModule = {};
  Object.entries(ROUTE_REGISTRY).forEach(([moduleId, def]) => {
    aliasToModule[moduleId] = moduleId;
    (def.aliases || []).forEach((alias) => {
      aliasToModule[alias] = moduleId;
    });
  });

  function escapeJsString(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  }

  function parseAppRefToken(text, apps) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return null;

    const withRoute = trimmed.match(/^(.+?)(\([^)]*\))$/);
    if (withRoute) {
      const ref = withRoute[1].trim();
      if (findAppByRef(ref, apps)) {
        return { ref, full: trimmed };
      }
      return null;
    }

    const matched = matchAppRefAtStart(trimmed, apps);
    if (matched && !matched.rest) {
      return { ref: matched.ref, full: trimmed };
    }
    return null;
  }

  function isShorthandBlocked(line) {
    const lower = String(line || "").trim().toLowerCase();
    if (!lower) return true;
    const exact = new Set([
      "help",
      "?",
      "desktop",
      "settings",
      "refresh",
      "sort",
      "add",
      "notify",
      "timer",
      "pomodoro",
      "stopwatch",
      "wait",
    ]);
    if (exact.has(lower)) return true;
    const prefixes = [
      "check",
      "focus ",
      "pin ",
      "unpin ",
      "reveal ",
      "alias",
      "macro",
      "when ",
      "if ",
      "loop ",
      "repeat ",
      "while ",
      "for ",
      "close",
      "run ",
      "open ",
      "timer ",
      "pomodoro ",
      "stopwatch ",
      "wait ",
    ];
    return prefixes.some((p) => lower === p || lower.startsWith(p));
  }

  function resolveShorthand(line, apps) {
    const trimmed = String(line || "").trim();
    if (!trimmed || isShorthandBlocked(trimmed)) return null;

    if (trimmed.toLowerCase() === "a") return "close all";

    const asRun = parseAppRefToken(trimmed, apps);
    if (asRun) return `run ${asRun.full}`;

    if (trimmed.length > 1 && trimmed[0].toLowerCase() === "b") {
      const rest = trimmed.slice(1).trim();
      const asClose = parseAppRefToken(rest, apps);
      if (asClose) return `close ${asClose.ref}`;
    }

    return null;
  }

  function resolveModule(ref) {
    const raw = String(ref || "").trim().toLowerCase();
    if (!raw) return null;
    if (aliasToModule[raw]) return aliasToModule[raw];
    const compact = raw.replace(/[\s_-]+/g, "");
    return aliasToModule[compact] || null;
  }

  function normalizeRefKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "");
  }

  function findAppByRef(ref, apps) {
    const key = normalizeRefKey(ref);
    if (!key) return null;

    const moduleId = resolveModule(ref);
    if (moduleId) {
      const byModule =
        apps.find((a) => a.id === moduleId) ||
        apps.find((a) => a.module === moduleId) ||
        null;
      if (byModule) return byModule;
      return null;
    }

    const exact =
      apps.find((a) => normalizeRefKey(a.id) === key) ||
      apps.find((a) => normalizeRefKey(a.name) === key) ||
      apps.find((a) => a.module && normalizeRefKey(a.module) === key) ||
      null;
    if (exact) return exact;

    const scored = [];
    for (const a of apps || []) {
      const candidates = [a.id, a.name, a.module].filter(Boolean).map(normalizeRefKey);
      let best = Infinity;
      for (const c of candidates) {
        if (!c) continue;
        if (c === key) return a;
        if (c.startsWith(key) || key.startsWith(c)) best = Math.min(best, 1);
        else if (c.includes(key) || key.includes(c)) best = Math.min(best, 2);
      }
      if (best < Infinity) scored.push({ app: a, best });
    }
    scored.sort((x, y) => x.best - y.best);
    if (scored.length === 1) return scored[0].app;
    if (scored.length > 1 && scored[0].best < scored[1].best) return scored[0].app;
    return null;
  }

  function matchAppRefAtStart(text, apps) {
    const trimmed = String(text || "").trim();
    if (!trimmed || !apps?.length) return null;

    let head = trimmed;
    let parenRest = "";
    const parenIdx = trimmed.indexOf("(");
    if (parenIdx > 0) {
      head = trimmed.slice(0, parenIdx).trim();
      parenRest = trimmed.slice(parenIdx);
    }

    const quoted = head.match(/^["']([^"']+)["']/);
    if (quoted) {
      const app = findAppByRef(quoted[1], apps);
      if (!app) return null;
      const afterQuote = head.slice(quoted[0].length).trim();
      return {
        app,
        ref: quoted[1],
        rest: [afterQuote, parenRest].filter(Boolean).join(""),
      };
    }

    const words = head.split(/\s+/).filter(Boolean);
    for (let count = words.length; count >= 1; count -= 1) {
      const phrase = words.slice(0, count).join(" ");
      const app = findAppByRef(phrase, apps);
      if (app) {
        const after = words.slice(count).join(" ").trim();
        return {
          app,
          ref: phrase,
          rest: [after, parenRest].filter(Boolean).join(""),
        };
      }
    }

    return null;
  }

  function parseSingleAppCommand(trimmed, verb, apps) {
    const prefix = `${verb} `;
    if (!String(trimmed || "").toLowerCase().startsWith(prefix)) return null;
    const matched = matchAppRefAtStart(trimmed.slice(prefix.length), apps);
    if (!matched || matched.rest) return null;
    return matched;
  }

  function resolveModuleFromRef(ref, apps) {
    return resolveModule(ref) || findAppByRef(ref, apps)?.module || null;
  }

  function splitCommandChain(line) {
    /** @type {Array<{ text: string, keepGoing: boolean }>} */
    const parts = [];
    let current = "";
    let depth = 0;
    let brace = 0;
    let quote = null;
    for (let i = 0; i < String(line || "").length; i += 1) {
      const ch = line[i];
      if ((ch === '"' || ch === "'") && !quote) {
        quote = ch;
        current += ch;
        continue;
      }
      if (quote) {
        current += ch;
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === "(") depth += 1;
      if (ch === ")") depth = Math.max(0, depth - 1);
      if (ch === "{") brace += 1;
      if (ch === "}") brace = Math.max(0, brace - 1);
      if ((ch === ";" || ch === "|") && depth === 0 && brace === 0) {
        if (current.trim()) {
          parts.push({ text: current.trim(), keepGoing: ch === "|" });
        }
        current = "";
        continue;
      }
      current += ch;
    }
    if (current.trim()) parts.push({ text: current.trim(), keepGoing: false });
    return parts;
  }

  function unquoteArg(value) {
    const t = String(value || "").trim();
    if (
      (t.startsWith('"') && t.endsWith('"') && t.length >= 2) ||
      (t.startsWith("'") && t.endsWith("'") && t.length >= 2)
    ) {
      return t.slice(1, -1);
    }
    return t;
  }

  function splitArgList(raw) {
    const parts = [];
    let current = "";
    let quote = null;
    for (let i = 0; i < String(raw || "").length; i += 1) {
      const ch = raw[i];
      if ((ch === '"' || ch === "'") && !quote) {
        quote = ch;
        current += ch;
        continue;
      }
      if (quote) {
        current += ch;
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === ",") {
        if (current.trim()) parts.push(current.trim());
        current = "";
        continue;
      }
      current += ch;
    }
    if (current.trim()) parts.push(current.trim());
    return parts;
  }

  function parseArgStructure(raw) {
    const parts = splitArgList(raw);
    const map = {};
    const positional = [];
    for (const part of parts) {
      const kv = part.match(/^([a-z_][a-z0-9_-]*)\s*:\s*(.+)$/i);
      if (kv) {
        map[kv[1].toLowerCase()] = unquoteArg(kv[2]);
      } else {
        positional.push(unquoteArg(part));
      }
    }
    return {
      map,
      positional,
      keys: Object.keys(map),
      single: parts.length === 1 ? unquoteArg(parts[0]) : null,
    };
  }

  function routeFromKv(moduleId, def, map) {
    const pageHint = String(map.page || "").toLowerCase();

    if (moduleId === "world-clock") {
      const label = map.label || map.name || null;
      const workMin = map.work || map.workmin || map.workMin || null;
      if (map.timer != null || pageHint === "timer") {
        const raw = map.timer != null ? map.timer : map.duration || map.for || null;
        if (raw != null && String(raw).trim() !== "" && String(raw).toLowerCase() !== "start") {
          const sec = parseDurationToSec(raw);
          if (!sec) {
            return { unknown: String(raw), hint: "Duration like 25m, 90s, 1h, or 5:00" };
          }
          return { page: "timer", action: "startTimer", param: String(sec), label };
        }
        if (String(map.timer || "").toLowerCase() === "pause" || map.action === "pause") {
          return { page: "timer", action: "pauseTimer" };
        }
        return { page: "timer" };
      }
      if (map.pomodoro != null || pageHint === "pomodoro") {
        const actionRaw = String(map.pomodoro || map.action || "start").toLowerCase();
        if (actionRaw === "pause" || actionRaw === "stop") {
          return { page: "pomodoro", action: "pausePomodoro" };
        }
        return {
          page: "pomodoro",
          action: "startPomodoro",
          workMin: workMin != null ? String(workMin) : null,
        };
      }
      if (map.stopwatch != null || pageHint === "stopwatch") {
        return { page: "stopwatch", action: "startStopwatch" };
      }
    }

    if (moduleId === "stocks") {
      if (map.mode) {
        const mode = String(map.mode).toLowerCase();
        if (!def.modes?.includes(mode)) {
          return { unknown: `mode:${map.mode}`, hint: `Modes: ${def.modes.join(", ")}` };
        }
        return { action: "setMode", param: mode };
      }
      const symbol = map.symbol || map.ticker || map.stock;
      if (symbol) {
        return { action: "openStock", param: String(symbol).toUpperCase(), page: "stock" };
      }
    }

    if (moduleId === "geography") {
      let countryRaw = map.country || map.code || map.name || null;
      let forceLearn = pageHint === "learn";

      if (map.learn != null && countryRaw == null) {
        countryRaw = map.learn;
        forceLearn = true;
      }
      if (map.explore != null && map.country == null && map.learn == null) {
        countryRaw = map.explore;
        forceLearn = false;
      }

      if (countryRaw) {
        const code = resolveCountryCode(countryRaw);
        if (!code) {
          return { unknown: String(countryRaw), hint: "Use a country name or ISO code (Togo, TG)" };
        }
        if (forceLearn) {
          return { page: "learn", param: code, action: "openLearn" };
        }
        return { page: "explore", param: code, action: "openCountry" };
      }
    }

    if (moduleId === "translate") {
      const text = map.text || map.q || map.source || map.query;
      if (text) {
        return {
          page: "translate",
          param: text,
          action: "openTranslate",
          from: map.from || map.sourceLang || null,
          to: map.to || map.target || map.targetLang || null,
        };
      }
    }

    if (moduleId === "code-lexicon") {
      const term = map.term || map.id || map.q;
      if (term) {
        return { page: "browse", param: term, action: "openTerm" };
      }
    }

    if (moduleId === "space" && map.view) {
      const view = String(map.view).toLowerCase();
      if (def.views?.includes(view)) return { page: "navigate", view };
    }

    if (moduleId === "history" && (map.id || map.entity)) {
      const id = map.id || map.entity;
      const type = map.type || (pageHint === "events" ? "event" : "figure");
      return {
        page: pageHint === "events" ? "events" : "figures",
        param: id,
        action: "openEntity",
        entityType: type,
      };
    }

    for (const [key, value] of Object.entries(map)) {
      if (key === "page") continue;
      if (def.pages?.includes(key) || def.deep?.[key]) {
        const page = def.pages?.includes(key) ? key : key;
        const deepFn = def.deep?.[key] || def.deep?.[page];
        if (moduleId === "flag-quiz" && key === "quiz") {
          return { page: "quiz", action: "startQuiz" };
        }
        if (deepFn) return { page, param: value, action: deepFn };
        return { page, param: value };
      }
    }

    if (pageHint && def.pages?.includes(pageHint)) {
      const deepFn = def.deep?.[pageHint];
      const param = map.id || map.param || map.target || null;
      if (param && deepFn) return { page: pageHint, param, action: deepFn };
      if (moduleId === "flag-quiz" && pageHint === "quiz") return { page: "quiz", action: "startQuiz" };
      return { page: pageHint, param };
    }

    if (map.view && def.views?.includes(String(map.view).toLowerCase())) {
      return { page: "navigate", view: String(map.view).toLowerCase() };
    }

    const unknownKey = Object.keys(map)[0];
    return {
      unknown: unknownKey || "args",
      hint: formatRouteHint(moduleId, def),
    };
  }

  function routeFromBare(moduleId, def, raw) {
    const lower = String(raw || "").trim().toLowerCase();
    if (!raw) return null;

    if (def.views?.includes(lower)) {
      return { page: "navigate", view: lower };
    }

    if (def.pages?.includes(lower)) {
      if (moduleId === "flag-quiz" && lower === "quiz") {
        return { page: "quiz", action: "startQuiz" };
      }
      if (moduleId === "world-clock" && lower === "pomodoro") {
        return { page: "pomodoro", action: "startPomodoro" };
      }
      if (moduleId === "world-clock" && lower === "stopwatch") {
        return { page: "stopwatch", action: "startStopwatch" };
      }
      return { page: lower };
    }

    if (moduleId === "world-clock" && looksLikeDuration(raw)) {
      const sec = parseDurationToSec(raw);
      if (sec) return { page: "timer", action: "startTimer", param: String(sec) };
    }

    if (moduleId === "stocks" && def.ticker && /^[A-Za-z0-9.^=-]{1,16}$/.test(raw)) {
      return { action: "openStock", param: String(raw).toUpperCase(), page: "stock" };
    }

    if (moduleId === "geography") {
      const code = resolveCountryCode(raw);
      if (code) return { page: "explore", param: code, action: "openCountry" };
    }

    if (moduleId === "translate" && def.bare === "text") {
      return { page: "translate", param: raw, action: "openTranslate" };
    }

    if (moduleId === "code-lexicon" && def.bare === "term") {
      return { page: "browse", param: raw, action: "openTerm" };
    }

    if (moduleId === "scripts") {
      return { action: "openAndRunScript", param: raw, page: "editor" };
    }

    return {
      unknown: lower,
      hint: formatRouteHint(moduleId, def),
    };
  }

  function parseDurationToSec(raw) {
    const s = String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
    if (!s) return null;
    if (/^\d+$/.test(s)) {
      const n = parseInt(s, 10);
      return Number.isFinite(n) && n > 0 ? n * 60 : null;
    }
    if (/^\d+:\d{2}(:\d{2})?$/.test(s)) {
      const parts = s.split(":").map((x) => parseInt(x, 10));
      if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
      let total = 0;
      if (parts.length === 2) total = parts[0] * 60 + parts[1];
      else total = parts[0] * 3600 + parts[1] * 60 + parts[2];
      return total > 0 ? total : null;
    }
    let total = 0;
    let matched = false;
    const re = /(\d+)(h|hr|hours?|m|min|minutes?|s|sec|seconds?)/gi;
    let m;
    while ((m = re.exec(s))) {
      matched = true;
      const n = parseInt(m[1], 10);
      const u = m[2].toLowerCase();
      if (u.startsWith("h")) total += n * 3600;
      else if (u.startsWith("m")) total += n * 60;
      else total += n;
    }
    if (!matched || total <= 0) return null;
    return Math.min(total, 24 * 3600);
  }

  function formatDurationSec(sec) {
    const n = Math.max(0, Math.round(Number(sec) || 0));
    const h = Math.floor(n / 3600);
    const m = Math.floor((n % 3600) / 60);
    const s = n % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return s ? `${m}m ${s}s` : `${m}m`;
    return `${s}s`;
  }

  function looksLikeDuration(raw) {
    const s = String(raw || "")
      .trim()
      .toLowerCase();
    if (!s) return false;
    if (/^\d+$/.test(s)) return true;
    if (/^\d+:\d{2}(:\d{2})?$/.test(s)) return true;
    return /^\d+\s*(h|hr|hours?|m|min|minutes?|s|sec|seconds?)/i.test(s);
  }

  function findClockApp(apps) {
    return findAppByRef("clock", apps) || findAppByRef("world-clock", apps);
  }

  async function openClock(ctx, route) {
    const app = findClockApp(ctx.getApps?.() || []);
    if (!app) return { ok: false, error: "Clock app not found" };
    await ctx.launchApp?.(app, { route: route || { page: "timer" } });
    return { ok: true };
  }

  function findTodayApp(apps) {
    return (
      findAppByRef("today", apps) ||
      findAppByRef("day-planner", apps) ||
      findAppByRef("planner", apps)
    );
  }

  async function openToday(ctx, page) {
    const app = findTodayApp(ctx.getApps?.() || []);
    if (!app) return { ok: false, error: "Today app not found" };
    const p = page || "today";
    await ctx.launchApp?.(app, { route: { page: p } });
    return { ok: true };
  }

  function findStocksApp(apps) {
    return findAppByRef("stocks", apps);
  }

  async function openStocks(ctx, route) {
    const app = findStocksApp(ctx.getApps?.() || []);
    if (!app) return { ok: false, error: "Stocks app not found" };
    await ctx.launchApp?.(app, { route: route || { page: "dashboard" } });
    return { ok: true };
  }

  function findBuildsApp(apps) {
    return findAppByRef("builds", apps);
  }

  async function openBuilds(ctx, route) {
    const app = findBuildsApp(ctx.getApps?.() || []);
    if (!app) return { ok: false, error: "Builds app not found" };
    await ctx.launchApp?.(app, { route: route || { page: "browse" } });
    return { ok: true };
  }

  function findVaultApp(apps) {
    return findAppByRef("vault", apps) || findAppByRef("profiles", apps);
  }

  async function openVault(ctx, route) {
    const app = findVaultApp(ctx.getApps?.() || []);
    if (!app) return { ok: false, error: "Vault app not found" };
    await ctx.launchApp?.(app, { route: route || { page: "vault" } });
    return { ok: true };
  }

  async function syncIfOpen(ctx, findFn, route) {
    try {
      const apps = ctx.getApps?.() || [];
      const app = findFn(apps);
      if (!app || !ctx.isAppOpen?.(app)) return;
      await ctx.launchApp?.(app, { route: route || null });
    } catch {
    }
  }

  function syncClockIfOpen(ctx, route) {
    return syncIfOpen(ctx, findClockApp, route);
  }
  function syncTodayIfOpen(ctx, page) {
    return syncIfOpen(ctx, findTodayApp, { page: page || "today" });
  }
  function syncStocksIfOpen(ctx, route) {
    return syncIfOpen(ctx, findStocksApp, route);
  }
  function syncBuildsIfOpen(ctx, route) {
    return syncIfOpen(ctx, findBuildsApp, route);
  }
  function syncVaultIfOpen(ctx, route) {
    return syncIfOpen(ctx, findVaultApp, route || { page: "vault" });
  }

  function findDriftApp(apps) {
    return findAppByRef("drift", apps);
  }

  async function openDrift(ctx, route) {
    const app = findDriftApp(ctx.getApps?.() || []);
    if (!app) return { ok: false, error: "Drift app not found" };
    await ctx.launchApp?.(app, { route: route || { page: "activity" } });
    return { ok: true };
  }

  function syncDriftIfOpen(ctx, route) {
    return syncIfOpen(ctx, findDriftApp, route);
  }

  function findStudyDeckApp(apps) {
    return (
      findAppByRef("studydeck", apps) ||
      findAppByRef("flashcards", apps) ||
      findAppByRef("decks", apps) ||
      findAppByRef("study-deck", apps)
    );
  }

  async function openStudyDeck(ctx, route) {
    const app = findStudyDeckApp(ctx.getApps?.() || []);
    if (!app) return { ok: false, error: "Study Deck app not found" };
    await ctx.launchApp?.(app, { route: route || { page: "home" } });
    return { ok: true };
  }

  function syncStudyDeckIfOpen(ctx, route) {
    return syncIfOpen(ctx, findStudyDeckApp, route);
  }

  function findContactsApp(apps) {
    return findAppByRef("contacts", apps);
  }

  async function openContacts(ctx, route) {
    const app = findContactsApp(ctx.getApps?.() || []);
    if (!app) return { ok: false, error: "Contacts app not found" };
    await ctx.launchApp?.(app, { route: route || { page: "browse" } });
    return { ok: true };
  }

  function syncContactsIfOpen(ctx, route) {
    return syncIfOpen(ctx, findContactsApp, route);
  }

  function findNotesApp(apps) {
    return findAppByRef("notes", apps) || findAppByRef("note", apps);
  }

  async function openNotes(ctx, route) {
    const app = findNotesApp(ctx.getApps?.() || []);
    if (!app) return { ok: false, error: "Notes app not found" };
    await ctx.launchApp?.(app, { route: route || { page: "all" } });
    return { ok: true };
  }

  function syncNotesIfOpen(ctx, route) {
    return syncIfOpen(ctx, findNotesApp, route);
  }

  function findTasksApp(apps) {
    return (
      findAppByRef("tasks", apps) ||
      findAppByRef("gtd", apps) ||
      findAppByRef("todo", apps)
    );
  }

  async function openTasks(ctx, route) {
    const app = findTasksApp(ctx.getApps?.() || []);
    if (!app) return { ok: false, error: "Tasks app not found" };
    await ctx.launchApp?.(app, { route: route || { page: "inbox" } });
    return { ok: true };
  }

  function syncTasksIfOpen(ctx, route) {
    return syncIfOpen(ctx, findTasksApp, route);
  }

  function findChatApp(apps) {
    return findAppByRef("chat", apps) || findAppByRef("aichat", apps);
  }

  async function openChatApp(ctx, route) {
    const app = findChatApp(ctx.getApps?.() || []);
    if (!app) return { ok: false, error: "Chat app not found" };
    await ctx.launchApp?.(app, { route: route || { page: "home" } });
    return { ok: true };
  }

  function findTranslateApp(apps) {
    return findAppByRef("translate", apps);
  }

  async function openTranslate(ctx, route) {
    const app = findTranslateApp(ctx.getApps?.() || []);
    if (!app) return { ok: false, error: "Translate app not found" };
    await ctx.launchApp?.(app, { route: route || { page: "translate" } });
    return { ok: true };
  }

  function syncTranslateIfOpen(ctx, route) {
    return syncIfOpen(ctx, findTranslateApp, route);
  }

  function findSysInfoApp(apps) {
    return (
      findAppByRef("sysinfo", apps) ||
      findAppByRef("sys", apps) ||
      findAppByRef("system-info", apps)
    );
  }

  async function openSysInfo(ctx, route) {
    const app = findSysInfoApp(ctx.getApps?.() || []);
    if (!app) return { ok: false, error: "System Info app not found" };
    await ctx.launchApp?.(app, { route: route || { page: "system" } });
    return { ok: true };
  }

  function syncSysInfoIfOpen(ctx, route) {
    return syncIfOpen(ctx, findSysInfoApp, route);
  }

  function findRemoteHubApp(apps) {
    return findAppByRef("remote", apps) || findAppByRef("remote-hub", apps);
  }

  async function openRemoteHub(ctx, route) {
    const app = findRemoteHubApp(ctx.getApps?.() || []);
    if (!app) return { ok: false, error: "Remote Hub app not found" };
    await ctx.launchApp?.(app, { route: route || { page: "machines" } });
    return { ok: true };
  }

  function findOsBridgeApp(apps) {
    return (
      findAppByRef("os-bridge", apps) ||
      findAppByRef("bridge", apps) ||
      findAppByRef("osbridge", apps)
    );
  }

  async function openOsBridge(ctx, route) {
    const page = route?.page || "devices";
    if (!route?.full && window.MySpaceBridgePanel?.show) {
      window.MySpaceBridgePanel.show(page);
      return { ok: true };
    }
    const app = findOsBridgeApp(ctx.getApps?.() || []);
    if (!app) return { ok: false, error: "OS Bridge app not found" };
    await ctx.launchApp?.(app, { route: { page }, full: true });
    return { ok: true };
  }

  function syncOsBridgeIfOpen(ctx, route) {
    return syncIfOpen(ctx, findOsBridgeApp, route);
  }

  function findFilesApp(apps) {
    return findAppByRef("files", apps) || findAppByRef("file", apps) || findAppByRef("explorer", apps);
  }

  async function openFiles(ctx, route) {
    const page = route?.page || "browse";
    const pathArg = route?.path || "";
    if (!route?.full && !pathArg && window.MySpaceFilesPanel?.show) {
      window.MySpaceFilesPanel.show(page);
      return { ok: true };
    }
    if (window.MySpaceFiles?.open) {
      await window.MySpaceFiles.open({ page, path: pathArg || undefined, full: true });
      return { ok: true };
    }
    const app = findFilesApp(ctx.getApps?.() || []);
    if (!app) return { ok: false, error: "Files app not found" };
    await ctx.launchApp?.(app, {
      route: pathArg ? { page: "browse", path: pathArg } : { page },
      full: true,
    });
    return { ok: true };
  }

  function syncFilesIfOpen(ctx, route) {
    return syncIfOpen(ctx, findFilesApp, route);
  }

  function syncRemoteHubIfOpen(ctx, route) {
    return syncIfOpen(ctx, findRemoteHubApp, route);
  }

  function findStudiesApp(apps) {
    return findAppByRef("studies", apps);
  }
  async function openStudies(ctx, route) {
    const app = findStudiesApp(ctx.getApps?.() || []);
    if (!app) return { ok: false, error: "Studies app not found" };
    await ctx.launchApp?.(app, { route: route || { page: "home" } });
    return { ok: true };
  }
  function syncStudiesIfOpen(ctx, route) {
    return syncIfOpen(ctx, findStudiesApp, route);
  }

  function findGeographyApp(apps) {
    return findAppByRef("geo", apps) || findAppByRef("geography", apps);
  }
  async function openGeography(ctx, route) {
    const app = findGeographyApp(ctx.getApps?.() || []);
    if (!app) return { ok: false, error: "Geography app not found" };
    await ctx.launchApp?.(app, { route: route || { page: "explore" } });
    return { ok: true };
  }
  function syncGeographyIfOpen(ctx, route) {
    return syncIfOpen(ctx, findGeographyApp, route);
  }

  function findFlagQuizApp(apps) {
    return (
      findAppByRef("flags", apps) ||
      findAppByRef("flagquiz", apps) ||
      findAppByRef("flag-quiz", apps)
    );
  }
  async function openFlagQuiz(ctx, route) {
    const app = findFlagQuizApp(ctx.getApps?.() || []);
    if (!app) return { ok: false, error: "Flag Quiz app not found" };
    await ctx.launchApp?.(app, { route: route || { page: "home" } });
    return { ok: true };
  }
  function syncFlagQuizIfOpen(ctx, route) {
    return syncIfOpen(ctx, findFlagQuizApp, route);
  }

  function findHistoryApp(apps) {
    return findAppByRef("history", apps);
  }
  async function openHistory(ctx, route) {
    const app = findHistoryApp(ctx.getApps?.() || []);
    if (!app) return { ok: false, error: "History app not found" };
    await ctx.launchApp?.(app, { route: route || { page: "figures" } });
    return { ok: true };
  }
  function syncHistoryIfOpen(ctx, route) {
    return syncIfOpen(ctx, findHistoryApp, route);
  }

  function findSpaceApp(apps) {
    return findAppByRef("space", apps);
  }
  async function openSpace(ctx, route) {
    const app = findSpaceApp(ctx.getApps?.() || []);
    if (!app) return { ok: false, error: "Space app not found" };
    await ctx.launchApp?.(app, { route: route || { page: "navigate" } });
    return { ok: true };
  }
  function syncSpaceIfOpen(ctx, route) {
    return syncIfOpen(ctx, findSpaceApp, route);
  }

  function findContractsApp(apps) {
    return findAppByRef("contracts", apps);
  }
  async function openContracts(ctx, route) {
    const app = findContractsApp(ctx.getApps?.() || []);
    if (!app) return { ok: false, error: "Contracts app not found" };
    await ctx.launchApp?.(app, { route: route || { page: "library" } });
    return { ok: true };
  }
  function syncContractsIfOpen(ctx, route) {
    return syncIfOpen(ctx, findContractsApp, route);
  }

  function findMslApp(apps) {
    return (
      apps.find((a) => a.id === "msl-protocol" || a.module === "msl-protocol") ||
      findAppByRef("msl", apps) ||
      findAppByRef("msl-protocol", apps)
    );
  }
  async function openMsl(ctx, route) {
    const page = String(route?.page || "caps").toLowerCase();
    const tab =
      page === "home" || page === "workshop" || page === "mint"
        ? "mint"
        : page === "inject"
          ? "inject"
          : page === "keys"
            ? "keys"
            : page === "about"
              ? "about"
              : "caps";
    if (window.MySpaceMsl?.open) {
      await window.MySpaceMsl.open({ page: tab });
      return { ok: true };
    }
    const app = findMslApp(ctx.getApps?.() || []);
    if (app) {
      await ctx.launchApp?.(app, { route: { page: tab }, full: true, skipJobs: true });
      return { ok: true };
    }
    window.MySpaceMslPanel?.show?.(tab);
    return { ok: true };
  }

  async function openParts(ctx, route) {
    const page = String(route?.page || "explore").toLowerCase();
    const apps = ctx.getApps?.() || [];
    const app =
      apps.find((a) => a.id === "parts" || a.module === "parts") ||
      findAppByRef("parts", apps) ||
      findAppByRef("forge", apps);
    if (!app) {
      window.MySpacePartsPanel?.show?.(page === "about" ? "about" : undefined);
      return { ok: true, message: "Parts panel" };
    }
    const nav = {
      page: page === "catalog" ? "explore" : page,
      id: route?.id || route?.part || route?.param,
      part: route?.id || route?.part || route?.param,
      param: route?.id || route?.part || route?.param,
      app: route?.app,
    };
    await ctx.launchApp?.(app, { route: nav, full: true, skipJobs: true });
    return { ok: true };
  }

  async function openPermissions(ctx, route) {
    const page = String(route?.page || "overview").toLowerCase();
    const apps = ctx.getApps?.() || [];
    const app =
      apps.find((a) => a.id === "permissions" || a.module === "permissions") ||
      findAppByRef("permissions", apps) ||
      findAppByRef("perms", apps);
    if (!app) {
      return { ok: false, error: "Permissions app unavailable" };
    }
    await ctx.launchApp?.(app, {
      route: { page },
      full: true,
      skipJobs: true,
    });
    return { ok: true };
  }

  async function openJobs(ctx, route) {
    const raw = String(route?.page || route?.tab || "queue").toLowerCase();
    const alias = {
      panel: "queue",
      open: "queue",
      home: "queue",
      all: "queue",
      running: "active",
      finished: "done",
      new: "enqueue",
      add: "enqueue",
      contract: "capacity",
      pools: "capacity",
      budget: "capacity",
    };
    const page = ["queue", "active", "done", "enqueue", "capacity", "about"].includes(alias[raw] || raw)
      ? alias[raw] || raw
      : "queue";
    if (window.MySpaceJobs?.open) {
      await window.MySpaceJobs.open({ page });
      return { ok: true };
    }
    const apps = ctx.getApps?.() || [];
    const app =
      apps.find((a) => a.id === "jobs" || a.module === "jobs") || findAppByRef("jobs", apps);
    if (app) {
      await ctx.launchApp?.(app, { route: { page }, full: true, skipJobs: true });
      return { ok: true };
    }
    window.MySpaceJobsPanel?.show?.(page);
    return { ok: true };
  }

  async function openScheduler(ctx, route) {
    const raw = String(route?.page || route?.tab || "active").toLowerCase();
    const alias = {
      panel: "active",
      open: "active",
      home: "active",
      queue: "active",
      list: "all",
      schedules: "all",
      add: "new",
      create: "new",
      enqueue: "new",
      runs: "history",
      log: "history",
    };
    const page = ["active", "all", "history", "new", "about"].includes(alias[raw] || raw)
      ? alias[raw] || raw
      : "active";
    if (window.MySpaceScheduler?.open) {
      await window.MySpaceScheduler.open({ page });
      return { ok: true };
    }
    const apps = ctx.getApps?.() || [];
    const app =
      apps.find((a) => a.id === "scheduler" || a.module === "scheduler") ||
      findAppByRef("scheduler", apps);
    if (app) {
      await ctx.launchApp?.(app, { route: { page }, full: true, skipJobs: true });
      return { ok: true };
    }
    return { ok: false, error: "Scheduler unavailable" };
  }

  async function openResolve(ctx, route) {
    const raw = String(route?.page || "inbox").toLowerCase();
    const page = ["inbox", "playbooks", "about"].includes(raw) ? raw : "inbox";
    if (window.MySpaceResolve?.open) {
      await window.MySpaceResolve.open({ page, incidentId: route?.incidentId || null });
      return { ok: true };
    }
    const apps = ctx.getApps?.() || [];
    const app =
      apps.find((a) => a.id === "resolve" || a.module === "resolve") ||
      findAppByRef("resolve", apps);
    if (app) {
      await ctx.launchApp?.(app, {
        route: { page, incidentId: route?.incidentId || null },
        full: true,
        skipJobs: true,
      });
      return { ok: true };
    }
    window.MySpaceResolvePanel?.show?.(page);
    return { ok: true };
  }

  async function openUpdates(ctx, route) {
    const raw = String(route?.page || "pending").toLowerCase();
    const page = ["pending", "history", "about"].includes(raw) ? raw : "pending";
    if (window.MySpaceUpdates?.open) {
      await window.MySpaceUpdates.open({ page });
      return { ok: true };
    }
    const apps = ctx.getApps?.() || [];
    const app =
      apps.find((a) => a.id === "updates" || a.module === "updates") ||
      findAppByRef("updates", apps);
    if (app) {
      await ctx.launchApp?.(app, { route: { page }, full: true, skipJobs: true });
      return { ok: true };
    }
    window.MySpaceUpdatesPanel?.show?.(page);
    return { ok: true };
  }

  async function openNetwork(ctx, route) {
    const raw = String(route?.page || "status").toLowerCase();
    const page = ["status", "adapters", "ports", "about"].includes(raw) ? raw : "status";
    if (window.MySpaceNetwork?.open) {
      await window.MySpaceNetwork.open({ page });
      return { ok: true };
    }
    const apps = ctx.getApps?.() || [];
    const app =
      apps.find((a) => a.id === "network" || a.module === "network") ||
      findAppByRef("network", apps);
    if (app) {
      await ctx.launchApp?.(app, { route: { page }, full: true, skipJobs: true });
      return { ok: true };
    }
    window.MySpaceNetworkPanel?.show?.(page);
    return { ok: true };
  }

  async function openInfo(ctx, route) {
    const raw = String(route?.page || "catalog").toLowerCase();
    const page = ["catalog", "services", "apps", "external", "about", "all"].includes(raw)
      ? raw === "all"
        ? "catalog"
        : raw
      : "catalog";
    if (window.MySpaceInfo?.open) {
      await window.MySpaceInfo.open({ page, id: route?.id || null });
      return { ok: true };
    }
    const apps = ctx.getApps?.() || [];
    const app =
      apps.find((a) => a.id === "apps-info" || a.module === "apps-info") ||
      findAppByRef("info", apps) ||
      findAppByRef("apps-info", apps);
    if (app) {
      await ctx.launchApp?.(app, { route: { page, id: route?.id || null }, full: true, skipJobs: true });
      return { ok: true };
    }
    window.MySpaceInfoPanel?.show?.(page);
    return { ok: true };
  }

  async function openBackup(ctx, route) {
    const raw = String(route?.page || "status").toLowerCase();
    const page = ["status", "history", "about"].includes(raw) ? raw : "status";
    if (window.MySpaceBackup?.open) {
      await window.MySpaceBackup.open({ page });
      return { ok: true };
    }
    const apps = ctx.getApps?.() || [];
    const app =
      apps.find((a) => a.id === "backup" || a.module === "backup") ||
      findAppByRef("backup", apps);
    if (app) {
      await ctx.launchApp?.(app, { route: { page }, full: true, skipJobs: true });
      return { ok: true };
    }
    window.MySpaceBackupPanel?.show?.(page);
    return { ok: true };
  }

  async function openStorage(ctx, route) {
    const raw = String(route?.page || "status").toLowerCase();
    const page = ["status", "apps", "large-files", "cleanup", "about"].includes(raw)
      ? raw
      : "status";
    if (window.MySpaceStorage?.open) {
      await window.MySpaceStorage.open({ page });
      return { ok: true };
    }
    const apps = ctx.getApps?.() || [];
    const app =
      apps.find((a) => a.id === "storage" || a.module === "storage") ||
      findAppByRef("storage", apps);
    if (app) {
      await ctx.launchApp?.(app, { route: { page }, full: true, skipJobs: true });
      return { ok: true };
    }
    window.MySpaceStoragePanel?.show?.(page);
    return { ok: true };
  }

  async function openThemes(ctx, route) {
    const raw = String(route?.page || "apps").toLowerCase();
    const page = ["apps", "about"].includes(raw) ? raw : "apps";
    const appId = route?.appId || route?.id || null;
    if (window.MySpaceThemes?.open) {
      await window.MySpaceThemes.open({ page, appId });
      return { ok: true };
    }
    const apps = ctx.getApps?.() || [];
    const app =
      apps.find((a) => a.id === "themes" || a.module === "themes") ||
      findAppByRef("themes", apps);
    if (app) {
      await ctx.launchApp?.(app, { route: { page, appId }, full: true, skipJobs: true });
      return { ok: true };
    }
    window.MySpaceThemesPanel?.show?.(page, { appId });
    return { ok: true };
  }

  function findLexiconApp(apps) {
    return (
      findAppByRef("lexicon", apps) ||
      findAppByRef("codelexicon", apps) ||
      findAppByRef("code-lexicon", apps)
    );
  }
  async function openLexicon(ctx, route) {
    const app = findLexiconApp(ctx.getApps?.() || []);
    if (!app) return { ok: false, error: "Code Lexicon app not found" };
    await ctx.launchApp?.(app, { route: route || { page: "browse" } });
    return { ok: true };
  }
  function syncLexiconIfOpen(ctx, route) {
    return syncIfOpen(ctx, findLexiconApp, route);
  }

  function findModelFlowApp(apps) {
    return (
      findAppByRef("flow", apps) ||
      findAppByRef("modelflow", apps) ||
      findAppByRef("zapier", apps) ||
      findAppByRef("model-flow", apps)
    );
  }
  async function openModelFlow(ctx, route) {
    const app = findModelFlowApp(ctx.getApps?.() || []);
    if (!app) return { ok: false, error: "Model Flow app not found" };
    await ctx.launchApp?.(app, { route: route || { page: "studio" }, full: true, skipJobs: true });
    return { ok: true };
  }
  function syncModelFlowIfOpen(ctx, route) {
    return syncIfOpen(ctx, findModelFlowApp, route);
  }

  function findShellConsoleApp(apps) {
    return (
      findAppByRef("console", apps) ||
      findAppByRef("shell", apps) ||
      findAppByRef("shell-console", apps)
    );
  }
  async function openShellConsole(ctx, route) {
    const raw = String(route?.page || "overview").toLowerCase();
    const map = {
      runner: "overview",
      reference: "overview",
      history: "language",
      aliases: "language",
      macros: "language",
      when: "language",
      open: "overview",
      home: "overview",
      panel: "overview",
    };
    const page = map[raw] || raw;
    if (window.MySpaceShellAtlas?.open) {
      window.MySpaceShellAtlas.open({ page });
      return { ok: true };
    }
    return { ok: false, error: "Shell atlas unavailable " };
  }
  function syncShellConsoleIfOpen(ctx, route) {
    return syncIfOpen(ctx, findShellConsoleApp, route);
  }

  function findDocsApp(apps) {
    return (
      findAppByRef("docs", apps) ||
      findAppByRef("documentation", apps) ||
      findAppByRef("handbook", apps)
    );
  }

  async function openDocs(ctx, route) {
    const app = findDocsApp(ctx.getApps?.() || []);
    if (!app) return { ok: false, error: "Docs app not found" };
    await ctx.launchApp?.(app, { route: route || { page: "overview" } });
    return { ok: true };
  }

  function syncDocsIfOpen(ctx, route) {
    return syncIfOpen(ctx, findDocsApp, route);
  }

  function findScriptsApp(apps) {
    return (
      findAppByRef("scripts", apps) ||
      findAppByRef("script", apps) ||
      findAppByRef("long-commands", apps)
    );
  }

  async function openScripts(ctx, route) {
    const app = findScriptsApp(ctx.getApps?.() || []);
    if (!app) return { ok: false, error: "Scripts app not found" };
    await ctx.launchApp?.(app, { route: route || {} });
    return { ok: true };
  }

  function syncScriptsIfOpen(ctx, route) {
    return syncIfOpen(ctx, findScriptsApp, route);
  }

  function findMapsApp(apps) {
    return (
      findAppByRef("world-maps", apps) ||
      findAppByRef("maps", apps) ||
      findAppByRef("worldmaps", apps)
    );
  }

  async function openMaps(ctx, route) {
    const app = findMapsApp(ctx.getApps?.() || []);
    if (!app) return { ok: false, error: "World Maps app not found" };
    await ctx.launchApp?.(app, { route: route || { page: "map" } });
    return { ok: true };
  }

  function syncMapsIfOpen(ctx, route) {
    return syncIfOpen(ctx, findMapsApp, route);
  }

  function localTodayISO(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function addDaysISO(iso, days) {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() + days);
    return localTodayISO(d);
  }

  function formatRouteHint(moduleId, def) {
    if (!def) return "Unknown target";
    const bits = [];
    if (def.pages?.length) bits.push(`pages: ${def.pages.join(", ")}`);
    if (def.views?.length) bits.push(`views: ${def.views.join(", ")}`);
    if (def.modes?.length) bits.push(`modes: mode:${def.modes.join(", mode:")}`);
    if (def.ticker) bits.push("ticker: AAPL or symbol:AAPL");
    if (def.bare === "country") bits.push("country: Togo or TG");
    if (def.bare === "text") bits.push("text:hello or bare phrase");
    if (def.bare === "term") bits.push("term:promise or bare term");
    if (def.bare === "script") bits.push("script name: morning");
    if (moduleId === "world-clock") bits.push("timer:25m · pomodoro · stopwatch");
    if (def.examples?.length) bits.push(`e.g. ${def.examples[0]}`);
    return bits.join(" · ") || moduleId;
  }

  function parseRunArgs(moduleId, argRaw) {
    const def = ROUTE_REGISTRY[moduleId];
    if (!def || !argRaw) return null;

    const raw = String(argRaw).trim();
    if (!raw) return null;

    const { map, positional, keys, single } = parseArgStructure(raw);

    if (keys.length) {
      return routeFromKv(moduleId, def, map);
    }

    if (positional.length > 1) {
      return {
        unknown: raw,
        hint: "Use commas for key:value",
      };
    }

    if (single != null) {
      return routeFromBare(moduleId, def, single);
    }

    return { unknown: raw, hint: formatRouteHint(moduleId, def) };
  }

  function wrapRetryScript(bodyLines) {
    return [
      "(function(){",
      "  var tries = 0;",
      "  function go(){",
      ...bodyLines,
      "  }",
      "  go();",
      "})();",
    ].join("\n");
  }

  function retryGuard(checkExpr, bodyLines) {
    return [
      `    if(!(${checkExpr})){`,
      "      if(++tries < 40){ setTimeout(go, 50); return; }",
      "      return;",
      "    }",
      ...bodyLines,
    ];
  }

  function resolveCountryCode(ref) {
    const raw = String(ref || "").trim();
    if (!raw) return null;
    const idx = window.MySpaceGeoCountries;
    const upper = raw.toUpperCase();
    if (idx?.byCode?.[upper]) return idx.byCode[upper];
    const lower = raw.toLowerCase();
    if (idx?.byName?.[lower]) return idx.byName[lower];
    if (/^[A-Za-z]{2,3}$/.test(raw)) return upper;
    if (idx?.byName && raw.length >= 4) {
      let hit = null;
      for (const [name, code] of Object.entries(idx.byName)) {
        if (name === lower || name.startsWith(lower) || lower.startsWith(name)) {
          hit = code;
          break;
        }
      }
      if (hit) return hit;
    }
    return null;
  }

  function parseRunCommand(line, apps = []) {
    const trimmed = String(line || "").trim();
    if (!/^run\b/i.test(trimmed)) return null;

    let rest = trimmed.slice(3).trim();
    if (!rest) return null;

    const matched = matchAppRefAtStart(rest, apps);
    if (!matched) return null;

    rest = matched.rest;
    let argRaw = "";
    if (rest.startsWith("(")) {
      const closeIdx = rest.indexOf(")");
      if (closeIdx === -1) return null;
      argRaw = rest.slice(1, closeIdx).trim();
      rest = rest.slice(closeIdx + 1).trim();
    }
    if (rest) return null;

    const moduleId = matched.app.module || resolveModule(matched.ref);

    return {
      appRef: matched.ref,
      app: matched.app,
      moduleId,
      argRaw,
      route: moduleId && argRaw ? parseRunArgs(moduleId, argRaw) : null,
    };
  }

  function buildRouteScript(moduleId, route) {
    if (!route || route.unknown) return null;

    const def = ROUTE_REGISTRY[moduleId];
    if (!def) return null;

    if (moduleId === "mail" && (route.action === "open-mail" || route.action === "openMail")) {
      const messageId = escapeJsString(route.messageId || "");
      const accountId = escapeJsString(route.accountId || "");
      return wrapRetryScript(
        retryGuard("window.MySpaceConnectHub?.openFromNotification", [
          `    window.MySpaceConnectHub.openFromNotification({ action: 'open-mail', messageId: '${messageId}', accountId: '${accountId}' });`,
        ])
      );
    }

    if (
      moduleId === "mail" &&
      (route.page === "hub" ||
        route.page === "catalog" ||
        route.page === "connect" ||
        route.page === "home" ||
        route.action === "show-hub" ||
        route.action === "showHub")
    ) {
      return wrapRetryScript(
        retryGuard("window.MySpaceConnectHub?.show", ["    window.MySpaceConnectHub.show();"])
      );
    }

    if (moduleId === "space" && route.view) {
      const view = escapeJsString(route.view);
      return wrapRetryScript(
        retryGuard("window.SpaceApp && window.SpacePages?.navigate?.setRealm", [
          "    window.SpaceApp.setPage('navigate');",
          `    window.SpacePages.navigate.setRealm('${view}');`,
        ])
      );
    }

    if (route.action === "openStock") {
      const symbol = escapeJsString(route.param);
      return wrapRetryScript(
        retryGuard("window.StocksApp?.openStock", [`    window.StocksApp.openStock('${symbol}');`])
      );
    }

    if (route.action === "setMode") {
      const mode = escapeJsString(route.param);
      return wrapRetryScript(
        retryGuard("window.StocksApp?.setMode", [`    window.StocksApp.setMode('${mode}');`])
      );
    }

    if (route.action === "openLearn" || (moduleId === "geography" && route.page === "learn" && route.param)) {
      const code = escapeJsString(route.param || "");
      return wrapRetryScript(
        retryGuard("window.GeoApp?.openLearn", [`    window.GeoApp.openLearn('${code}');`])
      );
    }

    if (
      route.action === "openCountry" ||
      (moduleId === "geography" && route.page === "explore" && route.param)
    ) {
      const code = escapeJsString(route.param || "");
      return wrapRetryScript(
        retryGuard("window.GeoApp?.openCountry", [`    window.GeoApp.openCountry('${code}');`])
      );
    }

    if (route.action === "openEntity" || (moduleId === "history" && route.param)) {
      const id = escapeJsString(route.param || "");
      const type = escapeJsString(route.entityType || (route.page === "events" ? "event" : "figure"));
      return wrapRetryScript(
        retryGuard("window.HistoryApp?.openEntity", [`    window.HistoryApp.openEntity('${id}', '${type}');`])
      );
    }

    if (route.action === "openBody" || (moduleId === "space" && route.page === "catalog" && route.param)) {
      const id = escapeJsString(route.param || "");
      return wrapRetryScript(
        retryGuard("window.SpaceApp?.openBody", [`    window.SpaceApp.openBody('${id}');`])
      );
    }

    if (route.action === "openMission" || (moduleId === "space" && route.page === "nasa" && route.param)) {
      const id = escapeJsString(route.param || "");
      return wrapRetryScript(
        retryGuard("window.SpaceApp?.openMission", [`    window.SpaceApp.openMission('${id}');`])
      );
    }

    if (route.action === "openReport" || (moduleId === "space" && route.page === "reports" && route.param)) {
      const id = escapeJsString(route.param || "");
      return wrapRetryScript(
        retryGuard("window.SpaceApp?.openReport", [`    window.SpaceApp.openReport('${id}');`])
      );
    }

    if (
      route.action === "openMachine" ||
      (moduleId === "remote-hub" && route.page === "machines" && route.param)
    ) {
      const id = escapeJsString(route.param || "");
      return wrapRetryScript(
        retryGuard("window.RemoteHubApp?.openMachine", [`    window.RemoteHubApp.openMachine('${id}');`])
      );
    }

    if (route.action === "openTerm" || (moduleId === "code-lexicon" && route.param)) {
      const id = escapeJsString(route.param || "");
      return wrapRetryScript(
        retryGuard("window.LexiconApp?.openTerm", [`    window.LexiconApp.openTerm('${id}');`])
      );
    }

    if (route.action === "startQuiz" || (moduleId === "flag-quiz" && route.page === "quiz" && route.action === "startQuiz")) {
      return wrapRetryScript(
        retryGuard("window.FlagQuizApp?.startQuiz", ["    window.FlagQuizApp.startQuiz();"])
      );
    }

    if (route.action === "startTimer" || (moduleId === "world-clock" && route.page === "timer" && route.param)) {
      const sec = escapeJsString(String(route.param || ""));
      const label = route.label ? escapeJsString(String(route.label)) : "";
      if (label) {
        return wrapRetryScript(
          retryGuard("window.ClockApp?.startTimer", [
            `    window.ClockApp.startTimer(${Number(route.param) || 0}, '${label}');`,
          ])
        );
      }
      return wrapRetryScript(
        retryGuard("window.ClockApp?.startTimer", [
          `    window.ClockApp.startTimer(${Number(route.param) || Number(sec) || 0});`,
        ])
      );
    }

    if (route.action === "pauseTimer") {
      return wrapRetryScript(
        retryGuard("window.ClockApp?.pauseTimer", ["    window.ClockApp.pauseTimer();"])
      );
    }

    if (route.action === "stopTimer") {
      return wrapRetryScript(
        retryGuard("window.ClockApp?.stopTimer", ["    window.ClockApp.stopTimer();"])
      );
    }

    if (route.action === "syncTimerFromStorage") {
      return wrapRetryScript(
        retryGuard("window.ClockApp?.syncTimerFromStorage", [
          "    window.ClockApp.syncTimerFromStorage();",
        ])
      );
    }

    if (route.action === "startPomodoro" || (moduleId === "world-clock" && route.page === "pomodoro" && route.action === "startPomodoro")) {
      const workMin = route.workMin != null ? Number(route.workMin) : null;
      if (Number.isFinite(workMin) && workMin > 0) {
        return wrapRetryScript(
          retryGuard("window.ClockApp?.startPomodoro", [
            `    window.ClockApp.startPomodoro({ workMin: ${workMin} });`,
          ])
        );
      }
      return wrapRetryScript(
        retryGuard("window.ClockApp?.startPomodoro", ["    window.ClockApp.startPomodoro();"])
      );
    }

    if (route.action === "pausePomodoro") {
      return wrapRetryScript(
        retryGuard("window.ClockApp?.pausePomodoro", ["    window.ClockApp.pausePomodoro();"])
      );
    }

    if (route.action === "startStopwatch" || (moduleId === "world-clock" && route.page === "stopwatch" && route.action === "startStopwatch")) {
      return wrapRetryScript(
        retryGuard("window.ClockApp?.startStopwatch", ["    window.ClockApp.startStopwatch();"])
      );
    }

    if (
      moduleId === "studies" &&
      (route.action === "openDocument" ||
        route.action === "openWorkspace" ||
        ((route.page === "editor" || route.page === "document" || route.page === "workspace") &&
          route.param))
    ) {
      const id = escapeJsString(route.param || "");
      if (id && (route.action === "openDocument" || route.page === "editor" || route.page === "document")) {
        return wrapRetryScript(
          retryGuard("window.StudiesApp?.openDocument", [`    window.StudiesApp.openDocument('${id}');`])
        );
      }
      return wrapRetryScript(
        retryGuard("window.StudiesApp?.goHome", [`    window.StudiesApp.goHome();`])
      );
    }

    if (route.action === "openDocument" || (moduleId === "contracts" && route.page === "document" && route.param)) {
      const id = escapeJsString(route.param);
      return wrapRetryScript(
        retryGuard("window.ContractsApp?.openDocument", [`    window.ContractsApp.openDocument('${id}');`])
      );
    }

    if (route.action === "openTranslate" || (moduleId === "translate" && route.page === "translate" && route.param)) {
      const text = escapeJsString(route.param);
      const from = route.from ? escapeJsString(route.from) : "";
      const to = route.to ? escapeJsString(route.to) : "";
      if (from || to) {
        return wrapRetryScript(
          retryGuard("window.TranslateApp?.openTranslate", [
            `    window.TranslateApp.openTranslate({ source: '${text}', from: '${from || "auto"}', to: '${to || "en"}' });`,
          ])
        );
      }
      return wrapRetryScript(
        retryGuard("window.TranslateApp?.openTranslate", [
          `    window.TranslateApp.openTranslate({ source: '${text}' });`,
        ])
      );
    }

    if (route.action === "openEditor" || (moduleId === "contracts" && route.page === "editor")) {
      if (route.templateId) {
        const tid = escapeJsString(route.templateId);
        return wrapRetryScript(
          retryGuard("window.ContractsApp?.openEditor", [
            `    window.ContractsApp.openEditor(null, '${tid}');`,
          ])
        );
      }
      if (!route.param || String(route.param).toLowerCase() === "new") {
        return wrapRetryScript(
          retryGuard("window.ContractsApp?.openEditor", ["    window.ContractsApp.openEditor(null);"])
        );
      }
      const id = escapeJsString(route.param);
      return wrapRetryScript(
        retryGuard("window.ContractsApp?.openEditor", [`    window.ContractsApp.openEditor('${id}');`])
      );
    }

    if (route.action === "openDeck" || (moduleId === "study-deck" && route.page === "deck" && route.param)) {
      const id = escapeJsString(route.param || "");
      return wrapRetryScript(
        retryGuard("window.StudyDeckApp?.openDeck", [`    window.StudyDeckApp.openDeck('${id}');`])
      );
    }

    if (
      route.action === "openContact" ||
      (moduleId === "contacts" && (route.page === "browse" || route.page === "contact") && route.param)
    ) {
      const id = escapeJsString(route.param || "");
      return wrapRetryScript(
        retryGuard("window.ContactsApp?.openContact", [
          "    window.ContactsApp.setPage('browse');",
          `    window.ContactsApp.openContact('${id}');`,
        ])
      );
    }

    if (
      route.action === "openNote" ||
      (moduleId === "notes" &&
        (route.page === "all" || route.page === "note" || route.page === "browse") &&
        route.param)
    ) {
      const id = escapeJsString(route.param || route.noteId || "");
      return wrapRetryScript(
        retryGuard("window.NotesApp?.openNote", [
          "    window.NotesApp.setPage('all');",
          `    window.NotesApp.openNote('${id}');`,
        ])
      );
    }

    if (
      route.action === "openTask" ||
      (moduleId === "tasks" &&
        (route.page === "all" || route.page === "inbox" || route.page === "task") &&
        route.param)
    ) {
      const id = escapeJsString(route.param || route.itemId || route.taskId || "");
      return wrapRetryScript(
        retryGuard("window.TasksApp?.openTask", [
          "    window.TasksApp.setPage('all');",
          `    window.TasksApp.openTask('${id}');`,
        ])
      );
    }

    if (
      route.action === "openProject" ||
      (moduleId === "builds" && (route.page === "browse" || route.page === "project") && route.param)
    ) {
      const id = escapeJsString(route.param || "");
      return wrapRetryScript(
        retryGuard("window.BuildsApp?.openProject", [`    window.BuildsApp.openProject('${id}');`])
      );
    }

    if (moduleId === "files" && route.path) {
      const p = escapeJsString(route.path);
      return wrapRetryScript(
        retryGuard("window.FilesApp?.openPath", [`    window.FilesApp.openPath('${p}');`])
      );
    }

    if (moduleId === "pulse") {
      const page = escapeJsString(route.page || "directory");
      const target = escapeJsString(route.moduleId || route.target || "");
      const lines = [`    window.PulseApp.applyRoute({ page: '${page}'${target ? `, moduleId: '${target}', target: '${target}'` : ""} });`];
      return wrapRetryScript(retryGuard("window.PulseApp?.applyRoute", lines));
    }

    if (moduleId === "parts") {
      const page = escapeJsString(route.page || "explore");
      const id = escapeJsString(route.id || route.part || route.param || "");
      const app = escapeJsString(route.app || "");
      const lines = [
        `    window.PartsApp.applyRoute({ page: '${page}'${id ? `, id: '${id}', part: '${id}'` : ""}${
          app ? `, app: '${app}'` : ""
        } });`,
      ];
      return wrapRetryScript(retryGuard("window.PartsApp?.applyRoute", lines));
    }

    if (moduleId === "permissions") {
      const page = escapeJsString(route.page || "overview");
      return wrapRetryScript(
        retryGuard("window.PermissionsApp?.applyRoute", [
          `    window.PermissionsApp.applyRoute({ page: '${page}' });`,
        ])
      );
    }

    if (moduleId === "msl-protocol") {
      const page = escapeJsString(route.page || "caps");
      return wrapRetryScript(
        retryGuard("window.MslApp?.applyRoute", [
          `    window.MslApp.applyRoute({ page: '${page}' });`,
        ])
      );
    }

    if (moduleId === "jobs") {
      const page = escapeJsString(route.page || "queue");
      return wrapRetryScript(
        retryGuard("window.JobsApp?.applyRoute", [
          `    window.JobsApp.applyRoute({ page: '${page}' });`,
        ])
      );
    }

    if (moduleId === "scheduler") {
      const page = escapeJsString(route.page || "active");
      return wrapRetryScript(
        retryGuard("window.SchedulerApp?.applyRoute", [
          `    window.SchedulerApp.applyRoute({ page: '${page}' });`,
        ])
      );
    }

    if (moduleId === "resolve") {
      const page = escapeJsString(route.page || "inbox");
      return wrapRetryScript(
        retryGuard("window.ResolveApp?.setPage", [`    window.ResolveApp.setPage('${page}');`])
      );
    }

    if (moduleId === "updates") {
      const page = escapeJsString(route.page || "pending");
      return wrapRetryScript(
        retryGuard("window.UpdatesApp?.setPage", [`    window.UpdatesApp.setPage('${page}');`])
      );
    }

    if (moduleId === "network") {
      const page = escapeJsString(route.page || "status");
      return wrapRetryScript(
        retryGuard("window.NetworkApp?.setPage", [`    window.NetworkApp.setPage('${page}');`])
      );
    }

    if (moduleId === "apps-info" || moduleId === "info") {
      const page = escapeJsString(route.page || "catalog");
      const id = escapeJsString(route.id || "");
      return wrapRetryScript(
        retryGuard("window.InfoApp?.applyRoute", [
          `    window.InfoApp.applyRoute({ page: '${page}'${id ? `, id: '${id}'` : ""} });`,
        ])
      );
    }

    if (moduleId === "backup") {
      const page = escapeJsString(route.page || "status");
      return wrapRetryScript(
        retryGuard("window.BackupApp?.setPage", [`    window.BackupApp.setPage('${page}');`])
      );
    }

    if (moduleId === "storage") {
      const page = escapeJsString(route.page || "status");
      return wrapRetryScript(
        retryGuard("window.StorageApp?.setPage", [`    window.StorageApp.setPage('${page}');`])
      );
    }

    if (moduleId === "themes") {
      const page = escapeJsString(route.page || "apps");
      const appId = escapeJsString(route.appId || route.id || "");
      return wrapRetryScript(
        retryGuard("window.ThemesApp?.applyRoute", [
          `    window.ThemesApp.applyRoute({ page: '${page}'${appId ? `, appId: '${appId}'` : ""} });`,
        ])
      );
    }

    if (
      route.action === "openEntry" ||
      (moduleId === "profiles" && (route.page === "vault" || route.page === "entry") && route.param)
    ) {
      const id = escapeJsString(route.param || "");
      if (moduleId === "coupons") {
        return wrapRetryScript(
          retryGuard("window.CouponsApp?.openEntry", [`    window.CouponsApp.openEntry('${id}');`])
        );
      }
      return wrapRetryScript(
        retryGuard("window.ProfilesApp?.openEntry", [
          "    window.ProfilesApp.setActivePage('vault');",
          `    window.ProfilesApp.openEntry('${id}');`,
        ])
      );
    }

    if (
      route.action === "openEvent" ||
      (moduleId === "drift" && (route.page === "activity" || route.page === "event") && route.param)
    ) {
      const id = escapeJsString(route.param || "");
      return wrapRetryScript(
        retryGuard("window.DriftApp?.openEvent", [`    window.DriftApp.openEvent('${id}');`])
      );
    }

    if (
      route.action === "openAndRunScript" ||
      route.action === "openScript" ||
      (moduleId === "scripts" && route.param)
    ) {
      const name = escapeJsString(route.param || "");
      if (route.action === "openScript") {
        return wrapRetryScript(
          retryGuard("window.ScriptsApp?.openScript", [`    window.ScriptsApp.openScript('${name}');`])
        );
      }
      return wrapRetryScript(
        retryGuard("window.ScriptsApp?.openAndRun", [
          `    window.ScriptsApp.openAndRun('${name}');`,
        ])
      );
    }

    if (moduleId === "docs" && route.action === "search") {
      const q = escapeJsString(route.param || "");
      return wrapRetryScript(
        retryGuard("window.DocsApp?.search", [`    window.DocsApp.search('${q}');`])
      );
    }

    if (moduleId === "docs" && route.action === "bookmarks") {
      return wrapRetryScript(
        retryGuard("window.DocsApp?.showBookmarks", ["    window.DocsApp.showBookmarks();"])
      );
    }

    if (moduleId === "model-flow" && (route.page || route.flow || route.task)) {
      const payload = {
        page: route.page || "studio",
      };
      if (route.task) payload.task = route.task;
      if (route.flow) payload.flow = route.flow;
      const json = JSON.stringify(payload).replace(/</g, "\\u003c");
      return wrapRetryScript(
        retryGuard("window.ModelFlowApp && typeof window.ModelFlowApp.setPage === 'function'", [
          `    window.ModelFlowApp.setPage(${json});`,
        ])
      );
    }

    if (moduleId === "notes" && (route.page || route.noteId || route.q || route.param)) {
      const payload = { page: route.page || "all" };
      if (route.noteId) payload.noteId = route.noteId;
      if (route.param && !payload.noteId) payload.noteId = route.param;
      if (route.q) payload.q = route.q;
      const json = JSON.stringify(payload).replace(/</g, "\\u003c");
      return wrapRetryScript(
        retryGuard("window.NotesApp && typeof window.NotesApp.refresh === 'function'", [
          `    window.NotesApp.refresh(${json});`,
        ])
      );
    }

    if (
      moduleId === "tasks" &&
      (route.page || route.itemId || route.taskId || route.projectId || route.q || route.param)
    ) {
      const payload = { page: route.page || "inbox" };
      if (route.itemId) payload.itemId = route.itemId;
      if (route.taskId) payload.itemId = route.taskId;
      if (route.param && !payload.itemId) payload.itemId = route.param;
      if (route.projectId) payload.projectId = route.projectId;
      if (route.listId) payload.listId = route.listId;
      if (route.q) payload.q = route.q;
      const json = JSON.stringify(payload).replace(/</g, "\\u003c");
      return wrapRetryScript(
        retryGuard("window.TasksApp && typeof window.TasksApp.refresh === 'function'", [
          `    window.TasksApp.refresh(${json});`,
        ])
      );
    }

    if (route.page) {
      const page = escapeJsString(route.page);
      const app = escapeJsString(def.app);
      if (moduleId === "mail") {
        return wrapRetryScript(
          retryGuard("window.MySpaceConnectHub?.show", ["    window.MySpaceConnectHub.show();"])
        );
      }
      const method = escapeJsString(def.method || "setPage");
      return wrapRetryScript(
        retryGuard(`window['${app}'] && typeof window['${app}']['${method}'] === 'function'`, [
          `    window['${app}']['${method}']('${page}');`,
        ])
      );
    }

    return null;
  }

  function listRunExamples() {
    const out = [];
    for (const def of Object.values(ROUTE_REGISTRY)) {
      if (def.examples?.length) out.push(...def.examples.slice(0, 2));
    }
    out.push(
      "clock(timer 25m)",
      "today(add Buy milk)",
      "stocks(watch AAPL)",
      "builds(list)",
      "vault(list)",
      "drift(scan)",
      "drift(list today)",
      "decks(list)",
      "studydeck(add Biology | front | back)",
      "wait 5s",
      "macro morning = run builds; run drift(insights)"
    );
    return out;
  }

  function formatHelp() {
    const wired = Object.entries(ROUTE_REGISTRY).filter(([, def]) => def.commands);
    const names = wired.map(([id, def]) => (def.aliases && def.aliases[0]) || id);
    const samples = wired
      .flatMap(([, def]) => (def.examples || []).slice(0, 1))
      .filter(Boolean)
      .slice(0, 16);
    return [
      "Run: run <app> · <app> · <app>(page|verb args)",
      `Command apps (${wired.length}): ${names.join(" · ")}`,
      samples.length ? `Try: ${samples.join(" · ")}` : null,
      "Wait: wait 5s · wait until 14:30",
      "Chain: cmd; cmd (stop on error) · cmd | cmd (keep going)",
      "Actions: close · focus · desktop · pin · reveal · settings",
      "Flow: if · loop · while · for · alias · macro · when · let · fn",
      "Discover: help · help lang · help <app> · check routes <app> · check running · docs(search …)",
      "Data: backup(export) · pack(open file.space) · pack(export script morning)",
      "Shortcuts: a=close all · b<app>=close",
    ]
      .filter(Boolean)
      .join(" · ");
  }

  function formatBackupCommandHelp() {
    return [
      "backup(open) · backup(status) · backup(history) · backup(about)",
      "backup(export) · backup(import) · backup(path)",
      "backup(help)",
    ].join(" · ");
  }

  async function executeBackupCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();
    if (!window.mySpace?.backup) {
      return { ok: false, error: "Backup API unavailable" };
    }
    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatBackupCommandHelp() };
    }

    const verb = lower.split(/\s+/)[0];

    if (["panel", "open", "home"].includes(verb)) {
      await openBackup(ctx || {}, { page: "status" });
      return { ok: true, message: "Opened Backup · status" };
    }
    if (verb === "history") {
      await openBackup(ctx || {}, { page: "history" });
      return { ok: true, message: "Opened Backup · history" };
    }
    if (verb === "about") {
      await openBackup(ctx || {}, { page: "about" });
      return { ok: true, message: "Opened Backup · about" };
    }

    let res;
    if (verb === "export") res = await window.mySpace.backup.export();
    else if (verb === "import" || verb === "restore") res = await window.mySpace.backup.import();
    else if (verb === "path" || verb === "folder" || verb === "reveal") {
      res = await window.mySpace.backup.path();
    } else if (verb === "status") res = await window.mySpace.backup.status();
    else if (verb === "list") {
      res = await window.mySpace.backup.history?.({});
      if (res?.ok) {
        const items = res.entries || [];
        if (!items.length) return { ok: true, message: "No backup history yet" };
        const lines = items
          .slice(0, 10)
          .map((e) => `${e.kind} · ${e.at || "—"} · ${e.path || ""}`);
        return { ok: true, message: lines.join("\n"), data: res };
      }
    } else {
      return { ok: false, error: `Unknown backup verb. ${formatBackupCommandHelp()}` };
    }

    if (res?.cancelled) return { ok: true, message: "Cancelled" };
    if (res?.ok) {
      if (verb === "status") {
        const bits = [
          res.path ? `path ${res.path}` : null,
          res.sizeLabel ? `size ${res.sizeLabel}` : null,
          res.lastExportAt ? `last export ${res.lastExportAt}` : "no export yet",
          res.lastRestoreAt ? `last restore ${res.lastRestoreAt}` : null,
          res.pendingRestore ? "pending restore" : null,
        ].filter(Boolean);
        return { ok: true, message: bits.join(" · "), data: res };
      }
      return { ok: true, message: res.message || `backup(${verb}) ok`, data: res };
    }
    return { ok: false, error: res?.error || `backup(${verb}) failed` };
  }

  function formatStorageCommandHelp() {
    return [
      "storage(open) · storage(status) · storage(apps) · storage(cleanup)",
      "storage(large C:) · storage(drives) · storage(path) · storage(settings)",
      "storage(cancel) · storage(about) · storage(help)",
    ].join(" · ");
  }

  async function executeStorageCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();

    if (!window.mySpace?.storage) {
      return { ok: false, error: "Storage shell API unavailable" };
    }

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatStorageCommandHelp() };
    }

    const verb = lower.split(/\s+/)[0];

    if (["panel", "open", "home"].includes(verb)) {
      await openStorage(ctx || {}, { page: "status" });
      return { ok: true, message: "Opened Storage · status" };
    }
    if (verb === "apps") {
      await openStorage(ctx || {}, { page: "apps" });
      return { ok: true, message: "Opened Storage · apps" };
    }
    if (verb === "cleanup" || verb === "clean") {
      await openStorage(ctx || {}, { page: "cleanup" });
      const res = await window.mySpace.storage.cleanup();
      const n = (res?.candidates || []).length;
      return {
        ok: true,
        message: n
          ? `${n} safe item${n === 1 ? "" : "s"} · ${res.totalLabel || ""} reclaimable`
          : "Nothing to clean in userData",
      };
    }
    if (verb === "about") {
      await openStorage(ctx || {}, { page: "about" });
      return { ok: true, message: "Opened Storage · about" };
    }
    if (verb === "large" || verb === "large-files") {
      const drive = t.replace(/^(large-files|large)\s*/i, "").trim() || "C:\\";
      await openStorage(ctx || {}, { page: "large-files" });
      const res = await window.mySpace.storage.largeFiles({ path: drive.endsWith("\\") ? drive : `${drive}\\` });
      if (!res?.ok) return { ok: false, error: res?.error || "Scan failed" };
      const files = res.largeFiles || [];
      if (!files.length) return { ok: true, message: `No large files on ${drive}` };
      const lines = files.slice(0, 8).map((f) => `${f.sizeLabel} · ${f.name}`);
      return { ok: true, message: `Top on ${drive}: ${lines.join(" · ")}` };
    }
    if (verb === "drives" || verb === "disks") {
      const res = await window.mySpace.storage.drives();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not read drives" };
      const drives = res.drives || [];
      if (!drives.length) return { ok: true, message: "No drives found" };
      return {
        ok: true,
        message: drives.map((d) => `${d.id} ${d.usagePercent}% · ${d.freeLabel} free`).join(" · "),
      };
    }
    if (verb === "cancel") {
      await window.mySpace.storage.cancel();
      return { ok: true, message: "Scan cancel requested" };
    }
    if (verb === "settings" || verb === "windows") {
      const res = await window.mySpace.storage.openSettings();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not open settings" };
      return { ok: true, message: "Opened Windows Storage settings" };
    }
    if (verb === "path" || verb === "folder") {
      const res = await window.mySpace.storage.path();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not open folder" };
      return { ok: true, message: res.path ? `Opened ${res.path}` : "Opened userData folder" };
    }

    if (verb === "status") {
      const res = await window.mySpace.storage.status();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not read status" };
      const ud = res.userData || {};
      const primary = res.primaryDrive;
      const bits = [
        ud.sizeLabel ? `userData ${ud.sizeLabel}` : null,
        ud.path ? `path ${ud.path}` : null,
        primary ? `${primary.id} ${primary.usagePercent}% used · ${primary.freeLabel} free` : null,
        res.driveSummary?.freeLabel ? `${res.driveSummary.freeLabel} free across drives` : null,
      ].filter(Boolean);
      return { ok: true, message: bits.join(" · "), data: res };
    }

    if (verb === "list" || verb === "ls") {
      const rest = t.replace(/^(list|ls)\s*/i, "").trim().toLowerCase();
      if (rest === "apps" || !rest) {
        const res = await window.mySpace.storage.apps();
        const apps = res?.apps || [];
        if (!apps.length) return { ok: true, message: "No app data" };
        const lines = apps.slice(0, 12).map((a) => `${a.name || a.appId} ${a.sizeLabel}`);
        return { ok: true, message: lines.join(" · ") };
      }
    }

    return { ok: false, error: `Unknown storage verb. ${formatStorageCommandHelp()}` };
  }

  function formatThemesCommandHelp() {
    return [
      "themes(open) · themes(apps) · themes(about)",
      "themes(notes light) · themes(tasks soft) · themes(builds outline)",
      "themes(clock dark) · themes(reset studies) · themes(list)",
      "themes(help)",
    ].join(" · ");
  }

  function resolveThemesAppRef(ref) {
    const r = String(ref || "").trim().toLowerCase();
    if (!r) return null;
    const aliases = {
      studies: "studies",
      study: "studies",
      clock: "world-clock",
      "world-clock": "world-clock",
      worldclock: "world-clock",
      notes: "notes",
      note: "notes",
      tasks: "tasks",
      task: "tasks",
      gtd: "tasks",
      contacts: "contacts",
      contact: "contacts",
      translate: "translate",
      coupons: "coupons",
      coupon: "coupons",
      profiles: "profiles",
      vault: "profiles",
      history: "history",
      geography: "geography",
      geo: "geography",
      builds: "builds",
      build: "builds",
      stocks: "stocks",
      stock: "stocks",
      contracts: "contracts",
      contract: "contracts",
      space: "space",
      "code-lexicon": "code-lexicon",
      lexicon: "code-lexicon",
      code: "code-lexicon",
      drift: "drift",
      "remote-hub": "remote-hub",
      remote: "remote-hub",
      hub: "remote-hub",
      "icon-library": "icon-library",
      icons: "icon-library",
      "study-deck": "study-deck",
      deck: "study-deck",
      "pi-digits": "pi-digits",
      pi: "pi-digits",
      "day-planner": "day-planner",
      today: "day-planner",
      planner: "day-planner",
      docs: "docs",
      doc: "docs",
      handbook: "docs",
      "flag-quiz": "flag-quiz",
      flags: "flag-quiz",
      quiz: "flag-quiz",
      games: "flag-quiz",
      learning: "flag-quiz",
      scripts: "scripts",
      script: "scripts",
      chat: "chat",
      mind: "chat",
      "os-bridge": "os-bridge",
      bridge: "os-bridge",
      "system-info": "system-info",
      sysinfo: "system-info",
      themes: "themes",
      theme: "themes",
      "model-flow": "model-flow",
      modelflow: "model-flow",
      "shell-console": "shell-console",
      shell: "shell-console",
      console: "shell-console",
      files: "files",
      file: "files",
      pulse: "pulse",
      mail: "mail",
      connect: "mail",
      jobs: "jobs",
      job: "jobs",
      scheduler: "scheduler",
      schedule: "scheduler",
      cron: "scheduler",
      host: "host",
      app: "app",
      myapp: "app",
      resolve: "resolve",
      updates: "updates",
      update: "updates",
      network: "network",
      net: "network",
      backup: "backup",
      storage: "storage",
      permissions: "permissions",
      perms: "permissions",
      parts: "parts",
      "msl-protocol": "msl-protocol",
      msl: "msl-protocol",
      "apps-info": "apps-info",
      info: "apps-info",
    };
    if (aliases[r]) return aliases[r];
    return r;
  }

  async function executeThemesCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();

    if (!window.mySpace?.themes) {
      return { ok: false, error: "Themes shell API unavailable" };
    }

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatThemesCommandHelp() };
    }

    const parts = t.split(/\s+/);
    const verb = parts[0].toLowerCase();

    if (["panel", "open", "home", "apps"].includes(verb)) {
      await openThemes(ctx || {}, { page: "apps" });
      return { ok: true, message: "Opened Themes" };
    }
    if (verb === "about") {
      await openThemes(ctx || {}, { page: "about" });
      return { ok: true, message: "Opened Themes · about" };
    }
    if (verb === "list" || verb === "ls") {
      const res = await window.mySpace.themes.catalog();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not list" };
      const lines = (res.apps || []).map((a) => {
        const th = a.theme || {};
        const label = th.isDefault ? "default" : `${th.mode}/${th.buttons}`;
        return `${a.name} (${label})`;
      });
      return { ok: true, message: lines.join(" · ") || "No themed apps" };
    }
    if (verb === "reset") {
      const appId = resolveThemesAppRef(parts.slice(1).join(" "));
      if (!appId) return { ok: false, error: "Usage: themes(reset studies)" };
      const res = await window.mySpace.themes.reset({ appId });
      if (!res?.ok) return { ok: false, error: res?.error || "Reset failed" };
      await openThemes(ctx || {}, { page: "apps", appId });
      return { ok: true, message: `Reset ${appId} to default` };
    }

    const appId = resolveThemesAppRef(verb);
    if (appId) {
      const rest = parts.slice(1).map((p) => p.toLowerCase());
      const modes = new Set(["dark", "light"]);
      const buttons = new Set(["default", "soft", "solid", "outline"]);
      let mode;
      let buttonStyle;
      for (const token of rest) {
        if (modes.has(token)) mode = token;
        else if (buttons.has(token)) buttonStyle = token;
      }
      if (mode || buttonStyle) {
        const cur = await window.mySpace.themes.get({ appId });
        const payload = {
          appId,
          mode: mode || cur?.theme?.mode || "dark",
          buttons: buttonStyle || cur?.theme?.buttons || "default",
        };
        const res = await window.mySpace.themes.set(payload);
        if (!res?.ok) return { ok: false, error: res?.error || "Could not set theme" };
        await openThemes(ctx || {}, { page: "apps", appId });
        return {
          ok: true,
          message: `${appId} → ${res.theme.mode} · ${res.theme.buttons}`,
        };
      }
      await openThemes(ctx || {}, { page: "apps", appId });
      return { ok: true, message: `Opened Themes · ${appId}` };
    }

    return { ok: false, error: `Unknown themes verb. ${formatThemesCommandHelp()}` };
  }

  function formatPackCommandHelp() {
    return [
      "pack(open path\\file.space): import a My Space document and open it",
      "pack(inspect file.space): show kind/title without importing",
      "pack(pick): choose a .space file",
      "pack(export script morning) · pack(export flow Title) · pack(export note Title) · pack(export deck Name)",
      "pack(build todo): zip user-built app for share",
      "Also: open file.space · Scripts/Flow Export .space · docs(open space-files)",
    ].join(" · ");
  }

  function parsePackCall(line) {
    const trimmed = String(line || "").trim();
    const m = trimmed.match(/^(pack|spacefile|dotspace|mysfile)\s*\((.*)\)\s*$/i);
    if (!m) return null;
    return m[2].trim();
  }

  function extractSpaceFilePath(text) {
    let t = String(text || "").trim();
    if (/^open\s+/i.test(t)) t = t.replace(/^open\s+/i, "").trim();
    t = t.replace(/^["']+|["']+$/g, "");
    if (!/\.space$/i.test(t)) return null;
    if (/\s/.test(t) && !/[\\/]/.test(t) && !/^[a-zA-Z]:/.test(t)) return null;
    return t;
  }

  async function executePackCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();
    if (!window.mySpace?.spaceFile) {
      return { ok: false, error: "Space file API unavailable" };
    }
    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatPackCommandHelp() };
    }

    if (lower === "pick" || lower === "open") {
      const res = await window.mySpace.spaceFile.pick();
      if (res?.cancelled) return { ok: true, message: "Cancelled" };
      if (!res?.ok) return { ok: false, error: res?.error || "Could not open .space file" };
      await launchImportedSpaceFile(res, ctx);
      return { ok: true, message: res.message || `Imported ${res.kind} “${res.title}”` };
    }

    if (/^inspect(\s|$)/i.test(t)) {
      const filePath = t.replace(/^inspect\s*/i, "").trim().replace(/^["']+|["']+$/g, "");
      if (!filePath) return { ok: false, error: "Usage: pack(inspect file.space)" };
      const res = await window.mySpace.spaceFile.inspect(filePath);
      if (!res?.ok) return { ok: false, error: res?.error || "Could not inspect file" };
      return {
        ok: true,
        message: `${res.kind} · ${res.title}${res.exportedAt ? ` · exported ${res.exportedAt}` : ""} · ${res.path}`,
      };
    }

    if (/^open\s+/i.test(t)) {
      const filePath = t.replace(/^open\s+/i, "").trim().replace(/^["']+|["']+$/g, "");
      if (!filePath) return { ok: false, error: "Usage: pack(open file.space)" };
      const res = await window.mySpace.spaceFile.open(filePath);
      if (!res?.ok) return { ok: false, error: res?.error || "Could not import .space file" };
      await launchImportedSpaceFile(res, ctx);
      return { ok: true, message: res.message || `Imported ${res.kind} “${res.title}”` };
    }

    const exp = t.match(/^export\s+(script|flow|note|deck)\s+(.+)$/i);
    if (exp) {
      const res = await window.mySpace.spaceFile.export({
        kind: exp[1].toLowerCase(),
        ref: exp[2].trim(),
      });
      if (res?.cancelled) return { ok: true, message: "Cancelled" };
      if (!res?.ok) return { ok: false, error: res?.error || "Export failed" };
      return { ok: true, message: res.message || `Exported to ${res.path}` };
    }

    if (/^export(\s|$)/i.test(t)) {
      return { ok: false, error: "Usage: pack(export script|flow|note|deck Name)" };
    }

    if (/^build(\s|$)/i.test(t)) {
      const id = t.replace(/^build\s*/i, "").trim();
      if (!id) return { ok: false, error: "Usage: pack(build <app-id>)" };
      if (!window.mySpace?.appBuilder?.build) {
        return { ok: false, error: "App build API unavailable" };
      }
      const res = await window.mySpace.appBuilder.build({ id });
      if (!res?.ok) return { ok: false, error: res?.error || "Pack build failed" };
      return { ok: true, message: res.message || `Built ${res.path}` };
    }

    const asPath = extractSpaceFilePath(t);
    if (asPath) {
      return executePackCommands(`open ${asPath}`, ctx);
    }

    return { ok: false, error: `Unknown pack verb. ${formatPackCommandHelp()}` };
  }

  async function launchImportedSpaceFile(res, ctx) {
    if (!res?.ok || !res.launch) return;
    const apps = ctx?.getApps?.() || window.MySpaceConfig?.getApps?.() || [];
    const app =
      apps.find((a) => a.id === res.launch.appId) ||
      apps.find((a) => a.module === res.launch.module);
    if (!app) return;
    await ctx?.launchApp?.(app, { route: res.launch.route || {} });
  }

  function parseBackupCall(line) {
    const trimmed = String(line || "").trim();
    const m = trimmed.match(/^backup\s*\((.*)\)\s*$/i);
    if (!m) return null;
    if (m[1].includes("(") || m[1].includes(")")) return null;
    return m[1].trim();
  }

  function parseStorageCall(line) {
    const trimmed = String(line || "").trim();
    const m = trimmed.match(/^storage\s*\((.*)\)\s*$/i);
    if (!m) return null;
    if (m[1].includes("(") || m[1].includes(")")) return null;
    return m[1].trim();
  }

  function parseThemesCall(line) {
    const trimmed = String(line || "").trim();
    const m = trimmed.match(/^(themes?|appearance|colors)\s*\((.*)\)\s*$/i);
    if (!m) return null;
    if (m[2].includes("(") || m[2].includes(")")) return null;
    return m[2].trim();
  }

  function getCommandHelpForModule(moduleId) {
    switch (moduleId) {
      case "world-clock":
        return formatClockCommandHelp();
      case "day-planner":
        return formatTodayCommandHelp();
      case "stocks":
        return formatStocksCommandHelp();
      case "builds":
        return formatBuildsCommandHelp();
      case "profiles":
        return formatVaultCommandHelp();
      case "drift":
        return formatDriftCommandHelp();
      case "study-deck":
        return formatStudyDeckCommandHelp();
      case "contacts":
        return formatContactsCommandHelp();
      case "notes":
        return formatNotesCommandHelp();
      case "tasks":
        return formatTasksCommandHelp();
      case "chat":
        return formatChatCommandHelp();
      case "translate":
        return formatTranslateCommandHelp();
      case "system-info":
        return formatSysInfoCommandHelp();
      case "remote-hub":
        return formatRemoteHubCommandHelp();
      case "os-bridge":
        return formatOsBridgeCommandHelp();
      case "files":
        return formatFilesCommandHelp();
      case "studies":
        return formatStudiesCommandHelp();
      case "geography":
        return formatGeographyCommandHelp();
      case "flag-quiz":
        return formatFlagQuizCommandHelp();
      case "history":
        return formatHistoryCommandHelp();
      case "space":
        return formatSpaceCommandHelp();
      case "contracts":
        return formatContractsCommandHelp();
      case "msl-protocol":
        return formatMslCommandHelp();
      case "parts":
        return formatPartsCommandHelp();
      case "permissions":
        return formatPermissionsCommandHelp();
      case "pulse":
        return formatPulseCommandHelp();
      case "resolve":
        return formatResolveCommandHelp();
      case "updates":
        return formatUpdatesCommandHelp();
      case "network":
        return formatNetworkCommandHelp();
      case "info":
      case "apps-info":
        return formatInfoCommandHelp();
      case "backup":
        return formatBackupCommandHelp();
      case "storage":
        return formatStorageCommandHelp();
      case "themes":
        return formatThemesCommandHelp();
      case "jobs":
        return formatJobsCommandHelp();
      case "scheduler":
        return formatSchedulerCommandHelp();
      case "mind":
        return formatMindCommandHelp();
      case "code-lexicon":
        return formatLexiconCommandHelp();
      case "model-flow":
        return formatModelFlowCommandHelp();
      case "shell-console":
        return formatShellConsoleCommandHelp();
      case "docs":
        return formatDocsCommandHelp();
      case "scripts":
        return formatScriptsCommandHelp();
      case "world-maps":
        return formatMapsCommandHelp();
      default:
        return null;
    }
  }

  function formatRoutesCheck(appRef, apps = []) {
    if (!appRef) {
      return {
        ok: true,
        message: `My apps: ${Object.keys(ROUTE_REGISTRY).join(", ")}: try help stocks · check routes geography`,
      };
    }
    const moduleId = resolveModuleFromRef(appRef, apps) || String(appRef).trim().toLowerCase();
    const def = ROUTE_REGISTRY[moduleId];
    if (!def) return { ok: false, error: `No routes for: ${appRef}` };
    const lines = [`${moduleId}`];
    if (def.aliases?.length) lines.push(`aliases: ${def.aliases.join(", ")}`);
    lines.push(`pages: ${def.pages.join(", ")}`);
    if (def.views?.length) lines.push(`views: ${def.views.join(", ")}`);
    if (def.modes?.length) lines.push(`modes: ${def.modes.map((m) => `mode:${m}`).join(", ")}`);
    if (def.ticker) lines.push("bare: ticker (AAPL) · keys: symbol, mode, page");
    if (def.bare === "country") lines.push("bare: country (Togo/TG) · keys: country, page, explore, learn");
    if (def.bare === "text") lines.push("bare: text · keys: text, from, to, page");
    if (def.bare === "term") lines.push("bare: term · keys: term, page");
    if (def.deep) {
      lines.push(
        `deep: ${Object.entries(def.deep)
          .map(([page, fn]) => `${page}→${fn}`)
          .join(", ")}`
      );
    }
    if (def.examples?.length) {
      lines.push(`examples: ${def.examples.join(" · ")}`);
    }
    if (def.commands) {
      lines.push("commands: app(verb args). e.g. clock(timer 25m) · no run needed");
      const cmdHelp = getCommandHelpForModule(moduleId);
      if (cmdHelp) lines.push(cmdHelp);
    }
    lines.push("grammar: run app · app · app(page) · app(verb args) · chain with ; or |");
    return { ok: true, message: lines.join(" · ") };
  }

  function formatCheckHelp() {
    return [
      "check running · check apps · check drift",
      "check routes · check routes space · help stocks",
      "check aliases · check macros · check when",
    ].join(" · ");
  }

  function formatIfHelp() {
    return [
      "if check drift open then run drift else focus drift",
      "if check !running then run builds",
      "if check running then close all else desktop",
      "if check alias ocean then ocean",
      "if check macro work then macro work",
    ].join(" · ");
  }

  function formatLoopHelp() {
    return [
      "loop 3 then run builds",
      "while check running then close",
      "for builds drift space then run $item",
      "for ocean earth cosmos then run space($item)",
      "loop help · while help · for help",
    ].join(" · ");
  }

  function parseThenCommand(trimmed, prefix) {
    const lower = trimmed.toLowerCase();
    const prefixLower = prefix.toLowerCase();
    if (!lower.startsWith(prefixLower)) return null;
    const thenIdx = lower.indexOf(IF_THEN);
    if (thenIdx === -1) return null;
    const head = trimmed.slice(prefix.length, thenIdx).trim();
    const body = trimmed.slice(thenIdx + IF_THEN.length).trim();
    if (!head || !body) return null;
    return { head, body };
  }

  function splitForItems(head) {
    return head
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const MAX_FN_DEPTH = 12;
  const IDENT_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
  const RESERVED_FN_NAMES = new Set([
    "help",
    "check",
    "run",
    "open",
    "goto",
    "close",
    "focus",
    "pin",
    "unpin",
    "reveal",
    "alias",
    "macro",
    "when",
    "if",
    "loop",
    "repeat",
    "while",
    "for",
    "let",
    "unset",
    "vars",
    "fn",
    "fns",
    "wait",
    "desktop",
    "settings",
    "timer",
    "pomodoro",
    "stopwatch",
    "backup",
    "storage",
    "themes",
    "today",
    "clock",
    "stocks",
    "sys",
    "sysinfo",
    "drift",
    "builds",
    "vault",
    "docs",
    "scripts",
    "maps",
    "remote",
    "bridge",
    "osbridge",
    "contacts",
    "translate",
    "geo",
    "geography",
    "contracts",
    "lexicon",
    "space",
    "console",
    "flow",
    "msl",
    "jobs",
    "scheduler",
    "mind",
    "chat",
    "notes",
  ]);

  function createScope(parent = null) {
    return { parent: parent || null, vars: Object.create(null), fns: Object.create(null) };
  }

  const sessionScope = createScope(null);

  function lookupVar(scope, name) {
    const key = String(name || "");
    let s = scope;
    while (s) {
      if (Object.prototype.hasOwnProperty.call(s.vars, key)) return s.vars[key];
      s = s.parent;
    }
    return undefined;
  }

  function lookupFn(scope, name) {
    const key = String(name || "").toLowerCase();
    let s = scope;
    while (s) {
      if (Object.prototype.hasOwnProperty.call(s.fns, key)) return s.fns[key];
      s = s.parent;
    }
    return undefined;
  }

  function setVar(scope, name, entry) {
    scope.vars[String(name)] = entry;
  }

  function makeVarEntry(resultOrValue) {
    if (resultOrValue && typeof resultOrValue === "object" && ("ok" in resultOrValue || "message" in resultOrValue || "data" in resultOrValue)) {
      const ok = resultOrValue.ok !== false;
      const message = String(resultOrValue.message || resultOrValue.error || "");
      const data =
        resultOrValue.data !== undefined
          ? resultOrValue.data
          : message;
      return {
        ok,
        message,
        data,
        text: valueToText(data !== undefined && data !== "" ? data : message),
      };
    }
    return {
      ok: true,
      message: valueToText(resultOrValue),
      data: resultOrValue,
      text: valueToText(resultOrValue),
    };
  }

  function valueToText(v) {
    if (v == null) return "";
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
    if (Array.isArray(v)) {
      return v
        .map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x)))
        .join(", ");
    }
    if (typeof v === "object") {
      if (typeof v.message === "string") return v.message;
      if (typeof v.text === "string") return v.text;
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    }
    return String(v);
  }

  function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function substituteVars(template, scope) {
    let out = String(template ?? "");
    out = out.replace(/\$\$/g, "\u0000");

    out = out.replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)\.(ok|text|message|data)\b/g, (match, name, field) => {
      const entry = lookupVar(scope, name);
      if (!entry) return match;
      if (field === "ok") return entry.ok ? "true" : "false";
      if (field === "text") return entry.text || "";
      if (field === "message") return entry.message || "";
      if (field === "data") return valueToText(entry.data);
      return match;
    });

    out = out.replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)\b/g, (match, name) => {
      const entry = lookupVar(scope, name);
      if (!entry) return match;
      return entry.text || "";
    });

    return out.replace(/\u0000/g, "$");
  }

  function substituteLoopVars(template, item, index) {
    return String(template || "")
      .replace(/\$item\b/gi, item)
      .replace(/\$index\b/gi, String(index))
      .replace(/\$1\b/g, item);
  }

  function parseLiteralRhs(raw) {
    const t = String(raw || "").trim();
    if (!t) return { kind: "empty" };
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
      return { kind: "literal", value: t.slice(1, -1) };
    }
    if (/^true$/i.test(t)) return { kind: "literal", value: true };
    if (/^false$/i.test(t)) return { kind: "literal", value: false };
    if (/^null$/i.test(t)) return { kind: "literal", value: null };
    if (/^-?\d+(\.\d+)?$/.test(t)) return { kind: "literal", value: Number(t) };
    return { kind: "command", value: t };
  }

  function parseArgList(inner) {
    const src = String(inner || "");
    if (!src.trim()) return [];
    const args = [];
    let cur = "";
    let quote = null;
    for (let i = 0; i < src.length; i += 1) {
      const ch = src[i];
      if (quote) {
        if (ch === quote) quote = null;
        else cur += ch;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        continue;
      }
      if (ch === ",") {
        args.push(cur.trim());
        cur = "";
        continue;
      }
      cur += ch;
    }
    args.push(cur.trim());
    return args;
  }

  function parseFnParams(paramStr) {
    return String(paramStr || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((p) => {
        if (!IDENT_RE.test(p)) return null;
        return p;
      });
  }

  function countBracesOutsideQuotes(text) {
    let depth = 0;
    let quote = null;
    for (let i = 0; i < String(text || "").length; i += 1) {
      const ch = text[i];
      if ((ch === '"' || ch === "'") && !quote) {
        quote = ch;
        continue;
      }
      if (quote) {
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === "{") depth += 1;
      else if (ch === "}") depth -= 1;
    }
    return depth;
  }

  function extractBalancedBlock(text, openIdx) {
    let depth = 0;
    let quote = null;
    for (let i = openIdx; i < text.length; i += 1) {
      const ch = text[i];
      if ((ch === '"' || ch === "'") && !quote) {
        quote = ch;
        continue;
      }
      if (quote) {
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) return { body: text.slice(openIdx + 1, i), end: i };
      }
    }
    return null;
  }

  function parseProgram(body) {
    const rawLines = String(body || "").split(/\r?\n/);
    const stmts = [];
    let i = 0;
    while (i < rawLines.length) {
      const trimmed = rawLines[i].trim();
      if (!trimmed || trimmed.startsWith("#")) {
        i += 1;
        continue;
      }

      if (/^fn\s+/i.test(trimmed) && trimmed.includes("{")) {
        let collected = trimmed;
        let j = i;
        const openAt = collected.indexOf("{");
        if (openAt < 0) {
          return { ok: false, error: `Function missing "{": ${trimmed}` };
        }
        let depth = countBracesOutsideQuotes(collected);
        while (depth > 0) {
          j += 1;
          if (j >= rawLines.length) {
            return { ok: false, error: `Unclosed function body near: ${trimmed}` };
          }
          collected += `\n${rawLines[j]}`;
          depth = countBracesOutsideQuotes(collected);
        }
        const fnMatch = collected.match(/^fn\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*\{([\s\S]*)\}\s*$/i);
        if (!fnMatch) {
          return { ok: false, error: `Invalid function syntax near line ${i + 1}` };
        }
        const params = parseFnParams(fnMatch[2]);
        if (params.some((p) => !p)) {
          return { ok: false, error: `Invalid function parameters: ${fnMatch[2]}` };
        }
        stmts.push({
          type: "fn",
          name: fnMatch[1],
          params,
          body: fnMatch[3].replace(/^\n/, "").replace(/\n$/, ""),
        });
        i = j + 1;
        continue;
      }

      stmts.push({ type: "line", text: trimmed });
      i += 1;
    }
    return { ok: true, stmts };
  }

  async function executeLet(trimmed, ctx, depth, scope) {
    const m = trimmed.match(/^let\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([\s\S]+)$/i);
    if (!m) {
      return { ok: false, error: 'Usage: let name = today(list) · let n = 3 · let s = "hi"' };
    }
    const name = m[1];
    if (/^(item|index)$/i.test(name)) {
      return { ok: false, error: `Reserved variable name: ${name}` };
    }
    const rhsRaw = substituteVars(m[2].trim(), scope);
    const lit = parseLiteralRhs(rhsRaw);
    if (lit.kind === "empty") {
      return { ok: false, error: "let requires a value after =" };
    }
    if (lit.kind === "literal") {
      const entry = makeVarEntry(lit.value);
      setVar(scope, name, entry);
      return { ok: true, message: `let ${name} = ${entry.text || String(lit.value)}`, data: entry.data };
    }
    const result = await execute(lit.value, ctx, depth + 1, scope);
    if (!result.ok) {
      return {
        ok: false,
        error: result.error || result.message || `let ${name} failed`,
        data: result.data,
      };
    }
    const entry = makeVarEntry(result);
    setVar(scope, name, entry);
    return {
      ok: true,
      message: `let ${name} = ${entry.text || result.message || "ok"}`,
      data: entry.data,
    };
  }

  async function executeUnset(trimmed, scope) {
    const m = trimmed.match(/^unset\s+([a-zA-Z_][a-zA-Z0-9_]*)$/i);
    if (!m) return { ok: false, error: "Usage: unset name" };
    const name = m[1];
    if (!Object.prototype.hasOwnProperty.call(scope.vars, name)) {
      return { ok: false, error: `Variable not in current scope: ${name}` };
    }
    delete scope.vars[name];
    return { ok: true, message: `Unset ${name}` };
  }

  function executeVarsCommand(trimmed, scope) {
    const lower = trimmed.toLowerCase();
    if (lower === "vars clear" || lower === "vars reset") {
      scope.vars = Object.create(null);
      return { ok: true, message: "Variables cleared (current scope)" };
    }
    if (lower !== "vars" && lower !== "variables") {
      return { ok: false, error: "Usage: vars · vars clear · unset name" };
    }
    const names = Object.keys(scope.vars);
    if (!names.length) return { ok: true, message: "No variables in current scope" };
    const lines = names.map((n) => {
      const e = scope.vars[n];
      return `${n}=${(e.text || "").slice(0, 60)}`;
    });
    return { ok: true, message: `vars (${names.length}): ${lines.join(" · ")}` };
  }

  function executeFnsCommand(trimmed, scope) {
    const lower = trimmed.toLowerCase();
    const remove = trimmed.match(/^fn\s+(?:remove|rm)\s+([a-zA-Z_][a-zA-Z0-9_]*)$/i);
    if (remove) {
      const key = remove[1].toLowerCase();
      if (!Object.prototype.hasOwnProperty.call(scope.fns, key)) {
        return { ok: false, error: `Function not in current scope: ${remove[1]}` };
      }
      delete scope.fns[key];
      return { ok: true, message: `Removed fn ${remove[1]}` };
    }
    if (lower === "fn" || lower === "fns" || lower === "fn list" || lower === "functions") {
      const names = Object.keys(scope.fns);
      const inherited = [];
      let p = scope.parent;
      while (p) {
        for (const n of Object.keys(p.fns)) {
          if (!scope.fns[n] && !inherited.includes(n)) inherited.push(n);
        }
        p = p.parent;
      }
      if (!names.length && !inherited.length) return { ok: true, message: "No functions defined" };
      const local = names.map((n) => {
        const f = scope.fns[n];
        return `${f.name}(${(f.params || []).join(", ")})`;
      });
      const bits = [];
      if (local.length) bits.push(`local: ${local.join(" · ")}`);
      if (inherited.length) bits.push(`inherited: ${inherited.join(" · ")}`);
      return { ok: true, message: bits.join(" · ") };
    }
    return null;
  }

  function defineFnFromStatement(stmt, scope) {
    const name = String(stmt.name || "");
    const key = name.toLowerCase();
    if (!IDENT_RE.test(name)) return { ok: false, error: `Invalid function name: ${name}` };
    if (RESERVED_FN_NAMES.has(key)) {
      return { ok: false, error: `Reserved name cannot be a function: ${name}` };
    }
    scope.fns[key] = {
      name,
      params: stmt.params || [],
      body: String(stmt.body || ""),
    };
    return {
      ok: true,
      message: `fn ${name}(${(stmt.params || []).join(", ")}) defined`,
    };
  }

  async function defineFnFromLine(trimmed, scope) {
    const open = trimmed.indexOf("{");
    if (open < 0) {
      return {
        ok: false,
        error: "Usage: fn name(a, b) { … } · fn list · fn remove name",
      };
    }
    const head = trimmed.slice(0, open).trim();
    const balanced = extractBalancedBlock(trimmed, open);
    if (!balanced) return { ok: false, error: "Unclosed function body: missing }" };
    const after = trimmed.slice(balanced.end + 1).trim();
    if (after) return { ok: false, error: "Unexpected tokens after function body" };
    const m = head.match(/^fn\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*$/i);
    if (!m) {
      return { ok: false, error: "Usage: fn name(a, b) { commands }" };
    }
    const params = parseFnParams(m[2]);
    if (params.some((p) => !p)) {
      return { ok: false, error: `Invalid parameters: ${m[2]}` };
    }
    return defineFnFromStatement({ name: m[1], params, body: balanced.body }, scope);
  }

  function parseFnCall(line) {
    const trimmed = String(line || "").trim();
    const open = trimmed.indexOf("(");
    if (open <= 0 || !trimmed.endsWith(")")) return null;
    const name = trimmed.slice(0, open).trim();
    if (!IDENT_RE.test(name)) return null;
    if (/\s/.test(name)) return null;
    const inner = trimmed.slice(open + 1, -1);
    return { name, args: parseArgList(inner) };
  }

  async function executeFnCall(call, ctx, depth, scope) {
    const fn = lookupFn(scope, call.name);
    if (!fn) return null;
    if (depth > MAX_FN_DEPTH) {
      return { ok: false, error: `Function nesting max is ${MAX_FN_DEPTH}` };
    }
    if (call.args.length > fn.params.length) {
      return {
        ok: false,
        error: `${fn.name} expects ${fn.params.length} arg(s), got ${call.args.length}`,
      };
    }
    const frame = createScope(scope);
    for (let i = 0; i < fn.params.length; i += 1) {
      const raw = call.args[i] != null ? call.args[i] : "";
      const expanded = substituteVars(raw, scope);
      const lit = parseLiteralRhs(expanded);
      if (lit.kind === "literal") {
        setVar(frame, fn.params[i], makeVarEntry(lit.value));
      } else if (lit.kind === "empty") {
        setVar(frame, fn.params[i], makeVarEntry(""));
      } else {
        setVar(frame, fn.params[i], makeVarEntry(expanded));
      }
    }
    const prog = await executeProgram(fn.body, ctx, {
      scope: frame,
      depth: depth + 1,
      source: `fn:${fn.name}`,
      allowEmpty: true,
    });
    return prog;
  }

  async function executeProgram(body, ctx, options = {}) {
    const scope = options.scope || createScope(sessionScope);
    const depth = options.depth || 0;
    const stopOnError = options.stopOnError !== false;
    const allowEmpty = options.allowEmpty === true;
    const parsed = parseProgram(body);
    if (!parsed.ok) return parsed;
    if (!parsed.stmts.length) {
      if (allowEmpty) {
        return { ok: true, message: "ok", results: [], ran: 0, total: 0, empty: true };
      }
      return { ok: false, error: "Empty program (add commands or uncomment lines)" };
    }

    const results = [];
    for (const stmt of parsed.stmts) {
      if (stmt.type === "fn") {
        const defined = defineFnFromStatement(stmt, scope);
        results.push(defined);
        if (!defined.ok && stopOnError) {
          return {
            ok: false,
            error: defined.error,
            results,
            ran: results.length,
            total: parsed.stmts.length,
            stopped: true,
          };
        }
        continue;
      }

      const result = await execute(stmt.text, ctx, depth, scope);
      results.push(result);
      if (!result.ok && stopOnError) {
        return {
          ok: false,
          error: result.error || result.message || "failed",
          message: result.error || result.message,
          results,
          ran: results.length,
          total: parsed.stmts.length,
          stopped: true,
          data: result.data,
        };
      }
    }

    const failed = results.filter((r) => !r.ok).length;
    const lastOk = [...results].reverse().find((r) => r.ok && r.message);
    return {
      ok: failed === 0,
      results,
      ran: results.length,
      total: parsed.stmts.length,
      failed,
      data: lastOk?.data,
      message:
        failed === 0
          ? lastOk?.message ||
            `Finished ${results.length} step${results.length === 1 ? "" : "s"}`
          : `Finished with ${failed} error${failed === 1 ? "" : "s"}`,
    };
  }

  async function executeWait(trimmed) {
    const m = trimmed.match(/^wait(?:\s+(.+))?$/i);
    if (!m) return null;
    const rest = (m[1] || "").trim();
    if (!rest) {
      return { ok: false, error: "Usage: wait 5s · wait 2m · wait until 14:30" };
    }

    const untilMatch = rest.match(/^until\s+(\d{1,2}):(\d{2})$/i);
    if (untilMatch) {
      const hh = parseInt(untilMatch[1], 10);
      const mm = parseInt(untilMatch[2], 10);
      if (hh > 23 || mm > 59) return { ok: false, error: "Invalid time: use HH:MM" };
      const now = new Date();
      const target = new Date(now);
      target.setHours(hh, mm, 0, 0);
      if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
      const ms = target.getTime() - now.getTime();
      if (ms > 6 * 60 * 60 * 1000) {
        return { ok: false, error: "wait until is limited to 6 hours ahead" };
      }
      await new Promise((r) => setTimeout(r, ms));
      return { ok: true, message: `Waited until ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}` };
    }

    const sec = parseDurationToSec(rest);
    if (!sec) return { ok: false, error: "Usage: wait 5s · wait 2m · wait until 14:30" };
    if (sec > 6 * 3600) return { ok: false, error: "wait is limited to 6 hours" };
    await new Promise((r) => setTimeout(r, sec * 1000));
    return { ok: true, message: `Waited ${formatDurationSec(sec)}` };
  }

  function parseAppCall(line, apps) {
    const trimmed = String(line || "").trim();
    if (!trimmed) return null;
    const open = trimmed.indexOf("(");
    if (open <= 0 || !trimmed.endsWith(")")) return null;
    const innerRaw = trimmed.slice(open + 1, -1);
    if (innerRaw.includes("(") || innerRaw.includes(")")) return null;
    const ref = trimmed.slice(0, open).trim();
    if (!ref) return null;
    const app = findAppByRef(ref, apps);
    const moduleId =
      resolveModule(ref) ||
      (app && (app.module || resolveModule(app.id) || resolveModule(app.name))) ||
      null;
    if (!moduleId) return null;
    if (!app && !appHasCommands(moduleId)) return null;
    return {
      ref,
      app,
      moduleId,
      inner: String(innerRaw || "").trim(),
    };
  }

  function appHasCommands(moduleId) {
    return Boolean(moduleId && ROUTE_REGISTRY[moduleId]?.commands);
  }

  function isClassicRouteArgs(inner) {
    const raw = String(inner || "").trim();
    if (!raw) return false;
    const { keys } = parseArgStructure(raw);
    return keys.length > 0;
  }

  function formatClockCommandHelp() {
    return [
      "clock(timer 25m) · clock(timer 90s Focus) · clock(timer pause|stop|status)",
      "clock(pomodoro start) · clock(pomodoro work:45) · clock(pomodoro pause)",
      "clock(stopwatch) · clock(world) · clock(meetings)",
    ].join(" · ");
  }

  async function executeClockCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatClockCommandHelp() };
    }

    const pages = ["local", "world", "meetings", "timer", "pomodoro", "stopwatch"];
    if (pages.includes(lower)) {
      await openClock(ctx, { page: lower });
      return { ok: true, message: `Opened Clock · ${lower}` };
    }

    if (/^timer(\s|$)/i.test(t)) {
      const rest = t.replace(/^timer\s*/i, "").trim();
      if (!rest) {
        await openClock(ctx, { page: "timer" });
        return { ok: true, message: "Opened Clock · timer" };
      }
      return executeTimerCommand(`timer ${rest}`, ctx);
    }

    if (/^pomodoro(\s|$)/i.test(t)) {
      const rest = t.replace(/^pomodoro\s*/i, "").trim();
      if (!rest) {
        await openClock(ctx, { page: "pomodoro" });
        return { ok: true, message: "Opened Clock · pomodoro" };
      }
      return executePomodoroCommand(`pomodoro ${rest}`, ctx);
    }

    if (/^stopwatch(\s|$)/i.test(t)) {
      const rest = t.replace(/^stopwatch\s*/i, "").trim();
      if (!rest || /^(start|go)$/i.test(rest)) {
        return executeStopwatchCommand(rest ? `stopwatch ${rest}` : "stopwatch", ctx);
      }
      return { ok: false, error: `Unknown stopwatch action. ${formatClockCommandHelp()}` };
    }

    if (looksLikeDuration(t)) {
      return executeTimerCommand(`timer ${t}`, ctx);
    }

    return {
      ok: false,
      error: `Unknown clock command "${t}". ${formatClockCommandHelp()}`,
    };
  }

  async function tryExecuteAppCommand(line, ctx) {
    const apps = ctx.getApps?.() || [];
    const call = parseAppCall(line, apps);
    if (!call || !call.moduleId) return null;
    if (!appHasCommands(call.moduleId)) return null;
    if (!call.inner) return null;
    if (isClassicRouteArgs(call.inner) && call.moduleId !== "translate") return null;

    if (call.moduleId === "world-clock") {
      return executeClockCommands(call.inner, ctx);
    }

    if (call.moduleId === "day-planner") {
      return executeTodayCommands(call.inner, ctx);
    }

    if (call.moduleId === "stocks") {
      return executeStocksCommands(call.inner, ctx);
    }

    if (call.moduleId === "builds") {
      return executeBuildsCommands(call.inner, ctx);
    }

    if (call.moduleId === "profiles") {
      return executeVaultCommands(call.inner, ctx);
    }

    if (call.moduleId === "drift") {
      return executeDriftCommands(call.inner, ctx);
    }

    if (call.moduleId === "study-deck") {
      return executeStudyDeckCommands(call.inner, ctx);
    }

    if (call.moduleId === "contacts") {
      return executeContactsCommands(call.inner, ctx);
    }

    if (call.moduleId === "notes") {
      return executeNotesCommands(call.inner, ctx);
    }

    if (call.moduleId === "tasks") {
      return executeTasksCommands(call.inner, ctx);
    }

    if (call.moduleId === "chat") {
      return executeChatCommands(call.inner, ctx);
    }

    if (call.moduleId === "translate") {
      return executeTranslateCommands(call.inner, ctx);
    }

    if (call.moduleId === "system-info") {
      return executeSysInfoCommands(call.inner, ctx);
    }

    if (call.moduleId === "remote-hub") {
      return executeRemoteHubCommands(call.inner, ctx);
    }

    if (call.moduleId === "os-bridge") {
      return executeOsBridgeCommands(call.inner, ctx);
    }

    if (call.moduleId === "files") {
      return executeFilesCommands(call.inner, ctx);
    }

    if (call.moduleId === "host") {
      return executeHostCommands(call.inner, ctx);
    }

    if (call.moduleId === "app") {
      return executeAppCommands(call.inner, ctx);
    }

    if (call.moduleId === "studies") {
      return executeStudiesCommands(call.inner, ctx);
    }

    if (call.moduleId === "geography") {
      return executeGeographyCommands(call.inner, ctx);
    }

    if (call.moduleId === "flag-quiz") {
      return executeFlagQuizCommands(call.inner, ctx);
    }

    if (call.moduleId === "history") {
      return executeHistoryCommands(call.inner, ctx);
    }

    if (call.moduleId === "space") {
      return executeSpaceCommands(call.inner, ctx);
    }

    if (call.moduleId === "contracts") {
      return executeContractsCommands(call.inner, ctx);
    }

    if (call.moduleId === "msl-protocol") {
      return executeMslCommands(call.inner, ctx);
    }

    if (call.moduleId === "parts") {
      return executePartsCommands(call.inner, ctx);
    }

    if (call.moduleId === "permissions") {
      return executePermissionsCommands(call.inner, ctx);
    }

    if (call.moduleId === "pulse") {
      return executePulseCommands(call.inner, ctx);
    }

    if (call.moduleId === "resolve") {
      return executeResolveCommands(call.inner, ctx);
    }

    if (call.moduleId === "updates") {
      return executeUpdatesCommands(call.inner, ctx);
    }

    if (call.moduleId === "network") {
      return executeNetworkCommands(call.inner, ctx);
    }

    if (call.moduleId === "info" || call.moduleId === "apps-info") {
      return executeInfoCommands(call.inner, ctx);
    }

    if (call.moduleId === "backup") {
      return executeBackupCommands(call.inner, ctx);
    }

    if (call.moduleId === "storage") {
      return executeStorageCommands(call.inner, ctx);
    }

    if (call.moduleId === "themes") {
      return executeThemesCommands(call.inner, ctx);
    }

    if (call.moduleId === "jobs") {
      return executeJobsCommands(call.inner, ctx);
    }

    if (call.moduleId === "scheduler") {
      return executeSchedulerCommands(call.inner, ctx);
    }

    if (call.moduleId === "mind") {
      return executeMindCommands(call.inner, ctx);
    }

    if (call.moduleId === "code-lexicon") {
      return executeLexiconCommands(call.inner, ctx);
    }

    if (call.moduleId === "model-flow") {
      return executeModelFlowCommands(call.inner, ctx);
    }

    if (call.moduleId === "shell-console") {
      return executeShellConsoleCommands(call.inner, ctx);
    }

    if (call.moduleId === "docs") {
      return executeDocsCommands(call.inner, ctx);
    }

    if (call.moduleId === "scripts") {
      return executeScriptsCommands(call.inner, ctx);
    }

    if (call.moduleId === "world-maps") {
      return executeMapsCommands(call.inner, ctx);
    }

    return {
      ok: false,
      error: `${call.app.name} has no commands for "(${call.inner})" yet`,
    };
  }

  function formatTodayCommandHelp() {
    return [
      "today(add Buy milk) · today(add Call Dana 15:00) · today(add Ship tomorrow)",
      "today(done Buy milk) · today(undo …) · today(delete …)",
      "today(list) · today(list tomorrow) · today(snooze … 15m|tomorrow)",
      "today(clear done) · today(tomorrow) · today(help)",
    ].join(" · ");
  }

  function formatTaskLine(task) {
    const time = task.dueTime ? ` ${task.dueTime}` : "";
    const pri = task.priority && task.priority !== "normal" ? ` [${task.priority}]` : "";
    const mark = task.done ? "✓ " : "";
    return `${mark}${task.title}${time}${pri}`;
  }

  function matchTaskByRef(tasks, ref, { includeDone = false } = {}) {
    const q = String(ref || "").trim().toLowerCase();
    if (!q) return { error: "Missing task title or id" };
    const pool = (tasks || []).filter((t) => includeDone || !t.done);
    const byId = pool.find((t) => t.id === ref || t.id.toLowerCase() === q);
    if (byId) return { task: byId };
    const exact = pool.filter((t) => String(t.title || "").toLowerCase() === q);
    if (exact.length === 1) return { task: exact[0] };
    const starts = pool.filter((t) => String(t.title || "").toLowerCase().startsWith(q));
    if (starts.length === 1) return { task: starts[0] };
    const includes = pool.filter((t) => String(t.title || "").toLowerCase().includes(q));
    if (includes.length === 1) return { task: includes[0] };
    if (includes.length > 1 || starts.length > 1 || exact.length > 1) {
      const amb = (exact.length > 1 ? exact : starts.length > 1 ? starts : includes).slice(0, 5);
      return {
        error: `Ambiguous — match one of: ${amb.map((t) => t.title).join(" · ")}`,
      };
    }
    return { error: `Task not found: ${ref}` };
  }

  function parseTodayAddArgs(rest) {
    let title = String(rest || "").trim();
    if (!title) return { error: "Usage: today(add Buy milk)" };

    let priority = null;
    let dueTime = null;
    let when = null;

    const pri = title.match(/\s+priority\s*:\s*(low|normal|high|urgent)\s*$/i);
    if (pri) {
      priority = pri[1].toLowerCase();
      title = title.slice(0, pri.index).trim();
    }

    const timeM = title.match(/\s+(\d{1,2}:\d{2})\s*$/);
    if (timeM) {
      dueTime = timeM[1];
      title = title.slice(0, timeM.index).trim();
    }

    const whenM = title.match(/\s+(today|tomorrow|later)\s*$/i);
    if (whenM) {
      when = whenM[1].toLowerCase();
      title = title.slice(0, whenM.index).trim();
    }

    if (!title) return { error: "Usage: today(add Buy milk)" };

    const today = localTodayISO();
    let dueDate = today;
    if (when === "tomorrow") dueDate = addDaysISO(today, 1);
    else if (when === "later") dueDate = addDaysISO(today, 3);
    else if (when === "today") dueDate = today;

    const args = { title, dueDate };
    if (dueTime) {
      args.dueTime = dueTime;
      args.notify = true;
    }
    if (priority) args.priority = priority;
    return { args, when: when || "today" };
  }

  async function executeTodayCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();

    if (!window.mySpace?.today) {
      return { ok: false, error: "Today shell API unavailable" };
    }

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatTodayCommandHelp() };
    }

    const pages = ["home", "today", "tomorrow", "later", "done", "all"];
    if (pages.includes(lower)) {
      await openToday(ctx, lower === "home" ? "today" : lower);
      return { ok: true, message: `Opened Today · ${lower === "home" ? "today" : lower}` };
    }

    if (/^list(\s|$)/i.test(t) || lower === "ls") {
      const bucketRaw = t.replace(/^list\s*/i, "").trim().toLowerCase() || "today";
      const bucket =
        bucketRaw === "ls" || !bucketRaw
          ? "today"
          : ["today", "tomorrow", "later", "done", "all", "open"].includes(bucketRaw)
            ? bucketRaw
            : null;
      if (!bucket) {
        return { ok: false, error: "Usage: today(list) · today(list tomorrow|later|done|all)" };
      }
      const res = await window.mySpace.today.list();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not list tasks" };
      const buckets = res.buckets || {};
      let items = [];
      if (bucket === "all") {
        items = res.tasks || [];
      } else if (bucket === "open") {
        items = (res.tasks || []).filter((x) => !x.done);
      } else {
        items = buckets[bucket] || [];
      }
      if (!items.length) {
        return { ok: true, message: `No ${bucket} tasks` };
      }
      const lines = items.slice(0, 20).map(formatTaskLine);
      const more = items.length > 20 ? ` · +${items.length - 20} more` : "";
      return { ok: true, message: `${bucket} (${items.length}): ${lines.join(" · ")}${more}` };
    }

    if (/^add(\s|$)/i.test(t) || /^new(\s|$)/i.test(t)) {
      const rest = t.replace(/^(add|new)\s*/i, "").trim();
      const parsed = parseTodayAddArgs(rest);
      if (parsed.error) return { ok: false, error: parsed.error };
      const res = await window.mySpace.today.add(parsed.args);
      if (!res?.ok) return { ok: false, error: res?.error || "Could not add task" };
      const task = res.task || parsed.args;
      const whenLabel = parsed.when || "today";
      const time = parsed.args.dueTime ? ` @ ${parsed.args.dueTime}` : "";
      await syncTodayIfOpen(
        ctx,
        whenLabel === "later" ? "later" : whenLabel === "tomorrow" ? "tomorrow" : "today"
      );
      return { ok: true, message: `Added · ${task.title || parsed.args.title}${time} (${whenLabel})` };
    }

    if (/^(done|complete|finish|check)(\s|$)/i.test(t)) {
      const rest = t.replace(/^(done|complete|finish|check)\s*/i, "").trim();
      if (!rest) return { ok: false, error: "Usage: today(done Buy milk)" };
      const listed = await window.mySpace.today.list();
      if (!listed?.ok) return { ok: false, error: listed?.error || "Could not load tasks" };
      const match = matchTaskByRef(listed.tasks || [], rest, { includeDone: false });
      if (match.error) return { ok: false, error: match.error };
      const res = await window.mySpace.today.update({ id: match.task.id, done: true });
      if (!res?.ok) return { ok: false, error: res?.error || "Could not complete task" };
      await syncTodayIfOpen(ctx, "today");
      return { ok: true, message: `Done · ${match.task.title}` };
    }

    if (/^(undo|undone|reopen|open task)(\s|$)/i.test(t)) {
      const rest = t.replace(/^(undo|undone|reopen|open task)\s*/i, "").trim();
      if (!rest) return { ok: false, error: "Usage: today(undo Buy milk)" };
      const listed = await window.mySpace.today.list();
      if (!listed?.ok) return { ok: false, error: listed?.error || "Could not load tasks" };
      const match = matchTaskByRef(listed.tasks || [], rest, { includeDone: true });
      if (match.error) return { ok: false, error: match.error };
      const res = await window.mySpace.today.update({ id: match.task.id, done: false });
      if (!res?.ok) return { ok: false, error: res?.error || "Could not reopen task" };
      await syncTodayIfOpen(ctx, "today");
      return { ok: true, message: `Reopened · ${match.task.title}` };
    }

    if (/^(delete|rm|remove)(\s|$)/i.test(t)) {
      const rest = t.replace(/^(delete|rm|remove)\s*/i, "").trim();
      if (!rest) return { ok: false, error: "Usage: today(delete Buy milk)" };
      const listed = await window.mySpace.today.list();
      if (!listed?.ok) return { ok: false, error: listed?.error || "Could not load tasks" };
      const match = matchTaskByRef(listed.tasks || [], rest, { includeDone: true });
      if (match.error) return { ok: false, error: match.error };
      const res = await window.mySpace.today.delete(match.task.id);
      if (!res?.ok) return { ok: false, error: res?.error || "Could not delete task" };
      await syncTodayIfOpen(ctx, "today");
      return { ok: true, message: `Deleted · ${match.task.title}` };
    }

    if (/^snooze(\s|$)/i.test(t)) {
      const rest = t.replace(/^snooze\s*/i, "").trim();
      if (!rest) return { ok: false, error: "Usage: today(snooze Buy milk 15m) · today(snooze … tomorrow)" };
      let target = rest;
      let snoozeArgs = { minutes: 15 };
      const tom = rest.match(/\s+tomorrow(?:-am)?\s*$/i);
      const dur = rest.match(/\s+(\d+)\s*(m|min|minutes?|h|hr|hours?)\s*$/i);
      if (tom) {
        target = rest.slice(0, tom.index).trim();
        snoozeArgs = { preset: /am/i.test(tom[0]) ? "tomorrow-am" : "tomorrow" };
      } else if (dur) {
        target = rest.slice(0, dur.index).trim();
        const n = parseInt(dur[1], 10);
        const u = dur[2].toLowerCase();
        snoozeArgs = { minutes: u.startsWith("h") ? n * 60 : n };
      }
      const listed = await window.mySpace.today.list();
      if (!listed?.ok) return { ok: false, error: listed?.error || "Could not load tasks" };
      const match = matchTaskByRef(listed.tasks || [], target, { includeDone: false });
      if (match.error) return { ok: false, error: match.error };
      const res = await window.mySpace.today.snooze({ id: match.task.id, ...snoozeArgs });
      if (!res?.ok) return { ok: false, error: res?.error || "Could not snooze task" };
      await syncTodayIfOpen(ctx, "today");
      return { ok: true, message: `Snoozed · ${match.task.title}` };
    }

    if (/^clear(\s+done)?$/i.test(t) || lower === "clear done") {
      const res = await window.mySpace.today.clearDone();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not clear done tasks" };
      await syncTodayIfOpen(ctx, "done");
      return { ok: true, message: "Cleared done tasks" };
    }

    return {
      ok: false,
      error: `Unknown today command "${t}". ${formatTodayCommandHelp()}`,
    };
  }

  function formatStocksCommandHelp() {
    return [
      "stocks(AAPL) · stocks(open TSLA) · stocks(quote NVDA)",
      "stocks(watch AAPL) · stocks(unwatch AAPL) · stocks(list)",
      "stocks(alert AAPL > 200) · stocks(alert rm AAPL) · stocks(list alerts)",
      "stocks(mode crypto) · stocks(portfolio) · stocks(hold AAPL 10 @ 180)",
      "stocks(buylist) · stocks(alerts) · stocks(help)",
    ].join(" · ");
  }

  function normalizeStocksSymbol(raw) {
    return String(raw || "")
      .trim()
      .toUpperCase()
      .replace(/^\$/, "");
  }

  function looksLikeTicker(raw) {
    return /^[A-Za-z][A-Za-z0-9.^=-]{0,15}$/.test(String(raw || "").trim());
  }

  function resolveStocksMode(raw) {
    const key = String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
    if (!key) return null;
    const aliases = {
      stock: "stocks",
      stocks: "stocks",
      equity: "stocks",
      equities: "stocks",
      intl: "intl",
      international: "intl",
      global: "intl",
      etf: "etf-index",
      etfs: "etf-index",
      "etf-index": "etf-index",
      index: "etf-index",
      indices: "indices",
      sector: "etf-sector",
      "etf-sector": "etf-sector",
      bonds: "etf-bonds",
      "etf-bonds": "etf-bonds",
      metal: "metals",
      metals: "metals",
      gold: "metals",
      energy: "energy",
      commodity: "commodities",
      commodities: "commodities",
      fx: "forex",
      forex: "forex",
      crypto: "crypto",
      coin: "crypto",
      coins: "crypto",
      reit: "reit",
      rates: "rates",
      emerging: "emerging",
    };
    return aliases[key] || (ROUTE_REGISTRY.stocks.modes.includes(key) ? key : null);
  }

  async function executeStocksCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();

    if (!window.mySpace?.stocks) {
      return { ok: false, error: "Stocks shell API unavailable" };
    }

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatStocksCommandHelp() };
    }

    const pages = ["dashboard", "portfolio", "alerts", "buylist", "stock", "ai-analysis", "home"];
    if (pages.includes(lower) || lower === "buy" || lower === "buy list" || lower === "buylist") {
      const page =
        lower === "home"
          ? "dashboard"
          : lower === "buy" || lower === "buy list"
            ? "buylist"
            : lower;
      await openStocks(ctx, { page });
      return { ok: true, message: `Opened Stocks · ${page}` };
    }

    if (/^mode(\s|$)/i.test(t) || /^market(\s|$)/i.test(t)) {
      const rest = t.replace(/^(mode|market)\s*/i, "").trim();
      const mode = resolveStocksMode(rest);
      if (!mode) {
        return {
          ok: false,
          error: `Unknown mode. Try: stocks, crypto, forex, metals, intl, etf-index`,
        };
      }
      const res = await window.mySpace.stocks.setMode(mode);
      if (!res?.ok) return { ok: false, error: res?.error || "Could not set mode" };
      await syncStocksIfOpen(ctx, { action: "setMode", param: mode });
      return { ok: true, message: `Stocks mode · ${mode}` };
    }

    if (/^quote(\s|$)/i.test(t) || /^price(\s|$)/i.test(t)) {
      const sym = normalizeStocksSymbol(t.replace(/^(quote|price)\s*/i, ""));
      if (!sym) return { ok: false, error: "Usage: stocks(quote AAPL)" };
      const res = await window.mySpace.stocks.quote(sym);
      if (!res?.ok) return { ok: false, error: res?.error || "Quote failed" };
      const q = (res.quotes || [])[0];
      if (!q) return { ok: false, error: `No quote for ${sym}` };
      const ch = q.changePct != null ? ` (${q.changePct >= 0 ? "+" : ""}${Number(q.changePct).toFixed(2)}%)` : "";
      return { ok: true, message: `${q.symbol || sym}: ${q.price ?? "?"}${ch}` };
    }

    if (/^watch(\s|$)/i.test(t) || /^add(\s|$)/i.test(t)) {
      const sym = normalizeStocksSymbol(t.replace(/^(watch|add)\s*/i, ""));
      if (!sym) return { ok: false, error: "Usage: stocks(watch AAPL)" };
      const res = await window.mySpace.stocks.watch(sym);
      if (!res?.ok) return { ok: false, error: res?.error || "Could not watch" };
      await syncStocksIfOpen(ctx, { page: "dashboard" });
      return { ok: true, message: `Watching ${sym}` };
    }

    if (/^unwatch(\s|$)/i.test(t) || /^remove(\s|$)/i.test(t) || /^rm(\s|$)/i.test(t)) {
      const sym = normalizeStocksSymbol(t.replace(/^(unwatch|remove|rm)\s*/i, ""));
      if (!sym) return { ok: false, error: "Usage: stocks(unwatch AAPL)" };
      const res = await window.mySpace.stocks.unwatch(sym);
      if (!res?.ok) return { ok: false, error: res?.error || "Could not unwatch" };
      await syncStocksIfOpen(ctx, { page: "dashboard" });
      return { ok: true, message: `Removed ${sym} from watchlist` };
    }

    if (/^list(\s|$)/i.test(t) || lower === "ls") {
      const what = t.replace(/^list\s*/i, "").trim().toLowerCase() || "watchlist";
      if (what === "ls" || what === "watch" || what === "watchlist" || !what) {
        const res = await window.mySpace.stocks.watchlist();
        if (!res?.ok) return { ok: false, error: res?.error || "Could not load watchlist" };
        const quotes = res.quotes || [];
        if (!quotes.length) {
          const syms = res.watchlist || [];
          return {
            ok: true,
            message: syms.length
              ? `Watchlist (${res.mode || "?"}): ${syms.slice(0, 15).join(", ")}${syms.length > 15 ? "…" : ""}`
              : "Watchlist empty",
          };
        }
        const lines = quotes.slice(0, 12).map((q) => {
          const ch =
            q.changePct != null
              ? ` ${q.changePct >= 0 ? "+" : ""}${Number(q.changePct).toFixed(1)}%`
              : "";
          return `${q.symbol} ${q.price ?? "?"}${ch}`;
        });
        return { ok: true, message: `Watchlist (${res.mode || "?"}): ${lines.join(" · ")}` };
      }
      if (what === "portfolio" || what === "holdings") {
        const res = await window.mySpace.stocks.portfolio();
        if (!res?.ok) return { ok: false, error: res?.error || "Could not load portfolio" };
        const positions = res.positions || [];
        if (!positions.length) return { ok: true, message: "Portfolio empty" };
        const lines = positions
          .slice(0, 12)
          .map((p) => `${p.symbol} ×${p.qty} @ ${p.price ?? "?"}`);
        return { ok: true, message: `Portfolio: ${lines.join(" · ")}` };
      }
      if (what === "alerts") {
        const res = await window.mySpace.stocks.alerts();
        if (!res?.ok) return { ok: false, error: res?.error || "Could not load alerts" };
        const alerts = res.alerts || [];
        if (!alerts.length) return { ok: true, message: "No alerts" };
        const lines = alerts.slice(0, 12).map((a) => {
          const cond =
            a.above != null ? `> ${a.above}` : a.below != null ? `< ${a.below}` : "?";
          return `${a.symbol} ${cond}`;
        });
        return { ok: true, message: `Alerts: ${lines.join(" · ")}` };
      }
      if (what === "buylist" || what === "buy") {
        const res = await window.mySpace.stocks.buylist();
        if (!res?.ok) return { ok: false, error: res?.error || "Could not load buy list" };
        const list = res.buyList || [];
        if (!list.length) return { ok: true, message: "Buy list empty" };
        return {
          ok: true,
          message: `Buy list: ${list
            .slice(0, 12)
            .map((i) => i.symbol)
            .join(", ")}`,
        };
      }
      return { ok: false, error: "Usage: stocks(list) · stocks(list portfolio|alerts|buylist)" };
    }

    if (/^alert(\s|$)/i.test(t)) {
      const rest = t.replace(/^alert\s*/i, "").trim();
      if (!rest) return { ok: false, error: "Usage: stocks(alert AAPL > 200)" };
      if (/^(rm|remove|delete|clear)\s+/i.test(rest) || /^unalert\s+/i.test(t)) {
        const sym = normalizeStocksSymbol(rest.replace(/^(rm|remove|delete|clear)\s+/i, ""));
        if (!sym) return { ok: false, error: "Usage: stocks(alert rm AAPL)" };
        const res = await window.mySpace.stocks.alertRemove({ symbol: sym });
        if (!res?.ok) return { ok: false, error: res?.error || "Could not remove alert" };
        await syncStocksIfOpen(ctx, { page: "alerts" });
        return { ok: true, message: `Removed alerts for ${sym}` };
      }
      const m = rest.match(/^(\S+)\s*(>=|<=|>|<|above|below)\s*(\d+(?:\.\d+)?)\s*$/i);
      if (!m) {
        return { ok: false, error: "Usage: stocks(alert AAPL > 200) · stocks(alert TSLA < 150)" };
      }
      const sym = normalizeStocksSymbol(m[1]);
      const op = m[2].toLowerCase();
      const price = parseFloat(m[3]);
      const args = { symbol: sym };
      if (op === ">" || op === ">=" || op === "above") args.above = price;
      else args.below = price;
      const res = await window.mySpace.stocks.alertAdd(args);
      if (!res?.ok) return { ok: false, error: res?.error || "Could not add alert" };
      await syncStocksIfOpen(ctx, { page: "alerts" });
      const label = args.above != null ? `> ${args.above}` : `< ${args.below}`;
      return { ok: true, message: `Alert · ${sym} ${label}` };
    }

    if (/^unalert(\s|$)/i.test(t)) {
      const sym = normalizeStocksSymbol(t.replace(/^unalert\s*/i, ""));
      if (!sym) return { ok: false, error: "Usage: stocks(unalert AAPL)" };
      const res = await window.mySpace.stocks.alertRemove({ symbol: sym });
      if (!res?.ok) return { ok: false, error: res?.error || "Could not remove alert" };
      await syncStocksIfOpen(ctx, { page: "alerts" });
      return { ok: true, message: `Removed alerts for ${sym}` };
    }

    if (/^hold(\s|$)/i.test(t) || /^position(\s|$)/i.test(t)) {
      const rest = t.replace(/^(hold|position)\s*/i, "").trim();
      const m = rest.match(/^(\S+)\s+(\d+(?:\.\d+)?)(?:\s*(?:@|at)?\s*(\d+(?:\.\d+)?))?$/i);
      if (!m) {
        return { ok: false, error: "Usage: stocks(hold AAPL 10 @ 180) · stocks(hold AAPL 0) to remove" };
      }
      const sym = normalizeStocksSymbol(m[1]);
      const qty = parseFloat(m[2]);
      const avgCost = m[3] != null ? parseFloat(m[3]) : 0;
      const res = await window.mySpace.stocks.hold({ symbol: sym, qty, avgCost });
      if (!res?.ok) return { ok: false, error: res?.error || "Could not update holding" };
      await syncStocksIfOpen(ctx, { page: "portfolio" });
      if (qty <= 0) return { ok: true, message: `Removed holding · ${sym}` };
      return { ok: true, message: `Holding · ${sym} ×${qty}${avgCost ? ` @ ${avgCost}` : ""}` };
    }

    if (/^open(\s|$)/i.test(t)) {
      const sym = normalizeStocksSymbol(t.replace(/^open\s*/i, ""));
      if (!sym || !looksLikeTicker(sym)) return { ok: false, error: "Usage: stocks(open AAPL)" };
      await openStocks(ctx, { action: "openStock", param: sym, page: "stock" });
      return { ok: true, message: `Opened ${sym}` };
    }

    if (/^ai(\s|$)/i.test(t) || /^analysis(\s|$)/i.test(t)) {
      const sym = normalizeStocksSymbol(t.replace(/^(ai|analysis)\s*/i, ""));
      if (sym && looksLikeTicker(sym)) {
        await openStocks(ctx, { action: "openStock", param: sym, page: "stock" });
        return { ok: true, message: `Opened ${sym}` };
      }
      await openStocks(ctx, { page: "ai-analysis" });
      return { ok: true, message: "Opened Stocks · ai-analysis" };
    }

    const modeOnly = resolveStocksMode(t);
    if (modeOnly && !/\s/.test(t)) {
      const res = await window.mySpace.stocks.setMode(modeOnly);
      if (!res?.ok) return { ok: false, error: res?.error || "Could not set mode" };
      await syncStocksIfOpen(ctx, { action: "setMode", param: modeOnly });
      return { ok: true, message: `Stocks mode · ${modeOnly}` };
    }

    if (looksLikeTicker(t) && !/\s/.test(t)) {
      const sym = normalizeStocksSymbol(t);
      await openStocks(ctx, { action: "openStock", param: sym, page: "stock" });
      return { ok: true, message: `Opened ${sym}` };
    }

    return {
      ok: false,
      error: `Unknown stocks command "${t}". ${formatStocksCommandHelp()}`,
    };
  }

  function formatBuildsCommandHelp() {
    return [
      "builds(list) · builds(list web) · builds(open Name)",
      "builds(new Name) · builds(delete Name) · builds(duplicate Name)",
      "builds(timeline) · builds(browse) · builds(folder Name) · builds(rescan Name)",
      "builds(help)",
    ].join(" · ");
  }

  function formatVaultCommandHelp() {
    return [
      "vault(status) · vault(lock) · vault(list) · vault(search gmail)",
      "vault(open Name) · vault(add Name) · vault(copy Name) · vault(delete Name)",
      "Unlock in the Vault app first: shell will not take your master password",
    ].join(" · ");
  }

  function matchNamedItem(items, ref, nameKey = "name") {
    const q = String(ref || "").trim().toLowerCase();
    if (!q) return { error: "Missing name" };
    const pool = items || [];
    const byId = pool.find((x) => String(x.id || "").toLowerCase() === q);
    if (byId) return { item: byId };
    const exact = pool.filter((x) => String(x[nameKey] || "").toLowerCase() === q);
    if (exact.length === 1) return { item: exact[0] };
    const starts = pool.filter((x) => String(x[nameKey] || "").toLowerCase().startsWith(q));
    if (starts.length === 1) return { item: starts[0] };
    const includes = pool.filter((x) => String(x[nameKey] || "").toLowerCase().includes(q));
    if (includes.length === 1) return { item: includes[0] };
    const amb = (exact.length > 1 ? exact : starts.length > 1 ? starts : includes).slice(0, 5);
    if (amb.length > 1) {
      return { error: `Ambiguous — match one of: ${amb.map((x) => x[nameKey]).join(" · ")}` };
    }
    return { error: `Not found: ${ref}` };
  }

  async function executeBuildsCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();

    if (!window.mySpace?.builds) {
      return { ok: false, error: "Builds shell API unavailable" };
    }

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatBuildsCommandHelp() };
    }

    if (lower === "timeline" || lower === "browse" || lower === "home") {
      const page = lower === "home" ? "browse" : lower;
      await openBuilds(ctx, { page });
      return { ok: true, message: `Opened Builds · ${page}` };
    }

    if (/^list(\s|$)/i.test(t) || lower === "ls") {
      const rest = t.replace(/^list\s*/i, "").trim();
      const args = {};
      if (rest && rest.toLowerCase() !== "ls") {
        if (/^fav(ou?rites?)?$/i.test(rest)) args.favorites = true;
        else if (
          /^(desktop|web|scripts|libraries|games|experiments|other)$/i.test(rest)
        ) {
          args.category = rest.toLowerCase();
        } else {
          args.query = rest;
        }
      }
      const res = await window.mySpace.builds.list(args);
      if (!res?.ok) return { ok: false, error: res?.error || "Could not list projects" };
      const projects = res.projects || [];
      if (!projects.length) return { ok: true, message: "No projects" };
      const lines = projects.slice(0, 20).map((p) => p.name);
      const more = projects.length > 20 ? ` · +${projects.length - 20} more` : "";
      return { ok: true, message: `Builds (${projects.length}): ${lines.join(" · ")}${more}` };
    }

    if (/^(open|go|show)(\s|$)/i.test(t)) {
      const name = t.replace(/^(open|go|show)\s*/i, "").trim();
      if (!name) return { ok: false, error: "Usage: builds(open Project Name)" };
      const res = await window.mySpace.builds.get(name);
      if (!res?.ok) return { ok: false, error: res?.error || "Project not found" };
      const project = res.project;
      await openBuilds(ctx, {
        page: "browse",
        action: "openProject",
        param: project.id,
      });
      return { ok: true, message: `Opened · ${project.name}` };
    }

    if (/^(new|add|create)(\s|$)/i.test(t)) {
      const rest = t.replace(/^(new|add|create)\s*/i, "").trim();
      if (!rest) return { ok: false, error: "Usage: builds(new My App) · builds(new My App web)" };
      let name = rest;
      let category = null;
      const catM = rest.match(/\s+(desktop|web|scripts|libraries|games|experiments|other)\s*$/i);
      if (catM) {
        category = catM[1].toLowerCase();
        name = rest.slice(0, catM.index).trim();
      }
      const pathM = name.match(/\s+path\s*:\s*(.+)$/i);
      let rootPath = null;
      if (pathM) {
        rootPath = unquoteArg(pathM[1].trim());
        name = name.slice(0, pathM.index).trim();
      }
      if (!name) return { ok: false, error: "Usage: builds(new My App)" };
      const args = { name };
      if (category) args.category = category;
      if (rootPath) args.path = rootPath;
      const res = await window.mySpace.builds.create(args);
      if (!res?.ok) return { ok: false, error: res?.error || "Could not create project" };
      const project = res.project || { name, id: res.id };
      await syncBuildsIfOpen(ctx, {
        page: "browse",
        action: "openProject",
        param: project.id,
      });
      return { ok: true, message: `Created · ${project.name || name}` };
    }

    if (/^(delete|rm|remove)(\s|$)/i.test(t)) {
      const name = t.replace(/^(delete|rm|remove)\s*/i, "").trim();
      if (!name) return { ok: false, error: "Usage: builds(delete Project Name)" };
      const res = await window.mySpace.builds.delete(name);
      if (!res?.ok) return { ok: false, error: res?.error || "Could not delete" };
      await syncBuildsIfOpen(ctx, { page: "browse" });
      return { ok: true, message: `Deleted · ${name}` };
    }

    if (/^duplicate(\s|$)/i.test(t) || /^copy(\s|$)/i.test(t)) {
      const name = t.replace(/^(duplicate|copy)\s*/i, "").trim();
      if (!name) return { ok: false, error: "Usage: builds(duplicate Project Name)" };
      const res = await window.mySpace.builds.duplicate(name);
      if (!res?.ok) return { ok: false, error: res?.error || "Could not duplicate" };
      const project = res.project;
      await syncBuildsIfOpen(ctx, {
        page: "browse",
        action: "openProject",
        param: project?.id,
      });
      return { ok: true, message: `Duplicated · ${project?.name || name}` };
    }

    if (/^rescan(\s|$)/i.test(t) || /^scan(\s|$)/i.test(t)) {
      const name = t.replace(/^(rescan|scan)\s*/i, "").trim();
      if (!name) return { ok: false, error: "Usage: builds(rescan Project Name)" };
      const res = await window.mySpace.builds.rescan(name);
      if (!res?.ok) return { ok: false, error: res?.error || "Could not rescan" };
      await syncBuildsIfOpen(ctx, {
        page: "browse",
        action: "openProject",
        param: res.project?.id,
      });
      return { ok: true, message: `Rescanned · ${res.project?.name || name}` };
    }

    if (/^folder(\s|$)/i.test(t) || /^reveal(\s|$)/i.test(t)) {
      const name = t.replace(/^(folder|reveal)\s*/i, "").trim();
      if (!name) return { ok: false, error: "Usage: builds(folder Project Name)" };
      const got = await window.mySpace.builds.get(name);
      if (!got?.ok) return { ok: false, error: got?.error || "Project not found" };
      const rootPath = got.project?.rootPath;
      if (!rootPath) return { ok: false, error: `${got.project.name} has no linked folder` };
      const res = await window.mySpace.builds.openFolder({ path: rootPath });
      if (!res?.ok) return { ok: false, error: res?.error || "Could not open folder" };
      return { ok: true, message: `Opened folder · ${got.project.name}` };
    }

    if (/^link(\s|$)/i.test(t)) {
      const rest = t.replace(/^link\s*/i, "").trim();
      const m = rest.match(/^(.+?)\s+(?:to\s+|path\s*:\s*)(.+)$/i) || rest.match(/^(\S+)\s+(.+)$/);
      if (!m) return { ok: false, error: "Usage: builds(link Project Name path:C:\\code\\app)" };
      const name = m[1].trim();
      const folderPath = unquoteArg(m[2].trim());
      const res = await window.mySpace.builds.linkFolder({
        name,
        project: name,
        path: folderPath,
      });
      if (!res?.ok) return { ok: false, error: res?.error || "Could not link folder" };
      await syncBuildsIfOpen(ctx, {
        page: "browse",
        action: "openProject",
        param: res.project?.id,
      });
      return { ok: true, message: `Linked folder · ${res.project?.name || name}` };
    }

    if (t && !/^(list|new|add|help)/i.test(t)) {
      const res = await window.mySpace.builds.get(t);
      if (res?.ok && res.project) {
        await openBuilds(ctx, {
          page: "browse",
          action: "openProject",
          param: res.project.id,
        });
        return { ok: true, message: `Opened · ${res.project.name}` };
      }
    }

    return {
      ok: false,
      error: `Unknown builds command "${t}". ${formatBuildsCommandHelp()}`,
    };
  }

  async function executeVaultCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();

    if (!window.mySpace?.vault) {
      return { ok: false, error: "Vault shell API unavailable" };
    }

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatVaultCommandHelp() };
    }

    if (lower === "vault" || lower === "home") {
      await openVault(ctx, { page: "vault" });
      return { ok: true, message: "Opened Vault" };
    }

    if (lower === "status") {
      const res = await window.mySpace.vault.status();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not read status" };
      const state = res.unlocked ? "unlocked" : res.initialized ? "locked" : "not set up";
      const count =
        res.entryCount != null ? ` · ${res.entryCount} entries` : "";
      return { ok: true, message: `Vault ${state}${count}` };
    }

    if (lower === "lock") {
      const res = await window.mySpace.vault.lock();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not lock" };
      await syncVaultIfOpen(ctx, { page: "vault" });
      return { ok: true, message: "Vault locked" };
    }

    const ensureUnlocked = async () => {
      const st = await window.mySpace.vault.status();
      if (!st?.ok) return st;
      if (!st.unlocked) {
        return {
          ok: false,
          error: "Vault is locked: unlock in the Vault app first",
        };
      }
      return { ok: true };
    };

    if (/^list(\s|$)/i.test(t) || lower === "ls") {
      const gate = await ensureUnlocked();
      if (!gate.ok) return gate;
      const res = await window.mySpace.vault.list();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not list" };
      const entries = res.entries || [];
      if (!entries.length) return { ok: true, message: "Vault empty" };
      const lines = entries.slice(0, 20).map((e) => e.name);
      const more = entries.length > 20 ? ` · +${entries.length - 20} more` : "";
      return { ok: true, message: `Vault (${entries.length}): ${lines.join(" · ")}${more}` };
    }

    if (/^search(\s|$)/i.test(t) || /^find(\s|$)/i.test(t)) {
      const q = t.replace(/^(search|find)\s*/i, "").trim().toLowerCase();
      if (!q) return { ok: false, error: "Usage: vault(search gmail)" };
      const gate = await ensureUnlocked();
      if (!gate.ok) return gate;
      const res = await window.mySpace.vault.list();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not search" };
      const hits = (res.entries || []).filter((e) => {
        const hay = [e.name, e.username, e.url, e.notes, e.category, ...(e.tags || [])]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
      if (!hits.length) return { ok: true, message: `No matches for "${q}"` };
      return {
        ok: true,
        message: `Found ${hits.length}: ${hits
          .slice(0, 15)
          .map((e) => e.name)
          .join(" · ")}`,
      };
    }

    if (/^(open|go|show)(\s|$)/i.test(t)) {
      const ref = t.replace(/^(open|go|show)\s*/i, "").trim();
      if (!ref) return { ok: false, error: "Usage: vault(open Gmail)" };
      const gate = await ensureUnlocked();
      if (!gate.ok) {
        if (/^vault_/i.test(ref)) {
          await openVault(ctx, { page: "vault", action: "openEntry", param: ref });
          return { ok: true, message: "Opening Vault (unlock to view entry)" };
        }
        return gate;
      }
      const listed = await window.mySpace.vault.list();
      if (!listed?.ok) return { ok: false, error: listed?.error || "Could not list" };
      const match = matchNamedItem(listed.entries || [], ref);
      if (match.error) return { ok: false, error: match.error };
      await openVault(ctx, {
        page: "vault",
        action: "openEntry",
        param: match.item.id,
      });
      return { ok: true, message: `Opened · ${match.item.name}` };
    }

    if (/^(add|new|create)(\s|$)/i.test(t)) {
      const rest = t.replace(/^(add|new|create)\s*/i, "").trim();
      if (!rest) return { ok: false, error: "Usage: vault(add Gmail) · vault(add name:Gmail user:me)" };
      const gate = await ensureUnlocked();
      if (!gate.ok) return gate;

      const entry = { name: rest };
      const { map, keys, positional } = parseArgStructure(rest);
      if (keys.length) {
        entry.name = map.name || map.title || positional[0] || "";
        if (map.user || map.username) entry.username = map.user || map.username;
        if (map.url || map.site) entry.url = map.url || map.site;
        if (map.notes || map.note) entry.notes = map.notes || map.note;
        if (map.category || map.cat) entry.category = map.category || map.cat;
        if (map.password || map.pass || map.pw) {
          entry.password = map.password || map.pass || map.pw;
        }
      } else {
        let title = rest;
        const userM = title.match(/\s+user(?:name)?\s*:\s*(\S+)/i);
        if (userM) {
          entry.username = userM[1];
          title = title.replace(userM[0], "").trim();
        }
        const urlM = title.match(/\s+url\s*:\s*(\S+)/i);
        if (urlM) {
          entry.url = urlM[1];
          title = title.replace(urlM[0], "").trim();
        }
        const passM = title.match(/\s+(?:password|pass|pw)\s*:\s*(\S+)/i);
        if (passM) {
          entry.password = passM[1];
          title = title.replace(passM[0], "").trim();
        }
        entry.name = title;
      }
      if (!entry.name) return { ok: false, error: "Usage: vault(add Gmail)" };

      const res = await window.mySpace.vault.save(entry);
      if (!res?.ok) return { ok: false, error: res?.error || "Could not save entry" };
      const saved = res.entry;
      await syncVaultIfOpen(ctx, {
        page: "vault",
        action: "openEntry",
        param: saved?.id,
      });
      return { ok: true, message: `Saved · ${saved?.name || entry.name}` };
    }

    if (/^(copy|password|pw)(\s|$)/i.test(t)) {
      const ref = t.replace(/^(copy|password|pw)\s*/i, "").trim();
      if (!ref) return { ok: false, error: "Usage: vault(copy Gmail)" };
      const gate = await ensureUnlocked();
      if (!gate.ok) return gate;
      const listed = await window.mySpace.vault.list();
      if (!listed?.ok) return { ok: false, error: listed?.error || "Could not list" };
      const match = matchNamedItem(listed.entries || [], ref);
      if (match.error) return { ok: false, error: match.error };
      const res = await window.mySpace.vault.copyPassword(match.item.id);
      if (!res?.ok) return { ok: false, error: res?.error || "No password to copy" };
      return { ok: true, message: `Password copied · ${match.item.name}` };
    }

    if (/^(delete|rm|remove)(\s|$)/i.test(t)) {
      const ref = t.replace(/^(delete|rm|remove)\s*/i, "").trim();
      if (!ref) return { ok: false, error: "Usage: vault(delete Gmail)" };
      const gate = await ensureUnlocked();
      if (!gate.ok) return gate;
      const listed = await window.mySpace.vault.list();
      if (!listed?.ok) return { ok: false, error: listed?.error || "Could not list" };
      const match = matchNamedItem(listed.entries || [], ref);
      if (match.error) return { ok: false, error: match.error };
      const res = await window.mySpace.vault.delete(match.item.id);
      if (!res?.ok) return { ok: false, error: res?.error || "Could not delete" };
      await syncVaultIfOpen(ctx, { page: "vault" });
      return { ok: true, message: `Deleted · ${match.item.name}` };
    }

    return {
      ok: false,
      error: `Unknown vault command "${t}". ${formatVaultCommandHelp()}`,
    };
  }

  function formatDriftCommandHelp() {
    return [
      "drift(scan) · drift(list) · drift(list today|week) · drift(search …)",
      "drift(zones) · drift(insights) · drift(pause|resume) · drift(status)",
      "drift(open <eventId>) · drift(activity|zones|insights)",
    ].join(" · ");
  }

  function formatStudyDeckCommandHelp() {
    return [
      "decks(list) · decks(new Biology) · decks(delete Biology)",
      "decks(add Biology | front | back) · studydeck(open Biology)",
      "studydeck(study Biology) · decks(help)",
    ].join(" · ");
  }

  async function executeDriftCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();

    if (!window.mySpace?.drift) {
      return { ok: false, error: "Drift shell API unavailable" };
    }

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatDriftCommandHelp() };
    }

    if (lower === "activity" || lower === "home") {
      await openDrift(ctx, { page: "activity" });
      return { ok: true, message: "Opened Drift · activity" };
    }

    if (/^page\s+/i.test(t)) {
      const page = t.replace(/^page\s+/i, "").trim().toLowerCase();
      if (!["activity", "zones", "insights"].includes(page)) {
        return { ok: false, error: "Usage: drift(page activity|zones|insights)" };
      }
      await openDrift(ctx, { page });
      return { ok: true, message: `Opened Drift · ${page}` };
    }

    if (lower === "status") {
      const zones = await window.mySpace.drift.zones();
      if (!zones?.ok) return { ok: false, error: zones?.error || "Could not load status" };
      const list = zones.zones || [];
      const enabled = list.filter((z) => z.enabled !== false).length;
      const paused = zones.settings?.paused ? "paused" : "active";
      const last = zones.settings?.lastScanAt
        ? ` · last scan ${String(zones.settings.lastScanAt).slice(0, 16)}`
        : "";
      return {
        ok: true,
        message: `Drift ${paused} · ${enabled}/${list.length} zones${last}`,
      };
    }

    if (lower === "pause") {
      const res = await window.mySpace.drift.settings({ paused: true });
      if (!res?.ok) return { ok: false, error: res?.error || "Could not pause" };
      await syncDriftIfOpen(ctx, { page: "activity" });
      return { ok: true, message: "Drift paused" };
    }

    if (lower === "resume" || lower === "unpause") {
      const res = await window.mySpace.drift.settings({ paused: false });
      if (!res?.ok) return { ok: false, error: res?.error || "Could not resume" };
      await syncDriftIfOpen(ctx, { page: "activity" });
      return { ok: true, message: "Drift resumed" };
    }

    if (/^scan(\s|$)/i.test(t)) {
      const rest = t.replace(/^scan\s*/i, "").trim();
      const args = { force: true };
      if (rest) {
        const zones = await window.mySpace.drift.zones();
        const match = matchNamedItem(zones.zones || [], rest, "label");
        if (match.error) {
          const byPath = (zones.zones || []).find((z) =>
            String(z.path || "").toLowerCase().includes(rest.toLowerCase())
          );
          if (!byPath) return { ok: false, error: match.error };
          args.zoneId = byPath.id;
        } else {
          args.zoneId = match.item.id;
        }
      }
      const res = await window.mySpace.drift.scan(args);
      if (!res?.ok) return { ok: false, error: res?.error || "Scan failed" };
      await syncDriftIfOpen(ctx, { page: "activity" });
      if (res.skipped) return { ok: true, message: "Scan skipped. recent scan already ran" };
      const n = res.newEvents ?? res.events?.length;
      return {
        ok: true,
        message:
          n != null
            ? `Scan complete · ${n} event${n === 1 ? "" : "s"}`
            : "Scan complete",
      };
    }

    if (lower === "zones" || /^zones(\s|$)/i.test(t)) {
      const res = await window.mySpace.drift.zones();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not list zones" };
      const list = res.zones || [];
      if (!list.length) return { ok: true, message: "No zones" };
      const lines = list.slice(0, 15).map((z) => {
        const on = z.enabled === false ? " off" : "";
        return `${z.label || z.path}${on}`;
      });
      return { ok: true, message: `Zones (${list.length}): ${lines.join(" · ")}` };
    }

    if (/^insights(\s|$)/i.test(t) || lower === "stats") {
      const rest = t.replace(/^(insights|stats)\s*/i, "").trim().toLowerCase();
      let days = 7;
      if (rest === "month" || rest === "30") days = 30;
      else if (rest === "week" || rest === "7") days = 7;
      else if (/^\d+$/.test(rest)) days = Math.min(90, Math.max(7, parseInt(rest, 10)));
      const res = await window.mySpace.drift.insights({ days });
      if (!res?.ok) return { ok: false, error: res?.error || "Could not load insights" };
      const s = res.stats || {};
      const bits = [
        s.periodEvents != null ? `${s.periodEvents} events` : null,
        s.todayEvents != null ? `${s.todayEvents} today` : null,
        s.changePercent != null ? `${s.changePercent >= 0 ? "+" : ""}${s.changePercent}% vs prior` : null,
        s.enabledZones != null ? `${s.enabledZones} zones` : null,
      ].filter(Boolean);
      const topTypes = (res.byType || [])
        .slice(0, 3)
        .map((x) => `${x.label || x.type}:${x.count}`)
        .join(", ");
      if (topTypes) bits.push(topTypes);
      return {
        ok: true,
        message: bits.length
          ? `Insights (${days}d): ${bits.join(" · ")}`
          : `Insights (${days}d) ready`,
      };
    }

    if (/^(list|events)(\s|$)/i.test(t) || lower === "ls") {
      const rest = t.replace(/^(list|events|ls)\s*/i, "").trim().toLowerCase();
      const args = { limit: 20 };
      if (rest === "today" || rest === "day") args.sinceDays = 1;
      else if (rest === "week") args.sinceDays = 7;
      else if (rest === "month") args.sinceDays = 30;
      else if (/^type\s*:/i.test(rest) || EVENT_TYPE_HINT(rest)) {
        args.type = rest.replace(/^type\s*:/i, "").trim();
      } else if (rest) {
        args.q = rest;
      }
      const res = await window.mySpace.drift.events(args);
      if (!res?.ok) return { ok: false, error: res?.error || "Could not list events" };
      const events = res.events || [];
      if (!events.length) return { ok: true, message: "No events" };
      const lines = events.slice(0, 15).map((e) => e.title || e.typeLabel || e.type);
      const more = (res.total || events.length) > 15 ? ` · +${(res.total || events.length) - 15} more` : "";
      return {
        ok: true,
        message: `Events (${res.total ?? events.length}): ${lines.join(" · ")}${more}`,
      };
    }

    if (/^search(\s|$)/i.test(t) || /^find(\s|$)/i.test(t)) {
      const q = t.replace(/^(search|find)\s*/i, "").trim();
      if (!q) return { ok: false, error: "Usage: drift(search config)" };
      const res = await window.mySpace.drift.events({ q, limit: 20 });
      if (!res?.ok) return { ok: false, error: res?.error || "Search failed" };
      const events = res.events || [];
      if (!events.length) return { ok: true, message: `No matches for "${q}"` };
      return {
        ok: true,
        message: `Found ${res.total ?? events.length}: ${events
          .slice(0, 12)
          .map((e) => e.title || e.path)
          .join(" · ")}`,
      };
    }

    if (/^(open|event)(\s|$)/i.test(t)) {
      const id = t.replace(/^(open|event)\s*/i, "").trim();
      if (!id) return { ok: false, error: "Usage: drift(open <eventId>)" };
      await openDrift(ctx, { page: "activity", action: "openEvent", param: id });
      return { ok: true, message: `Opened event · ${id}` };
    }

    if (/^add(\s|$)/i.test(t) || /^watch(\s|$)/i.test(t)) {
      const pathArg = t.replace(/^(add|watch)\s*/i, "").trim();
      if (!pathArg) return { ok: false, error: "Usage: drift(add C:\\path\\to\\folder)" };
      const res = await window.mySpace.drift.addZone({ path: unquoteArg(pathArg) });
      if (!res?.ok) return { ok: false, error: res?.error || "Could not add zone" };
      await syncDriftIfOpen(ctx, { page: "zones" });
      return { ok: true, message: `Zone added · ${res.zone?.label || pathArg}` };
    }

    if (/^clear(\s|$)/i.test(t)) {
      const rest = t.replace(/^clear\s*/i, "").trim().toLowerCase();
      const args = rest === "all" || !rest ? { all: true } : { olderThanDays: parseInt(rest, 10) || 30 };
      const res = await window.mySpace.drift.clearEvents(args);
      if (!res?.ok) return { ok: false, error: res?.error || "Could not clear" };
      await syncDriftIfOpen(ctx, { page: "activity" });
      return { ok: true, message: "Events cleared" };
    }

    return {
      ok: false,
      error: `Unknown drift command "${t}". ${formatDriftCommandHelp()}`,
    };
  }

  function EVENT_TYPE_HINT(rest) {
    const known = [
      "baseline",
      "new_file",
      "modified_file",
      "deleted_file",
      "git_commit",
      "scan_complete",
      "new_folder",
    ];
    return known.includes(String(rest || "").toLowerCase());
  }

  async function resolveDeckRef(ref) {
    const listed = await window.mySpace.studyDeck.list();
    if (!listed?.ok) return { error: listed?.error || "Could not list decks" };
    const match = matchNamedItem(listed.decks || [], ref, "name");
    if (match.error) return match;
    return { deck: match.item, decks: listed.decks };
  }

  async function executeStudyDeckCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();

    if (!window.mySpace?.studyDeck) {
      return { ok: false, error: "Study Deck shell API unavailable" };
    }

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatStudyDeckCommandHelp() };
    }

    if (lower === "home") {
      await openStudyDeck(ctx, { page: "home" });
      return { ok: true, message: "Opened Study Deck · home" };
    }

    if (/^list(\s|$)/i.test(t) || lower === "ls" || lower === "decks") {
      const res = await window.mySpace.studyDeck.list();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not list decks" };
      const decks = res.decks || [];
      if (!decks.length) return { ok: true, message: "No decks" };
      const lines = decks.slice(0, 20).map((d) => {
        const due = d.dueCount ? ` · ${d.dueCount} due` : "";
        return `${d.name} (${d.cardCount || 0}${due})`;
      });
      return { ok: true, message: `Decks (${decks.length}): ${lines.join(" · ")}` };
    }

    if (/^(new|create)(\s|$)/i.test(t)) {
      const name = t.replace(/^(new|create)\s*/i, "").trim();
      if (!name) return { ok: false, error: "Usage: decks(new Biology)" };
      const res = await window.mySpace.studyDeck.create({ name });
      if (!res?.ok) return { ok: false, error: res?.error || "Could not create deck" };
      await syncStudyDeckIfOpen(ctx, { page: "home" });
      return { ok: true, message: `Created deck · ${res.deck?.name || name}` };
    }

    if (/^(delete|rm|remove)(\s|$)/i.test(t)) {
      const ref = t.replace(/^(delete|rm|remove)\s*/i, "").trim();
      if (!ref) return { ok: false, error: "Usage: decks(delete Biology)" };
      const resolved = await resolveDeckRef(ref);
      if (resolved.error) return { ok: false, error: resolved.error };
      const res = await window.mySpace.studyDeck.delete(resolved.deck.id);
      if (!res?.ok) return { ok: false, error: res?.error || "Could not delete" };
      await syncStudyDeckIfOpen(ctx, { page: "home" });
      return { ok: true, message: `Deleted deck · ${resolved.deck.name}` };
    }

    if (/^add(\s|$)/i.test(t) || /^card(\s|$)/i.test(t)) {
      let rest = t.replace(/^(add|card)\s*(card\s*)?/i, "").trim();
      if (!rest) {
        return {
          ok: false,
          error: "Usage: decks(add Biology | Mitochondria | Powerhouse of the cell)",
        };
      }
      const parts = rest.split("|").map((s) => s.trim()).filter(Boolean);
      let deckRef;
      let front;
      let back;
      if (parts.length >= 3) {
        deckRef = parts[0];
        front = parts[1];
        back = parts.slice(2).join(" | ");
      } else if (parts.length === 2) {
        front = parts[0];
        back = parts[1];
      } else {
        return {
          ok: false,
          error: "Usage: decks(add Biology | front | back)",
        };
      }
      let deckId;
      if (deckRef) {
        const resolved = await resolveDeckRef(deckRef);
        if (resolved.error) return { ok: false, error: resolved.error };
        deckId = resolved.deck.id;
      } else {
        const listed = await window.mySpace.studyDeck.list();
        const first = (listed.decks || [])[0];
        if (!first) return { ok: false, error: "No decks. create one with decks(new Name)" };
        deckId = first.id;
        deckRef = first.name;
      }
      const res = await window.mySpace.studyDeck.addCard({
        deckId,
        front,
        back,
        type: "flash",
      });
      if (!res?.ok) return { ok: false, error: res?.error || "Could not add card" };
      await syncStudyDeckIfOpen(ctx, {
        page: "deck",
        action: "openDeck",
        param: deckId,
      });
      return { ok: true, message: `Card added · ${deckRef}` };
    }

    if (/^(open|deck)(\s|$)/i.test(t)) {
      const ref = t.replace(/^(open|deck)\s*/i, "").trim();
      if (!ref) return { ok: false, error: "Usage: studydeck(open Biology)" };
      const resolved = await resolveDeckRef(ref);
      if (resolved.error) return { ok: false, error: resolved.error };
      await openStudyDeck(ctx, {
        page: "deck",
        action: "openDeck",
        param: resolved.deck.id,
      });
      return { ok: true, message: `Opened · ${resolved.deck.name}` };
    }

    if (/^study(\s|$)/i.test(t)) {
      const ref = t.replace(/^study\s*/i, "").trim();
      if (ref) {
        const resolved = await resolveDeckRef(ref);
        if (resolved.error) return { ok: false, error: resolved.error };
        await openStudyDeck(ctx, {
          page: "deck",
          action: "openDeck",
          param: resolved.deck.id,
        });
        await openStudyDeck(ctx, { page: "study" });
        return { ok: true, message: `Studying · ${resolved.deck.name}` };
      }
      await openStudyDeck(ctx, { page: "study" });
      return { ok: true, message: "Opened Study Deck · study" };
    }

    if (t && !/^(list|new|add|help|study|create|delete|rm)/i.test(t)) {
      const resolved = await resolveDeckRef(t);
      if (!resolved.error) {
        await openStudyDeck(ctx, {
          page: "deck",
          action: "openDeck",
          param: resolved.deck.id,
        });
        return { ok: true, message: `Opened · ${resolved.deck.name}` };
      }
    }

    return {
      ok: false,
      error: `Unknown decks command "${t}". ${formatStudyDeckCommandHelp()}`,
    };
  }

  function contactLabel(c) {
    const dn = String(c?.displayName || "").trim();
    if (dn) return dn;
    return `${c?.firstName || ""} ${c?.lastName || ""}`.trim() || c?.id || "Contact";
  }

  function matchContact(contacts, ref) {
    const q = String(ref || "").trim().toLowerCase();
    if (!q) return { error: "Missing contact name" };
    const pool = contacts || [];
    const byId = pool.find((c) => String(c.id || "").toLowerCase() === q);
    if (byId) return { contact: byId };
    const labeled = pool.map((c) => ({ c, label: contactLabel(c) }));
    const exact = labeled.filter((x) => x.label.toLowerCase() === q);
    if (exact.length === 1) return { contact: exact[0].c };
    const starts = labeled.filter((x) => x.label.toLowerCase().startsWith(q));
    if (starts.length === 1) return { contact: starts[0].c };
    const includes = labeled.filter((x) => x.label.toLowerCase().includes(q));
    if (includes.length === 1) return { contact: includes[0].c };
    const amb = (exact.length > 1 ? exact : starts.length > 1 ? starts : includes).slice(0, 5);
    if (amb.length > 1) {
      return { error: `Ambiguous — match one of: ${amb.map((x) => x.label).join(" · ")}` };
    }
    return { error: `Not found: ${ref}` };
  }

  function formatContactsCommandHelp() {
    return [
      "contacts(list) · contacts(search Dana) · contacts(upcoming)",
      "contacts(add Dana | dana@mail.com | +972…) · contacts(delete Dana)",
      "contacts(email Dana) · contacts(phone Dana) · contacts(sms Dana)",
      "contacts(open Dana) · contacts(groups) · contacts(browse)",
    ].join(" · ");
  }

  async function executeContactsCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();

    if (!window.mySpace?.contacts) {
      return { ok: false, error: "Contacts shell API unavailable" };
    }

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatContactsCommandHelp() };
    }

    const pages = ["browse", "reminders", "groups"];
    if (pages.includes(lower)) {
      await openContacts(ctx, { page: lower });
      return { ok: true, message: `Opened Contacts · ${lower}` };
    }

    if (/^list(\s|$)/i.test(t) || lower === "ls") {
      const res = await window.mySpace.contacts.load();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not load contacts" };
      const contacts = res.data?.contacts || [];
      if (!contacts.length) return { ok: true, message: "No contacts" };
      const lines = contacts.slice(0, 20).map((c) => {
        const email = c.emails?.[0]?.value ? ` <${c.emails[0].value}>` : "";
        return `${contactLabel(c)}${email}`;
      });
      const more = contacts.length > 20 ? ` · +${contacts.length - 20} more` : "";
      return { ok: true, message: `Contacts (${contacts.length}): ${lines.join(" · ")}${more}` };
    }

    if (/^search(\s|$)/i.test(t) || /^find(\s|$)/i.test(t)) {
      const q = t.replace(/^(search|find)\s*/i, "").trim().toLowerCase();
      if (!q) return { ok: false, error: "Usage: contacts(search Dana)" };
      const res = await window.mySpace.contacts.load();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not load contacts" };
      const hits = (res.data?.contacts || []).filter((c) => {
        const blob = [
          contactLabel(c),
          c.company,
          c.notes,
          ...(c.emails || []).map((e) => e.value),
          ...(c.phones || []).map((p) => p.value),
          ...(c.tags || []),
        ]
          .join(" ")
          .toLowerCase();
        return blob.includes(q);
      });
      if (!hits.length) return { ok: true, message: `No matches for "${q}"` };
      return {
        ok: true,
        message: `Found ${hits.length}: ${hits
          .slice(0, 12)
          .map((c) => contactLabel(c))
          .join(" · ")}`,
      };
    }

    if (/^upcoming(\s|$)/i.test(t) || lower === "reminders") {
      if (lower === "reminders") {
        await openContacts(ctx, { page: "reminders" });
        return { ok: true, message: "Opened Contacts · reminders" };
      }
      const res = await window.mySpace.contacts.upcoming();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not load upcoming" };
      const items = res.upcoming || [];
      if (!items.length) return { ok: true, message: "No upcoming birthdays or reminders" };
      const lines = items.slice(0, 12).map((u) => {
        if (u.type === "birthday") {
          return `${u.name} birthday in ${u.daysUntil}d`;
        }
        return `${u.name}: ${u.title || "reminder"}${u.date ? ` ${u.date}` : ""}${
          u.time ? ` ${u.time}` : ""
        }`;
      });
      return { ok: true, message: `Upcoming: ${lines.join(" · ")}` };
    }

    if (/^(add|new|create)(\s|$)/i.test(t)) {
      const rest = t.replace(/^(add|new|create)\s*/i, "").trim();
      if (!rest) return { ok: false, error: "Usage: contacts(add Dana | dana@mail.com | +972…)" };
      let name = rest;
      let email = "";
      let phone = "";
      if (rest.includes("|")) {
        const parts = rest.split("|").map((s) => s.trim());
        name = parts[0] || "";
        email = parts[1] || "";
        phone = parts[2] || "";
      } else {
        const emailMatch = rest.match(/[\w.+-]+@[\w.-]+\.\w+/);
        const phoneMatch = rest.match(/(?:\+?\d[\d\s\-()]{6,}\d)/);
        if (emailMatch) {
          email = emailMatch[0];
          name = name.replace(emailMatch[0], "");
        }
        if (phoneMatch) {
          phone = phoneMatch[0].replace(/\s/g, "");
          name = name.replace(phoneMatch[0], "");
        }
        name = name.replace(/\s+/g, " ").trim();
      }
      if (!name) return { ok: false, error: "Name required" };
      const bits = name.split(/\s+/);
      const firstName = bits[0];
      const lastName = bits.slice(1).join(" ");
      const res = await window.mySpace.contacts.add({
        firstName,
        lastName,
        displayName: name,
        email: email || undefined,
        phone: phone || undefined,
      });
      if (!res?.ok) return { ok: false, error: res?.error || "Could not add contact" };
      await syncContactsIfOpen(ctx, { page: "browse" });
      return { ok: true, message: `Added · ${contactLabel(res.contact) || name}` };
    }

    if (/^(delete|rm|remove)(\s|$)/i.test(t)) {
      const ref = t.replace(/^(delete|rm|remove)\s*/i, "").trim();
      if (!ref) return { ok: false, error: "Usage: contacts(delete Dana)" };
      const loaded = await window.mySpace.contacts.load();
      if (!loaded?.ok) return { ok: false, error: loaded?.error || "Could not load contacts" };
      const match = matchContact(loaded.data?.contacts || [], ref);
      if (match.error) return { ok: false, error: match.error };
      const res = await window.mySpace.contacts.delete(match.contact.id);
      if (!res?.ok) return { ok: false, error: res?.error || "Could not delete" };
      await syncContactsIfOpen(ctx, { page: "browse" });
      return { ok: true, message: `Deleted · ${contactLabel(match.contact)}` };
    }

    if (/^(email|mail)(\s|$)/i.test(t)) {
      const ref = t.replace(/^(email|mail)\s*/i, "").trim();
      if (!ref) return { ok: false, error: "Usage: contacts(email Dana)" };
      const loaded = await window.mySpace.contacts.load();
      if (!loaded?.ok) return { ok: false, error: loaded?.error || "Could not load contacts" };
      const match = matchContact(loaded.data?.contacts || [], ref);
      if (match.error) return { ok: false, error: match.error };
      const email = match.contact.emails?.[0]?.value;
      if (!email) return { ok: false, error: `${contactLabel(match.contact)} has no email` };
      const res = await window.mySpace.contacts.email(email);
      if (!res?.ok) return { ok: false, error: res?.error || "Could not open email" };
      return { ok: true, message: `Email · ${contactLabel(match.contact)} <${email}>` };
    }

    if (/^(phone|call|tel)(\s|$)/i.test(t)) {
      const ref = t.replace(/^(phone|call|tel)\s*/i, "").trim();
      if (!ref) return { ok: false, error: "Usage: contacts(phone Dana)" };
      const loaded = await window.mySpace.contacts.load();
      if (!loaded?.ok) return { ok: false, error: loaded?.error || "Could not load contacts" };
      const match = matchContact(loaded.data?.contacts || [], ref);
      if (match.error) return { ok: false, error: match.error };
      const phone = match.contact.phones?.[0]?.value;
      if (!phone) return { ok: false, error: `${contactLabel(match.contact)} has no phone` };
      const res = await window.mySpace.contacts.phone(phone);
      if (!res?.ok) return { ok: false, error: res?.error || "Could not open phone" };
      return { ok: true, message: `Call · ${contactLabel(match.contact)} ${phone}` };
    }

    if (/^sms(\s|$)/i.test(t) || /^text(\s|$)/i.test(t)) {
      const ref = t.replace(/^(sms|text)\s*/i, "").trim();
      if (!ref) return { ok: false, error: "Usage: contacts(sms Dana)" };
      const loaded = await window.mySpace.contacts.load();
      if (!loaded?.ok) return { ok: false, error: loaded?.error || "Could not load contacts" };
      const match = matchContact(loaded.data?.contacts || [], ref);
      if (match.error) return { ok: false, error: match.error };
      const phone = match.contact.phones?.[0]?.value;
      if (!phone) return { ok: false, error: `${contactLabel(match.contact)} has no phone` };
      const res = await window.mySpace.contacts.sms(phone);
      if (!res?.ok) return { ok: false, error: res?.error || "Could not open sms" };
      return { ok: true, message: `SMS · ${contactLabel(match.contact)} ${phone}` };
    }

    if (/^open(\s|$)/i.test(t)) {
      const ref = t.replace(/^open\s*/i, "").trim();
      if (!ref) {
        await openContacts(ctx, { page: "browse" });
        return { ok: true, message: "Opened Contacts" };
      }
      if (pages.includes(ref.toLowerCase())) {
        await openContacts(ctx, { page: ref.toLowerCase() });
        return { ok: true, message: `Opened Contacts · ${ref.toLowerCase()}` };
      }
      const loaded = await window.mySpace.contacts.load();
      if (!loaded?.ok) return { ok: false, error: loaded?.error || "Could not load contacts" };
      const match = matchContact(loaded.data?.contacts || [], ref);
      if (match.error) return { ok: false, error: match.error };
      await openContacts(ctx, {
        page: "browse",
        action: "openContact",
        param: match.contact.id,
      });
      return { ok: true, message: `Opened · ${contactLabel(match.contact)}` };
    }

    return {
      ok: false,
      error: `Unknown contacts command "${t}". ${formatContactsCommandHelp()}`,
    };
  }

  function formatNotesCommandHelp() {
    return [
      "notes(list) · notes(search meeting) · notes(pinned) · notes(archive)",
      "notes(add Buy milk #errands) · notes(add Title | body text)",
      "notes(pin Buy milk) · notes(archive Buy milk) · notes(delete Buy milk)",
      "notes(open Buy milk) · notes(get Buy milk) · notes(help)",
    ].join(" · ");
  }

  async function executeNotesCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();

    if (!window.mySpace?.notes) {
      return { ok: false, error: "Notes shell API unavailable" };
    }

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatNotesCommandHelp() };
    }

    const pages = ["all", "pinned", "archive", "archived"];
    if (pages.includes(lower)) {
      const page = lower === "archived" ? "archive" : lower;
      await openNotes(ctx, { page });
      return { ok: true, message: `Opened Notes · ${page}` };
    }

    if (lower === "open" || lower === "browse") {
      await openNotes(ctx, { page: "all" });
      return { ok: true, message: "Opened Notes" };
    }

    if (/^list(\s|$)/i.test(t) || lower === "ls") {
      const res = await window.mySpace.notes.list({});
      if (!res?.ok) return { ok: false, error: res?.error || "Could not list notes" };
      const notes = res.notes || [];
      if (!notes.length) return { ok: true, message: "No notes" };
      const lines = notes.slice(0, 20).map((n) => {
        const pin = n.pinned ? "● " : "";
        const tags = (n.tags || []).slice(0, 2).map((x) => `#${x}`).join(" ");
        return `${pin}${n.title || "Untitled"}${tags ? ` ${tags}` : ""}`;
      });
      const more = notes.length > 20 ? ` · +${notes.length - 20} more` : "";
      return { ok: true, message: `Notes (${notes.length}): ${lines.join(" · ")}${more}` };
    }

    if (/^search(\s|$)/i.test(t) || /^find(\s|$)/i.test(t)) {
      const q = t.replace(/^(search|find)\s*/i, "").trim();
      if (!q) return { ok: false, error: "Usage: notes(search meeting)" };
      const res = await window.mySpace.notes.search(q);
      if (!res?.ok) return { ok: false, error: res?.error || "Search failed" };
      const notes = res.notes || [];
      if (!notes.length) return { ok: true, message: `No matches for "${q}"` };
      await syncNotesIfOpen(ctx, { page: "all", q });
      return {
        ok: true,
        message: `Found ${notes.length}: ${notes
          .slice(0, 12)
          .map((n) => n.title || "Untitled")
          .join(" · ")}`,
      };
    }

    if (/^get(\s|$)/i.test(t)) {
      const ref = t.replace(/^get\s*/i, "").trim();
      if (!ref) return { ok: false, error: "Usage: notes(get Buy milk)" };
      const res = await window.mySpace.notes.get(ref);
      if (!res?.ok) return { ok: false, error: res?.error || "Not found" };
      const n = res.note;
      const preview = String(n.body || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 140);
      const tags = (n.tags || []).map((x) => `#${x}`).join(" ");
      return {
        ok: true,
        message: `${n.title || "Untitled"}${tags ? ` ${tags}` : ""}${
          preview ? ` — ${preview}` : ""
        }`,
      };
    }

    if (/^(add|new|create)(\s|$)/i.test(t)) {
      const rest = t.replace(/^(add|new|create)\s*/i, "").trim();
      if (!rest) return { ok: false, error: "Usage: notes(add Buy milk #errands) or notes(add Title | body)" };
      const res = await window.mySpace.notes.add({ text: rest });
      if (!res?.ok) return { ok: false, error: res?.error || "Could not add note" };
      await syncNotesIfOpen(ctx, { page: "all", noteId: res.note?.id });
      const tags = (res.note?.tags || []).map((x) => `#${x}`).join(" ");
      return {
        ok: true,
        message: `Added · ${res.note?.title || "Untitled"}${tags ? ` ${tags}` : ""}`,
      };
    }

    if (/^pin(\s|$)/i.test(t) || /^unpin(\s|$)/i.test(t)) {
      const unpin = /^unpin/i.test(t);
      const ref = t.replace(/^(un)?pin\s*/i, "").trim();
      if (!ref) return { ok: false, error: "Usage: notes(pin Buy milk)" };
      const res = await window.mySpace.notes.pin(unpin ? { ref, pinned: false } : { ref });
      if (!res?.ok) return { ok: false, error: res?.error || "Pin failed" };
      await syncNotesIfOpen(ctx, { page: "all", noteId: res.note?.id });
      return {
        ok: true,
        message: `${res.note?.pinned ? "Pinned" : "Unpinned"} · ${res.note?.title || ref}`,
      };
    }

    if (/^archive(\s|$)/i.test(t) || /^unarchive(\s|$)/i.test(t)) {
      const un = /^unarchive/i.test(t);
      const ref = t.replace(/^un?archive\s*/i, "").trim();
      if (!ref) {
        if (!un) {
          await openNotes(ctx, { page: "archive" });
          return { ok: true, message: "Opened Notes · archive" };
        }
        return { ok: false, error: "Usage: notes(unarchive Buy milk)" };
      }
      const res = await window.mySpace.notes.archive(un ? { ref, archived: false } : { ref });
      if (!res?.ok) return { ok: false, error: res?.error || "Archive failed" };
      await syncNotesIfOpen(ctx, {
        page: res.note?.archived ? "archive" : "all",
        noteId: res.note?.id,
      });
      return {
        ok: true,
        message: `${res.note?.archived ? "Archived" : "Unarchived"} · ${res.note?.title || ref}`,
      };
    }

    if (/^(delete|rm|remove)(\s|$)/i.test(t)) {
      const ref = t.replace(/^(delete|rm|remove)\s*/i, "").trim();
      if (!ref) return { ok: false, error: "Usage: notes(delete Buy milk)" };
      const res = await window.mySpace.notes.delete(ref);
      if (!res?.ok) return { ok: false, error: res?.error || "Could not delete" };
      await syncNotesIfOpen(ctx, { page: "all" });
      return { ok: true, message: `Deleted · ${ref}` };
    }

    if (/^open(\s|$)/i.test(t)) {
      const ref = t.replace(/^open\s*/i, "").trim();
      if (!ref) {
        await openNotes(ctx, { page: "all" });
        return { ok: true, message: "Opened Notes" };
      }
      if (pages.includes(ref.toLowerCase())) {
        const page = ref.toLowerCase() === "archived" ? "archive" : ref.toLowerCase();
        await openNotes(ctx, { page });
        return { ok: true, message: `Opened Notes · ${page}` };
      }
      const res = await window.mySpace.notes.get(ref);
      if (!res?.ok) return { ok: false, error: res?.error || "Not found" };
      await openNotes(ctx, {
        page: res.note.archived ? "archive" : "all",
        action: "openNote",
        param: res.note.id,
      });
      return { ok: true, message: `Opened · ${res.note.title || "Untitled"}` };
    }

    return {
      ok: false,
      error: `Unknown notes command "${t}". ${formatNotesCommandHelp()}`,
    };
  }

  function formatTasksCommandHelp() {
    return [
      "tasks(list) · tasks(inbox) · tasks(next) · gtd(today) · todo(flagged)",
      "tasks(add Buy milk @next #errands) · tasks(add Title | notes +Project due:tomorrow)",
      "tasks(done Buy milk) · tasks(flag Buy milk) · tasks(move Buy milk waiting)",
      "tasks(schedule Buy milk) · tasks(project Website) · tasks(delete Buy milk)",
      "tasks(open Buy milk) · tasks(help)",
      "Note: Today (timed agenda) is today(…): Tasks is projects & next actions",
    ].join(" · ");
  }

  async function executeTasksCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();

    if (!window.mySpace?.tasks) {
      return { ok: false, error: "Tasks shell API unavailable" };
    }

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatTasksCommandHelp() };
    }

    const pages = [
      "inbox",
      "today",
      "upcoming",
      "next",
      "waiting",
      "someday",
      "flagged",
      "all",
      "done",
      "home",
    ];
    if (pages.includes(lower)) {
      const page = lower === "home" ? "inbox" : lower;
      await openTasks(ctx, { page });
      return { ok: true, message: `Opened Tasks · ${page}` };
    }

    if (lower === "open" || lower === "browse" || lower === "panel") {
      await openTasks(ctx, { page: "inbox" });
      return { ok: true, message: "Opened Tasks" };
    }

    if (/^list(\s|$)/i.test(t) || lower === "ls") {
      const rest = t.replace(/^(list|ls)\s*/i, "").trim().toLowerCase();
      const view = pages.includes(rest) ? (rest === "home" ? "inbox" : rest) : "inbox";
      const res = await window.mySpace.tasks.list({ view });
      if (!res?.ok) return { ok: false, error: res?.error || "Could not list tasks" };
      const items = res.items || [];
      if (!items.length) return { ok: true, message: `No tasks in ${view}` };
      const lines = items.slice(0, 20).map((i) => {
        const flag = i.flagged ? "★ " : "";
        const prio = i.priority ? ` P${i.priority}` : "";
        return `${flag}${i.title || "Untitled"}${prio}`;
      });
      const more = items.length > 20 ? ` · +${items.length - 20} more` : "";
      return { ok: true, message: `Tasks · ${view} (${items.length}): ${lines.join(" · ")}${more}` };
    }

    if (/^search(\s|$)/i.test(t) || /^find(\s|$)/i.test(t)) {
      const q = t.replace(/^(search|find)\s*/i, "").trim();
      if (!q) return { ok: false, error: "Usage: tasks(search meeting)" };
      const res = await window.mySpace.tasks.search(q);
      if (!res?.ok) return { ok: false, error: res?.error || "Search failed" };
      const items = res.items || [];
      if (!items.length) return { ok: true, message: `No matches for "${q}"` };
      await syncTasksIfOpen(ctx, { page: "all", q });
      return {
        ok: true,
        message: `Found ${items.length}: ${items
          .slice(0, 12)
          .map((i) => i.title || "Untitled")
          .join(" · ")}`,
      };
    }

    if (/^get(\s|$)/i.test(t)) {
      const ref = t.replace(/^get\s*/i, "").trim();
      if (!ref) return { ok: false, error: "Usage: tasks(get Buy milk)" };
      const res = await window.mySpace.tasks.get(ref);
      if (!res?.ok) return { ok: false, error: res?.error || "Not found" };
      const i = res.item;
      const bits = [
        i.title,
        i.bucket,
        i.dueDate ? `due ${i.dueDate}` : null,
        i.flagged ? "flagged" : null,
      ].filter(Boolean);
      return { ok: true, message: bits.join(" · ") };
    }

    if (/^(add|new|create)(\s|$)/i.test(t)) {
      const rest = t.replace(/^(add|new|create)\s*/i, "").trim();
      if (!rest) {
        return {
          ok: false,
          error: "Usage: tasks(add Buy milk @next) or tasks(add Title | notes +Project)",
        };
      }
      const res = await window.mySpace.tasks.add({ text: rest });
      if (!res?.ok) return { ok: false, error: res?.error || "Could not add task" };
      await syncTasksIfOpen(ctx, { page: res.item?.bucket || "inbox", itemId: res.item?.id });
      return {
        ok: true,
        message: `Added · ${res.item?.title || "Task"} · ${res.item?.bucket || "inbox"}`,
      };
    }

    if (/^(done|complete|toggle)(\s|$)/i.test(t)) {
      const ref = t.replace(/^(done|complete|toggle)\s*/i, "").trim();
      if (!ref) return { ok: false, error: "Usage: tasks(done Buy milk)" };
      const res = await window.mySpace.tasks.toggle({ ref });
      if (!res?.ok) return { ok: false, error: res?.error || "Update failed" };
      await syncTasksIfOpen(ctx, { page: "all", itemId: res.item?.id });
      return {
        ok: true,
        message: `${res.item?.status === "done" ? "Done" : "Reopened"} · ${res.item?.title || ref}`,
      };
    }

    if (/^flag(\s|$)/i.test(t) || /^unflag(\s|$)/i.test(t)) {
      const un = /^unflag/i.test(t);
      const ref = t.replace(/^(un)?flag\s*/i, "").trim();
      if (!ref) return { ok: false, error: "Usage: tasks(flag Buy milk)" };
      const res = await window.mySpace.tasks.flag(un ? { ref, flagged: false } : { ref });
      if (!res?.ok) return { ok: false, error: res?.error || "Flag failed" };
      await syncTasksIfOpen(ctx, { page: "flagged", itemId: res.item?.id });
      return {
        ok: true,
        message: `${res.item?.flagged ? "Flagged" : "Unflagged"} · ${res.item?.title || ref}`,
      };
    }

    if (/^move(\s|$)/i.test(t)) {
      const rest = t.replace(/^move\s*/i, "").trim();
      const m = rest.match(/^(.+?)\s+(inbox|next|waiting|someday)\s*$/i);
      if (!m) return { ok: false, error: "Usage: tasks(move Buy milk next)" };
      const res = await window.mySpace.tasks.move({ ref: m[1].trim(), bucket: m[2].toLowerCase() });
      if (!res?.ok) return { ok: false, error: res?.error || "Move failed" };
      await syncTasksIfOpen(ctx, { page: res.item?.bucket || "all", itemId: res.item?.id });
      return { ok: true, message: `Moved · ${res.item?.title || m[1]} → ${res.item?.bucket}` };
    }

    if (/^schedule(\s|$)/i.test(t) || /^today(\s|$)/i.test(t)) {
      const ref = t.replace(/^(schedule|today)\s*/i, "").trim();
      if (!ref) return { ok: false, error: "Usage: tasks(schedule Buy milk)" };
      const res = await window.mySpace.tasks.scheduleToday({ ref });
      if (!res?.ok) return { ok: false, error: res?.error || "Schedule failed" };
      await syncTasksIfOpen(ctx, { page: "today", itemId: res.item?.id });
      return { ok: true, message: `Scheduled on Today · ${res.item?.title || ref}` };
    }

    if (/^project(\s|$)/i.test(t)) {
      const name = t.replace(/^project\s*/i, "").trim();
      if (!name) {
        const res = await window.mySpace.tasks.projects();
        if (!res?.ok) return { ok: false, error: res?.error || "Could not list projects" };
        const projects = (res.projects || []).filter((p) => !p.archived);
        if (!projects.length) return { ok: true, message: "No projects. tasks(project Website)" };
        return {
          ok: true,
          message: `Projects (${projects.length}): ${projects.map((p) => p.name).join(" · ")}`,
        };
      }
      const res = await window.mySpace.tasks.addProject({ name });
      if (!res?.ok) return { ok: false, error: res?.error || "Could not create project" };
      await openTasks(ctx, { page: "all", projectId: res.project?.id });
      return { ok: true, message: `Project · ${res.project?.name}` };
    }

    if (/^(delete|rm|remove)(\s|$)/i.test(t)) {
      const ref = t.replace(/^(delete|rm|remove)\s*/i, "").trim();
      if (!ref) return { ok: false, error: "Usage: tasks(delete Buy milk)" };
      const res = await window.mySpace.tasks.delete({ ref });
      if (!res?.ok) return { ok: false, error: res?.error || "Could not delete" };
      await syncTasksIfOpen(ctx, { page: "inbox" });
      return { ok: true, message: `Deleted · ${ref}` };
    }

    if (/^open(\s|$)/i.test(t)) {
      const ref = t.replace(/^open\s*/i, "").trim();
      if (!ref) {
        await openTasks(ctx, { page: "inbox" });
        return { ok: true, message: "Opened Tasks" };
      }
      if (pages.includes(ref.toLowerCase())) {
        const page = ref.toLowerCase() === "home" ? "inbox" : ref.toLowerCase();
        await openTasks(ctx, { page });
        return { ok: true, message: `Opened Tasks · ${page}` };
      }
      const res = await window.mySpace.tasks.get(ref);
      if (!res?.ok) return { ok: false, error: res?.error || "Not found" };
      await openTasks(ctx, {
        page: "all",
        action: "openTask",
        param: res.item.id,
      });
      return { ok: true, message: `Opened · ${res.item.title || "Task"}` };
    }

    return {
      ok: false,
      error: `Unknown tasks command "${t}". ${formatTasksCommandHelp()}`,
    };
  }

  function formatChatCommandHelp() {
    return [
      "Chat is a ChatGPT-style app powered by Mind",
      "chat(new) · chat(list) · chat(open) · chat(settings) · chat(help)",
    ].join(" · ");
  }

  async function executeChatCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();
    if (!window.mySpace?.chat) {
      return { ok: false, error: "Chat shell API unavailable" };
    }
    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatChatCommandHelp() };
    }
    if (lower === "new" || lower === "create") {
      await openChatApp(ctx, { page: "home", action: "newChat" });
      const res = await window.mySpace.chat.create();
      if (res?.ok === false) return { ok: false, error: res.error || "Could not create chat" };
      return { ok: true, message: `New chat · ${res.conversation?.title || "New chat"}` };
    }
    if (lower === "open" || lower === "home" || lower === "panel") {
      await openChatApp(ctx, { page: "home" });
      return { ok: true, message: "Opened Chat" };
    }
    if (lower === "settings" || lower === "setup") {
      await openChatApp(ctx, { page: "settings", action: "openSettings" });
      return { ok: true, message: "Opened Chat · settings" };
    }
    if (lower === "list" || lower === "ls") {
      const res = await window.mySpace.chat.list();
      if (res?.ok === false) return { ok: false, error: res.error || "Could not list chats" };
      const items = res.conversations || [];
      if (!items.length) return { ok: true, message: "No chats yet" };
      const lines = items.slice(0, 12).map((c) => c.title || "New chat");
      return {
        ok: true,
        message: `Chats (${items.length}): ${lines.join(" · ")}${items.length > 12 ? "…" : ""}`,
      };
    }
    if (lower.startsWith("ask ") || lower.startsWith("send ")) {
      const text = t.replace(/^(ask|send)\s+/i, "").trim();
      if (!text) return { ok: false, error: "Usage: chat(ask <message>)" };
      await openChatApp(ctx, { page: "home" });
      const res = await window.mySpace.chat.send({ text });
      if (res?.ok === false) return { ok: false, error: res.error || "Send failed" };
      const reply = String(res.message?.content || "").slice(0, 240);
      return { ok: true, message: reply || "Sent" };
    }
    return {
      ok: false,
      error: `Unknown chat command "${t}". ${formatChatCommandHelp()}`,
    };
  }

  function formatTranslateCommandHelp() {
    return [
      "translate(hello) · translate(שלום) · translate(bonjour -> en) · translate(hello to hebrew)",
      "translate(text:shalom, from:he, to:en) · translate(detect bonjour)",
      "translate(languages) · translate(history) · translate(open phrases)",
    ].join(" · ");
  }

  function looksLikeLangToken(tok) {
    const t = String(tok || "").trim().toLowerCase();
    if (!t) return false;
    if (/^[a-z]{2}(-[a-z]{2})?$/i.test(t)) return true;
    if (/^(auto|hebrew|english|french|german|spanish|arabic|russian|chinese|portuguese|italian|japanese|korean|ivrit)$/i.test(t)) {
      return true;
    }
    return false;
  }

  function parseTranslatePayload(raw) {
    const original = String(raw || "").trim();
    let from = "auto";
    let to = null;
    let text = "";
    let page = null;
    let toExplicit = false;

    if (!original) return { text: "", from, to, page, toExplicit };

    const arrow = original.match(/^(.+?)\s*(?:->|=>|→)\s*([^\s,]+)\s*$/u);
    if (arrow) {
      return {
        text: arrow[1].trim(),
        from: "auto",
        to: arrow[2].trim(),
        page: null,
        toExplicit: true,
      };
    }

    const parts = splitArgList(original);
    const allKv =
      parts.length > 0 &&
      parts.every((p) => /^([a-z_][a-z0-9_-]*)\s*:\s*(.+)$/i.test(String(p).trim()));
    const { map, positional, keys } = parseArgStructure(original);
    const classicTranslate =
      keys.includes("text") ||
      keys.includes("page") ||
      keys.includes("q") ||
      keys.includes("source") ||
      (allKv && (keys.includes("to") || keys.includes("from")));

    if (classicTranslate) {
      page = map.page || null;
      text = String(map.text || map.q || map.source || map.query || positional.join(" ") || "").trim();
      if (map.from) from = String(map.from).trim();
      if (map.to || map.target || map.into) {
        let rawTo = String(map.to || map.target || map.into).trim();
        if (!text) {
          const m = rawTo.match(/^(\S+)\s+(.+)$/);
          if (m && looksLikeLangToken(m[1])) {
            rawTo = m[1];
            text = m[2].trim();
          }
        }
        to = rawTo;
        toExplicit = true;
      }
      return { text, from, to, page, toExplicit };
    }

    let work = original;
    const keyRe = /\b(from|to|into|target)\s*[:=]\s*([a-zA-Z-]{2,}|[^\s,]+)/gi;
    work = work.replace(keyRe, (_full, key, val) => {
      const k = String(key).toLowerCase();
      if (k === "from") from = val;
      else {
        to = val;
        toExplicit = true;
      }
      return " ";
    });

    const naturalTo = work.match(/^(?:to|into)\s+([a-zA-Z-]{2,}|\S+)\s+(.+)$/i);
    if (naturalTo && looksLikeLangToken(naturalTo[1])) {
      to = naturalTo[1];
      toExplicit = true;
      text = naturalTo[2].trim();
      return { text, from, to, page: null, toExplicit };
    }
    const trailingTo = work.match(/^(.+?)\s+(?:to|into)\s+([a-zA-Z-]{2,}|\S+)\s*$/i);
    if (trailingTo && looksLikeLangToken(trailingTo[2])) {
      text = trailingTo[1].trim();
      to = trailingTo[2];
      toExplicit = true;
      return { text, from, to, page: null, toExplicit };
    }

    text = work.replace(/\s+/g, " ").trim();
    if (
      (text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'"))
    ) {
      text = text.slice(1, -1).trim();
    }
    return { text, from, to, page: null, toExplicit };
  }

  async function runSilentTranslate(payload) {
    const text = String(payload?.text || "").trim();
    if (!text) return { ok: false, error: "Missing text to translate" };
    const args = {
      text,
      from: payload.from || "auto",
    };
    if (payload.toExplicit && payload.to) args.to = payload.to;
    else if (payload.to) args.to = payload.to;

    const res = await window.mySpace.translate.text(args);
    if (!res?.ok) return { ok: false, error: res?.error || "Translation failed" };

    try {
      await window.mySpace.translate.addHistory?.({
        source: res.source || text,
        translation: res.translation,
        from: res.from,
        to: res.to,
        provider: res.provider,
      });
    } catch {
    }

    return {
      ok: true,
      message: `${res.fromName || res.from} → ${res.toName || res.to}: ${res.translation}`,
      result: res,
    };
  }

  async function executeTranslateCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();
    const pages = ["translate", "history", "phrases", "batch", "settings"];

    if (!window.mySpace?.translate) {
      return { ok: false, error: "Translate shell API unavailable" };
    }

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatTranslateCommandHelp() };
    }

    if (/^languages?(\s|$)/i.test(t) || lower === "langs") {
      const res = await window.mySpace.translate.languages();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not list languages" };
      const langs = res.languages || [];
      const sample = langs
        .slice(0, 16)
        .map((l) => `${l.code}:${l.name}`)
        .join(" · ");
      return { ok: true, message: `Languages (${langs.length}): ${sample}…` };
    }

    if (/^detect(\s|$)/i.test(t)) {
      const text = t.replace(/^detect\s*/i, "").trim();
      if (!text) return { ok: false, error: "Usage: translate(detect bonjour)" };
      const res = await window.mySpace.translate.detect(text);
      if (!res?.ok) return { ok: false, error: res?.error || "Detect failed" };
      return { ok: true, message: `Detected · ${res.name || res.lang} (${res.lang})` };
    }

    if (/^history(\s|$)/i.test(t)) {
      const res = await window.mySpace.translate.load();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not load history" };
      const hist = res.data?.history || [];
      if (!hist.length) return { ok: true, message: "No translation history" };
      const lines = hist.slice(0, 8).map((h) => {
        const src = String(h.source || "").slice(0, 40);
        const dst = String(h.translation || "").slice(0, 40);
        return `${src} → ${dst}`;
      });
      return { ok: true, message: `History (${hist.length}): ${lines.join(" · ")}` };
    }

    if (/^open(\s|$)/i.test(t)) {
      const rest = t.replace(/^open\s*/i, "").trim().toLowerCase() || "translate";
      if (!pages.includes(rest)) {
        return { ok: false, error: `Unknown page "${rest}". Pages: ${pages.join(", ")}` };
      }
      await openTranslate(ctx, { page: rest });
      return { ok: true, message: `Opened Translate · ${rest}` };
    }

    if (pages.includes(lower) && lower !== "translate") {
      await openTranslate(ctx, { page: lower });
      return { ok: true, message: `Opened Translate · ${lower}` };
    }

    let body = t;
    if (/^translate(\s|$)/i.test(t)) {
      body = t.replace(/^translate\s*/i, "").trim();
      if (!body) return { ok: false, error: "Usage: translate(hello -> en)" };
    }

    const payload = parseTranslatePayload(body);
    if (payload.page) {
      const page = String(payload.page).toLowerCase();
      if (!pages.includes(page)) {
        return { ok: false, error: `Unknown page "${payload.page}". Pages: ${pages.join(", ")}` };
      }
      await openTranslate(ctx, { page });
      return { ok: true, message: `Opened Translate · ${page}` };
    }

    const out = await runSilentTranslate(payload);
    if (!out.ok) {
      return {
        ok: false,
        error: out.error || `Unknown translate command "${t}". ${formatTranslateCommandHelp()}`,
      };
    }
    await syncTranslateIfOpen(ctx, { page: "translate" });
    return { ok: true, message: out.message };
  }

  function formatSysInfoCommandHelp() {
    return [
      "sysinfo(scan) · sys(cpu) · sys(memory) · sys(storage) · sys(processes)",
      "sys(network) · sys(ports) · sys(environment) · sys(performance)",
      "sysinfo(open cpu) · sys(disk) · sys(help)",
    ].join(" · ");
  }

  function formatSysScanResult(page, res) {
    if (!res?.ok) return res?.error || "Scan failed";
    if (page === "system") {
      const s = res.summary || res.info || {};
      return `System · ${s.hostname || "—"} · ${s.os || res.info?.osName || "—"} · up ${
        s.uptime || res.info?.uptimeLabel || "—"
      } · RAM ${s.ram || res.info?.totalRamLabel || "—"}`;
    }
    if (page === "cpu") {
      const s = res.summary || {};
      return `CPU · ${s.model || res.processor?.name || "—"} · ${s.usagePercent ?? "—"}% · ${
        s.cores || "—"
      } cores / ${s.threads || "—"} threads`;
    }
    if (page === "memory") {
      const p = res.physical || {};
      return `Memory · ${p.usedLabel || "—"} / ${p.totalLabel || "—"} (${p.usagePercent ?? "—"}%)`;
    }
    if (page === "storage" || page === "disk") {
      const s = res.summary || {};
      const drives = (res.drives || [])
        .slice(0, 6)
        .map((d) => `${d.letter} ${d.freeLabel || "?"} free`)
        .join(" · ");
      return `Storage · ${s.drives || 0} drives · ${s.usedLabel || "—"} / ${s.totalLabel || "—"} used${
        drives ? ` · ${drives}` : ""
      }`;
    }
    if (page === "processes") {
      const s = res.summary || {};
      const top = (res.processes || [])
        .slice(0, 5)
        .map((p) => `${p.name} ${p.memoryLabel || ""}`)
        .join(" · ");
      return `Processes · ${s.total || 0} total · ${s.running || 0} running${
        top ? ` · top: ${top}` : ""
      }`;
    }
    if (page === "network") {
      const s = res.summary || {};
      const adapters = (res.adapters || [])
        .slice(0, 4)
        .map((a) => a.name || a.Name || a.InterfaceAlias || "?")
        .join(" · ");
      return `Network · ${s.adapters ?? "—"} adapters · ${s.connected ?? "—"} connected${
        adapters ? ` · ${adapters}` : ""
      }`;
    }
    if (page === "ports") {
      const s = res.summary || {};
      return `Ports · ${s.total || 0} · listening ${s.listening || 0} · established ${
        s.established || 0
      }`;
    }
    if (page === "environment") {
      const s = res.summary || {};
      return `Environment · ${s.total || 0} variables`;
    }
    if (page === "performance") {
      const c = res.current || {};
      return `Performance · CPU ${c.cpu ?? "—"}% · mem ${c.memory ?? "—"}% · disk ${
        c.disk ?? "—"
      }%`;
    }
    return `Scan ok · ${page}`;
  }

  async function executeSysInfoCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();
    const pages = ROUTE_REGISTRY["system-info"].pages;

    if (!window.mySpace?.sysinfo) {
      return { ok: false, error: "System Info shell API unavailable" };
    }

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatSysInfoCommandHelp() };
    }

    if (/^open(\s|$)/i.test(t) || /^page(\s|$)/i.test(t)) {
      const rest = t.replace(/^(open|page)\s*/i, "").trim().toLowerCase() || "system";
      if (!pages.includes(rest)) {
        return { ok: false, error: `Unknown page "${rest}". Pages: ${pages.join(", ")}` };
      }
      await openSysInfo(ctx, { page: rest });
      return { ok: true, message: `Opened System Info · ${rest}` };
    }

    const scanMap = {
      scan: "system",
      system: "system",
      cpu: "cpu",
      memory: "memory",
      ram: "memory",
      storage: "storage",
      disk: "storage",
      processes: "processes",
      procs: "processes",
      network: "network",
      net: "network",
      ports: "ports",
      environment: "environment",
      env: "environment",
      performance: "performance",
      metrics: "performance",
      perf: "performance",
    };

    const verb = lower.split(/\s+/)[0];
    const scanKey = scanMap[verb] || (pages.includes(lower) ? lower : null);

    if (scanKey) {
      let res;
      if (scanKey === "system") res = await window.mySpace.sysinfo.system();
      else if (scanKey === "cpu") res = await window.mySpace.sysinfo.cpu();
      else if (scanKey === "memory") res = await window.mySpace.sysinfo.memory();
      else if (scanKey === "storage") res = await window.mySpace.sysinfo.storage();
      else if (scanKey === "processes") res = await window.mySpace.sysinfo.processes();
      else if (scanKey === "network") res = await window.mySpace.sysinfo.network();
      else if (scanKey === "ports") res = await window.mySpace.sysinfo.ports();
      else if (scanKey === "environment") res = await window.mySpace.sysinfo.environment();
      else if (scanKey === "performance") res = await window.mySpace.sysinfo.metrics();
      else return { ok: false, error: `No scan for ${scanKey}` };

      if (!res?.ok) return { ok: false, error: res?.error || "Scan failed" };
      await syncSysInfoIfOpen(ctx, { page: scanKey === "performance" ? "performance" : scanKey === "storage" && verb === "disk" ? "disk" : scanKey });
      return { ok: true, message: formatSysScanResult(scanKey, res) };
    }

    return {
      ok: false,
      error: `Unknown sysinfo command "${t}". ${formatSysInfoCommandHelp()}`,
    };
  }

  function formatRemoteHubCommandHelp() {
    return [
      "remote(list) · remote(search office) · remote(check) · remote(check Office)",
      "remote(open Office) · remote(connect Office) · remote(connect Office ssh)",
      "remote(wake Office) · remote(scan) · remote(tools) · remote(import-ts)",
      "remote(add Lab | 10.0.0.5 | rdp) · remote(delete Lab) · remote(network)",
    ].join(" · ");
  }

  function formatOsBridgeCommandHelp() {
    return [
      "bridge(panel) · bridge(open) · bridge(devices) · bridge(places) · bridge(share) · bridge(host)",
      "bridge(full) · bridge(pair) · bridge(pair stop) · bridge(status) · bridge(help)",
      "OS Bridge is separate from Remote Hub (use remote(…) for RDP/SSH).",
    ].join(" · ");
  }

  async function executeOsBridgeCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();

    if (!t || /^(help|\?)$/i.test(t)) {
      return { ok: true, message: formatOsBridgeCommandHelp() };
    }

    if (/^(panel|open|show)$/i.test(t) || /^(devices|places|share|actions|host)$/i.test(t)) {
      const pageMap = { share: "actions", actions: "actions" };
      const page = pageMap[lower] || (/^(panel|open|show)$/i.test(t) ? "devices" : lower);
      await openOsBridge(ctx, { page });
      return { ok: true, message: `OS Bridge · ${page}` };
    }

    if (/^full(\s+\w+)?$/i.test(t)) {
      const rest = t.replace(/^full\s*/i, "").trim().toLowerCase();
      const pageMap = { share: "actions", actions: "actions" };
      const page = pageMap[rest] || rest || "devices";
      if (rest && !["devices", "places", "actions", "host"].includes(page)) {
        return { ok: false, error: `Unknown OS Bridge page "${rest}"` };
      }
      await openOsBridge(ctx, { page, full: true });
      return { ok: true, message: `Opened OS Bridge app · ${page}` };
    }

    if (/^open\s+/i.test(t)) {
      const rest = t.replace(/^open\s+/i, "").trim().toLowerCase();
      const pageMap = { share: "actions", action: "actions", actions: "actions" };
      const page = pageMap[rest] || rest || "devices";
      if (!["devices", "places", "actions", "host"].includes(page)) {
        return { ok: false, error: `Unknown OS Bridge page "${rest}"` };
      }
      await openOsBridge(ctx, { page });
      return { ok: true, message: `Opened OS Bridge · ${page}` };
    }

    if (/^pair(\s+stop)?$/i.test(t) || /^stop$/i.test(t)) {
      await openOsBridge(ctx, { page: "devices" });
      if (/stop/i.test(t)) {
        const res = await window.mySpace?.osBridge?.pairStop?.();
        if (res && res.ok === false) return { ok: false, error: res.error || "Could not stop pairing" };
        await syncOsBridgeIfOpen(ctx, { page: "devices" });
        return { ok: true, message: "OS Bridge pairing stopped" };
      }
      const res = await window.mySpace?.osBridge?.pairStart?.();
      if (res && res.ok === false) return { ok: false, error: res.error || "Could not start pairing" };
      await syncOsBridgeIfOpen(ctx, { page: "devices" });
      const code = res?.pairCode || res?.code;
      return {
        ok: true,
        message: code ? `Pairing started · code ${code}` : "Pairing started: see OS Bridge",
      };
    }

    if (/^status$/i.test(t)) {
      const res = await window.mySpace?.osBridge?.status?.();
      if (!res?.ok) return { ok: false, error: res?.error || "OS Bridge status unavailable" };
      const pair = res.pair || {};
      return {
        ok: true,
        message: `OS Bridge · ${pair.running ? `listening :${pair.port}` : "stopped"} · ${
          pair.devices?.length || 0
        } device(s) · inbox ${res.inboxCount || 0}`,
      };
    }

    return {
      ok: false,
      error: `Unknown bridge command "${t}". ${formatOsBridgeCommandHelp()}`,
    };
  }

  function formatFilesCommandHelp() {
    return [
      "files(panel) · files(open) · files(full) · files(browse) · files(recent) · files(favorites)",
      "files(downloads) · files(documents) · files(list PATH) · files(open PATH) · files(reveal PATH)",
      "files(write PATH body:…) · files(mkdir PATH) · files(copy SRC DEST) · files(workspace)",
      "files(status) · files(help)",
    ].join(" · ");
  }

  function parseFilesWriteArgs(t, verb) {
    const rest = String(t || "")
      .replace(new RegExp(`^${verb}\\s*`, "i"), "")
      .trim();
    if (!rest) {
      return { error: `Usage: files(${verb} <path> <${verb === "write" ? "body" : "text"}>)` };
    }
    const bodyKv = rest.match(/^(\S+)\s+body:(.*)$/is);
    if (bodyKv) {
      return { path: bodyKv[1].trim(), text: bodyKv[2] };
    }
    const quoted = rest.match(/^(\S+)\s+("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/s);
    if (quoted) {
      return { path: quoted[1].trim(), text: unquoteArg(quoted[2]) };
    }
    const space = rest.indexOf(" ");
    if (space < 0) {
      if (verb === "mkdir") return { path: rest };
      return { error: `Usage: files(${verb} <path> <body>)` };
    }
    return {
      path: rest.slice(0, space).trim(),
      text: rest.slice(space + 1).trim(),
    };
  }

  async function executeFilesCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();

    if (!t || /^(help|\?)$/i.test(t)) {
      return { ok: true, message: formatFilesCommandHelp() };
    }

    if (/^(panel|show)$/i.test(t)) {
      await openFiles(ctx, { page: "browse" });
      return { ok: true, message: "Files panel" };
    }

    if (/^(browse|recent|favorites|downloads|documents)$/i.test(t)) {
      const page = lower;
      if (page === "downloads" || page === "documents") {
        await openFiles(ctx, { page, full: true });
      } else {
        await openFiles(ctx, { page });
      }
      return { ok: true, message: `Files · ${page}` };
    }

    if (/^(open|full)$/i.test(t)) {
      await openFiles(ctx, { page: "browse", full: true });
      return { ok: true, message: "Opened Files app" };
    }

    if (/^full(\s+\w+)?$/i.test(t)) {
      const rest = t.replace(/^full\s*/i, "").trim().toLowerCase() || "browse";
      const page = ["browse", "recent", "favorites", "downloads", "documents"].includes(rest)
        ? rest
        : "browse";
      await openFiles(ctx, { page, full: true });
      return { ok: true, message: `Opened Files app · ${page}` };
    }

    if (/^open\s+/i.test(t)) {
      const rest = t.replace(/^open\s+/i, "").trim();
      const pageKey = rest.toLowerCase();
      if (["browse", "recent", "favorites", "downloads", "documents", "panel"].includes(pageKey)) {
        if (pageKey === "panel") {
          await openFiles(ctx, { page: "browse" });
          return { ok: true, message: "Files panel" };
        }
        await openFiles(ctx, {
          page: pageKey,
          full: pageKey === "downloads" || pageKey === "documents",
        });
        return { ok: true, message: `Files · ${pageKey}` };
      }
      const res = await window.mySpace?.files?.list?.(rest);
      if (res?.ok) {
        await openFiles(ctx, { path: rest, full: true });
        return { ok: true, message: `Opened ${rest}` };
      }
      const openRes = await window.mySpace?.files?.open?.(rest);
      if (openRes?.ok) return { ok: true, message: `Opened ${rest}` };
      await openFiles(ctx, { path: rest, full: true });
      return { ok: true, message: `Files · ${rest}` };
    }

    if (/^list(\s+|$)/i.test(t)) {
      const pathArg = t.replace(/^list\s*/i, "").trim();
      let target = pathArg;
      if (!target) {
        const home = await window.mySpace?.files?.home?.();
        target = home?.desktop || home?.home || "";
      }
      if (!target) return { ok: false, error: "Usage: files(list PATH)" };
      const home = await window.mySpace?.files?.home?.();
      const place = (home?.places || []).find(
        (p) => String(p.label || "").toLowerCase() === target.toLowerCase() || p.id === target.toLowerCase()
      );
      if (place) target = place.path;
      const res = await window.mySpace?.files?.list?.(target);
      if (!res?.ok) return { ok: false, error: res?.error || "Could not list folder" };
      const lines = (res.entries || [])
        .slice(0, 40)
        .map((e) => `${e.isDirectory ? "📁" : "📄"} ${e.name}${e.sizeLabel ? `  ${e.sizeLabel}` : ""}`);
      const more = (res.entries || []).length > 40 ? `\n… +${(res.entries || []).length - 40} more` : "";
      return {
        ok: true,
        message: `${res.path}\n${res.folders} folder(s) · ${res.files} file(s)\n${lines.join("\n")}${more}`,
      };
    }

    if (/^reveal\s+/i.test(t)) {
      const pathArg = t.replace(/^reveal\s+/i, "").trim();
      if (!pathArg) return { ok: false, error: "Usage: files(reveal PATH)" };
      const res = await window.mySpace?.files?.reveal?.(pathArg);
      if (!res?.ok) return { ok: false, error: res?.error || "Could not reveal" };
      return { ok: true, message: `Revealed ${pathArg}` };
    }

    if (/^status$/i.test(t)) {
      const res = await window.mySpace?.files?.status?.();
      if (!res?.ok) return { ok: false, error: res?.error || "Files status unavailable" };
      const ws = res.workspace ? ` · workspace ${res.workspace}` : "";
      return {
        ok: true,
        message: `Files · ${res.places} places · ${res.favorites} favorites · ${res.recent} recent · ${res.hostname || ""}${ws}`,
      };
    }

    if (/^workspace$/i.test(t)) {
      const res = await window.mySpace?.files?.workspaceRoot?.();
      if (!res?.ok) return { ok: false, error: res?.error || "Workspace unavailable" };
      return { ok: true, message: `Workspace · ${res.path}` };
    }

    if (/^write(\s|$)/i.test(t)) {
      const parsed = parseFilesWriteArgs(t, "write");
      if (parsed.error) return { ok: false, error: parsed.error };
      if (!window.mySpace?.files?.write) {
        return { ok: false, error: "Files write API unavailable" };
      }
      const res = await window.mySpace.files.write({
        path: parsed.path,
        content: parsed.text ?? "",
      });
      if (!res?.ok) return { ok: false, error: res?.error || "Could not write file" };
      return {
        ok: true,
        message: `Wrote ${res.relative || res.path} (${res.bytes || 0} bytes)`,
      };
    }

    if (/^append(\s|$)/i.test(t)) {
      const parsed = parseFilesWriteArgs(t, "append");
      if (parsed.error) return { ok: false, error: parsed.error };
      if (!parsed.text) return { ok: false, error: "Usage: files(append PATH body:…)" };
      if (!window.mySpace?.files?.write) {
        return { ok: false, error: "Files write API unavailable" };
      }
      const res = await window.mySpace.files.write({
        path: parsed.path,
        content: parsed.text,
        append: true,
      });
      if (!res?.ok) return { ok: false, error: res?.error || "Could not append to file" };
      return {
        ok: true,
        message: `Appended to ${res.relative || res.path} (${res.bytes || 0} bytes)`,
      };
    }

    if (/^mkdir(\s|$)/i.test(t)) {
      const parsed = parseFilesWriteArgs(t, "mkdir");
      if (parsed.error) return { ok: false, error: parsed.error };
      if (!window.mySpace?.files?.workspaceMkdir) {
        return { ok: false, error: "Files mkdir API unavailable" };
      }
      const res = await window.mySpace.files.workspaceMkdir({ path: parsed.path });
      if (!res?.ok) return { ok: false, error: res?.error || "Could not create folder" };
      return {
        ok: true,
        message: `Created ${res.relative || res.path}`,
      };
    }

    if (/^copy(\s|$)/i.test(t)) {
      const rest = t.replace(/^copy\s*/i, "").trim();
      const parts = rest.split(/\s+/).filter(Boolean);
      if (parts.length < 2) {
        return { ok: false, error: "Usage: files(copy SRC DEST). paths relative to workspace" };
      }
      if (!window.mySpace?.files?.workspaceCopy) {
        return { ok: false, error: "Files copy API unavailable" };
      }
      const res = await window.mySpace.files.workspaceCopy({
        src: parts[0],
        dest: parts.slice(1).join(" "),
      });
      if (!res?.ok) return { ok: false, error: res?.error || "Could not copy" };
      return {
        ok: true,
        message: `Copied ${res.from} → ${res.to}`,
      };
    }

    if (/^[a-zA-Z]:[\\/]/.test(t) || t.startsWith("\\\\") || t.startsWith("/")) {
      await openFiles(ctx, { path: t, full: true });
      return { ok: true, message: `Opened ${t}` };
    }

    return {
      ok: false,
      error: `Unknown files command "${t}". ${formatFilesCommandHelp()}`,
    };
  }

  function formatHostCommandHelp() {
    return [
      "host(run python file:tools/x.py) · host(run node file:tools/gen.js)",
      "host(run powershell file:tools/setup.ps1) · host(run node file:tools/a.js args:--watch wait:false)",
      "host(runtimes) · host(which node) · host(status) · host(help)",
    ].join(" · ");
  }

  function parseHostRunArgs(t) {
    let rest = String(t || "")
      .replace(/^run\s*/i, "")
      .trim();
    if (!rest) {
      return { error: "Usage: host(run <runtime> file:<path> [args:…] [cwd:…] [wait:true|false])" };
    }

    rest = rest.replace(/\s+--\s+/, " ");
    const tokens = rest.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    const runtime = (tokens.shift() || "").replace(/^["']|["']$/g, "");
    if (!runtime) {
      return { error: "Usage: host(run <runtime> file:<path> …)" };
    }

    let scriptPath = "";
    const kv = {};
    for (const rawTok of tokens) {
      const tok = rawTok.replace(/^["']|["']$/g, "");
      const fileMatch = tok.match(/^file:(.+)$/i);
      if (fileMatch) {
        scriptPath = `file:${fileMatch[1]}`;
        continue;
      }
      const kvMatch = tok.match(/^(\w+):([\s\S]+)$/);
      if (kvMatch) {
        kv[kvMatch[1].toLowerCase()] = kvMatch[2];
        continue;
      }
      if (!scriptPath) {
        scriptPath = tok.includes(":") ? tok : `file:${tok}`;
      }
    }

    if (!scriptPath) {
      return { error: "Usage: host(run python file:tools/x.py)" };
    }

    const waitRaw = kv.wait;
    let wait = true;
    if (waitRaw != null) {
      wait = /^(1|true|yes|on)$/i.test(String(waitRaw));
    }
    if (/^(0|false|no|off)$/i.test(String(kv.async || kv.background || ""))) {
    } else if (/^(1|true|yes|on)$/i.test(String(kv.async || kv.background || ""))) {
      wait = false;
    }

    return {
      runtime,
      scriptPath,
      args: kv.args || kv.arg || "",
      cwd: kv.cwd || "",
      wait,
      timeout: kv.timeout ? Number(kv.timeout) : undefined,
      enqueue: /^(1|true|yes|on)$/i.test(String(kv.enqueue || kv.job || "")),
    };
  }

  async function executeHostCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();

    if (!window.mySpace?.host) {
      return { ok: false, error: "Host shell API unavailable" };
    }

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatHostCommandHelp() };
    }

    if (lower === "status") {
      const res = await window.mySpace.host.status();
      if (!res?.ok) return { ok: false, error: res?.error || "Host status unavailable" };
      return {
        ok: true,
        message: `Host · workspace ${res.workspace} · runtimes ${(res.runtimes || []).join(", ")}`,
      };
    }

    if (lower === "runtimes" || lower === "list") {
      const res = await window.mySpace.host.runtimes();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not list runtimes" };
      return {
        ok: true,
        message: `Host runtimes: ${(res.runtimes || []).join(" · ")} · workspace ${res.workspace}`,
      };
    }

    if (/^which(\s|$)/i.test(t)) {
      const runtime = t.replace(/^which\s*/i, "").trim();
      if (!runtime) return { ok: false, error: "Usage: host(which node)" };
      const res = await window.mySpace.host.which({ runtime });
      if (!res?.ok) return { ok: false, error: res?.error || "Lookup failed" };
      return {
        ok: true,
        message: res.found
          ? `${runtime} → ${res.command}`
          : `${runtime} not found on PATH (${res.command})`,
      };
    }

    if (/^run(\s|$)/i.test(t)) {
      const parsed = parseHostRunArgs(t);
      if (parsed.error) return { ok: false, error: parsed.error };

      const payload = {
        runtime: parsed.runtime,
        scriptPath: parsed.scriptPath,
        args: parsed.args,
        cwd: parsed.cwd || undefined,
        wait: parsed.wait,
        timeout: parsed.timeout,
      };

      if (parsed.enqueue && window.mySpace?.jobs?.enqueue) {
        const res = await window.mySpace.jobs.enqueue({
          kind: "host",
          ...payload,
          source: "shell",
          title: `Host · ${parsed.runtime} ${parsed.scriptPath.replace(/^file:/i, "")}`,
        });
        if (res?.ok === false) return { ok: false, error: res.error || "Could not enqueue host job" };
        return {
          ok: true,
          message: res.message || `Queued host job · ${parsed.runtime} ${parsed.scriptPath}`,
        };
      }

      const res = await window.mySpace.host.run(payload);
      if (!res?.ok) {
        return {
          ok: false,
          error: res?.message || res?.error || "Host run failed",
          detail: res.stderr || res.stdout,
        };
      }
      if (res.detached) {
        return {
          ok: true,
          message: `Started ${parsed.runtime} · ${res.script || parsed.scriptPath}${res.pid ? ` (pid ${res.pid})` : ""}`,
        };
      }
      const preview = String(res.stdout || res.message || "Done")
        .split(/\r?\n/)
        .slice(0, 6)
        .join("\n");
      const dur = res.durationMs != null ? ` · ${res.durationMs}ms` : "";
      return {
        ok: true,
        message: `${parsed.runtime} · ${res.script || parsed.scriptPath}${dur}\n${preview}`,
      };
    }

    return {
      ok: false,
      error: `Unknown host command "${t}". ${formatHostCommandHelp()}`,
    };
  }

  function formatAppCommandHelp() {
    return [
      "app(scaffold todo name:My Todo template:minimal icon:📦)",
      "app(register todo) · app(list) · app(status)",
      "pack(build todo). zip user app for share",
      "app(help)",
    ].join(" · ");
  }

  function parseAppScaffoldArgs(t) {
    const rest = String(t || "")
      .replace(/^scaffold\s*/i, "")
      .trim();
    if (!rest) return { error: "Usage: app(scaffold <id> name:… template:minimal)" };
    const parts = rest.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    const id = (parts.shift() || "").replace(/^["']|["']$/g, "");
    if (!id) return { error: "Usage: app(scaffold <id> …)" };
    const kv = {};
    for (const raw of parts) {
      const tok = raw.replace(/^["']|["']$/g, "");
      const m = tok.match(/^(\w+):([\s\S]+)$/);
      if (m) kv[m[1].toLowerCase()] = m[2];
    }
    return {
      id,
      name: kv.name || id,
      template: kv.template || "minimal",
      icon: kv.icon || "📦",
      register: kv.register != null ? /^(1|true|yes|on)$/i.test(kv.register) : true,
    };
  }

  async function executeAppCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();

    if (!window.mySpace?.appBuilder) {
      return { ok: false, error: "App builder API unavailable" };
    }

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatAppCommandHelp() };
    }

    if (lower === "status") {
      const res = await window.mySpace.appBuilder.status();
      if (!res?.ok) return { ok: false, error: res?.error || "App builder status unavailable" };
      return {
        ok: true,
        message: `App builder · ${res.count || 0} user app(s) · ${res.userAppsRoot}`,
      };
    }

    if (lower === "list" || lower === "ls") {
      const res = await window.mySpace.appBuilder.list();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not list apps" };
      const apps = res.apps || [];
      if (!apps.length) {
        return { ok: true, message: "No user apps yet. try app(scaffold todo name:My Todo)" };
      }
      const lines = apps.map(
        (a) =>
          `${a.id}${a.registered ? " · desktop" : ""}${a.installed ? "" : " · missing files"}`
      );
      return { ok: true, message: `User apps (${apps.length}): ${lines.join(" · ")}` };
    }

    if (/^scaffold(\s|$)/i.test(t)) {
      const parsed = parseAppScaffoldArgs(t);
      if (parsed.error) return { ok: false, error: parsed.error };
      const res = await window.mySpace.appBuilder.scaffold(parsed);
      if (!res?.ok) return { ok: false, error: res?.error || "Scaffold failed" };
      const next = (res.next || []).join(" · ");
      return {
        ok: true,
        message: `Scaffolded ${res.app?.name || parsed.id} · ${res.path}${res.registered ? " · registered" : ""}${next ? `\nNext: ${next}` : ""}`,
      };
    }

    if (/^register(\s|$)/i.test(t)) {
      const id = t.replace(/^register\s*/i, "").trim();
      if (!id) return { ok: false, error: "Usage: app(register todo)" };
      const res = await window.mySpace.appBuilder.register({ id });
      if (!res?.ok) return { ok: false, error: res?.error || "Register failed" };
      return {
        ok: true,
        message: `Registered ${res.app?.name || id} on desktop`,
      };
    }

    if (/^build(\s|$)/i.test(t)) {
      const id = t.replace(/^build\s*/i, "").trim();
      if (!id) return { ok: false, error: "Usage: app(build todo) or pack(build todo)" };
      const res = await window.mySpace.appBuilder.build({ id });
      if (!res?.ok) return { ok: false, error: res?.error || "Build failed" };
      return { ok: true, message: res.message || `Built ${res.path}` };
    }

    return {
      ok: false,
      error: `Unknown app command "${t}". ${formatAppCommandHelp()}`,
    };
  }

  function machineLabel(m) {
    return String(m?.name || m?.host || m?.id || "machine");
  }

  async function resolveRemoteMachine(ref) {
    const loaded = await window.mySpace.remote.load();
    if (!loaded?.ok) return { error: loaded?.error || "Could not load machines" };
    const machines = loaded.data?.machines || [];
    const match = matchNamedItem(machines, ref, "name");
    if (match.error) {
      const byHost = machines.filter(
        (m) => String(m.host || "").toLowerCase() === String(ref || "").trim().toLowerCase()
      );
      if (byHost.length === 1) return { machine: byHost[0], machines };
      return match;
    }
    return { machine: match.item, machines };
  }

  async function executeRemoteHubCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();
    const pages = ["machines", "quick", "network", "enable"];

    if (!window.mySpace?.remote) {
      return { ok: false, error: "Remote Hub shell API unavailable" };
    }

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatRemoteHubCommandHelp() };
    }

    if (pages.includes(lower)) {
      await openRemoteHub(ctx, { page: lower });
      return { ok: true, message: `Opened Remote Hub · ${lower}` };
    }

    if (/^list(\s|$)/i.test(t) || lower === "ls") {
      const res = await window.mySpace.remote.load();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not load machines" };
      const machines = res.data?.machines || [];
      if (!machines.length) return { ok: true, message: "No machines" };
      const lines = machines.slice(0, 20).map((m) => {
        const fav = m.favorite ? "★ " : "";
        return `${fav}${m.name} (${m.host || "—"} · ${m.connectionType || "rdp"})`;
      });
      const more = machines.length > 20 ? ` · +${machines.length - 20} more` : "";
      return { ok: true, message: `Machines (${machines.length}): ${lines.join(" · ")}${more}` };
    }

    if (/^(search|find)(\s|$)/i.test(t)) {
      const q = t.replace(/^(search|find)\s*/i, "").trim().toLowerCase();
      if (!q) return { ok: false, error: "Usage: remote(search office)" };
      const res = await window.mySpace.remote.load();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not load machines" };
      const hits = (res.data?.machines || []).filter((m) => {
        const blob = [m.name, m.host, m.group, m.notes, ...(m.tags || [])]
          .join(" ")
          .toLowerCase();
        return blob.includes(q);
      });
      if (!hits.length) return { ok: true, message: `No matches for "${q}"` };
      return {
        ok: true,
        message: `Found ${hits.length}: ${hits
          .slice(0, 12)
          .map((m) => `${m.name} (${m.host || "—"})`)
          .join(" · ")}`,
      };
    }

    if (/^(check|status)(\s|$)/i.test(t)) {
      const ref = t.replace(/^(check|status)\s*/i, "").trim();
      const args = {};
      if (ref) {
        const resolved = await resolveRemoteMachine(ref);
        if (resolved.error) return { ok: false, error: resolved.error };
        args.ids = [resolved.machine.id];
      }
      const res = await window.mySpace.remote.check(args);
      if (!res?.ok) return { ok: false, error: res?.error || "Check failed" };
      const statuses = res.statuses || [];
      if (!statuses.length) return { ok: true, message: "No status results" };
      const byId = Object.fromEntries((res.machines || []).map((m) => [m.id, m]));
      const lines = statuses.slice(0, 15).map((s) => {
        const name = byId[s.id]?.name || s.id;
        const state = s.online ? "online" : "offline";
        const lat = s.latencyMs != null ? ` ${s.latencyMs}ms` : "";
        return `${name} ${state}${lat}`;
      });
      return { ok: true, message: `Status: ${lines.join(" · ")}` };
    }

    if (/^open(\s|$)/i.test(t)) {
      const ref = t.replace(/^open\s*/i, "").trim();
      if (!ref) {
        await openRemoteHub(ctx, { page: "machines" });
        return { ok: true, message: "Opened Remote Hub" };
      }
      if (pages.includes(ref.toLowerCase())) {
        await openRemoteHub(ctx, { page: ref.toLowerCase() });
        return { ok: true, message: `Opened Remote Hub · ${ref.toLowerCase()}` };
      }
      const resolved = await resolveRemoteMachine(ref);
      if (resolved.error) return { ok: false, error: resolved.error };
      await openRemoteHub(ctx, {
        page: "machines",
        action: "openMachine",
        param: resolved.machine.id,
      });
      return { ok: true, message: `Opened · ${machineLabel(resolved.machine)}` };
    }

    if (/^connect(\s|$)/i.test(t)) {
      const rest = t.replace(/^connect\s*/i, "").trim();
      if (!rest) return { ok: false, error: "Usage: remote(connect Office) · remote(connect Office ssh)" };
      const bits = rest.split(/\s+/);
      let mode = null;
      const modes = ["rdp", "ssh", "rustdesk", "psremoting", "explorer", "winrs", "custom"];
      if (bits.length > 1 && modes.includes(bits[bits.length - 1].toLowerCase())) {
        mode = bits.pop().toLowerCase();
      }
      const ref = bits.join(" ");
      const resolved = await resolveRemoteMachine(ref);
      if (resolved.error) return { ok: false, error: resolved.error };
      const args = { id: resolved.machine.id };
      if (mode) args.mode = mode;
      const res = await window.mySpace.remote.connect(args);
      if (!res?.ok) return { ok: false, error: res?.error || "Connect failed" };
      return {
        ok: true,
        message: `Connecting · ${machineLabel(resolved.machine)}${res.mode ? ` via ${res.mode}` : ""}`,
      };
    }

    if (/^wake(\s|$)/i.test(t) || /^wol(\s|$)/i.test(t)) {
      const ref = t.replace(/^(wake|wol)\s*/i, "").trim();
      if (!ref) return { ok: false, error: "Usage: remote(wake Office)" };
      let mac = ref;
      let label = ref;
      if (!/^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(ref)) {
        const resolved = await resolveRemoteMachine(ref);
        if (resolved.error) return { ok: false, error: resolved.error };
        mac = resolved.machine.macAddress;
        label = machineLabel(resolved.machine);
        if (!mac) return { ok: false, error: `${label} has no MAC address` };
      }
      const res = await window.mySpace.remote.wake({ mac });
      if (!res?.ok) return { ok: false, error: res?.error || "Wake failed" };
      return { ok: true, message: res.message || `Wake sent · ${label}` };
    }

    if (/^scan(\s|$)/i.test(t)) {
      const res = await window.mySpace.remote.scan({});
      if (!res?.ok) return { ok: false, error: res?.error || "Scan failed" };
      const hosts = res.hosts || [];
      if (!hosts.length) {
        return {
          ok: true,
          message: `Scan · ${res.subnet || "subnet"} · no hosts (${res.scanned || 0} probed)`,
        };
      }
      const lines = hosts
        .slice(0, 12)
        .map((h) => `${h.ip}${h.latencyMs != null ? ` ${h.latencyMs}ms` : ""}`)
        .join(" · ");
      await syncRemoteHubIfOpen(ctx, { page: "network" });
      return {
        ok: true,
        message: `Scan · ${res.subnet || "net"} · ${hosts.length} hosts: ${lines}`,
      };
    }

    if (lower === "tools") {
      const res = await window.mySpace.remote.tools();
      if (!res?.ok) return { ok: false, error: res?.error || "Tools check failed" };
      const tools = res.tools || {};
      const lines = Object.entries(tools)
        .map(([k, v]) => `${k}:${v ? "yes" : "no"}`)
        .join(" · ");
      return { ok: true, message: `Tools · ${lines}` };
    }

    if (/^(import-ts|tailscale|ts-import)(\s|$)/i.test(t)) {
      const res = await window.mySpace.remote.tailscaleImport();
      if (!res?.ok) return { ok: false, error: res?.error || "Tailscale import failed" };
      await syncRemoteHubIfOpen(ctx, { page: "machines" });
      return {
        ok: true,
        message: `Imported ${res.added ?? 0} Tailscale peer(s)`,
      };
    }

    if (/^(add|new)(\s|$)/i.test(t)) {
      const rest = t.replace(/^(add|new)\s*/i, "").trim();
      if (!rest) {
        return { ok: false, error: "Usage: remote(add Lab | 10.0.0.5 | rdp)" };
      }
      let name;
      let host;
      let connectionType = "rdp";
      if (rest.includes("|")) {
        const parts = rest.split("|").map((s) => s.trim());
        name = parts[0];
        host = parts[1] || "";
        connectionType = (parts[2] || "rdp").toLowerCase();
      } else if (isClassicRouteArgs(rest)) {
        const { map, positional } = parseArgStructure(rest);
        name = map.name || positional[0];
        host = map.host || map.ip || positional[1] || "";
        connectionType = String(map.type || map.connectionType || positional[2] || "rdp").toLowerCase();
      } else {
        const bits = rest.split(/\s+/);
        name = bits[0];
        host = bits[1] || "";
        connectionType = (bits[2] || "rdp").toLowerCase();
      }
      if (!name) return { ok: false, error: "Machine name required" };
      if (!host) return { ok: false, error: "Host / IP required" };
      const loaded = await window.mySpace.remote.load();
      if (!loaded?.ok) return { ok: false, error: loaded?.error || "Could not load" };
      const data = loaded.data || { machines: [], settings: {} };
      const machine = {
        id: `rm_${Date.now().toString(36)}`,
        name,
        host,
        connectionType,
        group: "General",
      };
      data.machines = [...(data.machines || []), machine];
      const saved = await window.mySpace.remote.save({ data });
      if (!saved?.ok) return { ok: false, error: saved?.error || "Could not save" };
      await syncRemoteHubIfOpen(ctx, {
        page: "machines",
        action: "openMachine",
        param: machine.id,
      });
      return { ok: true, message: `Added · ${name} (${host} · ${connectionType})` };
    }

    if (/^(delete|rm|remove)(\s|$)/i.test(t)) {
      const ref = t.replace(/^(delete|rm|remove)\s*/i, "").trim();
      if (!ref) return { ok: false, error: "Usage: remote(delete Lab)" };
      const resolved = await resolveRemoteMachine(ref);
      if (resolved.error) return { ok: false, error: resolved.error };
      const loaded = await window.mySpace.remote.load();
      if (!loaded?.ok) return { ok: false, error: loaded?.error || "Could not load" };
      const data = loaded.data;
      data.machines = (data.machines || []).filter((m) => m.id !== resolved.machine.id);
      const saved = await window.mySpace.remote.save({ data });
      if (!saved?.ok) return { ok: false, error: saved?.error || "Could not save" };
      await syncRemoteHubIfOpen(ctx, { page: "machines" });
      return { ok: true, message: `Deleted · ${machineLabel(resolved.machine)}` };
    }

    return {
      ok: false,
      error: `Unknown remote command "${t}". ${formatRemoteHubCommandHelp()}`,
    };
  }

  function formatStudiesCommandHelp() {
    return [
      "studies(list) · studies(search thesis) · studies(open My Notes)",
      "studies(home) · studies(templates) · studies(new) · studies(help)",
    ].join(" · ");
  }

  async function executeStudiesCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();
    const pages = ["home", "templates", "editor"];

    if (!window.mySpace?.studies) {
      return { ok: false, error: "Studies shell API unavailable" };
    }

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatStudiesCommandHelp() };
    }

    if (pages.includes(lower)) {
      await openStudies(ctx, { page: lower });
      return { ok: true, message: `Opened Studies · ${lower}` };
    }

    if (lower === "new" || lower === "create") {
      await openStudies(ctx, { page: "templates" });
      return { ok: true, message: "Opened Studies · templates (pick one to create)" };
    }

    if (/^list(\s|$)/i.test(t) || lower === "ls") {
      const res = await window.mySpace.studies.load();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not load documents" };
      const docs = res.data?.documents || [];
      if (!docs.length) return { ok: true, message: "No documents" };
      const lines = docs.slice(0, 20).map((d) => {
        const pin = d.pinned ? "★ " : "";
        return `${pin}${d.title || d.id}`;
      });
      const more = docs.length > 20 ? ` · +${docs.length - 20} more` : "";
      return { ok: true, message: `Documents (${docs.length}): ${lines.join(" · ")}${more}` };
    }

    if (/^(search|find)(\s|$)/i.test(t)) {
      const q = t.replace(/^(search|find)\s*/i, "").trim().toLowerCase();
      if (!q) return { ok: false, error: "Usage: studies(search thesis)" };
      const res = await window.mySpace.studies.load();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not load documents" };
      const hits = (res.data?.documents || []).filter((d) => {
        const blob = [d.title, d.id, ...(d.tags || []), d.template, d.docMode]
          .join(" ")
          .toLowerCase();
        return blob.includes(q);
      });
      if (!hits.length) return { ok: true, message: `No matches for "${q}"` };
      return {
        ok: true,
        message: `Found ${hits.length}: ${hits
          .slice(0, 12)
          .map((d) => d.title || d.id)
          .join(" · ")}`,
      };
    }

    if (/^open(\s|$)/i.test(t)) {
      const ref = t.replace(/^open\s*/i, "").trim();
      if (!ref) {
        await openStudies(ctx, { page: "home" });
        return { ok: true, message: "Opened Studies" };
      }
      if (pages.includes(ref.toLowerCase())) {
        await openStudies(ctx, { page: ref.toLowerCase() });
        return { ok: true, message: `Opened Studies · ${ref.toLowerCase()}` };
      }
      const res = await window.mySpace.studies.load();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not load documents" };
      const match = matchNamedItem(res.data?.documents || [], ref, "title");
      if (match.error) return { ok: false, error: match.error };
      await openStudies(ctx, {
        page: "editor",
        action: "openDocument",
        param: match.item.id,
      });
      return { ok: true, message: `Opened · ${match.item.title || match.item.id}` };
    }

    const res = await window.mySpace.studies.load();
    if (res?.ok) {
      const match = matchNamedItem(res.data?.documents || [], t, "title");
      if (!match.error) {
        await openStudies(ctx, {
          page: "editor",
          action: "openDocument",
          param: match.item.id,
        });
        return { ok: true, message: `Opened · ${match.item.title || match.item.id}` };
      }
    }

    return {
      ok: false,
      error: `Unknown studies command "${t}". ${formatStudiesCommandHelp()}`,
    };
  }

  function formatGeographyCommandHelp() {
    return [
      "geo(list) · geo(search Israel) · geo(get IL) · geography(Togo)",
      "geo(open Japan) · geo(learn Japan) · geo(traveled) · geo(explore)",
    ].join(" · ");
  }

  async function resolveCountryRef(ref) {
    const raw = String(ref || "").trim();
    if (!raw) return { error: "Missing country" };
    const via = resolveCountryCode(raw);
    if (via) return { code: via };
    const listed = await window.mySpace.geography.list({});
    if (!listed?.ok) return { error: listed?.error || "Could not list countries" };
    const countries = listed.countries || [];
    const q = raw.toLowerCase();
    const byCode = countries.find(
      (c) =>
        String(c.code || "").toUpperCase() === raw.toUpperCase() ||
        String(c.code2 || "").toUpperCase() === raw.toUpperCase()
    );
    if (byCode) return { code: byCode.code || byCode.code2, country: byCode };
    const exact = countries.filter((c) => String(c.name || "").toLowerCase() === q);
    if (exact.length === 1) return { code: exact[0].code || exact[0].code2, country: exact[0] };
    const starts = countries.filter((c) => String(c.name || "").toLowerCase().startsWith(q));
    if (starts.length === 1) return { code: starts[0].code || starts[0].code2, country: starts[0] };
    const includes = countries.filter((c) => String(c.name || "").toLowerCase().includes(q));
    if (includes.length === 1) return { code: includes[0].code || includes[0].code2, country: includes[0] };
    if (includes.length > 1) {
      return {
        error: `Ambiguous — match one of: ${includes
          .slice(0, 5)
          .map((c) => c.name)
          .join(" · ")}`,
      };
    }
    return { error: `Country not found: ${ref}` };
  }

  async function executeGeographyCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();
    const pages = ["explore", "learn", "traveled"];

    if (!window.mySpace?.geography) {
      return { ok: false, error: "Geography shell API unavailable" };
    }

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatGeographyCommandHelp() };
    }

    if (pages.includes(lower)) {
      await openGeography(ctx, { page: lower });
      return { ok: true, message: `Opened Geography · ${lower}` };
    }

    if (/^list(\s|$)/i.test(t) || lower === "ls") {
      const res = await window.mySpace.geography.list({});
      if (!res?.ok) return { ok: false, error: res?.error || "Could not list countries" };
      const countries = res.countries || [];
      const sample = countries
        .slice(0, 12)
        .map((c) => `${c.code2 || c.code}:${c.name}`)
        .join(" · ");
      return { ok: true, message: `Countries (${countries.length}): ${sample}…` };
    }

    if (/^(search|find)(\s|$)/i.test(t)) {
      const q = t.replace(/^(search|find)\s*/i, "").trim().toLowerCase();
      if (!q) return { ok: false, error: "Usage: geo(search Israel)" };
      const res = await window.mySpace.geography.list({});
      if (!res?.ok) return { ok: false, error: res?.error || "Could not list countries" };
      const hits = (res.countries || []).filter((c) => {
        const blob = [c.name, c.officialName, c.capital, c.region, c.code, c.code2]
          .join(" ")
          .toLowerCase();
        return blob.includes(q);
      });
      if (!hits.length) return { ok: true, message: `No matches for "${q}"` };
      return {
        ok: true,
        message: `Found ${hits.length}: ${hits
          .slice(0, 12)
          .map((c) => `${c.name} (${c.code2 || c.code})`)
          .join(" · ")}`,
      };
    }

    if (/^(get|info|show)(\s|$)/i.test(t)) {
      const ref = t.replace(/^(get|info|show)\s*/i, "").trim();
      if (!ref) return { ok: false, error: "Usage: geo(get IL)" };
      const resolved = await resolveCountryRef(ref);
      if (resolved.error) return { ok: false, error: resolved.error };
      const res = await window.mySpace.geography.get({
        code: resolved.code,
        skipWiki: true,
      });
      if (!res?.ok) return { ok: false, error: res?.error || "Could not load country" };
      const c = res.country || resolved.country || {};
      return {
        ok: true,
        message: `${c.name || ref} · capital ${c.capital || "—"} · ${c.region || "—"} · pop ${
          c.population != null ? Number(c.population).toLocaleString() : "—"
        }`,
      };
    }

    if (/^learn(\s|$)/i.test(t)) {
      const ref = t.replace(/^learn\s*/i, "").trim();
      if (!ref) {
        await openGeography(ctx, { page: "learn" });
        return { ok: true, message: "Opened Geography · learn" };
      }
      const resolved = await resolveCountryRef(ref);
      if (resolved.error) return { ok: false, error: resolved.error };
      await openGeography(ctx, {
        page: "learn",
        action: "openLearn",
        param: resolved.code,
      });
      return { ok: true, message: `Learn · ${resolved.country?.name || resolved.code}` };
    }

    if (/^open(\s|$)/i.test(t) || /^explore(\s|$)/i.test(t)) {
      const ref = t.replace(/^(open|explore)\s*/i, "").trim();
      if (!ref) {
        await openGeography(ctx, { page: "explore" });
        return { ok: true, message: "Opened Geography · explore" };
      }
      if (pages.includes(ref.toLowerCase())) {
        await openGeography(ctx, { page: ref.toLowerCase() });
        return { ok: true, message: `Opened Geography · ${ref.toLowerCase()}` };
      }
      const resolved = await resolveCountryRef(ref);
      if (resolved.error) return { ok: false, error: resolved.error };
      await openGeography(ctx, {
        page: "explore",
        action: "openCountry",
        param: resolved.code,
      });
      return { ok: true, message: `Opened · ${resolved.country?.name || resolved.code}` };
    }

    if (lower === "visited" || lower === "favorites") {
      const res = await window.mySpace.geography.load();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not load travel data" };
      const visited = res.data?.visited || [];
      const favs = res.data?.favorites || [];
      if (lower === "favorites") {
        return {
          ok: true,
          message: favs.length
            ? `Favorites (${favs.length}): ${favs.slice(0, 15).join(" · ")}`
            : "No favorites",
        };
      }
      return {
        ok: true,
        message: visited.length
          ? `Visited (${visited.length}): ${visited.slice(0, 15).join(" · ")}`
          : "No visited countries",
      };
    }

    const resolved = await resolveCountryRef(t);
    if (!resolved.error) {
      const res = await window.mySpace.geography.get({
        code: resolved.code,
        skipWiki: true,
      });
      if (!res?.ok) return { ok: false, error: res?.error || "Could not load country" };
      const c = res.country || resolved.country || {};
      return {
        ok: true,
        message: `${c.name || t} · capital ${c.capital || "—"} · ${c.region || "—"} · pop ${
          c.population != null ? Number(c.population).toLocaleString() : "—"
        }`,
      };
    }

    return {
      ok: false,
      error: `Unknown geography command "${t}". ${formatGeographyCommandHelp()}`,
    };
  }

  function formatFlagQuizCommandHelp() {
    return [
      "flags(scores) · flags(quiz) · flags(start) · flags(home)",
      "flags(meta) · flag-quiz(clear scores)",
    ].join(" · ");
  }

  async function executeFlagQuizCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();
    const pages = ["home", "quiz", "scores"];

    if (!window.mySpace?.flags) {
      return { ok: false, error: "Flag Quiz shell API unavailable" };
    }

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatFlagQuizCommandHelp() };
    }

    if (lower === "meta") {
      const res = await window.mySpace.flags.meta();
      if (!res?.ok) return { ok: false, error: res?.error || "Meta failed" };
      return {
        ok: true,
        message: `${res.name || "Flag Quiz"} v${res.version || "?"} · default ${
          res.defaultQuestions || "?"
        } questions · categories: ${(res.categories || []).slice(0, 8).join(", ")}`,
      };
    }

    if (/^scores(\s|$)/i.test(t) || lower === "list" || lower === "ls") {
      if (/^scores\s+clear$/i.test(t) || lower === "clear scores") {
        const cleared = await window.mySpace.flags.clearScores();
        if (!cleared?.ok) return { ok: false, error: cleared?.error || "Clear failed" };
        await syncFlagQuizIfOpen(ctx, { page: "scores" });
        return { ok: true, message: "Scores cleared" };
      }
      const res = await window.mySpace.flags.scores();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not load scores" };
      const scores = res.scores || [];
      if (!scores.length) return { ok: true, message: "No scores yet" };
      const lines = scores.slice(0, 10).map((s) => {
        const when = s.at ? new Date(s.at).toLocaleDateString() : "";
        return `${s.score}/${s.total} (${s.pct}%)${when ? ` ${when}` : ""}`;
      });
      return { ok: true, message: `Scores (${scores.length}): ${lines.join(" · ")}` };
    }

    if (lower === "clear" || lower === "clear scores") {
      const cleared = await window.mySpace.flags.clearScores();
      if (!cleared?.ok) return { ok: false, error: cleared?.error || "Clear failed" };
      await syncFlagQuizIfOpen(ctx, { page: "scores" });
      return { ok: true, message: "Scores cleared" };
    }

    if (/^(start|quiz|play)(\s|$)/i.test(t) || lower === "quiz") {
      await openFlagQuiz(ctx, { page: "quiz", action: "startQuiz" });
      return { ok: true, message: "Started Flag Quiz" };
    }

    if (/^open(\s|$)/i.test(t)) {
      const rest = t.replace(/^open\s*/i, "").trim().toLowerCase() || "home";
      if (!pages.includes(rest)) {
        return { ok: false, error: `Unknown page "${rest}". Pages: ${pages.join(", ")}` };
      }
      const route = rest === "quiz" ? { page: "quiz", action: "startQuiz" } : { page: rest };
      await openFlagQuiz(ctx, route);
      return { ok: true, message: `Opened Flag Quiz · ${rest}` };
    }

    if (pages.includes(lower)) {
      const route = lower === "quiz" ? { page: "quiz", action: "startQuiz" } : { page: lower };
      await openFlagQuiz(ctx, route);
      return { ok: true, message: `Opened Flag Quiz · ${lower}` };
    }

    return {
      ok: false,
      error: `Unknown flags command "${t}". ${formatFlagQuizCommandHelp()}`,
    };
  }

  function formatHistoryCommandHelp() {
    return [
      "history(list figures) · history(list events) · history(search Napoleon)",
      "history(get Q762) · history(open Napoleon) · history(bookmarks) · history(status)",
    ].join(" · ");
  }

  async function executeHistoryCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();
    const pages = ["figures", "events", "collection"];

    if (!window.mySpace?.history) {
      return { ok: false, error: "History shell API unavailable" };
    }

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatHistoryCommandHelp() };
    }

    if (lower === "status") {
      const res = await window.mySpace.history.status();
      if (!res?.ok) return { ok: false, error: res?.error || "Status failed" };
      return {
        ok: true,
        message: `History cache · figures ${res.figuresCount ?? "—"} · events ${
          res.eventsCount ?? "—"
        } · ${res.loaded ? "loaded" : "empty"}${res.updatedAt ? ` · ${res.updatedAt}` : ""}`,
      };
    }

    if (pages.includes(lower)) {
      await openHistory(ctx, { page: lower });
      return { ok: true, message: `Opened History · ${lower}` };
    }

    if (/^list(\s|$)/i.test(t) || lower === "ls") {
      const rest = t.replace(/^list\s*/i, "").trim().toLowerCase() || "figures";
      const kind = rest.startsWith("event") ? "events" : "figures";
      const res =
        kind === "events"
          ? await window.mySpace.history.events()
          : await window.mySpace.history.figures();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not list" };
      const items = res[kind] || [];
      if (!items.length) return { ok: true, message: `No ${kind}` };
      const lines = items.slice(0, 15).map((x) => `${x.name || x.id}${x.id ? ` [${x.id}]` : ""}`);
      return {
        ok: true,
        message: `${kind} (${items.length}): ${lines.join(" · ")}${
          items.length > 15 ? "…" : ""
        }`,
      };
    }

    if (/^(search|find)(\s|$)/i.test(t)) {
      const q = t.replace(/^(search|find)\s*/i, "").trim().toLowerCase();
      if (!q) return { ok: false, error: "Usage: history(search Napoleon)" };
      const [fig, ev] = await Promise.all([
        window.mySpace.history.figures(),
        window.mySpace.history.events(),
      ]);
      if (!fig?.ok && !ev?.ok) return { ok: false, error: "Could not search history" };
      const pool = [...(fig.figures || []), ...(ev.events || [])];
      const hits = pool.filter((x) => {
        const blob = [x.name, x.id, x.wikiTitle, x.summary, x.description].join(" ").toLowerCase();
        return blob.includes(q);
      });
      if (!hits.length) return { ok: true, message: `No matches for "${q}"` };
      return {
        ok: true,
        message: `Found ${hits.length}: ${hits
          .slice(0, 12)
          .map((x) => `${x.name || x.id}`)
          .join(" · ")}`,
      };
    }

    if (/^(get|info)(\s|$)/i.test(t)) {
      const ref = t.replace(/^(get|info)\s*/i, "").trim();
      if (!ref) return { ok: false, error: "Usage: history(get Q762)" };
      let id = ref;
      if (!/^Q\d+$/i.test(ref)) {
        const [fig, ev] = await Promise.all([
          window.mySpace.history.figures(),
          window.mySpace.history.events(),
        ]);
        const pool = [...(fig.figures || []), ...(ev.events || [])];
        const match = matchNamedItem(pool, ref, "name");
        if (match.error) return { ok: false, error: match.error };
        id = match.item.id;
      }
      const res = await window.mySpace.history.get(id);
      if (!res?.ok) return { ok: false, error: res?.error || "Entity not found" };
      const e = res.entity || {};
      const extract = String(res.wiki?.extract || e.summary || "").slice(0, 160);
      return {
        ok: true,
        message: `${e.name || id}${e.type ? ` · ${e.type}` : ""}${
          extract ? ` — ${extract}${extract.length >= 160 ? "…" : ""}` : ""
        }`,
      };
    }

    if (lower === "bookmarks" || lower === "saved") {
      const res = await window.mySpace.history.load();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not load bookmarks" };
      const bookmarks = res.data?.bookmarks || [];
      if (!bookmarks.length) return { ok: true, message: "No bookmarks" };
      const lines = bookmarks.slice(0, 15).map((b) => b.name || b.id || b);
      return { ok: true, message: `Bookmarks (${bookmarks.length}): ${lines.join(" · ")}` };
    }

    if (/^open(\s|$)/i.test(t)) {
      const ref = t.replace(/^open\s*/i, "").trim();
      if (!ref) {
        await openHistory(ctx, { page: "figures" });
        return { ok: true, message: "Opened History" };
      }
      if (pages.includes(ref.toLowerCase())) {
        await openHistory(ctx, { page: ref.toLowerCase() });
        return { ok: true, message: `Opened History · ${ref.toLowerCase()}` };
      }
      let id = ref;
      let type = null;
      if (!/^Q\d+$/i.test(ref)) {
        const [fig, ev] = await Promise.all([
          window.mySpace.history.figures(),
          window.mySpace.history.events(),
        ]);
        const pool = [...(fig.figures || []), ...(ev.events || [])];
        const match = matchNamedItem(pool, ref, "name");
        if (match.error) return { ok: false, error: match.error };
        id = match.item.id;
        type = match.item.type;
      }
      await openHistory(ctx, {
        page: type === "event" ? "events" : "figures",
        action: "openEntity",
        param: id,
      });
      return { ok: true, message: `Opened · ${id}` };
    }

    return {
      ok: false,
      error: `Unknown history command "${t}". ${formatHistoryCommandHelp()}`,
    };
  }

  function formatSpaceCommandHelp() {
    return [
      "space(apod) · space(search Mars) · space(get earth) · space(missions)",
      "space(reports) · space(ocean) · space(earth) · space(cosmos)",
      "space(open Mars) · space(catalog) · space(nasa) · space(aliens)",
    ].join(" · ");
  }

  async function executeSpaceCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();
    const pages = ["navigate", "catalog", "nasa", "reports", "aliens"];
    const views = ["cosmos", "ocean", "earth"];

    if (!window.mySpace?.space) {
      return { ok: false, error: "Space shell API unavailable" };
    }

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatSpaceCommandHelp() };
    }

    if (views.includes(lower)) {
      await openSpace(ctx, { page: "navigate", view: lower });
      return { ok: true, message: `Opened Space · ${lower}` };
    }

    if (pages.includes(lower)) {
      await openSpace(ctx, { page: lower });
      return { ok: true, message: `Opened Space · ${lower}` };
    }

    if (lower === "apod" || /^apod(\s|$)/i.test(t)) {
      const res = await window.mySpace.space.apod({});
      if (!res?.ok) return { ok: false, error: res?.error || "APOD failed" };
      const a = res.apod || res;
      return {
        ok: true,
        message: `APOD · ${a.title || "Today"}${a.date ? ` (${a.date})` : ""}${
          a.explanation ? ` — ${String(a.explanation).slice(0, 140)}…` : ""
        }`,
      };
    }

    if (/^missions?(\s|$)/i.test(t)) {
      const rest = t.replace(/^missions?\s*/i, "").trim();
      if (rest && !/^(list|ls)$/i.test(rest)) {
        const res = await window.mySpace.space.mission(rest);
        if (res?.ok && res.mission) {
          const m = res.mission;
          return {
            ok: true,
            message: `${m.name || m.id}${m.status ? ` · ${m.status}` : ""}${
              m.summary ? ` — ${String(m.summary).slice(0, 120)}` : ""
            }`,
          };
        }
        const listed = await window.mySpace.space.missions({});
        if (listed?.ok) {
          const match = matchNamedItem(listed.missions || [], rest, "name");
          if (!match.error) {
            await openSpace(ctx, {
              page: "nasa",
              action: "openMission",
              param: match.item.id,
            });
            return { ok: true, message: `Opened mission · ${match.item.name || match.item.id}` };
          }
        }
      }
      const res = await window.mySpace.space.missions({});
      if (!res?.ok) return { ok: false, error: res?.error || "Could not list missions" };
      const missions = res.missions || [];
      const lines = missions.slice(0, 12).map((m) => m.name || m.id);
      return { ok: true, message: `Missions (${res.count ?? missions.length}): ${lines.join(" · ")}` };
    }

    if (/^reports?(\s|$)/i.test(t)) {
      const rest = t.replace(/^reports?\s*/i, "").trim();
      if (rest && !/^(list|ls)$/i.test(rest)) {
        const listed = await window.mySpace.space.reports({});
        if (listed?.ok) {
          const match = matchNamedItem(listed.reports || [], rest, "name");
          if (!match.error) {
            await openSpace(ctx, {
              page: "reports",
              action: "openReport",
              param: match.item.id,
            });
            return { ok: true, message: `Opened report · ${match.item.name || match.item.id}` };
          }
        }
      }
      const res = await window.mySpace.space.reports({});
      if (!res?.ok) return { ok: false, error: res?.error || "Could not list reports" };
      const reports = res.reports || [];
      const lines = reports.slice(0, 12).map((r) => r.name || r.title || r.id);
      return { ok: true, message: `Reports (${res.count ?? reports.length}): ${lines.join(" · ")}` };
    }

    if (/^(search|find|catalog)(\s|$)/i.test(t) || lower === "list" || lower === "ls") {
      const q = t
        .replace(/^(search|find|catalog|list|ls)\s*/i, "")
        .trim();
      const res = await window.mySpace.space.catalog(q ? { q } : {});
      if (!res?.ok) return { ok: false, error: res?.error || "Catalog failed" };
      const bodies = res.bodies || [];
      if (!bodies.length) return { ok: true, message: q ? `No bodies for "${q}"` : "Catalog empty" };
      const lines = bodies.slice(0, 15).map((b) => `${b.name}${b.category ? ` (${b.category})` : ""}`);
      return {
        ok: true,
        message: `Catalog${q ? ` · ${q}` : ""} (${bodies.length}): ${lines.join(" · ")}`,
      };
    }

    if (/^(get|info)(\s|$)/i.test(t)) {
      const ref = t.replace(/^(get|info)\s*/i, "").trim();
      if (!ref) return { ok: false, error: "Usage: space(get earth)" };
      let id = ref;
      const listed = await window.mySpace.space.catalog({ q: ref });
      if (listed?.ok) {
        const match = matchNamedItem(listed.bodies || [], ref, "name");
        if (!match.error) id = match.item.id;
      }
      const res = await window.mySpace.space.get({ id, skipWiki: true });
      if (!res?.ok) return { ok: false, error: res?.error || "Body not found" };
      const b = res.body || {};
      return {
        ok: true,
        message: `${b.name || id}${b.category ? ` · ${b.category}` : ""}${
          b.summary || b.description
            ? ` — ${String(b.summary || b.description).slice(0, 140)}`
            : ""
        }`,
      };
    }

    if (/^open(\s|$)/i.test(t)) {
      const ref = t.replace(/^open\s*/i, "").trim();
      if (!ref) {
        await openSpace(ctx, { page: "navigate" });
        return { ok: true, message: "Opened Space" };
      }
      const rl = ref.toLowerCase();
      if (views.includes(rl)) {
        await openSpace(ctx, { page: "navigate", view: rl });
        return { ok: true, message: `Opened Space · ${rl}` };
      }
      if (pages.includes(rl)) {
        await openSpace(ctx, { page: rl });
        return { ok: true, message: `Opened Space · ${rl}` };
      }
      const listed = await window.mySpace.space.catalog({ q: ref });
      if (!listed?.ok) return { ok: false, error: listed?.error || "Catalog failed" };
      const match = matchNamedItem(listed.bodies || [], ref, "name");
      if (match.error) return { ok: false, error: match.error };
      await openSpace(ctx, {
        page: "catalog",
        action: "openBody",
        param: match.item.id,
      });
      return { ok: true, message: `Opened · ${match.item.name || match.item.id}` };
    }

    const listed = await window.mySpace.space.catalog({ q: t });
    if (listed?.ok) {
      const match = matchNamedItem(listed.bodies || [], t, "name");
      if (!match.error) {
        const res = await window.mySpace.space.get({ id: match.item.id, skipWiki: true });
        if (res?.ok) {
          const b = res.body || match.item;
          return {
            ok: true,
            message: `${b.name || t}${b.category ? ` · ${b.category}` : ""}${
              b.summary || b.description
                ? ` — ${String(b.summary || b.description).slice(0, 140)}`
                : ""
            }`,
          };
        }
      }
    }

    return {
      ok: false,
      error: `Unknown space command "${t}". ${formatSpaceCommandHelp()}`,
    };
  }

  function formatContractsCommandHelp() {
    return [
      "contracts(list) · contracts(templates) · contracts(upcoming)",
      "contracts(open Lease) · contracts(editor) · contracts(expiring) · contracts(library)",
    ].join(" · ");
  }

  async function executeContractsCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();
    const pages = ["library", "editor", "document", "expiring"];

    if (!window.mySpace?.contracts) {
      return { ok: false, error: "Contracts shell API unavailable" };
    }

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatContractsCommandHelp() };
    }

    if (pages.includes(lower)) {
      await openContracts(ctx, { page: lower === "document" ? "library" : lower });
      return { ok: true, message: `Opened Contracts · ${lower === "document" ? "library" : lower}` };
    }

    if (lower === "new") {
      await openContracts(ctx, { page: "editor", action: "openEditor" });
      return { ok: true, message: "Opened Contracts · new editor" };
    }

    if (/^list(\s|$)/i.test(t) || lower === "ls") {
      const res = await window.mySpace.contracts.list();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not list contracts" };
      const contracts = res.contracts || [];
      if (!contracts.length) return { ok: true, message: "No contracts" };
      const lines = contracts.slice(0, 15).map((c) => {
        const exp = c.expiryDate ? ` · exp ${c.expiryDate}` : "";
        return `${c.title || c.id}${exp}`;
      });
      return { ok: true, message: `Contracts (${contracts.length}): ${lines.join(" · ")}` };
    }

    if (/^templates?(\s|$)/i.test(t)) {
      const res = await window.mySpace.contracts.templates();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not list templates" };
      const templates = res.templates || [];
      if (!templates.length) return { ok: true, message: "No templates" };
      const lines = templates
        .slice(0, 15)
        .map((x) => `${x.title || x.id}${x.category ? ` (${x.category})` : ""}`);
      return { ok: true, message: `Templates (${templates.length}): ${lines.join(" · ")}` };
    }

    if (lower === "upcoming" || lower === "expiry") {
      const res = await window.mySpace.contracts.upcoming();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not load upcoming" };
      const items = res.upcoming || [];
      if (!items.length) return { ok: true, message: "No upcoming expiries" };
      const lines = items
        .slice(0, 12)
        .map((u) => `${u.title} · ${u.daysLeft != null ? `${u.daysLeft}d` : u.expiryDate || "?"}`);
      return { ok: true, message: `Upcoming: ${lines.join(" · ")}` };
    }

    if (lower === "check") {
      const res = await window.mySpace.contracts.check();
      if (!res?.ok) return { ok: false, error: res?.error || "Check failed" };
      const n = (res.triggered || []).length;
      await syncContractsIfOpen(ctx, { page: "expiring" });
      return { ok: true, message: n ? `Expiry check · ${n} alert(s)` : "Expiry check · nothing due" };
    }

    if (/^(get|info)(\s|$)/i.test(t)) {
      const ref = t.replace(/^(get|info)\s*/i, "").trim();
      if (!ref) return { ok: false, error: "Usage: contracts(get Lease)" };
      const listed = await window.mySpace.contracts.list();
      if (!listed?.ok) return { ok: false, error: listed?.error || "Could not list" };
      const match = matchNamedItem(listed.contracts || [], ref, "title");
      if (match.error) return { ok: false, error: match.error };
      const res = await window.mySpace.contracts.get(match.item.id);
      if (!res?.ok) return { ok: false, error: res?.error || "Not found" };
      const c = res.contract || match.item;
      return {
        ok: true,
        message: `${c.title}${c.expiryDate ? ` · expires ${c.expiryDate}` : ""}${
          c.status ? ` · ${c.status}` : ""
        }`,
      };
    }

    if (/^open(\s|$)/i.test(t)) {
      const ref = t.replace(/^open\s*/i, "").trim();
      if (!ref) {
        await openContracts(ctx, { page: "library" });
        return { ok: true, message: "Opened Contracts" };
      }
      if (pages.includes(ref.toLowerCase())) {
        const page = ref.toLowerCase() === "document" ? "library" : ref.toLowerCase();
        await openContracts(ctx, { page });
        return { ok: true, message: `Opened Contracts · ${page}` };
      }
      const listed = await window.mySpace.contracts.list();
      if (!listed?.ok) return { ok: false, error: listed?.error || "Could not list" };
      const match = matchNamedItem(listed.contracts || [], ref, "title");
      if (match.error) {
        const tpls = await window.mySpace.contracts.templates();
        const tm = matchNamedItem(tpls.templates || [], ref, "title");
        if (!tm.error) {
          await openContracts(ctx, {
            page: "editor",
            action: "openEditor",
            templateId: tm.item.id,
          });
          return { ok: true, message: `New from template · ${tm.item.title}` };
        }
        return { ok: false, error: match.error };
      }
      await openContracts(ctx, {
        page: "document",
        action: "openDocument",
        param: match.item.id,
      });
      return { ok: true, message: `Opened · ${match.item.title}` };
    }

    return {
      ok: false,
      error: `Unknown contracts command "${t}". ${formatContractsCommandHelp()}`,
    };
  }

  function formatMslCommandHelp() {
    return [
      "msl(open) · msl(mint) · msl(inject) · msl(about)",
      "msl(list) · msl(caps) · msl(keys) · msl(parse msl:v1/…)",
      "msl(invoke space.bodies.search q:mars) · msl(resolve msl:v1/…) · msl(help)",
    ].join(" · ");
  }

  function formatPartsCommandHelp() {
    return [
      "parts(list) · parts(get search.fuzzy) · parts(adopt search.fuzzy into notes)",
      "parts(publish) · parts(published notes) · parts(panel) · parts(about) · parts(help)",
    ].join(" · ");
  }

  function formatPermissionsCommandHelp() {
    return [
      "permissions(open) · permissions(tools) · permissions(notifications)",
      "permissions(jobs) · permissions(bridge) · permissions(external) · permissions(about)",
      "perms(overview) · permissions(help)",
    ].join(" · ");
  }

  async function executePermissionsCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();

    if (!t || /^(help|\?)$/i.test(lower)) {
      return { ok: true, message: formatPermissionsCommandHelp() };
    }

    const pageMap = {
      open: "overview",
      panel: "overview",
      overview: "overview",
      home: "overview",
      tools: "tools",
      ai: "tools",
      mind: "tools",
      notifications: "notifications",
      notif: "notifications",
      alerts: "notifications",
      mail: "notifications",
      jobs: "jobs",
      compute: "jobs",
      bridge: "bridge",
      devices: "bridge",
      external: "external",
      composio: "external",
      about: "about",
    };

    const first = lower.split(/\s+/)[0];
    const page = pageMap[first] || (ROUTE_REGISTRY.permissions.pages.includes(first) ? first : null);
    if (page) {
      await openPermissions(ctx, { page });
      return { ok: true, message: `Permissions · ${page}` };
    }

    return { ok: false, error: `Unknown permissions command. ${formatPermissionsCommandHelp()}` };
  }

  async function executePartsCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();

    if (!window.mySpace?.parts) {
      return { ok: false, error: "Parts bridge unavailable" };
    }

    if (!t || /^(help|\?)$/i.test(lower)) {
      return { ok: true, message: formatPartsCommandHelp() };
    }

    if (/^(panel|open|catalog|explore)(\s|$)/i.test(t)) {
      await openParts(ctx, { page: "explore" });
      return { ok: true, message: "Parts" };
    }
    if (/^(about|info)(\s|$)/i.test(t)) {
      await openParts(ctx, { page: "about" });
      return { ok: true, message: "Parts · about" };
    }
    if (/^(publish|upload|new)(\s|$)/i.test(t)) {
      const rest = t.replace(/^(publish|upload|new)\s*/i, "").trim();
      const app = rest.split(/\s+/)[0] || undefined;
      await openParts(ctx, { page: "publish", app });
      return { ok: true, message: app ? `Parts · publish (${app})` : "Parts · publish" };
    }

    if (/^(list|ls|caps)(\s|$)/i.test(t)) {
      const q = t.replace(/^(list|ls|caps)\s*/i, "").trim();
      const res = await window.mySpace.parts.list({ q });
      if (!res?.ok) return { ok: false, error: res?.error || "Could not list parts" };
      const rows = res.parts || [];
      if (!rows.length) return { ok: true, message: "No parts found" };
      const preview = rows
        .slice(0, 20)
        .map((p) => `${p.contract} · ${p.title}`)
        .join("\n");
      return {
        ok: true,
        message: `${rows.length} parts\n${preview}${rows.length > 20 ? "\n…" : ""}`,
      };
    }

    if (/^published(\s|$)/i.test(t)) {
      const app = t.replace(/^published\s*/i, "").trim() || undefined;
      const res = await window.mySpace.parts.published(app ? { app } : {});
      if (!res?.ok) return { ok: false, error: res?.error || "Could not list published parts" };
      if (app) {
        const rows = res.parts || [];
        if (!rows.length) return { ok: true, message: `${app}: no uploads` };
        return {
          ok: true,
          message: `${app}: ${rows.length}\n${rows.map((p) => p.id).join("\n")}`,
        };
      }
      const apps = res.apps || [];
      if (!apps.length) return { ok: true, message: "No app uploads yet" };
      return {
        ok: true,
        message: apps.map((a) => `${a.app} (${a.count})`).join("\n"),
      };
    }

    if (/^get\s+/i.test(t)) {
      const id = t.replace(/^get\s+/i, "").trim();
      if (!id) return { ok: false, error: "Usage: parts(get search.fuzzy)" };
      const res = await window.mySpace.parts.get({ id });
      if (!res?.ok) return { ok: false, error: res?.error || "Part not found" };
      const p = res.part;
      const files = Object.keys(res.files || {}).join(", ") || "(none)";
      return {
        ok: true,
        message: `${p.contract}\n${p.summary}\nFiles: ${files}\n${p.usage || ""}`.trim(),
      };
    }

    if (/^adopt\s+/i.test(t)) {
      const rest = t.replace(/^adopt\s+/i, "").trim();
      const m = rest.match(/^(\S+)\s+(?:into|to|->)\s+(\S+)$/i) || rest.match(/^(\S+)\s+(\S+)$/);
      if (!m) {
        return { ok: false, error: "Usage: parts(adopt search.fuzzy into notes)" };
      }
      const res = await window.mySpace.parts.adopt({ id: m[1], target: m[2] });
      if (!res?.ok) return { ok: false, error: res?.error || "Adopt failed" };
      return { ok: true, message: `Adopted ${res.part?.contract} → ${res.dest}` };
    }

    if (/^unpublish\s+/i.test(t)) {
      const rest = t.replace(/^unpublish\s+/i, "").trim();
      const m = rest.match(/^(\S+)\s+(?:from)\s+(\S+)$/i) || rest.match(/^(\S+)\s+(\S+)$/);
      if (!m) return { ok: false, error: "Usage: parts(unpublish notes.demo from notes)" };
      const res = await window.mySpace.parts.unpublish({ id: m[1], app: m[2] });
      if (!res?.ok) return { ok: false, error: res?.error || "Unpublish failed" };
      return { ok: true, message: `Removed ${res.removed}` };
    }

    if (/^[a-z][a-z0-9]*(\.[a-z0-9-]+)+$/i.test(t)) {
      return executePartsCommands(`get ${t}`, ctx);
    }

    return { ok: false, error: `Unknown parts command. ${formatPartsCommandHelp()}` };
  }

  function parseMslInvokeArgs(rest) {
    const parts = String(rest || "").trim().split(/\s+/).filter(Boolean);
    const capability = parts.shift() || "";
    const input = {};
    for (const part of parts) {
      const m = part.match(/^([^:=]+)[:=](.+)$/);
      if (m) input[m[1]] = m[2];
    }
    return { capability, input };
  }

  async function executeMslCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();

    if (!window.mySpace?.msl) {
      return { ok: false, error: "MSL shell API unavailable" };
    }

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatMslCommandHelp() };
    }

    if (lower === "panel" || lower === "bus" || lower === "system" || lower === "open" || lower === "home") {
      await openMsl(ctx, { page: "caps" });
      return { ok: true, message: "Opened MSL" };
    }

    if (lower === "workshop" || lower === "mint") {
      await openMsl(ctx, { page: "mint" });
      return { ok: true, message: "Opened MSL · mint" };
    }

    if (lower === "inject") {
      await openMsl(ctx, { page: "inject" });
      return { ok: true, message: "Opened MSL · inject" };
    }

    if (lower === "about") {
      await openMsl(ctx, { page: "about" });
      return { ok: true, message: "Opened MSL · about" };
    }

    if (/^(list|caps|capabilities)(\s|$)/i.test(t) || lower === "ls") {
      const res = await window.mySpace.msl.list();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not list capabilities" };
      const caps = res.capabilities || [];
      if (!caps.length) return { ok: true, message: "No MSL capabilities" };
      const lines = caps
        .slice(0, 20)
        .map((c) => `${c.id}${c.kind ? ` (${c.kind})` : ""}`);
      return {
        ok: true,
        message: `MSL caps (${caps.length}): ${lines.join(" · ")}${
          caps.length > 20 ? "…" : ""
        }`,
      };
    }

    if (/^keys(\s|$)/i.test(t)) {
      const res = await window.mySpace.msl.keys();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not list keys" };
      const keys = res.keys || [];
      if (!keys.length) return { ok: true, message: "No saved MSL keys" };
      const lines = keys.slice(0, 12).map((k) => k.label || k.uri || k.id || JSON.stringify(k));
      return { ok: true, message: `MSL keys (${keys.length}): ${lines.join(" · ")}` };
    }

    if (/^parse(\s|$)/i.test(t)) {
      const uri = t.replace(/^parse\s*/i, "").trim();
      if (!uri) return { ok: false, error: "Usage: msl(parse msl:v1/…)" };
      const res = await window.mySpace.msl.parse(uri);
      if (!res?.ok) return { ok: false, error: res?.error || "Parse failed" };
      return {
        ok: true,
        message: `Parsed · ${res.capability || "?"}${
          res.version ? ` v${res.version}` : ""
        }`,
      };
    }

    if (/^resolve(\s|$)/i.test(t)) {
      const uri = t.replace(/^resolve\s*/i, "").trim();
      if (!uri) return { ok: false, error: "Usage: msl(resolve msl:v1/…)" };
      const res = await window.mySpace.msl.resolve(uri);
      if (!res?.ok && res?.result?.ok === false) {
        return { ok: false, error: res.result?.error || res.error || "Resolve failed" };
      }
      if (res?.ok === false) return { ok: false, error: res?.error || "Resolve failed" };
      return {
        ok: true,
        message: `Resolved · ${res.capability || "?"}${
          res.result?.ok === false ? ` · ${res.result.error}` : ""
        }`,
      };
    }

    if (/^invoke(\s|$)/i.test(t)) {
      const rest = t.replace(/^invoke\s*/i, "").trim();
      if (!rest) return { ok: false, error: "Usage: msl(invoke capability [key:value…])" };
      const { capability, input } = parseMslInvokeArgs(rest);
      if (!capability) return { ok: false, error: "Missing capability id" };
      const res = await window.mySpace.msl.invoke({ capability, input });
      if (!res || res.ok === false) {
        return { ok: false, error: res?.error || "Invoke failed" };
      }
      const preview = JSON.stringify(res).slice(0, 180);
      return { ok: true, message: `Invoked ${capability} · ${preview}${preview.length >= 180 ? "…" : ""}` };
    }

    return {
      ok: false,
      error: `Unknown msl command "${t}". ${formatMslCommandHelp()}`,
    };
  }

  function formatPulseCommandHelp() {
    return [
      "Pulse: Link Bus (internal apps + Composio external tools)",
      "pulse(panel) · pulse(external) · pulse(routes) · pulse(log) · pulse(stats)",
      "pulse(send notes create title=Hi) · pulse(send composio status)",
      "pulse(send composio connect toolkit=github) · pulse(send composio sync)",
      "pulse(pub pulse.ping message=hi) · pulse(sub notes.*) · pulse(help)",
    ].join(" · ");
  }

  function parsePulseKv(rest) {
    const input = {};
    for (const part of String(rest || "").trim().split(/\s+/).filter(Boolean)) {
      const m = part.match(/^([^:=]+)[:=](.+)$/);
      if (m) input[m[1]] = m[2];
    }
    return input;
  }

  async function executePulseCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();

    if (!window.mySpace?.link) {
      return { ok: false, error: "Pulse shell API unavailable" };
    }

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatPulseCommandHelp() };
    }

    if (lower === "panel" || lower === "bus" || lower === "open" || lower === "home" || lower === "directory") {
      if (window.MySpacePulse?.open) {
        await window.MySpacePulse.open({ page: "directory" });
      } else {
        window.MySpaceLinkPanel?.show?.("routes");
      }
      return { ok: true, message: "Opened Pulse" };
    }

    if (lower === "external" || lower === "composio" || lower === "tools") {
      if (window.MySpacePulse?.open) {
        await window.MySpacePulse.open({ page: "external" });
      }
      return { ok: true, message: "Opened Pulse External (Composio)" };
    }

    if (lower === "activity" || lower === "log") {
      if (window.MySpacePulse?.open) {
        await window.MySpacePulse.open({ page: "activity" });
      } else {
        window.MySpaceLinkPanel?.show?.("log");
      }
      return { ok: true, message: "Opened Pulse activity log" };
    }

    if (lower === "routes" || lower === "list" || lower === "caps") {
      const res = await window.mySpace.link.routes();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not list routes" };
      const cmds = res.commands || [];
      const lines = cmds.slice(0, 16).map((r) => `${r.id} (${r.delivery})`);
      return {
        ok: true,
        message: `Pulse routes (${cmds.length}): ${lines.join(" · ")}${cmds.length > 16 ? "…" : ""}`,
      };
    }

    if (lower === "events") {
      const res = await window.mySpace.link.routes({ kind: "event" });
      const evts = res?.events || [];
      return {
        ok: true,
        message: `Pulse events (${evts.length}): ${evts
          .slice(0, 12)
          .map((e) => e.id)
          .join(" · ")}`,
      };
    }

    if (lower === "log") {
      if (window.MySpacePulse?.open) {
        await window.MySpacePulse.open({ page: "activity" });
      } else {
        window.MySpaceLinkPanel?.show?.("log");
      }
      return { ok: true, message: "Opened Pulse activity log" };
    }

    if (lower === "stats") {
      const res = await window.mySpace.link.stats();
      if (!res?.ok) return { ok: false, error: res?.error || "Stats unavailable" };
      return {
        ok: true,
        message: `Pulse · ${res.routes?.commands || 0} commands · ${res.routes?.events || 0} events · ${res.total || 0} log entries · ${res.subscriptions || 0} subs`,
      };
    }

    if (/^sub\s+/i.test(t)) {
      const topic = t.replace(/^sub\s+/i, "").trim();
      if (!topic) return { ok: false, error: "Usage: pulse(sub notes.*)" };
      const res = await window.mySpace.link.subscribe({ topics: [topic] });
      if (!res?.ok) return { ok: false, error: res?.error || "Subscribe failed" };
      return { ok: true, message: `Subscribed to ${topic}` };
    }

    if (/^pub\s+/i.test(t) || /^publish\s+/i.test(t)) {
      const rest = t.replace(/^(pub|publish)\s+/i, "").trim();
      const space = rest.indexOf(" ");
      const topic = (space > 0 ? rest.slice(0, space) : rest).trim();
      const kv = parsePulseKv(space > 0 ? rest.slice(space + 1) : "");
      if (!topic) return { ok: false, error: "Usage: pulse(pub topic key=value)" };
      const res = await window.mySpace.link.publish({ topic, payload: kv });
      if (!res?.ok) return { ok: false, error: res?.error || "Publish failed" };
      return { ok: true, message: `Published ${topic} · delivered ${res.delivered || 0}` };
    }

    if (/^send\s+/i.test(t)) {
      const rest = t.replace(/^send\s+/i, "").trim();
      const parts = rest.split(/\s+/);
      const target = parts.shift() || "";
      const verb = parts.shift() || "";
      const args = parsePulseKv(parts.join(" "));
      if (!target || !verb) return { ok: false, error: "Usage: pulse(send notes create title=Hi)" };
      const res = await window.mySpace.link.send({ target, verb, args });
      if (!res?.ok) return { ok: false, error: res?.error || "Send failed" };
      const preview = JSON.stringify(res.result || res).slice(0, 160);
      return { ok: true, message: `Sent ${target}.${verb} · ${preview}` };
    }

    return {
      ok: false,
      error: `Unknown pulse command "${t}". ${formatPulseCommandHelp()}`,
    };
  }

  function formatResolveCommandHelp() {
    return [
      "resolve(open) · resolve(inbox) · resolve(status) · resolve(list)",
      "resolve(ask <app> <CODE>) · resolve(playbooks)",
      "pulse(send resolve report appId:notes code:LOAD_FAILED message:…)",
      "resolve(help)",
    ].join(" · ");
  }

  function formatUpdatesCommandHelp() {
    return [
      "updates(open) · updates(pending) · updates(history) · updates(about)",
      "updates(status) · updates(check) · updates(list)",
      "updates(help)",
    ].join(" · ");
  }

  function formatNetworkCommandHelp() {
    return [
      "network(open) · network(status) · network(check) · network(adapters)",
      "network(ports) · network(about) · network(settings)",
      "network(help)",
    ].join(" · ");
  }

  function formatInfoCommandHelp() {
    return [
      "info(open) · info(services) · info(apps) · info(external) · info(about)",
      "info(help)",
    ].join(" · ");
  }

  async function executeUpdatesCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();

    if (!window.mySpace?.updates) {
      return { ok: false, error: "Updates shell API unavailable" };
    }

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatUpdatesCommandHelp() };
    }

    if (["panel", "open", "home", "pending"].includes(lower)) {
      await openUpdates(ctx, { page: "pending" });
      return { ok: true, message: "Opened Updates · pending" };
    }

    if (lower === "history") {
      await openUpdates(ctx, { page: "history" });
      return { ok: true, message: "Opened Updates · history" };
    }

    if (lower === "about") {
      await openUpdates(ctx, { page: "about" });
      return { ok: true, message: "Opened Updates · about" };
    }

    if (lower === "status") {
      const res = await window.mySpace.updates.status();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not read status" };
      const c = res.counts || {};
      return {
        ok: true,
        message: `Updates: ${c.pending || 0} pending · ${c.applied || 0} applied · ${c.all || 0} in catalog`,
      };
    }

    if (lower === "check") {
      const res = await window.mySpace.updates.check();
      if (!res?.ok) return { ok: false, error: res?.error || "Check failed" };
      return { ok: true, message: res.pending ? `${res.pending} pending (bell notified)` : "No pending major updates" };
    }

    if (/^(list|ls)(\s|$)/i.test(t)) {
      const rest = t.replace(/^(list|ls)\s*/i, "").trim() || "pending";
      const res = await window.mySpace.updates.list({ filter: rest });
      if (!res?.ok) return { ok: false, error: res?.error || "Could not list updates" };
      const items = res.updates || [];
      if (!items.length) return { ok: true, message: "No updates in this filter" };
      const lines = items.slice(0, 8).map((u) => `v${u.version || u.id} · ${u.status} · ${u.title}`);
      return { ok: true, message: lines.join("\n") };
    }

    return { ok: false, error: `Unknown updates command. try updates(help)` };
  }

  async function executeNetworkCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();

    if (!window.mySpace?.network) {
      return { ok: false, error: "Network shell API unavailable" };
    }

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatNetworkCommandHelp() };
    }

    if (["panel", "open", "home"].includes(lower)) {
      await openNetwork(ctx, { page: "status" });
      return { ok: true, message: "Opened Network · status" };
    }

    if (lower === "adapters" || lower === "interfaces" || lower === "ifaces") {
      await openNetwork(ctx, { page: "adapters" });
      return { ok: true, message: "Opened Network · adapters" };
    }

    if (lower === "ports" || lower === "port") {
      await openNetwork(ctx, { page: "ports" });
      return { ok: true, message: "Opened Network · ports" };
    }

    if (lower === "about") {
      await openNetwork(ctx, { page: "about" });
      return { ok: true, message: "Opened Network · about" };
    }

    if (lower === "settings" || lower === "windows") {
      const res = await window.mySpace.network.openSettings();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not open settings" };
      return { ok: true, message: "Opened Windows Network settings" };
    }

    if (lower === "status" || lower === "info") {
      const res = await window.mySpace.network.status();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not read status" };
      return {
        ok: true,
        message: `Network: ${res.online ? "online" : "offline"} · ${res.primaryIp || "—"} · ${
          res.primaryName || "no adapter"
        }`,
      };
    }

    if (lower === "check" || lower === "probe") {
      const res = await window.mySpace.network.check();
      if (!res?.ok) return { ok: false, error: res?.error || "Check failed" };
      const c = res.checks || {};
      return {
        ok: true,
        message: `Reachability: ${c.passed || 0}/${c.total || 0} passed · host ${
          res.online ? "online" : "offline"
        }`,
      };
    }

    if (/^(adapters|interfaces|ifaces)(\s+list)?$/i.test(t) || lower === "list adapters") {
      const res = await window.mySpace.network.adapters();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not list adapters" };
      const items = res.adapters || [];
      if (!items.length) return { ok: true, message: "No adapters found" };
      const lines = items
        .slice(0, 10)
        .map(
          (a) =>
            `${a.connected ? "●" : "○"} ${a.name} · ${a.ipv4Primary || "—"} · ${a.statusLabel || a.status}`
        );
      return { ok: true, message: lines.join("\n") };
    }

    if (/^ports(\s|$)/i.test(t) || /^ls ports/i.test(t)) {
      const res = await window.mySpace.network.ports({ state: "LISTENING", limit: 12 });
      if (!res?.ok) return { ok: false, error: res?.error || "Could not list ports" };
      const items = res.ports || [];
      if (!items.length) return { ok: true, message: "No listening ports" };
      const lines = items.map(
        (p) => `${p.protocol} :${p.localPort} · ${p.processName || "?"} · pid ${p.pid || "—"}`
      );
      return { ok: true, message: lines.join("\n") };
    }

    return { ok: false, error: `Unknown network command: try network(help)` };
  }

  async function executeInfoCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatInfoCommandHelp() };
    }

    if (["panel", "open", "home", "catalog", "all"].includes(lower)) {
      await openInfo(ctx, { page: "catalog" });
      return { ok: true, message: "Opened Info · catalog" };
    }

    if (lower === "services" || lower === "platform" || lower === "service") {
      await openInfo(ctx, { page: "services" });
      return { ok: true, message: "Opened Info · services" };
    }

    if (lower === "apps" || lower === "app") {
      await openInfo(ctx, { page: "apps" });
      return { ok: true, message: "Opened Info · apps" };
    }

    if (lower === "external" || lower === "externals") {
      await openInfo(ctx, { page: "external" });
      return { ok: true, message: "Opened Info · external" };
    }

    if (lower === "about") {
      await openInfo(ctx, { page: "about" });
      return { ok: true, message: "Opened Info · about" };
    }

    return { ok: false, error: `Unknown info command: try info(help)` };
  }

  async function executeResolveCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();

    if (!window.mySpace?.resolve) {
      return { ok: false, error: "Resolve shell API unavailable" };
    }

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatResolveCommandHelp() };
    }

    if (["panel", "open", "home", "inbox"].includes(lower)) {
      await openResolve(ctx, { page: "inbox" });
      return { ok: true, message: "Opened Resolve · inbox" };
    }

    if (lower === "playbooks") {
      await openResolve(ctx, { page: "playbooks" });
      return { ok: true, message: "Opened Resolve · playbooks" };
    }

    if (lower === "about") {
      await openResolve(ctx, { page: "about" });
      return { ok: true, message: "Opened Resolve · about" };
    }

    if (lower === "status") {
      const res = await window.mySpace.resolve.status();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not read status" };
      return {
        ok: true,
        message: `Resolve: ${res.open || 0} open · ${res.resolved || 0} resolved · ${res.playbooks || 0} playbooks`,
      };
    }

    if (/^(list|ls)(\s|$)/i.test(t)) {
      const rest = t.replace(/^(list|ls)\s*/i, "").trim();
      const status = rest || "open";
      const res = await window.mySpace.resolve.list({ status: status === "all" ? "" : status, limit: 20 });
      if (!res?.ok) return { ok: false, error: res?.error || "Could not list incidents" };
      const items = res.incidents || [];
      if (!items.length) return { ok: true, message: "No incidents" };
      const lines = items
        .slice(0, 10)
        .map((i) => `${i.appId}.${i.code} [${i.id}]`);
      return {
        ok: true,
        message: `Incidents (${items.length}): ${lines.join(" · ")}${items.length > 10 ? "…" : ""}`,
      };
    }

    if (/^playbooks?$/i.test(lower)) {
      const res = await window.mySpace.resolve.playbooks();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not list playbooks" };
      const rows = res.playbooks || [];
      if (!rows.length) return { ok: true, message: "No playbooks" };
      return {
        ok: true,
        message: rows.map((p) => p.id).slice(0, 12).join(" · "),
      };
    }

    if (/^ask\s+/i.test(t)) {
      const rest = t.replace(/^ask\s+/i, "").trim();
      const parts = rest.split(/\s+/);
      const appId = parts.shift();
      const code = parts.shift();
      if (!appId || !code) {
        return { ok: false, error: "Usage: resolve(ask <app> <CODE>)" };
      }
      const res = await window.mySpace.resolve.ask({
        appId,
        code,
        message: parts.join(" "),
      });
      if (!res?.ok) return { ok: false, error: res?.error || "Ask failed" };
      if (!res.hasFix) {
        return { ok: true, message: `No playbook for ${appId}.${code} (${res.category})` };
      }
      const step = (res.steps || [])[0];
      return {
        ok: true,
        message: `${res.playbook?.title || res.playbook?.id}: ${step?.label || step?.action || "see Resolve"}`,
      };
    }

    return {
      ok: false,
      error: `Unknown resolve command "${t}". ${formatResolveCommandHelp()}`,
    };
  }

  function formatJobsCommandHelp() {
    return [
      "Jobs is the OS runtime: launches & shell are jobs automatically",
      "jobs(list) · jobs(stats) · jobs(capacity) · jobs(open)",
      "jobs(cancel <id>) · jobs(clear) · jobs(help)",
    ].join(" · ");
  }

  function formatSchedulerCommandHelp() {
    return [
      "Scheduler is the OS time runtime, when work fires",
      "schedule(list) · schedule(stats) · schedule(open)",
      "schedule(add every 1h <cmd>) · schedule(add daily 02:00 <cmd>)",
      "schedule(pause <id>) · schedule(run-now <id>) · schedule(remove <id>) · schedule(help)",
    ].join(" · ");
  }

  async function executeSchedulerCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();

    if (!window.mySpace?.scheduler) {
      return { ok: false, error: "Scheduler shell API unavailable" };
    }

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatSchedulerCommandHelp() };
    }

    if (
      lower === "panel" ||
      lower === "open" ||
      lower === "home" ||
      lower === "active" ||
      lower === "queue"
    ) {
      await openScheduler(ctx, { page: "active" });
      return { ok: true, message: "Opened Scheduler" };
    }

    if (lower === "all" || lower === "list-ui" || lower === "schedules") {
      await openScheduler(ctx, { page: "all" });
      return { ok: true, message: "Opened Scheduler · all" };
    }

    if (lower === "runs" || lower === "log" || lower === "history-ui") {
      await openScheduler(ctx, { page: "history" });
      return { ok: true, message: "Opened Scheduler · history" };
    }

    if (lower === "new" || lower === "create" || lower === "add-ui" || lower === "enqueue") {
      await openScheduler(ctx, { page: "new" });
      return { ok: true, message: "Opened Scheduler · new" };
    }

    if (lower === "about") {
      await openScheduler(ctx, { page: "about" });
      return { ok: true, message: "Opened Scheduler · about" };
    }

    if (/^(list|ls)(\s|$)/i.test(t)) {
      const status = t.replace(/^(list|ls)\s*/i, "").trim().toLowerCase();
      const res = await window.mySpace.scheduler.list(status ? { status } : { status: "active" });
      if (res?.ok === false) return { ok: false, error: res.error || "Could not list schedules" };
      const items = res.schedules || [];
      if (!items.length) return { ok: true, message: status ? `No ${status} schedules` : "No schedules" };
      const lines = items.slice(0, 12).map((s) => {
        const trig =
          s.trigger?.type === "interval"
            ? `every ${Math.round((s.trigger.everyMs || 0) / 60000)}m`
            : s.trigger?.type === "daily"
              ? `daily ${s.trigger.time}`
              : s.trigger?.type || "?";
        return `${s.enabled ? "active" : s.status}:${trig} ${s.title} [${s.id}]`;
      });
      return {
        ok: true,
        message: `Schedules (${items.length}): ${lines.join(" · ")}${items.length > 12 ? "…" : ""}`,
      };
    }

    if (lower === "stats" || lower === "status") {
      const res = await window.mySpace.scheduler.stats();
      const s = res?.stats || {};
      return {
        ok: true,
        message: `Scheduler · active ${s.active || 0} · paused ${s.paused || 0} · total ${
          s.total || 0
        }${s.nextRunAt ? ` · next ${s.nextRunAt}` : ""}`,
      };
    }

    if (/^add(\s|$)/i.test(t)) {
      const spec = t.replace(/^add\s*/i, "").trim();
      if (!spec) {
        return {
          ok: false,
          error: "Usage: schedule(add every 1h <cmd>) · schedule(add daily 02:00 <cmd>)",
        };
      }
      const res = await window.mySpace.scheduler.add({ spec, source: "shell" });
      if (res?.ok === false) return { ok: false, error: res.error || "Add failed" };
      const s = res.schedule;
      return {
        ok: true,
        message: `Scheduled · ${s?.title || s?.id}${s?.nextRunAt ? ` · next ${s.nextRunAt}` : ""} [${
          s?.id
        }]`,
      };
    }

    if (/^pause(\s|$)/i.test(t)) {
      const id = t.replace(/^pause\s*/i, "").trim();
      if (!id) return { ok: false, error: "Usage: schedule(pause <id>)" };
      const res = await window.mySpace.scheduler.pause(id);
      if (res?.ok === false) return { ok: false, error: res.error || "Pause failed" };
      return { ok: true, message: `Paused · ${id}` };
    }

    if (/^resume(\s|$)/i.test(t)) {
      const id = t.replace(/^resume\s*/i, "").trim();
      if (!id) return { ok: false, error: "Usage: schedule(resume <id>)" };
      const res = await window.mySpace.scheduler.resume(id);
      if (res?.ok === false) return { ok: false, error: res.error || "Resume failed" };
      return { ok: true, message: `Resumed · ${id}` };
    }

    if (/^(remove|cancel|rm|delete)(\s|$)/i.test(t)) {
      const id = t.replace(/^(remove|cancel|rm|delete)\s*/i, "").trim();
      if (!id) return { ok: false, error: "Usage: schedule(remove <id>)" };
      const res = await window.mySpace.scheduler.remove(id);
      if (res?.ok === false) return { ok: false, error: res.error || "Remove failed" };
      return { ok: true, message: `Removed · ${id}` };
    }

    if (/^(run-now|runnow|run|fire)(\s|$)/i.test(t)) {
      const id = t.replace(/^(run-now|runnow|run|fire)\s*/i, "").trim();
      if (!id) return { ok: false, error: "Usage: schedule(run-now <id>)" };
      const res = await window.mySpace.scheduler.runNow(id);
      if (res?.ok === false) return { ok: false, error: res.error || "Run failed" };
      return {
        ok: true,
        message: `Fired · ${id}${res?.result?.message ? ` · ${res.result.message}` : ""}`,
      };
    }

    if (lower === "history") {
      const res = await window.mySpace.scheduler.history({ limit: 10 });
      const rows = res?.history || [];
      if (!rows.length) return { ok: true, message: "No schedule history" };
      return {
        ok: true,
        message: rows
          .map((h) => `${h.ok ? "ok" : "fail"} ${h.title}: ${h.message || ""}`)
          .join(" · "),
      };
    }

    if (lower === "clearhistory" || lower === "clear-history") {
      await window.mySpace.scheduler.clearHistory();
      return { ok: true, message: "Cleared schedule history" };
    }

    return {
      ok: false,
      error: `Unknown schedule command "${t}". ${formatSchedulerCommandHelp()}`,
    };
  }

  async function executeJobsCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();

    if (!window.mySpace?.jobs) {
      return { ok: false, error: "Jobs shell API unavailable" };
    }

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatJobsCommandHelp() };
    }

    if (lower === "panel" || lower === "queue" || lower === "open" || lower === "home") {
      await openJobs(ctx, { page: "queue" });
      return { ok: true, message: "Opened Jobs" };
    }

    if (lower === "enqueue" || lower === "new") {
      await openJobs(ctx, { page: "enqueue" });
      return { ok: true, message: "Opened Jobs · enqueue" };
    }

    if (lower === "capacity" || lower === "contract" || lower === "budget") {
      await openJobs(ctx, { page: "capacity" });
      return { ok: true, message: "Opened Jobs · capacity" };
    }

    if (lower === "active") {
      await openJobs(ctx, { page: "active" });
      return { ok: true, message: "Opened Jobs · active" };
    }

    if (lower === "done" || lower === "history") {
      await openJobs(ctx, { page: "done" });
      return { ok: true, message: "Opened Jobs · done" };
    }

    if (lower === "about") {
      await openJobs(ctx, { page: "about" });
      return { ok: true, message: "Opened Jobs · about" };
    }

    if (/^(list|ls)(\s|$)/i.test(t)) {
      const status = t.replace(/^(list|ls)\s*/i, "").trim().toLowerCase();
      const res = await window.mySpace.jobs.list(status ? { status } : {});
      if (!res?.ok && res?.ok !== undefined && res.ok === false) {
        return { ok: false, error: res.error || "Could not list jobs" };
      }
      const items = res.jobs || [];
      if (!items.length) return { ok: true, message: "No jobs" };
      const lines = items
        .slice(0, 12)
        .map((j) => `${j.status}:${j.kind} ${j.title} [${j.id}]`);
      return {
        ok: true,
        message: `Jobs (${items.length}): ${lines.join(" · ")}${items.length > 12 ? "…" : ""}`,
      };
    }

    if (lower === "stats" || lower === "status") {
      const res = await window.mySpace.jobs.stats();
      const s = res?.stats || {};
      return {
        ok: true,
        message: `Jobs · queued ${s.queued || 0} · running ${s.running || 0} · ok ${
          s.succeeded || 0
        } · fail ${s.failed || 0}${s.pausedByFocus ? " · paused by Focus" : ""}`,
      };
    }

    if (/^capacity(\s+set)?(\s|$)/i.test(t) && !/^capacity$/i.test(t)) {
      const rest = t.replace(/^capacity(\s+set)?\s*/i, "").trim();
      const patch = {};
      for (const part of rest.split(/\s+/).filter(Boolean)) {
        const m = part.match(/^([^:=]+)[:=](.+)$/);
        if (!m) continue;
        const key = m[1];
        const val = m[2];
        if (["maxConcurrent", "maxQueued", "dailyBudgetSeconds"].includes(key)) {
          patch[key] = Number(val);
        } else if (["pauseWhenFocus", "notifyOnDone", "allowShell", "allowScript", "allowFileWrite", "allowHost", "allowAppBuild"].includes(key)) {
          patch[key] = /^(1|true|yes|on)$/i.test(val);
        }
      }
      if (!Object.keys(patch).length) {
        return { ok: false, error: "Usage: jobs(capacity set maxConcurrent:3 pauseWhenFocus:true)" };
      }
      const res = await window.mySpace.jobs.setCapacity(patch);
      if (res?.ok === false) return { ok: false, error: res.error || "Capacity update failed" };
      return { ok: true, message: "Capacity contract updated" };
    }

    if (lower === "clear" || lower === "clearfinished") {
      await window.mySpace.jobs.clearFinished();
      return { ok: true, message: "Cleared finished jobs" };
    }

    if (/^cancel(\s|$)/i.test(t)) {
      const id = t.replace(/^cancel\s*/i, "").trim();
      if (!id) return { ok: false, error: "Usage: jobs(cancel <id>)" };
      const res = await window.mySpace.jobs.cancel(id);
      if (res?.ok === false) return { ok: false, error: res.error || "Cancel failed" };
      return { ok: true, message: `Cancelled · ${id}` };
    }

    if (/^retry(\s|$)/i.test(t)) {
      const id = t.replace(/^retry\s*/i, "").trim();
      if (!id) return { ok: false, error: "Usage: jobs(retry <id>)" };
      const res = await window.mySpace.jobs.retry(id);
      if (res?.ok === false) return { ok: false, error: res.error || "Retry failed" };
      return { ok: true, message: `Re-queued · ${res.job?.title || id}` };
    }

    if (/^(run|shell)(\s|$)/i.test(t)) {
      const command = t.replace(/^(run|shell)\s*/i, "").trim();
      if (!command) return { ok: false, error: "Usage: jobs(run <shell command>)" };
      const res = await window.mySpace.jobs.enqueue({ kind: "shell", command, source: "shell" });
      if (res?.ok === false) return { ok: false, error: res.error || "Enqueue failed" };
      return { ok: true, message: `Queued shell · ${res.job?.id || "?"}` };
    }

    if (/^script(\s|$)/i.test(t)) {
      const scriptName = t.replace(/^script\s*/i, "").trim();
      if (!scriptName) return { ok: false, error: "Usage: jobs(script <name>)" };
      const res = await window.mySpace.jobs.enqueue({
        kind: "script",
        scriptName,
        source: "shell",
      });
      if (res?.ok === false) return { ok: false, error: res.error || "Enqueue failed" };
      return { ok: true, message: `Queued script · ${scriptName}` };
    }

    if (/^delay(\s|$)/i.test(t)) {
      const ms = Number(t.replace(/^delay\s*/i, "").trim()) || 1000;
      const res = await window.mySpace.jobs.enqueue({ kind: "delay", delayMs: ms, source: "shell" });
      if (res?.ok === false) return { ok: false, error: res.error || "Enqueue failed" };
      return { ok: true, message: `Queued delay · ${ms}ms` };
    }

    if (lower === "noop" || lower === "ping") {
      const res = await window.mySpace.jobs.enqueue({ kind: "noop", title: "No-op", source: "shell" });
      if (res?.ok === false) return { ok: false, error: res.error || "Enqueue failed" };
      return { ok: true, message: `Queued noop · ${res.job?.id || "?"}` };
    }

    return {
      ok: false,
      error: `Unknown jobs command "${t}". ${formatJobsCommandHelp()}`,
    };
  }

  function formatMindCommandHelp() {
    return [
      "Mind: pick a task — quick (cheap) · chat (everyday) · think (deep/expensive)",
      "mind(panel) opens Mind Chat · mind(setup) keys/models · mind(memory list|add …) · mind(ask …) · mind(quick …) · mind(think …) · mind(test) · mind(help)",
    ].join(" · ");
  }

  function parseMindAskInner(raw) {
    let text = String(raw || "").trim();
    let task = "chat";
    const prefix = text.match(/^(quick|chat|think|deep|fast|cheap|hard|pro|everyday)\s*:\s*/i);
    if (prefix) {
      const map = {
        quick: "quick",
        fast: "quick",
        cheap: "quick",
        chat: "chat",
        everyday: "chat",
        think: "think",
        deep: "think",
        hard: "think",
        pro: "think",
      };
      task = map[prefix[1].toLowerCase()] || "chat";
      text = text.slice(prefix[0].length).trim();
    }
    return { prompt: text, task };
  }

  async function executeMindCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();
    if (!window.mySpace?.mind) {
      return { ok: false, error: "Mind shell API unavailable" };
    }
    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatMindCommandHelp() };
    }
    if (lower === "panel" || lower === "open" || lower === "home" || lower === "chat") {
      if (window.MySpaceMindChat?.open) {
        await window.MySpaceMindChat.open();
        return { ok: true, message: "Opened Mind Chat" };
      }
      window.MySpaceMindPanel?.show?.("ask");
      return { ok: true, message: "Opened Mind" };
    }
    if (lower === "ask") {
      window.MySpaceMindPanel?.show?.("ask");
      return { ok: true, message: "Opened Mind · Ask" };
    }
    if (lower === "setup" || lower === "providers" || lower === "keys" || lower === "settings") {
      window.MySpaceMindPanel?.show?.("setup");
      return { ok: true, message: "Opened Mind · Setup" };
    }
    if (lower === "status" || lower === "stats") {
      const res = await window.mySpace.mind.status();
      if (res?.ok === false) return { ok: false, error: res.error || "Mind status failed" };
      const lines = (res.tasks || [])
        .map((x) => `${x.label}:${x.model}`)
        .join(" · ");
      return {
        ok: true,
        message: `Mind · default ${res.defaultTask || "chat"} · ${lines || "—"} · budget ${
          res.budget?.usedTokensToday || 0
        }${res.budget?.dailyTokens ? `/${res.budget.dailyTokens}` : ""}`,
      };
    }
    if (lower === "test" || lower.startsWith("test ")) {
      const rest = t.slice(4).trim();
      const task =
        /^(quick|chat|think)$/i.test(rest) ? rest.toLowerCase() : undefined;
      const res = await window.mySpace.mind.test(task ? { task } : { task: "quick" });
      if (res?.ok === false) return { ok: false, error: res.error || "Mind test failed" };
      return { ok: true, message: res.message || "Mind test ok" };
    }

    if (lower === "memory" || lower.startsWith("memory ")) {
      const memApi = window.mySpace?.mind?.memory;
      if (!memApi) return { ok: false, error: "Mind memory API unavailable." };
      const rest = lower === "memory" ? "" : t.slice(7).trim();
      if (!rest || rest === "help") {
        return {
          ok: true,
          message:
            "mind(memory list) · mind(memory add <fact>) · mind(memory clear) · mind(memory on|off)",
        };
      }
      if (rest === "list") {
        const res = await memApi.list();
        if (res?.ok === false) return { ok: false, error: res.error || "Memory list failed" };
        const lines = (res.facts || []).map((f) => `• ${f.text}${f.tags?.length ? ` [${f.tags.join(", ")}]` : ""}`);
        return {
          ok: true,
          message: lines.length
            ? `Memory (${res.count})${res.enabled === false ? " · off" : ""}:\n${lines.join("\n")}`
            : "Memory is empty",
        };
      }
      if (rest === "clear") {
        const res = await memApi.clear();
        return res?.ok === false
          ? { ok: false, error: res.error || "Clear failed" }
          : { ok: true, message: "Memory cleared" };
      }
      if (rest === "on" || rest === "off") {
        const res = await memApi.setEnabled(rest === "on");
        return res?.ok === false
          ? { ok: false, error: res.error || "Toggle failed" }
          : { ok: true, message: `Memory ${rest === "on" ? "enabled" : "disabled"}` };
      }
      if (rest.startsWith("add ")) {
        const text = t.slice(11).trim();
        if (!text) return { ok: false, error: "Usage: mind(memory add <fact>)" };
        const res = await memApi.add({ text });
        return res?.ok === false
          ? { ok: false, error: res.error || "Add failed" }
          : { ok: true, message: `Saved: ${text}` };
      }
      return { ok: false, error: `Unknown memory command. mind(memory help)` };
    }

    const taskVerb = lower.match(/^(quick|chat|think|deep|fast)\s+([\s\S]+)$/);
    if (taskVerb) {
      const map = { quick: "quick", fast: "quick", chat: "chat", think: "think", deep: "think" };
      const task = map[taskVerb[1]] || "chat";
      const prompt = taskVerb[2].trim();
      if (!prompt) return { ok: false, error: `Usage: mind(${task} <prompt>)` };
      const res = await window.mySpace.mind.ask({ prompt, task });
      if (res?.ok === false) return { ok: false, error: res.error || "Mind ask failed" };
      return {
        ok: true,
        message: `${res.text || ""}\n— ${res.taskLabel || task} · ${res.model || ""}`,
      };
    }

    if (lower.startsWith("ask ")) {
      const { prompt, task } = parseMindAskInner(t.slice(4).trim());
      if (!prompt) return { ok: false, error: "Usage: mind(ask <prompt>) or mind(ask think: …)" };
      const res = await window.mySpace.mind.ask({ prompt, task });
      if (res?.ok === false) return { ok: false, error: res.error || "Mind ask failed" };
      return {
        ok: true,
        message: `${res.text || ""}\n— ${res.taskLabel || task} · ${res.model || ""}`,
      };
    }

    if (t && !/^(panel|status|test|ask|setup|providers|help|keys|settings)/i.test(t)) {
      const res = await window.mySpace.mind.ask({ prompt: t, task: "chat" });
      if (res?.ok === false) return { ok: false, error: res.error || "Mind ask failed" };
      return {
        ok: true,
        message: `${res.text || ""}\n— ${res.taskLabel || "Everyday"} · ${res.model || ""}`,
      };
    }
    return {
      ok: false,
      error: `Unknown mind command "${t}". ${formatMindCommandHelp()}`,
    };
  }

  function formatLexiconCommandHelp() {
    return [
      "lexicon(search promise) · lexicon(get closure) · lexicon(daily)",
      "lexicon(stats) · lexicon(categories) · lexicon(open promise) · lexicon(promise)",
    ].join(" · ");
  }

  function formatTermLine(term) {
    if (!term) return "—";
    const name = term.term || term.id;
    const blurb = String(term.short || term.summary || term.definition || "")
      .replace(/\s+/g, " ")
      .slice(0, 100);
    return `${name}${term.category ? ` · ${term.category}` : ""}${blurb ? ` — ${blurb}` : ""}`;
  }

  async function resolveLexiconTerm(ref) {
    const q = String(ref || "").trim();
    if (!q) return { error: "Missing term" };
    const direct = await window.mySpace.lexicon.get({ id: q, slug: q });
    if (direct?.ok && direct.term) return { term: direct.term };
    const searched = await window.mySpace.lexicon.search({ q, limit: 20 });
    if (!searched?.ok) return { error: searched?.error || "Search failed" };
    const match = matchNamedItem(searched.terms || [], q, "term");
    if (match.error) {
      if ((searched.terms || []).length === 1) return { term: searched.terms[0] };
      return match;
    }
    return { term: match.item };
  }

  async function executeLexiconCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();
    const pages = ["browse", "categories"];

    if (!window.mySpace?.lexicon) {
      return { ok: false, error: "Lexicon shell API unavailable" };
    }

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatLexiconCommandHelp() };
    }

    if (lower === "stats") {
      const res = await window.mySpace.lexicon.stats();
      if (!res?.ok) return { ok: false, error: res?.error || "Stats failed" };
      return {
        ok: true,
        message: `Lexicon · ${res.termCount ?? "?"} terms${
          res.builtAt ? ` · built ${res.builtAt}` : ""
        }`,
      };
    }

    if (lower === "daily" || lower === "wotd") {
      const res = await window.mySpace.lexicon.daily();
      if (!res?.ok) return { ok: false, error: res?.error || "Daily term failed" };
      return { ok: true, message: `Daily · ${formatTermLine(res.term)}` };
    }

    if (lower === "categories" || /^categories(\s|$)/i.test(t)) {
      if (lower === "categories") {
      }
      const res = await window.mySpace.lexicon.categories();
      if (!res?.ok) return { ok: false, error: res?.error || "Categories failed" };
      const cats = res.categories || [];
      const lines = cats.slice(0, 20).map((c) => c.label || c.id || c.name || c);
      return { ok: true, message: `Categories (${cats.length}): ${lines.join(" · ")}` };
    }

    if (pages.includes(lower)) {
      await openLexicon(ctx, { page: lower });
      return { ok: true, message: `Opened Lexicon · ${lower}` };
    }

    if (/^(search|find|list)(\s|$)/i.test(t) || lower === "ls") {
      const q = t.replace(/^(search|find|list|ls)\s*/i, "").trim();
      const res = await window.mySpace.lexicon.search(q ? { q, limit: 20 } : { limit: 20 });
      if (!res?.ok) return { ok: false, error: res?.error || "Search failed" };
      const terms = res.terms || [];
      if (!terms.length) return { ok: true, message: q ? `No terms for "${q}"` : "No terms" };
      const lines = terms.slice(0, 15).map((x) => x.term || x.id);
      return {
        ok: true,
        message: `Terms${q ? ` · ${q}` : ""} (${res.total ?? terms.length}): ${lines.join(" · ")}`,
      };
    }

    if (/^(get|info)(\s|$)/i.test(t)) {
      const ref = t.replace(/^(get|info)\s*/i, "").trim();
      if (!ref) return { ok: false, error: "Usage: lexicon(get closure)" };
      const resolved = await resolveLexiconTerm(ref);
      if (resolved.error) return { ok: false, error: resolved.error };
      const full = await window.mySpace.lexicon.get({
        id: resolved.term.id,
        slug: resolved.term.slug || resolved.term.id,
      });
      const term = full?.term || resolved.term;
      return { ok: true, message: formatTermLine(term) };
    }

    if (/^open(\s|$)/i.test(t)) {
      const ref = t.replace(/^open\s*/i, "").trim();
      if (!ref) {
        await openLexicon(ctx, { page: "browse" });
        return { ok: true, message: "Opened Lexicon" };
      }
      if (pages.includes(ref.toLowerCase())) {
        await openLexicon(ctx, { page: ref.toLowerCase() });
        return { ok: true, message: `Opened Lexicon · ${ref.toLowerCase()}` };
      }
      const resolved = await resolveLexiconTerm(ref);
      if (resolved.error) return { ok: false, error: resolved.error };
      await openLexicon(ctx, {
        page: "browse",
        action: "openTerm",
        param: resolved.term.id || resolved.term.slug,
      });
      return { ok: true, message: `Opened · ${resolved.term.term || resolved.term.id}` };
    }

    const resolved = await resolveLexiconTerm(t);
    if (!resolved.error) {
      const full = await window.mySpace.lexicon.get({
        id: resolved.term.id,
        slug: resolved.term.slug || resolved.term.id,
      });
      return { ok: true, message: formatTermLine(full?.term || resolved.term) };
    }

    return {
      ok: false,
      error: `Unknown lexicon command "${t}". ${formatLexiconCommandHelp()}`,
    };
  }

  function formatModelFlowCommandHelp() {
    return [
      "flow(meta) · flow(tools) · flow(history) · flow(library)",
      "flow(plan Send weekly digest email) · flow(open) · flow(studio) · flow(blank)",
    ].join(" · ");
  }

  async function executeModelFlowCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();

    if (!window.mySpace?.flow) {
      return { ok: false, error: "Model Flow shell API unavailable" };
    }

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatModelFlowCommandHelp() };
    }

    if (lower === "open" || lower === "studio") {
      await openModelFlow(ctx, { page: "studio" });
      return { ok: true, message: "Opened Model Flow · studio" };
    }

    if (lower === "blank" || lower === "new") {
      await openModelFlow(ctx, { page: "studio", blank: true });
      return { ok: true, message: "Opened Model Flow · blank" };
    }

    if (lower === "library" || lower === "saved") {
      const res = await window.mySpace.flow.library?.();
      const items = res?.items || [];
      await openModelFlow(ctx, { page: "library" });
      if (!res?.ok) return { ok: true, message: "Opened Model Flow · saved" };
      if (!items.length) return { ok: true, message: "No saved flows" };
      return {
        ok: true,
        message: `Saved (${items.length}): ${items
          .slice(0, 10)
          .map((h) => h.title || h.task || h.id)
          .join(" · ")}`,
      };
    }

    if (lower === "meta" || lower === "status") {
      const res = await window.mySpace.flow.meta();
      if (!res?.ok) return { ok: false, error: res?.error || "Meta failed" };
      const keyBit = res.hasKey
        ? `key yes (${res.keySource || "set"})`
        : "key no";
      return {
        ok: true,
        message: `Model Flow · ${keyBit} · ${res.model || "?"} · ${res.program || "—"}`,
      };
    }

    if (lower === "tools") {
      const res = await window.mySpace.flow.tools();
      if (!res?.ok) return { ok: false, error: res?.error || "Tools failed" };
      const tools = res.tools || [];
      const lines = tools.slice(0, 20).map((x) => {
        const id = x.id || x.name || x;
        const live = x.live !== false;
        return `${id}(${live ? "live" : "staged"})`;
      });
      return { ok: true, message: `Tools (${tools.length}): ${lines.join(" · ")}` };
    }

    if (lower === "history") {
      const res = await window.mySpace.flow.history();
      if (!res?.ok) return { ok: false, error: res?.error || "History failed" };
      const items = res.items || [];
      if (!items.length) return { ok: true, message: "No flow history" };
      const lines = items.slice(0, 10).map((h) => h.title || h.task || h.id);
      await syncModelFlowIfOpen(ctx, { page: "history" });
      return { ok: true, message: `History (${items.length}): ${lines.join(" · ")}` };
    }

    if (/^plan(\s|$)/i.test(t)) {
      const task = t.replace(/^plan\s*/i, "").trim();
      if (!task) return { ok: false, error: "Usage: flow(plan Send weekly digest email)" };
      const res = await window.mySpace.flow.plan(task);
      if (!res?.ok) return { ok: false, error: res?.error || "Plan failed" };
      const flow = res.flow || {};
      const steps = (flow.steps || []).slice(0, 8).map((s, i) => `${i + 1}.${s.title || s.tool || s.type || "step"}`);
      await syncModelFlowIfOpen(ctx, { page: "studio", flow, task });
      return {
        ok: true,
        message: `Plan (${res.mode || "local"}) · ${flow.title || task}${
          steps.length ? ` · ${steps.join(" → ")}` : ""
        }${res.warning ? ` · warn: ${res.warning}` : ""}`,
      };
    }

    return {
      ok: false,
      error: `Unknown flow command "${t}". ${formatModelFlowCommandHelp()}`,
    };
  }

  function formatShellConsoleCommandHelp() {
    return [
      "shell(open): open the Shell command atlas (Platform → Shell)",
      "shell(overview) · shell(language) · shell(core) · shell(modules)",
      "console(…): same atlas (Console app retired)",
      "Type commands on the desktop shell line · long programs → Scripts",
      "alias / macro / when: manage shortcuts in the live shell language",
    ].join(" · ");
  }

  async function executeShellConsoleCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();
    const atlasPages = ["overview", "language", "core", "modules", "shell"];

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatShellConsoleCommandHelp() };
    }

    if (/^open(\s|$)/i.test(t)) {
      const rest = t.replace(/^open\s*/i, "").trim().toLowerCase() || "overview";
      await openShellConsole(ctx, { page: rest });
      return { ok: true, message: "Opened Shell atlas" };
    }

    if (atlasPages.includes(lower) || ["runner", "reference", "home", "panel"].includes(lower)) {
      await openShellConsole(ctx, { page: lower });
      return { ok: true, message: "Opened Shell atlas" };
    }

    if (/^(aliases|alias|macros|macro|when|history)(\s|$)/i.test(t)) {
      await openShellConsole(ctx, { page: "language" });
      return {
        ok: true,
        message:
          "Opened Shell atlas · Language. Manage with: alias · macro · when · check aliases · check macros · check when",
      };
    }

    return {
      ok: false,
      error: `Unknown shell atlas command "${t}". ${formatShellConsoleCommandHelp()}`,
    };
  }

  function formatDocsCommandHelp() {
    return [
      "docs(overview) · docs(search timer) · docs(open app-clock)",
      "docs(open command-index) · docs(list) · docs(bookmarks) · docs(help)",
    ].join(" · ");
  }

  const DOCS_PAGE_ALIASES = {
    start: "overview",
    intro: "overview",
    model: "mental-model",
    readme: "how-to-read-docs",
    handbook: "how-to-read-docs",
    shell: "shell-language",
    chaining: "shell-chaining",
    flow: "shell-flow",
    vars: "shell-vars",
    variables: "shell-vars",
    functions: "shell-functions",
    fn: "shell-functions",
    shortcuts: "shell-shortcuts",
    check: "shell-check",
    discovery: "shell-discovery",
    errors: "shell-errors",
    commands: "cmd-protocol",
    protocol: "cmd-protocol",
    index: "command-index",
    "command-index": "command-index",
    apps: "apps-directory",
    directory: "apps-directory",
    windows: "apps-windows",
    welcome: "app-welcome",
    info: "app-info",
    docsapp: "app-docs",
    sysinfo: "app-sysinfo",
    sys: "app-sysinfo",
    clock: "app-clock",
    today: "app-today",
    tasks: "app-tasks",
    gtd: "app-tasks",
    todo: "app-tasks",
    vault: "app-vault",
    contacts: "app-contacts",
    notes: "app-notes",
    note: "app-notes",
    chat: "app-chat",
    aichat: "app-chat",
    stocks: "app-stocks",
    builds: "app-builds",
    drift: "app-drift",
    remote: "app-remote",
    studies: "app-studies",
    decks: "app-decks",
    flashcards: "app-decks",
    translate: "app-translate",
    geo: "app-geo",
    geography: "app-geo",
    maps: "app-maps",
    flags: "app-flags",
    pi: "app-pi",
    "pi-digits": "app-pi",
    history: "app-history",
    space: "app-space",
    lexicon: "app-lexicon",
    contracts: "app-contracts",
    msl: "msl",
    providers: "msl-providers",
    capabilities: "msl-capabilities",
    caps: "msl-capabilities",
    jobs: "app-jobs",
    mind: "app-mind",
    ai: "app-mind",
    icons: "app-icons",
    "icon-library": "app-icons",
    "model-flow": "app-flow",
    flowapp: "app-flow",
    console: "app-console",
    scripts: "app-scripts",
    external: "app-external",
    routes: "routes",
    silent: "silent-actions",
    sync: "sync-if-open",
    automation: "aliases-macros",
    aliases: "aliases-macros",
    macros: "aliases-macros",
    when: "when-rules",
    patterns: "automation-patterns",
    storage: "storage",
    themes: "themes",
    appearance: "themes",
    userdata: "userdata-map",
    files: "userdata-map",
    settings: "settings",
    "settings-index": "settings-index",
    "settings-complete": "settings-complete",
    allsettings: "settings-complete",
    eod: "recipe-eod",
    "end of day": "recipe-eod",
    backups: "backups",
    backup: "backups",
    storage: "app-storage",
    "disk-usage": "app-storage",
    themes: "app-themes",
    appearance: "app-themes",
    recipes: "recipe-morning",
    reference: "glossary",
    architecture: "architecture",
    ipc: "ipc-map",
    bridge: "myspace-bridge",
    myspace: "myspace-bridge",
    "apps-json": "apps-json",
    catalog: "apps-json",
    "desktop-config": "desktop-config",
    wallpaper: "desktop-config",
    updates: "updates-system",
    faq: "faq",
    troubleshooting: "troubleshooting",
    changelog: "changelog",
  };

  async function executeDocsCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatDocsCommandHelp() };
    }

    if (lower === "list" || lower === "ls" || lower === "categories") {
      return {
        ok: true,
        message:
          "Docs categories: Start · Shell · Apps · Protocols · Automation · Data · Recipes · Reference: try docs(open how-to-read-docs) or docs(open command-index)",
      };
    }

    if (/^search(\s|$)/i.test(t) || /^find(\s|$)/i.test(t)) {
      const q = t.replace(/^(search|find)\s*/i, "").trim();
      if (!q) return { ok: false, error: "Usage: docs(search timer)" };
      await openDocs(ctx, { page: "overview", action: "search", param: q });
      return { ok: true, message: `Docs search · ${q}` };
    }

    if (lower === "bookmarks" || lower === "saved") {
      await openDocs(ctx, { page: "overview", action: "bookmarks" });
      return { ok: true, message: "Opened Docs · bookmarks" };
    }

    if (/^open(\s|$)/i.test(t)) {
      const ref = t.replace(/^open\s*/i, "").trim() || "overview";
      const id = DOCS_PAGE_ALIASES[ref.toLowerCase()] || ref;
      await openDocs(ctx, { page: id });
      return { ok: true, message: `Opened Docs · ${id}` };
    }

    const id = DOCS_PAGE_ALIASES[lower] || t;
    await openDocs(ctx, { page: id });
    return { ok: true, message: `Opened Docs · ${id}` };
  }

  function formatScriptsCommandHelp() {
    return [
      "scripts(list) · scripts(get morning) · scripts(run morning)",
      "scripts(set name body…) · scripts(append name line…): write programs from the language",
      "scripts(open morning) · scripts(new focus) · scripts(delete focus)",
      "scripts(duplicate morning) · scripts(help)",
    ].join(" · ");
  }

  function parseScriptsWriteArgs(t, verb) {
    const rest = String(t || "")
      .replace(new RegExp(`^${verb}\\s*`, "i"), "")
      .trim();
    if (!rest) {
      return {
        error: `Usage: scripts(${verb} <name> <${verb === "set" ? "body" : "line"}>)`,
      };
    }
    const bodyKv = rest.match(/^(\S+)\s+body:(.*)$/is);
    if (bodyKv) {
      return { name: bodyKv[1].trim(), text: bodyKv[2] };
    }
    const quoted = rest.match(/^(\S+)\s+("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/s);
    if (quoted) {
      return { name: quoted[1].trim(), text: unquoteArg(quoted[2]) };
    }
    const space = rest.indexOf(" ");
    if (space < 0) {
      return {
        error: `Usage: scripts(${verb} <name> <${verb === "set" ? "body" : "line"}>)`,
      };
    }
    return {
      name: rest.slice(0, space).trim(),
      text: rest.slice(space + 1).trim(),
    };
  }

  async function resolveScriptRef(ref) {
    const q = String(ref || "").trim();
    if (!q) return { error: "Missing script name" };
    if (!window.mySpace?.scripts?.get) {
      return { error: "Scripts shell API unavailable" };
    }
    const res = await window.mySpace.scripts.get(q);
    if (res?.ok && res.script) return { script: res.script };
    return { error: res?.error || `Script not found: ${q}` };
  }

  async function executeScriptsCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();

    if (!window.mySpace?.scripts) {
      return { ok: false, error: "Scripts shell API unavailable" };
    }

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatScriptsCommandHelp() };
    }

    if (lower === "list" || lower === "ls") {
      const res = await window.mySpace.scripts.list();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not list scripts" };
      const scripts = res.scripts || [];
      if (!scripts.length) return { ok: true, message: "No scripts yet. try scripts(new morning)" };
      const lines = scripts
        .slice(0, 20)
        .map((s) => `${s.name}${s.lines != null ? ` (${s.lines} lines)` : ""}`);
      const more = scripts.length > 20 ? ` · +${scripts.length - 20} more` : "";
      return { ok: true, message: `Scripts (${scripts.length}): ${lines.join(" · ")}${more}` };
    }

    if (/^get(\s|$)/i.test(t)) {
      const ref = t.replace(/^get\s*/i, "").trim();
      const resolved = await resolveScriptRef(ref);
      if (resolved.error) return { ok: false, error: resolved.error };
      const s = resolved.script;
      const lines = String(s.body || "")
        .split(/\r?\n/)
        .filter((ln) => ln.trim() && !ln.trim().startsWith("#")).length;
      return {
        ok: true,
        message: `Script ${s.name} · ${lines} command line${lines === 1 ? "" : "s"} · id ${s.id}`,
      };
    }

    if (/^run(\s|$)/i.test(t)) {
      const ref = t.replace(/^run\s*/i, "").trim();
      if (!ref) return { ok: false, error: "Usage: scripts(run morning)" };
      const res = await window.mySpace.scripts.run({ name: ref });
      const ran = Number(res?.ran) || (res?.results || []).length;
      const failed =
        Number(res?.failed) || (res?.results || []).filter((r) => !r.ok).length;
      if (res?.ok) {
        await syncScriptsIfOpen(ctx, { param: ref, action: "openScript" });
        return {
          ok: true,
          message: res.message || `Script ${ref}: ${ran} step${ran === 1 ? "" : "s"}`,
        };
      }
      return {
        ok: false,
        error:
          res?.message ||
          res?.error ||
          (res?.stopped
            ? `Script ${ref} stopped after ${ran} step${ran === 1 ? "" : "s"}`
            : `Script ${ref} finished with ${failed} error${failed === 1 ? "" : "s"}`),
      };
    }

    if (/^open(\s|$)/i.test(t)) {
      const ref = t.replace(/^open\s*/i, "").trim();
      if (!ref) {
        await openScripts(ctx, {});
        return { ok: true, message: "Opened Scripts" };
      }
      await openScripts(ctx, { param: ref, action: "openScript" });
      return { ok: true, message: `Opened Scripts · ${ref}` };
    }

    if (/^(new|create)(\s|$)/i.test(t)) {
      const name = t.replace(/^(new|create)\s*/i, "").trim() || "untitled";
      const res = await window.mySpace.scripts.create({ name });
      if (!res?.ok) return { ok: false, error: res?.error || "Could not create script" };
      await syncScriptsIfOpen(ctx, { param: res.script?.name || name, action: "openScript" });
      return { ok: true, message: `Created script · ${res.script?.name || name}` };
    }

    if (/^(delete|rm|remove)(\s|$)/i.test(t)) {
      const ref = t.replace(/^(delete|rm|remove)\s*/i, "").trim();
      const resolved = await resolveScriptRef(ref);
      if (resolved.error) return { ok: false, error: resolved.error };
      const res = await window.mySpace.scripts.delete(resolved.script.id);
      if (!res?.ok) return { ok: false, error: res?.error || "Could not delete script" };
      await syncScriptsIfOpen(ctx, {});
      return { ok: true, message: `Deleted script · ${resolved.script.name}` };
    }

    if (/^duplicate(\s|$)/i.test(t)) {
      const ref = t.replace(/^duplicate\s*/i, "").trim();
      const resolved = await resolveScriptRef(ref);
      if (resolved.error) return { ok: false, error: resolved.error };
      const res = await window.mySpace.scripts.duplicate(resolved.script.id);
      if (!res?.ok) return { ok: false, error: res?.error || "Could not duplicate" };
      await syncScriptsIfOpen(ctx, {
        param: res.script?.name,
        action: "openScript",
      });
      return { ok: true, message: `Duplicated · ${res.script?.name || "?"}` };
    }

    if (/^set(\s|$)/i.test(t)) {
      const parsed = parseScriptsWriteArgs(t, "set");
      if (parsed.error) return { ok: false, error: parsed.error };
      const res = await window.mySpace.scripts.set({
        name: parsed.name,
        body: parsed.text ?? "",
      });
      if (!res?.ok) return { ok: false, error: res?.error || "Could not set script" };
      await syncScriptsIfOpen(ctx, { param: res.script?.name, action: "openScript" });
      const lines = String(res.script?.body || "")
        .split(/\r?\n/)
        .filter((ln) => ln.trim()).length;
      return {
        ok: true,
        message: `${res.created ? "Created" : "Updated"} script · ${res.script?.name} (${lines} line${lines === 1 ? "" : "s"})`,
      };
    }

    if (/^append(\s|$)/i.test(t)) {
      const parsed = parseScriptsWriteArgs(t, "append");
      if (parsed.error) return { ok: false, error: parsed.error };
      if (!parsed.text) return { ok: false, error: "Usage: scripts(append <name> <line>)" };
      const res = await window.mySpace.scripts.append({
        name: parsed.name,
        text: parsed.text,
      });
      if (!res?.ok) return { ok: false, error: res?.error || "Could not append to script" };
      await syncScriptsIfOpen(ctx, { param: res.script?.name, action: "openScript" });
      return {
        ok: true,
        message: `${res.created ? "Created" : "Appended to"} script · ${res.script?.name}`,
      };
    }

    const resolved = await resolveScriptRef(t);
    if (!resolved.error) {
      await openScripts(ctx, { param: resolved.script.name, action: "openScript" });
      return { ok: true, message: `Opened Scripts · ${resolved.script.name}` };
    }

    return {
      ok: false,
      error: `Unknown scripts command "${t}". ${formatScriptsCommandHelp()}`,
    };
  }

  function formatMapsCommandHelp() {
    return [
      "maps(geocode Tel Aviv) · maps(search Paris) · maps(notes) · maps(routes)",
      "maps(reverse 32.08 34.78) · maps(country 32.08 34.78)",
      "maps(status) · maps(sync) · maps(open) · maps(help)",
    ].join(" · ");
  }

  async function mapsCall(fn) {
    try {
      const data = await fn();
      if (data && typeof data === "object" && data.ok === false) {
        return { ok: false, error: data.error || "Maps request failed" };
      }
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  }

  function formatGeocodeHit(hit) {
    if (!hit) return "—";
    const name = hit.display_name || hit.name || hit.label || JSON.stringify(hit);
    return String(name).replace(/\s+/g, " ").slice(0, 90);
  }

  async function executeMapsCommands(inner, ctx) {
    const t = String(inner || "").trim();
    const lower = t.toLowerCase();

    if (!window.mySpace?.maps) {
      return { ok: false, error: "Maps shell API unavailable" };
    }

    if (!t || lower === "help" || lower === "?") {
      return { ok: true, message: formatMapsCommandHelp() };
    }

    if (lower === "open" || lower === "map" || lower === "home") {
      await openMaps(ctx, { page: "map" });
      return { ok: true, message: "Opened World Maps" };
    }

    if (lower === "status" || lower === "auth") {
      const res = await mapsCall(() => window.mySpace.maps.authStatus());
      if (!res.ok) return res;
      const d = res.data || {};
      const user = d.user || d.currentUser || d.username || d.email;
      const signed = d.signedIn ?? d.ok ?? Boolean(user);
      return {
        ok: true,
        message: signed
          ? `Maps signed in${user ? ` · ${typeof user === "string" ? user : user.name || user.email || ""}` : ""}`
          : "Maps signed out. open the app to sign in",
      };
    }

    if (lower === "sync") {
      const res = await mapsCall(() => window.mySpace.maps.syncStatus());
      if (!res.ok) return res;
      const d = res.data || {};
      return {
        ok: true,
        message: `Maps sync · ${d.path || d.folder || d.root || "no folder"}${
          d.enabled === false ? " · off" : ""
        }`,
      };
    }

    if (lower === "notes" || lower === "list notes" || /^notes(\s|$)/i.test(t)) {
      const res = await mapsCall(() => window.mySpace.maps.notes());
      if (!res.ok) return res;
      const notes = Array.isArray(res.data) ? res.data : res.data?.notes || [];
      if (!notes.length) return { ok: true, message: "No map notes (sign in if empty unexpectedly)" };
      const lines = notes.slice(0, 12).map((n) => n.title || n.name || n.id || "note");
      const more = notes.length > 12 ? ` · +${notes.length - 12} more` : "";
      return { ok: true, message: `Notes (${notes.length}): ${lines.join(" · ")}${more}` };
    }

    if (lower === "routes" || lower === "list routes" || /^routes(\s|$)/i.test(t)) {
      const res = await mapsCall(() => window.mySpace.maps.routes());
      if (!res.ok) return res;
      const routes = Array.isArray(res.data) ? res.data : res.data?.routes || [];
      if (!routes.length) return { ok: true, message: "No map routes" };
      const lines = routes.slice(0, 12).map((r) => r.label || r.name || r.mode || r.id || "route");
      const more = routes.length > 12 ? ` · +${routes.length - 12} more` : "";
      return { ok: true, message: `Routes (${routes.length}): ${lines.join(" · ")}${more}` };
    }

    if (/^(geocode|search)(\s|$)/i.test(t)) {
      const q = t.replace(/^(geocode|search)\s*/i, "").trim();
      if (!q) return { ok: false, error: "Usage: maps(geocode Tel Aviv)" };
      const res = await mapsCall(() => window.mySpace.maps.geocode(q));
      if (!res.ok) return res;
      const hits = Array.isArray(res.data) ? res.data : [];
      if (!hits.length) return { ok: true, message: `No geocode results for “${q}”` };
      const lines = hits.slice(0, 5).map(formatGeocodeHit);
      return {
        ok: true,
        message: `Geocode (${hits.length}): ${lines.join(" · ")}`,
      };
    }

    if (/^reverse(\s|$)/i.test(t)) {
      const rest = t.replace(/^reverse\s*/i, "").trim();
      const parts = rest.split(/[\s,]+/).filter(Boolean);
      if (parts.length < 2) {
        return { ok: false, error: "Usage: maps(reverse 32.08 34.78)" };
      }
      const lat = Number(parts[0]);
      const lng = Number(parts[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return { ok: false, error: "Usage: maps(reverse <lat> <lng>)" };
      }
      const res = await mapsCall(() => window.mySpace.maps.reverse(lat, lng));
      if (!res.ok) return res;
      const label = typeof res.data === "string" ? res.data : formatGeocodeHit(res.data);
      return { ok: true, message: `Reverse · ${label || "—"}` };
    }

    if (/^country(\s|$)/i.test(t)) {
      const rest = t.replace(/^country\s*/i, "").trim();
      const parts = rest.split(/[\s,]+/).filter(Boolean);
      if (parts.length < 2) {
        return { ok: false, error: "Usage: maps(country 32.08 34.78)" };
      }
      const lat = Number(parts[0]);
      const lng = Number(parts[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return { ok: false, error: "Usage: maps(country <lat> <lng>)" };
      }
      const res = await mapsCall(() => window.mySpace.maps.country(lat, lng));
      if (!res.ok) return res;
      const d = res.data || {};
      return {
        ok: true,
        message: `Country · ${d.countryName || "—"}${
          d.countryCode ? ` (${d.countryCode})` : ""
        }${d.displayName ? ` — ${String(d.displayName).slice(0, 60)}` : ""}`,
      };
    }

    return {
      ok: false,
      error: `Unknown maps command "${t}". ${formatMapsCommandHelp()}`,
    };
  }

  async function executeTimerCommand(trimmed, ctx) {
    const m = trimmed.match(/^timer(?:\s+(.+))?$/i);
    if (!m) return null;
    if (!window.mySpace?.clock) {
      return { ok: false, error: "Clock shell API unavailable" };
    }

    const rest = (m[1] || "").trim();
    const lower = rest.toLowerCase();

    if (!rest || lower === "status") {
      const res = await window.mySpace.clock.timerStatus();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not read timer" };
      if (res.empty) return { ok: true, message: "No timer set" };
      const state = res.running ? "running" : "paused";
      return {
        ok: true,
        message: `Timer ${state}: ${res.display} left${res.label ? ` (${res.label})` : ""}`,
      };
    }

    if (lower === "pause") {
      const res = await window.mySpace.clock.timerPause();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not pause timer" };
      await syncClockIfOpen(ctx, { page: "timer", action: "pauseTimer" });
      return { ok: true, message: `Timer paused · ${res.display} left` };
    }

    if (lower === "stop" || lower === "reset") {
      const res = await window.mySpace.clock.timerStop();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not stop timer" };
      await syncClockIfOpen(ctx, { page: "timer", action: "stopTimer" });
      return { ok: true, message: `Timer reset · ${res.display}` };
    }

    let label = null;
    let durationToken = rest;
    const labelKv = rest.match(/(?:^|\s)label\s*:\s*(.+)$/i);
    if (labelKv) {
      label = unquoteArg(labelKv[1].trim());
      durationToken = rest.slice(0, labelKv.index).trim();
    } else {
      const parts = rest.match(/^(\S+)(?:\s+(.+))?$/);
      if (parts) {
        durationToken = parts[1];
        if (parts[2]) label = unquoteArg(parts[2].trim());
      }
    }

    const sec = parseDurationToSec(durationToken);
    if (!sec) {
      return { ok: false, error: "Usage: clock(timer 25m) · clock(timer 90s Focus) · clock(timer pause|status)" };
    }

    const res = await window.mySpace.clock.timerStart({
      durationSec: sec,
      label: label || "Timer",
      autoStart: true,
    });
    if (!res?.ok) return { ok: false, error: res?.error || "Could not start timer" };

    await syncClockIfOpen(ctx, {
      page: "timer",
      action: "startTimer",
      param: String(sec),
      label: label || null,
    });

    return {
      ok: true,
      message: `Timer ${res.display}${label ? ` · ${label}` : ""} started`,
    };
  }

  async function executePomodoroCommand(trimmed, ctx) {
    const m = trimmed.match(/^pomodoro(?:\s+(.+))?$/i);
    if (!m) return null;
    if (!window.mySpace?.clock) {
      return { ok: false, error: "Clock shell API unavailable" };
    }

    const rest = (m[1] || "").trim();
    const lower = rest.toLowerCase();
    if (lower === "pause" || lower === "stop") {
      const res = await window.mySpace.clock.pomodoroPause();
      if (!res?.ok) return { ok: false, error: res?.error || "Could not pause pomodoro" };
      await syncClockIfOpen(ctx, { page: "pomodoro", action: "pausePomodoro" });
      return { ok: true, message: "Pomodoro paused" };
    }

    let workMin = null;
    const workMatch = rest.match(/(?:work|workmin)\s*[:=]\s*(\d+)/i);
    if (workMatch) workMin = parseInt(workMatch[1], 10);
    else if (/^\d+$/.test(rest)) workMin = parseInt(rest, 10);

    const args = { autoStart: true };
    if (Number.isFinite(workMin) && workMin > 0) args.workMin = workMin;

    const res = await window.mySpace.clock.pomodoroStart(args);
    if (!res?.ok) return { ok: false, error: res?.error || "Could not start pomodoro" };

    const clockApp = findClockApp(ctx.getApps?.() || []);
    const alreadyOpen = clockApp && ctx.isAppOpen?.(clockApp);
    await syncClockIfOpen(ctx, {
      page: "pomodoro",
      action: "startPomodoro",
      workMin: args.workMin != null ? String(args.workMin) : null,
    });

    const mins = res.settings?.workMin || args.workMin || 25;
    if (!alreadyOpen) {
      return {
        ok: true,
        message: `Pomodoro armed · ${mins}m: open clock(pomodoro) to begin`,
      };
    }
    return { ok: true, message: `Pomodoro started · ${mins}m focus` };
  }

  async function executeStopwatchCommand(trimmed, ctx) {
    const m = trimmed.match(/^stopwatch(?:\s+(.+))?$/i);
    if (!m) return null;
    if (!window.mySpace?.clock) {
      return { ok: false, error: "Clock shell API unavailable" };
    }
    const rest = (m[1] || "").trim().toLowerCase();
    if (rest && rest !== "start" && rest !== "go") {
      return { ok: false, error: "Usage: clock(stopwatch) · clock(stopwatch start)" };
    }
    const res = await window.mySpace.clock.stopwatchStart({ autoStart: true });
    if (!res?.ok) return { ok: false, error: res?.error || "Could not start stopwatch" };
    const clockApp = findClockApp(ctx.getApps?.() || []);
    const alreadyOpen = clockApp && ctx.isAppOpen?.(clockApp);
    await syncClockIfOpen(ctx, { page: "stopwatch", action: "startStopwatch" });
    if (!alreadyOpen) {
      return { ok: true, message: "Stopwatch armed: open clock(stopwatch) to run" };
    }
    return { ok: true, message: "Stopwatch started" };
  }

  async function executeRun(trimmed, ctx) {
    const apps = ctx.getApps?.() || [];
    const platformOnly = String(trimmed || "")
      .trim()
      .match(/^run\s+([\w.-]+)(?:\(([\s\S]*)\))?$/i);
    if (platformOnly) {
      const mod = resolveModule(platformOnly[1]);
      if (mod === "msl-protocol" && ROUTE_REGISTRY[mod]?.platform) {
        const inner = (platformOnly[2] || "panel").trim() || "panel";
        return executeMslCommands(inner, ctx);
      }
      if (mod === "parts" && ROUTE_REGISTRY[mod]?.platform) {
        const inner = (platformOnly[2] || "panel").trim() || "panel";
        return executePartsCommands(inner, ctx);
      }
      if (mod === "permissions" && ROUTE_REGISTRY[mod]?.platform) {
        const inner = (platformOnly[2] || "open").trim() || "open";
        return executePermissionsCommands(inner, ctx);
      }
      if (mod === "pulse" && ROUTE_REGISTRY[mod]?.platform) {
        const inner = (platformOnly[2] || "panel").trim() || "panel";
        return executePulseCommands(inner, ctx);
      }
      if (mod === "jobs" && ROUTE_REGISTRY[mod]?.platform) {
        const inner = (platformOnly[2] || "panel").trim() || "panel";
        return executeJobsCommands(inner, ctx);
      }
      if (mod === "host" && ROUTE_REGISTRY[mod]?.platform) {
        const inner = (platformOnly[2] || "help").trim() || "help";
        return executeHostCommands(inner, ctx);
      }
      if (mod === "app" && ROUTE_REGISTRY[mod]?.platform) {
        const inner = (platformOnly[2] || "help").trim() || "help";
        return executeAppCommands(inner, ctx);
      }
      if (mod === "resolve" && ROUTE_REGISTRY[mod]?.platform) {
        const inner = (platformOnly[2] || "inbox").trim() || "inbox";
        return executeResolveCommands(inner, ctx);
      }
      if (mod === "updates" && ROUTE_REGISTRY[mod]?.platform) {
        const inner = (platformOnly[2] || "pending").trim() || "pending";
        return executeUpdatesCommands(inner, ctx);
      }
      if (mod === "network" && ROUTE_REGISTRY[mod]?.platform) {
        const inner = (platformOnly[2] || "status").trim() || "status";
        return executeNetworkCommands(inner, ctx);
      }
      if ((mod === "info" || mod === "apps-info") && (ROUTE_REGISTRY.info?.platform || ROUTE_REGISTRY[mod]?.platform)) {
        const inner = (platformOnly[2] || "catalog").trim() || "catalog";
        return executeInfoCommands(inner, ctx);
      }
      if (mod === "backup" && ROUTE_REGISTRY[mod]?.platform) {
        const inner = (platformOnly[2] || "status").trim() || "status";
        return executeBackupCommands(inner, ctx);
      }
      if (mod === "storage" && ROUTE_REGISTRY[mod]?.platform) {
        const inner = (platformOnly[2] || "status").trim() || "status";
        return executeStorageCommands(inner, ctx);
      }
      if (mod === "themes" && ROUTE_REGISTRY[mod]?.platform) {
        const inner = (platformOnly[2] || "open").trim() || "open";
        return executeThemesCommands(inner, ctx);
      }
      if (mod === "mind" && ROUTE_REGISTRY[mod]?.platform) {
        const inner = (platformOnly[2] || "panel").trim() || "panel";
        return executeMindCommands(inner, ctx);
      }
    }

    const parsed = parseRunCommand(trimmed, apps);
    if (!parsed) {
      return { ok: false, error: "Usage: run <app> or run <app>(target) " };
    }

    const app = parsed.app || findAppByRef(parsed.appRef, apps);
    if (!app) {
      const mod = resolveModule(parsed.appRef);
      if (mod === "msl-protocol") {
        return executeMslCommands((parsed.argRaw || "panel").trim() || "panel", ctx);
      }
      if (mod === "parts") {
        return executePartsCommands((parsed.argRaw || "panel").trim() || "panel", ctx);
      }
      if (mod === "permissions") {
        return executePermissionsCommands((parsed.argRaw || "open").trim() || "open", ctx);
      }
      if (mod === "pulse") {
        return executePulseCommands((parsed.argRaw || "panel").trim() || "panel", ctx);
      }
      if (mod === "jobs") {
        return executeJobsCommands((parsed.argRaw || "panel").trim() || "panel", ctx);
      }
      if (mod === "resolve") {
        return executeResolveCommands((parsed.argRaw || "inbox").trim() || "inbox", ctx);
      }
      if (mod === "updates") {
        return executeUpdatesCommands((parsed.argRaw || "pending").trim() || "pending", ctx);
      }
      if (mod === "network") {
        return executeNetworkCommands((parsed.argRaw || "status").trim() || "status", ctx);
      }
      if (mod === "info" || mod === "apps-info") {
        return executeInfoCommands((parsed.argRaw || "catalog").trim() || "catalog", ctx);
      }
      if (mod === "backup") {
        return executeBackupCommands((parsed.argRaw || "status").trim() || "status", ctx);
      }
      if (mod === "storage") {
        return executeStorageCommands((parsed.argRaw || "status").trim() || "status", ctx);
      }
      if (mod === "themes") {
        return executeThemesCommands((parsed.argRaw || "open").trim() || "open", ctx);
      }
      if (mod === "mind") {
        return executeMindCommands((parsed.argRaw || "panel").trim() || "panel", ctx);
      }
      return { ok: false, error: `App not found: ${parsed.appRef}` };
    }

    if (app.type === "builtin") {
      if (app.id === "welcome") {
        await ctx.showBuiltin?.();
        return { ok: true, message: `Opened ${app.name}` };
      }
      return { ok: false, error: `"${app.name}" cannot be opened with run` };
    }

    if (parsed.moduleId === "translate" && appHasCommands(parsed.moduleId) && parsed.argRaw) {
      return executeTranslateCommands(parsed.argRaw.trim(), ctx);
    }

    if (
      parsed.moduleId &&
      appHasCommands(parsed.moduleId) &&
      parsed.argRaw &&
      !isClassicRouteArgs(parsed.argRaw)
    ) {
      const inner = parsed.argRaw.trim();
      if (
        parsed.moduleId === "world-clock" &&
        (/^(timer|pomodoro|stopwatch)(\s|$)/i.test(inner) ||
          looksLikeDuration(inner) ||
          ["local", "world", "meetings", "timer", "pomodoro", "stopwatch", "help", "?"].includes(
            inner.toLowerCase()
          ))
      ) {
        return executeClockCommands(inner, ctx);
      }
      if (parsed.moduleId === "day-planner") {
        return executeTodayCommands(inner, ctx);
      }
      if (parsed.moduleId === "stocks") {
        return executeStocksCommands(inner, ctx);
      }
      if (parsed.moduleId === "builds") {
        return executeBuildsCommands(inner, ctx);
      }
      if (parsed.moduleId === "profiles") {
        return executeVaultCommands(inner, ctx);
      }
      if (parsed.moduleId === "drift") {
        return executeDriftCommands(inner, ctx);
      }
      if (parsed.moduleId === "study-deck") {
        return executeStudyDeckCommands(inner, ctx);
      }
      if (parsed.moduleId === "contacts") {
        return executeContactsCommands(inner, ctx);
      }
      if (parsed.moduleId === "notes") {
        return executeNotesCommands(inner, ctx);
      }
      if (parsed.moduleId === "tasks") {
        return executeTasksCommands(inner, ctx);
      }
      if (parsed.moduleId === "chat") {
        return executeChatCommands(inner, ctx);
      }
      if (parsed.moduleId === "system-info") {
        return executeSysInfoCommands(inner, ctx);
      }
      if (parsed.moduleId === "remote-hub") {
        return executeRemoteHubCommands(inner, ctx);
      }
      if (parsed.moduleId === "os-bridge") {
        return executeOsBridgeCommands(inner, ctx);
      }
      if (parsed.moduleId === "files") {
        return executeFilesCommands(inner, ctx);
      }
      if (parsed.moduleId === "host") {
        return executeHostCommands(inner, ctx);
      }
      if (parsed.moduleId === "app") {
        return executeAppCommands(inner, ctx);
      }
      if (parsed.moduleId === "studies") {
        return executeStudiesCommands(inner, ctx);
      }
      if (parsed.moduleId === "geography") {
        return executeGeographyCommands(inner, ctx);
      }
      if (parsed.moduleId === "flag-quiz") {
        return executeFlagQuizCommands(inner, ctx);
      }
      if (parsed.moduleId === "history") {
        return executeHistoryCommands(inner, ctx);
      }
      if (parsed.moduleId === "space") {
        return executeSpaceCommands(inner, ctx);
      }
      if (parsed.moduleId === "contracts") {
        return executeContractsCommands(inner, ctx);
      }
      if (parsed.moduleId === "msl-protocol") {
        return executeMslCommands(inner, ctx);
      }
      if (parsed.moduleId === "parts") {
        return executePartsCommands(inner, ctx);
      }
      if (parsed.moduleId === "permissions") {
        return executePermissionsCommands(inner, ctx);
      }
      if (parsed.moduleId === "pulse") {
        return executePulseCommands(inner, ctx);
      }
      if (parsed.moduleId === "jobs") {
        return executeJobsCommands(inner, ctx);
      }
      if (parsed.moduleId === "resolve") {
        return executeResolveCommands(inner, ctx);
      }
      if (parsed.moduleId === "mind") {
        return executeMindCommands(inner, ctx);
      }
      if (parsed.moduleId === "code-lexicon") {
        return executeLexiconCommands(inner, ctx);
      }
      if (parsed.moduleId === "model-flow") {
        return executeModelFlowCommands(inner, ctx);
      }
      if (parsed.moduleId === "shell-console") {
        return executeShellConsoleCommands(inner, ctx);
      }
      if (parsed.moduleId === "docs") {
        return executeDocsCommands(inner, ctx);
      }
      if (parsed.moduleId === "scripts") {
        return executeScriptsCommands(inner, ctx);
      }
      if (parsed.moduleId === "world-maps") {
        return executeMapsCommands(inner, ctx);
      }
    }

    if (parsed.route?.unknown) {
      const hint = parsed.route.hint
        ? parsed.route.hint
        : (() => {
            const def = ROUTE_REGISTRY[parsed.moduleId];
            return def
              ? `Unknown target "${parsed.route.unknown}". Pages: ${def.pages.join(", ")}${
                  def.views ? ` · views: ${def.views.join(", ")}` : ""
                }${def.modes ? ` · modes: mode:${def.modes.join(", mode:")}` : ""}`
              : `"${parsed.route.unknown}" is not supported for ${app.name}`;
          })();
      return { ok: false, error: hint };
    }

    if (parsed.argRaw && app.type !== "myapp") {
      return { ok: false, error: `${app.name} has no pages. use: run ${parsed.appRef}` };
    }

    let route = null;
    if (app.type === "myapp" && parsed.moduleId) {
      route = parsed.route || null;
      if (parsed.argRaw && !route) {
        return { ok: false, error: `Unknown target for ${app.name}` };
      }
    }

    if (parsed.moduleId === "world-clock" && route && window.mySpace?.clock) {
      try {
        if (route.action === "startTimer" && route.param) {
          await window.mySpace.clock.timerStart({
            durationSec: Number(route.param),
            label: route.label || "Timer",
            autoStart: true,
          });
        } else if (route.action === "pauseTimer") {
          await window.mySpace.clock.timerPause();
        } else if (route.action === "stopTimer") {
          await window.mySpace.clock.timerStop();
        } else if (route.action === "startPomodoro") {
          const args = { autoStart: true };
          if (route.workMin != null) args.workMin = Number(route.workMin);
          await window.mySpace.clock.pomodoroStart(args);
        } else if (route.action === "pausePomodoro") {
          await window.mySpace.clock.pomodoroPause();
        } else if (route.action === "startStopwatch") {
          await window.mySpace.clock.stopwatchStart({ autoStart: true });
        }
      } catch {
      }
    }

    await ctx.launchApp?.(app, { route });
    const target = parsed.argRaw ? ` (${parsed.argRaw})` : "";
    return { ok: true, message: `Running ${app.name}${target}` };
  }

  function executeCheck(trimmed, ctx) {
    const match = trimmed.match(CHECK_RE);
    if (!match) return null;

    const rawTarget = (match[1] || "").trim();
    const target = rawTarget.toLowerCase();

    if (!target || target === "help") {
      return { ok: true, message: formatCheckHelp() };
    }

    if (target === "running" || target === "windows") {
      const tabs = ctx.getRunning?.() || [];
      if (!tabs.length) return { ok: true, message: "No windows open" };
      return {
        ok: true,
        message: tabs.map((t) => `${t.name}${t.active ? " (active)" : ""}`).join(" · "),
      };
    }

    if (target === "apps") {
      const apps = ctx.getApps?.() || [];
      if (!apps.length) return { ok: true, message: "No apps on desktop" };
      return {
        ok: true,
        message: apps.map((a) => `${a.name}${ctx.isAppOpen?.(a) ? " ✓" : ""}`).join(" · "),
      };
    }

    if (target === "aliases") {
      const items = window.MySpaceShellConfig?.listAliases?.() || [];
      if (!items.length) return { ok: true, message: "No aliases. try: alias ocean = run space(ocean)" };
      return {
        ok: true,
        message: items.map((a) => `${a.name} = ${a.command}`).join(" · "),
      };
    }

    if (target === "macros") {
      const items = window.MySpaceShellConfig?.listMacros?.() || [];
      if (!items.length) return { ok: true, message: "No macros. try: macro work = run builds; run drift" };
      return {
        ok: true,
        message: items.map((m) => `${m.name} = ${m.commands.join("; ")}`).join(" · "),
      };
    }

    if (target === "when" || target === "rules") {
      const items = window.MySpaceShellConfig?.listWhenRules?.() || [];
      if (!items.length) return { ok: true, message: "No rules. try: when drift(new) notify" };
      return {
        ok: true,
        message: items.map((r) => `${r.id}: ${r.trigger} → ${r.action}`).join(" · "),
      };
    }

    if (target === "routes") {
      return formatRoutesCheck(null, apps);
    }

    if (target.startsWith("routes ")) {
      return formatRoutesCheck(rawTarget.slice(7).trim(), apps);
    }

    const apps = ctx.getApps?.() || [];
    const app = findAppByRef(target, apps);
    if (app) {
      const open = ctx.isAppOpen?.(app);
      const moduleId = app.module || resolveModule(app.id);
      let msg = `${app.name}: ${open ? "open" : "not running"}`;
      if (moduleId && ROUTE_REGISTRY[moduleId]) {
        msg += ` — check routes ${moduleId}`;
      }
      return { ok: true, message: msg };
    }

    return { ok: false, error: "Unknown check. Try: check running · check apps · check routes space" };
  }

  function normalizeConditionExpr(expr) {
    let raw = String(expr || "").trim();
    if (raw.toLowerCase().startsWith("check ")) {
      raw = raw.slice(6).trim();
    }
    return raw;
  }

  function evaluateCondition(expr, ctx) {
    let raw = normalizeConditionExpr(expr);
    if (!raw) return null;

    let negated = false;
    if (raw.startsWith("!")) {
      negated = true;
      raw = raw.slice(1).trim();
    } else if (/^not\s+/i.test(raw)) {
      negated = true;
      raw = raw.replace(/^not\s+/i, "").trim();
    }

    const lower = raw.toLowerCase();

    if (lower === "if" || lower === "help") {
      return null;
    }

    if (lower === "running" || lower === "windows") {
      const has = (ctx.getRunning?.() || []).length > 0;
      return negated ? !has : has;
    }

    if (lower === "desktop") {
      const onDesktop = ctx.isOnDesktop?.() !== false;
      return negated ? !onDesktop : onDesktop;
    }

    if (lower === "workspace") {
      const inWorkspace = ctx.isInWorkspace?.() === true;
      return negated ? !inWorkspace : inWorkspace;
    }

    if (lower.startsWith("alias ")) {
      const name = raw.slice(6).trim().toLowerCase().replace(/\s+/g, "-");
      const has = (window.MySpaceShellConfig?.listAliases?.() || []).some((a) => a.name === name);
      return negated ? !has : has;
    }

    if (lower.startsWith("macro ")) {
      const name = raw.slice(6).trim();
      const has = Boolean(window.MySpaceShellConfig?.getMacro?.(name)?.length);
      return negated ? !has : has;
    }

    const stateMatch = raw.match(/^(.+?)\s+(open|closed|running)$/i);
    if (stateMatch) {
      const apps = ctx.getApps?.() || [];
      const app = findAppByRef(stateMatch[1].trim(), apps);
      if (!app) return negated;
      const isOpen = ctx.isAppOpen?.(app);
      const wantClosed = stateMatch[2].toLowerCase() === "closed";
      const pass = wantClosed ? !isOpen : isOpen;
      return negated ? !pass : pass;
    }

    const apps = ctx.getApps?.() || [];
    const app = findAppByRef(raw, apps);
    if (app) {
      const isOpen = ctx.isAppOpen?.(app);
      return negated ? !isOpen : isOpen;
    }

    return null;
  }

  function parseIfCommand(trimmed) {
    const lower = trimmed.toLowerCase();
    if (!lower.startsWith("if ")) return null;

    const thenIdx = lower.indexOf(IF_THEN);
    if (thenIdx === -1) return null;

    const condition = trimmed.slice(3, thenIdx).trim();
    let rest = trimmed.slice(thenIdx + IF_THEN.length).trim();
    if (!condition || !rest) return null;

    let elseCmd = null;
    const elseIdx = rest.toLowerCase().lastIndexOf(IF_ELSE);
    if (elseIdx !== -1) {
      elseCmd = rest.slice(elseIdx + IF_ELSE.length).trim();
      rest = rest.slice(0, elseIdx).trim();
    }

    return { condition, thenCmd: rest, elseCmd };
  }

  async function executeIf(trimmed, ctx, depth, scope) {
    if (trimmed.toLowerCase() === "if help" || trimmed.toLowerCase() === "if ?") {
      return { ok: true, message: formatIfHelp() };
    }

    const parsed = parseIfCommand(trimmed);
    if (!parsed) {
      return {
        ok: false,
        error: "Usage: if check drift open then run drift else focus drift",
      };
    }

    const pass = evaluateCondition(parsed.condition, ctx);
    if (pass === null) {
      return { ok: false, error: `Unknown condition: ${parsed.condition}` };
    }

    const cmd = pass ? parsed.thenCmd : parsed.elseCmd;
    if (!cmd) {
      return {
        ok: true,
        message: pass ? "Condition true" : "Condition false",
      };
    }

    const result = await execute(cmd, ctx, depth + 1, scope);
    if (!result.ok) return result;
    return {
      ok: true,
      message: result.message || (pass ? "Then branch ran" : "Else branch ran"),
      data: result.data,
    };
  }

  async function executeLoop(trimmed, ctx, depth, scope) {
    const lower = trimmed.toLowerCase();
    if (lower === "loop help" || lower === "loop ?" || lower === "repeat help") {
      return { ok: true, message: formatLoopHelp() };
    }

    let line = trimmed;
    if (lower.startsWith("repeat ")) {
      line = `loop ${trimmed.slice(7)}`;
    }

    const parsed = parseThenCommand(line, "loop ");
    if (!parsed) {
      return { ok: false, error: "Usage: loop 3 then run builds" };
    }

    const countHead = substituteVars(parsed.head, scope);
    const count = parseInt(countHead, 10);
    if (!Number.isFinite(count) || count < 1) {
      return { ok: false, error: "Loop count must be a positive number" };
    }
    if (count > MAX_LOOP_COUNT) {
      return { ok: false, error: `Loop max is ${MAX_LOOP_COUNT}. got ${count}` };
    }

    let lastMessage = "";
    let lastData;
    for (let i = 0; i < count; i += 1) {
      const frame = createScope(scope);
      setVar(frame, "item", makeVarEntry(String(i + 1)));
      setVar(frame, "index", makeVarEntry(i + 1));
      const result = await execute(parsed.body, ctx, depth, frame);
      if (!result.ok) return result;
      if (result.message) lastMessage = result.message;
      lastData = result.data;
    }

    return { ok: true, message: lastMessage || `Loop ×${count} done`, data: lastData };
  }

  async function executeWhile(trimmed, ctx, depth, scope) {
    const lower = trimmed.toLowerCase();
    if (lower === "while help" || lower === "while ?") {
      return { ok: true, message: formatLoopHelp() };
    }

    const parsed = parseThenCommand(trimmed, "while ");
    if (!parsed) {
      return { ok: false, error: "Usage: while check running then close" };
    }

    if (evaluateCondition(parsed.head, ctx) === null) {
      return { ok: false, error: `Unknown condition: ${parsed.head}` };
    }

    let iterations = 0;
    let lastMessage = "";
    let lastData;

    while (evaluateCondition(parsed.head, ctx) && iterations < MAX_WHILE_ITERATIONS) {
      const result = await execute(parsed.body, ctx, depth, scope);
      if (!result.ok) return result;
      if (result.message) lastMessage = result.message;
      lastData = result.data;
      iterations += 1;
    }

    if (iterations >= MAX_WHILE_ITERATIONS && evaluateCondition(parsed.head, ctx)) {
      return { ok: false, error: `While stopped after ${MAX_WHILE_ITERATIONS} iterations` };
    }

    return {
      ok: true,
      message: lastMessage || (iterations ? `While ran ${iterations} time(s)` : "While: condition false"),
      data: lastData,
    };
  }

  async function executeFor(trimmed, ctx, depth, scope) {
    const lower = trimmed.toLowerCase();
    if (lower === "for help" || lower === "for ?") {
      return { ok: true, message: formatLoopHelp() };
    }

    const parsed = parseThenCommand(trimmed, "for ");
    if (!parsed) {
      return { ok: false, error: "Usage: for builds drift then run $item" };
    }

    const head = substituteVars(parsed.head, scope);
    const items = splitForItems(head);
    if (!items.length) {
      return { ok: false, error: "For needs at least one item" };
    }
    if (items.length > MAX_LOOP_COUNT) {
      return { ok: false, error: `For max is ${MAX_LOOP_COUNT} items` };
    }

    let lastMessage = "";
    let lastData;
    for (let i = 0; i < items.length; i += 1) {
      const frame = createScope(scope);
      setVar(frame, "item", makeVarEntry(items[i]));
      setVar(frame, "index", makeVarEntry(i + 1));
      const result = await execute(parsed.body, ctx, depth, frame);
      if (!result.ok) return result;
      if (result.message) lastMessage = result.message;
      lastData = result.data;
    }

    return { ok: true, message: lastMessage || `For ran ${items.length} item(s)`, data: lastData };
  }

  function executeFocus(trimmed, ctx) {
    const apps = ctx.getApps?.() || [];
    const matched = parseSingleAppCommand(trimmed, "focus", apps);
    if (!matched) {
      if (String(trimmed || "").toLowerCase().startsWith("focus ")) {
        return { ok: false, error: `App not found: ${trimmed.slice(6).trim()}` };
      }
      return null;
    }

    const app = matched.app;
    if (!ctx.isAppOpen?.(app)) {
      return { ok: false, error: `${app.name} is not open. use: run ${matched.ref}` };
    }

    ctx.focusApp?.(app);
    return { ok: true, message: `Focused ${app.name}` };
  }

  function executeAppAction(trimmed, ctx, kind) {
    const verbs = { pin: "pin", unpin: "unpin", reveal: "reveal" };
    const verb = verbs[kind];
    const apps = ctx.getApps?.() || [];
    const matched = parseSingleAppCommand(trimmed, verb, apps);
    if (!matched) {
      if (String(trimmed || "").toLowerCase().startsWith(`${verb} `)) {
        return { ok: false, error: `App not found: ${trimmed.slice(verb.length + 1).trim()}` };
      }
      return null;
    }

    const app = matched.app;

    if (kind === "pin") {
      const result = ctx.pinApp?.(app.id);
      if (!result?.ok) return { ok: false, error: result?.error || "Could not pin" };
      return { ok: true, message: `Pinned ${app.name}` };
    }

    if (kind === "unpin") {
      const result = ctx.unpinApp?.(app.id);
      if (!result?.ok) return { ok: false, error: result?.error || "Could not unpin" };
      return { ok: true, message: `Unpinned ${app.name}` };
    }

    if (kind === "reveal") {
      if (app.type !== "myapp" && app.type !== "external") {
        return { ok: false, error: `${app.name} has no folder to reveal` };
      }
      ctx.revealApp?.(app);
      return { ok: true, message: `Revealing ${app.name}` };
    }

    return null;
  }

  function executeDesktopAction(trimmed, ctx) {
    const lower = trimmed.toLowerCase();

    if (lower === "desktop" || lower === "show desktop") {
      ctx.showDesktop?.();
      return { ok: true, message: "Desktop" };
    }

    if (lower === "settings") {
      ctx.openSettings?.();
      return { ok: true, message: "Settings" };
    }

    if (lower === "add" || lower === "add app") {
      ctx.addApp?.();
      return { ok: true, message: "Add shortcut" };
    }

    if (lower === "refresh" || lower === "refresh desktop") {
      ctx.refreshDesktop?.();
      return { ok: true, message: "Desktop refreshed" };
    }

    if (lower === "sort" || lower === "sort apps") {
      ctx.sortDesktop?.();
      return { ok: true, message: "Icons sorted A–Z" };
    }

    if (lower === "reset layout" || lower === "reset desktop") {
      ctx.resetLayout?.();
      return { ok: true, message: "Icon positions reset" };
    }

    return null;
  }

  async function executeClose(trimmed, ctx) {
    if (!/^close\b/i.test(trimmed)) {
      return { ok: false, error: "Usage: close <app> or close all" };
    }

    const rest = trimmed.slice(5).trim();
    const apps = ctx.getApps?.() || [];

    if (!rest) {
      const closed = ctx.closeActive?.();
      if (!closed) return { ok: false, error: "No active window to close" };
      return { ok: true, message: `Closed ${closed}` };
    }

    if (rest.toLowerCase() === "all") {
      ctx.closeAll?.();
      return { ok: true, message: "Closed all windows" };
    }

    const matched = matchAppRefAtStart(rest, apps);
    if (!matched || matched.rest) {
      return { ok: false, error: `App not found: ${rest}` };
    }

    const closed = ctx.closeApp?.(matched.app.id);
    if (closed === false) return { ok: false, error: `"${matched.app.name}" is not open` };
    return { ok: true, message: `Closed ${matched.app.name}` };
  }

  function executeAlias(trimmed, ctx) {
    const lower = trimmed.toLowerCase();

    if (lower === "alias list" || lower === "aliases") {
      return executeCheck("check aliases", ctx) || { ok: true, message: "No aliases" };
    }

    const removeMatch = trimmed.match(ALIAS_REMOVE_RE);
    if (removeMatch) {
      const result = window.MySpaceShellConfig?.removeAlias?.(removeMatch[1]);
      if (!result?.ok) return { ok: false, error: result?.error || "Could not remove alias" };
      return { ok: true, message: `Removed alias ${removeMatch[1]}` };
    }

    const setMatch = trimmed.match(ALIAS_SET_RE);
    if (setMatch) {
      const result = window.MySpaceShellConfig?.setAlias?.(setMatch[1], setMatch[2]);
      if (!result?.ok) return { ok: false, error: result?.error || "Could not save alias" };
      return { ok: true, message: `Alias ${result.name} saved` };
    }

    return null;
  }

  async function executeMacro(trimmed, ctx) {
    const lower = trimmed.toLowerCase();

    if (lower === "macro list" || lower === "macros") {
      return executeCheck("check macros", ctx) || { ok: true, message: "No macros" };
    }

    const removeMatch = trimmed.match(MACRO_REMOVE_RE);
    if (removeMatch) {
      const result = window.MySpaceShellConfig?.removeMacro?.(removeMatch[1]);
      if (!result?.ok) return { ok: false, error: result?.error || "Could not remove macro" };
      return { ok: true, message: `Removed macro ${removeMatch[1]}` };
    }

    const setMatch = trimmed.match(MACRO_SET_RE);
    if (setMatch) {
      const result = window.MySpaceShellConfig?.setMacro?.(setMatch[1], setMatch[2]);
      if (!result?.ok) return { ok: false, error: result?.error || "Could not save macro" };
      return { ok: true, message: `Macro ${result.name} saved (${result.commands.length} steps)` };
    }

    const runMatch = trimmed.match(MACRO_RUN_RE);
    if (runMatch) {
      const commands = window.MySpaceShellConfig?.getMacro?.(runMatch[1]);
      if (!commands?.length) return { ok: false, error: `Macro not found: ${runMatch[1]}` };
      const results = [];
      for (const cmd of commands) {
        const result = await execute(cmd, ctx, 0, sessionScope);
        if (!result.ok) return result;
        if (result.message) results.push(result.message);
      }
      return { ok: true, message: results[results.length - 1] || `Ran macro ${runMatch[1]}` };
    }

    return null;
  }

  function executeWhen(trimmed, ctx) {
    const lower = trimmed.toLowerCase();

    if (lower === "when list" || lower === "whens") {
      return executeCheck("check when", ctx) || { ok: true, message: "No when rules" };
    }

    const removeMatch = trimmed.match(WHEN_REMOVE_RE);
    if (removeMatch) {
      const result = window.MySpaceShellConfig?.removeWhenRule?.(removeMatch[1]);
      if (!result?.ok) return { ok: false, error: result?.error || "Rule not found" };
      window.MySpaceShellWhen?.refresh?.();
      return { ok: true, message: `Removed rule ${removeMatch[1]}` };
    }

    const setMatch = trimmed.match(WHEN_SET_RE);
    if (setMatch) {
      const trigger = `${setMatch[1].toLowerCase()}(${setMatch[2].trim().toLowerCase()})`;
      const action = setMatch[3].trim();
      const result = window.MySpaceShellConfig?.addWhenRule?.(trigger, action);
      if (!result?.ok) return { ok: false, error: result?.error || "Could not save rule" };
      window.MySpaceShellWhen?.refresh?.();
      return { ok: true, message: `Rule ${result.rule.id}: when ${trigger} → ${action}` };
    }

    return null;
  }

  async function executeChainParts(parts, ctx, depth, scope) {
    const results = [];
    let lastData;
    for (const part of parts) {
      const cmd = typeof part === "string" ? part : part.text;
      const keepGoing = typeof part === "object" && part.keepGoing;
      const result = await execute(cmd, ctx, depth + 1, scope);
      if (!result.ok && !keepGoing) return result;
      if (result.ok && result.message) results.push(result.message);
      else if (!result.ok && result.error) results.push(`(skip: ${result.error})`);
      if (result.ok) lastData = result.data;
    }
    return { ok: true, message: results[results.length - 1] || "Done", data: lastData };
  }

  async function execute(line, ctx, depth = 0, scope = null) {
    const sc = scope || sessionScope;
    let trimmed = String(line || "").trim();
    if (!trimmed) return { ok: false, error: "Empty command" };
    if (depth > 12) return { ok: false, error: "Too many nested commands" };

    if (/[;|]/.test(trimmed)) {
      const parts = splitCommandChain(trimmed);
      if (parts.length > 1) {
        return executeChainParts(parts, ctx, depth, sc);
      }
    }

    if (/^let\s+/i.test(trimmed)) {
      return executeLet(trimmed, ctx, depth, sc);
    }
    if (/^unset\s+/i.test(trimmed)) {
      return executeUnset(trimmed, sc);
    }
    if (/^vars\b/i.test(trimmed) || /^variables\b/i.test(trimmed)) {
      return executeVarsCommand(trimmed, sc);
    }
    const fnsCmd = executeFnsCommand(trimmed, sc);
    if (fnsCmd) return fnsCmd;
    if (/^fn\s+/i.test(trimmed)) {
      return defineFnFromLine(trimmed, sc);
    }

    trimmed = substituteVars(trimmed, sc);
    if (!trimmed) return { ok: false, error: "Empty command after substitution" };

    const fnCall = parseFnCall(trimmed);
    if (fnCall && lookupFn(sc, fnCall.name)) {
      return executeFnCall(fnCall, ctx, depth, sc);
    }

    const aliasCmd = window.MySpaceShellConfig?.resolveAlias?.(trimmed);
    if (aliasCmd && aliasCmd !== trimmed) {
      return execute(aliasCmd, ctx, depth + 1, sc);
    }

    const backupInner = parseBackupCall(trimmed);
    if (backupInner !== null) {
      return executeBackupCommands(backupInner, ctx);
    }

    const storageInner = parseStorageCall(trimmed);
    if (storageInner !== null) {
      return executeStorageCommands(storageInner, ctx);
    }

    const themesInner = parseThemesCall(trimmed);
    if (themesInner !== null) {
      return executeThemesCommands(themesInner, ctx);
    }

    const packInner = parsePackCall(trimmed);
    if (packInner !== null) {
      return executePackCommands(packInner, ctx);
    }

    const spacePath = extractSpaceFilePath(trimmed);
    if (spacePath) {
      return executePackCommands(`open ${spacePath}`, ctx);
    }

    const appCmd = await tryExecuteAppCommand(trimmed, ctx);
    if (appCmd) return appCmd;

    const shorthandCmd = resolveShorthand(trimmed, ctx.getApps?.() || []);
    if (shorthandCmd && shorthandCmd !== trimmed) {
      return execute(shorthandCmd, ctx, depth + 1, sc);
    }

    if (/[;|]/.test(trimmed)) {
      const parts = splitCommandChain(trimmed);
      if (parts.length > 1) {
        return executeChainParts(parts, ctx, depth, sc);
      }
    }

    const lower = trimmed.toLowerCase();

    if (lower === "help" || lower === "?" || lower === "help grammar") {
      return { ok: true, message: formatHelp() };
    }

    if (lower === "help examples" || lower === "examples") {
      return { ok: true, message: listRunExamples().join(" · ") };
    }

    if (lower === "help lang" || lower === "help language" || lower === "help let" || lower === "help fn") {
      return { ok: true, message: formatLangHelp() };
    }

    if (lower === "help backup" || lower === "help backups") {
      return { ok: true, message: formatBackupCommandHelp() };
    }

    if (
      lower === "help pack" ||
      lower === "help spacefile" ||
      lower === "help .space" ||
      lower === "help space-files"
    ) {
      return { ok: true, message: formatPackCommandHelp() };
    }

    const helpAppMatch = trimmed.match(/^help\s+(.+)$/i);
    if (helpAppMatch) {
      const apps = ctx.getApps?.() || [];
      const matched = matchAppRefAtStart(helpAppMatch[1].trim(), apps);
      if (matched && !matched.rest) {
        return formatRoutesCheck(matched.ref, apps);
      }
      return { ok: false, error: `App not found: ${helpAppMatch[1].trim()}` };
    }

    if (lower.startsWith("check")) {
      const result = executeCheck(trimmed, ctx);
      if (result) return result;
      return { ok: false, error: "Usage: check running · check apps · check routes space" };
    }

    if (lower.startsWith("focus ")) {
      const result = executeFocus(trimmed, ctx);
      if (result) return result;
      return { ok: false, error: "Usage: focus drift" };
    }

    if (lower.startsWith("pin ")) {
      const result = executeAppAction(trimmed, ctx, "pin");
      if (result) return result;
    }

    if (lower.startsWith("unpin ")) {
      const result = executeAppAction(trimmed, ctx, "unpin");
      if (result) return result;
    }

    if (lower.startsWith("reveal ")) {
      const result = executeAppAction(trimmed, ctx, "reveal");
      if (result) return result;
    }

    const desktopResult = executeDesktopAction(trimmed, ctx);
    if (desktopResult) return desktopResult;

    if (lower === "wait" || lower.startsWith("wait ")) {
      return executeWait(trimmed);
    }

    if (lower === "timer" || lower.startsWith("timer ")) {
      return execute(`clock(${trimmed})`, ctx, depth + 1, sc);
    }

    if (lower === "pomodoro" || lower.startsWith("pomodoro ")) {
      return execute(`clock(${trimmed})`, ctx, depth + 1, sc);
    }

    if (lower === "stopwatch" || lower.startsWith("stopwatch ")) {
      return execute(`clock(${trimmed})`, ctx, depth + 1, sc);
    }

    if (lower.startsWith("alias")) {
      const result = executeAlias(trimmed, ctx);
      if (result) return result;
      return { ok: false, error: "Usage: alias name = run space(ocean)" };
    }

    if (lower.startsWith("macro")) {
      const result = await executeMacro(trimmed, ctx);
      if (result) return result;
      return { ok: false, error: "Usage: macro name = run builds; run drift" };
    }

    if (lower.startsWith("when")) {
      const result = executeWhen(trimmed, ctx);
      if (result) return result;
      return { ok: false, error: "Usage: when drift(new) notify" };
    }

    if (lower.startsWith("if ")) {
      return executeIf(trimmed, ctx, depth + 1, sc);
    }

    if (lower.startsWith("loop ") || lower.startsWith("repeat ")) {
      return executeLoop(trimmed, ctx, depth, sc);
    }

    if (lower.startsWith("while ")) {
      return executeWhile(trimmed, ctx, depth, sc);
    }

    if (lower.startsWith("for ")) {
      return executeFor(trimmed, ctx, depth, sc);
    }

    if (lower.startsWith("close")) {
      return executeClose(trimmed, ctx);
    }

    const openMatch = trimmed.match(OPEN_RE);
    if (openMatch) {
      return executeRun(`run ${openMatch[1].trim()}`, ctx);
    }

    if (lower.startsWith("run ") || lower.startsWith("goto ")) {
      const asRun = lower.startsWith("goto ") ? `run ${trimmed.slice(5).trim()}` : trimmed;
      return executeRun(asRun, ctx);
    }

    const macroCommands = window.MySpaceShellConfig?.getMacro?.(trimmed);
    if (macroCommands?.length) {
      return execute(`macro ${trimmed}`, ctx, depth + 1, sc);
    }

    const scriptResult = await tryRunNamedScript(trimmed);
    if (scriptResult) return scriptResult;

    return {
      ok: false,
      error:
        "Unknown command. Try: let x = today(list) · fn hi() { … } · run space(ocean) · help lang",
    };
  }

  function formatLangHelp() {
    return [
      "My Space Language — OS orchestration (not bash; not app-internal logic)",
      "Layers: Language · Scripts (runtime) · Shell (atlas) · Services (jobs/schedule/…)",
      "Operations: every module(…) verb in the live registry (help <app> · Platform → Shell)",
      'let name = today(list) · let n = 3 · let s = "hi"',
      "let a = 1; let b = 2  (chain lets with ;)",
      "vars · vars clear · unset name  (names are case-sensitive)",
      "$name · $name.text · $name.ok · $$ for literal $",
      "fn greet(name) { … } · greet(Yonatan) · fn list · fn remove greet",
      "Empty fn bodies are ok · do not name fns after apps (today/clock/…)",
      "help lang · docs(open shell-language)",
    ].join(" · ");
  }

  async function tryRunNamedScript(trimmed) {
    const key = String(trimmed || "").trim();
    if (!key) return null;
    const lower = key.toLowerCase();
    if (
      /^(help|check|run|open|goto|close|focus|pin|unpin|reveal|alias|macro|when|if|loop|repeat|while|for|let|unset|vars|fn|fns|desktop|settings|add|refresh|sort|backup)\b/.test(
        lower
      )
    ) {
      return null;
    }
    if (!window.mySpace?.scripts?.run) return null;

    let exists = false;
    try {
      const listed = await window.mySpace.scripts.list();
      if (listed?.ok && Array.isArray(listed.scripts)) {
        exists = listed.scripts.some((s) => String(s.name || "").toLowerCase() === lower);
      }
    } catch {
      return null;
    }
    if (!exists) return null;

    const res = await window.mySpace.scripts.run({ name: key });
    if (!res) return { ok: false, error: `Script "${key}" failed` };
    if (res.ok === false && res.error === "Script not found") return null;

    const ran = Number(res.ran) || (res.results || []).length;
    const failed = Number(res.failed) || (res.results || []).filter((r) => !r.ok).length;
    if (res.ok) {
      return {
        ok: true,
        message: res.message || `Script ${key}: ${ran} step${ran === 1 ? "" : "s"}`,
      };
    }
    return {
      ok: false,
      error:
        res.message ||
        res.error ||
        (res.stopped
          ? `Script ${key} stopped after ${ran} step${ran === 1 ? "" : "s"}`
          : `Script ${key} finished with ${failed} error${failed === 1 ? "" : "s"}`),
    };
  }

  window.MySpaceShellCommands = {
    parseRunCommand,
    parseRunArgs,
    matchAppRefAtStart,
    resolveShorthand,
    parseAppRefToken,
    buildRouteScript,
    findAppByRef,
    resolveModule,
    formatHelp,
    formatCheckHelp,
    formatIfHelp,
    formatLoopHelp,
    formatLangHelp,
    formatRoutesCheck,
    getCommandHelpForModule,
    formatScriptsCommandHelp,
    formatMapsCommandHelp,
    parseThenCommand,
    evaluateCondition,
    parseIfCommand,
    listRunExamples,
    splitCommandChain,
    parseArgStructure,
    execute,
    executeProgram,
    substituteVars,
    createScope,
    getSessionScope: () => sessionScope,
    ROUTE_REGISTRY,
  };
})();