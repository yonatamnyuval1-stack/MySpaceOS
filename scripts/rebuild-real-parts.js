const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SHARED = path.join(ROOT, "shared", "parts");
const APPS = path.join(ROOT, "apps");

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
        version: Number(meta.version) || 1,
        kind: meta.kind || "util",
        title: meta.title,
        summary: meta.summary,
        tags: meta.tags || [],
        entry: "index.js",
        files: ["index.js"],
        api: meta.api || {},
        usage: meta.usage || `const mod = require('./parts/${id}');`,
      },
      null,
      2
    ) + "\n"
  );
  fs.writeFileSync(path.join(dir, "index.js"), code.replace(/\r\n/g, "\n"));
  console.log("shared", id);
}

function dualExport(exportName, objectExpr) {
  return `
const api = ${objectExpr};
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.${exportName} = api;
`;
}

function rmDir(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function cleanWeakStubs() {
  const keepAdopted = new Set();
  for (const app of fs.readdirSync(APPS, { withFileTypes: true })) {
    if (!app.isDirectory()) continue;
    const partsRoot = path.join(APPS, app.name, "parts");
    if (!fs.existsSync(partsRoot)) continue;
    for (const folder of fs.readdirSync(partsRoot, { withFileTypes: true })) {
      if (!folder.isDirectory()) continue;
      const base = path.join(partsRoot, folder.name);
      const metaPath = path.join(base, "part.json");
      let meta = null;
      try {
        meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      } catch {
      }
      if (meta?.adoptedAt) {
        keepAdopted.add(`${app.name}/${folder.name}`);
        continue;
      }
      rmDir(base);
      console.log("removed stub", app.name, folder.name);
    }
  }
  return keepAdopted;
}

function writeCredit(appId, exportsList, note) {
  const file = path.join(APPS, appId, "parts.json");
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        note: note || `Real Parts published from ${appId} (code lives in shared/parts: clean, no host coupling).`,
        exports: exportsList,
      },
      null,
      2
    ) + "\n"
  );
}

writePart(
  "finance.ohlc",
  {
    kind: "util",
    title: "OHLC indicators",
    summary:
      "SMA, RSI, volatility, period return, volume averages, and analyze() for OHLC candle arrays. Build charting / portfolio UIs without reinventing indicators.",
    tags: ["finance", "stocks", "charts", "rsi"],
    usage: "const { analyze, rsi, sma } = require('./parts/finance.ohlc');",
    api: {
      sma: "sma(points, period) → (number|null)[]",
      rsi: "rsi(points, period=14) → number|null",
      analyze: "analyze(points, quote?) → summary object",
    },
  },
  `/**
 * Portable OHLC analytics — extracted from Stocks.
 * points: [{ close, volume? }, ...]
 */

function sma(points, period) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += points[j].close;
    out.push(sum / period);
  }
  return out;
}

function periodReturn(points) {
  if (points.length < 2) return null;
  const first = points[0].close;
  const last = points[points.length - 1].close;
  if (!first) return null;
  return ((last - first) / first) * 100;
}

function volatility(points) {
  if (points.length < 3) return null;
  const rets = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1].close;
    if (prev) rets.push((points[i].close - prev) / prev);
  }
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
  return Math.sqrt(variance) * 100;
}

function rsi(points, period = 14) {
  if (points.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = points.length - period; i < points.length; i++) {
    const diff = points[i].close - points[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function avgVolume(points) {
  const vols = points.map((p) => p.volume).filter((v) => v != null && v > 0);
  if (!vols.length) return null;
  return vols.reduce((a, b) => a + b, 0) / vols.length;
}

function trendLabel(price, ma) {
  if (price == null || ma == null) return "—";
  const diff = ((price - ma) / ma) * 100;
  if (diff > 1.5) return { text: "Above MA", cls: "up" };
  if (diff < -1.5) return { text: "Below MA", cls: "down" };
  return { text: "Near MA", cls: "flat" };
}

function analyze(points, quote) {
  const closes = points.map((p) => p.close).filter((c) => c != null);
  const ma20 = sma(points, 20);
  const ma50 = sma(points, 50);
  const lastMa20 = ma20[ma20.length - 1];
  const lastMa50 = ma50[ma50.length - 1];
  const price = quote?.price ?? closes[closes.length - 1];
  const periodHigh = closes.length ? Math.max(...closes) : null;
  const periodLow = closes.length ? Math.min(...closes) : null;
  const vol = avgVolume(points);
  const lastVol = points[points.length - 1]?.volume;

  return {
    ma20,
    ma50,
    periodReturn: periodReturn(points),
    volatility: volatility(points),
    rsi: rsi(points),
    periodHigh,
    periodLow,
    avgVolume: vol,
    volumeVsAvg: vol && lastVol ? ((lastVol - vol) / vol) * 100 : null,
    trend20: trendLabel(price, lastMa20),
    trend50: trendLabel(price, lastMa50),
    distFromHigh: periodHigh && price ? ((price - periodHigh) / periodHigh) * 100 : null,
    distFromLow: periodLow && price ? ((price - periodLow) / periodLow) * 100 : null,
  };
}
` + dualExport("PartsFinanceOhlc", "{ sma, periodReturn, volatility, rsi, avgVolume, trendLabel, analyze }")
);

