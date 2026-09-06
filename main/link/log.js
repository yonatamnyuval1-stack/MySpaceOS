const MAX_ENTRIES = 200;

/** @type {Array<object>} */
const entries = [];

function append(entry) {
  const row = {
    id: `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    ...entry,
  };
  entries.unshift(row);
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  return row;
}

function list(args = {}) {
  const limit = Math.min(100, Math.max(1, parseInt(args.limit, 10) || 50));
  const kind = args.kind ? String(args.kind) : "";
  const topic = args.topic ? String(args.topic).toLowerCase() : "";
  let rows = entries;
  if (kind) rows = rows.filter((r) => r.kind === kind);
  if (topic) rows = rows.filter((r) => String(r.topic || r.route || "").toLowerCase().includes(topic));
  return { ok: true, entries: rows.slice(0, limit), total: entries.length };
}

function clear() {
  entries.length = 0;
  return { ok: true };
}

function snapshot() {
  const byKind = {};
  for (const row of entries) {
    byKind[row.kind] = (byKind[row.kind] || 0) + 1;
  }
  return { ok: true, total: entries.length, byKind };
}

module.exports = { append, list, clear, snapshot };