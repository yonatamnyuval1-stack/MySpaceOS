const path = require("path");
const fs = require("fs");

const V5_BASE = "https://api.restcountries.com/countries/v5";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const LIST_FIELDS = [
  "names.common",
  "names.official",
  "codes.alpha_2",
  "codes.alpha_3",
  "capitals",
  "region",
  "subregion",
  "continents",
  "population",
  "area.kilometers",
  "flag.url_png",
  "coordinates.lat",
  "coordinates.lng",
  "memberships.un",
].join(",");

function projectRoot() {
  return path.join(__dirname, "..", "..");
}

function getApiKey() {
  if (process.env.RESTCOUNTRIES_API_KEY) return process.env.RESTCOUNTRIES_API_KEY.trim();
  try {
    const cfg = path.join(projectRoot(), "config", "user-config.json");
    if (fs.existsSync(cfg)) {
      const data = JSON.parse(fs.readFileSync(cfg, "utf8"));
      const key = data?.geography?.restcountriesApiKey || data?.restcountriesApiKey;
      if (key) return String(key).trim();
    }
  } catch {
  }
  return "";
}

function getPath(obj, dotted) {
  if (!obj) return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, dotted)) return obj[dotted];
  return dotted.split(".").reduce((cur, part) => (cur == null ? undefined : cur[part]), obj);
}

function pickNativeNameV5(raw) {
  const native = getPath(raw, "names.native");
  if (!native || typeof native !== "object") return "";
  const first = Object.values(native)[0];
  return first?.official || first?.common || "";
}

function normalizeLanguages(raw) {
  if (Array.isArray(raw)) {
    return raw
      .map((l) => ({
        code: l.iso639_1 || l.iso639_3 || l.bcp47 || "",
        name: l.name || l.native_name || "",
      }))
      .filter((l) => l.name);
  }
  if (raw && typeof raw === "object") {
    return Object.entries(raw).map(([code, name]) => ({
      code,
      name: typeof name === "string" ? name : name?.name || "",
    }));
  }
  return [];
}

function normalizeCurrencies(raw) {
  if (Array.isArray(raw)) {
    return raw
      .map((c) => ({
        code: c.code || "",
        name: c.name || "",
        symbol: c.symbol || "",
      }))
      .filter((c) => c.name || c.code);
  }
  if (raw && typeof raw === "object") {
    return Object.entries(raw).map(([code, c]) => ({
      code,
      name: c?.name || "",
      symbol: c?.symbol || "",
    }));
  }
  return [];
}

function normalizeFromV3(raw, full = false) {
  if (!raw?.cca3) return null;
  const langs = raw.languages
    ? Object.entries(raw.languages).map(([code, name]) => ({ code, name }))
    : [];
  const currencies = raw.currencies
    ? Object.entries(raw.currencies).map(([code, c]) => ({
        code,
        name: c.name,
        symbol: c.symbol || "",
      }))
    : [];
  const base = {
    code: raw.cca3,
    code2: raw.cca2,
    name: raw.name?.common || raw.cca3,
    officialName: raw.name?.official || raw.name?.common || "",
    nativeName: pickNativeNameV3(raw.name),
    capital: raw.capital?.[0] || "",
    capitals: raw.capital || [],
    region: raw.region || "",
    subregion: raw.subregion || "",
    continents: raw.continents || [],
    population: raw.population || 0,
    area: raw.area || 0,
    density: raw.area ? Math.round(raw.population / raw.area) : 0,
    flag: raw.flags?.png || raw.flags?.svg || "",
    flagSvg: raw.flags?.svg || "",
    coatOfArms: raw.coatOfArms?.png || raw.coatOfArms?.svg || "",
    latlng: raw.latlng || [],
    landlocked: Boolean(raw.landlocked),
    borders: raw.borders || [],
    unMember: raw.unMember !== false,
    independent: raw.independent !== false,
    status: raw.status || "",
    timezones: raw.timezones || [],
    languages: langs,
    currencies,
    tld: raw.tld || [],
    demonyms: raw.demonym || raw.demonyms?.eng?.m || "",
    startOfWeek: raw.startOfWeek || "",
    car: raw.car || null,
    idd: raw.idd || null,
    fifa: raw.fifa || "",
    cioc: raw.cioc || "",
    maps: raw.maps || {},
    wikiTitle: raw.name?.common || "",
  };
  if (!full) {
    return {
      code: base.code,
      code2: base.code2,
      name: base.name,
      officialName: base.officialName,
      capital: base.capital,
      region: base.region,
      subregion: base.subregion,
      continents: base.continents,
      population: base.population,
      area: base.area,
      flag: base.flag,
      latlng: base.latlng,
      unMember: base.unMember,
    };
  }
  return base;
}