writePart(
  "money.format",
  {
    kind: "util",
    title: "Money & market formatters",
    summary:
      "Currency, percent, volume (K/M/B), and market-cap compact formatters used by trading UIs.",
    tags: ["finance", "money", "format"],
    usage: "const { formatMoney, formatPct, formatVol, formatCap } = require('./parts/money.format');",
    api: {
      formatMoney: "formatMoney(n, currency?)",
      formatPct: "formatPct(n)",
      formatVol: "formatVol(n)",
      formatCap: "formatCap(n)",
    },
  },
  `/**
 * Portable money / market number formatters from Stocks.
 */

function formatMoney(n, currency) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(n));
  } catch {
    return Number(n).toFixed(2) + " " + (currency || "USD");
  }
}

function formatPct(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  const sign = v >= 0 ? "+" : "";
  return sign + v.toFixed(2) + "%";
}

function formatVol(n) {
  if (n == null) return "—";
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return String(v);
}

function formatCap(n) {
  if (n == null) return "—";
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  if (v >= 1e12) return "$" + (v / 1e12).toFixed(2) + "T";
  if (v >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  return "$" + v;
}

function changeClass(n) {
  if (n > 0) return "up";
  if (n < 0) return "down";
  return "flat";
}
` + dualExport("PartsMoneyFormat", "{ formatMoney, formatPct, formatVol, formatCap, changeClass }")
);

writePart(
  "cards.srs",
  {
    kind: "util",
    title: "Spaced repetition scheduler",
    summary:
      "SM-2-style scheduleCard(again|hard|good|easy) plus dueQueue for study sessions. Build flashcard apps on top.",
    tags: ["srs", "flashcards", "study"],
    usage: "const { scheduleCard, dueQueue } = require('./parts/cards.srs');",
    api: {
      scheduleCard: "scheduleCard(card, grade) → next card fields",
      dueQueue: "dueQueue(cards, now?, limit?) → due cards sorted",
    },
  },
  `/**
 * Portable spaced-repetition helpers: from Study Deck.
 * Card fields: ease, interval (days), dueAt (ISO), reps, lapses
 */

function scheduleCard(card, grade) {
  const next = {
    ...card,
    updatedAt: new Date().toISOString(),
    reps: (card.reps || 0) + 1,
  };
  const now = Date.now();
  let ease = Number(card.ease) || 2.5;
  let interval = Number(card.interval) || 0;

  if (grade === "again") {
    next.lapses = (card.lapses || 0) + 1;
    ease = Math.max(1.3, ease - 0.2);
    interval = 0;
    next.dueAt = new Date(now + 5 * 60 * 1000).toISOString();
  } else if (grade === "hard") {
    ease = Math.max(1.3, ease - 0.15);
    interval = interval ? Math.max(1, Math.round(interval * 1.2)) : 1;
    next.dueAt = new Date(now + interval * 24 * 60 * 60 * 1000).toISOString();
  } else if (grade === "easy") {
    ease = Math.min(3.0, ease + 0.15);
    interval = interval ? Math.round(interval * ease * 1.3) : 4;
    next.dueAt = new Date(now + interval * 24 * 60 * 60 * 1000).toISOString();
  } else {
    ease = Math.min(3.0, ease + 0.05);
    interval = interval ? Math.round(interval * ease) : 1;
    next.dueAt = new Date(now + interval * 24 * 60 * 60 * 1000).toISOString();
  }
  next.ease = Math.round(ease * 100) / 100;
  next.interval = interval;
  return next;
}

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

function newCard(fields = {}) {
  const now = new Date().toISOString();
  return {
    id: fields.id || "card_" + Date.now(),
    front: String(fields.front || ""),
    back: String(fields.back || ""),
    type: fields.type || "flash",
    ease: 2.5,
    interval: 0,
    dueAt: now,
    reps: 0,
    lapses: 0,
    createdAt: now,
    updatedAt: now,
    ...fields,
  };
}
` + dualExport("PartsCardsSrs", "{ scheduleCard, dueQueue, newCard }")
);

