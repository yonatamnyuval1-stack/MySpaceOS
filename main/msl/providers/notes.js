const { handleNotesInvoke } = require("../../apps/notes-ipc");

function slimNote(n) {
  if (!n) return null;
  return {
    id: n.id,
    title: n.title || "Untitled",
    body: n.body || "",
    notebookId: n.notebookId || null,
    tags: Array.isArray(n.tags) ? n.tags : [],
    pinned: Boolean(n.pinned),
    archived: Boolean(n.archived),
    updatedAt: n.updatedAt || null,
    createdAt: n.createdAt || null,
  };
}

async function listNotes(input = {}) {
  const res = await handleNotesInvoke("notes.list", {
    notebookId: input.notebookId || null,
    pinned: input.pinned === true ? true : undefined,
    archived: input.archived === true ? true : input.archived === false ? false : undefined,
    includeArchived: input.includeArchived === true,
    tag: input.tag || null,
  });
  if (!res?.ok) return res;
  const limit = Math.min(Math.max(Number(input.limit) || 80, 1), 300);
  const notes = (res.notes || []).map(slimNote).filter(Boolean).slice(0, limit);
  return {
    ok: true,
    notes,
    total: (res.notes || []).length,
    notebooks: res.notebooks || [],
  };
}

async function searchNotes(input = {}) {
  const q = String(input.q || input.query || "").trim();
  if (!q) return { ok: false, error: "Missing query" };
  const res = await handleNotesInvoke("notes.search", {
    q,
    includeArchived: input.includeArchived === true,
  });
  if (!res?.ok) return res;
  const limit = Math.min(Math.max(Number(input.limit) || 40, 1), 200);
  return {
    ok: true,
    notes: (res.notes || []).map(slimNote).filter(Boolean).slice(0, limit),
    total: (res.notes || []).length,
    q,
  };
}

async function getNote(input = {}) {
  const ref = input.id || input.title || input.ref || input.q;
  if (!ref) return { ok: false, error: "Missing note id or title" };
  const res = await handleNotesInvoke("note.get", {
    id: input.id,
    title: input.title,
    ref,
  });
  if (!res?.ok) return res;
  return { ok: true, note: slimNote(res.note) };
}

async function addNote(input = {}) {
  const res = await handleNotesInvoke("note.add", {
    title: input.title,
    body: input.body,
    text: input.text || input.line,
    tags: input.tags,
    notebookId: input.notebookId,
    pinned: input.pinned,
  });
  if (!res?.ok) return res;
  return { ok: true, note: slimNote(res.note) };
}

const CAPABILITIES = [
  {
    id: "notes.list",
    kind: "query",
    provider: "notes",
    title: "List notes",
    description: "List notes (optional notebook, tag, pinned, archive filters)",
    handler: listNotes,
  },
  {
    id: "notes.search",
    kind: "query",
    provider: "notes",
    title: "Search notes",
    description: "Search note titles, bodies, and tags",
    handler: searchNotes,
  },
  {
    id: "notes.get",
    kind: "query",
    provider: "notes",
    title: "Get note",
    description: "Get a note by id or title",
    handler: getNote,
  },
  {
    id: "notes.add",
    kind: "action",
    provider: "notes",
    title: "Add note",
    description: "Create a note (title, body, tags, notebook)",
    handler: addNote,
  },
];

module.exports = { CAPABILITIES };