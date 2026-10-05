const path = require("path");
const fs = require("fs");
const { app, shell } = require("electron");
const {
  setupLocalAuthApp,
  requireSignedIn,
  registerLegacyMigrator,
} = require("./local-auth-app-helper");

const APP_ID = "space";
const auth = setupLocalAuthApp(APP_ID);
registerLegacyMigrator(APP_ID, ["space.json", "space-apod-cache.json"]);

const USER_FILE = () => auth.userDataPath("space.json");
const CATALOG_FILE = () => path.join(__dirname, "..", "..", "data", "space-catalog.json");
const STARS_FILE = () => path.join(__dirname, "..", "..", "data", "space-stars.json");
const OCEAN_FILE = () => path.join(__dirname, "..", "..", "data", "space-ocean.json");
const EARTH_FILE = () => path.join(__dirname, "..", "..", "data", "space-earth.json");
const APOD_CACHE_FILE = () => auth.userDataPath("space-apod-cache.json");
const APOD_FALLBACK_FILE = () => path.join(__dirname, "..", "..", "data", "space-apod-fallback.json");

function signedInGuard() {
  return requireSignedIn(auth);
}

const MISSIONS_FILE = () => path.join(__dirname, "..", "..", "data", "space-nasa-missions.json");
const REPORTS_FILE = () => path.join(__dirname, "..", "..", "data", "space-nasa-reports.json");
const PHYSICS_FILE = () => path.join(__dirname, "..", "..", "data", "space-physics.json");
const NEO_FALLBACK_FILE = () => path.join(__dirname, "..", "..", "data", "space-neo-fallback.json");
const UAP_DOCS_DIR = () => path.join(__dirname, "..", "..", "apps", "space", "data", "uap-docs");
const UAP_CATALOG_FILE = () => path.join(UAP_DOCS_DIR(), "catalog.json");
const ALIENS_HUB_FILE = () => path.join(__dirname, "..", "..", "apps", "space", "data", "aliens-hub.json");
/** Shared NASA Open APIs demo key — product uses this so users never need their own key. */
const NASA_KEY = String(process.env.NASA_API_KEY || "DEMO_KEY").trim() || "DEMO_KEY";
const USING_DEMO_KEY = NASA_KEY === "DEMO_KEY";
const DEMO_KEY_NOTE =
  "Using NASA’s shared demo access (no personal key needed). Live feeds can be busy — cached or sample data may appear.";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function withNasaMeta(payload) {
  return {
    ...payload,
    usingDemoKey: USING_DEMO_KEY,
    demoKeyNote: USING_DEMO_KEY ? DEMO_KEY_NOTE : "",
  };
}

let catalogCache = null;
let starsCache = null;
let oceanCache = null;
let earthCache = null;
let missionsCache = null;
let reportsCache = null;
let physicsCache = null;

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function readJson(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    /* ignore */
  }
  return fallback;
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url, retries = 4) {
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(25000),
      });
      if (res.status === 429 || res.status === 503 || res.status === 504) {
        const retryAfter = Number(res.headers.get("retry-after")) || 8;
        await sleep(retryAfter * 1000 + attempt * 2500);
        throw new Error(`HTTP ${res.status}`);
      }
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < retries - 1) await sleep(2000 * (attempt + 1));
    }
  }
  throw lastErr;
}

function normalizeApod(data) {
  return {
    date: data.date,
    title: data.title,
    explanation: data.explanation || "",
    url: data.url || "",
    hdurl: data.hdurl || data.url || "",
    mediaType: data.media_type || "image",
    copyright: data.copyright || "",
  };
}

function loadCatalog() {
  if (catalogCache) return catalogCache;
  const raw = readJson(CATALOG_FILE(), { bodies: [] });
  catalogCache = {
    updatedAt: raw.updatedAt || null,
    bodies: (Array.isArray(raw.bodies) ? raw.bodies : []).map(normalizeBody).filter(Boolean),
  };
  return catalogCache;
}

