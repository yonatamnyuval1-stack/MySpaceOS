const MAX_CARDS = 2;
const MAX_CARD_CHARS = 900;

const INDEX = `Surfaces: Desktop apps · Platform (AI/Web/Shell/Link) · Shell Console · Jobs (overflow only) · Mind Chat · Ask AI (OS tools) · OS Bridge (phone/host) · Remote Hub (RDP/SSH, separate).
Shell form: app(verb args) · run <app> · help <app>. Prefer verbs over essays.`;

const CARDS = [
  {
    id: "map",
    title: "OS map",
    keywords: [
      "my space",
      "myspace",
      "what is",
      "overview",
      "platform",
      "desktop",
      "where",
      "how does",
      "os",
      "system",
    ],
    body: `My Space = personal desktop OS on Windows.
• Desktop tiles = apps (Chat, Stocks, Vault, OS Bridge, Remote Hub, …).
• Platform catalog = services (Mind, Connect, Shell/Scripts, MSL, Jobs): not the same as app tiles.
• Shell Console = command language. Ask AI (side FAB) = tool agent that can open/close/run.
• Jobs = extreme-load queue only; normal opens/commands run direct.
• OS Bridge ≠ Remote Hub. Bridge = this PC + phone Wi‑Fi. Hub = remote machines.`,
  },
  {
    id: "shell",
    title: "Shell",
    keywords: [
      "shell",
      "console",
      "command",
      "commands",
      "run ",
      "macro",
      "alias",
      "help",
      "script",
      "scripts",
      "(",
      "verb",
    ],
    body: `Shell protocol: name(verb args). Examples:
clock(timer 25m) · today(add Buy milk) · stocks(AAPL) · vault(list) · remote(list) · bridge(open) · mind(ask …) · chat(new) · jobs(panel) · console(runner)
• run <app name> opens an app. Partial names fuzzy-match when unique.
• help / help <app> for verbs. Macros & when-rules live in Console.
• Scripts app stores multi-line programs; scripts(open) / scripts(new).
• Prefer giving one copy-paste line the user can run.`,
  },
  {
    id: "apps",
    title: "Apps",
    keywords: [
      "app",
      "apps",
      "open",
      "stocks",
      "vault",
      "clock",
      "today",
      "notes",
      "chat",
      "maps",
      "drift",
      "builds",
      "contacts",
      "translate",
      "deck",
      "study",
    ],
    body: `Common apps (open via run <name> or shell):
• Chat / Mind Chat — conversations + modes (Companion, Cynical, Spacehand).
• Clock: timer/pomodoro/world. Today: tasks. Stocks: quotes/watchlist.
• Vault (profiles): passwords. Notes, Contacts, Translate.
• Builds, Drift, Study Deck, World Maps, Geography, History, Space, Contracts, Lexicon.
• Docs, Scripts, System Info, Shell Console.
If unsure of an id: suggest run <readable name> or help.`,
  },
  {
    id: "mind",
    title: "Mind & Chat",
    keywords: [
      "mind",
      "gemini",
      "ollama",
      "model",
      "chat mode",
      "modes",
      "companion",
      "cynical",
      "spacehand",
      "operator",
      "ask ai",
      "deep",
      "quick",
    ],
    body: `Mind = OS AI runtime (Gemini key in Mind Setup; optional Ollama).
Tasks: quick (cheap) · chat/everyday · think/deep.
• Mind Chat app = history + Modes catalog (sidebar chip).
• Ask AI (rose FAB) = can run OS actions with confirm — separate from Chat modes.
• Modes change behavior: Companion (warm), Cynical (mocking), Spacehand (OS guide that can open apps / run shell).
Shell: mind(panel) · mind(ask …) · mind(setup) · chat(new) · chat(open).`,
  },
  {
    id: "bridge",
    title: "OS Bridge & Remote",
    keywords: [
      "bridge",
      "os bridge",
      "phone",
      "pair",
      "pairing",
      "qr",
      "clipboard",
      "inbox",
      "remote",
      "rdp",
      "ssh",
      "wol",
      "wifi",
      "wi-fi",
    ],
    body: `OS Bridge (app): this host PC.
• Devices — Start pairing, same Wi‑Fi, scan QR or Copy link (http://IP:17834/?c=CODE).
• Places — Desktop/Downloads/USB. Share: clipboard/paths. Host — Windows settings links.
Remote Hub (separate app): RDP / SSH / Wake-on-LAN to other machines — not phone pairing.
Shell: bridge(open) · bridge(devices) · remote(open) · remote(list).`,
  },
  {
    id: "connect",
    title: "Connect & Web",
    keywords: [
      "connect",
      "gmail",
      "mail",
      "browser",
      "web",
      "whatsapp",
      "telegram",
      "inbox",
      "email",
    ],
    body: `Connect = web/services hub (Platform · green series).
• Opens Gmail and other web apps inside My Space (Connect cards).
• My Space Browser is the green browser surface.
• Mail notifications can open Connect targets via IPC.
Shell/platform: run connect · open browser from Platform.
Ask AI can also open web apps when asked.`,
  },
  {
    id: "jobs",
    title: "Jobs",
    keywords: ["jobs", "queue", "capacity", "pool", "background", "overflow", "stuck"],
    body: `Jobs = compute safety valve, not the default path.
• Normal app launches, Console, Scripts, Connect run direct.
• Jobs queues only under extreme concurrent load, explicit enqueue, or background/MSL sources.
• Panel: Platform → Jobs · jobs(panel) · jobs(list). Clear stuck/finished from the panel.
Do not tell users every click is a Job.`,
  },
  {
    id: "platform",
    title: "Platform & Link",
    keywords: [
      "msl",
      "link",
      "caps",
      "mint",
      "flow",
      "model flow",
      "notifications",
      "search",
      "focus",
      "series",
    ],
    body: `Platform services (catalog):
• AI series (rose): Mind, Model Flow, Search, Notifications…
• Web (green): Connect / Browser.
• Shell (cyan): Console + Scripts.
• Link (violet): MSL protocol: caps/mint panel, not a normal desktop app.
• Jobs / System Info / Bridge as supporting entries.
Focus mode can silence noise; hotkeys open palette / shortcuts help.`,
  },
];

