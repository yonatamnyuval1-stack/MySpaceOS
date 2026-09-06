const fs = require("fs");
const path = require("path");
const CATALOG = require("./earth-places-catalog");
const CATALOG_B = require("./earth-places-catalog-b");

const OUT = path.join(__dirname, "..", "data", "space-earth.json");
const KM_PER_DEG = 111.32;
const SKIP_IMAGES = process.argv.includes("--no-images");
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const GEO_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";

const OCEAN_SITES = [
  { id: "mediterranean", name: "Mediterranean", lon: 18, lat: 35, oceanRegion: "shallow_reef" },
  { id: "atlantic", name: "Atlantic", lon: -30, lat: 30, oceanRegion: "open_pacific" },
  { id: "caribbean", name: "Caribbean", lon: -75, lat: 18, oceanRegion: "shallow_reef" },
  { id: "pacific", name: "Pacific", lon: -155, lat: 5, oceanRegion: "open_pacific" },
  { id: "indian", name: "Indian Ocean", lon: 75, lat: -5, oceanRegion: "open_pacific" },
  { id: "north_sea", name: "North Sea", lon: 3, lat: 56, oceanRegion: "kelp_coast" },
  { id: "great_barrier", name: "Coral Sea", lon: 148, lat: -18, oceanRegion: "shallow_reef" },
  { id: "japan_trench", name: "Pacific Deep", lon: 142, lat: 38, oceanRegion: "deep_trench" },
];