function normalizeBody(raw) {
  if (!raw?.id || !raw?.name) return null;
  return {
    id: String(raw.id),
    name: String(raw.name),
    category: String(raw.category || "planet"),
    parent: raw.parent ? String(raw.parent) : null,
    orbitOrder: Number(raw.orbitOrder) || 0,
    distAU: raw.distAU != null ? Number(raw.distAU) : null,
    radiusKm: raw.radiusKm != null ? Number(raw.radiusKm) : null,
    mass: String(raw.mass || ""),
    gravity: String(raw.gravity || ""),
    dayLength: String(raw.dayLength || ""),
    yearLength: String(raw.yearLength || ""),
    temperature: String(raw.temperature || ""),
    moonsCount: raw.moonsCount != null ? Number(raw.moonsCount) : null,
    composition: String(raw.composition || ""),
    discovered: String(raw.discovered || ""),
    namedAfter: String(raw.namedAfter || ""),
    description: String(raw.description || ""),
    facts: Array.isArray(raw.facts) ? raw.facts.map((f) => String(f)) : [],
    wikiTitle: String(raw.wikiTitle || raw.name),
    color: String(raw.color || "#8899bb"),
    image: String(raw.image || ""),
    nasaUrl: String(raw.nasaUrl || ""),
  };
}

function loadStars() {
  if (starsCache) return starsCache;
  const raw = readJson(STARS_FILE(), { stars: [] });
  starsCache = {
    count: raw.count || raw.stars?.length || 0,
    stars: Array.isArray(raw.stars) ? raw.stars : [],
  };
  return starsCache;
}

function getStar(id) {
  return loadStars().stars.find((s) => s.id === id) || null;
}

function loadOcean() {
  if (oceanCache) return oceanCache;
  const raw = readJson(OCEAN_FILE(), { creatures: [], species: [] });
  const speciesById = Object.fromEntries((raw.species || []).map((s) => [s.id, s]));
  oceanCache = {
    count: raw.count || raw.creatures?.length || 0,
    worldKm: raw.worldKm || 120,
    maxDepthM: raw.maxDepthM || 11000,
    species: raw.species || [],
    speciesById,
    creatures: Array.isArray(raw.creatures) ? raw.creatures : [],
  };
  return oceanCache;
}

function getCreature(id) {
  return loadOcean().creatures.find((c) => c.id === id) || null;
}

function loadEarth() {
  if (earthCache) return earthCache;
  const raw = readJson(EARTH_FILE(), { countries: [], cities: [], places: [] });
  const countryByCode = Object.fromEntries((raw.countries || []).map((c) => [c.code, c]));
  earthCache = {
    kmPerDeg: raw.kmPerDeg || 111.32,
    countryCount: raw.countryCount || raw.countries?.length || 0,
    cityCount: raw.cityCount || raw.cities?.length || 0,
    placeCount: raw.placeCount || raw.places?.length || 0,
    countries: raw.countries || [],
    cities: raw.cities || [],
    places: raw.places || [],
    oceanSites: raw.oceanSites || [],
    countryByCode,
  };
  return earthCache;
}

function getEarthCountry(code) {
  return loadEarth().countryByCode[code] || loadEarth().countries.find((c) => c.code === code) || null;
}

function countryToBody(c) {
  return {
    id: c.id || `country_${c.code}`,
    name: c.name,
    category: "country",
    code: c.code,
    capital: c.capital,
    region: c.region,
    subregion: c.subregion,
    population: c.population,
    area: c.area,
    flag: c.flag,
    image: c.flag,
    lat: c.lat,
    lon: c.lon,
    description: `${c.name}${c.capital ? ` — capital ${c.capital}` : ""}${c.region ? `, ${c.region}` : ""}.`,
    wikiTitle: c.wikiTitle || c.name,
    facts: [
      c.capital ? `Capital: ${c.capital}` : "",
      c.population ? `Population: ${c.population.toLocaleString()}` : "",
      c.area ? `Area: ${c.area.toLocaleString()} km²` : "",
      `Coordinates: ${c.lat?.toFixed(2)}°, ${c.lon?.toFixed(2)}°`,
    ].filter(Boolean),
  };
}

