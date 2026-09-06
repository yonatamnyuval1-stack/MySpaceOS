(function () {
  const P = (id, title, subtitle, tags, blocks) => ({ id, title, subtitle, tags, blocks });
  const h2 = (text) => ({ type: "h2", text });
  const h3 = (text) => ({ type: "h2", text });
  const p = (text) => ({ type: "p", text });
  const note = (text) => ({ type: "callout", tone: "note", text });
  const tip = (text) => ({ type: "callout", tone: "tip", text });
  const warn = (text) => ({ type: "callout", tone: "warn", text });
  const code = (lines) => ({ type: "code", lines: Array.isArray(lines) ? lines : [lines] });
  const ul = (items) => ({ type: "ul", items });
  const ol = (items) => ({ type: "ol", items });
  const table = (headers, rows) => ({ type: "table", headers, rows });
  const kicker = (text) => ({ type: "kicker", text });

  window.DocsBlocks = { P, h2, h3, p, note, tip, warn, code, ul, ol, table, kicker };

  window.DOCS_GROUPS = [
    {
      id: "start",
      label: "Start",
      icon: "◎",
      blurb: "What My Space is and how to begin",
      pages: [
        "overview",
        "mental-model",
        "how-to-read-docs",
        "quick-start",
        "desktop",
        "navigation",
      ],
    },
    {
      id: "shell",
      label: "Shell",
      icon: "⌘",
      blurb: "Language, grammar, and the command line",
      pages: [
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
      ],
    },
    {
      id: "apps",
      label: "Apps",
      icon: "▦",
      blurb: "Every app: purpose, UI, and full shell verbs",
      pages: [
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
        "app-files",
        "app-icons",
        "app-flow",
        "app-console",
        "app-scripts",
        "app-connect",
        "app-notifications",
        "app-external",
      ],
    },
    {
      id: "protocols",
      label: "Protocols",
      icon: "⇄",
      blurb: "MSL links, deep routes, and cross-app calls",
      pages: [
        "space-files",
        "msl",
        "msl-providers",
        "msl-capabilities",
        "routes",
        "silent-actions",
        "sync-if-open",
      ],
    },
    {
      id: "automation",
      label: "Automation",
      icon: "⟳",
      blurb: "Aliases, macros, when-rules, scripts & Model Flow",
      pages: [
        "aliases-macros",
        "when-rules",
        "scripts-app",
        "model-flow",
        "automation-patterns",
      ],
    },
    {
      id: "data",
      label: "Data & privacy",
      icon: "◇",
      blurb: "Where data lives, Vault, and settings",
      pages: [
        "storage",
        "userdata-map",
        "vault-security",
        "settings",
        "settings-index",
        "settings-complete",
        "backups",
      ],
    },
    {
      id: "recipes",
      label: "Recipes",
      icon: "✦",
      blurb: "Copy-paste workflows for real days",
      pages: [
        "recipe-morning",
        "recipe-focus",
        "recipe-dev",
        "recipe-travel",
        "recipe-eod",
        "recipe-weekly",
        "recipe-remote",
      ],
    },
    {
      id: "reference",
      label: "Reference",
      icon: "☰",
      blurb: "Indexes, architecture, glossary, FAQ",
      pages: [
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
    },
  ];
})();