function pickNativeNameV3(nameObj) {
  if (!nameObj?.nativeName) return "";
  const first = Object.values(nameObj.nativeName)[0];
  return first?.official || first?.common || "";
}

function normalizeFromV5(raw, full = false) {
  const code = getPath(raw, "codes.alpha_3");
  if (!code) return null;
  const capitals = Array.isArray(raw.capitals) ? raw.capitals : [];
  const capitalName = capitals[0]?.name || capitals[0] || "";
  const lat = getPath(raw, "coordinates.lat");
  const lng = getPath(raw, "coordinates.lng");
  const area = getPath(raw, "area.kilometers") ?? raw.area?.kilometers ?? 0;
  const population = raw.population || 0;
  const links = raw.links || {};
  const callingCodes = raw.calling_codes || [];
  const idd =
    callingCodes.length > 0
      ? { root: callingCodes[0].startsWith("+") ? callingCodes[0] : `+${callingCodes[0]}`, suffixes: [] }
      : null;

  const base = {
    code,
    code2: getPath(raw, "codes.alpha_2") || "",
    name: getPath(raw, "names.common") || code,
    officialName: getPath(raw, "names.official") || getPath(raw, "names.common") || "",
    nativeName: pickNativeNameV5(raw),
    capital: capitalName,
    capitals: capitals.map((c) => (typeof c === "string" ? c : c.name)).filter(Boolean),
    region: raw.region || "",
    subregion: raw.subregion || "",
    continents: raw.continents || [],
    population,
    area,
    density: area ? Math.round(population / area) : 0,
    flag: getPath(raw, "flag.url_png") || raw.flag?.url_png || "",
    flagSvg: getPath(raw, "flag.url_svg") || raw.flag?.url_svg || "",
    coatOfArms: raw.coat_of_arms?.png || raw.coat_of_arms?.svg || "",
    latlng: lat != null && lng != null ? [lat, lng] : [],
    landlocked: Boolean(raw.landlocked),
    borders: raw.borders || [],
    unMember: raw.memberships?.un !== false,
    independent: true,
    status: "",
    timezones: raw.timezones || [],
    languages: normalizeLanguages(raw.languages),
    currencies: normalizeCurrencies(raw.currencies),
    tld: raw.tlds || [],
    demonyms: raw.demonyms?.eng?.m || "",
    startOfWeek: raw.start_of_week || "",
    car: raw.cars ? { side: raw.cars.driving_side, signs: raw.cars.signs || [] } : null,
    idd,
    fifa: getPath(raw, "codes.fifa") || "",
    cioc: getPath(raw, "codes.cioc") || "",
    maps: {
      googleMaps: links.google_maps || "",
      openStreetMaps: links.open_street_maps || "",
    },
    wikiTitle: getPath(raw, "names.common") || "",
  };
  if (!full) {
    return {
      code: base.code,
      code2: base.code2,
      name: base.name,
      officialName: base.officialName,
      capital: base.capital,
      region: base.region,
      subregion: base.subregion,
      continents: base.continents,
      population: base.population,
      area: base.area,
      flag: base.flag,
      latlng: base.latlng,
      unMember: base.unMember,
    };
  }
  return base;
}

function regionToContinents(region) {
  const map = {
    Africa: ["Africa"],
    Americas: ["North America", "South America"],
    Asia: ["Asia"],
    Europe: ["Europe"],
    Oceania: ["Oceania"],
    Antarctic: ["Antarctica"],
  };
  return map[region] || (region ? [region] : []);
}

function normalizeFromBundled(raw, full = false) {
  if (!raw?.code) return null;
  const latlng = raw.lat != null && raw.lon != null ? [raw.lat, raw.lon] : [];
  const base = {
    code: raw.code,
    code2: raw.code2 || "",
    name: raw.name || raw.code,
    officialName: raw.officialName || raw.name || "",
    nativeName: "",
    capital: raw.capital || "",
    capitals: raw.capital ? [raw.capital] : [],
    region: raw.region || "",
    subregion: raw.subregion || "",
    continents: raw.continents || regionToContinents(raw.region),
    population: raw.population || 0,
    area: raw.area || 0,
    density: raw.area ? Math.round((raw.population || 0) / raw.area) : 0,
    flag: raw.flag || raw.image || "",
    flagSvg: "",
    coatOfArms: "",
    latlng,
    landlocked: false,
    borders: raw.borders || [],
    unMember: true,
    independent: true,
    status: "",
    timezones: raw.timezones || [],
    languages: raw.languages || [],
    currencies: raw.currencies || [],
    tld: raw.tld || [],
    demonyms: "",
    startOfWeek: "",
    car: null,
    idd: null,
    fifa: "",
    cioc: "",
    maps: raw.maps || {},
    wikiTitle: raw.wikiTitle || raw.name || "",
  };
  if (!full) {
    return {
      code: base.code,
      code2: base.code2,
      name: base.name,
      officialName: base.officialName,
      capital: base.capital,
      region: base.region,
      subregion: base.subregion,
      continents: base.continents,
      population: base.population,
      area: base.area,
      flag: base.flag,
      latlng: base.latlng,
      unMember: base.unMember,
    };
  }
  return base;
}