const MEGA_CITIES = [
  ["Tokyo", "JPN", 139.6917, 35.6895, 13960000],
  ["Delhi", "IND", 77.209, 28.6139, 32900000],
  ["Shanghai", "CHN", 121.4737, 31.2304, 24800000],
  ["São Paulo", "BRA", -46.6333, -23.55, 22400000],
  ["Mexico City", "MEX", -99.1332, 19.4326, 21800000],
  ["Cairo", "EGY", 31.2357, 30.0444, 21300000],
  ["Mumbai", "IND", 72.8777, 19.076, 20700000],
  ["Beijing", "CHN", 116.4074, 39.9042, 20400000],
  ["Dhaka", "BGD", 90.4125, 23.8103, 22000000],
  ["Osaka", "JPN", 135.5022, 34.6937, 19000000],
  ["New York", "USA", -74.006, 40.7128, 18800000],
  ["Karachi", "PAK", 67.0099, 24.8607, 16800000],
  ["Buenos Aires", "ARG", -58.3816, -34.6037, 15300000],
  ["Istanbul", "TUR", 28.9784, 41.0082, 15600000],
  ["Kolkata", "IND", 88.3639, 22.5726, 15000000],
  ["Manila", "PHL", 120.9842, 14.5995, 14400000],
  ["Lagos", "NGA", 3.3792, 6.5244, 15300000],
  ["Rio de Janeiro", "BRA", -43.1729, -22.9068, 13500000],
  ["Paris", "FRA", 2.3522, 48.8566, 11000000],
  ["London", "GBR", -0.1276, 51.5074, 9500000],
  ["Los Angeles", "USA", -118.2437, 34.0522, 12500000],
  ["Moscow", "RUS", 37.6173, 55.7558, 12500000],
  ["Chicago", "USA", -87.6298, 41.8781, 8900000],
  ["Bogotá", "COL", -74.0721, 4.711, 11000000],
  ["Jakarta", "IDN", 106.8456, -6.2088, 11000000],
  ["Lima", "PER", -77.0428, -12.0464, 11000000],
  ["Bangkok", "THA", 100.5018, 13.7563, 10500000],
  ["Seoul", "KOR", 126.978, 37.5665, 9700000],
  ["Nairobi", "KEN", 36.8219, -1.2921, 5000000],
  ["Sydney", "AUS", 151.2093, -33.8688, 5300000],
  ["Toronto", "CAN", -79.3832, 43.6532, 6200000],
  ["Dubai", "ARE", 55.2708, 25.2048, 3600000],
  ["Singapore", "SGP", 103.8198, 1.3521, 5900000],
  ["Hong Kong", "HKG", 114.1694, 22.3193, 7500000],
  ["Taipei", "TWN", 121.5654, 25.033, 7000000],
  ["Berlin", "DEU", 13.405, 52.52, 3700000],
  ["Madrid", "ESP", -3.7038, 40.4168, 6800000],
  ["Rome", "ITA", 12.4964, 41.9028, 4300000],
  ["Barcelona", "ESP", 2.1734, 41.3851, 5600000],
  ["Amsterdam", "NLD", 4.9041, 52.3676, 2500000],
  ["Vienna", "AUT", 16.3738, 48.2082, 2000000],
  ["Prague", "CZE", 14.4378, 50.0755, 1300000],
  ["Warsaw", "POL", 21.0122, 52.2297, 3100000],
  ["Athens", "GRC", 23.7275, 37.9838, 3200000],
  ["Lisbon", "PRT", -9.1393, 38.7223, 2900000],
  ["Stockholm", "SWE", 18.0686, 59.3293, 1700000],
  ["Oslo", "NOR", 10.7522, 59.9139, 1100000],
  ["Copenhagen", "DNK", 12.5683, 55.6761, 1400000],
  ["Helsinki", "FIN", 24.9384, 60.1699, 1300000],
  ["Dublin", "IRL", -6.2603, 53.3498, 1400000],
  ["Brussels", "BEL", 4.3517, 50.8503, 1200000],
  ["Zurich", "CHE", 8.5417, 47.3769, 1400000],
  ["Geneva", "CHE", 6.1432, 46.2044, 500000],
  ["Munich", "DEU", 11.582, 48.1351, 1500000],
  ["Hamburg", "DEU", 9.9937, 53.5511, 1900000],
  ["Milan", "ITA", 9.19, 45.4642, 1400000],
  ["Naples", "ITA", 14.2681, 40.8518, 2100000],
  ["Venice", "ITA", 12.3155, 45.4408, 250000],
  ["Florence", "ITA", 11.2558, 43.7696, 380000],
  ["Kyoto", "JPN", 135.7681, 35.0116, 1400000],
  ["Hiroshima", "JPN", 132.4553, 34.3853, 1200000],
  ["Vancouver", "CAN", -123.1207, 49.2827, 2600000],
  ["Montreal", "CAN", -73.5673, 45.5017, 4200000],
  ["San Francisco", "USA", -122.4194, 37.7749, 4700000],
  ["Washington", "USA", -77.0369, 38.9072, 5200000],
  ["Boston", "USA", -71.0589, 42.3601, 4900000],
  ["Miami", "USA", -80.1918, 25.7617, 6200000],
  ["Houston", "USA", -95.3698, 29.7604, 7100000],
  ["Dallas", "USA", -96.797, 32.7767, 7600000],
  ["Philadelphia", "USA", -75.1652, 39.9526, 6100000],
  ["Seattle", "USA", -122.3321, 47.6062, 4000000],
  ["Las Vegas", "USA", -115.1398, 36.1699, 2700000],
  ["Denver", "USA", -104.9903, 39.7392, 2900000],
  ["Atlanta", "USA", -84.388, 33.749, 6100000],
  ["Phoenix", "USA", -112.074, 33.4484, 5000000],
  ["San Diego", "USA", -117.1611, 32.7157, 3300000],
  ["Austin", "USA", -97.7431, 30.2672, 2400000],
  ["New Orleans", "USA", -90.0715, 29.9511, 1000000],
  ["Honolulu", "USA", -157.8583, 21.3069, 1000000],
  ["Melbourne", "AUS", 144.9631, -37.8136, 5300000],
  ["Brisbane", "AUS", 153.0251, -27.4698, 2500000],
  ["Perth", "AUS", 115.8605, -31.9505, 2200000],
  ["Auckland", "NZL", 174.7633, -36.8485, 1700000],
  ["Wellington", "NZL", 174.7762, -41.2865, 420000],
  ["Johannesburg", "ZAF", 28.0473, -26.2041, 5600000],
  ["Cape Town", "ZAF", 18.4241, -33.9249, 4800000],
  ["Casablanca", "MAR", -7.5898, 33.5731, 3700000],
  ["Marrakech", "MAR", -7.9811, 31.6295, 1000000],
  ["Nairobi", "KEN", 36.8219, -1.2921, 5000000],
  ["Addis Ababa", "ETH", 38.7578, 8.9806, 5000000],
  ["Accra", "GHA", -0.187, 5.6037, 2500000],
  ["Lagos", "NGA", 3.3792, 6.5244, 15300000],
  ["Kinshasa", "COD", 15.2663, -4.4419, 15000000],
  ["Lusaka", "ZMB", 28.3228, -15.3875, 2500000],
  ["Harare", "ZWE", 31.0335, -17.8252, 1600000],
  ["Riyadh", "SAU", 46.6753, 24.7136, 7700000],
  ["Jeddah", "SAU", 39.1925, 21.4858, 4700000],
  ["Tehran", "IRN", 51.389, 35.6892, 9000000],
  ["Baghdad", "IRQ", 44.3661, 33.3152, 8100000],
  ["Damascus", "SYR", 36.2765, 33.5138, 2500000],
  ["Beirut", "LBN", 35.5018, 33.8938, 2200000],
  ["Amman", "JOR", 35.9106, 31.9539, 4100000],
  ["Jerusalem", "ISR", 35.2137, 31.7683, 900000],
  ["Tel Aviv", "ISR", 34.7818, 32.0853, 4600000],
  ["Doha", "QAT", 51.531, 25.2854, 2400000],
  ["Kuwait City", "KWT", 47.9774, 29.3759, 3200000],
  ["Muscat", "OMN", 58.4059, 23.588, 1600000],
  ["Baku", "AZE", 49.8671, 40.4093, 2300000],
  ["Tbilisi", "GEO", 44.8271, 41.7151, 1200000],
  ["Yerevan", "ARM", 44.5152, 40.1792, 1100000],
  ["Almaty", "KAZ", 76.8512, 43.222, 2000000],
  ["Tashkent", "UZB", 69.2401, 41.2995, 2500000],
  ["Bishkek", "KGZ", 74.5698, 42.8746, 1100000],
  ["Ulaanbaatar", "MNG", 106.9057, 47.8864, 1500000],
  ["Kathmandu", "NPL", 85.324, 27.7172, 1500000],
  ["Colombo", "LKA", 79.8612, 6.9271, 750000],
  ["Hanoi", "VNM", 105.8342, 21.0278, 5100000],
  ["Ho Chi Minh City", "VNM", 106.6297, 10.8231, 9300000],
  ["Phnom Penh", "KHM", 104.916, 11.5564, 2300000],
  ["Vientiane", "LAO", 102.6331, 17.9757, 820000],
  ["Yangon", "MMR", 96.1951, 16.8661, 5500000],
  ["Kuala Lumpur", "MYS", 101.6869, 3.139, 8200000],
  ["Jakarta", "IDN", 106.8456, -6.2088, 11000000],
  ["Surabaya", "IDN", 112.7521, -7.2575, 3000000],
  ["Bali Denpasar", "IDN", 115.2126, -8.6705, 900000],
  ["Manila", "PHL", 120.9842, 14.5995, 14400000],
  ["Cebu", "PHL", 123.8854, 10.3157, 1000000],
  ["Taipei", "TWN", 121.5654, 25.033, 7000000],
  ["Macau", "MAC", 113.5439, 22.1987, 680000],
  ["Ulaanbaatar", "MNG", 106.9057, 47.8864, 1500000],
  ["Vladivostok", "RUS", 131.8855, 43.1198, 600000],
  ["Saint Petersburg", "RUS", 30.3351, 59.9343, 5400000],
  ["Novosibirsk", "RUS", 82.9346, 55.0084, 1600000],
  ["Yekaterinburg", "RUS", 60.5975, 56.8389, 1500000],
  ["Havana", "CUB", -82.3666, 23.1136, 2100000],
  ["San Juan", "PRI", -66.1057, 18.4655, 320000],
  ["Panama City", "PAN", -79.5199, 8.9824, 1900000],
  ["San José", "CRI", -84.0907, 9.9281, 1400000],
  ["Guatemala City", "GTM", -90.5069, 14.6349, 3000000],
  ["Quito", "ECU", -78.4678, -0.1807, 2800000],
  ["Caracas", "VEN", -66.9036, 10.4806, 2900000],
  ["Montevideo", "URY", -56.1645, -34.9011, 1900000],
  ["Asunción", "PRY", -57.5759, -25.2637, 520000],
  ["La Paz", "BOL", -68.1193, -16.4897, 800000],
  ["Santiago", "CHL", -70.6693, -33.4489, 6800000],
  ["Valparaíso", "CHL", -71.6127, -33.0472, 1000000],
];

