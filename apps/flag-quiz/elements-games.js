(function (root) {
  const MISS_KEY = "myspace-learning-games-elements-misses";

  const GAMES = [
    {
      id: "name",
      icon: "⚛️",
      nameKey: "game.name.element",
      blurbKey: "game.name.element.blurb",
      kind: "mcq-name",
    },
    {
      id: "hard50",
      icon: "🎯",
      nameKey: "game.hard50.element",
      blurbKey: "game.hard50.element.blurb",
      kind: "mcq-name",
    },
    {
      id: "type",
      icon: "⌨️",
      nameKey: "game.type.element",
      blurbKey: "game.type.element.blurb",
      kind: "type-name",
    },
    {
      id: "find",
      icon: "🔍",
      nameKey: "game.find.element",
      blurbKey: "game.find.element.blurb",
      kind: "mcq-flag",
    },
    {
      id: "twins",
      icon: "👁️",
      nameKey: "game.twins.element",
      blurbKey: "game.twins.element.blurb",
      kind: "mcq-similar",
    },
    {
      id: "flash",
      icon: "⚡",
      nameKey: "game.flash.element",
      blurbKey: "game.flash.element.blurb",
      kind: "mcq-flash",
    },
  ];

  function loadMisses() {
    try {
      const raw = JSON.parse(localStorage.getItem(MISS_KEY) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch {
      return {};
    }
  }

  function recordMiss(code) {
    if (!code) return;
    const misses = loadMisses();
    misses[code] = (Number(misses[code]) || 0) + 1;
    localStorage.setItem(MISS_KEY, JSON.stringify(misses));
  }

  function recordHit(code) {
    if (!code) return;
    const misses = loadMisses();
    if (!misses[code]) return;
    misses[code] = Math.max(0, (Number(misses[code]) || 0) - 1);
    if (!misses[code]) delete misses[code];
    localStorage.setItem(MISS_KEY, JSON.stringify(misses));
  }

  function getGame(id) {
    return GAMES.find((g) => g.id === id) || GAMES[0];
  }

  function flashMsForMode(mode) {
    return root.FlagQuizGames?.flashMsForMode?.(mode) ?? 900;
  }

  function similarPoolFor(correct, pool, count) {
    return root.ElementsQuizData?.similarPoolFor?.(correct, pool, count) || [];
  }

  function normalizeAnswer(text) {
    return String(text || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[''`´]/g, "")
      .replace(/\s+/g, " ");
  }

  function answersMatch(input, element, pool) {
    const a = normalizeAnswer(input);
    if (!a || !element) return false;
    const en = normalizeAnswer(element.name);
    const he = normalizeAnswer(element.nameHe || "");
    const sym = normalizeAnswer(element.symbol || element.code);
    if (a === en || (he && a === he) || (sym && a === sym)) return true;
    if (root.FlagQuizGames?.answersMatch) {
      return root.FlagQuizGames.answersMatch(input, element, pool || root.ElementsQuizData?.elements || []);
    }
    return false;
  }

  root.ElementsQuizGames = {
    GAMES,
    getGame,
    similarPoolFor,
    flashMsForMode,
    answersMatch,
    recordMiss,
    recordHit,
    loadMisses,
    normalizeAnswer,
  };
})(window);
