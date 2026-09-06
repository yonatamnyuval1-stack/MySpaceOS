const { handleStocksInvoke } = require("../../apps/stocks-ipc");

async function getQuote(input = {}) {
  const symbols = Array.isArray(input.symbols)
    ? input.symbols
    : String(input.symbol || input.q || "")
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
  if (!symbols.length) return { ok: false, error: "Missing symbols" };
  return handleStocksInvoke("quote.get", { symbols });
}

async function search(input = {}) {
  const query = String(input.q || input.query || "").trim();
  if (!query) return { ok: false, error: "Missing query" };
  const res = await handleStocksInvoke("search", {
    query,
    mode: input.mode,
    limit: input.limit,
  });
  if (res?.ok === false) return res;
  return {
    ok: true,
    results: res?.results || [],
    mode: res?.mode || null,
  };
}

async function getWatchlist(input = {}) {
  const res = await handleStocksInvoke("market.watchlist", { mode: input.mode });
  if (res?.ok === false) return res;
  return {
    ok: true,
    watchlist: res?.watchlist || [],
    quotes: res?.quotes || [],
    indices: res?.indices || [],
    mode: res?.mode || null,
  };
}

async function getPortfolio() {
  const res = await handleStocksInvoke("portfolio.get", {});
  if (res?.ok === false) return res;
  return {
    ok: true,
    positions: res?.positions || [],
    summary: res?.summary || null,
  };
}

const CAPABILITIES = [
  {
    id: "stocks.quote.get",
    kind: "query",
    provider: "stocks",
    title: "Get stock quotes",
    description: "Fetch live quotes for one or more symbols",
    handler: getQuote,
  },
  {
    id: "stocks.search",
    kind: "query",
    provider: "stocks",
    title: "Search symbols",
    description: "Search tickers / company names",
    handler: search,
  },
  {
    id: "stocks.watchlist.get",
    kind: "query",
    provider: "stocks",
    title: "Get watchlist",
    description: "Watchlist symbols with quotes and indices",
    handler: getWatchlist,
  },
  {
    id: "stocks.portfolio.get",
    kind: "query",
    provider: "stocks",
    title: "Get portfolio",
    description: "Portfolio positions and summary",
    handler: getPortfolio,
  },
];

module.exports = { CAPABILITIES };
