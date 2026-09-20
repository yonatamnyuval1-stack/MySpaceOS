const USER_AGENT = "MySpaceHistory/1.0 (Educational desktop app; Electron)";

const ERA_RANGES = [
  { id: "ancient", label: "Ancient", from: -3500, to: 500 },
  { id: "medieval", label: "Medieval", from: 500, to: 1400 },
  { id: "early", label: "Early Modern", from: 1400, to: 1700 },
  { id: "modern", label: "18th–19th c.", from: 1700, to: 1900 },
  { id: "twentieth", label: "20th Century", from: 1900, to: 1975 },
  { id: "recent", label: "1975–2010", from: 1975, to: 2010 },
];

const EVENT_ERA_RANGES = [
  { id: "ancient", from: -3500, to: 500 },
  { id: "medieval", from: 500, to: 1400 },
  { id: "early", from: 1400, to: 1700 },
  { id: "modern", from: 1700, to: 1900 },
  { id: "twentieth", from: 1900, to: 2000 },
  { id: "recent", from: 2000, to: 2025 },
];

const QUERY_TIMEOUT_MS = 90000;

function qId(uri) {
  const m = String(uri || "").match(/(Q\d+)$/i);
  return m ? m[1].toUpperCase() : "";
}

function parseWikidataDate(raw) {
  if (!raw) return { iso: "", year: null };
  const s = String(raw);
  const yearMatch = s.match(/^([+-]?\d{4})/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
  const iso = s.replace(/^\+/, "").slice(0, 10);
  return { iso, year };
}

function eraFromYear(year, ranges = ERA_RANGES) {
  if (year == null || Number.isNaN(year)) return "unknown";
  for (const e of ranges) {
    if (year >= e.from && year < e.to) return e.id;
  }
  return "unknown";
}

function commonsThumb(url, width = 400) {
  if (!url) return "";
  if (url.includes("wikimedia.org")) {
    const file = url.split("/").pop();
    if (file) return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(decodeURIComponent(file))}?width=${width}`;
  }
  return url;
}

async function wikidataQuery(sparql, retries = 4) {
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch("https://query.wikidata.org/sparql", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/sparql-results+json",
          "User-Agent": USER_AGENT,
        },
        body: new URLSearchParams({ query: sparql }),
        signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
      });
      if (res.status === 429 || res.status === 503 || res.status === 504) {
        throw new Error(`Wikidata query failed (${res.status})`);
      }
      if (!res.ok) throw new Error(`Wikidata query failed (${res.status})`);
      return res.json();
    } catch (err) {
      lastErr = err;
      const wait = 3000 * (attempt + 1);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

function bindingValue(b, key) {
  return b[key]?.value || "";
}

function normalizeFigureRow(b) {
  const id = qId(bindingValue(b, "person"));
  const name = bindingValue(b, "personLabel");
  if (!id || !name) return null;
  const birth = parseWikidataDate(bindingValue(b, "birth"));
  const death = parseWikidataDate(bindingValue(b, "death"));
  const image = commonsThumb(bindingValue(b, "image"));
  return {
    id,
    type: "figure",
    name,
    birth: birth.iso,
    death: death.iso,
    birthYear: birth.year,
    deathYear: death.year,
    era: eraFromYear(birth.year),
    country: bindingValue(b, "countryLabel") || "",
    description: bindingValue(b, "description") || "",
    image,
    wikiTitle: name,
  };
}

function normalizeEventRow(b) {
  const id = qId(bindingValue(b, "event"));
  const name = bindingValue(b, "eventLabel");
  if (!id || !name) return null;
  const date = parseWikidataDate(bindingValue(b, "date"));
  const image = commonsThumb(bindingValue(b, "image"));
  return {
    id,
    type: "event",
    name,
    date: date.iso,
    year: date.year,
    era: eraFromYear(date.year, EVENT_ERA_RANGES),
    location: bindingValue(b, "locationLabel") || "",
    eventType: bindingValue(b, "eventTypeLabel") || "",
    description: bindingValue(b, "description") || "",
    image,
    wikiTitle: name,
  };
}

function figureSparql(fromYear, toYear, limit = 200) {
  return `
SELECT DISTINCT ?person ?personLabel ?birth ?death ?occupationLabel ?image WHERE {
  ?person wdt:P31 wd:Q5.
  ?person wdt:P569 ?birth.
  ?person wikibase:sitelinks ?sitelinks.
  FILTER(?sitelinks >= 15)
  FILTER(YEAR(?birth) >= ${fromYear} && YEAR(?birth) < ${toYear})
  OPTIONAL { ?person wdt:P570 ?death. }
  OPTIONAL { ?person wdt:P106 ?occ . ?occ rdfs:label ?occupationLabel FILTER(LANG(?occupationLabel)="en") }
  OPTIONAL { ?person wdt:P18 ?image. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT ${limit}`;
}

function eventSparql(fromYear, toYear, limit = 150) {
  return `
SELECT DISTINCT ?event ?eventLabel ?date ?locationLabel ?image WHERE {
  ?event wdt:P585 ?date .
  ?event wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= 10)
  FILTER(YEAR(?date) >= ${fromYear} && YEAR(?date) < ${toYear})
  {
    ?event wdt:P31/wdt:P279* wd:Q1190554 .
  } UNION {
    ?event wdt:P31/wdt:P279* wd:Q178561 .
  } UNION {
    ?event wdt:P31/wdt:P279* wd:Q198 .
  }
  OPTIONAL { ?event wdt:P276 ?loc . ?loc rdfs:label ?locationLabel FILTER(LANG(?locationLabel)="en") }
  OPTIONAL { ?event wdt:P18 ?image. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT ${limit}`;
}

function dedupeById(items) {
  const map = new Map();
  for (const item of items) {
    if (!item?.id) continue;
    if (!map.has(item.id)) map.set(item.id, item);
  }
  return [...map.values()];
}

async function buildCache(onProgress, onError) {
  const figures = [];
  const events = [];
  const total = ERA_RANGES.length + EVENT_ERA_RANGES.length;
  let step = 0;

  for (const era of ERA_RANGES) {
    step += 1;
    if (onProgress) onProgress({ phase: "figures", era: era.id, step, total });
    try {
      const data = await wikidataQuery(figureSparql(era.from, era.to));
      const rows = (data.results?.bindings || []).map(normalizeFigureRow).filter(Boolean);
      figures.push(...rows);
      await new Promise((r) => setTimeout(r, 2500));
    } catch (err) {
      if (onError) onError(era.id, "figures", err);
      else console.warn(`History figures ${era.id}:`, err.message);
    }
  }

  for (const era of EVENT_ERA_RANGES) {
    step += 1;
    if (onProgress) onProgress({ phase: "events", era: era.id, step, total });
    try {
      const data = await wikidataQuery(eventSparql(era.from, era.to));
      const rows = (data.results?.bindings || []).map(normalizeEventRow).filter(Boolean);
      events.push(...rows);
      await new Promise((r) => setTimeout(r, 2500));
    } catch (err) {
      if (onError) onError(era.id, "events", err);
      else console.warn(`History events ${era.id}:`, err.message);
    }
  }

  return {
    updatedAt: Date.now(),
    figures: dedupeById(figures).sort((a, b) => (a.birthYear || 0) - (b.birthYear || 0)),
    events: dedupeById(events).sort((a, b) => (a.year || 0) - (b.year || 0)),
  };
}

module.exports = { buildCache, ERA_RANGES, EVENT_ERA_RANGES };