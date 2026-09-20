const path = require("path");
const fs = require("fs");

const { handleDayPlannerInvoke } = require("./day-planner-ipc");
const { handleStudyDeckInvoke } = require("./study-deck-ipc");
const { handleStudiesInvoke } = require("./studies-ipc");
const { handleContactsInvoke } = require("./contacts-ipc");
const { handleContractsInvoke } = require("./contracts-ipc");
const { handleStocksInvoke } = require("./stocks-ipc");
const { handleBuildsInvoke } = require("./builds-ipc");
const { handleProfilesInvoke } = require("./profiles-ipc");
const { handleDriftInvoke } = require("./drift-ipc");
const { handleCodeLexiconInvoke } = require("./code-lexicon-ipc");
const { handleGeographyInvoke } = require("./geography-ipc");
const { handleHistoryInvoke } = require("./history-ipc");
const { handleSpaceInvoke } = require("./space-ipc");
const { handleRemoteHubInvoke } = require("./remote-hub-ipc");
const { handleShellConsoleInvoke } = require("./shell-console-ipc");
const { handleTranslateInvoke } = require("./translate-ipc");
const { handleWorldClockInvoke } = require("./world-clock-ipc");
const { handleAppsInfoInvoke } = require("./apps-info-ipc");

const MAX_RESULTS = 2500;
const BROWSER_MAX_RESULTS = 120;
const PER_SOURCE_CAP = 800;

function score(hay, q) {
  const h = String(hay || "").toLowerCase();
  if (!q) return 0;
  if (h === q) return 120;
  if (h.startsWith(q)) return 100;
  if (h.includes(q)) return 60;
  const parts = q.split(/\s+/).filter(Boolean);
  if (parts.length && parts.every((p) => h.includes(p))) return 40;
  let qi = 0;
  for (let i = 0; i < h.length && qi < q.length; i++) {
    if (h[i] === q[qi]) qi++;
  }
  if (qi === q.length && q.length >= 3) return 25;
  return 0;
}

function push(results, item) {
  if (!item?.title || !(item.rank > 0)) return;
  results.push(item);
}

function displayContactName(c) {
  if (c.displayName) return c.displayName.trim();
  const parts = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  return parts || c.name || "Unnamed";
}

function looksLikeTicker(q) {
  return /^[a-z0-9.\-^=]{1,12}$/i.test(q) && /[a-z]/i.test(q);
}

function capSource(items, n = PER_SOURCE_CAP) {
  return items.sort((a, b) => b.rank - a.rank).slice(0, n);
}

async function safe(fn) {
  try {
    return await fn();
  } catch {
    return [];
  }
}

async function searchTasks(q) {
  const out = [];
  const tasksRes = await handleDayPlannerInvoke("tasks.list", {});
  const buckets = tasksRes?.buckets || {};
  const openTasks = [
    ...(buckets.today || []),
    ...(buckets.tomorrow || []),
    ...(buckets.later || []),
    ...(buckets.done || []).slice(0, 20),
  ];
  for (const task of openTasks) {
    const hay = `${task.title || ""} ${task.notes || ""} ${task.dueDate || ""} ${task.dueTime || ""}`;
    const rank = score(hay, q);
    if (rank > 0) {
      push(out, {
        id: `task:${task.id}`,
        kind: "task",
        title: task.title,
        subtitle: `Today · ${task.dueTime || task.dueDate || "task"}`,
        icon: "📅",
        rank: rank + 10,
        appId: "day-planner",
        route: { page: task.bucket === "done" ? "done" : "today" },
      });
    }
  }
  return capSource(out, 200);
}

async function searchDecks(q) {
  const out = [];
  const decksRes = await handleStudyDeckInvoke("decks.list", {});
  for (const deck of decksRes?.decks || []) {
    const hay = `${deck.name || ""} ${deck.description || ""}`;
    const rank = score(hay, q);
    if (rank > 0) {
      push(out, {
        id: `deck:${deck.id}`,
        kind: "deck",
        title: deck.name,
        subtitle: `Study Deck · ${deck.cardCount || 0} cards`,
        icon: "🃏",
        rank: rank + 8,
        appId: "study-deck",
        route: { page: "deck", param: deck.id, action: "openDeck" },
      });
    }
  }
  return capSource(out, 400);
}

async function searchStudies(q) {
  const out = [];
  const studiesRes = await handleStudiesInvoke("storage.load", {});
  const docs = studiesRes?.documents || studiesRes?.data?.documents || [];
  for (const doc of docs) {
    const hay = `${doc.title || ""} ${(doc.tags || []).join(" ")}`;
    const rank = score(hay, q);
    if (rank > 0) {
      push(out, {
        id: `doc:${doc.id}`,
        kind: "document",
        title: doc.title || "Untitled",
        subtitle: "Studies document",
        icon: "📚",
        rank: rank + 8,
        appId: "studies",
        route: { page: "editor", param: doc.id, action: "openDocument" },
      });
    }
  }
  return capSource(out, 400);
}