function loadBundledCountries() {
  const file = path.join(projectRoot(), "data", "space-earth.json");
  try {
    if (!fs.existsSync(file)) return null;
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(data.countries) ? data.countries : null;
  } catch {
    return null;
  }
}

async function fetchJson(url, headers = {}) {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...headers },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = body?.errors?.[0]?.message || body?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body;
}

function isDeprecatedPayload(body) {
  return body && !Array.isArray(body) && body.success === false && body.data == null;
}

async function fetchV5Page(offset, limit, apiKey) {
  const url =
    `${V5_BASE}?limit=${limit}&offset=${offset}` +
    `&response_fields=${encodeURIComponent(LIST_FIELDS)}`;
  const body = await fetchJson(url, { Authorization: `Bearer ${apiKey}` });
  if (body?.errors?.length) throw new Error(body.errors[0].message);
  return body?.data || {};
}

async function fetchAllCountriesV5(apiKey) {
  const all = [];
  const limit = 100;
  let offset = 0;
  for (let page = 0; page < 10; page++) {
    const data = await fetchV5Page(offset, limit, apiKey);
    const objects = data.objects || [];
    all.push(...objects);
    if (!data.meta?.more && objects.length < limit) break;
    offset += limit;
    if (!objects.length) break;
  }
  return all.map((c) => normalizeFromV5(c, false)).filter(Boolean);
}

async function fetchCountryDetailV5(code, apiKey) {
  const url = `${V5_BASE}/codes.alpha_3/${encodeURIComponent(code)}`;
  const body = await fetchJson(url, { Authorization: `Bearer ${apiKey}` });
  if (body?.errors?.length) throw new Error(body.errors[0].message);
  const item = body?.data?.objects?.[0];
  if (!item) throw new Error("Country not found");
  return normalizeFromV5(item, true);
}

async function fetchAllCountries() {
  const apiKey = getApiKey();
  if (apiKey) {
    try {
      const countries = await fetchAllCountriesV5(apiKey);
      if (countries.length) {
        countries.sort((a, b) => a.name.localeCompare(b.name));
        return { countries, source: "api-v5" };
      }
    } catch {
    }
  }

  try {
    const fields = [
      "name",
      "cca2",
      "cca3",
      "capital",
      "region",
      "subregion",
      "continents",
      "population",
      "area",
      "flags",
    ].join(",");
    const raw = await fetchJson(`https://restcountries.com/v3.1/all?fields=${fields}`);
    if (Array.isArray(raw)) {
      const countries = raw.map((c) => normalizeFromV3(c, false)).filter(Boolean);
      countries.sort((a, b) => a.name.localeCompare(b.name));
      return { countries, source: "api-v3" };
    }
    if (isDeprecatedPayload(raw)) {
      const msg = raw.errors?.[0]?.message || "REST Countries v3.1 is deprecated";
      throw new Error(msg);
    }
    throw new Error("Unexpected country list response from REST Countries");
  } catch {
  }

  const bundled = loadBundledCountries();
  if (bundled?.length) {
    const countries = bundled.map((c) => normalizeFromBundled(c, false)).filter(Boolean);
    countries.sort((a, b) => a.name.localeCompare(b.name));
    return { countries, source: "bundled" };
  }

  throw new Error(
    "Country data unavailable. Add a REST Countries v5 API key (RESTCOUNTRIES_API_KEY) or ensure data/space-earth.json exists."
  );
}

async function fetchCountryDetail(code) {
  const upper = String(code || "").toUpperCase();
  if (!upper) throw new Error("Missing country code");

  const apiKey = getApiKey();
  if (apiKey) {
    try {
      return await fetchCountryDetailV5(upper, apiKey);
    } catch {
    }
  }

  try {
    const raw = await fetchJson(`https://restcountries.com/v3.1/alpha/${encodeURIComponent(upper)}`);
    const item = Array.isArray(raw) ? raw[0] : isDeprecatedPayload(raw) ? null : raw;
    if (item?.cca3) return normalizeFromV3(item, true);
  } catch {
  }

  const bundled = loadBundledCountries();
  const match = bundled?.find((c) => c.code === upper || c.code2 === upper);
  if (match) return normalizeFromBundled(match, true);

  throw new Error("Country not found");
}

module.exports = {
  fetchAllCountries,
  fetchCountryDetail,
  normalizeFromV3,
  normalizeFromBundled,
  getApiKey,
};
