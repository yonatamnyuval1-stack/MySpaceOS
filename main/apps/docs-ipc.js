const { app } = require("electron");
const fs = require("fs");
const path = require("path");

const {
  setupLocalAuthApp,
  requireSignedIn,
  userStorageRoot,
  registerLegacyMigrator,
  registerSingleFileMigrator,
} = require("./local-auth-app-helper");

const APP_ID = "docs";
const auth = setupLocalAuthApp(APP_ID);
registerSingleFileMigrator(APP_ID, "docs.json");

const DATA_FILE = () => auth.userDataPath("data.json");

function signedInGuard() {
  return requireSignedIn(auth);
}


function dataPath() {
  return path.join(app.getPath("userData"), "docs.json");
}

function defaultData() {
  return {
    bookmarks: [],
    lastPageId: "overview",
    recent: [],
    settings: {},
  };
}

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(dataPath(), "utf8"));
    return {
      ...defaultData(),
      ...raw,
      bookmarks: Array.isArray(raw?.bookmarks) ? raw.bookmarks : [],
      recent: Array.isArray(raw?.recent) ? raw.recent.slice(0, 20) : [],
    };
  } catch {
    return defaultData();
  }
}

function save(data) {
  fs.mkdirSync(path.dirname(dataPath()), { recursive: true });
  fs.writeFileSync(dataPath(), JSON.stringify(data, null, 2), "utf8");
  return data;
}

async function handleDocsInvoke(channel, args = {}) {
  const authErr = signedInGuard();
  if (authErr) return authErr;
  if (channel === "storage.load") {
    return { ok: true, data: load() };
  }

  if (channel === "storage.save") {
    const next = { ...load(), ...(args?.data || args || {}) };
    save(next);
    return { ok: true, data: next };
  }

  if (channel === "page.open") {
    const id = String(args?.id || "").trim();
    if (!id) return { ok: false, error: "Missing page id" };
    const data = load();
    data.lastPageId = id;
    data.recent = [id, ...data.recent.filter((x) => x !== id)].slice(0, 20);
    save(data);
    return { ok: true, data };
  }

  if (channel === "bookmarks.toggle") {
    const id = String(args?.id || "").trim();
    if (!id) return { ok: false, error: "Missing page id" };
    const data = load();
    if (data.bookmarks.includes(id)) {
      data.bookmarks = data.bookmarks.filter((x) => x !== id);
    } else {
      data.bookmarks = [id, ...data.bookmarks].slice(0, 50);
    }
    save(data);
    return { ok: true, data, bookmarked: data.bookmarks.includes(id) };
  }

  if (channel === "meta") {
    return { ok: true, name: "Docs", version: "1.0.0" };
  }

  return { ok: false, error: `Unknown channel: ${channel}` };
}

module.exports = { handleDocsInvoke };