writePart(
  "clock.tz",
  {
    kind: "util",
    title: "Timezone clock helpers",
    summary:
      "List IANA zones, format times in a zone, get civil time parts, offsets, and analog clock angles — foundation for world clocks and schedulers.",
    tags: ["clock", "timezone", "intl"],
    usage: "const { getPartsInZone, formatInZone, localTimeZone } = require('./parts/clock.tz');",
  },
  `/**
 * Portable timezone helpers: from World Clock.
 */

function pad2(n) {
  return String(n).padStart(2, "0");
}

function getAllTimeZones() {
  try {
    if (typeof Intl !== "undefined" && typeof Intl.supportedValuesOf === "function") {
      return Intl.supportedValuesOf("timeZone");
    }
  } catch (_) {
    /* ignore */
  }
  return ["UTC", "America/New_York", "Europe/London", "Europe/Paris", "Asia/Jerusalem", "Asia/Tokyo"];
}

function zoneCityName(zoneId) {
  const part = String(zoneId || "").split("/").pop() || zoneId;
  return part.replace(/_/g, " ");
}

function formatInZone(date, timeZone, opts) {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone, ...opts }).format(date);
  } catch (_) {
    return "—";
  }
}

function getPartsInZone(date, timeZone) {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = fmt.formatToParts(date);
    const map = {};
    parts.forEach((p) => {
      if (p.type !== "literal") map[p.type] = p.value;
    });
    return {
      year: parseInt(map.year, 10),
      month: parseInt(map.month, 10),
      day: parseInt(map.day, 10),
      hour: parseInt(map.hour, 10) % 24,
      minute: parseInt(map.minute, 10),
      second: parseInt(map.second, 10),
    };
  } catch (_) {
    return null;
  }
}

function getOffsetLabel(date, timeZone) {
  try {
    const short = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName");
    return short?.value || "";
  } catch (_) {
    return "";
  }
}

function clockAngles(date, timeZone) {
  const p = getPartsInZone(date, timeZone) || {
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
  };
  const h = p.hour % 12;
  const m = p.minute;
  const s = p.second;
  return {
    hour: (h + m / 60) * 30,
    minute: (m + s / 60) * 6,
    second: s * 6,
  };
}

function localTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (_) {
    return "UTC";
  }
}

function formatTime12(d, tz) {
  return formatInZone(d, tz, { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
}
function formatTime24(d, tz) {
  return formatInZone(d, tz, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}
function formatDate(d, tz) {
  return formatInZone(d, tz, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function formatMs(ms) {
  const neg = ms < 0;
  const t = Math.abs(Math.floor(ms));
  const h = Math.floor(t / 3600000);
  const m = Math.floor((t % 3600000) / 60000);
  const s = Math.floor((t % 60000) / 1000);
  const cs = Math.floor((t % 1000) / 10);
  if (h > 0) return (neg ? "-" : "") + pad2(h) + ":" + pad2(m) + ":" + pad2(s);
  return (neg ? "-" : "") + pad2(m) + ":" + pad2(s) + "." + pad2(cs);
}

function formatTimerDisplay(totalSec) {
  const t = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (h > 0) return pad2(h) + ":" + pad2(m) + ":" + pad2(s);
  return pad2(m) + ":" + pad2(s);
}
` +
    dualExport(
      "PartsClockTz",
      "{ pad2, getAllTimeZones, zoneCityName, formatInZone, getPartsInZone, getOffsetLabel, clockAngles, localTimeZone, formatTime12, formatTime24, formatDate, formatMs, formatTimerDisplay }"
    )
);

console.log("phase1 core written");

