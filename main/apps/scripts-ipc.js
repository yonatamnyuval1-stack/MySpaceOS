const path = require("path");
const fs = require("fs");
const { app } = require("electron");
const { loadJsonFile, saveJsonFile } = require("./safe-json-store");
const { reportLoadFailure, reportSaveFailure } = require("../resolve/report-helper");
function dataPath() {
  const profile = require("../myspace-profile");
  return profile.profileScopedPath("scripts.json");
}

function uid() {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
const DEMO_SCRIPT_NAMES = new Set(["morning", "focus", "eod", "remote"]);
const STARTERS_VERSION = 3;
const PROGRAM_EXT = ".msos";

function stripProgramExt(name) {
  const n = String(name || "").trim();
  if (n.toLowerCase().endsWith(PROGRAM_EXT)) return n.slice(0, -PROGRAM_EXT.length);
  return n;
}

function ensureProgramExt(name) {
  let base = String(name || "").trim();
  if (!base) base = "untitled";
  base = stripProgramExt(base).replace(/[<>:"|?*\u0000-\u001f]/g, "").slice(0, 72);
  if (!base) base = "untitled";
  return `${base}${PROGRAM_EXT}`;
}

function namesMatch(a, b) {
  return ensureProgramExt(a).toLowerCase() === ensureProgramExt(b).toLowerCase();
}

function findScriptByRef(scripts, ref) {
  const q = String(ref || "").trim();
  if (!q) return null;
  const byId = (scripts || []).find((s) => s.id === q);
  if (byId) return byId;
  return (scripts || []).find((s) => namesMatch(s.name, q)) || null;
}

function uniqueProgramName(scripts, desired) {
  let name = ensureProgramExt(desired);
  const stem = stripProgramExt(name);
  let n = 2;
  while ((scripts || []).some((s) => namesMatch(s.name, name))) {
    name = ensureProgramExt(`${stem}-${n}`);
    n += 1;
  }
  return name;
}

function normalizeFolder(raw) {
  return String(raw || "")
    .replace(/\\/g, "/")
    .split("/")
    .map((p) => p.trim())
    .filter((p) => p && p !== "." && p !== "..")
    .map((p) => p.replace(/[<>:"|?*\u0000-\u001f]/g, "").slice(0, 64))
    .filter(Boolean)
    .slice(0, 8)
    .join("/");
}

function folderAncestors(folder) {
  const parts = normalizeFolder(folder).split("/").filter(Boolean);
  const out = [];
  for (let i = 0; i < parts.length; i += 1) {
    out.push(parts.slice(0, i + 1).join("/"));
  }
  return out;
}

function collectFolders(scripts, explicit) {
  const set = new Set();
  for (const f of Array.isArray(explicit) ? explicit : []) {
    const n = normalizeFolder(f);
    if (n) {
      folderAncestors(n).forEach((a) => set.add(a));
    }
  }
  for (const s of Array.isArray(scripts) ? scripts : []) {
    const n = normalizeFolder(s?.folder);
    if (n) folderAncestors(n).forEach((a) => set.add(a));
  }
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function defaultState() {
  return {
    scripts: [],
    settings: {
      stopOnError: true,
      startersVersion: STARTERS_VERSION,
      folders: [],
      expandedFolders: [],
    },
  };
}

function purgeDemoScripts(state) {
  if (!state || typeof state !== "object") return defaultState();
  const scripts = (Array.isArray(state.scripts) ? state.scripts : []).filter((s) => {
    const id = String(s?.id || "");
    const stem = stripProgramExt(s?.name || "").toLowerCase();
    if (id.startsWith("s_starter_")) return false;
    if (DEMO_SCRIPT_NAMES.has(stem)) return false;
    return true;
  });
  return {
    ...state,
    scripts,
    settings: {
      ...(state.settings || {}),
      startersVersion: STARTERS_VERSION,
      folders: collectFolders(scripts, state.settings?.folders),
      expandedFolders: Array.isArray(state.settings?.expandedFolders)
        ? state.settings.expandedFolders.map(normalizeFolder).filter(Boolean)
        : [],
    },
  };
}

function normalizeScript(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = ensureProgramExt(String(raw.name || "").trim());
  if (!stripProgramExt(name)) return null;
  return {
    id: String(raw.id || uid()),
    name,
    body: String(raw.body || ""),
    folder: normalizeFolder(raw.folder),
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
      folders: collectFolders(scripts, raw.settings?.folders),
      expandedFolders: Array.isArray(raw.settings?.expandedFolders)
        ? [...new Set(raw.settings.expandedFolders.map(normalizeFolder).filter(Boolean))]
        : [],
    },
  };
  const ver = state.settings.startersVersion;
  if (ver < STARTERS_VERSION) {
    state = purgeDemoScripts(state);
  }
  state.settings.folders = collectFolders(state.scripts, state.settings.folders);
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
          ran: Number(prog.ran ?? results.length) || results.length,
          total: Number(prog.total ?? lines.length) || lines.length,
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
          total: lines.length,
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
        total: lines.length,
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
    total: lines.length,
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
    if (Array.isArray(args?.expandedFolders)) {
      loaded.data.settings.expandedFolders = [
        ...new Set(args.expandedFolders.map(normalizeFolder).filter(Boolean)),
      ];
    }
    if (Array.isArray(args?.folders)) {
      loaded.data.settings.folders = collectFolders(loaded.data.scripts, args.folders);
    }
    const saved = await saveState(loaded.data);
    if (!saved.ok) return saved;
    return { ok: true, settings: saved.data.settings };
  }
  if (ch === "folders.create") {
    const loaded = await loadState();
    if (!loaded.ok) return loaded;
    const folder = normalizeFolder(args?.folder ?? args?.path ?? args?.name);
    if (!folder) return { ok: false, error: "Folder name required" };
    loaded.data.settings.folders = collectFolders(loaded.data.scripts, [
      ...(loaded.data.settings.folders || []),
      folder,
    ]);
    const expanded = new Set(loaded.data.settings.expandedFolders || []);
    folderAncestors(folder).forEach((a) => expanded.add(a));
    loaded.data.settings.expandedFolders = [...expanded];
    const saved = await saveState(loaded.data);
    if (!saved.ok) return saved;
    return { ok: true, folder, settings: saved.data.settings };
  }
  if (ch === "folders.delete") {
    const loaded = await loadState();
    if (!loaded.ok) return loaded;
    const folder = normalizeFolder(args?.folder ?? args?.path);
    if (!folder) return { ok: false, error: "Folder required" };
    const prefix = `${folder}/`;
    loaded.data.scripts = loaded.data.scripts.map((s) => {
      const f = normalizeFolder(s.folder);
      if (f === folder || f.startsWith(prefix)) {
        return { ...s, folder: "", updatedAt: new Date().toISOString() };
      }
      return s;
    });
    loaded.data.settings.folders = (loaded.data.settings.folders || []).filter(
      (f) => f !== folder && !String(f).startsWith(prefix)
    );
    loaded.data.settings.expandedFolders = (loaded.data.settings.expandedFolders || []).filter(
      (f) => f !== folder && !String(f).startsWith(prefix)
    );
    const saved = await saveState(loaded.data);
    if (!saved.ok) return saved;
    return { ok: true, settings: saved.data.settings, scripts: saved.data.scripts };
  }
  if (ch === "folders.rename") {
    const loaded = await loadState();
    if (!loaded.ok) return loaded;
    const from = normalizeFolder(args?.from ?? args?.folder ?? args?.path);
    if (!from) return { ok: false, error: "Folder required" };
    const rawTo = String(args?.to ?? args?.name ?? "").trim();
    const segment = normalizeFolder(rawTo.split(/[/\\]/).filter(Boolean).pop() || "");
    if (!segment) return { ok: false, error: "New folder name required" };
    const parent = from.includes("/") ? from.slice(0, from.lastIndexOf("/")) : "";
    const to = parent ? `${parent}/${segment}` : segment;
    if (to === from) {
      return { ok: true, folder: to, settings: loaded.data.settings, scripts: loaded.data.scripts };
    }
    const fromPrefix = `${from}/`;
    const existing = new Set(collectFolders(loaded.data.scripts, loaded.data.settings.folders));
    if (existing.has(to)) {
      return { ok: false, error: `Folder already exists: ${to}` };
    }
    const remap = (f) => {
      const n = normalizeFolder(f);
      if (n === from) return to;
      if (n.startsWith(fromPrefix)) return `${to}/${n.slice(fromPrefix.length)}`;
      return n;
    };
    loaded.data.scripts = loaded.data.scripts.map((s) => {
      const nextFolder = remap(s.folder);
      if (nextFolder === normalizeFolder(s.folder)) return s;
      return { ...s, folder: nextFolder, updatedAt: new Date().toISOString() };
    });
    loaded.data.settings.folders = collectFolders(
      loaded.data.scripts,
      (loaded.data.settings.folders || []).map(remap)
    );
    loaded.data.settings.expandedFolders = [
      ...new Set((loaded.data.settings.expandedFolders || []).map(remap).filter(Boolean)),
    ];
    const saved = await saveState(loaded.data);
    if (!saved.ok) return saved;
    return {
      ok: true,
      folder: to,
      from,
      settings: saved.data.settings,
      scripts: saved.data.scripts,
    };
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
    const name = String(args?.name || "").trim();
    const script =
      findScriptByRef(loaded.data.scripts, id) ||
      findScriptByRef(loaded.data.scripts, name);
    if (!script) return { ok: false, error: "Script not found" };
    return { ok: true, script, settings: loaded.data.settings };
  }

  if (ch === "scripts.create") {
    const loaded = await loadState();
    if (!loaded.ok) return loaded;
    const name = uniqueProgramName(loaded.data.scripts, args?.name || "untitled");
    const folder = normalizeFolder(args?.folder);
    if (folder) {
      loaded.data.settings.folders = collectFolders(loaded.data.scripts, [
        ...(loaded.data.settings.folders || []),
        folder,
      ]);
    }
    const script = {
      id: uid(),
      name,
      body: String(args?.body ?? ""),
      folder,
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
    let name =
      args?.name != null ? ensureProgramExt(String(args.name).trim()) : ensureProgramExt(prev.name);
    if (!stripProgramExt(name)) name = prev.name;
    const clash = loaded.data.scripts.some((s) => s.id !== id && namesMatch(s.name, name));
    if (clash) return { ok: false, error: `Name already used: ${name}` };
    const folder =
      args?.folder != null ? normalizeFolder(args.folder) : normalizeFolder(prev.folder);
    if (folder) {
      loaded.data.settings.folders = collectFolders(
        loaded.data.scripts.map((s, i) => (i === idx ? { ...s, folder } : s)),
        loaded.data.settings.folders
      );
    }
    const next = {
      ...prev,
      name,
      body: args?.body != null ? String(args.body) : prev.body,
      folder,
      updatedAt: new Date().toISOString(),
    };
    loaded.data.scripts[idx] = next;
    await saveState(loaded.data);
    return { ok: true, script: next };
  }
  if (ch === "scripts.set") {
    const loaded = await loadState();
    if (!loaded.ok) return loaded;
    const rawName = String(args?.name || "").trim();
    if (!stripProgramExt(rawName)) return { ok: false, error: "Script name required" };
    const name = ensureProgramExt(rawName);
    const body = args?.body != null ? String(args.body) : "";
    const idx = loaded.data.scripts.findIndex((s) => namesMatch(s.name, name));
    if (idx >= 0) {
      const prev = loaded.data.scripts[idx];
      const next = {
        ...prev,
        name,
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
      body: body || "",
      folder: normalizeFolder(args?.folder),
      updatedAt: new Date().toISOString(),
    };
    loaded.data.scripts.unshift(script);
    await saveState(loaded.data);
    return { ok: true, script, created: true };
  }
  if (ch === "scripts.append") {
    const loaded = await loadState();
    if (!loaded.ok) return loaded;
    const rawName = String(args?.name || "").trim();
    if (!stripProgramExt(rawName)) return { ok: false, error: "Script name required" };
    const name = ensureProgramExt(rawName);
    const text = String(args?.text ?? args?.body ?? args?.line ?? "").trim();
    if (!text) return { ok: false, error: "Nothing to append" };
    let idx = loaded.data.scripts.findIndex((s) => namesMatch(s.name, name));
    if (idx < 0) {
      const script = {
        id: uid(),
        name,
        body: text,
        folder: normalizeFolder(args?.folder),
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
      name,
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
    const stem = stripProgramExt(src.name);
    const name = uniqueProgramName(loaded.data.scripts, `${stem}-copy`);
    const script = {
      id: uid(),
      name,
      body: src.body,
      folder: normalizeFolder(src.folder),
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
    const name = String(args?.name || "").trim();
    const script =
      findScriptByRef(loaded.data.scripts, id) ||
      findScriptByRef(loaded.data.scripts, name);
    const hasBody = args?.body != null;
    if (!script && !hasBody) return { ok: false, error: "Script not found" };
    const body = hasBody ? String(args.body) : script.body;
    const stopOnError =
      args?.stopOnError != null ? !!args.stopOnError : loaded.data.settings.stopOnError !== false;
    const result = await runBody(body, { stopOnError });
    const label = script?.name || "program";
    return {
      ...result,
      script: script ? { id: script.id, name: script.name } : null,
      message:
        result.message ||
        (result.ok
          ? `Script ${label}: ${result.ran} step${result.ran === 1 ? "" : "s"}`
          : `Script ${label} failed`),
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
  ensureProgramExt,
  stripProgramExt,
  PROGRAM_EXT,
  STARTER_SCRIPTS: [],
  DEMO_SCRIPT_NAMES,
};