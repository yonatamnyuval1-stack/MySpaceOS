const { handleStocksInvoke } = require("../apps/stocks-ipc");
const { shellOpenPage } = require("./tools-shell");

const MODE_ALIASES = {
  stock: "stocks",
  equities: "stocks",
  us: "stocks",
  international: "intl",
  overseas: "intl",
  etf: "etf-index",
  index: "etf-index",
  indices: "indices",
  indexes: "indices",
  sector: "etf-sector",
  bonds: "etf-bonds",
  bond: "etf-bonds",
  gold: "metals",
  metal: "metals",
  oil: "energy",
  commodity: "commodities",
  fx: "forex",
  currency: "forex",
  coin: "crypto",
  bitcoin: "crypto",
  reits: "reit",
  rates: "rates",
  emerging: "emerging",
};

function normalizeMode(raw) {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (!s) return undefined;
  return MODE_ALIASES[s] || s;
}

function parseSymbols(args) {
  if (Array.isArray(args?.symbols)) {
    return args.symbols.map((s) => String(s || "").trim().toUpperCase()).filter(Boolean);
  }
  const single = args?.symbol || args?.ticker || args?.query;
  if (typeof single === "string" && single.includes(",")) {
    return single
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
  }
  if (single) return [String(single).trim().toUpperCase()].filter(Boolean);
  return [];
}

function slimQuote(q) {
  if (!q || typeof q !== "object") return q;
  return {
    symbol: q.symbol,
    name: q.name,
    price: q.price,
    change: q.change,
    changePct: q.changePct,
    currency: q.currency,
    exchange: q.exchange,
    previousClose: q.previousClose,
    dayHigh: q.dayHigh,
    dayLow: q.dayLow,
    volume: q.volume,
    marketCap: q.marketCap,
    marketState: q.marketState,
  };
}

async function stocksGetQuote(args) {
  const symbols = parseSymbols(args);
  if (!symbols.length) {
    return { ok: false, error: "Provide symbol or symbols (e.g. AAPL, BTC-USD)" };
  }
  const res = await handleStocksInvoke("quote.get", { symbols });
  if (!res?.ok) return res || { ok: false, error: "Failed to fetch quotes" };
  return {
    ok: true,
    quotes: (res.quotes || []).map(slimQuote),
  };
}

async function stocksSearch(args) {
  const query = String(args?.query || args?.q || args?.symbol || "").trim();
  if (!query) return { ok: false, error: "query is required" };
  const mode = normalizeMode(args?.mode) || "stocks";
  const res = await handleStocksInvoke("search", { query, mode });
  if (!res?.ok) return res || { ok: false, error: "Search failed" };
  const limit = Math.min(15, Math.max(1, parseInt(args?.limit, 10) || 8));
  return {
    ok: true,
    mode: res.mode || mode,
    results: (res.results || []).slice(0, limit).map((r) => ({
      symbol: r.symbol,
      name: r.name,
      exchange: r.exchange,
      type: r.type || r.quoteType,
    })),
  };
}

async function stocksGetWatchlist(args) {
  const mode = normalizeMode(args?.mode);
  const res = await handleStocksInvoke("market.watchlist", mode ? { mode } : {});
  if (!res?.ok) return res || { ok: false, error: "Failed to load watchlist" };
  return {
    ok: true,
    mode: res.mode,
    modeLabel: res.modeConfig?.label,
    watchlist: res.watchlist || [],
    quotes: (res.quotes || []).map(slimQuote),
    indices: (res.indices || []).map((i) => ({
      symbol: i.symbol,
      name: i.name,
      quote: i.quote ? slimQuote(i.quote) : null,
    })),
  };
}