writePart(
  "clock.meeting",
  {
    kind: "util",
    title: "Meeting slot finder",
    summary:
      "Score participants across timezones and findBestSlots for a date: the engine behind multi-zone meeting planners.",
    tags: ["clock", "meeting", "timezone", "scheduling"],
    usage: "const { findBestSlots, participantScore } = require('./parts/clock.meeting');",
    api: {
      findBestSlots: "findBestSlots({ participants, dateStr, durationMin, referenceTz })",
      participantScore: "participantScore(slotDate, participant, durationMin)",
    },
  },
  fs.readFileSync(path.join(ROOT, "scripts", "_meeting-body.js"), "utf8")
);

writePart(
  "files.kind",
  {
    kind: "util",
    title: "File kind classifier",
    summary:
      "Classify filenames into code / sheet / document / image / pdf / folder / other — including Dockerfiles and lockfiles.",
    tags: ["files", "builds", "mime"],
    usage: "const { fileKind } = require('./parts/files.kind');",
  },
  fs.readFileSync(path.join(ROOT, "scripts", "_files-kind-body.js"), "utf8")
);

writePart(
  "path.tree",
  {
    kind: "util",
    title: "Relative path tree helpers",
    summary: "Normalize relative paths, containment checks, top-level folder items, and file counts in trees.",
    tags: ["path", "builds", "files"],
    usage: "const { normRelPath, isPathUnder, countFilesInTreeNode } = require('./parts/path.tree');",
  },
  `/**
 * Portable path / tree helpers: from Builds.
 */

function normRelPath(p) {
  return String(p || "")
    .replace(/\\\\/g, "/")
    .replace(/\\/+$/, "")
    .toLowerCase();
}

function isPathUnder(child, parent) {
  const c = normRelPath(child);
  const p = normRelPath(parent);
  if (!p || c === p) return false;
  return c.startsWith(p + "/");
}

function topLevelSubCategoryItems(items) {
  const list = (items || []).filter((i) => i && i.path);
  return list.filter(function (item, i) {
    return !list.some(function (other, j) {
      return j !== i && isPathUnder(item.path, other.path);
    });
  });
}

function countFilesInTreeNode(node) {
  if (!node) return 0;
  if (node.type === "file") return 1;
  if (node.fileCount != null) return Number(node.fileCount) || 0;
  return (node.children || []).reduce(function (sum, child) {
    return sum + countFilesInTreeNode(child);
  }, 0);
}
` + dualExport("PartsPathTree", "{ normRelPath, isPathUnder, topLevelSubCategoryItems, countFilesInTreeNode }")
);

writePart(
  "date.agenda",
  {
    kind: "util",
    title: "Local agenda date helpers",
    summary:
      "Local YYYY-MM-DD / HH:mm, addDays, due labels, hour bucketing and groupByHour for day planners.",
    tags: ["date", "planner", "agenda"],
    usage: "const { localTodayISO, groupByHour, dueLabel } = require('./parts/date.agenda');",
  },
  `/**
 * Portable local agenda helpers: from Day Planner / Today.
 */

function pad(n) {
  return String(n).padStart(2, "0");
}

function localTodayISO(d = new Date()) {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

function localNowHM(d = new Date()) {
  return pad(d.getHours()) + ":" + pad(d.getMinutes());
}

function addDaysLocal(iso, days) {
  const d = new Date(String(iso) + "T12:00:00");
  if (Number.isNaN(d.getTime())) return localTodayISO();
  d.setDate(d.getDate() + Number(days || 0));
  return localTodayISO(d);
}

function formatLongDate(iso) {
  try {
    return new Date(String(iso) + "T12:00:00").toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatTimeLabel(hm) {
  if (!hm) return "Anytime";
  try {
    const [h, m] = hm.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return hm;
  }
}

function hourKey(hm) {
  if (!hm) return "anytime";
  return String(hm).slice(0, 2) + ":00";
}

function dueLabel(iso, today = localTodayISO()) {
  if (!iso) return "";
  if (iso === today) return "Today";
  if (iso === addDaysLocal(today, 1)) return "Tomorrow";
  try {
    return new Date(String(iso) + "T12:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function dueDateForWhen(when, today = localTodayISO()) {
  if (when === "tomorrow") return addDaysLocal(today, 1);
  if (when === "later") return addDaysLocal(today, 3);
  return today;
}

function defaultComposerTime(d = new Date()) {
  const x = new Date(d);
  x.setMinutes(Math.ceil(x.getMinutes() / 15) * 15, 0, 0);
  if (x.getMinutes() === 60) x.setHours(x.getHours() + 1, 0, 0, 0);
  return pad(x.getHours()) + ":" + pad(x.getMinutes());
}

function groupByHour(items, getTime = (it) => it.time || it.hm) {
  const buckets = new Map();
  for (const item of items || []) {
    const key = hourKey(getTime(item));
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(item);
  }
  return [...buckets.entries()]
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    .map(([hour, rows]) => ({ hour, items: rows }));
}
` +
    dualExport(
      "PartsDateAgenda",
      "{ localTodayISO, localNowHM, addDaysLocal, formatLongDate, formatTimeLabel, hourKey, dueLabel, dueDateForWhen, defaultComposerTime, groupByHour }"
    )
);

