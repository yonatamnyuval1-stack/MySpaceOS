(function (root) {
  const DATA = root.FlagQuizAirportsData || {};

  function hasAirport(code) {
    return Boolean(DATA[String(code || "").toLowerCase()]?.iata);
  }

  function getAirport(code) {
    return DATA[String(code || "").toLowerCase()] || null;
  }

  function airportCode(countryOrCode) {
    const code = typeof countryOrCode === "string" ? countryOrCode : countryOrCode?.code;
    const row = getAirport(code) || countryOrCode;
    return String(row?.iata || "").toUpperCase();
  }

  function airportCityLabel(countryOrCode, lang) {
    const code = typeof countryOrCode === "string" ? countryOrCode : countryOrCode?.code;
    const row = getAirport(code) || countryOrCode;
    if (!row) return "";
    if (lang === "he" && row.cityHe) return row.cityHe;
    return row.city || "";
  }

  function airportNameLabel(countryOrCode, lang) {
    const code = typeof countryOrCode === "string" ? countryOrCode : countryOrCode?.code;
    const row = getAirport(code) || countryOrCode;
    if (!row) return "";
    if (lang === "he" && row.airportHe) return row.airportHe;
    return row.airport || "";
  }

  function enrichAirport(country) {
    if (!country?.code) return country;
    const row = getAirport(country.code);
    if (!row) return { ...country };
    return {
      ...country,
      iata: row.iata,
      airportCity: row.city,
      airportCityHe: row.cityHe,
      airportName: row.airport,
      airportNameHe: row.airportHe,
    };
  }

  function filterAirportPool(pool) {
    return (pool || []).map(enrichAirport).filter((c) => c.iata);
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function buildAirportNameQuiz(pool, length, choiceCount = 4) {
    const enriched = filterAirportPool(pool);
    const need = Math.max(4, choiceCount);
    if (enriched.length < need) return [];
    const n = Math.min(length, enriched.length);
    const picks = shuffle(enriched).slice(0, n);
    return picks.map((correct) => {
      const distractors = shuffle(enriched.filter((c) => c.code !== correct.code)).slice(0, choiceCount - 1);
      const options = shuffle([correct, ...distractors]);
      return { correct, options, kind: "mcq-airport" };
    });
  }

  function buildAirportFindQuiz(pool, length, choiceCount = 4) {
    const enriched = filterAirportPool(pool);
    const need = Math.max(4, choiceCount);
    if (enriched.length < need) return [];
    const n = Math.min(length, enriched.length);
    const picks = shuffle(enriched).slice(0, n);
    return picks.map((correct) => {
      const distractors = shuffle(enriched.filter((c) => c.code !== correct.code)).slice(0, choiceCount - 1);
      const options = shuffle([correct, ...distractors]);
      return { correct, options, kind: "mcq-flag-airport" };
    });
  }

  const themesApi = root.FlagQuizThemes;
  if (!themesApi) {
    console.warn("[flag-quiz] FlagQuizThemes missing — airports theme skipped");
    return;
  }

  if (!themesApi.THEMES.some((t) => t.id === "airports")) {
    themesApi.THEMES.push({
      id: "airports",
      icon: "✈️",
      nameKey: "theme.airports",
      blurbKey: "theme.airports.blurb",
      airportGames: true,
    });
  }

  themesApi.hasAirport = hasAirport;
  themesApi.getAirport = getAirport;
  themesApi.airportCode = airportCode;
  themesApi.airportCityLabel = airportCityLabel;
  themesApi.airportNameLabel = airportNameLabel;
  themesApi.enrichAirport = enrichAirport;
  themesApi.filterAirportPool = filterAirportPool;
  themesApi.buildAirportNameQuiz = buildAirportNameQuiz;
  themesApi.buildAirportFindQuiz = buildAirportFindQuiz;
  themesApi.airportCount = Object.keys(DATA).length;
})(typeof window !== "undefined" ? window : globalThis);
