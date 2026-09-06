const path = require("path");
const fs = require("fs");
const { app } = require("electron");
const { loadJsonFile, saveJsonFile } = require("./safe-json-store");
const { reportLoadFailure, reportSaveFailure } = require("../resolve/report-helper");
const { getLocalAuth, setLegacyMigrator } = require("./local-auth");
const { setLocalAuthPrepare } = require("./app-local-auth-ipc");

const APP_ID = "notes";
const auth = getLocalAuth(APP_ID);

const LEGACY_DATA_FILE = () => path.join(app.getPath("userData"), "notes.json");
const LEGACY_MIGRATED_FLAG = (accountsRoot) => path.join(accountsRoot, ".legacy-data-migrated");

function DATA_FILE() {
  return auth.userDataPath("data.json");
}

async function migrateNotesLegacy(userId, accountsRoot) {
  const target = path.join(accountsRoot, "users", userId, "data.json");
  const flag = LEGACY_MIGRATED_FLAG(accountsRoot);
  try {
    await fs.promises.access(flag);
    return;
  } catch {
  }
  try {
    await fs.promises.access(target);
    await fs.promises.writeFile(
      flag,
      JSON.stringify({ userId, at: new Date().toISOString(), source: "existing" }),
      "utf8"
    );
    return;
  } catch {
  }
  const legacyPath = LEGACY_DATA_FILE();
  try {
    const legacy = await fs.promises.readFile(legacyPath, "utf8");
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.writeFile(target, legacy, "utf8");
    await fs.promises.writeFile(
      flag,
      JSON.stringify({ userId, at: new Date().toISOString(), source: "legacy" }),
      "utf8"
    );
  } catch (err) {
    if (err?.code === "ENOENT") {
      await fs.promises.writeFile(
        flag,
        JSON.stringify({ userId, at: new Date().toISOString(), source: "none" }),
        "utf8"
      );
      return;
    }
    throw err;
  }
}

setLegacyMigrator(APP_ID, migrateNotesLegacy);
setLocalAuthPrepare(APP_ID, (localAuth) => {
  localAuth.setSessionRoot(localAuth.getLocalRoot());
  localAuth.setAccountsRoot(localAuth.getLocalRoot());
});

function requireSignedIn() {
  try {
    auth.requireUser();
    return null;
  } catch {
    return { ok: false, error: "Not signed in" };
  }
}

const INBOX_ID = "nb_inbox";

function uid(prefix = "note") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function defaultState() {
  const at = nowIso();
  return {
    notebooks: [{ id: INBOX_ID, name: "Inbox", icon: "📥", createdAt: at }],
    notes: [],
    settings: { defaultNotebookId: INBOX_ID },
  };
}

