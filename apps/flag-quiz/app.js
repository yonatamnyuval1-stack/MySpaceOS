(function () {
  const STORAGE_KEY = "myspace-flag-quiz-scores";
  const BEST_TIME_KEY = "myspace-flag-quiz-l5-bests";
  const BEST_TIME_LEGACY_KEY = "myspace-flag-quiz-l5-best-ms";
  const TYPE_HARD_STATS_KEY = "myspace-flag-quiz-type-hard-stats";
  const HARD50_TIMED_STATS_KEY = "myspace-flag-quiz-hard50-timed-stats";
  const GAME_KEY = "myspace-flag-quiz-game";
  const ELEMENTS_GAME_KEY = "myspace-learning-games-elements-game";
  const MODELS_GAME_KEY = "myspace-learning-games-models-game";
  const RANDOM_LENGTH = 20;
  const HARD50_QUIZ_LENGTH = 50;
  const HARD50_GAME_ID = "hard50";
  const HARD50_TIMED_MODE = "timed";
  const HARD50_TIMED_BEST_KEY = "hard50-timed";
  const MODELS_HARD_GAME_ID = "hard";
  const TYPE_GAME_ID = "type";
  const LEVEL5_TIME_MS = 2 * 60 * 1000;
  const TYPE_HARD_TIME_MS = 60 * 1000;
  const HARD50_TIMED_TIME_MS = 2 * 60 * 1000;
  const LEVEL5_RECORD_MIN_SCORE = 18;
  const HARD50_TIMED_RECORD_MIN_SCORE = 46; // 50 questions — up to 4 wrongs still qualify for records
  const LEVEL5_WRONG_PENALTY_MS = 1000;

  const state = {
    page: "home",
    categoryId: "countries",
    gameId: "name",
    themeId: "flags",
    mode: "random",
    length: RANDOM_LENGTH,
    questions: [],
    index: 0,
    score: 0,
    answered: false,
    review: [],
    timed: false,
    startedAt: 0,
    endsAt: 0,
    elapsedMs: 0,
    timedOut: false,
    finished: false,
    timerId: null,
    advanceTimer: null,
    flashTimer: null,
  };

  const $ = (id) => document.getElementById(id);
  const t = (key, vars) => window.FlagQuizI18n?.t?.(key, vars) || key;
  const lang = () => window.FlagQuizI18n?.lang?.() || "en";
  const label = (entity) => {
    if (isModelsCategory()) {
      return window.ModelsQuizData?.modelLabel?.(entity) || entity?.name || "";
    }
    if (isElementsCategory()) {
      return window.ElementsQuizData?.elementLabel?.(entity, lang()) || entity?.name || "";
    }
    return window.FlagQuizData?.countryLabel?.(entity, lang()) || entity?.name || "";
  };
  const isElementsCategory = () => state.categoryId === "elements";
  const isModelsCategory = () => state.categoryId === "models";
  const isNonCountryCategory = () => isElementsCategory() || isModelsCategory();
  const gameMeta = () => {
    if (isModelsCategory()) {
      return (
        window.ModelsQuizGames?.getGame?.(state.gameId) || {
          id: "input",
          kind: "mcq-price",
          nameKey: "game.models.input",
          blurbKey: "game.models.input.blurb",
        }
      );
    }
    if (isElementsCategory()) {
      return (
        window.ElementsQuizGames?.getGame?.(state.gameId) || {
          id: "name",
          kind: "mcq-name",
          nameKey: "game.name.element",
          blurbKey: "game.name.element.blurb",
        }
      );
    }
    return window.FlagQuizGames?.getGame?.(state.gameId) || { id: "name", kind: "mcq-name" };
  };
  const isAnimalsTheme = () => !isNonCountryCategory() && state.themeId === "animals";
  const isOutlinesTheme = () => !isNonCountryCategory() && state.themeId === "outlines";
  const isContinentsTheme = () => !isNonCountryCategory() && state.themeId === "continents";
  const isStatusTheme = () => !isNonCountryCategory() && state.themeId === "status";
  const isCapitalsTheme = () => !isNonCountryCategory() && state.themeId === "capitals";
  const isAirportsTheme = () => !isNonCountryCategory() && state.themeId === "airports";
  const isNameOnlyTheme = () => {
    const th = window.FlagQuizThemes?.getTheme?.(state.themeId);
    return (
      Boolean(th?.nameGamesOnly) ||
      isAnimalsTheme() ||
      isOutlinesTheme() ||
      isContinentsTheme() ||
      isStatusTheme()
    );
  };
  const animalName = (country) =>
    window.FlagQuizThemes?.animalLabel?.(country, lang()) || country?.animal || "";
  const continentName = (countryOrId) =>
    window.FlagQuizThemes?.continentLabel?.(
      typeof countryOrId === "string" ? countryOrId : countryOrId?.continent || countryOrId,
      lang()
    ) || countryOrId?.continentName || "";
  const statusName = (countryOrId) =>
    window.FlagQuizThemes?.statusLabel?.(
      typeof countryOrId === "string" ? countryOrId : countryOrId?.status || countryOrId,
      lang()
    ) || countryOrId?.statusName || "";
  const capitalName = (country) =>
    window.FlagQuizThemes?.capitalLabel?.(country, lang()) || country?.capital || "";
  const airportIata = (country) =>
    window.FlagQuizThemes?.airportCode?.(country) || country?.iata || "";
  const airportCity = (country) =>
    window.FlagQuizThemes?.airportCityLabel?.(country, lang()) || country?.airportCity || "";
  const optionLabel = (opt) => {
    if (isContinentsTheme()) return continentName(opt) || label(opt);
    if (isStatusTheme()) return statusName(opt) || label(opt);
    const qKind = state.questions[state.index]?.kind;
    if (qKind === "mcq-price" || qKind === "mcq-price-pair") {
      return opt?.label || String(opt?.code || "");
    }
    if (qKind === "mcq-capital") return capitalName(opt) || label(opt);
    if (qKind === "mcq-airport") return airportIata(opt) || label(opt);
    return label(opt);
  };

  function availableGames() {
    if (isModelsCategory()) {
      return window.ModelsQuizGames?.GAMES || [];
    }
    if (isElementsCategory()) {
      return window.ElementsQuizGames?.GAMES || [];
    }
    const all = window.FlagQuizGames?.GAMES || [];
    if (isCapitalsTheme() || isAirportsTheme()) {
      return all.filter((g) => g.id === "name" || g.id === "find" || g.id === "hard50");
    }
    if (!isNameOnlyTheme()) return all;
    return all.filter((g) => g.kind === "mcq-name");
  }

  function ensureGameFitsTheme() {
    const ok = availableGames().some((g) => g.id === state.gameId);
    if (!ok) {
      state.gameId = availableGames()[0]?.id || "name";
      saveGame(state.gameId);
    }
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function loadScores() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  function saveScore(entry) {
    const next = [entry, ...loadScores()].slice(0, 30);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  function loadBestTimesMap() {
    try {
      const raw = JSON.parse(localStorage.getItem(BEST_TIME_KEY) || "{}");
      if (raw && typeof raw === "object" && !Array.isArray(raw)) return { ...raw };
    } catch {
      /* ignore */
    }
    // migrate legacy single Name-the-Flag record
    const legacy = Number(localStorage.getItem(BEST_TIME_LEGACY_KEY));
    if (Number.isFinite(legacy) && legacy > 0) {
      const migrated = { name: legacy };
      localStorage.setItem(BEST_TIME_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return {};
  }

  function loadBestTimeMs(gameId = state.gameId) {
    const n = Number(loadBestTimesMap()[gameId]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function saveBestTimeMs(ms, gameId = state.gameId) {
    const map = loadBestTimesMap();
    const prev = Number(map[gameId]);
    const prevOk = Number.isFinite(prev) && prev > 0 ? prev : null;
    if (prevOk == null || ms < prevOk) {
      map[gameId] = ms;
      localStorage.setItem(BEST_TIME_KEY, JSON.stringify(map));
      return { bestMs: ms, isNew: true };
    }
    return { bestMs: prevOk, isNew: false };
  }

  function isTypeHardMode(mode = state.mode) {
    return state.gameId === TYPE_GAME_ID && Number(mode) === 5;
  }

  function isHard50TimedMode(mode = state.mode) {
    return (
      state.gameId === HARD50_GAME_ID &&
      mode === HARD50_TIMED_MODE &&
      !isNonCountryCategory() &&
      state.themeId === "flags"
    );
  }

  function isRaceTimedMode(mode = state.mode) {
    return isTypeHardMode(mode) || isHard50TimedMode(mode);
  }

  function showHard50TimedStage() {
    return (
      state.gameId === HARD50_GAME_ID &&
      !isNonCountryCategory() &&
      state.themeId === "flags"
    );
  }

  function bestTimeKeyForMode(mode = state.mode) {
    if (isHard50TimedMode(mode)) return HARD50_TIMED_BEST_KEY;
    return state.gameId;
  }

  function recordMinScoreForMode(mode = state.mode) {
    if (isHard50TimedMode(mode)) return HARD50_TIMED_RECORD_MIN_SCORE;
    return LEVEL5_RECORD_MIN_SCORE;
  }

  function loadTypeHardStats() {
    try {
      const raw = JSON.parse(localStorage.getItem(TYPE_HARD_STATS_KEY) || "{}");
      const attempts = Math.max(0, Number(raw.attempts) || 0);
      const cleared = Math.max(0, Math.min(attempts, Number(raw.cleared) || 0));
      return { attempts, cleared };
    } catch {
      return { attempts: 0, cleared: 0 };
    }
  }

  function recordTypeHardAttempt({ cleared }) {
    const prev = loadTypeHardStats();
    const next = {
      attempts: prev.attempts + 1,
      cleared: prev.cleared + (cleared ? 1 : 0),
    };
    localStorage.setItem(TYPE_HARD_STATS_KEY, JSON.stringify(next));
    return {
      ...next,
      clearPct: next.attempts ? Math.round((next.cleared / next.attempts) * 100) : 0,
    };
  }

  function typeHardClearPct(stats = loadTypeHardStats()) {
    if (!stats.attempts) return null;
    return Math.round((stats.cleared / stats.attempts) * 100);
  }

  function loadHard50TimedStats() {
    try {
      const raw = JSON.parse(localStorage.getItem(HARD50_TIMED_STATS_KEY) || "{}");
      const attempts = Math.max(0, Number(raw.attempts) || 0);
      const cleared = Math.max(0, Math.min(attempts, Number(raw.cleared) || 0));
      return { attempts, cleared };
    } catch {
      return { attempts: 0, cleared: 0 };
    }
  }

  function recordHard50TimedAttempt({ cleared }) {
    const prev = loadHard50TimedStats();
    const next = {
      attempts: prev.attempts + 1,
      cleared: prev.cleared + (cleared ? 1 : 0),
    };
    localStorage.setItem(HARD50_TIMED_STATS_KEY, JSON.stringify(next));
    return {
      ...next,
      clearPct: next.attempts ? Math.round((next.cleared / next.attempts) * 100) : 0,
    };
  }

  function hard50TimedClearPct(stats = loadHard50TimedStats()) {
    if (!stats.attempts) return null;
    return Math.round((stats.cleared / stats.attempts) * 100);
  }

  function timeLimitMs(mode = state.mode) {
    if (isTypeHardMode(mode)) return TYPE_HARD_TIME_MS;
    if (isHard50TimedMode(mode)) return HARD50_TIMED_TIME_MS;
    return LEVEL5_TIME_MS;
  }

  function loadSavedGame() {
    const key = isModelsCategory()
      ? MODELS_GAME_KEY
      : isElementsCategory()
        ? ELEMENTS_GAME_KEY
        : GAME_KEY;
    const id = localStorage.getItem(key) || (isModelsCategory() ? "input" : "name");
    if (isModelsCategory()) {
      return window.ModelsQuizGames?.getGame?.(id)?.id || "input";
    }
    if (isElementsCategory()) {
      return window.ElementsQuizGames?.getGame?.(id)?.id || "name";
    }
    return window.FlagQuizGames?.getGame?.(id)?.id || "name";
  }

  function saveGame(id) {
    const key = isModelsCategory()
      ? MODELS_GAME_KEY
      : isElementsCategory()
        ? ELEMENTS_GAME_KEY
        : GAME_KEY;
    localStorage.setItem(key, id);
  }

  function formatTime(ms) {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function formatElapsed(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    if (m > 0) return `${m}:${String(s).padStart(2, "0")}.${tenths}`;
    return `${s}.${tenths}s`;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isLevel5(mode = state.mode) {
    if (state.gameId === HARD50_GAME_ID || state.gameId === MODELS_HARD_GAME_ID) return false;
    return Number(mode) === 5;
  }

  function clearTimers() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
    if (state.advanceTimer) {
      clearTimeout(state.advanceTimer);
      state.advanceTimer = null;
    }
    if (state.flashTimer) {
      clearTimeout(state.flashTimer);
      state.flashTimer = null;
    }
  }

  function themeGameKeys(g) {
    if (isAnimalsTheme() && g.id === "name") {
      return { nameKey: "game.name.animal", blurbKey: "game.name.animal.blurb" };
    }
    if (isAnimalsTheme() && g.id === "hard50") {
      return { nameKey: g.nameKey, blurbKey: "game.hard50.animal.blurb" };
    }
    if (isOutlinesTheme() && g.id === "name") {
      return { nameKey: "game.name.outline", blurbKey: "game.name.outline.blurb" };
    }
    if (isOutlinesTheme() && g.id === "hard50") {
      return { nameKey: g.nameKey, blurbKey: "game.hard50.outline.blurb" };
    }
    if (isContinentsTheme() && g.id === "name") {
      return { nameKey: "game.name.continent", blurbKey: "game.name.continent.blurb" };
    }
    if (isContinentsTheme() && g.id === "hard50") {
      return { nameKey: g.nameKey, blurbKey: "game.hard50.continent.blurb" };
    }
    if (isStatusTheme() && g.id === "name") {
      return { nameKey: "game.name.status", blurbKey: "game.name.status.blurb" };
    }
    if (isStatusTheme() && g.id === "hard50") {
      return { nameKey: g.nameKey, blurbKey: "game.hard50.status.blurb" };
    }
    if (isCapitalsTheme() && g.id === "name") {
      return { nameKey: "game.name.capital", blurbKey: "game.name.capital.blurb" };
    }
    if (isCapitalsTheme() && g.id === "find") {
      return { nameKey: "game.find.capital", blurbKey: "game.find.capital.blurb" };
    }
    if (isCapitalsTheme() && g.id === "hard50") {
      return { nameKey: g.nameKey, blurbKey: "game.hard50.capital.blurb" };
    }
    if (isAirportsTheme() && g.id === "name") {
      return { nameKey: "game.name.airport", blurbKey: "game.name.airport.blurb" };
    }
    if (isAirportsTheme() && g.id === "find") {
      return { nameKey: "game.find.airport", blurbKey: "game.find.airport.blurb" };
    }
    if (isAirportsTheme() && g.id === "hard50") {
      return { nameKey: g.nameKey, blurbKey: "game.hard50.airport.blurb" };
    }
    return { nameKey: g.nameKey, blurbKey: g.blurbKey };
  }

  function quizPromptKey() {
    if (isModelsCategory()) {
      const field = state.questions[state.index]?.priceField || gameMeta().priceField;
      if (field === "output") return "quiz.promptModelsOutput";
      if (field === "pair") return "quiz.promptModelsPair";
      return "quiz.promptModelsInput";
    }
    if (isElementsCategory()) return "quiz.promptElement";
    if (isAnimalsTheme()) return "quiz.promptAnimal";
    if (isOutlinesTheme()) return "quiz.promptOutline";
    if (isContinentsTheme()) return "quiz.promptContinent";
    if (isStatusTheme()) return "quiz.promptStatus";
    if (isCapitalsTheme()) return "quiz.promptCapital";
    if (isAirportsTheme()) return "quiz.promptAirport";
    return "quiz.prompt";
  }

  function contentDomain() {
    if (isModelsCategory()) return "models";
    if (isElementsCategory()) return "elements";
    if (isAnimalsTheme()) return "animals";
    if (isOutlinesTheme()) return "outlines";
    if (isContinentsTheme()) return "continents";
    if (isStatusTheme()) return "status";
    if (isCapitalsTheme()) return "capitals";
    if (isAirportsTheme()) return "airports";
    return "flags";
  }

  function hasI18nKey(key) {
    const pack = window.FlagQuizI18n?.STRINGS;
    if (!pack) return false;
    const code = lang();
    return !!(pack[code]?.[key] || pack.en?.[key]);
  }

  /** Prefer `key.domain` (e.g. results.msg.great.elements), else `key`. */
  function tDomain(key, vars) {
    const specific = `${key}.${contentDomain()}`;
    if (hasI18nKey(specific)) return t(specific, vars);
    return t(key, vars);
  }

  function paintLevelLabels() {
    document.querySelectorAll(".btn-level").forEach((btn) => {
      const raw = btn.dataset.level;
      if (raw === HARD50_TIMED_MODE) {
        const show = showHard50TimedStage();
        btn.hidden = !show;
        btn.classList.toggle("hidden", !show);
        btn.textContent = t("home.hard50.timed");
        btn.title = t("home.hard50.timed.hint");
        return;
      }
      const level = Number(raw);
      if (level === 5 && state.gameId === TYPE_GAME_ID) {
        btn.textContent = t("home.level5.type");
        btn.title = t("home.level5.type.hint");
      } else if (level >= 1 && level <= 5) {
        btn.textContent = t(`home.level${level}`);
        btn.removeAttribute("title");
      }
    });
  }

  function paintRaceTimedBlurbExtra(baseBlurb) {
    if (state.gameId === TYPE_GAME_ID) {
      const stats = loadTypeHardStats();
      const pct = typeHardClearPct(stats);
      const best = loadBestTimeMs(TYPE_GAME_ID);
      const parts = [baseBlurb];
      if (pct != null) {
        parts.push(
          t("home.typeHard.stats", {
            pct,
            cleared: stats.cleared,
            attempts: stats.attempts,
          })
        );
      } else {
        parts.push(t("home.typeHard.statsEmpty"));
      }
      if (best != null) parts.push(t("home.typeHard.best", { time: formatElapsed(best) }));
      return parts.filter(Boolean).join(" ");
    }
    if (showHard50TimedStage()) {
      const stats = loadHard50TimedStats();
      const pct = hard50TimedClearPct(stats);
      const best = loadBestTimeMs(HARD50_TIMED_BEST_KEY);
      const parts = [baseBlurb];
      if (pct != null) {
        parts.push(
          t("home.typeHard.stats", {
            pct,
            cleared: stats.cleared,
            attempts: stats.attempts,
          })
        );
      } else {
        parts.push(t("home.typeHard.statsEmpty"));
      }
      if (best != null) parts.push(t("home.typeHard.best", { time: formatElapsed(best) }));
      return parts.filter(Boolean).join(" ");
    }
    return baseBlurb;
  }

  function paintGameChrome() {
    ensureGameFitsTheme();
    const g = gameMeta();
    const nameEl = $("game-current-name");
    const blurbEl = $("game-current-blurb");
    const { nameKey, blurbKey } = themeGameKeys(g);
    if (nameEl) nameEl.textContent = `${g.icon || ""} ${t(nameKey)}`.trim();
    if (blurbEl) blurbEl.textContent = paintRaceTimedBlurbExtra(t(blurbKey));
    paintLevelLabels();
    document.getElementById("app-shell")?.setAttribute("data-game", g.id);
    document.getElementById("app-shell")?.setAttribute("data-theme", state.themeId);
    document.getElementById("app-shell")?.setAttribute("data-category", state.categoryId);
    paintThemeChrome();
    paintCategoryChrome();
  }

  function paintCategoryChrome() {
    const cats = window.LearningGamesCategories?.CATEGORIES || [];
    const wrap = $("category-switch-wrap");
    if (wrap) wrap.hidden = cats.length < 2;
    const cat =
      window.LearningGamesCategories?.getCategory?.(state.categoryId) ||
      { id: "countries", icon: "🌍", nameKey: "cat.countries" };
    const ico = $("category-current-ico");
    const nameEl = $("category-current-name");
    if (ico) ico.textContent = cat.icon || "";
    if (nameEl) nameEl.textContent = t(cat.nameKey);
    const themeWrap = $("theme-switch-wrap");
    if (themeWrap) themeWrap.hidden = isNonCountryCategory();
    document.getElementById("app-shell")?.classList.remove("is-math");
    document.getElementById("app-shell")?.classList.toggle("is-elements", isElementsCategory());
    document.getElementById("app-shell")?.classList.toggle("is-models", isModelsCategory());
    document.getElementById("app-shell")?.classList.toggle("has-categories", cats.length >= 2);
  }

  function setCategory(id) {
    const next = window.LearningGamesCategories?.saveCategory?.(id) || "countries";
    state.categoryId = next;
    if (next === "elements" || next === "models") {
      state.themeId = "flags"; 
    }
    state.gameId = loadSavedGame();
    ensureGameFitsTheme();
    paintGameChrome();
    rebuildThemeWall();
  }

  function openCategoryPicker() {
    const cats = window.LearningGamesCategories?.CATEGORIES || [];
    const menu = $("category-picker");
    if (!menu) return;
    const open = !menu.classList.contains("hidden");
    if (open) {
      menu.classList.add("hidden");
      return;
    }
    $("game-picker")?.classList.add("hidden");
    $("theme-picker")?.classList.add("hidden");
    menu.innerHTML = cats
      .map((c) => {
        const active = c.id === state.categoryId ? "is-active" : "";
        return `<button type="button" class="category-picker-item ${active}" data-category="${c.id}">
          <span class="category-picker-icon">${c.icon || ""}</span>
          <span class="category-picker-text">
            <strong>${escapeHtml(t(c.nameKey))}</strong>
            <em>${escapeHtml(t(c.blurbKey))}</em>
          </span>
        </button>`;
      })
      .join("");
    menu.classList.remove("hidden");
    menu.querySelectorAll("[data-category]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setCategory(btn.getAttribute("data-category"));
        menu.classList.add("hidden");
      });
    });
  }

  function paintThemeChrome() {
    const theme = window.FlagQuizThemes?.getTheme?.(state.themeId) || { id: "flags", icon: "🏳️", nameKey: "theme.flags" };
    const ico = $("theme-current-ico");
    const nameEl = $("theme-current-name");
    if (ico) ico.textContent = theme.icon || "";
    if (nameEl) nameEl.textContent = t(theme.nameKey);
  }

  function setTheme(id) {
    const next = window.FlagQuizThemes?.getTheme?.(id)?.id || "flags";
    state.themeId = next;
    window.FlagQuizThemes?.saveTheme?.(next);
    ensureGameFitsTheme();
    paintGameChrome();
    rebuildThemeWall();
  }

  function openThemePicker() {
    const themes = window.FlagQuizThemes?.THEMES || [];
    const menu = $("theme-picker");
    if (!menu) return;
    const open = !menu.classList.contains("hidden");
    if (open) {
      menu.classList.add("hidden");
      return;
    }
    $("game-picker")?.classList.add("hidden");
    $("category-picker")?.classList.add("hidden");
    menu.innerHTML = themes
      .map((th) => {
        const active = th.id === state.themeId ? "is-active" : "";
        return `<button type="button" class="theme-picker-item ${active}" data-theme="${th.id}">
          <span class="theme-picker-icon">${th.icon || ""}</span>
          <span class="theme-picker-text">
            <strong>${escapeHtml(t(th.nameKey))}</strong>
            <em>${escapeHtml(t(th.blurbKey))}</em>
          </span>
        </button>`;
      })
      .join("");
    menu.classList.remove("hidden");
    menu.querySelectorAll("[data-theme]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setTheme(btn.getAttribute("data-theme"));
        menu.classList.add("hidden");
      });
    });
  }

  function cycleGame() {
    const list = availableGames();
    const i = Math.max(0, list.findIndex((g) => g.id === state.gameId));
    const next = list[(i + 1) % Math.max(1, list.length)]?.id || "name";
    state.gameId = next;
    saveGame(next);
    paintGameChrome();
    window.FlagQuizI18n?.applyDom?.(lang());
    paintGameChrome();
  }

  function openGamePicker() {
    const games = availableGames();
    const menu = $("game-picker");
    if (!menu) {
      cycleGame();
      return;
    }
    const open = !menu.classList.contains("hidden");
    if (open) {
      menu.classList.add("hidden");
      return;
    }
    $("theme-picker")?.classList.add("hidden");
    $("category-picker")?.classList.add("hidden");
    menu.innerHTML = games
      .map((g) => {
        const active = g.id === state.gameId ? "is-active" : "";
        const { nameKey, blurbKey } = themeGameKeys(g);
        return `<button type="button" class="game-picker-item ${active}" data-game="${g.id}">
          <span class="game-picker-icon">${g.icon || ""}</span>
          <span class="game-picker-text">
            <strong>${escapeHtml(t(nameKey))}</strong>
            <em>${escapeHtml(t(blurbKey))}</em>
          </span>
        </button>`;
      })
      .join("");
    menu.classList.remove("hidden");
    menu.querySelectorAll("[data-game]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.gameId = btn.getAttribute("data-game");
        saveGame(state.gameId);
        menu.classList.add("hidden");
        paintGameChrome();
      });
    });
  }

  async function rebuildThemeWall() {
    const wall = $("flag-wall");
    if (!wall) return;
    wall.innerHTML = "";
    if (isModelsCategory()) {
      buildModelWallFromPool(window.ModelsQuizData?.models || [], { tileCount: 80 });
      return;
    }
    if (isElementsCategory()) {
      buildElementWallFromPool(window.ElementsQuizData?.elements || [], { tileCount: 96 });
      return;
    }
    if (isAnimalsTheme()) {
      const base = window.FlagQuizThemes?.filterAnimalPool?.(window.FlagQuizData?.countries || []) || [];
      const sample = shuffle(base).slice(0, 24);
      await window.FlagQuizThemes?.prefetchImages?.(sample, 6);
      buildFlagWallFromPool(
        sample.filter((c) => c.animalImage),
        { tileCount: 48 }
      );
      return;
    }
    if (isOutlinesTheme()) {
      const base = window.FlagQuizThemes?.filterOutlinePool?.(window.FlagQuizData?.countries || []) || [];
      buildFlagWallFromPool(shuffle(base).slice(0, 40), { tileCount: 80 });
      return;
    }
    if (isContinentsTheme()) {
      const base = window.FlagQuizThemes?.filterContinentPool?.(window.FlagQuizData?.countries || []) || [];
      buildFlagWallFromPool(shuffle(base).slice(0, 48), { tileCount: 120 });
      return;
    }
    if (isStatusTheme()) {
      const base = window.FlagQuizThemes?.filterStatusPool?.(window.FlagQuizData?.countries || []) || [];
      buildFlagWallFromPool(shuffle(base).slice(0, 48), { tileCount: 120 });
      return;
    }
    if (isCapitalsTheme()) {
      const base = window.FlagQuizThemes?.filterCapitalPool?.(window.FlagQuizData?.countries || []) || [];
      buildFlagWallFromPool(shuffle(base).slice(0, 48), { tileCount: 120 });
      return;
    }
    if (isAirportsTheme()) {
      const base = window.FlagQuizThemes?.filterAirportPool?.(window.FlagQuizData?.countries || []) || [];
      buildAirportWallFromPool(shuffle(base).slice(0, 48), { tileCount: 96 });
      return;
    }
    buildFlagWallFromPool(window.FlagQuizData?.countries || []);
  }

  function buildFlagWall() {
    rebuildThemeWall();
  }

  function buildElementWallFromPool(pool, opts = {}) {
    const wall = $("flag-wall");
    if (!wall || wall.childElementCount) return;
    if (!pool.length) return;
    const tileCount = Number(opts.tileCount) > 0 ? Number(opts.tileCount) : 96;
    const tiles = [];
    while (tiles.length < tileCount) tiles.push(...shuffle(pool));
    const frag = document.createDocumentFragment();
    tiles.slice(0, tileCount).forEach((el) => {
      const cell = document.createElement("span");
      cell.className = "wall-element";
      cell.textContent = el.symbol || el.code;
      cell.title = el.name || "";
      frag.appendChild(cell);
    });
    wall.appendChild(frag);
  }

  function buildModelWallFromPool(pool, opts = {}) {
    const wall = $("flag-wall");
    if (!wall || wall.childElementCount) return;
    if (!pool.length) return;
    const tileCount = Number(opts.tileCount) > 0 ? Number(opts.tileCount) : 80;
    const tiles = [];
    while (tiles.length < tileCount) tiles.push(...shuffle(pool));
    const frag = document.createDocumentFragment();
    tiles.slice(0, tileCount).forEach((m) => {
      const cell = document.createElement("span");
      cell.className = "wall-model";
      cell.textContent = window.ModelsQuizData?.shortId?.(m) || m.name || m.code;
      cell.title = `${m.name || ""} · ${window.ModelsQuizData?.formatPrice?.(m.inputPerM)} / ${window.ModelsQuizData?.formatPrice?.(m.outputPerM)}`;
      frag.appendChild(cell);
    });
    wall.appendChild(frag);
  }

  function buildAirportWallFromPool(pool, opts = {}) {
    const wall = $("flag-wall");
    if (!wall || wall.childElementCount) return;
    if (!pool.length) return;
    const tileCount = Number(opts.tileCount) > 0 ? Number(opts.tileCount) : 96;
    const tiles = [];
    while (tiles.length < tileCount) tiles.push(...shuffle(pool));
    const frag = document.createDocumentFragment();
    tiles.slice(0, tileCount).forEach((c) => {
      const cell = document.createElement("span");
      cell.className = "wall-airport";
      cell.textContent = c.iata || window.FlagQuizThemes?.airportCode?.(c) || "";
      cell.title = `${c.iata || ""} · ${c.airportCity || c.name || ""}`;
      frag.appendChild(cell);
    });
    wall.appendChild(frag);
  }

  function buildFlagWallFromPool(pool, opts = {}) {
    const wall = $("flag-wall");
    if (!wall || wall.childElementCount) return;
    if (!pool.length) return;
    const tileCount = Number(opts.tileCount) > 0 ? Number(opts.tileCount) : 220;
    const tiles = [];
    while (tiles.length < tileCount) tiles.push(...shuffle(pool));
    const frag = document.createDocumentFragment();
    tiles.slice(0, tileCount).forEach((c) => {
      const img = document.createElement("img");
      if (isAnimalsTheme() && c.animalImage) {
        img.src = c.animalImage;
        img.className = "wall-animal";
      } else if (isOutlinesTheme() && c.outlineImage) {
        img.src = c.outlineImage;
        img.className = "wall-outline";
      } else {
        img.src = `https://flagcdn.com/w80/${c.code}.png`;
      }
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.draggable = false;
      img.onerror = () => {
        if (isAnimalsTheme() || isOutlinesTheme()) img.remove();
        else img.src = c.flagSvg || img.src;
      };
      frag.appendChild(img);
    });
    wall.appendChild(frag);
  }

  function setPage(page) {
    state.page = page;
    document.querySelectorAll(".page").forEach((el) => {
      const on = el.dataset.page === page;
      el.classList.toggle("active", on);
      el.hidden = !on;
    });
    document.getElementById("app-shell")?.classList.toggle("is-quiz", page === "quiz");
    if (page === "home") {
      clearTimers();
      $("game-picker")?.classList.add("hidden");
      $("theme-picker")?.classList.add("hidden");
      paintGameChrome();
    }
    publishScreenFacts();
  }

  function resolvePool(mode) {
    if (isModelsCategory()) {
      if (mode === "random" || mode == null) {
        return window.ModelsQuizData?.models || [];
      }
      if (state.gameId === MODELS_HARD_GAME_ID) {
        return (
          window.ModelsQuizData?.poolForHardLevel?.(Number(mode)) ||
          window.ModelsQuizData?.models ||
          []
        );
      }
      return (
        window.ModelsQuizData?.poolForLevel?.(Number(mode)) ||
        window.ModelsQuizData?.models ||
        []
      );
    }
    if (isElementsCategory()) {
      if (mode === "random" || mode == null) {
        return window.ElementsQuizData?.elements || [];
      }
      if (state.gameId === HARD50_GAME_ID || isTypeHardMode(mode)) {
        return (
          window.ElementsQuizData?.poolForHard50Level?.(Number(mode)) ||
          window.ElementsQuizData?.elements ||
          []
        );
      }
      return (
        window.ElementsQuizData?.poolForLevel?.(Number(mode)) ||
        window.ElementsQuizData?.elements ||
        []
      );
    }
    let pool;
    if (mode === "random" || mode == null) {
      pool = window.FlagQuizData?.countries || [];
    } else if (state.gameId === HARD50_GAME_ID || isTypeHardMode(mode) || isHard50TimedMode(mode)) {
      const poolLevel = isHard50TimedMode(mode) ? 5 : Number(mode);
      pool = window.FlagQuizData?.poolForHard50Level?.(poolLevel) || window.FlagQuizData?.countries || [];
    } else {
      pool = window.FlagQuizData?.poolForLevel?.(Number(mode)) || window.FlagQuizData?.countries || [];
    }
    if (isAnimalsTheme()) {
      pool = window.FlagQuizThemes?.filterAnimalPool?.(pool) || [];
    } else if (isOutlinesTheme()) {
      pool = window.FlagQuizThemes?.filterOutlinePool?.(pool) || [];
    } else if (isContinentsTheme()) {
      pool = window.FlagQuizThemes?.filterContinentPool?.(pool) || [];
    } else if (isStatusTheme()) {
      pool = window.FlagQuizThemes?.filterStatusPool?.(pool) || [];
    } else if (isCapitalsTheme()) {
      pool = window.FlagQuizThemes?.filterCapitalPool?.(pool) || [];
    } else if (isAirportsTheme()) {
      pool = window.FlagQuizThemes?.filterAirportPool?.(pool) || [];
    }
    return pool;
  }

  function choiceCountForMode(mode) {
    if (isContinentsTheme()) return 6;
    if (isStatusTheme()) return 3;
    if (isHard50TimedMode(mode)) return 6;
    if (isModelsCategory()) return Number(mode) === 5 ? 6 : 4;
    if (isElementsCategory()) return Number(mode) === 5 ? 6 : 4;
    if (isNameOnlyTheme() || isCapitalsTheme() || isAirportsTheme()) return 4;
    return Number(mode) === 5 ? 6 : 4;
  }

  function quizLengthForMode(mode, pool) {
    const hardLen =
      state.gameId === HARD50_GAME_ID ||
      (isModelsCategory() && state.gameId === MODELS_HARD_GAME_ID);
    const target = hardLen ? HARD50_QUIZ_LENGTH : RANDOM_LENGTH;
    return Math.min(target, pool.length);
  }

  function buildQuiz(pool, length, choiceCount, kind) {
    const need = Math.max(4, choiceCount);
    if (!pool || pool.length < need) return [];
    const n = Math.min(length, pool.length);
    const distractorCount = choiceCount - 1;
    const picks = shuffle(pool).slice(0, n);
    return picks.map((correct) => {
      let distractors;
      if (kind === "mcq-similar") {
        distractors = isElementsCategory()
          ? window.ElementsQuizGames.similarPoolFor(correct, pool, distractorCount)
          : window.FlagQuizGames.similarPoolFor(correct, pool, distractorCount);
      } else {
        distractors = shuffle(pool.filter((c) => c.code !== correct.code)).slice(0, distractorCount);
        while (distractors.length < distractorCount) {
          const extra = pool.find(
            (c) => c.code !== correct.code && !distractors.some((d) => d.code === c.code)
          );
          if (!extra) break;
          distractors.push(extra);
        }
      }
      const options = shuffle([correct, ...distractors]);
      return { correct, options, kind };
    });
  }

  function paintTimer() {
    const el = $("quiz-timer");
    if (!el) return;
    if (!state.timed || state.finished) {
      el.classList.add("hidden");
      return;
    }
    el.classList.remove("hidden");
    const left = Math.max(0, state.endsAt - Date.now());
    el.textContent = t("quiz.timer", { time: formatTime(left) });
    const urgentMs = isRaceTimedMode() ? 15000 : 30000;
    el.classList.toggle("is-urgent", left <= urgentMs);
  }

  function startTimer() {
    clearTimers();
    state.timed = true;
    state.startedAt = Date.now();
    state.endsAt = state.startedAt + timeLimitMs(state.mode);
    state.timedOut = false;
    paintTimer();
    state.timerId = setInterval(() => {
      if (state.finished) return;
      paintTimer();
      if (Date.now() >= state.endsAt) {
        state.timedOut = true;
        finishQuiz({ reason: "timeout" });
      }
    }, 200);
  }

  async function startMode(mode) {
    clearTimers();
    state.mode = mode;
    state.finished = false;
    state.timedOut = false;
    state.elapsedMs = 0;
    const g = gameMeta();
    state.timed = isLevel5(mode) && !isNameOnlyTheme() && !isCapitalsTheme() && !isAirportsTheme();
    if (isElementsCategory()) {
      state.timed = isLevel5(mode);
    }
    if (isModelsCategory()) {
      state.timed = false;
    }
    if (isHard50TimedMode(mode)) {
      state.timed = true;
    }
    let pool = resolvePool(mode);
    if (isAnimalsTheme()) {
      pool = await window.FlagQuizThemes?.prefetchImages?.(pool, 8) || pool;
      pool = pool.filter((c) => c.animalImage);
    }
    const length = quizLengthForMode(mode, pool);
    state.length = length;
    if (isModelsCategory()) {
      state.questions =
        window.ModelsQuizGames?.buildQuiz?.(
          pool,
          length,
          choiceCountForMode(mode),
          state.gameId,
          mode
        ) || [];
    } else if (isContinentsTheme()) {
      state.questions = window.FlagQuizThemes?.buildContinentQuiz?.(pool, length) || [];
    } else if (isStatusTheme()) {
      state.questions = window.FlagQuizThemes?.buildStatusQuiz?.(pool, length) || [];
    } else if (isCapitalsTheme()) {
      const choices = choiceCountForMode(mode);
      if (g.id === "find") {
        state.questions = window.FlagQuizThemes?.buildCapitalFindQuiz?.(pool, length, choices) || [];
      } else {
        state.questions = window.FlagQuizThemes?.buildCapitalNameQuiz?.(pool, length, choices) || [];
      }
    } else if (isAirportsTheme()) {
      const choices = choiceCountForMode(mode);
      if (g.id === "find") {
        state.questions = window.FlagQuizThemes?.buildAirportFindQuiz?.(pool, length, choices) || [];
      } else {
        state.questions = window.FlagQuizThemes?.buildAirportNameQuiz?.(pool, length, choices) || [];
      }
    } else {
      state.questions = buildQuiz(pool, length, choiceCountForMode(mode), g.kind);
    }
    state.index = 0;
    state.score = 0;
    state.answered = false;
    state.review = [];
    if (!state.questions.length) {
      const alertKey = isModelsCategory()
        ? "alert.noModels"
        : isElementsCategory()
        ? "alert.noElements"
        : isAnimalsTheme()
        ? "alert.noAnimals"
        : isOutlinesTheme()
          ? "alert.noOutlines"
          : isContinentsTheme()
            ? "alert.noContinents"
            : isStatusTheme()
              ? "alert.noStatus"
              : isCapitalsTheme()
                ? "alert.noCapitals"
                : isAirportsTheme()
                  ? "alert.noAirports"
                : "alert.noData";
      window.alert(t(alertKey));
      return;
    }
    if (isAnimalsTheme()) {
      const wall = $("flag-wall");
      if (wall) wall.innerHTML = "";
      const urls = state.questions.map((q) => q.correct?.animalImage).filter(Boolean);
      await window.FlagQuizThemes?.warmBrowserImages?.(urls, 6);
    }
    $("quiz-stage").hidden = false;
    $("quiz-results").hidden = true;
    $("btn-quit")?.classList.remove("hidden");
    document.getElementById("app-shell")?.classList.toggle("is-level5", state.timed);
    setPage("quiz");
    if (state.timed) startTimer();
    else $("quiz-timer")?.classList.add("hidden");
    renderQuestion();
  }

  function replay() {
    startMode(state.mode);
  }

  function publishScreenFacts() {
    const q = state.page === "quiz" ? state.questions[state.index] : null;
    const onResults = !!(state.page === "quiz" && $("quiz-results") && !$("quiz-results").hidden);
    const live = !onResults && q?.correct
      ? {
          code: q.correct.code,
          name: q.correct.name,
          nameHe: q.correct.nameHe || null,
          flag: q.correct.flag || null,
          index: state.index,
          total: state.questions.length,
          answered: !!state.answered,
        }
      : null;
    const facts = {
      app: "flag-quiz",
      page: onResults ? "results" : state.page,
      mode: state.mode,
      game: state.gameId,
      text: onResults
        ? `Learning games results: ${state.score}/${state.questions.length}`
        : state.page === "home"
          ? `Learning Games — ${
              isModelsCategory() ? "Model Prices" : isElementsCategory() ? "Elements" : "Countries"
            } · ${t(gameMeta().nameKey)}`
          : live
            ? `Quiz: ${live.name}`
            : `Learning Games: ${state.page}`,
      category: state.categoryId,
      primaryFlag: live
        ? {
            flagCode: live.code,
            flagCountry: live.name,
            flagCountryHe: live.nameHe,
            src: live.flag,
            fromQuizState: true,
            index: live.index,
            total: live.total,
            answered: live.answered,
          }
        : null,
      score: state.score,
      at: Date.now(),
    };
    try {
      window.myApp?.invoke?.("screen.publish", facts);
    } catch {
    }
  }

  function setPrompt(text) {
    const el = $("quiz-prompt");
    if (el) el.textContent = text;
  }

  function renderQuestion() {
    const q = state.questions[state.index];
    if (!q) {
      finishQuiz({ reason: "complete" });
      return;
    }
    state.answered = false;
    const total = state.questions.length;
    const step = state.index + 1;
    const kind = q.kind || gameMeta().kind;
    $("quiz-step").textContent = t("quiz.step", { step, total });
    $("quiz-score-live").textContent = t("quiz.score", { score: state.score });
    $("quiz-bar-fill").style.width = `${((step - 1) / total) * 100}%`;
    $("quiz-feedback").textContent = "";
    $("quiz-feedback").className = "quiz-feedback";
    $("btn-next").hidden = true;

    const flagWrap = $("flag-frame");
    const img = $("quiz-flag");
    const box = $("quiz-answers");
    box.innerHTML = "";
    box.className = "answers";
    document.getElementById("app-shell")?.setAttribute("data-kind", kind);

    if (kind === "mcq-price" || kind === "mcq-price-pair") {
      flagWrap.hidden = false;
      flagWrap.classList.remove("is-off");
      flagWrap.classList.remove("is-animal", "is-outline", "is-continent", "is-status", "is-element");
      flagWrap.classList.add("is-model");
      img.hidden = true;
      img.removeAttribute("src");
      const symTile = $("element-symbol-tile");
      if (symTile) symTile.hidden = true;
      const fallback = $("animal-fallback");
      if (fallback) fallback.hidden = true;
      const caption = $("animal-caption");
      if (caption) {
        caption.hidden = true;
        caption.textContent = "";
      }
      const card = $("model-card");
      const prov = $("model-card-provider");
      const nameEl = $("model-card-name");
      const idEl = $("model-card-id");
      if (card) card.hidden = false;
      if (prov) prov.textContent = q.correct.provider || "";
      if (nameEl) nameEl.textContent = label(q.correct);
      if (idEl) idEl.textContent = q.correct.code || "";
      const field = q.priceField || "input";
      const promptKey =
        field === "output"
          ? "quiz.promptModelsOutput"
          : field === "pair"
            ? "quiz.promptModelsPair"
            : "quiz.promptModelsInput";
      setPrompt(t(promptKey, { name: label(q.correct) }));
      box.classList.add("answers--prices");
      q.options.forEach((opt) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "answer-btn answer-btn--price";
        btn.dataset.code = opt.code;
        btn.setAttribute("aria-label", opt.label || opt.code);
        if (kind === "mcq-price-pair" || field === "pair") {
          btn.innerHTML = `<span class="price-pair"><span class="price-in">${escapeHtml(
            window.ModelsQuizData?.formatPrice?.(opt.input) || ""
          )}</span><span class="price-sep">/</span><span class="price-out">${escapeHtml(
            window.ModelsQuizData?.formatPrice?.(opt.output) || ""
          )}</span></span><span class="price-hint">${escapeHtml(t("quiz.models.pairHint"))}</span>`;
        } else {
          btn.innerHTML = `<span class="price-val">${escapeHtml(opt.label || "")}</span><span class="price-hint">${escapeHtml(
            field === "output" ? t("quiz.models.outputHint") : t("quiz.models.inputHint")
          )}</span>`;
        }
        btn.addEventListener("click", () => onAnswer(opt.code));
        box.appendChild(btn);
      });
      paintTimer();
      publishScreenFacts();
      return;
    }

    const modelCard = $("model-card");
    if (modelCard) modelCard.hidden = true;
    const flagFrameEl = flagWrap;
    flagFrameEl?.classList.remove("is-model");

    if (kind === "mcq-flag" || kind === "mcq-flag-capital" || kind === "mcq-flag-airport") {
      flagWrap.hidden = true;
      flagWrap.classList.add("is-off");
      img.removeAttribute("src");
      img.alt = "";
      const symTile = $("element-symbol-tile");
      if (symTile) {
        symTile.hidden = true;
        const zEl = $("element-z");
        const symEl = $("element-sym");
        if (zEl) zEl.textContent = "";
        if (symEl) symEl.textContent = "";
      }
      if (kind === "mcq-flag-capital") {
        setPrompt(t("quiz.promptFindCapital", { capital: capitalName(q.correct) }));
      } else if (kind === "mcq-flag-airport") {
        setPrompt(
          t("quiz.promptFindAirport", {
            iata: airportIata(q.correct),
            city: airportCity(q.correct),
          })
        );
      } else if (isElementsCategory()) {
        setPrompt(t("quiz.promptFindElement", { name: label(q.correct) }));
      } else {
        setPrompt(t("quiz.promptFind", { name: label(q.correct) }));
      }
      box.classList.add(isElementsCategory() ? "answers--symbols" : "answers--flags");
      q.options.forEach((opt) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = isElementsCategory()
          ? "answer-btn answer-btn--symbol"
          : "answer-btn answer-btn--flag";
        btn.dataset.code = opt.code;
        btn.setAttribute("aria-label", label(opt));
        if (isElementsCategory()) {
          btn.innerHTML = `<span class="opt-z">${escapeHtml(String(opt.number || ""))}</span><span class="opt-sym">${escapeHtml(opt.symbol || opt.code)}</span>`;
        } else {
          btn.innerHTML = `<img src="${opt.flag}" alt="" draggable="false" />`;
          btn.querySelector("img").onerror = (e) => {
            e.target.src = opt.flagSvg || e.target.src;
          };
        }
        btn.addEventListener("click", () => onAnswer(opt.code));
        box.appendChild(btn);
      });
      paintTimer();
      publishScreenFacts();
      return;
    }

    flagWrap.hidden = false;
    flagWrap.classList.remove("is-off");
    flagWrap.classList.toggle("is-animal", isAnimalsTheme());
    flagWrap.classList.toggle("is-outline", isOutlinesTheme());
    flagWrap.classList.toggle("is-continent", isContinentsTheme());
    flagWrap.classList.toggle("is-status", isStatusTheme());
    flagWrap.classList.toggle("is-element", isElementsCategory());
    img.classList.remove("is-hidden-flash", "is-loading");
    $("element-symbol-tile")?.classList.remove("is-hidden-flash");
    const caption = $("animal-caption");
    const fallback = $("animal-fallback");
    const fallbackName = $("animal-fallback-name");
    const symTile = $("element-symbol-tile");
    const symEl = $("element-sym");
    const zEl = $("element-z");
    if (caption) {
      if (isAnimalsTheme()) {
        caption.hidden = false;
        caption.textContent = animalName(q.correct);
      } else if (isElementsCategory()) {
        caption.hidden = false;
        caption.textContent = t("quiz.elementNumber", { n: q.correct.number });
      } else if (isAirportsTheme() && kind === "mcq-airport") {
        caption.hidden = false;
        caption.textContent = airportCity(q.correct) || label(q.correct);
      } else if (isStatusTheme()) {
        caption.hidden = false;
        caption.textContent = label(q.correct);
      } else {
        caption.hidden = true;
        caption.textContent = "";
      }
    }
    if (fallback) fallback.hidden = true;

    if (isElementsCategory()) {
      img.hidden = true;
      img.removeAttribute("src");
      if (symTile) {
        symTile.hidden = false;
        if (zEl) zEl.textContent = String(q.correct.number || "");
        if (symEl) symEl.textContent = q.correct.symbol || q.correct.code;
      }
    } else {
      if (symTile) {
        symTile.hidden = true;
        if (zEl) zEl.textContent = "";
        if (symEl) symEl.textContent = "";
      }
      if (isAnimalsTheme()) {
      const token = `${state.index}:${q.correct.code}`;
      const showAnimalMedia = (url) => {
        if (url) {
          img.classList.add("is-loading");
          img.hidden = false;
          img.alt = t("quiz.animalAlt");
          if (fallback) {
            fallback.hidden = false;
            if (fallbackName) fallbackName.textContent = t("quiz.animalLoading");
          }
          img.onload = () => {
            if (`${state.index}:${q.correct.code}` !== token) return;
            img.classList.remove("is-loading");
            if (fallback) fallback.hidden = true;
          };
          img.onerror = () => {
            if (`${state.index}:${q.correct.code}` !== token) return;
            img.classList.remove("is-loading");
            img.hidden = true;
            img.removeAttribute("src");
            if (fallback) {
              fallback.hidden = false;
              if (fallbackName) fallbackName.textContent = animalName(q.correct);
            }
          };
          img.src = url;
        } else {
          img.classList.remove("is-loading");
          img.hidden = true;
          img.removeAttribute("src");
          if (fallback) {
            fallback.hidden = false;
            if (fallbackName) fallbackName.textContent = animalName(q.correct);
          }
        }
      };
      if (q.correct.animalImage) {
        showAnimalMedia(q.correct.animalImage);
      } else {
        img.hidden = true;
        if (fallback) {
          fallback.hidden = false;
          if (fallbackName) fallbackName.textContent = t("quiz.animalLoading");
        }
        window.FlagQuizThemes?.resolveCountryImage?.(q.correct).then((url) => {
          if (state.questions[state.index]?.correct?.code !== q.correct.code) return;
          if (fallbackName && !url) fallbackName.textContent = animalName(q.correct) || t("quiz.animalNoPhoto");
          else if (fallbackName) fallbackName.textContent = animalName(q.correct);
          showAnimalMedia(url);
        });
      }
      const ahead = state.questions
        .slice(state.index + 1, state.index + 4)
        .map((qq) => qq.correct?.animalImage)
        .filter(Boolean);
      window.FlagQuizThemes?.warmBrowserImages?.(ahead, 3);
    } else if (isOutlinesTheme()) {
      img.hidden = false;
      img.onload = null;
      img.onerror = () => {
        img.hidden = true;
      };
      img.src = q.correct.outlineImage || "";
      img.alt = t("quiz.outlineAlt");
    } else {
      img.hidden = false;
      img.onload = null;
      img.src = q.correct.flag;
      img.alt = isContinentsTheme()
        ? t("quiz.continentFlagAlt")
        : isStatusTheme()
          ? t("quiz.statusFlagAlt")
          : t("quiz.flagAlt");
      img.onerror = () => {
        img.src = q.correct.flagSvg || img.src;
      };
    }
    }

    if (kind === "type-name") {
      setPrompt(isElementsCategory() ? t("quiz.promptTypeElement") : t("quiz.promptType"));
      const row = document.createElement("div");
      row.className = "type-answer-row";
      row.innerHTML = `
        <input type="text" class="type-answer-input" id="type-answer-input" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(tDomain("quiz.typePlaceholder"))}" />
        <button type="button" class="btn btn-primary" id="type-answer-submit">${escapeHtml(t("quiz.check"))}</button>
      `;
      box.appendChild(row);
      const input = row.querySelector("#type-answer-input");
      const submit = () => {
        if (state.answered) return;
        onTypedAnswer(input.value);
      };
      row.querySelector("#type-answer-submit").addEventListener("click", submit);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submit();
        }
      });
      requestAnimationFrame(() => input.focus());
      paintTimer();
      publishScreenFacts();
      return;
    }

    setPrompt(t(quizPromptKey()));
    const showChoices = () => {
      box.innerHTML = "";
      box.classList.toggle("answers--continents", isContinentsTheme());
      box.classList.toggle("answers--status", isStatusTheme());
      q.options.forEach((opt) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "answer-btn";
        if (isContinentsTheme() || isStatusTheme()) {
          btn.classList.add(isStatusTheme() ? "answer-btn--status" : "answer-btn--continent");
          btn.textContent = optionLabel(opt);
        } else {
          btn.textContent = optionLabel(opt);
        }
        btn.dataset.code = opt.code;
        btn.addEventListener("click", () => onAnswer(opt.code));
        box.appendChild(btn);
      });
    };

    if (kind === "mcq-flash") {
      setPrompt(t(isElementsCategory() ? "quiz.promptFlashElement" : "quiz.promptFlash"));
      box.innerHTML = `<p class="flash-wait">${escapeHtml(tDomain("quiz.flashWatch"))}</p>`;
      const ms = isElementsCategory()
        ? window.ElementsQuizGames.flashMsForMode(state.mode)
        : window.FlagQuizGames.flashMsForMode(state.mode);
      state.flashTimer = setTimeout(() => {
        state.flashTimer = null;
        img.classList.add("is-hidden-flash");
        $("element-symbol-tile")?.classList.add("is-hidden-flash");
        setPrompt(t(quizPromptKey()));
        showChoices();
      }, ms);
    } else {
      showChoices();
    }

    paintTimer();
    publishScreenFacts();
  }

  function markAnswered(correct, pickedCode, pickedName) {
    const q = state.questions[state.index];
    if (correct) {
      state.score += 1;
      if (isModelsCategory()) window.ModelsQuizGames?.recordHit?.(q.correct.code);
      else if (isElementsCategory()) window.ElementsQuizGames?.recordHit?.(q.correct.code);
      else window.FlagQuizGames?.recordHit?.(q.correct.code);
    } else {
      if (isModelsCategory()) window.ModelsQuizGames?.recordMiss?.(q.correct.code);
      else if (isElementsCategory()) window.ElementsQuizGames?.recordMiss?.(q.correct.code);
      else window.FlagQuizGames?.recordMiss?.(q.correct.code);
    }
    state.review.push({
      code: q.correct.code,
      name: label(q.correct),
      flag: isModelsCategory() || isElementsCategory()
        ? null
        : isAnimalsTheme()
        ? q.correct.animalImage || q.correct.flag
        : isOutlinesTheme()
          ? q.correct.outlineImage || q.correct.flag
          : q.correct.flag,
      symbol: q.correct.symbol || (isElementsCategory() ? q.correct.code : null),
      number: q.correct.number ?? null,
      inputPerM: q.correct.inputPerM ?? null,
      outputPerM: q.correct.outputPerM ?? null,
      priceField: q.priceField || null,
      animal: animalName(q.correct),
      continent: continentName(q.correct),
      status: statusName(q.correct),
      picked: pickedCode,
      correct,
      pickedName: pickedName || pickedCode,
    });

    const fb = $("quiz-feedback");
    if (correct) {
      fb.textContent = t("quiz.correct");
      fb.className = "quiz-feedback is-good";
    } else if (isModelsCategory()) {
      fb.textContent = t("quiz.wrongModelPrice", {
        name: label(q.correct),
        input: window.ModelsQuizData?.formatPrice?.(q.correct.inputPerM) || "",
        output: window.ModelsQuizData?.formatPrice?.(q.correct.outputPerM) || "",
      });
      fb.className = "quiz-feedback is-bad";
    } else if (isElementsCategory()) {
      fb.textContent = t("quiz.wrongElement", {
        name: label(q.correct),
        symbol: q.correct.symbol || q.correct.code,
      });
      fb.className = "quiz-feedback is-bad";
    } else if (isAnimalsTheme() && animalName(q.correct)) {
      fb.textContent = t("quiz.wrongAnimal", { name: label(q.correct), animal: animalName(q.correct) });
      fb.className = "quiz-feedback is-bad";
    } else if (isContinentsTheme() && continentName(q.correct)) {
      fb.textContent = t("quiz.wrongContinent", {
        name: label(q.correct),
        continent: continentName(q.correct),
      });
      fb.className = "quiz-feedback is-bad";
    } else if (isStatusTheme() && statusName(q.correct)) {
      fb.textContent = t("quiz.wrongStatus", {
        name: label(q.correct),
        status: statusName(q.correct),
      });
      fb.className = "quiz-feedback is-bad";
    } else if (isCapitalsTheme() && capitalName(q.correct)) {
      fb.textContent = t("quiz.wrongCapital", {
        name: label(q.correct),
        capital: capitalName(q.correct),
      });
      fb.className = "quiz-feedback is-bad";
    } else if (isAirportsTheme() && airportIata(q.correct)) {
      fb.textContent = t("quiz.wrongAirport", {
        name: label(q.correct),
        iata: airportIata(q.correct),
        city: airportCity(q.correct),
      });
      fb.className = "quiz-feedback is-bad";
    } else {
      fb.textContent = t("quiz.wrong", { name: label(q.correct) });
      fb.className = "quiz-feedback is-bad";
    }
    $("quiz-score-live").textContent = t("quiz.score", { score: state.score });
    $("quiz-bar-fill").style.width = `${((state.index + 1) / state.questions.length) * 100}%`;
  }

  function afterAnswer(correct) {
    const isLast = state.index >= state.questions.length - 1;
    const kind = state.questions[state.index]?.kind || gameMeta().kind;
    const auto = state.timed || kind === "mcq-flash";
    if (auto) {
      $("btn-next").hidden = true;
      const delay = correct ? 180 : 450;
      state.advanceTimer = setTimeout(() => {
        state.advanceTimer = null;
        if (state.finished) return;
        if (isLast) finishQuiz({ reason: "complete" });
        else {
          state.index += 1;
          renderQuestion();
        }
      }, delay);
    } else {
      $("btn-next").textContent = isLast ? t("quiz.seeResults") : t("quiz.next");
      $("btn-next").hidden = false;
    }
    publishScreenFacts();
  }

  function onAnswer(code) {
    if (state.answered || state.finished) return;
    if (state.timed && Date.now() >= state.endsAt) {
      state.timedOut = true;
      finishQuiz({ reason: "timeout" });
      return;
    }
    state.answered = true;
    const q = state.questions[state.index];
    const answerId = q.answerCode || q.correct.code;
    const correct = code === answerId;
    const picked = q.options.find((o) => o.code === code);
    markAnswered(correct, code, optionLabel(picked) || code);

    document.querySelectorAll(".answer-btn").forEach((btn) => {
      btn.disabled = true;
      if (btn.dataset.code === answerId) btn.classList.add("is-correct");
      if (btn.dataset.code === code && !correct) btn.classList.add("is-wrong");
    });

    afterAnswer(correct);
  }

  function onTypedAnswer(raw) {
    if (state.answered || state.finished) return;
    if (state.timed && Date.now() >= state.endsAt) {
      state.timedOut = true;
      finishQuiz({ reason: "timeout" });
      return;
    }
    state.answered = true;
    const q = state.questions[state.index];
    const correct = isElementsCategory()
      ? window.ElementsQuizGames.answersMatch(raw, q.correct, window.ElementsQuizData?.elements)
      : window.FlagQuizGames.answersMatch(raw, q.correct, window.FlagQuizData?.countries);
    markAnswered(correct, raw, raw || "—");

    const input = $("type-answer-input");
    const submitBtn = $("type-answer-submit");
    if (input) {
      input.disabled = true;
      input.classList.add(correct ? "is-correct" : "is-wrong");
    }
    if (submitBtn) submitBtn.disabled = true;

    afterAnswer(correct);
  }

  function nextQuestion() {
    if (state.finished) return;
    if (state.index >= state.questions.length - 1) {
      finishQuiz({ reason: "complete" });
      return;
    }
    state.index += 1;
    renderQuestion();
  }

  function finishQuiz(opts = {}) {
    if (state.finished) return;
    state.finished = true;
    clearTimers();

    const total = state.questions.length;
    const score = state.score;
    const wrongs = Math.max(0, state.review.length - score);
    const pct = total ? Math.round((score / total) * 100) : 0;
    const completedAll = state.review.length >= total && !state.timedOut && opts.reason !== "timeout";
    const elapsedMs = state.timed
      ? Math.max(0, (state.timedOut ? state.endsAt : Date.now()) - state.startedAt)
      : 0;
    const adjustedMs = elapsedMs + wrongs * LEVEL5_WRONG_PENALTY_MS;
    const raceTimed = isRaceTimedMode();
    const qualifiesForRecord =
      state.timed && completedAll && score >= recordMinScoreForMode();
    state.elapsedMs = adjustedMs;

    let bestInfo = null;
    const bestKey = bestTimeKeyForMode();
    if (qualifiesForRecord) bestInfo = saveBestTimeMs(adjustedMs, bestKey);
    else if (state.timed) {
      const prev = loadBestTimeMs(bestKey);
      bestInfo = prev != null ? { bestMs: prev, isNew: false } : null;
    }

    let raceTimedStats = null;
    if (isTypeHardMode()) {
      raceTimedStats = recordTypeHardAttempt({ cleared: completedAll });
    } else if (isHard50TimedMode()) {
      raceTimedStats = recordHard50TimedAttempt({ cleared: completedAll });
    }

    saveScore({
      score,
      total,
      pct,
      mode: state.mode,
      game: state.gameId,
      elapsedMs: state.timed ? elapsedMs : null,
      adjustedMs: state.timed ? adjustedMs : null,
      wrongs: state.timed ? wrongs : null,
      timedOut: !!state.timedOut,
      completedAll,
      recordEligible: !!qualifiesForRecord,
      typeHardClearPct: raceTimedStats?.clearPct ?? null,
      at: Date.now(),
    });

    $("quiz-timer")?.classList.add("hidden");
    $("btn-quit")?.classList.add("hidden");
    $("quiz-stage").hidden = true;
    $("quiz-results").hidden = false;
    $("results-score").textContent = `${score} / ${total}`;

    const clearRateLine =
      raceTimedStats != null
        ? ` ${t("results.msg.clearRate", {
            pct: raceTimedStats.clearPct,
            cleared: raceTimedStats.cleared,
            attempts: raceTimedStats.attempts,
          })}`
        : "";

    if (state.timed) {
      if (state.timedOut) {
        $("results-title").textContent = t("results.title.timeout");
        $("results-msg").textContent =
          t("results.msg.timeout", {
            score,
            total,
            answered: state.review.length,
          }) + clearRateLine;
      } else if (qualifiesForRecord && bestInfo?.isNew) {
        $("results-title").textContent = t("results.title.record");
        $("results-msg").textContent =
          t(raceTimed ? "results.msg.record.typeHard" : "results.msg.record", {
            time: formatElapsed(adjustedMs),
            raw: formatElapsed(elapsedMs),
            wrongs,
            pct,
          }) + clearRateLine;
      } else if (qualifiesForRecord) {
        $("results-title").textContent = t("results.title.timed");
        $("results-msg").textContent =
          t(raceTimed ? "results.msg.timed.typeHard" : "results.msg.timed", {
            time: formatElapsed(adjustedMs),
            raw: formatElapsed(elapsedMs),
            wrongs,
            best: formatElapsed(bestInfo?.bestMs || loadBestTimeMs(bestKey) || adjustedMs),
            pct,
          }) + clearRateLine;
      } else if (completedAll) {
        $("results-title").textContent = t("results.title.noRecord");
        $("results-msg").textContent =
          t("results.msg.noRecord", {
            score,
            need: recordMinScoreForMode(),
            time: formatElapsed(adjustedMs),
            wrongs,
          }) + clearRateLine;
      } else {
        $("results-title").textContent = pct >= 50 ? t("results.title.ok") : t("results.title.low");
        $("results-msg").textContent = tDomain("results.msg.ok", { pct }) + clearRateLine;
      }
    } else {
      $("results-title").textContent =
        pct >= 80 ? t("results.title.great") : pct >= 50 ? t("results.title.ok") : t("results.title.low");
      $("results-msg").textContent =
        pct >= 80
          ? tDomain("results.msg.great", { pct })
          : pct >= 50
            ? tDomain("results.msg.ok", { pct })
            : tDomain("results.msg.low", { pct });
    }

    const reviewItems = state.timed ? state.review.filter((r) => !r.correct) : state.review;
    const review = $("results-review");
    if (state.timed && !reviewItems.length && completedAll) {
      review.innerHTML = `<p class="review-empty">${escapeHtml(tDomain("results.reviewAllCorrect"))}</p>`;
    } else {
      review.innerHTML = reviewItems
        .map((r) => {
          let thumb;
          if (isModelsCategory() || (r.inputPerM != null && r.outputPerM != null && !r.symbol && !r.flag)) {
            thumb = `<div class="review-price" aria-hidden="true"><span>${escapeHtml(
              window.ModelsQuizData?.formatPrice?.(r.inputPerM) || ""
            )}</span><span class="review-price-sep">/</span><span>${escapeHtml(
              window.ModelsQuizData?.formatPrice?.(r.outputPerM) || ""
            )}</span></div>`;
          } else if (r.symbol || (isElementsCategory() && r.code)) {
            thumb = `<div class="review-symbol" aria-hidden="true"><span class="review-z">${escapeHtml(
              r.number != null ? String(r.number) : ""
            )}</span><span class="review-sym">${escapeHtml(r.symbol || r.code)}</span></div>`;
          } else if (r.flag) {
            thumb = `<img src="${r.flag}" alt="" />`;
          } else {
            thumb = `<div class="review-symbol is-empty" aria-hidden="true"></div>`;
          }
          return `
      <div class="review-item">
        ${thumb}
        <div>
          <div><strong>${escapeHtml(r.name)}</strong></div>
          <div class="${r.correct ? "ok" : "no"}">
            ${r.correct ? escapeHtml(t("results.reviewCorrect")) : escapeHtml(t("results.reviewWrong", { name: r.pickedName }))}
          </div>
        </div>
      </div>`;
        })
        .join("");
    }
    publishScreenFacts();
  }

  function applyLanguageFromSettings() {
    const code = window.AppSettingsRuntime?.get?.("language") || "en";
    window.FlagQuizI18n?.applyDom?.(code);
    window.AppSettings?.refreshLabels?.();
    paintGameChrome();
    if (state.page === "quiz" && state.questions.length && !state.answered && $("quiz-results")?.hidden) {
      renderQuestion();
    }
  }

  function abortQuiz() {
    if (state.finished && $("quiz-results") && !$("quiz-results").hidden) {
      // already on results — same as Back
    }
    clearTimers();
    state.finished = true;
    state.answered = false;
    state.questions = [];
    state.index = 0;
    state.score = 0;
    state.review = [];
    state.timed = false;
    document.getElementById("app-shell")?.classList.remove("is-level5");
    $("btn-quit")?.classList.add("hidden");
    $("quiz-timer")?.classList.add("hidden");
    setPage("home");
    publishScreenFacts();
  }

  function bind() {
    document.querySelectorAll(".btn-level").forEach((btn) => {
      btn.addEventListener("click", () => {
        const raw = btn.dataset.level;
        if (raw === HARD50_TIMED_MODE) {
          startMode(HARD50_TIMED_MODE);
          return;
        }
        const level = Number(raw);
        if (level >= 1 && level <= 5) startMode(level);
      });
    });
    $("btn-start")?.addEventListener("click", () => startMode("random"));
    $("btn-next")?.addEventListener("click", nextQuestion);
    $("btn-again")?.addEventListener("click", replay);
    $("btn-home")?.addEventListener("click", abortQuiz);
    $("btn-quit")?.addEventListener("click", abortQuiz);
    $("btn-game-switch")?.addEventListener("click", (e) => {
      e.stopPropagation();
      openGamePicker();
    });
    $("btn-theme-switch")?.addEventListener("click", (e) => {
      e.stopPropagation();
      openThemePicker();
    });
    $("btn-category-switch")?.addEventListener("click", (e) => {
      e.stopPropagation();
      openCategoryPicker();
    });
    document.addEventListener("click", (e) => {
      const menu = $("game-picker");
      if (menu && !menu.classList.contains("hidden")) {
        if (!e.target.closest("#game-picker") && !e.target.closest("#btn-game-switch")) {
          menu.classList.add("hidden");
        }
      }
      const themeMenu = $("theme-picker");
      if (themeMenu && !themeMenu.classList.contains("hidden")) {
        if (!e.target.closest("#theme-picker") && !e.target.closest("#btn-theme-switch")) {
          themeMenu.classList.add("hidden");
        }
      }
      const catMenu = $("category-picker");
      if (catMenu && !catMenu.classList.contains("hidden")) {
        if (!e.target.closest("#category-picker") && !e.target.closest("#btn-category-switch")) {
          catMenu.classList.add("hidden");
        }
      }
    });
  }

  function init() {
    state.categoryId = window.LearningGamesCategories?.loadCategory?.() || "countries";
    state.themeId = window.FlagQuizThemes?.loadTheme?.() || "flags";
    state.gameId = loadSavedGame();
    ensureGameFitsTheme();
    bind();
    buildFlagWall();
    paintGameChrome();

    window.AppSettingsRuntime?.onApplied?.(() => applyLanguageFromSettings());
    document.addEventListener("app-setting-changed", (e) => {
      if (e.detail?.appId !== "flag-quiz") return;
      if (e.detail.key === "language" || e.detail.key === "*") applyLanguageFromSettings();
    });
    document.addEventListener("app-settings-closed", () => {
      if (state.page === "quiz") setPage("quiz");
      else setPage("home");
    });

    applyLanguageFromSettings();
    setPage("home");
  }

  window.FlagQuizApp = {
    setPage,
    startQuiz: (arg) => {
      const n = Number(arg);
      if (n >= 1 && n <= 5) startMode(n);
      else startMode("random");
    },
    startLevel: (level) => startMode(Number(level)),
    startRandom: () => startMode("random"),
    setGame: (id) => {
      if (isModelsCategory()) {
        state.gameId = window.ModelsQuizGames?.getGame?.(id)?.id || "input";
      } else if (isElementsCategory()) {
        state.gameId = window.ElementsQuizGames?.getGame?.(id)?.id || "name";
      } else {
        state.gameId = window.FlagQuizGames?.getGame?.(id)?.id || "name";
      }
      saveGame(state.gameId);
      paintGameChrome();
    },
    getPage: () => state.page,
    getMode: () => state.mode,
    getGame: () => state.gameId,
    getBestTimeMs: (gameId) => loadBestTimeMs(gameId || state.gameId),
    getBestTimes: () => loadBestTimesMap(),
    getCurrentFlag() {
      if (state.page !== "quiz") return null;
      const q = state.questions[state.index];
      if (!q?.correct) return null;
      return {
        code: q.correct.code,
        name: q.correct.name,
        nameHe: q.correct.nameHe || null,
        flag: q.correct.flag || null,
        index: state.index,
        total: state.questions.length,
        answered: !!state.answered,
        showingResults: !$("quiz-results")?.hidden,
      };
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();