async function searchContacts(q) {
  const out = [];
  const contactsRes = await handleContactsInvoke("storage.load", {});
  const data = contactsRes?.data || {};
  for (const c of data.contacts || []) {
    const name = displayContactName(c);
    const hay = [
      name,
      c.company,
      c.jobTitle,
      c.notes,
      ...(c.tags || []),
      ...(c.emails || []).map((e) => e.value),
      ...(c.phones || []).map((p) => p.value),
    ]
      .filter(Boolean)
      .join(" ");
    const rank = score(hay, q);
    if (rank > 0) {
      const bits = [c.company, c.phones?.[0]?.value, c.emails?.[0]?.value].filter(Boolean);
      push(out, {
        id: `contact:${c.id}`,
        kind: "contact",
        title: name,
        subtitle: bits.length ? `Contact · ${bits[0]}` : "Contact",
        icon: c.icon || "👤",
        rank: rank + 12,
        appId: "contacts",
        route: { page: "browse", param: c.id, action: "openContact" },
      });
    }
  }
  for (const g of data.groups || []) {
    const rank = score(`${g.name || ""} group contacts`, q);
    if (rank > 0) {
      push(out, {
        id: `contact-group:${g.id}`,
        kind: "contact-group",
        title: g.name,
        subtitle: "Contacts · group",
        icon: g.icon || "📁",
        rank: rank + 6,
        appId: "contacts",
        route: { page: "groups" },
      });
    }
  }
  return capSource(out, 200);
}

async function searchContracts(q) {
  const out = [];
  const contractsRes = await handleContractsInvoke("contracts.list", {});
  for (const c of contractsRes?.contracts || []) {
    const party =
      c.fieldValues?.party_a || c.fieldValues?.client_name || c.fieldValues?.contractor_name || "";
    const hay = `${c.title || ""} ${c.status || ""} ${party} ${c.expiryDate || ""}`;
    const rank = score(hay, q);
    if (rank > 0) {
      const when = c.expiryDate ? ` · expires ${c.expiryDate}` : "";
      push(out, {
        id: `contract:${c.id}`,
        kind: "contract",
        title: c.title || "Untitled contract",
        subtitle: `Contract · ${c.status || "draft"}${when}`,
        icon: "📄",
        rank: rank + 11,
        appId: "contracts",
        route: { page: "document", param: c.id, action: "openDocument" },
      });
    }
  }
  const templates = await handleContractsInvoke("templates.list", {});
  for (const t of templates?.templates || []) {
    const hay = `${t.title || ""} ${t.category || ""} template contract`;
    const rank = score(hay, q);
    if (rank > 0) {
      push(out, {
        id: `contract-tpl:${t.id}`,
        kind: "contract-template",
        title: t.title,
        subtitle: `Contract template · ${t.category || "general"}`,
        icon: "📝",
        rank: rank + 7,
        appId: "contracts",
        route: { page: "editor", action: "openEditor", templateId: t.id },
      });
    }
  }
  return capSource(out, 200);
}

