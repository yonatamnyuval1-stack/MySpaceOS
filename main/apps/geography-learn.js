const path = require("path");
const fs = require("fs");

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const SECTION_MAP = [
  { keys: ["history", "ancient", "medieval", "modern history", "prehistory", "early history"], id: "history", title: "History" },
  { keys: ["geography", "climate", "environment", "geology", "wildlife", "biodiversity"], id: "geography", title: "Geography & nature" },
  { keys: ["economy", "economic", "finance", "infrastructure", "energy", "trade", "industry"], id: "economy", title: "Economy & money" },
  { keys: ["demographics", "population", "ethnic", "language", "religion", "immigration"], id: "demographics", title: "People & demographics" },
  { keys: ["culture", "society", "tradition", "custom", "sport", "media", "education", "health"], id: "culture", title: "Culture & customs" },
  { keys: ["government", "politics", "administration", "law", "foreign relations", "military", "security"], id: "government", title: "Government & politics" },
  { keys: ["cuisine", "food", "dining"], id: "cuisine", title: "Food & cuisine" },
  { keys: ["tourism", "attraction", "world heritage", "landmark", "cities", "urban"], id: "places", title: "Places to know" },
];

function learnFile(projectRoot) {
  return path.join(projectRoot || path.join(__dirname, "..", ".."), "data", "geography-learn.json");
}

function learnUserDir(userDataPath) {
  return path.join(userDataPath, "geography-learn-cache");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url, timeoutMs = 25000) {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function wikiTitleFromCountry(country) {
  return String(country.wikiTitle || country.name || "").trim();
}

function classifySection(lineTitle) {
  const t = String(lineTitle || "").toLowerCase();
  for (const rule of SECTION_MAP) {
    if (rule.keys.some((k) => t.includes(k))) return rule;
  }
  return { id: "more", title: lineTitle || "More" };
}

function paragraphsFromText(text, maxLen = 12000) {
  const raw = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) return [];
  const chunks = raw.split(/(?<=[.!?])\s+(?=[A-Z])/).filter((p) => p.length > 40);
  if (chunks.length < 2) return [raw.slice(0, maxLen)];
  const out = [];
  let buf = "";
  for (const c of chunks) {
    if (buf.length + c.length > 2200 && buf) {
      out.push(buf.trim());
      buf = c;
    } else {
      buf = buf ? `${buf} ${c}` : c;
    }
    if (out.length >= 12) break;
  }
  if (buf) out.push(buf.trim());
  return out.map((p) => p.slice(0, maxLen));
}

function extractPlaces(text) {
  const places = [];
  const lines = String(text || "").split(/\n+/);
  for (const line of lines) {
    const m = line.match(/^[\*\-•]\s*(?:\[\[)?([^|\]]{2,80})/);
    if (m) {
      const name = m[1].replace(/\]\]/g, "").trim();
      if (name.length > 2 && places.length < 15) places.push({ name, description: "" });
    }
  }
  return places;
}

