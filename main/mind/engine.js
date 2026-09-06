const fs = require("fs");
const path = require("path");
const { BrowserWindow, app } = require("electron");
const store = require("./store");
const gemini = require("./providers/gemini");
const ollama = require("./providers/ollama");
const { formatMemoryBlock } = require("./memory");
const { normalizeTaskId, publicTasks, TASK_META } = require("./tasks");

let settings = null;
let started = false;

function ensureSettings() {
  if (!settings) settings = store.loadSettings();
  return settings;
}

function persistSettings(next) {
  settings = store.saveSettings(next);
  broadcast();
  return settings;
}

function broadcast() {
  const payload = snapshot();
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      if (!win.isDestroyed()) win.webContents.send("mind-updated", payload);
    } catch {
    }
  }
}

function providerPublic(id, cfg) {
  const key = store.getProviderSecret(id);
  return {
    id,
    name: cfg?.name || id,
    kind: cfg?.kind || "cloud",
    enabled: cfg?.enabled !== false,
    model: cfg?.model || "",
    baseUrl: cfg?.baseUrl || "",
    hasKey: id === "ollama" ? Boolean(cfg?.enabled) : Boolean(key),
    keyPreview: key ? store.maskKey(key) : "",
  };
}

function snapshot() {
  const s = ensureSettings();
  const providers = Object.keys(s.providers).map((id) => providerPublic(id, s.providers[id]));
  const budget = s.budget || {};
  const left =
    budget.dailyTokens > 0 ? Math.max(0, budget.dailyTokens - (budget.usedTokensToday || 0)) : null;
  const tasks = publicTasks(s.tasks);
  const geminiReady = Boolean(store.getProviderSecret("gemini"));
  return {
    ok: true,
    ready: geminiReady || Boolean(s.providers.ollama?.enabled),
    hasKey: geminiReady,
    defaultProvider: s.defaultProvider,
    defaultTask: s.defaultTask || "chat",
    defaultModel: s.defaultModel,
    tasks,
    providers,
    budget: { ...budget, leftTokens: left },
    updatedAt: s.updatedAt,
  };
}