async function searchStocks(q) {
  const out = [];
  const loaded = await handleStocksInvoke("storage.load", {});
  const data = loaded?.data || {};
  const modes = ["stocks", "metals", "forex", "crypto"];
  const seen = new Set();

  const pushSymbol = (sym, subtitle, bonus = 0, name = "") => {
    const symbol = String(sym || "").toUpperCase();
    if (!symbol || seen.has(symbol)) return;
    const hay = `${symbol} ${name}`.toLowerCase();
    const rank = score(hay, q);
    if (rank <= 0 && !hay.includes(q)) return;
    seen.add(symbol);
    push(out, {
      id: `stock:${symbol}`,
      kind: "stock",
      title: name && name !== symbol ? `${symbol} · ${name}` : symbol,
      subtitle,
      icon: "📈",
      rank: (rank || 40) + 14 + bonus,
      appId: "stocks",
      route: { action: "openStock", param: symbol },
    });
  };

  for (const mode of modes) {
    for (const sym of data.watchlists?.[mode] || []) {
      pushSymbol(sym, `Stocks · watchlist · ${mode}`, mode === (data.activeMode || "stocks") ? 2 : 0);
    }
  }
  for (const [sym, h] of Object.entries(data.holdings || {})) {
    pushSymbol(sym, `Stocks · portfolio${h?.qty != null ? ` · ${h.qty} sh` : ""}`, 4);
  }
  for (const alert of data.alerts || []) {
    const hay = `${alert.symbol || ""} ${alert.note || ""} alert`;
    const rank = score(hay, q);
    if (rank > 0) {
      const sym = String(alert.symbol || "").toUpperCase();
      push(out, {
        id: `stock-alert:${alert.id || sym}`,
        kind: "stock",
        title: `${sym} alert`,
        subtitle: alert.note ? `Stocks · ${alert.note}` : "Stocks · alert",
        icon: "🔔",
        rank: rank + 12,
        appId: "stocks",
        route: { action: "openStock", param: sym },
      });
    }
  }
  for (const item of data.buyList || []) {
    if (item.done) continue;
    const hay = `${item.symbol || ""} ${item.note || ""} buylist`;
    const rank = score(hay, q);
    if (rank > 0) {
      const sym = String(item.symbol || "").toUpperCase();
      push(out, {
        id: `stock-buy:${item.id || sym}`,
        kind: "stock",
        title: `${sym} buy list`,
        subtitle: item.note ? `Stocks · ${item.note}` : "Stocks · buy list",
        icon: "🛒",
        rank: rank + 11,
        appId: "stocks",
        route: { action: "openStock", param: sym },
      });
    }
  }

  try {
    const { searchLocalSymbols } = require("./stocks-symbols");
    const localHits = searchLocalSymbols(q, { limit: 1500, mode: "stocks" });
    for (const hit of localHits) {
      const sym = String(hit.symbol || "").toUpperCase();
      if (!sym || seen.has(sym)) continue;
      seen.add(sym);
      push(out, {
        id: `stock-cat:${sym}`,
        kind: "stock",
        title: hit.name && hit.name !== sym ? `${sym} · ${hit.name}` : sym,
        subtitle: [hit.exchange, hit.sector].filter(Boolean).join(" · ") || "Stocks · catalog",
        icon: "📈",
        rank: (hit.rank || 40) + 10,
        appId: "stocks",
        route: { action: "openStock", param: sym },
      });
    }
  } catch {
  }

  if (q.length >= 1) {
    try {
      const searchRes = await handleStocksInvoke("search", { query: q, limit: 100 });
      for (const hit of searchRes?.results || []) {
        const sym = String(hit.symbol || "").toUpperCase();
        if (!sym || seen.has(sym)) continue;
        seen.add(sym);
        push(out, {
          id: `stock-search:${sym}`,
          kind: "stock",
          title: hit.name ? `${sym} · ${hit.name}` : sym,
          subtitle: hit.exchange ? `Stocks · ${hit.exchange}` : "Stocks · search",
          icon: "📈",
          rank: score(sym.toLowerCase(), q) + 16,
          appId: "stocks",
          route: { action: "openStock", param: sym },
        });
      }
    } catch {
    }
  }

  const pages = [
    { page: "portfolio", title: "Portfolio", keywords: "portfolio holdings positions" },
    { page: "alerts", title: "Alerts", keywords: "alerts notify" },
    { page: "buylist", title: "Buy list", keywords: "buy list buylist" },
    { page: "dashboard", title: "Stocks dashboard", keywords: "stocks dashboard market" },
  ];
  for (const p of pages) {
    const rank = score(`${p.title} ${p.keywords}`, q);
    if (rank > 0) {
      push(out, {
        id: `stock-page:${p.page}`,
        kind: "stock",
        title: p.title,
        subtitle: "Stocks · page",
        icon: "📊",
        rank: rank + 6,
        appId: "stocks",
        route: { page: p.page },
      });
    }
  }
  return capSource(out, 1500);
}

async function searchBuilds(q) {
  const out = [];
  const res = await handleBuildsInvoke("projects.list", { q });
  for (const p of res?.projects || []) {
    const hay = [p.name, p.description, ...(p.stack || []), ...(p.tags || []), p.rootPath, p.repoUrl]
      .filter(Boolean)
      .join(" ");
    const rank = score(hay, q);
    if (rank > 0) {
      push(out, {
        id: `build:${p.id}`,
        kind: "build",
        title: p.name,
        subtitle: p.description || (p.stack || []).slice(0, 3).join(", ") || "Builds: project",
        icon: p.icon || "🏗️",
        rank: rank + (p.favorite ? 16 : 13),
        appId: "builds",
        route: { page: "browse", param: p.id, action: "openProject" },
      });
    }
  }
  if (score("timeline builds chronology", q) > 0) {
    push(out, {
      id: "build-page:timeline",
      kind: "build",
      title: "Builds timeline",
      subtitle: "Builds: chronological view",
      icon: "🗓️",
      rank: score("timeline builds chronology", q) + 5,
      appId: "builds",
      route: { page: "timeline" },
    });
  }
  return capSource(out, 400);
}

