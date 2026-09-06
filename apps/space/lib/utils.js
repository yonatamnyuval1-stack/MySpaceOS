window.Space = (function () {
  const { invoke: ipc } = window.myApp;

  async function invoke(channel, args) {
    const res = await ipc(channel, args);
    if (!res?.ok) throw new Error(res?.error || "Request failed");
    return res;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function uid(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function truncate(s, max = 4000) {
    const t = String(s || "");
    return t.length <= max ? t : `${t.slice(0, max)}…`;
  }

  const CATEGORY_LABELS = {
    sun: "Star",
    planet: "Planet",
    dwarf: "Dwarf planet",
    moon: "Moon",
    star: "Star",
    creature: "Marine life",
    country: "Country",
    city: "City",
    place: "Place",
    mission: "Mission",
    deepsky: "Deep sky",
  };

  const RARITY_LABELS = {
    common: "Common",
    uncommon: "Uncommon",
    rare: "Rare",
    legendary: "Legendary",
  };

  function categoryLabel(cat) {
    return CATEGORY_LABELS[cat] || cat;
  }

  function formatDistAU(au) {
    if (au == null || Number.isNaN(au)) return "—";
    if (au === 0) return "0 (center)";
    return `${au} AU`;
  }

  function starToBody(star) {
    return {
      id: star.id,
      name: star.name,
      category: "star",
      named: Boolean(star.named),
      description: star.named
        ? `Named star in ${star.constellation} — ${star.distLy} light-years from Earth.`
        : `Star in ${star.constellation} — catalog ${star.name}.`,
      distLy: star.distLy,
      magnitude: star.magnitude,
      spectral: star.spectral,
      constellation: star.constellation,
      color: star.color || "#ffffff",
      wikiTitle: star.wikiTitle || (star.named ? star.name : ""),
      facts: [
        `Distance: ${star.distLy} light-years`,
        `Apparent magnitude: ${star.magnitude}`,
        `Spectral type: ${star.spectral}`,
        `Constellation: ${star.constellation}`,
      ],
    };
  }

  function creatureToBody(creature) {
    const zoneLabels = {
      epipelagic: "Sunlight zone",
      reef: "Coral reef",
      mesopelagic: "Twilight zone",
      bathypelagic: "Midnight zone",
      abyssal: "Abyssal plain",
      hadal: "Hadal zone",
    };
    return {
      id: creature.id,
      name: creature.name,
      category: "creature",
      speciesId: creature.speciesId,
      rarity: creature.rarity,
      rarityLabel: RARITY_LABELS[creature.rarity] || creature.rarity,
      zone: creature.zone,
      zoneLabel: zoneLabels[creature.zone] || creature.zone,
      depthM: creature.depthM,
      emoji: creature.emoji,
      color: creature.color || "#38bdf8",
      featured: Boolean(creature.featured),
      description: `${creature.name} — ${RARITY_LABELS[creature.rarity] || creature.rarity} in the ${zoneLabels[creature.zone] || creature.zone}.`,
      wikiTitle: creature.wikiTitle || creature.name,
      facts: [
        `Depth: ${creature.depthM} m`,
        `Rarity: ${RARITY_LABELS[creature.rarity] || creature.rarity}`,
        `Zone: ${zoneLabels[creature.zone] || creature.zone}`,
      ],
    };
  }

  return {
    invoke,
    escapeHtml,
    uid,
    truncate,
    categoryLabel,
    formatDistAU,
    starToBody,
    creatureToBody,
    RARITY_LABELS,
    CATEGORY_LABELS,
  };
})();