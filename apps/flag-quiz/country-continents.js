(function (root) {
  const CONTINENTS = [
    { id: "africa", name: "Africa", nameHe: "אפריקה", icon: "🌍" },
    { id: "asia", name: "Asia", nameHe: "אסיה", icon: "🌏" },
    { id: "europe", name: "Europe", nameHe: "אירופה", icon: "🌍" },
    { id: "north-america", name: "North America", nameHe: "צפון אמריקה", icon: "🌎" },
    { id: "south-america", name: "South America", nameHe: "דרום אמריקה", icon: "🌎" },
    { id: "oceania", name: "Oceania", nameHe: "אוקיאניה", icon: "🌏" },
  ];

  const BY_CONTINENT = {
    africa: [
      "dz", "ao", "bj", "bw", "bf", "bi", "cv", "cm", "cf", "td", "km", "cg", "cd", "ci",
      "dj", "eg", "gq", "er", "sz", "et", "ga", "gm", "gh", "gn", "gw", "ke", "ls", "lr",
      "ly", "mg", "mw", "ml", "mr", "mu", "ma", "mz", "na", "ne", "ng", "rw", "st", "sn",
      "sc", "sl", "so", "za", "ss", "sd", "tz", "tg", "tn", "ug", "zm", "zw",
      "yt", "re", "sh", "eh",
    ],
    asia: [
      "af", "am", "az", "bh", "bd", "bt", "bn", "kh", "cn", "cy", "ge", "in", "id", "ir",
      "iq", "il", "jp", "jo", "kz", "kp", "kr", "kw", "kg", "la", "lb", "my", "mv", "mn",
      "mm", "np", "om", "pk", "ph", "qa", "sa", "sg", "lk", "sy", "tw", "tj", "th", "tl",
      "tr", "tm", "ae", "uz", "vn", "ye",
      "hk", "mo", "ps",
    ],
    europe: [
      "al", "ad", "at", "by", "be", "ba", "bg", "hr", "cz", "dk", "ee", "fi", "fr", "de",
      "gr", "hu", "is", "ie", "it", "lv", "li", "lt", "lu", "mt", "md", "mc", "me", "nl",
      "mk", "no", "pl", "pt", "ro", "ru", "sm", "rs", "sk", "si", "es", "se", "ch", "ua",
      "gb", "va",
      "ax", "fo", "gi", "gg", "im", "je", "xk",
    ],
    "north-america": [
      "ag", "bs", "bb", "bz", "ca", "cr", "cu", "dm", "do", "sv", "gd", "gt", "ht", "hn",
      "jm", "mx", "ni", "pa", "kn", "lc", "vc", "tt", "us",
      "ai", "aw", "bm", "vg", "ky", "cw", "gl", "gp", "mq", "ms", "pr", "bl", "pm", "sx",
      "tc", "vi",
    ],
    "south-america": [
      "ar", "bo", "br", "cl", "co", "ec", "gy", "py", "pe", "sr", "uy", "ve",
      "fk", "gf",
    ],
    oceania: [
      "au", "fj", "ki", "mh", "fm", "nr", "nz", "pw", "pg", "ws", "sb", "to", "tv", "vu",
      "as", "cx", "cc", "ck", "pf", "gu", "nc", "nu", "nf", "mp", "pn", "tk", "wf",
    ],
  };

  const CONTINENT_OF = Object.create(null);
  for (const [continentId, codes] of Object.entries(BY_CONTINENT)) {
    for (const code of codes) CONTINENT_OF[code] = continentId;
  }

  function continentById(id) {
    return CONTINENTS.find((c) => c.id === id) || null;
  }

  function continentOf(code) {
    return CONTINENT_OF[String(code || "").toLowerCase()] || "";
  }

  function continentLabel(continentOrId, lang) {
    const c = typeof continentOrId === "string" ? continentById(continentOrId) : continentOrId;
    if (!c) return "";
    if (lang === "he" && c.nameHe) return c.nameHe;
    return c.name || "";
  }

  function enrichContinent(country) {
    if (!country?.code) return country;
    const continent = continentOf(country.code);
    if (!continent) return { ...country };
    const meta = continentById(continent);
    return {
      ...country,
      continent,
      continentName: meta?.name || continent,
      continentNameHe: meta?.nameHe || "",
    };
  }

  function filterContinentPool(pool) {
    return (pool || []).map(enrichContinent).filter((c) => c.continent);
  }

  function continentOptions(lang) {
    return CONTINENTS.map((c) => ({
      code: c.id,
      name: c.name,
      nameHe: c.nameHe,
      icon: c.icon,
      label: continentLabel(c, lang),
    }));
  }

  function buildContinentQuiz(pool, length) {
    const enriched = filterContinentPool(pool);
    if (enriched.length < 4) return [];
    const n = Math.min(length, enriched.length);
    const picks = [...enriched].sort(() => Math.random() - 0.5).slice(0, n);
    for (let i = picks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [picks[i], picks[j]] = [picks[j], picks[i]];
    }
    return picks.map((correct) => {
      const options = CONTINENTS.map((c) => ({
        code: c.id,
        name: c.name,
        nameHe: c.nameHe,
        icon: c.icon,
      }));
      for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
      }
      return {
        correct,
        options,
        kind: "mcq-continent",
        answerCode: correct.continent,
      };
    });
  }

  const themesApi = root.FlagQuizThemes;
  if (!themesApi) {
    console.warn("[flag-quiz] FlagQuizThemes missing — continents theme skipped");
    return;
  }

  if (!themesApi.THEMES.some((t) => t.id === "continents")) {
    themesApi.THEMES.push({
      id: "continents",
      icon: "🌐",
      nameKey: "theme.continents",
      blurbKey: "theme.continents.blurb",
      nameGamesOnly: true,
      continentQuiz: true,
    });
  }

  themesApi.CONTINENTS = CONTINENTS;
  themesApi.continentOf = continentOf;
  themesApi.continentById = continentById;
  themesApi.continentLabel = continentLabel;
  themesApi.enrichContinent = enrichContinent;
  themesApi.filterContinentPool = filterContinentPool;
  themesApi.continentOptions = continentOptions;
  themesApi.buildContinentQuiz = buildContinentQuiz;
  themesApi.continentMappedCount = Object.keys(CONTINENT_OF).length;
})(typeof window !== "undefined" ? window : globalThis);
