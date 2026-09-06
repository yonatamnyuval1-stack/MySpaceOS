const MARKET_MODES = {
  stocks: {
    id: "stocks",
    label: "Stocks",
    icon: "📊",
    subtitle: "NASDAQ watchlist · indices · heatmap",
    defaultWatchlist: [
      "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "AMD", "NFLX", "INTC",
      "AVGO", "COST", "PEP", "CSCO", "ADBE", "TXN", "QCOM", "AMAT", "INTU", "ISRG",
      "BKNG", "SBUX", "HON", "AMGN", "MU", "LRCX", "PANW", "CRWD", "APP", "PLTR",
      "GILD", "MDLZ", "ADP", "VRTX", "CMCSA", "REGN", "KLAC", "SNPS", "CDNS", "MAR",
      "ORLY", "CTAS",
    ],
    indices: [
      { symbol: "^IXIC", name: "NASDAQ Composite" },
      { symbol: "^NDX", name: "NASDAQ 100" },
      { symbol: "^GSPC", name: "S&P 500" },
      { symbol: "^DJI", name: "Dow Jones" },
    ],
    searchTypes: ["EQUITY"],
    nasdaqOnly: true,
    showMarketCap: true,
    showMovers: true,
    showIndices: true,
    searchPlaceholder: "Search NASDAQ — NVDA, Apple…",
  },
  intl: {
    id: "intl",
    label: "Intl Stocks",
    icon: "🌍",
    subtitle: "Global equities · ADRs & local listings",
    defaultWatchlist: [
      "ASML", "TM", "SAP", "NVO", "SONY", "BABA", "TSM", "7203.T", "005930.KS", "BP",
      "SHEL", "UL", "NESN.SW", "MC.PA", "OR.PA", "SIE.DE", "AIR.PA", "BHP", "RIO", "AZN",
      "HSBC", "RY", "TD", "SHOP", "SE", "MELI", "JD", "PDD", "INFY", "IBN",
      "SNY", "GSK", "SAN", "DB", "ING", "NOK", "ERIC", "UMC", "HMC", "MUFG",
      "SMFG", "NMR",
    ],
    indices: [
      { symbol: "^N225", name: "Nikkei 225" },
      { symbol: "^FTSE", name: "FTSE 100" },
      { symbol: "^GDAXI", name: "DAX" },
      { symbol: "^HSI", name: "Hang Seng" },
    ],
    searchTypes: ["EQUITY"],
    nasdaqOnly: false,
    intlOnly: true,
    showMarketCap: true,
    showMovers: true,
    showIndices: true,
    searchPlaceholder: "Search global stocks — Toyota, ASML…",
  },
  "etf-index": {
    id: "etf-index",
    label: "Index ETFs",
    icon: "📈",
    subtitle: "Broad market & index trackers",
    defaultWatchlist: [
      "SPY", "QQQ", "DIA", "IWM", "VTI", "VOO", "IVV", "RSP", "SPLG", "QQQM",
      "VB", "VO", "VV", "VUG", "VTV", "SCHB", "ITOT", "SPYG", "SPYV", "MDY",
      "IJH", "IJR", "IWB", "IWF", "IWD", "MTUM", "QUAL", "USMV", "VLUE", "SIZE",
      "SPYD", "NOBL", "DGRO", "VIG", "SCHD", "DVY", "SDY", "HDV", "VYM", "MGK",
      "MGV", "ONEQ",
    ],
    indices: [
      { symbol: "^GSPC", name: "S&P 500" },
      { symbol: "^IXIC", name: "NASDAQ" },
      { symbol: "^RUT", name: "Russell 2000" },
    ],
    searchTypes: ["ETF"],
    showMarketCap: false,
    showMovers: true,
    showIndices: true,
    searchPlaceholder: "Search index ETFs — SPY, QQQ…",
  },
  "etf-sector": {
    id: "etf-sector",
    label: "Sector ETFs",
    icon: "🏭",
    subtitle: "Technology, finance, energy sectors",
    defaultWatchlist: [
      "XLK", "XLF", "XLE", "XLV", "XLI", "XLP", "XLY", "XLU", "XLRE", "XLB",
      "XLC", "SMH", "SOXX", "IGV", "KRE", "XBI", "IBB", "ITA", "XHB", "XRT",
      "XME", "GDX", "TAN", "ICLN", "BOTZ", "HACK", "ARKK", "ARKW", "WCLD", "CLOU",
      "XSD", "PSI", "SKYY", "CIBR", "FINX", "BLOK", "HERO", "ESPO", "BETZ", "PAVE",
      "IFRA", "GRID",
    ],
    indices: [
      { symbol: "XLK", name: "Tech" },
      { symbol: "XLF", name: "Financials" },
      { symbol: "XLE", name: "Energy" },
    ],
    searchTypes: ["ETF"],
    showMarketCap: false,
    showMovers: true,
    showIndices: true,
    searchPlaceholder: "Search sector ETFs — XLK, XLF…",
  },
  "etf-bonds": {
    id: "etf-bonds",
    label: "Bond ETFs",
    icon: "🏛",
    subtitle: "Treasury & corporate bond funds",
    defaultWatchlist: [
      "TLT", "IEF", "SHY", "BND", "LQD", "HYG", "AGG", "TIP", "GOVT", "VGIT",
      "VGSH", "VGLT", "BNDX", "EMB", "JNK", "SJNK", "MUB", "VCIT", "VCSH", "VCLT",
      "IGSB", "IGIB", "IGLB", "BSV", "BIV", "BLV", "SCHZ", "SCHO", "SCHR", "SCHP",
      "TOTL", "NEAR", "MINT", "GSY", "TFLO", "SHV", "GBIL", "FLRN", "FLOT", "VRIG",
      "USHY", "ANGL",
    ],
    indices: [
      { symbol: "^TNX", name: "10Y Yield" },
      { symbol: "TLT", name: "20+ Yr Treasury" },
      { symbol: "BND", name: "Total Bond" },
    ],
    searchTypes: ["ETF"],
    showMarketCap: false,
    showMovers: true,
    showIndices: true,
    searchPlaceholder: "Search bond ETFs — TLT, BND…",
  },
  metals: {
    id: "metals",
    label: "Metals",
    icon: "🥇",
    subtitle: "Gold, silver, platinum · ETFs & futures",
    defaultWatchlist: [
      "GLD", "SLV", "IAU", "PPLT", "GDX", "GC=F", "SI=F", "HG=F", "PL=F", "GDXJ",
      "SIL", "RING", "PICK", "REMX", "DBB", "CPER", "AA", "FCX", "NEM", "GOLD",
      "AEM", "WPM", "FNV", "PAAS", "HL", "AG", "CDE", "RGLD", "KGC", "AU",
      "BTG", "EGO", "IAG", "OR", "SAND", "SSR", "NGD", "AGI", "HMY", "BVN",
      "SCCO", "TECK",
    ],
    indices: [
      { symbol: "GC=F", name: "Gold Fut." },
      { symbol: "SI=F", name: "Silver Fut." },
      { symbol: "GLD", name: "Gold ETF" },
    ],
    searchTypes: ["ETF", "FUTURE", "COMMODITY", "EQUITY"],
    showMarketCap: false,
    showMovers: true,
    showIndices: true,
    searchPlaceholder: "Search metals — GLD, gold…",
  },
  energy: {
    id: "energy",
    label: "Energy",
    icon: "⛽",
    subtitle: "Oil, gas & energy sector",
    defaultWatchlist: [
      "USO", "XLE", "XOP", "OIH", "CL=F", "NG=F", "UCO", "UNG", "BNO", "XES",
      "IEO", "PXE", "FCG", "AMLP", "MLPA", "KOLD", "BOIL", "ERX", "ERY", "DIG",
      "XOM", "CVX", "COP", "SLB", "EOG", "MPC", "PSX", "VLO", "OXY", "HAL",
      "DVN", "FANG", "CTRA", "OVV", "APA", "BKR", "WMB", "OKE", "KMI", "HES",
      "MRO", "CNQ",
    ],
    indices: [
      { symbol: "CL=F", name: "Crude Oil" },
      { symbol: "NG=F", name: "Natural Gas" },
      { symbol: "XLE", name: "Energy ETF" },
    ],
    searchTypes: ["ETF", "FUTURE", "EQUITY"],
    showMarketCap: false,
    showMovers: true,
    showIndices: true,
    searchPlaceholder: "Search energy — oil, XLE…",
  },
  commodities: {
    id: "commodities",
    label: "Commodities",
    icon: "🌾",
    subtitle: "Agriculture, softs & broad baskets",
    defaultWatchlist: [
      "DBC", "GSG", "PDBC", "ZW=F", "ZC=F", "ZS=F", "KC=F", "CC=F", "SB=F", "CT=F",
      "LE=F", "HE=F", "GF=F", "OJ=F", "LB=F", "DBA", "WEAT", "CORN", "SOYB", "CANE",
      "JO", "NIB", "COW", "MOO", "WOOD", "CUT", "UGA", "BNO", "USCI", "RJI",
      "FTGC", "COMB", "BCD", "FAAR", "CMDY", "HGER", "BCI", "GCC", "USO", "UNG",
      "GLD", "SLV",
    ],
    indices: [
      { symbol: "DBC", name: "Commodity ETF" },
      { symbol: "ZW=F", name: "Wheat" },
      { symbol: "ZC=F", name: "Corn" },
    ],
    searchTypes: ["ETF", "FUTURE", "COMMODITY"],
    showMarketCap: false,
    showMovers: true,
    showIndices: true,
    searchPlaceholder: "Search commodities — wheat, corn…",
  },
  indices: {
    id: "indices",
    label: "Indices",
    icon: "📉",
    subtitle: "Major global market benchmarks",
    defaultWatchlist: [
      "^IXIC", "^GSPC", "^DJI", "^NDX", "^RUT", "^VIX", "^N225", "^TA125.TA", "^FTSE", "^GDAXI",
      "^FCHI", "^STOXX50E", "^HSI", "^SSEC", "^KS11", "^AXJO", "^GSPTSE", "^BVSP", "^MXX", "^BSESN",
      "^NYA", "^XAX", "^MID", "^SOX", "^MOVE", "^TNX", "^FVX", "^TYX", "^IRX", "^OVX",
      "^RUA", "^RUI", "^OEX", "^DJA", "^TRAN", "^UTIL", "^NSEI", "^JKSE", "^KLSE", "^NZ50",
      "^SSMI", "^BFX",
    ],
    indices: [
      { symbol: "^VIX", name: "VIX" },
      { symbol: "^GSPC", name: "S&P 500" },
      { symbol: "^IXIC", name: "NASDAQ" },
    ],
    searchTypes: ["INDEX"],
    showMarketCap: false,
    showMovers: true,
    showIndices: false,
    searchPlaceholder: "Search indices — S&P, VIX…",
  },
  forex: {
    id: "forex",
    label: "Forex",
    icon: "💱",
    subtitle: "Major currency pairs",
    defaultWatchlist: [
      "EURUSD=X", "GBPUSD=X", "USDJPY=X", "USDCHF=X", "AUDUSD=X", "USDCAD=X", "USDILS=X", "USDCNY=X",
      "NZDUSD=X", "EURGBP=X", "EURJPY=X", "GBPJPY=X", "AUDJPY=X", "EURCHF=X", "USDSEK=X", "USDNOK=X",
      "USDMXN=X", "USDZAR=X", "USDTRY=X", "USDBRL=X", "USDINR=X", "USDKRW=X", "USDSGD=X", "USDHKD=X",
      "EURILS=X", "GBPILS=X", "CHFJPY=X", "CADJPY=X", "EURAUD=X", "GBPAUD=X",
      "EURCAD=X", "EURNZD=X", "GBPCAD=X", "GBPNZD=X", "AUDNZD=X", "AUDCAD=X", "NZDJPY=X", "CADCHF=X",
      "EURSEK=X", "EURNOK=X", "USDPLN=X", "USDHUF=X",
    ],
    indices: [
      { symbol: "EURUSD=X", name: "EUR/USD" },
      { symbol: "USDJPY=X", name: "USD/JPY" },
      { symbol: "USDILS=X", name: "USD/ILS" },
    ],
    searchTypes: ["CURRENCY"],
    showMarketCap: false,
    showMovers: true,
    showIndices: true,
    searchPlaceholder: "Search forex — EUR/USD, ILS…",
  },
  crypto: {
    id: "crypto",
    label: "Crypto",
    icon: "₿",
    subtitle: "Bitcoin, Ethereum & major coins",
    defaultWatchlist: [
      "BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD", "ADA-USD", "DOGE-USD", "BNB-USD", "AVAX-USD",
      "DOT-USD", "LINK-USD", "MATIC-USD", "LTC-USD", "BCH-USD", "ATOM-USD", "UNI-USD", "NEAR-USD",
      "APT-USD", "ARB-USD", "OP-USD", "SUI-USD", "PEPE-USD", "SHIB-USD", "TRX-USD", "XLM-USD",
      "ICP-USD", "FIL-USD", "AAVE-USD", "MKR-USD", "TON-USD", "RENDER-USD",
      "INJ-USD", "IMX-USD", "STX-USD", "GRT-USD", "ALGO-USD", "VET-USD", "FTM-USD", "SAND-USD",
      "MANA-USD", "AXS-USD", "EGLD-USD", "FLOW-USD",
    ],
    indices: [
      { symbol: "BTC-USD", name: "Bitcoin" },
      { symbol: "ETH-USD", name: "Ethereum" },
      { symbol: "SOL-USD", name: "Solana" },
    ],
    searchTypes: ["CRYPTOCURRENCY"],
    showMarketCap: false,
    showMovers: true,
    showIndices: true,
    searchPlaceholder: "Search crypto — BTC, ETH…",
  },
  reit: {
    id: "reit",
    label: "Real Estate",
    icon: "🏠",
    subtitle: "REITs & real estate ETFs",
    defaultWatchlist: [
      "VNQ", "IYR", "SCHH", "O", "PLD", "AMT", "EQIX", "SPG", "PSA", "WELL",
      "DLR", "CCI", "AVB", "EQR", "VICI", "EXR", "INVH", "MAA", "UDR", "ESS",
      "ARE", "BXP", "SLG", "VTR", "PEAK", "HST", "IRM", "SBAC", "WY", "XLRE",
      "REG", "KIM", "FRT", "NNN", "ADC", "STAG", "REXR", "EGP", "TRNO", "CUBE",
      "LSI", "NSA",
    ],
    indices: [
      { symbol: "VNQ", name: "REIT ETF" },
      { symbol: "IYR", name: "US Real Estate" },
      { symbol: "^DJUSRE", name: "DJ RE Index" },
    ],
    searchTypes: ["ETF", "EQUITY"],
    showMarketCap: true,
    showMovers: true,
    showIndices: true,
    searchPlaceholder: "Search REITs — VNQ, O…",
  },
  rates: {
    id: "rates",
    label: "Rates",
    icon: "📐",
    subtitle: "Treasury yields & rate-sensitive assets",
    defaultWatchlist: [
      "^TNX", "^FVX", "^TYX", "TLT", "IEF", "SHY", "TMV", "TBT", "^IRX", "GOVT",
      "VGIT", "VGSH", "VGLT", "EDV", "ZROZ", "TMF", "TBF", "PST", "TTT", "UBT",
      "SCHP", "VTIP", "STIP", "LQD", "HYG", "BND", "AGG", "BIL", "SGOV", "JPST",
      "SHYG", "USHY", "ANGL", "FALN", "HYDB", "FPE", "PFF", "PGX", "VRP", "PREF",
      "NPF", "PFFD",
    ],
    indices: [
      { symbol: "^TNX", name: "10Y Yield" },
      { symbol: "^FVX", name: "5Y Yield" },
      { symbol: "^TYX", name: "30Y Yield" },
    ],
    searchTypes: ["INDEX", "ETF"],
    showMarketCap: false,
    showMovers: true,
    showIndices: true,
    searchPlaceholder: "Search rates — TNX, TLT…",
  },
  emerging: {
    id: "emerging",
    label: "Emerging",
    icon: "🌏",
    subtitle: "Emerging markets ETFs & ADRs",
    defaultWatchlist: [
      "EEM", "VWO", "IEMG", "FXI", "EWZ", "INDA", "EWY", "EWT", "MCHI", "KWEB",
      "ASHR", "YINN", "EWW", "EZA", "ECH", "EPOL", "TUR", "THD", "EIDO", "EPHE",
      "SCHE", "EMXC", "FEM", "FM", "EEMA", "EEMV", "SPEM", "DEM", "FNDE", "DGS",
      "FLIN", "FLCH", "FLBR", "FLKR", "FLTW", "FEMS", "PXH", "EMGF", "RODM", "EEMS",
      "SMIN", "INDY",
    ],
    indices: [
      { symbol: "EEM", name: "EM ETF" },
      { symbol: "FXI", name: "China Large-Cap" },
      { symbol: "EWZ", name: "Brazil" },
    ],
    searchTypes: ["ETF", "EQUITY"],
    showMarketCap: false,
    showMovers: true,
    showIndices: true,
    searchPlaceholder: "Search emerging — EEM, FXI…",
  },
};

