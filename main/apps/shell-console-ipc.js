const path = require("path");
const fs = require("fs");
const { app, BrowserWindow } = require("electron");

const MAX_HISTORY = 500;

function dataPath() {
  const { profileScopedPath } = require("../myspace-profile");
  const identity = require("../myspace-identity");
  void identity.tryRestoreSession();
  return profileScopedPath("shell-engine.json");
}

function defaultState() {
  return {
    aliases: {},
    macros: {},
    whenRules: [],
    history: [],
    settings: {
      logHistory: true,
      maxHistory: MAX_HISTORY,
    },
  };
}

function normalizeName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function normalizeState(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  return {
    aliases: raw.aliases && typeof raw.aliases === "object" ? { ...raw.aliases } : {},
    macros: raw.macros && typeof raw.macros === "object" ? { ...raw.macros } : {},
    whenRules: Array.isArray(raw.whenRules) ? raw.whenRules.map((r) => ({ ...r })) : [],
    history: Array.isArray(raw.history) ? raw.history.slice(0, MAX_HISTORY) : [],
    settings: { ...base.settings, ...(raw.settings || {}) },
  };
}

function countConfig(data) {
  if (!data) return 0;
  return (
    Object.keys(data.aliases || {}).length +
    Object.keys(data.macros || {}).length +
    (data.whenRules || []).length
  );
}

async function loadState() {
  try {
    const raw = await fs.promises.readFile(dataPath(), "utf8");
    return { ok: true, data: normalizeState(JSON.parse(raw)), fromFile: true };
  } catch (err) {
    if (err?.code === "ENOENT") return { ok: true, data: defaultState(), fromFile: false };
    return { ok: false, error: err.message || "Failed to load" };
  }
}

async function saveState(data) {
  const payload = normalizeState(data);
  await fs.promises.mkdir(path.dirname(dataPath()), { recursive: true });
  await fs.promises.writeFile(dataPath(), JSON.stringify(payload, null, 2), "utf8");
  broadcastUpdate(payload);
  return { ok: true, data: payload };
}

function broadcastUpdate(data) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send("shell-engine-updated", data);
    }
  }
}

function mainWindow() {
  return BrowserWindow.getAllWindows().find((w) => !w.isDestroyed()) || null;
}

async function executeInRenderer(line, source = "console-app") {
  const win = mainWindow();
  if (!win) return { ok: false, error: "My Space window not found" };
  const safeLine = JSON.stringify(String(line || ""));
  const safeSource = JSON.stringify(String(source || "console-app"));
  try {
    const result = await win.webContents.executeJavaScript(
      `(async () => window.MySpaceShellBridge?.executeCommand?.(${safeLine}, ${safeSource}))()`
    );
    return result || { ok: false, error: "Shell bridge unavailable" };
  } catch (err) {
    return { ok: false, error: err.message || "Command failed" };
  }
}

async function executeProgramInRenderer(body, source = "scripts-app", opts = {}) {
  const win = mainWindow();
  if (!win) return { ok: false, error: "My Space window not found" };
  const safeBody = JSON.stringify(String(body || ""));
  const safeSource = JSON.stringify(String(source || "scripts-app"));
  const safeOpts = JSON.stringify({ stopOnError: opts.stopOnError !== false });
  try {
    const result = await win.webContents.executeJavaScript(
      `(async () => window.MySpaceShellBridge?.executeProgram?.(${safeBody}, ${safeSource}, ${safeOpts}))()`
    );
    return result || { ok: false, error: "Shell bridge unavailable" };
  } catch (err) {
    return { ok: false, error: err.message || "Program failed" };
  }
}

async function appendHistory(entry) {
  const loaded = await loadState();
  if (!loaded.ok) return loaded;
  const data = loaded.data;
  if (!data.settings.logHistory) return { ok: true };
  data.history.unshift({
    id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    line: entry.line,
    ok: Boolean(entry.ok),
    message: String(entry.message || ""),
    at: entry.at || new Date().toISOString(),
    source: entry.source || "console",
  });
  const max = Math.min(MAX_HISTORY, parseInt(data.settings.maxHistory, 10) || MAX_HISTORY);
  data.history = data.history.slice(0, max);
  return saveState(data);
}

