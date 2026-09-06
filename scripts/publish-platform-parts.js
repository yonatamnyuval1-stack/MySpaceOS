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
    note: note || existing.note || `Platform service Parts credited to ${appId}`,
    exports: [...byRef.values()],
  };
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  console.log("credit", appId, data.exports.map((e) => e.ref).join(", "));
}

writePart(
  "msl.key",
  {
    kind: "util",
    title: "MSL key codec",
    summary: "Build and parse msl:v1/<capability>?query keys: the portable My Space Link URI format.",
    tags: ["msl", "link", "uri"],
    publisher: "msl",
    usage: "const { build, parse } = require('./parts/msl.key');",
    api: { build: "build(capability, input)", parse: "parse(uri)" },
  },
  fs.readFileSync(path.join(APPS, "shared", "msl-key.js"), "utf8") +
    `\n` +
    `if (typeof window !== "undefined" && window.MslKey) window.PartsMslKey = window.MslKey;\n` +
    `else if (typeof module !== "undefined" && module.exports) {\n` +
    `  const g = typeof globalThis !== "undefined" ? globalThis : {};\n` +
    `  if (g.MslKey) module.exports = g.MslKey;\n` +
    `}\n`
);

writePart(
  "msl.context.slim",
  {
    kind: "util",
    title: "MSL / AI context slimmer",
    summary: "Trim nested capability results for AI grounding prompts: prefer useful keys, cap depth and size.",
    tags: ["msl", "ai", "context"],
    publisher: "msl",
    usage: "const { slimValue, formatSourceBlock } = require('./parts/msl.context.slim');",
  },
  `/**
 * Portable MSL AI context helpers: from main/msl/ai-context.js
 */

function slimValue(value, depth = 0) {
  if (value == null) return value;
  if (depth > 3) return undefined;
  if (typeof value === "string") return value.slice(0, 400);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 24).map((item) => slimValue(item, depth + 1)).filter((v) => v !== undefined);
  }
  if (typeof value === "object") {
    const out = {};
    const prefer = [
      "id", "name", "title", "era", "year", "type", "category", "summary", "blurb",
      "description", "code", "symbol", "price", "translated", "text", "figures",
      "events", "items", "body", "entity", "country", "quote", "project", "doc",
    ];
    const keys = [
      ...prefer.filter((k) => Object.prototype.hasOwnProperty.call(value, k)),
      ...Object.keys(value).filter((k) => !prefer.includes(k)).slice(0, 8),
    ];
    for (const k of keys.slice(0, 14)) {
      if (k === "ok" || k === "error" || k === "handler") continue;
      const v = slimValue(value[k], depth + 1);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  return undefined;
}

function formatSourceBlock(sources, appLabel = "this app") {
  if (!sources || !sources.length) return "";
  const chunks = sources.map((s, i) => {
    const head = (i + 1) + ". " + (s.label || s.capability) + " [" + s.capability + "] " + (s.uri || "");
    let body = "";
    try {
      body = JSON.stringify(s.data, null, 0);
    } catch {
      body = String(s.data || "");
    }
    if (body.length > 3500) body = body.slice(0, 3500) + "…";
    return head + "\\n" + body;
  });
  return (
    "\\n\\nMy Space Link sources injected for " +
    appLabel +
    " (treat as tools / factual grounding for your AI work).\\n" +
    "Use concrete names, facts, and examples from these sources when relevant.\\n" +
    "Do not paste raw JSON into user-facing output.\\n" +
    "Sources:\\n" +
    chunks.join("\\n\\n")
  );
}
` + dual("PartsMslContextSlim", "{ slimValue, formatSourceBlock }")
);