async function searchVault(q) {
  const out = [];
  const status = await handleProfilesInvoke("vault.status", {});
  if (!status?.unlocked) {
    if (score("vault unlock passwords secrets profiles", q) > 0) {
      push(out, {
        id: "vault:unlock",
        kind: "vault-entry",
        title: "Unlock Vault",
        subtitle: "Vault is locked: open to unlock",
        icon: "🔐",
        rank: score("vault unlock passwords secrets profiles", q) + 10,
        appId: "profiles",
        route: { page: "vault" },
      });
    }
    return out;
  }
  const list = await handleProfilesInvoke("vault.list", {});
  for (const e of list?.entries || []) {
    const hay = [e.name, e.username, e.url, e.notes, e.category, ...(e.tags || [])]
      .filter(Boolean)
      .join(" ");
    const rank = score(hay, q);
    if (rank > 0) {
      push(out, {
        id: `vault:${e.id}`,
        kind: "vault-entry",
        title: e.name || "Untitled",
        subtitle: e.username ? `Vault · ${e.username}` : e.url ? `Vault, ${e.url}` : "Vault, entry",
        icon: e.icon || "🔑",
        rank: rank + (e.favorite ? 15 : 13),
        appId: "profiles",
        route: { page: "vault", param: e.id, action: "openEntry" },
      });
    }
  }
  return capSource(out, 400);
}

async function searchDrift(q) {
  const out = [];
  const res = await handleDriftInvoke("events.list", { q, limit: 40, offset: 0, sinceDays: 90 });
  for (const e of res?.events || []) {
    const hay = [e.title, e.summary, e.path, e.typeLabel, e.zoneLabel, e.type].filter(Boolean).join(" ");
    const rank = score(hay, q);
    if (rank > 0) {
      push(out, {
        id: `drift-evt:${e.id}`,
        kind: "drift-event",
        title: e.title || "Drift event",
        subtitle: `Drift · ${e.typeLabel || e.type || "event"}${e.zoneLabel ? ` · ${e.zoneLabel}` : ""}`,
        icon: e.icon || "🌊",
        rank: rank + 10,
        appId: "drift",
        route: { page: "activity", param: e.id, action: "openEvent" },
      });
    }
  }
  const zones = await handleDriftInvoke("zones.list", {});
  for (const z of zones?.zones || []) {
    const hay = `${z.label || ""} ${z.path || ""} zone drift watch`;
    const rank = score(hay, q);
    if (rank > 0) {
      push(out, {
        id: `drift-zone:${z.id}`,
        kind: "drift-zone",
        title: z.label || z.path || "Zone",
        subtitle: z.path ? `Drift zone · ${z.path}` : "Drift: watch zone",
        icon: "📁",
        rank: rank + 8,
        appId: "drift",
        route: { page: "zones" },
      });
    }
  }
  for (const p of [
    { page: "insights", title: "Drift insights", keywords: "insights summary patterns" },
    { page: "activity", title: "Drift activity", keywords: "activity timeline events drift scan" },
  ]) {
    const rank = score(`${p.title} ${p.keywords}`, q);
    if (rank > 0) {
      push(out, {
        id: `drift-page:${p.page}`,
        kind: "drift-event",
        title: p.title,
        subtitle: "Drift: page",
        icon: "🌊",
        rank: rank + 5,
        appId: "drift",
        route: { page: p.page },
      });
    }
  }
  return capSource(out, 200);
}

async function searchLexicon(q) {
  const out = [];
  const res = await handleCodeLexiconInvoke("terms.search", { q, limit: 800 });
  for (const t of res?.terms || []) {
    const hay = `${t.term || ""} ${t.definitionPreview || ""} ${t.categoryLabel || ""} ${(t.tags || []).join(" ")}`;
    const rank = score(hay, q) || score((t.term || "").toLowerCase(), q);
    if (rank > 0 || (t.term || "").toLowerCase().includes(q)) {
      push(out, {
        id: `lexicon:${t.id}`,
        kind: "lexicon-term",
        title: t.term,
        subtitle: `Lexicon: ${t.categoryLabel || t.category || "term"}${t.level ? ` · ${t.level}` : ""}`,
        icon: "📖",
        rank: (rank || 50) + 14,
        appId: "code-lexicon",
        route: { page: "browse", param: t.id, action: "openTerm" },
      });
    }
  }
  return capSource(out, 800);
}

