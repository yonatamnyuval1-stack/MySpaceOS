const { handleGeographyInvoke } = require("../../apps/geography-ipc");

function slimCountry(c) {
  if (!c) return null;
  return {
    code: c.code || c.cca2 || c.id,
    name: c.name || c.commonName || "",
    officialName: c.officialName || "",
    region: c.region || "",
    subregion: c.subregion || "",
    capital: c.capital || "",
    flag: c.flag || c.flagEmoji || "",
  };
}

async function listCountries(input = {}) {
  const res = await handleGeographyInvoke("countries.list", { force: Boolean(input.force) });
  if (!res?.ok) return res;
  let countries = (res.countries || []).map(slimCountry).filter(Boolean);
  const q = String(input.q || input.query || "").trim().toLowerCase();
  if (q) {
    countries = countries.filter((c) =>
      [c.code, c.name, c.officialName, c.region, c.capital].join(" ").toLowerCase().includes(q)
    );
  }
  const limit = Math.min(Math.max(Number(input.limit) || 80, 1), 300);
  return { ok: true, countries: countries.slice(0, limit), total: countries.length };
}

async function getCountry(input = {}) {
  const code = String(input.code || input.id || "").trim();
  if (!code) return { ok: false, error: "Missing country code" };
  return handleGeographyInvoke("countries.get", {
    code,
    skipWiki: input.includeWiki ? false : input.skipWiki !== false,
    wikiLang: input.wikiLang,
  });
}

async function getLearn(input = {}) {
  const code = String(input.code || input.id || "").trim();
  if (!code) return { ok: false, error: "Missing country code" };
  return handleGeographyInvoke("learn.get", { code });
}

async function openMaps(input = {}) {
  const url = String(input.url || "").trim();
  if (!url) return { ok: false, error: "Missing url" };
  return handleGeographyInvoke("maps.open", { url });
}

const CAPABILITIES = [
  {
    id: "geography.countries.list",
    kind: "query",
    provider: "geography",
    title: "List countries",
    description: "Geography country catalog with optional search",
    handler: listCountries,
  },
  {
    id: "geography.countries.get",
    kind: "query",
    provider: "geography",
    title: "Get country",
    description: "Country detail by ISO code (optional Wikipedia)",
    handler: getCountry,
  },
  {
    id: "geography.learn.get",
    kind: "query",
    provider: "geography",
    title: "Get learn profile",
    description: "Rich learn-mode profile for a country",
    handler: getLearn,
  },
  {
    id: "geography.maps.open",
    kind: "action",
    provider: "geography",
    title: "Open maps link",
    description: "Open an external maps URL",
    handler: openMaps,
  },
];

module.exports = { CAPABILITIES };