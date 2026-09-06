const path = require("path");
const fs = require("fs");
const { app, dialog, BrowserWindow } = require("electron");
const {
  parseDocument,
  buildDocument,
  looksLikeSpacePath,
  sanitizeFileStem,
  MAX_BYTES,
} = require("../space-file-format");
const { handleScriptsInvoke } = require("./scripts-ipc");
const { handleModelFlowInvoke } = require("./model-flow-ipc");
const { handleNotesInvoke } = require("./notes-ipc");
const { handleStudyDeckInvoke } = require("./study-deck-ipc");

const PROTOCOL = "myspace";

function parentWindow(event) {
  const win = event?.sender ? BrowserWindow.fromWebContents(event.sender) : null;
  if (win && !win.isDestroyed()) return win;
  return BrowserWindow.getFocusedWindow();
}

function unwrapQuotes(raw) {
  return String(raw || "")
    .trim()
    .replace(/^["']+|["']+$/g, "");
}

function spaceSearchDirs() {
  const dirs = [
    process.cwd(),
    app.getPath("home"),
    app.getPath("downloads"),
    app.getPath("documents"),
    app.getPath("desktop"),
  ];
  return [...new Set(dirs.filter(Boolean))];
}

function resolveSpacePath(raw) {
  const input = unwrapQuotes(raw);
  if (!input) return null;
  if (!looksLikeSpacePath(input)) return null;
  if (path.isAbsolute(input)) return path.normalize(input);
  for (const dir of spaceSearchDirs()) {
    const tryPath = path.resolve(dir, input);
    if (fs.existsSync(tryPath)) return tryPath;
  }
  return path.resolve(process.cwd(), input);
}

async function hintForMissingSpace(resolved, rawInput) {
  const stem = path.basename(resolved, path.extname(resolved));
  const raw = unwrapQuotes(rawInput);
  const hints = [];

  if (raw && !/[\\/]/.test(raw) && !/^[a-zA-Z]:/.test(raw)) {
    hints.push("Use pack(pick) to browse, or paste the full path after export");
  }

  try {
    const listed = await handleScriptsInvoke("scripts.list", {});
    const scripts = listed?.scripts || [];
    const hit = scripts.find((s) => String(s.name || "").toLowerCase() === stem.toLowerCase());
    if (hit) {
      hints.push(
        `“${hit.name}” lives in Scripts: export it first: pack(export script ${hit.name})`,
      );
    }
  } catch {
  }

  return hints.length ? hints.join(". ") : "";
}

async function readDoc(filePath) {
  const resolved = resolveSpacePath(filePath) || unwrapQuotes(filePath);
  if (!resolved) return { ok: false, error: "Path must be a .space file" };
  let st;
  try {
    st = await fs.promises.stat(resolved);
  } catch {
    const hint = await hintForMissingSpace(resolved, filePath);
    const error = hint
      ? `File not found: ${resolved}. ${hint}`
      : `File not found: ${resolved}`;
    return { ok: false, error };
  }
  if (!st.isFile()) return { ok: false, error: "Not a file" };
  if (st.size > MAX_BYTES) return { ok: false, error: "File is too large" };
  const raw = await fs.promises.readFile(resolved, "utf8");
  const parsed = parseDocument(raw);
  if (!parsed.ok) return parsed;
  return { ok: true, path: resolved, doc: parsed.doc };
}

async function writeDoc(filePath, docText) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, docText, "utf8");
  return { ok: true, path: filePath };
}

