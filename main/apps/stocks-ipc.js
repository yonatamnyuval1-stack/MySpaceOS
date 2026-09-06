const path = require("path");
const fs = require("fs");
const { app } = require("electron");
const { MARKET_MODES, MODE_ORDER, getMode, defaultWatchlists, maybeUpgradeWatchlist } = require(path.join(
  __dirname,
  "../../apps/stocks/lib/market-modes.js"
));

const WM_ROOT = path.join(__dirname, "../../world-maps");
const { geminiGenerate } = require(path.join(WM_ROOT, "gemini-ipc.js"));
const {
  setupLocalAuthApp,
  requireSignedIn,
  registerSingleFileMigrator,
} = require("./local-auth-app-helper");

const APP_ID = "stocks";
const auth = setupLocalAuthApp(APP_ID);
registerSingleFileMigrator(APP_ID, "stocks.json");

const DATA_FILE = () => auth.userDataPath("data.json");

function signedInGuard() {
  return requireSignedIn(auth);
}

const CACHE_TTL_MS = 45000;
const cache = new Map();
const NETWORK_RETRIES = 3;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

let yahooSession = null;

function cacheGet(key) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < CACHE_TTL_MS) return hit.v;
  return null;
}

function cacheSet(key, value) {
  cache.set(key, { t: Date.now(), v: value });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableNetworkError(err) {
  const msg = String(err?.message || "").toLowerCase();
  return (
    msg.includes("fetch failed") ||
    msg.includes("network error") ||
    msg.includes("timeout") ||
    msg.includes("econnreset") ||
    msg.includes("enotfound") ||
    msg.includes("eai_again")
  );
}

async function fetchWithRetry(url, options, label, maxRetries = NETWORK_RETRIES) {
  let lastErr = null;
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      return await fetch(url, options);
    } catch (err) {
      lastErr = err;
      if (!isRetryableNetworkError(err) || attempt >= maxRetries) break;
      await wait(250 * attempt);
    }
  }
  throw new Error(`${label} (${lastErr?.message || "fetch failed"})`);
}

function parseSetCookieHeaders(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  }
  const raw = headers.get("set-cookie");
  if (!raw) return "";
  return raw
    .split(/,(?=[^;]+?=)/)
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

async function refreshYahooSession() {
  let boot;
  try {
    boot = await fetchWithRetry(
      "https://fc.yahoo.com",
      {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      redirect: "manual",
      },
      "Network error while connecting to Yahoo"
    );
  } catch (err) {
    throw new Error(`Network error while connecting to Yahoo (${err?.message || "fetch failed"})`);
  }
  const cookie = parseSetCookieHeaders(boot.headers);
  if (!cookie) throw new Error("Could not connect to market data service");

  let crumbRes;
  try {
    crumbRes = await fetchWithRetry(
      "https://query1.finance.yahoo.com/v1/test/getcrumb",
      {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "*/*",
        Cookie: cookie,
      },
      },
      "Network error while authenticating market data"
    );
  } catch (err) {
    throw new Error(`Network error while authenticating market data (${err?.message || "fetch failed"})`);
  }
  if (!crumbRes.ok) throw new Error(`Market auth failed (${crumbRes.status})`);
  const crumb = (await crumbRes.text()).trim();
  if (!crumb || /unauthorized/i.test(crumb)) throw new Error("Market auth failed");

  yahooSession = {
    cookie,
    crumb,
    expiresAt: Date.now() + 2 * 60 * 60 * 1000,
  };
  return yahooSession;
}

async function getYahooSession() {
  if (yahooSession && Date.now() < yahooSession.expiresAt) return yahooSession;
  return refreshYahooSession();
}

function withCrumb(url, crumb) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}crumb=${encodeURIComponent(crumb)}`;
}

async function yahooGet(url, allowRetry = true) {
  const session = await getYahooSession();
  let res;
  try {
    res = await fetchWithRetry(
      withCrumb(url, session.crumb),
      {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        Cookie: session.cookie,
        Referer: "https://finance.yahoo.com/",
      },
      },
      "Network error while loading market data"
    );
  } catch (err) {
    throw new Error(`Network error while loading market data (${err?.message || "fetch failed"})`);
  }

  if (res.status === 401 && allowRetry) {
    yahooSession = null;
    return yahooGet(url, false);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (/Invalid Crumb|Unauthorized/i.test(body) && allowRetry) {
      yahooSession = null;
      return yahooGet(url, false);
    }
    throw new Error(`Market data unavailable (${res.status})`);
  }

  return res.json();
}

function toStooqSymbol(symbol) {
  const sym = normalizeSymbol(symbol);
  if (!sym || sym.startsWith("^")) return null;
  return `${sym.toLowerCase()}.us`;
}

async function fetchQuotesStooq(symbols) {
  const pairs = symbols.map((s) => ({ sym: s, stooq: toStooqSymbol(s) })).filter((p) => p.stooq);
  if (!pairs.length) return [];

  const url = `https://stooq.com/q/l/?s=${pairs.map((p) => p.stooq).join(",")}&f=sd2t2ohlcv&h&e=csv`;
  let res;
  try {
    res = await fetchWithRetry(url, { headers: { "User-Agent": USER_AGENT } }, "Network error on backup market source");
  } catch (err) {
    throw new Error(`Network error on backup market source (${err?.message || "fetch failed"})`);
  }
  if (!res.ok) throw new Error(`Backup market data failed (${res.status})`);
  const text = await res.text();
  const lines = text.trim().split(/\r?\n/).slice(1);
  const byStooq = {};

  for (const line of lines) {
    const cols = line.split(",");
    if (cols.length < 8) continue;
    const stooqSym = cols[0].toLowerCase();
    const close = parseFloat(cols[6]);
    const open = parseFloat(cols[3]);
    if (!Number.isFinite(close)) continue;
    const change = Number.isFinite(open) ? close - open : 0;
    const changePct = open ? (change / open) * 100 : 0;
    byStooq[stooqSym] = { close, open, change, changePct, volume: parseInt(cols[7], 10) || null };
  }

  return pairs
    .map(({ sym, stooq }) => {
      const row = byStooq[stooq];
      if (!row) return null;
      return {
        symbol: sym,
        name: sym,
        exchange: "NASDAQ",
        currency: "USD",
        price: row.close,
        change: row.change,
        changePct: row.changePct,
        previousClose: row.open,
        open: row.open,
        dayHigh: null,
        dayLow: null,
        volume: row.volume,
        marketCap: null,
        fiftyTwoWeekHigh: null,
        fiftyTwoWeekLow: null,
        trailingPE: null,
        marketState: "",
        isNasdaq: true,
      };
    })
    .filter(Boolean);
}

function normalizeSymbol(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.^\-=]/g, "");
}

function isNasdaqQuote(q) {
  const ex = String(q.fullExchangeName || q.exchange || q.quoteType || "").toUpperCase();
  return ex.includes("NASDAQ") || ex === "NMS" || ex === "NGM" || ex === "NCM";
}

function mapQuote(q) {
  if (!q || !q.symbol) return null;
  const price = q.regularMarketPrice ?? q.postMarketPrice ?? q.preMarketPrice;
  if (price == null) return null;
  const change = q.regularMarketChange ?? 0;
  const changePct = q.regularMarketChangePercent ?? 0;
  return {
    symbol: q.symbol,
    name: q.shortName || q.longName || q.symbol,
    exchange: q.fullExchangeName || q.exchange || "",
    quoteType: q.quoteType || "",
    currency: q.currency || "USD",
    price,
    change,
    changePct,
    previousClose: q.regularMarketPreviousClose ?? null,
    open: q.regularMarketOpen ?? null,
    dayHigh: q.regularMarketDayHigh ?? null,
    dayLow: q.regularMarketDayLow ?? null,
    volume: q.regularMarketVolume ?? null,
    marketCap: q.marketCap ?? null,
    fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? null,
    trailingPE: q.trailingPE ?? null,
    forwardPE: q.forwardPE ?? null,
    epsTrailingTwelveMonths: q.epsTrailingTwelveMonths ?? null,
    beta: q.beta ?? null,
    dividendYield: q.trailingAnnualDividendYield ?? q.dividendYield ?? null,
    marketState: q.marketState || "",
    isNasdaq: isNasdaqQuote(q),
  };
}

function isUsEquityExchange(exchange) {
  const ex = String(exchange || "").toUpperCase();
  return ex.includes("NASDAQ") || ex.includes("NYSE") || ex.includes("AMEX") || ex === "NMS" || ex === "NGM";
}

function matchesSearchMode(result, modeConf) {
  const types = modeConf.searchTypes || ["EQUITY"];
  if (!types.includes(result.quoteType)) return false;
  if (modeConf.nasdaqOnly) {
    const nasdaq =
      result.isNasdaq === true ||
      /NASDAQ|NMS|NGM/i.test(String(result.exchange || ""));
    if (!nasdaq) return false;
  }
  if (modeConf.intlOnly && result.quoteType === "EQUITY" && isUsEquityExchange(result.exchange)) return false;
  return true;
}

async function fetchQuotesFromCharts(symbols) {
  const out = [];
  for (const sym of symbols) {
    try {
      let data;
      try {
        data = await yahooGet(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=5d&interval=1d`
        );
      } catch {
        const res = await fetchWithRetry(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=5d&interval=1d`,
          {
            headers: {
              "User-Agent": USER_AGENT,
              Accept: "application/json",
            },
          },
          "Network error while loading chart quote"
        );
        if (!res.ok) continue;
        data = await res.json();
      }
      const result = data?.chart?.result?.[0];
      const meta = result?.meta;
      if (!meta?.symbol) continue;
      const price = meta.regularMarketPrice ?? meta.previousClose;
      if (price == null) continue;
      const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
      const change =
        previousClose != null && Number.isFinite(previousClose) ? price - previousClose : 0;
      const changePct = previousClose ? (change / previousClose) * 100 : 0;
      out.push({
        symbol: meta.symbol,
        name: meta.shortName || meta.longName || meta.symbol,
        exchange: meta.fullExchangeName || meta.exchangeName || "",
        quoteType: meta.instrumentType || "",
        currency: meta.currency || "USD",
        price,
        change,
        changePct,
        previousClose,
        open: null,
        dayHigh: meta.regularMarketDayHigh ?? null,
        dayLow: meta.regularMarketDayLow ?? null,
        volume: meta.regularMarketVolume ?? null,
        marketCap: null,
        fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
        fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
        trailingPE: null,
        marketState: meta.marketState || "",
        isNasdaq: isNasdaqQuote(meta),
      });
    } catch {
    }
  }
  return out;
}

