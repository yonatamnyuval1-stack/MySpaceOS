const fs = require("fs");
const path = require("path");

const CATALOG_FILE = () => path.join(__dirname, "..", "..", "data", "stocks-symbols.json");

let catalogCache = null;

function loadCatalog() {
  if (catalogCache) return catalogCache;
  try {
    const raw = JSON.parse(fs.readFileSync(CATALOG_FILE(), "utf8"));
    catalogCache = {
      updatedAt: raw.updatedAt || null,
      count: raw.count || (raw.symbols || []).length,
      symbols: Array.isArray(raw.symbols) ? raw.symbols : [],
    };
  } catch {
    catalogCache = { updatedAt: null, count: 0, symbols: [] };
  }
  return catalogCache;
}

function scoreSymbol(entry, q) {
  const sym = String(entry.symbol || "").toLowerCase();
  const name = String(entry.name || "").toLowerCase();
  const sector = String(entry.sector || "").toLowerCase();
  const industry = String(entry.industry || "").toLowerCase();
  if (!q) return 0;
  if (sym === q) return 200;
  if (sym.startsWith(q)) return 160 - Math.min(40, sym.length - q.length);
  if (name.startsWith(q)) return 120;
  if (sym.includes(q)) return 90;
  if (name.includes(q)) return 70;
  if (sector.includes(q) || industry.includes(q)) return 40;
  const parts = q.split(/\s+/).filter(Boolean);
  if (parts.length > 1 && parts.every((p) => name.includes(p) || sym.includes(p))) return 55;
  return 0;
}

/**
 * Fast local search over thousands of symbols.
 * @param {string} query
 * @param {{ limit?: number, mode?: string }} opts
 */
function searchLocalSymbols(query, opts = {}) {
  const q = String(query || "")
    .trim()
    .toLowerCase();
  if (!q) return [];
  const limit = Math.min(5000, Math.max(1, parseInt(opts.limit, 10) || 500));
  const mode = String(opts.mode || "stocks").toLowerCase();
  const { symbols } = loadCatalog();

  const scored = [];
  for (const entry of symbols) {
    if (mode === "crypto" && !/-USD$|USD-/.test(entry.symbol) && entry.exchange !== "CCC") continue;
    if (mode === "forex" && !/=X$/.test(entry.symbol) && entry.exchange !== "CCY") continue;
    if (mode === "metals" && !/=F$/.test(entry.symbol) && entry.exchange !== "COM") {
      if (!/gold|silver|copper|platinum/i.test(entry.name || "")) continue;
    }
    if ((mode === "stocks" || mode === "etf") && (/=X$|-USD$|=F$/.test(entry.symbol) || entry.exchange === "CCC" || entry.exchange === "CCY")) {
      continue;
    }

    const rank = scoreSymbol(entry, q);
    if (rank > 0) scored.push({ entry, rank });
  }

  scored.sort((a, b) => b.rank - a.rank || a.entry.symbol.localeCompare(b.entry.symbol));
  return scored.slice(0, limit).map(({ entry, rank }) => {
    const exchange = entry.exchange || "";
    return {
      symbol: entry.symbol,
      name: entry.name,
      exchange,
      type: entry.exchange === "CCC" ? "CRYPTOCURRENCY" : entry.exchange === "CCY" ? "CURRENCY" : "EQUITY",
      quoteType: entry.exchange === "CCC" ? "CRYPTOCURRENCY" : "EQUITY",
      isNasdaq: /NASDAQ|NMS|NGM/i.test(exchange),
      sector: entry.sector || "",
      industry: entry.industry || "",
      rank,
      source: "local",
    };
  });
}

function catalogStats() {
  const c = loadCatalog();
  return { ok: true, count: c.count, updatedAt: c.updatedAt };
}

module.exports = { loadCatalog, searchLocalSymbols, catalogStats, scoreSymbol };
