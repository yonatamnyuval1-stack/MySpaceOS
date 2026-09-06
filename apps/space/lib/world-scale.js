window.SpaceWorldScale = (function () {
  const LOG_MIN = 3.78;
  const LOG_MAX = 15.2;
  const LOG_SURFACE = 3.804;

  const R_EARTH_KM = 6371;

  const BANDS = [
    { id: "earth", name: "Earth surface", logMin: 3.72, logMax: 3.92, hint: "Drag ↔ map · drag ↑ space · ↓ closer" },
    { id: "ocean", name: "Underwater", logMin: 3.68, logMax: 3.74, hint: "Swim · drag ↑ to surface · ↔ to move" },
    { id: "atmosphere", name: "Atmosphere & orbit", logMin: 3.92, logMax: 4.25, hint: "ISS · Moon path · drag ↑ into deep space" },
    { id: "solar", name: "Solar system", logMin: 4.25, logMax: 9.8, hint: "Planets · AU scale · drag ↔ pan" },
    { id: "neighborhood", name: "Near Sun · 50 ly", logMin: 9.8, logMax: 12.5, hint: "Local stars · drag ↔ pan" },
    { id: "galaxy", name: "Star map", logMin: 12.5, logMax: 14.2, hint: "5,600+ stars · drag ↔ pan" },
    { id: "cosmos", name: "Milky Way", logMin: 14.2, logMax: LOG_MAX, hint: "Galactic scale · drag ↔ pan" },
  ];

  const ANCHORS = [
    { label: "Earth surface", log: 3.804 },
    { label: "ISS orbit", log: 3.831 },
    { label: "Moon", log: 5.585 },
    { label: "1 AU", log: 8.175 },
    { label: "Neptune", log: 9.653 },
    { label: "1 light-year", log: 12.976 },
    { label: "50 light-years", log: 14.675 },
  ];

  function bandFromLog(log, currentBand, opts = {}) {
    const allowOcean = opts.allowOcean === true;
    if (allowOcean && log < 3.74) return "ocean";
    if (currentBand === "ocean" && allowOcean) return log >= 3.78 ? "earth" : "ocean";
    if (log < LOG_MIN) return "earth";

    const order = ["earth", "atmosphere", "solar", "neighborhood", "galaxy", "cosmos"];
    const thresholds = [3.92, 4.28, 9.85, 12.55, 14.25];
    if (!currentBand || !order.includes(currentBand)) {
      for (let i = 0; i < order.length; i++) {
        if (log < thresholds[i]) return order[i];
      }
      return "cosmos";
    }
    const idx = order.indexOf(currentBand);
    const up = thresholds[idx];
    const down = idx > 0 ? thresholds[idx - 1] - 0.06 : 3.74;
    if (idx < order.length - 1 && log >= up + 0.06) return order[idx + 1];
    if (idx > 0 && log < down) return order[idx - 1];
    return currentBand;
  }

  function bandInfo(id) {
    return BANDS.find((b) => b.id === id) || BANDS[0];
  }

  function formatDistance(log) {
    const km = 10 ** log;
    if (km < R_EARTH_KM * 1.02) {
      const alt = Math.max(0, km - R_EARTH_KM);
      if (alt < 2) return "sea level";
      if (alt < 1000) return `${Math.round(alt)} km altitude`;
      return `${(alt / 1000).toFixed(1)} Mm altitude`;
    }
    if (km < 1e6) return `${(km / 1000).toFixed(1)} thousand km`;
    if (km < 9.5e11) return `${(km / 1.496e8).toFixed(2)} AU`;
    return `${(km / 9.461e12).toFixed(2)} light-years`;
  }

  function earthLogZoom(worldLog) {
    return Math.max(-2.2, Math.min(4.5, (worldLog - 3.72) * 11 - 0.5));
  }

  function cosmosGalaxyLog(worldLog) {
    if (worldLog < 4.25) return 2.05;
    if (worldLog < 9.8) return 0.5;
    if (worldLog < 12.5) return 0.9;
    if (worldLog < 14.2) return -0.3;
    return -1.7;
  }

  function worldLogFromEarthZoom(z) {
    return 3.72 + (z + 0.5) / 11;
  }

  function clampLog(log) {
    return Math.max(LOG_MIN, Math.min(LOG_MAX, log));
  }

  return {
    LOG_MIN,
    LOG_MAX,
    BANDS,
    ANCHORS,
    bandFromLog,
    bandInfo,
    formatDistance,
    earthLogZoom,
    cosmosGalaxyLog,
    worldLogFromEarthZoom,
    clampLog,
    LOG_SURFACE,
    R_EARTH_KM,
  };
})();