async function searchGeography(q) {
  const out = [];
  const res = await handleGeographyInvoke("countries.list", {});
  let matched = 0;
  for (const c of res?.countries || []) {
    if (matched >= 400) break;
    const code = c.code || c.cca2 || c.code2 || "";
    const hay = [c.name, c.officialName, c.capital, c.region, c.subregion, code, c.code3]
      .filter(Boolean)
      .join(" ");
    const rank = score(hay, q);
    if (rank > 0) {
      matched++;
      push(out, {
        id: `country:${code}`,
        kind: "country",
        title: c.name || code,
        subtitle: [c.capital, c.region, code].filter(Boolean).join(" · ") || "Geography",
        icon: "🌍",
        rank: rank + 12,
        appId: "geography",
        route: { page: "explore", param: String(code).toUpperCase(), action: "openCountry" },
      });
      if (rank >= 40) {
        push(out, {
          id: `country-learn:${code}`,
          kind: "country",
          title: `Learn: ${c.name || code}`,
          subtitle: "Geography · deep profile",
          icon: "🎓",
          rank: rank + 8,
          appId: "geography",
          route: { page: "learn", param: String(code).toUpperCase(), action: "openLearn" },
        });
      }
    }
  }
  const storage = await handleGeographyInvoke("storage.load", {});
  for (const v of storage?.data?.visited || storage?.visited || []) {
    const hay = `${v.countryName || ""} ${v.countryCode || ""} ${(v.cities || []).join(" ")} ${v.notes || ""} travel visited`;
    const rank = score(hay, q);
    if (rank > 0) {
      push(out, {
        id: `geo-visit:${v.id || v.countryCode}`,
        kind: "geo-visit",
        title: v.countryName || v.countryCode || "Visit",
        subtitle: "Geography, traveled",
        icon: "✈️",
        rank: rank + 10,
        appId: "geography",
        route: { page: "traveled" },
      });
    }
  }
  return capSource(out, 500);
}

async function searchHistory(q) {
  const out = [];
  const figures = await handleHistoryInvoke("figures.list", {});
  for (const f of figures?.figures || []) {
    const hay = `${f.name || ""} ${f.era || ""} ${f.country || ""} ${f.description || ""}`;
    const rank = score(hay, q);
    if (rank > 0) {
      push(out, {
        id: `hist-fig:${f.id}`,
        kind: "history-figure",
        title: f.name,
        subtitle: `History · figure${f.era ? ` · ${f.era}` : ""}`,
        icon: "👤",
        rank: rank + 11,
        appId: "history",
        route: { page: "figures", param: f.id, action: "openEntity", entityType: "figure" },
      });
    }
  }
  const events = await handleHistoryInvoke("events.list", {});
  for (const e of events?.events || []) {
    const hay = `${e.name || ""} ${e.year || ""} ${e.era || ""} ${e.location || ""} ${e.eventType || ""} ${e.description || ""}`;
    const rank = score(hay, q);
    if (rank > 0) {
      push(out, {
        id: `hist-evt:${e.id}`,
        kind: "history-event",
        title: e.name,
        subtitle: `History · event${e.year != null ? ` · ${e.year}` : ""}`,
        icon: "📜",
        rank: rank + 11,
        appId: "history",
        route: { page: "events", param: e.id, action: "openEntity", entityType: "event" },
      });
    }
  }
  const storage = await handleHistoryInvoke("storage.load", {});
  for (const b of storage?.data?.bookmarks || storage?.bookmarks || []) {
    const hay = `${b.name || ""} ${b.notes || ""} ${b.entityType || ""} bookmark`;
    const rank = score(hay, q);
    if (rank > 0) {
      push(out, {
        id: `hist-bm:${b.entityId || b.id}`,
        kind: "history-bookmark",
        title: b.name || "Bookmark",
        subtitle: "History · bookmark",
        icon: "⭐",
        rank: rank + 12,
        appId: "history",
        route: {
          page: b.entityType === "event" ? "events" : "figures",
          param: b.entityId,
          action: "openEntity",
          entityType: b.entityType === "event" ? "event" : "figure",
        },
      });
    }
  }
  return capSource(out, 1000);
}