/** Previous defaults — upgrade stored lists that still match any of these. */
const PREVIOUS_DEFAULT_WATCHLISTS = {
  stocks: [
    ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "AMD", "NFLX", "INTC"],
    [
      "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "AMD", "NFLX", "INTC",
      "AVGO", "COST", "PEP", "CSCO", "ADBE", "TXN", "QCOM", "AMAT", "INTU", "ISRG",
      "BKNG", "SBUX", "HON", "AMGN", "MU", "LRCX", "PANW", "CRWD", "APP", "PLTR",
    ],
  ],
  intl: [
    ["ASML", "TM", "SAP", "NVO", "SONY", "BABA", "TSM", "7203.T", "005930.KS", "BP"],
    [
      "ASML", "TM", "SAP", "NVO", "SONY", "BABA", "TSM", "7203.T", "005930.KS", "BP",
      "SHEL", "UL", "NESN.SW", "MC.PA", "OR.PA", "SIE.DE", "AIR.PA", "BHP", "RIO", "AZN",
      "HSBC", "RY", "TD", "SHOP", "SE", "MELI", "JD", "PDD", "INFY", "IBN",
    ],
  ],
  "etf-index": [
    ["SPY", "QQQ", "DIA", "IWM", "VTI", "VOO", "IVV", "RSP"],
    [
      "SPY", "QQQ", "DIA", "IWM", "VTI", "VOO", "IVV", "RSP", "SPLG", "QQQM",
      "VB", "VO", "VV", "VUG", "VTV", "SCHB", "ITOT", "SPYG", "SPYV", "MDY",
      "IJH", "IJR", "IWB", "IWF", "IWD", "MTUM", "QUAL", "USMV", "VLUE", "SIZE",
    ],
  ],
  "etf-sector": [
    ["XLK", "XLF", "XLE", "XLV", "XLI", "XLP", "XLY", "XLU", "XLRE", "XLB"],
    [
      "XLK", "XLF", "XLE", "XLV", "XLI", "XLP", "XLY", "XLU", "XLRE", "XLB",
      "XLC", "SMH", "SOXX", "IGV", "KRE", "XBI", "IBB", "ITA", "XHB", "XRT",
      "XME", "GDX", "TAN", "ICLN", "BOTZ", "HACK", "ARKK", "ARKW", "WCLD", "CLOU",
    ],
  ],
  "etf-bonds": [
    ["TLT", "IEF", "SHY", "BND", "LQD", "HYG", "AGG", "TIP"],
    [
      "TLT", "IEF", "SHY", "BND", "LQD", "HYG", "AGG", "TIP", "GOVT", "VGIT",
      "VGSH", "VGLT", "BNDX", "EMB", "JNK", "SJNK", "MUB", "VCIT", "VCSH", "VCLT",
      "IGSB", "IGIB", "IGLB", "BSV", "BIV", "BLV", "SCHZ", "SCHO", "SCHR", "SCHP",
    ],
  ],
  metals: [
    ["GLD", "SLV", "IAU", "PPLT", "GDX", "GC=F", "SI=F", "HG=F", "PL=F"],
    [
      "GLD", "SLV", "IAU", "PPLT", "GDX", "GC=F", "SI=F", "HG=F", "PL=F", "GDXJ",
      "SIL", "RING", "PICK", "REMX", "DBB", "CPER", "AA", "FCX", "NEM", "GOLD",
      "AEM", "WPM", "FNV", "PAAS", "HL", "AG", "CDE", "RGLD", "KGC", "AU",
    ],
  ],
  energy: [
    ["USO", "XLE", "XOP", "OIH", "CL=F", "NG=F", "UCO", "UNG"],
    [
      "USO", "XLE", "XOP", "OIH", "CL=F", "NG=F", "UCO", "UNG", "BNO", "XES",
      "IEO", "PXE", "FCG", "AMLP", "MLPA", "KOLD", "BOIL", "ERX", "ERY", "DIG",
      "XOM", "CVX", "COP", "SLB", "EOG", "MPC", "PSX", "VLO", "OXY", "HAL",
    ],
  ],
  commodities: [
    ["DBC", "GSG", "PDBC", "ZW=F", "ZC=F", "ZS=F", "KC=F", "CC=F", "SB=F", "CT=F"],
    [
      "DBC", "GSG", "PDBC", "ZW=F", "ZC=F", "ZS=F", "KC=F", "CC=F", "SB=F", "CT=F",
      "LE=F", "HE=F", "GF=F", "OJ=F", "LB=F", "DBA", "WEAT", "CORN", "SOYB", "CANE",
      "JO", "NIB", "COW", "MOO", "WOOD", "CUT", "UGA", "BNO", "USCI", "RJI",
    ],
  ],
  indices: [
    ["^IXIC", "^GSPC", "^DJI", "^NDX", "^RUT", "^VIX", "^N225", "^TA125.TA", "^FTSE", "^GDAXI"],
    [
      "^IXIC", "^GSPC", "^DJI", "^NDX", "^RUT", "^VIX", "^N225", "^TA125.TA", "^FTSE", "^GDAXI",
      "^FCHI", "^STOXX50E", "^HSI", "^SSEC", "^KS11", "^AXJO", "^GSPTSE", "^BVSP", "^MXX", "^BSESN",
      "^NYA", "^XAX", "^MID", "^SOX", "^MOVE", "^TNX", "^FVX", "^TYX", "^IRX", "^OVX",
    ],
  ],
  forex: [
    ["EURUSD=X", "GBPUSD=X", "USDJPY=X", "USDCHF=X", "AUDUSD=X", "USDCAD=X", "USDILS=X", "USDCNY=X"],
    [
      "EURUSD=X", "GBPUSD=X", "USDJPY=X", "USDCHF=X", "AUDUSD=X", "USDCAD=X", "USDILS=X", "USDCNY=X",
      "NZDUSD=X", "EURGBP=X", "EURJPY=X", "GBPJPY=X", "AUDJPY=X", "EURCHF=X", "USDSEK=X", "USDNOK=X",
      "USDMXN=X", "USDZAR=X", "USDTRY=X", "USDBRL=X", "USDINR=X", "USDKRW=X", "USDSGD=X", "USDHKD=X",
      "EURILS=X", "GBPILS=X", "CHFJPY=X", "CADJPY=X", "EURAUD=X", "GBPAUD=X",
    ],
  ],
  crypto: [
    ["BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD", "ADA-USD", "DOGE-USD", "BNB-USD", "AVAX-USD"],
    [
      "BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD", "ADA-USD", "DOGE-USD", "BNB-USD", "AVAX-USD",
      "DOT-USD", "LINK-USD", "MATIC-USD", "LTC-USD", "BCH-USD", "ATOM-USD", "UNI-USD", "NEAR-USD",
      "APT-USD", "ARB-USD", "OP-USD", "SUI-USD", "PEPE-USD", "SHIB-USD", "TRX-USD", "XLM-USD",
      "ICP-USD", "FIL-USD", "AAVE-USD", "MKR-USD", "TON-USD", "RENDER-USD",
    ],
  ],
  reit: [
    ["VNQ", "IYR", "SCHH", "O", "PLD", "AMT", "EQIX", "SPG"],
    [
      "VNQ", "IYR", "SCHH", "O", "PLD", "AMT", "EQIX", "SPG", "PSA", "WELL",
      "DLR", "CCI", "AVB", "EQR", "VICI", "EXR", "INVH", "MAA", "UDR", "ESS",
      "ARE", "BXP", "SLG", "VTR", "PEAK", "HST", "IRM", "SBAC", "WY", "XLRE",
    ],
  ],
  rates: [
    ["^TNX", "^FVX", "^TYX", "TLT", "IEF", "SHY", "TMV", "TBT"],
    [
      "^TNX", "^FVX", "^TYX", "TLT", "IEF", "SHY", "TMV", "TBT", "^IRX", "GOVT",
      "VGIT", "VGSH", "VGLT", "EDV", "ZROZ", "TMF", "TBF", "PST", "TTT", "UBT",
      "SCHP", "VTIP", "STIP", "LQD", "HYG", "BND", "AGG", "BIL", "SGOV", "JPST",
    ],
  ],
  emerging: [
    ["EEM", "VWO", "IEMG", "FXI", "EWZ", "INDA", "EWY", "EWT"],
    [
      "EEM", "VWO", "IEMG", "FXI", "EWZ", "INDA", "EWY", "EWT", "MCHI", "KWEB",
      "ASHR", "YINN", "EWW", "EZA", "ECH", "EPOL", "TUR", "THD", "EIDO", "EPHE",
      "SCHE", "EMXC", "FEM", "FM", "EEMA", "EEMV", "SPEM", "DEM", "FNDE", "DGS",
    ],
  ],
};