function htmlToPlain(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[23]>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchWikiHtmlSections(title) {
  const pageTitle = encodeURIComponent(title.replace(/ /g, "_"));
  const sections = [];
  try {
    const q = await fetchJson(
      `https://en.wikipedia.org/w/api.php?action=parse&page=${pageTitle}&prop=text&format=json`
    );
    const html = q.parse?.text || "";
    const chunks = html.split(/<h2\b/i).slice(1);
    for (const chunk of chunks.slice(0, 22)) {
      const titleMatch = chunk.match(/^[^>]*>([^<]+)</);
      const line = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "Section";
      const bodyHtml = chunk.replace(/^[^>]*>[^<]*</, "");
      const text = htmlToPlain(bodyHtml);
      if (text.length > 100) sections.push({ line, text });
    }
  } catch {
  }
  return sections;
}

async function fetchWikiMobileSections(title) {
  const htmlSecs = await fetchWikiHtmlSections(title);
  if (htmlSecs.length) return htmlSecs;
  return fetchWikiFullExtractFallback(title);
}

async function fetchWikiFullExtractFallback(title) {
  const pageTitle = encodeURIComponent(title.replace(/ /g, "_"));
  try {
    const q = await fetchJson(
      `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exintro=0&titles=${pageTitle}&format=json`
    );
    const page = Object.values(q.query?.pages || {})[0];
    const text = page?.extract || "";
    if (text.length > 100) return [{ line: "Country profile", text }];
  } catch {
  }
  return [];
}

async function fetchWikiLead(title) {
  const encoded = encodeURIComponent(title.replace(/ /g, "_"));
  try {
    const summary = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`);
    return {
      description: summary.description || "",
      extract: summary.extract || "",
    };
  } catch {
    return { description: "", extract: "" };
  }
}

function factsFromCountry(c) {
  const currs = (c.currencies || []).map((x) => `${x.name} (${x.symbol || x.code})`).join(", ");
  const langs = (c.languages || []).map((x) => x.name).join(", ");
  return [
    `Official name: ${c.officialName || c.name}`,
    `Capital: ${c.capital || "—"}`,
    `Region: ${c.region || ""}${c.subregion ? ` · ${c.subregion}` : ""}`,
    `Population: ${(c.population || 0).toLocaleString()}`,
    `Area: ${(c.area || 0).toLocaleString()} km²`,
    c.density ? `Density: ${c.density.toLocaleString()} per km²` : "",
    c.landlocked ? "Landlocked country" : "Has coastline or borders",
    langs ? `Languages: ${langs}` : "",
    currs ? `Currency: ${currs}` : "",
    (c.timezones || []).length ? `Time zones: ${c.timezones.slice(0, 4).join(", ")}` : "",
    (c.borders || []).length ? `Borders: ${c.borders.join(", ")}` : "Island or no land borders",
  ].filter(Boolean);
}

async function buildLearnProfile(country) {
  const title = wikiTitleFromCountry(country);
  const lead = await fetchWikiLead(title);
  const wikiSections = await fetchWikiMobileSections(title);

  const sectionBuckets = new Map();
  const overviewParas = paragraphsFromText(lead.extract, 8000);

  for (const ws of wikiSections) {
    const line = ws.line || ws.anchor || "";
    const text = ws.text || "";
    if (!text || text.length < 80) continue;
    const rule = classifySection(line);
    const id = rule.id === "more" ? `more_${line.toLowerCase().replace(/\W+/g, "_").slice(0, 40)}` : rule.id;
    const titleSec = rule.id === "more" ? line : rule.title;
    if (!sectionBuckets.has(id)) {
      sectionBuckets.set(id, { id, title: titleSec, paragraphs: [], places: [] });
    }
    const bucket = sectionBuckets.get(id);
    bucket.paragraphs.push(...paragraphsFromText(text, 6000));
    if (id === "places" || /place|city|tourism/i.test(line)) {
      bucket.places.push(...extractPlaces(text));
    }
  }

  const sections = [];

  sections.push({
    id: "overview",
    title: "Overview",
    paragraphs:
      overviewParas.length > 0
        ? overviewParas
        : [
            `${country.name} is a country in ${country.region || "the world"}${country.subregion ? ` (${country.subregion})` : ""}.`,
            lead.description || "",
          ].filter(Boolean),
  });

  sections.push({
    id: "quick-facts",
    title: "Quick facts",
    facts: factsFromCountry(country),
  });

  const order = ["history", "geography", "demographics", "culture", "economy", "government", "cuisine", "places"];
  for (const id of order) {
    const b = sectionBuckets.get(id);
    if (b && (b.paragraphs.length || b.places?.length)) {
      sections.push({
        id: b.id,
        title: b.title,
        paragraphs: b.paragraphs.slice(0, 14),
        places: b.places?.slice(0, 12) || [],
      });
    }
  }

  for (const [id, b] of sectionBuckets) {
    if (order.includes(id)) continue;
    if (id.startsWith("more_") && b.paragraphs.length) {
      sections.push({
        id: b.id,
        title: b.title,
        paragraphs: b.paragraphs.slice(0, 10),
        places: b.places?.slice(0, 8) || [],
      });
    }
  }

  return {
    code: country.code,
    name: country.name,
    officialName: country.officialName,
    flag: country.flag,
    capital: country.capital,
    region: country.region,
    updatedAt: Date.now(),
    summary: lead.description || overviewParas[0]?.slice(0, 320) || `${country.name} — in-depth country profile.`,
    sections,
    stats: {
      population: country.population,
      area: country.area,
      density: country.density,
      languages: country.languages,
      currencies: country.currencies,
    },
  };
}

function loadBundledLearn(projectRoot) {
  const file = learnFile(projectRoot);
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
  }
  return { updatedAt: null, profiles: {} };
}

function loadUserLearnProfile(userDataPath, code) {
  const file = path.join(learnUserDir(userDataPath), `${code}.json`);
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
  }
  return null;
}

function saveUserLearnProfile(userDataPath, profile) {
  const dir = learnUserDir(userDataPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${profile.code}.json`), JSON.stringify(profile, null, 2), "utf8");
}

function getBundledProfile(projectRoot, code) {
  const data = loadBundledLearn(projectRoot);
  return data.profiles?.[code] || data.profiles?.[code.toUpperCase()] || null;
}

function listBundledCodes(projectRoot) {
  const data = loadBundledLearn(projectRoot);
  return Object.keys(data.profiles || {});
}

function saveBundledLearn(projectRoot, profilesMap) {
  const file = learnFile(projectRoot);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const payload = {
    updatedAt: Date.now(),
    count: Object.keys(profilesMap).length,
    profiles: profilesMap,
  };
  fs.writeFileSync(file, JSON.stringify(payload), "utf8");
  return payload;
}

module.exports = {
  buildLearnProfile,
  loadBundledLearn,
  getBundledProfile,
  listBundledCodes,
  loadUserLearnProfile,
  saveUserLearnProfile,
  saveBundledLearn,
  learnFile,
  sleep,
};