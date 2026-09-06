const path = require("path");
const fs = require("fs");
const { app, nativeImage } = require("electron");

const ROOT = path.join(__dirname, "..", "..");
const SELF_ID = "apps-info";

function userData() {
  return app.getPath("userData");
}

function readJsonSafe(file, fallback = null) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function statFile(file) {
  try {
    if (!fs.existsSync(file)) return null;
    const st = fs.statSync(file);
    return {
      path: file,
      name: path.basename(file),
      bytes: st.size,
      sizeLabel: formatBytes(st.size),
      modifiedAt: st.mtime.toISOString(),
      createdAt: st.birthtime?.toISOString?.() || null,
    };
  } catch {
    return null;
  }
}

function formatBytes(n) {
  const v = Number(n) || 0;
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  if (v < 1024 * 1024 * 1024) return `${(v / (1024 * 1024)).toFixed(1)} MB`;
  return `${(v / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function fmtWhen(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

function pushEvent(events, { at, title, detail, kind, meta }) {
  if (!at && !title) return;
  events.push({
    at: at || null,
    atLabel: at ? fmtWhen(at) : null,
    title: String(title || "").trim(),
    detail: String(detail || "").trim(),
    kind: kind || "activity",
    meta: meta || null,
  });
}

function sortEvents(events) {
  return events
    .filter((e) => e.title)
    .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")))
    .slice(0, 80);
}

function loadMergedConfig() {
  const defaults = readJsonSafe(path.join(ROOT, "config", "apps.json"), { apps: [] });
  const userPath = app.isPackaged
    ? path.join(userData(), "user-config.json")
    : path.join(ROOT, "config", "user-config.json");
  const user = readJsonSafe(userPath, {});
  const userApps = Array.isArray(user?.apps) ? user.apps : [];
  const defaultApps = Array.isArray(defaults?.apps) ? defaults.apps : [];
  const removed = new Set(Array.isArray(user?.removedAppIds) ? user.removedAppIds : []);
  const known = new Set(userApps.map((a) => a.id));
  const apps = [...userApps];
  for (const a of defaultApps) {
    if (known.has(a.id) || removed.has(a.id)) continue;
    apps.push(a);
  }
  return { ...defaults, ...user, apps, userPath, paletteRecents: user?.paletteRecents || [] };
}

function expandEnv(target) {
  return String(target || "").replace(/%([^%]+)%/g, (_, name) => process.env[name] || `%${name}%`);
}

function resolveExe(appEntry) {
  const candidates = []
    .concat(appEntry.paths || [])
    .concat(appEntry.path ? [appEntry.path] : []);
  for (const c of candidates) {
    const full = expandEnv(c);
    if (full && fs.existsSync(full)) return full;
  }
  return candidates[0] ? expandEnv(candidates[0]) : null;
}

function getFileIconDataUrl(exePath) {
  try {
    if (!exePath || !fs.existsSync(exePath)) return null;
    return nativeImage.createFromPath(exePath).toDataURL();
  } catch {
    return null;
  }
}

function resolveIcon(appEntry) {
  if (appEntry.iconData) return appEntry.iconData;
  if (appEntry.iconUrl) return appEntry.iconUrl;
  if (appEntry.iconPath) {
    const full = path.join(ROOT, appEntry.iconPath);
    if (fs.existsSync(full)) {
      try {
        return nativeImage.createFromPath(full).toDataURL();
      } catch {
      }
    }
  }
  if (appEntry.type === "external") {
    const exe = resolveExe(appEntry);
    const icon = getFileIconDataUrl(exe);
    if (icon) return icon;
  }
  if (appEntry.type === "url" && appEntry.url) {
    try {
      const host = new URL(appEntry.url).hostname;
      return `https://www.google.com/s2/favicons?domain=${host}&sz=128`;
    } catch {
    }
  }
  return null;
}

const { APP_PROFILES, SERVICE_PROFILES, SERVICE_TO_APP } = require("./apps-info-profiles");

function moduleSourceStats(moduleId) {
  const dir = path.join(ROOT, "apps", moduleId);
  if (!fs.existsSync(dir)) return null;
  const files = [];
  function walk(d, depth) {
    if (depth > 3) return;
    let entries = [];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (ent.name === "node_modules" || ent.name === ".git") continue;
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) walk(full, depth + 1);
      else {
        try {
          const st = fs.statSync(full);
          files.push({
            rel: path.relative(dir, full).replace(/\\/g, "/"),
            bytes: st.size,
            modifiedAt: st.mtime.toISOString(),
          });
        } catch {
        }
      }
    }
  }
  walk(dir, 0);
  files.sort((a, b) => a.rel.localeCompare(b.rel));
  const totalBytes = files.reduce((s, f) => s + f.bytes, 0);
  return {
    dir,
    fileCount: files.length,
    totalBytes,
    sizeLabel: formatBytes(totalBytes),
    files: files.slice(0, 60),
  };
}

function paletteHitsFor(appId, paletteRecents) {
  return (paletteRecents || [])
    .filter((r) => r?.appId === appId)
    .map((r) => ({
      at: r.at ? new Date(r.at).toISOString() : null,
      title: r.title || appId,
      subtitle: r.subtitle || "",
      route: r.route || null,
    }))
    .slice(0, 20);
}

function driftEventsForApp(appId, moduleId) {
  const drift = readJsonSafe(path.join(userData(), "drift.json"), null);
  const events = Array.isArray(drift?.events) ? drift.events : [];
  const needles = [appId, moduleId, `apps\\${moduleId}`, `apps/${moduleId}`]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());
  const hits = [];
  for (const e of events) {
    const hay = `${e.title || ""} ${e.summary || ""} ${e.path || ""}`.toLowerCase();
    if (needles.some((n) => n && hay.includes(n))) {
      hits.push({
        at: e.at || null,
        title: e.title || e.typeLabel || e.type,
        detail: e.summary || e.path || "",
        kind: e.type || "drift",
      });
    }
    if (hits.length >= 40) break;
  }
  return hits;
}

function collectStorageFiles(keys) {
  const out = [];
  for (const key of keys || []) {
    const full = path.join(userData(), key);
    if (key.endsWith("/") || key.endsWith("\\")) {
      try {
        if (!fs.existsSync(full)) continue;
        const st = fs.statSync(full);
        out.push({
          path: full,
          name: key.replace(/[\\/]+$/, ""),
          bytes: null,
          sizeLabel: "folder",
          modifiedAt: st.mtime.toISOString(),
          kind: "folder",
        });
        const kids = fs.readdirSync(full).slice(0, 20);
        for (const kid of kids) {
          const kidStat = statFile(path.join(full, kid));
          if (kidStat) out.push({ ...kidStat, kind: "file" });
        }
      } catch {
      }
      continue;
    }
    const st = statFile(full);
    if (st) out.push({ ...st, kind: "file" });
  }
  return out;
}

