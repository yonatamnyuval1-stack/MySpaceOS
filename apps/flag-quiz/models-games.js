(function (root) {
  const MISS_KEY = "myspace-learning-games-models-misses";

  const GAMES = [
    {
      id: "input",
      icon: "⬇️",
      nameKey: "game.models.input",
      blurbKey: "game.models.input.blurb",
      kind: "mcq-price",
      priceField: "input",
    },
    {
      id: "output",
      icon: "⬆️",
      nameKey: "game.models.output",
      blurbKey: "game.models.output.blurb",
      kind: "mcq-price",
      priceField: "output",
    },
    {
      id: "pair",
      icon: "↕️",
      nameKey: "game.models.pair",
      blurbKey: "game.models.pair.blurb",
      kind: "mcq-price-pair",
      priceField: "pair",
    },
    {
      id: "hard",
      icon: "🎯",
      nameKey: "game.models.hard",
      blurbKey: "game.models.hard.blurb",
      kind: "mcq-price-mix",
      priceField: "mix",
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

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function fmt(n) {
    return root.ModelsQuizData?.formatPrice?.(n) || `$${n}`;
  }

  function priceKey(field, value) {
    return `${field}:${Number(value)}`;
  }

  function pairKey(inn, out) {
    return `io:${Number(inn)}|${Number(out)}`;
  }

  function uniqueByCode(opts) {
    const seen = new Set();
    const out = [];
    for (const o of opts) {
      if (!o || seen.has(o.code)) continue;
      seen.add(o.code);
      out.push(o);
    }
    return out;
  }

  function synthNear(value, mode) {
    const v = Number(value);
    if (!(v > 0)) return [];
    const hard = Number(mode) >= 4;
    const factors = hard
      ? [0.8, 0.9, 1.1, 1.25, 1.5, 2]
      : [0.5, 0.75, 1.5, 2, 3];
    return factors
      .map((f) => Math.round(v * f * 10000) / 10000)
      .filter((x) => x > 0 && x !== v);
  }

  function buildSingleFieldQuestion(correct, pool, field, choiceCount, mode) {
    const key = field === "output" ? "outputPerM" : "inputPerM";
    const correctVal = Number(correct[key]);
    const answerCode = priceKey(field === "output" ? "out" : "in", correctVal);
    const correctOpt = {
      code: answerCode,
      label: fmt(correctVal),
      price: correctVal,
      field,
    };

    const nearModels =
      root.ModelsQuizData?.similarByPrice?.(correct, pool, field, choiceCount * 3) || [];
    const fromModels = nearModels.map((m) => {
      const val = Number(m[key]);
      return {
        code: priceKey(field === "output" ? "out" : "in", val),
        label: fmt(val),
        price: val,
        field,
      };
    });

    const synth = synthNear(correctVal, mode).map((val) => ({
      code: priceKey(field === "output" ? "out" : "in", val),
      label: fmt(val),
      price: val,
      field,
    }));

    const wide = shuffle(pool.filter((m) => m.code !== correct.code))
      .slice(0, 12)
      .map((m) => {
        const val = Number(m[key]);
        return {
          code: priceKey(field === "output" ? "out" : "in", val),
          label: fmt(val),
          price: val,
          field,
        };
      });

    const preferClose = Number(mode) >= 3;
    const distractorPool = preferClose
      ? uniqueByCode([...fromModels, ...synth, ...wide])
      : uniqueByCode([...wide, ...fromModels, ...synth]);

    const distractors = distractorPool
      .filter((o) => o.code !== answerCode)
      .slice(0, Math.max(0, choiceCount - 1));

    while (distractors.length < choiceCount - 1) {
      const bump = Math.round(correctVal * (2 + distractors.length) * 10000) / 10000;
      const code = priceKey(field === "output" ? "out" : "in", bump);
      if (distractors.some((d) => d.code === code) || code === answerCode) break;
      distractors.push({ code, label: fmt(bump), price: bump, field });
    }

    return {
      correct,
      options: shuffle([correctOpt, ...distractors]),
      kind: "mcq-price",
      priceField: field,
      answerCode,
    };
  }

  function buildPairQuestion(correct, pool, choiceCount, mode) {
    const inn = Number(correct.inputPerM);
    const out = Number(correct.outputPerM);
    const answerCode = pairKey(inn, out);
    const correctOpt = {
      code: answerCode,
      label: `${fmt(inn)} / ${fmt(out)}`,
      input: inn,
      output: out,
    };

    const near = root.ModelsQuizData?.similarByPrice?.(correct, pool, "input", choiceCount * 2) || [];
    const fromModels = near.map((m) => {
      const i = Number(m.inputPerM);
      const o = Number(m.outputPerM);
      return {
        code: pairKey(i, o),
        label: `${fmt(i)} / ${fmt(o)}`,
        input: i,
        output: o,
      };
    });

    const swaps = [
      { input: inn, output: Math.round(out * 1.5 * 10000) / 10000 },
      { input: Math.round(inn * 1.5 * 10000) / 10000, output: out },
      { input: out, output: inn },
      { input: inn, output: Math.round(inn * 4 * 10000) / 10000 },
    ].map((p) => ({
      code: pairKey(p.input, p.output),
      label: `${fmt(p.input)} / ${fmt(p.output)}`,
      input: p.input,
      output: p.output,
    }));

    const wide = shuffle(pool.filter((m) => m.code !== correct.code))
      .slice(0, 10)
      .map((m) => {
        const i = Number(m.inputPerM);
        const o = Number(m.outputPerM);
        return {
          code: pairKey(i, o),
          label: `${fmt(i)} / ${fmt(o)}`,
          input: i,
          output: o,
        };
      });

    const preferClose = Number(mode) >= 3;
    const distractorPool = preferClose
      ? uniqueByCode([...fromModels, ...swaps, ...wide])
      : uniqueByCode([...wide, ...swaps, ...fromModels]);

    const distractors = distractorPool
      .filter((o) => o.code !== answerCode)
      .slice(0, Math.max(0, choiceCount - 1));

    return {
      correct,
      options: shuffle([correctOpt, ...distractors]),
      kind: "mcq-price-pair",
      priceField: "pair",
      answerCode,
    };
  }

  function pickMixField(mode) {
    const n = Number(mode);
    if (n >= 4 && Math.random() < 0.35) return "pair";
    return Math.random() < 0.5 ? "input" : "output";
  }

  function buildQuiz(pool, length, choiceCount, gameId, mode) {
    const need = Math.max(4, choiceCount);
    if (!pool || pool.length < need) return [];
    const game = getGame(gameId);
    const n = Math.min(length, pool.length);
    const picks = shuffle(pool).slice(0, n);
    return picks.map((correct) => {
      let field = game.priceField;
      if (game.kind === "mcq-price-mix") field = pickMixField(mode);
      if (field === "pair") return buildPairQuestion(correct, pool, choiceCount, mode);
      return buildSingleFieldQuestion(correct, pool, field === "output" ? "output" : "input", choiceCount, mode);
    });
  }

  root.ModelsQuizGames = {
    GAMES,
    getGame,
    buildQuiz,
    recordMiss,
    recordHit,
    loadMisses,
  };
})(window);
