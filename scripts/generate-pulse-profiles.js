const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function cmd(verb, title, description, opts = {}) {
  const row = {
    verb,
    title,
    description,
    delivery: opts.delivery || "ipc",
  };
  if (row.delivery === "ipc") row.channel = opts.channel || verb;
  if (opts.broker) row.broker = opts.broker;
  if (opts.input) row.input = opts.input;
  if (opts.emit) row.emit = opts.emit;
  if (opts.examples) row.examples = opts.examples;
  if (opts.callers) row.callers = opts.callers;
  return row;
}

function evt(topic, title, description, payload) {
  return { topic, title, description, payload: payload || {} };
}

function writePulse(relDir, data) {
  const dir = path.join(ROOT, relDir);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "pulse.json");
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log("wrote", path.relative(ROOT, file), data.commands.length, "cmds");
}

function writeApp(moduleId, data) {
  writePulse(path.join("apps", moduleId), data);
}

function writeBootstrapFixed(name, data) {
  const file = path.join(ROOT, "main", "link", "bootstrap", `${name}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log("wrote bootstrap", name, data.commands.length, "cmds");
}

writeApp("notes", {
  profile: {
    tagline: "Quick capture: notebooks, tags, pin & archive",
    icon: "📝",
    color: "#7dd3fc",
  },
  commands: [
    cmd("list", "List notes", "List notes (optional notebook / archived filter)", {
      channel: "notes.list",
      input: { notebookId: "string?", archived: "boolean?", pinned: "boolean?" },
    }),
    cmd("search", "Search notes", "Search notes by text", {
      channel: "notes.search",
      input: { q: "string" },
      examples: ["pulse(send notes search q=todo)"],
    }),
    cmd("get", "Get note", "Fetch a note by id or title", {
      channel: "note.get",
      input: { id: "string?", title: "string?", ref: "string?" },
    }),
    cmd("create", "Create note", "Add a new note", {
      channel: "note.add",
      input: { title: "string?", body: "string?", text: "string?", tags: "string[]?", notebookId: "string?" },
      emit: "notes.created",
      examples: ["pulse(send notes create title=Hello body=World)"],
    }),
    cmd("update", "Update note", "Change title, body, or tags", {
      channel: "note.update",
      input: { id: "string", title: "string?", body: "string?", tags: "string[]?", notebookId: "string?" },
      emit: "notes.updated",
    }),
    cmd("delete", "Delete note", "Permanently delete a note", {
      channel: "note.delete",
      input: { id: "string" },
      emit: "notes.deleted",
    }),
    cmd("pin", "Pin note", "Pin or unpin a note", {
      channel: "note.pin",
      input: { id: "string", pinned: "boolean?" },
    }),
    cmd("archive", "Archive note", "Archive or restore a note", {
      channel: "note.archive",
      input: { id: "string", archived: "boolean?" },
    }),
    cmd("open", "Open note", "Open Notes and select a note", {
      delivery: "ui",
      input: { id: "string?", title: "string?", ref: "string?" },
    }),
    cmd("notebooks", "List notebooks", "List all notebooks", { channel: "notebooks.list" }),
    cmd("notebookCreate", "Create notebook", "Add a notebook", {
      channel: "notebook.add",
      input: { name: "string", icon: "string?" },
    }),
    cmd("notebookRename", "Rename notebook", "Rename a notebook", {
      channel: "notebook.rename",
      input: { id: "string", name: "string" },
    }),
    cmd("notebookDelete", "Delete notebook", "Delete a notebook (notes move to Inbox)", {
      channel: "notebook.delete",
      input: { id: "string" },
    }),
  ],
  events: [
    evt("notes.created", "Note created", "A note was added", { id: "string", title: "string?" }),
    evt("notes.updated", "Note updated", "A note changed", { id: "string" }),
    evt("notes.deleted", "Note deleted", "A note was removed", { id: "string" }),
  ],
});

writeApp("contacts", {
  profile: {
    tagline: "People: phone, email, birthdays & reminders",
    icon: "👥",
    color: "#f9a8d4",
  },
  commands: [
    cmd("list", "List contacts", "Load contacts and groups (optional search)", {
      channel: "storage.load",
      input: { q: "string?" },
    }),
    cmd("add", "Add contact", "Create a contact", {
      channel: "contact.add",
      input: {
        firstName: "string?",
        lastName: "string?",
        name: "string?",
        email: "string?",
        phone: "string?",
        company: "string?",
        groupId: "string?",
      },
      emit: "contacts.added",
    }),
    cmd("delete", "Delete contact", "Remove a contact by id", {
      channel: "contact.delete",
      input: { id: "string" },
      emit: "contacts.deleted",
    }),
    cmd("open", "Open contact", "Open Contacts and show a person", {
      delivery: "ui",
      input: { id: "string" },
    }),
    cmd("email", "Open email", "Compose email to a contact address", {
      channel: "email.open",
      input: { email: "string?", id: "string?" },
    }),
    cmd("phone", "Open phone", "Start a phone call / tel: link", {
      channel: "phone.open",
      input: { phone: "string?", id: "string?" },
    }),
    cmd("sms", "Open SMS", "Open SMS to a number", {
      channel: "sms.open",
      input: { phone: "string?", id: "string?" },
    }),
    cmd("copy", "Copy text", "Copy text to the clipboard", {
      channel: "clipboard.copy",
      input: { text: "string" },
    }),
    cmd("reminders", "Upcoming reminders", "List upcoming contact reminders", {
      channel: "reminders.upcoming",
    }),
    cmd("remindersCheck", "Check reminders", "Fire due reminders now", {
      channel: "reminders.check",
    }),
    cmd("export", "Export contacts", "Export contacts JSON", { channel: "data.export" }),
    cmd("import", "Import contacts", "Import contacts from JSON", {
      channel: "data.import",
      input: { json: "string?", data: "object?" },
    }),
    cmd("notifyTest", "Test notification", "Show a test OS notification", {
      channel: "notify.test",
      input: { title: "string?", body: "string?" },
    }),
  ],
  events: [
    evt("contacts.selected", "Contact selected", "User selected a contact", { id: "string", name: "string?" }),
    evt("contacts.added", "Contact added", "A contact was created", { id: "string" }),
    evt("contacts.deleted", "Contact deleted", "A contact was removed", { id: "string" }),
  ],
});

writeApp("files", {
  profile: {
    tagline: "Browse this PC: places, preview & file actions",
    icon: "📁",
    color: "#93c5fd",
  },
  commands: [
    cmd("list", "List directory", "List files in a folder", {
      channel: "dir.list",
      input: { path: "string" },
    }),
    cmd("stat", "File info", "Get metadata for a path", {
      channel: "file.stat",
      input: { path: "string" },
    }),
    cmd("read", "Read file", "Read a text file", {
      channel: "file.read",
      input: { path: "string" },
    }),
    cmd("preview", "Preview file", "Preview a file", {
      channel: "file.preview",
      input: { path: "string" },
    }),
    cmd("open", "Open path", "Open with the default handler", {
      channel: "path.open",
      input: { path: "string" },
      emit: "files.opened",
    }),
    cmd("reveal", "Reveal in Explorer", "Show path in the system file manager", {
      channel: "file.reveal",
      input: { path: "string" },
      emit: "files.revealed",
    }),
    cmd("browse", "Browse folder", "Open Files and navigate to a folder", {
      delivery: "ui",
      input: { path: "string" },
    }),
    cmd("mkdir", "Create folder", "Create a new directory", {
      channel: "dir.create",
      input: { path: "string?", parent: "string?", name: "string" },
    }),
    cmd("rename", "Rename", "Rename a file or folder", {
      channel: "file.rename",
      input: { path: "string", name: "string" },
    }),
    cmd("copy", "Copy", "Copy a file or folder", {
      channel: "file.copy",
      input: { path: "string", dest: "string" },
    }),
    cmd("move", "Move", "Move a file or folder", {
      channel: "file.move",
      input: { path: "string", dest: "string" },
    }),
    cmd("delete", "Delete", "Delete a path (Recycle Bin when possible)", {
      channel: "file.delete",
      input: { path: "string" },
    }),
    cmd("places", "List places", "Home, Desktop, Documents, Downloads…", { channel: "places.list" }),
    cmd("drives", "List drives", "List disk drives", { channel: "drives.list" }),
    cmd("recent", "Recent files", "Recently opened paths", { channel: "recent.list" }),
    cmd("recentClear", "Clear recent", "Clear recent history", { channel: "recent.clear" }),
    cmd("favorites", "List favorites", "Pinned favorite folders", { channel: "favorites.list" }),
    cmd("favoriteAdd", "Add favorite", "Pin a folder", {
      channel: "favorites.add",
      input: { path: "string" },
    }),
    cmd("favoriteRemove", "Remove favorite", "Unpin a folder", {
      channel: "favorites.remove",
      input: { path: "string" },
    }),
    cmd("home", "Home snapshot", "Places + drives + status", { channel: "home" }),
  ],
  events: [
    evt("files.opened", "File opened", "A path was opened", { path: "string" }),
    evt("files.revealed", "File revealed", "A path was shown in Explorer", { path: "string" }),
  ],
});

writeBootstrapFixed("desktop", {
  profile: {
    tagline: "My Space shell: toasts, launch & focus",
    icon: "🖥️",
    color: "#a78bfa",
  },
  commands: [
    cmd("toast", "Show toast", "Display a short desktop toast", {
      delivery: "ui",
      input: { message: "string" },
      callers: ["desktop", "shell", "jobs", "mind", "pulse"],
      examples: ["pulse(send desktop toast message=Saved)"],
    }),
    cmd("launch", "Launch app", "Open a My Space app by id", {
      delivery: "ui",
      input: { appId: "string", page: "string?" },
      callers: ["desktop", "shell", "jobs", "mind", "pulse"],
    }),
    cmd("showDesktop", "Show desktop", "Focus the desktop / hide workspace", {
      delivery: "ui",
      input: {},
    }),
    cmd("openSettings", "Open settings", "Open My Space settings", {
      delivery: "ui",
      input: {},
    }),
    cmd("openSearch", "Open search", "Open the command palette", {
      delivery: "ui",
      input: {},
    }),
    cmd("openNotifications", "Open notifications", "Open the bell inbox", {
      delivery: "ui",
      input: {},
    }),
    cmd("openPlatform", "Open Platform", "Open the platform services catalog", {
      delivery: "ui",
      input: {},
    }),
    cmd("openPulse", "Open Pulse", "Open the Pulse directory", {
      delivery: "ui",
      input: { moduleId: "string?" },
    }),
    cmd("openMsl", "Open MSL", "Open the MSL capability panel", {
      delivery: "ui",
      input: { tab: "string?" },
    }),
    cmd("openJobs", "Open Jobs", "Open the Jobs panel", { delivery: "ui", input: {} }),
    cmd("openMind", "Open Mind", "Open Mind chat / setup", {
      delivery: "ui",
      input: { page: "string?" },
    }),
    cmd("openFiles", "Open Files", "Open the Files service", {
      delivery: "ui",
      input: { page: "string?", path: "string?" },
    }),
  ],
  events: [
    evt("desktop.focus", "Focus changed", "Desktop / app focus changed", { appId: "string?" }),
  ],
});

writeBootstrapFixed("notifications", {
  profile: {
    tagline: "Bell inbox: alerts, prefs & blocklist",
    icon: "🔔",
    color: "#fbbf24",
  },
  commands: [
    cmd("list", "List notifications", "List inbox items", {
      broker: "notifications",
      channel: "list",
      input: { limit: "number?" },
    }),
    cmd("push", "Push notification", "Add a notification to the inbox", {
      broker: "notifications",
      channel: "push",
      input: { title: "string", body: "string?", source: "string?", level: "string?" },
      emit: "notifications.pushed",
      examples: ["pulse(send notifications push title=Hello body=World)"],
    }),
    cmd("remove", "Remove notification", "Delete one notification", {
      broker: "notifications",
      channel: "remove",
      input: { id: "string" },
    }),
    cmd("clear", "Clear inbox", "Clear all notifications", {
      broker: "notifications",
      channel: "clear",
    }),
    cmd("markRead", "Mark read", "Mark one notification as read", {
      broker: "notifications",
      channel: "markRead",
      input: { id: "string" },
    }),
    cmd("markAllRead", "Mark all read", "Mark every notification as read", {
      broker: "notifications",
      channel: "markAllRead",
    }),
    cmd("prefs", "Get prefs", "Read notification preferences", {
      broker: "notifications",
      channel: "prefs.get",
    }),
    cmd("setPrefs", "Set prefs", "Update notification preferences", {
      broker: "notifications",
      channel: "prefs.set",
      input: { quiet: "boolean?", enabled: "boolean?" },
    }),
    cmd("block", "Block sender", "Add a source to the blocklist", {
      broker: "notifications",
      channel: "blocklist.add",
      input: { source: "string" },
    }),
    cmd("unblock", "Unblock sender", "Remove a source from the blocklist", {
      broker: "notifications",
      channel: "blocklist.remove",
      input: { source: "string" },
    }),
    cmd("open", "Open inbox", "Open the notifications panel", { delivery: "ui", input: {} }),
  ],
  events: [
    evt("notifications.pushed", "Notification pushed", "A new inbox item was added", {
      id: "string?",
      title: "string?",
    }),
    evt("notifications.updated", "Inbox updated", "Notification list changed", {}),
  ],
});

writeBootstrapFixed("jobs", {
  profile: {
    tagline: "OS compute queue: enqueue, cancel & capacity",
    icon: "⚙️",
    color: "#94a3b8",
  },
  commands: [
    cmd("list", "List jobs", "List jobs in the queue", {
      broker: "jobs",
      channel: "jobs.list",
      input: { status: "string?", limit: "number?" },
    }),
    cmd("get", "Get job", "Fetch a job by id", {
      broker: "jobs",
      channel: "jobs.get",
      input: { id: "string" },
    }),
    cmd("enqueue", "Enqueue job", "Add work to the queue", {
      broker: "jobs",
      channel: "jobs.enqueue",
      input: { type: "string?", title: "string?", payload: "object?" },
    }),
    cmd("run", "Run activity", "Run a shell/activity job", {
      broker: "jobs",
      channel: "jobs.run",
      input: { command: "string?", title: "string?" },
    }),
    cmd("cancel", "Cancel job", "Cancel a running or queued job", {
      broker: "jobs",
      channel: "jobs.cancel",
      input: { id: "string" },
    }),
    cmd("retry", "Retry job", "Retry a failed job", {
      broker: "jobs",
      channel: "jobs.retry",
      input: { id: "string" },
    }),
    cmd("clearFinished", "Clear finished", "Remove completed jobs", {
      broker: "jobs",
      channel: "jobs.clearFinished",
    }),
    cmd("stats", "Stats", "Queue statistics snapshot", {
      broker: "jobs",
      channel: "jobs.stats",
    }),
    cmd("capacity", "Get capacity", "Read pool capacity", {
      broker: "jobs",
      channel: "jobs.capacity.get",
    }),
    cmd("setCapacity", "Set capacity", "Update pool capacity", {
      broker: "jobs",
      channel: "jobs.capacity.set",
      input: { pool: "string?", limit: "number?" },
    }),
    cmd("open", "Open Jobs panel", "Open the Jobs UI", { delivery: "ui", input: {} }),
  ],
  events: [evt("jobs.updated", "Jobs updated", "Queue state changed", {})],
});

writeBootstrapFixed("mind", {
  profile: {
    tagline: "OS AI runtime: ask, chat, memory & models",
    icon: "✦",
    color: "#fb7185",
  },
  commands: [
    cmd("status", "Status", "Mind runtime status", { broker: "mind", channel: "mind.status" }),
    cmd("providers", "List providers", "Available AI providers", {
      broker: "mind",
      channel: "mind.providers",
    }),
    cmd("ask", "Ask", "One-shot completion", {
      broker: "mind",
      channel: "mind.ask",
      input: { prompt: "string", provider: "string?" },
      examples: ["pulse(send mind ask prompt=What is Focus mode?)"],
    }),
    cmd("chat", "Chat", "Multi-turn chat", {
      broker: "mind",
      channel: "mind.chat",
      input: { messages: "array?", prompt: "string?", provider: "string?" },
    }),
    cmd("test", "Test provider", "Ping a provider", {
      broker: "mind",
      channel: "mind.test",
      input: { provider: "string?" },
    }),
    cmd("setSettings", "Set settings", "Update Mind settings", {
      broker: "mind",
      channel: "mind.settings.set",
      input: { provider: "string?", model: "string?" },
    }),
    cmd("setKey", "Set API key", "Store a provider API key", {
      broker: "mind",
      channel: "mind.key.set",
      input: { provider: "string?", key: "string" },
    }),
    cmd("clearKey", "Clear API key", "Remove a stored key", {
      broker: "mind",
      channel: "mind.key.clear",
      input: { provider: "string?" },
    }),
    cmd("memoryList", "List memory", "List long-term memory facts", {
      broker: "mind",
      channel: "mind.memory.list",
    }),
    cmd("memoryAdd", "Add memory", "Remember a fact", {
      broker: "mind",
      channel: "mind.memory.add",
      input: { text: "string", tags: "string[]?" },
    }),
    cmd("memoryUpdate", "Update memory", "Edit a memory item", {
      broker: "mind",
      channel: "mind.memory.update",
      input: { id: "string", text: "string?" },
    }),
    cmd("memoryDelete", "Delete memory", "Forget a memory item", {
      broker: "mind",
      channel: "mind.memory.delete",
      input: { id: "string" },
    }),
    cmd("memoryClear", "Clear memory", "Clear all memory", {
      broker: "mind",
      channel: "mind.memory.clear",
    }),
    cmd("open", "Open Mind", "Open Mind UI", {
      delivery: "ui",
      input: { page: "string?" },
    }),
  ],
  events: [evt("mind.updated", "Mind updated", "Mind settings or memory changed", {})],
});

writeBootstrapFixed("shell", {
  profile: {
    tagline: "Command language: run commands & open Console",
    icon: "⌨️",
    color: "#22d3ee",
  },
  commands: [
    cmd("run", "Run command", "Run a My Space shell command on the desktop", {
      delivery: "ui",
      input: { command: "string" },
      examples: ["pulse(send shell run command=msl(list))"],
    }),
    cmd("open", "Open Console", "Open the Shell Console app", {
      delivery: "ui",
      input: { page: "string?" },
    }),
    cmd("openScripts", "Open Scripts", "Open saved Scripts", { delivery: "ui", input: {} }),
    cmd("openAliases", "Open aliases", "Open Console aliases page", {
      delivery: "ui",
      input: {},
    }),
    cmd("openHistory", "Open history", "Open Console history page", {
      delivery: "ui",
      input: {},
    }),
    cmd("openMacros", "Open macros", "Open Console macros page", { delivery: "ui", input: {} }),
    cmd("openWhen", "Open when-rules", "Open Console when-rules page", {
      delivery: "ui",
      input: {},
    }),
  ],
  events: [evt("shell.ran", "Command ran", "A shell command finished", { command: "string?", ok: "boolean?" })],
});

function appProfile(moduleId, profile, commands, events = []) {
  writeApp(moduleId, { profile, commands, events });
}

appProfile(
  "stocks",
  { tagline: "Markets: quotes, watchlist, alerts & portfolio", icon: "📈", color: "#4ade80" },
  [
    cmd("search", "Search symbols", "Search tickers", { channel: "search", input: { q: "string" } }),
    cmd("quote", "Get quote", "Fetch a live quote", { channel: "quote.get", input: { symbol: "string" } }),
    cmd("chart", "Get chart", "Fetch chart data", { channel: "chart.get", input: { symbol: "string", range: "string?" } }),
    cmd("catalog", "Symbol catalog", "Browse symbol catalog", { channel: "symbols.catalog", input: { q: "string?" } }),
    cmd("watchlist", "Watchlist", "Current watchlist", { channel: "market.watchlist" }),
    cmd("watchAdd", "Add to watchlist", "Pin a symbol", { channel: "watchlist.add", input: { symbol: "string" } }),
    cmd("watchRemove", "Remove from watchlist", "Unpin a symbol", { channel: "watchlist.remove", input: { symbol: "string" } }),
    cmd("movers", "Market movers", "Top movers", { channel: "market.movers" }),
    cmd("indices", "Indices", "Major indices", { channel: "market.indices" }),
    cmd("portfolio", "Portfolio", "Get portfolio", { channel: "portfolio.get" }),
    cmd("setPortfolio", "Set portfolio", "Replace portfolio", { channel: "portfolio.set", input: { holdings: "array?" } }),
    cmd("alerts", "List alerts", "Price alerts", { channel: "alerts.list" }),
    cmd("alertAdd", "Add alert", "Create a price alert", { channel: "alerts.add", input: { symbol: "string", price: "number?", direction: "string?" } }),
    cmd("alertRemove", "Remove alert", "Delete an alert", { channel: "alerts.remove", input: { id: "string" } }),
    cmd("alertsCheck", "Check alerts", "Evaluate alerts now", { channel: "alerts.check" }),
    cmd("buylist", "Buy list", "List buy-list items", { channel: "buylist.list" }),
    cmd("analyze", "Analyze", "Generate analysis", { channel: "analysis.generate", input: { symbol: "string" } }),
    cmd("open", "Open Stocks", "Open Stocks UI", { delivery: "ui", input: { symbol: "string?", page: "string?" } }),
  ],
  [evt("stocks.alert", "Alert fired", "A price alert triggered", { symbol: "string", price: "number?" })]
);

appProfile(
  "translate",
  { tagline: "Translate text, detect language & history", icon: "🌐", color: "#38bdf8" },
  [
    cmd("text", "Translate", "Translate text", { channel: "translate.text", input: { text: "string", to: "string", from: "string?" } }),
    cmd("batch", "Batch translate", "Translate many strings", { channel: "translate.batch", input: { texts: "string[]", to: "string", from: "string?" } }),
    cmd("detect", "Detect language", "Detect language of text", { channel: "detect.language", input: { text: "string" } }),
    cmd("languages", "List languages", "Supported languages", { channel: "languages.list" }),
    cmd("historyAdd", "Save to history", "Add a translation to history", { channel: "history.add", input: { text: "string?", translated: "string?", from: "string?", to: "string?" } }),
    cmd("historyDelete", "Delete history item", "Remove one history entry", { channel: "history.delete", input: { id: "string" } }),
    cmd("historyClear", "Clear history", "Clear translation history", { channel: "history.clear" }),
    cmd("favorite", "Toggle favorite", "Favorite a history item", { channel: "history.toggleFavorite", input: { id: "string" } }),
    cmd("speak", "Speak", "Text-to-speech", { channel: "speech.speak", input: { text: "string", lang: "string?" } }),
    cmd("clipboardRead", "Read clipboard", "Read clipboard text", { channel: "clipboard.read" }),
    cmd("clipboardWrite", "Write clipboard", "Write clipboard text", { channel: "clipboard.write", input: { text: "string" } }),
    cmd("export", "Export", "Export data", { channel: "data.export" }),
    cmd("import", "Import", "Import data", { channel: "data.import", input: { json: "string?" } }),
    cmd("open", "Open Translate", "Open Translate UI", { delivery: "ui", input: { text: "string?" } }),
  ]
);

appProfile(
  "world-clock",
  { tagline: "Clocks, timer, pomodoro, stopwatch & focus", icon: "🕐", color: "#fcd34d" },
  [
    cmd("timerStart", "Start timer", "Start a countdown timer", { channel: "timer.start", input: { seconds: "number?", duration: "string?" } }),
    cmd("timerPause", "Pause timer", "Pause the timer", { channel: "timer.pause" }),
    cmd("timerStop", "Stop timer", "Stop the timer", { channel: "timer.stop" }),
    cmd("timerStatus", "Timer status", "Current timer state", { channel: "timer.status" }),
    cmd("pomodoroStart", "Start pomodoro", "Start a pomodoro session", { channel: "pomodoro.start", input: {} }),
    cmd("pomodoroPause", "Pause pomodoro", "Pause pomodoro", { channel: "pomodoro.pause" }),
    cmd("stopwatchStart", "Start stopwatch", "Start stopwatch", { channel: "stopwatch.start" }),
    cmd("focusEnter", "Enter focus", "Enter focus mode", { channel: "focus.enter", input: { minutes: "number?" } }),
    cmd("focusExit", "Exit focus", "Leave focus mode", { channel: "focus.exit" }),
    cmd("calendar", "Open calendar URL", "Open a calendar link", { channel: "calendar.openUrl", input: { url: "string" } }),
    cmd("notify", "Notify", "Show a clock notification", { channel: "notify", input: { title: "string?", body: "string?" } }),
    cmd("open", "Open Clock", "Open Clock UI", { delivery: "ui", input: { page: "string?" } }),
  ]
);

appProfile(
  "day-planner",
  { tagline: "Today’s tasks: add, toggle, snooze & generate", icon: "📅", color: "#fb923c" },
  [
    cmd("list", "List tasks", "List planner tasks", { channel: "tasks.list", input: { day: "string?" } }),
    cmd("add", "Add task", "Create a task", { channel: "task.add", input: { title: "string", due: "string?", notes: "string?" }, emit: "day-planner.taskAdded" }),
    cmd("update", "Update task", "Edit a task", { channel: "task.update", input: { id: "string", title: "string?", due: "string?", notes: "string?" } }),
    cmd("delete", "Delete task", "Remove a task", { channel: "task.delete", input: { id: "string" } }),
    cmd("toggle", "Toggle done", "Mark task done / undone", { channel: "task.toggle", input: { id: "string" } }),
    cmd("snooze", "Snooze task", "Snooze a task", { channel: "task.snooze", input: { id: "string", minutes: "number?" } }),
    cmd("clearDone", "Clear done", "Clear completed tasks", { channel: "tasks.clearDone" }),
    cmd("generate", "Generate tasks", "AI-generate tasks", { channel: "tasks.generate", input: { prompt: "string?" } }),
    cmd("remindersCheck", "Check reminders", "Fire due reminders", { channel: "reminders.check" }),
    cmd("meta", "Meta", "Planner metadata", { channel: "meta" }),
    cmd("open", "Open Today", "Open Day Planner", { delivery: "ui", input: { page: "string?" } }),
  ],
  [evt("day-planner.taskAdded", "Task added", "A task was created", { id: "string?", title: "string?" })]
);

appProfile(
  "geography",
  { tagline: "Countries: list, learn packs & maps", icon: "🌍", color: "#34d399" },
  [
    cmd("list", "List countries", "Search / list countries", { channel: "countries.list", input: { q: "string?" } }),
    cmd("get", "Get country", "Country details by code", { channel: "countries.get", input: { code: "string" } }),
    cmd("wiki", "Country wiki", "Wikipedia summary", { channel: "countries.wiki", input: { code: "string?", title: "string?" } }),
    cmd("learnGet", "Get learn pack", "Fetch a learn pack", { channel: "learn.get", input: { code: "string?" } }),
    cmd("learnBuild", "Build learn pack", "Build learn content", { channel: "learn.build", input: { code: "string?" } }),
    cmd("learnStatus", "Learn status", "Learn pack status", { channel: "learn.status" }),
    cmd("mapsOpen", "Open maps", "Open maps for a place", { channel: "maps.open", input: { q: "string?", code: "string?" } }),
    cmd("linkOpen", "Open link", "Open an external link", { channel: "link.open", input: { url: "string" } }),
    cmd("open", "Open Geography", "Open Geography UI", { delivery: "ui", input: { page: "string?", code: "string?" } }),
  ]
);

appProfile(
  "history",
  { tagline: "Figures & events: search and open entities", icon: "📜", color: "#d6b48c" },
  [
    cmd("figures", "List figures", "Search historical figures", { channel: "figures.list", input: { q: "string?" } }),
    cmd("events", "List events", "Search historical events", { channel: "events.list", input: { q: "string?" } }),
    cmd("get", "Get entity", "Fetch figure or event", { channel: "entity.get", input: { id: "string", type: "string?" } }),
    cmd("cacheStatus", "Cache status", "History cache status", { channel: "cache.status" }),
    cmd("cacheBuild", "Build cache", "Rebuild history cache", { channel: "cache.build" }),
    cmd("linkOpen", "Open link", "Open external link", { channel: "link.open", input: { url: "string" } }),
    cmd("open", "Open History", "Open History UI", { delivery: "ui", input: { page: "string?", id: "string?" } }),
  ]
);

appProfile(
  "space",
  { tagline: "Bodies, NASA, stars & reports", icon: "🌌", color: "#818cf8" },
  [
    cmd("list", "List catalog", "Search space bodies", { channel: "catalog.list", input: { q: "string?" } }),
    cmd("get", "Get body", "Fetch a catalog body", { channel: "catalog.get", input: { id: "string" } }),
    cmd("solar", "Solar system", "Solar system bodies", { channel: "catalog.solar" }),
    cmd("wiki", "Wiki", "Wikipedia for a title", { channel: "wiki.get", input: { title: "string" } }),
    cmd("apod", "APOD today", "Astronomy Picture of the Day", { channel: "apod.today" }),
    cmd("nasaSearch", "NASA image search", "Search NASA images", { channel: "nasa.images.search", input: { q: "string" } }),
    cmd("missions", "List missions", "NASA missions", { channel: "nasa.missions.list", input: { q: "string?" } }),
    cmd("missionGet", "Get mission", "Mission details", { channel: "nasa.missions.get", input: { id: "string" } }),
    cmd("reports", "List reports", "Space reports", { channel: "nasa.reports.list" }),
    cmd("reportGet", "Get report", "Report details", { channel: "nasa.reports.get", input: { id: "string" } }),
    cmd("neo", "Near-Earth objects", "NEO feed", { channel: "nasa.neo.feed" }),
    cmd("mars", "Mars photos", "Mars rover photos", { channel: "nasa.mars.photos", input: { sol: "number?", camera: "string?" } }),
    cmd("stars", "Stars field", "Stars dataset", { channel: "stars.field" }),
    cmd("open", "Open Space", "Open Space UI", { delivery: "ui", input: { page: "string?", id: "string?" } }),
  ]
);

appProfile(
  "builds",
  { tagline: "Projects: create, link folders & scan trees", icon: "🏗️", color: "#f472b6" },
  [
    cmd("list", "List projects", "List builds projects", { channel: "projects.list", input: { q: "string?" } }),
    cmd("get", "Get project", "Project details", { channel: "projects.get", input: { id: "string" } }),
    cmd("create", "Create project", "Create a project", { channel: "projects.create", input: { name: "string", description: "string?" } }),
    cmd("update", "Update project", "Update project fields", { channel: "projects.update", input: { id: "string", name: "string?", description: "string?" } }),
    cmd("delete", "Delete project", "Delete a project", { channel: "projects.delete", input: { id: "string" } }),
    cmd("duplicate", "Duplicate project", "Clone a project", { channel: "projects.duplicate", input: { id: "string" } }),
    cmd("linkFolder", "Link folder", "Attach a folder to a project", { channel: "projects.linkFolder", input: { id: "string", path: "string" } }),
    cmd("rescan", "Rescan project", "Rescan linked folders", { channel: "projects.rescan", input: { id: "string" } }),
    cmd("addLink", "Add link", "Add a URL link", { channel: "projects.addLink", input: { id: "string", url: "string", title: "string?" } }),
    cmd("removeLink", "Remove link", "Remove a URL link", { channel: "projects.removeLink", input: { id: "string", linkId: "string" } }),
    cmd("folderOpen", "Open folder", "Open a folder path", { channel: "folder.open", input: { path: "string" } }),
    cmd("fileOpen", "Open file", "Open a file path", { channel: "file.open", input: { path: "string" } }),
    cmd("treeScan", "Scan tree", "Scan a folder tree", { channel: "tree.scan", input: { path: "string" } }),
    cmd("open", "Open Builds", "Open Builds UI", { delivery: "ui", input: { id: "string?", page: "string?" } }),
  ]
);

appProfile(
  "study-deck",
  { tagline: "Flashcards: decks, cards & grading", icon: "🃏", color: "#c084fc" },
  [
    cmd("list", "List decks", "List study decks", { channel: "decks.list" }),
    cmd("create", "Create deck", "Create a deck", { channel: "deck.create", input: { name: "string", description: "string?" } }),
    cmd("get", "Get deck", "Fetch a deck", { channel: "deck.get", input: { id: "string" } }),
    cmd("update", "Update deck", "Edit a deck", { channel: "deck.update", input: { id: "string", name: "string?" } }),
    cmd("delete", "Delete deck", "Delete a deck", { channel: "deck.delete", input: { id: "string" } }),
    cmd("cardAdd", "Add card", "Add a flashcard", { channel: "card.add", input: { deckId: "string", front: "string", back: "string" } }),
    cmd("cardUpdate", "Update card", "Edit a card", { channel: "card.update", input: { id: "string", front: "string?", back: "string?" } }),
    cmd("cardDelete", "Delete card", "Remove a card", { channel: "card.delete", input: { id: "string" } }),
    cmd("grade", "Grade card", "Record a study grade", { channel: "card.grade", input: { id: "string", grade: "string|number" } }),
    cmd("generate", "Generate cards", "AI-generate cards", { channel: "cards.generate", input: { deckId: "string", prompt: "string?" } }),
    cmd("open", "Open Study Deck", "Open Study Deck UI", { delivery: "ui", input: { page: "string?", id: "string?" } }),
  ]
);

appProfile(
  "contracts",
  { tagline: "Contracts: library, templates & expiry", icon: "⚖️", color: "#a3a3a3" },
  [
    cmd("list", "List contracts", "List contracts", { channel: "contracts.list", input: { q: "string?" } }),
    cmd("get", "Get contract", "Fetch a contract", { channel: "contracts.get", input: { id: "string" } }),
    cmd("save", "Save contract", "Create or update a contract", { channel: "contracts.save", input: { id: "string?", title: "string?", body: "string?" } }),
    cmd("delete", "Delete contract", "Delete a contract", { channel: "contracts.delete", input: { id: "string" } }),
    cmd("templates", "List templates", "Contract templates", { channel: "templates.list" }),
    cmd("templateGet", "Get template", "Fetch a template", { channel: "templates.get", input: { id: "string" } }),
    cmd("expiryCheck", "Check expiry", "Run expiry check", { channel: "expiry.check" }),
    cmd("upcoming", "Upcoming expiry", "Contracts nearing expiry", { channel: "expiry.upcoming" }),
    cmd("open", "Open Contracts", "Open Contracts UI", { delivery: "ui", input: { page: "string?", id: "string?" } }),
  ]
);

appProfile(
  "profiles",
  { tagline: "Vault: secure profiles & passwords", icon: "🔐", color: "#f87171" },
  [
    cmd("list", "List vault", "List vault entries", { channel: "vault.list", input: { q: "string?" } }),
    cmd("get", "Get entry", "Fetch a vault entry", { channel: "vault.get", input: { id: "string" } }),
    cmd("save", "Save entry", "Create or update entry", { channel: "vault.save", input: { id: "string?", title: "string?", username: "string?", password: "string?" } }),
    cmd("delete", "Delete entry", "Delete a vault entry", { channel: "vault.delete", input: { id: "string" } }),
    cmd("unlock", "Unlock vault", "Unlock the vault", { channel: "vault.unlock", input: { password: "string" } }),
    cmd("lock", "Lock vault", "Lock the vault", { channel: "vault.lock" }),
    cmd("status", "Vault status", "Locked / unlocked status", { channel: "vault.status" }),
    cmd("copyPassword", "Copy password", "Copy entry password", { channel: "vault.copyPassword", input: { id: "string" } }),
    cmd("clipboard", "Copy text", "Copy arbitrary text", { channel: "clipboard.copy", input: { text: "string" } }),
    cmd("export", "Export", "Export vault data", { channel: "data.export" }),
    cmd("import", "Import", "Import vault data", { channel: "data.import", input: { json: "string?" } }),
    cmd("open", "Open Profiles", "Open Profiles UI", { delivery: "ui", input: { page: "string?", id: "string?" } }),
  ]
);

appProfile(
  "coupons",
  { tagline: "Coupons & codes: save, redeem & copy", icon: "🎟️", color: "#f472b6" },
  [
    cmd("list", "List coupons", "List coupons", { channel: "coupons.list", input: { q: "string?" } }),
    cmd("get", "Get coupon", "Fetch a coupon", { channel: "coupons.get", input: { id: "string" } }),
    cmd("save", "Save coupon", "Create or update", { channel: "coupons.save", input: { id: "string?", title: "string?", code: "string?" } }),
    cmd("delete", "Delete coupon", "Delete a coupon", { channel: "coupons.delete", input: { id: "string" } }),
    cmd("redeem", "Redeem", "Mark redeemed", { channel: "coupons.redeem", input: { id: "string" } }),
    cmd("copyCode", "Copy code", "Copy coupon code", { channel: "coupons.copyCode", input: { id: "string" } }),
    cmd("copyPin", "Copy PIN", "Copy coupon PIN", { channel: "coupons.copyPin", input: { id: "string" } }),
    cmd("unlock", "Unlock", "Unlock coupons store", { channel: "coupons.unlock", input: { password: "string?" } }),
    cmd("lock", "Lock", "Lock coupons store", { channel: "coupons.lock" }),
    cmd("expiryCheck", "Expiry check", "Check expiring coupons", { channel: "coupons.expiry.check" }),
    cmd("status", "Status", "Coupons status", { channel: "coupons.status" }),
    cmd("open", "Open Coupons", "Open Coupons UI", { delivery: "ui", input: { id: "string?" } }),
  ]
);

appProfile(
  "chat",
  { tagline: "AI chat threads: send, modes & memory", icon: "✦", color: "#fb7185" },
  [
    cmd("list", "List chats", "List chat threads", { channel: "chat.list" }),
    cmd("get", "Get chat", "Fetch a thread", { channel: "chat.get", input: { id: "string" } }),
    cmd("create", "Create chat", "Start a new thread", { channel: "chat.create", input: { title: "string?", mode: "string?" } }),
    cmd("delete", "Delete chat", "Delete a thread", { channel: "chat.delete", input: { id: "string" } }),
    cmd("rename", "Rename chat", "Rename a thread", { channel: "chat.rename", input: { id: "string", title: "string" } }),
    cmd("pin", "Pin chat", "Pin / unpin a thread", { channel: "chat.pin", input: { id: "string", pinned: "boolean?" } }),
    cmd("clear", "Clear chat", "Clear messages in a thread", { channel: "chat.clear", input: { id: "string" } }),
    cmd("send", "Send message", "Send a chat message", { channel: "chat.send", input: { id: "string?", text: "string", mode: "string?" } }),
    cmd("regenerate", "Regenerate", "Regenerate last reply", { channel: "chat.regenerate", input: { id: "string" } }),
    cmd("modes", "List modes", "Available chat modes", { channel: "chat.modes.list" }),
    cmd("setMode", "Set mode", "Set active mode", { channel: "chat.mode.set", input: { mode: "string" } }),
    cmd("memoryList", "List memory", "Chat memory facts", { channel: "chat.memory.list" }),
    cmd("memoryAdd", "Add memory", "Add a memory fact", { channel: "chat.memory.add", input: { text: "string" } }),
    cmd("open", "Open Chat", "Open Chat UI", { delivery: "ui", input: { id: "string?" } }),
  ]
);

appProfile(
  "mail",
  { tagline: "Mail & Connect hub: sync, accounts & messages", icon: "✉️", color: "#60a5fa" },
  [
    cmd("messages", "List messages", "List mail messages", { channel: "messages.list", input: { accountId: "string?", q: "string?" } }),
    cmd("get", "Get message", "Fetch a message", { channel: "messages.get", input: { id: "string", accountId: "string?" } }),
    cmd("labels", "List labels", "Mailbox labels", { channel: "labels.list", input: { accountId: "string?" } }),
    cmd("sync", "Sync now", "Trigger mail sync", { channel: "sync.now" }),
    cmd("accounts", "List accounts", "Connected accounts", { channel: "accounts.list" }),
    cmd("connect", "Connect account", "Start account connect", { channel: "accounts.connect", input: { provider: "string?" } }),
    cmd("disconnect", "Disconnect account", "Disconnect an account", { channel: "accounts.disconnect", input: { id: "string" } }),
    cmd("hub", "Hub catalog", "Connect hub services", { channel: "hub.catalog" }),
    cmd("hubList", "Hub list", "Connected hub apps", { channel: "hub.list" }),
    cmd("hubOpen", "Hub open", "Open a hub service", { channel: "hub.open", input: { id: "string" } }),
    cmd("status", "Status", "Mail status", { channel: "status" }),
    cmd("open", "Open Mail", "Open Mail / Connect", { delivery: "ui", input: { page: "string?" } }),
  ]
);

appProfile(
  "scripts",
  { tagline: "Saved multi-step shell programs", icon: "📜", color: "#22d3ee" },
  [
    cmd("list", "List scripts", "List saved scripts", { channel: "scripts.list", input: { q: "string?" } }),
    cmd("get", "Get script", "Fetch a script", { channel: "scripts.get", input: { id: "string" } }),
    cmd("create", "Create script", "Create a script", { channel: "scripts.create", input: { name: "string", body: "string?" } }),
    cmd("update", "Update script", "Update a script", { channel: "scripts.update", input: { id: "string", name: "string?", body: "string?" } }),
    cmd("delete", "Delete script", "Delete a script", { channel: "scripts.delete", input: { id: "string" } }),
    cmd("duplicate", "Duplicate script", "Clone a script", { channel: "scripts.duplicate", input: { id: "string" } }),
    cmd("run", "Run script", "Execute a script", { channel: "scripts.run", input: { id: "string" } }),
    cmd("parse", "Parse script", "Parse / validate a script", { channel: "scripts.parse", input: { body: "string" } }),
    cmd("open", "Open Scripts", "Open Scripts UI", { delivery: "ui", input: { id: "string?" } }),
  ]
);

appProfile(
  "shell-console",
  { tagline: "Console engine: history, aliases, macros & when", icon: "⌨️", color: "#67e8f9" },
  [
    cmd("run", "Run command", "Run via console engine", { channel: "command.run", input: { command: "string" } }),
    cmd("history", "History", "Command history", { channel: "history.list", input: { limit: "number?" } }),
    cmd("historyAdd", "Add history", "Append history entry", { channel: "history.add", input: { command: "string" } }),
    cmd("historyClear", "Clear history", "Clear history", { channel: "history.clear" }),
    cmd("aliases", "List aliases", "Shell aliases", { channel: "aliases.list" }),
    cmd("aliasSet", "Set alias", "Create/update alias", { channel: "aliases.set", input: { name: "string", value: "string" } }),
    cmd("aliasRemove", "Remove alias", "Delete alias", { channel: "aliases.remove", input: { name: "string" } }),
    cmd("macros", "List macros", "Saved macros", { channel: "macros.list" }),
    cmd("macroSet", "Set macro", "Create/update macro", { channel: "macros.set", input: { name: "string", body: "string" } }),
    cmd("macroRemove", "Remove macro", "Delete macro", { channel: "macros.remove", input: { name: "string" } }),
    cmd("whenList", "List when-rules", "Automation rules", { channel: "when.list" }),
    cmd("whenAdd", "Add when-rule", "Create a when-rule", { channel: "when.add", input: { trigger: "string?", action: "string?" } }),
    cmd("export", "Export", "Export console data", { channel: "data.export" }),
    cmd("import", "Import", "Import console data", { channel: "data.import", input: { json: "string?" } }),
    cmd("open", "Open Console", "Open Console UI", { delivery: "ui", input: { page: "string?" } }),
  ]
);

appProfile(
  "os-bridge",
  { tagline: "Phone pairing, host places & share", icon: "🔗", color: "#94a3b8" },
  [
    cmd("places", "List places", "Host folder places", { channel: "places.list" }),
    cmd("placesAdd", "Add place", "Add a host place", { channel: "places.add", input: { path: "string", label: "string?" } }),
    cmd("placesOpen", "Open place", "Open a place", { channel: "places.open", input: { id: "string?" , path: "string?" } }),
    cmd("placesReveal", "Reveal place", "Reveal in Explorer", { channel: "places.reveal", input: { path: "string" } }),
    cmd("pairStart", "Start pairing", "Start phone pair server", { channel: "pair.start" }),
    cmd("pairStop", "Stop pairing", "Stop pair server", { channel: "pair.stop" }),
    cmd("pairSend", "Send file to phone", "Send a file", { channel: "pair.sendFile", input: { path: "string" } }),
    cmd("clipboardToPhone", "Clipboard to phone", "Send clipboard to phone", { channel: "clipboard.sendToPhone" }),
    cmd("clipboardRead", "Read clipboard", "Read host clipboard", { channel: "clipboard.read" }),
    cmd("clipboardWrite", "Write clipboard", "Write host clipboard", { channel: "clipboard.write", input: { text: "string" } }),
    cmd("inbox", "Inbox list", "Phone upload inbox", { channel: "inbox.list" }),
    cmd("outbox", "Outbox list", "Outgoing files", { channel: "outbox.list" }),
    cmd("drives", "List drives", "Host drives", { channel: "drives.list" }),
    cmd("hostOpen", "Host open", "Open a Windows settings / host action", { channel: "host.open", input: { action: "string" } }),
    cmd("open", "Open Bridge", "Open OS Bridge UI", { delivery: "ui", input: { page: "string?" } }),
  ]
);

appProfile(
  "drift",
  { tagline: "What changed: zones, scans & insights", icon: "📈", color: "#86efac" },
  [
    cmd("zones", "List zones", "Watched zones", { channel: "zones.list" }),
    cmd("zoneAdd", "Add zone", "Watch a folder", { channel: "zones.add", input: { path: "string", label: "string?" } }),
    cmd("zoneRemove", "Remove zone", "Stop watching", { channel: "zones.remove", input: { id: "string" } }),
    cmd("zoneToggle", "Toggle zone", "Enable/disable a zone", { channel: "zones.toggle", input: { id: "string" } }),
    cmd("scan", "Run scan", "Scan for changes", { channel: "scan.run", input: { zoneId: "string?" } }),
    cmd("events", "List events", "Change events", { channel: "events.list", input: { limit: "number?" } }),
    cmd("eventsClear", "Clear events", "Clear event log", { channel: "events.clear" }),
    cmd("insights", "Insights", "Drift insights", { channel: "insights.get" }),
    cmd("folderOpen", "Open folder", "Open a folder", { channel: "folder.open", input: { path: "string" } }),
    cmd("folderReveal", "Reveal folder", "Reveal in Explorer", { channel: "folder.reveal", input: { path: "string" } }),
    cmd("open", "Open Drift", "Open Drift UI", { delivery: "ui", input: {} }),
  ]
);

appProfile(
  "code-lexicon",
  { tagline: "Code terms: search, daily & related", icon: "📖", color: "#a5b4fc" },
  [
    cmd("list", "List terms", "List lexicon terms", { channel: "terms.list", input: { category: "string?" } }),
    cmd("search", "Search terms", "Search the lexicon", { channel: "terms.search", input: { q: "string" } }),
    cmd("get", "Get term", "Fetch a term", { channel: "terms.get", input: { id: "string?", slug: "string?" } }),
    cmd("related", "Related terms", "Related terms", { channel: "terms.related", input: { id: "string" } }),
    cmd("daily", "Daily term", "Term of the day", { channel: "terms.daily" }),
    cmd("categories", "Categories", "List categories", { channel: "categories.list" }),
    cmd("stats", "Stats", "Lexicon stats", { channel: "stats.get" }),
    cmd("linkOpen", "Open link", "Open external link", { channel: "link.open", input: { url: "string" } }),
    cmd("open", "Open Lexicon", "Open Code Lexicon UI", { delivery: "ui", input: { id: "string?" } }),
  ]
);

appProfile(
  "model-flow",
  { tagline: "AI tool flows: plan, approve & run", icon: "✦", color: "#f9a8d4" },
  [
    cmd("meta", "Meta", "Flow metadata", { channel: "flow.meta" }),
    cmd("tools", "List tools", "Available tools", { channel: "flow.tools" }),
    cmd("plan", "Plan flow", "Ask AI to plan a flow", { channel: "flow.plan", input: { prompt: "string" } }),
    cmd("normalize", "Normalize flow", "Normalize a flow draft", { channel: "flow.normalize", input: { flow: "object?" } }),
    cmd("run", "Run flow", "Execute an approved flow", { channel: "flow.run", input: { flow: "object?", id: "string?" } }),
    cmd("blank", "Blank flow", "Create a blank flow", { channel: "flow.blank" }),
    cmd("saveAsScript", "Save as script", "Export flow as script", { channel: "flow.saveAsScript", input: { flow: "object?", name: "string?" } }),
    cmd("library", "Library list", "Saved flows", { channel: "flow.library.list" }),
    cmd("libraryGet", "Library get", "Fetch saved flow", { channel: "flow.library.get", input: { id: "string" } }),
    cmd("librarySave", "Library save", "Save flow to library", { channel: "flow.library.save", input: { name: "string", flow: "object?" } }),
    cmd("libraryDelete", "Library delete", "Delete saved flow", { channel: "flow.library.delete", input: { id: "string" } }),
    cmd("history", "History", "Past runs", { channel: "flow.history" }),
    cmd("historyGet", "History get", "Fetch a run", { channel: "flow.history.get", input: { id: "string" } }),
    cmd("open", "Open Flow", "Open Model Flow UI", { delivery: "ui", input: { page: "string?" } }),
  ]
);

appProfile(
  "docs",
  { tagline: "My Space handbook: open docs pages", icon: "📖", color: "#cbd5e1" },
  [
    cmd("openPage", "Open page", "Open a docs page by id", { channel: "page.open", input: { id: "string" } }),
    cmd("bookmark", "Toggle bookmark", "Bookmark a docs page", { channel: "bookmarks.toggle", input: { id: "string" } }),
    cmd("meta", "Meta", "Docs metadata", { channel: "meta" }),
    cmd("open", "Open Docs", "Open Docs UI", { delivery: "ui", input: { page: "string?" } }),
  ]
);

appProfile(
  "remote-hub",
  { tagline: "Remote machines: connect, wake & scan", icon: "🖥️", color: "#7dd3fc" },
  [
    cmd("connect", "Connect", "Connect to a machine", { channel: "connect", input: { id: "string?", host: "string?", mode: "string?" } }),
    cmd("wake", "Wake-on-LAN", "Send WoL packet", { channel: "wol.wake", input: { id: "string?", mac: "string?" } }),
    cmd("scan", "Network scan", "Scan the LAN", { channel: "network.scan" }),
    cmd("check", "Check machines", "Probe saved machines", { channel: "machines.check" }),
    cmd("export", "Export machines", "Export machine list", { channel: "machines.export" }),
    cmd("import", "Import machines", "Import machine list", { channel: "machines.import", input: { json: "string?" } }),
    cmd("agentProbe", "Agent probe", "Probe remote agent", { channel: "agent.probe", input: { host: "string?" } }),
    cmd("screenCapture", "Screen capture", "Capture remote screen", { channel: "screen.capture", input: { host: "string?" } }),
    cmd("tailscale", "Tailscale status", "Tailscale status", { channel: "tailscale.status" }),
    cmd("clipboard", "Copy text", "Copy to clipboard", { channel: "clipboard.copy", input: { text: "string" } }),
    cmd("open", "Open Remote Hub", "Open Remote Hub UI", { delivery: "ui", input: { page: "string?" } }),
  ]
);

appProfile(
  "studies",
  { tagline: "Study docs: export & Gemini helpers", icon: "📚", color: "#c4b5fd" },
  [
    cmd("exportFile", "Export file", "Export a study document", { channel: "export.file", input: { id: "string?", format: "string?" } }),
    cmd("exportPdf", "Export PDF", "Export as PDF", { channel: "export.pdf", input: { id: "string?" } }),
    cmd("exportDocx", "Export DOCX", "Export as Word", { channel: "export.docx", input: { id: "string?" } }),
    cmd("gemini", "Gemini generate", "Generate with Gemini", { channel: "gemini-generate", input: { prompt: "string" } }),
    cmd("geminiChat", "Gemini chat", "Chat with Gemini", { channel: "gemini-chat", input: { messages: "array?", prompt: "string?" } }),
    cmd("fillSlots", "Fill slots", "Fill template slots", { channel: "gemini-fill-slots", input: { template: "string?", prompt: "string?" } }),
    cmd("factCheck", "Fact check", "Fact-check text", { channel: "gemini-fact-check", input: { text: "string" } }),
    cmd("open", "Open Studies", "Open Studies UI", { delivery: "ui", input: { page: "string?", id: "string?" } }),
  ]
);

appProfile(
  "world-maps",
  { tagline: "Maps: geocode, notes, routes & sync", icon: "🗺️", color: "#4ade80" },
  [
    cmd("geocode", "Geocode", "Forward geocode a query", { channel: "geocode", input: { q: "string" } }),
    cmd("reverse", "Reverse geocode", "Reverse geocode coordinates", { channel: "reverse-geocode", input: { lat: "number", lon: "number" } }),
    cmd("reverseCountry", "Reverse country", "Country for coordinates", { channel: "reverse-geocode-country", input: { lat: "number", lon: "number" } }),
    cmd("notesLoad", "Load map notes", "Load saved map notes", { channel: "notes-load" }),
    cmd("notesSave", "Save map notes", "Save map notes", { channel: "notes-save-all", input: { notes: "array?" } }),
    cmd("routesLoad", "Load routes", "Load saved routes", { channel: "routes-load" }),
    cmd("routesSave", "Save routes", "Save routes", { channel: "routes-save-all", input: { routes: "array?" } }),
    cmd("settings", "Load settings", "Map settings", { channel: "settings-load" }),
    cmd("syncStatus", "Sync status", "Cloud/folder sync status", { channel: "sync-status" }),
    cmd("authStatus", "Auth status", "Login status", { channel: "auth-status" }),
    cmd("open", "Open Maps", "Open World Maps UI", { delivery: "ui", input: {} }),
  ]
);

appProfile(
  "system-info",
  { tagline: "Ports, processes, CPU, memory & disk", icon: "📊", color: "#94a3b8" },
  [
    cmd("system", "System scan", "Machine overview", { channel: "system.scan" }),
    cmd("cpu", "CPU scan", "CPU info & load", { channel: "cpu.scan" }),
    cmd("memory", "Memory scan", "RAM usage", { channel: "memory.scan" }),
    cmd("storage", "Storage scan", "Disk volumes", { channel: "storage.scan" }),
    cmd("network", "Network scan", "Network interfaces", { channel: "network.scan" }),
    cmd("ports", "Ports scan", "Listening ports", { channel: "ports.scan" }),
    cmd("processes", "Processes scan", "Running processes", { channel: "processes.scan" }),
    cmd("environment", "Environment", "Env variables summary", { channel: "environment.scan" }),
    cmd("diskRoots", "Disk roots", "List disk roots", { channel: "disk.roots" }),
    cmd("diskScan", "Disk tree scan", "Scan a folder tree", { channel: "disk.scan", input: { path: "string?" } }),
    cmd("diskLarge", "Large files", "Find large files", { channel: "disk.largeFiles", input: { path: "string?" } }),
    cmd("diskCancel", "Cancel disk scan", "Cancel an in-flight disk scan", { channel: "disk.cancel" }),
    cmd("metricsSample", "Sample metrics", "Take a live metrics sample", { channel: "metrics.sample" }),
    cmd("metricsHistory", "Metrics history", "Recent metrics samples", { channel: "metrics.history" }),
    cmd("metricsClear", "Clear metrics", "Clear metrics history", { channel: "metrics.clear" }),
    cmd("open", "Open System Info", "Open System Info panel", {
      delivery: "ui",
      input: { page: "string?" },
      examples: ["pulse(send system-info open page=ports)"],
    }),
  ]
);

appProfile(
  "apps-info",
  { tagline: "App catalog: logos, profiles & activity", icon: "ℹ️", color: "#93c5fd" },
  [
    cmd("list", "List catalog", "List all apps in the Info catalog", {
      channel: "catalog.list",
      examples: ["pulse(send apps-info list)"],
    }),
    cmd("detail", "App detail", "Full record for one app", {
      channel: "catalog.detail",
      input: { id: "string" },
      examples: ["pulse(send apps-info detail id=notes)"],
    }),
    cmd("open", "Open Info", "Open the Info app", { delivery: "ui", input: { id: "string?" } }),
    cmd("openApp", "Open app detail", "Open Info focused on an app", {
      delivery: "ui",
      input: { id: "string" },
    }),
  ]
);

appProfile(
  "flag-quiz",
  { tagline: "Flag quiz: scores & practice screen", icon: "🚩", color: "#fca5a5" },
  [
    cmd("scores", "List scores", "High scores", { channel: "scores.list" }),
    cmd("scoreAdd", "Add score", "Record a score", {
      channel: "scores.add",
      input: { score: "number?", name: "string?" },
    }),
    cmd("scoresClear", "Clear scores", "Reset the scoreboard", { channel: "scores.clear" }),
    cmd("screenPublish", "Publish screen", "Publish current quiz screen state", {
      channel: "screen.publish",
      input: { state: "object?" },
    }),
    cmd("screenGet", "Get screen", "Read published screen state", { channel: "screen.get" }),
    cmd("meta", "Meta", "Quiz metadata", { channel: "meta" }),
    cmd("open", "Open Flag Quiz", "Open Flag Quiz", { delivery: "ui", input: { page: "string?" } }),
    cmd("openPractice", "Open practice", "Open practice mode", { delivery: "ui", input: {} }),
    cmd("openScores", "Open scores", "Open scores screen", { delivery: "ui", input: {} }),
  ]
);

appProfile(
  "pi-digits",
  { tagline: "π digits: progress & practice", icon: "π", color: "#c4b5fd" },
  [
    cmd("progress", "Get progress", "Current π memorization progress", { channel: "progress.get" }),
    cmd("progressSave", "Save progress", "Save digit progress", {
      channel: "progress.save",
      input: { digits: "number?", index: "number?" },
    }),
    cmd("progressReset", "Reset progress", "Reset progress", { channel: "progress.reset" }),
    cmd("screenPublish", "Publish screen", "Publish practice screen", {
      channel: "screen.publish",
      input: { state: "object?" },
    }),
    cmd("screenGet", "Get screen", "Read screen state", { channel: "screen.get" }),
    cmd("meta", "Meta", "π Digits metadata", { channel: "meta" }),
    cmd("open", "Open π Digits", "Open π Digits", { delivery: "ui", input: { page: "string?" } }),
    cmd("openPractice", "Open practice", "Open practice mode", { delivery: "ui", input: {} }),
  ]
);

appProfile(
  "icon-library",
  { tagline: "Icons: browse, favorites & recent", icon: "🎨", color: "#f9a8d4" },
  [
    cmd("state", "Library state", "Favorites, recent & filters", { channel: "library.getState" }),
    cmd("favoritesSet", "Set favorites", "Update favorite icons", {
      channel: "favorites.set",
      input: { ids: "array?" },
    }),
    cmd("recentAdd", "Add recent", "Mark an icon as recent", {
      channel: "recent.add",
      input: { id: "string" },
    }),
    cmd("screenPublish", "Publish screen", "Publish library screen", {
      channel: "screen.publish",
      input: { state: "object?" },
    }),
    cmd("screenGet", "Get screen", "Read screen state", { channel: "screen.get" }),
    cmd("open", "Open Icon Library", "Open Icon Library", { delivery: "ui", input: { page: "string?" } }),
    cmd("openFavorites", "Open favorites", "Open favorites view", { delivery: "ui", input: {} }),
    cmd("openRecent", "Open recent", "Open recent icons", { delivery: "ui", input: {} }),
  ]
);

writeBootstrapFixed("msl", {
  profile: {
    tagline: "My Space Link: capabilities, keys & inject",
    icon: "🔗",
    color: "#a78bfa",
  },
  commands: [
    cmd("list", "List capabilities", "Browse MSL capabilities", {
      channel: "msl.list",
      broker: "msl",
      examples: ["pulse(send msl list)"],
    }),
    cmd("invoke", "Invoke capability", "Call an MSL capability", {
      channel: "msl.invoke",
      broker: "msl",
      input: { uri: "string?", id: "string?", args: "object?" },
      examples: ["pulse(send msl invoke uri=msl:v1/…)"],
    }),
    cmd("keyParse", "Parse key", "Parse an msl:v1 key URI", {
      channel: "msl.key.parse",
      broker: "msl",
      input: { uri: "string" },
    }),
    cmd("keyBuild", "Build key", "Build an msl:v1 key URI", {
      channel: "msl.key.build",
      broker: "msl",
      input: { capability: "string?", args: "object?" },
    }),
    cmd("keyResolve", "Resolve key", "Resolve a key to a capability call", {
      channel: "msl.key.resolve",
      broker: "msl",
      input: { uri: "string" },
    }),
    cmd("keysList", "List keys", "Saved / minted keys", { channel: "msl.keys.list", broker: "msl" }),
    cmd("keysSave", "Save key", "Persist a minted key", {
      channel: "msl.keys.save",
      broker: "msl",
      input: { uri: "string", label: "string?" },
    }),
    cmd("keysDelete", "Delete key", "Remove a saved key", {
      channel: "msl.keys.delete",
      broker: "msl",
      input: { id: "string?" , uri: "string?" },
    }),
    cmd("injectList", "List injects", "Injected key wirings", { channel: "msl.inject.list", broker: "msl" }),
    cmd("injectSet", "Set inject", "Wire a key into a target", {
      channel: "msl.inject.set",
      broker: "msl",
      input: { target: "string", uri: "string" },
    }),
    cmd("injectRemove", "Remove inject", "Remove an inject", {
      channel: "msl.inject.remove",
      broker: "msl",
      input: { target: "string?" , id: "string?" },
    }),
    cmd("injectClear", "Clear injects", "Clear all injects", { channel: "msl.inject.clear", broker: "msl" }),
    cmd("injectTargets", "Inject targets", "List inject targets", {
      channel: "msl.inject.targets",
      broker: "msl",
    }),
    cmd("open", "Open MSL", "Open the MSL panel", {
      delivery: "ui",
      input: { tab: "string?" },
      examples: ["pulse(send msl open tab=keys)"],
    }),
    cmd("openCaps", "Open capabilities", "MSL capabilities tab", { delivery: "ui", input: {} }),
    cmd("openKeys", "Open keys", "MSL keys tab", { delivery: "ui", input: {} }),
    cmd("openMint", "Open mint", "MSL mint tab", { delivery: "ui", input: {} }),
    cmd("openInject", "Open inject", "MSL inject tab", { delivery: "ui", input: {} }),
  ],
  events: [
    evt("msl.invoked", "Capability invoked", "Fired after an MSL invoke", { uri: "string", ok: "boolean" }),
    evt("msl.key.saved", "Key saved", "A key was minted/saved", { uri: "string" }),
  ],
});

writeBootstrapFixed("browser", {
  profile: {
    tagline: "In-app browsing: home & web tabs",
    icon: "🌐",
    color: "#4ade80",
  },
  commands: [
    cmd("open", "Open Browser", "Open My Space Browser", {
      delivery: "ui",
      input: { url: "string?" },
      examples: ["pulse(send browser open)"],
    }),
    cmd("openHome", "Open home", "Browser home", { delivery: "ui", input: {} }),
    cmd("openWeb", "Open web tab", "Open a new in-app web tab", {
      delivery: "ui",
      input: { url: "string?" },
      examples: ["pulse(send browser openWeb url=https://example.com)"],
    }),
    cmd("navigate", "Navigate", "Open Browser at a URL", {
      delivery: "ui",
      input: { url: "string" },
    }),
  ],
});

writeBootstrapFixed("connect", {
  profile: {
    tagline: "Service catalog: mail, messaging & more",
    icon: "🧩",
    color: "#4ade80",
  },
  commands: [
    cmd("open", "Open Connect", "Open the Connect catalog", {
      delivery: "ui",
      input: {},
      examples: ["pulse(send connect open)"],
    }),
    cmd("openCatalog", "Open catalog", "All Connect services", { delivery: "ui", input: {} }),
    cmd("openBrowser", "Open My Space Browser", "Connect → Browser", { delivery: "ui", input: {} }),
    cmd("openMail", "Open mail", "Jump to mail from Connect", { delivery: "ui", input: {} }),
  ],
});

writeBootstrapFixed("search", {
  profile: {
    tagline: "System-wide find & command palette",
    icon: "🔍",
    color: "#e2e8f0",
  },
  commands: [
    cmd("open", "Open Search", "Open the command palette", {
      delivery: "ui",
      input: { q: "string?" },
      examples: ["pulse(send search open)"],
    }),
    cmd("query", "Search query", "Open palette with a query", {
      delivery: "ui",
      input: { q: "string" },
    }),
  ],
});

writeBootstrapFixed("os", {
  profile: {
    tagline: "Desktop, settings & shell surfaces",
    icon: "🖥️",
    color: "#e2e8f0",
  },
  commands: [
    cmd("showDesktop", "Show desktop", "Minimize / show desktop", { delivery: "ui", input: {} }),
    cmd("openSettings", "Open settings", "Space settings", { delivery: "ui", input: {} }),
    cmd("openPlatform", "Open Platform", "Platform services catalog", { delivery: "ui", input: {} }),
    cmd("openSearch", "Open search", "Command palette", { delivery: "ui", input: {} }),
    cmd("openNotifications", "Open notifications", "Bell inbox", { delivery: "ui", input: {} }),
    cmd("launch", "Launch app", "Launch an app by id", {
      delivery: "ui",
      input: { appId: "string", page: "string?" },
    }),
    cmd("toast", "Toast", "Show a desktop toast", {
      delivery: "ui",
      input: { message: "string" },
    }),
    cmd("open", "Open OS surfaces", "Open settings or desktop", {
      delivery: "ui",
      input: { page: "string?" },
    }),
  ],
});

console.log("\nDone. Profiles generated.");