async function importDoc(doc) {
  const kind = doc.kind;
  const payload = doc.payload;

  if (kind === "script") {
    const res = await handleScriptsInvoke("scripts.create", {
      name: payload.name,
      body: payload.body,
    });
    if (!res?.ok) return { ok: false, error: res?.error || "Could not import script" };
    return {
      ok: true,
      kind,
      title: res.script.name,
      imported: { id: res.script.id, name: res.script.name },
      launch: {
        appId: "scripts",
        module: "scripts",
        route: { action: "openScript", param: res.script.name },
      },
    };
  }

  if (kind === "flow") {
    const flow = {
      title: payload.title,
      task: payload.task,
      summary: payload.summary,
      source: payload.source || "import",
      steps: payload.steps,
    };
    const res = await handleModelFlowInvoke("flow.library.save", {
      flow,
      title: payload.title,
    });
    if (!res?.ok) return { ok: false, error: res?.error || "Could not import flow" };
    return {
      ok: true,
      kind,
      title: res.item?.title || payload.title,
      imported: { id: res.item?.id, name: res.item?.title },
      launch: {
        appId: "model-flow",
        module: "model-flow",
        route: {
          page: "studio",
          task: flow.task,
          flow: res.item?.flow || flow,
        },
      },
    };
  }

  if (kind === "note") {
    const res = await handleNotesInvoke("note.add", {
      title: payload.title,
      body: payload.body,
      tags: payload.tags,
    });
    if (!res?.ok) return { ok: false, error: res?.error || "Could not import note" };
    return {
      ok: true,
      kind,
      title: res.note.title,
      imported: { id: res.note.id, name: res.note.title },
      launch: {
        appId: "notes",
        module: "notes",
        route: { page: "all", noteId: res.note.id },
      },
    };
  }

  if (kind === "deck") {
    const created = await handleStudyDeckInvoke("deck.create", {
      name: payload.name,
      description: payload.description,
      color: payload.color,
      language: payload.language,
    });
    if (!created?.ok) return { ok: false, error: created?.error || "Could not import deck" };
    const updated = await handleStudyDeckInvoke("deck.update", {
      id: created.deck.id,
      name: payload.name,
      description: payload.description,
      color: payload.color,
      language: payload.language,
      cards: payload.cards,
    });
    const deck = updated?.deck || created.deck;
    return {
      ok: true,
      kind,
      title: deck.name,
      imported: { id: deck.id, name: deck.name },
      launch: {
        appId: "study-deck",
        module: "study-deck",
        route: { page: "deck", action: "openDeck", param: deck.id },
      },
    };
  }

  return { ok: false, error: `Cannot import kind "${kind}"` };
}

async function collectExportSource(kind, ref, extraPayload) {
  if (isPlainPayload(extraPayload, kind)) {
    return { ok: true, kind, title: extraPayload.title || extraPayload.name, payload: extraPayload };
  }
  const key = String(ref || "").trim();
  if (kind === "script") {
    if (!key) return { ok: false, error: "Usage: pack(export script morning)" };
    const res = await handleScriptsInvoke("scripts.get", { name: key, id: key });
    if (!res?.ok) return { ok: false, error: res?.error || "Script not found" };
    return {
      ok: true,
      kind: "script",
      title: res.script.name,
      payload: { name: res.script.name, body: res.script.body },
    };
  }
  if (kind === "flow") {
    if (!key) return { ok: false, error: "Usage: pack(export flow Title)" };
    const list = await handleModelFlowInvoke("flow.library.list", {});
    const items = list?.items || list?.library || [];
    const hit = items.find(
      (x) =>
        x.id === key ||
        String(x.title || "").toLowerCase() === key.toLowerCase()
    );
    if (!hit?.flow) {
      const one = await handleModelFlowInvoke("flow.library.get", { id: key });
      if (!one?.ok || !one.item?.flow) return { ok: false, error: "Saved flow not found: save it to the library first" };
      return {
        ok: true,
        kind: "flow",
        title: one.item.title,
        payload: one.item.flow,
      };
    }
    return { ok: true, kind: "flow", title: hit.title, payload: hit.flow };
  }
  if (kind === "note") {
    if (!key) return { ok: false, error: "Usage: pack(export note Title)" };
    const res = await handleNotesInvoke("note.get", { ref: key, title: key, id: key });
    if (!res?.ok) return { ok: false, error: res?.error || "Note not found" };
    return {
      ok: true,
      kind: "note",
      title: res.note.title,
      payload: { title: res.note.title, body: res.note.body, tags: res.note.tags || [] },
    };
  }
  if (kind === "deck") {
    if (!key) return { ok: false, error: "Usage: pack(export deck Name)" };
    const listed = await handleStudyDeckInvoke("decks.list", {});
    const decks = listed?.decks || [];
    const hit =
      decks.find((d) => d.id === key) ||
      decks.find((d) => String(d.name || "").toLowerCase() === key.toLowerCase());
    if (!hit) return { ok: false, error: "Deck not found" };
    const full = await handleStudyDeckInvoke("deck.get", { id: hit.id });
    const deck = full?.deck || hit;
    return {
      ok: true,
      kind: "deck",
      title: deck.name,
      payload: {
        name: deck.name,
        description: deck.description,
        color: deck.color,
        language: deck.language,
        cards: (deck.cards || []).map((c) => ({
          type: c.type,
          front: c.front,
          back: c.back,
          choices: c.choices,
          answerIndex: c.answerIndex,
          explanation: c.explanation,
        })),
      },
    };
  }
  return { ok: false, error: `Unknown kind "${kind}"` };
}