writePart(
  "pulse.profile",
  {
    kind: "util",
    title: "Pulse profile normalizer",
    summary: "Normalize pulse.json commands/events/profiles: validate Link Bus manifests without Electron.",
    tags: ["pulse", "link", "schema"],
    publisher: "pulse",
    usage: "const { normalizeProfile } = require('./parts/pulse.profile');",
  },
  `/**
 * Portable Pulse profile schema: from main/link/discover.js
 */

function normalizeInput(input) {
  if (!input || typeof input !== "object") return {};
  const out = {};
  for (const [key, val] of Object.entries(input)) {
    out[String(key)] = String(val || "any");
  }
  return out;
}

function normalizeCommand(moduleId, raw) {
  if (!raw || typeof raw !== "object") return null;
  const verb = String(raw.verb || "").trim();
  if (!verb) return null;
  const delivery = raw.delivery === "ui" ? "ui" : "ipc";
  return {
    id: moduleId + "." + verb,
    target: moduleId,
    verb,
    kind: "command",
    delivery,
    channel: delivery === "ipc" ? String(raw.channel || "").trim() : "",
    broker: raw.broker ? String(raw.broker).trim() : "",
    title: String(raw.title || verb),
    description: String(raw.description || ""),
    input: normalizeInput(raw.input),
    inputMap: raw.inputMap && typeof raw.inputMap === "object" ? raw.inputMap : null,
    emit: raw.emit ? String(raw.emit) : "",
    callers: Array.isArray(raw.callers) ? raw.callers.map(String) : null,
    examples: Array.isArray(raw.examples) ? raw.examples.map(String) : [],
    source: "manifest",
  };
}

function normalizeEvent(moduleId, raw) {
  if (!raw || typeof raw !== "object") return null;
  const topic = String(raw.topic || raw.id || "").trim();
  if (!topic) return null;
  const parts = topic.split(".");
  const verb = parts.length > 1 ? parts.slice(1).join(".") : topic;
  return {
    id: topic,
    target: parts[0] || moduleId,
    verb,
    kind: "event",
    title: String(raw.title || topic),
    description: String(raw.description || ""),
    payload: normalizeInput(raw.payload),
    source: "manifest",
  };
}

function normalizeProfile(moduleId, raw) {
  if (!raw || typeof raw !== "object") return null;
  const profile = raw.profile && typeof raw.profile === "object" ? raw.profile : {};
  const commands = (Array.isArray(raw.commands) ? raw.commands : [])
    .map((c) => normalizeCommand(moduleId, c))
    .filter(Boolean);
  const events = (Array.isArray(raw.events) ? raw.events : [])
    .map((e) => normalizeEvent(moduleId, e))
    .filter(Boolean);
  if (!commands.length && !events.length && !profile.tagline) return null;
  return {
    moduleId,
    tagline: String(profile.tagline || ""),
    icon: String(profile.icon || ""),
    color: String(profile.color || ""),
    commands,
    events,
    declaredAt: null,
    source: "manifest",
  };
}
` + dual("PartsPulseProfile", "{ normalizeInput, normalizeCommand, normalizeEvent, normalizeProfile }")
);

writePart(
  "pulse.topic",
  {
    kind: "util",
    title: "Pulse topic matcher",
    summary: "Match pub/sub topics with *, #, and prefix.* patterns: Link Bus subscriptions.",
    tags: ["pulse", "pubsub", "topics"],
    publisher: "pulse",
    usage: "const { matchTopic } = require('./parts/pulse.topic');",
  },
  `/**
 * Portable topic pattern matcher: from main/link/subscriptions.js
 */

function matchTopic(pattern, topic) {
  const p = String(pattern || "").trim();
  const t = String(topic || "").trim();
  if (!p || !t) return false;
  if (p === "*" || p === "#") return true;
  if (p.endsWith(".*")) return t.startsWith(p.slice(0, -1));
  if (p.endsWith("#")) return t.startsWith(p.slice(0, -1));
  return p === t;
}

function filterTopics(patterns, topic) {
  return (Array.isArray(patterns) ? patterns : []).filter((p) => matchTopic(p, topic));
}
` + dual("PartsPulseTopic", "{ matchTopic, filterTopics }")
);

writePart(
  "jobs.capacity",
  {
    kind: "util",
    title: "Jobs capacity contract",
    summary:
      "Pool defaults, normalizeCapacity, Connect boost exceptions, and canStartJob rules: the Jobs OS compute contract.",
    tags: ["jobs", "capacity", "pools"],
    publisher: "jobs",
    usage: "const { normalizeCapacity, canStartJob } = require('./parts/jobs.capacity');",
  },
  fs.readFileSync(path.join(__dirname, "_jobs-capacity-body.js"), "utf8")
);

writePart(
  "mind.tasks",
  {
    kind: "util",
    title: "Mind task catalog",
    summary: "Quick / Everyday / Deep task tiers with model options: route AI work by cost and difficulty.",
    tags: ["mind", "ai", "models"],
    publisher: "mind",
    usage: "const { publicTasks, normalizeTaskId } = require('./parts/mind.tasks');",
  },
  fs.readFileSync(path.join(ROOT, "main", "mind", "tasks.js"), "utf8").replace(
      /module\.exports\s*=\s*\{[\s\S]*?\};\s*$/,
      `const api = {
  TASK_IDS,
  TASK_META,
  MODEL_OPTIONS,
  DEFAULT_TASK_MODELS,
  defaultTasks,
  normalizeTaskId,
  publicTasks,
};
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.PartsMindTasks = api;
`
    )
);