function cityToBody(city, country) {
  return {
    id: city.id,
    name: city.name,
    category: "city",
    country: city.country,
    countryName: country?.name || city.country,
    population: city.population,
    lat: city.lat,
    lon: city.lon,
    image: country?.flag || "",
    description: `${city.name}${country ? `, ${country.name}` : ""} — ${(city.population || 0).toLocaleString()} people.`,
    wikiTitle: city.name,
    facts: [
      city.capital ? "National capital" : "Major city",
      `Population: ${(city.population || 0).toLocaleString()}`,
      `Location: ${city.lat?.toFixed(2)}°, ${city.lon?.toFixed(2)}°`,
    ],
  };
}

function placeToBody(place, country) {
  return {
    id: place.id,
    name: place.name,
    category: "place",
    placeType: place.type,
    city: place.city,
    country: place.country,
    countryName: country?.name || place.country,
    lat: place.lat,
    lon: place.lon,
    image: country?.flag || "",
    description: `${place.name} — ${place.type || "place"} in ${place.city || ""}${country ? `, ${country.name}` : ""}.`,
    wikiTitle: place.wikiTitle || place.name,
    facts: [
      place.city ? `City: ${place.city}` : "",
      `Type: ${place.type || "landmark"}`,
      `Coordinates: ${place.lat?.toFixed(2)}°, ${place.lon?.toFixed(2)}°`,
    ].filter(Boolean),
  };
}

const RARITY_LABELS = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  legendary: "Legendary",
};

const ZONE_LABELS = {
  epipelagic: "Sunlight zone (0–200 m)",
  reef: "Coral reef & coast",
  mesopelagic: "Twilight zone (200–1000 m)",
  bathypelagic: "Midnight zone (1000–4000 m)",
  abyssal: "Abyssal plain (4000–6000 m)",
  hadal: "Hadal zone (6000+ m)",
};

function creatureToBody(creature) {
  const ocean = loadOcean();
  const sp = ocean.speciesById[creature.speciesId] || {};
  return {
    id: creature.id,
    name: creature.name,
    category: "creature",
    speciesId: creature.speciesId,
    rarity: creature.rarity,
    rarityLabel: RARITY_LABELS[creature.rarity] || creature.rarity,
    zone: creature.zone,
    zoneLabel: ZONE_LABELS[creature.zone] || sp.zoneLabel || creature.zone,
    depthM: creature.depthM,
    emoji: creature.emoji,
    color: creature.color || "#38bdf8",
    featured: Boolean(creature.featured),
    description: `${creature.name} — ${RARITY_LABELS[creature.rarity] || creature.rarity} species in the ${ZONE_LABELS[creature.zone] || creature.zone}.`,
    wikiTitle: creature.wikiTitle || sp.wikiTitle || creature.name,
    facts: [
      `Depth: ${creature.depthM} m`,
      `Rarity: ${RARITY_LABELS[creature.rarity] || creature.rarity}`,
      `Zone: ${ZONE_LABELS[creature.zone] || creature.zone}`,
      `Position: ${creature.x} km, ${creature.y} km`,
      sp.depthMin != null ? `Typical range: ${sp.depthMin}–${sp.depthMax} m` : "",
    ].filter(Boolean),
  };
}

function starToBody(star) {
  return {
    id: star.id,
    name: star.name,
    category: "star",
    description: star.named
      ? `Named star in ${star.constellation} — ${star.distLy} light-years from Earth.`
      : `Star in ${star.constellation} — catalog entry ${star.name}.`,
    distLy: star.distLy,
    magnitude: star.magnitude,
    spectral: star.spectral,
    constellation: star.constellation,
    color: star.color || "#ffffff",
    wikiTitle: star.wikiTitle || (star.named ? star.name : ""),
    facts: [
      `Distance: ${star.distLy} light-years`,
      `Apparent magnitude: ${star.magnitude}`,
      `Spectral type: ${star.spectral}`,
      `Constellation: ${star.constellation}`,
      `Position (ly): x=${star.x}, y=${star.y}, z=${star.z}`,
    ],
    named: star.named,
  };
}

