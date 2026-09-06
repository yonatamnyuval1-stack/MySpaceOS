(function (root) {
  const DATA = root.FlagQuizCapitalsData || {};

  function hasCapital(code) {
    return Boolean(DATA[String(code || "").toLowerCase()]?.capital);
  }

  function getCapital(code) {
    return DATA[String(code || "").toLowerCase()] || null;
  }

  function capitalLabel(countryOrCode, lang) {
    const code = typeof countryOrCode === "string" ? countryOrCode : countryOrCode?.code;
    const row = getCapital(code) || countryOrCode;
    if (!row) return "";
    if (lang === "he" && row.capitalHe) return row.capitalHe;
    return row.capital || countryOrCode?.capital || "";
  }

  function enrichCapital(country) {
    if (!country?.code) return country;
    const row = getCapital(country.code);
    if (!row) return { ...country };
    return { ...country, capital: row.capital, capitalHe: row.capitalHe };
  }

  function filterCapitalPool(pool) {
    return (pool || []).map(enrichCapital).filter((c) => c.capital);
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function buildCapitalNameQuiz(pool, length, choiceCount = 4) {
    const enriched = filterCapitalPool(pool);
    const need = Math.max(4, choiceCount);
    if (enriched.length < need) return [];
    const n = Math.min(length, enriched.length);
    const picks = shuffle(enriched).slice(0, n);
    return picks.map((correct) => {
      const distractors = shuffle(enriched.filter((c) => c.code !== correct.code)).slice(0, choiceCount - 1);
      const options = shuffle([correct, ...distractors]);
      return { correct, options, kind: "mcq-capital" };
    });
  }

  function buildCapitalFindQuiz(pool, length, choiceCount = 4) {
    const enriched = filterCapitalPool(pool);
    const need = Math.max(4, choiceCount);
    if (enriched.length < need) return [];
    const n = Math.min(length, enriched.length);
    const picks = shuffle(enriched).slice(0, n);
    return picks.map((correct) => {
      const distractors = shuffle(enriched.filter((c) => c.code !== correct.code)).slice(0, choiceCount - 1);
      const options = shuffle([correct, ...distractors]);
      return { correct, options, kind: "mcq-flag-capital" };
    });
  }

  const themesApi = root.FlagQuizThemes;
  if (!themesApi) {
    console.warn("[flag-quiz] FlagQuizThemes missing: capitals theme skipped");
    return;
  }

  if (!themesApi.THEMES.some((t) => t.id === "capitals")) {
    themesApi.THEMES.push({
      id: "capitals",
      icon: "🏛️",
      nameKey: "theme.capitals",
      blurbKey: "theme.capitals.blurb",
      capitalGames: true,
    });
  }

  themesApi.hasCapital = hasCapital;
  themesApi.getCapital = getCapital;
  themesApi.capitalLabel = capitalLabel;
  themesApi.enrichCapital = enrichCapital;
  themesApi.filterCapitalPool = filterCapitalPool;
  themesApi.buildCapitalNameQuiz = buildCapitalNameQuiz;
  themesApi.buildCapitalFindQuiz = buildCapitalFindQuiz;
  themesApi.capitalCount = Object.keys(DATA).length;
})(typeof window !== "undefined" ? window : globalThis);