async function fetchQuotes(symbols) {
  const list = [...new Set(symbols.map(normalizeSymbol).filter(Boolean))];
  if (!list.length) return { ok: true, quotes: [] };

  const key = `quotes:${list.join(",")}`;
  const cached = cacheGet(key);
  if (cached) return { ok: true, quotes: cached };

  const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(list.join(","))}`;
  let quotes = [];
  let primaryError = null;
  try {
    const data = await yahooGet(url);
    quotes = (data?.quoteResponse?.result || []).map(mapQuote).filter(Boolean);
  } catch (err) {
    primaryError = err;
    try {
      quotes = await fetchQuotesFromCharts(list);
    } catch (_) {
      /* continue */
    }
    if (!quotes.length) {
      try {
        quotes = await fetchQuotesStooq(list);
      } catch (_) {
        /* continue */
      }
    }
    if (!quotes.length) throw primaryError;
  }

  const got = new Set(quotes.map((q) => q.symbol));
  const missing = list.filter((s) => !got.has(s));
  if (missing.length) {
    try {
      const extra = await fetchQuotesFromCharts(missing);
      quotes = quotes.concat(extra);
    } catch (_) {
      /* ignore */
    }
  }
  const stillMissing = list.filter((s) => !quotes.some((q) => q.symbol === s));
  if (stillMissing.length) {
    try {
      const extra = await fetchQuotesStooq(stillMissing);
      quotes = quotes.concat(extra);
    } catch (_) {
      /* ignore */
    }
  }

  cacheSet(key, quotes);
  return { ok: true, quotes };
}

async function fetchChart(args) {
  const symbol = normalizeSymbol(args?.symbol);
  if (!symbol) return { ok: false, error: "Symbol required" };

  const range = String(args?.range || "1mo");
  const interval = String(args?.interval || "1d");
  const key = `chart:${symbol}:${range}:${interval}`;
  const cached = cacheGet(key);
  if (cached) return { ok: true, ...cached };

  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`;
  const data = await yahooGet(url);
  const result = data?.chart?.result?.[0];
  if (!result) return { ok: false, error: "No chart data" };

  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const closes = quote.close || [];
  const opens = quote.open || [];
  const highs = quote.high || [];
  const lows = quote.low || [];
  const volumes = quote.volume || [];

  const points = timestamps
    .map((t, i) => ({
      t: t * 1000,
      close: closes[i],
      open: opens[i],
      high: highs[i],
      low: lows[i],
      volume: volumes[i],
    }))
    .filter((p) => p.close != null);

  const meta = result.meta || {};
  const payload = {
    symbol,
    currency: meta.currency || "USD",
    exchange: meta.exchangeName || "",
    points,
    meta: {
      regularMarketPrice: meta.regularMarketPrice,
      previousClose: meta.previousClose ?? meta.chartPreviousClose,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
    },
  };
  cacheSet(key, payload);
  return { ok: true, ...payload };
}

async function searchSymbols(args) {
  const q = String(args?.query || "").trim();
  if (q.length < 1) return { ok: true, results: [] };

  const mode = args?.mode && MARKET_MODES[args.mode] ? args.mode : "stocks";
  const modeConf = getMode(mode);
  const relaxed = args?.relaxed === true || args?.allModes === true;
  const limit = Math.min(2000, Math.max(25, parseInt(args?.limit, 10) || 200));
  const key = `search:${mode}:${q}:${limit}`;
  const cached = cacheGet(key);
  if (cached) return { ok: true, results: cached, mode, source: "cache" };

  const { searchLocalSymbols } = require("./stocks-symbols");
  const local = searchLocalSymbols(q, { limit, mode });
  const bySym = new Map();
  for (const r of local) {
    const exchange = r.exchange || "";
    bySym.set(String(r.symbol).toUpperCase(), {
      symbol: r.symbol,
      name: r.name,
      exchange,
      type: r.type,
      quoteType: r.quoteType,
      sector: r.sector,
      industry: r.industry,
      isNasdaq: /NASDAQ|NMS|NGM/i.test(exchange),
      source: "local",
    });
  }

  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=40&newsCount=0`;
    const data = await yahooGet(url);
    for (const r of data?.quotes || []) {
      const mapped = {
        symbol: r.symbol,
        name: r.shortname || r.longname || r.symbol,
        exchange: r.exchDisp || r.exchange || "",
        type: r.quoteType,
        quoteType: r.quoteType,
        isNasdaq: String(r.exchDisp || r.exchange || "").toUpperCase().includes("NASDAQ"),
        source: "yahoo",
      };
      if (!matchesSearchMode(mapped, modeConf)) continue;
      const keySym = String(mapped.symbol || "").toUpperCase();
      if (!keySym) continue;
      const prev = bySym.get(keySym);
      if (!prev) bySym.set(keySym, mapped);
      else if (!prev.name || prev.name === prev.symbol) {
        bySym.set(keySym, { ...prev, name: mapped.name || prev.name, exchange: prev.exchange || mapped.exchange });
      }
    }
  } catch {
  }

  let results = [...bySym.values()];
  if (!relaxed) {
    results = results.filter((r) => matchesSearchMode(r, modeConf));
  }
  const ql = q.toLowerCase();
  results.sort((a, b) => {
    const as = String(a.symbol || "").toLowerCase();
    const bs = String(b.symbol || "").toLowerCase();
    const ap = as === ql ? 0 : as.startsWith(ql) ? 1 : 2;
    const bp = bs === ql ? 0 : bs.startsWith(ql) ? 1 : 2;
    if (ap !== bp) return ap - bp;
    return as.localeCompare(bs);
  });
  results = results.slice(0, limit);

  cacheSet(key, results);
  return { ok: true, results, mode, source: "local+yahoo", count: results.length };
}

async function fetchIndicesForMode(modeId) {
  const modeConf = getMode(modeId);
  if (!modeConf.showIndices || !modeConf.indices?.length) {
    return { ok: true, indices: [] };
  }
  const symbols = modeConf.indices.map((i) => i.symbol);
  const res = await fetchQuotes(symbols);
  const bySymbol = Object.fromEntries((res.quotes || []).map((q) => [q.symbol, q]));
  return {
    ok: true,
    indices: modeConf.indices.map((i) => ({
      ...i,
      quote: bySymbol[i.symbol] || null,
    })),
  };
}

async function loadStorage() {
  try {
    const raw = await fs.promises.readFile(DATA_FILE(), "utf8");
    return { ok: true, data: normalizeStorage(JSON.parse(raw)) };
  } catch (err) {
    if (err?.code === "ENOENT") return { ok: true, data: normalizeStorage({}) };
    return { ok: false, error: err.message };
  }
}

async function saveStorage(args) {
  const data = normalizeStorage(args?.data ?? args);
  await fs.promises.mkdir(path.dirname(DATA_FILE()), { recursive: true });
  await fs.promises.writeFile(DATA_FILE(), JSON.stringify(data, null, 2), "utf8");
  return { ok: true, data };
}

function normalizeStorage(raw) {
  const defaults = defaultWatchlists();
  let watchlists = { ...defaults };

  if (raw?.watchlists && typeof raw.watchlists === "object") {
    for (const id of MODE_ORDER) {
      if (Array.isArray(raw.watchlists[id])) {
        const list = [...new Set(raw.watchlists[id].map(normalizeSymbol).filter(Boolean))];
        watchlists[id] = list.length ? maybeUpgradeWatchlist(id, list, defaults[id]) : [];
      }
    }
  } else if (Array.isArray(raw?.watchlist)) {
    const legacy = [...new Set(raw.watchlist.map(normalizeSymbol).filter(Boolean))];
    watchlists.stocks = legacy.length
      ? maybeUpgradeWatchlist("stocks", legacy, defaults.stocks)
      : [];
  }

  const activeMode = MARKET_MODES[raw?.activeMode] ? raw.activeMode : "stocks";
  const holdings = normalizeHoldings(raw?.holdings);
  const alerts = normalizeAlerts(raw?.alerts);
  const buyList = normalizeBuyList(raw?.buyList);
  const analysisCache =
    raw?.analysisCache && typeof raw.analysisCache === "object" && !Array.isArray(raw.analysisCache)
      ? raw.analysisCache
      : {};

  return {
    activeMode,
    watchlists,
    holdings,
    alerts,
    buyList,
    analysisCache,
    settings: {
      refreshMs: Math.min(300000, Math.max(15000, parseInt(raw?.settings?.refreshMs, 10) || 60000)),
    },
  };
}

function normalizeBuyList(raw) {
  return (Array.isArray(raw) ? raw : [])
    .map((item) => ({
      id: String(item?.id || `bl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
      symbol: normalizeSymbol(item?.symbol),
      note: String(item?.note || "").trim(),
      targetPrice: item?.targetPrice != null && item.targetPrice !== "" ? parseFloat(item.targetPrice) : null,
      addedAt: item?.addedAt || new Date().toISOString(),
      done: Boolean(item?.done),
    }))
    .filter((item) => item.symbol);
}

