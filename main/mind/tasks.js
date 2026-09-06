const TASK_IDS = ["quick", "chat", "think"];

const TASK_META = {
  quick: {
    id: "quick",
    label: "Quick",
    blurb: "Fast & cheap: short answers, tags, renames",
    tier: "cheap",
  },
  chat: {
    id: "chat",
    label: "Everyday",
    blurb: "Normal chat, summaries, everyday help",
    tier: "normal",
  },
  think: {
    id: "think",
    label: "Deep",
    blurb: "Hard reasoning, long plans — costs more",
    tier: "expensive",
  },
};

const MODEL_OPTIONS = {
  cheap: [
    { id: "gemini-2.5-flash-lite", label: "2.5 Flash Lite" },
    { id: "gemini-3.5-flash-lite", label: "3.5 Flash Lite" },
    { id: "gemini-flash-lite-latest", label: "Flash Lite (latest)" },
  ],
  normal: [
    { id: "gemini-2.5-flash-lite", label: "2.5 Flash Lite" },
    { id: "gemini-2.5-flash", label: "2.5 Flash" },
    { id: "gemini-3.5-flash", label: "3.5 Flash" },
    { id: "gemini-3.6-flash", label: "3.6 Flash" },
    { id: "gemini-3.7-flash", label: "3.7 Flash" },
    { id: "gemini-flash-lite-latest", label: "Flash Lite (latest)" },
    { id: "gemini-flash-latest", label: "Flash (latest)" },
  ],
  expensive: [
    { id: "gemini-2.5-pro", label: "2.5 Pro" },
    { id: "gemini-3.1-pro-preview", label: "3.1 Pro" },
    { id: "gemini-pro-latest", label: "Pro (latest)" },
  ],
};

const DEFAULT_TASK_MODELS = {
  quick: "gemini-2.5-flash-lite",
  chat: "gemini-2.5-flash-lite",
  think: "gemini-2.5-pro",
};

function defaultTasks() {
  return {
    quick: {
      provider: "gemini",
      model: DEFAULT_TASK_MODELS.quick,
    },
    chat: {
      provider: "gemini",
      model: DEFAULT_TASK_MODELS.chat,
    },
    think: {
      provider: "gemini",
      model: DEFAULT_TASK_MODELS.think,
    },
  };
}

function normalizeTaskId(raw) {
  const key = String(raw || "")
    .trim()
    .toLowerCase();
  if (!key) return null;
  if (TASK_IDS.includes(key)) return key;
  const aliases = {
    fast: "quick",
    cheap: "quick",
    lite: "quick",
    normal: "chat",
    everyday: "chat",
    default: "chat",
    deep: "think",
    hard: "think",
    pro: "think",
    expensive: "think",
    reason: "think",
  };
  return aliases[key] || null;
}

function publicTasks(tasksCfg = {}) {
  return TASK_IDS.map((id) => {
    const meta = TASK_META[id];
    const cfg = tasksCfg[id] || {};
    return {
      id,
      label: meta.label,
      blurb: meta.blurb,
      tier: meta.tier,
      provider: cfg.provider || "gemini",
      model: cfg.model || DEFAULT_TASK_MODELS[id],
      modelOptions: MODEL_OPTIONS[meta.tier] || [],
    };
  });
}

module.exports = {
  TASK_IDS,
  TASK_META,
  MODEL_OPTIONS,
  DEFAULT_TASK_MODELS,
  defaultTasks,
  normalizeTaskId,
  publicTasks,
};