writePart(
  "tpl.mustache",
  {
    kind: "util",
    title: "Mustache-lite fill",
    summary: "Replace {{field}} placeholders in templates — contracts, mail merge, prompts.",
    tags: ["template", "contracts", "mustache"],
    usage: "const { fillTemplate } = require('./parts/tpl.mustache');",
  },
  `/**
 * Portable {{field}} template fill: from Contracts.
 */

function fillTemplate(text, fieldValues, { blankOptional = false } = {}) {
  return String(text ?? "").replace(/\\{\\{(\\w+)\\}\\}/g, (_, key) => {
    const v = fieldValues?.[key];
    if (v == null || v === "") return blankOptional ? "" : "________________________";
    return String(v);
  });
}

function isClauseBodyEmpty(body) {
  const t = String(body ?? "")
    .trim()
    .replace(/_{3,}/g, "")
    .replace(/\\s+/g, " ");
  return !t;
}

function renderClauses(clauses, fieldValues) {
  return (Array.isArray(clauses) ? clauses : [])
    .map((c) => ({
      ...c,
      body: fillTemplate(c.body, fieldValues, { blankOptional: Boolean(c.optional) }),
    }))
    .filter((c) => !c.optional || !isClauseBodyEmpty(c.body));
}
` + dualExport("PartsTplMustache", "{ fillTemplate, isClauseBodyEmpty, renderClauses }")
);

writePart(
  "astro.physics",
  {
    kind: "util",
    title: "Orbital & astrophysics (SI)",
    summary:
      "Orbital/escape velocity, rocket Δv, light time, Schwarzschild radius, Kepler period, Hohmann transfer: SI units with body constants.",
    tags: ["space", "physics", "astronomy"],
    usage: "const { orbitalVelocity, hohmannDeltaV, BODIES } = require('./parts/astro.physics');",
  },
  fs.readFileSync(path.join(ROOT, "scripts", "_astro-body.js"), "utf8")
);

writePart(
  "time.when",
  {
    kind: "util",
    title: "Activity timestamps",
    summary: "Human timestamps: Today/Yesterday + time, or short date: for feeds and activity logs.",
    tags: ["time", "drift", "activity"],
    usage: "const { formatWhen, relativeTime } = require('./parts/time.when');",
  },
  `/**
 * Portable activity time labels: from Drift (+ relative).
 */

function formatWhen(iso, now = new Date()) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const n = now instanceof Date ? now : new Date(now);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === n.toDateString()) return "Today " + time;
  const yesterday = new Date(n);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday " + time;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " + time;
}

function relativeTime(iso, now = Date.now()) {
  const t = typeof iso === "number" ? iso : Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const delta = Math.max(0, Number(now) - t);
  const sec = Math.floor(delta / 1000);
  if (sec < 45) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return min + "m ago";
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + "h ago";
  const day = Math.floor(hr / 24);
  if (day < 7) return day + "d ago";
  return formatWhen(iso, new Date(now));
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
` + dualExport("PartsTimeWhen", "{ formatWhen, relativeTime, debounce }")
);

writePart(
  "bytes.format",
  {
    kind: "util",
    title: "Human byte sizes",
    summary: "Format byte counts as B / KB / MB / GB / TB for file browsers and system panels.",
    tags: ["files", "bytes", "format"],
    usage: "const { formatBytes } = require('./parts/bytes.format');",
  },
  `/**
 * Portable byte size formatter.
 */

function formatBytes(n, digits = 1) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return "—";
  if (v < 1024) return Math.round(v) + " B";
  const units = ["KB", "MB", "GB", "TB", "PB"];
  let x = v;
  let i = -1;
  do {
    x /= 1024;
    i += 1;
  } while (x >= 1024 && i < units.length - 1);
  const fixed = x >= 10 || digits === 0 ? x.toFixed(0) : x.toFixed(digits);
  return fixed + " " + units[i];
}
` + dualExport("PartsBytesFormat", "{ formatBytes }")
);