function normalizeHay(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function scoreCard(card, hay) {
  if (!hay) return 0;
  let score = 0;
  for (const kw of card.keywords || []) {
    const k = String(kw).toLowerCase();
    if (!k) continue;
    if (!hay.includes(k)) continue;
    score += k.length >= 6 ? 3 : 2;
  }
  return score;
}

function selectKnowledgeCards(userText, opts = {}) {
  const hay = normalizeHay(userText);
  const maxCards = Math.max(1, Math.min(3, Number(opts.maxCards) || MAX_CARDS));
  const scored = CARDS.map((card) => ({ card, score: scoreCard(card, hay) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.card.id.localeCompare(b.card.id));

  let picked = scored.slice(0, maxCards).map((x) => x.card);

  if (!picked.length) {
    const productHint =
      /\b(my ?space|shell|app|bridge|mind|vault|platform|connect|jobs|remote|chat|open|run)\b/i.test(
        hay
      );
    if (productHint) {
      picked = [CARDS.find((c) => c.id === "map")].filter(Boolean);
    }
  }

  return picked;
}

function formatKnowledgeBlock(cards) {
  if (!cards?.length) {
    return {
      block: `Knowledge index (no card matched: stay general, don't invent APIs):\n${INDEX}`,
      ids: [],
      chars: INDEX.length,
    };
  }
  const parts = [`Knowledge cards (authoritative for this turn: prefer these facts):`];
  let chars = 0;
  const ids = [];
  for (const card of cards) {
    let body = String(card.body || "").trim();
    if (body.length > MAX_CARD_CHARS) body = `${body.slice(0, MAX_CARD_CHARS - 1)}…`;
    const chunk = `[${card.id}] ${card.title}\n${body}`;
    if (chars + chunk.length > MAX_CARD_CHARS * MAX_CARDS + 80) break;
    parts.push(chunk);
    ids.push(card.id);
    chars += chunk.length;
  }
  return { block: parts.join("\n\n"), ids, chars };
}

function buildKnowledgePack(userText, opts = {}) {
  const cards = selectKnowledgeCards(userText, opts);
  const formatted = formatKnowledgeBlock(cards);
  return {
    ...formatted,
    index: INDEX,
    cardCount: formatted.ids.length,
  };
}

function listKnowledgeCards() {
  return CARDS.map((c) => ({
    id: c.id,
    title: c.title,
    keywords: (c.keywords || []).slice(0, 8),
  }));
}

module.exports = {
  INDEX,
  CARDS,
  selectKnowledgeCards,
  buildKnowledgePack,
  listKnowledgeCards,
  MAX_CARDS,
};