const USER_AGENT = "MySpaceHistory/1.0 (Educational desktop app; Electron)";
const API_DELAY_MS = 2500;

const FIGURE_CATEGORIES = [
  { era: "medieval", title: "Category:12th-century_births" },
  { era: "medieval", title: "Category:13th-century_births" },
  { era: "medieval", title: "Category:14th-century_births" },
  { era: "medieval", title: "Category:15th-century_births" },
  { era: "early", title: "Category:16th-century_births" },
  { era: "early", title: "Category:17th-century_births" },
  { era: "modern", title: "Category:18th-century_births" },
  { era: "modern", title: "Category:19th-century_births" },
  { era: "twentieth", title: "Category:20th-century_births" },
  { era: "recent", title: "Category:21st-century_births" },
  { era: "ancient", title: "Category:Ancient_Roman_politicians" },
  { era: "ancient", title: "Category:Ancient_Greek_philosophers" },
  { era: "ancient", title: "Category:Pharaohs_of_the_Eighteenth_Dynasty_of_Egypt" },
  { era: "twentieth", title: "Category:Nobel_laureates" },
];

const EVENT_CATEGORIES = [
  { era: "ancient", title: "Category:Battles_of_antiquity" },
  { era: "medieval", title: "Category:Battles_of_the_Middle_Ages" },
  { era: "early", title: "Category:17th-century_conflicts" },
  { era: "modern", title: "Category:18th-century_conflicts" },
  { era: "modern", title: "Category:19th-century_conflicts" },
  { era: "twentieth", title: "Category:20th-century_conflicts" },
  { era: "twentieth", title: "Category:World_War_I" },
  { era: "twentieth", title: "Category:World_War_II" },
  { era: "recent", title: "Category:21st-century_conflicts" },
  { era: "twentieth", title: "Category:Revolutions" },
  { era: "twentieth", title: "Category:Terrorist_incidents" },
];

const FIGURE_LISTS = [
  { era: "ancient", title: "List of Roman emperors" },
  { era: "medieval", title: "List of Byzantine emperors" },
  { era: "ancient", title: "List of pharaohs" },
  { era: "ancient", title: "List of ancient Greek philosophers" },
  { era: "medieval", title: "List of popes" },
  { era: "modern", title: "List of French monarchs" },
  { era: "modern", title: "List of monarchs of England" },
  { era: "modern", title: "List of Russian rulers" },
  { era: "modern", title: "List of Ottoman sultans" },
  { era: "modern", title: "List of presidents of the United States" },
  { era: "modern", title: "List of prime ministers of the United Kingdom" },
  { era: "twentieth", title: "List of Nobel laureates" },
  { era: "twentieth", title: "List of composers" },
  { era: "twentieth", title: "List of scientists" },
  { era: "twentieth", title: "List of explorers" },
  { era: "twentieth", title: "List of inventors" },
  { era: "twentieth", title: "List of writers" },
  { era: "twentieth", title: "List of artists" },
  { era: "twentieth", title: "List of film directors" },
  { era: "twentieth", title: "List of mathematicians" },
];

const EVENT_LISTS = [
  { era: "ancient", title: "List of battles before 601" },
  { era: "medieval", title: "List of battles 601–1600" },
  { era: "modern", title: "List of wars 1800–1899" },
  { era: "twentieth", title: "List of wars 1900–1944" },
  { era: "twentieth", title: "List of wars 1945–1989" },
  { era: "twentieth", title: "List of World War I battles" },
  { era: "twentieth", title: "List of World War II battles" },
  { era: "twentieth", title: "List of revolutions and rebellions" },
  { era: "twentieth", title: "List of coups d'état and coup attempts" },
  { era: "recent", title: "List of terrorist incidents" },
  { era: "twentieth", title: "List of assassinations" },
  { era: "twentieth", title: "List of disasters" },
];

const SKIP_TITLE = /^(List of|Category:|Wikipedia:|Template:|File:|Portal:|Draft:)/i;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function wikiApi(params, retries = 6) {
  const clean = { format: "json" };
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") clean[k] = String(v);
  }
  const url = `https://en.wikipedia.org/w/api.php?${new URLSearchParams(clean)}`;
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await sleep(API_DELAY_MS);
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(90000),
      });
      if (res.status === 429 || res.status === 503) {
        const retryAfter = Number(res.headers.get("retry-after")) || 15;
        await sleep(retryAfter * 1000);
        throw new Error(`Wikipedia API ${res.status}`);
      }
      if (!res.ok) throw new Error(`Wikipedia API ${res.status}`);
      return res.json();
    } catch (err) {
      lastErr = err;
      await sleep(8000 * (attempt + 1));
    }
  }
  throw lastErr;
}

function pageToItem(p, era, type, eventType = "") {
  if (!p?.title || p.missing || p.ns !== 0) return null;
  if (SKIP_TITLE.test(p.title)) return null;
  const id = p.pageprops?.wikibase_item || `WP_${p.pageid}`;
  const name = p.title.replace(/_/g, " ");
  const base = {
    id,
    name,
    era,
    description: p.description || "",
    image: p.thumbnail?.source || "",
    wikiTitle: p.title,
  };
  if (type === "event") {
    return {
      ...base,
      type: "event",
      date: "",
      year: null,
      location: "",
      eventType: eventType || "Historical event",
    };
  }
  return {
    ...base,
    type: "figure",
    birth: "",
    death: "",
    birthYear: null,
    deathYear: null,
    occupation: "",
    country: "",
  };
}