writePart(
  "mind.memory.rank",
  {
    kind: "util",
    title: "Mind memory ranking",
    summary: "Score and select relevant memory facts for a user message; format a prompt memory block.",
    tags: ["mind", "memory", "rag"],
    publisher: "mind",
    usage: "const { scoreFact, selectRelevantFacts, formatMemoryBlock } = require('./parts/mind.memory.rank');",
  },
  `/**
 * Portable Mind memory ranking: pure helpers (pass facts in; no disk I/O).
 */

function scoreFact(fact, userText) {
  let score = fact && fact.pinned ? 50 : 1;
  const q = String(userText || "").toLowerCase().trim();
  if (!q || !fact) return score;
  const hay = (String(fact.text || "") + " " + (fact.tags || []).join(" ")).toLowerCase();
  const words = q.split(/\\s+/).filter((w) => w.length > 2);
  for (const w of words) {
    if (hay.includes(w)) score += 4;
  }
  for (const tag of fact.tags || []) {
    if (q.includes(String(tag).toLowerCase())) score += 8;
  }
  return score;
}

function selectRelevantFacts(facts, userText, opts = {}) {
  const list = Array.isArray(facts) ? facts : [];
  const limit = Math.max(1, Math.min(12, Number(opts.limit) || 8));
  if (!list.length) return [];
  const scored = list
    .map((f) => ({ fact: f, score: scoreFact(f, userText) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(b.fact.updatedAt || "").localeCompare(String(a.fact.updatedAt || ""));
    });
  const pinned = scored.filter((x) => x.fact.pinned).map((x) => x.fact);
  const rest = scored
    .filter((x) => !x.fact.pinned)
    .slice(0, Math.max(0, limit - pinned.length))
    .map((x) => x.fact);
  return pinned.concat(rest).slice(0, limit);
}

function formatMemoryBlock(facts, preferences, userText, opts = {}) {
  if (opts.includeMemory === false) return { block: "", ids: [], chars: 0 };
  const selected = selectRelevantFacts(facts, userText, opts);
  const prefLines = Object.entries(preferences || {})
    .filter(([, v]) => v != null && String(v).trim())
    .map(([k, v]) => "- " + k + ": " + String(v).trim());
  const factLines = selected.map((f) => "- " + String(f.text || "").trim());
  const lines = [];
  if (prefLines.length) {
    lines.push("Preferences:");
    lines.push(...prefLines);
  }
  if (factLines.length) {
    if (lines.length) lines.push("");
    lines.push("Relevant memory:");
    lines.push(...factLines);
  }
  const block = lines.length ? "\\n\\n[Mind Memory]\\n" + lines.join("\\n") : "";
  return {
    block,
    ids: selected.map((f) => f.id).filter(Boolean),
    chars: block.length,
  };
}
` + dual("PartsMindMemoryRank", "{ scoreFact, selectRelevantFacts, formatMemoryBlock }")
);

writePart(
  "shell.args",
  {
    kind: "util",
    title: "Shell argument parser",
    summary: "Parse shell-style arg lists into key:value map + positional args: shared by Console and CLIs.",
    tags: ["shell", "args", "parser"],
    publisher: "shell",
    usage: "const { parseArgStructure } = require('./parts/shell.args');",
  },
  `/**
 * Portable shell arg structure — from src/shell-commands.js
 */

function unquoteArg(value) {
  const t = String(value || "").trim();
  if (
    (t.startsWith('"') && t.endsWith('"') && t.length >= 2) ||
    (t.startsWith("'") && t.endsWith("'") && t.length >= 2)
  ) {
    return t.slice(1, -1);
  }
  return t;
}

function splitArgList(raw) {
  const parts = [];
  let current = "";
  let quote = null;
  const s = String(raw || "");
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if ((ch === '"' || ch === "'") && !quote) {
      quote = ch;
      current += ch;
      continue;
    }
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === ",") {
      if (current.trim()) parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseArgStructure(raw) {
  const parts = splitArgList(raw);
  const map = {};
  const positional = [];
  for (const part of parts) {
    const kv = part.match(/^([a-z_][a-z0-9_-]*)\\s*:\\s*(.+)$/i);
    if (kv) map[kv[1].toLowerCase()] = unquoteArg(kv[2]);
    else positional.push(unquoteArg(part));
  }
  return {
    map,
    positional,
    keys: Object.keys(map),
    single: parts.length === 1 ? unquoteArg(parts[0]) : null,
  };
}

function parseKvArgs(raw) {
  const input = {};
  for (const part of String(raw || "").trim().split(/\\s+/).filter(Boolean)) {
    const m = part.match(/^([^:=]+)[:=]([\\s\\S]+)$/);
    if (m) input[m[1]] = m[2];
  }
  return input;
}
` + dual("PartsShellArgs", "{ unquoteArg, splitArgList, parseArgStructure, parseKvArgs }")
);

