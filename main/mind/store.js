const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const { defaultTasks, normalizeTaskId, DEFAULT_TASK_MODELS } = require("./tasks");
const profile = require("../myspace-profile");

function settingsPath() {
  return profile.profileScopedPath("mind-platform.json");
}

function secretsPath() {
  return profile.profileScopedPath("mind-secrets.json");
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function defaultSettings() {
  const tasks = defaultTasks();
  return {
    version: 2,
    defaultProvider: "gemini",
    defaultTask: "chat",
    defaultModel: tasks.chat.model,
    tasks,
    providers: {
      gemini: {
        id: "gemini",
        name: "Google Gemini",
        kind: "cloud",
        enabled: true,
        model: tasks.chat.model,
        baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      },
      ollama: {
        id: "ollama",
        name: "Ollama (local)",
        kind: "local",
        enabled: false,
        model: "llama3.2",
        baseUrl: "http://127.0.0.1:11434",
      },
    },
    budget: {
      dailyTokens: 0,
      usedTokensToday: 0,
      budgetDay: todayKey(),
    },
    updatedAt: null,
  };
}

function defaultSecrets() {
  return { providers: {} };
}

function clampInt(n, min, max, fallback) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.round(v)));
}

function migrateGeminiModel(model) {
  const m = String(model || "").trim();
  if (!m || /^gemini-2\.0-flash/i.test(m) || m === "gemini-2.5-flash") {
    return DEFAULT_TASK_MODELS.chat;
  }
  return m;
}

function normalizeTasks(rawTasks, legacyRouting) {
  const base = defaultTasks();
  const src = rawTasks && typeof rawTasks === "object" ? rawTasks : {};
  const out = {};
  for (const id of Object.keys(base)) {
    const patch = src[id] && typeof src[id] === "object" ? src[id] : {};
    let provider = String(patch.provider || base[id].provider || "gemini");
    if (!patch.provider && legacyRouting && typeof legacyRouting === "object") {
      if (id === "quick" && legacyRouting.fast) provider = String(legacyRouting.fast);
      if (id === "chat" && legacyRouting.chat) provider = String(legacyRouting.chat);
    }
    out[id] = {
      provider,
      model: migrateGeminiModel(patch.model || base[id].model),
    };
  }
  return out;
}

function normalizeSettings(raw) {
  const base = defaultSettings();
  const s = raw && typeof raw === "object" ? raw : {};
  const providers = { ...base.providers };
  if (s.providers && typeof s.providers === "object") {
    for (const [id, p] of Object.entries(s.providers)) {
      if (!p || typeof p !== "object") continue;
      providers[id] = {
        ...(providers[id] || { id, name: id, kind: "cloud", enabled: false }),
        ...p,
        id,
      };
      if (id === "gemini" && providers[id].model) {
        providers[id].model = migrateGeminiModel(providers[id].model);
      }
    }
  }
  const tasks = normalizeTasks(s.tasks, s.routing);
  const budget = {
    ...base.budget,
    ...(s.budget && typeof s.budget === "object" ? s.budget : {}),
  };
  budget.dailyTokens = clampInt(budget.dailyTokens, 0, 50_000_000, 0);
  budget.usedTokensToday = Math.max(0, Number(budget.usedTokensToday) || 0);
  budget.budgetDay = String(budget.budgetDay || todayKey());
  if (budget.budgetDay !== todayKey()) {
    budget.budgetDay = todayKey();
    budget.usedTokensToday = 0;
  }
  const defaultTask = normalizeTaskId(s.defaultTask) || "chat";
  const defaultModel = migrateGeminiModel(
    String(s.defaultModel || tasks[defaultTask]?.model || base.defaultModel)
  );
  providers.gemini = {
    ...providers.gemini,
    model: tasks.chat?.model || providers.gemini.model || defaultModel,
  };
  return {
    version: 2,
    defaultProvider: String(s.defaultProvider || base.defaultProvider),
    defaultTask,
    defaultModel,
    tasks,
    providers,
    budget,
    updatedAt: s.updatedAt || null,
  };
}

function loadSettings() {
  try {
    return normalizeSettings(JSON.parse(fs.readFileSync(settingsPath(), "utf8")));
  } catch {
    return defaultSettings();
  }
}

function saveSettings(data) {
  const next = normalizeSettings({ ...data, updatedAt: new Date().toISOString() });
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2), "utf8");
  return next;
}

function loadSecrets() {
  try {
    const raw = JSON.parse(fs.readFileSync(secretsPath(), "utf8"));
    if (!raw || typeof raw !== "object") return defaultSecrets();
    return {
      providers:
        raw.providers && typeof raw.providers === "object" ? { ...raw.providers } : {},
    };
  } catch {
    return defaultSecrets();
  }
}

function saveSecrets(data) {
  const next = {
    providers:
      data?.providers && typeof data.providers === "object" ? { ...data.providers } : {},
  };
  fs.mkdirSync(path.dirname(secretsPath()), { recursive: true });
  fs.writeFileSync(secretsPath(), JSON.stringify(next, null, 2), "utf8");
  return next;
}

function getProviderSecret(providerId) {
  const secrets = loadSecrets();
  const entry = secrets.providers?.[providerId];
  if (!entry || typeof entry !== "object") return null;
  const apiKey = String(entry.apiKey || "").trim();
  return apiKey || null;
}

function setProviderSecret(providerId, apiKey) {
  const secrets = loadSecrets();
  if (!secrets.providers[providerId]) secrets.providers[providerId] = {};
  const key = String(apiKey || "").trim();
  if (!key) delete secrets.providers[providerId].apiKey;
  else secrets.providers[providerId].apiKey = key;
  saveSecrets(secrets);
  return { ok: true, hasKey: Boolean(key) };
}

function clearProviderSecret(providerId) {
  return setProviderSecret(providerId, "");
}

function maskKey(key) {
  const k = String(key || "");
  if (k.length < 10) return k ? "••••" : "";
  return `${k.slice(0, 6)}…${k.slice(-4)}`;
}

module.exports = {
  settingsPath,
  secretsPath,
  defaultSettings,
  normalizeSettings,
  loadSettings,
  saveSettings,
  loadSecrets,
  saveSecrets,
  getProviderSecret,
  setProviderSecret,
  clearProviderSecret,
  maskKey,
  todayKey,
};