async function fetchCategoryBatch(cmtitle, era, type, limit = 500) {
  const items = [];
  let gcmcontinue;
  const eventType = type === "event" ? cmtitle.replace("Category:", "").replace(/_/g, " ") : "";
  while (items.length < limit) {
    const params = {
      action: "query",
      generator: "categorymembers",
      gcmtitle: cmtitle,
      gcmnamespace: "0",
      gcmlimit: String(Math.min(500, limit - items.length)),
      prop: "pageprops|pageimages|description",
      piprop: "thumbnail",
      pithumbsize: "400",
      ppprop: "wikibase_item",
    };
    if (gcmcontinue) params.gcmcontinue = gcmcontinue;
    const data = await wikiApi(params);
    for (const p of Object.values(data.query?.pages || {})) {
      const item = pageToItem(p, era, type, eventType);
      if (item) items.push(item);
    }
    gcmcontinue = data.continue?.gcmcontinue;
    if (!gcmcontinue) break;
  }
  return items;
}

async function fetchListPageLinks(title, limit = 400) {
  const titles = new Set();
  let plcontinue;
  while (titles.size < limit) {
    const params = {
      action: "query",
      titles: title,
      prop: "links",
      plnamespace: "0",
      pllimit: "500",
    };
    if (plcontinue) params.plcontinue = plcontinue;
    const data = await wikiApi(params);
    const page = Object.values(data.query?.pages || {})[0];
    if (!page || page.missing) break;
    for (const link of page.links || []) {
      if (link.ns === 0 && !SKIP_TITLE.test(link.title)) titles.add(link.title);
    }
    plcontinue = data.continue?.plcontinue;
    if (!plcontinue) break;
  }
  return [...titles].slice(0, limit);
}

async function enrichTitles(titles, era, type, eventType = "") {
  const items = [];
  for (let i = 0; i < titles.length; i += 50) {
    const chunk = titles.slice(i, i + 50);
    const data = await wikiApi({
      action: "query",
      titles: chunk.join("|"),
      prop: "pageprops|pageimages|description",
      piprop: "thumbnail",
      pithumbsize: "400",
      ppprop: "wikibase_item",
    });
    for (const p of Object.values(data.query?.pages || {})) {
      const item = pageToItem(p, era, type, eventType);
      if (item) items.push(item);
    }
  }
  return items;
}

function dedupeById(items) {
  const map = new Map();
  for (const item of items) {
    if (!item?.id) continue;
    if (!map.has(item.id)) map.set(item.id, item);
  }
  return [...map.values()];
}

function mergeItems(existing, incoming) {
  return dedupeById([...(existing || []), ...incoming]);
}

function sourceKey(src) {
  return `${src.kind}:${src.title}`;
}

async function buildWikiSeed(onProgress, onError, onSave, existing = null, progressState = null) {
  let figures = existing?.figures || [];
  let events = existing?.events || [];
  const completed = new Set(progressState?.completedSources || []);
  const sources = [
    ...FIGURE_CATEGORIES.map((s) => ({ ...s, phase: "figures", kind: "category" })),
    ...FIGURE_LISTS.map((s) => ({ ...s, phase: "figures", kind: "list" })),
    ...EVENT_CATEGORIES.map((s) => ({ ...s, phase: "events", kind: "category" })),
    ...EVENT_LISTS.map((s) => ({ ...s, phase: "events", kind: "list" })),
  ];
  const total = sources.length;
  const completedSources = [...completed];

  for (let i = 0; i < sources.length; i++) {
    const src = sources[i];
    const key = sourceKey(src);
    const step = i + 1;

    if (completed.has(key)) {
      if (onProgress) {
        onProgress({
          phase: src.phase,
          era: src.era,
          step,
          total,
          category: src.title,
          kind: src.kind,
          figuresCount: figures.length,
          eventsCount: events.length,
          skipped: true,
        });
      }
      continue;
    }

    if (onProgress) {
      onProgress({ phase: src.phase, era: src.era, step, total, category: src.title, kind: src.kind });
    }

    let lastErr = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        let batch = [];
        if (src.kind === "category") {
          batch = await fetchCategoryBatch(src.title, src.era, src.phase === "events" ? "event" : "figure", 500);
        } else {
          const links = await fetchListPageLinks(src.title, 400);
          batch = await enrichTitles(links, src.era, src.phase === "events" ? "event" : "figure", src.title);
        }
        if (src.phase === "figures") figures = mergeItems(figures, batch);
        else events = mergeItems(events, batch);

        completed.add(key);
        completedSources.push(key);

        const snapshot = {
          updatedAt: Date.now(),
          source: "wikipedia-bulk",
          figures,
          events,
        };
        if (onSave) onSave(snapshot, { completedSources: [...completed] });
        if (onProgress) {
          onProgress({
            phase: src.phase,
            era: src.era,
            step,
            total,
            category: src.title,
            kind: src.kind,
            figuresCount: figures.length,
            eventsCount: events.length,
            saved: true,
          });
        }
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        if (onError) onError(src.era, src.phase, err, attempt + 1);
        await sleep(10000 * (attempt + 1));
      }
    }
    if (lastErr) {
      console.warn(`SKIP after retries: ${key} — ${lastErr.message}`);
    }
  }

  return {
    updatedAt: Date.now(),
    source: "wikipedia-bulk",
    figures,
    events,
  };
}

module.exports = {
  buildWikiSeed,
  FIGURE_CATEGORIES,
  EVENT_CATEGORIES,
  FIGURE_LISTS,
  EVENT_LISTS,
};
