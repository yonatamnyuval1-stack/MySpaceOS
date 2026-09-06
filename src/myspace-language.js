(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.MySpaceLanguage = api;
  }
})(typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : this, function () {
  const NAME = "My Space Language";
  const SHORT = "Language";
  const DOC_ID = "shell-language";
  const ATLAS_LANGUAGE_ID = "language";

  const PURPOSE =
    "Orchestrate My Space: connect the OS to apps inside it, drive platform services, automate the surroundings, and coordinate other languages when building real things. Not a general-purpose app language: other languages own app-internal logic.";

  const VISION =
    "Together with Python, JavaScript, and other host languages, My Space Language lets users build My Space apps, automations, and portable artifacts, without leaving the OS contract. The language wires; host languages implement; platform services enforce permissions and capacity.";

  const DIVISION_OF_LABOR = [
    {
      owner: NAME,
      owns: "Glue & OS contract",
      examples: [
        "app(scaffold …)",
        "msl(expose …)",
        "pulse(send …)",
        "permissions(…)",
        "schedule(…)",
        "pack(build …)",
        "host(run …)",
      ],
    },
    {
      owner: "Host languages (Python, Node, …)",
      owns: "App-internal logic, UI generation, algorithms, data crunching",
      examples: ["Business rules", "React/Vue UI", "ML models", "CLI tools"],
    },
    {
      owner: "Platform services",
      owns: "Runtime enforcement. not syntax",
      examples: ["Jobs capacity", "Scheduler timers", "Permissions gates", "Files sandbox"],
    },
  ];

  const LAYERS = [
    {
      id: "language",
      name: NAME,
      role: "Grammar + operations (let, fn, if, and every module verb)",
    },
    {
      id: "scripts",
      name: "Scripts",
      role: "Runtime and library for saved programs written in the language",
    },
    {
      id: "shell",
      name: "Shell",
      role: "Atlas and entry surfaces: desktop line, palette, Platform → Shell",
    },
    {
      id: "services",
      name: "Platform services",
      role: "Jobs, Scheduler, Files, MSL, Pulse, Permissions…, called by language operations",
    },
    {
      id: "host",
      name: "Host languages",
      role: "Python, Node, PowerShell: app logic invoked by host(…) under Permissions",
    },
  ];

  const CREATE_LADDER = [
    {
      id: "objects",
      title: "In-OS objects",
      status: "live",
      blurb: "Notes, tasks, schedules, jobs, Pulse messages, MSL caps",
      ops: ["notes(add …)", "schedule(add …)", "jobs(run …)", "pulse(send …)"],
    },
    {
      id: "programs",
      title: "Language programs",
      status: "live",
      blurb: "Scripts as first-class artifacts the language can write",
      ops: ["scripts(set …)", "scripts(append …)", "scripts(run …)"],
    },
    {
      id: "files",
      title: "Workspace files",
      status: "live",
      blurb: "Materialize files and folders under userData/workspace",
      ops: ["files(write …)", "files(append …)", "files(mkdir …)", "files(copy …)"],
    },
    {
      id: "host",
      title: "Host interop",
      status: "live",
      blurb: "Run Python/Node/PowerShell on workspace scripts (Permissions + Jobs)",
      ops: ['host(run python -- file:tools/x.py)', "host(run node -- file:tools/gen.js)"],
    },
    {
      id: "apps",
      title: "My Space apps",
      status: "live",
      blurb: "Scaffold user app packages; register on desktop; pack for share",
      ops: ["app(scaffold …)", "app(register …)", "pack(build …)", "run <id>"],
    },
    {
      id: "portable",
      title: "Portable artifacts",
      status: "live",
      blurb: ".space exports and pack import: share scripts, flows, notes, decks",
      ops: ["pack(export script …)", "pack(open file.space)"],
    },
  ];

  const APP_PACKAGE = {
    summary:
      "A My Space app = manifest (glue) + core (host language) + optional MSL/Pulse profiles. The language scaffolds and wires; host code fills logic.",
    parts: [
      { id: "manifest", path: "apps/<id>/manifest.json", role: "Identity, version, module id" },
      { id: "glue", path: "apps/<id>/pulse.json, preload, index.html", role: "How the app talks to My Space" },
      { id: "core", path: "apps/<id>/lib/ or tools/<id>/", role: "Python/JS/etc. — product logic" },
      { id: "msl", path: "Declared capabilities", role: "msl(expose …) from the language" },
      { id: "register", path: "config/apps.json entry", role: "Desktop / Platform visibility" },
    ],
    exampleFlow: [
      "app(scaffold todo template:minimal)",
      "host(run node -- file:tools/todo/scaffold-ui.js)",
      "msl(expose todo.list)",
      "pack(build todo)",
      "run todo",
    ],
  };

  const OPERATION_FAMILIES = [
    {
      id: "apps",
      title: "Apps & surfaces",
      blurb: "Open, focus, and route into apps",
      examples: ["run notes", "today(open)", "space(ocean)"],
      status: "live",
    },
    {
      id: "create",
      title: "Create & mutate (in-OS)",
      blurb: "Create first-class My Space objects and programs",
      examples: [
        "notes(add …)",
        "schedule(add …)",
        "scripts(set …)",
        "scripts(append …)",
        "files(write …)",
        "files(mkdir …)",
      ],
      status: "live",
    },
    {
      id: "platform",
      title: "Platform services",
      blurb: "Drive OS services as language operations",
      examples: ["jobs(list)", "schedule(list)", "files(…)", "mind(ask …)"],
      status: "live",
    },
    {
      id: "link",
      title: "Connect apps",
      blurb: "Cross-app wiring inside My Space",
      examples: ["msl(invoke …)", "pulse(send …)", "parts(adopt …)"],
      status: "live",
    },
    {
      id: "host",
      title: "Host interop",
      blurb: "Invoke other languages as tools (Permissions + Jobs)",
      examples: ['host(run python file:tools/x.py)', "host(run node file:tools/gen.js)"],
      status: "live",
    },
    {
      id: "build",
      title: "Build apps & artifacts",
      blurb: "Scaffold apps, write workspace files, pack for share",
      examples: ["app(scaffold …)", "files(write …)", "pack(build …)"],
      status: "live",
    },
    {
      id: "flow",
      title: "Program flow",
      blurb: "Language grammar for small programs",
      examples: ["let x = …", "fn name(){…}", "if … then …"],
      status: "live",
    },
    {
      id: "automate",
      title: "Shortcuts & reactions",
      blurb: "Personal automation in the language engine",
      examples: ["alias …", "macro …", "when … then …"],
      status: "live",
    },
  ];

  function layerBlurb() {
    return LAYERS.map((l) => `${l.name}: ${l.role}`).join(" · ");
  }

  function purposeParagraphs() {
    return [
      `${NAME} is the orchestration language of My Space OS.`,
      VISION,
      PURPOSE,
      "Every live module verb: notes(…), jobs(…), schedule(…), msl(…), scripts(set …), and the rest of ROUTE_REGISTRY, is a language operation. Shell Atlas maps them; Scripts runs long programs; platform services enforce runtime; host languages fill app logic when host(…) is wired.",
    ];
  }

  function createLadderSummary() {
    return CREATE_LADDER.map(
      (step) => `${step.title} (${step.status}): ${step.blurb}`
    );
  }

  function operationsFromRegistry(registry) {
    const rows = [];
    const reg = registry && typeof registry === "object" ? registry : {};
    for (const [moduleId, def] of Object.entries(reg)) {
      if (!def || typeof def !== "object") continue;
      const alias = (def.aliases && def.aliases[0]) || moduleId;
      rows.push({
        moduleId,
        alias,
        form: `${alias}(…)`,
        platform: !!def.platform,
        title: String(moduleId),
        examples: Array.isArray(def.examples) ? def.examples.slice(0, 3) : [],
        status: "live",
      });
    }
    rows.sort((a, b) => a.alias.localeCompare(b.alias));
    return rows;
  }

  return {
    NAME,
    SHORT,
    DOC_ID,
    ATLAS_LANGUAGE_ID,
    PURPOSE,
    VISION,
    DIVISION_OF_LABOR,
    LAYERS,
    CREATE_LADDER,
    APP_PACKAGE,
    OPERATION_FAMILIES,
    layerBlurb,
    purposeParagraphs,
    createLadderSummary,
    operationsFromRegistry,
  };
});