async function stocksGetPortfolio() {
  const res = await handleStocksInvoke("portfolio.get", {});
  if (!res?.ok) return res || { ok: false, error: "Failed to load portfolio" };
  return {
    ok: true,
    summary: res.summary,
    positions: (res.positions || []).map((p) => ({
      symbol: p.symbol,
      name: p.name,
      qty: p.qty,
      avgCost: p.avgCost,
      price: p.price,
      changePct: p.changePct,
      value: p.value,
      cost: p.cost,
      pl: p.pl,
      plPct: p.plPct,
    })),
  };
}

async function stocksGetMovers(args) {
  const mode = normalizeMode(args?.mode) || "stocks";
  const limit = Math.min(10, Math.max(3, parseInt(args?.limit, 10) || 5));
  const res = await handleStocksInvoke("market.movers", { mode, limit });
  if (!res?.ok) return res || { ok: false, error: "Failed to load movers" };
  return {
    ok: true,
    mode,
    gainers: (res.gainers || []).map(slimQuote),
    losers: (res.losers || []).map(slimQuote),
  };
}

const STOCKS_TOOL_DEFS = [
  {
    name: "stocks_get_quote",
    description:
      "Get live market quotes for one or more symbols (stocks, ETFs, crypto, forex, metals). Use symbols like AAPL, MSFT, BTC-USD, EURUSD=X, GC=F.",
    parameters: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Single ticker, e.g. AAPL or BTC-USD" },
        symbols: {
          type: "array",
          items: { type: "string" },
          description: "Multiple tickers",
        },
      },
    },
  },
  {
    name: "stocks_search",
    description:
      "Search for market symbols by company name or ticker keyword. Optionally filter by market mode (stocks, crypto, forex, metals, etc.).",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search text, e.g. Apple or Tesla" },
        mode: {
          type: "string",
          description:
            "Market mode: stocks | crypto | forex | metals | energy | indices | etf | intl | reit | emerging",
        },
        limit: { type: "number", description: "Max results (default 8)" },
      },
      required: ["query"],
    },
  },
  {
    name: "stocks_get_watchlist",
    description:
      "Get the user's Stocks watchlist with live quotes (and indices when available) for a market mode.",
    parameters: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          description: "Market mode (default: current active mode). e.g. stocks, crypto, forex",
        },
      },
    },
  },
  {
    name: "stocks_get_portfolio",
    description:
      "Get the user's portfolio holdings with live prices, position values, and total P/L summary.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "stocks_get_movers",
    description:
      "Get today's top gainers and losers from the watchlist for a market mode.",
    parameters: {
      type: "object",
      properties: {
        mode: { type: "string", description: "Market mode (default stocks)" },
        limit: { type: "number", description: "How many gainers/losers (3–10, default 5)" },
      },
    },
  },
];

async function maybeOpenStocks(page, ctx, result) {
  if (!result?.ok || !ctx?.getMainWindow) return result;
  try {
    const opened = await shellOpenPage({ app: "stocks", page }, ctx);
    if (opened?.ok) result.openedPage = page;
    else if (opened?.error) result.openWarning = opened.error;
  } catch (err) {
    result.openWarning = err.message || String(err);
  }
  return result;
}

async function executeStocksTool(name, args, ctx) {
  let result;
  switch (name) {
    case "stocks_get_quote":
      result = await stocksGetQuote(args);
      break;
    case "stocks_search":
      result = await stocksSearch(args);
      break;
    case "stocks_get_watchlist":
      result = await stocksGetWatchlist(args);
      break;
    case "stocks_get_portfolio":
      result = await stocksGetPortfolio();
      break;
    case "stocks_get_movers":
      result = await stocksGetMovers(args);
      break;
    default:
      result = { ok: false, error: `Unknown stocks tool: ${name}` };
  }

  if (result?.ok && ["stocks_get_watchlist", "stocks_get_portfolio", "stocks_get_movers"].includes(name)) {
    const page = name === "stocks_get_portfolio" ? "portfolio" : "dashboard";
    result = await maybeOpenStocks(page, ctx, result);
  }

  return result;
}

module.exports = {
  STOCKS_TOOL_DEFS,
  executeStocksTool,
};