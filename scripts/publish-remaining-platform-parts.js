const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SHARED = path.join(ROOT, "shared", "parts");
const APPS = path.join(ROOT, "apps");
const CONFIG = path.join(ROOT, "config");

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

function writePart(id, meta, code) {
  const dir = path.join(SHARED, id);
  ensureDir(dir);
  fs.writeFileSync(
    path.join(dir, "part.json"),
    JSON.stringify(
      {
        id,
        version: 1,
        kind: meta.kind || "util",
        title: meta.title,
        summary: meta.summary,
        tags: meta.tags || [],
        entry: "index.js",
        files: ["index.js"],
        api: meta.api || {},
        usage: meta.usage || `const mod = require('./parts/${id}');`,
        publisher: meta.publisher || null,
      },
      null,
      2
    ) + "\n"
  );
  fs.writeFileSync(path.join(dir, "index.js"), code.replace(/\r\n/g, "\n"));
  console.log("shared", id);
}

function dual(name, expr) {
  return `
const api = ${expr};
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.${name} = api;
`;
}

function writeAppCredit(appId, exports, note) {
  const file = path.join(APPS, appId, "parts.json");
  let existing = { exports: [] };
  if (fs.existsSync(file)) {
    try {
      existing = JSON.parse(fs.readFileSync(file, "utf8")) || existing;
    } catch {
    }
  }
  const byRef = new Map();
  for (const e of existing.exports || []) {
    if (e?.ref) byRef.set(String(e.ref).toLowerCase(), e);
  }
  for (const e of exports) {
    byRef.set(String(e.ref).toLowerCase(), e);
  }
  const data = {
    note: note || existing.note || `Parts credited to ${appId}`,
    exports: [...byRef.values()],
  };
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  console.log("credit", appId, data.exports.map((e) => e.ref).join(", "));
}

function mergePlatformParts(services) {
  ensureDir(CONFIG);
  const file = path.join(CONFIG, "platform-parts.json");
  let existing = { version: 1, note: "", services: {} };
  if (fs.existsSync(file)) {
    try {
      existing = JSON.parse(fs.readFileSync(file, "utf8")) || existing;
    } catch {
    }
  }
  const merged = { ...(existing.services || {}) };
  for (const [sid, items] of Object.entries(services)) {
    const byRef = new Map();
    for (const e of merged[sid] || []) {
      if (e?.ref) byRef.set(String(e.ref).toLowerCase(), e);
    }
    for (const e of items) byRef.set(String(e.ref).toLowerCase(), e);
    merged[sid] = [...byRef.values()];
  }
  const out = {
    version: 1,
    note:
      existing.note ||
      "Parts published by platform services that are not desktop apps",
    services: merged,
  };
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
  console.log("wrote config/platform-parts.json");
}

{
  let code = fs.readFileSync(path.join(ROOT, "main", "space-file-format.js"), "utf8");
  code = code.replace(
    /if \(Buffer\.byteLength\(raw, "utf8"\) > max\)/,
    `const bl =
    typeof Buffer !== "undefined" && Buffer.byteLength
      ? Buffer.byteLength(raw, "utf8")
      : new TextEncoder().encode(raw).length;
  if (bl > max)`
  );
  code = code.replace(
    /module\.exports = \{[\s\S]*?\};?\s*$/,
    `const api = {
  FORMAT_ID,
  FORMAT_VERSION,
  MAX_BYTES,
  KINDS,
  isPlainObject,
  clip,
  stripSecrets,
  parseDocument,
  buildDocument,
  normalizePayload,
  suggestTitle,
  looksLikeSpacePath,
  sanitizeFileStem,
};
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.PartsSpaceFormat = api;
`
  );
  writePart(
    "space.format",
    {
      kind: "data",
      title: ".space document format",
      summary:
        "Portable myspace.space envelope for scripts, flows, notes, and decks: parse/build with secret stripping.",
      tags: ["space", "export", "import", "scripts", "flow"],
      publisher: "scripts",
      usage: "const { parseDocument, buildDocument } = require('./parts/space.format');",
      api: {
        parseDocument: "parseDocument(raw)",
        buildDocument: "buildDocument({ kind, title, payload })",
      },
    },
    code
  );
}