const CHANNELS = {
  "storage.load": () => loadState(),
  "storage.save": (args) => saveState(args?.data ?? args),
  "storage.reset": async () => saveState(defaultState()),
  "sync.fromDesktop": async () => {
    const win = mainWindow();
    if (!win) return { ok: false, error: "My Space window not found" };
    try {
      const snapshot = await win.webContents.executeJavaScript(
        `(function(){ return window.MySpaceShellConfig?.getSnapshot?.() || null; })()`
      );
      if (!snapshot) return { ok: false, error: "Desktop shell config unavailable" };
      const loaded = await loadState();
      if (!loaded.ok) return loaded;
      const data = loaded.data || defaultState();
      const snapAliases = snapshot.aliases && typeof snapshot.aliases === "object" ? snapshot.aliases : {};
      const snapMacros = snapshot.macros && typeof snapshot.macros === "object" ? snapshot.macros : {};
      const snapWhen = Array.isArray(snapshot.whenRules) ? snapshot.whenRules.map((r) => ({ ...r })) : [];
      const merged = {
        ...data,
        aliases:
          Object.keys(snapAliases).length > 0 ? { ...snapAliases } : { ...(data.aliases || {}) },
        macros: Object.keys(snapMacros).length > 0 ? { ...snapMacros } : { ...(data.macros || {}) },
        whenRules: snapWhen.length > 0 ? snapWhen : Array.isArray(data.whenRules) ? data.whenRules : [],
      };
      const saved = await saveState(merged);
      return { ok: true, data: saved.data, migrated: countConfig(snapshot) };
    } catch (err) {
      return { ok: false, error: err.message || "Sync failed" };
    }
  },

  "aliases.list": async () => {
    const loaded = await loadState();
    if (!loaded.ok) return loaded;
    const items = Object.entries(loaded.data.aliases).map(([name, command]) => ({ name, command }));
    return { ok: true, items };
  },
  "aliases.set": async (args) => {
    const key = normalizeName(args?.name);
    const cmd = String(args?.command || "").trim();
    if (!key) return { ok: false, error: "Alias name required" };
    if (!cmd) return { ok: false, error: "Alias command required" };
    const loaded = await loadState();
    if (!loaded.ok) return loaded;
    loaded.data.aliases[key] = cmd;
    await saveState(loaded.data);
    return { ok: true, name: key, command: cmd };
  },
  "aliases.remove": async (args) => {
    const key = normalizeName(args?.name);
    const loaded = await loadState();
    if (!loaded.ok) return loaded;
    if (!loaded.data.aliases[key]) return { ok: false, error: `Alias not found: ${args?.name}` };
    delete loaded.data.aliases[key];
    await saveState(loaded.data);
    return { ok: true };
  },

  "macros.list": async () => {
    const loaded = await loadState();
    if (!loaded.ok) return loaded;
    const items = Object.entries(loaded.data.macros).map(([name, commands]) => ({ name, commands }));
    return { ok: true, items };
  },
  "macros.set": async (args) => {
    const key = normalizeName(args?.name);
    const chain = String(args?.commands || args?.command || "");
    const commands = chain
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!key) return { ok: false, error: "Macro name required" };
    if (!commands.length) return { ok: false, error: "Macro needs at least one command" };
    const loaded = await loadState();
    if (!loaded.ok) return loaded;
    loaded.data.macros[key] = commands;
    await saveState(loaded.data);
    return { ok: true, name: key, commands };
  },
  "macros.remove": async (args) => {
    const key = normalizeName(args?.name);
    const loaded = await loadState();
    if (!loaded.ok) return loaded;
    if (!loaded.data.macros[key]) return { ok: false, error: `Macro not found: ${args?.name}` };
    delete loaded.data.macros[key];
    await saveState(loaded.data);
    return { ok: true };
  },

  "when.list": async () => {
    const loaded = await loadState();
    if (!loaded.ok) return loaded;
    return { ok: true, items: loaded.data.whenRules };
  },
  "when.add": async (args) => {
    const trigger = String(args?.trigger || "").trim().toLowerCase();
    const action = String(args?.action || "").trim();
    if (!trigger || !action) return { ok: false, error: "Trigger and action required" };
    const loaded = await loadState();
    if (!loaded.ok) return loaded;
    let n = loaded.data.whenRules.length + 1;
    while (loaded.data.whenRules.some((r) => r.id === `when-${n}`)) n += 1;
    const rule = { id: `when-${n}`, trigger, action };
    loaded.data.whenRules.push(rule);
    await saveState(loaded.data);
    return { ok: true, rule };
  },
  "when.update": async (args) => {
    const id = String(args?.id || "").trim();
    const trigger = String(args?.trigger || "").trim().toLowerCase();
    const action = String(args?.action || "").trim();
    if (!id) return { ok: false, error: "Rule id required" };
    const loaded = await loadState();
    if (!loaded.ok) return loaded;
    const idx = loaded.data.whenRules.findIndex((r) => r.id === id);
    if (idx < 0) return { ok: false, error: "Rule not found" };
    loaded.data.whenRules[idx] = { id, trigger: trigger || loaded.data.whenRules[idx].trigger, action: action || loaded.data.whenRules[idx].action };
    await saveState(loaded.data);
    return { ok: true, rule: loaded.data.whenRules[idx] };
  },
  "when.remove": async (args) => {
    const id = String(args?.id || args?.name || "").trim();
    const loaded = await loadState();
    if (!loaded.ok) return loaded;
    const before = loaded.data.whenRules.length;
    loaded.data.whenRules = loaded.data.whenRules.filter((r) => r.id !== id && r.trigger !== id);
    if (loaded.data.whenRules.length === before) return { ok: false, error: `Rule not found: ${id}` };
    await saveState(loaded.data);
    return { ok: true };
  },

  "history.list": async () => {
    const loaded = await loadState();
    if (!loaded.ok) return loaded;
    return { ok: true, items: loaded.data.history };
  },
  "history.clear": async () => {
    const loaded = await loadState();
    if (!loaded.ok) return loaded;
    loaded.data.history = [];
    await saveState(loaded.data);
    return { ok: true };
  },
  "history.add": (args) => appendHistory(args),

  "settings.patch": async (args) => {
    const loaded = await loadState();
    if (!loaded.ok) return loaded;
    loaded.data.settings = { ...loaded.data.settings, ...(args?.settings || args || {}) };
    await saveState(loaded.data);
    return { ok: true, settings: loaded.data.settings };
  },

  "command.run": async (args) => {
    const line = String(args?.line || "").trim();
    if (!line) return { ok: false, error: "Empty command" };
    return executeInRenderer(line, args?.source || "console-app");
  },

  "data.export": async () => {
    const loaded = await loadState();
    if (!loaded.ok) return loaded;
    return { ok: true, json: JSON.stringify(loaded.data, null, 2) };
  },
  "data.import": async (args) => {
    let parsed;
    try {
      parsed = typeof args?.json === "string" ? JSON.parse(args.json) : args?.data;
    } catch {
      return { ok: false, error: "Invalid JSON" };
    }
    return saveState(parsed);
  },
};

async function handleShellConsoleInvoke(channel, args) {
  const handler = CHANNELS[channel];
  if (!handler) return { ok: false, error: `Unknown channel: ${channel}` };
  try {
    return await handler(args);
  } catch (err) {
    return { ok: false, error: err.message || "Request failed" };
  }
}

module.exports = {
  handleShellConsoleInvoke,
  loadState,
  saveState,
  appendHistory,
  executeInRenderer,
  executeProgramInRenderer,
};
