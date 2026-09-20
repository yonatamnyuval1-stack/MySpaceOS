const path = require("path");
const fs = require("fs");
const { app, shell } = require("electron");
const {
  buildLearnProfile,
  getBundledProfile,
  loadBundledLearn,
  loadUserLearnProfile,
  saveUserLearnProfile,
  listBundledCodes,
} = require("./geography-learn");
const { fetchAllCountries: loadCountriesFromApi, fetchCountryDetail } = require("./restcountries-client");
const { loadJsonFile, saveJsonFile, atomicWriteJson } = require("./safe-json-store");
const { reportLoadFailure, reportSaveFailure, reportRuntimeFailure } = require("../resolve/report-helper");
const {
  setupLocalAuthApp,
  requireSignedIn,
  userStorageRoot,
  registerLegacyMigrator,
} = require("./local-auth-app-helper");

const APP_ID = "geography";
const auth = setupLocalAuthApp(APP_ID);
registerLegacyMigrator(APP_ID, ["geography.json", "geography-countries-cache.json"]);

const USER_FILE = () => auth.userDataPath("geography.json");
const CACHE_FILE = () => auth.userDataPath("geography-countries-cache.json");

function signedInGuard() {
  return requireSignedIn(auth);
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function readJson(file, fallback) {
  const loaded = loadJsonFile(file, { fallback });
  if (!loaded.ok) return fallback;
  return loaded.data == null ? fallback : loaded.data;
}

function writeJson(file, data) {
  atomicWriteJson(file, data);
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.message ? `: ${body.message}` : "";
    } catch {
      /* ignore */
    }
    throw new Error(`Request failed (${res.status})${detail}`);
  }
  return res.json();
}

async function loadCountriesCache() {
  const cache = readJson(CACHE_FILE(), null);
  if (cache?.countries?.length && Date.now() - (cache.updatedAt || 0) < CACHE_TTL_MS) {
    return cache.countries;
  }
  return null;
}

