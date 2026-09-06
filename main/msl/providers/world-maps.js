const { handleWorldMapsInvoke } = require("../../apps/world-maps-ipc");

async function wrap(channel, input = {}) {
  try {
    const result = await handleWorldMapsInvoke(channel, input);
    if (result && typeof result === "object" && Object.prototype.hasOwnProperty.call(result, "ok")) {
      return result;
    }
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

async function geocode(input = {}) {
  const query = String(input.q || input.query || "").trim();
  if (!query) return { ok: false, error: "Missing query" };
  const res = await wrap("geocode", {
    query,
    q: query,
    lang: input.lang,
    countryCode: input.countryCode,
  });
  if (!res.ok) return res;
  const raw = res.result;
  const results = Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : raw ? [raw] : [];
  return { ok: true, results: results.slice(0, Math.min(Number(input.limit) || 12, 30)) };
}

async function reverseGeocode(input = {}) {
  const lat = Number(input.lat);
  const lng = Number(input.lng ?? input.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, error: "Missing lat/lng" };
  }
  const res = await wrap("reverse-geocode", { lat, lng, lang: input.lang });
  if (!res.ok) return res;
  const display =
    typeof res.result === "string"
      ? res.result
      : res.result?.display_name || res.result?.displayName || null;
  return { ok: true, displayName: display, raw: res.result };
}

async function countryAt(input = {}) {
  const lat = Number(input.lat);
  const lng = Number(input.lng ?? input.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, error: "Missing lat/lng" };
  }
  const res = await wrap("reverse-geocode-country", { lat, lng, lang: input.lang });
  if (!res.ok) return res;
  const raw = res.result || {};
  return {
    ok: true,
    countryName: raw.countryName || raw.country || null,
    countryCode: raw.countryCode || raw.code || null,
    displayName: raw.displayName || raw.display_name || null,
  };
}

async function listNotes() {
  const res = await wrap("notes-load", {});
  if (!res.ok) return res;
  const notes = Array.isArray(res.result) ? res.result : [];
  return { ok: true, notes, total: notes.length };
}

async function listRoutes() {
  const res = await wrap("routes-load", {});
  if (!res.ok) return res;
  const routes = Array.isArray(res.result) ? res.result : [];
  return { ok: true, routes, total: routes.length };
}

const CAPABILITIES = [
  {
    id: "maps.geocode",
    kind: "query",
    provider: "world-maps",
    title: "Geocode place",
    description: "Forward geocode a place name to coordinates",
    handler: geocode,
  },
  {
    id: "maps.reverseGeocode",
    kind: "query",
    provider: "world-maps",
    title: "Reverse geocode",
    description: "Resolve lat/lng to a display name",
    handler: reverseGeocode,
  },
  {
    id: "maps.country.at",
    kind: "query",
    provider: "world-maps",
    title: "Country at coordinates",
    description: "Country name/code for a lat/lng point",
    handler: countryAt,
  },
  {
    id: "maps.notes.list",
    kind: "query",
    provider: "world-maps",
    title: "List map notes",
    description: "User map notes (requires signed-in session)",
    handler: listNotes,
  },
  {
    id: "maps.routes.list",
    kind: "query",
    provider: "world-maps",
    title: "List map routes",
    description: "User saved routes (requires signed-in session)",
    handler: listRoutes,
  },
];

module.exports = { CAPABILITIES };
