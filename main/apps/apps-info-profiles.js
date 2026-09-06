const APP_PROFILES = {
  welcome: {
    tagline: "Startup command center",
    about:
      "Welcome is the built-in startup screen of the shell — not a desktop app. It opens when My Space launches (unless disabled in Settings → General → Desktop) and surfaces apps, tips, and quick actions without a separate myapp module.",
    features: [
      "Opens on system startup",
      "Not shown as a desktop or Start menu app",
      "Tips and orientation for the desktop",
      "Quick actions into other tools",
      "Lives inside the shell (builtin), not a separate webview module",
    ],
    pages: ["Home / tips"],
    storageKeys: [],
  },
  "apps-info": {
    tagline: "Catalog of every app & platform service",
    about:
      "Info is the Platform encyclopedia for My Space: logos, what each app or service does, surfaces, storage, and live activity digests where available. Open from Platform → Info — not a desktop tile.",
    features: [
      "Full catalog of desktop apps and platform services",
      "About, features, and surfaces per entry",
      "Live stats & timeline digests for supported apps",
      "Storage and source-file overview",
    ],
    pages: ["Catalog", "Detail"],
    storageKeys: [],
  },
  docs: {
    tagline: "Built-in handbook",
    about:
      "Searchable documentation for Shell, apps, protocols, recipes, and architecture. Deep-linkable topics for how My Space fits together.",
    features: ["Category browse", "Full-text search", "Bookmarks", "Deep links from shell docs(…)"],
    pages: ["Overview", "Categories", "Search"],
    storageKeys: [],
  },
  "system-info": {
    tagline: "Live machine vitals",
    about:
      "System Info scans Windows for ports, processes, memory, storage, CPU, network, environment variables, and disk trees. It also keeps a rolling metrics history for charts.",
    features: [
      "Ports, processes, memory & CPU scans",
      "Storage / disk tree & large-file finder",
      "Network & environment inspection",
      "Metrics sampling with 24h history",
    ],
    pages: ["System", "CPU", "Memory", "Storage", "Disk", "Performance", "Processes", "Network", "Ports", "Environment"],
    storageKeys: ["system-info-metrics.json"],
  },
  "world-clock": {
    tagline: "Time tools for focus and meetings",
    about:
      "World clocks, a timer, stopwatch, Pomodoro, and a meeting planner — persisted so your favorites and timers survive restarts.",
    features: ["World clock favorites", "Timer & stopwatch", "Pomodoro", "Meeting planner across zones"],
    pages: ["Clocks", "Timer", "Pomodoro", "Meetings"],
    storageKeys: ["world-clock.json"],
  },
  "remote-hub": {
    tagline: "Reach other PCs from My Space",
    about:
      "Machine inventory for RDP, SSH, WinRM and related remoting. Tracks latency checks, favorites, and last-seen status.",
    features: ["Machine roster", "Quick connect", "LAN network scan", "Enable-access scripts", "Latency / online checks"],
    pages: ["Machines", "Quick connect", "Network scan", "Enable access"],
    storageKeys: ["remote-hub.json", "remote-hub-last.rdp"],
  },
  "os-bridge": {
    tagline: "Phone ↔ PC over local Wi‑Fi",
    about:
      "Pair a phone on the same network for files, clipboard, hosted folders/USB, share actions, and Windows shortcuts. Separate from Remote Hub (which targets other PCs).",
    features: ["Device pairing & QR", "Send files & clipboard", "Hosted places", "Windows host shortcuts"],
    pages: ["Devices", "Places", "Share", "Host"],
    storageKeys: ["os-bridge.json"],
  },
  files: {
    tagline: "Places, drives & recent files",
    about:
      "Platform file browser for My Space: browse places and drives, recent files, favorites, and Downloads — without leaving the shell.",
    features: ["Browse places & drives", "Recent files", "Favorites", "Downloads folder"],
    pages: ["Browse", "Recent", "Favorites", "Downloads"],
    storageKeys: [],
  },
  pulse: {
    tagline: "Link Bus — apps & external tools",
    about:
      "Cross-app messaging bus for internal apps and Composio external tools. Per-app pulse.json command profiles, send/subscribe, events, and an External tab for API keys and toolkits.",
    features: ["Command routes", "Subscriptions & events", "Activity log", "Composio external tools"],
    pages: ["Routes", "External", "Events", "Subscriptions", "Log", "Send"],
    storageKeys: ["pulse.json"],
  },
  "msl-protocol": {
    tagline: "My Space Link capability bus",
    about:
      "Browse providers, mint msl:v1 keys, manage the library, and inject capabilities into AI apps. Complements Pulse (messages) and Parts (code modules).",
    features: ["Capability catalog", "Mint & manage keys", "Inject into AI apps", "Shell msl(…)"],
    pages: ["Capabilities", "Keys", "Mint", "Inject"],
    storageKeys: ["msl.json"],
  },
  parts: {
    tagline: "Reusable code modules between apps",
    about:
      "Catalog of clean, reusable parts (helpers, UI fragments, utilities). Browse like a forge, open a part, adopt by copying files — written without host-app coupling.",
    features: ["Explore parts", "Publish from any app", "Copy-to-adopt workflow"],
    pages: ["Explore", "Publish", "About"],
    storageKeys: ["parts.json"],
  },
  permissions: {
    tagline: "Gates for AI tools, Jobs, Bridge & more",
    about:
      "Central switches for what Mind tools may do, notification senders, Jobs capacity gates, Bridge trusted devices, and Composio allowlists.",
    features: ["AI tool switches", "Notification blocklist", "Jobs gates", "Bridge trust", "External allowlist"],
    pages: ["Overview", "AI tools", "Notifications", "Jobs", "Bridge", "External"],
    storageKeys: ["permissions.json"],
  },
  jobs: {
    tagline: "OS compute runtime & capacity",
    about:
      "Queue, active, and done jobs with capacity pools (Interactive, Connect, Shell, Background). Connect opens are prioritized; stuck work can recover.",
    features: ["Job queue", "Capacity pools", "Enqueue work", "Shell jobs(…)"],
    pages: ["Queue", "Active", "Done", "Enqueue", "Capacity"],
    storageKeys: ["jobs.json"],
  },
  resolve: {
    tagline: "Incidents, playbooks & fixes",
    about:
      "Apps report faults via Pulse; Resolve matches playbooks and lets you apply fixes from an inbox. Complements the Fault protocol.",
    features: ["Incident inbox", "Playbook matching", "Apply known fixes", "Shell resolve(…)"],
    pages: ["Inbox", "Playbooks", "About"],
    storageKeys: ["resolve.json"],
  },
  updates: {
    tagline: "Current build & new releases",
    about:
      "Platform release service: your installed version with notes, new major updates on this page (not the bell), History changelog, Apply / Skip.",
    features: ["Current build card", "New updates list", "Full changelog", "Restart & update"],
    pages: ["Current", "History", "About"],
    storageKeys: ["updates-state.json"],
  },
  backup: {
    tagline: "Export & restore My Space data",
    about:
      "Platform backup service: export the userData folder to a zip you choose, restore from zip (restarts My Space), and keep a history of exports and restores on this PC.",
    features: ["Export zip", "Restore & relaunch", "History of exports/restores", "Open data folder"],
    pages: ["Status", "History", "About"],
    storageKeys: ["backup-state.json"],
  },
  network: {
    tagline: "Host connectivity",
    about:
      "Online status, primary IP, reachability probes (DNS / internet / Gemini / GitHub), adapters, and listening ports. Opens Windows Network settings when needed.",
    features: ["Status & reachability", "Adapters & DNS", "Listening ports", "Windows Network link"],
    pages: ["Status", "Adapters", "Ports", "About"],
    storageKeys: [],
  },
  storage: {
    tagline: "Disk & My Space data",
    about:
      "Platform storage service: drive usage, per-app userData breakdown, large-file scan on host drives, and safe cleanup of temp/cache/quarantine files inside userData.",
    features: ["Drive status", "App data breakdown", "Large file scan", "Safe cleanup", "Open userData folder"],
    pages: ["Status", "Apps", "Large files", "Cleanup", "About"],
    storageKeys: ["storage-state.json"],
  },
  themes: {
    tagline: "Colors & modes per app",
    about:
      "Platform Themes service: per-app light/dark mode and button styles. Defaults keep today’s look; customize Studies, Clock, and more as they are rolled out.",
    features: ["Per-app mode", "Button styles", "Live apply", "Reset to default"],
    pages: ["Apps", "About"],
    storageKeys: ["themes-state.json"],
  },
  studies: {
    tagline: "Documents, templates & Gemini fill",
    about:
      "Subject workspaces with Word-style documents, templates with slots, and a dedicated Gemini chat that can fill layouts or generate multi-page projects.",
    features: ["Documents & templates", "Slot-based AI fill", "Dedicated Gemini chat", "Export-oriented layouts"],
    pages: ["Documents", "Templates", "AI chat"],
    storageKeys: ["studies.json"],
  },
  "study-deck": {
    tagline: "Flashcards with spaced repetition",
    about:
      "Create decks, study cards, and generate content with AI. Tracks ease, intervals, lapses, and due dates.",
    features: ["Decks & cards", "Spaced-repetition scheduling", "AI card generation", "Per-card study stats"],
    pages: ["Decks", "Study", "Generate"],
    storageKeys: ["study-deck.json"],
  },
  "day-planner": {
    tagline: "Hour-by-hour agenda",
    about:
      "Daily tasks with due times, priorities, snooze/notify, and completion timestamps — the live day board for My Space.",
    features: ["Hour agenda", "Reminders & snooze", "Done / undone tracking", "Priority levels"],
    pages: ["Today"],
    storageKeys: ["day-planner.json"],
  },
  tasks: {
    tagline: "Projects & next actions",
    about:
      "GTD-style task manager: Inbox, Next, Waiting, Someday, projects/lists, soft due dates, checklists, and Send to Today. Complements Notes (capture) and Today (timed agenda).",
    features: [
      "Inbox & smart lists",
      "Projects with lists",
      "Priorities, flags, due dates",
      "Checklists",
      "Schedule onto Today",
      "Shell: tasks / gtd / todo",
    ],
    pages: ["Inbox", "Next", "Projects", "Completed"],
    storageKeys: ["tasks.json"],
  },
  profiles: {
    tagline: "Encrypted secrets vault",
    about:
      "Profiles and an encrypted vault for passwords and secrets. Detail views never expose secret values — only safe metadata.",
    features: ["Profile list", "Encrypted vault storage", "Create / update timestamps"],
    pages: ["Profiles", "Vault"],
    storageKeys: ["profiles.json", "vault.json"],
  },
  "world-maps": {
    tagline: "Map explorer with notes & routes",
    about:
      "Interactive world map with accounts, notes, routes, and search. User data lives under a dedicated world-maps folder in userData.",
    features: ["Map exploration", "Notes & routes", "Search", "Per-user map settings"],
    pages: ["Map", "Notes", "Routes"],
    storageKeys: ["world-maps/"],
  },
  stocks: {
    tagline: "Multi-asset tracker + AI analysis",
    about:
      "Watchlists, portfolio holdings, alerts, buy list, live charts, AI Analysis pages, and a dedicated Stocks Gemini chat.",
    features: [
      "Watchlists & holdings",
      "Price alerts",
      "Buy list",
      "Charts across ranges",
      "Deep AI Analysis (cached)",
      "Dedicated Gemini chat",
    ],
    pages: ["Markets", "Portfolio", "Alerts", "AI Analysis", "AI chat"],
    storageKeys: ["stocks.json"],
  },
  translate: {
    tagline: "Translation desk with history",
    about:
      "Translate across 100+ languages with phrase helpers, batch mode, favorites, and a persistent history of past translations.",
    features: ["Single & batch translate", "Language pairs", "Favorites", "History of translations"],
    pages: ["Translate", "Phrases", "History"],
    storageKeys: ["translate.json"],
  },
  contacts: {
    tagline: "People, birthdays & reminders",
    about:
      "Contact profiles with phone, email, groups, birthdays, and reminder notifications.",
    features: ["Contact cards", "Groups", "Birthdays", "Reminder triggers"],
    pages: ["People", "Groups"],
    storageKeys: ["contacts.json"],
  },
  mail: {
    tagline: "Mail inside Connect",
    about:
      "Connect mail accounts, sync messages, and read inbox content inside My Space. Part of the Web / Connect surface — not a separate desktop-only silo.",
    features: ["Account connect", "Inbox sync", "Message list & detail", "Provider support"],
    pages: ["Inbox", "Accounts"],
    storageKeys: ["mail.json"],
  },
  notes: {
    tagline: "Quick notes & notebooks",
    about:
      "Capture notes and keep them organized inside My Space with search-friendly local storage.",
    features: ["Create & edit notes", "Local persistence", "Quick capture"],
    pages: ["Notes"],
    storageKeys: ["notes.json"],
  },
  coupons: {
    tagline: "Coupons & expiry alerts",
    about:
      "Track coupons and promo codes with expiry dates and reminder notifications before they lapse.",
    features: ["Coupon inventory", "Expiry tracking", "Reminder alerts"],
    pages: ["Coupons"],
    storageKeys: ["coupons.json"],
  },
  chat: {
    tagline: "Full-page AI conversations",
    about:
      "ChatGPT-style conversations powered by Mind — history sidebar, model/context settings, pin/rename, and task chips. Distinct from the Mind Chat side panel.",
    features: ["Conversation history", "Model & context settings", "Pin / rename / regenerate", "Mind-backed replies"],
    pages: ["Chat", "History"],
    storageKeys: ["chat.json"],
  },
  geography: {
    tagline: "Countries, images & travel log",
    about:
      "Rich country encyclopedia with images, learning profiles, and a personal travel log (visits, cities, ratings).",
    features: ["Country data & images", "Travel log", "Learning profiles", "Country cache"],
    pages: ["Browse", "Travel", "Learn"],
    storageKeys: ["geography.json", "geography-countries-cache.json"],
  },
  "flag-quiz": {
    tagline: "Flag mastery across five game modes",
    about:
      "Five game modes, levels 1–5, random play, typo-tolerant answers, and persisted high-score history.",
    features: ["5 game modes", "Levels & random", "Score history", "Missed-country learning"],
    pages: ["Modes", "Play", "Records"],
    storageKeys: ["flag-quiz-scores.json"],
  },
  "pi-digits": {
    tagline: "π digit explorer",
    about:
      "Browse and search digits of π — a playful math utility inside My Space.",
    features: ["Digit browse", "Search / jump", "Local display"],
    pages: ["Digits"],
    storageKeys: [],
  },
  "icon-library": {
    tagline: "Icon & brand asset library",
    about:
      "Browse My Space brand marks and icons used across the shell and apps.",
    features: ["Icon browse", "Brand atom variants", "Copy / reference for apps"],
    pages: ["Library"],
    storageKeys: [],
  },
  history: {
    tagline: "Figures & events encyclopedia",
    about:
      "Historical figures and events powered by Wikidata/Wikipedia caches, plus personal bookmarks.",
    features: ["Figures & events browse", "Wikipedia / Wikidata cache", "Bookmarks with notes"],
    pages: ["Figures", "Events", "Bookmarks"],
    storageKeys: ["history.json", "history-cache.json"],
  },
  space: {
    tagline: "Stars, NASA lab & exploration log",
    about:
      "Space exploration with star catalogs, NASA missions/reports, physics notes, ocean/earth layers, APOD cache, and a personal logbook.",
    features: ["Star / ocean / earth layers", "NASA lab & reports", "APOD cache", "Exploration logbook"],
    pages: ["Explore", "NASA", "Logbook", "Physics"],
    storageKeys: ["space.json", "space-apod-cache.json"],
  },
  contracts: {
    tagline: "Formal digital agreements",
    about:
      "Fillable contract templates with signatures, status, expiry dates, and warning notifications.",
    features: ["Templates", "Fillable fields", "Signatures", "Expiry alerts"],
    pages: ["Contracts", "Templates"],
    storageKeys: ["contracts.json"],
  },
  builds: {
    tagline: "Everything you’ve built",
    about:
      "Project inventory with categories, documentation, attachments, stack tags, and code file trees.",
    features: ["Projects & categories", "File trees", "Notes & attachments", "Stack / tags"],
    pages: ["Projects", "Categories"],
    storageKeys: ["builds.json"],
  },
  "code-lexicon": {
    tagline: "4000+ programming concepts",
    about:
      "Searchable lexicon of programming concepts. Mostly bundled content with a light user preference file.",
    features: ["Concept search", "Category browse", "Bundled lexicon dataset"],
    pages: ["Browse", "Search"],
    storageKeys: ["code-lexicon.json"],
  },
  drift: {
    tagline: "What changed on your PC",
    about:
      "Watches folders/zones, snapshots filesystem state, and builds a chronological timeline of creates, edits, deletes, git commits, and My Space config changes.",
    features: ["Watched zones", "Filesystem event timeline", "Git commit detection", "Background scanning"],
    pages: ["Timeline", "Zones", "Settings"],
    storageKeys: ["drift.json"],
  },
  "model-flow": {
    tagline: "AI plans tool flows — you approve",
    about:
      "Personal automation studio: plan → edit → approve → run. Connects to external model providers; Lab is not a My Space service.",
    features: ["Plan & approve flows", "Tool staging", "Run history", "Shell flow(…)"],
    pages: ["Studio", "Tools", "History"],
    storageKeys: ["model-flow.json"],
  },
  "shell-console": {
    tagline: "Legacy console (retired)",
    about:
      "Former command runner. The live Shell atlas and desktop shell line replaced it; long programs live in Scripts.",
    features: ["Historical aliases / macros data may remain", "Use Platform → Shell instead"],
    pages: ["Retired"],
    storageKeys: ["shell-engine.json"],
  },
  scripts: {
    tagline: "Saved multi-step shell programs",
    about:
      "Write, save, and run long My Space shell command sequences line by line. Open from Platform → Scripts.",
    features: ["Script library", "Create & edit", "Line-by-line run", "Shell scripts(…)"],
    pages: ["Library", "New"],
    storageKeys: ["scripts.json"],
  },
  edge: {
    tagline: "Microsoft Edge (external)",
    about: "Launches or embeds Microsoft Edge from the configured install path.",
    features: ["External browser launch", "Optional in-app URL dashboards"],
    pages: [],
    storageKeys: [],
  },
  docker: {
    tagline: "Docker Desktop (external)",
    about: "Opens Docker Desktop; optional in-app URL for a local dashboard.",
    features: ["External app launch", "Optional localhost dashboard"],
    pages: [],
    storageKeys: [],
  },
  vscode: {
    tagline: "Visual Studio Code (external)",
    about: "Launches VS Code from common install locations.",
    features: ["External editor launch"],
    pages: [],
    storageKeys: [],
  },
  terminal: {
    tagline: "Windows Terminal (external)",
    about: "Launches Windows Terminal (wt.exe) from Apps or PATH.",
    features: ["External terminal launch"],
    pages: [],
    storageKeys: [],
  },
  cursor: {
    tagline: "Cursor AI editor (external)",
    about: "Launches the Cursor editor from its local install path.",
    features: ["External AI editor launch"],
    pages: [],
    storageKeys: [],
  },
  github: {
    tagline: "GitHub in the browser",
    about: "Opens https://github.com as a URL workspace tab.",
    features: ["URL workspace", "Favicon-based tile icon"],
    pages: [],
    storageKeys: [],
  },
};