async function searchSpace(q) {
  const out = [];
  const bodies = await handleSpaceInvoke("catalog.list", { q });
  for (const b of bodies?.bodies || []) {
    const hay = `${b.name || ""} ${b.description || ""} ${b.category || ""}`;
    const rank = score(hay, q) || (q && (b.name || "").toLowerCase().includes(q) ? 50 : 0);
    if (rank > 0) {
      push(out, {
        id: `space-body:${b.id}`,
        kind: "space-body",
        title: b.name,
        subtitle: `Space · ${b.category || "body"}`,
        icon: "🪐",
        rank: rank + 13,
        appId: "space",
        route: { page: "catalog", param: b.id, action: "openBody" },
      });
    }
  }
  const missions = await handleSpaceInvoke("nasa.missions.list", { q });
  for (const m of missions?.missions || []) {
    const hay = `${m.name || ""} ${m.agency || ""} ${m.target || ""} ${m.summary || ""} ${m.status || ""}`;
    const rank = score(hay, q) || (q && (m.name || "").toLowerCase().includes(q) ? 50 : 0);
    if (rank > 0) {
      push(out, {
        id: `space-mission:${m.id}`,
        kind: "space-mission",
        title: m.name,
        subtitle: `Space · mission${m.agency ? ` · ${m.agency}` : ""}`,
        icon: "🚀",
        rank: rank + 12,
        appId: "space",
        route: { page: "nasa", param: m.id, action: "openMission" },
      });
    }
  }
  const reports = await handleSpaceInvoke("nasa.reports.list", { q });
  for (const r of reports?.reports || []) {
    const hay = `${r.title || ""} ${r.summary || ""} ${(r.tags || []).join(" ")} ${r.year || ""}`;
    const rank = score(hay, q) || (q && (r.title || "").toLowerCase().includes(q) ? 50 : 0);
    if (rank > 0) {
      push(out, {
        id: `space-report:${r.id}`,
        kind: "space-report",
        title: r.title,
        subtitle: `Space · report${r.year ? ` · ${r.year}` : ""}`,
        icon: "📰",
        rank: rank + 11,
        appId: "space",
        route: { page: "reports", param: r.id, action: "openReport" },
      });
    }
  }

  try {
    const starsFile = path.join(__dirname, "..", "..", "data", "space-stars.json");
    if (fs.existsSync(starsFile)) {
      const starsData = JSON.parse(fs.readFileSync(starsFile, "utf8"));
      const stars = starsData.stars || starsData || [];
      let n = 0;
      for (const s of stars) {
        if (n >= 600) break;
        const hay = `${s.name || ""} ${s.designation || ""} ${s.constellation || ""} ${s.id || ""}`;
        const rank = score(hay, q);
        if (rank > 0) {
          n++;
          push(out, {
            id: `space-star:${s.id || s.name}`,
            kind: "space-body",
            title: s.name || s.designation || s.id,
            subtitle: `Space · star${s.constellation ? ` · ${s.constellation}` : ""}`,
            icon: "⭐",
            rank: rank + 9,
            appId: "space",
            route: { page: "catalog", param: s.id || `star_${s.name}`, action: "openBody" },
          });
        }
      }
    }
  } catch {
  }
  return capSource(out, 800);
}

async function searchRemote(q) {
  const out = [];
  const res = await handleRemoteHubInvoke("storage.load", {});
  const machines = res?.data?.machines || res?.machines || [];
  for (const m of machines) {
    const hay = [
      m.name,
      m.host,
      m.group,
      m.connectionType,
      m.notes,
      m.rdpUser,
      m.sshUser,
      m.rustdeskId,
      ...(m.tags || []),
    ]
      .filter(Boolean)
      .join(" ");
    const rank = score(hay, q);
    if (rank > 0) {
      push(out, {
        id: `remote:${m.id}`,
        kind: "remote-machine",
        title: m.name || m.host || "Machine",
        subtitle: `Remote · ${m.host || m.connectionType || "machine"}`,
        icon: "💻",
        rank: rank + (m.favorite ? 14 : 12),
        appId: "remote-hub",
        route: { page: "machines", param: m.id, action: "openMachine" },
      });
    }
  }
  return capSource(out, 200);
}

async function searchShell(q) {
  const out = [];
  const aliases = await handleShellConsoleInvoke("aliases.list", {});
  for (const a of aliases?.items || []) {
    const hay = `${a.name || ""} ${a.command || ""} alias`;
    const rank = score(hay, q);
    if (rank > 0) {
      push(out, {
        id: `shell-alias:${a.name}`,
        kind: "shell-cmd",
        title: `alias ${a.name}`,
        subtitle: a.command || "Shell alias",
        icon: "⌘",
        rank: rank + 15,
        appId: "shell-console",
        command: a.name,
      });
    }
  }
  const macros = await handleShellConsoleInvoke("macros.list", {});
  for (const m of macros?.items || []) {
    const cmds = Array.isArray(m.commands) ? m.commands.join("; ") : "";
    const hay = `${m.name || ""} ${cmds} macro`;
    const rank = score(hay, q);
    if (rank > 0) {
      push(out, {
        id: `shell-macro:${m.name}`,
        kind: "shell-cmd",
        title: `macro ${m.name}`,
        subtitle: cmds || "Shell macro",
        icon: "⌘",
        rank: rank + 14,
        appId: "shell-console",
        command: `macro ${m.name}`,
      });
    }
  }
  const when = await handleShellConsoleInvoke("when.list", {});
  for (const w of when?.items || []) {
    const hay = `${w.id || ""} ${w.trigger || ""} ${w.action || ""} when rule`;
    const rank = score(hay, q);
    if (rank > 0) {
      push(out, {
        id: `shell-when:${w.id}`,
        kind: "shell-when",
        title: w.id || "when rule",
        subtitle: `When · ${w.trigger || ""} → ${w.action || ""}`,
        icon: "⚡",
        rank: rank + 10,
        appId: "shell-console",
        route: { page: "when" },
      });
    }
  }
  return capSource(out, 200);
}