writePart(
  "shell.duration",
  {
    kind: "util",
    title: "Shell duration parser",
    summary: "Parse 50m / 1h30m / 1:30 / bare minutes into seconds and format back: timers and when-rules.",
    tags: ["shell", "duration", "time"],
    publisher: "shell",
    usage: "const { parseDurationToSec, formatDurationSec } = require('./parts/shell.duration');",
  },
  fs.readFileSync(path.join(__dirname, "_shell-duration-body.js"), "utf8")
);

writePart(
  "shell.program",
  {
    kind: "util",
    title: "Shell program AST",
    summary:
      "Parse multi-line shell programs: # comments, fn name(a){…}, semicolon/pipe chains: complements shell.args.",
    tags: ["shell", "scripts", "parser", "ast"],
    publisher: "shell",
    usage: "const { parseProgram, splitCommandChain } = require('./parts/shell.program');",
  },
  fs.readFileSync(path.join(__dirname, "_shell-program-body.js"), "utf8")
);

writePart(
  "flow.plan",
  {
    kind: "util",
    title: "Model Flow planner",
    summary:
      "Offline localPlan, LLM JSON → normalizeFlow, email/sheets intent guards, URL extract. Flow beyond tool-call parsing.",
    tags: ["flow", "ai", "planner", "automation"],
    publisher: "flow",
    usage: "const { localPlan, normalizeFlow } = require('./parts/flow.plan');",
  },
  fs.readFileSync(path.join(__dirname, "_flow-plan-body.js"), "utf8")
);

writePart(
  "browser.url",
  {
    kind: "util",
    title: "Browser URL helpers",
    summary: "Detect bare domains/localhost, coerce to http(s), and flag embed-unsafe hosts for webviews.",
    tags: ["browser", "url", "webview"],
    publisher: "browser",
    usage: "const { normalizeUrl, isUnsafeWebviewUrl } = require('./parts/browser.url');",
  },
  fs.readFileSync(path.join(__dirname, "_browser-url-body.js"), "utf8")
);

writePart(
  "notif.sender",
  {
    kind: "util",
    title: "Notification sender keys",
    summary: "Normalize mail From → stable blocklist keys; scrape sender from notification route/title/body.",
    tags: ["notifications", "mail", "blocklist"],
    publisher: "notifications",
    usage: "const { normalizeSenderKey, senderKeyFromNotification } = require('./parts/notif.sender');",
  },
  fs.readFileSync(path.join(__dirname, "_notif-sender-body.js"), "utf8")
);

writePart(
  "search.score",
  {
    kind: "util",
    title: "Palette search scoring",
    summary:
      "Integer ranking (exact/prefix/includes/tokens/subsequence) plus ?/ask AI and > shell query modes: distinct from search.fuzzy.",
    tags: ["search", "palette", "rank"],
    publisher: "search",
    usage: "const { score, isAiQuery, isShellQuery } = require('./parts/search.score');",
  },
  fs.readFileSync(path.join(__dirname, "_search-score-body.js"), "utf8")
);

writePart(
  "netstat.parse",
  {
    kind: "util",
    title: "Netstat line parser",
    summary: "Parse netstat -ano TCP/UDP rows into structured ports; label All interfaces / Localhost; summarize.",
    tags: ["system-info", "ports", "netstat"],
    publisher: "system-info",
    usage: "const { parseNetstatLine, summarizePorts } = require('./parts/netstat.parse');",
  },
  fs.readFileSync(path.join(__dirname, "_netstat-parse-body.js"), "utf8")
);