function getBody(id) {
  const catalog = loadCatalog();
  return catalog.bodies.find((b) => b.id === id) || null;
}

function listBodies(filter = {}) {
  const catalog = loadCatalog();
  let list = [...catalog.bodies];
  const cat = filter.category;
  if (cat && cat !== "all") {
    list = list.filter((b) => b.category === cat);
  }
  const q = String(filter.q || "")
    .trim()
    .toLowerCase();
  if (q) {
    list = list.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        b.category.includes(q)
    );
  }
  list.sort((a, b) => {
    if (a.orbitOrder !== b.orbitOrder) return a.orbitOrder - b.orbitOrder;
    return a.name.localeCompare(b.name);
  });
  return list;
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
  try {
    const apiUrl =
      `https://${host}/w/api.php?action=query&prop=extracts|pageimages&redirects=1` +
      `&explaintext=1&exsectionformat=plain&piprop=thumbnail&pithumbsize=900` +
      `&titles=${pageTitle}&format=json`;
    const q = await fetchJson(apiUrl);
    const page = Object.values(q.query?.pages || {})[0];
    if (page && !page.missing) {
      extract = page.extract || "";
    }
  } catch {
  }

  const images = [];
  if (summary?.originalimage?.source) {
    images.push({ url: summary.originalimage.source, caption: summary.title || title });
  } else if (summary?.thumbnail?.source) {
    images.push({ url: summary.thumbnail.source, caption: summary.title || title });
  }

  return {
    title: summary?.title || title,
    description: summary?.description || "",
    extract: extract || summary?.extract || "",
    wikiUrl: summary?.content_urls?.desktop?.page || `https://${host}/wiki/${pageTitle}`,
    images,
  };
}

function loadMissions() {
  if (missionsCache) return missionsCache;
  const raw = readJson(MISSIONS_FILE(), { missions: [] });
  missionsCache = {
    updatedAt: raw.updatedAt || null,
    missions: Array.isArray(raw.missions) ? raw.missions : [],
  };
  return missionsCache;
}

function loadReports() {
  if (reportsCache) return reportsCache;
  const raw = readJson(REPORTS_FILE(), { reports: [] });
  reportsCache = {
    updatedAt: raw.updatedAt || null,
    reports: Array.isArray(raw.reports) ? raw.reports : [],
  };
  return reportsCache;
}

function loadPhysicsPack() {
  if (physicsCache) return physicsCache;
  physicsCache = readJson(PHYSICS_FILE(), { constants: {}, topics: [], bodies: [] });
  return physicsCache;
}

function listUapDocs() {
  const catalog = readJson(UAP_CATALOG_FILE(), { documents: [], externalOnly: [], note: "" });
  const dir = UAP_DOCS_DIR();
  const documents = (catalog.documents || []).map((doc) => {
    const filePath = path.join(dir, doc.file);
    const exists = fs.existsSync(filePath);
    let sizeBytes = 0;
    if (exists) {
      try {
        sizeBytes = fs.statSync(filePath).size;
      } catch {
        sizeBytes = 0;
      }
    }
    return { ...doc, exists, sizeBytes, sizeLabel: formatBytes(sizeBytes) };
  });
  return {
    note: catalog.note || "",
    title: catalog.title || "UAP documents",
    portals: catalog.officialPortals || [],
    documents,
    externalOnly: catalog.externalOnly || catalog.notObtainedYet || [],
    available: documents.filter((d) => d.exists).length,
  };
}

function resolveUapDocPath(id, fileName) {
  const catalog = readJson(UAP_CATALOG_FILE(), { documents: [] });
  const doc =
    (catalog.documents || []).find((d) => d.id === id) ||
    (catalog.documents || []).find((d) => d.file === fileName);
  if (!doc?.file) return null;
  const filePath = path.join(UAP_DOCS_DIR(), doc.file);
  if (!fs.existsSync(filePath)) return null;
  return filePath;
}