function normalizeHoldings(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const [sym, h] of Object.entries(raw)) {
    const symbol = normalizeSymbol(sym);
    if (!symbol) continue;
    const qty = parseFloat(h?.qty ?? h?.quantity ?? 0);
    const avgCost = parseFloat(h?.avgCost ?? h?.cost ?? 0);
    if (qty > 0) out[symbol] = { qty, avgCost };
  }
  return out;
}

function normalizeAlerts(raw) {
  return (Array.isArray(raw) ? raw : [])
    .map((a) => ({
      id: String(a?.id || `al_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
      symbol: normalizeSymbol(a?.symbol),
      above: a?.above != null && a.above !== "" ? parseFloat(a.above) : null,
      below: a?.below != null && a.below !== "" ? parseFloat(a.below) : null,
      enabled: a?.enabled !== false,
      note: String(a?.note || "").trim(),
      triggeredAt: a?.triggeredAt || null,
      lastBellKey: a?.lastBellKey || null,
    }))
    .filter((a) => a.symbol && (a.above != null || a.below != null));
}

async function getPortfolio() {
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  const holdings = loaded.data.holdings || {};
  const symbols = Object.keys(holdings);
  if (!symbols.length) {
    return { ok: true, positions: [], summary: { totalValue: 0, totalCost: 0, totalPl: 0, totalPlPct: 0 } };
  }
  const quotesRes = await fetchQuotes(symbols);
  const quoteMap = Object.fromEntries((quotesRes.quotes || []).map((q) => [q.symbol, q]));
  const positions = symbols
    .map((sym) => {
      const h = holdings[sym];
      const q = quoteMap[sym];
      const price = q?.price ?? 0;
      const value = h.qty * price;
      const cost = h.qty * h.avgCost;
      const pl = value - cost;
      const plPct = cost ? (pl / cost) * 100 : 0;
      return {
        symbol: sym,
        qty: h.qty,
        avgCost: h.avgCost,
        price,
        name: q?.name || sym,
        changePct: q?.changePct ?? 0,
        value,
        cost,
        pl,
        plPct,
      };
    })
    .sort((a, b) => b.value - a.value);
  const totalValue = positions.reduce((s, p) => s + p.value, 0);
  const totalCost = positions.reduce((s, p) => s + p.cost, 0);
  const totalPl = totalValue - totalCost;
  return {
    ok: true,
    positions,
    summary: {
      totalValue,
      totalCost,
      totalPl,
      totalPlPct: totalCost ? (totalPl / totalCost) * 100 : 0,
    },
  };
}

async function setHolding(args) {
  const symbol = normalizeSymbol(args?.symbol);
  if (!symbol) return { ok: false, error: "Symbol required" };
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  const data = loaded.data;
  const qty = parseFloat(args?.qty);
  const avgCost = parseFloat(args?.avgCost);
  if (!qty || qty <= 0) {
    delete data.holdings[symbol];
  } else {
    data.holdings[symbol] = { qty, avgCost: avgCost || 0 };
  }
  await saveStorage({ data });
  return getPortfolio();
}

async function checkAlerts() {
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  const alerts = (loaded.data.alerts || []).filter((a) => a.enabled);
  if (!alerts.length) return { ok: true, triggered: [], alerts: loaded.data.alerts };

  const symbols = [...new Set(alerts.map((a) => a.symbol))];
  const quotesRes = await fetchQuotes(symbols);
  const quoteMap = Object.fromEntries((quotesRes.quotes || []).map((q) => [q.symbol, q]));
  const triggered = [];
  const now = new Date().toISOString();
  const day = now.slice(0, 10);
  let dirty = false;

  let push = null;
  try {
    push = require("./notifications-center").push;
  } catch {
    push = null;
  }

  for (const alert of alerts) {
    const q = quoteMap[alert.symbol];
    if (!q?.price) continue;
    let hit = false;
    let reason = "";
    let side = "";
    if (alert.above != null && q.price >= alert.above) {
      hit = true;
      side = "above";
      reason = `Above $${alert.above} (now $${q.price.toFixed(2)})`;
    }
    if (alert.below != null && q.price <= alert.below) {
      hit = true;
      side = "below";
      reason = `Below $${alert.below} (now $${q.price.toFixed(2)})`;
    }
    if (!hit) continue;

    triggered.push({ ...alert, price: q.price, reason, name: q.name });
    alert.triggeredAt = now;

    const bellKey = `${alert.id}:${side}:${day}`;
    if (alert.lastBellKey !== bellKey && push) {
      push({
        appId: "stocks",
        type: "price-alert",
        title: `${alert.symbol} alert`,
        body: `${q.name || alert.symbol}: ${reason}`,
        dedupeKey: `stock:${bellKey}`,
        route: { page: "alerts", symbol: alert.symbol },
        priority: "high",
      });
      alert.lastBellKey = bellKey;
      dirty = true;
    } else if (alert.lastBellKey !== bellKey) {
      alert.lastBellKey = bellKey;
      dirty = true;
    }
  }

  if (triggered.length || dirty) await saveStorage({ data: loaded.data });
  return { ok: true, triggered, alerts: loaded.data.alerts };
}

let stocksAlertTimer = null;

function startStocksAlertService() {
  if (stocksAlertTimer) return;
  const tick = () => {
    checkAlerts().catch(() => {});
  };
  tick();
  stocksAlertTimer = setInterval(tick, 3 * 60 * 1000);
}

async function saveAlerts(args) {
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  loaded.data.alerts = normalizeAlerts(args?.alerts || []);
  await saveStorage({ data: loaded.data });
  return { ok: true, alerts: loaded.data.alerts };
}

async function watchlistAdd(args) {
  const symbol = normalizeSymbol(args?.symbol);
  if (!symbol) return { ok: false, error: "Symbol required" };
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  const mode =
    args?.mode && MARKET_MODES[args.mode] ? args.mode : loaded.data.activeMode || "stocks";
  const list = [...getWatchlistForMode(loaded.data, mode)];
  if (!list.includes(symbol)) list.unshift(symbol);
  loaded.data.watchlists = loaded.data.watchlists || {};
  loaded.data.watchlists[mode] = list;
  await saveStorage({ data: loaded.data });
  return { ok: true, symbol, mode, watchlist: list };
}

async function watchlistRemove(args) {
  const symbol = normalizeSymbol(args?.symbol);
  if (!symbol) return { ok: false, error: "Symbol required" };
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  const mode =
    args?.mode && MARKET_MODES[args.mode] ? args.mode : loaded.data.activeMode || "stocks";
  const list = getWatchlistForMode(loaded.data, mode).filter((s) => s !== symbol);
  loaded.data.watchlists = loaded.data.watchlists || {};
  loaded.data.watchlists[mode] = list;
  await saveStorage({ data: loaded.data });
  return { ok: true, symbol, mode, watchlist: list };
}

async function alertsAdd(args) {
  const symbol = normalizeSymbol(args?.symbol);
  if (!symbol) return { ok: false, error: "Symbol required" };
  const above =
    args?.above != null && args.above !== "" ? parseFloat(args.above) : null;
  const below =
    args?.below != null && args.below !== "" ? parseFloat(args.below) : null;
  if (!(above != null && Number.isFinite(above)) && !(below != null && Number.isFinite(below))) {
    return { ok: false, error: "Need above or below price" };
  }
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  const alert = {
    id: `al_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    symbol,
    above: above != null && Number.isFinite(above) ? above : null,
    below: below != null && Number.isFinite(below) ? below : null,
    enabled: args?.enabled !== false,
    note: String(args?.note || "").trim(),
    triggeredAt: null,
    lastBellKey: null,
  };
  const alerts = normalizeAlerts([...(loaded.data.alerts || []), alert]);
  loaded.data.alerts = alerts;
  await saveStorage({ data: loaded.data });
  return { ok: true, alert: alerts.find((a) => a.id === alert.id) || alert, alerts };
}

async function alertsRemove(args) {
  const symbol = normalizeSymbol(args?.symbol);
  const id = args?.id ? String(args.id) : null;
  if (!symbol && !id) return { ok: false, error: "Symbol or id required" };
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  const before = loaded.data.alerts || [];
  const alerts = before.filter((a) => {
    if (id && a.id === id) return false;
    if (symbol && a.symbol === symbol) return false;
    return true;
  });
  if (alerts.length === before.length) {
    return { ok: false, error: symbol ? `No alerts for ${symbol}` : "Alert not found" };
  }
  loaded.data.alerts = alerts;
  await saveStorage({ data: loaded.data });
  return { ok: true, removed: before.length - alerts.length, alerts };
}

function getWatchlistForMode(data, modeId) {
  const mode = MARKET_MODES[modeId] ? modeId : "stocks";
  const list = data.watchlists?.[mode];
  if (Array.isArray(list) && list.length) return list;
  return [...getMode(mode).defaultWatchlist];
}

async function getWatchlistData(args) {
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  const mode = args?.mode && MARKET_MODES[args.mode] ? args.mode : loaded.data.activeMode;
  const modeConf = getMode(mode);
  const symbols = getWatchlistForMode(loaded.data, mode);
  const [quotesRes, indicesRes] = await Promise.all([fetchQuotes(symbols), fetchIndicesForMode(mode)]);
  return {
    ok: true,
    mode,
    modeConfig: {
      id: modeConf.id,
      label: modeConf.label,
      icon: modeConf.icon,
      subtitle: modeConf.subtitle,
      showMarketCap: modeConf.showMarketCap !== false,
      showMovers: modeConf.showMovers !== false,
      showIndices: modeConf.showIndices !== false,
      searchPlaceholder: modeConf.searchPlaceholder,
    },
    watchlist: symbols,
    quotes: quotesRes.quotes || [],
    indices: indicesRes.indices || [],
    settings: loaded.data.settings,
    holdings: loaded.data.holdings,
  };
}

async function getMovers(args) {
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  const mode = args?.mode && MARKET_MODES[args.mode] ? args.mode : loaded.data.activeMode;
  const modeConf = getMode(mode);
  if (modeConf.showMovers === false) {
    return { ok: true, gainers: [], losers: [], all: [] };
  }
  const symbols = getWatchlistForMode(loaded.data, mode);
  const quotesRes = await fetchQuotes(symbols);
  const quotes = [...(quotesRes.quotes || [])].sort((a, b) => b.changePct - a.changePct);
  const limit = Math.min(10, Math.max(3, parseInt(args?.limit, 10) || 5));
  return {
    ok: true,
    gainers: quotes.filter((q) => q.changePct > 0).slice(0, limit),
    losers: quotes.filter((q) => q.changePct < 0).slice(-limit).reverse(),
    all: quotes,
  };
}

async function setMarketMode(args) {
  const mode = args?.mode;
  if (!MARKET_MODES[mode]) return { ok: false, error: "Unknown market mode" };
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  const data = { ...loaded.data, activeMode: mode };
  await saveStorage({ data });
  return { ok: true, activeMode: mode, modeConfig: getMode(mode) };
}

function listMarketModes() {
  return {
    ok: true,
    activeMode: "stocks",
    modes: MODE_ORDER.map((id) => {
      const m = getMode(id);
      return { id: m.id, label: m.label, icon: m.icon, subtitle: m.subtitle };
    }),
  };
}

function parseModelJson(raw) {
  const text = String(raw || "")
    .replace(/^\uFEFF/, "")
    .trim();
  if (!text) return null;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let candidate = fence ? fence[1].trim() : text;
  const start = candidate.search(/[\[{]/);
  if (start < 0) return null;
  candidate = candidate.slice(start);

  const tryParse = (s) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };

  let parsed = tryParse(candidate);
  if (parsed) return parsed;

  const end = candidate.lastIndexOf("}");
  if (end > 0) {
    parsed = tryParse(candidate.slice(0, end + 1));
    if (parsed) return parsed;
  }

  return repairTruncatedJson(candidate);
}

function repairTruncatedJson(raw) {
  let s = String(raw || "").trim();
  if (!s.startsWith("{") && !s.startsWith("[")) return null;

  s = s.replace(/,\s*"[^"]*$/u, "");
  s = s.replace(/,\s*[^,{}\[\]"]+$/u, "");
  s = s.replace(/:\s*"[^"]*$/u, ': ""');
  s = s.replace(/:\s*-?\d+(\.\d*)?$/u, ": null");
  s = s.replace(/:\s*(true|false)?$/iu, ": null");
  s = s.replace(/,\s*$/u, "");
  s = s.replace(/,\s*"[^"]*"\s*:\s*(\{|\[)\s*$/u, "");
  s = s.replace(/,\s*$/u, "");

  const stack = [];
  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") stack.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") {
      if (stack.length && stack[stack.length - 1] === ch) stack.pop();
    }
  }
  if (inString) s += '"';
  s = s.replace(/,\s*$/u, "");
  while (stack.length) s += stack.pop();

  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** Drop null/empty leaves so prompts stay smaller and more reliable. */
function pruneEmpty(value) {
  if (value == null) return undefined;
  if (typeof value === "string") return value.trim() ? value : undefined;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    const arr = value.map(pruneEmpty).filter((v) => v !== undefined);
    return arr.length ? arr : undefined;
  }
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const pv = pruneEmpty(v);
      if (pv !== undefined) out[k] = pv;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return undefined;
}

function compactAnalysisFacts(facts) {
  const f = facts && typeof facts === "object" ? { ...facts } : {};
  if (f.fundamentals && typeof f.fundamentals === "object") {
    f.fundamentals = { ...f.fundamentals };
    if (f.fundamentals.description) {
      f.fundamentals.description = String(f.fundamentals.description).slice(0, 420);
    }
    if (Array.isArray(f.fundamentals.etfHoldings)) {
      f.fundamentals.etfHoldings = f.fundamentals.etfHoldings.slice(0, 5);
    }
  }
  if (Array.isArray(f.peers)) {
    f.peers = f.peers.slice(0, 5).map((p) => ({
      symbol: p.symbol,
      name: p.name,
      trailingPE: p.trailingPE,
      forwardPE: p.forwardPE,
      marketCap: p.marketCap,
      changePct: p.changePct,
      vsSelfTrailingPE: p.vsSelfTrailingPE,
      vsSelfForwardPE: p.vsSelfForwardPE,
    }));
  }
  if (Array.isArray(f.news)) {
    f.news = f.news.slice(0, 5).map((n) => ({
      title: String(n.title || "").slice(0, 120),
      publisher: n.publisher || undefined,
      published: n.published || undefined,
    }));
  }
  if (f.grounding) {
    f.grounding = {
      fundamentals: Boolean(f.grounding.fundamentals),
      peers: Boolean(f.grounding.peers),
      news: Boolean(f.grounding.news),
      note: "Use these numbers; if missing say unavailable. do not invent figures/headlines.",
    };
  }
  return pruneEmpty(f) || {};
}

async function generateJsonWithGemini({ system, userPrompt, maxOutputTokens = 8192 }) {
  const runOnce = (extra = {}) =>
    geminiGenerate({
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      systemInstruction: system,
      temperature: 0.2,
      maxOutputTokens,
      ...extra,
    });

  let res = await runOnce({ responseMimeType: "application/json" });
  if (!res.ok && /mime|responseMimeType|json/i.test(String(res.error || ""))) {
    res = await runOnce();
  }
  if (!res.ok) return res;

  let parsed = parseModelJson(res.text);
  if (parsed) return { ok: true, parsed, model: res.model, finishReason: res.finishReason };

  if (!String(res.text || "").trim()) {
    return {
      ok: false,
      error: `AI returned empty analysis (${res.finishReason || "no content"}). Try again.`,
      finishReason: res.finishReason,
    };
  }

  const broken = String(res.text || "").slice(0, 12000);
  const repairPrompt =
    `Repair into ONE valid JSON object. Keep complete fields only; drop incomplete trailing fields.\n` +
    `Output JSON only — no markdown.\n\nBROKEN:\n${broken}`;

  const repair = await geminiGenerate({
    contents: [{ role: "user", parts: [{ text: repairPrompt }] }],
    systemInstruction: "You repair JSON. Output only a valid JSON object.",
    temperature: 0,
    maxOutputTokens: Math.min(8192, maxOutputTokens),
    responseMimeType: "application/json",
  });

  if (repair.ok) {
    parsed = parseModelJson(repair.text);
    if (parsed) return { ok: true, parsed, model: res.model || repair.model, finishReason: repair.finishReason };
  }

  const repair2 = await geminiGenerate({
    contents: [{ role: "user", parts: [{ text: repairPrompt }] }],
    systemInstruction: "You repair JSON. Output only a valid JSON object.",
    temperature: 0,
    maxOutputTokens: Math.min(8192, maxOutputTokens),
  });
  if (repair2.ok) {
    parsed = parseModelJson(repair2.text);
    if (parsed) return { ok: true, parsed, model: res.model || repair2.model, finishReason: repair2.finishReason };
  }

  parsed = repairTruncatedJson(String(res.text || "").replace(/^[^{\[]+/, ""));
  if (parsed && typeof parsed === "object") {
    return { ok: true, parsed, model: res.model, finishReason: res.finishReason, repairedLocally: true };
  }

  return {
    ok: false,
    error: `AI returned unparseable analysis (${res.finishReason || "parse error"}). Try again.`,
    finishReason: res.finishReason,
    rawPreview: String(res.text || "").slice(0, 240),
  };
}

function slimTechnical(points, quote) {
  const closes = (points || []).map((p) => p.close).filter((c) => c != null);
  if (closes.length < 5) {
    return {
      periodReturnPct: null,
      rsi14: null,
      volatilityPct: null,
      trendVsMa20: null,
      trendVsMa50: null,
      periodHigh: null,
      periodLow: null,
    };
  }
  const first = closes[0];
  const last = closes[closes.length - 1];
  const periodReturnPct = first ? ((last - first) / first) * 100 : null;
  const periodHigh = Math.max(...closes);
  const periodLow = Math.min(...closes);

  function sma(period) {
    if (closes.length < period) return null;
    const slice = closes.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }
  const ma20 = sma(20);
  const ma50 = sma(50);
  const price = quote?.price ?? last;
  function vsMa(ma) {
    if (price == null || ma == null) return null;
    const diff = ((price - ma) / ma) * 100;
    if (diff > 1.5) return "above";
    if (diff < -1.5) return "below";
    return "near";
  }

  let rsi14 = null;
  if (closes.length >= 15) {
    let gains = 0;
    let losses = 0;
    for (let i = closes.length - 14; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    const avgGain = gains / 14;
    const avgLoss = losses / 14;
    rsi14 = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  let volatilityPct = null;
  if (closes.length >= 3) {
    const rets = [];
    for (let i = 1; i < closes.length; i++) {
      if (closes[i - 1]) rets.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
    volatilityPct = Math.sqrt(variance) * 100;
  }

  return {
    periodReturnPct: periodReturnPct != null ? Number(periodReturnPct.toFixed(2)) : null,
    rsi14: rsi14 != null ? Number(rsi14.toFixed(1)) : null,
    volatilityPct: volatilityPct != null ? Number(volatilityPct.toFixed(2)) : null,
    trendVsMa20: vsMa(ma20),
    trendVsMa50: vsMa(ma50),
    periodHigh,
    periodLow,
  };
}

function rangePositionPct(price, low, high) {
  if (price == null || low == null || high == null || high <= low) return null;
  return Number((((price - low) / (high - low)) * 100).toFixed(1));
}

function cacheGetWithTtl(key, ttlMs) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ttlMs) return hit.v;
  return null;
}

function yahooNum(v) {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "object" && v.raw != null) {
    const n = Number(v.raw);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function yahooStr(v) {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "object" && v.fmt != null) return String(v.fmt).trim();
  return String(v).trim();
}

function yahooEpochMs(v) {
  const n = yahooNum(v);
  if (n == null) return null;
  // Yahoo earnings dates are unix seconds
  return n < 1e12 ? n * 1000 : n;
}

function roundNum(n, digits = 2) {
  if (n == null || !Number.isFinite(Number(n))) return null;
  const f = 10 ** digits;
  return Math.round(Number(n) * f) / f;
}

function pctFromRatio(n) {
  if (n == null || !Number.isFinite(Number(n))) return null;
  // Yahoo growth/margins are usually ratios (0.12 = 12%)
  const v = Number(n);
  if (Math.abs(v) <= 1.5) return roundNum(v * 100, 2);
  return roundNum(v, 2);
}

async function yahooGetSoft(url) {
  try {
    return await yahooGet(url);
  } catch {
    return null;
  }
}

async function fetchQuoteSummaryFacts(symbol) {
  const key = `qsum:${symbol}`;
  const cached = cacheGetWithTtl(key, 30 * 60 * 1000);
  if (cached) return cached;

  const modules = [
    "assetProfile",
    "summaryProfile",
    "summaryDetail",
    "defaultKeyStatistics",
    "financialData",
    "earningsTrend",
    "calendarEvents",
    "price",
    "fundProfile",
    "topHoldings",
  ].join(",");
  const url =
    `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}` +
    `?modules=${encodeURIComponent(modules)}`;
  const data = await yahooGetSoft(url);
  const r = data?.quoteSummary?.result?.[0] || null;
  if (!r) {
    const empty = { ok: false, fundamentals: null };
    cacheSet(key, empty);
    return empty;
  }

  const profile = r.assetProfile || r.summaryProfile || {};
  const detail = r.summaryDetail || {};
  const stats = r.defaultKeyStatistics || {};
  const fin = r.financialData || {};
  const cal = r.calendarEvents || {};
  const priceMod = r.price || {};
  const fund = r.fundProfile || {};
  const holdings = r.topHoldings || {};

  const earningsDates = [];
  const rawDates = cal.earnings?.earningsDate;
  if (Array.isArray(rawDates)) {
    for (const d of rawDates) {
      const ms = yahooEpochMs(d);
      if (ms) earningsDates.push(new Date(ms).toISOString().slice(0, 10));
    }
  }

  let earningsGrowthEstimate = null;
  let revenueEstimateGrowth = null;
  const trends = Array.isArray(r.earningsTrend?.trend) ? r.earningsTrend.trend : [];
  const t0 = trends.find((t) => t?.period === "0y") || trends[0];
  const t1 = trends.find((t) => t?.period === "+1y");
  if (t0) {
    earningsGrowthEstimate = pctFromRatio(yahooNum(t0.growth) ?? yahooNum(t0.earningsEstimate?.growth));
    revenueEstimateGrowth = pctFromRatio(yahooNum(t0.revenueEstimate?.growth));
  }
  const forwardEps = yahooNum(t1?.earningsEstimate?.avg) ?? yahooNum(stats.forwardEps);

  const fundamentals = {
    sector: yahooStr(profile.sector) || null,
    industry: yahooStr(profile.industry) || null,
    country: yahooStr(profile.country) || null,
    employees: yahooNum(profile.fullTimeEmployees),
    website: yahooStr(profile.website) || null,
    description: yahooStr(profile.longBusinessSummary).slice(0, 1200) || null,
    quoteTypeHint: yahooStr(priceMod.quoteType) || null,
    trailingPE: yahooNum(detail.trailingPE) ?? yahooNum(stats.trailingPE),
    forwardPE: yahooNum(detail.forwardPE) ?? yahooNum(stats.forwardPE),
    pegRatio: yahooNum(stats.pegRatio),
    priceToBook: yahooNum(stats.priceToBook) ?? yahooNum(detail.priceToBook),
    enterpriseToEbitda: yahooNum(stats.enterpriseToEbitda),
    enterpriseValue: yahooNum(stats.enterpriseValue),
    revenueGrowthPct: pctFromRatio(yahooNum(fin.revenueGrowth)),
    earningsGrowthPct: pctFromRatio(yahooNum(fin.earningsGrowth)),
    earningsGrowthEstimatePct: earningsGrowthEstimate,
    revenueEstimateGrowthPct: revenueEstimateGrowth,
    grossMarginPct: pctFromRatio(yahooNum(fin.grossMargins)),
    operatingMarginPct: pctFromRatio(yahooNum(fin.operatingMargins)),
    profitMarginPct: pctFromRatio(yahooNum(fin.profitMargins) ?? yahooNum(stats.profitMargins)),
    returnOnEquityPct: pctFromRatio(yahooNum(fin.returnOnEquity)),
    totalCash: yahooNum(fin.totalCash),
    totalDebt: yahooNum(fin.totalDebt),
    debtToEquity: yahooNum(fin.debtToEquity),
    currentRatio: yahooNum(fin.currentRatio),
    freeCashflow: yahooNum(fin.freeCashflow),
    trailingEps: yahooNum(stats.trailingEps),
    forwardEps,
    targetMeanPrice: yahooNum(fin.targetMeanPrice),
    recommendationKey: yahooStr(fin.recommendationKey) || null,
    numberOfAnalystOpinions: yahooNum(fin.numberOfAnalystOpinions),
    beta: yahooNum(detail.beta) ?? yahooNum(stats.beta),
    dividendYieldPct: (() => {
      const y = yahooNum(detail.dividendYield) ?? yahooNum(detail.trailingAnnualDividendYield);
      if (y == null) return null;
      return Math.abs(y) <= 1 ? roundNum(y * 100, 2) : roundNum(y, 2);
    })(),
    nextEarningsDates: earningsDates.slice(0, 2),
    etfCategory: yahooStr(fund.categoryName) || yahooStr(fund.family) || null,
    etfHoldings:
      Array.isArray(holdings.holdings)
        ? holdings.holdings.slice(0, 8).map((h) => ({
            symbol: yahooStr(h.symbol) || null,
            name: yahooStr(h.holdingName) || null,
            pct: pctFromRatio(yahooNum(h.holdingPercent)),
          }))
        : [],
  };

  if (!fundamentals.etfHoldings.length) delete fundamentals.etfHoldings;
  if (!fundamentals.etfCategory) delete fundamentals.etfCategory;

  const payload = { ok: true, fundamentals };
  cacheSet(key, payload);
  return payload;
}

async function fetchRecommendedPeerSymbols(symbol) {
  const key = `peersym:${symbol}`;
  const cached = cacheGetWithTtl(key, 30 * 60 * 1000);
  if (cached) return cached;

  const urls = [
    `https://query2.finance.yahoo.com/v6/finance/recommendationsbysymbol/${encodeURIComponent(symbol)}`,
    `https://query1.finance.yahoo.com/v6/finance/recommendationsbysymbol/${encodeURIComponent(symbol)}`,
  ];
  let symbols = [];
  for (const url of urls) {
    const data = await yahooGetSoft(url);
    const rec =
      data?.finance?.result?.[0]?.recommendedSymbols || [];
    if (Array.isArray(rec) && rec.length) {
      symbols = rec
        .map((r) => normalizeSymbol(r.symbol || r))
        .filter((s) => s && s !== symbol)
        .slice(0, 6);
      break;
    }
  }

  if (!symbols.length) {
    const data = await yahooGetSoft(
      `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&quotesCount=12&newsCount=0`
    );
    symbols = (data?.quotes || [])
      .map((q) => normalizeSymbol(q.symbol))
      .filter((s) => s && s !== symbol && !s.includes("=") && !s.startsWith("^"))
      .slice(0, 5);
  }

  cacheSet(key, symbols);
  return symbols;
}

async function fetchPeerComparables(symbol, selfQuote, fundamentals) {
  try {
    const peerSyms = await fetchRecommendedPeerSymbols(symbol);
    if (!peerSyms.length) return [];

    const quotesRes = await fetchQuotes(peerSyms.slice(0, 5));
    const quotes = quotesRes?.quotes || [];
    const selfTrailing = roundNum(selfQuote?.trailingPE ?? fundamentals?.trailingPE, 2);
    const selfForward = roundNum(fundamentals?.forwardPE ?? selfQuote?.forwardPE, 2);

    return quotes.map((q) => {
      const trailingPE = q.trailingPE != null ? roundNum(q.trailingPE, 2) : null;
      const forwardPE = q.forwardPE != null ? roundNum(q.forwardPE, 2) : null;
      return {
        symbol: q.symbol,
        name: q.name,
        price: q.price,
        changePct: roundNum(q.changePct, 2),
        marketCap: q.marketCap,
        trailingPE,
        forwardPE,
        vsSelfTrailingPE:
          selfTrailing != null && trailingPE != null ? roundNum(trailingPE - selfTrailing, 2) : null,
        vsSelfForwardPE:
          selfForward != null && forwardPE != null ? roundNum(forwardPE - selfForward, 2) : null,
      };
    });
  } catch {
    return [];
  }
}

async function fetchSymbolNews(symbol, name) {
  const key = `news:${symbol}`;
  const cached = cacheGetWithTtl(key, 15 * 60 * 1000);
  if (cached) return cached;

  const nameToken = String(name || "")
    .replace(/\b(Inc\.?|Corp\.?|Ltd\.?|LLC|Holdings|Class\s+[A-Z]|USD|ETF)\b/gi, "")
    .split(/[,(]/)[0]
    .trim();

  const queries = [];
  if (nameToken && nameToken.length >= 3 && nameToken.toUpperCase() !== symbol) queries.push(nameToken);
  queries.push(symbol);
  if (nameToken && nameToken.includes(" ")) {
    const first = nameToken.split(/\s+/)[0];
    if (first && first.length >= 4) queries.push(first);
  }

  const seen = new Set();
  const items = [];
  const needle = `${symbol} ${nameToken}`.toLowerCase();

  for (const q of queries) {
    if (items.length >= 5) break;
    const data = await yahooGetSoft(
      `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=0&newsCount=10`
    );
    for (const n of data?.news || []) {
      const title = yahooStr(n.title || n.headline);
      if (!title || seen.has(title.toLowerCase())) continue;
      seen.add(title.toLowerCase());
      const pub =
        n.providerPublishTime != null
          ? new Date(
              n.providerPublishTime < 1e12 ? n.providerPublishTime * 1000 : n.providerPublishTime
            )
              .toISOString()
              .slice(0, 10)
          : null;
      items.push({
        title: title.slice(0, 180),
        publisher: yahooStr(n.publisher || n.provider) || null,
        published: pub,
        link: yahooStr(n.link || n.url) || null,
        _rel: needle
          .split(/\s+/)
          .filter((t) => t.length >= 3)
          .some((t) => title.toLowerCase().includes(t))
          ? 1
          : 0,
      });
    }
  }

  items.sort((a, b) => b._rel - a._rel);
  const out = items.slice(0, 5).map(({ _rel, ...rest }) => rest);
  cacheSet(key, out);
  return out;
}

async function gatherAnalysisEnrichment(symbol, quote) {
  const coverage = {
    fundamentals: false,
    peers: false,
    news: false,
  };

  const [summaryRes, newsItems] = await Promise.all([
    fetchQuoteSummaryFacts(symbol).catch(() => ({ ok: false, fundamentals: null })),
    fetchSymbolNews(symbol, quote?.name).catch(() => []),
  ]);

  const fundamentals = summaryRes?.fundamentals || null;
  if (fundamentals && (fundamentals.sector || fundamentals.description || fundamentals.forwardPE != null || fundamentals.revenueGrowthPct != null)) {
    coverage.fundamentals = true;
  }

  const peers = await fetchPeerComparables(symbol, quote, fundamentals);
  if (peers.length) coverage.peers = true;

  const news = Array.isArray(newsItems) ? newsItems.slice(0, 5) : [];
  if (news.length) coverage.news = true;

  if (fundamentals) {
    if (quote.trailingPE == null && fundamentals.trailingPE != null) quote.trailingPE = fundamentals.trailingPE;
    if (quote.beta == null && fundamentals.beta != null) quote.beta = fundamentals.beta;
    if (quote.dividendYield == null && fundamentals.dividendYieldPct != null) {
      quote.dividendYield = fundamentals.dividendYieldPct / 100;
    }
    if (quote.marketCap == null && fundamentals.enterpriseValue == null) {
      /* keep */
    }
  }

  return { fundamentals, peers, news, coverage };
}

function enrichMarketFacts(quote, technical3m, technical1y, enrichment) {
  const pos52 = rangePositionPct(quote?.price, quote?.fiftyTwoWeekLow, quote?.fiftyTwoWeekHigh);
  const fundamentals = enrichment?.fundamentals || null;
  const peers = Array.isArray(enrichment?.peers) ? enrichment.peers : [];
  const news = Array.isArray(enrichment?.news) ? enrichment.news : [];
  const coverage = enrichment?.coverage || { fundamentals: false, peers: false, news: false };

  return {
    symbol: quote.symbol,
    name: quote.name,
    exchange: quote.exchange,
    quoteType: quote.quoteType,
    currency: quote.currency,
    price: quote.price,
    changePct: quote.changePct,
    previousClose: quote.previousClose,
    open: quote.open,
    marketCap: quote.marketCap,
    trailingPE: quote.trailingPE,
    forwardPE: fundamentals?.forwardPE ?? null,
    epsTrailingTwelveMonths: quote.epsTrailingTwelveMonths,
    beta: quote.beta,
    dividendYield: quote.dividendYield,
    fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
    pctOf52WeekRange: pos52,
    dayHigh: quote.dayHigh,
    dayLow: quote.dayLow,
    volume: quote.volume,
    technical3m: technical3m || null,
    technical1y: technical1y || null,
    fundamentals: fundamentals
      ? {
          sector: fundamentals.sector,
          industry: fundamentals.industry,
          country: fundamentals.country,
          employees: fundamentals.employees,
          website: fundamentals.website,
          description: fundamentals.description,
          trailingPE: fundamentals.trailingPE,
          forwardPE: fundamentals.forwardPE,
          pegRatio: fundamentals.pegRatio,
          priceToBook: fundamentals.priceToBook,
          enterpriseToEbitda: fundamentals.enterpriseToEbitda,
          revenueGrowthPct: fundamentals.revenueGrowthPct,
          earningsGrowthPct: fundamentals.earningsGrowthPct,
          earningsGrowthEstimatePct: fundamentals.earningsGrowthEstimatePct,
          revenueEstimateGrowthPct: fundamentals.revenueEstimateGrowthPct,
          grossMarginPct: fundamentals.grossMarginPct,
          operatingMarginPct: fundamentals.operatingMarginPct,
          profitMarginPct: fundamentals.profitMarginPct,
          returnOnEquityPct: fundamentals.returnOnEquityPct,
          totalCash: fundamentals.totalCash,
          totalDebt: fundamentals.totalDebt,
          debtToEquity: fundamentals.debtToEquity,
          currentRatio: fundamentals.currentRatio,
          freeCashflow: fundamentals.freeCashflow,
          trailingEps: fundamentals.trailingEps,
          forwardEps: fundamentals.forwardEps,
          targetMeanPrice: fundamentals.targetMeanPrice,
          recommendationKey: fundamentals.recommendationKey,
          numberOfAnalystOpinions: fundamentals.numberOfAnalystOpinions,
          nextEarningsDates: fundamentals.nextEarningsDates,
          etfCategory: fundamentals.etfCategory || null,
          etfHoldings: fundamentals.etfHoldings || null,
        }
      : null,
    peers,
    news,
    grounding: {
      ...coverage,
      fetchedAt: new Date().toISOString(),
      note: "Use fundamentals/peers/news when present. If null/empty, say data unavailable: do not invent precise figures or dated headlines.",
    },
  };
}

function strList(arr, max = 8) {
  return Array.isArray(arr) ? arr.map((s) => String(s).trim()).filter(Boolean).slice(0, max) : [];
}

function normalizeAnalysis(raw, symbol, quote, technical, enrichment) {
  const a = raw && typeof raw === "object" ? raw : {};
  const scenarios = a.scenarios || {};
  const normalizeScenario = (s) => ({
    pct: Math.max(0, Math.min(100, Number(s?.pct) || 0)),
    thesis: String(s?.thesis || "").trim(),
    upsidePct: s?.upsidePct != null && s.upsidePct !== "" ? Number(s.upsidePct) : null,
    triggers: strList(s?.triggers, 5),
    whatMustHappen: strList(s?.whatMustHappen, 4),
  });
  const fund = enrichment?.fundamentals || null;
  const coverage = enrichment?.coverage || {};
  return {
    schemaVersion: 3,
    symbol,
    generatedAt: new Date().toISOString(),
    grounding: {
      fundamentals: Boolean(coverage.fundamentals),
      peers: Boolean(coverage.peers),
      news: Boolean(coverage.news),
      peerCount: Array.isArray(enrichment?.peers) ? enrichment.peers.length : 0,
      newsCount: Array.isArray(enrichment?.news) ? enrichment.news.length : 0,
      sector: fund?.sector || null,
      industry: fund?.industry || null,
      nextEarningsDates: fund?.nextEarningsDates || [],
    },
    quoteSnapshot: quote
      ? {
          name: quote.name,
          price: quote.price,
          changePct: quote.changePct,
          currency: quote.currency,
          trailingPE: quote.trailingPE ?? fund?.trailingPE ?? null,
          forwardPE: fund?.forwardPE ?? quote.forwardPE ?? null,
          marketCap: quote.marketCap,
          beta: quote.beta ?? fund?.beta ?? null,
          dividendYield: quote.dividendYield,
          fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
          fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
          pctOf52WeekRange: rangePositionPct(quote.price, quote.fiftyTwoWeekLow, quote.fiftyTwoWeekHigh),
          revenueGrowthPct: fund?.revenueGrowthPct ?? null,
          earningsGrowthPct: fund?.earningsGrowthPct ?? null,
          profitMarginPct: fund?.profitMarginPct ?? null,
          debtToEquity: fund?.debtToEquity ?? null,
          targetMeanPrice: fund?.targetMeanPrice ?? null,
        }
      : null,
    technicalFacts: technical || null,
    snapshot: {
      summary: String(a.snapshot?.summary || "").trim(),
      score: Math.max(1, Math.min(10, Number(a.snapshot?.score) || 5)),
      scoreWhy: String(a.snapshot?.scoreWhy || "").trim(),
      oneLiner: String(a.snapshot?.oneLiner || "").trim(),
      bullCase: String(a.snapshot?.bullCase || "").trim(),
      bearCase: String(a.snapshot?.bearCase || "").trim(),
      horizonMonths: a.snapshot?.horizonMonths != null ? Number(a.snapshot.horizonMonths) : null,
    },
    business: {
      model: String(a.business?.model || "").trim(),
      moat: String(a.business?.moat || "").trim(),
      pricingPower: String(a.business?.pricingPower || "").trim(),
      customers: String(a.business?.customers || "").trim(),
      segments: strList(a.business?.segments, 8),
      economics: String(a.business?.economics || "").trim(),
    },
    pipeline: {
      items: (Array.isArray(a.pipeline?.items) ? a.pipeline.items : [])
        .map((it) => ({
          title: String(it?.title || "").trim(),
          detail: String(it?.detail || "").trim(),
          horizon: String(it?.horizon || "").trim(),
          impact: ["high", "med", "low"].includes(String(it?.impact || "").toLowerCase())
            ? String(it.impact).toLowerCase()
            : "med",
          confidence: ["high", "med", "low"].includes(String(it?.confidence || "").toLowerCase())
            ? String(it.confidence).toLowerCase()
            : "med",
        }))
        .filter((it) => it.title)
        .slice(0, 10),
    },
    capitalAllocation: {
      summary: String(a.capitalAllocation?.summary || "").trim(),
      priorities: strList(a.capitalAllocation?.priorities, 6),
      balanceSheet: String(a.capitalAllocation?.balanceSheet || "").trim(),
      shareholderReturns: String(a.capitalAllocation?.shareholderReturns || "").trim(),
    },
    financials: {
      summary: String(a.financials?.summary || "").trim(),
      quality: String(a.financials?.quality || "").trim(),
      highlights: strList(a.financials?.highlights, 10),
      redFlags: strList(a.financials?.redFlags, 6),
    },
    valuation: {
      stance: ["cheap", "fair", "expensive"].includes(String(a.valuation?.stance || "").toLowerCase())
        ? String(a.valuation.stance).toLowerCase()
        : "fair",
      summary: String(a.valuation?.summary || "").trim(),
      vsPeers: String(a.valuation?.vsPeers || "").trim(),
      method: String(a.valuation?.method || "").trim(),
      impliedExpectations: String(a.valuation?.impliedExpectations || "").trim(),
      fairValueNote: String(a.valuation?.fairValueNote || "").trim(),
    },
    growth: {
      summary: String(a.growth?.summary || "").trim(),
      durability: String(a.growth?.durability || "").trim(),
      drivers: strList(a.growth?.drivers, 8),
      headwinds: strList(a.growth?.headwinds, 8),
      reinvestment: String(a.growth?.reinvestment || "").trim(),
    },
    competition: {
      summary: String(a.competition?.summary || "").trim(),
      position: String(a.competition?.position || "").trim(),
      peers: strList(a.competition?.peers, 8),
      advantages: strList(a.competition?.advantages, 6),
      threats: strList(a.competition?.threats, 6),
    },
    risks: (Array.isArray(a.risks) ? a.risks : [])
      .map((r) => ({
        severity: ["high", "med", "low"].includes(String(r?.severity || "").toLowerCase())
          ? String(r.severity).toLowerCase()
          : "med",
        title: String(r?.title || "").trim(),
        detail: String(r?.detail || "").trim(),
        mitigant: String(r?.mitigant || "").trim(),
      }))
      .filter((r) => r.title)
      .slice(0, 10),
    thesisKillers: {
      summary: String(a.thesisKillers?.summary || "").trim(),
      items: strList(a.thesisKillers?.items, 8),
    },
    scenarios: {
      bull: normalizeScenario(scenarios.bull),
      base: normalizeScenario(scenarios.base),
      bear: normalizeScenario(scenarios.bear),
    },
    technical: {
      summary: String(a.technical?.summary || "").trim(),
      bias: ["bullish", "bearish", "neutral"].includes(String(a.technical?.bias || "").toLowerCase())
        ? String(a.technical.bias).toLowerCase()
        : "neutral",
      levels: String(a.technical?.levels || "").trim(),
      invalidation: String(a.technical?.invalidation || "").trim(),
    },
    fit: {
      horizon: String(a.fit?.horizon || "").trim(),
      suitableFor: strList(a.fit?.suitableFor, 6),
      notFor: strList(a.fit?.notFor, 6),
      positionSizing: String(a.fit?.positionSizing || "").trim(),
    },
    watchlist: (Array.isArray(a.watchlist) ? a.watchlist : [])
      .map((w) => ({
        item: String(w?.item || "").trim(),
        why: String(w?.why || "").trim(),
        threshold: String(w?.threshold || "").trim(),
      }))
      .filter((w) => w.item)
      .slice(0, 10),
    verifyNext: {
      summary: String(a.verifyNext?.summary || "").trim(),
      questions: strList(a.verifyNext?.questions, 8),
    },
    bottomLine: {
      bullets: strList(a.bottomLine?.bullets, 6),
      conviction: ["high", "med", "low"].includes(String(a.bottomLine?.conviction || "").toLowerCase())
        ? String(a.bottomLine.conviction).toLowerCase()
        : "med",
      action: ["watch", "hold_research", "deeper_research"].includes(
        String(a.bottomLine?.action || "").toLowerCase()
      )
        ? String(a.bottomLine.action).toLowerCase()
        : "deeper_research",
      asymmetry: String(a.bottomLine?.asymmetry || "").trim(),
    },
  };
}

const ANALYSIS_CACHE_VERSION = "v3";

async function getCachedAnalysis(args) {
  const symbol = normalizeSymbol(args?.symbol);
  if (!symbol) return { ok: false, error: "Symbol required" };
  const lang = args?.lang === "he" ? "he" : "en";
  const key = `${symbol}:${lang}:${ANALYSIS_CACHE_VERSION}`;
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  const hit = loaded.data.analysisCache?.[key] || null;
  return { ok: true, symbol, lang, analysis: hit };
}

async function generateAiAnalysis(args) {
  const symbol = normalizeSymbol(args?.symbol);
  if (!symbol) return { ok: false, error: "Symbol required" };
  const force = Boolean(args?.force);
  const lang = args?.lang === "he" ? "he" : "en";
  const cacheKey = `${symbol}:${lang}:${ANALYSIS_CACHE_VERSION}`;

  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  if (!force && loaded.data.analysisCache?.[cacheKey]?.schemaVersion >= 3) {
    return { ok: true, cached: true, analysis: loaded.data.analysisCache[cacheKey] };
  }

  const [quoteRes, chart3m, chart1y] = await Promise.all([
    fetchQuotes([symbol]),
    fetchChart({ symbol, range: "3mo", interval: "1d" }),
    fetchChart({ symbol, range: "1y", interval: "1wk" }),
  ]);
  const quote = quoteRes.quotes?.[0] || null;
  if (!quote) return { ok: false, error: "Quote not found for symbol" };
  const technical3m = slimTechnical(chart3m.points || [], quote);
  const technical1y = slimTechnical(chart1y.points || [], quote);
  const technical = { ...technical3m, oneYear: technical1y };

  const enrichment = await gatherAnalysisEnrichment(symbol, quote);
  const facts = enrichMarketFacts(quote, technical3m, technical1y, enrichment);
  const factsForPrompt = compactAnalysisFacts(facts);

  const langName = lang === "he" ? "Hebrew" : "English";
  const system = `You are a senior equity research analyst writing for a serious desktop Stocks app.
Return ONLY valid JSON (no markdown) matching the schema exactly.
Depth rules:
- Be specific: name products, segments, competitors, metrics, and catalysts: avoid vague filler.
- LIVE FACTS may include fundamentals, peers[], and news[]. Ground financials, valuation, growth, competition, capital allocation, pipeline, and watchlist in those blocks when present.
- Prefer FACTS.fundamentals numbers (margins, growth %, debt, forwardPE, nextEarningsDates) over memory.
- Prefer FACTS.peers for relative valuation (vsPeers / competition.peers). Cite tickers and multiples from FACTS.
- Prefer FACTS.news titles/dates for near-term catalysts in pipeline and watchlist. Do NOT invent dated headlines that are not in FACTS.news.
- If a FACTS field is null/missing/empty, say data unavailable rather than inventing precise figures.
- Separate known facts from reasoned judgment; when uncertain, say so briefly inside the field.
- Scenarios: probabilities are estimates (sum ~100). Include realistic upsidePct for bull/base and downside for bear (signed % from current price).
- Never output a "buy now" recommendation. action must be watch | hold_research | deeper_research.
- Adapt categories for ETF/crypto/forex/commodity (pipeline = catalysts/adoption; moat = structural edge; use etfHoldings when present).
- Write ALL prose fields in ${langName}. Keep ticker symbols in Latin letters.
- HARD LENGTH: each string field max 1-2 short sentences (Hebrew: even shorter). Lists max 4 items. Prefer COMPLETE valid JSON over long prose.
- Prefer actionable insight: what matters, what breaks the thesis, what to verify next.`;

  try {
    const { gatherMslAiContext } = require("../msl/ai-context");
    const msl = await gatherMslAiContext("stocks", { label: "Stocks" });
    if (msl.promptBlock) system += msl.promptBlock.slice(0, 8000);
  } catch {
    /* optional */
  }

  const factsBlock = JSON.stringify(factsForPrompt);

  const schemaCore = `{
  "snapshot": {
    "oneLiner": "sharp one-sentence thesis",
    "summary": "2-3 short sentences: what it is, why it matters now",
    "score": 1-10,
    "scoreWhy": "brief scoring rationale",
    "bullCase": "1 sentence",
    "bearCase": "1 sentence",
    "horizonMonths": 12
  },
  "business": {
    "model": "how they make money",
    "moat": "durable advantage or lack thereof",
    "pricingPower": "pricing / retention",
    "customers": "who buys",
    "segments": ["up to 4"],
    "economics": "margins/scale intuition using FACTS"
  },
  "pipeline": {
    "items": [{
      "title": "catalyst (prefer FACTS.news / nextEarningsDates)",
      "detail": "why it matters",
      "horizon": "near|mid|long",
      "impact": "high|med|low",
      "confidence": "high|med|low"
    }]
  },
  "financials": {
    "summary": "cite FACTS.fundamentals numbers",
    "quality": "earnings/cash quality",
    "highlights": ["up to 4"],
    "redFlags": ["up to 3"]
  },
  "valuation": {
    "stance": "cheap|fair|expensive",
    "summary": "use trailing/forward PE from FACTS",
    "vsPeers": "vs FACTS.peers",
    "method": "best lens",
    "impliedExpectations": "what market prices in",
    "fairValueNote": "rich/cheap note; mention targetMeanPrice if present"
  },
  "growth": {
    "summary": "",
    "durability": "1-3y vs longer",
    "drivers": ["…"],
    "headwinds": ["…"],
    "reinvestment": "reinvestment quality"
  },
  "risks": [{
    "severity": "high|med|low",
    "title": "",
    "detail": "how value is destroyed",
    "mitigant": "if any"
  }],
  "technical": {
    "summary": "interpret technical3m/technical1y only",
    "bias": "bullish|bearish|neutral",
    "levels": "support/resistance from facts",
    "invalidation": "what flips bias"
  },
  "bottomLine": {
    "bullets": ["3-5 short points"],
    "conviction": "high|med|low",
    "action": "watch|hold_research|deeper_research",
    "asymmetry": "upside vs downside skew"
  }
}`;

  const schemaDeep = `{
  "capitalAllocation": {
    "summary": "how management deploys capital",
    "priorities": ["up to 4"],
    "balanceSheet": "leverage/liquidity from FACTS",
    "shareholderReturns": "buybacks/dividends"
  },
  "competition": {
    "summary": "",
    "position": "leader / challenger / niche",
    "peers": ["prefer FACTS.peers tickers"],
    "advantages": ["…"],
    "threats": ["…"]
  },
  "thesisKillers": {
    "summary": "what would kill the thesis",
    "items": ["specific falsifiers"]
  },
  "scenarios": {
    "bull": { "pct": 0-100, "upsidePct": 25, "thesis": "", "triggers": ["…"], "whatMustHappen": ["…"] },
    "base": { "pct": 0-100, "upsidePct": 8, "thesis": "", "triggers": ["…"], "whatMustHappen": ["…"] },
    "bear": { "pct": 0-100, "upsidePct": -20, "thesis": "", "triggers": ["…"], "whatMustHappen": ["…"] }
  },
  "fit": {
    "horizon": "holding mindset",
    "suitableFor": ["…"],
    "notFor": ["…"],
    "positionSizing": "conservative note (not advice)"
  },
  "watchlist": [{
    "item": "metric or event",
    "why": "why it matters",
    "threshold": "optional trigger"
  }],
  "verifyNext": {
    "summary": "what to verify before acting",
    "questions": ["up to 5"]
  }
}`;

  const promptFor = (label, schema) =>
    `Produce ${label} research JSON for this instrument.\n` +
    `Fill every field briefly. COMPLETE valid JSON beats long prose.\n` +
    `Ground claims in LIVE FACTS when available.\n\n` +
    `LIVE FACTS:\n${factsBlock}\n\nSCHEMA:\n${schema}`;

  const shortRetryPrompt = (label, schema) =>
    `RETRY: previous JSON failed. Return SHORT valid JSON only for ${label}.\n` +
    `1 sentence per field max. Arrays ≤3 items.\n\n` +
    `LIVE FACTS:\n${factsBlock}\n\nSCHEMA:\n${schema}`;

  async function runPass(label, schema) {
    let res = await generateJsonWithGemini({
      system,
      userPrompt: promptFor(label, schema),
      maxOutputTokens: 6144,
    });
    if (res.ok && res.parsed) return res;
    // Compact retry once
    res = await generateJsonWithGemini({
      system:
        system +
        "\nCRITICAL: Previous attempt failed parsing. Output minimal valid JSON only.",
      userPrompt: shortRetryPrompt(label, schema),
      maxOutputTokens: 4096,
    });
    return res;
  }

  const [coreRes, deepRes] = await Promise.all([
    runPass("CORE", schemaCore),
    runPass("DEEP", schemaDeep),
  ]);

  if (!coreRes.ok || !coreRes.parsed) {
    return {
      ok: false,
      error: coreRes.error || "AI returned unparseable analysis. Try again.",
      finishReason: coreRes.finishReason,
      rawPreview: coreRes.rawPreview,
    };
  }

  const parsed = {
    ...(coreRes.parsed || {}),
    ...((deepRes.ok && deepRes.parsed) || {}),
  };
  const analysis = normalizeAnalysis(parsed, symbol, quote, technical, enrichment);
  analysis.lang = lang;
  if (!deepRes.ok) analysis.partialDeep = true;
  loaded.data.analysisCache = loaded.data.analysisCache || {};
  loaded.data.analysisCache[cacheKey] = analysis;
  const keys = Object.keys(loaded.data.analysisCache);
  if (keys.length > 50) {
    keys
      .map((k) => ({ k, at: loaded.data.analysisCache[k]?.generatedAt || "" }))
      .sort((a, b) => String(a.at).localeCompare(String(b.at)))
      .slice(0, keys.length - 50)
      .forEach(({ k }) => delete loaded.data.analysisCache[k]);
  }
  await saveStorage({ data: loaded.data });
  return {
    ok: true,
    cached: false,
    analysis,
    model: coreRes.model || deepRes.model,
    partialDeep: !deepRes.ok,
  };
}

const CHANNELS = {
  "storage.load": () => loadStorage(),
  "storage.save": (args) => saveStorage(args),
  "market.modes": async () => {
    const loaded = await loadStorage();
    const base = listMarketModes();
    if (loaded.ok) base.activeMode = loaded.data.activeMode;
    return base;
  },
  "market.setMode": (args) => setMarketMode(args),
  "market.indices": (args) => fetchIndicesForMode(args?.mode || "stocks"),
  "market.watchlist": (args) => getWatchlistData(args),
  "market.movers": (args) => getMovers(args),
  "quote.get": (args) => fetchQuotes(args?.symbols || []),
  "chart.get": (args) => fetchChart(args),
  "search": (args) => searchSymbols(args),
  "symbols.catalog": () => {
    try {
      return require("./stocks-symbols").catalogStats();
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },
  "portfolio.get": () => getPortfolio(),
  "portfolio.set": (args) => setHolding(args),
  "alerts.list": async () => {
    const loaded = await loadStorage();
    return { ok: true, alerts: loaded.data?.alerts || [] };
  },
  "alerts.save": (args) => saveAlerts(args),
  "alerts.add": (args) => alertsAdd(args),
  "alerts.remove": (args) => alertsRemove(args),
  "alerts.check": () => checkAlerts(),
  "watchlist.add": (args) => watchlistAdd(args),
  "watchlist.remove": (args) => watchlistRemove(args),
  "buylist.list": async () => {
    const loaded = await loadStorage();
    return { ok: true, buyList: loaded.data?.buyList || [] };
  },
  "buylist.save": async (args) => {
    const loaded = await loadStorage();
    if (!loaded.ok) return loaded;
    loaded.data.buyList = normalizeBuyList(args?.buyList || []);
    return saveStorage({ data: loaded.data });
  },
  "analysis.getCached": (args) => getCachedAnalysis(args),
  "analysis.generate": (args) => generateAiAnalysis(args),
  "gemini-generate": (args) => geminiGenerate(args || {}),
  "gemini-chat": (args) => handleStocksGeminiChat(args),
};

async function handleStocksGeminiChat(args) {
  try {
    const messages = Array.isArray(args) ? args : args?.messages;
    const contents = [];
    for (const m of Array.isArray(messages) ? messages.slice(-8) : []) {
      const roleRaw = String(m?.role || "").toLowerCase();
      const role =
        roleRaw === "assistant" || roleRaw === "model"
          ? "model"
          : roleRaw === "user"
            ? "user"
            : null;
      if (!role) continue;
      const text = String(m?.content || "").trim();
      if (!text) continue;
      contents.push({ role, parts: [{ text }] });
    }
    if (!contents.length) return { ok: false, error: "Empty messages" };

    let system =
      "You are the Stocks research assistant inside My Space (separate from the host OS AI). " +
      "Help with equities, ETFs, crypto, forex, metals, portfolio thinking, valuation, risks, and catalysts. " +
      "Be clear, practical, and honest about uncertainty. Never pretend to place trades. " +
      "This is not personalized investment advice. Reply in the user's language.\n" +
      "If the user asks for a full structured multi-category analysis of a ticker, tell them to open AI Analysis and press “Fill all with AI”, " +
      "or confirm the symbol so the in-app analysis page can run it.";

    if (args && !Array.isArray(args)) {
      if (args.symbol) system += `\n\nActive symbol focus: ${String(args.symbol).toUpperCase()}.`;
      if (args.quoteSummary) system += `\nLive quote context:\n${String(args.quoteSummary).slice(0, 2500)}`;
      if (args.analysisSummary) system += `\nCached AI analysis summary:\n${String(args.analysisSummary).slice(0, 3500)}`;
      if (args.portfolioSummary) system += `\nPortfolio context:\n${String(args.portfolioSummary).slice(0, 2000)}`;
    }

    try {
      const { gatherMslAiContext } = require("../msl/ai-context");
      const msl = await gatherMslAiContext("stocks", { label: "Stocks" });
      if (msl.promptBlock) system += msl.promptBlock.slice(0, 8000);
    } catch {
      /* optional */
    }

    const res = await geminiGenerate({
      contents,
      systemInstruction: system,
      temperature: 0.4,
      maxOutputTokens: 4096,
    });
    if (!res.ok) return res;
    const parts = res.candidate?.content?.parts || [];
    const content = parts
      .map((p) => (typeof p?.text === "string" ? p.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim();
    if (!content) return { ok: false, error: "Empty response from Gemini" };
    return { ok: true, content, model: res.model };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

async function handleStocksInvoke(channel, args) {
  const authErr = signedInGuard();
  if (authErr) return authErr;
  const handler = CHANNELS[channel];
  if (!handler) return { ok: false, error: `Unknown channel: ${channel}` };
  try {
    return await handler(args);
  } catch (err) {
    const msg = String(err?.message || "Request failed");
    if (/fetch failed|network error/i.test(msg)) {
      return {
        ok: false,
        error:
          "Network connection to market data failed. Check internet/VPN/firewall and try Refresh.",
      };
    }
    return { ok: false, error: msg };
  }
}

module.exports = { handleStocksInvoke, startStocksAlertService, checkAlerts };