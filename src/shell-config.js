(function () {
  const STORAGE_KEY = "myspace-shell-config";

  let state = {
    aliases: {},
    macros: {},
    whenRules: [],
  };

  let syncReady = false;

  function applyState(next) {
    state = {
      aliases: next?.aliases && typeof next.aliases === "object" ? { ...next.aliases } : {},
      macros: next?.macros && typeof next.macros === "object" ? { ...next.macros } : {},
      whenRules: Array.isArray(next?.whenRules) ? next.whenRules.map((r) => ({ ...r })) : [],
    };
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      applyState(JSON.parse(raw));
    } catch {
    }
  }

  function persistLocal() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  async function syncToDisk() {
    if (!window.mySpace?.shellEngine?.save) return;
    try {
      const res = await window.mySpace.shellEngine.load();
      const history = res?.data?.history || [];
      const settings = res?.data?.settings || {};
      await window.mySpace.shellEngine.save({
        aliases: state.aliases,
        macros: state.macros,
        whenRules: state.whenRules,
        history,
        settings,
      });
    } catch {
    }
  }

  function save() {
    persistLocal();
    syncToDisk();
    window.MySpaceShellWhen?.refresh?.();
  }

  function countConfig(data) {
    return (
      Object.keys(data?.aliases || {}).length +
      Object.keys(data?.macros || {}).length +
      (data?.whenRules || []).length
    );
  }

  function mergeWhenRules(a, b) {
    const seen = new Set();
    const out = [];
    for (const r of [...(a || []), ...(b || [])]) {
      const key = r.id || r.trigger;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ ...r });
    }
    return out;
  }

  async function pushStateToDisk(disk, next) {
    await window.mySpace.shellEngine.save({
      aliases: next.aliases,
      macros: next.macros,
      whenRules: next.whenRules,
      history: disk?.history || [],
      settings: disk?.settings || {},
    });
  }

  async function initFromDisk() {
    if (!window.mySpace?.shellEngine?.load) {
      syncReady = true;
      return;
    }
    try {
      const res = await window.mySpace.shellEngine.load();
      if (!res?.ok || !res.data) {
        syncReady = true;
        return;
      }
      const disk = res.data;
      const fromFile = res.fromFile === true;
      const diskCount = countConfig(disk);
      const localCount = countConfig(state);

      if (diskCount > 0 && localCount > 0) {
        const merged = {
          aliases: { ...disk.aliases, ...state.aliases },
          macros: { ...disk.macros, ...state.macros },
          whenRules: mergeWhenRules(disk.whenRules, state.whenRules),
        };
        applyState(merged);
        persistLocal();
        await pushStateToDisk(disk, merged);
      } else if (fromFile && diskCount > 0) {
        applyState(disk);
        persistLocal();
      } else if (localCount > 0) {
        await pushStateToDisk(disk, state);
      } else if (fromFile) {
        applyState(disk);
        persistLocal();
      }
    } catch {
    }
    syncReady = true;
    window.mySpace.shellEngine.onUpdated?.((data) => {
      if (!data) return;
      applyState(data);
      persistLocal();
      window.MySpaceShellWhen?.refresh?.();
    });
  }

  function normalizeName(name) {
    return String(name || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
  }

  function resolveAlias(line) {
    const key = normalizeName(line);
    const command = state.aliases[key];
    return command ? String(command).trim() : null;
  }

  function setAlias(name, command) {
    const key = normalizeName(name);
    if (!key) return { ok: false, error: "Alias name required" };
    const cmd = String(command || "").trim();
    if (!cmd) return { ok: false, error: "Alias command required" };
    state.aliases[key] = cmd;
    save();
    return { ok: true, name: key, command: cmd };
  }

  function removeAlias(name) {
    const key = normalizeName(name);
    if (!state.aliases[key]) return { ok: false, error: `Alias not found: ${name}` };
    delete state.aliases[key];
    save();
    return { ok: true };
  }

  function listAliases() {
    return Object.entries(state.aliases).map(([name, command]) => ({ name, command }));
  }

  function setMacro(name, commandChain) {
    const key = normalizeName(name);
    if (!key) return { ok: false, error: "Macro name required" };
    const commands = String(commandChain || "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!commands.length) return { ok: false, error: "Macro needs at least one command" };
    state.macros[key] = commands;
    save();
    return { ok: true, name: key, commands };
  }

  function getMacro(name) {
    const key = normalizeName(name);
    return state.macros[key] ? [...state.macros[key]] : null;
  }

  function removeMacro(name) {
    const key = normalizeName(name);
    if (!state.macros[key]) return { ok: false, error: `Macro not found: ${name}` };
    delete state.macros[key];
    save();
    return { ok: true };
  }

  function listMacros() {
    return Object.entries(state.macros).map(([name, commands]) => ({ name, commands }));
  }

  function nextWhenId() {
    let n = state.whenRules.length + 1;
    while (state.whenRules.some((r) => r.id === `when-${n}`)) n += 1;
    return `when-${n}`;
  }

  function addWhenRule(trigger, action) {
    const trig = String(trigger || "").trim().toLowerCase();
    const act = String(action || "").trim();
    if (!trig || !act) return { ok: false, error: "Usage: when drift(new) notify" };
    const rule = { id: nextWhenId(), trigger: trig, action: act };
    state.whenRules.push(rule);
    save();
    return { ok: true, rule };
  }

  function updateWhenRule(id, trigger, action) {
    const idx = state.whenRules.findIndex((r) => r.id === id);
    if (idx < 0) return { ok: false, error: `Rule not found: ${id}` };
    const trig = String(trigger || "").trim().toLowerCase();
    const act = String(action || "").trim();
    state.whenRules[idx] = {
      id,
      trigger: trig || state.whenRules[idx].trigger,
      action: act || state.whenRules[idx].action,
    };
    save();
    return { ok: true, rule: state.whenRules[idx] };
  }

  function removeWhenRule(id) {
    const before = state.whenRules.length;
    state.whenRules = state.whenRules.filter((r) => r.id !== id && r.trigger !== id);
    if (state.whenRules.length === before) {
      return { ok: false, error: `Rule not found: ${id}` };
    }
    save();
    return { ok: true };
  }

  function getWhenRules() {
    return state.whenRules.map((r) => ({ ...r }));
  }

  function listWhenRules() {
    return getWhenRules();
  }

  function replaceAll(data) {
    applyState(data || {});
    save();
    return { ok: true };
  }

  function clearAll() {
    state = { aliases: {}, macros: {}, whenRules: [] };
    save();
    return { ok: true };
  }

  function getSnapshot() {
    return {
      aliases: { ...state.aliases },
      macros: Object.fromEntries(Object.entries(state.macros).map(([k, v]) => [k, [...v]])),
      whenRules: state.whenRules.map((r) => ({ ...r })),
    };
  }

  loadLocal();
  initFromDisk();

  window.MySpaceShellConfig = {
    resolveAlias,
    setAlias,
    removeAlias,
    listAliases,
    setMacro,
    getMacro,
    removeMacro,
    listMacros,
    addWhenRule,
    updateWhenRule,
    removeWhenRule,
    getWhenRules,
    listWhenRules,
    replaceAll,
    clearAll,
    getSnapshot,
    isSyncReady: () => syncReady,
  };
})();