async function searchTranslate(q) {
  const out = [];
  const res = await handleTranslateInvoke("storage.load", {});
  const history = res?.data?.history || res?.history || [];
  for (const h of history) {
    const hay = `${h.source || ""} ${h.translation || ""} ${h.from || ""} ${h.to || ""}`;
    const rank = score(hay, q);
    if (rank > 0) {
      push(out, {
        id: `translation:${h.id}`,
        kind: "translation",
        title: (h.source || "").slice(0, 80) || "Translation",
        subtitle: `Translate · ${h.from || "?"} → ${h.to || "?"}${h.favorite ? " · ★" : ""}`,
        icon: "🌐",
        rank: rank + (h.favorite ? 13 : 10),
        appId: "translate",
        route: {
          page: "translate",
          param: h.source || "",
          action: "openTranslate",
          from: h.from,
          to: h.to,
        },
      });
    }
  }
  return capSource(out, 400);
}

async function searchClock(q) {
  const out = [];
  const res = await handleWorldClockInvoke("storage.load", {});
  const favs = res?.data?.favorites || res?.favorites || [];
  for (const f of favs) {
    const hay = `${f.label || ""} ${f.timezone || ""} ${f.country || ""} clock world`;
    const rank = score(hay, q);
    if (rank > 0) {
      push(out, {
        id: `clock:${f.id || f.timezone}`,
        kind: "clock-city",
        title: f.label || f.timezone || "City",
        subtitle: `Clock · ${f.timezone || "world"}`,
        icon: "🕐",
        rank: rank + 11,
        appId: "world-clock",
        route: { page: "world" },
      });
    }
  }
  for (const p of [
    { page: "pomodoro", title: "Pomodoro", keywords: "pomodoro focus tomato" },
    { page: "timer", title: "Timer", keywords: "timer countdown" },
    { page: "meetings", title: "Meetings", keywords: "meetings timezone" },
    { page: "stopwatch", title: "Stopwatch", keywords: "stopwatch" },
    { page: "world", title: "World clock", keywords: "world clock cities" },
  ]) {
    const rank = score(`${p.title} ${p.keywords}`, q);
    if (rank > 0) {
      push(out, {
        id: `clock-page:${p.page}`,
        kind: "clock-city",
        title: p.title,
        subtitle: "Clock · page",
        icon: "🕐",
        rank: rank + 6,
        appId: "world-clock",
        route: { page: p.page },
      });
    }
  }
  return capSource(out, 400);
}

async function searchAppsInfo(q) {
  const out = [];
  const res = await handleAppsInfoInvoke("catalog.list", {});
  for (const a of res?.apps || res?.items || []) {
    const hay = `${a.name || ""} ${a.description || ""} ${a.tagline || ""} ${a.id || ""} ${a.module || ""} ${a.type || ""}`;
    const rank = score(hay, q);
    if (rank > 0 && a.id && a.id !== "welcome") {
      push(out, {
        id: `app-info:${a.id}`,
        kind: "app-info",
        title: a.name || a.id,
        subtitle: a.tagline || a.description || `App · ${a.type || "myapp"}`,
        icon: a.icon || "📦",
        rank: rank + 5,
        appId: a.id,
        route: null,
        launchAppId: a.id,
      });
    }
  }

  try {
    const file = path.join(__dirname, "..", "..", "config", "recommended-apps.json");
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, "utf8"));
      const list = Array.isArray(raw) ? raw : raw.apps || raw.recommended || [];
      for (const a of list) {
        const hay = `${a.name || ""} ${a.description || ""} ${a.url || ""} recommended`;
        const rank = score(hay, q);
        if (rank > 0) {
          push(out, {
            id: `recommended:${a.id || a.name}`,
            kind: "app-info",
            title: a.name || "Recommended",
            subtitle: "Recommended · add via Start",
            icon: a.icon || "＋",
            rank: rank + 3,
            appId: "welcome",
            route: null,
            launchAppId: null,
          });
        }
      }
    }
  } catch {
  }
  return capSource(out, 100);
}