function parseCatalog(rows) {
  return rows.map((r) => ({
    id: `place_${r[0]}`,
    name: r[1],
    country: r[2],
    city: r[3],
    lon: r[4],
    lat: r[5],
    type: r[6],
    wikiTitle: r[7],
  }));
}

function placesFromCatalogCities(cityList, countryByCode) {
  const out = [];
  const seen = new Set();
  for (const c of cityList) {
    if ((c.population || 0) < 150000 && !c.capital) continue;
    const key = `${c.country}_${c.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const country = countryByCode[c.country];
    out.push({
      id: `place_center_${c.id}`,
      name: `${c.name} city center`,
      country: c.country,
      city: c.name,
      lon: c.lon,
      lat: c.lat,
      type: "street",
      wikiTitle: c.name,
      image: country?.flag || "",
    });
  }
  return out;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWikiThumb(title) {
  const page = encodeURIComponent(String(title).replace(/ /g, "_"));
  try {
    const s = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${page}`);
    return s.thumbnail?.source || null;
  } catch {
    return null;
  }
}

async function enrichImages(items, label) {
  if (SKIP_IMAGES) return;
  console.log(`Fetching Wikipedia images for ${items.length} ${label}…`);
  let done = 0;
  for (const item of items) {
    if (!item.wikiTitle && !item.name) continue;
    if (!item.image) item.image = await fetchWikiThumb(item.wikiTitle || item.name);
    done++;
    if (done % 8 === 0) process.stdout.write(`  ${label}: ${done}/${items.length}\r`);
    await sleep(120);
  }
  console.log(`  ${label}: done (${done})`);
}