function formatBytes(n) {
  if (!n || n < 1) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function listMissions(filter = {}) {
  let list = [...loadMissions().missions];
  const status = filter.status;
  if (status && status !== "all") list = list.filter((m) => m.status === status);
  const type = filter.type;
  if (type && type !== "all") list = list.filter((m) => m.type === type);
  const q = String(filter.q || "")
    .trim()
    .toLowerCase();
  if (q) {
    list = list.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.target || "").toLowerCase().includes(q) ||
        (m.summary || "").toLowerCase().includes(q) ||
        (m.agency || "").toLowerCase().includes(q)
    );
  }
  return list;
}

function listReports(filter = {}) {
  let list = [...loadReports().reports];
  const cat = filter.category;
  if (cat && cat !== "all") list = list.filter((r) => r.category === cat);
  const q = String(filter.q || "")
    .trim()
    .toLowerCase();
  if (q) {
    list = list.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.summary || "").toLowerCase().includes(q) ||
        (r.tags || []).some((t) => t.includes(q))
    );
  }
  list.sort((a, b) => (b.year || 0) - (a.year || 0));
  return list;
}

function getMission(id) {
  return loadMissions().missions.find((m) => m.id === id) || null;
}

function getReport(id) {
  return loadReports().reports.find((r) => r.id === id) || null;
}

async function fetchNeoFeed(startDate, endDate) {
  const params = new URLSearchParams({ api_key: NASA_KEY, start_date: startDate, end_date: endDate });
  try {
    const data = await fetchJson(`https://api.nasa.gov/neo/rest/v1/feed?${params}`);
    return { feed: data, fromCache: false, cacheNote: "" };
  } catch {
    const fallback = readJson(NEO_FALLBACK_FILE(), null);
    if (fallback) {
      return {
        feed: fallback,
        fromCache: true,
        cacheNote: USING_DEMO_KEY
          ? "NASA NEO demo access is busy — showing bundled sample asteroids."
          : "NASA NEO API busy: showing bundled sample asteroids.",
      };
    }
    throw new Error("Near-Earth object feed unavailable.");
  }
}

async function fetchNasaImages(q, page = 1) {
  const query = encodeURIComponent(String(q || "nebula").trim() || "nebula");
  const url = `https://images-api.nasa.gov/search?q=${query}&media_type=image&page=${page}`;
  try {
    const data = await fetchJson(url);
    const items = (data.collection?.items || []).slice(0, 24).map((item) => {
      const meta = item.data?.[0] || {};
      const thumb = item.links?.find((l) => l.rel === "preview" || l.render === "image")?.href || "";
      const href = item.href || "";
      return {
        title: meta.title || "Untitled",
        nasaId: meta.nasa_id || "",
        date: meta.date_created || "",
        description: (meta.description || "").slice(0, 280),
        thumb,
        href,
        keywords: (meta.keywords || []).slice(0, 6),
      };
    });
    return { items, total: data.collection?.metadata?.total || items.length, fromCache: false, cacheNote: "" };
  } catch (err) {
    return {
      items: [],
      total: 0,
      fromCache: true,
      cacheNote: err.message || "NASA Image Library unavailable.",
    };
  }
}

