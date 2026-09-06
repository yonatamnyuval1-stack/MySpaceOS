(function (root) {
  const MISS_KEY = "myspace-flag-quiz-misses";
  const SIMILAR_GROUPS = [];

  const GAMES = [
    {
      id: "name",
      icon: "🏳️",
      nameKey: "game.name",
      blurbKey: "game.name.blurb",
      kind: "mcq-name",
    },
    {
      id: "hard50",
      icon: "🎯",
      nameKey: "game.hard50",
      blurbKey: "game.hard50.blurb",
      kind: "mcq-name",
    },
    {
      id: "type",
      icon: "⌨️",
      nameKey: "game.type",
      blurbKey: "game.type.blurb",
      kind: "type-name",
    },
    {
      id: "find",
      icon: "🔍",
      nameKey: "game.find",
      blurbKey: "game.find.blurb",
      kind: "mcq-flag",
    },
    {
      id: "twins",
      icon: "👁️",
      nameKey: "game.twins",
      blurbKey: "game.twins.blurb",
      kind: "mcq-similar",
    },
    {
      id: "flash",
      icon: "⚡",
      nameKey: "game.flash",
      blurbKey: "game.flash.blurb",
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

  function nextGameId(currentId) {
    const i = Math.max(0, GAMES.findIndex((g) => g.id === currentId));
    return GAMES[(i + 1) % GAMES.length].id;
  }

  function byCodeMap(pool) {
    const m = new Map();
    for (const c of pool || []) m.set(c.code, c);
    return m;
  }

  function similarPoolFor(correct, pool, count) {
    if (root.FlagQuizSimilar?.similarPoolFor) {
      return root.FlagQuizSimilar.similarPoolFor(correct, pool, count);
    }
    const map = byCodeMap(pool);
    const rest = (pool || []).filter((c) => c.code !== correct.code);
    return [...rest].sort(() => Math.random() - 0.5).slice(0, count);
  }

  function flashMsForMode(mode) {
    if (mode === "random" || mode == null) return 900;
    const n = Number(mode);
    if (n === 1) return 1600;
    if (n === 2) return 1200;
    if (n === 3) return 900;
    if (n === 4) return 650;
    return 158; 
  }

  function normalizeAnswer(text) {
    return String(text || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[''`]/g, "")
      .replace(/[^a-z0-9\u0590-\u05ff\s]/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function editDistance(a, b, max = Infinity) {
    if (a === b) return 0;
    const la = a.length;
    const lb = b.length;
    if (Math.abs(la - lb) > max) return max + 1;
    if (!la) return lb;
    if (!lb) return la;
    let prev = new Array(lb + 1);
    let cur = new Array(lb + 1);
    for (let j = 0; j <= lb; j++) prev[j] = j;
    for (let i = 1; i <= la; i++) {
      cur[0] = i;
      let rowMin = cur[0];
      for (let j = 1; j <= lb; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (cur[j] < rowMin) rowMin = cur[j];
      }
      if (rowMin > max) return max + 1;
      [prev, cur] = [cur, prev];
    }
    return prev[lb];
  }

  function nameDistance(input, name) {
    if (!input || !name) return Infinity;
    if (input === name) return 0;
    const minPrefix = Math.min(4, name.length);
    if (name.startsWith(input) && input.length >= minPrefix) {
      return (name.length - input.length) * 0.25;
    }
    if (input.startsWith(name) && name.length >= 4) {
      return input.length - name.length;
    }
    return editDistance(input, name);
  }

  function countryNameDistance(input, country) {
    if (!country) return Infinity;
    const en = normalizeAnswer(country.name);
    const he = normalizeAnswer(country.nameHe || "");
    return Math.min(nameDistance(input, en), he ? nameDistance(input, he) : Infinity);
  }

  function closestCountry(input, pool) {
    const a = normalizeAnswer(input);
    if (!a) return null;
    const list = pool || root.FlagQuizData?.countries || [];
    let bestCode = null;
    let bestD = Infinity;
    let secondD = Infinity;
    for (const c of list) {
      if (!c?.code) continue;
      const d = countryNameDistance(a, c);
      if (d < bestD) {
        secondD = bestD;
        bestD = d;
        bestCode = c.code;
      } else if (d < secondD) {
        secondD = d;
      }
    }
    if (bestCode == null || !Number.isFinite(bestD)) return null;
    return { code: bestCode, distance: bestD, secondDistance: secondD };
  }

  function answersMatch(input, country, pool) {
    const a = normalizeAnswer(input);
    if (!a || !country) return false;
    const en = normalizeAnswer(country.name);
    const he = normalizeAnswer(country.nameHe || "");
    if (a === en || (he && a === he)) return true;

    const list = pool || root.FlagQuizData?.countries || [];
    if (!list.length) return false;
    const hit = closestCountry(a, list);
    if (!hit || hit.code !== country.code) return false;
    if (!(hit.distance < hit.secondDistance)) return false;
    const targetLen = Math.max(en.length, he.length, a.length, 1);
    const maxAllowed = Math.max(2, Math.floor(targetLen * 0.4));
    return hit.distance <= maxAllowed;
  }

  root.FlagQuizGames = {
    GAMES,
    SIMILAR_GROUPS,
    getGame,
    nextGameId,
    similarPoolFor,
    flashMsForMode,
    answersMatch,
    closestCountry,
    countryNameDistance,
    editDistance,
    normalizeAnswer,
    recordMiss,
    recordHit,
    loadMisses,
  };
})(window);