function simplifyRing(ring, maxPts = 18) {
  if (!ring?.length) return [];
  if (ring.length <= maxPts) return ring.map(([lon, lat]) => [Math.round(lon * 1000) / 1000, Math.round(lat * 1000) / 1000]);
  const out = [];
  const step = Math.max(1, Math.floor(ring.length / maxPts));
  for (let i = 0; i < ring.length; i += step) out.push([Math.round(ring[i][0] * 1000) / 1000, Math.round(ring[i][1] * 1000) / 1000]);
  return out;
}

function simplifyGeometry(geom) {
  if (!geom) return null;
  if (geom.type === "Polygon") {
    return { type: "Polygon", rings: geom.coordinates.map((r) => simplifyRing(r)) };
  }
  if (geom.type === "MultiPolygon") {
    return { type: "MultiPolygon", polygons: geom.coordinates.map((poly) => poly.map((r) => simplifyRing(r))) };
  }
  return null;
}

async function loadCountriesGeo() {
  try {
    const geo = await fetchJson(GEO_URL);
    const byIso = new Map();
    for (const f of geo.features || []) {
      const iso = f.properties?.ISO_A3 || f.properties?.ADM0_A3;
      if (!iso || iso === "-99") continue;
      const g = simplifyGeometry(f.geometry);
      if (g) byIso.set(iso, g);
    }
    return byIso;
  } catch (err) {
    console.warn("GeoJSON borders skipped:", err.message);
    return new Map();
  }
}

function ringCentroid(ring) {
  let sx = 0;
  let sy = 0;
  for (const [lon, lat] of ring) {
    sx += lon;
    sy += lat;
  }
  return { lon: sx / ring.length, lat: sy / ring.length };
}

function geomCentroid(geom) {
  if (!geom) return { lon: 0, lat: 0 };
  if (geom.type === "Polygon" && geom.rings?.[0]?.length) return ringCentroid(geom.rings[0]);
  if (geom.type === "MultiPolygon" && geom.polygons?.[0]?.[0]?.length) return ringCentroid(geom.polygons[0][0]);
  return { lon: 0, lat: 0 };
}