function digestDayPlanner() {
  const data = readJsonSafe(path.join(userData(), "day-planner.json"), { tasks: [] });
  const tasks = Array.isArray(data.tasks) ? data.tasks : [];
  const stats = {
    total: tasks.length,
    done: tasks.filter((t) => t.done).length,
    open: tasks.filter((t) => !t.done).length,
    withNotify: tasks.filter((t) => t.notify).length,
  };
  const events = [];
  for (const t of tasks) {
    if (t.doneAt) {
      pushEvent(events, {
        at: t.doneAt,
        title: `Completed: ${t.title}`,
        detail: [t.dueDate, t.dueTime].filter(Boolean).join(" "),
        kind: "done",
      });
    }
    if (t.notifiedAt) {
      pushEvent(events, {
        at: typeof t.notifiedAt === "string" && t.notifiedAt.includes("T")
          ? t.notifiedAt
          : `${t.dueDate || ""}T${String(t.notifiedAt).includes(":") ? t.notifiedAt : "00:00"}:00`,
        title: `Reminder fired: ${t.title}`,
        detail: String(t.notifiedAt),
        kind: "notify",
      });
    }
    pushEvent(events, {
      at: t.updatedAt || t.createdAt,
      title: `Task: ${t.title}`,
      detail: [
        t.done ? "done" : "open",
        t.priority && t.priority !== "normal" ? `priority ${t.priority}` : null,
        t.dueDate ? `due ${t.dueDate}${t.dueTime ? " " + t.dueTime : ""}` : null,
        t.notes || null,
      ]
        .filter(Boolean)
        .join(" · "),
      kind: "task",
    });
  }
  return { stats, events: sortEvents(events), highlights: tasks.slice(0, 12).map((t) => ({
    label: t.title,
    value: t.done ? "done" : [t.dueDate, t.dueTime].filter(Boolean).join(" ") || "open",
  })) };
}

function digestStudyDeck() {
  const data = readJsonSafe(path.join(userData(), "study-deck.json"), { decks: [] });
  const decks = Array.isArray(data.decks) ? data.decks : [];
  let cards = 0;
  let reps = 0;
  let lapses = 0;
  const events = [];
  const highlights = [];
  for (const d of decks) {
    const list = Array.isArray(d.cards) ? d.cards : [];
    cards += list.length;
    highlights.push({ label: d.name || "Deck", value: `${list.length} cards` });
    pushEvent(events, {
      at: d.updatedAt || d.createdAt,
      title: `Deck: ${d.name || "Untitled"}`,
      detail: `${list.length} cards`,
      kind: "deck",
    });
    for (const c of list) {
      reps += Number(c.reps) || 0;
      lapses += Number(c.lapses) || 0;
      if (c.updatedAt || c.createdAt) {
        pushEvent(events, {
          at: c.updatedAt || c.createdAt,
          title: `Card studied / updated`,
          detail: `${(c.front || c.question || "").slice(0, 80)} · reps ${c.reps || 0}`,
          kind: "card",
        });
      }
    }
  }
  return {
    stats: { decks: decks.length, cards, reps, lapses },
    events: sortEvents(events),
    highlights,
  };
}

function digestStudies() {
  const data = readJsonSafe(path.join(userData(), "studies.json"), {});
  const docs = Array.isArray(data.documents) ? data.documents : [];
  const subjects = Array.isArray(data.subjects) ? data.subjects : [];
  const events = [];
  for (const d of docs) {
    pushEvent(events, {
      at: d.updatedAt || d.createdAt,
      title: `Document: ${d.title || "Untitled"}`,
      detail: [
        d.template ? `template ${d.template}` : null,
        d.pinned ? "pinned" : null,
        Array.isArray(d.tags) && d.tags.length ? `tags: ${d.tags.join(", ")}` : null,
        d.createdAt && d.updatedAt && d.createdAt !== d.updatedAt
          ? `created ${fmtWhen(d.createdAt)}`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
      kind: "document",
    });
  }
  return {
    stats: { documents: docs.length, subjects: subjects.length },
    events: sortEvents(events),
    highlights: docs.slice(0, 12).map((d) => ({
      label: d.title || "Untitled",
      value: fmtWhen(d.updatedAt || d.createdAt) || "",
    })),
  };
}

function digestStocks() {
  const data = readJsonSafe(path.join(userData(), "stocks.json"), {});
  const watchlists = Array.isArray(data.watchlists)
    ? data.watchlists
    : data.watchlists && typeof data.watchlists === "object"
      ? Object.values(data.watchlists)
      : [];
  const holdings = Array.isArray(data.holdings)
    ? data.holdings
    : data.holdings && typeof data.holdings === "object"
      ? Object.values(data.holdings)
      : [];
  const alerts = Array.isArray(data.alerts) ? data.alerts : [];
  const buyList = Array.isArray(data.buyList) ? data.buyList : [];
  const analysis = data.analysisCache && typeof data.analysisCache === "object" ? data.analysisCache : {};
  const analysisKeys = Object.keys(analysis);
  const events = [];
  for (const a of alerts) {
    pushEvent(events, {
      at: a.triggeredAt || a.updatedAt || a.createdAt || a.addedAt,
      title: a.triggeredAt ? `Alert triggered: ${a.symbol || a.id}` : `Alert: ${a.symbol || a.id}`,
      detail: [a.condition || a.op, a.price != null ? `price ${a.price}` : null].filter(Boolean).join(" · "),
      kind: "alert",
    });
  }
  for (const b of buyList) {
    pushEvent(events, {
      at: b.completedAt || b.addedAt || b.createdAt,
      title: b.done || b.completed ? `Buy-list done: ${b.symbol}` : `Buy-list: ${b.symbol}`,
      detail: b.note || b.notes || "",
      kind: "buy",
    });
  }
  for (const key of analysisKeys) {
    const a = analysis[key];
    pushEvent(events, {
      at: a?.generatedAt || a?.updatedAt,
      title: `AI Analysis: ${a?.symbol || key}`,
      detail: a?.snapshot?.oneLiner || a?.lang || "",
      kind: "ai",
    });
  }
  let symbolCount = 0;
  for (const wl of watchlists) {
    if (Array.isArray(wl?.symbols)) symbolCount += wl.symbols.length;
    else if (Array.isArray(wl)) symbolCount += wl.length;
  }
  if (!symbolCount && Array.isArray(data.symbols)) symbolCount = data.symbols.length;

  return {
    stats: {
      watchlists: watchlists.length || (data.watchlists ? 1 : 0),
      symbols: symbolCount,
      holdings: holdings.length,
      alerts: alerts.length,
      buyList: buyList.length,
      aiAnalyses: analysisKeys.length,
    },
    events: sortEvents(events),
    highlights: [
      ...analysisKeys.slice(0, 8).map((k) => ({
        label: `AI · ${analysis[k]?.symbol || k}`,
        value: analysis[k]?.snapshot?.oneLiner || fmtWhen(analysis[k]?.generatedAt) || "",
      })),
      ...buyList.slice(0, 6).map((b) => ({
        label: `Buy · ${b.symbol}`,
        value: b.done || b.completed ? "done" : fmtWhen(b.addedAt) || "open",
      })),
    ],
  };
}

function digestTranslate() {
  const data = readJsonSafe(path.join(userData(), "translate.json"), {});
  const history = Array.isArray(data.history) ? data.history : [];
  const events = history.map((h) => ({
    at: h.createdAt || null,
    atLabel: fmtWhen(h.createdAt),
    title: `${h.source || ""} → ${h.translation || ""}`.trim(),
    detail: `${h.from || "?"} → ${h.to || "?"} · ${h.provider || "provider?"}${h.favorite ? " · favorite" : ""}`,
    kind: "translate",
  }));
  return {
    stats: {
      history: history.length,
      favorites: history.filter((h) => h.favorite).length,
      recentPairs: Array.isArray(data.recentPairs) ? data.recentPairs.length : 0,
    },
    events: sortEvents(events),
    highlights: history.slice(0, 10).map((h) => ({
      label: String(h.source || "").slice(0, 40),
      value: String(h.translation || "").slice(0, 40),
    })),
  };
}

function digestContracts() {
  const data = readJsonSafe(path.join(userData(), "contracts.json"), {});
  const contracts = Array.isArray(data.contracts) ? data.contracts : [];
  const events = [];
  for (const c of contracts) {
    pushEvent(events, {
      at: c.updatedAt || c.createdAt,
      title: `Contract: ${c.title || c.templateId || c.id}`,
      detail: `status ${c.status || "?"} · signatures ${(c.signatures || []).length}`,
      kind: "contract",
    });
    for (const s of c.signatures || []) {
      pushEvent(events, {
        at: s.signedAt,
        title: `Signed: ${c.title || c.id}`,
        detail: s.name || s.role || "",
        kind: "signature",
      });
    }
    if (c.expiryNotifiedAt) {
      pushEvent(events, {
        at: c.expiryNotifiedAt,
        title: `Expiry notice: ${c.title || c.id}`,
        detail: c.expiryDate || "",
        kind: "notify",
      });
    }
  }
  return {
    stats: {
      contracts: contracts.length,
      signed: contracts.filter((c) => (c.signatures || []).length).length,
      drafts: contracts.filter((c) => c.status === "draft").length,
    },
    events: sortEvents(events),
    highlights: contracts.map((c) => ({
      label: c.title || c.id,
      value: `${c.status || "?"} · ${(c.signatures || []).length} sig`,
    })),
  };
}

function digestBuilds() {
  const data = readJsonSafe(path.join(userData(), "builds.json"), {});
  const projects = Array.isArray(data.projects) ? data.projects : [];
  const categories = Array.isArray(data.categories) ? data.categories : [];
  const events = [];
  for (const p of projects) {
    pushEvent(events, {
      at: p.updatedAt || p.createdAt || p.refreshedAt,
      title: `Project: ${p.name || p.title || p.id}`,
      detail: [
        p.stack ? `stack ${Array.isArray(p.stack) ? p.stack.join(", ") : p.stack}` : null,
        p.categoryId || p.category || null,
        p.path || null,
      ]
        .filter(Boolean)
        .join(" · "),
      kind: "project",
    });
  }
  return {
    stats: { projects: projects.length, categories: categories.length },
    events: sortEvents(events),
    highlights: projects.slice(0, 12).map((p) => ({
      label: p.name || p.title || p.id,
      value: fmtWhen(p.updatedAt || p.createdAt) || "",
    })),
  };
}

function digestDrift() {
  const data = readJsonSafe(path.join(userData(), "drift.json"), {});
  const eventsRaw = Array.isArray(data.events) ? data.events : [];
  const zones = Array.isArray(data.zones) ? data.zones : [];
  const byType = {};
  for (const e of eventsRaw) {
    byType[e.type || "other"] = (byType[e.type || "other"] || 0) + 1;
  }
  const events = eventsRaw.slice(0, 60).map((e) => ({
    at: e.at || null,
    atLabel: fmtWhen(e.at),
    title: e.title || e.typeLabel || e.type,
    detail: e.summary || e.path || e.zoneLabel || "",
    kind: e.type || "drift",
  }));
  return {
    stats: {
      events: eventsRaw.length,
      zones: zones.length,
      lastScanAt: data.settings?.lastScanAt || zones.map((z) => z.lastScannedAt).filter(Boolean).sort().slice(-1)[0] || null,
      types: byType,
    },
    events: sortEvents(events),
    highlights: Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([k, v]) => ({ label: k, value: String(v) })),
  };
}

