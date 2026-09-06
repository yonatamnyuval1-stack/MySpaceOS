const { publishPart } = require("../main/parts/broker");

const PARTS = [
  {
    app: "apps-info",
    id: "apps.catalog-filter",
    title: "App catalog filter",
    summary: "Filter and rank app rows by id, name, and description.",
    kind: "util",
    tags: ["apps", "search"],
    usage: "const { filterApps } = require('./parts/apps.catalog-filter');",
    files: {
      "index.js": `/**
 * Portable app-catalog filter: no host imports.
 */

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .trim();
}

function scoreApp(query, app) {
  const q = norm(query);
  if (!q) return 1;
  const id = norm(app.id || app.module);
  const name = norm(app.name || app.title);
  const desc = norm(app.description || app.summary);
  if (id === q || name === q) return 1;
  if (id.startsWith(q) || name.startsWith(q)) return 0.92;
  if (id.includes(q) || name.includes(q)) return 0.8;
  if (desc.includes(q)) return 0.55;
  return 0;
}

function filterApps(apps, query, limit = 50) {
  const list = Array.isArray(apps) ? apps : [];
  return list
    .map((app) => ({ app, score: scoreApp(query, app) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || String(a.app.name || "").localeCompare(String(b.app.name || "")))
    .slice(0, Math.max(1, limit))
    .map((row) => row.app);
}

module.exports = { scoreApp, filterApps };
`,
    },
  },
  {
    app: "builds",
    id: "path.rel-norm",
    title: "Relative path normalize",
    summary: "Normalize relative paths and check containment safely.",
    kind: "util",
    tags: ["path", "files"],
    usage: "const { normalizeRel, isPathUnder } = require('./parts/path.rel-norm');",
    files: {
      "index.js": `/**
 * Portable relative-path helpers: no host imports.
 */

function normalizeRel(input) {
  const raw = String(input || "").replace(/\\\\/g, "/").trim();
  if (!raw) return "";
  const parts = [];
  for (const seg of raw.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") {
      if (parts.length) parts.pop();
      continue;
    }
    parts.push(seg);
  }
  return parts.join("/");
}

function isPathUnder(root, candidate) {
  const r = normalizeRel(root);
  const c = normalizeRel(candidate);
  if (!c) return false;
  if (!r) return !c.split("/").includes("..");
  return c === r || c.startsWith(r + "/");
}

module.exports = { normalizeRel, isPathUnder };
`,
    },
  },
  {
    app: "chat",
    id: "chat.drafts",
    title: "Conversation drafts map",
    summary: "In-memory + storage-backed draft text keyed by conversation id.",
    kind: "util",
    tags: ["chat", "draft"],
    usage: "const { DraftStore } = require('./parts/chat.drafts');",
    files: {
      "index.js": `/**
 * Portable draft store: pass any storage with getItem/setItem (e.g. sessionStorage).
 */

function DraftStore(storage, key = "parts.chat.drafts") {
  const store = storage && typeof storage.getItem === "function" ? storage : null;
  let map = {};
  if (store) {
    try {
      map = JSON.parse(store.getItem(key) || "{}") || {};
    } catch {
      map = {};
    }
  }

  function persist() {
    if (!store) return;
    try {
      store.setItem(key, JSON.stringify(map));
    } catch {
      /* quota */
    }
  }

  return {
    get(id) {
      return map[String(id || "")] || "";
    },
    set(id, text) {
      const k = String(id || "");
      if (!k) return;
      const v = String(text || "");
      if (!v) delete map[k];
      else map[k] = v;
      persist();
    },
    clear(id) {
      delete map[String(id || "")];
      persist();
    },
    all() {
      return { ...map };
    },
  };
}

module.exports = { DraftStore };
`,
    },
  },
  {
    app: "code-lexicon",
    id: "lexicon.level-badge",
    title: "Lexicon level badge",
    summary: "Map concept level strings to label + CSS class.",
    kind: "ui",
    tags: ["lexicon", "badge"],
    usage: "const { levelBadge } = require('./parts/lexicon.level-badge');",
    files: {
      "index.js": `/**
 * Portable level → badge mapping.
 */

const LEVELS = {
  beginner: { label: "Beginner", className: "badge-beginner" },
  intermediate: { label: "Intermediate", className: "badge-intermediate" },
  advanced: { label: "Advanced", className: "badge-advanced" },
  expert: { label: "Expert", className: "badge-expert" },
};

function levelBadge(level) {
  const key = String(level || "")
    .toLowerCase()
    .trim();
  return LEVELS[key] || { label: key || "Unknown", className: "badge-unknown" };
}

module.exports = { levelBadge, LEVELS };
`,
    },
  },
  {
    app: "contacts",
    id: "contacts.display-name",
    title: "Contact display name",
    summary: "Compose a display name from first/last/full/email fields.",
    kind: "util",
    tags: ["contacts", "name"],
    usage: "const { displayName } = require('./parts/contacts.display-name');",
    files: {
      "index.js": `/**
 * Portable contact display-name helper.
 */

function displayName(contact) {
  const c = contact || {};
  const full = String(c.fullName || c.name || "").trim();
  if (full) return full;
  const first = String(c.firstName || c.first || "").trim();
  const last = String(c.lastName || c.last || "").trim();
  const joined = [first, last].filter(Boolean).join(" ").trim();
  if (joined) return joined;
  const email = String(c.email || "").trim();
  if (email) return email.split("@")[0] || email;
  const phone = String(c.phone || c.mobile || "").trim();
  return phone || "Unnamed";
}

module.exports = { displayName };
`,
    },
  },
  {
    app: "contracts",
    id: "contracts.status-badge",
    title: "Contract status badge",
    summary: "Normalize contract status to label + tone class.",
    kind: "ui",
    tags: ["contracts", "status"],
    usage: "const { statusBadge } = require('./parts/contracts.status-badge');",
    files: {
      "index.js": `/**
 * Portable contract status → badge.
 */

const MAP = {
  draft: { label: "Draft", tone: "muted" },
  pending: { label: "Pending", tone: "warn" },
  sent: { label: "Sent", tone: "info" },
  signed: { label: "Signed", tone: "ok" },
  expired: { label: "Expired", tone: "danger" },
  void: { label: "Void", tone: "danger" },
  active: { label: "Active", tone: "ok" },
};

function statusBadge(status) {
  const key = String(status || "")
    .toLowerCase()
    .trim();
  return MAP[key] || { label: key || "Unknown", tone: "muted" };
}

module.exports = { statusBadge, MAP };
`,
    },
  },
  {
    app: "coupons",
    id: "coupons.expiry",
    title: "Coupon expiry urgency",
    summary: "Compare ISO expiry dates and return ok / soon / expired.",
    kind: "util",
    tags: ["coupons", "date"],
    usage: "const { expiryState } = require('./parts/coupons.expiry');",
    files: {
      "index.js": `/**
 * Portable coupon expiry classifier.
 */

function expiryState(iso, now = Date.now(), soonDays = 7) {
  if (!iso) return { state: "none", label: "No expiry", daysLeft: null };
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return { state: "none", label: "Invalid date", daysLeft: null };
  const ms = t - Number(now);
  const daysLeft = Math.ceil(ms / 86400000);
  if (ms < 0) return { state: "expired", label: "Expired", daysLeft };
  if (daysLeft <= soonDays) return { state: "soon", label: "Expiring soon", daysLeft };
  return { state: "ok", label: "Valid", daysLeft };
}

module.exports = { expiryState };
`,
    },
  },
  {
    app: "day-planner",
    id: "date.local-iso",
    title: "Local ISO date helpers",
    summary: "Local YYYY-MM-DD / HH:mm formatting and addDays.",
    kind: "util",
    tags: ["date", "planner"],
    usage: "const { toLocalDate, toLocalTime, addDays } = require('./parts/date.local-iso');",
    files: {
      "index.js": `/**
 * Portable local date/time helpers (browser or Node).
 */

function pad(n) {
  return String(n).padStart(2, "0");
}

function toLocalDate(d = new Date()) {
  const x = d instanceof Date ? d : new Date(d);
  return \`\${x.getFullYear()}-\${pad(x.getMonth() + 1)}-\${pad(x.getDate())}\`;
}

function toLocalTime(d = new Date()) {
  const x = d instanceof Date ? d : new Date(d);
  return \`\${pad(x.getHours())}:\${pad(x.getMinutes())}\`;
}

function addDays(isoDate, days) {
  const [y, m, d] = String(isoDate || toLocalDate())
    .split("-")
    .map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + Number(days || 0));
  return toLocalDate(dt);
}

module.exports = { toLocalDate, toLocalTime, addDays };
`,
    },
  },
  {
    app: "docs",
    id: "docs.toc-flatten",
    title: "Flatten handbook TOC",
    summary: "Flatten nested table-of-contents nodes into searchable rows.",
    kind: "data",
    tags: ["docs", "toc"],
    usage: "const { flattenToc } = require('./parts/docs.toc-flatten');",
    files: {
      "index.js": `/**
 * Portable TOC flattener.
 */

function flattenToc(nodes, acc = [], trail = []) {
  const list = Array.isArray(nodes) ? nodes : [];
  for (const node of list) {
    if (!node || typeof node !== "object") continue;
    const title = String(node.title || node.label || node.id || "").trim();
    const path = [...trail, title].filter(Boolean);
    acc.push({
      id: node.id || path.join("/"),
      title,
      path: path.join(" / "),
      depth: path.length,
      href: node.href || node.url || null,
      raw: node,
    });
    if (Array.isArray(node.children) || Array.isArray(node.items)) {
      flattenToc(node.children || node.items, acc, path);
    }
  }
  return acc;
}

module.exports = { flattenToc };
`,
    },
  },
  {
    app: "drift",
    id: "time.relative",
    title: "Relative time labels",
    summary: "Turn ISO timestamps into Just now / Nm ago / short date.",
    kind: "util",
    tags: ["time", "activity"],
    usage: "const { relativeTime } = require('./parts/time.relative');",
    files: {
      "index.js": `/**
 * Portable relative time formatter.
 */

function relativeTime(iso, now = Date.now()) {
  const t = typeof iso === "number" ? iso : Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const delta = Math.max(0, Number(now) - t);
  const sec = Math.floor(delta / 1000);
  if (sec < 45) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return \`\${min}m ago\`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return \`\${hr}h ago\`;
  const day = Math.floor(hr / 24);
  if (day < 7) return \`\${day}d ago\`;
  const d = new Date(t);
  return \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, "0")}-\${String(d.getDate()).padStart(2, "0")}\`;
}

module.exports = { relativeTime };
`,
    },
  },
  {
    app: "files",
    id: "bytes.format",
    title: "Human byte sizes",
    summary: "Format byte counts as KB / MB / GB with stable rounding.",
    kind: "util",
    tags: ["files", "bytes"],
    usage: "const { formatBytes } = require('./parts/bytes.format');",
    files: {
      "index.js": `/**
 * Portable byte size formatter.
 */

function formatBytes(n, digits = 1) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return "—";
  if (v < 1024) return \`\${Math.round(v)} B\`;
  const units = ["KB", "MB", "GB", "TB"];
  let x = v;
  let i = -1;
  do {
    x /= 1024;
    i += 1;
  } while (x >= 1024 && i < units.length - 1);
  const fixed = x >= 10 || digits === 0 ? x.toFixed(0) : x.toFixed(digits);
  return \`\${fixed} \${units[i]}\`;
}

module.exports = { formatBytes };
`,
    },
  },
  {
    app: "flag-quiz",
    id: "quiz.shuffle",
    title: "Fisher–Yates shuffle",
    summary: "Immutable shuffle for quiz option order.",
    kind: "util",
    tags: ["quiz", "random"],
    usage: "const { shuffle } = require('./parts/quiz.shuffle');",
    files: {
      "index.js": `/**
 * Portable Fisher–Yates shuffle (non-mutating).
 */

function shuffle(items, rand = Math.random) {
  const arr = Array.isArray(items) ? items.slice() : [];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

module.exports = { shuffle };
`,
    },
  },
  {
    app: "geography",
    id: "geo.flag-emoji",
    title: "ISO to flag emoji",
    summary: "Convert ISO 3166-1 alpha-2 codes to regional-indicator emoji.",
    kind: "data",
    tags: ["geo", "flag"],
    usage: "const { flagEmoji } = require('./parts/geo.flag-emoji');",
    files: {
      "index.js": `/**
 * Portable ISO2 → flag emoji (no assets).
 */

function flagEmoji(iso2) {
  const code = String(iso2 || "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "";
  const A = 0x1f1e6;
  return String.fromCodePoint(A + code.charCodeAt(0) - 65, A + code.charCodeAt(1) - 65);
}

module.exports = { flagEmoji };
`,
    },
  },
  {
    app: "history",
    id: "wiki.title-slug",
    title: "Wikipedia title slug",
    summary: "Normalize titles for Wikipedia / Wikidata style paths.",
    kind: "util",
    tags: ["wiki", "history"],
    usage: "const { wikiSlug } = require('./parts/wiki.title-slug');",
    files: {
      "index.js": `/**
 * Portable wiki title slugger.
 */

function wikiSlug(title) {
  return String(title || "")
    .trim()
    .replace(/\\s+/g, "_")
    .replace(/[/\\\\?#]/g, "")
    .replace(/_+/g, "_");
}

function wikiUrl(title, lang = "en") {
  const slug = wikiSlug(title);
  if (!slug) return "";
  return \`https://\${lang}.wikipedia.org/wiki/\${encodeURIComponent(slug).replace(/%2F/gi, "/")}\`;
}

module.exports = { wikiSlug, wikiUrl };
`,
    },
  },
  {
    app: "icon-library",
    id: "icons.svg-trim",
    title: "SVG string trim",
    summary: "Trim and normalize SVG markup for clipboard copy.",
    kind: "util",
    tags: ["icons", "svg"],
    usage: "const { trimSvg } = require('./parts/icons.svg-trim');",
    files: {
      "index.js": `/**
 * Portable SVG cleanup for copy/export.
 */

function trimSvg(raw) {
  let s = String(raw || "").trim();
  if (!s) return "";
  // strip XML declaration / comments lightly
  s = s.replace(/<\\?xml[\\s\\S]*?\\?>/i, "").replace(/<!--[\\s\\S]*?-->/g, "");
  s = s.trim();
  if (!/^<svg\\b/i.test(s)) return s;
  return s.replace(/\\s{2,}/g, " ").replace(/>\\s+</g, "><");
}

module.exports = { trimSvg };
`,
    },
  },
  {
    app: "mail",
    id: "connect.service-rank",
    title: "Connect service rank",
    summary: "Rank web-service catalog entries by name, tags, and url.",
    kind: "util",
    tags: ["connect", "search"],
    usage: "const { rankServices } = require('./parts/connect.service-rank');",
    files: {
      "index.js": `/**
 * Portable Connect/mail service ranking.
 */

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .trim();
}

function scoreService(query, svc) {
  const q = norm(query);
  if (!q) return 1;
  const name = norm(svc.name || svc.title);
  const tags = norm((svc.tags || []).join(" "));
  const url = norm(svc.url || svc.href);
  if (name === q) return 1;
  if (name.startsWith(q)) return 0.9;
  if (name.includes(q)) return 0.75;
  if (tags.includes(q)) return 0.6;
  if (url.includes(q)) return 0.45;
  return 0;
}

function rankServices(services, query, limit = 40) {
  return (Array.isArray(services) ? services : [])
    .map((svc) => ({ svc, score: scoreService(query, svc) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.svc);
}

module.exports = { scoreService, rankServices };
`,
    },
  },
  {
    app: "model-flow",
    id: "flow.step-status",
    title: "Flow step status",
    summary: "Normalize plan/approve/run step phases to tone + label.",
    kind: "ui",
    tags: ["flow", "status"],
    usage: "const { stepStatus } = require('./parts/flow.step-status');",
    files: {
      "index.js": `/**
 * Portable Model Flow step status mapper.
 */

const MAP = {
  idle: { label: "Idle", tone: "muted" },
  planned: { label: "Planned", tone: "info" },
  pending: { label: "Pending approval", tone: "warn" },
  approved: { label: "Approved", tone: "ok" },
  running: { label: "Running", tone: "info" },
  done: { label: "Done", tone: "ok" },
  succeeded: { label: "Succeeded", tone: "ok" },
  failed: { label: "Failed", tone: "danger" },
  skipped: { label: "Skipped", tone: "muted" },
  cancelled: { label: "Cancelled", tone: "muted" },
};

function stepStatus(phase) {
  const key = String(phase || "")
    .toLowerCase()
    .trim();
  return MAP[key] || { label: key || "Unknown", tone: "muted" };
}

module.exports = { stepStatus, MAP };
`,
    },
  },
  {
    app: "msl-protocol",
    id: "msl.uri-parse",
    title: "MSL URI parse",
    summary: "Parse msl:v1/… capability URIs into capability + query map.",
    kind: "util",
    tags: ["msl", "uri"],
    usage: "const { parseMslUri } = require('./parts/msl.uri-parse');",
    files: {
      "index.js": `/**
 * Portable MSL URI parser (best-effort, no host deps).
 */

function parseMslUri(raw) {
  const s = String(raw || "").trim();
  if (!s) return { ok: false, error: "Empty URI" };
  const body = s.replace(/^msl:v\\d+\\//i, "").replace(/^msl:\\/\\//i, "");
  const [capPart, query = ""] = body.split("?");
  const capability = decodeURIComponent(capPart || "").replace(/\\/+/g, ".").replace(/^\\.|\\.$/g, "");
  const params = {};
  if (query) {
    for (const pair of query.split("&")) {
      if (!pair) continue;
      const eq = pair.indexOf("=");
      const k = decodeURIComponent(eq >= 0 ? pair.slice(0, eq) : pair);
      const v = decodeURIComponent(eq >= 0 ? pair.slice(eq + 1) : "");
      if (k) params[k] = v;
    }
  }
  if (!capability) return { ok: false, error: "Missing capability" };
  return { ok: true, capability, params, raw: s };
}

module.exports = { parseMslUri };
`,
    },
  },
  {
    app: "myspace-browser",
    id: "url.query-or-nav",
    title: "Omnibox query vs URL",
    summary: "Decide whether omnibox input is a search query or navigation URL.",
    kind: "util",
    tags: ["browser", "url"],
    usage: "const { classifyOmnibox } = require('./parts/url.query-or-nav');",
    files: {
      "index.js": `/**
 * Portable omnibox classifier.
 */

function classifyOmnibox(input) {
  const raw = String(input || "").trim();
  if (!raw) return { kind: "empty", value: "" };
  if (/^(https?:|myspace:|file:)/i.test(raw)) {
    return { kind: "url", value: raw };
  }
  if (/^[\\w.-]+\\.[a-z]{2,}([\\/:].*)?$/i.test(raw) && !/\\s/.test(raw)) {
    return { kind: "url", value: \`https://\${raw}\` };
  }
  if (/^localhost(:\\d+)?(\\/.*)?$/i.test(raw)) {
    return { kind: "url", value: \`http://\${raw}\` };
  }
  return { kind: "query", value: raw };
}

module.exports = { classifyOmnibox };
`,
    },
  },
  {
    app: "notes",
    id: "notes.tag-parse",
    title: "Note tag parser",
    summary: "Split and normalize tag strings for notebooks.",
    kind: "util",
    tags: ["notes", "tags"],
    usage: "const { parseTags } = require('./parts/notes.tag-parse');",
    files: {
      "index.js": `/**
 * Portable note tag parser.
 */

function parseTags(input) {
  const raw = Array.isArray(input) ? input.join(",") : String(input || "");
  const seen = new Set();
  const out = [];
  for (const part of raw.split(/[,#\\s]+/)) {
    const t = part.trim().toLowerCase().replace(/^#+/, "");
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function snippet(text, max = 140) {
  const s = String(text || "")
    .replace(/\\s+/g, " ")
    .trim();
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

module.exports = { parseTags, snippet };
`,
    },
  },
  {
    app: "os-bridge",
    id: "host.safe-id",
    title: "Safe host id slug",
    summary: "Slugify device/folder names into safe identifiers.",
    kind: "util",
    tags: ["bridge", "id"],
    usage: "const { safeId } = require('./parts/host.safe-id');",
    files: {
      "index.js": `/**
 * Portable safe identifier slug.
 */

function safeId(input, fallback = "item") {
  const s = String(input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return s || fallback;
}

module.exports = { safeId };
`,
    },
  },
  {
    app: "pi-digits",
    id: "memory.chunk",
    title: "Digit string chunker",
    summary: "Split long digit strings into fixed-size memory chunks.",
    kind: "util",
    tags: ["memory", "pi"],
    usage: "const { chunkDigits } = require('./parts/memory.chunk');",
    files: {
      "index.js": `/**
 * Portable digit chunker for memorization drills.
 */

function chunkDigits(digits, size = 5) {
  const s = String(digits || "").replace(/\\D+/g, "");
  const n = Math.max(1, Number(size) || 5);
  const out = [];
  for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n));
  return out;
}

module.exports = { chunkDigits };
`,
    },
  },
  {
    app: "profiles",
    id: "vault.mask",
    title: "Secret mask",
    summary: "Mask passwords/secrets for list and detail views.",
    kind: "util",
    tags: ["vault", "security"],
    usage: "const { maskSecret } = require('./parts/vault.mask');",
    files: {
      "index.js": `/**
 * Portable secret masking.
 */

function maskSecret(value, visible = 0) {
  const s = String(value ?? "");
  if (!s) return "";
  const keep = Math.max(0, Math.min(Number(visible) || 0, s.length));
  if (!keep) return "•".repeat(Math.min(12, Math.max(4, s.length)));
  return s.slice(0, keep) + "•".repeat(Math.max(4, s.length - keep));
}

module.exports = { maskSecret };
`,
    },
  },
  {
    app: "pulse",
    id: "pulse.kv-args",
    title: "Pulse key=value args",
    summary: "Parse shell-style key:value / key=value argument blobs.",
    kind: "util",
    tags: ["pulse", "args"],
    usage: "const { parseKvArgs } = require('./parts/pulse.kv-args');",
    files: {
      "index.js": `/**
 * Portable Pulse / shell KV arg parser.
 */

function parseKvArgs(raw) {
  const input = {};
  for (const part of String(raw || "").trim().split(/\\s+/).filter(Boolean)) {
    const m = part.match(/^([^:=]+)[:=]([\\s\\S]+)$/);
    if (m) input[m[1]] = m[2];
  }
  return input;
}

function formatKvArgs(obj) {
  return Object.entries(obj || {})
    .map(([k, v]) => \`\${k}=\${v}\`)
    .join(" ");
}

module.exports = { parseKvArgs, formatKvArgs };
`,
    },
  },
  {
    app: "remote-hub",
    id: "net.endpoint-label",
    title: "Endpoint label",
    summary: "Format host:port and connection-type labels for remote machines.",
    kind: "util",
    tags: ["network", "remote"],
    usage: "const { endpointLabel } = require('./parts/net.endpoint-label');",
    files: {
      "index.js": `/**
 * Portable remote endpoint labels.
 */

function endpointLabel(host, port, type) {
  const h = String(host || "").trim() || "—";
  const p = port == null || port === "" ? "" : \`:\${port}\`;
  const t = String(type || "").trim();
  return t ? \`\${t.toUpperCase()} \${h}\${p}\` : \`\${h}\${p}\`;
}

function parseHostPort(raw, defaultPort) {
  const s = String(raw || "").trim();
  if (!s) return { host: "", port: defaultPort ?? null };
  if (s.startsWith("[")) {
    const end = s.indexOf("]");
    const host = s.slice(1, end);
    const rest = s.slice(end + 1);
    const port = rest.startsWith(":") ? Number(rest.slice(1)) : defaultPort ?? null;
    return { host, port: Number.isFinite(port) ? port : defaultPort ?? null };
  }
  const idx = s.lastIndexOf(":");
  if (idx > 0 && s.indexOf(":") === idx) {
    const host = s.slice(0, idx);
    const port = Number(s.slice(idx + 1));
    return { host, port: Number.isFinite(port) ? port : defaultPort ?? null };
  }
  return { host: s, port: defaultPort ?? null };
}

module.exports = { endpointLabel, parseHostPort };
`,
    },
  },
  {
    app: "scripts",
    id: "text.line-count",
    title: "Script line count",
    summary: "Count total and non-empty lines in script bodies.",
    kind: "util",
    tags: ["scripts", "text"],
    usage: "const { lineCount } = require('./parts/text.line-count');",
    files: {
      "index.js": `/**
 * Portable line counters.
 */

function lineCount(text) {
  const s = String(text ?? "");
  if (!s) return { total: 0, nonEmpty: 0 };
  const lines = s.split(/\\r?\\n/);
  const nonEmpty = lines.filter((l) => l.trim().length > 0).length;
  return { total: lines.length, nonEmpty };
}

module.exports = { lineCount };
`,
    },
  },
  {
    app: "shell-console",
    id: "list.field-filter",
    title: "Multi-field list filter",
    summary: "Filter object arrays by substring across chosen fields.",
    kind: "util",
    tags: ["shell", "filter"],
    usage: "const { fieldFilter } = require('./parts/list.field-filter');",
    files: {
      "index.js": `/**
 * Portable multi-field substring filter.
 */

function fieldFilter(items, query, fields = []) {
  const q = String(query || "")
    .toLowerCase()
    .trim();
  const list = Array.isArray(items) ? items : [];
  if (!q) return list.slice();
  const keys = Array.isArray(fields) && fields.length ? fields : null;
  return list.filter((item) => {
    if (item == null) return false;
    if (!keys) return JSON.stringify(item).toLowerCase().includes(q);
    return keys.some((k) =>
      String(item[k] ?? "")
        .toLowerCase()
        .includes(q)
    );
  });
}

module.exports = { fieldFilter };
`,
    },
  },
  {
    app: "space",
    id: "space.si-format",
    title: "SI / scientific format",
    summary: "Format large/small numbers for physics and astronomy UIs.",
    kind: "util",
    tags: ["space", "number"],
    usage: "const { formatSi } = require('./parts/space.si-format');",
    files: {
      "index.js": `/**
 * Portable SI / scientific number formatting.
 */

function formatSi(n, digits = 3) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs !== 0 && (abs >= 1e6 || abs < 1e-3)) {
    return v.toExponential(digits);
  }
  if (Number.isInteger(v) && abs < 1e6) return String(v);
  return v.toPrecision(digits);
}

module.exports = { formatSi };
`,
    },
  },
  {
    app: "stocks",
    id: "money.format",
    title: "Money & percent format",
    summary: "Format prices, deltas, and percentages for watchlists.",
    kind: "util",
    tags: ["stocks", "money"],
    usage: "const { formatMoney, formatPct } = require('./parts/money.format');",
    files: {
      "index.js": `/**
 * Portable money / percent formatters.
 */

function formatMoney(n, currency = "USD", digits = 2) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: digits,
    }).format(v);
  } catch {
    return \`\${v.toFixed(digits)} \${currency}\`;
  }
}

function formatPct(n, digits = 2) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return \`\${sign}\${v.toFixed(digits)}%\`;
}

module.exports = { formatMoney, formatPct };
`,
    },
  },
  {
    app: "studies",
    id: "text.html-words",
    title: "HTML strip + word count",
    summary: "Strip tags from HTML-ish text and count words.",
    kind: "util",
    tags: ["studies", "text"],
    usage: "const { stripHtml, wordCount } = require('./parts/text.html-words');",
    files: {
      "index.js": `/**
 * Portable HTML strip + word count.
 */

function stripHtml(html) {
  return String(html || "")
    .replace(/<script[\\s\\S]*?<\\/script>/gi, " ")
    .replace(/<style[\\s\\S]*?<\\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\\s+/g, " ")
    .trim();
}

function wordCount(text) {
  const s = stripHtml(text);
  if (!s) return 0;
  return s.split(/\\s+/).filter(Boolean).length;
}

module.exports = { stripHtml, wordCount };
`,
    },
  },
  {
    app: "study-deck",
    id: "cards.due-queue",
    title: "Flashcard due queue",
    summary: "Filter and sort cards by dueAt for a study session.",
    kind: "util",
    tags: ["cards", "srs"],
    usage: "const { dueQueue } = require('./parts/cards.due-queue');",
    files: {
      "index.js": `/**
 * Portable flashcard due-queue helper.
 */

function dueQueue(cards, now = Date.now(), limit = 50) {
  const t = Number(now);
  return (Array.isArray(cards) ? cards : [])
    .map((card) => {
      const due = card?.dueAt != null ? Date.parse(card.dueAt) : 0;
      return { card, due: Number.isFinite(due) ? due : 0 };
    })
    .filter((row) => row.due <= t)
    .sort((a, b) => a.due - b.due)
    .slice(0, Math.max(1, limit))
    .map((row) => row.card);
}

module.exports = { dueQueue };
`,
    },
  },
  {
    app: "system-info",
    id: "table.sort-rows",
    title: "Table row sorter",
    summary: "Sort arrays of row objects by a column key asc/desc.",
    kind: "util",
    tags: ["table", "sort"],
    usage: "const { sortRows } = require('./parts/table.sort-rows');",
    files: {
      "index.js": `/**
 * Portable row sorter for tables / metric grids.
 */

function sortRows(rows, key, dir = "asc") {
  const list = Array.isArray(rows) ? rows.slice() : [];
  const mult = String(dir).toLowerCase() === "desc" ? -1 : 1;
  list.sort((a, b) => {
    const av = a?.[key];
    const bv = b?.[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * mult;
    return String(av).localeCompare(String(bv), undefined, { numeric: true }) * mult;
  });
  return list;
}

module.exports = { sortRows };
`,
    },
  },
  {
    app: "translate",
    id: "lang.label",
    title: "Language code labels",
    summary: "Map common BCP-47 / ISO language codes to English labels.",
    kind: "data",
    tags: ["translate", "i18n"],
    usage: "const { langLabel } = require('./parts/lang.label');",
    files: {
      "index.js": `/**
 * Portable language code → English label (common set).
 */

const LABELS = {
  en: "English",
  he: "Hebrew",
  ar: "Arabic",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  ru: "Russian",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
  hi: "Hindi",
  tr: "Turkish",
  nl: "Dutch",
  pl: "Polish",
  sv: "Swedish",
  uk: "Ukrainian",
  fa: "Persian",
  yi: "Yiddish",
};

function langLabel(code) {
  const raw = String(code || "").trim();
  if (!raw) return "";
  const base = raw.toLowerCase().split(/[-_]/)[0];
  return LABELS[base] || raw;
}

module.exports = { langLabel, LABELS };
`,
    },
  },
  {
    app: "world-clock",
    id: "clock.duration",
    title: "Duration display",
    summary: "Format ms or seconds as mm:ss / hh:mm:ss for timers.",
    kind: "util",
    tags: ["clock", "timer"],
    usage: "const { formatDuration } = require('./parts/clock.duration');",
    files: {
      "index.js": `/**
 * Portable duration formatter for clocks / pomodoro / stopwatch.
 */

function pad(n) {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

function formatDuration(msOrSec, unit = "ms") {
  let ms = Number(msOrSec);
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  if (unit === "s" || unit === "sec") ms *= 1000;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return \`\${pad(h)}:\${pad(m)}:\${pad(s)}\`;
  return \`\${pad(m)}:\${pad(s)}\`;
}

module.exports = { formatDuration };
`,
    },
  },
  {
    app: "world-maps",
    id: "geo.bbox-clamp",
    title: "Map bbox clamp",
    summary: "Normalize and clamp lat/lon bounding boxes.",
    kind: "util",
    tags: ["maps", "geo"],
    usage: "const { clampBbox } = require('./parts/geo.bbox-clamp');",
    files: {
      "index.js": `/**
 * Portable map bounding-box clamp.
 */

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function clampBbox(bbox) {
  const b = bbox || {};
  let west = Number(b.west ?? b.minLon ?? b[0]);
  let south = Number(b.south ?? b.minLat ?? b[1]);
  let east = Number(b.east ?? b.maxLon ?? b[2]);
  let north = Number(b.north ?? b.maxLat ?? b[3]);
  if (![west, south, east, north].every(Number.isFinite)) {
    return { west: -180, south: -85, east: 180, north: 85 };
  }
  west = clamp(west, -180, 180);
  east = clamp(east, -180, 180);
  south = clamp(south, -85, 85);
  north = clamp(north, -85, 85);
  if (south > north) {
    const t = south;
    south = north;
    north = t;
  }
  if (west > east) {
    const t = west;
    west = east;
    east = t;
  }
  return { west, south, east, north };
}

module.exports = { clampBbox };
`,
    },
  },
];

async function main() {
  let ok = 0;
  let fail = 0;
  for (const spec of PARTS) {
    const res = publishPart({
      app: spec.app,
      id: spec.id,
      title: spec.title,
      summary: spec.summary,
      kind: spec.kind,
      tags: spec.tags,
      usage: spec.usage,
      entry: "index.js",
      files: spec.files,
      version: 1,
    });
    if (res.ok) {
      ok += 1;
      console.log("OK", spec.app, "→", spec.id);
    } else {
      fail += 1;
      console.error("FAIL", spec.app, spec.id, res.error);
    }
  }
  console.log(`\\nDone: ${ok} published, ${fail} failed, ${PARTS.length} total`);
}

main();