function normalizeTag(t) {
  return String(t || "")
    .trim()
    .replace(/^#/, "")
    .toLowerCase()
    .slice(0, 40);
}

function normalizeNotebook(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = String(raw.name || "").trim().slice(0, 60);
  if (!name) return null;
  return {
    id: String(raw.id || uid("nb")),
    name,
    icon: String(raw.icon || "📓").slice(0, 8),
    createdAt: raw.createdAt || nowIso(),
  };
}

function normalizeNote(raw) {
  if (!raw || typeof raw !== "object") return null;
  const title = String(raw.title || "").trim().slice(0, 200);
  const body = String(raw.body || "");
  if (!title && !body.trim()) return null;
  const tags = Array.isArray(raw.tags)
    ? [...new Set(raw.tags.map(normalizeTag).filter(Boolean))].slice(0, 20)
    : [];
  return {
    id: String(raw.id || uid("note")),
    title: title || "Untitled",
    body,
    notebookId: String(raw.notebookId || INBOX_ID),
    tags,
    pinned: Boolean(raw.pinned),
    archived: Boolean(raw.archived),
    createdAt: raw.createdAt || nowIso(),
    updatedAt: raw.updatedAt || raw.createdAt || nowIso(),
  };
}

function normalizeState(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;

  let notebooks = Array.isArray(raw.notebooks)
    ? raw.notebooks.map(normalizeNotebook).filter(Boolean).slice(0, 40)
    : [];
  if (!notebooks.some((n) => n.id === INBOX_ID)) {
    notebooks.unshift(base.notebooks[0]);
  }
  if (!notebooks.length) notebooks = base.notebooks;

  const notes = Array.isArray(raw.notes)
    ? raw.notes.map(normalizeNote).filter(Boolean).slice(0, 2000)
    : [];

  const defaultNotebookId = notebooks.some((n) => n.id === raw?.settings?.defaultNotebookId)
    ? raw.settings.defaultNotebookId
    : INBOX_ID;

  return {
    notebooks,
    notes,
    settings: { defaultNotebookId },
  };
}

function loadState() {
  const loaded = loadJsonFile(DATA_FILE(), { fallback: null });
  if (!loaded.ok) {
    console.error("notes load:", loaded.error);
    reportLoadFailure("notes", loaded);
    return { ok: true, data: defaultState(), fromFile: false, warning: loaded.error };
  }
  if (!loaded.fromFile || loaded.data == null) {
    return { ok: true, data: defaultState(), fromFile: false };
  }
  return { ok: true, data: normalizeState(loaded.data), fromFile: true };
}

function saveState(data, { allowEmpty = false } = {}) {
  const payload = normalizeState(data);
  const result = saveJsonFile(DATA_FILE(), payload, {
    listKey: "notes",
    allowEmpty,
  });
  if (!result.ok) {
    reportSaveFailure("notes", result);
    return { ok: false, error: result.error || "Failed to save", data: result.data };
  }
  return { ok: true, data: payload };
}

let chain = Promise.resolve();
function withLock(fn) {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function ensurePersisted() {
  const loaded = loadState();
  if (!loaded.fromFile) {
    const saved = saveState(loaded.data);
    if (saved.ok) return saved;
  }
  return loaded;
}

function sortNotes(a, b) {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
}

function parseTagsFromText(text) {
  const tags = [];
  const re = /#([A-Za-z0-9_\u0590-\u05FF-]+)/g;
  let m;
  while ((m = re.exec(String(text || ""))) !== null) {
    const t = normalizeTag(m[1]);
    if (t) tags.push(t);
  }
  return [...new Set(tags)];
}

function stripHashTags(text) {
  return String(text || "")
    .replace(/#([A-Za-z0-9_\u0590-\u05FF-]+)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchNote(notes, ref) {
  const q = String(ref || "").trim();
  if (!q) return { error: "Missing note id or title" };
  const lower = q.toLowerCase();
  const byId = notes.find((n) => n.id === q || n.id.toLowerCase() === lower);
  if (byId) return { note: byId };
  const exact = notes.filter((n) => String(n.title || "").toLowerCase() === lower);
  if (exact.length === 1) return { note: exact[0] };
  if (exact.length > 1) {
    return { error: `Ambiguous — match one of: ${exact.slice(0, 5).map((n) => n.title).join(" · ")}` };
  }
  const starts = notes.filter((n) => String(n.title || "").toLowerCase().startsWith(lower));
  if (starts.length === 1) return { note: starts[0] };
  const includes = notes.filter((n) => String(n.title || "").toLowerCase().includes(lower));
  if (includes.length === 1) return { note: includes[0] };
  if (includes.length > 1 || starts.length > 1) {
    const amb = (starts.length > 1 ? starts : includes).slice(0, 5);
    return { error: `Ambiguous — match one of: ${amb.map((n) => n.title).join(" · ")}` };
  }
  return { error: `Not found: ${q}` };
}

function filterNotes(notes, opts = {}) {
  let list = notes.slice();
  if (opts.archived === true) list = list.filter((n) => n.archived);
  else if (opts.archived === false || opts.archived == null) {
    if (!opts.includeArchived) list = list.filter((n) => !n.archived);
  }
  if (opts.pinned === true) list = list.filter((n) => n.pinned);
  if (opts.notebookId) list = list.filter((n) => n.notebookId === opts.notebookId);
  if (opts.tag) {
    const tag = normalizeTag(opts.tag);
    list = list.filter((n) => n.tags.includes(tag));
  }
  if (opts.q) {
    const q = String(opts.q).toLowerCase().trim();
    list = list.filter((n) => {
      const blob = [n.title, n.body, ...(n.tags || [])].join(" ").toLowerCase();
      return blob.includes(q);
    });
  }
  return list.sort(sortNotes);
}

async function handleNotesInvoke(channel, args = {}) {
  return withLock(() => handleNotesInvokeUnlocked(channel, args));
}

async function handleNotesInvokeUnlocked(channel, args = {}) {
  const ch = String(channel || "");
  const signedInErr = requireSignedIn();
  if (signedInErr) return signedInErr;

  if (ch === "storage.load") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    return { ok: true, data: loaded.data, warning: loaded.warning };
  }

  if (ch === "storage.save") {
    return saveState(args?.data ?? args);
  }

  if (ch === "notes.list") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    const notes = filterNotes(loaded.data.notes, {
      notebookId: args?.notebookId || null,
      pinned: args?.pinned === true ? true : undefined,
      archived: args?.archived === true ? true : args?.archived === false ? false : undefined,
      includeArchived: args?.includeArchived === true,
      tag: args?.tag || null,
    });
    return { ok: true, notes, notebooks: loaded.data.notebooks, settings: loaded.data.settings };
  }

  if (ch === "notes.search") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    const q = String(args?.q || args?.query || "").trim();
    if (!q) return { ok: false, error: "Query required" };
    const notes = filterNotes(loaded.data.notes, {
      q,
      includeArchived: args?.includeArchived === true,
    });
    return { ok: true, notes, q };
  }

  if (ch === "note.get") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    const ref = args?.id || args?.title || args?.ref;
    const hit = matchNote(loaded.data.notes, ref);
    if (hit.error) return { ok: false, error: hit.error };
    return { ok: true, note: hit.note };
  }

  if (ch === "note.add") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    let title = String(args?.title || "").trim();
    let body = String(args?.body || "");
    const rawLine = String(args?.text || args?.line || "").trim();

    if (rawLine && !title) {
      const pipe = rawLine.split("|").map((s) => s.trim());
      if (pipe.length >= 2) {
        title = pipe[0];
        body = pipe.slice(1).join(" | ");
      } else {
        title = rawLine;
      }
    }

    const fromTitle = parseTagsFromText(title);
    const fromBody = parseTagsFromText(body);
    const explicit = Array.isArray(args?.tags) ? args.tags.map(normalizeTag).filter(Boolean) : [];
    const tags = [...new Set([...explicit, ...fromTitle, ...fromBody])].slice(0, 20);
    title = stripHashTags(title) || "Untitled";

    const notebookId =
      String(args?.notebookId || loaded.data.settings.defaultNotebookId || INBOX_ID).trim() ||
      INBOX_ID;
    const nbOk = loaded.data.notebooks.some((n) => n.id === notebookId);
    const note = normalizeNote({
      id: uid("note"),
      title,
      body,
      notebookId: nbOk ? notebookId : INBOX_ID,
      tags,
      pinned: Boolean(args?.pinned),
      archived: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    if (!note) return { ok: false, error: "Empty note" };
    loaded.data.notes.unshift(note);
    const saved = saveState(loaded.data);
    if (!saved.ok) return saved;
    return { ok: true, note };
  }

  if (ch === "note.update") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    const id = String(args?.id || "").trim();
    const idx = loaded.data.notes.findIndex((n) => n.id === id);
    if (idx < 0) return { ok: false, error: "Note not found" };
    const prev = loaded.data.notes[idx];
    const next = normalizeNote({
      ...prev,
      title: args?.title != null ? args.title : prev.title,
      body: args?.body != null ? args.body : prev.body,
      notebookId: args?.notebookId != null ? args.notebookId : prev.notebookId,
      tags: args?.tags != null ? args.tags : prev.tags,
      pinned: args?.pinned != null ? args.pinned : prev.pinned,
      archived: args?.archived != null ? args.archived : prev.archived,
      createdAt: prev.createdAt,
      updatedAt: nowIso(),
      id: prev.id,
    });
    if (!next) return { ok: false, error: "Invalid note" };
    loaded.data.notes[idx] = next;
    const saved = saveState(loaded.data);
    if (!saved.ok) return saved;
    return { ok: true, note: next };
  }

  if (ch === "note.delete") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    const ref = args?.id || args?.title || args?.ref;
    const hit = matchNote(loaded.data.notes, ref);
    if (hit.error) return { ok: false, error: hit.error };
    loaded.data.notes = loaded.data.notes.filter((n) => n.id !== hit.note.id);
    const saved = saveState(loaded.data, { allowEmpty: true });
    if (!saved.ok) return saved;
    return { ok: true, id: hit.note.id };
  }

  if (ch === "note.pin") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    const ref = args?.id || args?.title || args?.ref;
    const hit = matchNote(loaded.data.notes, ref);
    if (hit.error) return { ok: false, error: hit.error };
    const idx = loaded.data.notes.findIndex((n) => n.id === hit.note.id);
    const pinned = args?.pinned != null ? Boolean(args.pinned) : !hit.note.pinned;
    loaded.data.notes[idx] = {
      ...hit.note,
      pinned,
      updatedAt: nowIso(),
    };
    const saved = saveState(loaded.data);
    if (!saved.ok) return saved;
    return { ok: true, note: loaded.data.notes[idx] };
  }

  if (ch === "note.archive") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    const ref = args?.id || args?.title || args?.ref;
    const hit = matchNote(loaded.data.notes, ref);
    if (hit.error) return { ok: false, error: hit.error };
    const idx = loaded.data.notes.findIndex((n) => n.id === hit.note.id);
    const archived = args?.archived != null ? Boolean(args.archived) : !hit.note.archived;
    loaded.data.notes[idx] = {
      ...hit.note,
      archived,
      updatedAt: nowIso(),
    };
    const saved = saveState(loaded.data);
    if (!saved.ok) return saved;
    return { ok: true, note: loaded.data.notes[idx] };
  }

  if (ch === "notebooks.list") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    return { ok: true, notebooks: loaded.data.notebooks, settings: loaded.data.settings };
  }

  if (ch === "notebook.add") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    const nb = normalizeNotebook({
      id: uid("nb"),
      name: args?.name || "Notebook",
      icon: args?.icon || "📓",
      createdAt: nowIso(),
    });
    if (!nb) return { ok: false, error: "Name required" };
    if (loaded.data.notebooks.some((n) => n.name.toLowerCase() === nb.name.toLowerCase())) {
      return { ok: false, error: `Notebook already exists: ${nb.name}` };
    }
    loaded.data.notebooks.push(nb);
    const saved = saveState(loaded.data);
    if (!saved.ok) return saved;
    return { ok: true, notebook: nb };
  }

  if (ch === "notebook.rename") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    const id = String(args?.id || "").trim();
    const idx = loaded.data.notebooks.findIndex((n) => n.id === id);
    if (idx < 0) return { ok: false, error: "Notebook not found" };
    if (id === INBOX_ID && args?.name != null) {
    }
    const name = String(args?.name || "").trim().slice(0, 60);
    if (!name) return { ok: false, error: "Name required" };
    loaded.data.notebooks[idx] = { ...loaded.data.notebooks[idx], name };
    const saved = saveState(loaded.data);
    if (!saved.ok) return saved;
    return { ok: true, notebook: loaded.data.notebooks[idx] };
  }

  if (ch === "notebook.delete") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    const id = String(args?.id || "").trim();
    if (id === INBOX_ID) return { ok: false, error: "Cannot delete Inbox" };
    const idx = loaded.data.notebooks.findIndex((n) => n.id === id);
    if (idx < 0) return { ok: false, error: "Notebook not found" };
    loaded.data.notebooks.splice(idx, 1);
    loaded.data.notes = loaded.data.notes.map((n) =>
      n.notebookId === id ? { ...n, notebookId: INBOX_ID, updatedAt: nowIso() } : n
    );
    if (loaded.data.settings.defaultNotebookId === id) {
      loaded.data.settings.defaultNotebookId = INBOX_ID;
    }
    const saved = saveState(loaded.data);
    if (!saved.ok) return saved;
    return { ok: true };
  }

  return { ok: false, error: `Unknown notes channel: ${ch}` };
}

module.exports = {
  handleNotesInvoke,
  loadState,
  matchNote,
  INBOX_ID,
};