writePart(
  "chat.drafts",
  {
    kind: "util",
    title: "Conversation draft store",
    summary:
      "Keyed draft map with injectable storage (sessionStorage/localStorage). Debounce-friendly for chat composers.",
    tags: ["chat", "draft", "storage"],
    usage: "const { DraftStore } = require('./parts/chat.drafts');",
  },
  `/**
 * Portable draft store: from Mind Chat pattern.
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

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
` + dualExport("PartsChatDrafts", "{ DraftStore, debounce }")
);

writePart(
  "coupons.expiry",
  {
    kind: "util",
    title: "Expiry urgency",
    summary: "Classify ISO expiry dates as ok / soon / expired for wallets and reminders.",
    tags: ["date", "coupons", "expiry"],
    usage: "const { expiryState } = require('./parts/coupons.expiry');",
  },
  `/**
 * Portable expiry classifier — from Coupons.
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
` + dualExport("PartsCouponsExpiry", "{ expiryState }")
);

{
  const src = fs.readFileSync(path.join(APPS, "translate", "lib", "languages.js"), "utf8");
  const code =
    src.replace(
      /if \(typeof module !== "undefined" && module\.exports\) \{[\s\S]*\}$/,
      `const api = { LANGUAGES, PHRASE_CATEGORIES, getLanguage, targetLanguages };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") {
  window.PartsLangCatalog = api;
  window.TranslateLangs = api;
}
`
    );
  writePart(
    "lang.catalog",
    {
      kind: "data",
      title: "Language catalog",
      summary: "100+ BCP-47 language codes with English + native names, plus helpers for translate UIs.",
      tags: ["i18n", "translate", "languages"],
      usage: "const { LANGUAGES, getLanguage } = require('./parts/lang.catalog');",
    },
    code
  );
}

cleanWeakStubs();

writeCredit("stocks", [
  { ref: "finance.ohlc", note: "OHLC indicators used in analysis views" },
  { ref: "money.format", note: "Money / pct / volume formatters" },
]);
writeCredit("world-clock", [
  { ref: "clock.tz", note: "Timezone formatting & civil time parts" },
  { ref: "clock.meeting", note: "Meeting slot scoring engine" },
]);
writeCredit("study-deck", [{ ref: "cards.srs", note: "Spaced repetition scheduler" }]);
writeCredit("builds", [
  { ref: "files.kind", note: "Filename → kind classifier" },
  { ref: "path.tree", note: "Relative path tree helpers" },
]);
writeCredit("day-planner", [{ ref: "date.agenda", note: "Local agenda date/hour helpers" }]);
writeCredit("contracts", [{ ref: "tpl.mustache", note: "{{field}} template fill" }]);
writeCredit("space", [{ ref: "astro.physics", note: "Orbital / astrophysics SI calculators" }]);
writeCredit("drift", [{ ref: "time.when", note: "Activity timestamp labels" }]);
writeCredit("files", [{ ref: "bytes.format", note: "Human byte sizes" }]);
writeCredit("system-info", [{ ref: "bytes.format", note: "Disk / RAM size labels" }]);
writeCredit("chat", [{ ref: "chat.drafts", note: "Composer draft store pattern" }]);
writeCredit("coupons", [{ ref: "coupons.expiry", note: "Expiry urgency classifier" }]);
writeCredit("translate", [{ ref: "lang.catalog", note: "Language list + helpers" }]);
writeCredit("geography", [
  { ref: "geo.codes", note: "Country name / ISO resolve" },
  { ref: "search.fuzzy", note: "Country list filtering" },
]);
writeCredit("icon-library", [
  { ref: "search.fuzzy", note: "Icon search ranking" },
  { ref: "ui.omnibox", note: "Search field pattern" },
]);
writeCredit("docs", [
  { ref: "ui.omnibox", note: "Handbook search pattern" },
  { ref: "search.fuzzy", note: "Text ranking helper" },
]);
writeCredit("notes", [{ ref: "search.fuzzy", note: "Recommended for note search" }]);

console.log("\\nDone. Shared forge rebuilt with real modules.");