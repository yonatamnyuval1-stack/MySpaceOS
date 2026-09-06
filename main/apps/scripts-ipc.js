const path = require("path");
const fs = require("fs");
const { app } = require("electron");
const { loadJsonFile, saveJsonFile } = require("./safe-json-store");
const { reportLoadFailure, reportSaveFailure } = require("../resolve/report-helper");

function dataPath() {
  return path.join(app.getPath("userData"), "scripts.json");
}

function uid() {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

const STARTER_SCRIPTS = [
  {
    name: "morning",
    body: [
      "# Morning pulse — silent inventory (edit freely)",
      "fn pulse() {",
      "  today(list)",
      "  sys(cpu)",
      "  stocks(list)",
      "  drift(list today)",
      "}",
      "let start = pulse()",
      "# Optional UI: focus today · run builds",
    ].join("\n"),
  },
  {
    name: "focus",
    body: [
      "# Focus block — quiet desktop + timer",
      "a",
      "clock(timer 50m Deep work)",
      "today(add Review notes)",
      "# Tip: omit `a` if you need a reference window open",
    ].join("\n"),
  },
  {
    name: "eod",
    body: [
      "# End of day: review, then clear finished work",
      "fn wrap() {",
      "  today(list)",
      "  drift(list today)",
      "  builds(list)",
      "}",
      "let review = wrap()",
      "today(clear done)",
      "# Optional: contracts(upcoming) · focus today",
    ].join("\n"),
  },
  {
    name: "remote",
    body: [
      "# Remote day: inventory before wake/connect",
      "remote(list)",
      "remote(tools)",
      "remote(check)",
      "# Then, for a named machine:",
      "# remote(check Office)",
      "# remote(wake Office)",
      "# wait 30s",
      "# remote(connect Office)",
    ].join("\n"),
  },
];

const STARTERS_VERSION = 1;

function starterEntries() {
  const now = new Date().toISOString();
  return STARTER_SCRIPTS.map((s) => ({
    id: `s_starter_${s.name}`,
    name: s.name,
    body: s.body,
    updatedAt: now,
  }));
}

function defaultState() {
  return {
    scripts: starterEntries(),
    settings: {
      stopOnError: true,
      startersVersion: STARTERS_VERSION,
    },
  };
}

function mergeStarterScripts(state) {
  if (!state || typeof state !== "object") {
    return { state: defaultState(), added: STARTER_SCRIPTS.map((s) => s.name) };
  }
  const scripts = Array.isArray(state.scripts) ? [...state.scripts] : [];
  const have = new Set(scripts.map((s) => String(s.name || "").toLowerCase()).filter(Boolean));
  const added = [];
  const now = new Date().toISOString();
  for (const starter of STARTER_SCRIPTS) {
    const key = starter.name.toLowerCase();
    if (have.has(key)) continue;
    scripts.push({
      id: uid(),
      name: starter.name,
      body: starter.body,
      updatedAt: now,
    });
    have.add(key);
    added.push(starter.name);
  }
  return {
    state: {
      ...state,
      scripts,
      settings: {
        ...(state.settings || {}),
        startersVersion: STARTERS_VERSION,
      },
    },
    added,
  };
}

function normalizeScript(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = String(raw.name || "").trim().slice(0, 80);
  if (!name) return null;
  return {
    id: String(raw.id || uid()),
    name,
    body: String(raw.body || ""),
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

function normalizeState(raw) {
  if (!raw || typeof raw !== "object") return defaultState();
  const scripts = Array.isArray(raw.scripts)
    ? raw.scripts.map(normalizeScript).filter(Boolean).slice(0, 200)
    : [];
  let state = {
    scripts,
    settings: {
      stopOnError: raw.settings?.stopOnError !== false,
      startersVersion: Number(raw.settings?.startersVersion) || 0,
    },
  };
  const ver = state.settings.startersVersion;
  if (ver < STARTERS_VERSION) {
    state = mergeStarterScripts(state).state;
  }
  return state;
}

async function loadState() {
  const loaded = loadJsonFile(dataPath(), { fallback: null });
  if (!loaded.ok) {
    console.error("scripts load:", loaded.error);
    reportLoadFailure("scripts", loaded);
    return { ok: true, data: defaultState(), fromFile: false, warning: loaded.error };
  }
  if (!loaded.fromFile || loaded.data == null) {
    return { ok: true, data: defaultState(), fromFile: false };
  }
  const prevVer = Number(loaded.data?.settings?.startersVersion) || 0;
  const data = normalizeState(loaded.data);
  if (prevVer < STARTERS_VERSION) {
    const saved = await saveState(data);
    if (!saved.ok) {
      return { ok: true, data, fromFile: true, warning: saved.error };
    }
  }
  return { ok: true, data, fromFile: true };
}

async function saveState(data) {
  const payload = normalizeState(data);
  const result = saveJsonFile(dataPath(), payload, { listKey: "scripts" });
  if (!result.ok) {
    reportSaveFailure("scripts", result);
    return { ok: false, error: result.error || "Failed to save", data: result.data };
  }
  return { ok: true, data: payload };
}

function parseScriptLines(body) {
  return String(body || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

function isCloseAllCommand(line) {
  const t = String(line || "")
    .trim()
    .toLowerCase();
  return t === "a" || t === "close all" || t === "closeall";
}

async function executeLine(line) {
  const { executeInRenderer } = require("./shell-console-ipc");
  const result = await executeInRenderer(line, "scripts-app");
  return {
    line,
    ok: !!result?.ok,
    message: result?.message || result?.error || (result?.ok ? "ok" : "failed"),
  };
}

async function runBody(body, opts = {}) {
  const stopOnError = opts.stopOnError !== false;
  const lines = parseScriptLines(body);
  if (!lines.length) {
    return { ok: false, error: "Script is empty (add commands or uncomment lines)", results: [] };
  }

  try {
    const { executeProgramInRenderer } = require("./shell-console-ipc");
    if (typeof executeProgramInRenderer === "function") {
      const prog = await executeProgramInRenderer(body, "scripts-app", { stopOnError });
      if (prog && typeof prog === "object") {
        const results = Array.isArray(prog.results)
          ? prog.results.map((r, idx) => ({
              line: r.line || lines[idx] || "",
              ok: !!r.ok,
              message: r.message || r.error || (r.ok ? "ok" : "failed"),
            }))
          : [];
        return {
          ok: !!prog.ok,
          message: prog.message || prog.error,
          results,
          ran: results.length,
          failed: results.filter((r) => !r.ok).length,
          stopped: !!prog.stopped,
        };
      }
    }
  } catch {
  }

  const results = [];
  for (const line of lines) {
    if (isCloseAllCommand(line)) {
      const { executeInRenderer } = require("./shell-console-ipc");
      const result = await executeInRenderer("a", "scripts-app");
      results.push({
        line,
        ok: !!result?.ok,
        message: result?.message || result?.error || "close all",
      });
      if (!result?.ok && stopOnError) {
        return {
          ok: false,
          stopped: true,
          message: `Stopped at: ${line}`,
          results,
          ran: results.length,
          failed: 1,
        };
      }
      continue;
    }
    const step = await executeLine(line);
    results.push(step);
    if (!step.ok && stopOnError) {
      return {
        ok: false,
        stopped: true,
        message: `Stopped at: ${line} — ${step.message}`,
        results,
        ran: results.length,
        failed: results.filter((r) => !r.ok).length,
      };
    }
  }
  const failed = results.filter((r) => !r.ok).length;
  return {
    ok: failed === 0,
    message: failed ? `${failed} step(s) failed` : `${results.length} step(s) ok`,
    results,
    ran: results.length,
    failed,
  };
}

async function handleScriptsInvoke(channel, args = {}) {
  const ch = String(channel || "");

  if (ch === "storage.load") {
    const loaded = await loadState();
    if (!loaded.ok) return loaded;
    if (!loaded.fromFile) {
      await saveState(loaded.data);
    }
    return { ok: true, data: loaded.data, warning: loaded.warning };
  }

  if (ch === "storage.save") {
    return saveState(args?.data ?? args);
  }

  if (ch === "settings.patch" || ch === "settings.set") {
    const loaded = await loadState();
    if (!loaded.ok) return loaded;
    if (args?.stopOnError != null) {
      loaded.data.settings.stopOnError = !!args.stopOnError;
    }
    const saved = await saveState(loaded.data);
    if (!saved.ok) return saved;
    return { ok: true, settings: saved.data.settings };
  }

  if (ch === "scripts.list") {
    const loaded = await loadState();
    if (!loaded.ok) return loaded;
    if (!loaded.fromFile) {
      await saveState(loaded.data);
    }
    return {
      ok: true,
      scripts: loaded.data.scripts.map((s) => ({
        id: s.id,
        name: s.name,
        updatedAt: s.updatedAt,
        lines: parseScriptLines(s.body).length,
      })),
      settings: loaded.data.settings,
    };
  }

  if (ch === "scripts.get") {
    const loaded = await loadState();
    if (!loaded.ok) return loaded;
    const id = String(args?.id || "").trim();
    const name = String(args?.name || "").trim().toLowerCase();
    const script = loaded.data.scripts.find(
      (s) => s.id === id || s.name.toLowerCase() === name
    );
    if (!script) return { ok: false, error: "Script not found" };
    return { ok: true, script, settings: loaded.data.settings };
  }

  if (ch === "scripts.create") {
    const loaded = await loadState();
    if (!loaded.ok) return loaded;
    let name = String(args?.name || "untitled").trim().slice(0, 80) || "untitled";
    const base = name;
    let n = 2;
    while (loaded.data.scripts.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      name = `${base}-${n}`;
      n += 1;
    }
    const script = {
      id: uid(),
      name,
      body: String(args?.body ?? "# New script\nrun today\n"),
      updatedAt: new Date().toISOString(),
    };
    loaded.data.scripts.unshift(script);
    await saveState(loaded.data);
    return { ok: true, script };
  }

  if (ch === "scripts.update") {
    const loaded = await loadState();
    if (!loaded.ok) return loaded;
    const id = String(args?.id || "").trim();
    const idx = loaded.data.scripts.findIndex((s) => s.id === id);
    if (idx < 0) return { ok: false, error: "Script not found" };
    const prev = loaded.data.scripts[idx];
    let name = args?.name != null ? String(args.name).trim().slice(0, 80) : prev.name;
    if (!name) name = prev.name;
    const clash = loaded.data.scripts.some(
      (s) => s.id !== id && s.name.toLowerCase() === name.toLowerCase()
    );
    if (clash) return { ok: false, error: `Name already used: ${name}` };
    const next = {
      ...prev,
      name,
      body: args?.body != null ? String(args.body) : prev.body,
      updatedAt: new Date().toISOString(),
    };
    loaded.data.scripts[idx] = next;
    await saveState(loaded.data);
    return { ok: true, script: next };
  }

  if (ch === "scripts.set") {
    const loaded = await loadState();
    if (!loaded.ok) return loaded;
    const name = String(args?.name || "").trim().slice(0, 80);
    if (!name) return { ok: false, error: "Script name required" };
    const body = args?.body != null ? String(args.body) : "";
    const key = name.toLowerCase();
    const idx = loaded.data.scripts.findIndex((s) => s.name.toLowerCase() === key);
    if (idx >= 0) {
      const prev = loaded.data.scripts[idx];
      const next = {
        ...prev,
        body,
        updatedAt: new Date().toISOString(),
      };
      loaded.data.scripts[idx] = next;
      await saveState(loaded.data);
      return { ok: true, script: next, created: false };
    }
    const script = {
      id: uid(),
      name,
      body: body || "# New script\n",
      updatedAt: new Date().toISOString(),
    };
    loaded.data.scripts.unshift(script);
    await saveState(loaded.data);
    return { ok: true, script, created: true };
  }

  if (ch === "scripts.append") {
    const loaded = await loadState();
    if (!loaded.ok) return loaded;
    const name = String(args?.name || "").trim().slice(0, 80);
    if (!name) return { ok: false, error: "Script name required" };
    const text = String(args?.text ?? args?.body ?? args?.line ?? "").trim();
    if (!text) return { ok: false, error: "Nothing to append" };
    const key = name.toLowerCase();
    let idx = loaded.data.scripts.findIndex((s) => s.name.toLowerCase() === key);
    if (idx < 0) {
      const script = {
        id: uid(),
        name,
        body: text,
        updatedAt: new Date().toISOString(),
      };
      loaded.data.scripts.unshift(script);
      await saveState(loaded.data);
      return { ok: true, script, created: true };
    }
    const prev = loaded.data.scripts[idx];
    const body = prev.body ? `${String(prev.body).replace(/\s*$/, "")}\n${text}` : text;
    const next = {
      ...prev,
      body,
      updatedAt: new Date().toISOString(),
    };
    loaded.data.scripts[idx] = next;
    await saveState(loaded.data);
    return { ok: true, script: next, created: false };
  }

  if (ch === "scripts.delete") {
    const loaded = await loadState();
    if (!loaded.ok) return loaded;
    const id = String(args?.id || "").trim();
    const before = loaded.data.scripts.length;
    loaded.data.scripts = loaded.data.scripts.filter((s) => s.id !== id);
    if (loaded.data.scripts.length === before) return { ok: false, error: "Script not found" };
    await saveState(loaded.data);
    return { ok: true };
  }

  if (ch === "scripts.duplicate") {
    const loaded = await loadState();
    if (!loaded.ok) return loaded;
    const id = String(args?.id || "").trim();
    const src = loaded.data.scripts.find((s) => s.id === id);
    if (!src) return { ok: false, error: "Script not found" };
    let name = `${src.name}-copy`;
    let n = 2;
    while (loaded.data.scripts.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      name = `${src.name}-copy-${n}`;
      n += 1;
    }
    const script = {
      id: uid(),
      name,
      body: src.body,
      updatedAt: new Date().toISOString(),
    };
    loaded.data.scripts.unshift(script);
    await saveState(loaded.data);
    return { ok: true, script };
  }

  if (ch === "scripts.run") {
    const loaded = await loadState();
    if (!loaded.ok) return loaded;
    const id = String(args?.id || "").trim();
    const name = String(args?.name || "").trim().toLowerCase();
    const script = loaded.data.scripts.find(
      (s) => s.id === id || s.name.toLowerCase() === name
    );
    if (!script) return { ok: false, error: "Script not found" };
    const stopOnError =
      args?.stopOnError != null ? !!args.stopOnError : loaded.data.settings.stopOnError !== false;
    const result = await runBody(script.body, { stopOnError });
    return {
      ...result,
      script: { id: script.id, name: script.name },
      message:
        result.message ||
        (result.ok
          ? `Script ${script.name}: ${result.ran} step${result.ran === 1 ? "" : "s"}`
          : `Script ${script.name} failed`),
    };
  }

  if (ch === "scripts.parse") {
    return { ok: true, lines: parseScriptLines(args?.body) };
  }

  return { ok: false, error: `Unknown scripts channel: ${ch}` };
}

module.exports = {
  handleScriptsInvoke,
  loadState,
  parseScriptLines,
  runBody,
  STARTER_SCRIPTS,
};