writePart(
  "files.nav",
  {
    kind: "util",
    title: "Files navigation helpers",
    summary: "Breadcrumbs, parent dir, text decode (UTF-8/16 + BOM), and binary sniff for file browsers.",
    tags: ["files", "preview", "path"],
    publisher: "files",
    usage: "const { crumbsFor, decodeTextBuffer, looksLikeBinary } = require('./parts/files.nav');",
  },
  fs.readFileSync(path.join(__dirname, "_files-nav-body.js"), "utf8")
);

writePart(
  "ai.toolcall",
  {
    kind: "util",
    title: "Agent tool-call parser",
    summary: "Parse TOOL_CALL JSON blocks and OpenAI-style tool_calls; strip calls from assistant text.",
    tags: ["ai", "tools", "agent", "flow"],
    publisher: "flow",
    usage: "const { parseToolCall, stripToolCall } = require('./parts/ai.toolcall');",
  },
  fs.readFileSync(path.join(__dirname, "_ai-toolcall-body.js"), "utf8")
);

writePart(
  "host.safe-id",
  {
    kind: "util",
    title: "Safe host id slug",
    summary: "Sanitize device/folder ids to [a-zA-Z0-9_-]: used by OS Bridge pairing file lookup.",
    tags: ["host", "id", "bridge"],
    publisher: "os-bridge",
    usage: "const { safeId } = require('./parts/host.safe-id');",
    api: { safeId: "safeId(raw)", matchesPrefix: "matchesPrefix(filename, id)" },
  },
  `/**
 * Portable safe id helpers: from main/apps/os-bridge-pair-server.js
 */

function safeId(raw) {
  return String(raw || "").replace(/[^a-zA-Z0-9_-]/g, "");
}

function matchesPrefix(filename, id) {
  const sid = safeId(id);
  if (!sid) return false;
  const n = String(filename || "");
  return n.startsWith(sid + "_") || n.startsWith(sid + ".");
}
` + dual("PartsHostSafeId", "{ safeId, matchesPrefix }")
);

writeAppCredit(
  "msl-protocol",
  [
    { ref: "msl.key", note: "MSL URI codec" },
    { ref: "msl.context.slim", note: "AI context slimmer for injected keys" },
  ],
  "MSL platform service — Link series"
);
writeAppCredit(
  "pulse",
  [
    { ref: "pulse.profile", note: "pulse.json normalizer" },
    { ref: "pulse.topic", note: "Topic pattern matcher" },
  ],
  "Pulse / Link Bus platform service"
);
writeAppCredit(
  "files",
  [
    { ref: "bytes.format", note: "Human byte sizes" },
    { ref: "files.nav", note: "Breadcrumbs + text preview decode" },
    { ref: "files.kind", note: "Filename kind classifier (Builds)" },
  ],
  "Files platform service"
);
writeAppCredit(
  "shell-console",
  [{ ref: "shell.args", note: "Shell arg / key:value parser" }],
  "Shell Console — Shell series"
);
writeAppCredit(
  "scripts",
  [{ ref: "shell.args", note: "Shared with Shell for script argument parsing" }],
  "Scripts platform service"
);
writeAppCredit(
  "model-flow",
  [{ ref: "ai.toolcall", note: "TOOL_CALL / tool_calls parser for agents" }],
  "Model Flow — AI series"
);
writeAppCredit(
  "os-bridge",
  [{ ref: "host.safe-id", note: "Safe device/folder id slug" }],
  "OS Bridge platform service"
);

ensureDir(CONFIG);
fs.writeFileSync(
  path.join(CONFIG, "platform-parts.json"),
  JSON.stringify(
    {
      version: 1,
      note: "Parts published by platform services that are not desktop apps",
      services: {
        jobs: [
          { ref: "jobs.capacity", note: "Compute pools + Connect boost capacity contract" },
        ],
        mind: [
          { ref: "mind.tasks", note: "Quick / Everyday / Deep task catalog" },
          { ref: "mind.memory.rank", note: "Memory fact ranking for prompts" },
        ],
        msl: [
          { ref: "msl.key", note: "MSL key codec" },
          { ref: "msl.context.slim", note: "Injected source slimmer" },
        ],
        shell: [{ ref: "shell.args", note: "Shell argument parser" }],
        connect: [{ ref: "ui.omnibox", note: "Catalog search pattern" }],
        "os-bridge": [{ ref: "host.safe-id", note: "Safe host id" }],
      },
    },
    null,
    2
  ) + "\n"
);
console.log("wrote config/platform-parts.json");

console.log("\\nDone publishing platform service Parts.");