const MODE_ORDER = [
  "stocks",
  "intl",
  "etf-index",
  "etf-sector",
  "etf-bonds",
  "metals",
  "energy",
  "commodities",
  "indices",
  "forex",
  "crypto",
  "reit",
  "rates",
  "emerging",
];

function getMode(id) {
  return MARKET_MODES[id] || MARKET_MODES.stocks;
}

function defaultWatchlists() {
  const out = {};
  for (const id of MODE_ORDER) {
    out[id] = [...getMode(id).defaultWatchlist];
  }
  return out;
}

function listsEqualIgnoreOrder(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  const sa = [...a].map(String).sort().join("|");
  const sb = [...b].map(String).sort().join("|");
  return sa === sb;
}

function maybeUpgradeWatchlist(modeId, list, defaultsForMode) {
  const prevLists = PREVIOUS_DEFAULT_WATCHLISTS[modeId];
  if (!prevLists || !Array.isArray(list) || !list.length) return defaultsForMode;
  const versions = Array.isArray(prevLists[0]) ? prevLists : [prevLists];
  for (const prev of versions) {
    if (listsEqualIgnoreOrder(list, prev)) return [...defaultsForMode];
  }
  return list;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    MARKET_MODES,
    MODE_ORDER,
    getMode,
    defaultWatchlists,
    PREVIOUS_DEFAULT_WATCHLISTS,
    maybeUpgradeWatchlist,
    listsEqualIgnoreOrder,
  };
} else {
  window.StocksModes = {
    MARKET_MODES,
    MODE_ORDER,
    getMode,
    defaultWatchlists,
    maybeUpgradeWatchlist,
  };
}