async function searchPageShortcuts(q) {
  const out = [];
  const pages = [
    { appId: "system-info", page: "cpu", title: "CPU", keywords: "cpu processor cores" },
    { appId: "system-info", page: "memory", title: "Memory", keywords: "memory ram" },
    { appId: "system-info", page: "storage", title: "Storage", keywords: "storage disk drive" },
    { appId: "system-info", page: "network", title: "Network", keywords: "network adapters wifi" },
    { appId: "system-info", page: "processes", title: "Processes", keywords: "processes task manager" },
    { appId: "flag-quiz", page: "quiz", title: "Flag Quiz", keywords: "flags quiz countries", action: "startQuiz" },
    { appId: "flag-quiz", page: "scores", title: "Flag Quiz scores", keywords: "flag scores" },
    { appId: "shell-console", page: "runner", title: "Shell runner", keywords: "shell console runner" },
    { appId: "shell-console", page: "reference", title: "Shell reference", keywords: "shell help reference" },
    { appId: "world-maps", page: "map", title: "World Maps", keywords: "maps world geography atlas" },
  ];
  for (const p of pages) {
    const rank = score(`${p.title} ${p.keywords}`, q);
    if (rank > 0) {
      push(out, {
        id: `page:${p.appId}:${p.page}`,
        kind: "page",
        title: p.title,
        subtitle: `Open · ${p.appId}`,
        icon: "↗",
        rank: rank + 4,
        appId: p.appId,
        route: { page: p.page, ...(p.action ? { action: p.action } : {}) },
      });
    }
  }
  return out;
}

async function searchConnect(q) {
  const out = [];
  let catalog = [];
  try {
    catalog = require("../mail/hub-catalog").publicCatalog() || [];
  } catch {
    return out;
  }
  for (const s of catalog) {
    if (!s?.id || s.id === "myspace-browser") continue;
    const hay = `${s.name} ${s.description || ""} ${s.categoryLabel || ""} connect ${s.category || ""}`;
    const rank = score(hay, q);
    if (rank > 0) {
      push(out, {
        id: `connect:${s.id}`,
        kind: "connect-service",
        title: s.name,
        subtitle: s.description || s.categoryLabel || "Connect",
        icon: "🔗",
        rank: rank + 12,
        serviceId: s.id,
        openUrl: s.openUrl || null,
        appId: "mail",
      });
    }
  }
  return out;
}

function normalizeSearchArgs(queryOrOpts) {
  if (queryOrOpts && typeof queryOrOpts === "object" && !Array.isArray(queryOrOpts)) {
    return {
      query: String(queryOrOpts.query || "").trim().toLowerCase(),
      mode: queryOrOpts.mode === "browser" ? "browser" : "default",
    };
  }
  return {
    query: String(queryOrOpts || "").trim().toLowerCase(),
    mode: "default",
  };
}

async function desktopSearch(queryOrOpts) {
  const { query: q, mode } = normalizeSearchArgs(queryOrOpts);
  if (!q || q.length < 2) return { ok: true, results: [], mode };

  const batches = await Promise.all([
    safe(() => searchTasks(q)),
    safe(() => searchDecks(q)),
    safe(() => searchStudies(q)),
    safe(() => searchContacts(q)),
    safe(() => searchContracts(q)),
    safe(() => searchStocks(q)),
    safe(() => searchBuilds(q)),
    safe(() => searchVault(q)),
    safe(() => searchDrift(q)),
    safe(() => searchLexicon(q)),
    safe(() => searchGeography(q)),
    safe(() => searchHistory(q)),
    safe(() => searchSpace(q)),
    safe(() => searchRemote(q)),
    safe(() => searchShell(q)),
    safe(() => searchTranslate(q)),
    safe(() => searchClock(q)),
    safe(() => searchAppsInfo(q)),
    safe(() => searchPageShortcuts(q)),
    safe(() => searchConnect(q)),
  ]);

  const results = batches.flat();
  const byId = new Map();
  for (const item of results) {
    const prev = byId.get(item.id);
    if (!prev || item.rank > prev.rank) byId.set(item.id, item);
  }

  const sorted = [...byId.values()].sort(
    (a, b) => b.rank - a.rank || String(a.title).localeCompare(String(b.title))
  );
  const limit = mode === "browser" ? BROWSER_MAX_RESULTS : MAX_RESULTS;
  return {
    ok: true,
    results: sorted.slice(0, limit),
    total: sorted.length,
    capped: sorted.length > limit,
    mode,
  };
}

module.exports = { desktopSearch };