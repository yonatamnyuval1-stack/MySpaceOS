const fs = require("fs");
const path = require("path");
const https = require("https");
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "data", "stocks-symbols.json");
const DATA = path.join(ROOT, "data");

function fetchUrl(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlinkSync(dest);
          return fetchUrl(res.headers.location, dest).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          file.close();
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve(dest)));
      })
      .on("error", (err) => {
        try {
          fs.unlinkSync(dest);
        } catch {
        }
        reject(err);
      });
  });
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function add(map, symbol, meta = {}) {
  const sym = String(symbol || "")
    .trim()
    .toUpperCase();
  if (!sym || sym.length > 12) return;
  const prev = map.get(sym);
  const name = String(meta.name || prev?.name || "").trim();
  const exchange = String(meta.exchange || prev?.exchange || "").trim();
  const sector = String(meta.sector || prev?.sector || "").trim();
  const industry = String(meta.industry || prev?.industry || "").trim();
  map.set(sym, {
    symbol: sym,
    name: name || sym,
    exchange,
    sector,
    industry,
  });
}

async function ensureSources() {
  fs.mkdirSync(DATA, { recursive: true });
  const sources = [
    [
      "nasdaq-full.json",
      "https://raw.githubusercontent.com/rreichel3/US-Stock-Symbols/main/nasdaq/nasdaq_full_tickers.json",
    ],
    [
      "nyse-full.json",
      "https://raw.githubusercontent.com/rreichel3/US-Stock-Symbols/main/nyse/nyse_full_tickers.json",
    ],
    [
      "stocks-tickers-raw.txt",
      "https://raw.githubusercontent.com/rreichel3/US-Stock-Symbols/main/all/all_tickers.txt",
    ],
  ];
  for (const [name, url] of sources) {
    const dest = path.join(DATA, name);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) continue;
    console.log(`Downloading ${name}…`);
    await fetchUrl(url, dest);
  }
}

async function main() {
  await ensureSources();
  const map = new Map();

  for (const [file, exchange] of [
    ["nasdaq-full.json", "NASDAQ"],
    ["nyse-full.json", "NYSE"],
  ]) {
    const full = path.join(DATA, file);
    if (!fs.existsSync(full)) continue;
    for (const r of loadJson(full)) {
      add(map, r.symbol, {
        name: r.name,
        exchange,
        sector: r.sector,
        industry: r.industry,
      });
    }
  }

  const tickersFile = path.join(DATA, "stocks-tickers-raw.txt");
  if (fs.existsSync(tickersFile)) {
    for (const line of fs.readFileSync(tickersFile, "utf8").split(/\r?\n/)) {
      add(map, line.trim());
    }
  }

  const extras = [
    ["BTC-USD", "Bitcoin USD", "CCC"],
    ["ETH-USD", "Ethereum USD", "CCC"],
    ["SOL-USD", "Solana USD", "CCC"],
    ["BNB-USD", "BNB USD", "CCC"],
    ["XRP-USD", "XRP USD", "CCC"],
    ["ADA-USD", "Cardano USD", "CCC"],
    ["DOGE-USD", "Dogecoin USD", "CCC"],
    ["EURUSD=X", "EUR/USD", "CCY"],
    ["GBPUSD=X", "GBP/USD", "CCY"],
    ["USDILS=X", "USD/ILS", "CCY"],
    ["JPY=X", "USD/JPY", "CCY"],
    ["GC=F", "Gold Futures", "COM"],
    ["SI=F", "Silver Futures", "COM"],
    ["CL=F", "Crude Oil", "COM"],
    ["^GSPC", "S&P 500", "IDX"],
    ["^DJI", "Dow Jones", "IDX"],
    ["^IXIC", "NASDAQ Composite", "IDX"],
  ];
  for (const [symbol, name, exchange] of extras) {
    add(map, symbol, { name, exchange });
  }

  const symbols = [...map.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
  fs.writeFileSync(
    OUT,
    JSON.stringify({
      updatedAt: new Date().toISOString(),
      count: symbols.length,
      symbols,
    })
  );
  console.log(`Wrote ${symbols.length} symbols → ${OUT}`);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});