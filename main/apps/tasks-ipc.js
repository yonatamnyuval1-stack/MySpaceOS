const {
  setupLocalAuthApp,
  requireSignedIn,
  userStorageRoot,
  registerLegacyMigrator,
  registerSingleFileMigrator,
} = require("./local-auth-app-helper");

const APP_ID = "tasks";
const auth = setupLocalAuthApp(APP_ID);
registerSingleFileMigrator(APP_ID, "tasks.json");

const DATA_FILE = () => auth.userDataPath("data.json");

function signedInGuard() {
  return requireSignedIn(auth);
}


const path = require("path");
const { app } = require("electron");
const { loadJsonFile, saveJsonFile } = require("./safe-json-store");
const { reportLoadFailure, reportSaveFailure } = require("../resolve/report-helper");


const INBOX_LIST_ID = "list_inbox";
const BUCKETS = new Set(["inbox", "next", "waiting", "someday"]);
const STATUSES = new Set(["active", "done", "cancelled"]);
const PRIORITIES = new Set([0, 1, 2, 3]);

function uid(prefix = "task") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeTag(t) {
  return String(t || "")
    .trim()
    .replace(/^#/, "")
    .toLowerCase()
    .slice(0, 40);
}

function normalizeDueDate(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const lower = s.toLowerCase();
  if (lower === "today") return todayISO();
  if (lower === "tomorrow") {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return null;
}

function defaultState() {
  const at = nowIso();
  return {
    projects: [],
    lists: [
      {
        id: INBOX_LIST_ID,
        name: "Inbox",
        projectId: null,
        system: true,
        createdAt: at,
      },
    ],
    items: [],
    settings: {
      defaultBucket: "inbox",
      showCompletedInLists: false,
    },
  };
}

function normalizeChecklistItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const text = String(raw.text || "").trim().slice(0, 200);
  if (!text) return null;
  return {
    id: String(raw.id || uid("chk")),
    text,
    done: Boolean(raw.done),
  };
}

function normalizeProject(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = String(raw.name || "").trim().slice(0, 80);
  if (!name) return null;
  return {
    id: String(raw.id || uid("proj")),
    name,
    color: String(raw.color || "#64b5f6").slice(0, 20),
    icon: String(raw.icon || "◆").slice(0, 8),
    notes: String(raw.notes || "").slice(0, 4000),
    archived: Boolean(raw.archived),
    createdAt: raw.createdAt || nowIso(),
    updatedAt: raw.updatedAt || raw.createdAt || nowIso(),
  };
}

function normalizeList(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = String(raw.name || "").trim().slice(0, 80);
  if (!name) return null;
  return {
    id: String(raw.id || uid("list")),
    name,
    projectId: raw.projectId ? String(raw.projectId) : null,
    system: Boolean(raw.system),
    createdAt: raw.createdAt || nowIso(),
  };
}

function normalizeItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const title = String(raw.title || "").trim().slice(0, 240);
  if (!title) return null;

  let status = String(raw.status || "active").toLowerCase();
  if (!STATUSES.has(status)) status = "active";

  let bucket = String(raw.bucket || "inbox").toLowerCase();
  if (!BUCKETS.has(bucket)) bucket = "inbox";
  if (status === "done" || status === "cancelled") {
    /* keep bucket for restore */
  }

  let priority = Number(raw.priority);
  if (!PRIORITIES.has(priority)) priority = 0;

  const tags = Array.isArray(raw.tags)
    ? [...new Set(raw.tags.map(normalizeTag).filter(Boolean))].slice(0, 20)
    : [];

  const checklist = Array.isArray(raw.checklist)
    ? raw.checklist.map(normalizeChecklistItem).filter(Boolean).slice(0, 80)
    : [];

  return {
    id: String(raw.id || uid("task")),
    title,
    notes: String(raw.notes || "").slice(0, 12000),
    projectId: raw.projectId ? String(raw.projectId) : null,
    listId: raw.listId ? String(raw.listId) : INBOX_LIST_ID,
    status,
    bucket,
    priority,
    dueDate: normalizeDueDate(raw.dueDate),
    tags,
    checklist,
    waitingOn: String(raw.waitingOn || "").trim().slice(0, 120),
    flagged: Boolean(raw.flagged),
    sortOrder: Number.isFinite(Number(raw.sortOrder)) ? Number(raw.sortOrder) : Date.now(),
    createdAt: raw.createdAt || nowIso(),
    updatedAt: raw.updatedAt || raw.createdAt || nowIso(),
    completedAt: raw.completedAt || null,
  };
}

