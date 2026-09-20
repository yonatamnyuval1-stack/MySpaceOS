(function () {
  const { P, h2, p, note, tip, warn, code, ul, ol, table, kicker } = window.DocsBlocks;
  const PAGES = window.DOCS_PAGES || (window.DOCS_PAGES = {});

  function add(page) {
    PAGES[page.id] = page;
  }

  add(
    P("how-to-read-docs", "How to read this handbook", "Kickers, tables, silence, and how pages connect", ["docs","guide","beginner"], [
      kicker("Docs"),
      p("Docs is the My Space handbook: a searchable set of articles that explain the desktop, the shell language, each first-party app, protocols, and copy-paste recipes. Every page is built from the same block types so the layout stays predictable while you learn."),
      p("You do not need to memorize the catalog. Follow Start → Shell → Apps in the sidebar, then Protocols / Automation when you are ready to connect things. Use docs(search …) whenever a word looks unfamiliar."),
      p("App pages (ids starting with app-) are the deep handbook for each product: purpose, UI surfaces, full shell verbs, a typical workflow, and gotchas. cmd-protocol explains the shared grammar; command-index is the jump table."),
      p("This guide teaches you how to read those articles so beginners can move from “what is this?” to “I can automate it” without drowning in source code."),
      h2("Anatomy of a page"),
      ul(["Kicker: small label (Start, Shell, Apps, Commands…). It tells you which mental shelf the article lives on.","Paragraphs: the story: who the app is for and how it fits My Space.","h2 sections: Open it, Surfaces / pages, Shell commands, Typical workflow, Related.","Tables: Verb | What it does | Silent? is the standard command map.","code blocks: copyable shell lines. Prefer these over paraphrasing verbs from memory.","tip / note / warn: Tip is optional speed; Note is context; Watch out is safety or lock behavior."]),
      h2("Silent vs open"),
      p("Many verbs return a short shell message without focusing a window (silent). Verbs like open, bare page names, quiz, and study usually launch or navigate the UI. If a window is already open, silent verbs often refresh it quietly (syncIfOpen). That design lets macros inspect state during focus work."),
      table(["Intent","Example","Expect"], [["Read / inspect","stocks(quote AAPL)","Silent summary"],["Mutate","today(add Buy milk)","Silent; UI syncs if open"],["Navigate","clock(timer), run builds","Opens or focuses UI"]]),
      h2("Finding the right article"),
      code(["docs(overview)","docs(search timer)","docs(open app-clock)","docs(open cmd-protocol)","docs(list)","docs(bookmarks)"]),
      tip("Bookmark pages you revisit (☆ in the top bar). docs(bookmarks) jumps back to that list."),
      note("After Restart & Update, new verbs appear in help <app> and should be mirrored here. If Docs and help disagree, trust the live shell and check Changelog."),
      h2("Page ids are stable APIs"),
      p("Treat page ids like routes: app-clock, cmd-protocol, recipe-morning. They appear in the top bar Copy id button and in docs(open …). Prefer ids in macros over fragile title matching."),
      h2("What “detailed” means here"),
      ul(["Enough context that a beginner understands why the app exists.","Enough verbs that help <app> is not your only reference.","Enough warnings that Vault/MSL mistakes are unlikely.","Pointers outward so you are never stuck on a dead-end article."]),
      code(["docs(open how-to-read-docs)","docs(open apps-directory)","docs(open app-today)"]),
      h2("Related"),
      p("Read overview and mental-model first, then cmd-protocol, then any app-* page. apps-directory is the full table of first-party apps."),
    ])
  );

  add(
    P("cmd-protocol", "App command protocol", "app(verb args). no run required", ["commands","protocol"], [
      kicker("Commands"),
      p("The unified command protocol is the spine of My Space automation. Apps that opt in with commands: true in the route registry accept app(verb …) directly. you do not need the run keyword. The same line almost always works as run app(verb …) for classical muscle memory."),
      p("Think of each wired app as a small CLI: verbs read state, mutate state, or open a surface. Arguments are free-form text after the verb (spaces, pipes, arrows, durations). Ambiguous names usually return a short disambiguation list instead of guessing wrongly."),
      p("This page is the thorough protocol reference. Per-app verb tables live on app-* pages (for example app-clock, app-today, app-stocks). Use command-index when you only need a jump link."),
      h2("Grammar"),
      code(["clock(timer 25m)","today(add Ship report tomorrow)","stocks(quote AAPL)","geo(get IL)","run geography(country:IL)          # classic key:value deep link","macro desk = today(list); stocks(list); drift(list today)"]),
      h2("Rules of silence (0.1.10+)"),
      ul(["list / search / get / quote / scan / add / watch / detect / status → usually silent shell messages.","If the app window is already open, syncIfOpen refreshes UI quietly.","open / bare page names / study / quiz → launch or navigate.","Some verbs spawn external tools (remote connect, mailto, tel) without opening My Space chrome.","Vault never unlocks from the shell — unlock only in the Vault window."]),
      h2("Classic key:value still works"),
      p("Older deep links use run app(key:value, …). Prefer the verb protocol for scripts and macros; keep classic forms when you need a precise UI deep link (especially geography and some translate forms)."),
      code(["run geography(country:IL)","run translate(text:hello, to:he)"]),
      h2("Discovery"),
      code(["help clock","help today","check routes clock","docs(search pomodoro)","docs(open apps-directory)"]),
      h2("Authoring macros & scripts"),
      p("Chain silent reads for dashboards; open windows only when a human should look. Prefer unique substrings for name matching. Put long sequences in the Scripts app (run scripts(name))."),
      code(["macro morning: today(list); stocks(list); sys(cpu); drift(list today)","macro morning"]),
      warn("Never put master passwords, API keys, or unlock secrets into shell lines, aliases, or scripts. Vault unlock and sensitive MSL work belong in UI."),
      tip("Wired modules include Clock, Today, Stocks, Builds, Vault, Drift, Decks, Contacts, Translate, SysInfo, Remote, Studies, Geo, Flags, History, Space, Contracts, MSL, Lexicon, Flow, Console, Docs — and growing."),
      h2("Resolution order (mental sketch)"),
      ol(["Parse app(…) vs run app(…) vs classic key:value.","Resolve app aliases (clock → world-clock, geo → geography).","Dispatch verb to the app’s command handler.","Decide silent message vs launch/focus vs external spawn.","syncIfOpen when a window already exists."]),
      h2("Common failure modes"),
      table(["Symptom","Likely cause","Fix"], [["Unknown app","Typo or missing alias","help / check routes / docs(search)"],["Ambiguous name","Two tasks/contacts share a title","Use a longer unique substring or id"],["Vault refused","Locked vault","Unlock in UI, vault(status)"],["Nothing opened","Silent verb by design","Add open or check shell message"]]),
      note("Protocol pages under Commands remain useful summaries; this page plus app-* pages are the deep cut."),
      h2("Related"),
      p("shell-language, shell-chaining, silent-actions, sync-if-open, apps-directory, and every app-* page."),
    ])
  );

  add(
    P("apps-directory", "Apps directory", "Every first-party app at a glance", ["apps"], [
      kicker("Apps"),
      p("This directory is the map of My Space applications: builtins, myapps, and external pins. Use it to jump to a detailed app-* article or to remember the preferred shell entry for each module."),
      p("First-party myapps live under apps/<module> with optional main IPC. External entries are executables or URLs from config/apps.json — they launch like desktop apps but do not expose app(verb) protocols."),
      h2("First-party apps"),
      table(["App","Module","Shell","Docs page","Role"], [["Welcome","builtin","welcome / run welcome","app-welcome","Command center"],["Info","apps-info","run info · apps-info","app-info","Activity digests"],["Docs","docs","docs(…)","app-docs","This handbook"],["Connect","mail","run mail · run connect","app-connect","Mail, messaging, browsers & web apps"],["Notifications","shell","bell · Settings in inbox","app-notifications","Desktop & mail alerts"],["MSL","platform","msl(panel) · msl(…)","app-msl","Capability bus (major platform service)"],["Jobs","platform","jobs(panel) · jobs(…)","app-jobs","Compute queue + capacity contract"],["Mind","platform","mind(panel) · mind(ask …)","app-mind","OS AI runtime (Gemini / Ollama)"],["Files","files","files(…) · files(panel)","app-files","Browse this PC"],["System Info","system-info","sys(…) · sysinfo(…)","app-sysinfo","Scans"],["Clock","world-clock","clock(…)","app-clock","Time & timers"],["Remote Hub","remote-hub","remote(…)","app-remote","RDP / SSH / WoL"],["Studies","studies","studies(…)","app-studies","Long documents"],["Study Deck","study-deck","decks(…) · studydeck(…)","app-decks","Flashcards"],["Today","day-planner","today(…)","app-today","Agenda"],["Tasks","tasks","tasks(…) · gtd · todo","app-tasks","Projects & next actions"],["Vault","profiles","vault(…)","app-vault","Secrets"],["World Maps","world-maps","run maps","app-maps","Map explorer"],["Stocks","stocks","stocks(…)","app-stocks","Markets"],["Translate","translate","translate(…)","app-translate","Languages"],["Contacts","contacts","contacts(…)","app-contacts","People"],["Notes","notes · note","notes(…)","app-notes","Quick capture"],["Chat","chat","chat(…)","app-chat","AI chat via Mind"],["Geography","geography","geo(…) · geography(…)","app-geo","Countries"],["Learning Games","flag-quiz","flags(…)","app-flags","Quizzes"],["Pi Digits","pi-digits","run pi-digits","app-pi","Memorize π"],["Icon Library","icon-library","run icon-library","app-icons","Icons"],["History","history","history(…)","app-history","Figures & events"],["Space","space","space(…)","app-space","Cosmos / ocean / earth"],["Digital Contracts","contracts","contracts(…)","app-contracts","Contracts"],["Builds","builds","builds(…)","app-builds","Projects shelf"],["Code Lexicon","code-lexicon","lexicon(…)","app-lexicon","Concepts"],["Drift","drift","drift(…)","app-drift","Change timeline"],["Model Flow","model-flow","flow(…)","app-flow","AI tool flows"],["Console","shell-console","console(…)","app-console","Shell UI"],["Scripts","scripts","run scripts · run scripts(name)","app-scripts","Multi-step programs"]]),
      h2("External & URL pins"),
      table(["Name","Id","Kind","Docs"], [["Microsoft Edge","edge","external","app-external"],["Docker Desktop","docker","external","app-external"],["VS Code","vscode","external","app-external"],["Terminal","terminal","external","app-external"],["Cursor","cursor","external","app-external"],["GitHub","github","url","app-external"]]),
      note("Shell column shows the preferred entry. Apps without commands:true still open via run <name>."),
      tip("Open a deep article: docs(open app-clock), docs(search vault)"),
      h2("How to use this directory"),
      p("Start here when you know the human name of an app but not the module id or shell entry. Copy the Docs page id into docs(open …), or copy the Shell column into the desktop command line."),
      p("External pins are listed separately because they never grow app(verb) tables — if you catch yourself writing edge(list), you want a myapp instead."),
      h2("Grouping by job"),
      table(["Job","Start with","Also see"], [["Plan the day","app-today, app-tasks, app-clock","app-contacts, app-notes"],["Communicate & browse","app-connect, app-notifications","app-contacts, app-external"],["Ship code","app-builds, app-drift, app-external","app-console, app-scripts, app-files"],["Learn","app-decks, app-lexicon, app-flags, app-pi","app-studies"],["Ops / machines","app-sysinfo, app-remote, app-files","app-external"],["Secrets & people","app-vault, app-contacts","app-contracts"]]),
      tip("Search beats browsing: docs(search snooze) often lands faster than scrolling Apps."),
      note("This page overwrites the shorter apps-directory from catalog-pages.js when catalog-apps.js loads after it."),
      h2("Related"),
      p("how-to-read-docs, cmd-protocol, apps-windows, apps-external, overview."),
    ])
  );

  add(
    P("app-welcome", "Welcome", "Builtin command center: tips and quick actions", ["apps","welcome","builtin"], [
      kicker("Apps"),
      p("Welcome is the builtin command center of My Space. It is not a myapp folder under apps/: it is woven into the desktop shell as the friendly front door: tips, quick actions, and orientation when you sit down at the desk."),
      p("Who it is for: anyone opening My Space after idle time, new users learning what is pinned, and power users who want a calm surface before diving into Console or Scripts."),
      p("How it fits: Welcome does not own long-lived project data. It points outward — to apps, recipes in Docs, and habitual run / focus patterns. Think of it as the lobby, not the workshop."),
      p("There is no unified app(verb) protocol for Welcome. You open it, read tips, use quick actions, then leave into real work surfaces."),
      h2("Open it"),
      code(["welcome","run welcome","focus welcome"]),
      note("Exact aliases may vary with desktop config; if a name fails, try run welcome or open Welcome from the desktop."),
      h2("Surfaces / pages"),
      table(["Surface","What you see","Notes"], [["Home / command center","Tips, quick actions, orientation","Builtin UI"],["Quick actions","Shortcuts into common apps or recipes","Configurable with desktop habits"]]),
      h2("Shell commands"),
      p("Welcome has no verb table. Use desktop launch/focus only."),
      table(["Verb / form","What it does","Silent?"], [["(none)","No app(verb) protocol","—"],["run welcome / focus welcome","Open or focus the Welcome surface","No — navigates"]]),
      warn("Do not expect welcome(list) or similar — those verbs belong to other apps."),
      h2("Typical workflow"),
      ol(["Open Welcome after login or Restart & Update to see new tips.","Pick one quick action (Today, Docs, Clock) instead of hunting icons.","When comfortable, graduate to Console aliases and Scripts for the same actions."]),
      tip("Pair Welcome with docs(open how-to-read-docs) on day one."),
      h2("When Welcome helps most"),
      ul(["First launch after install or Restart & Update.","Returning from vacation when muscle memory is cold.","Showing My Space to someone new without opening Console."]),
      h2("What Welcome is not"),
      p("It is not Docs, not Console, and not a replacement for Scripts. If you find yourself living only in Welcome tips, graduate those tips into aliases."),
      code(["run welcome","docs(open quick-start)","docs(open recipe-morning)"]),
      h2("Related"),
      p("app-docs, app-console, app-info, quick-start, overview."),
    ])
  );

  add(
    P("app-info", "Info (apps-info)", "Digests of what happened inside apps", ["apps","info","apps-info"], [
      kicker("Apps"),
      p("Info (module apps-info) collects digests of what happened across My Space apps: logos, names, and a fuller record of in-app activity. It answers “what did I just do?” after quizzes, study sessions, timers, or long work stretches."),
      p("Who it is for: people who bounce between many myapps and want a single place to skim recent activity without opening each tool."),
      p("How it fits: Info is a meta surface. It does not replace Drift (filesystem change) or Console history (shell lines). It focuses on app-level narratives and screen facts."),
      h2("Open it"),
      code(["run info","run apps-info","focus info","focus apps-info"]),
      h2("Surfaces / pages"),
      table(["Surface","What you see","Notes"], [["Digest / home","Cross-app activity summaries","Primary view"],["Per-app records","Deeper facts for a single app","When available in UI"]]),
      h2("Shell commands"),
      p("Info is primarily opened via run/focus. Prefer the UI for browsing digests."),
      table(["Verb / form","What it does","Silent?"], [["run info / run apps-info","Open Info","No"],["focus info","Focus existing window","No"]]),
      note("If you expected silent digests from the shell, open the Info window: verb coverage may stay intentionally thin."),
      h2("Typical workflow"),
      ol(["Finish a Learning Games quiz or Pomodoro block.","run info to skim what the session recorded.","Jump back into the originating app if you need details."]),
      tip("Combine with drift(list today) when you care about files changed vs apps visited."),
      h2("Info vs other histories"),
      table(["Tool","Records","Use when"], [["Info (apps-info)","In-app activity digests","What happened inside myapps"],["Console history","Shell lines","What you typed"],["Drift","Filesystem events","What files changed"],["Docs bookmarks","Handbook pages","What you decided to remember"]]),
      p("Beginners often open Info expecting Drift. If the question is “which files moved?”, go to app-drift. If the question is “which quiz did I finish?”, stay here."),
      code(["run info","drift(list today)","console(history)"]),
      h2("Related"),
      p("app-drift, app-flags, app-clock, app-console, apps-directory."),
    ])
  );

  add(
    P("app-docs", "Docs", "My Space handbook: shell, apps, protocols & recipes", ["apps","docs"], [
      kicker("Apps"),
      p("Docs is this handbook: categories, full-text search, bookmarks, and shell verbs so you can open articles without clicking the sidebar. It is the canonical human-readable mirror of shell behavior."),
      p("Who it is for: beginners learning My Space, and experts who want a verb table without reading source. Keep it pinned."),
      p("How it fits: Docs explains Console, Scripts, MSL, and every first-party app. It does not execute macros: it teaches you to write them."),
      h2("Open it"),
      code(["docs","run docs","docs(overview)","docs(open app-clock)","docs(search silent)"]),
      h2("Surfaces / pages"),
      table(["Surface","What you see","Notes"], [["Article stage","Current handbook page + TOC","Main reading view"],["Search results","Ranked hits across pages","From sidebar or docs(search)"],["Bookmarks","Saved page list","docs(bookmarks)"],["Category nav","Start / Shell / Commands / Apps / …","Sidebar groups"]]),
      h2("Shell commands"),
      code(["docs(overview)","docs(search timer)","docs(open cmd-protocol)","docs(open app-vault)","docs(list)","docs(bookmarks)","docs(help)"]),
      table(["Verb","What it does","Silent?"], [["overview","Open the overview article","No navigates"],["search <query>","Search handbook text","Usually opens results / focuses Docs"],["open <pageId>","Jump to a page id (e.g. app-clock)","No"],["list","List available pages / catalog","Often silent or summary"],["bookmarks","Open bookmarks list","No"],["help","Docs help string","Silent / message"]]),
      tip("Copy page id from the top bar, then docs(open <id>) from anywhere."),
      h2("Typical workflow"),
      ol(["docs(search vault) when stuck on unlock rules.","Bookmark cmd-protocol and your top three app-* pages.","After Restart & Update, skim changelog then help <app>."]),
      note("You are reading the Docs app. Page ids in Related can be opened with docs(open …)."),
      h2("Authoring mindset"),
      p("Docs pages are data: arrays of blocks: not Markdown files. That is why catalog-pages.js and catalog-apps.js exist. When you search, you search block text across those catalogs."),
      h2("Power moves"),
      code(["docs(search syncIfOpen)","docs(open silent-actions)","docs(open app-vault)","docs(bookmarks)"]),
      ul(["Use search for verbs (“snooze”, “wake”, “quote”).","Use open with ids from Related sections.","Bookmark protocol + your top three daily apps."]),
      h2("Related"),
      p("how-to-read-docs, cmd-protocol, apps-directory, glossary, faq."),
    ])
  );

  add(
    P("app-sysinfo", "System Info", "Ports, processes & machine scans", ["apps","sysinfo","system"], [
      kicker("Apps"),
      p("System Info (module system-info, aliases sysinfo / sys) is an on-demand scanner for CPU, memory, storage, processes, network, ports, environment, and performance snapshots. It is a focused slice of machine truth — not a full Task Manager replacement."),
      p("Who it is for: developers checking ports before bind, operators waking remote machines, anyone writing morning macros that print a one-line health blurb."),
      p("How it fits: SysInfo feeds awareness into Remote Hub (ports/network), Drift (why is disk busy?), and Scripts (gate a deploy on free memory). Scans are Windows-oriented."),
      h2("Open it"),
      code(["run system-info","run sysinfo","sysinfo(scan)","sys(open cpu)","sysinfo(open memory)"]),
      h2("Surfaces / pages"),
      table(["Surface","What you see","Notes"], [["Overview / scan","Aggregated machine snapshot","sysinfo(scan)"],["CPU","Processor load & related","sys(cpu) / open cpu"],["Memory","RAM pressure","sys(memory) · sys(ram)"],["Storage / disk","Volumes & free space","sys(storage) · sys(disk)"],["Processes","Running process list slice","sys(processes)"],["Network / ports","Adapters & listening ports","sys(network) · sys(ports)"],["Environment","Env-related facts","sys(environment)"],["Performance","Perf-oriented summary","sys(performance)"]]),
      h2("Shell commands"),
      code(["sysinfo(scan)","sys(system)","sys(cpu)","sys(memory)","sys(ram)","sys(storage)","sys(disk)","sys(processes)","sys(network)","sys(ports)","sys(environment)","sys(performance)","sysinfo(open cpu)","sys(open memory)","sys(help)"]),
      table(["Verb","What it does","Silent?"], [["scan / system","Broad scan summary","Yes (typical)"],["cpu","CPU summary","Yes"],["memory / ram","Memory summary","Yes"],["storage / disk","Disk / volume summary","Yes"],["processes","Process snapshot","Yes"],["network","Network summary","Yes"],["ports","Listening / notable ports","Yes"],["environment","Environment facts","Yes"],["performance","Performance summary","Yes"],["open <section>","Open UI on a section","No"],["help","Help string","Yes"]]),
      note("Non-Windows platforms may return limited placeholders."),
      h2("Typical workflow"),
      ol(["sys(ports) before starting a local server.","sys(cpu); sys(memory) inside a morning macro.","sys(open processes) when you need to kill something visually."]),
      tip("Use silent sys(…) lines inside macros — they are designed for status text."),
      h2("Reading scan results"),
      p("Each silent verb returns a compact string suitable for a shell message or macro log: not a full spreadsheet. When you need to act (kill a process, free a port), open the matching UI section."),
      h2("Recipe fragments"),
      code(["sys(cpu); sys(memory); sys(ports)","sys(open ports)","macro health = sys(cpu); sys(memory); sys(disk)"]),
      note("Ports output is especially useful before remote connect or local server boot."),
      warn("Do not treat SysInfo as a security audit: it is a convenience scanner."),
      h2("Related"),
      p("app-remote, app-drift, app-console, cmd-protocol, recipe-morning."),
    ])
  );

  add(
    P("app-files", "Files", "Browse this PC: places, preview & actions", ["apps","files","platform","explorer"], [
      kicker("Platform"),
      p("Files is a major platform service: an in-My-Space file browser for places, drives, favorites, recent paths, text/image preview, and common file actions (open, reveal, rename, new folder, Recycle Bin). It is not a desktop tile — open it from Platform → Files, the Files panel, or the shell."),
      p("Who it is for: anyone who needs to navigate this PC without leaving My Space, jump to Downloads/Desktop, pin project folders, or preview code and images before opening them outside."),
      p("How it fits: Files complements Builds (project trees), Drift (what changed), OS Bridge (phone / host places), and Search. Prefer Files for general browsing; prefer Builds when the folder is a linked project."),
      h2("Open it"),
      code(["files(panel)","files(open)","files(full)","files(downloads)","files(documents)","files(recent)","files(favorites)","Platform → Files"]),
      h2("Surfaces"),
      table(["Surface","What it is","Notes"], [["Panel","Quick places, drives, go-to path, recent, favorites","Default from Platform"],["Full app","Three-pane browser: sidebar · list · preview","files(full) / Full app"],["Browse","Places & drives","files(browse)"],["Recent","Recently opened paths","files(recent)"],["Favorites","Pinned folders","files(favorites)"],["Downloads / Documents","Jump straight to those folders","Opens full app"]]),
      h2("Shell commands"),
      code(["files(panel)","files(full)","files(list Downloads)","files(list C:\\\\Users)","files(open C:\\\\Users\\\\Public)","files(reveal PATH)","files(status)","files(help)"]),
      table(["Verb","What it does","Silent?"], [["panel / show","Open the platform panel","No"],["open / full","Open the full Files app","No"],["browse / recent / favorites","Open panel or surface","No"],["downloads / documents","Open that folder in the full app","No"],["list [PATH|place]","List folder contents in the shell","Yes"],["open PATH","Open a folder in Files or a file with the OS","No / may open"],["reveal PATH","Show in Windows Explorer","Yes"],["status","Places / favorites / recent counts","Yes"],["help","Help string","Yes"]]),
      h2("Inside the full app"),
      ul(["Sidebar: Places, Drives, Favorites (+), Recent.","Toolbar: back, up, refresh, breadcrumbs, go-to path, new folder, open in Explorer.","List: name, size, modified — filter and sort.","Preview: text & images; Open / Reveal / Copy path / Rename / Delete (Recycle Bin).","Keys: Backspace = up · Del = delete · F2 = rename · F5 = refresh · Ctrl+L = focus path."]),
      h2("MSL"),
      code(["files.home","files.places.list","files.dir.list","files.recent.list","files.path.open","files.file.reveal"]),
      tip("Pin project roots under Favorites so files(favorites) and the panel jump there in one click."),
      note("Delete moves to the Recycle Bin by default (not permanent wipe)."),
      h2("Related"),
      p("app-builds, app-drift, app-sysinfo, app-msl, cmd-protocol."),
    ])
  );

  add(
    P("app-clock", "Clock", "World clocks, timer, pomodoro & stopwatch", ["apps","clock","world-clock"], [
      kicker("Apps"),
      p("Clock (module world-clock, alias clock) is the time desk for My Space: local time, world clocks, meetings, countdown timers, pomodoro focus blocks, and a stopwatch. Timer state is persisted in main so countdowns keep running even when the Clock page is slow to load."),
      p("Who it is for: makers who time deep work, people coordinating across timezones, and anyone who wants shell-driven timers without opening another phone app."),
      p("How it fits: Clock pairs with Today (agenda) and Focus gate behavior during pomodoro. Global shortcuts like timer / pomodoro / stopwatch still rewrite into clock verbs for speed."),
      p("Prefer explicit clock(timer …) forms in scripts. Bare durations may be accepted as timer intents in some paths, but explicit verbs are clearer in macros."),
      h2("Open it"),
      code(["run clock","run world-clock","clock(local)","clock(world)","clock(meetings)","clock(timer)","clock(pomodoro)","clock(stopwatch)","focus clock"]),
      h2("Surfaces / pages"),
      table(["Page","What it is","Open with"], [["local","Local clock / home time surface","clock(local)"],["world","World clocks","clock(world)"],["meetings","Meeting-oriented times","clock(meetings)"],["timer","Countdown timer","clock(timer) / clock(timer 25m)"],["pomodoro","Focus / pomodoro sessions","clock(pomodoro) / clock(pomodoro start)"],["stopwatch","Stopwatch","clock(stopwatch)"]]),
      h2("Shell commands — timer"),
      code(["clock(timer 25m)","clock(timer 90s Focus)","clock(timer 25m label:Tea)","clock(timer pause)","clock(timer stop)","clock(timer status)"]),
      table(["Verb","What it does","Silent?"], [["timer <duration> [label]","Start / configure a countdown (25m, 90s, …)","Often silent + may sync UI"],["timer pause","Pause active timer","Yes / sync"],["timer stop","Stop timer","Yes / sync"],["timer status","Report timer state","Yes"],["timer (bare page)","Open timer page","No"]]),
      h2("Shell commands: pomodoro & stopwatch"),
      code(["clock(pomodoro start)","clock(pomodoro work:45)","clock(pomodoro pause)","clock(stopwatch)"]),
      table(["Verb","What it does","Silent?"], [["pomodoro start","Start a pomodoro / focus session","May open / sync"],["pomodoro work:<minutes>","Set work length then run (e.g. work:45)","May open / sync"],["pomodoro pause","Pause pomodoro","Yes / sync"],["stopwatch","Open / drive stopwatch","Usually navigates"]]),
      h2("Shell commands: pages & globals"),
      code(["clock(local) · clock(world) · clock(meetings)","clock(timer) · clock(pomodoro) · clock(stopwatch)","timer 25m          # global rewrite → clock","pomodoro start","stopwatch","clock(help)"]),
      table(["Verb / form","What it does","Silent?"], [["local / world / meetings","Open those pages","No"],["globals timer/pomodoro/stopwatch","Rewrite to clock equivalents","Depends on target verb"],["help","Help string","Yes"]]),
      note("Timer persistence lives in main process storage: closing the window should not erase an active countdown."),
      h2("Typical workflow"),
      ol(["clock(timer 25m Deep work) before a coding block.","clock(pomodoro work:45) for longer focus with breaks.","clock(world) when scheduling with remote teammates.","clock(timer status) from a macro without stealing focus."]),
      tip("Pair with today(list) in a morning macro: see agenda, then start a timer."),
      warn("Do not rely on vague bare numbers in shared scripts: write clock(timer 25m) explicitly."),
      h2("Choosing timer vs pomodoro vs stopwatch"),
      table(["Tool","Best for","Shell seed"], [["Timer","One countdown with optional label","clock(timer 25m Deep work)"],["Pomodoro","Repeating focus/break cadence","clock(pomodoro work:45)"],["Stopwatch","Measure elapsed without a target","clock(stopwatch)"]]),
      h2("Timezone & meetings"),
      p("World and meetings pages exist so you do not convert offsets in your head. Open them when scheduling across regions; keep timer/pomodoro for personal focus."),
      code(["clock(world)","clock(meetings)","clock(timer status)"]),
      note("Global aliases timer / pomodoro / stopwatch rewrite into clock — handy at the desktop line, less clear inside shared Scripts (prefer explicit clock(…))."),
      h2("Related"),
      p("app-today, app-info, recipe-focus, cmd-protocol, silent-actions."),
    ])
  );

  add(
    P("app-remote", "Remote Hub", "Free remote control: RDP, SSH, RustDesk & wake-on-LAN", ["apps","remote","remote-hub"], [
      kicker("Apps"),
      p("Remote Hub (module remote-hub, alias remote) is your inventory of machines plus the actions to reach them: RDP, SSH, RustDesk-style tools, wake-on-LAN, subnet scan, and Tailscale import. It turns “that PC under the desk” into a named, scriptable endpoint."),
      p("Who it is for: developers with lab machines, homelab operators, and anyone who jumps between SSH and RDP daily."),
      p("How it fits: Remote Hub complements System Info (ports/network) and external Terminal. connect may spawn OS tools (mstsc, ssh, rustdesk) without keeping My Space chrome in front."),
      h2("Open it"),
      code(["run remote","run remote-hub","remote(list)","remote(network)","remote(open Office)","focus remote"]),
      h2("Surfaces / pages"),
      table(["Page","What it is","Open with"], [["machines","Machine inventory","remote(list) / default"],["quick","Quick actions","UI"],["network","Network-oriented view","remote(network)"],["enable","Enablement / setup helpers","remote(enable)"],["tools","Installed / available tools","remote(tools)"]]),
      h2("Shell commands"),
      code(["remote(list)","remote(search office)","remote(check)","remote(check Office)","remote(open Office)","remote(connect Office)","remote(connect Office ssh)","remote(wake Office)","remote(wake AA:BB:CC:DD:EE:FF)","remote(scan)","remote(tools)","remote(import-ts)","remote(add Lab | 10.0.0.5 | rdp)","remote(delete Lab)","remote(network)","remote(help)"]),
      table(["Verb","What it does","Silent?"], [["list","List machines","Yes"],["search <query>","Find machines by name/notes","Yes"],["check [name]","Reachability / status check","Yes"],["open <name>","Open machine details in UI","No"],["connect <name> [ssh]","Launch remote session (RDP/SSH/tool)","Spawns external; may not focus hub"],["wake <name|mac>","Wake-on-LAN","Yes / message"],["scan","Subnet / discovery scan","Yes / progress message"],["tools","Show tool availability","Yes or opens tools"],["import-ts","Import Tailscale nodes","Yes / message"],["add Name | host | kind","Add a machine","Yes"],["delete <name>","Remove a machine","Yes"],["network","Open network page","No"],["help","Help string","Yes"]]),
      warn("After wake, wait before connect — the NIC needs time to come online. A blind connect often fails once then works."),
      h2("Typical workflow"),
      ol(["remote(wake Office)","Wait 30–60s (or a scripted pause).","remote(check Office)","remote(connect Office) or remote(connect Office ssh)."]),
      tip("Keep machine names unique so open/connect/delete never disambiguate mid-macro."),
      note("import-ts pulls Tailscale-known hosts into the inventory when configured."),
      h2("Connect kinds"),
      ul(["RDP — Windows desktops via mstsc-style launch.","SSH: shell sessions on servers and lab boxes.","RustDesk / tools. when configured in tools inventory.","Wake-on-LAN — power on before any of the above."]),
      h2("Inventory hygiene"),
      p("Keep names short and unique (Office, Lab-GPU). Put IPs and MAC addresses in the machine record so wake/connect do not need retyping. Re-run import-ts when Tailscale membership changes."),
      code(["remote(list)","remote(search lab)","remote(tools)","remote(import-ts)"]),
      note("check is cheaper than connect: use it after wake."),
      h2("Related"),
      p("app-sysinfo, app-external, recipe-remote, cmd-protocol."),
    ])
  );

  add(
    P("app-studies", "Studies", "Documents, templates, and a dedicated Gemini chat", ["apps","studies"], [
      kicker("Apps"),
      p("Studies is the long-document workshop: structured writings, templates, formal modes, export, and a dedicated Gemini chat for drafting and refining. It is where essays, briefs, and study notes grow beyond sticky tasks."),
      p("Who it is for: students, founders writing memos, and anyone who wants AI assist without leaving My Space."),
      p("How it fits: Studies holds prose; Study Deck holds flashcards; Docs holds the OS handbook. Gemini chat and export live primarily in the UI even when shell verbs open or list documents."),
      h2("Open it"),
      code(["run studies","studies(home)","studies(list)","studies(open My Brief)","studies(templates)","studies(new)"]),
      h2("Surfaces / pages"),
      table(["Surface","What it is","Open with"], [["home","Studies home","studies(home)"],["document editor","Active study document","studies(open …)"],["templates","Template gallery","studies(templates)"],["new","Create flow","studies(new)"],["Gemini chat","Dedicated assist chat","UI"],["export","PDF / DOCX export","UI"]]),
      h2("Shell commands"),
      code(["studies(list)","studies(search climate)","studies(open My Brief)","studies(home)","studies(templates)","studies(new)","studies(help)"]),
      table(["Verb","What it does","Silent?"], [["list","List studies / documents","Yes"],["search <query>","Search titles/content index","Yes"],["open <name>","Open a document","No"],["home","Go home","No"],["templates","Open templates","No"],["new","Start a new study","No"],["help","Help string","Yes"]]),
      note("Gemini chat + export are UI-first: shell gets you to the document, the window finishes the craft."),
      h2("Typical workflow"),
      ol(["studies(templates) → pick a structure.","studies(new) or open an existing draft.","Use Gemini chat in-app to outline, then export from UI."]),
      tip("Name documents uniquely so studies(open …) never asks you to disambiguate."),
      h2("Studies vs Scripts vs Docs"),
      table(["App","Content type","AI role"], [["Studies","Human documents / memos","Gemini chat in UI"],["Docs","OS handbook","None — reference"],["Scripts","Executable command programs","None — deterministic"]]),
      p("If the output must run, it belongs in Scripts. If the output must teach My Space, it belongs in Docs. If the output is a deliverable document, it belongs in Studies."),
      code(["studies(list)","studies(search roadmap)","studies(templates)"]),
      h2("Related"),
      p("app-decks, app-docs, app-flow, app-lexicon."),
    ])
  );

  add(
    P("app-decks", "Study Deck", "Flashcard decks: create, study, and generate cards with AI", ["apps","decks","study-deck"], [
      kicker("Apps"),
      p("Study Deck (module study-deck) is spaced practice for anything you must remember: languages, APIs, interview facts, personal systems. Create decks, add cards, study with grading, and optionally generate cards with AI."),
      p("Who it is for: learners who want deliberate recall: not passive rereading in Studies."),
      p("How it fits: decks(…) manages library mutations; studydeck(…) opens/study flows. Pair with Learning Games for quiz variety and Lexicon for concept lookups while you author cards."),
      h2("Open it"),
      code(["run study-deck","run decks","decks(list)","studydeck(open Spanish)","studydeck(study Spanish)"]),
      h2("Surfaces / pages"),
      table(["Surface","What it is","Open with"], [["library / list","All decks","decks(list)"],["deck detail","Cards in a deck","studydeck(open …)"],["study session","Review / grade loop","studydeck(study …)"],["AI generate","Card generation helpers","UI"]]),
      h2("Shell commands"),
      code(["decks(list)","decks(new Spanish)","decks(delete Spanish)","decks(add Spanish | hola | hello)","studydeck(open Spanish)","studydeck(study Spanish)","decks(help)"]),
      table(["Verb","What it does","Silent?"], [["decks(list)","List decks","Yes"],["decks(new <name>)","Create a deck","Yes"],["decks(delete <name>)","Delete a deck","Yes"],["decks(add Deck | front | back)","Add a card (pipe form)","Yes"],["studydeck(open <deck>)","Open deck in UI","No"],["studydeck(study <deck>)","Start study session","No"],["help","Help string","Yes"]]),
      note("Card add uses Deck | front | back. Keep fronts unique enough to edit later by eye."),
      h2("Typical workflow"),
      ol(["decks(new Interview JS)","decks(add Interview JS | event loop | call stack → …)","studydeck(study Interview JS) for a 10-minute session."]),
      tip("Capture cards from Lexicon: lexicon(promise) to read, then decks(add …) with your own wording."),
      h2("Card quality tips"),
      ul(["One fact per card: split compound ideas.","Put the prompt on the front; keep backs short enough to grade quickly.","Prefer your own wording after Lexicon lookups so recall is yours."]),
      h2("Study cadence"),
      code(["decks(list)","studydeck(study Spanish)","clock(timer 12m)"]),
      p("Twelve focused minutes of grading beats an hour of passive rereading in Studies."),
      h2("Related"),
      p("app-studies, app-flags, app-lexicon, app-pi, recipe-focus."),
    ])
  );

  add(
    P("app-today", "Today", "Daily agenda by hour: reminders, done, and snooze", ["apps","today","day-planner"], [
      kicker("Apps"),
      p("Today (module day-planner, aliases today / planner / dayplanner) is the hour-aware agenda: capture timed items, mark done, snooze, and peek at tomorrow without breaking focus. It is the operational checklist for the day — not a full calendar suite and not the GTD project manager (see Tasks)."),
      p("Who it is for: makers who live in the shell and want capture-during-focus: add a task silently, keep coding, review later."),
      p("How it fits: Today pairs with Clock (timers), Tasks (projects / next actions), and Contacts (people). Shell matching for done/delete/snooze uses id or unique title; ambiguous titles return a short list."),
      p("Buckets include today, tomorrow, later, done, and all. today(tomorrow) opens the tomorrow surface; today(list tomorrow) prints it silently."),
      h2("Open it"),
      code(["run today","run day-planner","today(tomorrow)","today(later)","today(done)","today(all)","focus today"]),
      h2("Surfaces / pages"),
      table(["Page","What it is","Open with"], [["home / today","Today’s agenda","run today / default"],["tomorrow","Tomorrow bucket","today(tomorrow)"],["later","Later / deferred","today(later)"],["done","Completed items","today(done)"],["all","Everything","today(all)"]]),
      h2("Shell commands: capture & mutate"),
      code(["today(add Buy milk)","today(add Call Dana 15:00)","today(add Ship report tomorrow)","today(done Buy milk)","today(undo Buy milk)","today(delete Buy milk)","today(snooze Buy milk 15m)","today(snooze Buy milk tomorrow)","today(clear done)"]),
      table(["Verb","What it does","Silent?"], [["add …","Create a task (optional time, tomorrow)","Yes"],["done …","Mark complete (id or unique title)","Yes"],["undo …","Undo done","Yes"],["delete …","Remove task","Yes"],["snooze … 15m|tomorrow","Defer a task","Yes"],["clear done","Clear completed items","Yes"]]),
      h2("Shell commands: list & pages"),
      code(["today(list)","today(list tomorrow)","today(tomorrow)","today(later)","today(done)","today(all)","today(help)"]),
      table(["Verb","What it does","Silent?"], [["list","List today’s tasks","Yes"],["list tomorrow","List tomorrow’s tasks","Yes"],["tomorrow / later / done / all","Open those pages","No"],["help","Help string","Yes"]]),
      tip("Silent add + later today(open) is a good macro pattern for capture-during-focus."),
      note("Include a time like 15:00 or the word tomorrow in add text when scheduling matters."),
      h2("Typical workflow"),
      ol(["Morning: today(list); clock(timer 25m).","During focus: today(add Email invoice) without opening UI.","Afternoon: today(snooze … 15m) or today(done …).","Evening: today(list tomorrow); today(clear done)."]),
      warn("If done/delete returns multiple matches, refine the title substring or use an id from list."),
      h2("Capture grammar examples"),
      code(["today(add Buy milk)","today(add Call Dana 15:00)","today(add Ship report tomorrow)","today(snooze Buy milk 15m)","today(snooze Buy milk tomorrow)","today(done Buy milk)","today(list tomorrow)"]),
      h2("Disambiguation"),
      p("If two tasks are both named Email, done Email will not guess. Rename while adding (Email Dana / Email bank) or use identifiers from today(list)."),
      note("clear done is housekeeping: run it when the done bucket becomes noise."),
      h2("Related"),
      p("app-clock, app-tasks, app-contacts, recipe-morning, cmd-protocol."),
    ])
  );

  add(
    P("app-tasks", "Tasks", "Projects, lists & next actions: GTD between Notes and Today", ["apps","tasks","gtd","todo"], [
      kicker("Apps"),
      p("Tasks is the GTD layer: Inbox, Next, Waiting, Someday, projects with lists, soft due dates, priorities, flags, and checklists. It sits between Notes (capture text) and Today (timed hour agenda)."),
      p("Who it is for: people who need project structure and next-action clarity — not just “what’s at 15:00”."),
      p("How it fits: Capture with tasks(add …) using @next / @waiting / @someday, +ProjectName, #tags, due:tomorrow, and !!! for priority. Send a clarified item onto the day board with tasks(schedule …) → Today."),
      h2("Open it"),
      code(["run tasks","tasks(inbox)","gtd(next)","todo(flagged)","tasks(open Buy milk)","focus tasks"]),
      h2("Surfaces / pages"),
      table(["Surface","What it is","Open with"], [["inbox","Unclarified capture","tasks(inbox)"],["next","Actionable next actions","tasks(next)"],["waiting / someday","Blocked or parked","tasks(waiting) · tasks(someday)"],["today / upcoming","Soft due dates","tasks(today) · tasks(upcoming)"],["flagged / all / done","Filters","tasks(flagged) · tasks(all) · tasks(done)"],["projects","Sidebar projects + lists","tasks(project Name) / UI"]]),
      h2("Shell commands"),
      code(["tasks(list)","tasks(list next)","tasks(add Buy milk @next #errands)","tasks(add Title | notes +Website due:tomorrow !!!)","tasks(done Buy milk)","tasks(flag Buy milk)","tasks(move Buy milk waiting)","tasks(schedule Buy milk)","tasks(project Website)","tasks(search milk)","tasks(delete Buy milk)","tasks(help)"]),
      table(["Verb","What it does","Silent?"], [["list / ls [view]","List a smart view","Yes"],["search / find <q>","Search items","Yes"],["get <ref>","Print summary","Yes"],["add / new / create …","Capture (pipe, @bucket, +Project, #tags, due:)","Yes"],["done / complete / toggle <ref>","Mark done / reopen","Yes"],["flag / unflag <ref>","Toggle flag","Yes"],["move <ref> <bucket>","Move inbox/next/waiting/someday","Yes"],["schedule / today <ref>","Copy onto Today’s timed agenda","Yes"],["project [name]","List projects or create one","Yes / opens UI when creating"],["delete / rm <ref>","Delete item","Yes"],["open <ref|page>","Open UI / item","No"],["inbox / next / …","Open smart lists","No"],["help","Help string","Yes"]]),
      h2("Capture parsing"),
      ul(["Pipe form: Title | notes","@inbox @next @waiting @someday route the bucket","+ProjectName attaches an existing project when the name matches","#tags lifted from the line","due:YYYY-MM-DD · due:tomorrow · bare today/tomorrow","! / !! / !!! or p1/p2/p3 set priority","Aliases: gtd · todo · lists · projects"]),
      tip("Use Notes for free-form thoughts, Tasks for actionable work, Today for “do this at 15:00”."),
      note("The shell name tasks(…) now opens this app. Timed day agenda is today(…)."),
      h2("Typical workflow"),
      ol(["tasks(add Call Dana @inbox) during a meeting.","Clarify: tasks(move Call Dana next) or edit in UI.","tasks(schedule Call Dana) when it must hit today’s hour board.","tasks(project Website) then capture with +Website."]),
      h2("Storage"),
      p("Persists to userData/tasks.json via the shared safe JSON store. Independent from day-planner.json."),
      h2("Related"),
      p("app-today, app-notes, app-contacts, cmd-protocol, storage."),
    ])
  );

  add(
    P("app-vault", "Vault", "Encrypted passwords & secrets", ["apps","vault","profiles"], [
      kicker("Apps"),
      p("Vault (module profiles, alias vault) is the encrypted store for passwords and secrets. The shell is a convenience layer after unlock — list, search, copy, add, delete — never the unlock UI."),
      p("Who it is for: anyone who wants secrets near the desktop without pasting into chat logs or plaintext notes."),
      p("How it fits: Vault is the trust boundary for credentials used across My Space. Contacts and Remote Hub may reference people/machines; Vault holds the actual secrets."),
      h2("Open it"),
      code(["run vault","run profiles","vault(status)","vault(open Gmail)","focus vault"]),
      h2("Surfaces / pages"),
      table(["Surface","What it is","Notes"], [["Unlock","Master password entry","UI ONLY — never via shell"],["List / browse","Entries","vault(list) / UI"],["Entry detail","Single secret","vault(open …)"],["Lock","Re-lock store","vault(lock)"]]),
      h2("Shell commands"),
      code(["vault(status)","vault(lock)","vault(list)","vault(search gmail)","vault(open Gmail)","vault(add Work Email)","vault(copy Gmail)","vault(delete Name)","vault(help)"]),
      table(["Verb","What it does","Silent?"], [["status","Locked/unlocked + summary","Yes"],["lock","Lock the vault","Yes"],["list","List entries","Yes (requires unlock)"],["search <query>","Search entries","Yes"],["open <name>","Open entry in UI","No"],["add <name>","Create entry (details in UI as needed)","Yes / may need UI"],["copy <name>","Copy secret to clipboard","Yes"],["delete <name>","Delete entry","Yes"],["help","Help string","Yes"]]),
      warn("Unlock ONLY in the Vault window. Never put the master password in shell, aliases, macros, or scripts. The shell will not prompt for it."),
      note("If status says locked, open Vault, unlock, then retry copy/add/delete."),
      h2("Typical workflow"),
      ol(["Open Vault UI → unlock.","vault(search bank) silently.","vault(copy …) when filling a form.","vault(lock) before leaving the desk."]),
      tip("Name entries uniquely (Gmail Work vs Gmail Personal) so copy never greps the wrong secret."),
      h2("Safe shell patterns"),
      code(["vault(status)","vault(search github)","vault(copy GitHub PAT)","vault(lock)"]),
      ul(["Always status before copy in shared macros.","Prefer search → copy over open when you only need clipboard.","Lock at the end of sensitive sessions."]),
      warn("Clipboard may retain secrets: clear or overwrite after paste into the target app."),
      p("Vault security handbook pages explain encryption posture; this app page is the operator manual."),
      h2("Related"),
      p("vault-security, storage, app-contacts, app-remote, cmd-protocol."),
    ])
  );

  add(
    P("app-maps", "World Maps", "World map explorer: notes, routes & search", ["apps","maps","world-maps"], [
      kicker("Apps"),
      p("World Maps (module world-maps, aliases maps / worldmaps) is the annotated map explorer: geocode places, list notes and routes, and open the canvas. It complements Geography (encyclopedia) with a spatial canvas."),
      p("Who it is for: travelers, planners, and anyone who thinks spatially."),
      p("How it fits: maps(…) verbs are silent for geocode/notes/routes/status; maps(open) launches the UI. Marker camera fly-to stays in-app."),
      h2("Open it"),
      code(["run maps","maps(open)","focus maps"]),
      h2("Surfaces / pages"),
      table(["Surface","What it is","Open with"], [["Map canvas","Interactive world map","maps(open)"],["Notes","Pinned notes","maps(notes) lists; edit in UI"],["Routes","Route sketches","maps(routes)"],["Auth / sync","Sign-in & folder sync","maps(status) · maps(sync)"]]),
      h2("Shell commands"),
      code(["maps(geocode Tel Aviv)","maps(search Paris)","maps(notes)","maps(routes)","maps(reverse 32.08 34.78)","maps(country 32.08 34.78)","maps(status)","maps(sync)","maps(open)","maps(help)"]),
      table(["Verb","What it does","Silent?"], [["geocode / search <q>","Nominatim place search","Yes"],["notes","List saved notes (needs sign-in)","Yes"],["routes","List saved routes (needs sign-in)","Yes"],["reverse <lat> <lng>","Reverse geocode","Yes"],["country <lat> <lng>","Country at point","Yes"],["status / auth","Sign-in status","Yes"],["sync","Sync folder status","Yes"],["open / map","Open World Maps UI","No"],["help","Help string","Yes"]]),
      note("For country facts and travel logs use Geography (app-geo). Notes/routes require Maps sign-in."),
      warn("If notes/routes fail with Not signed in, open the app and sign in once."),
      h2("Typical workflow"),
      ol(["maps(geocode Kyoto) to confirm a place name.","maps(open) to drop notes and sketch routes.","geo(get JP) when you need encyclopedia detail."]),
      tip("Pair Maps with Geography and recipe-travel."),
      h2("Related"),
      p("app-geo, app-flags, app-history, recipe-travel, msl-capabilities (maps.*)."),
    ])
  );

  add(
    P("app-stocks", "Stocks", "Multi-asset tracker: charts, portfolio, alerts & AI Analysis", ["apps","stocks"], [
      kicker("Apps"),
      p("Stocks is the multi-asset tracker: equities, crypto, forex, metals, ETFs, commodities, and more. Watchlists, quotes, alerts, portfolio holdings, and an AI Analysis surface (Gemini) live here."),
      p("Who it is for: investors and curious builders who want quotes in the shell and charts in the window."),
      p("How it fits: Bare tickers are first-class. quote is the automation-friendly silent read; bare AAPL may navigate. AI Analysis is UI-only with Gemini — not a shell verb."),
      h2("Open it"),
      code(["run stocks","stocks(AAPL)","stocks(open AAPL)","stocks(mode crypto)","stocks(portfolio)","stocks(alerts)"]),
      h2("Surfaces / pages"),
      table(["Surface","What it is","Open with"], [["dashboard","Overview / modes","run stocks"],["stock","Symbol detail / chart","stocks(AAPL) / open"],["portfolio","Holdings","stocks(portfolio)"],["alerts","Price alerts","stocks(alerts) / list alerts"],["buylist","Buy list","stocks(buylist)"],["ai-analysis","Gemini analysis","UI only"]]),
      h2("Modes"),
      p("Switch asset universes with stocks(mode …). Supported modes include:"),
      ul(["stocks, metals, forex, crypto, intl","etf-index, etf-sector, etf-bonds","energy, commodities, indices, reit, rates, emerging"]),
      h2("Shell commands"),
      code(["stocks(AAPL)","stocks(open AAPL)","stocks(quote AAPL)","stocks(watch TSLA)","stocks(unwatch TSLA)","stocks(list)","stocks(alert AAPL > 200)","stocks(alert rm AAPL)","stocks(list alerts)","stocks(mode crypto)","stocks(portfolio)","stocks(hold AAPL 10 @ 180)","stocks(buylist)","stocks(alerts)","stocks(help)"]),
      table(["Verb","What it does","Silent?"], [["AAPL (bare ticker)","Open / focus symbol","Usually navigates"],["open <ticker>","Open symbol UI","No"],["quote <ticker>","Price summary","Yes"],["watch / unwatch","Watchlist mutate","Yes"],["list","List watch / symbols","Yes"],["alert … / alert rm …","Create / remove alert","Yes"],["list alerts","List alerts","Yes"],["mode <name>","Switch asset mode","May navigate / sync"],["portfolio","Open / summarize portfolio","Depends"],["hold <ticker> qty @ price","Record holding","Yes"],["buylist / alerts","Open those surfaces","No"],["help","Help string","Yes"]]),
      warn("AI Analysis is UI-only with Gemini: there is no stocks(analyze) shell verb to put in macros."),
      tip("Prefer stocks(quote AAPL) inside scripts; use bare AAPL when you want the chart."),
      h2("Typical workflow"),
      ol(["Morning macro: stocks(list); stocks(quote AAPL); stocks(list alerts).","stocks(mode crypto) when rotating focus.","stocks(hold AAPL 10 @ 180) after a fill.","Open AI Analysis in UI for a narrative read — not from shell."]),
      h2("Automation vs analysis"),
      table(["Need","Use","Avoid"], [["Price in a macro","stocks(quote AAPL)","Bare AAPL (opens UI)"],["Chart glance","stocks(AAPL) / open","quote alone"],["Narrative AI read","AI Analysis UI (Gemini)","Inventing a shell analyze verb"],["Risk alerts","alert / list alerts","Relying only on memory"]]),
      h2("Portfolio hygiene"),
      code(["stocks(hold AAPL 10 @ 180)","stocks(portfolio)","stocks(buylist)","stocks(mode etf-index)"]),
      p("hold records your position context; it is not a broker. Keep real brokerage as source of truth."),
      h2("Related"),
      p("app-today, recipe-morning, cmd-protocol, app-flow."),
    ])
  );

  add(
    P("app-translate", "Translate", "100+ languages: translate, phrases, batch & history", ["apps","translate"], [
      kicker("Apps"),
      p("Translate covers 100+ languages with instant translation, phrasebooks, batch mode, history, and smart Hebrew↔English defaults. Shell forms accept free text, arrows (-> en), language names (to hebrew), and classic text:/from:/to:."),
      p("Who it is for: bilinguals, travelers, and builders dealing with mixed-language notes."),
      p("How it fits: Successful shell translations can land in history when saveHistory is enabled. Batch remains a UI strength for many strings at once."),
      h2("Open it"),
      code(["run translate","translate(open phrases)","translate(batch)","translate(history)","focus translate"]),
      h2("Surfaces / pages"),
      table(["Page","What it is","Open with"], [["translate","Main translator","run translate / free text verbs"],["history","Past translations","translate(history)"],["phrases","Phrasebook","translate(open phrases)"],["batch","Batch translate","translate(batch)"],["settings","Translator settings","UI"]]),
      h2("Shell commands: translate forms"),
      code(["translate(hello)","translate(bonjour -> en)","translate(hello to hebrew)","translate(שלום)","translate(text:shalom, from:he, to:en)","translate(to:en hello world)","translate(detect bonjour)","translate(languages)","translate(history)","translate(open phrases)","translate(batch)","translate(help)"]),
      table(["Verb / form","What it does","Silent?"], [["free text","Translate with smart defaults","Yes (result message)"],["… -> en / to hebrew","Directed translation","Yes"],["text:/from:/to:","Classic key form","Yes"],["detect …","Detect language","Yes"],["languages","List / summarize languages","Yes"],["history","Open or show history","Often navigates"],["open phrases","Open phrases","No"],["batch","Open batch UI","No"],["help","Help string","Yes"]]),
      h2("Smart defaults (he↔en)"),
      ul(["If to is omitted, script detection picks a sensible target (Hebrew-heavy → en, Latin-heavy → he).","If auto-detect equals the target, the engine flips once (he↔en) to avoid no-op translations.","Language names (hebrew, english, french…) resolve in IPC normalizeLang."]),
      tip("Batch UI is best for glossaries; shell is best for one-liners inside macros."),
      h2("Typical workflow"),
      ol(["translate(hello to hebrew) for a quick check.","translate(open phrases) while traveling.","translate(batch) when importing a word list."]),
      h2("Form cheat-sheet"),
      code(["translate(hello)","translate(bonjour -> en)","translate(hello to hebrew)","translate(text:shalom, from:he, to:en)","translate(detect bonjour)"]),
      h2("History & phrases"),
      p("History captures successful shell translations when enabled: great for building a personal glossary. Phrases is the curated pack for travel. Batch is for glossary imports."),
      note("If a translation no-ops, check detect and the he↔en flip rules above."),
      h2("Related"),
      p("app-contacts, app-decks, app-geo, cmd-protocol."),
    ])
  );

  add(
    P("app-contacts", "Contacts", "People profiles: phone, email, birthdays & notifications", ["apps","contacts"], [
      kicker("Apps"),
      p("Contacts is the people graph: profiles with email, phone, birthdays, groups, and reminders. The shell can list, search, add, and hand off to OS handlers for mailto / tel / sms."),
      p("Who it is for: anyone who wants people next to Today tasks and Vault secrets without opening a heavy CRM."),
      p("How it fits: upcoming is silent; reminders opens the reminders page. Display-name matching drives open/email/phone/delete."),
      h2("Open it"),
      code(["run contacts","contacts(browse)","contacts(groups)","contacts(open Dana)","focus contacts"]),
      h2("Surfaces / pages"),
      table(["Page","What it is","Open with"], [["browse","People browser","contacts(browse)"],["groups","Groups","contacts(groups)"],["reminders","Birthday / reminder surface","contacts(reminders) if available"],["profile","Single contact","contacts(open …)"]]),
      h2("Shell commands"),
      code(["contacts(list)","contacts(search Dana)","contacts(upcoming)","contacts(add Dana | dana@mail.com | +972…)","contacts(add Dana dana@mail.com)","contacts(delete Dana)","contacts(email Dana)","contacts(phone Dana)","contacts(sms Dana)","contacts(open Dana)","contacts(groups)","contacts(browse)","contacts(help)"]),
      table(["Verb","What it does","Silent?"], [["list","List contacts","Yes"],["search <query>","Search people","Yes"],["upcoming","Upcoming birthdays / reminders","Yes"],["add …","Add contact (pipe or free form)","Yes"],["delete <name>","Delete contact","Yes"],["email / phone / sms <name>","Hand off to OS handlers","Spawns external"],["open <name>","Open profile UI","No"],["groups / browse","Open those pages","No"],["help","Help string","Yes"]]),
      h2("Add parsing"),
      ul(["Pipe form: Name | email | phone","Free form: Name plus detected email/phone tokens","Display name matching for open/email/phone/delete"]),
      tip("upcoming is silent; open reminders in UI when you want the visual calendar of people events."),
      h2("Typical workflow"),
      ol(["contacts(add Dana | dana@mail.com | +972…)","contacts(upcoming) in a Monday macro.","contacts(email Dana) when composing reaches OS mail."]),
      h2("OS handoff behavior"),
      p("email / phone / sms ask the operating system to open the right handler. My Space does not send the message itself — it starts the compose surface with the contact’s address or number when available."),
      code(["contacts(search Dana)","contacts(email Dana)","contacts(upcoming)"]),
      h2("Groups & browse"),
      p("Use groups when a project team or family cluster should be filtered together. browse is the general people canvas."),
      h2("Related"),
      p("app-today, app-vault, app-translate, recipe-weekly."),
    ])
  );

  add(
    P("app-notes", "Notes", "Quick capture: notebooks, tags, pin & archive", ["apps","notes"], [
      kicker("Apps"),
      p("Notes is the capture pad for My Space: fast inbox notes, notebooks, tags, pin, and archive. It is lighter than Studies (long documents) and complementary to Tasks (actionable work) and Today (timed agenda)."),
      p("Who it is for: anyone who wants thoughts, lists, and scraps next to the shell without opening a heavy editor."),
      p("How it fits: notes(add …) is silent and syncs an open Notes window. notes(open …) jumps to a note. Hashtags in the title become tags; Title | body splits capture lines."),
      h2("Open it"),
      code(["run notes","notes(all)","notes(pinned)","notes(archive)","notes(open Buy milk)","focus notes"]),
      h2("Surfaces / pages"),
      table(["Surface","What it is","Open with"], [["all","Full note list + editor","notes(all) / run notes"],["pinned","Pinned filter","notes(pinned)"],["archive","Archived notes","notes(archive)"],["editor","Title, tags, body — autosave","Select a note or notes(open …)"],["notebooks","Sidebar notebooks","UI · + to create"]]),
      h2("Shell commands"),
      code(["notes(list)","notes(search meeting)","notes(add Buy milk #errands)","notes(add Title | body text)","notes(get Buy milk)","notes(pin Buy milk)","notes(archive Buy milk)","notes(delete Buy milk)","notes(open Buy milk)","notes(help)"]),
      table(["Verb","What it does","Silent?"], [["list / ls","List active notes","Yes"],["search / find <q>","Search title, body, tags","Yes"],["get <ref>","Print title + preview","Yes"],["add / new / create …","Create note (pipe or free form + #tags)","Yes"],["pin / unpin <ref>","Toggle pin","Yes"],["archive / unarchive <ref>","Archive or restore","Yes"],["archive (bare)","Open archive surface","No"],["delete / rm <ref>","Delete note","Yes"],["open <ref|page>","Open UI / a note","No"],["all / pinned","Open those filters","No"],["help","Help string","Yes"]]),
      h2("Capture parsing"),
      ul(["Pipe form: Title | body","Free form: whole line becomes the title (body empty until you edit)","#tags in the title are lifted into the tag list","Alias: note(…) same as notes(…)"]),
      tip("Use notes(add …) from macros for inbox capture; open the app when you need to edit long bodies."),
      h2("Typical workflow"),
      ol(["notes(add Call Alex #work) from the desktop line.","notes(search Alex) later.","notes(pin Call Alex) when it should stay on top.","notes(archive …) when done."]),
      h2("Storage"),
      p("Persists to userData/notes.json via the shared safe JSON store (atomic write, corrupt quarantine). Default notebook is Inbox."),
      h2("Related"),
      p("app-today, app-tasks, app-contacts, app-studies, app-chat, storage, userdata-map."),
    ])
  );

  add(
    P("app-chat", "Chat", "AI chat powered by Mind: history like ChatGPT", ["apps","chat","ai","mind"], [
      kicker("Apps"),
      p("Chat is a ChatGPT-style conversation app. Ask AI (the side assistant) stays as-is for OS tools; Chat is for long threads, history, and model/context settings — all routed through Mind."),
      h2("Open it"),
      code(["run chat","chat(new)","chat(list)","chat(settings)","focus chat"]),
      h2("Surfaces"),
      table(["Surface","What it is"], [["Sidebar","Chat history + search + New chat"],["Thread","Messages for the active conversation"],["Settings","Mind task, model override, context size, temperature, system prompt"]]),
      h2("Shell"),
      code(["chat(new)","chat(list)","chat(open)","chat(settings)","chat(ask Hello)","chat(help)"]),
      tip("Pick Quick / Everyday / Deep (Mind tasks) in Settings. Context messages controls how many prior turns are sent."),
      h2("Related"),
      p("app-mind, app-flow, app-notes."),
    ])
  );

  add(
    P("app-geo", "Geography", "World countries: rich data, images & travel log", ["apps","geo","geography"], [
      kicker("Apps"),
      p("Geography is the country encyclopedia: rich data, imagery, learn profiles, and a traveled / explore log. get prints facts silently; open jumps to the country panel; learn enters study-oriented views."),
      p("Who it is for: travelers, students, and quiz companions for Learning Games."),
      p("How it fits: bare geography(IL) and geo(get IL) coexist with classic run geography(country:IL). World Maps is the canvas; Geography is the database."),
      h2("Open it"),
      code(["run geography","geo(open IL)","geography(IL)","geo(learn IL)","geo(explore)","focus geography"]),
      h2("Surfaces / pages"),
      table(["Surface","What it is","Open with"], [["browse / home","Country browser","run geography"],["country","Single country panel","geo(open …) / bare code"],["learn","Learn profile","geo(learn …)"],["traveled","Travel log","geo(traveled)"],["explore","Explore mode","geo(explore)"]]),
      h2("Shell commands"),
      code(["geo(list)","geo(search japan)","geo(get IL)","geo(open IL)","geography(IL)","geo(learn IL)","geo(traveled)","geo(explore)","geo(help)"]),
      table(["Verb","What it does","Silent?"], [["list","List / summarize countries index","Yes"],["search <query>","Search countries","Yes"],["get <code|name>","Print country facts","Yes"],["open <code|name>","Open country UI","No"],["bare geography(IL)","Convenience open/get path","Usually navigates"],["learn …","Open learn surface","No"],["traveled","Travel log","May navigate or summarize"],["explore","Explore mode","No"],["help","Help string","Yes"]]),
      tip("Prefer geo(get IL) in macros; geo(open IL) when you want imagery."),
      h2("Typical workflow"),
      ol(["geo(search balkans) to discover.","geo(get BG) for a silent fact line.","geo(learn BG) before a flags quiz.","Mark traveled in UI after a trip."]),
      h2("Verb intent matrix"),
      table(["Verb","Intent","Example"], [["get","Read facts silently","geo(get IL)"],["open","Show rich UI","geo(open IL)"],["learn","Study-oriented surface","geo(learn IL)"],["traveled","Personal travel log","geo(traveled)"],["explore","Serendipitous browse","geo(explore)"]]),
      code(["geography(IL)","run geography(country:IL)","geo(search japan)"]),
      note("Classic key:value deep links remain useful for precise UI targeting."),
      h2("Related"),
      p("app-maps, app-flags, app-history, recipe-travel."),
    ])
  );

  add(
    P("app-flags", "Learning Games", "Quizzes: Countries, Elements, and Model Prices", ["apps","flags","flag-quiz"], [
      kicker("Apps"),
      p("Learning Games (module flag-quiz, shell flags) hosts quiz modes: Countries (flags/geography), Elements (periodic table), and Model Prices (OpenRouter $/MTok). Scores persist; meta reports version/defaults."),
      p("Who it is for: playful learners who want short rounds between deep work blocks."),
      p("How it fits: pairs with Geography and Lexicon. scores is silent; quiz/start/home navigate."),
      h2("Open it"),
      code(["run flags","run flag-quiz","flags(home)","flags(quiz)","flags(start)","focus flags"]),
      h2("Surfaces / pages"),
      table(["Surface","What it is","Notes"], [["home","Game picker / home","flags(home)"],["quiz","Active quiz","flags(quiz) / start"],["scores","Score history","flags(scores) — silent shell"],["meta","Version / defaults","flags(meta)"]]),
      h2("Quiz types"),
      ul(["Countries — flags and country knowledge","Elements: periodic table","Model Prices: OpenRouter $/MTok pricing familiarity"]),
      h2("Shell commands"),
      code(["flags(scores)","flags(quiz)","flags(start)","flags(home)","flags(meta)","flags(clear scores)","flags(help)"]),
      table(["Verb","What it does","Silent?"], [["scores","Print / summarize scores","Yes"],["quiz","Enter quiz","No"],["start","Start a round","No"],["home","Go home","No"],["meta","Meta / version / defaults","Yes"],["clear scores","Reset scores","Yes"],["help","Help string","Yes"]]),
      warn("clear scores is destructive: confirm you mean it before putting it in a script."),
      h2("Typical workflow"),
      ol(["flags(home) → pick Countries / Elements / Model Prices.","Play a short round.","flags(scores) from shell later without opening UI.","run info if you want a cross-app digest of the session."]),
      tip("Warm up with geo(learn …) before a Countries quiz."),
      h2("Picking a quiz type"),
      table(["Type","Trains","Warm-up"], [["Countries","Flags / country recognition","geo(learn …)"],["Elements","Periodic table","lexicon or Studies notes"],["Model Prices","$/MTok intuition for OpenRouter models","Docs + pricing familiarity"]]),
      code(["flags(meta)","flags(scores)","flags(start)"]),
      p("Short rounds between Pomodoros work better than marathon quiz nights."),
      h2("Related"),
      p("app-geo, app-lexicon, app-pi, app-info."),
    ])
  );

  add(
    P("app-pi", "Pi Digits", "Learn digits of π: look, remember, type", ["apps","pi","pi-digits"], [
      kicker("Apps"),
      p("Pi Digits is a guided memorization studio for π: study a chunk, warm up, recall by typing, then link the next slice. It is playful and deliberate — a little at a time — with progress, weak-spot review, and recite modes."),
      p("Who it is for: anyone who enjoys memory sports, students warming up focus, or makers who want a non-work ritual between coding blocks."),
      p("How it fits: There are NO shell verbs for Pi Digits beyond launching the app. All study mechanics live in the UI. Pair with Clock timers for timed recall sets."),
      h2("Open it"),
      code(["run pi-digits","run \"pi digits\"","focus pi-digits"]),
      h2("Surfaces / pages"),
      table(["Surface","What it is","Notes"], [["study","Look at the next chunk","Guided lesson start"],["warm-up","Light rehearsal","Before recall"],["recall","Type digits from memory","Core practice"],["link","Connect to the next chunk","Builds continuity"],["recite recent / from start","Longer recitation modes","UI"],["weak spot review","Focus on failures","UI"],["progress / chunks","Mastery map","UI"]]),
      h2("Shell commands"),
      p("Pi Digits exposes no app(verb) protocol. Launch only:"),
      code(["run pi-digits"]),
      table(["Verb / form","What it does","Silent?"], [["(none)","No verbs. UI guided lesson only",":"],["run pi-digits","Open the app","No"]]),
      note("Guided loop: study → warm-up → recall → link. Recite recent / from start and weak-spot review deepen retention."),
      h2("Typical workflow"),
      ol(["clock(timer 10m) then run pi-digits.","Study a chunk, warm up, recall, link the next.","If you stumble, use weak spot review before expanding length.","Check progress/chunks before ending the session."]),
      tip("Short daily sessions beat rare marathon recitals."),
      h2("Memory tips"),
      ul(["Say chunks aloud during warm-up before typing.","Stop expanding length while weak spots remain.","Link deliberately: the join between chunks is where most breaks happen."]),
      code(["run pi-digits","clock(timer 10m)"]),
      p("Because there are no verbs, any automation is just launching the app and timing the session externally."),
      h2("Related"),
      p("app-decks, app-flags, app-clock, recipe-focus."),
    ])
  );

  add(
    P("app-icons", "Icon Library", "Browse, preview, copy & favorite system icons", ["apps","icons","icon-library"], [
      kicker("Apps"),
      p("Icon Library is the maker’s icon desk for My Space: browse packs, preview glyphs, favorite icons, and copy SVG or ids into your own UI work. It also ties into MSL via icons.search for cross-app icon discovery."),
      p("Who it is for: people building myapps, decorating Docs-like UIs, or standardizing icon language across the desktop."),
      p("How it fits: run icon-library opens the browser; MSL consumers can search icons without reinventing asset pipelines."),
      h2("Open it"),
      code(["run icon-library","focus icon-library"]),
      h2("Surfaces / pages"),
      table(["Surface","What it is","Notes"], [["browse / packs","Icon packs explorer","Search packs in UI"],["favorites","Saved icons","UI"],["preview","Large preview + copy actions","Copy SVG / id"]]),
      h2("Shell commands"),
      code(["run icon-library"]),
      table(["Verb / form","What it does","Silent?"], [["run icon-library","Open Icon Library","No"],["MSL icons.search","Search icons via My Space Link","Via MSL callers"]]),
      note("Copy SVG/id from the UI. Prefer favorites for icons you reuse in multiple apps."),
      h2("Typical workflow"),
      ol(["run icon-library","Search a pack, preview, favorite keepers.","Copy SVG or id into your app.","Optionally expose/search via MSL icons.search from other tools."]),
      tip("Keep a small favorite set — consistency beats a huge random palette."),
      h2("Copy targets"),
      ul(["SVG — paste into app HTML/CSS or design tools.","Id: reference in My Space icon systems / MSL consumers.","Favorites — build a house style set for your myapps."]),
      code(["run icon-library"]),
      note("MSL icons.search lets other apps query without opening the library window."),
      h2("Related"),
      p("app-msl, app-builds, msl-providers, apps-windows."),
    ])
  );

  add(
    P("app-history", "History", "Historical figures & events. Wikidata & Wikipedia", ["apps","history"], [
      kicker("Apps"),
      p("History surfaces historical figures and events backed by Wikidata and Wikipedia extracts. Search, get silent facts, open rich panels, and keep bookmarks. Cache status matters — history(status) tells you if data is ready."),
      p("Who it is for: curious readers, students, and quiz companions."),
      p("How it fits: pairs with Geography and Space for “what happened / who / where.” Bookmarks keep a personal syllabus."),
      h2("Open it"),
      code(["run history","history(open Ada Lovelace)","history(bookmarks)","history(list figures)","focus history"]),
      h2("Surfaces / pages"),
      table(["Surface","What it is","Open with"], [["figures","People index","history(list figures)"],["events","Events index","history(list events)"],["detail","Figure or event panel","history(open …) / get"],["bookmarks","Saved items","history(bookmarks)"],["status","Cache / readiness","history(status)"]]),
      h2("Shell commands"),
      code(["history(list figures)","history(list events)","history(search newton)","history(get Ada Lovelace)","history(open Ada Lovelace)","history(bookmarks)","history(status)","history(help)"]),
      table(["Verb","What it does","Silent?"], [["list figures|events","List index slices","Yes"],["search <query>","Search figures/events","Yes"],["get <name>","Print summary facts","Yes"],["open <name>","Open detail UI","No"],["bookmarks","Open bookmarks","No"],["status","Cache / data status","Yes"],["help","Help string","Yes"]]),
      tip("history(status) before a classroom demo — confirm cache is warm."),
      h2("Typical workflow"),
      ol(["history(search industrial revolution)","history(get …) for a silent blurb.","history(open …) when you want Wikipedia extract UI.","Bookmark keepers for weekly review."]),
      h2("Figures vs events"),
      p("list figures and list events keep the two indexes separate so search stays coherent. When you are unsure, search first, then get, then open."),
      code(["history(search newton)","history(get Isaac Newton)","history(list events)","history(status)"]),
      note("Wikipedia extracts may be cached: status helps explain empty panels after offline periods."),
      h2("Related"),
      p("app-geo, app-space, app-studies, app-flags."),
    ])
  );

  add(
    P("app-space", "Space", "Space exploration: cosmos, NASA lab, ocean & earth", ["apps","space"], [
      kicker("Apps"),
      p("Space is a multi-realm navigator: cosmos, ocean, and earth views plus NASA-flavored missions, reports, APOD, catalog search, and curious extras. It is exploration UX — not a telescope driver."),
      p("Who it is for: science-curious users and anyone who wants APOD or mission briefs without a browser scavenger hunt."),
      p("How it fits: catalog search is the silent discovery tool; views switch realms; open jumps into a topic panel."),
      h2("Open it"),
      code(["run space","space(cosmos)","space(ocean)","space(earth)","space(apod)","space(open …)","focus space"]),
      h2("Surfaces / pages"),
      table(["View / surface","What it is","Open with"], [["cosmos","Space / astronomy realm","space(cosmos)"],["ocean","Ocean realm","space(ocean)"],["earth","Earth realm","space(earth)"],["apod","Astronomy Picture of the Day","space(apod)"],["missions / reports","NASA-oriented content","space(missions) / reports"],["catalog / nasa / aliens","Discovery & specialty surfaces","matching verbs"]]),
      h2("Shell commands"),
      code(["space(apod)","space(search hubble)","space(get …)","space(missions)","space(reports)","space(ocean)","space(earth)","space(cosmos)","space(open …)","space(catalog)","space(nasa)","space(aliens)","space(help)"]),
      table(["Verb","What it does","Silent?"], [["apod","APOD summary / open","May summarize or navigate"],["search <query>","Search catalog","Yes"],["get <id|name>","Fetch item summary","Yes"],["missions / reports","List or open those sets","Depends"],["ocean / earth / cosmos","Switch views","No"],["open …","Open a topic","No"],["catalog / nasa / aliens","Specialty surfaces","Usually navigates"],["help","Help string","Yes"]]),
      tip("space(search …) silently, then space(open …) when you pick a hit."),
      h2("Typical workflow"),
      ol(["space(apod) as a morning curiosity beat.","space(cosmos) then catalog search for a mission.","Flip to ocean/earth when the day’s theme shifts."]),
      h2("Realm switching"),
      p("cosmos / ocean / earth are intentional context switches. Stay in one realm while exploring so catalog results match the theme you care about."),
      code(["space(apod)","space(search jwst)","space(missions)","space(ocean)"]),
      h2("Silent discovery"),
      p("search/get are for scripts and curiosity macros; open/views are for leaning back and reading."),
      h2("Related"),
      p("app-history, app-geo, app-studies, recipe-morning."),
    ])
  );

  add(
    P("app-contracts", "Digital Contracts", "Formal digital contracts: fields, signatures & expiry", ["apps","contracts"], [
      kicker("Apps"),
      p("Digital Contracts manages formal agreements: templates, fillable fields, signatures, library storage, and expiry / upcoming alerts. It is paperwork with structure — not a freeform Studies doc."),
      p("Who it is for: freelancers, small teams, and anyone tracking renewals."),
      p("How it fits: upcoming/expiring keep renewals visible; editor is UI-heavy; get Name prints a silent summary when wired."),
      h2("Open it"),
      code(["run contracts","contracts(library)","contracts(open …)","contracts(editor)","contracts(templates)","focus contracts"]),
      h2("Surfaces / pages"),
      table(["Surface","What it is","Open with"], [["library","Contract library","contracts(library)"],["templates","Template gallery","contracts(templates)"],["editor","Fill / sign editor","contracts(editor)"],["upcoming / expiring","Renewal radar","contracts(upcoming) / expiring"],["detail","Single contract","contracts(open …) / get"]]),
      h2("Shell commands"),
      code(["contracts(list)","contracts(templates)","contracts(upcoming)","contracts(open Service Agreement)","contracts(editor)","contracts(expiring)","contracts(library)","contracts(get Service Agreement)","contracts(help)"]),
      table(["Verb","What it does","Silent?"], [["list","List contracts","Yes"],["templates","Open templates","No"],["upcoming","Upcoming deadlines","Yes or navigates"],["open <name>","Open contract","No"],["editor","Open editor","No"],["expiring","Expiring soon","Yes or navigates"],["library","Open library","No"],["get <name>","Summary for a named contract","Yes"],["help","Help string","Yes"]]),
      note("Signatures and sensitive fills belong in the editor UI. treat shell as navigation and reminders."),
      h2("Typical workflow"),
      ol(["contracts(templates) → start from a known form.","Fill and sign in editor.","Monday macro: contracts(upcoming); contracts(expiring)."]),
      tip("Unique contract titles make get/open reliable in scripts."),
      h2("Renewal radar"),
      code(["contracts(upcoming)","contracts(expiring)","contracts(list)"]),
      p("Put these in a weekly macro with today(list) so paperwork deadlines appear beside tasks."),
      note("Templates reduce mistakes: prefer templates over blank contracts when a standard form exists."),
      h2("Related"),
      p("app-studies, app-vault, recipe-weekly, app-today."),
    ])
  );

  add(
    P("app-msl", "MSL", "My Space Link: platform capability bus", ["apps","msl","platform"], [
      kicker("Platform"),
      p("MSL (My Space Link) is a major platform service built into My Space: not a desktop app. Apps publish capabilities; other surfaces call them via msl:v1 keys. Open the system panel for capabilities, saved keys, mint, and inject."),
      p("Who it is for: everyone using cross-app features (icons, AI grounding, shell automation), and makers wiring providers."),
      p("How it fits: beside Browser and Shell. Browser navigates; Shell commands; MSL connects app capabilities."),
      h2("Open it"),
      code(["msl(panel)","msl(open)","msl(mint)","Platform catalog → MSL","Ctrl+K → “MSL”"]),
      tip("There is no MSL app tile. Mint and inject live inside the system panel tabs."),
      h2("Surfaces"),
      table(["Surface","What it is","Open with"], [["MSL panel","Capabilities, keys, mint, inject","msl(panel)"],["Command palette","Search caps · open panel","Ctrl+K"],["Shell","list / invoke / resolve / keys","msl(…)"]]),
      h2("Shell commands"),
      code(["msl(list)","msl(caps)","msl(keys)","msl(invoke space.bodies.search q:mars)","msl(resolve msl:v1/…)","msl(parse msl:v1/…)","msl(panel)","msl(mint)","msl(inject)","msl(help)"]),
      table(["Verb","What it does","Silent?"], [["list / caps","List capabilities","Yes"],["keys","List saved keys","Yes"],["invoke <cap> [k:v…]","Call a capability","Yes"],["resolve <uri>","Parse + invoke a key","Yes"],["parse <uri>","Parse only","Yes"],["panel / open","Open system MSL panel","No"],["mint / inject","Open panel mint/inject tabs","No"],["help","Help string","Yes"]]),
      warn("Providers can be disabled per app in Settings (mslProvider). Mint/inject carefully."),
      h2("Typical workflow"),
      ol(["msl(panel) or Platform → MSL.","Browse capabilities; Invoke to smoke-test.","Use Mint / Inject tabs for AI keys.","msl(invoke …) from Scripts/macros for automation."]),
      h2("Related"),
      p("msl, msl-providers, msl-capabilities, platform services catalog, app-jobs, app-mind, app-flow."),
    ])
  );

  add(
    P("app-jobs", "Jobs", "Compute queue + capacity contract", ["apps","jobs","platform","compute"], [
      kicker("Platform"),
      p("Jobs is a major platform service: the OS compute runtime, not a command wrapper. Opening an app, running a shell line, or executing a script/program creates a job automatically. Capacity is the compute contract: concurrency, Focus pause for background work, optional daily budget."),
      p("Who it is for: everyone, the runtime is always on. Power users open the panel to inspect activity and tune Capacity."),
      p("How it fits: Shell and launches go through Jobs; MSL can still enqueue background work via jobs.enqueue."),
      h2("Open it"),
      code(["jobs(panel)","jobs(capacity)","Platform catalog → Jobs","Ctrl+K → “Jobs”"]),
      tip("You do not write jobs(run …) for normal work. Just use My Space; Jobs records and budgets it."),
      h2("Capacity pools"),
      table(["Pool","What goes here","Defaults"], [["Interactive","App launches + user-facing work","Max 6 · never Focus-paused · never budget-blocked"],["Shell","Shell commands, scripts, programs","Max 4"],["Background","Queued/MSL/low-priority","Max 2 · Focus can pause · optional daily budget"]]),
      tip("Optional exceptions (max 8) force an app/source into a pool, e.g. builds → Interactive."),
      warn("If Interactive is busy, My Space still starts the launch (capacity bypass) so the desktop does not freeze."),
      h2("Surfaces"),
      table(["Surface","What it is","Open with"], [["Queue / Active / Done","Live OS activity","jobs(panel)"],["Capacity","Compute contract","jobs(capacity)"],["Enqueue","Optional manual/background only","jobs(enqueue)"]]),
      h2("Shell commands"),
      code(["jobs(list)","jobs(stats)","jobs(capacity)","jobs(cancel <id>)","jobs(clear)","jobs(panel)","jobs(help)"]),
      table(["Verb","What it does","Silent?"], [["list / stats","Inspect runtime","Yes"],["capacity","Open or set contract","No / Yes"],["cancel / retry / clear","Control jobs","Yes"],["panel","Open system panel","No"]]),
      warn("Capacity can forbid launches or shell. Focus pauses background jobs only — interactive work still runs."),
      h2("Typical workflow"),
      ol(["Use My Space normally (open apps, shell, scripts).","Open jobs(panel) to see what ran.","Tune jobs(capacity) if you want stricter compute limits."]),
      h2("Related"),
      p("app-msl, app-mind, app-scripts, app-console, platform services catalog, focus mode."),
    ])
  );

  add(
    P("app-mind", "Mind", "Ask AI by task: cheap, everyday, or deep", ["apps","mind","platform","ai","gemini"], [
      kicker("Platform"),
      p("Mind is the OS AI. One Gemini key; three tasks. Cheap models for cheap work, Pro for hard work."),
      h2("Tasks"),
      table(["Task","Use for","Default model"], [["Quick","Short / cheap work","Flash Lite"],["Everyday","Normal chat & summaries","Flash"],["Deep","Hard reasoning — costs more","Pro"]]),
      tip("Change which model each task uses in Mind → Setup."),
      h2("Open it"),
      code(["mind(panel)","mind(setup)","Platform → Mind","Ctrl+K → Mind"]),
      h2("Shell"),
      code(["mind(ask What is Focus?)","mind(quick tag this note)","mind(think Plan my week)","mind(ask think: Explain Jobs pools)","mind(test)","mind(status)"]),
      h2("MSL"),
      code(["msl(invoke mind.ask prompt:Hello task:quick)","msl(invoke mind.status)"]),
      warn("API keys stay in userData only. Never commit keys."),
      h2("Related"),
      p("app-jobs, app-msl, app-flow, platform services catalog."),
    ])
  );

  add(
    P("app-builds", "Builds", "Everything you've built: projects, docs & code trees", ["apps","builds"], [
      kicker("Apps"),
      p("Builds is your maker inventory: projects you have built, documentation hooks, folder links, rescans, timeline, and browse views. Treat it as the index of everything on the workbench."),
      p("Who it is for: developers and creators juggling many repos and side projects."),
      p("How it fits: list/open/new/delete/duplicate manage the shelf; folder/rescan keep trees fresh; builds(link Name path:C:\\…) attaches a filesystem path. Drift watches change; Builds remembers what the project is."),
      h2("Open it"),
      code(["run builds","builds(browse)","builds(timeline)","builds(open Operating System)","focus builds"]),
      h2("Surfaces / pages"),
      table(["Page","What it is","Open with"], [["browse","Project shelf browser","builds(browse)"],["timeline","Activity / timeline","builds(timeline)"],["project","Single project","builds(open …)"],["web / fav filters","Filtered lists","builds(list web) etc."]]),
      h2("Shell commands"),
      code(["builds(list)","builds(list web)","builds(open Operating System)","builds(new My App)","builds(delete My App)","builds(duplicate My App)","builds(timeline)","builds(browse)","builds(folder My App)","builds(rescan My App)","builds(link Name path:C:\\path\\to\\proj)","builds(help)"]),
      table(["Verb","What it does","Silent?"], [["list / list web","List projects (optionally filtered)","Yes"],["open <name>","Open project","No"],["new <name>","Create project entry","Yes"],["delete <name>","Delete entry","Yes"],["duplicate <name>","Duplicate entry","Yes"],["timeline","Open timeline","No"],["browse","Open browse","No"],["folder <name>","Reveal / focus folder linkage","Depends"],["rescan <name>","Rescan project files","Yes / message"],["link Name path:…","Link a filesystem path","Yes"],["help","Help string","Yes"]]),
      tip("Name matching is fuzzy. use a unique substring when several projects share a prefix."),
      h2("Typical workflow"),
      ol(["builds(new Side Tool)","builds(link Side Tool path:C:\\src\\side-tool)","builds(rescan Side Tool) after big refactors.","builds(timeline) on Friday for a retrospective."]),
      note("Drift answers “what changed?”; Builds answers “what exists on my shelf?”"),
      h2("Shelf vs disk"),
      table(["Question","Ask","Command seed"], [["What projects exist?","Builds list","builds(list)"],["Where is the folder?","folder / link","builds(folder …) / link path:"],["What changed recently?","Drift","drift(list today)"],["Open the editor","External","run cursor"]]),
      code(["builds(list web)","builds(rescan Operating System)","builds(timeline)"]),
      p("duplicate is useful for templating a project entry without cloning the disk tree by itself."),
      h2("Related"),
      p("app-drift, app-scripts, app-external, recipe-dev."),
    ])
  );

  add(
    P("app-lexicon", "Code Lexicon", "6000+ programming concepts: search, browse, daily", ["apps","lexicon","code-lexicon"], [
      kicker("Apps"),
      p("Code Lexicon is a searchable encyclopedia of 4000+ programming concepts. Bare lexicon(promise) prints a definition silently; open jumps to the term panel. Daily and stats keep a learning habit alive."),
      p("Who it is for: developers leveling up vocabulary, interview prep, and teachers building decks."),
      p("How it fits: feed Study Deck with concepts you look up; use categories to browse domains."),
      h2("Open it"),
      code(["run lexicon","run code-lexicon","lexicon(open promise)","lexicon(categories)","lexicon(daily)","focus lexicon"]),
      h2("Surfaces / pages"),
      table(["Surface","What it is","Open with"], [["search / browse","Concept browser","run lexicon"],["term","Single concept panel","lexicon(open …) / bare term"],["daily","Daily concept","lexicon(daily)"],["stats","Usage / learning stats","lexicon(stats)"],["categories","Category browse","lexicon(categories)"]]),
      h2("Shell commands"),
      code(["lexicon(search monad)","lexicon(get promise)","lexicon(promise)","lexicon(daily)","lexicon(stats)","lexicon(categories)","lexicon(open promise)","lexicon(help)"]),
      table(["Verb","What it does","Silent?"], [["search <query>","Search concepts","Yes"],["get <term>","Definition summary","Yes"],["bare term","Convenience get/open path","Usually silent get"],["daily","Daily concept","Yes or navigates"],["stats","Stats summary","Yes"],["categories","Open / list categories","Depends"],["open <term>","Open term UI","No"],["help","Help string","Yes"]]),
      tip("lexicon(promise) in a macro while decks(add …) captures your own wording."),
      h2("Typical workflow"),
      ol(["lexicon(daily) with morning coffee.","lexicon(search event loop) then open.","Add a Study Deck card for anything you could not explain aloud."]),
      h2("Learning loop"),
      ol(["lexicon(daily) or search a gap.","Read get/open until you can explain it aloud.","decks(add …) with your explanation on the back.","studydeck(study …) tomorrow."]),
      code(["lexicon(search closure)","lexicon(get closure)","lexicon(categories)","lexicon(stats)"]),
      h2("Related"),
      p("app-decks, app-studies, app-flags, recipe-dev."),
    ])
  );

  add(
    P("app-drift", "Drift", "What changed on your PC: projects, files & activity", ["apps","drift"], [
      kicker("Apps"),
      p("Drift is change awareness across watched zones: scans produce events, lists slice today/week, search finds noise, insights summarize, and pause/resume control the firehose. It answers “what moved on disk?” while you were focused elsewhere."),
      p("Who it is for: developers who want a timeline of project churn without reading every git status by hand."),
      p("How it fits: Builds is the shelf; Drift is the motion sensor. drift(add path) registers zones; open eventId jumps into a specific event."),
      h2("Open it"),
      code(["run drift","drift(list today)","drift(insights)","drift(open <eventId>)","drift(zones)","focus drift"]),
      h2("Surfaces / pages"),
      table(["Surface","What it is","Open with"], [["timeline / list","Event timeline","drift(list) / list today|week"],["zones","Watched paths","drift(zones)"],["insights","Summaries","drift(insights)"],["event","Single event","drift(open eventId)"],["status","Running / paused","drift(status)"]]),
      h2("Shell commands"),
      code(["drift(scan)","drift(list)","drift(list today)","drift(list week)","drift(search *.ts)","drift(zones)","drift(insights)","drift(pause)","drift(resume)","drift(status)","drift(open eventId)","drift(add C:\\src\\my-app)","drift(help)"]),
      table(["Verb","What it does","Silent?"], [["scan","Trigger a scan","Yes / message"],["list / list today|week","List events in a window","Yes"],["search <query>","Search events","Yes"],["zones","List or open zones","Depends"],["insights","Insight summary","Yes"],["pause / resume","Pause or resume watching","Yes"],["status","Watcher status","Yes"],["open <eventId>","Open event UI","No"],["add <path>","Add a watch zone","Yes"],["help","Help string","Yes"],["pages","Page navigation forms where wired","No"]]),
      tip("Pause Drift during huge installs or node_modules storms, then resume."),
      h2("Typical workflow"),
      ol(["drift(add C:\\src\\operating-system)","Work for an hour.","drift(list today); drift(insights).","drift(open …) on surprising events."]),
      warn("Watching entire drives can be noisy: prefer project roots as zones."),
      h2("Noise control"),
      ul(["Prefer project roots over user-home watches.","pause during npm install / large clones.","insights after a long day instead of reading every event.","search with extensions (*.ts) to cut chatter."]),
      code(["drift(pause)","drift(resume)","drift(list week)","drift(search package-lock)"]),
      h2("Related"),
      p("app-builds, app-sysinfo, app-info, recipe-dev."),
    ])
  );

  add(
    P("app-flow", "Model Flow", "Personal Zapier: AI plans tool flows, you approve", ["apps","flow","model-flow"], [
      kicker("Apps"),
      p("Model Flow is personal automation with a human gate: AI plans a tool flow, you edit or drop steps, then approve before anything with side effects runs. Shell can draft plans and paint them into an open studio; approval stays in the UI on purpose."),
      p("Who it is for: power users who want Zapier-like chains without blind auto-execution."),
      p("How it fits: Console holds aliases/macros/when; Scripts holds deterministic multi-step programs; Flow is the AI-planned path with consent."),
      h2("Open it"),
      code(["run flow","run model-flow","flow(open)","flow(studio)","flow(plan summarize my morning)","focus flow"]),
      h2("Surfaces / pages"),
      table(["Surface","What it is","Notes"], [["studio","Compose → plan → edit → approve canvas","Blank flow, templates, step editor"],["History panel","Past runs; search, pin, delete, Open / Reuse","Side panel"],["Saved panel","Named flows you keep","Save flow from review/done"],["Tools panel","Live vs Staged tools","Live includes shell, stocks, translate, contacts, wait"],["Connection panel","Lab key status; set / clear key","Never shows the raw key"]]),
      h2("Shell commands"),
      code(["flow(meta)","flow(tools)","flow(history)","flow(plan …)","flow(open)","flow(studio)","flow(help)"]),
      table(["Verb","What it does","Silent?"], [["meta","Key / model / program status","Yes"],["tools","List tools with live/staged","Yes"],["history","List runs; sync History panel if open","Yes"],["library / saved","List saved flows; open Saved panel","Yes"],["blank / new","Open a blank studio flow","No"],["plan …","Draft a plan; paints studio if Flow is open","Message"],["open / studio","Open Flow UI","No"],["approve","Approve in UI — not a blind shell fire","UI"],["help","Help string","Yes"]]),
      warn("Never assume plan implies execute. Approve in UI before side effects. Staged tools can appear in plans but do not execute yet."),
      h2("Typical workflow"),
      ol(["Open Flow and set a Lab key under Connection (or use the local planner).","Describe a task → Plan.","Edit chips or Drop steps, then Approve & run.","Use Save as script after review or a successful run to crystallize into Scripts.","Reopen a past run from History to re-approve or reuse the task."]),
      tip("Use Flow to explore; Scripts to crystallize. Save as script writes a Scripts body from live shell/stocks/translate/contacts steps. Export .space (or pack(export flow Title) after saving to the library) to share a plan as a file."),
      h2("Plan quality tips"),
      ul(["Be specific: name apps and verbs you already know exist.","Prefer Live tools when you need real email, sheets, shell, stocks, translate, or contacts.","Save good plans with Save as script when stable."]),
      code(["flow(tools)","flow(plan list today then quote AAPL)","flow(studio)"]),
      h2("Related"),
      p("app-scripts, app-console, automation-patterns, model-flow (handbook)."),
    ])
  );

  add(
    P("app-console", "Console", "Command engine: run, aliases, macros, when & history", ["apps","console","shell-console"], [
      kicker("Apps"),
      p("Console is the visual editor for the same command engine the desktop shell uses: aliases, macros, when-rules, history, runner, and a reference cheat-sheet. If the empty-space command line is the cockpit, Console is the hangar."),
      p("Who it is for: anyone authoring automation beyond one-off lines."),
      p("How it fits: edits here affect desktop shell behavior. Docs teaches; Console configures; Scripts stores long programs."),
      h2("Open it"),
      code(["run console","run shell-console","console(open aliases)","console(reference)","console(runner)","focus console"]),
      h2("Surfaces / pages"),
      table(["Surface","What it is","Open with"], [["aliases","Alias editor","console(open aliases) / aliases"],["macros","Macro editor","console(macros)"],["when","When-rules editor","console(when)"],["history","Command history","console(history)"],["runner","Run scratch commands","console(runner)"],["reference","Pocket cheat-sheet","console(reference)"]]),
      h2("Shell commands"),
      code(["console(aliases)","console(macros)","console(when)","console(history)","console(runner)","console(reference)","console(open aliases)","console(help)"]),
      table(["Verb","What it does","Silent?"], [["aliases / macros / when / history / runner / reference","Open those surfaces","No"],["open aliases","Explicit open form","No"],["help","Help string","Yes"]]),
      note("Creating an alias in Console is the same store the desktop line uses — test with a simple echo/help target first."),
      h2("Typical workflow"),
      ol(["console(reference) when learning verbs.","console(open aliases) → add morning → today(list); stocks(list).","console(when) for event-driven rules.","console(history) to promote a good line into a macro."]),
      tip("Keep macro names short and conflict-free with app names."),
      h2("Alias vs macro vs when vs script"),
      table(["Kind","Shape","Example idea"], [["Alias","Short name → one command","t → today(list)"],["Macro","Named multi-command line","morning → today(list); stocks(list)"],["When","Event-driven rule","On focus start → clock(pomodoro start)"],["Script","Long saved program in Scripts app","run scripts(morning)"]]),
      code(["console(open aliases)","console(macros)","console(when)","console(reference)"]),
      h2("Related"),
      p("app-scripts, aliases-macros, when-rules, shell-language, cmd-protocol."),
    ])
  );

  add(
    P("app-scripts", "Scripts", "Long multi-step shell programs: write, save, run", ["apps","scripts"], [
      kicker("Apps"),
      p("Scripts stores long multi-step shell programs: sequences of shell lines saved by name and run on demand. It is the home for morning / shutdown sequences once verbs are stable."),
      p("Who it is for: users who outgrew one-line macros and want editable programs with a real authoring surface."),
      p("How it fits: scripts(…) is on the unified command protocol. A script body is a full program: let, fn, if/loop, and app(verb) share one scope for that run."),
      h2("Open it"),
      code(["run scripts","scripts(open)","scripts(open morning)","focus scripts"]),
      h2("Surfaces / pages"),
      table(["Surface","What it is","Notes"], [["library","Named scripts","scripts(list)"],["editor","Multi-line authoring","scripts(open name)"],["runner","Execute a named script","scripts(run name)"]]),
      h2("Shell commands"),
      code(["scripts(list)","scripts(get morning)","scripts(run morning)","scripts(open morning)","scripts(new focus)","scripts(duplicate morning)","scripts(delete focus)","scripts(help)"]),
      table(["Verb","What it does","Silent?"], [["list / ls","Inventory scripts","Yes"],["get <name>","Script metadata","Yes"],["run <name>","Execute saved script body as one program","Yes (steps may open apps)"],["open [name]","Open Scripts UI / a script","No"],["new / create [name]","Create a script","Yes + syncIfOpen"],["duplicate <name>","Copy a script","Yes + syncIfOpen"],["delete / rm <name>","Delete a script","Yes"],["help","Help string","Yes"],["<name> (bare)","Open that script in UI","No"]]),
      tip("Export a single script as a .space file (Scripts → Export .space, or pack(export script morning)). See space-files. Do not use space(…) — that is the astronomy app."),
      h2("Program features inside a script"),
      code([
        "fn morning() {",
        "  let tasks = today(list)",
        "  stocks(list)",
        "  today(add review $tasks)",
        "}",
        "morning()",
      ]),
      tip("See docs(open shell-vars) and docs(open shell-functions). Desktop: help lang."),
      h2("Starter rituals"),
      code(["scripts(run morning), scripts(run focus), scripts(run eod), scripts(run remote)"]),
      p("Seeded once by name: your edits are never overwritten. Pair with backup(export) so rituals travel with you."),
      h2("Typical workflow"),
      ol(["Prototype: today(list); stocks(list); sys(cpu).","scripts(new morning) then edit the body in Scripts.","scripts(run morning) daily (or from a macro).","Graduate Flow experiments into Scripts when stable."]),
      h2("Example morning script body"),
      code(["today(list)","stocks(list)","sys(cpu)","drift(list today)","contracts(upcoming)"]),
      note("Chaining operators follow shell-chaining (; stops on error, | continues)."),
      h2("Related"),
      p("app-console, app-flow, scripts-app, automation-patterns, cmd-protocol."),
    ])
  );

  add(
    P("app-connect", "Connect", "Mail, messaging, social, AI & browsers inside My Space", ["apps","connect","mail","browser","gmail"], [
      kicker("Apps"),
      p("Connect (desktop id mail, module mail) is the hub for web mail, messaging, social, AI chats, media, tools, and in-app browsers. Services open as My Space workspace tabs — not as your system browser — unless a site truly cannot run in-app."),
      p("Who it is for: anyone who wants Gmail, WhatsApp Web, ChatGPT, YouTube, or a unified search browser without leaving the desktop shell."),
      p("How it fits: Connect catalogs services; the workspace address bar and My Space Browser search across apps, handbook-style content, Connect services, and the web. Mail notifications deep-link back into Gmail inside Connect."),
      h2("Open it"),
      code(["run mail","run connect","focus mail","focus connect"]),
      note("config/apps.json keeps id mail for compatibility; the visible name is Connect."),
      h2("Surfaces"),
      table(["Surface","What it is","Notes"], [["Catalog","Cards by category (Browser, Mail, Messaging, Social, AI, Media, Tools)","Search filters the grid"],["Opened panel","Confirms a service opened in a My Space tab","Re-open / back to catalog"],["Workspace tab","In-app webview with address bar","appId connect-<service>"]]),
      h2("Categories (examples)"),
      table(["Category","Examples"], [["Browser","My Space Browser, Google, Microsoft Edge (Bing), Browser"],["Mail","Gmail, Outlook, Yahoo Mail"],["Messaging","WhatsApp, Telegram, Discord, Slack, Messenger, Teams"],["Social","Instagram, X, LinkedIn, Facebook, Reddit, TikTok"],["AI","Ollama, ChatGPT, Claude, Gemini"],["Media","YouTube, Spotify, Netflix"],["Tools","GitHub, Notion, Drive, OneDrive"]]),
      h2("My Space Browser"),
      p("My Space Browser is Connect’s own start page: search apps, Connect services, in-My-Space content (same index as the command palette / desktop search), URLs, and web search — then browse in the same tab."),
      ul(["Open from Connect → Browser → My Space Browser."]),
      ul(["Home page search and the workspace address bar both use the unified index."]),
      ul(["New tab (+) while this browser is active returns to the My Space Browser home."]),
      ul(["Navigation stays inside My Space (forceInApp) for connect-* tabs."]),
      tip("Logo: Electron atom mark with green foreground: sibling of the default app icon, not the gold M installer mark."),
      h2("Opening a service"),
      ol(["Open Connect.","Pick a card (or search the catalog).","The service opens in a workspace web tab (connect-<id>).","Use the address bar to move around; sign in inside the tab when needed."]),
      warn("Some sites may show “browser not secure”. Connect uses a partition-only Firefox-style UA for Google hosts; avoid setting a global Electron UA (that can break the catalog)."),
      h2("Mail notifications"),
      p("New mail can push into the Notifications bell. Click Open to jump to Gmail in Connect (optional message deep link). Use Block on a mail card to silence that sender — see app-notifications."),
      h2("Shell"),
      p("Connect is primarily UI-driven. Open/focus via run/focus; there is no full mail(verb) table for every hub service yet."),
      table(["Verb / form","What it does","Silent?"], [["run mail / run connect","Open Connect hub","No"],["focus mail","Focus Connect if open","No"]]),
      h2("Related"),
      p("app-notifications, app-external, apps-directory, desktopSearch / command palette."),
    ])
  );

  add(
    P("app-notifications", "Notifications", "Bell inbox, mail alerts, and sender blocklist", ["apps","notifications","mail","bell"], [
      kicker("Apps"),
      p("Notifications is the desktop bell inbox: updates, mail alerts, and other system messages. It is not a separate desktop tile — open it from the taskbar bell."),
      p("Who it is for: anyone who wants mail noise under control without leaving My Space, and anyone applying Restart & Update banners."),
      h2("Open it"),
      ul(["Click the taskbar bell."]),
      ul(["Unread count shows on the badge."]),
      h2("Mail alert cards"),
      table(["Button","What it does"], [["Open","Marks read and routes into Connect / Gmail (message deep link when available)"],["Dismiss","Removes the notification (update cards may also skip an update)"],["Block","Blocks future alerts from that sender, removes the card, updates the blocklist"]]),
      tip("Block works even on older cards by using the sender email when stored, or the display name from the title when email is missing."),
      h2("Settings (gear in the inbox)"),
      ul(["Toggle mail alerts on/off."]),
      ul(["See blocked senders and remove them from the blocklist."]),
      ul(["Add a sender email manually to the blocklist."]),
      h2("Prefs storage"),
      p("Preferences live in userData as notifications-prefs.json (mailAlertsEnabled, blockedSenders). The blocklist accepts emails and normalized display names."),
      h2("Related"),
      p("app-connect, updates banners, myspace-bridge (notifications namespace)."),
    ])
  );

  add(
    P("app-external", "External apps", "Edge, Docker, VS Code, Terminal, Cursor, GitHub", ["apps","external"], [
      kicker("Apps"),
      p("External pins live in config/apps.json as type external (local executable) or url (browser). They appear on the desktop like myapps but do not expose app(verb) protocols — you run, focus, and close them."),
      p("Who it is for: everyone who still lives in Edge, Docker, VS Code, Windows Terminal, Cursor, and GitHub while using My Space as the orchestration layer."),
      p("How it fits: My Space launches and focuses; the external tool does the specialized work. Prefer quoted names when spaces exist: run \"vs code\"."),
      h2("Open it"),
      code(["run edge","run docker","run \"vs code\"","run vscode","run terminal","run cursor","run github","focus edge","focus cursor"]),
      h2("Surfaces / pages"),
      table(["App","Id","Kind","Notes"], [["Microsoft Edge","edge","external","Browser"],["Docker Desktop","docker","external","Containers; optional in-app URL for localhost dashboard"],["VS Code","vscode","external","Classic editor"],["Terminal","terminal","external","Windows Terminal"],["Cursor","cursor","external","AI editor"],["GitHub","github","url","Opens https://github.com"]]),
      h2("Shell commands"),
      code(["run edge","focus edge","close edge","run docker","run vscode","run \"vs code\"","run terminal","run cursor","focus cursor","close cursor","run github"]),
      table(["Verb / form","What it does","Silent?"], [["run <id|name>","Launch external / open URL","No"],["focus <id|name>","Focus existing window if running","No"],["close <id|name>","Close / quit when supported","No"]]),
      note("Paths are resolved from apps.json (Program Files, LOCALAPPDATA, wt.exe, etc.). If launch fails, verify the executable still exists."),
      h2("Typical workflow"),
      ol(["run cursor for AI editing; run terminal for OS shell.","run docker before container work; sys(ports) to confirm binds.","run github when you need the web PR view quickly.","close unused externals at end of day to reclaim RAM."]),
      tip("Fuzzy names work: edge, docker, vscode, terminal, cursor, github: quotes help with vs code."),
      warn("External apps have no stocks-like verb tables: do not write edge(list) expecting My Space protocol behavior."),
      h2("Focus discipline"),
      p("External editors and browsers accumulate windows. Prefer focus over run when the app is already up, and close at end of day for RAM. My Space cannot teach VS Code or Cursor verbs — those stay inside those products."),
      code(["focus cursor","run terminal","close docker","run github"]),
      h2("Path troubleshooting"),
      ul(["Confirm apps.json paths still match install locations.","VS Code and Cursor often live under LOCALAPPDATA\\Programs.","Terminal may resolve via wt.exe on PATH.","GitHub is a URL pin — it always needs network."]),
      h2("Related"),
      p("apps-external, app-builds, app-sysinfo, recipe-dev, app-remote."),
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