function digestShell() {
  const data = readJsonSafe(path.join(userData(), "shell-engine.json"), null);
  if (!data) {
    const st = statFile(path.join(userData(), "shell-engine.json"));
    return {
      stats: { history: 0, note: st ? "History file present but unreadable (may be truncated)" : "No history yet" },
      events: [],
      highlights: st ? [{ label: "shell-engine.json", value: st.sizeLabel }] : [],
    };
  }
  const history = Array.isArray(data.history) ? data.history : [];
  const events = history.slice(0, 80).map((h) => ({
    at: h.at || null,
    atLabel: fmtWhen(h.at),
    title: h.line || "(empty command)",
    detail: `${h.ok === false ? "failed" : "ok"}${h.message ? " · " + String(h.message).slice(0, 120) : ""}${h.source ? " · " + h.source : ""}`,
    kind: h.ok === false ? "error" : "command",
  }));
  return {
    stats: {
      history: history.length,
      aliases: Array.isArray(data.aliases) ? data.aliases.length : Object.keys(data.aliases || {}).length,
      macros: Array.isArray(data.macros) ? data.macros.length : 0,
      rules: Array.isArray(data.rules) || Array.isArray(data.when) ? (data.rules || data.when || []).length : 0,
    },
    events: sortEvents(events),
    highlights: history.slice(0, 10).map((h) => ({
      label: String(h.line || "").slice(0, 48),
      value: h.ok === false ? "fail" : "ok",
    })),
  };
}

function digestWorldClock() {
  const data = readJsonSafe(path.join(userData(), "world-clock.json"), {});
  const favorites = Array.isArray(data.favorites) ? data.favorites : [];
  return {
    stats: {
      favorites: favorites.length,
      pomodoroSessions: data.pomodoro?.sessionsCompleted || data.pomodoro?.completed || null,
      timerRunning: Boolean(data.timer?.running),
      stopwatchRunning: Boolean(data.stopwatch?.running),
    },
    events: favorites.map((f) => ({
      at: null,
      atLabel: null,
      title: `Favorite clock: ${f.label || f.city || f.tz || f.id}`,
      detail: f.tz || f.timezone || "",
      kind: "favorite",
    })),
    highlights: favorites.slice(0, 10).map((f) => ({
      label: f.label || f.city || f.tz,
      value: f.tz || f.timezone || "",
    })),
  };
}