function normalizeState(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;

  const projects = Array.isArray(raw.projects)
    ? raw.projects.map(normalizeProject).filter(Boolean).slice(0, 200)
    : [];

  let lists = Array.isArray(raw.lists)
    ? raw.lists.map(normalizeList).filter(Boolean).slice(0, 400)
    : [];
  if (!lists.some((l) => l.id === INBOX_LIST_ID)) {
    lists.unshift(base.lists[0]);
  }
  if (!lists.length) lists = base.lists;

  const items = Array.isArray(raw.items)
    ? raw.items.map(normalizeItem).filter(Boolean).slice(0, 5000)
    : [];

  return {
    projects,
    lists,
    items,
    settings: {
      defaultBucket: BUCKETS.has(raw?.settings?.defaultBucket)
        ? raw.settings.defaultBucket
        : "inbox",
      showCompletedInLists: Boolean(raw?.settings?.showCompletedInLists),
    },
  };
}

function loadState() {
  const loaded = loadJsonFile(DATA_FILE(), { fallback: null });
  if (!loaded.ok) {
    console.error("tasks load:", loaded.error);
    reportLoadFailure("tasks", loaded);
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
    listKey: "items",
    allowEmpty,
  });
  if (!result.ok) {
    reportSaveFailure("tasks", result);
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

function sortItems(a, b) {
  if (a.flagged !== b.flagged) return a.flagged ? -1 : 1;
  if (a.priority !== b.priority) return b.priority - a.priority;
  const da = a.dueDate || "9999-99-99";
  const db = b.dueDate || "9999-99-99";
  if (da !== db) return da.localeCompare(db);
  return Number(a.sortOrder) - Number(b.sortOrder);
}

function matchByRef(list, ref, nameKey = "title") {
  const q = String(ref || "").trim();
  if (!q) return { error: "Missing id or name" };
  const lower = q.toLowerCase();
  const byId = list.find((x) => x.id === q || x.id.toLowerCase() === lower);
  if (byId) return { item: byId };
  const exact = list.filter((x) => String(x[nameKey] || "").toLowerCase() === lower);
  if (exact.length === 1) return { item: exact[0] };
  if (exact.length > 1) {
    return {
      error: `Ambiguous — match one of: ${exact
        .slice(0, 5)
        .map((x) => x[nameKey])
        .join(" · ")}`,
    };
  }
  const starts = list.filter((x) => String(x[nameKey] || "").toLowerCase().startsWith(lower));
  if (starts.length === 1) return { item: starts[0] };
  const includes = list.filter((x) => String(x[nameKey] || "").toLowerCase().includes(lower));
  if (includes.length === 1) return { item: includes[0] };
  if (includes.length > 1 || starts.length > 1) {
    const amb = (starts.length > 1 ? starts : includes).slice(0, 5);
    return {
      error: `Ambiguous — match one of: ${amb.map((x) => x[nameKey]).join(" · ")}`,
    };
  }
  return { error: `Not found: ${q}` };
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

function parseCaptureLine(rawLine) {
  let line = String(rawLine || "").trim();
  let dueDate = null;
  let priority = 0;
  let bucket = null;
  let projectHint = null;

  const dueMatch = line.match(/\bdue:(\S+)/i);
  if (dueMatch) {
    dueDate = normalizeDueDate(dueMatch[1]);
    line = line.replace(dueMatch[0], " ").trim();
  }
  if (/\btoday\b/i.test(line) && !dueDate) {
    dueDate = todayISO();
    line = line.replace(/\btoday\b/i, " ").trim();
  }
  if (/\btomorrow\b/i.test(line) && !dueDate) {
    dueDate = normalizeDueDate("tomorrow");
    line = line.replace(/\btomorrow\b/i, " ").trim();
  }

  if (/\b!!!|\bp3\b/i.test(line)) {
    priority = 3;
    line = line.replace(/\b!!!|\bp3\b/gi, " ").trim();
  } else if (/\b!!|\bp2\b/i.test(line)) {
    priority = 2;
    line = line.replace(/\b!!|\bp2\b/gi, " ").trim();
  } else if (/\b!|\bp1\b/i.test(line)) {
    priority = 1;
    line = line.replace(/\b!|\bp1\b/gi, " ").trim();
  }

  const bucketMatch = line.match(/\b@(inbox|next|waiting|someday)\b/i);
  if (bucketMatch) {
    bucket = bucketMatch[1].toLowerCase();
    line = line.replace(bucketMatch[0], " ").trim();
  }

  const projMatch = line.match(/\+([A-Za-z0-9_\u0590-\u05FF-]{1,40})/);
  if (projMatch) {
    projectHint = projMatch[1];
    line = line.replace(projMatch[0], " ").trim();
  }

  const tags = parseTagsFromText(line);
  line = stripHashTags(line);

  let title = line;
  let notes = "";
  const pipe = line.split("|").map((s) => s.trim());
  if (pipe.length >= 2) {
    title = pipe[0];
    notes = pipe.slice(1).join(" | ");
  }

  return { title, notes, dueDate, priority, bucket, projectHint, tags };
}

function countsFor(data) {
  const today = todayISO();
  const active = data.items.filter((i) => i.status === "active");
  return {
    inbox: active.filter((i) => i.bucket === "inbox").length,
    next: active.filter((i) => i.bucket === "next").length,
    waiting: active.filter((i) => i.bucket === "waiting").length,
    someday: active.filter((i) => i.bucket === "someday").length,
    today: active.filter((i) => i.dueDate && i.dueDate <= today).length,
    upcoming: active.filter((i) => i.dueDate && i.dueDate > today).length,
    flagged: active.filter((i) => i.flagged).length,
    done: data.items.filter((i) => i.status === "done").length,
    all: active.length,
    projects: data.projects.filter((p) => !p.archived).length,
  };
}

function filterItems(data, opts = {}) {
  let list = data.items.slice();
  const view = String(opts.view || "all").toLowerCase();
  const today = todayISO();
  const includeDone = opts.includeDone === true || data.settings.showCompletedInLists;

  if (opts.status) {
    list = list.filter((i) => i.status === opts.status);
  } else if (view === "done") {
    list = list.filter((i) => i.status === "done");
  } else if (view === "cancelled") {
    list = list.filter((i) => i.status === "cancelled");
  } else if (!includeDone && view !== "all-with-done") {
    list = list.filter((i) => i.status === "active");
  }

  if (view === "inbox") list = list.filter((i) => i.bucket === "inbox" && i.status === "active");
  else if (view === "next") list = list.filter((i) => i.bucket === "next" && i.status === "active");
  else if (view === "waiting") list = list.filter((i) => i.bucket === "waiting" && i.status === "active");
  else if (view === "someday") list = list.filter((i) => i.bucket === "someday" && i.status === "active");
  else if (view === "today") {
    list = list.filter((i) => i.status === "active" && i.dueDate && i.dueDate <= today);
  } else if (view === "upcoming") {
    list = list.filter((i) => i.status === "active" && i.dueDate && i.dueDate > today);
  } else if (view === "flagged") {
    list = list.filter((i) => i.status === "active" && i.flagged);
  } else if (view === "all" || view === "home") {
    /* already filtered to active unless includeDone */
  }

  if (opts.projectId) list = list.filter((i) => i.projectId === opts.projectId);
  if (opts.listId) list = list.filter((i) => i.listId === opts.listId);
  if (opts.bucket) list = list.filter((i) => i.bucket === opts.bucket);
  if (opts.flagged === true) list = list.filter((i) => i.flagged);
  if (opts.tag) {
    const tag = normalizeTag(opts.tag);
    list = list.filter((i) => (i.tags || []).includes(tag));
  }
  if (opts.q) {
    const q = String(opts.q).toLowerCase().trim();
    list = list.filter((i) => {
      const blob = [i.title, i.notes, i.waitingOn, ...(i.tags || [])].join(" ").toLowerCase();
      return blob.includes(q);
    });
  }

  return list.sort(sortItems);
}

function snapshotResult(data) {
  return {
    ok: true,
    projects: data.projects,
    lists: data.lists,
    items: data.items,
    settings: data.settings,
    counts: countsFor(data),
  };
}

function resolveProjectHint(data, hint) {
  if (!hint) return null;
  const hit = matchByRef(data.projects.filter((p) => !p.archived), hint, "name");
  return hit.item || null;
}

async function handleTasksInvoke(channel, args = {}) {
  return withLock(() => handleTasksInvokeUnlocked(channel, args));
}

async function handleTasksInvokeUnlocked(channel, args = {}) {
  const authErr = signedInGuard();
  if (authErr) return authErr;

  const ch = String(channel || "");

  if (ch === "storage.load" || ch === "snapshot") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    return { ...snapshotResult(loaded.data), warning: loaded.warning };
  }

  if (ch === "storage.save") {
    return saveState(args?.data ?? args);
  }

  if (ch === "meta") {
    return {
      ok: true,
      name: "Tasks",
      version: "1.0.0",
      today: todayISO(),
      buckets: [...BUCKETS],
      inboxListId: INBOX_LIST_ID,
    };
  }

  if (ch === "items.list") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    const items = filterItems(loaded.data, args || {});
    return {
      ok: true,
      items,
      counts: countsFor(loaded.data),
      projects: loaded.data.projects,
      lists: loaded.data.lists,
      settings: loaded.data.settings,
    };
  }

  if (ch === "items.search") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    const q = String(args?.q || args?.query || "").trim();
    if (!q) return { ok: false, error: "Query required" };
    const items = filterItems(loaded.data, {
      q,
      includeDone: true,
      view: "all-with-done",
    });
    return { ok: true, items, q };
  }

  if (ch === "item.get") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    const ref = args?.id || args?.title || args?.ref;
    const hit = matchByRef(loaded.data.items, ref, "title");
    if (hit.error) return { ok: false, error: hit.error };
    return { ok: true, item: hit.item };
  }

  if (ch === "item.add") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;

    let title = String(args?.title || "").trim();
    let notes = String(args?.notes || "");
    let dueDate = normalizeDueDate(args?.dueDate);
    let priority = Number(args?.priority);
    if (!PRIORITIES.has(priority)) priority = 0;
    let bucket = String(args?.bucket || "").toLowerCase();
    let tags = Array.isArray(args?.tags) ? args.tags.map(normalizeTag).filter(Boolean) : [];
    let projectId = args?.projectId ? String(args.projectId) : null;
    let listId = args?.listId ? String(args.listId) : null;

    const rawLine = String(args?.text || args?.line || "").trim();
    if (rawLine && !title) {
      const parsed = parseCaptureLine(rawLine);
      title = parsed.title;
      notes = notes || parsed.notes;
      dueDate = dueDate || parsed.dueDate;
      if (!args?.priority && parsed.priority) priority = parsed.priority;
      if (!bucket && parsed.bucket) bucket = parsed.bucket;
      tags = [...new Set([...tags, ...parsed.tags])];
      if (!projectId && parsed.projectHint) {
        const proj = resolveProjectHint(loaded.data, parsed.projectHint);
        if (proj) projectId = proj.id;
      }
    }

    if (!title) return { ok: false, error: "Title is required" };
    if (!BUCKETS.has(bucket)) {
      bucket = projectId ? "next" : loaded.data.settings.defaultBucket || "inbox";
    }
    if (!listId) listId = INBOX_LIST_ID;
    if (listId !== INBOX_LIST_ID && !loaded.data.lists.some((l) => l.id === listId)) {
      listId = INBOX_LIST_ID;
    }
    if (projectId && !loaded.data.projects.some((p) => p.id === projectId)) {
      projectId = null;
    }

    const item = normalizeItem({
      title,
      notes,
      projectId,
      listId,
      status: "active",
      bucket,
      priority,
      dueDate,
      tags,
      flagged: Boolean(args?.flagged),
      waitingOn: args?.waitingOn,
      checklist: args?.checklist,
      sortOrder: Date.now(),
    });

    loaded.data.items.unshift(item);
    const saved = saveState(loaded.data);
    if (!saved.ok) return saved;
    return { ok: true, item, counts: countsFor(saved.data) };
  }

  if (ch === "item.update") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    const ref = args?.id || args?.ref;
    const hit = matchByRef(loaded.data.items, ref, "title");
    if (hit.error) return { ok: false, error: hit.error };
    const idx = loaded.data.items.findIndex((i) => i.id === hit.item.id);
    const prev = loaded.data.items[idx];
    const next = { ...prev };

    if (args?.title != null) next.title = String(args.title).trim().slice(0, 240) || prev.title;
    if (args?.notes != null) next.notes = String(args.notes).slice(0, 12000);
    if (args?.projectId !== undefined) {
      next.projectId = args.projectId ? String(args.projectId) : null;
    }
    if (args?.listId != null) next.listId = String(args.listId);
    if (args?.bucket != null && BUCKETS.has(String(args.bucket).toLowerCase())) {
      next.bucket = String(args.bucket).toLowerCase();
    }
    if (args?.priority != null && PRIORITIES.has(Number(args.priority))) {
      next.priority = Number(args.priority);
    }
    if (args?.dueDate !== undefined) next.dueDate = normalizeDueDate(args.dueDate);
    if (args?.tags != null) {
      next.tags = [...new Set((args.tags || []).map(normalizeTag).filter(Boolean))].slice(0, 20);
    }
    if (args?.waitingOn != null) next.waitingOn = String(args.waitingOn).trim().slice(0, 120);
    if (args?.flagged != null) next.flagged = Boolean(args.flagged);
    if (args?.checklist != null) {
      next.checklist = (args.checklist || []).map(normalizeChecklistItem).filter(Boolean).slice(0, 80);
    }
    if (args?.status != null && STATUSES.has(String(args.status).toLowerCase())) {
      const st = String(args.status).toLowerCase();
      next.status = st;
      if (st === "done" && prev.status !== "done") next.completedAt = nowIso();
      if (st === "active") next.completedAt = null;
    }

    next.updatedAt = nowIso();
    const normalized = normalizeItem(next);
    if (!normalized) return { ok: false, error: "Invalid task" };
    loaded.data.items[idx] = normalized;
    const saved = saveState(loaded.data);
    if (!saved.ok) return saved;
    return { ok: true, item: normalized, counts: countsFor(saved.data) };
  }

  if (ch === "item.toggle" || ch === "item.complete") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    const ref = args?.id || args?.ref;
    const hit = matchByRef(loaded.data.items, ref, "title");
    if (hit.error) return { ok: false, error: hit.error };
    const idx = loaded.data.items.findIndex((i) => i.id === hit.item.id);
    const prev = loaded.data.items[idx];
    const forceDone = args?.done === true || ch === "item.complete";
    const forceOpen = args?.done === false;
    let status = prev.status;
    if (forceDone) status = "done";
    else if (forceOpen) status = "active";
    else status = prev.status === "done" ? "active" : "done";

    const normalized = normalizeItem({
      ...prev,
      status,
      completedAt: status === "done" ? nowIso() : null,
      updatedAt: nowIso(),
    });
    if (!normalized) return { ok: false, error: "Invalid task" };
    loaded.data.items[idx] = normalized;
    const saved = saveState(loaded.data);
    if (!saved.ok) return saved;
    return { ok: true, item: saved.data.items[idx], counts: countsFor(saved.data) };
  }

  if (ch === "item.delete") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    const ref = args?.id || args?.ref;
    const hit = matchByRef(loaded.data.items, ref, "title");
    if (hit.error) return { ok: false, error: hit.error };
    loaded.data.items = loaded.data.items.filter((i) => i.id !== hit.item.id);
    const saved = saveState(loaded.data, { allowEmpty: true });
    if (!saved.ok) return saved;
    return { ok: true, deletedId: hit.item.id, counts: countsFor(saved.data) };
  }

  if (ch === "item.pin" || ch === "item.flag") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    const ref = args?.id || args?.ref;
    const hit = matchByRef(loaded.data.items, ref, "title");
    if (hit.error) return { ok: false, error: hit.error };
    const idx = loaded.data.items.findIndex((i) => i.id === hit.item.id);
    const flagged = args?.flagged != null ? Boolean(args.flagged) : !hit.item.flagged;
    loaded.data.items[idx] = normalizeItem({
      ...hit.item,
      flagged,
      updatedAt: nowIso(),
    });
    const saved = saveState(loaded.data);
    if (!saved.ok) return saved;
    return { ok: true, item: saved.data.items[idx], counts: countsFor(saved.data) };
  }

  if (ch === "item.move") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    const ref = args?.id || args?.ref;
    const hit = matchByRef(loaded.data.items, ref, "title");
    if (hit.error) return { ok: false, error: hit.error };
    const idx = loaded.data.items.findIndex((i) => i.id === hit.item.id);
    const next = { ...hit.item };
    if (args?.bucket && BUCKETS.has(String(args.bucket).toLowerCase())) {
      next.bucket = String(args.bucket).toLowerCase();
    }
    if (args?.projectId !== undefined) {
      next.projectId = args.projectId ? String(args.projectId) : null;
    }
    if (args?.listId) next.listId = String(args.listId);
    next.updatedAt = nowIso();
    loaded.data.items[idx] = normalizeItem(next);
    const saved = saveState(loaded.data);
    if (!saved.ok) return saved;
    return { ok: true, item: saved.data.items[idx], counts: countsFor(saved.data) };
  }

  if (ch === "item.checklist.add") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    const ref = args?.id || args?.ref;
    const hit = matchByRef(loaded.data.items, ref, "title");
    if (hit.error) return { ok: false, error: hit.error };
    const text = String(args?.text || args?.title || "").trim();
    if (!text) return { ok: false, error: "Checklist text required" };
    const idx = loaded.data.items.findIndex((i) => i.id === hit.item.id);
    const chk = normalizeChecklistItem({ text });
    const checklist = [...(hit.item.checklist || []), chk].slice(0, 80);
    loaded.data.items[idx] = normalizeItem({
      ...hit.item,
      checklist,
      updatedAt: nowIso(),
    });
    const saved = saveState(loaded.data);
    if (!saved.ok) return saved;
    return { ok: true, item: saved.data.items[idx], checklistItem: chk };
  }

  if (ch === "item.checklist.toggle") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    const ref = args?.id || args?.ref;
    const hit = matchByRef(loaded.data.items, ref, "title");
    if (hit.error) return { ok: false, error: hit.error };
    const chkId = String(args?.checklistId || args?.checkId || "");
    const idx = loaded.data.items.findIndex((i) => i.id === hit.item.id);
    const checklist = (hit.item.checklist || []).map((c) =>
      c.id === chkId ? { ...c, done: args?.done != null ? Boolean(args.done) : !c.done } : c
    );
    loaded.data.items[idx] = normalizeItem({
      ...hit.item,
      checklist,
      updatedAt: nowIso(),
    });
    const saved = saveState(loaded.data);
    if (!saved.ok) return saved;
    return { ok: true, item: saved.data.items[idx] };
  }

  if (ch === "item.checklist.delete") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    const ref = args?.id || args?.ref;
    const hit = matchByRef(loaded.data.items, ref, "title");
    if (hit.error) return { ok: false, error: hit.error };
    const chkId = String(args?.checklistId || args?.checkId || "");
    const idx = loaded.data.items.findIndex((i) => i.id === hit.item.id);
    loaded.data.items[idx] = normalizeItem({
      ...hit.item,
      checklist: (hit.item.checklist || []).filter((c) => c.id !== chkId),
      updatedAt: nowIso(),
    });
    const saved = saveState(loaded.data);
    if (!saved.ok) return saved;
    return { ok: true, item: saved.data.items[idx] };
  }

  if (ch === "item.scheduleToday") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    const ref = args?.id || args?.ref;
    const hit = matchByRef(loaded.data.items, ref, "title");
    if (hit.error) return { ok: false, error: hit.error };

    const { handleDayPlannerInvoke } = require("./day-planner-ipc");
    const added = await handleDayPlannerInvoke("task.add", {
      title: hit.item.title,
      notes: hit.item.notes || `From Tasks · ${hit.item.id}`,
      dueDate: todayISO(),
      dueTime: args?.dueTime || args?.time || null,
      notify: args?.notify !== false,
      priority: hit.item.priority >= 2 ? "high" : hit.item.priority === 1 ? "medium" : "low",
    });
    if (!added?.ok) {
      return { ok: false, error: added?.error || "Could not add to Today" };
    }

    const idx = loaded.data.items.findIndex((i) => i.id === hit.item.id);
    loaded.data.items[idx] = normalizeItem({
      ...hit.item,
      dueDate: todayISO(),
      bucket: hit.item.bucket === "inbox" ? "next" : hit.item.bucket,
      updatedAt: nowIso(),
    });
    const saved = saveState(loaded.data);
    if (!saved.ok) return saved;
    return {
      ok: true,
      item: saved.data.items[idx],
      todayTask: added.task,
      counts: countsFor(saved.data),
    };
  }

  if (ch === "items.clearDone") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    const before = loaded.data.items.length;
    loaded.data.items = loaded.data.items.filter((i) => i.status !== "done");
    const saved = saveState(loaded.data, { allowEmpty: true });
    if (!saved.ok) return saved;
    return {
      ok: true,
      removed: before - saved.data.items.length,
      counts: countsFor(saved.data),
    };
  }

  if (ch === "projects.list") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    const includeArchived = args?.includeArchived === true;
    const projects = includeArchived
      ? loaded.data.projects
      : loaded.data.projects.filter((p) => !p.archived);
    return { ok: true, projects, lists: loaded.data.lists };
  }

  if (ch === "project.add") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    const project = normalizeProject({
      name: args?.name || args?.title,
      color: args?.color,
      icon: args?.icon,
      notes: args?.notes,
    });
    if (!project) return { ok: false, error: "Project name required" };
    loaded.data.projects.push(project);
    if (args?.list !== false) {
      const list = normalizeList({
        name: "General",
        projectId: project.id,
      });
      loaded.data.lists.push(list);
    }
    const saved = saveState(loaded.data);
    if (!saved.ok) return saved;
    return { ok: true, project, lists: saved.data.lists.filter((l) => l.projectId === project.id) };
  }

  if (ch === "project.update") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    const ref = args?.id || args?.ref || args?.name;
    const hit = matchByRef(loaded.data.projects, ref, "name");
    if (hit.error) return { ok: false, error: hit.error };
    const idx = loaded.data.projects.findIndex((p) => p.id === hit.item.id);
    const next = { ...hit.item };
    if (args?.name != null) next.name = String(args.name).trim().slice(0, 80) || next.name;
    if (args?.color != null) next.color = String(args.color).slice(0, 20);
    if (args?.icon != null) next.icon = String(args.icon).slice(0, 8);
    if (args?.notes != null) next.notes = String(args.notes).slice(0, 4000);
    if (args?.archived != null) next.archived = Boolean(args.archived);
    next.updatedAt = nowIso();
    loaded.data.projects[idx] = normalizeProject(next);
    const saved = saveState(loaded.data);
    if (!saved.ok) return saved;
    return { ok: true, project: saved.data.projects[idx] };
  }

  if (ch === "project.delete") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    const ref = args?.id || args?.ref;
    const hit = matchByRef(loaded.data.projects, ref, "name");
    if (hit.error) return { ok: false, error: hit.error };
    const id = hit.item.id;
    loaded.data.projects = loaded.data.projects.filter((p) => p.id !== id);
    loaded.data.lists = loaded.data.lists.filter((l) => l.projectId !== id);
    loaded.data.items = loaded.data.items.map((i) =>
      i.projectId === id
        ? { ...i, projectId: null, listId: INBOX_LIST_ID, updatedAt: nowIso() }
        : i
    );
    const saved = saveState(loaded.data, { allowEmpty: true });
    if (!saved.ok) return saved;
    return { ok: true, deletedId: id, counts: countsFor(saved.data) };
  }

  if (ch === "lists.list") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    let lists = loaded.data.lists.slice();
    if (args?.projectId) lists = lists.filter((l) => l.projectId === args.projectId);
    return { ok: true, lists };
  }

  if (ch === "list.add") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    const list = normalizeList({
      name: args?.name || args?.title,
      projectId: args?.projectId || null,
    });
    if (!list) return { ok: false, error: "List name required" };
    if (list.projectId && !loaded.data.projects.some((p) => p.id === list.projectId)) {
      return { ok: false, error: "Project not found" };
    }
    loaded.data.lists.push(list);
    const saved = saveState(loaded.data);
    if (!saved.ok) return saved;
    return { ok: true, list };
  }

  if (ch === "list.update") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    const ref = args?.id || args?.ref;
    const hit = matchByRef(loaded.data.lists, ref, "name");
    if (hit.error) return { ok: false, error: hit.error };
    if (hit.item.system || hit.item.id === INBOX_LIST_ID) {
      return { ok: false, error: "Cannot rename system Inbox" };
    }
    const idx = loaded.data.lists.findIndex((l) => l.id === hit.item.id);
    const next = { ...hit.item };
    if (args?.name != null) next.name = String(args.name).trim().slice(0, 80) || next.name;
    if (args?.projectId !== undefined) {
      next.projectId = args.projectId ? String(args.projectId) : null;
    }
    loaded.data.lists[idx] = normalizeList(next);
    const saved = saveState(loaded.data);
    if (!saved.ok) return saved;
    return { ok: true, list: saved.data.lists[idx] };
  }

  if (ch === "list.delete") {
    const loaded = ensurePersisted();
    if (!loaded.ok) return loaded;
    const ref = args?.id || args?.ref;
    const hit = matchByRef(loaded.data.lists, ref, "name");
    if (hit.error) return { ok: false, error: hit.error };
    if (hit.item.system || hit.item.id === INBOX_LIST_ID) {
      return { ok: false, error: "Cannot delete system Inbox" };
    }
    const id = hit.item.id;
    loaded.data.lists = loaded.data.lists.filter((l) => l.id !== id);
    loaded.data.items = loaded.data.items.map((i) =>
      i.listId === id ? { ...i, listId: INBOX_LIST_ID, updatedAt: nowIso() } : i
    );
    const saved = saveState(loaded.data, { allowEmpty: true });
    if (!saved.ok) return saved;
    return { ok: true, deletedId: id };
  }

  return { ok: false, error: `Unknown tasks channel: ${ch}` };
}

module.exports = {
  handleTasksInvoke,
  loadState,
  INBOX_LIST_ID,
  todayISO,
};
