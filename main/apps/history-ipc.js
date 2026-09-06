const path = require("path");
const fs = require("fs");
const { app, shell } = require("electron");
const { buildCache, ERA_RANGES, EVENT_ERA_RANGES } = require("./history-cache-core");
const {
  setupLocalAuthApp,
  requireSignedIn,
  registerLegacyMigrator,
} = require("./local-auth-app-helper");

const APP_ID = "history";
const auth = setupLocalAuthApp(APP_ID);
registerLegacyMigrator(APP_ID, ["history.json", "history-cache.json"]);

const USER_FILE = () => auth.userDataPath("history.json");
const CACHE_FILE = () => auth.userDataPath("history-cache.json");
const BUNDLED_CACHE_FILE = () => path.join(__dirname, "..", "..", "data", "history-cache.json");

function signedInGuard() {
  return requireSignedIn(auth);
}

const USER_AGENT = "MySpaceHistory/1.0 (Educational desktop app; Electron)";

function readJson(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
  }
  return fallback;
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function parseWikidataDate(raw) {
  if (!raw) return { iso: "", year: null };
  const s = String(raw);
  const yearMatch = s.match(/^([+-]?\d{4})/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
  const iso = s.replace(/^\+/, "").slice(0, 10);
  return { iso, year };
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.error?.info || body?.message || "";
    } catch {
    }
    throw new Error(`Request failed (${res.status})${detail ? `: ${detail}` : ""}`);
  }
  return res.json();
}

function loadCache() {
  const userCache = readJson(CACHE_FILE(), null);
  if (userCache?.figures?.length || userCache?.events?.length) return userCache;

  const bundled = readJson(BUNDLED_CACHE_FILE(), null);
  if (bundled?.figures?.length || bundled?.events?.length) {
    try {
      writeJson(CACHE_FILE(), bundled);
    } catch {
    }
    return bundled;
  }
  return null;
}

async function buildAndSaveCache(onProgress) {
  const { buildWikiSeed } = require("./history-wiki-seed");
  const existing = loadCache();
  const onSave = (snapshot) => {
    writeJson(CACHE_FILE(), snapshot);
    try {
      writeJson(BUNDLED_CACHE_FILE(), snapshot);
    } catch {
    }
  };
  const cache = await buildWikiSeed(onProgress, null, onSave, existing);
  onSave(cache);
  return cache;
}

function getCacheOrThrow() {
  const cache = loadCache();
  if (!cache?.figures?.length && !cache?.events?.length) {
    throw new Error("Database not loaded yet.");
  }
  return cache;
}