function digestRemoteHub() {
  const data = readJsonSafe(path.join(userData(), "remote-hub.json"), {});
  const machines = Array.isArray(data.machines) ? data.machines : [];
  const events = [];
  for (const m of machines) {
    pushEvent(events, {
      at: m.lastChecked || m.lastOnline || m.updatedAt,
      title: `Machine: ${m.name || m.host || m.id}`,
      detail: [
        m.host,
        m.lastLatencyMs != null ? `${m.lastLatencyMs} ms` : null,
        m.lastOnline ? `online ${fmtWhen(m.lastOnline)}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      kind: "machine",
    });
  }
  return {
    stats: { machines: machines.length },
    events: sortEvents(events),
    highlights: machines.map((m) => ({
      label: m.name || m.host,
      value: m.lastLatencyMs != null ? `${m.lastLatencyMs} ms` : m.host || "",
    })),
  };
}

function digestSpace() {
  const data = readJsonSafe(path.join(userData(), "space.json"), {});
  const logbook = Array.isArray(data.logbook) ? data.logbook : [];
  const apod = readJsonSafe(path.join(userData(), "space-apod-cache.json"), null);
  const events = logbook.map((e) => ({
    at: e.createdAt || e.at || null,
    atLabel: fmtWhen(e.createdAt || e.at),
    title: e.title || e.object || e.name || "Log entry",
    detail: [e.category, e.notes].filter(Boolean).join(" · "),
    kind: "log",
  }));
  if (apod) {
    pushEvent(events, {
      at: apod.cachedAt || apod.date || null,
      title: `APOD: ${apod.title || apod.date || "cached"}`,
      detail: String(apod.explanation || "").slice(0, 160),
      kind: "apod",
    });
  }
  return {
    stats: {
      logbook: logbook.length,
      oceanCells: data.ocean?.explored?.length || data.ocean?.cells || null,
      hasApodCache: Boolean(apod),
    },
    events: sortEvents(events),
    highlights: logbook.slice(0, 10).map((e) => ({
      label: e.title || e.object || "entry",
      value: fmtWhen(e.createdAt) || "",
    })),
  };
}

function digestFlagQuiz() {
  const data = readJsonSafe(path.join(userData(), "flag-quiz-scores.json"), null);
  const scores = Array.isArray(data) ? data : Array.isArray(data?.scores) ? data.scores : [];
  const events = scores.map((s) => ({
    at: s.at || null,
    atLabel: fmtWhen(s.at),
    title: `Score ${s.score}/${s.total} (${s.pct != null ? s.pct : Math.round(((s.score || 0) / (s.total || 1)) * 100)}%)`,
    detail: s.mode || s.game || "",
    kind: "score",
  }));
  return {
    stats: {
      gamesRecorded: scores.length,
      bestPct: scores.reduce((m, s) => Math.max(m, Number(s.pct) || ((s.score || 0) / (s.total || 1)) * 100), 0) || null,
    },
    events: sortEvents(events),
    highlights: scores.slice(0, 10).map((s) => ({
      label: `${s.score}/${s.total}`,
      value: fmtWhen(s.at) || "",
    })),
  };
}

function digestGeography() {
  const data = readJsonSafe(path.join(userData(), "geography.json"), {});
  const travel = Array.isArray(data.travel) ? data.travel : Array.isArray(data.visits) ? data.visits : [];
  const events = travel.map((t) => ({
    at: t.visitedAt || t.date || t.updatedAt || t.createdAt || null,
    atLabel: fmtWhen(t.visitedAt || t.date || t.updatedAt || t.createdAt),
    title: `Travel: ${t.country || t.name || t.code || t.id}`,
    detail: [t.city, t.notes, t.rating != null ? `rating ${t.rating}` : null, t.favorite ? "favorite" : null]
      .filter(Boolean)
      .join(" · "),
    kind: "travel",
  }));
  return {
    stats: {
      travelEntries: travel.length,
      favorites: travel.filter((t) => t.favorite).length,
      hasCountryCache: fs.existsSync(path.join(userData(), "geography-countries-cache.json")),
    },
    events: sortEvents(events),
    highlights: travel.slice(0, 10).map((t) => ({
      label: t.country || t.name || t.code,
      value: t.city || fmtWhen(t.visitedAt || t.date) || "",
    })),
  };
}

function digestHistoryApp() {
  const data = readJsonSafe(path.join(userData(), "history.json"), {});
  const bookmarks = Array.isArray(data.bookmarks) ? data.bookmarks : [];
  const cache = statFile(path.join(userData(), "history-cache.json"));
  const events = bookmarks.map((b) => ({
    at: b.createdAt || null,
    atLabel: fmtWhen(b.createdAt),
    title: `Bookmark: ${b.title || b.name || b.id}`,
    detail: b.notes || b.type || "",
    kind: "bookmark",
  }));
  return {
    stats: {
      bookmarks: bookmarks.length,
      cacheSize: cache?.sizeLabel || null,
      cacheModified: cache?.modifiedAt || null,
    },
    events: sortEvents(events),
    highlights: bookmarks.slice(0, 10).map((b) => ({
      label: b.title || b.name,
      value: fmtWhen(b.createdAt) || "",
    })),
  };
}

function digestContacts() {
  const data = readJsonSafe(path.join(userData(), "contacts.json"), {});
  const contacts = Array.isArray(data.contacts) ? data.contacts : [];
  const groups = Array.isArray(data.groups) ? data.groups : [];
  const events = [];
  for (const c of contacts) {
    pushEvent(events, {
      at: c.updatedAt || c.createdAt,
      title: `Contact: ${c.name || c.fullName || c.id}`,
      detail: [c.email, c.phone, c.birthday].filter(Boolean).join(" · "),
      kind: "contact",
    });
    if (c.lastTriggered) {
      pushEvent(events, {
        at: c.lastTriggered,
        title: `Reminder: ${c.name || c.id}`,
        detail: "notification triggered",
        kind: "notify",
      });
    }
  }
  return {
    stats: { contacts: contacts.length, groups: groups.length },
    events: sortEvents(events),
    highlights: contacts.slice(0, 12).map((c) => ({
      label: c.name || c.fullName || c.id,
      value: c.email || c.phone || "",
    })),
  };
}

function digestProfiles() {
  const profiles = readJsonSafe(path.join(userData(), "profiles.json"), {});
  const list = Array.isArray(profiles.profiles) ? profiles.profiles : Array.isArray(profiles) ? profiles : [];
  const vault = statFile(path.join(userData(), "vault.json"));
  const events = list.map((p) => ({
    at: p.updatedAt || p.createdAt || null,
    atLabel: fmtWhen(p.updatedAt || p.createdAt),
    title: `Profile: ${p.name || p.label || p.id}`,
    detail: "metadata only — secrets never shown",
    kind: "profile",
  }));
  return {
    stats: {
      profiles: list.length,
      vaultPresent: Boolean(vault),
      vaultSize: vault?.sizeLabel || null,
      vaultModified: vault?.modifiedAt || null,
    },
    events: sortEvents(events),
    highlights: [
      ...list.slice(0, 8).map((p) => ({ label: p.name || p.id, value: fmtWhen(p.updatedAt) || "" })),
      vault ? { label: "Encrypted vault", value: vault.sizeLabel } : null,
    ].filter(Boolean),
  };
}

function digestSystemInfo() {
  const metrics = readJsonSafe(path.join(userData(), "system-info-metrics.json"), null);
  const points = Array.isArray(metrics) ? metrics : Array.isArray(metrics?.points) ? metrics.points : [];
  const last = points[points.length - 1];
  return {
    stats: {
      samples: points.length,
      lastCpu: last?.cpu ?? null,
      lastMemory: last?.memory ?? null,
      lastDisk: last?.disk ?? null,
      lastSampleAt: last?.t ? new Date(last.t).toISOString() : null,
    },
    events: points.slice(-30).reverse().map((p) => ({
      at: p.t ? new Date(p.t).toISOString() : null,
      atLabel: p.t ? fmtWhen(new Date(p.t).toISOString()) : null,
      title: `Sample CPU ${p.cpu ?? "—"}% · RAM ${p.memory ?? "—"}% · Disk ${p.disk ?? "—"}%`,
      detail: "",
      kind: "metric",
    })),
    highlights: last
      ? [
          { label: "CPU", value: `${last.cpu ?? "—"}%` },
          { label: "Memory", value: `${last.memory ?? "—"}%` },
          { label: "Disk", value: `${last.disk ?? "—"}%` },
        ]
      : [{ label: "Metrics", value: "No samples yet" }],
  };
}

function worldMapsRoot() {
  try {
    const { getWorldMapsAccountsRoot } = require("./world-maps-ipc");
    return getWorldMapsAccountsRoot();
  } catch {
    return path.join(userData(), "world-maps");
  }
}

function loadWorldMapsUsers() {
  const root = worldMapsRoot();
  const store = readJsonSafe(path.join(root, "users.json"), { users: [] });
  const session = readJsonSafe(path.join(root, "session.json"), null);
  const users = Array.isArray(store?.users) ? store.users : [];
  return users.map((u) => {
    const dir = path.join(root, "users", u.id);
    const notesData = readJsonSafe(path.join(dir, "notes.json"), { notes: [] });
    const routesData = readJsonSafe(path.join(dir, "routes.json"), { routes: [] });
    const settings = readJsonSafe(path.join(dir, "settings.json"), {});
    const notes = Array.isArray(notesData?.notes) ? notesData.notes : [];
    const routes = Array.isArray(routesData?.routes) ? routesData.routes : [];
    return {
      id: u.id,
      username: u.username,
      createdAt: u.createdAt || null,
      active: session?.userId === u.id,
      notes,
      routes,
      settings: settings && typeof settings === "object" ? settings : {},
      dir,
    };
  });
}

function digestWorldMaps() {
  const accounts = loadWorldMapsUsers();
  const notesTotal = accounts.reduce((n, a) => n + a.notes.length, 0);
  const routesTotal = accounts.reduce((n, a) => n + a.routes.length, 0);
  const events = [];
  for (const a of accounts) {
    pushEvent(events, {
      at: a.createdAt,
      title: `Account created: ${a.username}`,
      detail: a.id,
      kind: "account",
    });
    for (const note of a.notes) {
      pushEvent(events, {
        at: note.createdAt || note.updatedAt,
        title: `Note · ${a.username}: ${note.title || note.category || note.id}`,
        detail: [note.category, note.address, note.lat != null ? `${note.lat}, ${note.lng}` : null]
          .filter(Boolean)
          .join(" · "),
        kind: "note",
      });
    }
    for (const route of a.routes) {
      pushEvent(events, {
        at: route.createdAt || route.updatedAt,
        title: `Route · ${a.username}: ${route.label || route.mode || route.id}`,
        detail: [
          route.mode,
          route.duration,
          Array.isArray(route.waypoints) ? `${route.waypoints.length} waypoints` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        kind: "route",
      });
    }
  }
  return {
    stats: {
      accounts: accounts.length,
      notes: notesTotal,
      routes: routesTotal,
      activeUser: accounts.find((a) => a.active)?.username || null,
    },
    events: sortEvents(events),
    highlights: accounts.map((a) => ({
      label: a.username + (a.active ? " (active)" : ""),
      value: `${a.notes.length} notes · ${a.routes.length} routes`,
    })),
  };
}

function item(title, detail, at) {
  return {
    title: String(title || "").trim(),
    detail: detail != null ? String(detail).trim() : "",
    at: at ? fmtWhen(at) || String(at) : null,
  };
}

function singleMyProfile(live, opts = {}) {
  const sections = [];
  if (opts.sections) sections.push(...opts.sections);
  if (live?.highlights?.length) {
    sections.push({
      title: "Highlights",
      items: live.highlights.map((h) => item(h.label, h.value)),
    });
  }
  if (live?.events?.length) {
    sections.push({
      title: "Recent activity",
      items: live.events.slice(0, 40).map((e) => item(e.title, e.detail, e.at)),
    });
  }
  return {
    multiUser: false,
    title: "Profiles",
    subtitle: "No separate accounts in this app — this is your data",
    profiles: [
      {
        id: "me",
        name: opts.name || "My data",
        badge: "you",
        createdAt: null,
        createdAtLabel: null,
        stats: live?.stats || {},
        sections: sections.filter((s) => s.items?.length),
      },
    ],
  };
}

function profilesWorldMaps(live) {
  const accounts = loadWorldMapsUsers();
  if (!accounts.length) {
    return singleMyProfile(live, { name: "My data (no accounts yet)" });
  }
  return {
    multiUser: true,
    title: "Profiles",
    subtitle: `${accounts.length} World Maps account${accounts.length === 1 ? "" : "s"} — open one to see notes & routes`,
    profiles: accounts.map((a) => ({
      id: a.id,
      name: a.username,
      badge: a.active ? "active" : "account",
      createdAt: a.createdAt,
      createdAtLabel: fmtWhen(a.createdAt),
      stats: {
        notes: a.notes.length,
        routes: a.routes.length,
        settingsKeys: Object.keys(a.settings || {}).length,
      },
      sections: [
        {
          title: "Notes",
          items: a.notes.map((n) =>
            item(
              n.title || n.category || n.id,
              [n.category, n.address, n.lat != null ? `${n.lat}, ${n.lng}` : null, n.text || n.body || n.notes]
                .filter(Boolean)
                .join(" · ")
                .slice(0, 240),
              n.createdAt || n.updatedAt
            )
          ),
        },
        {
          title: "Routes",
          items: a.routes.map((r) =>
            item(
              r.label || r.mode || r.id,
              [
                r.mode,
                r.duration,
                Array.isArray(r.waypoints) ? `${r.waypoints.length} waypoints` : null,
                Array.isArray(r.waypoints)
                  ? r.waypoints
                      .map((w) => w.name || `${w.lat},${w.lng}`)
                      .filter(Boolean)
                      .slice(0, 4)
                      .join(" → ")
                  : null,
              ]
                .filter(Boolean)
                .join(" · "),
              r.createdAt || r.updatedAt
            )
          ),
        },
        {
          title: "Settings",
          items: Object.entries(a.settings || {})
            .slice(0, 30)
            .map(([k, v]) =>
              item(k, typeof v === "object" ? JSON.stringify(v).slice(0, 160) : String(v))
            ),
        },
      ].filter((s) => s.items.length),
    })),
  };
}

function profilesVaultApp(live) {
  const data = readJsonSafe(path.join(userData(), "profiles.json"), {});
  const list = Array.isArray(data.profiles) ? data.profiles : [];
  const vault = statFile(path.join(userData(), "vault.json"));
  if (!list.length) {
    return singleMyProfile(live, {
      name: "My data",
      sections: vault
        ? [
            {
              title: "Encrypted vault",
              items: [item("vault.json", `${vault.sizeLabel} · secrets never shown`, vault.modifiedAt)],
            },
          ]
        : [],
    });
  }
  return {
    multiUser: true,
    title: "Profiles",
    subtitle: `${list.length} saved identity profile${list.length === 1 ? "" : "s"} (passwords never shown)`,
    profiles: list.map((p) => ({
      id: p.id,
      name: p.name || p.id,
      badge: p.favorite ? "favorite" : "profile",
      createdAt: p.createdAt || null,
      createdAtLabel: fmtWhen(p.createdAt),
      stats: {
        links: Array.isArray(p.links) ? p.links.length : 0,
        fields: Array.isArray(p.fields) ? p.fields.length : 0,
        tags: Array.isArray(p.tags) ? p.tags.length : 0,
      },
      sections: [
        {
          title: "About",
          items: [
            p.description ? item("Description", p.description) : null,
            p.categoryId ? item("Category", p.categoryId) : null,
            p.localPath ? item("Local path", p.localPath) : null,
            p.notes ? item("Notes", p.notes) : null,
            p.updatedAt ? item("Updated", fmtWhen(p.updatedAt)) : null,
          ].filter(Boolean),
        },
        {
          title: "Links",
          items: (p.links || []).map((l) => item(l.label || "Link", l.url)),
        },
        {
          title: "Fields",
          items: (p.fields || []).map((f) => item(f.key, f.value)),
        },
        {
          title: "Tags",
          items: (p.tags || []).map((t) => item(t, "")),
        },
      ].filter((s) => s.items.length),
    })),
  };
}

function profilesStocks(live) {
  const data = readJsonSafe(path.join(userData(), "stocks.json"), {});
  const sections = [];
  const buyList = Array.isArray(data.buyList) ? data.buyList : [];
  const alerts = Array.isArray(data.alerts) ? data.alerts : [];
  const analysis = data.analysisCache && typeof data.analysisCache === "object" ? data.analysisCache : {};
  if (buyList.length) {
    sections.push({
      title: "Buy list",
      items: buyList.map((b) =>
        item(b.symbol, [b.done || b.completed ? "done" : "open", b.note || b.notes].filter(Boolean).join(" · "), b.addedAt)
      ),
    });
  }
  if (alerts.length) {
    sections.push({
      title: "Alerts",
      items: alerts.map((a) =>
        item(a.symbol || a.id, [a.condition || a.op, a.price != null ? String(a.price) : null].filter(Boolean).join(" "), a.triggeredAt || a.createdAt)
      ),
    });
  }
  const aKeys = Object.keys(analysis);
  if (aKeys.length) {
    sections.push({
      title: "AI analyses",
      items: aKeys.map((k) =>
        item(analysis[k]?.symbol || k, analysis[k]?.snapshot?.oneLiner || analysis[k]?.lang || "", analysis[k]?.generatedAt)
      ),
    });
  }
  return singleMyProfile(live, { name: "My data", sections });
}

function profilesStudies(live) {
  const data = readJsonSafe(path.join(userData(), "studies.json"), {});
  const docs = Array.isArray(data.documents) ? data.documents : [];
  return singleMyProfile(live, {
    name: "My data",
    sections: [
      {
        title: "Documents",
        items: docs.map((d) =>
          item(d.title || "Untitled", [d.template, d.pinned ? "pinned" : null].filter(Boolean).join(" · "), d.updatedAt || d.createdAt)
        ),
      },
    ],
  });
}

function profilesDayPlanner(live) {
  const data = readJsonSafe(path.join(userData(), "day-planner.json"), { tasks: [] });
  const tasks = Array.isArray(data.tasks) ? data.tasks : [];
  return singleMyProfile(live, {
    name: "My data",
    sections: [
      {
        title: "Tasks",
        items: tasks.map((t) =>
          item(
            t.title,
            [t.done ? "done" : "open", t.dueDate, t.dueTime, t.priority !== "normal" ? t.priority : null, t.notes]
              .filter(Boolean)
              .join(" · "),
            t.updatedAt || t.createdAt
          )
        ),
      },
    ],
  });
}

function profilesStudyDeck(live) {
  const data = readJsonSafe(path.join(userData(), "study-deck.json"), { decks: [] });
  const decks = Array.isArray(data.decks) ? data.decks : [];
  return singleMyProfile(live, {
    name: "My data",
    sections: decks.map((d) => ({
      title: `Deck: ${d.name || "Untitled"}`,
      items: (d.cards || []).slice(0, 40).map((c) =>
        item(
          String(c.front || c.question || "").slice(0, 80) || "card",
          `reps ${c.reps || 0} · lapses ${c.lapses || 0}`,
          c.updatedAt || c.createdAt
        )
      ),
    })),
  });
}

function profilesTranslate(live) {
  const data = readJsonSafe(path.join(userData(), "translate.json"), {});
  const history = Array.isArray(data.history) ? data.history : [];
  return singleMyProfile(live, {
    name: "My data",
    sections: [
      {
        title: "Translation history",
        items: history.map((h) =>
          item(`${h.source} → ${h.translation}`, `${h.from} → ${h.to} · ${h.provider || ""}`, h.createdAt)
        ),
      },
    ],
  });
}

function profilesContacts(live) {
  const data = readJsonSafe(path.join(userData(), "contacts.json"), {});
  const contacts = Array.isArray(data.contacts) ? data.contacts : [];
  return singleMyProfile(live, {
    name: "My data",
    sections: [
      {
        title: "Contacts",
        items: contacts.map((c) =>
          item(c.name || c.fullName || c.id, [c.email, c.phone, c.birthday].filter(Boolean).join(" · "), c.updatedAt || c.createdAt)
        ),
      },
    ],
  });
}

function profilesContracts(live) {
  const data = readJsonSafe(path.join(userData(), "contracts.json"), {});
  const contracts = Array.isArray(data.contracts) ? data.contracts : [];
  return singleMyProfile(live, {
    name: "My data",
    sections: [
      {
        title: "Contracts",
        items: contracts.map((c) =>
          item(
            c.title || c.id,
            `status ${c.status || "?"} · signatures ${(c.signatures || []).length}`,
            c.updatedAt || c.createdAt
          )
        ),
      },
    ],
  });
}

function profilesBuilds(live) {
  const data = readJsonSafe(path.join(userData(), "builds.json"), {});
  const projects = Array.isArray(data.projects) ? data.projects : [];
  return singleMyProfile(live, {
    name: "My data",
    sections: [
      {
        title: "Projects",
        items: projects.map((p) =>
          item(p.name || p.title || p.id, p.path || (Array.isArray(p.stack) ? p.stack.join(", ") : p.stack) || "", p.updatedAt || p.createdAt)
        ),
      },
    ],
  });
}

function profilesRemoteHub(live) {
  const data = readJsonSafe(path.join(userData(), "remote-hub.json"), {});
  const machines = Array.isArray(data.machines) ? data.machines : [];
  return singleMyProfile(live, {
    name: "My data",
    sections: [
      {
        title: "Machines",
        items: machines.map((m) =>
          item(m.name || m.host || m.id, [m.host, m.lastLatencyMs != null ? `${m.lastLatencyMs} ms` : null].filter(Boolean).join(" · "), m.lastChecked || m.lastOnline)
        ),
      },
    ],
  });
}

function profilesGeography(live) {
  const data = readJsonSafe(path.join(userData(), "geography.json"), {});
  const travel = Array.isArray(data.travel) ? data.travel : Array.isArray(data.visits) ? data.visits : [];
  return singleMyProfile(live, {
    name: "My data",
    sections: [
      {
        title: "Travel log",
        items: travel.map((t) =>
          item(t.country || t.name || t.code || t.id, [t.city, t.notes, t.rating != null ? `rating ${t.rating}` : null].filter(Boolean).join(" · "), t.visitedAt || t.date)
        ),
      },
    ],
  });
}

function profilesSpace(live) {
  const data = readJsonSafe(path.join(userData(), "space.json"), {});
  const logbook = Array.isArray(data.logbook) ? data.logbook : [];
  return singleMyProfile(live, {
    name: "My data",
    sections: [
      {
        title: "Logbook",
        items: logbook.map((e) => item(e.title || e.object || e.name || "entry", [e.category, e.notes].filter(Boolean).join(" · "), e.createdAt || e.at)),
      },
    ],
  });
}

function profilesHistoryApp(live) {
  const data = readJsonSafe(path.join(userData(), "history.json"), {});
  const bookmarks = Array.isArray(data.bookmarks) ? data.bookmarks : [];
  return singleMyProfile(live, {
    name: "My data",
    sections: [
      {
        title: "Bookmarks",
        items: bookmarks.map((b) => item(b.title || b.name || b.id, b.notes || b.type || "", b.createdAt)),
      },
    ],
  });
}

function profilesFlagQuiz(live) {
  const data = readJsonSafe(path.join(userData(), "flag-quiz-scores.json"), null);
  const scores = Array.isArray(data) ? data : Array.isArray(data?.scores) ? data.scores : [];
  return singleMyProfile(live, {
    name: "My data",
    sections: [
      {
        title: "Scores",
        items: scores.map((s) =>
          item(`${s.score}/${s.total}`, s.mode || s.game || (s.pct != null ? `${s.pct}%` : ""), s.at)
        ),
      },
    ],
  });
}

function profilesShell(live) {
  const data = readJsonSafe(path.join(userData(), "shell-engine.json"), null);
  const history = Array.isArray(data?.history) ? data.history : [];
  return singleMyProfile(live, {
    name: "My data",
    sections: [
      {
        title: "Command history",
        items: history.slice(0, 60).map((h) =>
          item(h.line || "(empty)", `${h.ok === false ? "failed" : "ok"}${h.message ? " · " + String(h.message).slice(0, 100) : ""}`, h.at)
        ),
      },
    ],
  });
}

function profilesDrift(live) {
  return singleMyProfile(live, { name: "My data" });
}

function profilesWorldClock(live) {
  const data = readJsonSafe(path.join(userData(), "world-clock.json"), {});
  const favorites = Array.isArray(data.favorites) ? data.favorites : [];
  return singleMyProfile(live, {
    name: "My data",
    sections: [
      {
        title: "Favorite clocks",
        items: favorites.map((f) => item(f.label || f.city || f.tz || f.id, f.tz || f.timezone || "")),
      },
    ],
  });
}

const PROFILE_BUILDERS = {
  "world-maps": profilesWorldMaps,
  profiles: profilesVaultApp,
  stocks: profilesStocks,
  studies: profilesStudies,
  "day-planner": profilesDayPlanner,
  "study-deck": profilesStudyDeck,
  translate: profilesTranslate,
  contacts: profilesContacts,
  contracts: profilesContracts,
  builds: profilesBuilds,
  "remote-hub": profilesRemoteHub,
  geography: profilesGeography,
  space: profilesSpace,
  history: profilesHistoryApp,
  "flag-quiz": profilesFlagQuiz,
  "shell-console": profilesShell,
  drift: profilesDrift,
  "world-clock": profilesWorldClock,
};

function buildProfilesView(appId, live) {
  const builder = PROFILE_BUILDERS[appId];
  if (builder) return builder(live);
  return singleMyProfile(live);
}

function digestCodeLexicon() {
  const user = readJsonSafe(path.join(userData(), "code-lexicon.json"), {});
  const bundled = statFile(path.join(ROOT, "data", "code-lexicon.json"));
  return {
    stats: {
      lastCategory: user.lastCategory || user.category || null,
      bundledSize: bundled?.sizeLabel || null,
    },
    events: [],
    highlights: [
      bundled ? { label: "Bundled lexicon", value: bundled.sizeLabel } : null,
      user.lastCategory ? { label: "Last category", value: String(user.lastCategory) } : null,
    ].filter(Boolean),
  };
}

const DIGESTERS = {
  "day-planner": digestDayPlanner,
  "study-deck": digestStudyDeck,
  studies: digestStudies,
  stocks: digestStocks,
  translate: digestTranslate,
  contracts: digestContracts,
  builds: digestBuilds,
  drift: digestDrift,
  "shell-console": digestShell,
  "world-clock": digestWorldClock,
  "remote-hub": digestRemoteHub,
  space: digestSpace,
  "flag-quiz": digestFlagQuiz,
  geography: digestGeography,
  history: digestHistoryApp,
  contacts: digestContacts,
  profiles: digestProfiles,
  "system-info": digestSystemInfo,
  "world-maps": digestWorldMaps,
  "code-lexicon": digestCodeLexicon,
};

function typeLabel(type, kind) {
  if (kind === "platform" || type === "platform") return "Platform service";
  if (type === "myapp") return "My Space app";
  if (type === "builtin") return "Built-in shell";
  if (type === "external") return "External program";
  if (type === "url") return "Web URL";
  return type || "unknown";
}

function loadPlatformServices() {
  return readJsonSafe(path.join(ROOT, "config", "platform-services.json"), { services: [] });
}

function atomIconData(mark) {
  const file = path.join(ROOT, "src", "brand", `${mark || "atom-white"}.png`);
  if (!fs.existsSync(file)) return null;
  try {
    return nativeImage.createFromPath(file).toDataURL();
  } catch {
    return null;
  }
}

function resolveProfile(appId, serviceId) {
  const fromApp = appId ? APP_PROFILES[appId] : null;
  const fromSvc = serviceId ? SERVICE_PROFILES[serviceId] || APP_PROFILES[SERVICE_TO_APP[serviceId]] : null;
  const base = fromApp || fromSvc || {};
  return {
    tagline: base.tagline || "",
    about: base.about || "",
    features: base.features || [],
    pages: base.pages || [],
    storageKeys: base.storageKeys || [],
  };
}

function catalogItemFromApp(a, { platform = false, serviceId = null, serviceMeta = null } = {}) {
  const moduleId = a.module || a.id;
  const profile = resolveProfile(a.id, serviceId);
  if (serviceMeta?.tagline && !profile.tagline) profile.tagline = serviceMeta.tagline;
  if (serviceMeta?.summary && !profile.about) profile.about = serviceMeta.summary;
  if (serviceMeta?.surfaces?.length && !profile.pages?.length) {
    profile.pages = serviceMeta.surfaces.map((s) => s.label || s.id);
  }
  const storage = collectStorageFiles(profile.storageKeys || []);
  const newest = storage
    .map((s) => s.modifiedAt)
    .filter(Boolean)
    .sort()
    .slice(-1)[0];
  const kind = platform || a.hidden ? "platform" : a.type === "external" || a.type === "url" ? "external" : "app";
  return {
    id: a.id,
    name: a.name || a.id,
    type: platform ? "platform" : a.type,
    typeLabel: typeLabel(platform ? "platform" : a.type, kind),
    kind,
    icon: a.icon || "◆",
    iconData: resolveIcon(a) || (platform ? atomIconData(serviceMeta?.mark || "atom-white") : null),
    description: a.description || profile.about || "",
    tagline: profile.tagline || a.description || "",
    module: moduleId,
    serviceId: serviceId || null,
    series: serviceMeta?.series || null,
    seriesLabel: serviceMeta?.seriesLabel || null,
    lastDataAt: newest || null,
    lastDataLabel: newest ? fmtWhen(newest) : null,
    hidden: !!a.hidden,
  };
}

function catalogItemFromServiceOnly(svc) {
  const profile = resolveProfile(null, svc.id);
  const pages =
    profile.pages?.length > 0
      ? profile.pages
      : (svc.surfaces || []).map((s) => s.label || s.id);
  const about = profile.about || svc.summary || "";
  const tagline = profile.tagline || svc.tagline || "";
  return {
    id: `svc:${svc.id}`,
    name: svc.name || svc.id,
    type: "platform",
    typeLabel: "Platform service",
    kind: "platform",
    icon: "⬡",
    iconData: atomIconData(svc.mark || "atom-white"),
    description: about,
    tagline,
    module: null,
    serviceId: svc.id,
    series: svc.series || null,
    seriesLabel: svc.seriesLabel || null,
    lastDataAt: null,
    lastDataLabel: null,
    hidden: true,
    serviceOnly: true,
  };
}

async function listCatalog() {
  const cfg = loadMergedConfig();
  const platformDoc = loadPlatformServices();
  const services = Array.isArray(platformDoc?.services) ? platformDoc.services : [];
  const appsById = new Map((cfg.apps || []).filter((a) => a?.id).map((a) => [a.id, a]));

  const coveredAppIds = new Set();
  const items = [];

  for (const svc of services) {
    if (!svc?.id) continue;
    const appId = SERVICE_TO_APP[svc.id] || (appsById.has(svc.id) ? svc.id : null);
    if (appId && appsById.has(appId)) {
      coveredAppIds.add(appId);
      items.push(
        catalogItemFromApp(appsById.get(appId), {
          platform: true,
          serviceId: svc.id,
          serviceMeta: svc,
        })
      );
      continue;
    }
    const curated = SERVICE_PROFILES[svc.id] || APP_PROFILES[svc.id];
    items.push(
      catalogItemFromServiceOnly({
        ...svc,
        tagline: curated?.tagline || svc.tagline,
        summary: curated?.about || svc.summary,
      })
    );
  }

  for (const a of cfg.apps || []) {
    if (!a?.id || coveredAppIds.has(a.id)) continue;
    const isPlatformish = !!a.hidden;
    items.push(
      catalogItemFromApp(a, {
        platform: isPlatformish,
        serviceId: null,
        serviceMeta: isPlatformish ? { mark: "atom-white" } : null,
      })
    );
  }

  const apps = items.length;
  const platformCount = items.filter((i) => i.kind === "platform").length;
  const desktopCount = items.filter((i) => i.kind === "app").length;
  const externalCount = items.filter((i) => i.kind === "external").length;

  return {
    ok: true,
    apps: items,
    count: apps,
    counts: {
      all: apps,
      platform: platformCount,
      app: desktopCount,
      external: externalCount,
    },
    generatedAt: new Date().toISOString(),
  };
}

async function getDetail(args) {
  const rawId = String(args?.id || "").trim();
  if (!rawId) return { ok: false, error: "App id required" };

  const cfg = loadMergedConfig();
  const platformDoc = loadPlatformServices();
  const services = Array.isArray(platformDoc?.services) ? platformDoc.services : [];

  let serviceOnly = false;
  let serviceId = null;
  let entry = null;
  let svcMeta = null;

  if (rawId.startsWith("svc:")) {
    serviceOnly = true;
    serviceId = rawId.slice(4);
    svcMeta = services.find((s) => s.id === serviceId) || null;
    if (!svcMeta && !SERVICE_PROFILES[serviceId]) {
      return { ok: false, error: "Service not found" };
    }
  } else {
    entry = (cfg.apps || []).find((a) => a.id === rawId);
    if (!entry) {
      const mapped = SERVICE_TO_APP[rawId];
      if (mapped) entry = (cfg.apps || []).find((a) => a.id === mapped);
      svcMeta = services.find((s) => s.id === rawId) || null;
      if (svcMeta) serviceId = rawId;
    } else {
      svcMeta =
        services.find((s) => SERVICE_TO_APP[s.id] === entry.id || s.id === entry.id) || null;
      if (svcMeta) serviceId = svcMeta.id;
    }
    if (!entry && !svcMeta) return { ok: false, error: "App not found" };
    if (!entry && svcMeta) {
      serviceOnly = true;
      serviceId = svcMeta.id;
    }
  }

  if (serviceOnly) {
    const profile = resolveProfile(SERVICE_TO_APP[serviceId] || null, serviceId);
    if (svcMeta?.surfaces?.length && !profile.pages?.length) {
      profile.pages = svcMeta.surfaces.map((s) => s.label || s.id);
    }
    if (!profile.about && svcMeta?.summary) profile.about = svcMeta.summary;
    if (!profile.tagline && svcMeta?.tagline) profile.tagline = svcMeta.tagline;

    return {
      ok: true,
      app: {
        id: `svc:${serviceId}`,
        name: svcMeta?.name || serviceId,
        type: "platform",
        typeLabel: "Platform service",
        kind: "platform",
        icon: "⬡",
        iconData: atomIconData(svcMeta?.mark || "atom-white"),
        description: profile.about || "",
        module: null,
        url: null,
        paths: [],
        exePath: null,
        exeExists: null,
        serviceId,
        series: svcMeta?.series || null,
      },
      profile: {
        tagline: profile.tagline || "",
        about: profile.about || "",
        features: profile.features || [],
        pages: profile.pages || [],
      },
      live: { stats: {}, highlights: [] },
      profilesView: null,
      timeline: [],
      storage: collectStorageFiles(profile.storageKeys || []),
      source: null,
      palette: [],
      driftRelated: 0,
      generatedAt: new Date().toISOString(),
    };
  }

  const id = entry.id;
  const moduleId = entry.module || entry.id;
  let profile = resolveProfile(id, serviceId);
  if (svcMeta?.surfaces?.length && !(APP_PROFILES[id]?.pages?.length)) {
    profile = {
      ...profile,
      pages: svcMeta.surfaces.map((s) => s.label || s.id),
    };
  }
  if (!profile.about) {
    profile.about =
      entry.description || "No extended profile yet — showing live data where available.";
  }

  const live = DIGESTERS[id] ? DIGESTERS[id]() : { stats: {}, events: [], highlights: [] };
  const profilesView = buildProfilesView(id, live);
  const storage = collectStorageFiles(profile.storageKeys || []);
  const source = entry.type === "myapp" || entry.type === "builtin" ? moduleSourceStats(moduleId) : null;
  const palette = paletteHitsFor(id, cfg.paletteRecents);
  const driftHits = driftEventsForApp(id, moduleId);

  const timeline = sortEvents([
    ...(live.events || []),
    ...palette.map((p) => ({
      at: p.at,
      atLabel: fmtWhen(p.at),
      title: `Opened via command palette: ${p.title}`,
      detail: p.subtitle || p.route || "",
      kind: "palette",
    })),
    ...driftHits.map((d) => ({
      at: d.at,
      atLabel: fmtWhen(d.at),
      title: d.title,
      detail: d.detail,
      kind: "drift",
    })),
    ...storage
      .filter((s) => s.modifiedAt)
      .map((s) => ({
        at: s.modifiedAt,
        atLabel: fmtWhen(s.modifiedAt),
        title: `Storage updated: ${s.name}`,
        detail: s.sizeLabel || "",
        kind: "storage",
      })),
  ]);

  const exePath = entry.type === "external" ? resolveExe(entry) : null;
  const kind =
    entry.hidden || serviceId
      ? "platform"
      : entry.type === "external" || entry.type === "url"
        ? "external"
        : "app";

  return {
    ok: true,
    app: {
      id: entry.id,
      name: entry.name || entry.id,
      type: kind === "platform" ? "platform" : entry.type,
      typeLabel: typeLabel(kind === "platform" ? "platform" : entry.type, kind),
      kind,
      icon: entry.icon || "◆",
      iconData: resolveIcon(entry) || (kind === "platform" ? atomIconData("atom-white") : null),
      description: entry.description || "",
      module: moduleId,
      url: entry.url || null,
      paths: entry.paths || (entry.path ? [entry.path] : []),
      exePath,
      exeExists: exePath ? fs.existsSync(exePath) : null,
      serviceId: serviceId || null,
      series: svcMeta?.series || null,
    },
    profile: {
      tagline: profile.tagline || "",
      about: profile.about || "",
      features: profile.features || [],
      pages: profile.pages || [],
    },
    live: {
      stats: live.stats || {},
      highlights: live.highlights || [],
    },
    profilesView,
    timeline,
    storage,
    source,
    palette,
    driftRelated: driftHits.length,
    generatedAt: new Date().toISOString(),
  };
}

const CHANNELS = {
  "catalog.list": listCatalog,
  "catalog.detail": getDetail,
};

async function handleAppsInfoInvoke(channel, args) {
  const handler = CHANNELS[channel];
  if (!handler) return { ok: false, error: `Unknown channel: ${channel}` };
  try {
    return await handler(args || {});
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

module.exports = { handleAppsInfoInvoke };