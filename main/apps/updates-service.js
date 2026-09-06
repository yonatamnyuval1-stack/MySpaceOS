const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const CHECK_MS = 60 * 1000;

let watchTimer = null;
let watching = false;

function catalogPath() {
  return path.join(app.getAppPath(), "config", "updates.json");
}

function statePath() {
  return path.join(app.getPath("userData"), "updates-state.json");
}

function defaultState() {
  return {
    appliedIds: [],
    skippedIds: [],
    pendingApplyId: null,
    lastCheckedAt: null,
  };
}

function loadState() {
  try {
    const raw = JSON.parse(fs.readFileSync(statePath(), "utf8"));
    return {
      appliedIds: Array.isArray(raw?.appliedIds) ? raw.appliedIds.map(String) : [],
      skippedIds: Array.isArray(raw?.skippedIds) ? raw.skippedIds.map(String) : [],
      pendingApplyId: raw?.pendingApplyId ? String(raw.pendingApplyId) : null,
      lastCheckedAt: raw?.lastCheckedAt || null,
    };
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  const next = {
    appliedIds: [...new Set(state.appliedIds || [])].slice(-80),
    skippedIds: [...new Set(state.skippedIds || [])].slice(-80),
    pendingApplyId: state.pendingApplyId || null,
    lastCheckedAt: state.lastCheckedAt || null,
  };
  fs.mkdirSync(path.dirname(statePath()), { recursive: true });
  fs.writeFileSync(statePath(), JSON.stringify(next, null, 2), "utf8");
  return next;
}

function readCatalog() {
  try {
    const raw = JSON.parse(fs.readFileSync(catalogPath(), "utf8"));
    const list = Array.isArray(raw?.updates) ? raw.updates : [];
    return list
      .filter((u) => u && u.id && u.title)
      .map((u) => ({
        id: String(u.id),
        version: String(u.version || ""),
        major: u.major === true,
        title: String(u.title).slice(0, 120),
        body: String(u.body || "").slice(0, 1200),
        date: u.date || null,
      }));
  } catch (err) {
    if (err && err.code !== "ENOENT") {
      console.warn("updates catalog:", err.message || err);
    }
    return [];
  }
}
function pendingMajorUpdates(state = loadState()) {
  const applied = new Set(state.appliedIds || []);
  const skipped = new Set(state.skippedIds || []);
  const appVersion = app.getVersion?.() || "";
  return readCatalog().filter((u) => {
    if (!u.major) return false;
    if (applied.has(u.id) || skipped.has(u.id)) return false;
    if (appVersion && u.version && cmpVersion(u.version, appVersion) <= 0) return false;
    return true;
  });
}

function finalizePendingApply() {
  const state = loadState();
  if (!state.pendingApplyId) return null;
  const id = state.pendingApplyId;
  if (!state.appliedIds.includes(id)) state.appliedIds.push(id);
  state.pendingApplyId = null;
  saveState(state);

  const entry = readCatalog().find((u) => u.id === id);
  try {
    const { push } = require("./notifications-center");
    push(
      {
        appId: "system",
        type: "update-done",
        title: "My Space updated",
        body: entry?.title
          ? `Applied: ${entry.title.replace(/^Update ready — /i, "")}`
          : "Latest major update is now active.",
        dedupeKey: `update-done:${id}`,
        priority: "normal",
        route: { action: "none" },
      },
      { showOs: false }
    );
  } catch {
  }
  return id;
}

function notifyPending() {
  const state = loadState();
  state.lastCheckedAt = new Date().toISOString();
  saveState(state);

  const pending = pendingMajorUpdates(state);
  return { ok: true, pending: pending.length, updates: pending };
}

function applyAndRelaunch(updateId) {
  const id = String(updateId || "").trim();
  if (!id) return { ok: false, error: "Missing update id" };

  const state = loadState();
  state.pendingApplyId = id;
  if (!state.appliedIds.includes(id)) {
  }
  saveState(state);

  try {
    const { list, remove } = require("./notifications-center");
    const snap = list();
    for (const n of snap.items || []) {
      if (n.type === "system-update" && n.route?.updateId === id) {
        remove({ id: n.id });
      }
      if (n.dedupeKey === `system-update:${id}`) {
        remove({ id: n.id });
      }
    }
  } catch {
  }

  setImmediate(() => {
    try {
      app.relaunch();
    } catch (err) {
      console.error("relaunch failed:", err);
    }
    app.exit(0);
  });

  return { ok: true, relaunching: true, updateId: id };
}

function skipUpdate(updateId) {
  const id = String(updateId || "").trim();
  if (!id) return { ok: false, error: "Missing update id" };
  const state = loadState();
  if (!state.skippedIds.includes(id)) state.skippedIds.push(id);
  saveState(state);
  return { ok: true, skipped: id };
}

function versionParts(v) {
  return String(v || "")
    .replace(/^v/i, "")
    .split(/[.-]/)
    .map((n) => {
      const x = parseInt(n, 10);
      return Number.isFinite(x) ? x : 0;
    });
}

function cmpVersion(a, b) {
  const aa = versionParts(a);
  const bb = versionParts(b);
  const len = Math.max(aa.length, bb.length);
  for (let i = 0; i < len; i++) {
    const d = (aa[i] || 0) - (bb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

function findCurrentRelease(appVersion = app.getVersion?.() || "") {
  const catalog = readCatalog();
  const ver = String(appVersion || "").trim();
  if (!ver) {
    return {
      version: "",
      title: "My Space",
      body: "Installed build of My Space.",
      date: null,
      id: null,
      exact: false,
    };
  }

  const exact = catalog.filter((u) => u.version === ver);
  const pick =
    exact[exact.length - 1] ||
    catalog
      .filter((u) => u.version && cmpVersion(u.version, ver) <= 0)
      .sort((a, b) => cmpVersion(a.version, b.version))
      .pop() ||
    null;

  if (!pick) {
    return {
      version: ver,
      title: `My Space ${ver}`,
      body: "You're running this build of My Space.",
      date: null,
      id: null,
      exact: false,
    };
  }

  return {
    id: pick.id,
    version: ver,
    catalogVersion: pick.version,
    title: String(pick.title || "").replace(/^Update ready\s*[—–-]\s*/i, "").trim() || `My Space ${ver}`,
    body: pick.body || "You're running this build of My Space.",
    date: pick.date || null,
    major: pick.major === true,
    exact: pick.version === ver,
  };
}

function listUpdates(args = {}) {
  const state = loadState();
  const applied = new Set(state.appliedIds || []);
  const skipped = new Set(state.skippedIds || []);
  const filter = String(args.filter || args.status || "all").toLowerCase();
  const q = String(args.q || args.query || "")
    .trim()
    .toLowerCase();
  const appVersion = app.getVersion?.() || "";

  let rows = readCatalog().map((u) => {
    let status = "available";
    if (applied.has(u.id)) {
      status = "applied";
    } else if (skipped.has(u.id)) {
      status = "skipped";
    } else if (appVersion && u.version && cmpVersion(u.version, appVersion) <= 0) {
      status = "applied";
    } else if (u.major) {
      status = "pending";
    }
    return {
      ...u,
      status,
      pendingApply: state.pendingApplyId === u.id,
    };
  });

  rows = [...rows].reverse();

  if (filter === "pending") rows = rows.filter((u) => u.status === "pending");
  else if (filter === "applied") rows = rows.filter((u) => u.status === "applied");
  else if (filter === "skipped") rows = rows.filter((u) => u.status === "skipped");

  if (q) {
    rows = rows.filter((u) =>
      `${u.id} ${u.version} ${u.title} ${u.body}`.toLowerCase().includes(q)
    );
  }

  const catalog = readCatalog();
  const classified = catalog.map((u) => {
    if (applied.has(u.id) || (appVersion && u.version && cmpVersion(u.version, appVersion) <= 0)) {
      return "applied";
    }
    if (skipped.has(u.id)) return "skipped";
    if (u.major) return "pending";
    return "available";
  });

  const current = findCurrentRelease(appVersion);

  return {
    ok: true,
    updates: rows,
    pending: rows.filter((u) => u.status === "pending"),
    current,
    counts: {
      all: catalog.length,
      pending: classified.filter((s) => s === "pending").length,
      applied: classified.filter((s) => s === "applied").length,
      skipped: (state.skippedIds || []).length,
    },
    lastCheckedAt: state.lastCheckedAt,
    pendingApplyId: state.pendingApplyId,
    catalogPath: catalogPath(),
    appVersion,
  };
}

function status() {
  const state = loadState();
  const listed = listUpdates({ filter: "all" });
  const appVersion = app.getVersion?.() || "";
  return {
    ok: true,
    pending: pendingMajorUpdates(state),
    current: findCurrentRelease(appVersion),
    appliedIds: state.appliedIds,
    skippedIds: state.skippedIds,
    pendingApplyId: state.pendingApplyId,
    lastCheckedAt: state.lastCheckedAt,
    catalogPath: catalogPath(),
    counts: listed.counts,
    appVersion,
  };
}

async function handleUpdatesInvoke(channel, args = {}) {
  switch (channel) {
    case "status":
      return status();
    case "list":
      return listUpdates(args || {});
    case "check":
      return notifyPending();
    case "apply":
      return applyAndRelaunch(args?.updateId || args?.id);
    case "skip":
      return skipUpdate(args?.updateId || args?.id);
    default:
      return { ok: false, error: `Unknown updates channel: ${channel}` };
  }
}

function startUpdatesService() {
  finalizePendingApply();
  notifyPending();

  if (watchTimer) return;
  watchTimer = setInterval(() => {
    try {
      notifyPending();
    } catch (err) {
      console.warn("updates check:", err?.message || err);
    }
  }, CHECK_MS);

  if (!watching) {
    watching = true;
    try {
      fs.watch(catalogPath(), { persistent: false }, () => {
        setTimeout(() => {
          try {
            notifyPending();
          } catch {
          }
        }, 400);
      });
    } catch {
    }
  }
}

module.exports = {
  startUpdatesService,
  handleUpdatesInvoke,
  applyAndRelaunch,
  notifyPending,
  status,
  listUpdates,
  findCurrentRelease,
};