async function fetchWikiEnrichment(title, lang = "en") {
  const wikiLang = lang === "he" ? "he" : "en";
  const host = `${wikiLang}.wikipedia.org`;
  const pageTitle = encodeURIComponent(String(title).replace(/ /g, "_"));

  let summary = null;
  try {
    summary = await fetchJson(`https://${host}/api/rest_v1/page/summary/${pageTitle}`);
  } catch {
    if (wikiLang !== "en") {
      try {
        summary = await fetchJson(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(String(title).replace(/ /g, "_"))}`
        );
      } catch {
        summary = null;
      }
    }
  }

  let extract = "";
  const images = [];
  try {
    const q = await fetchJson(
      `https://${host}/w/api.php?action=query&prop=extracts|pageimages&redirects=1` +
        `&explaintext=1&exsectionformat=plain&exchars=6000&piprop=thumbnail|original&pithumbsize=800` +
        `&titles=${pageTitle}&format=json`
    );
    const page = Object.values(q.query?.pages || {})[0];
    if (page && !page.missing) {
      extract = page.extract || "";
      if (page.original?.source) images.push({ url: page.original.source, caption: title });
      else if (page.thumbnail?.source) images.push({ url: page.thumbnail.source, caption: title });
    }
  } catch {
  }

  if (summary?.originalimage?.source && !images.some((i) => i.url === summary.originalimage.source)) {
    images.unshift({ url: summary.originalimage.source, caption: summary.title || title });
  } else if (summary?.thumbnail?.source && !images.length) {
    images.push({ url: summary.thumbnail.source, caption: summary.title || title });
  }

  return {
    title: summary?.title || title,
    description: summary?.description || "",
    extract: extract || summary?.extract || "",
    lang: wikiLang,
    wikiUrl: summary?.content_urls?.desktop?.page || `https://${host}/wiki/${pageTitle}`,
    images,
  };
}

function claimValue(claims, pid) {
  const list = claims?.[pid];
  if (!list?.length) return null;
  const mainsnak = list[0].mainsnak;
  if (mainsnak.datavalue?.value?.time) return parseWikidataDate(mainsnak.datavalue.value.time);
  if (mainsnak.datavalue?.value?.id) return mainsnak.datavalue.value.id;
  if (typeof mainsnak.datavalue?.value === "string") return mainsnak.datavalue.value;
  return null;
}

async function fetchEntityDetail(qid) {
  const data = await fetchJson(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`);
  const entity = data.entities?.[qid];
  if (!entity) throw new Error("Entity not found");

  const labels = entity.labels?.en?.value || entity.labels?.he?.value || qid;
  const desc = entity.descriptions?.en?.value || entity.descriptions?.he?.value || "";
  const claims = entity.claims || {};
  const birth = claimValue(claims, "P569");
  const death = claimValue(claims, "P570");
  const date = claimValue(claims, "P585");

  const sitelinks = entity.sitelinks?.enwiki?.title || labels;

  return {
    id: qid,
    name: labels,
    description: desc,
    birth: birth?.iso || "",
    death: death?.iso || "",
    birthYear: birth?.year ?? null,
    deathYear: death?.year ?? null,
    date: date?.iso || "",
    year: date?.year ?? null,
    wikiTitle: sitelinks,
    wikidataUrl: `https://www.wikidata.org/wiki/${qid}`,
  };
}

function normalizeBookmark(raw) {
  if (!raw?.entityId) return null;
  return {
    id: String(raw.id || uid("bm")),
    entityId: String(raw.entityId).toUpperCase(),
    entityType: raw.entityType === "event" ? "event" : "figure",
    name: String(raw.name || "").trim(),
    notes: String(raw.notes || "").trim(),
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

function normalizeUserData(raw) {
  return {
    bookmarks: (Array.isArray(raw?.bookmarks) ? raw.bookmarks : []).map(normalizeBookmark).filter(Boolean),
    settings: { wikiLang: raw?.settings?.wikiLang === "he" ? "he" : "en" },
  };
}

function loadUserData() {
  return normalizeUserData(readJson(USER_FILE(), { bookmarks: [], settings: { wikiLang: "en" } }));
}

function saveUserData(data) {
  const normalized = normalizeUserData(data);
  writeJson(USER_FILE(), normalized);
  return normalized;
}

async function handleHistoryInvoke(channel, args) {
  const authErr = signedInGuard();
  if (authErr) return authErr;
  try {
    if (channel === "cache.status") {
      const cache = loadCache();
      return {
        ok: true,
        loaded: Boolean(cache?.figures?.length || cache?.events?.length),
        figuresCount: cache?.figures?.length || 0,
        eventsCount: cache?.events?.length || 0,
        updatedAt: cache?.updatedAt || null,
      };
    }

    if (channel === "cache.build") {
      const cache = await buildAndSaveCache();
      return {
        ok: true,
        figuresCount: cache.figures.length,
        eventsCount: cache.events.length,
        updatedAt: cache.updatedAt,
      };
    }

    if (channel === "figures.list") {
      const cache = getCacheOrThrow();
      return { ok: true, figures: cache.figures };
    }

    if (channel === "events.list") {
      const cache = getCacheOrThrow();
      return { ok: true, events: cache.events };
    }

    if (channel === "entity.get") {
      const id = String(args?.id || "").toUpperCase();
      if (!id) return { ok: false, error: "Missing entity id" };
      const cache = loadCache() || { figures: [], events: [] };
      const cached =
        cache.figures?.find((f) => f.id === id) || cache.events?.find((e) => e.id === id) || null;
      let detail = null;
      try {
        detail = await fetchEntityDetail(id);
      } catch {
        detail = cached;
      }
      const lang = args?.wikiLang || loadUserData().settings.wikiLang || "en";
      const title = detail?.wikiTitle || cached?.wikiTitle || cached?.name || detail?.name;
      let wiki = null;
      try {
        wiki = await fetchWikiEnrichment(title, lang);
      } catch {
        wiki = null;
      }
      return { ok: true, entity: { ...cached, ...detail, type: cached?.type || args?.type }, wiki };
    }

    if (channel === "storage.load") {
      return { ok: true, data: loadUserData() };
    }

    if (channel === "storage.save") {
      return { ok: true, data: saveUserData(args?.data || {}) };
    }

    if (channel === "link.open") {
      const url = String(args?.url || "").trim();
      if (!url) return { ok: false, error: "Missing URL" };
      await shell.openExternal(url);
      return { ok: true };
    }

    return { ok: false, error: `Unknown channel: ${channel}` };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

module.exports = { handleHistoryInvoke, buildCache: buildAndSaveCache, ERA_RANGES, EVENT_ERA_RANGES };