const SERVICE_PROFILES = {
  os: {
    tagline: "Personal desktop layer on your OS",
    about:
      "Desktop, windows/tabs, pins, focus, wallpaper, and launching internal or external programs inside one shell.",
    features: ["Desktop & windows", "Pins & focus", "Wallpaper", "Launch internal/external"],
    pages: ["Desktop", "Settings"],
    storageKeys: [],
  },
  browser: {
    tagline: "In-app browsing and unified search",
    about:
      "Workspace web tabs, address bar, and My Space Browser — browse without leaving the shell.",
    features: ["Web tabs", "Address bar", "My Space Browser home"],
    pages: ["Home", "Web"],
    storageKeys: [],
  },
  connect: {
    tagline: "Find and open web services inside My Space",
    about:
      "Service catalog for mail, messaging, social, browsers, and more. Open from the search icon — looks the same as before.",
    features: ["Service catalog", "Mail & web destinations", "My Space Browser entry"],
    pages: ["Catalog", "My Space Browser"],
    storageKeys: [],
  },
  shell: {
    tagline: "Command language — full atlas",
    about:
      "Long-form map of every live shell command (modules, language, core verbs). Type on the desktop shell line or palette; author long programs in Scripts.",
    features: ["Command atlas", "Language reference", "Module index", "Core verbs"],
    pages: ["Overview", "Language", "Modules", "Core"],
    storageKeys: [],
  },
  mind: {
    tagline: "OS AI runtime — conversations, tasks, models",
    about:
      "Platform AI control plane: Everyday · Quick · Deep. Long-term Memory, Gemini key and optional Ollama in Setup. Mind Chat is the side assistant.",
    features: ["Chat history", "Mind Chat side panel", "Setup keys & models", "Long-term Memory"],
    pages: ["Chat", "Mind Chat", "Setup", "Memory"],
    storageKeys: ["mind.json"],
  },
  search: {
    tagline: "Find apps, services & content",
    about:
      "Unified search across My Space — apps, platform services, and desktop content from one entry point.",
    features: ["Unified search", "App & service hits", "Quick open"],
    pages: ["Search"],
    storageKeys: [],
  },
  notifications: {
    tagline: "Alerts that matter",
    about:
      "Notification center for reminders, deadlines, timers, updates, and other high-signal alerts — the bell surface as a platform service.",
    features: ["Inbox of alerts", "Prefs & blocklist hooks", "OS toast integration"],
    pages: ["Inbox"],
    storageKeys: ["notifications.json"],
  },
  backup: {
    tagline: "Export & restore My Space data",
    about:
      "Platform backup service: export the userData folder to a zip you choose, restore from zip (restarts My Space), and keep a history of exports and restores on this PC.",
    features: ["Export zip", "Restore & relaunch", "History of exports/restores", "Open data folder"],
    pages: ["Status", "History", "About"],
    storageKeys: ["backup-state.json"],
  },
  storage: {
    tagline: "Disk & My Space data",
    about:
      "Platform storage service: host drive summary, per-app userData sizes, large-file scan, and safe cleanup of temp and cache files.",
    features: ["Drive usage", "App breakdown", "Large files", "Safe cleanup"],
    pages: ["Status", "Apps", "Large files", "Cleanup", "About"],
    storageKeys: ["storage-state.json"],
  },
  themes: {
    tagline: "Colors & modes per app",
    about:
      "Pick an app and switch light/dark or button styles. Defaults match the shipped look; rolled out two apps at a time.",
    features: ["App grid", "Mode & buttons", "Reset default"],
    pages: ["Apps", "About"],
    storageKeys: ["themes-state.json"],
  },
};

const SERVICE_TO_APP = {
  scripts: "scripts",
  msl: "msl-protocol",
  parts: "parts",
  pulse: "pulse",
  resolve: "resolve",
  jobs: "jobs",
  updates: "updates",
  network: "network",
  flow: "model-flow",
  "system-info": "system-info",
  bridge: "os-bridge",
  files: "files",
  permissions: "permissions",
  backup: "backup",
  storage: "storage",
  themes: "themes",
};

module.exports = {
  APP_PROFILES,
  SERVICE_PROFILES,
  SERVICE_TO_APP,
};