function isPlainPayload(extra, kind) {
  if (!extra || typeof extra !== "object") return false;
  if (kind === "script") return typeof extra.body === "string";
  if (kind === "flow") return Array.isArray(extra.steps);
  if (kind === "note") return extra.title != null || extra.body != null;
  if (kind === "deck") return extra.name && Array.isArray(extra.cards);
  return false;
}

async function pickOpen(event) {
  const win = parentWindow(event);
  const res = await dialog.showOpenDialog(win || undefined, {
    title: "Open My Space file",
    properties: ["openFile"],
    filters: [{ name: "My Space files", extensions: ["space"] }],
  });
  if (res.canceled || !res.filePaths?.[0]) return { ok: false, cancelled: true };
  return { ok: true, path: res.filePaths[0] };
}

async function pickSave(event, title) {
  const win = parentWindow(event);
  const res = await dialog.showSaveDialog(win || undefined, {
    title: "Export My Space file",
    defaultPath: `${sanitizeFileStem(title)}.space`,
    filters: [{ name: "My Space files", extensions: ["space"] }],
  });
  if (res.canceled || !res.filePath) return { ok: false, cancelled: true };
  let dest = res.filePath;
  if (!/\.space$/i.test(dest)) dest = `${dest}.space`;
  return { ok: true, path: dest };
}

async function handleSpaceFileInvoke(action, args = {}, event) {
  const act = String(action || "");

  if (act === "inspect") {
    const read = await readDoc(args.path);
    if (!read.ok) return read;
    return {
      ok: true,
      path: read.path,
      kind: read.doc.kind,
      title: read.doc.title,
      exportedAt: read.doc.exportedAt,
      version: read.doc.version,
    };
  }

  if (act === "open" || act === "import") {
    const read = await readDoc(args.path);
    if (!read.ok) return read;
    const imported = await importDoc(read.doc);
    if (!imported.ok) return imported;
    return {
      ...imported,
      path: read.path,
      message: `Imported ${imported.kind} “${imported.title}”`,
    };
  }

  if (act === "pick") {
    const picked = await pickOpen(event);
    if (!picked.ok) return picked;
    return handleSpaceFileInvoke("open", { path: picked.path }, event);
  }

  if (act === "export") {
    const kind = String(args.kind || "").toLowerCase().trim();
    const src = await collectExportSource(kind, args.ref || args.name || args.id, args.payload);
    if (!src.ok) return src;
    const built = buildDocument({ kind: src.kind, title: src.title, payload: src.payload });
    if (!built.ok) return built;
    let dest = args.path ? unwrapQuotes(args.path) : "";
    if (!dest) {
      const picked = await pickSave(event, built.doc.title);
      if (!picked.ok) return picked;
      dest = picked.path;
    } else if (!/\.space$/i.test(dest)) {
      dest = `${dest}.space`;
    }
    if (!path.isAbsolute(dest)) dest = path.resolve(process.cwd(), dest);
    const written = await writeDoc(dest, built.text);
    if (!written.ok) return written;
    return {
      ok: true,
      path: written.path,
      kind: built.doc.kind,
      title: built.doc.title,
      message: `Exported ${built.doc.kind} “${built.doc.title}”`,
    };
  }

  return { ok: false, error: `Unknown space-file action: ${act}` };
}

function parseMyspaceUrl(raw) {
  try {
    const href = String(raw || "").trim();
    if (!/^myspace:/i.test(href)) return null;
    const u = new URL(href);
    const file =
      u.searchParams.get("file") ||
      u.searchParams.get("path") ||
      decodeURIComponent((u.pathname || "").replace(/^\/+/, ""));
    return file || null;
  } catch {
    return null;
  }
}

function collectSpaceFilesFromArgv(argv = []) {
  const files = [];
  for (const a of argv || []) {
    if (!a || a.startsWith("--")) continue;
    const fromUrl = parseMyspaceUrl(a);
    if (fromUrl && looksLikeSpacePath(fromUrl)) {
      files.push(resolveSpacePath(fromUrl) || unwrapQuotes(fromUrl));
      continue;
    }
    if (looksLikeSpacePath(a)) {
      files.push(resolveSpacePath(a) || unwrapQuotes(a));
    }
  }
  return [...new Set(files)];
}

function registerProtocolClient() {
  try {
    if (app.isPackaged) {
      app.setAsDefaultProtocolClient(PROTOCOL);
    } else {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(__dirname, "..", "..")]);
    }
  } catch (err) {
    console.warn("myspace protocol register failed:", err?.message || err);
  }
}

module.exports = {
  handleSpaceFileInvoke,
  collectSpaceFilesFromArgv,
  registerProtocolClient,
  parseMyspaceUrl,
  looksLikeSpacePath,
  PROTOCOL,
};