async function fetchAllCountries(force = false) {
  if (!force) {
    const cached = await loadCountriesCache();
    if (cached) return cached;
  }

  const { countries } = await loadCountriesFromApi();
  writeJson(CACHE_FILE(), { updatedAt: Date.now(), countries });
  return countries;
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
  let extraImages = [];
  try {
    const apiUrl =
      `https://${host}/w/api.php?action=query&prop=extracts|pageimages&redirects=1` +
      `&explaintext=1&exsectionformat=plain&piprop=thumbnail&pithumbsize=800` +
      `&titles=${pageTitle}&format=json`;
    const q = await fetchJson(apiUrl);
    const pages = q.query?.pages || {};
    const page = Object.values(pages)[0];
    if (page && !page.missing) {
      extract = page.extract || "";
      if (page.thumbnail?.source) {
        extraImages.push({ url: page.thumbnail.source, caption: title });
      }
    }
  } catch {
  }

  const images = [];
  if (summary?.originalimage?.source) {
    images.push({ url: summary.originalimage.source, caption: summary.title || title });
  } else if (summary?.thumbnail?.source) {
    images.push({ url: summary.thumbnail.source, caption: summary.title || title });
  }
  for (const img of extraImages) {
    if (!images.some((i) => i.url === img.url)) images.push(img);
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

function normalizeVisit(raw) {
  if (!raw?.countryCode) return null;
  return {
    id: String(raw.id || uid("vis")),
    countryCode: String(raw.countryCode).toUpperCase(),
    countryName: String(raw.countryName || "").trim(),
    firstVisit: String(raw.firstVisit || "").trim(),
    lastVisit: String(raw.lastVisit || "").trim(),
    visitCount: Math.max(1, Number(raw.visitCount) || 1),
    cities: Array.isArray(raw.cities) ? raw.cities.map((c) => String(c).trim()).filter(Boolean) : [],
    notes: String(raw.notes || "").trim(),
    rating: Math.min(5, Math.max(0, Number(raw.rating) || 0)),
    favorite: Boolean(raw.favorite),
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
  };
}

function normalizeUserData(raw) {
  const visited = (Array.isArray(raw?.visited) ? raw.visited : []).map(normalizeVisit).filter(Boolean);
  return {
    visited,
    favorites: Array.isArray(raw?.favorites) ? raw.favorites.map((c) => String(c).toUpperCase()) : [],
    settings: {
      wikiLang: raw?.settings?.wikiLang === "he" ? "he" : "en",
      ...(raw?.settings || {}),
    },
  };
}

function loadUserData() {
  const loaded = loadJsonFile(USER_FILE(), {
    fallback: { visited: [], favorites: [], settings: { wikiLang: "en" } },
  });
  if (!loaded.ok) {
    console.error("geography load:", loaded.error);
    reportLoadFailure("geography", loaded);
    return normalizeUserData({ visited: [], favorites: [], settings: { wikiLang: "en" } });
  }
  return normalizeUserData(loaded.data || {});
}

function saveUserData(data) {
  const normalized = normalizeUserData(data);
  const result = saveJsonFile(USER_FILE(), normalized, { listKey: "visited" });
  if (!result.ok) {
    reportSaveFailure("geography", result);
    if (result.data) return normalizeUserData(result.data);
  }
  return normalized;
}

async function handleGeographyInvoke(channel, args) {
  const authErr = signedInGuard();
  if (authErr) return authErr;
  try {
    if (channel === "countries.list") {
      const countries = await fetchAllCountries(Boolean(args?.force));
      return { ok: true, countries };
    }

    if (channel === "countries.get") {
      const code = String(args?.code || "").toUpperCase();
      if (!code) return { ok: false, error: "Missing country code" };
      const country = await fetchCountryDetail(code);
      const skipWiki = Boolean(args?.skipWiki);
      let wiki = null;
      if (!skipWiki) {
        const lang = args?.wikiLang || loadUserData().settings.wikiLang || "en";
        try {
          wiki = await fetchWikiEnrichment(country.wikiTitle || country.name, lang);
        } catch (err) {
          reportRuntimeFailure("geography", "WIKI_FETCH_FAILED", err, { code, lang });
          wiki = null;
        }
      }
      return { ok: true, country, wiki };
    }

    if (channel === "learn.status") {
      const bundled = loadBundledLearn();
      const codes = listBundledCodes();
      return {
        ok: true,
        bundledCount: codes.length,
        updatedAt: bundled.updatedAt || null,
      };
    }

    if (channel === "learn.get") {
      const code = String(args?.code || "").toUpperCase();
      if (!code) return { ok: false, error: "Missing country code" };

      let profile = getBundledProfile(null, code);
      let fromCache = profile ? "bundled" : null;

      if (!profile) {
        profile = loadUserLearnProfile(userStorageRoot(auth), code);
        fromCache = profile ? "user" : null;
      }

      if (!profile) {
        const country = await fetchCountryDetail(code);
        profile = await buildLearnProfile(country);
        saveUserLearnProfile(userStorageRoot(auth), profile);
        fromCache = "built";
      }

      return { ok: true, profile, fromCache };
    }

    if (channel === "learn.build") {
      const code = String(args?.code || "").toUpperCase();
      if (!code) return { ok: false, error: "Missing country code" };
      const country = await fetchCountryDetail(code);
      const profile = await buildLearnProfile(country);
      saveUserLearnProfile(userStorageRoot(auth), profile);
      return { ok: true, profile, fromCache: "built" };
    }

    if (channel === "countries.wiki") {
      const title = String(args?.title || args?.name || "").trim();
      if (!title) return { ok: false, error: "Missing title" };
      const wiki = await fetchWikiEnrichment(title, args?.lang || "en");
      return { ok: true, wiki };
    }

    if (channel === "storage.load") {
      return { ok: true, data: loadUserData() };
    }

    if (channel === "storage.save") {
      return { ok: true, data: saveUserData(args?.data || {}) };
    }

    if (channel === "maps.open") {
      const url = String(args?.url || "").trim();
      if (!url) return { ok: false, error: "Missing URL" };
      await shell.openExternal(url);
      return { ok: true };
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

module.exports = { handleGeographyInvoke };