async function fetchMarsPhotos(rover = "curiosity", sol = null) {
  const params = new URLSearchParams({ api_key: NASA_KEY });
  if (sol != null) params.set("sol", String(sol));
  const roverName = ["curiosity", "perseverance", "opportunity", "spirit"].includes(rover)
    ? rover
    : "curiosity";
  const url =
    sol != null
      ? `https://api.nasa.gov/mars-photos/api/v1/rovers/${roverName}/photos?${params}`
      : `https://api.nasa.gov/mars-photos/api/v1/rovers/${roverName}/latest_photos?${params}`;
  try {
    const data = await fetchJson(url);
    const photos = (data.photos || data.latest_photos || []).slice(0, 24).map((p) => ({
      id: p.id,
      sol: p.sol,
      camera: p.camera?.full_name || p.camera?.name || "",
      earthDate: p.earth_date,
      img: p.img_src,
      rover: p.rover?.name || roverName,
    }));
    return { photos, fromCache: false, cacheNote: "" };
  } catch {
    return {
      photos: [],
      fromCache: true,
      cacheNote: USING_DEMO_KEY
        ? "Mars photos via NASA demo access are busy or offline — try again in a bit."
        : "Mars rover API unavailable (rate limit or offline). Try again later.",
    };
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(iso, days) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function fetchApod(date) {
  try {
    const params = new URLSearchParams({ api_key: NASA_KEY });
    if (date) params.set("date", date);
    const data = await fetchJson(`https://api.nasa.gov/planetary/apod?${params}`);
    const apod = normalizeApod(data);
    writeJson(APOD_CACHE_FILE(), { updatedAt: Date.now(), apod });
    return { apod, fromCache: false, cacheNote: "" };
  } catch {
    const cached = readJson(APOD_CACHE_FILE(), null);
    if (cached?.apod) {
      return {
        apod: cached.apod,
        fromCache: true,
        cacheNote: USING_DEMO_KEY
          ? "NASA demo access is busy — showing your last saved picture."
          : "NASA servers are busy (503). Showing your last saved picture.",
      };
    }
    const fallback = readJson(APOD_FALLBACK_FILE(), null);
    if (fallback?.apod) {
      return {
        apod: fallback.apod,
        fromCache: true,
        cacheNote: "NASA API unavailable. Showing a bundled astronomy picture.",
      };
    }
    throw new Error("NASA APOD is temporarily unavailable. Try again in a few minutes.");
  }
}

function normalizeLogEntry(raw) {
  if (!raw?.bodyId) return null;
  return {
    id: String(raw.id || uid("log")),
    bodyId: String(raw.bodyId),
    name: String(raw.name || ""),
    category: String(raw.category || ""),
    notes: String(raw.notes || "").trim(),
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

function normalizeUserData(raw) {
  return {
    logbook: (Array.isArray(raw?.logbook) ? raw.logbook : []).map(normalizeLogEntry).filter(Boolean),
    settings: { wikiLang: raw?.settings?.wikiLang === "he" ? "he" : "en" },
    ocean: {
      exploredCells: Array.isArray(raw?.ocean?.exploredCells) ? raw.ocean.exploredCells.map(String) : [],
      discoveredSpecies: Array.isArray(raw?.ocean?.discoveredSpecies)
        ? raw.ocean.discoveredSpecies.map(String)
        : [],
    },
  };
}

function loadUserData() {
  return normalizeUserData(readJson(USER_FILE(), { logbook: [], settings: { wikiLang: "en" } }));
}

function saveUserData(data) {
  const normalized = normalizeUserData(data);
  writeJson(USER_FILE(), normalized);
  return normalized;
}

async function handleSpaceInvoke(channel, args) {
  const authErr = signedInGuard();
  if (authErr) return authErr;
  try {
    if (channel === "catalog.list") {
      const bodies = listBodies(args || {});
      const catalog = loadCatalog();
      return { ok: true, bodies, updatedAt: catalog.updatedAt };
    }

    if (channel === "wiki.get") {
      const title = String(args?.title || "").trim();
      if (!title) return { ok: false, error: "Missing title" };
      let lang = "en";
      try {
        lang = loadUserData().settings.wikiLang || "en";
      } catch {
        /* ignore */
      }
      try {
        const wiki = await fetchWikiEnrichment(title, lang);
        return { ok: true, wiki };
      } catch (err) {
        return { ok: false, error: err.message || "Wikipedia unavailable" };
      }
    }

    if (channel === "catalog.get") {
      const id = String(args?.id || "");
      const skipWiki = Boolean(args?.skipWiki);

      if (id.startsWith("star_")) {
        const star = getStar(id);
        if (!star) return { ok: false, error: "Star not found" };
        const body = starToBody(star);
        let wiki = null;
        if (!skipWiki && body.wikiTitle) {
          try {
            let lang = "en";
            try {
              lang = loadUserData().settings.wikiLang || "en";
            } catch {
              /* ignore */
            }
            wiki = await fetchWikiEnrichment(body.wikiTitle, lang);
          } catch {
            wiki = null;
          }
        }
        return { ok: true, body, children: [], wiki };
      }

      const body = getBody(id);
      if (!body) return { ok: false, error: "Object not found" };
      const children = loadCatalog().bodies.filter((b) => b.parent === body.id);
      let wiki = null;
      if (!skipWiki && body.wikiTitle) {
        try {
          let lang = "en";
          try {
            lang = loadUserData().settings.wikiLang || "en";
          } catch {
            /* ignore */
          }
          wiki = await fetchWikiEnrichment(body.wikiTitle, lang);
        } catch {
          wiki = null;
        }
      }
      return { ok: true, body, children, wiki };
    }

    if (channel === "catalog.solar") {
      const bodies = loadCatalog().bodies.filter((b) =>
        ["sun", "planet", "dwarf"].includes(b.category)
      );
      return { ok: true, bodies };
    }

    if (channel === "stars.field") {
      const data = loadStars();
      return { ok: true, stars: data.stars, count: data.count };
    }

    if (channel === "stars.get") {
      const star = getStar(String(args?.id || ""));
      if (!star) return { ok: false, error: "Star not found" };
      const lang = args?.wikiLang || loadUserData().settings.wikiLang || "en";
      const body = starToBody(star);
      let wiki = null;
      if (body.wikiTitle) {
        try {
          wiki = await fetchWikiEnrichment(body.wikiTitle, lang);
        } catch {
          wiki = null;
        }
      }
      return { ok: true, star, body, wiki };
    }

    if (channel === "ocean.field") {
      const data = loadOcean();
      const user = loadUserData();
      return {
        ok: true,
        creatures: data.creatures,
        count: data.count,
        worldKm: data.worldKm,
        speciesCount: data.species.length,
        progress: user.ocean,
      };
    }

    if (channel === "ocean.progress.save") {
      const user = loadUserData();
      user.ocean = {
        exploredCells: Array.isArray(args?.exploredCells) ? args.exploredCells : user.ocean.exploredCells,
        discoveredSpecies: Array.isArray(args?.discoveredSpecies)
          ? args.discoveredSpecies
          : user.ocean.discoveredSpecies,
      };
      return { ok: true, data: saveUserData(user) };
    }

    if (channel === "ocean.get") {
      const creature = getCreature(String(args?.id || ""));
      if (!creature) return { ok: false, error: "Creature not found" };
      const lang = args?.wikiLang || loadUserData().settings.wikiLang || "en";
      const body = creatureToBody(creature);
      let wiki = null;
      if (body.wikiTitle) {
        try {
          wiki = await fetchWikiEnrichment(body.wikiTitle, lang);
        } catch {
          wiki = null;
        }
      }
      return { ok: true, creature, body, wiki };
    }

    if (channel === "earth.field") {
      const data = loadEarth();
      return {
        ok: true,
        countries: data.countries,
        cities: data.cities,
        places: data.places,
        oceanSites: data.oceanSites,
        countryCount: data.countryCount,
        cityCount: data.cityCount,
        placeCount: data.placeCount,
        kmPerDeg: data.kmPerDeg,
      };
    }

    if (channel === "earth.get") {
      const lang = args?.wikiLang || loadUserData().settings.wikiLang || "en";
      const earth = loadEarth();
      const kind = args?.kind || "country";
      let body = null;
      if (kind === "country" || String(args?.id || "").startsWith("country_")) {
        const code = args?.code || String(args?.id || "").replace(/^country_/, "");
        const c = getEarthCountry(code);
        if (!c) return { ok: false, error: "Country not found" };
        body = countryToBody(c);
      } else if (kind === "city" || String(args?.id || "").startsWith("city_")) {
        const city = earth.cities.find((x) => x.id === args?.id);
        if (!city) return { ok: false, error: "City not found" };
        body = cityToBody(city, getEarthCountry(city.country));
      } else if (kind === "place" || String(args?.id || "").startsWith("place_")) {
        const place = earth.places.find((x) => x.id === args?.id);
        if (!place) return { ok: false, error: "Place not found" };
        body = placeToBody(place, getEarthCountry(place.country));
      } else {
        return { ok: false, error: "Unknown earth entity" };
      }
      let wiki = null;
      if (body.wikiTitle) {
        try {
          wiki = await fetchWikiEnrichment(body.wikiTitle, lang);
        } catch {
          wiki = null;
        }
      }
      return { ok: true, body, wiki };
    }

    if (channel === "nasa.status") {
      return withNasaMeta({ ok: true });
    }

    if (channel === "apod.today") {
      const result = await fetchApod(args?.date);
      return withNasaMeta({ ok: true, ...result });
    }

    if (channel === "nasa.missions.list") {
      const missions = listMissions(args || {});
      return withNasaMeta({
        ok: true,
        missions,
        count: missions.length,
        updatedAt: loadMissions().updatedAt,
      });
    }

    if (channel === "nasa.missions.get") {
      const mission = getMission(String(args?.id || ""));
      if (!mission) return { ok: false, error: "Mission not found" };
      const linkedReport = mission.links?.reportId ? getReport(mission.links.reportId) : null;
      return { ok: true, mission, linkedReport };
    }

    if (channel === "nasa.reports.list") {
      const reports = listReports(args || {});
      return { ok: true, reports, count: reports.length, updatedAt: loadReports().updatedAt };
    }

    if (channel === "nasa.reports.get") {
      const report = getReport(String(args?.id || ""));
      if (!report) return { ok: false, error: "Report not found" };
      const linkedMission = report.missionId ? getMission(report.missionId) : null;
      return { ok: true, report, linkedMission };
    }

    if (channel === "physics.pack") {
      return { ok: true, pack: loadPhysicsPack() };
    }

    if (channel === "nasa.neo.feed") {
      const end = String(args?.endDate || todayIso());
      const start = String(args?.startDate || addDaysIso(end, -6));
      const result = await fetchNeoFeed(start, end);
      return withNasaMeta({ ok: true, ...result, startDate: start, endDate: end });
    }

    if (channel === "nasa.images.search") {
      const result = await fetchNasaImages(args?.q, args?.page || 1);
      return withNasaMeta({ ok: true, ...result });
    }

    if (channel === "nasa.mars.photos") {
      const result = await fetchMarsPhotos(args?.rover, args?.sol);
      return withNasaMeta({ ok: true, ...result });
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

    if (channel === "aliens.hub") {
      const hub = readJson(ALIENS_HUB_FILE(), null);
      if (!hub) return { ok: false, error: "Aliens hub content missing" };
      return { ok: true, hub };
    }

    if (channel === "uap.docs.list") {
      return { ok: true, ...listUapDocs() };
    }

    if (channel === "uap.docs.open") {
      const filePath = resolveUapDocPath(args?.id, args?.file);
      if (!filePath) return { ok: false, error: "Document not found" };
      const err = await shell.openPath(filePath);
      if (err) return { ok: false, error: err };
      return { ok: true, path: filePath };
    }

    if (channel === "uap.docs.reveal") {
      const filePath = resolveUapDocPath(args?.id, args?.file);
      if (!filePath) return { ok: false, error: "Document not found" };
      shell.showItemInFolder(filePath);
      return { ok: true, path: filePath };
    }

    if (channel === "uap.docs.saveCopy") {
      const filePath = resolveUapDocPath(args?.id, args?.file);
      if (!filePath) return { ok: false, error: "Document not found" };
      const destDir = app.getPath("downloads");
      const base = path.basename(filePath);
      let dest = path.join(destDir, base);
      if (fs.existsSync(dest)) {
        const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const ext = path.extname(base);
        const stem = path.basename(base, ext);
        dest = path.join(destDir, `${stem}-${stamp}${ext}`);
      }
      fs.copyFileSync(filePath, dest);
      shell.showItemInFolder(dest);
      return { ok: true, path: dest, folder: destDir };
    }

    return { ok: false, error: `Unknown channel: ${channel}` };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

module.exports = { handleSpaceInvoke };