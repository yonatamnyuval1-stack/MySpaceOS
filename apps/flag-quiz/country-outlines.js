(function (root) {
  const OUTLINES = root.FlagQuizOutlineSvgs || {};

  function hasOutline(code) {
    return Boolean(OUTLINES[String(code || "").toLowerCase()]);
  }

  function outlineUrl(code) {
    return OUTLINES[String(code || "").toLowerCase()] || "";
  }

  function enrichOutline(country) {
    if (!country?.code) return country;
    const url = outlineUrl(country.code);
    if (!url) return { ...country };
    return { ...country, outlineImage: url };
  }

  function filterOutlinePool(pool) {
    return (pool || []).map(enrichOutline).filter((c) => c.outlineImage);
  }

  const themesApi = root.FlagQuizThemes;
  if (!themesApi) {
    console.warn("[flag-quiz] FlagQuizThemes missing: outlines theme skipped");
    return;
  }

  if (!themesApi.THEMES.some((t) => t.id === "outlines")) {
    themesApi.THEMES.push({
      id: "outlines",
      icon: "⬚",
      nameKey: "theme.outlines",
      blurbKey: "theme.outlines.blurb",
      nameGamesOnly: true,
    });
  }

  themesApi.hasOutline = hasOutline;
  themesApi.outlineUrl = outlineUrl;
  themesApi.enrichOutline = enrichOutline;
  themesApi.filterOutlinePool = filterOutlinePool;
  themesApi.outlineCount = Object.keys(OUTLINES).length;
  themesApi.OUTLINES = OUTLINES;
})(typeof window !== "undefined" ? window : globalThis);