function importBootstrapSecrets() {
  try {
    const bootPath = path.join(app.getAppPath(), "config", "mind-bootstrap.local.json");
    if (!fs.existsSync(bootPath)) return { ok: false, skipped: true };
    const raw = JSON.parse(fs.readFileSync(bootPath, "utf8"));
    const geminiKey = String(raw.geminiApiKey || raw.GEMINI_API_KEY || "").trim();
    if (!geminiKey) return { ok: false, skipped: true };
    if (store.getProviderSecret("gemini")) return { ok: true, already: true };
    store.setProviderSecret("gemini", geminiKey);
    const s = ensureSettings();
    s.providers.gemini = { ...s.providers.gemini, enabled: true };
    s.defaultProvider = "gemini";
    persistSettings(s);
    return { ok: true, imported: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

function resolveTask(args = {}) {
  const s = ensureSettings();
  const fromArgs =
    normalizeTaskId(args.task) ||
    normalizeTaskId(args.route) ||
    normalizeTaskId(args.tier) ||
    null;
  const taskId = fromArgs || normalizeTaskId(s.defaultTask) || "chat";
  const taskCfg = s.tasks?.[taskId] || s.tasks?.chat || { provider: "gemini", model: s.defaultModel };
  const meta = TASK_META[taskId] || TASK_META.chat;
  return { taskId, taskCfg, meta };
}

function resolveProvider(args = {}) {
  const s = ensureSettings();
  const { taskId, taskCfg, meta } = resolveTask(args);

  let id = String(args.provider || "").trim();
  if (!id) id = String(taskCfg.provider || s.defaultProvider || "gemini");

  if (normalizeTaskId(args.task) === null && String(args.task || "").toLowerCase() === "local") {
    id = "ollama";
  }

  const cfg = s.providers[id];
  if (!cfg || cfg.enabled === false) {
    if (id === "ollama") {
      return { ok: false, error: "Local Ollama is off, enable it in Mind → Setup" };
    }
    return { ok: false, error: `Provider "${id}" unavailable or disabled` };
  }

  const model = String(args.model || taskCfg.model || cfg.model || s.defaultModel);
  return { ok: true, id, cfg, model, taskId, tier: meta.tier, taskLabel: meta.label };
}

function budgetAllows() {
  const s = ensureSettings();
  const b = s.budget || {};
  if (!b.dailyTokens) return { ok: true };
  if ((b.usedTokensToday || 0) >= b.dailyTokens) {
    return { ok: false, error: "Mind daily budget used up, raise it in Mind → Setup" };
  }
  return { ok: true };
}

function spendBudget(tokens) {
  const s = ensureSettings();
  const n = Math.max(0, Number(tokens) || 0);
  if (!n) return;
  s.budget.usedTokensToday = (s.budget.usedTokensToday || 0) + n;
  persistSettings(s);
}

async function complete(args = {}) {
  const gate = budgetAllows();
  if (!gate.ok) return gate;

  const resolved = resolveProvider(args);
  if (!resolved.ok) return resolved;

  const messages = Array.isArray(args.messages) ? args.messages : null;
  const prompt = String(args.prompt || args.text || args.q || "").trim();
  if ((!messages || !messages.length) && !prompt) return { ok: false, error: "Missing prompt" };
  let system = args.system ? String(args.system) : "";

  if (args.includeMemory !== false) {
    const userHint =
      prompt ||
      (messages || [])
        .slice()
        .reverse()
        .find((m) => String(m.role || "").toLowerCase() === "user");
    const userText =
      typeof userHint === "string"
        ? userHint
        : String(userHint?.content || userHint?.text || "");
    const mem = formatMemoryBlock(userText, { maxChars: args.memoryMaxChars || 1200 });
    if (mem.block) {
      system = system ? `${system}\n\n${mem.block}` : mem.block;
    }
  }

  let result;
  if (resolved.id === "gemini") {
    const apiKey = store.getProviderSecret("gemini");
    if (!apiKey) return { ok: false, error: "Add your Gemini key in Mind → Setup" };

    const modelChain = [];
    const primary = String(resolved.model || "").trim();
    if (primary) modelChain.push(primary);
    for (const alt of ["gemini-2.5-flash-lite", "gemini-flash-lite-latest", "gemini-2.5-flash"]) {
      if (alt && !modelChain.includes(alt)) modelChain.push(alt);
    }

    let last = null;
    for (const model of modelChain) {
      last = await gemini.generate({
        apiKey,
        model,
        baseUrl: resolved.cfg.baseUrl,
        prompt,
        messages,
        system,
        temperature: args.temperature,
        maxOutputTokens: args.maxOutputTokens,
      });
      if (last?.ok) {
        result = last;
        break;
      }
      const err = String(last?.error || "");
      const quota = /quota|rate[_\s-]?limit|exceeded|429/i.test(err) || last?.status === 429;
      if (!quota) {
        result = last;
        break;
      }
      result = last;
    }
  } else if (resolved.id === "ollama") {
    result = await ollama.generate({
      baseUrl: resolved.cfg.baseUrl,
      model: resolved.model,
      prompt:
        prompt ||
        (messages || [])
          .map((m) => `${m.role}: ${m.content || m.text || ""}`)
          .join("\n\n"),
      system,
      temperature: args.temperature,
    });
  } else {
    return { ok: false, error: `No runner for provider "${resolved.id}"` };
  }

  if (result?.ok && result.tokens) spendBudget(result.tokens);
  return result?.ok
    ? {
        ok: true,
        text: result.text,
        provider: result.provider || resolved.id,
        model: result.model || resolved.model,
        task: resolved.taskId,
        taskLabel: resolved.taskLabel,
        tier: resolved.tier,
        tokens: result.tokens || 0,
        finishReason: result.finishReason || "",
      }
    : result;
}

async function chat(args = {}) {
  const messages = Array.isArray(args.messages) ? args.messages : [];
  if (!messages.length && args.prompt) {
    return complete({ ...args, task: args.task || "chat" });
  }
  const parts = messages
    .map((m) => {
      const role = String(m.role || "user");
      const content = String(m.content || m.text || "");
      return `${role}: ${content}`;
    })
    .join("\n");
  return complete({
    ...args,
    task: args.task || "chat",
    prompt: parts || String(args.prompt || ""),
    system: args.system || "You are Mind, the My Space OS AI. Be clear and useful.",
  });
}

async function testProvider(args = {}) {
  const task =
    normalizeTaskId(args.task) ||
    (args.provider === "ollama" ? null : normalizeTaskId(args.provider) ? null : "chat");
  if (String(args.provider || "") === "ollama" || String(args.task || "") === "local") {
    const s = ensureSettings();
    const ping = await ollama.ping(s.providers.ollama?.baseUrl);
    return ping.ok
      ? {
          ok: true,
          provider: "ollama",
          message: `Local ok · ${(ping.models || []).slice(0, 5).join(", ") || "no models"}`,
        }
      : { ok: false, error: ping.error || "Ollama offline" };
  }
  const res = await complete({
    task: task || "quick",
    provider: args.provider,
    prompt: "Reply with exactly: OK",
    maxOutputTokens: 16,
    temperature: 0,
  });
  if (!res?.ok) return res;
  return {
    ok: true,
    provider: res.provider,
    model: res.model,
    task: res.task,
    message: `Mind · ${res.taskLabel || res.task} · ${res.model} ok`,
  };
}

function listProviders() {
  return { ok: true, providers: snapshot().providers, tasks: snapshot().tasks };
}

function setSettings(patch = {}) {
  const s = ensureSettings();
  if (patch.defaultProvider) s.defaultProvider = String(patch.defaultProvider);
  if (patch.defaultTask) {
    const t = normalizeTaskId(patch.defaultTask);
    if (t) s.defaultTask = t;
  }
  if (patch.defaultModel) s.defaultModel = String(patch.defaultModel);
  if (patch.tasks && typeof patch.tasks === "object") {
    for (const [id, p] of Object.entries(patch.tasks)) {
      const taskId = normalizeTaskId(id);
      if (!taskId || !p || typeof p !== "object") continue;
      s.tasks[taskId] = {
        ...(s.tasks[taskId] || {}),
        ...p,
      };
      if (p.model) s.tasks[taskId].model = String(p.model);
      if (p.provider) s.tasks[taskId].provider = String(p.provider);
    }
    if (s.tasks.chat?.model) {
      s.defaultModel = s.tasks.chat.model;
      if (s.providers.gemini) s.providers.gemini.model = s.tasks.chat.model;
    }
  }
  if (patch.budget && typeof patch.budget === "object") {
    if (patch.budget.dailyTokens != null) s.budget.dailyTokens = Number(patch.budget.dailyTokens) || 0;
  }
  if (patch.providers && typeof patch.providers === "object") {
    for (const [id, p] of Object.entries(patch.providers)) {
      if (!p || typeof p !== "object") continue;
      s.providers[id] = { ...(s.providers[id] || { id }), ...p, id };
    }
  }
  persistSettings(s);
  return { ok: true, ...snapshot() };
}

function setApiKey(args = {}) {
  const provider = String(args.provider || "gemini").trim();
  const apiKey = String(args.apiKey || args.key || "").trim();
  if (!provider) return { ok: false, error: "Missing provider" };
  if (!apiKey) return { ok: false, error: "Missing apiKey" };
  store.setProviderSecret(provider, apiKey);
  const s = ensureSettings();
  if (s.providers[provider]) s.providers[provider].enabled = true;
  persistSettings(s);
  return { ok: true, provider, hasKey: true, keyPreview: store.maskKey(apiKey), ...snapshot() };
}

function clearApiKey(args = {}) {
  const provider = String(args.provider || "gemini").trim();
  store.clearProviderSecret(provider);
  broadcast();
  return { ok: true, provider, hasKey: false, ...snapshot() };
}

function startMindService() {
  if (started) return;
  started = true;
  settings = store.loadSettings();
  importBootstrapSecrets();
  broadcast();
}

module.exports = {
  startMindService,
  snapshot,
  complete,
  chat,
  testProvider,
  listProviders,
  setSettings,
  setApiKey,
  clearApiKey,
  importBootstrapSecrets,
};