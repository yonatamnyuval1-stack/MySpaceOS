(function (root) {
  const STATUSES = [
    { id: "independent", name: "Independent country", nameHe: "מדינה עצמאית", icon: "🏛️" },
    { id: "territory", name: "Territory", nameHe: "טריטוריה", icon: "🗺️" },
    { id: "other", name: "Other", nameHe: "אחר", icon: "✳️" },
  ];
  const TERRITORY = [
    "ax", "as", "ai", "aw", "bm", "vg", "ky", "cx", "cc", "cw", "fk", "fo",
    "gf", "pf", "gi", "gl", "gp", "gu", "gg", "im", "je", "mq", "yt", "ms",
    "nc", "nf", "mp", "pn", "pr", "re", "bl", "sh", "pm", "sx", "tk", "tc",
    "vi", "wf",
  ];

  const OTHER = [
    "hk", "mo", 
    "ck", "nu", 
    "tw", "ps", "xk", "eh", 
  ];

  const STATUS_OF = Object.create(null);
  for (const code of TERRITORY) STATUS_OF[code] = "territory";
  for (const code of OTHER) STATUS_OF[code] = "other";

  function statusById(id) {
    return STATUSES.find((s) => s.id === id) || null;
  }

  function statusOf(code) {
    const c = String(code || "").toLowerCase();
    if (!c) return "";
    return STATUS_OF[c] || "independent";
  }

  function statusLabel(statusOrId, lang) {
    const s = typeof statusOrId === "string" ? statusById(statusOrId) : statusOrId;
    if (!s) return "";
    if (lang === "he" && s.nameHe) return s.nameHe;
    return s.name || "";
  }

  function enrichStatus(country) {
    if (!country?.code) return country;
    const status = statusOf(country.code);
    const meta = statusById(status);
    return {
      ...country,
      status,
      statusName: meta?.name || status,
      statusNameHe: meta?.nameHe || "",
    };
  }

  function filterStatusPool(pool) {
    return (pool || []).map(enrichStatus).filter((c) => c.status);
  }

  function statusOptions(lang) {
    return STATUSES.map((s) => ({
      code: s.id,
      name: s.name,
      nameHe: s.nameHe,
      icon: s.icon,
      label: statusLabel(s, lang),
    }));
  }

  /** Quiz: show a country (flag + name cue) — pick independent / territory / other. */
  function buildStatusQuiz(pool, length) {
    const enriched = filterStatusPool(pool);
    if (enriched.length < 4) return [];
    const n = Math.min(length, enriched.length);
    const picks = [...enriched];
    for (let i = picks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [picks[i], picks[j]] = [picks[j], picks[i]];
    }
    const selected = picks.slice(0, n);
    return selected.map((correct) => {
      const options = STATUSES.map((s) => ({
        code: s.id,
        name: s.name,
        nameHe: s.nameHe,
        icon: s.icon,
      }));
      for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
      }
      return {
        correct,
        options,
        kind: "mcq-status",
        answerCode: correct.status,
      };
    });
  }

  const themesApi = root.FlagQuizThemes;
  if (!themesApi) {
    console.warn("[flag-quiz] FlagQuizThemes missing — status theme skipped");
    return;
  }

  if (!themesApi.THEMES.some((t) => t.id === "status")) {
    themesApi.THEMES.push({
      id: "status",
      icon: "⚖️",
      nameKey: "theme.status",
      blurbKey: "theme.status.blurb",
      nameGamesOnly: true,
      statusQuiz: true,
    });
  }

  themesApi.STATUSES = STATUSES;
  themesApi.statusOf = statusOf;
  themesApi.statusById = statusById;
  themesApi.statusLabel = statusLabel;
  themesApi.enrichStatus = enrichStatus;
  themesApi.filterStatusPool = filterStatusPool;
  themesApi.statusOptions = statusOptions;
  themesApi.buildStatusQuiz = buildStatusQuiz;
})(typeof window !== "undefined" ? window : globalThis);