async function loadCountriesFromGeo() {
  const geo = await fetchJson(GEO_URL);
  const out = [];
  for (const f of geo.features || []) {
    const code = f.properties?.ISO_A3 || f.properties?.ADM0_A3;
    const name = f.properties?.NAME || f.properties?.NAME_EN || code;
    if (!code || code === "-99" || !name) continue;
    const geometry = simplifyGeometry(f.geometry);
    const { lon, lat } = geomCentroid(geometry);
    const code2 = (f.properties?.ISO_A2 || "").toLowerCase();
    out.push({
      code,
      code2: code2.length === 2 ? code2.toUpperCase() : "",
      name,
      capital: f.properties?.ADMIN || name,
      region: f.properties?.CONTINENT || "",
      subregion: f.properties?.SUBREGION || "",
      population: Math.round(f.properties?.POP_EST || 0),
      area: 0,
      flag: code2.length === 2 ? `https://flagcdn.com/w320/${code2}.png` : "",
      lon,
      lat,
      wikiTitle: name,
      geometry,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

async function loadRestCountries() {
  try {
    const raw = await fetchJson(
      "https://restcountries.com/v3.1/all?fields=name,cca2,cca3,capital,region,subregion,population,area,flags,latlng"
    );
    return raw
      .filter((c) => c.cca3)
      .map((c) => ({
        code: c.cca3,
        code2: c.cca2,
        name: c.name?.common || c.cca3,
        capital: c.capital?.[0] || "",
        region: c.region || "",
        subregion: c.subregion || "",
        population: c.population || 0,
        area: c.area || 0,
        flag: c.flags?.png || "",
        lon: c.latlng?.[1] ?? 0,
        lat: c.latlng?.[0] ?? 0,
        wikiTitle: c.name?.common || "",
        geometry: null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.warn("restcountries failed:", err.message);
    return null;
  }
}

function dedupeById(list) {
  const seen = new Set();
  return list.filter((p) => {
    const k = p.id || `${p.name}|${p.lon}|${p.lat}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function main() {
  console.log("Fetching countries…");
  const geoByIso = await loadCountriesGeo();
  let countries = await loadRestCountries();
  if (!countries?.length) countries = await loadCountriesFromGeo();
  else {
    countries = countries.map((c) => ({
      ...c,
      geometry: geoByIso.get(c.code) || null,
      flag: c.flag || (c.code2 ? `https://flagcdn.com/w320/${c.code2.toLowerCase()}.png` : ""),
    }));
  }

  const countryList = countries.map((c) => ({
    ...c,
    id: `country_${c.code}`,
    geometry: c.geometry || geoByIso.get(c.code) || null,
  }));
  const countryByCode = Object.fromEntries(countryList.map((c) => [c.code, c]));

  const capitals = countries
    .filter((c) => c.lon || c.lat)
    .map((c) => ({
      id: `city_${c.code}_capital`,
      name: c.capital || c.name,
      country: c.code,
      lon: c.lon,
      lat: c.lat,
      population: c.population,
      capital: true,
      wikiTitle: c.capital || c.name,
      image: c.flag,
    }));

  const megaCities = MEGA_CITIES.map(([name, code, lon, lat, pop], i) => ({
    id: `city_${code}_${i}`,
    name,
    country: code,
    lon,
    lat,
    population: pop,
    capital: false,
    wikiTitle: name,
    image: countryByCode[code]?.flag || "",
  }));

  const allCities = dedupeById([...capitals, ...megaCities]);

  let places = dedupeById([
    ...parseCatalog(CATALOG),
    ...parseCatalog(CATALOG_B),
    ...placesFromCatalogCities(allCities, countryByCode),
  ]);

  const featured = places
    .filter((p) => ["landmark", "nature"].includes(p.type) && p.wikiTitle)
    .slice(0, 180);
  await enrichImages(featured, "landmarks");
  for (const c of countryList) {
    if (!c.image) c.image = c.flag;
  }

  const payload = {
    updatedAt: Date.now(),
    kmPerDeg: KM_PER_DEG,
    worldWidthKm: 360 * KM_PER_DEG,
    countryCount: countryList.length,
    cityCount: allCities.length,
    placeCount: places.length,
    countries: countryList,
    cities: allCities,
    places,
    oceanSites: OCEAN_SITES,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload));
  console.log(
    `Wrote ${OUT}: ${countryList.length} countries, ${allCities.length} cities, ${places.length} places`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});