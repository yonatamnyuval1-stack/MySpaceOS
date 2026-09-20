window.ConsolePages.reference = (function () {
  const page = document.getElementById("page-reference");

  const SECTIONS = [
    {
      title: "Shortcuts (built-in)",
      lines: [
        "a → close all",
        "b<app> → close <app>  (bdrift, bbuilds, bremote hub)",
        "<app> → run <app>  (drift, space, code lexicon)",
        "<app>(page) → run <app>(page)  (drift(insights), space(ocean))",
      ],
    },
    {
      title: "Actions",
      lines: [
        "run <app>, run <app>(page), open <app>",
        "close, close all, close <app>",
        "focus <app>, pin, unpin, reveal",
        "desktop, settings, add, refresh, sort, reset layout",
      ],
    },
    {
      title: "Queries (check)",
      lines: [
        "check running, check apps, check <app>",
        "check routes, check routes space",
        "check aliases, check macros, check when",
      ],
    },
    {
      title: "Flow",
      lines: [
        "if check drift open then run drift else focus drift",
        "loop 3 then run builds",
        "while check running then close",
        "for builds drift then run $item",
        "alias name = run space(ocean)",
        "macro work = run builds; run drift",
        "when drift(new) notify",
        "chain with ; between commands",
      ],
    },
    {
      title: "Multi-word app names",
      lines: [
        "run code lexicon · focus remote hub",
        "run digital contracts · close microsoft edge",
        'or use quotes: run "vs code"',
      ],
    },
    {
      title: "Examples",
      lines: [
        "a",
        "drift, space(ocean), builds",
        "bdrift, bbuilds",
        "macro morning = run builds; run drift",
      ],
    },
  ];

  function render() {
    page.innerHTML = `
      <p class="muted ref-intro">Desktop shell reference: right-click empty desktop to open the command line.</p>
      ${SECTIONS.map(
        (s) => `<section class="ref-block">
          <h3>${s.title}</h3>
          <ul>${s.lines.map((l) => `<li><code>${l}</code></li>`).join("")}</ul>
        </section>`
      ).join("")}`;
  }

  function scan() {
    render();
  }

  return { id: "reference", page, scan };
})();