writePart(
  "vault.crypto",
  {
    kind: "util",
    title: "Vault crypto (scrypt + AES-GCM)",
    summary:
      "Password hash/verify and AES-256-GCM JSON encrypt/decrypt: Node crypto core used by mail/profiles/coupons.",
    tags: ["vault", "crypto", "security"],
    publisher: "os",
    usage: "const { encryptJson, decryptJson, createAuthRecord } = require('./parts/vault.crypto');",
    api: {
      createAuthRecord: "createAuthRecord(password)",
      encryptJson: "encryptJson(key, data)",
      decryptJson: "decryptJson(key, blob)",
    },
  },
  fs.readFileSync(path.join(ROOT, "main", "apps", "vault-crypto.js"), "utf8")
);

writePart(
  "json.store",
  {
    kind: "util",
    title: "Safe JSON store",
    summary:
      "Atomic JSON writes, corrupt quarantine, .bak recovery, refuse empty-list overwrite: shared app persistence.",
    tags: ["json", "persistence", "fs"],
    publisher: "os",
    usage: "const { loadJsonFile, saveJsonFile } = require('./parts/json.store');",
  },
  fs.readFileSync(path.join(__dirname, "_json-store-body.js"), "utf8")
);

writeAppCredit(
  "scripts",
  [
    { ref: "shell.args", note: "Shared arg parser" },
    { ref: "shell.program", note: "Multi-line program AST" },
    { ref: "space.format", note: ".space export/import envelope" },
  ],
  "Scripts platform service"
);
writeAppCredit(
  "shell-console",
  [
    { ref: "shell.args", note: "Shell arg / key:value parser" },
    { ref: "shell.program", note: "Program AST + command chains" },
    { ref: "shell.duration", note: "Timer / when-rule durations" },
  ],
  "Shell Console: Shell series"
);
writeAppCredit(
  "model-flow",
  [
    { ref: "ai.toolcall", note: "TOOL_CALL / tool_calls parser" },
    { ref: "flow.plan", note: "Offline + normalize flow planner" },
    { ref: "space.format", note: "Flow .space export envelope" },
  ],
  "Model Flow: AI series"
);
writeAppCredit(
  "myspace-browser",
  [{ ref: "browser.url", note: "URL normalize + unsafe host list" }],
  "My Space Browser: Web series"
);
writeAppCredit(
  "system-info",
  [
    { ref: "bytes.format", note: "Disk / RAM size labels" },
    { ref: "netstat.parse", note: "Port table from netstat lines" },
  ],
  "System Info platform service"
);
writeAppCredit(
  "study-deck",
  [
    { ref: "cards.srs", note: "SRS scheduling" },
    { ref: "space.format", note: "Deck .space import/export" },
  ],
  "Study Deck: .space deck kind"
);

mergePlatformParts({
  scripts: [
    { ref: "space.format", note: ".space document envelope" },
    { ref: "shell.program", note: "Multi-line script program AST" },
  ],
  shell: [
    { ref: "shell.args", note: "Shell argument parser" },
    { ref: "shell.program", note: "Program AST" },
    { ref: "shell.duration", note: "Duration parse/format" },
  ],
  flow: [
    { ref: "ai.toolcall", note: "Tool-call parser" },
    { ref: "flow.plan", note: "Local + normalize planner" },
    { ref: "space.format", note: "Flow .space files" },
  ],
  browser: [{ ref: "browser.url", note: "URL helpers + unsafe hosts" }],
  notifications: [{ ref: "notif.sender", note: "Sender blocklist keys" }],
  search: [{ ref: "search.score", note: "Palette integer scoring + modes" }],
  "system-info": [{ ref: "netstat.parse", note: "Netstat port parser" }],
  os: [
    { ref: "json.store", note: "Safe atomic JSON persistence" },
    { ref: "vault.crypto", note: "scrypt + AES-GCM vault core" },
  ],
});

console.log("\nDone publishing remaining platform Parts.");
