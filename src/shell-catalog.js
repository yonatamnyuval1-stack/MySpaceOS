(function () {
  const TITLE_MAP = {
    "system-info": "System Info",
    docs: "Docs",
    "world-clock": "World Clock",
    "day-planner": "Today / Day Planner",
    stocks: "Stocks",
    builds: "Builds",
    profiles: "Vault / Profiles",
    drift: "Drift",
    "study-deck": "Study Deck",
    contacts: "Contacts",
    notes: "Notes",
    chat: "Chat",
    translate: "Translate",
    "remote-hub": "Remote Hub",
    "os-bridge": "OS Bridge",
    files: "Files",
    studies: "Studies",
    geography: "Geography",
    "flag-quiz": "Flag Quiz",
    history: "History",
    space: "Space",
    contracts: "Contracts",
    "msl-protocol": "MSL",
    parts: "Parts",
    permissions: "Permissions",
    pulse: "Pulse",
    jobs: "Jobs",
    scheduler: "Scheduler",
    mind: "Mind",
    "code-lexicon": "Code Lexicon",
    "model-flow": "Model Flow",
    "shell-console": "Shell (Atlas)",
    scripts: "Scripts",
    "world-maps": "World Maps",
    mail: "Connect / Mail",
  };

  function splitBullets(text) {
    return String(text || "")
      .split(/\s*·\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function humanTitle(moduleId) {
    if (TITLE_MAP[moduleId]) return TITLE_MAP[moduleId];
    return String(moduleId || "")
      .split(/[-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  function primaryAlias(moduleId, def) {
    return (def.aliases && def.aliases[0]) || moduleId;
  }

  function moduleSummary(moduleId, def) {
    const lang = window.MySpaceLanguage;
    const alias = primaryAlias(moduleId, def);
    const title = humanTitle(moduleId);
    const aliasList = (def.aliases || []).length
      ? (def.aliases || []).join(", ")
      : alias;
    const langName = lang?.NAME || "My Space Language";
    return [
      `${title} is a first-class ${langName} operation (module verb), not a separate mini-language.`,
      `Invoke it with ${alias}(…): for example ${alias}(help), or open/run the app with run ${alias} / ${alias}.`,
      `Registered aliases: ${aliasList}.`,
      def.commands
        ? "This operation supports the app-command protocol: verbs and pages run without wrapping in run when you use parentheses."
        : "This operation is primarily route-based (pages and navigation).",
      def.platform
        ? "It backs a platform service: the language calls the service; open the service UI from Platform or via the same verb."
        : "It can be launched as an app when installed.",
    ].join(" ");
  }
  
  function buildModuleEntry(moduleId, def, cmds) {
    const helpRaw = cmds.getCommandHelpForModule?.(moduleId) || "";
    const routes = cmds.formatRoutesCheck?.(moduleId, [])?.message || "";
    const alias = primaryAlias(moduleId, def);
    const sections = [];

    sections.push({
      heading: "Overview",
      paragraphs: [moduleSummary(moduleId, def)],
    });

    sections.push({
      heading: "How to call it",
      paragraphs: [
        `Basic forms:`,
      ],
      items: [
        `${alias}(help): module-specific command help`,
        `${alias}(<page>): open or switch to a page/surface`,
        `${alias}(<verb> …): run a verb with arguments`,
        `run ${alias}: launch / focus the app when applicable`,
        `run ${alias}(<page>): same as ${alias}(<page>) for most modules`,
        `help ${alias}: short help line in the shell`,
        `check routes ${alias}: dump pages, aliases, examples, and grammar for this module`,
      ],
    });

    if (def.aliases?.length) {
      sections.push({
        heading: "Aliases",
        paragraphs: [
          "Any of these names resolve to the same module. Use whichever is shortest to type.",
        ],
        items: def.aliases.map((a) => `${a} → ${moduleId}`),
      });
    }

    if (def.pages?.length) {
      sections.push({
        heading: "Pages and surfaces",
        paragraphs: [
          "These page ids are accepted inside parentheses (and by run …(page) when routing is wired). Prefer the names below over inventing new ones.",
        ],
        items: def.pages.map((p) => `${alias}(${p})`),
      });
    }

    if (def.views?.length) {
      sections.push({
        heading: "Views",
        items: def.views.map((v) => String(v)),
      });
    }

    if (def.modes?.length) {
      sections.push({
        heading: "Modes",
        items: def.modes.map((m) => `mode:${m}`),
      });
    }

    if (def.bare) {
      sections.push({
        heading: "Bare argument form",
        paragraphs: [
          `This module accepts a bare positional argument of type “${def.bare}” (in addition to key:value args).`,
        ],
      });
    }

    if (def.deep && typeof def.deep === "object") {
      sections.push({
        heading: "Deep links",
        paragraphs: ["Some pages map to dedicated in-app methods:"],
        items: Object.entries(def.deep).map(([page, fn]) => `${page} → ${fn}`),
      });
    }

    const helpItems = splitBullets(helpRaw);
    if (helpItems.length) {
      sections.push({
        heading: "Command reference (full help text)",
        paragraphs: [
          "This is the same help the live shell returns for help / module(help), expanded into individual entries so you can read every verb — not the shortened Docs handbook summaries.",
        ],
        items: helpItems,
      });
    }

    if (def.examples?.length) {
      sections.push({
        heading: "Examples",
        paragraphs: ["Copy-paste these into the desktop shell line or command palette:"],
        items: def.examples.slice(),
      });
    }

    const routeItems = splitBullets(routes).filter((l) => l !== moduleId);
    if (routeItems.length) {
      sections.push({
        heading: "Routes dump (check routes)",
        paragraphs: [
          `Equivalent to running check routes ${alias}. Useful when debugging whether a page or key is registered.`,
        ],
        items: routeItems,
      });
    }

    sections.push({
      heading: "Chaining and automation",
      paragraphs: [
        "Shell chains work with this module like any other command:",
      ],
      items: [
        `${alias}(…); ${alias}(…): stop the chain on first error`,
        `${alias}(…) | other(…): keep going even if a step fails`,
        `alias short = ${alias}(…): save a personal shortcut`,
        `macro name = ${alias}(…); other(…): multi-step personal macro`,
        `when <trigger> then ${alias}(…): react to events`,
        `if check … then ${alias}(…) else …: conditional runs`,
        `Long multi-step programs belong in Scripts (Platform → Scripts), not in one-line macros.`,
      ],
    });

    return {
      id: moduleId,
      kind: "module",
      title: humanTitle(moduleId),
      alias,
      aliases: def.aliases || [],
      group: def.platform ? "platform" : "apps",
      searchText: [
        moduleId,
        humanTitle(moduleId),
        ...(def.aliases || []),
        ...(def.pages || []),
        ...(def.examples || []),
        helpRaw,
      ]
        .join(" ")
        .toLowerCase(),
      sections,
    };
  }

  function buildLanguageEntry(cmds) {
    const lang = window.MySpaceLanguage;
    const name = lang?.NAME || "My Space Language";
    const families = lang?.OPERATION_FAMILIES || [];
    const layers = lang?.LAYERS || [];
    const ops = lang?.operationsFromRegistry?.(cmds.ROUTE_REGISTRY) || [];

    const sections = [
      {
        heading: "What the language is",
        paragraphs: lang?.purposeParagraphs?.() || [
          `${name} is the orchestration language of My Space OS.`,
          "It connects the OS to apps and drives platform services. App-internal logic belongs in other languages.",
        ],
      },
      {
        heading: "Layers (do not conflate)",
        paragraphs: [
          "Keep these roles separate: same cyan series in the rail, different jobs:",
        ],
        items: layers.length
          ? layers.map((l) => `${l.name} — ${l.role}`)
          : [
              "My Space Language: grammar + operations",
              "Scripts: runtime for saved programs",
              "Shell: atlas + entry surfaces",
              "Platform services: Jobs, Scheduler, … called by operations",
              "Host languages: Python/Node logic via host(…) when wired",
            ],
      },
      {
        heading: "North star: build with other languages",
        paragraphs: [
          lang?.VISION ||
            "Together with host languages, My Space Language lets users build apps and artifacts inside My Space.",
          "The language wires the OS contract; host languages implement app logic; platform services enforce permissions and capacity.",
        ],
        items: (lang?.DIVISION_OF_LABOR || []).map(
          (d) => `${d.owner} — ${d.owns} (e.g. ${(d.examples || []).slice(0, 2).join(", ")})`
        ),
      },
      {
        heading: "Create ladder",
        paragraphs: [
          "What building in My Space means: live operations today, roadmap for the rest:",
        ],
        items: (lang?.CREATE_LADDER || []).map(
          (step) =>
            `[${step.status}] ${step.title} — ${step.blurb} · ${(step.ops || []).slice(0, 2).join(" · ")}`
        ),
      },
      {
        heading: "App package (target)",
        paragraphs: [
          lang?.APP_PACKAGE?.summary ||
            "App = manifest + glue + host-language core + optional MSL caps.",
          "Example flow:",
        ],
        items: lang?.APP_PACKAGE?.exampleFlow || [
          "app(scaffold todo)",
          "host(run node -- file:tools/todo/gen.js)",
          "msl(expose todo.list)",
          "pack(build todo)",
        ],
      },
      {
        heading: "Operation families",
        paragraphs: [
          "Everything you type as module(…) is a language operation. Families (live and planned):",
        ],
        items: families.map(
          (f) =>
            `${f.title}${f.status && f.status !== "live" ? ` [${f.status}]` : ""}: ${f.blurb} — e.g. ${(f.examples || []).slice(0, 2).join(" · ")}`
        ),
      },
      {
        heading: "Live operations (from ROUTE_REGISTRY)",
        paragraphs: [
          "This list is generated from the live registry. the same source help and check routes use. Each row is an operation the language knows today.",
        ],
        items: ops.slice(0, 80).map((o) => {
          const ex = o.examples?.[0] ? ` — e.g. ${o.examples[0]}` : "";
          return `${o.form}${o.platform ? " · platform" : ""}${ex}`;
        }),
      },
      {
        heading: "Invocation grammar",
        paragraphs: [
          "Most app and platform operations accept parentheses. run is optional when the module is wired for commands.",
        ],
        items: [
          "run <app>: launch / focus an app",
          "<app>: shorthand launch when the name resolves",
          "<app>(page): open a specific page/surface",
          "<app>(verb args): execute an operation (preferred for platform services)",
          "help: global overview · help <app>: operation help · help lang: variables & functions",
          "check running · check apps · check routes <app> · check aliases · check macros · check when",
        ],
      },
      {
        heading: "Chaining",
        paragraphs: [
          "Use ; to stop on the first failing step. Use | to continue even when a step fails. Prefer Scripts for long programs.",
        ],
        items: [
          "cmd; cmd: sequential, abort on error",
          "cmd | cmd: sequential, keep going",
          "wait 5s · wait until 14:30. pause between steps",
        ],
      },
      {
        heading: "Variables (let / vars)",
        paragraphs: [
          "Variables capture command results or literals for later substitution. Names are case-sensitive.",
        ],
        items: splitBullets(cmds.formatLangHelp?.() || ""),
      },
      {
        heading: "Functions (fn)",
        paragraphs: [
          "Define reusable blocks with parameters. Do not name functions after installed apps (today, clock, …): those names are reserved for operations.",
        ],
        items: [
          "fn greet(name) { … }: define",
          "greet(Yonatan): call",
          "fn list · fns: list functions",
          "fn remove greet: delete a function",
          "Empty bodies are allowed",
        ],
      },
      {
        heading: "Conditionals (if)",
        paragraphs: ["Branch on check results or other conditions:"],
        items: splitBullets(cmds.formatIfHelp?.() || ""),
      },
      {
        heading: "Loops (loop / while / for)",
        paragraphs: [
          "Iteration is intentionally capped (safety). For heavy or long automation use Scripts or Jobs.",
        ],
        items: splitBullets(cmds.formatLoopHelp?.() || ""),
      },
      {
        heading: "Aliases, macros, and when-rules",
        paragraphs: [
          "Stored in the language engine (synced across the desktop). Short personal automation — long programs belong in Scripts.",
        ],
        items: [
          "alias name = command: create/update",
          "alias remove name: delete",
          "macro name = cmd; cmd: multi-step shortcut",
          "macro run name · macro remove name",
          "when <trigger> then <action>: event reactions (not the same as Scheduler time contracts)",
          "when remove <id> · check when · check aliases · check macros",
        ],
      },
    ];

    return {
      id: "language",
      kind: "language",
      title: name,
      alias: "lang",
      aliases: ["lang", "language", "myspace-language"],
      group: "core",
      searchText:
        "language myspace let fn vars unset if loop while for alias macro when chain wait help operations modules scripts shell",
      sections,
    };
  }

  function buildOverviewEntry() {
    const lang = window.MySpaceLanguage;
    const name = lang?.NAME || "My Space Language";
    return {
      id: "overview",
      kind: "overview",
      title: "Shell overview",
      alias: "overview",
      aliases: [],
      group: "core",
      searchText: "overview shell atlas language scripts jobs scheduler platform console retired",
      sections: [
        {
          heading: "Role in My Space",
          paragraphs: [
            `Platform → Shell is the atlas for ${name}: not a second language and not the Scripts runtime.`,
            `${name} orchestrates the OS: launch apps, call platform services (Jobs, Scheduler, Mind, Files, MSL, Pulse, Permissions, …), chain steps, and automate. Every module(…) verb is a language operation.`,
            "This atlas is generated from the live ROUTE_REGISTRY and module help: the same sources help and check routes use — expanded for reading.",
            "Type on the desktop shell line or command palette. Author long programs in Scripts. Queue heavy work through Jobs. Time contracts live in Scheduler (schedule(…) in the language).",
          ],
        },
        {
          heading: "Language · Scripts · Shell · Services",
          paragraphs: [lang?.layerBlurb?.() || ""],
          items: [
            `Language: ${name} (grammar + operations)`,
            "Scripts: runtime / library for saved language programs",
            "Shell: this atlas + desktop line + palette (entry & map)",
            "Services: Jobs, Scheduler, Files, … invoked by operations",
          ],
        },
        {
          heading: "Where to type / run",
          items: [
            "Desktop shell line: primary place to run language lines",
            "Command palette: search operations and actions",
            "Platform → Scripts: author and run saved multi-step programs",
            "Platform → Jobs: capacity and compute queue (not a second syntax)",
            "Platform → Scheduler: time contracts (schedule(…) from the language)",
            "Platform → Shell: this atlas (documentation), not a second runner",
          ],
        },
        {
          heading: "How operations are registered",
          paragraphs: [
            "Each app or platform service opts into the language with a ROUTE_REGISTRY entry: aliases, pages, examples, and often a dedicated executor (module(help) text).",
            "If an operation is missing here, it is missing from the live registry: fix the module wiring, not a separate docs-only list.",
          ],
        },
      ],
    };
  }

  function buildCoreEntry(cmds) {
    return {
      id: "core",
      kind: "core",
      title: "Core verbs & utilities",
      alias: "core",
      aliases: [],
      group: "core",
      searchText: "core wait close focus desktop pin reveal settings backup pack help check open goto",
      sections: [
        {
          heading: "Desktop & window control",
          paragraphs: [
            "These verbs talk to the My Space desktop layer (windows, focus, pins). They are language operations without a single app module.",
          ],
          items: [
            "close · close all · close <app>: close tabs/windows",
            "focus <app>: bring an app to front",
            "desktop: show the desktop surface",
            "pin / unpin: taskbar pins where supported",
            "reveal: reveal an item in context",
            "settings: open Settings",
            "open / goto: navigation helpers depending on target",
          ],
        },
        {
          heading: "Discovery",
          paragraphs: [cmds.formatHelp?.() || ""],
          items: splitBullets(cmds.formatCheckHelp?.() || ""),
        },
        {
          heading: "Backup",
          paragraphs: [
            "User-data backup and restore. Prefer these over manually copying folders.",
          ],
          items: [],
        },
      ],
    };
  }

  function buildBackupPackSections(cmds) {
    return [
      {
        heading: "Backup",
        paragraphs: [
          "backup(…) manages My Space userData archives. Use from the shell when you want an explicit export/import without opening Settings.",
        ],
        items: [
          "backup(export): zip userData to a file you choose",
          "backup(import) / backup(restore): restore from zip (restarts My Space)",
          "backup(path) / backup(open) / backup(reveal): open the data folder",
          "backup(status): size, last export, pending restore",
          "Also available from Settings → Maintenance",
        ],
      },
      {
        heading: "Pack (.space files)",
        paragraphs: [
          "pack(…) imports and exports portable My Space documents (.space) for scripts, flows, notes, and decks.",
        ],
        items: [
          "pack(open path\\file.space): import and open",
          "pack(inspect file.space): show kind/title without importing",
          "pack(pick): choose a .space file interactively",
          "pack(export script morning) · pack(export flow Title) · pack(export note Title) · pack(export deck Name)",
          "Opening a .space path directly is also supported in many contexts",
        ],
      },
    ];
  }

  function getShellCatalog() {
    const cmds = window.MySpaceShellCommands;
    if (!cmds?.ROUTE_REGISTRY) {
      return { generatedAt: Date.now(), entries: [buildOverviewEntry()], modules: [] };
    }

    const overview = buildOverviewEntry();
    const language = buildLanguageEntry(cmds);
    const core = buildCoreEntry(cmds);
    core.sections = core.sections.filter((s) => s.heading !== "Backup");
    core.sections.push(...buildBackupPackSections(cmds));

    const modules = Object.entries(cmds.ROUTE_REGISTRY)
      .filter(([id]) => id !== "shell-console")
      .map(([id, def]) => buildModuleEntry(id, def, cmds))
      .sort((a, b) => a.title.localeCompare(b.title));

    const modulesIndex = {
      id: "modules",
      kind: "index",
      title: "Language operations",
      alias: "modules",
      aliases: ["operations", "ops"],
      group: "core",
      searchText: ["operations", "ops", "modules", ...modules.map((m) => m.searchText)].join(" "),
      sections: [
        {
          heading: "Operations in My Space Language",
          paragraphs: [
            `There are ${modules.length} live operations registered in ROUTE_REGISTRY (excluding the retired Console app). Each module(…) verb is a first-class language operation, not a separate mini-language. Select any name in the sidebar for the full entry.`,
          ],
          items: modules.map((m) => `${m.title} — ${m.alias}(…) · ${m.group}`),
        },
      ],
    };

    const atlasSelf = {
      id: "shell",
      kind: "module",
      title: "Shell Atlas",
      alias: "shell",
      aliases: ["shell", "console"],
      group: "platform",
      searchText: "shell console atlas open help reference language",
      sections: [
        {
          heading: "This surface",
          paragraphs: [
            "Platform → Shell opens this atlas for My Space Language. shell(open) and console(open) also open it.",
            "Shell is the map/entry, not the language itself and not the Scripts runtime. Type on the desktop line; author long programs in Scripts; call Scheduler/Jobs as schedule(…)/jobs(…).",
          ],
          items: [
            "shell(open) · shell(overview) · shell(language) · shell(modules) · shell(core)",
            "Language page: purpose, layers, and live operations catalog",
            "console(…): compatibility alias; opens the same atlas",
            "help shell: points at this atlas",
          ],
        },
      ],
    };

    return {
      generatedAt: Date.now(),
      moduleCount: modules.length,
      entries: [overview, language, core, modulesIndex, atlasSelf, ...modules],
      modules,
    };
  }

  window.MySpaceShellCatalog = {
    getShellCatalog,
    humanTitle,
  };
})();
