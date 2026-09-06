(function () {
  const { P, h2, p, note, tip, warn, code, ul, ol, table, kicker } = window.DocsBlocks;

  const PAGES = {};

  function add(page) {
    PAGES[page.id] = page;
  }
  add(
    P("overview", "What is My Space?", "A personal desktop OS layered on your desktop OS", ["intro", "architecture"], [
      kicker("Start"),
      p(
        "My Space is not another launcher icon tray. It is a personal operating layer that sits on top of your desktop OS: a curated desktop of apps, a command shell with its own grammar, automation (aliases, macros, when-rules, scripts), and a cross-app protocol (My Space Link) so capabilities can move between tools without copy-paste gymnastics."
      ),
      p(
        "You use it the way you use a small OS: open surfaces, run short commands, chain work into macros, and keep day-to-day state (tasks, vault, contacts, projects) close to the glass."
      ),
      note(
        "Packaging: My Space ships as Electron builds for Windows, macOS, and Linux. UI/commands are designed to behave the same across platforms, but some deep OS features (like window embedding) are Windows-only."
      ),
      h2("Recommended reading order (newcomers)"),
      ol([
        "how-to-read-docs: how this handbook is structured.",
        "mental-model: open vs read vs mutate; silence; fuzzy names.",
        "quick-start: half an hour of hands-on commands.",
        "desktop: pins, focus, close, layout.",
        "shell-language → shell-chaining → cmd-protocol: My Space Language.",
        "apps-directory: pick any app-* page and go deep.",
        "aliases-macros + recipes: turn habits into one-liners.",
        "msl + silent-actions: how apps talk without stealing focus.",
        "command-index: jump table when you already know the app name.",
        "settings-complete · msl-capabilities · architecture: exhaustive reference.",
      ]),
      h2("The four pillars"),
      table(
        ["Pillar", "What you get", "Where it lives"],
        [
          ["Desktop", "Pins, layout, focus, wallpaper, empty-space command line", "Main My Space window"],
          ["Apps", "First-party myapps (incl. Connect hub) + external tools (Edge, VS Code, Cursor…)", "apps/ + config/apps.json"],
          ["My Space Language", "Orchestration: grammar + module(…) operations; Scripts = runtime; Shell = atlas", "Desktop line · Scripts · Platform → Shell"],
          ["Links (MSL)", "Publish and call capabilities across apps (My Space Link — not the Language)", "MSL panel + per-app settings"],
        ]
      ),
      h2("What “first-party” means"),
      p(
        "A myapp is a folder under apps/<module> with an index.html, optional preload.js, and usually a main/apps/<module>-ipc.js backend. The shell knows many of them through ROUTE_REGISTRY: pages, aliases, deep links, and — when commands: true — the unified app(verb args) protocol."
      ),
      h2("What My Space is not"),
      ul([
        "Not a replacement for Windows Explorer or the full Task Manager (System Info covers a focused slice).",
        "Not a cloud suite: data stays in Electron userData on this PC unless you export it.",
        "Not a free-form chatbot OS: Model Flow and Gemini-assisted apps are opt-in helpers, not the core loop.",
      ]),
      tip("Open Docs anytime: docs · docs(overview) · docs(search timer)"),
      note("This handbook mirrors the live shell. After Restart & Update, new verbs appear here and in help <app>."),
    ])
  );

  add(
    P("mental-model", "Mental model", "How to think about the system before memorizing commands", ["intro", "concepts"], [
      kicker("Start"),
      p(
        "Most confusion comes from mixing three different intents: open a surface, read data, or change data. My Space separates them on purpose."
      ),
      h2("Three intents"),
      table(
        ["Intent", "Typical form", "Window behavior"],
        [
          ["Navigate / open", "run builds · space(ocean) · today(tomorrow)", "Opens or focuses UI"],
          ["Read / inspect", "stocks(quote AAPL) · geo(get IL) · sys(cpu)", "Silent message (unless already open → quiet refresh)"],
          ["Mutate", "today(add …) · vault(copy …) · decks(new …)", "Silent; syncIfOpen if window exists"],
        ]
      ),
      h2("Names resolve fuzzily"),
      p(
        "App references accept aliases and partial names: clock → world-clock, geo → geography, Pi digit → Pi Digits. Quotes help with spaces: run \"vs code\"."
      ),
      h2("Classic routes vs command protocol"),
      ul([
        "Classic: run geography(country:IL) — key:value deep links into UI.",
        "Protocol: geo: verb-first, often silent, designed for scripts.",
        "Both coexist. Prefer protocol for automation; classic for precise UI deep-links.",
      ]),
      h2("Trust boundaries"),
      warn(
        "Vault never accepts a master password from the shell. Unlock in the Vault window first. MSL providers can be rolled back per app in Settings."
      ),
      tip("When stuck: help <app> · check routes <app> · docs(search <topic>)"),
    ])
  );

  add(
    P("quick-start", "Quick start", "A practical first half-hour", ["intro", "shell"], [
      kicker("Start"),
      ol([
        "Right-click empty desktop → open the command line.",
        "Type clock and press Enter: Clock opens.",
        "Type clock(timer 25m): a timer starts; you do not need to hunt the Timer page.",
        "Type today(add Buy milk): a task is stored even if Today is closed.",
        "Type a: every My Space app window closes (external apps may stay).",
        "Save a shortcut: alias ocean = run space(ocean) then type ocean.",
        "Pack a morning: macro morning = today(list); sys(cpu); drift(list today) then macro morning.",
        "Open Connect (run mail) and try My Space Browser: search an app or Gmail from the home page.",
      ]),
      h2("Essential first commands"),
      code([
        "check running",
        "help clock",
        "check routes today",
        "docs(search timer)",
        "stocks(list)",
        "builds(list)",
      ]),
      h2("What “silent” feels like"),
      p(
        "After today(add …) or stocks(quote …) you should see a short confirmation in the shell, not necessarily a new window. That is intentional (since 0.1.10). To force UI: today(open) or today(tomorrow)."
      ),
      h2("Install the habit"),
      ul([
        "Prefer app(verb) inside macros so overnight scripts do not spam windows.",
        "Use check before if-branches so automation is idempotent.",
        "Bookmark Docs pages you revisit (★ in the top bar).",
      ]),
      note("If a verb is missing after an update banner, click Restart & Update once."),
    ])
  );

  add(
    P("desktop", "Desktop & windows", "Layout, pins, focus, and launching", ["desktop", "ui"], [
      kicker("Start"),
      p(
        "The desktop is the hub surface: wallpaper, pinned apps, running My Space windows, and a command line reachable from empty space. Think of it as your always-on control plane. The taskbar bell opens Notifications; Connect (Mail) opens the web-app catalog and My Space Browser."
      ),
      h2("Launch & focus"),
      code([
        "run <app> · open <app> · focus <app>",
        "run remote hub · run \"vs code\"",
        "focus builds · focus today",
      ]),
      h2("Close"),
      code([
        "close              # frontmost / context close",
        "close all          # every My Space app window",
        "close <app>        # one app",
        "a                  # shorthand for close all",
        "bdrift · bbuilds   # b + app ref → close that app",
      ]),
      h2("Layout helpers"),
      code([
        "pin <app> · unpin <app>",
        "reveal <app>",
        "desktop · settings",
        "refresh · sort · reset layout",
      ]),
      h2("Myapps vs external"),
      ul([
        "myapp: rendered inside My Space (Clock, Docs, Stocks…). Supports routes and often app(verb).",
        "external: Windows executables (Edge, Docker, Terminal, Cursor). Launch/focus/close semantics differ; embedding may be available when configured.",
        "url: opens a site (e.g. GitHub) in the browser.",
      ]),
      tip("Fuzzy names: run code lexicon · focus digital contracts · run pi digit"),
      warn("close all does not quit My Space itself — it clears app windows. External processes may keep running."),
    ])
  );

  add(
    P("navigation", "Finding your way", "Help, Docs, Info, and Console as maps", ["desktop", "docs"], [
      kicker("Start"),
      p("You rarely need to memorize every verb. The system exposes several maps: use them together."),
      h2("Maps of the system"),
      table(
        ["Tool", "Best for", "Example"],
        [
          ["Docs (this app)", "Concepts + full catalogs", "docs(search msl)"],
          ["help <app>", "Quick examples for one app", "help stocks"],
          ["check routes", "Pages / aliases / command flag", "check routes clock"],
          ["Console → Reference", "Compact shell cheat-sheet", "console(reference)"],
          ["Info", "What apps recently did on-screen", "run apps-info"],
        ]
      ),
      h2("Search Docs well"),
      ul([
        "Search matches titles, subtitles, tags, tables, and code lines.",
        "Try verbs: timer, quote, wake, apod, alias.",
        "Try concepts: silent, msl, syncIfOpen, userData.",
      ]),
      code(["docs(search silent)", "docs(open cmd-protocol)", "docs(bookmarks)"]),
    ])
  );

  add(
    P("shell-language", "My Space Language", "OS orchestration language: grammar + live operations", ["shell", "grammar", "language", "myspace-language"], [
      kicker("Language"),
      p(
        "My Space Language is the orchestration language of My Space OS. It connects the OS to apps inside My Space and drives everything around them (platform services, automation, permissions, files, schedules, jobs, link buses). It is not a bash clone and not a general-purpose app language — other languages own app-internal logic."
      ),
      h2("Language · Scripts · Shell · Services"),
      table(
        ["Layer", "Role"],
        [
          ["My Space Language", "Grammar + operations (let, fn, if, and every module verb)"],
          ["Scripts", "Runtime / library for saved programs written in the language"],
          ["Shell", "Atlas + entry surfaces (desktop line, palette, Platform → Shell)"],
          ["Platform services", "Jobs, Scheduler, Files, MSL, Pulse… — called by language operations"],
        ]
      ),
      h2("Existing commands are language operations"),
      p(
        "Everything you already type as module(…) is part of the language: not a separate bolted-on command list. notes(add …), jobs(list), schedule(add …), msl(invoke …), pulse(send …), files(…), and the rest of the live ROUTE_REGISTRY are first-class operations."
      ),
      ul([
        "Platform → Shell → Language: purpose, layers, and the live operations catalog",
        "Platform → Shell → Operations: one page per module verb",
        "help <app> · check routes <app>: same registry the atlas uses",
      ]),
      h2("Core forms"),
      table(
        ["Form", "Meaning", "Example"],
        [
          ["run app", "Launch / open", "run builds"],
          ["app", "Shorthand run (fuzzy)", "space"],
          ["app(page)", "Open a declared page/view", "space(ocean)"],
          ["app(verb args)", "Language operation", "today(add Milk)"],
          ["key:value inside ()", "Classic deep route", "run geography(country:IL)"],
        ]
      ),
      h2("Parsing notes"),
      ul([
        "Parentheses must balance; nested ( ) inside args are rejected by the app-call parser.",
        "Comma-separated key:value lists are classic routes (text:hello, to:he).",
        "Space-separated verb forms are the modern protocol (timer 25m, search office).",
        "Quotes preserve spaces in app names and some arguments.",
      ]),
      h2("Where programs run"),
      ul([
        "Desktop empty-space command line (primary entry).",
        "Command palette (search operations).",
        "Scripts app: saved multi-line programs; one scoped run (let/fn share scope).",
        "Jobs / Scheduler: may enqueue or time language operations; they are not a second syntax.",
        "Aliases, macros, and when-rules call back into the same language engine.",
      ]),
      tip("Inside scripts and macros, prefer silent verbs so playback stays calm."),
      note("Global aliases like timer 25m and wait 5s still exist; clock(timer 25m) is clearer in shared scripts. Shell Atlas is the long-form map — Docs stays the short handbook."),
      h2("North star — build apps with other languages"),
      p(
        "My Space Language is not only for short automations. Together with Python, JavaScript, and other host languages, it should let users build My Space apps and other complete artifacts: scaffold the app package, wire MSL/Pulse/Permissions, run host tools for UI and logic, schedule maintenance, and pack for share."
      ),
      table(
        ["Owner", "Responsibility", "Examples"],
        [
          ["My Space Language", "Glue, OS contract, wiring", "app(scaffold …) · msl(expose …) · schedule(…) · host(run …) · pack(build …)"],
          ["Host languages", "App-internal logic", "Python data · Node UI gen · algorithms"],
          ["Platform services", "Runtime enforcement", "Jobs · Scheduler · Permissions · Files sandbox"],
        ]
      ),
      h2("Create ladder"),
      p("What “building in My Space” means in order. Live today; rest is the roadmap."),
      table(
        ["Stage", "Status", "Operations"],
        [
          ["In-OS objects", "live", "notes(add …) · schedule(add …) · pulse(send …)"],
          ["Language programs", "live", "scripts(set …) · scripts(append …) · scripts(run …)"],
          ["Portable artifacts", "live", "pack(export …) · pack(open …)"],
          ["Workspace files", "live", "files(write …) · files(mkdir …) · files(copy …) · files(workspace)"],
          ["Host interop", "live", "host(run python file:…) · host(run node file:…) · host(runtimes)"],
          ["My Space apps", "live", "app(scaffold …) · app(register …) · pack(build …) · run <id>"],
        ]
      ),
      h2("App package (target shape)"),
      p(
        "A My Space app = manifest + glue (preload, pulse, shell surfaces) + core (host-language logic) + optional MSL caps. The language scaffolds and registers; host code implements the product."
      ),
      code([
        "app(scaffold todo template:minimal)",
        "host(run node -- file:tools/todo/scaffold-ui.js)",
        "msl(expose todo.list)",
        "pack(build todo)",
        "run todo",
      ]),
      tip("Do not put OS wiring in Python/JS: keep host code inside the app boundary; call My Space only through declared caps or language operations."),
    ])
  );

  add(
    P("shell-chaining", "Chaining & pipelines", " ; vs | and how failures stop", ["shell", "flow"], [
      kicker("Shell"),
      p("Most real work is more than one command. The shell supports two chain styles."),
      h2("Semicolon: stop on error"),
      code(["run builds; run drift; today(list)"]),
      p("Steps run in order. If a step fails, the chain typically stops so you do not continue on a bad state."),
      h2("Pipe: keep going"),
      code(["today(list) | focus today"]),
      p("Use | when later steps should still run even if an earlier informational step is noisy."),
      h2("Good chain design"),
      ul([
        "Put checks first: check running; …",
        "Mutations before opens: today(add …); today(open)",
        "Keep side-effecting external connects near the end: remote(connect Office)",
      ]),
      warn("Infinite loops are capped. A broken while check … then … will not spin forever."),
      tip("Pack stable chains as macros so you do not retype them."),
    ])
  );

  add(
    P("shell-flow", "Control flow", "if / then / else, loops, and for-each", ["shell", "automation"], [
      kicker("Shell"),
      p(
        "Control flow turns one-off commands into small programs. Everything still runs through the same shell engine: the same verbs, the same silence rules — so a macro that uses if/loop behaves like typed lines."
      ),
      h2("Conditionals"),
      code([
        "if check drift open then focus drift else run drift",
        "if check !running then run builds",
        "if check alias ocean then ocean",
        "if check macro work then macro work else docs(search macro)",
        "if help",
      ]),
      p("The condition is usually a check … query (running, windows, apps, aliases, macros, when, routes, or app open/closed). Prefix with ! or not to negate where supported."),
      h2("What you can check"),
      table(
        ["Check", "True when", "Example"],
        [
          ["check running / windows", "Any My Space app windows are open", "if check running then a"],
          ["check <app> open", "That app window exists", "if check today open then today(list)"],
          ["check alias <name>", "Alias is defined", "if check alias ocean then ocean"],
          ["check macro <name>", "Macro is defined", "if check macro morning then macro morning"],
          ["check routes <app>", "Always useful as discovery; see shell-check", "check routes clock"],
        ]
      ),
      h2("loop: fixed count"),
      code(["loop 3 then sys(cpu)", "loop 5 then wait 1s", "loop help"]),
      p("Runs the body N times. Good for short retries or spaced waits — not for unbounded work."),
      h2("while: conditional repeat"),
      code(["while check running then close", "while help"]),
      p("Re-evaluates the condition each iteration. Always design an exit (close something, pause Drift, etc.)."),
      h2("for: iterate tokens"),
      code([
        "for builds drift space then run $item",
        "for ocean earth cosmos then run space($item)",
        "for AAPL TSLA NVDA then stocks(quote $item)",
        "for help",
      ]),
      p("$item is the current token; $index is available when the engine substitutes loop variables. Keep lists short and explicit — do not paste huge inventories into for."),
      h2("Nesting & safety"),
      ul([
        "Loop / while iterations are capped (~25) so a bad condition cannot freeze the UI.",
        "Nesting depth is capped (~12). Prefer macros over deep nesting.",
        "A failing step inside ; chains stops the rest — know whether your body uses ; or |.",
      ]),
      h2("When to use Scripts instead"),
      p("If the workflow is longer than a few lines, hard to read as one string, or you want to edit it visually: put it in Scripts and run scripts(name). Macros and if/loop stay best for short rituals."),
      tip("Test the body command alone before wrapping it in while."),
      warn("Never put vault unlock / master password into automated flow. Unlock is UI-only."),
      note("Pair with aliases-macros and automation-patterns for real-day packing."),
    ])
  );

  add(
    P("shell-vars", "Variables & results", "let, $name, and capturing command output", ["shell", "language"], [
      kicker("Shell"),
      p(
        "Variables turn the shell from a list of commands into a small program. Assign with let, reuse with $name, and inspect with vars. On the desktop, variables live in the session scope until cleared. Scripts get a fresh child scope per run (they can read session vars, but lets inside a script stay local)."
      ),
      h2("Assign"),
      code([
        "let n = 3",
        'let label = "Deep work"',
        "let tasks = today(list)",
        "let quote = stocks(quote AAPL)",
        "let a = 1; let b = 2",
      ]),
      p(
        "Right-hand side may be a literal (number, true/false, quoted string) or any command. Command results are captured only when the command succeeds. Names are case-sensitive (`$Foo` ≠ `$foo`). Chain multiple lets with `;`."
      ),
      h2("Use"),
      code([
        "loop $n then sys(cpu)",
        "clock(timer 25m $label)",
        "today(add Review: $tasks)",
      ]),
      h2("Fields"),
      table(
        ["Form", "Meaning"],
        [
          ["$name", "Primary text (message / data string)"],
          ["$name.text", "Same as primary text"],
          ["$name.message", "Shell message string"],
          ["$name.ok", "true or false"],
          ["$name.data", "Structured data when present, else text"],
          ["$$", "Literal dollar sign"],
        ]
      ),
      h2("Inspect & clear"),
      code(["vars", "vars clear", "unset tasks"]),
      tip("Unresolved $names are left as-is so for … then run $item still works."),
      note("help lang prints the short grammar card. A failed RHS does not overwrite a previous binding."),
      h2("Related"),
      p("shell-functions · shell-flow · app-scripts · cmd-protocol."),
    ])
  );

  add(
    P("shell-functions", "Functions", "fn name(args) { … } reusable blocks", ["shell", "language"], [
      kicker("Shell"),
      p(
        "Functions package multi-step logic with parameters. Define with fn, call like name(args). User functions are resolved before app(verb), so a fn named greet will not be mistaken for an app."
      ),
      h2("Define"),
      code([
        "fn pulse() {",
        "  today(list)",
        "  stocks(list)",
        "  sys(cpu)",
        "}",
        "fn greet(name) {",
        "  today(add hello $name)",
        "}",
      ]),
      p("Single-line form also works at the desktop prompt:"),
      code([
        "fn greet(name) { today(add hello $name) }",
        'fn greet(name) { let x = $name }; greet("Yo")',
      ]),
      h2("Call"),
      code(["pulse()", "greet(Yonatan)", 'greet("Yo na")', "fn nop() { } · nop()"]),
      h2("Parameters"),
      ul([
        "Args bind to $param names inside the body.",
        "Missing args become empty strings.",
        "Too many args is an error.",
        "Each call gets a fresh frame scope (locals do not leak).",
        "Empty / comment-only bodies are allowed (noop).",
        "Do not name functions after apps (today, clock, stocks, …): those names are reserved.",
        "Nesting cap is 12 (recursive calls beyond that fail).",
      ]),
      h2("Manage"),
      code(["fn list", "fns", "fn remove greet"]),
      h2("In Scripts"),
      p("Put fn blocks at the top of a script, then call them. scripts(run …) executes the whole body as one program so functions and lets share scope."),
      code([
        "fn morning() {",
        "  today(list)",
        "  drift(list today)",
        "}",
        "morning()",
      ]),
      tip("Prefer fn for reusable logic; prefer macro for short saved one-liners; prefer Scripts for long editable programs."),
      warn("Function names cannot be reserved words. Nesting is capped."),
      h2("Related"),
      p("shell-vars · shell-flow · app-scripts · aliases-macros."),
    ])
  );

  add(
    P("shell-shortcuts", "Built-in shortcuts", "One-letter and compact triggers", ["shell", "shortcuts"], [
      kicker("Shell"),
      table(
        ["Shortcut", "Expands to", "Notes"],
        [
          ["a", "close all", "My Space windows"],
          ["b<app>", "close <app>", "bdrift · bremote hub"],
          ["<app>", "run <app>", "Fuzzy match"],
          ["<app>(…)", "run or command protocol", "If commands:true and verb form"],
        ]
      ),
      h2("Timer & wait globals"),
      code([
        "timer 25m",
        "timer 25m Deep work",
        "timer pause · timer stop · timer status",
        "pomodoro start",
        "wait 5s · wait 2m",
        "wait until 14:30",
      ]),
      p("wait blocks the shell up to a safety cap (hours-scale limit). Prefer it inside macros for paced sequences."),
      note("Prefer clock(…) when writing shared Docs recipes so the intent is obvious."),
    ])
  );

  add(
    P("shell-check", "check queries", "Inspect running state, routes, and automation", ["shell", "check"], [
      kicker("Shell"),
      p("check is the read-only sensor API of the shell. Use it in the CLI and inside if / while."),
      h2("Runtime"),
      code(["check running", "check apps", "check drift", "check <app>"]),
      h2("Routes & help data"),
      code(["check routes", "check routes space", "check routes clock"]),
      h2("Automation inventory"),
      code(["check aliases", "check macros", "check when"]),
      h2("Using checks in branches"),
      code([
        "if check running then close all else desktop",
        "if check !running then run builds",
      ]),
      tip("check routes <app> prints pages, aliases, examples, and whether commands:true is on."),
    ])
  );

  add(
    P("shell-discovery", "Discovery", "How to learn verbs without leaving the shell", ["shell", "help"], [
      kicker("Shell"),
      p(
        "You do not need to memorize every verb. My Space exposes several overlapping maps: start narrow and widen only when you need concepts."
      ),
      h2("Discovery ladder"),
      ol([
        "help — global cheat sheet of common patterns.",
        "help <app>: curated examples for one module.",
        "check routes <app>: pages, aliases, commands flag, and command help lines.",
        "docs(search <word>): handbook articles that explain why, not only how.",
        "docs(open <page-id>): jump straight into a known article.",
        "console(reference): compact visual cheat-sheet inside Console.",
      ]),
      h2("Try this sequence"),
      code([
        "help clock",
        "check routes clock",
        "docs(search timer)",
        "docs(open cmd-clock-today)",
        "console(reference)",
      ]),
      h2("Reading examples"),
      p(
        "ROUTE_REGISTRY examples are curated happy paths, not an exhaustive grammar. When you type an unknown verb, the error often repeats that app’s command help string — treat the error as a mini cheat-sheet."
      ),
      h2("Search tips in Docs"),
      ul([
        "Search verbs (snooze, wake, quote) more often than app marketing names.",
        "Search protocol words (silent, msl, sync) for conceptual pages.",
        "Bookmark pages you revisit — docs(bookmarks).",
      ]),
      tip("If help <app> looks empty after an update, Restart & Update, the preload bridge may still be on the previous version."),
      note("Docs categories: Start · Shell · Commands · Apps · Protocols · Automation · Data & privacy · Recipes · Reference."),
    ])
  );

  add(
    P("shell-errors", "Errors & recovery", "What failures mean and what to do", ["shell", "troubleshooting"], [
      kicker("Shell"),
      table(
        ["Symptom", "Likely cause", "Fix"],
        [
          ["Unknown command", "Typo or app not commands:true", "help <app> · check routes"],
          ["API unavailable — restart", "Preload bridge missing after upgrade", "Restart & Update"],
          ["Not found / Ambiguous", "Name match failed or multiple hits", "Use id or a longer unique name"],
          ["Vault locked", "Mutation without unlock", "Unlock in Vault UI"],
          ["Translation failed", "Network / provider", "Retry · translate(detect …)"],
          ["Machine not found", "Remote Hub empty / typo", "remote(list)"],
        ]
      ),
      warn("A failing step in a ; chain stops the rest. Re-run from the failed command after fixing state."),
      tip("docs(open troubleshooting) collects more cases."),
    ])
  );

  // ─── Commands protocol ───────────────────────────────────

  add(
    P("cmd-protocol", "App command protocol", "app(verb args) — no run required", ["commands", "protocol"], [
      kicker("Commands"),
      p(
        "Apps opt in with commands: true in ROUTE_REGISTRY. Once enabled, tryExecuteAppCommand accepts app(verb …) without the run keyword. The same verbs usually work as run app(verb …)."
      ),
      h2("Rules of silence (0.1.10+)"),
      ul([
        "list / search / get / quote / scan / add / watch / detect → silent shell message.",
        "If the app window is already open, syncIfOpen refreshes UI quietly.",
        "open / bare page names / study / quiz → launch or navigate.",
        "Some verbs spawn external tools (remote connect, mailto) without opening the My Space app chrome.",
      ]),
      h2("Classic key:value still works"),
      code(["run geography(country:IL)", "run translate(text:hello, to:he)"]),
      p("Classic forms remain for deep UI links. Translate is special-cased so text:/to:/from: can stay in the command handler."),
      h2("Authoring macros"),
      code([
        "macro desk = today(list); stocks(list); drift(list today)",
        "macro desk",
      ]),
      warn("Vault mutations require an unlocked Vault window. The shell will not prompt for the master password."),
      tip("Wired modules include Clock, Today, Stocks, Builds, Vault, Drift, Decks, Contacts, Translate, SysInfo, Remote, Studies, Geo, Flags, History, Space, Contracts, MSL, Lexicon, Flow, Console, Docs — and growing."),
    ])
  );

  add(
    P("cmd-clock-today", "Clock & Today", "Timers, pomodoro, and the daily agenda", ["commands", "clock", "today"], [
      kicker("Commands"),
      h2("Clock: identity"),
      p("Module world-clock. Aliases: clock. Pages: local, world, meetings, timer, pomodoro, stopwatch."),
      h2("Clock: verbs"),
      code([
        "clock(timer 25m)",
        "clock(timer 90s Focus)",
        "clock(timer 25m label:Tea)",
        "clock(timer pause) · clock(timer stop) · clock(timer status)",
        "clock(pomodoro start) · clock(pomodoro work:45) · clock(pomodoro pause)",
        "clock(stopwatch)",
        "clock(local) · clock(world) · clock(meetings)",
        "clock(help)",
      ]),
      h2("Clock: behavior notes"),
      ul([
        "Timer state is persisted in main so it keeps running even if the Clock page is slow to load.",
        "Bare durations may be accepted as timer intents in some paths; prefer explicit clock(timer …).",
        "Global timer / pomodoro / wait aliases still exist for speed.",
      ]),
      h2("Today: identity"),
      p("Module day-planner. Aliases: today, planner, dayplanner. Pages: home, today, tomorrow, later, done, all. (GTD projects live in Tasks — tasks / gtd / todo.)"),
      h2("Today: verbs"),
      code([
        "today(add Buy milk)",
        "today(add Call Dana 15:00)",
        "today(add Ship report tomorrow)",
        "today(done Buy milk) · today(undo …) · today(delete …)",
        "today(list) · today(list tomorrow)",
        "today(snooze Buy milk 15m) · today(snooze … tomorrow)",
        "today(clear done)",
        "today(tomorrow) · today(later) · today(done) · today(all)",
        "today(help)",
      ]),
      h2("Today: matching tasks"),
      p("done / delete / snooze resolve tasks by id or unique title match. Ambiguous titles return a short list to disambiguate."),
      tip("Silent add + later today(open) is a good macro pattern for capture-during-focus."),
    ])
  );

  add(
    P("cmd-stocks-builds", "Stocks & Builds", "Markets and your project shelf", ["commands", "stocks", "builds"], [
      kicker("Commands"),
      h2("Stocks: identity"),
      p("Module stocks. Pages include dashboard, portfolio, alerts, stock, ai-analysis. Modes cover stocks, crypto, forex, metals, ETFs, and more."),
      h2("Stocks: verbs"),
      code([
        "stocks(AAPL)                 # open / focus symbol",
        "stocks(watch TSLA)",
        "stocks(quote NVDA)",
        "stocks(alert AAPL > 200)",
        "stocks(alert remove AAPL)",
        "stocks(mode crypto)",
        "stocks(list) · stocks(portfolio) · stocks(hold …)",
        "stocks(help)",
      ]),
      h2("Stocks: notes"),
      ul([
        "Bare tickers are first-class when they look like symbols.",
        "quote is silent; bare AAPL may navigate depending on path: prefer quote for scripts.",
        "Alerts persist via stocks IPC; list them from the Alerts page or shell list helpers where available.",
      ]),
      h2("Builds: identity"),
      p("Module builds. Pages: browse, timeline. Deep link openProject."),
      h2("Builds: verbs"),
      code([
        "builds(list) · builds(list web) · builds(list fav)",
        "builds(open Operating System)",
        "builds(new My App)",
        "builds(folder My App) · builds(rescan My App)",
        "builds(timeline) · builds(browse)",
        "builds(help)",
      ]),
      tip("Name matching is fuzzy on project titles; use a unique substring when several projects share a prefix."),
    ])
  );

  add(
    P("cmd-vault-contacts", "Vault & Contacts", "Secrets and people", ["commands", "vault", "contacts"], [
      kicker("Commands"),
      h2("Vault: identity"),
      p("Module profiles. Alias: vault. UI unlock is mandatory for mutations."),
      h2("Vault: verbs"),
      code([
        "vault(status) · vault(lock)",
        "vault(list) · vault(search gmail)",
        "vault(open Gmail) · vault(copy Gmail)",
        "vault(add Work Email) · vault(delete Name)",
        "vault(help)",
      ]),
      warn("If status says locked, open Vault, unlock, then retry copy/add/delete. The shell never asks for the master password."),
      h2("Contacts: identity"),
      p("Module contacts. Pages: browse, reminders, groups."),
      h2("Contacts: verbs"),
      code([
        "contacts(list) · contacts(search Dana)",
        "contacts(add Dana | dana@mail.com | +972…)",
        "contacts(add Dana dana@mail.com)",
        "contacts(email Dana) · contacts(phone Dana) · contacts(sms Dana)",
        "contacts(upcoming) · contacts(open Dana)",
        "contacts(delete Dana)",
        "contacts(groups) · contacts(browse) · contacts(reminders)",
        "contacts(help)",
      ]),
      h2("Contacts: add parsing"),
      ul([
        "Pipe form: Name | email | phone",
        "Free form: Name plus detected email/phone tokens",
        "Display name matching is used for open/email/phone/delete",
      ]),
      tip("upcoming is silent; reminders opens the reminders page."),
    ])
  );

  add(
    P("cmd-translate-sys", "Translate & System Info", "Languages and machine scans", ["commands", "translate", "sysinfo"], [
      kicker("Commands"),
      h2("Translate: identity"),
      p("Module translate. Pages: translate, history, phrases, batch, settings."),
      h2("Translate: verbs & forms"),
      code([
        "translate(hello)",
        "translate(bonjour -> en)",
        "translate(hello to hebrew)",
        "translate(שלום)                    # defaults toward English",
        "translate(text:shalom, from:he, to:en)",
        "translate(to:en hello world)",
        "translate(detect bonjour)",
        "translate(languages) · translate(history)",
        "translate(open phrases) · translate(batch)",
        "translate(help)",
      ]),
      h2("Translate: smart defaults"),
      ul([
        "If to is omitted, script detection picks a sensible target (Hebrew-heavy → en, Latin-heavy → he).",
        "If auto-detect equals the target, the engine flips once (he↔en) to avoid no-op translations.",
        "Language names (hebrew, english, french…) resolve in IPC normalizeLang.",
        "Successful shell translations are added to history when saveHistory is enabled.",
      ]),
      h2("System Info: identity"),
      p("Module system-info. Aliases: sysinfo, sys."),
      h2("System Info: verbs"),
      code([
        "sysinfo(scan) · sys(system)",
        "sys(cpu) · sys(memory) · sys(ram)",
        "sys(storage) · sys(disk)",
        "sys(processes) · sys(network) · sys(ports)",
        "sys(environment) · sys(performance)",
        "sysinfo(open cpu) · sys(open memory)",
        "sys(help)",
      ]),
      note("Scans are Windows-oriented; non-Windows returns limited placeholders."),
      tip("Use sys(cpu) inside morning macros: silent and fast enough for a status line."),
    ])
  );

  add(
    P("cmd-remote-drift", "Remote Hub & Drift", "Machines and what changed", ["commands", "remote", "drift"], [
      kicker("Commands"),
      h2("Remote Hub: identity"),
      p("Module remote-hub. Alias: remote. Pages: machines, quick, network, enable."),
      h2("Remote: verbs"),
      code([
        "remote(list) · remote(search office)",
        "remote(check) · remote(check Office)",
        "remote(open Office)",
        "remote(connect Office) · remote(connect Office ssh)",
        "remote(wake Office) · remote(wake AA:BB:CC:DD:EE:FF)",
        "remote(scan) · remote(tools)",
        "remote(add Lab | 10.0.0.5 | rdp)",
        "remote(delete Lab) · remote(import-ts)",
        "remote(network) · remote(enable)",
        "remote(help)",
      ]),
      h2("Remote: connect modes"),
      p("rdp · ssh · rustdesk · psremoting · explorer · winrs · custom: optional trailing token on connect."),
      h2("Drift: identity"),
      p("Module drift. Pages: activity, zones, insights."),
      h2("Drift: verbs"),
      code([
        "drift(scan)",
        "drift(list) · drift(list today)",
        "drift(search config)",
        "drift(zones) · drift(insights)",
        "drift(pause)",
        "drift(open <eventId>)",
        "drift(help)",
      ]),
      tip("drift(scan) then drift(list today) is a strong end-of-day pair."),
    ])
  );

  add(
    P("cmd-learn", "Study Deck, Studies & Flags", "Learning surfaces from the shell", ["commands", "study", "flags"], [
      kicker("Commands"),
      h2("Study Deck: identity"),
      p("Module study-deck. Aliases: studydeck, flashcards, decks, studiesdeck.)"),
      h2("Study Deck: verbs"),
      code([
        "decks(list)",
        "decks(new Biology)",
        "decks(add Biology | Mitochondria | Powerhouse of the cell)",
        "decks(add front | back)              # uses first deck",
        "decks(delete Biology)",
        "studydeck(open Biology)",
        "studydeck(study Biology) · studydeck(study)",
        "decks(help)",
      ]),
      h2("Studies: identity"),
      p("Module studies. Pages: home, templates, editor."),
      h2("Studies: verbs"),
      code([
        "studies(list) · studies(search thesis)",
        "studies(open My Notes)",
        "studies(templates) · studies(home) · studies(new)",
        "studies(help)",
      ]),
      h2("Flag Quiz: identity"),
      p("Module flag-quiz. Aliases: flags, flagquiz, flag-learn. App display name: Learning Games."),
      h2("Flags: verbs"),
      code([
        "flags(scores) · flags(list)",
        "flags(quiz) · flags(start) · flags(play)",
        "flags(meta) · flags(home) · flags(scores)",
        "flags(clear) · flags(clear scores)",
        "flags(help)",
      ]),
      note("quiz/start opens UI and starts a run; scores stays silent."),
    ])
  );

  add(
    P("cmd-geo-space-history", "Geography, Space & History", "World, cosmos, and the past", ["commands", "geo", "space", "history"], [
      kicker("Commands"),
      h2("Geography: identity"),
      p("Module geography. Alias: geo. Pages: explore, learn, traveled. Bare country names resolve to silent get."),
      code([
        "geo(list) · geo(search Israel)",
        "geo(get IL) · geo(info Japan)",
        "geography(Togo)                 # silent summary",
        "geo(open Japan) · geo(learn Japan)",
        "geo(traveled) · geo(explore)",
        "geo(visited) · geo(favorites)",
        "geo(help)",
      ]),
      h2("Space: identity"),
      p("Module space. Pages: navigate, catalog, nasa, reports, aliens. Views: cosmos, ocean, earth."),
      code([
        "space(apod)",
        "space(search Mars) · space(catalog)",
        "space(get earth)",
        "space(missions) · space(missions apollo)",
        "space(reports)",
        "space(ocean) · space(earth) · space(cosmos)",
        "space(open Mars) · space(nasa) · space(aliens)",
        "space(help)",
      ]),
      h2("History: identity"),
      p("Module history. Pages: figures, events, collection. Entities use Wikidata ids (Q…)."),
      code([
        "history(status)",
        "history(list figures) · history(list events)",
        "history(search Napoleon)",
        "history(get Q762) · history(info Napoleon)",
        "history(open Napoleon) · history(bookmarks)",
        "history(figures) · history(events)",
        "history(help)",
      ]),
      tip("Bare geography/space names are silent summaries; prefix open to navigate."),
    ])
  );

  add(
    P("cmd-contracts-msl", "Contracts & MSL", "Documents and the link protocol", ["commands", "contracts", "msl"], [
      kicker("Commands"),
      h2("Contracts: verbs"),
      code([
        "contracts(list) · contracts(templates)",
        "contracts(upcoming) · contracts(check)",
        "contracts(get Lease) · contracts(open Lease)",
        "contracts(editor) · contracts(expiring) · contracts(library)",
        "contracts(new)",
        "contracts(help)",
      ]),
      p("open can also match a template title to start editor with that template."),
      h2("MSL: verbs"),
      code([
        "msl(list) · msl(caps) · msl(capabilities)",
        "msl(keys)",
        "msl(parse msl://…)",
        "msl(open) · msl(home)",
        "msl(help)",
      ]),
      tip("See Protocols → MSL providers for which apps publish what."),
    ])
  );

  add(
    P("cmd-lexicon-flow-console", "Lexicon, Flow & Console", "Concepts, AI flows, and the command engine UI", ["commands", "lexicon", "flow", "console"], [
      kicker("Commands"),
      h2("Code Lexicon"),
      code([
        "lexicon(search promise) · lexicon(list async)",
        "lexicon(get closure) · lexicon(promise)   # bare term → silent definition",
        "lexicon(daily) · lexicon(stats) · lexicon(categories)",
        "lexicon(open promise) · lexicon(browse)",
        "lexicon(help)",
      ]),
      h2("Model Flow"),
      code([
        "flow(meta) · flow(status)",
        "flow(tools) · flow(history)",
        "flow(plan Send weekly digest email)",
        "flow(open) · flow(studio)",
        "flow(help)",
      ]),
      p("plan returns a summary in the shell and paints the canvas if Flow is open. Edit steps in-app, then Approve & run. Tools panel shows Live vs Staged."),
      h2("Console"),
      code([
        "console(aliases) · console(macros) · console(when) · console(history)",
        "console(runner) · console(reference)",
        "console(open aliases)",
        "shell(reference)                  # alias of console",
        "console(help)",
      ]),
      note("console(aliases) lists silently; console(open aliases) forces the page."),
    ])
  );

  add(
    P("cmd-docs-maps-scripts", "Docs, Maps & Scripts", "Handbook plus Scripts & Maps verbs", ["commands", "docs", "scripts", "maps"], [
      kicker("Commands"),
      h2("Docs — verbs"),
      code([
        "docs(overview) · docs(cmd-protocol)",
        "docs(search timer)",
        "docs(open shell-language)",
        "docs(list) · docs(bookmarks)",
        "docs(help)",
      ]),
      h2("Scripts: verbs"),
      code([
        "scripts(list) · scripts(get morning) · scripts(run morning)",
        "scripts(set nightly backup(status)) · scripts(append nightly schedule(list))",
        "scripts(open morning) · scripts(new focus) · scripts(help)",
      ]),
      h2("World Maps: verbs"),
      code([
        "maps(geocode Tel Aviv) · maps(notes) · maps(routes)",
        "maps(status) · maps(open) · maps(help)",
      ]),
      tip("Deep pages: app-docs · app-scripts · app-maps · help <app>."),
    ])
  );

  add(
    P("apps-directory", "Apps directory", "Every first-party app at a glance", ["apps"], [
      kicker("Apps"),
      table(
        ["App", "Module", "Shell", "Role"],
        [
          ["Welcome", "builtin", "welcome", "Command center"],
          ["Info", "apps-info", "run info", "In-app activity / digests"],
          ["Docs", "docs", "docs(…)", "This handbook"],
          ["System Info", "system-info", "sys(…)", "Scans"],
          ["Clock", "world-clock", "clock(…)", "Time & timers"],
          ["Remote Hub", "remote-hub", "remote(…)", "RDP/SSH/WoL"],
          ["Studies", "studies", "studies(…)", "Long documents"],
          ["Study Deck", "study-deck", "decks(…)", "Flashcards"],
          ["Today", "day-planner", "today(…)", "Agenda"],
          ["Vault", "profiles", "vault(…)", "Secrets"],
          ["World Maps", "world-maps", "maps(…)", "Map explorer"],
          ["Stocks", "stocks", "stocks(…)", "Markets"],
          ["Translate", "translate", "translate(…)", "Languages"],
          ["Contacts", "contacts", "contacts(…)", "People"],
          ["Geography", "geography", "geo(…)", "Countries"],
          ["Learning Games", "flag-quiz", "flags(…)", "Quizzes"],
          ["Pi Digits", "pi-digits", "run pi-digits", "Memorize π"],
          ["Icon Library", "icon-library", "run icon-library", "Icons"],
          ["History", "history", "history(…)", "Figures & events"],
          ["Space", "space", "space(…)", "Cosmos/ocean/earth"],
          ["Digital Contracts", "contracts", "contracts(…)", "Contracts"],
          ["MSL", "platform · msl", "msl(…)", "Capability bus"],
          ["Builds", "builds", "builds(…)", "Projects shelf"],
          ["Code Lexicon", "code-lexicon", "lexicon(…)", "Concepts"],
          ["Drift", "drift", "drift(…)", "Change timeline"],
          ["Model Flow", "model-flow", "flow(…)", "AI tool flows"],
          ["Console", "shell-console", "console(…)", "Shell UI"],
          ["Scripts", "scripts", "scripts(…)", "Multi-step programs"],
        ]
      ),
      note("Shell column shows the preferred entry. Apps without commands:true still open via run."),
    ])
  );

  add(
    P("apps-windows", "App windows", "How myapps open, route, and expose APIs", ["apps", "architecture"], [
      kicker("Apps"),
      p(
        "Each myapp loads in a dedicated window with its own preload exposing window.myApp.invoke(channel, args). The desktop shell uses a separate preload (window.mySpace.*) for cross-app orchestration."
      ),
      h2("Routing into a window"),
      ol([
        "Shell resolves module + route (page / action / param).",
        "launchApp opens or focuses the window.",
        "An injected script calls e.g. ClockApp.setActivePage('timer') or DocsApp.search('msl').",
      ]),
      h2("Public window.*App objects"),
      p(
        "Apps expose a small global API (TranslateApp.openTranslate, GeoApp.openCountry, DocsApp.setPage…). Deep links depend on these being ready — the injector retries briefly."
      ),
      h2("Settings panels"),
      p(
        "Shared settings-definitions.js declares schema per module. Apps include the shared settings CSS/JS bundle to render toggles (history, MSL provider, language, …)."
      ),
    ])
  );

  add(
    P("apps-productivity", "Productivity apps", "Day-to-day work surfaces in depth", ["apps"], [
      kicker("Apps"),
      h2("Today"),
      p("Hour-aware agenda with buckets (today / tomorrow / later / done). Capture from shell without breaking focus. Snooze understands durations and tomorrow."),
      h2("Studies"),
      p("Long-form documents, templates, formal modes, Gemini assist, export to PDF/DOCX. Use studies(list/search/open) to jump into editors."),
      h2("Vault"),
      p("Encrypted credential store. Shell is a convenience layer after unlock: never the unlock UI."),
      h2("Contacts"),
      p("People graph with emails, phones, birthdays, reminders. Shell can mailto/tel/sms via OS handlers."),
      h2("Contracts"),
      p("Template-driven formal documents with expiry scanning. upcoming/check keep renewals visible."),
      h2("Builds"),
      p("Your maker inventory — projects, folders, rescans, timeline. Treat it as the index of everything you have built."),
      h2("Stocks"),
      p("Multi-asset tracker with modes, watchlists, alerts, portfolio. quote/watch are automation-friendly."),
      h2("Translate"),
      p("Instant translate, history, phrases, batch. Shell forms include arrows and language names."),
    ])
  );

  add(
    P("apps-learn", "Learning apps", "Practice, memorize, explore: detailed", ["apps", "learn"], [
      kicker("Apps"),
      h2("Study Deck"),
      p("Decks + cards + grading + optional AI generation. Shell add uses Deck | front | back. study opens the review surface."),
      h2("Learning Games (Flag Quiz)"),
      p("Quiz modes and score history. flags(meta) reports version/defaults; flags(scores) is silent."),
      h2("Pi Digits"),
      p("Playful π memorization (chain, chunk, ghost, …). Open with run pi-digits for now."),
      h2("Code Lexicon"),
      p("Thousands of programming concepts. Bare lexicon(promise) prints a definition silently; open jumps to the term panel."),
      h2("Geography"),
      p("Country encyclopedia + learn profiles + travel log. get vs open vs learn are intentionally different verbs."),
      h2("History"),
      p("Wikidata-backed figures and events with optional Wikipedia extracts. Cache status matters — history(status)."),
      h2("Space"),
      p("Multi-realm navigator (cosmos/ocean/earth), NASA missions/reports, APOD. catalog search is the silent discovery tool."),
      h2("World Maps"),
      p("Annotated map explorer. Currently classic run maps."),
    ])
  );

  add(
    P("apps-system", "System & ops apps", "Visibility, remote control, and meta tools", ["apps", "system"], [
      kicker("Apps"),
      h2("System Info"),
      p("On-demand scans rather than a permanent dashboard widget. Each sys(…) verb maps to a scan channel and returns a compact summary string."),
      h2("Drift"),
      p("Change awareness across watched zones. scan produces events; insights summarize; pause stops noise."),
      h2("Remote Hub"),
      p("Inventory of machines + connect + WoL + subnet scan + Tailscale import. connect may spawn mstsc/ssh/rustdesk."),
      h2("Console"),
      p("Visual editor for the same aliases/macros/when/history the desktop shell uses. Reference page is the pocket cheat-sheet."),
      h2("Scripts"),
      p("Named multi-line programs. Ideal home for morning shutdown sequences once verbs are stable."),
      h2("Model Flow"),
      p("Plan/approve/run tool flows. Shell plan is great for drafting; execution with side effects stays in-app."),
      h2("Info"),
      p("Cross-app digests / screen facts — useful after quizzes or long sessions."),
      h2("Icon Library, MSL & Docs"),
      p("Meta tooling: icons for makers, link keys for integration, handbook for humans."),
    ])
  );

  add(
    P("apps-external", "External apps", "Windows tools launched from My Space", ["apps"], [
      kicker("Apps"),
      p(
        "External entries live in config/apps.json with type external (local executable path) or url (open in the default browser). They appear on the desktop like myapps, but they do not expose app(verb) protocols — you launch, focus, and close them."
      ),
      h2("Typical pins"),
      table(
        ["Name", "Kind", "What it is for"],
        [
          ["Microsoft Edge", "external", "Default browser for web work"],
          ["Docker Desktop", "external", "Containers / local stacks"],
          ["VS Code", "external", "Classic editor"],
          ["Windows Terminal", "external", "OS shell sessions"],
          ["Cursor", "external", "AI-assisted editor"],
          ["GitHub", "url", "Repo / PR browser entry"],
        ]
      ),
      h2("Shell patterns"),
      code([
        "run edge",
        'run "vs code"',
        "run cursor",
        "focus cursor",
        "close terminal",
        "run github",
      ]),
      h2("Path resolution"),
      ul([
        "If the path in apps.json is wrong, run fails with a clear path error: fix the config or reinstall the tool.",
        "Quoted names help when the display name has spaces.",
        "url entries never need a local path; they hand off to the OS browser.",
      ]),
      tip("Put heavy editors at the end of macros so silent inventory verbs finish first."),
      note("External apps do not get Docs command pages of their own: document your launch aliases instead."),
    ])
  );

  add(
    P("msl", "My Space Link (MSL)", "Capabilities published between apps", ["protocols", "msl"], [
      kicker("Protocols"),
      p(
        "MSL is the cross-app capability bus. Provider apps publish actions (translate.text, space.bodies.search, …). Client apps call them through the broker. Keys can be minted, saved, injected into targets, and revoked."
      ),
      h2("Shell entry points"),
      code(["msl(list)", "msl(keys)", "msl(parse msl://…)", "msl(open)"]),
      h2("Mental model"),
      ol([
        "Provider declares capabilities and honors mslProvider settings toggles.",
        "You mint or inject a key in the MSL system panel (or via broker channels).",
        "A client invokes msl.invoke with capability id + input.",
        "Broker enforces allowlists (who may call what).",
      ]),
      h2("Safety"),
      ul([
        "Per-app Settings → My Space Link can disable publishing (rollback).",
        "Not every module is an MSL client: allowlists are intentional.",
        "Treat keys like capability URLs: do not paste secrets into them.",
      ]),
      tip("Pair with Docs → MSL providers for a capability map."),
    ])
  );

  add(
    P("msl-providers", "MSL providers map", "Which apps publish what (overview)", ["protocols", "msl"], [
      kicker("Protocols"),
      p("Exact capability ids evolve: always confirm with msl(list). Common families include:"),
      table(
        ["Provider area", "Examples of capability themes"],
        [
          ["Translate", "translate.text · detect · languages · history"],
          ["Space", "bodies search/get · wiki · open link"],
          ["Icons", "icons.search"],
          ["Apps Info", "catalog / digests"],
          ["Clock", "favorites · pomodoro status (provider set)"],
          ["Stocks", "quotes / watch-related queries"],
          ["History", "entity queries"],
          ["World Maps", "map-related queries"],
          ["Contacts", "list · reminders · email/phone open"],
          ["Geography", "countries list/get · learn · maps open"],
          ["Today", "tasks list/add/toggle/generate"],
          ["Builds", "projects list/get/create · folder open"],
          ["Studies", "docs list/get · export"],
        ]
      ),
      note("If a capability is missing, the provider toggle may be off or the module may not be in MSL_CLIENTS/ALLOWED_CALLERS."),
      code(["msl(list)"]),
    ])
  );

  add(
    P("routes", "Routes & deep links", "Pages, views, modes, and classic key:value", ["protocols", "routes"], [
      kicker("Protocols"),
      p("ROUTE_REGISTRY is the shell’s map of each module: pages, optional views/modes, aliases, deep action table, bare argument kind, examples, and commands flag."),
      h2("Examples of route kinds"),
      code([
        "run space(ocean)                 # view",
        "run stocks(mode:crypto)          # mode",
        "run geography(country:IL)        # classic key",
        "run lexicon(term:closure)",
        "run clock(timer:25m)             # classic timer deep link",
      ]),
      h2("Discover"),
      code(["check routes", "check routes space", "help geography"]),
      tip("When both classic and verb forms exist, use verbs in macros and classic when you need an exact UI deep-link."),
    ])
  );

  add(
    P("silent-actions", "Silent by default", "Why list does not open a window", ["protocols", "ux"], [
      kicker("Protocols"),
      p(
        "Since 0.1.10, action commands no longer force-open apps. This keeps macros, loops, and check-driven automation predictable."
      ),
      h2("Silent family"),
      ul([
        "Inventory: list, search, scores, templates, languages, tools…",
        "Read: get, quote, status, meta, detect, apod…",
        "Mutate: add, delete, watch, clear scores… (still silent UI-wise)",
        "Scan: scan, cpu, memory, drift(scan)…",
      ]),
      h2("Open family"),
      ul([
        "open …",
        "Bare page/view names: tomorrow, ocean, quiz…",
        "study / start / quiz style verbs",
        "Some connect/wake flows spawn OS tools",
      ]),
      code([
        "today(add Milk)        # silent",
        "today(tomorrow)        # opens",
        "geo(get IL)            # silent",
        "geo(open IL)           # opens",
      ]),
    ])
  );

  add(
    P("sync-if-open", "syncIfOpen", "Quiet UI refresh when a window already exists", ["protocols", "ux"], [
      kicker("Protocols"),
      p(
        "After a silent mutation or scan, the shell may call syncIfOpen: if that app window already exists, it is routed/refreshed so the UI catches up; if the window is closed, nothing opens. This is the bridge between silent automation and live screens."
      ),
      h2("Lifecycle"),
      ol([
        "You run a silent verb (today(add …), drift(scan), stocks(watch …), …).",
        "The IPC handler mutates or reads data and returns a shell message.",
        "Optionally the shell calls syncIfOpen for that module.",
        "Only an already-open window receives a refresh route.",
      ]),
      h2("Why it matters"),
      ul([
        "Macros can update Today while you stay in full-screen coding.",
        "If Today is open beside you, the list still refreshes.",
        "No surprise windows during automation — that is the whole point of silent-by-default.",
      ]),
      h2("What it is not"),
      ul([
        "Not a live subscription or websocket: only a side effect of a command you issued.",
        "Not a guarantee every verb syncs.",
        "Not a substitute for open / page verbs when you actually want the window.",
      ]),
      code([
        "today(add Milk)     # silent; Today refreshes only if already open",
        "today(tomorrow)     # opens / focuses the Tomorrow page on purpose",
      ]),
      tip("When debugging “UI didn’t update”, check whether the window was open and whether the verb is in the sync family."),
      note("Pair with Silent by default — syncIfOpen is the quiet companion to that policy."),
    ])
  );

  add(
    P("aliases-macros", "Aliases & macros", "Name shortcuts and multi-step packs", ["automation"], [
      kicker("Automation"),
      h2("Aliases — one command, one name"),
      code([
        "alias ocean = run space(ocean)",
        "alias cpu = sys(cpu)",
        "alias remove ocean",
        "check aliases",
        "console(aliases)",
      ]),
      p("Aliases are expanded before execution. Keep them short and stable."),
      h2("Macros — named chains"),
      code([
        "macro morning = today(list); sys(cpu); stocks(list); drift(list today)",
        "macro focus = a; clock(timer 50m Deep work)",
        "macro morning",
        "macro remove morning",
        "check macros",
      ]),
      h2("Design tips"),
      ul([
        "Silent verbs inside macros unless you truly want windows.",
        "Put destructive closes first only when intentional.",
        "Prefer check … gates for macros you bind to muscle memory.",
      ]),
      tip("Console UI is ideal for editing long macro strings safely."),
    ])
  );

  add(
    P("when-rules", "When rules", "Event → reaction automation", ["automation"], [
      kicker("Automation"),
      p(
        "When-rules are standing automations: an app emits an event, the shell matches a rule, and a reaction command runs. Unlike macros (you invoke them), when-rules fire because something happened in the system."
      ),
      h2("Shape"),
      code([
        "when drift(new) notify",
        "when remove <name>",
        "check when",
        "console(when)",
      ]),
      h2("Good reactions"),
      ul([
        "notify — surface awareness without opening windows.",
        "A single silent verb (today(add …), stocks(list)).",
        "A short named macro you already trust.",
      ]),
      h2("Practice"),
      ol([
        "Confirm the event actually fires (e.g. create a Drift event and watch).",
        "Start with notify only — prove the trigger before adding work.",
        "Escalate to one silent verb, then a small macro if needed.",
        "Remove unused rules promptly — every rule is permanent load.",
      ]),
      h2("Anti-patterns"),
      ul([
        "Reaction that re-emits the same event (feedback loop).",
        "Heavy run chains that steal focus while you are mid-task.",
        "Dozens of overlapping rules for the same noisy source.",
      ]),
      warn("A noisy event + a heavy macro can create feedback loops. Prefer notify or a single silent verb first."),
      tip("Inspect and edit comfortably in Console → When, then verify with check when."),
    ])
  );

  add(
    P("scripts-app", "Scripts app", "Runtime for My Space Language programs", ["automation", "scripts", "language"], [
      kicker("Scripts"),
      p(
        "Scripts stores and runs named multi-line programs written in My Space Language. It is the language runtime/library — not a second language. Use Scripts when a ritual is longer than a comfortable macro, needs structure, or you want a reusable program you edit visually."
      ),
      h2("How it fits"),
      ul([
        "My Space Language: the grammar and operations you write",
        "Scripts: where long programs live and execute",
        "Shell: atlas/map of the language (Platform → Shell)",
        "Scheduler / Jobs: time and capacity around language runs (schedule(…), jobs(…))",
      ]),
      h2("When to use Scripts vs macros"),
      table(
        ["Tool", "Best for", "Limit"],
        [
          ["Alias", "One command, memorable name", "No chaining"],
          ["Macro", "Short rituals (≈2–6 steps)", "Hard to edit long strings"],
          ["Script", "Long procedures, weekly packs", "One program scope; test before shipping"],
          ["When", "Event-driven reactions", "Not for manual rituals"],
        ]
      ),
      h2("Launch"),
      code([
        "scripts(list)",
        "scripts(run morning)",
        "scripts(open morning)",
        "run scripts",
      ]),
      h2("Write from the language"),
      p(
        "Programs can create or extend other programs: the first create operation in My Space Language. scripts(set) replaces the body (creates if missing). scripts(append) adds a line. Use from the desktop line, from another script, or from Scheduler."
      ),
      code([
        "scripts(set nightly backup(status))",
        "scripts(append nightly schedule(list))",
        'scripts(set weekly "today(list)\\nnetwork(status)")',
        "scripts(set pack body:# generated\\nrun today)",
      ]),
      h2("Authoring guidance"),
      ul([
        "One command per line: easier to bisect failures.",
        "Prefer silent app(verb) lines; put run / focus only where intentional.",
        "Name scripts after outcomes (morning, eod-review), not implementation.",
        "Test each line in the desktop shell before saving the pack.",
        "Keep wait … between wake/connect style steps.",
      ]),
      h2("Starter rituals (shipped)"),
      code([
        "scripts(run morning) · scripts(run focus)",
        "scripts(run eod) · scripts(run remote)",
      ]),
      p(
        "These four scripts are seeded once (merged by name). Existing scripts with the same name are never overwritten."
      ),
      h2("Example skeleton"),
      code([
        "# conceptual morning script body",
        "today(list)",
        "sys(cpu)",
        "stocks(list)",
        "drift(list today)",
      ]),
      note("Scripts is on the app(verb) protocol: help scripts · docs(open app-scripts)."),
      tip("If a script grows past ~20 lines, split into named scripts and call them from a thin wrapper macro."),
    ])
  );

  add(
    P("model-flow", "Model Flow", "Plan → edit → approve → run", ["automation", "ai"], [
      kicker("Automation"),
      p("Model Flow is a single studio: compose a task, get a plan, edit or drop steps, approve, then run. Side panels cover History, Tools (Live vs Staged), and Connection (Lab key)."),
      code([
        "flow(meta) · flow(tools) · flow(history)",
        "flow(plan Summarize inbox and draft a reply)",
        "flow(open)",
      ]),
      h2("Shell vs app"),
      ul([
        "Shell plan: drafts and, if Flow is open, paints the canvas for approval.",
        "In-app: edit chips, drop steps, approve side effects (Gmail/Sheets/etc.).",
        "Connection shows whether a key is set (env or secrets file): never the raw key.",
        "Live tools today: model, email, sheets, notify. Everything else is Staged.",
      ]),
      warn("Billing/quota issues fall back to local plans; live email/sheets still need a Lab key."),
    ])
  );

  add(
    P("automation-patterns", "Automation patterns", "Composable recipes for reliability", ["automation"], [
      kicker("Automation"),
      h2("Capture without focus loss"),
      code(["today(add …)", "contacts(add …)", "decks(add Deck | front | back)"]),
      h2("Status line macro"),
      code(["macro pulse = sys(cpu); today(list); stocks(list)"]),
      h2("Safe open-if-needed"),
      code(["if check drift open then focus drift else run drift"]),
      h2("End of day"),
      code(["macro eod = drift(scan); drift(list today); today(clear done)"]),
      h2("Rules of thumb"),
      ol([
        "Prefer silent verbs.",
        "Gate with check.",
        "Keep macros under ~6 steps unless using Scripts.",
        "Name aliases after destinations (ocean), macros after rituals (morning).",
      ]),
    ])
  );

  add(
    P("storage", "Where data lives", "Per-app JSON under Electron userData", ["data"], [
      kicker("Data"),
      p(
        "Most myapps persist JSON files under the Electron userData directory (app name my-space on this machine). Examples: day-planner tasks, translate history,  vault ciphertext blobs."
      ),
      h2("Implications"),
      ul([
        "No automatic cloud sync: use backup(export) if you care.",
        "Reinstalling the app without wiping userData keeps state.",
        "reset layout on the desktop does not wipe app JSON.",
        "Exports exist in several apps (Translate, Contacts, Console, …).",
      ]),
      h2("Docs storage"),
      p("docs.json stores bookmarks, lastPageId, and recent page ids."),
      tip("For developers: userData path is available via Electron app.getPath('userData')."),
    ])
  );

  add(
    P("vault-security", "Vault security", "Master password boundary in detail", ["data", "vault"], [
      kicker("Data"),
      p(
        "Vault encrypts secrets at rest under your master password. Unlock is interactive and happens only inside the Vault UI — the shell never prompts for the master password, and it must never appear in aliases, macros, scripts, or Docs."
      ),
      h2("Session model"),
      ul([
        "Locked — list/copy/mutate fail or return locked status.",
        "Unlocked — shell verbs can list, copy, add, and update entries for this session.",
        "Lock explicitly when you leave the machine: vault(lock).",
      ]),
      h2("Shell verbs"),
      code([
        "vault(status)",
        "vault(lock)",
        "vault(list)",
        "vault(search bank)",
        "vault(copy Gmail)",
        "vault(add Title | user | secret)",
      ]),
      h2("Hard rules"),
      ol([
        "Never store the master password in automation of any kind.",
        "Treat vault(list) / search output as sensitive on shared screens and recordings.",
        "Prefer vault(copy …) over printing secrets into the shell transcript.",
        "Back up Vault ciphertext with the rest of userData — losing the master password loses access.",
      ]),
      h2("Failure checklist"),
      table(
        ["Symptom", "Likely cause", "Fix"],
        [
          ["copy fails", "Locked session", "Unlock in Vault UI · vault(status)"],
          ["ambiguous match", "Similar titles", "Longer unique name or open Vault"],
          ["empty list", "No entries / locked", "status then unlock"],
        ]
      ),
      warn("If copy fails mysteriously, check status first: locked is the usual cause."),
      tip("Pair a leaving-desk habit: macro leave = vault(lock); a"),
    ])
  );

  add(
    P("settings", "Settings", "Per-app preferences and MSL toggles", ["data", "settings"], [
      kicker("Data"),
      p(
        "Each myapp can declare a schema in apps/shared/settings-definitions.js. Shared runtime renders toggles, selects, and related controls inside the app and persists values through settings.* IPC channels. Desktop-level Settings opens the global preferences surface."
      ),
      h2("Where settings live"),
      ul([
        "Per-app panel: open the app, use its Settings affordance.",
        "Shared definitions: single source of truth for keys and defaults.",
        "Persisted JSON under userData: survives restarts.",
      ]),
      h2("Common themes"),
      table(
        ["Theme", "Examples", "Why it matters"],
        [
          ["Language", "en / he for learning apps", "UI + quiz copy"],
          ["History", "saveHistory for Translate / Console", "Privacy vs recall"],
          ["MSL provider", "mslProvider kill-switches", "Rollback a published capability"],
          ["Behavior", "confirm clear, sync from desktop", "Safety / integration"],
        ]
      ),
      h2("Open"),
      code(["settings", "run settings"]),
      tip("Turning off an MSL provider is the supported rollback if a capability misbehaves — no code edit required."),
      note("Changing a setting does not always hot-reload every window; reopen the app if UI looks stale."),
    ])
  );

  add(
    P("space-files", ".space files", "Portable My Space documents. not MSL, not astronomy", ["protocols", "files", "pack"], [
      kicker("Protocols"),
      p("A .space file is a My Space document on disk: one script, flow, note, or study deck you can double-click, drag onto the desktop, or send to another machine. It is not MSL (msl:v1/… live links) and not the Space app (space(apod))."),
      h2("What it looks like"),
      p("UTF-8 JSON with format myspace.space, version 1, a kind, a title, and a payload. Secrets (apiKey, token, password) are stripped from flows on export."),
      code([
        "{",
        '  "format": "myspace.space",',
        '  "version": 1,',
        '  "kind": "script",',
        '  "title": "morning",',
        '  "payload": { "name": "morning", "body": "today(list)\\n" }',
        "}",
      ]),
      h2("Kinds"),
      table(
        ["kind", "Opens in", "Payload"],
        [
          ["script", "Scripts", "name + body"],
          ["flow", "Model Flow", "title, task, steps (saved to the Flow library)"],
          ["note", "Notes", "title, body, tags"],
          ["deck", "Study Deck", "name + cards (content only, not review stats)"],
        ]
      ),
      h2("Shell — pack(…), not space(…)"),
      p("space(…) already belongs to the Space astronomy app. The file protocol uses pack (aliases: spacefile, dotspace, mysfile)."),
      code([
        "pack(open C:\\\\Users\\\\you\\\\morning.space)",
        "pack(inspect morning.space)",
        "pack(pick)",
        "pack(export script morning)",
        "pack(export flow My plan)",
        "pack(export note Ideas)",
        "pack(export deck Spanish)",
        "open morning.space",
        "help pack",
      ]),
      h2("Import behavior"),
      ul([
        "Import creates a new copy. It never overwrites an existing script/note of the same name (scripts get a -2 suffix).",
        "Flows land in the Model Flow library, then open in the studio.",
        "Maximum size 2 MB. Unknown future versions are rejected with a clear error.",
      ]),
      h2("From the apps"),
      ul([
        "Scripts → Export .space",
        "Model Flow (review / after run) → Export .space",
        "Drag a .space file onto the My Space desktop",
      ]),
      h2("Windows"),
      p("Installed builds register the .space extension and the myspace:// URL scheme. Dev npm start still opens files passed on the command line or dropped on the window."),
      tip("Full-system zip is still backup(export). .space is one object, not the whole OS."),
      h2("Related"),
      p("backups, app-scripts, app-flow, msl, cmd-protocol."),
    ])
  );

  add(
    P("backups", "Backups & export", "How to not lose your personal OS", ["data"], [
      kicker("Data"),
      p(
        "My Space is local-first. There is no automatic cloud sync. Your personal OS lives in the Electron userData folder (plus desktop config in dev). Use the built-in backup commands for a one-click zip export and restore."
      ),
      h2("One-click backup (recommended)"),
      code([
        "backup(export)",
        "backup(status)",
        "backup(path)",
      ]),
      ul([
        "backup(export): pick a .zip destination; archives userData (+ desktop-user-config in dev).",
        "backup(import): choose a zip; My Space stages it and restarts to apply.",
        "backup(path): open the live data folder in Explorer.",
        "Settings → Maintenance: same actions with buttons.",
      ]),
      h2("Manual copy (still valid)"),
      ol([
        "Quit My Space completely (not just close a child window).",
        "Locate %APPDATA%\\my-space (or backup(path)).",
        "Copy the entire folder to an external drive or encrypted archive.",
        "Optionally keep a dated copy (YYYY-MM-DD) so you can roll back.",
      ]),
      h2("In-app exports"),
      ul([
        "Translate / Contacts / Console / Contracts: use each app’s export where available.",
        "Scripts / Model Flow: Export .space for a single script or flow (docs(open space-files)).",
        "Export is complementary to a full backup, not a replacement.",
        "Keep a plain-text note of critical macros if you iterate often.",
      ]),
      h2("What to prioritize"),
      table(
        ["Asset", "Why", "Notes"],
        [
          ["Vault ciphertext", "Secrets", "Still encrypted: protect the archive"],
          ["Today / Contacts / Builds", "Daily inventory", "High churn"],
          ["Scripts + Console", "Automation", "Hard to recreate from memory"],
          ["Docs bookmarks", "Navigation", "Optional"],
          ["Layout / pins", "Desktop feel", "reset layout does not wipe app JSON"],
        ]
      ),
      h2("Restore"),
      ol([
        "backup(import) and confirm — or quit and replace userData manually.",
        "After restart, unlock Vault once and run scripts(list) · today(list).",
      ]),
      tip("Schedule a monthly backup(export) alias if this desktop holds real work."),
      warn("Prefer backup(import) over hand-copying while My Space is running — mid-write JSON can corrupt."),
      note("help backup · docs(open backups)"),
    ])
  );

  add(
    P("recipe-morning", "Recipe · Morning", "Start the day in one macro", ["recipes"], [
      kicker("Recipes"),
      p(
        "A morning ritual should answer three questions fast: what is on my plate, is the machine healthy, and did anything drift overnight — without opening a wall of windows."
      ),
      h2("Starter script (shipped)"),
      code(["scripts(run morning)", "scripts(open morning)"]),
      p(
        "A morning starter is seeded into Scripts on first use (and merged by name if missing). It uses fn / let for a silent pulse — edit freely; your edits are never overwritten."
      ),
      h2("Silent macro alternative"),
      code([
        "macro morning = today(list); sys(cpu); stocks(list); drift(list today)",
        "macro morning",
      ]),
      h2("What each step does"),
      table(
        ["Step", "Intent", "Window?"],
        [
          ["today(list)", "See open tasks", "Silent (refresh if open)"],
          ["sys(cpu)", "Quick health pulse", "Silent"],
          ["stocks(list)", "Watchlist snapshot", "Silent"],
          ["drift(list today)", "Overnight activity", "Silent"],
        ]
      ),
      h2("UI variant (weekends / planning days)"),
      code(["macro morning-ui = macro morning; focus today; run builds"]),
      h2("Customize"),
      ul([
        "Swap stocks(list) for contracts(upcoming) if you care more about deadlines.",
        "Add weather/news via an external run only in the -ui variant.",
        "Keep the silent macro as the muscle-memory default.",
      ]),
      tip("Keep the silent macro as default; add a -ui variant for weekends."),
      note("If morning feels slow, trim to today(list); drift(list today) and run the rest on demand."),
    ])
  );

  add(
    P("recipe-focus", "Recipe · Focus block", "Timer + quiet desktop", ["recipes"], [
      kicker("Recipes"),
      p(
        "Focus blocks work when the desktop stops competing for attention. Close noise, start a named timer, and leave one breadcrumb task for the end."
      ),
      h2("Starter script (shipped)"),
      code(["scripts(run focus)", "scripts(open focus)"]),
      h2("Enter focus (macro)"),
      code([
        "macro focus = a; clock(timer 50m Deep work); today(add Review notes)",
        "macro focus",
      ]),
      h2("Step notes"),
      ul([
        "a — closes child windows (destructive on purpose; omit if you need a reference window).",
        "clock(timer 50m Deep work) — classic deep-work length; change duration freely.",
        "today(add Review notes) — a landing task so the block has a clear exit.",
      ]),
      h2("Pomodoro alternative"),
      code([
        "macro pomo = clock(pomodoro)",
        "macro pomo",
      ]),
      h2("Exit focus"),
      code(["today(list)", "drift(list today)", "today(toggle Review notes)"]),
      tip("If you need music or docs open, replace a with selective close <app> calls."),
      warn("Do not put vault(copy …) inside an auto-start focus macro on shared machines."),
    ])
  );

  add(
    P("recipe-dev", "Recipe · Dev session", "Projects, drift, and lexicon", ["recipes"], [
      kicker("Recipes"),
      p(
        "A developer session should load context (projects + recent file activity), optionally refresh language memory, then open the editor last so inventory verbs stay silent and fast."
      ),
      h2("Manual sequence"),
      code([
        "builds(list)",
        "builds(get MySpace)",
        "drift(scan)",
        "drift(list today)",
        "lexicon(search promise)",
        "run cursor",
      ]),
      h2("Macro form"),
      code(["macro dev = builds(list); drift(scan); run cursor", "macro dev"]),
      h2("Optional enrichments"),
      ul([
        "lexicon(daily): one word warm-up before coding.",
        "studies(list): if you keep session notes in Studies.",
        "sys(memory): when the machine feels heavy before a build.",
      ]),
      h2("End of session"),
      code(["macro ship = drift(scan); builds(list); today(add Ship notes)"]),
      tip("Put run cursor / run \"vs code\" at the end so silent lists print before the editor steals focus."),
      note("Ambiguous project names → pass a longer Builds title or open Builds UI once."),
    ])
  );

  add(
    P("recipe-travel", "Recipe · Travel planning", "Geo + translate + contacts", ["recipes"], [
      kicker("Recipes"),
      p(
        "Travel prep is a research loop: learn the place, keep phrases ready, and pin people/places you will actually contact. Keep everything silent until you want a map."
      ),
      h2("Country brief"),
      code([
        "geo(get JP)",
        "geo(learn Japan)",
        "geo(search kyoto)",
        "geo(open JP)          # only when you want the map UI",
      ]),
      h2("Language kit"),
      code([
        "translate(Where is the station? to:ja)",
        "translate(One coffee please -> ja)",
        "translate(history)",
        "translate(languages)",
      ]),
      h2("People & places"),
      code([
        "contacts(search hotel)",
        "contacts(search airport)",
        "contacts(add Hotel Kyoto | +81… | hotel@…)",
      ]),
      h2("Pack as a macro"),
      code([
        "macro trip-jp = geo(get JP); geo(learn Japan); translate(history)",
        "macro trip-jp",
      ]),
      tip("Save useful phrases in Translate history (or an alias to a fixed translate(…))."),
      note("Detect + flip behavior: if source equals target, Translate may flip: override with explicit to:."),
    ])
  );

  add(
    P("recipe-eod", "Recipe · End of day", "Review, then clear the slate", ["recipes"], [
      kicker("Recipes"),
      p(
        "End of day should close the loop: see what is still open, skim activity, then clear finished tasks so tomorrow starts honest."
      ),
      h2("Starter script (shipped)"),
      code(["scripts(run eod)", "scripts(open eod)"]),
      h2("Macro form"),
      code([
        "macro eod = today(list); drift(list today); builds(list); today(clear done)",
        "macro eod",
      ]),
      tip("If you prefer a weekly deep clean, use recipe-weekly instead of clearing done every night."),
      warn("today(clear done) removes completed tasks — keep it out of morning scripts."),
    ])
  );

  add(
    P("recipe-weekly", "Recipe · Weekly review", "Clear, reflect, rescan", ["recipes"], [
      kicker("Recipes"),
      p(
        "A weekly review clears finished work, rescans activity, and surfaces commitments you might have forgotten — then leaves room for human journaling."
      ),
      h2("Core macro"),
      code([
        "macro weekly = today(clear done); drift(scan); drift(insights); builds(list); contracts(upcoming)",
        "macro weekly",
      ]),
      h2("What each step buys you"),
      table(
        ["Step", "Outcome"],
        [
          ["today(clear done)", "Reset completed tasks so Today stays honest"],
          ["drift(scan)", "Fresh activity picture"],
          ["drift(insights)", "Patterns / hot zones"],
          ["builds(list)", "Project inventory check"],
          ["contracts(upcoming)", "Deadlines you should not miss"],
        ]
      ),
      h2("After the macro"),
      ol([
        "Skim the shell transcript: note surprises.",
        "Optionally open Studies or Docs bookmarks for a short journal.",
        "Add 1–3 concrete tasks: today(add …).",
        "If vault work is needed, unlock Vault once and finish secrets there.",
      ]),
      h2("Soft UI variant"),
      code(["macro weekly-ui = macro weekly; focus today; run contracts"]),
      tip("Run weekly on a fixed weekday alias so muscle memory sticks."),
      warn("today(clear done) is intentional cleanup: do not put it in morning macros by accident."),
    ])
  );

  add(
    P("recipe-remote", "Recipe · Remote day", "Machines, checks, and wake", ["recipes"], [
      kicker("Recipes"),
      p(
        "Remote days fail when you connect before the machine is ready. Inventory → health → wake → wait → connect is the reliable order."
      ),
      h2("Starter script (shipped)"),
      code(["scripts(run remote)", "scripts(open remote)"]),
      h2("Safe sequence"),
      code([
        "remote(list)",
        "remote(tools)",
        "remote(check)",
        "remote(check Office)",
        "remote(wake Office)",
        "wait 30s",
        "remote(connect Office)",
      ]),
      h2("Macro form"),
      code([
        "macro office = remote(check Office); remote(wake Office); wait 30s; remote(connect Office)",
        "macro office",
      ]),
      h2("Troubleshooting ladder"),
      ol([
        "remote(tools) — is the client toolchain present?",
        "remote(check) — is the host reachable / configured?",
        "Confirm MAC / subnet for Wake-on-LAN.",
        "Increase wait if the machine boots slowly.",
        "Only then remote(connect …).",
      ]),
      h2("End of day"),
      code(["remote(list)", "# lock/sleep the remote machine from its own OS if needed"]),
      warn("Wake-on-LAN requires a stored MAC and a network path that can reach the target."),
      tip("Keep machine display names short and unique so remote(check Office) never ambiguously matches."),
    ])
  );

  add(
    P("command-index", "Command index", "Jump table from app → handbook page → live help", ["reference", "commands"], [
      kicker("Reference"),
      p(
        "Use this page when you already know the app name and want the deep handbook article plus the live shell help command. Detailed verb tables live on each app-* page — this index does not replace them."
      ),
      table(
        ["App", "Module / aliases", "Docs page", "Live help"],
        [
          ["Docs", "docs", "app-docs", "help docs"],
          ["Clock", "world-clock · clock", "app-clock", "help clock"],
          ["Today", "day-planner · today", "app-today", "help today"],
          ["Tasks", "tasks · gtd · todo", "app-tasks", "help tasks"],
          ["Vault", "profiles · vault", "app-vault", "help vault"],
          ["Contacts", "contacts", "app-contacts", "help contacts"],
          ["Notes", "notes · note", "app-notes", "help notes"],
          ["Chat", "chat · aichat", "app-chat", "help chat · chat(new)"],
          ["Stocks", "stocks", "app-stocks", "help stocks"],
          ["Builds", "builds", "app-builds", "help builds"],
          ["Drift", "drift", "app-drift", "help drift"],
          ["Remote Hub", "remote-hub · remote", "app-remote", "help remote"],
          ["System Info", "system-info · sys", "app-sysinfo", "help sys"],
          ["Studies", "studies", "app-studies", "help studies"],
          ["Study Deck", "study-deck · decks", "app-decks", "help decks"],
          ["Translate", "translate", "app-translate", "help translate"],
          ["Geography", "geography · geo", "app-geo", "help geo"],
          ["Learning Games", "flag-quiz · flags", "app-flags", "help flags"],
          ["History", "history", "app-history", "help history"],
          ["Space", "space", "app-space", "help space"],
          ["Contracts", "contracts", "app-contracts", "help contracts"],
          ["MSL", "platform · msl", "app-msl", "help msl · msl(panel)"],
          ["Jobs", "platform · jobs", "app-jobs", "help jobs · jobs(panel)"],
          ["Mind", "platform · mind", "app-mind", "help mind · mind(panel)"],
          ["Code Lexicon", "code-lexicon · lexicon", "app-lexicon", "help lexicon"],
          ["Model Flow", "model-flow · flow", "app-flow", "help flow"],
          ["Console", "shell-console · console", "app-console", "help console"],
          ["Scripts", "scripts · script", "app-scripts", "help scripts"],
          ["World Maps", "world-maps · maps", "app-maps", "help maps"],
          ["Pi Digits", "pi-digits (UI)", "app-pi", "run pi-digits"],
          ["Icon Library", "icon-library (UI)", "app-icons", "run icon-library"],
          ["Welcome", "builtin", "app-welcome", "welcome"],
          ["Info", "apps-info", "app-info", "run info"],
          ["Externals", "edge · docker · vscode · …", "app-external", "run edge"],
        ]
      ),
      h2("Protocol & discovery"),
      code([
        "docs(open cmd-protocol)",
        "docs(open shell-language)",
        "help",
        "help grammar",
        "help scripts",
        "help maps",
        "check routes",
        "check routes clock",
      ]),
      tip("If Docs and help disagree after an update, Restart & Update, then trust help <app>."),
      note("Pi Digits / Icon Library / Welcome / Info remain UI-first (launch via run). help lists every commands:true app automatically."),
    ])
  );

  add(
    P("settings-index", "Settings catalog", "What each app can configure", ["data", "settings"], [
      kicker("Data"),
      p(
        "Per-app settings are declared in apps/shared/settings-definitions.js and rendered by the shared settings runtime. Open an app’s Settings panel, or jump to desktop settings. Turning off an MSL provider toggle is the supported rollback if a published capability misbehaves."
      ),
      h2("How to open"),
      code(["settings", "run settings"]),
      p("Then open the specific app and use its gear / Settings affordance for module-specific keys."),
      h2("Themes you will see"),
      table(
        ["Theme", "Typical keys", "Apps"],
        [
          ["MSL provider", "mslProvider / publish toggles", "Most providers (Translate, Space, Builds, …)"],
          ["History / privacy", "saveHistory", "Translate, Console, …"],
          ["Language", "en / he UI", "Learning apps, Flags, Pi Digits, …"],
          ["Scan / refresh", "intervals, background scan", "Drift, Builds, Stocks"],
          ["Confirmations", "confirmDelete / confirm clear", "Builds, Vault, …"],
          ["Display", "layout, counts, appearance", "Stocks, Builds, …"],
        ]
      ),
      h2("Module highlights"),
      ul([
        "Builds — auto-refresh trees, confirm delete, MSL icons, publish projects over MSL.",
        "Drift — background scan, interval, desktop notifications.",
        "Stocks — quote refresh, after-hours, UI layout classic/organized, alerts.",
        "Translate — history, language defaults, MSL publish.",
        "Contacts — reminders, MSL.",
        "Vault — display / security-adjacent options (unlock remains UI-only).",
        "Geography / History / Space / Maps — explore/viewer/reading preferences + MSL.",
        "Studies — document/Gemini-related prefs + MSL.",
        "Pi Digits — practice chunk size / language.",
        "Icon Library — preview + MSL icons.search.",
        "Docs — reading prefs for this handbook.",
        "Console — history / runner behavior.",
        "Remote Hub — connection defaults.",
      ]),
      tip("After flipping a setting, reopen the app if the UI looks stale: not every control hot-reloads every surface."),
      note("This catalog summarizes themes; the live Settings UI is authoritative for defaults and hints."),
      warn("Do not disable MSL providers mid-macro that depends on them: macros will fail closed."),
    ])
  );

  add(
    P("glossary", "Glossary", "Shared vocabulary", ["reference"], [
      kicker("Reference"),
      table(
        ["Term", "Meaning"],
        [
          ["myapp", "First-party app under apps/<module> with optional IPC"],
          ["module", "Id used by IPC, settings schema, and ROUTE_REGISTRY"],
          ["ROUTE_REGISTRY", "Shell map of pages, aliases, deep links, commands"],
          ["app(verb)", "Unified command protocol without requiring run"],
          ["silent action", "Command that returns text and does not force-open UI"],
          ["syncIfOpen", "Refresh UI only if the app window already exists"],
          ["MSL", "My Space Link: cross-app capability protocol"],
          ["capability", "Named MSL action/query a provider publishes"],
          ["alias", "Named shortcut expanding to one command"],
          ["macro", "Named chain of commands"],
          ["when", "Event-triggered automation rule"],
          ["userData", "Electron folder for persistent JSON"],
          ["classic route", "key:value or bare page form via run app(…)"],
          ["preload", "Bridge exposing myApp / mySpace APIs to renderer"],
        ]
      ),
    ])
  );

  add(
    P("faq", "FAQ", "Common questions", ["reference"], [
      kicker("Reference"),
      h2("Why didn’t the app open?"),
      p("Many verbs are silent on purpose. Use open or a page name: today(tomorrow), stocks(portfolio), geo(open IL)."),
      h2("Why did translate pick English?"),
      p("Hebrew-heavy (and similar) text defaults toward English so you do not translate Hebrew→Hebrew. Override with to:he or -> he."),
      h2("Vault says locked"),
      p("Unlock once in the Vault window, then retry vault(copy …)."),
      h2("Ambiguous match"),
      p("Several contacts/projects/decks share a prefix. Pass a longer unique name or an id."),
      h2("Where are Scripts / Maps verbs?"),
      p("Both are on the protocol: scripts(list/run/…) and maps(geocode/notes/…). See help scripts · help maps · app-scripts · app-maps."),
      h2("Command missing after update"),
      p("Click Restart & Update, then help <app>."),
    ])
  );

  add(
    P("troubleshooting", "Troubleshooting", "Symptom → cause → fix", ["reference"], [
      kicker("Reference"),
      table(
        ["Symptom", "Cause", "Fix"],
        [
          ["Shell API unavailable", "Old preload / no restart", "Restart & Update"],
          ["Unknown channels", "Module IPC not wired", "Update; verify ALLOWED_MODULES"],
          ["Scan empty on non-Windows", "Platform limits", "Expected placeholders"],
          ["Remote connect fails", "Tool missing / host down", "remote(tools) · remote(check)"],
          ["Drift too noisy", "Zones broad", "Tighten zones · drift(pause)"],
          ["Macro opens too many windows", "Used run/page verbs", "Switch to silent verbs"],
          ["Docs search empty", "Typo / new page not in catalog", "docs(list) · broader term"],
        ]
      ),
      tip("docs(search error) often lands near shell-errors."),
    ])
  );

  add(
    P("changelog", "Changelog highlights", "Docs-relevant shell & protocol evolution", ["reference", "updates"], [
      kicker("Reference"),
      ul([
        "0.1.52: Chat app: ChatGPT-style AI history powered by Mind",
        "0.1.51: Mind by task: Quick / Everyday / Deep model tiers",
        "0.1.50: Mind platform: OS AI runtime (Gemini + optional Ollama), mind(…), MSL mind.ask / mind.status",
        "0.1.49: Jobs Connect boost pool",
        "0.1.48: Jobs capacity pools (Interactive / Shell / Background)",
        "0.1.47: Jobs becomes the OS runtime for launches & shell",
        "0.1.46: Jobs platform service",
        "0.1.45: MSL as platform service (no app tile)",
        "0.1.38: .space files: portable Scripts/Flow/Notes/Decks; pack(open/export); Windows file association",
        "0.1.37: Vault entries listed A–Z by name (existing secrets unchanged)",
        "0.1.36: Learning Games Countries: Independence theme (independent / territory / other)",
        "0.1.35: Model Flow studio depth: blank/templates, step editor, saved library, retry from failed, wait tool",
        "0.1.34: Flow: shell/stocks/translate/contacts live; Save as script; Notes MSL (list/search/get/add)",
        "0.1.31: Notes app: notebooks, tags, pin/archive, notes(…) shell, notes.json persistence",
        "0.1.21: Shell language: let / $vars / result capture / fn functions; Scripts run as one program scope",
        "0.1.20: Scripts + Maps on app(verb); help auto-lists every commands:true module",
        "0.1.19: Exhaustive Docs: every settings key, all 51 MSL capabilities, architecture/IPC/mySpace bridge, userData map, desktop config, updates system",
        "0.1.18: Full handbook: per-app deep pages, command index, settings catalog, newcomer reading path",
        "0.1.17: Docs handbook expanded with deeper articles & more categories/pages",
        "0.1.16: Docs app launched (categories, search, bookmarks, docs(…))",
        "0.1.15: Contracts, MSL, Lexicon, Flow, Console commands",
        "0.1.14: Studies, Geo, Flags, History, Space commands",
        "0.1.13: Translate accuracy + Remote Hub commands",
        "0.1.12: Contacts, Translate, SysInfo commands",
        "0.1.11: Drift & Study Deck commands",
        "0.1.10: Silent-by-default actions",
        "0.1.9: Builds & Vault commands",
        "0.1.8: Stocks commands",
        "0.1.7: Today commands",
        "0.1.6: Unified app(verb) protocol",
        "0.1.5: Clock shell timers",
        "0.1.3: Scripts app",
      ]),
      tip("Use Restart & Update when a banner appears so the shell and Docs stay aligned."),
    ])
  );
  (window.DOCS_GROUPS || []).forEach((g) => {
    g.pages.forEach((pid) => {
      if (PAGES[pid]) PAGES[pid].group = g.id;
    });
  });

  window.DOCS_PAGES = PAGES;
  window.DOCS_PAGE_LIST = Object.keys(PAGES).map((id) => PAGES[id]);
})();