const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const FILE_TO_APP = {
  "builds.json": "builds",
  "chat-app.json": "chat",
  "contacts.json": "contacts",
  "contracts.json": "contracts",
  "coupons-vault.json": "coupons",
  "day-planner.json": "day-planner",
  "docs.json": "docs",
  "files-service.json": "files",
  "geography.json": "geography",
  "model-flow-history.json": "model-flow",
  "model-flow-library.json": "model-flow",
  "notes.json": "notes",
  "tasks.json": "tasks",
  "storage-state.json": "storage",
  "themes-state.json": "themes",
  "scripts.json": "scripts",
  "shell-engine.json": "shell",
  "stocks.json": "stocks",
  "study-deck.json": "study-deck",
  "translate.json": "translate",
  "vault.json": "profiles",
  "world-clock.json": "world-clock",
};

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function tryParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function inferAppId(filePath) {
  return FILE_TO_APP[path.basename(String(filePath || ""))] || "";
}

function dataFileForApp(appId) {
  const id = String(appId || "").trim();
  if (!id) return "";
  for (const [file, app] of Object.entries(FILE_TO_APP)) {
    if (app === id) return file;
  }
  return "";
}

function reportLoadProblem(filePath, payload) {
  const appId = inferAppId(filePath);
  if (!appId) return;
  try {
    const { reportLoadFailure } = require("../resolve/report-helper");
    reportLoadFailure(appId, payload, appId);
  } catch {
  }
}

function reportSaveProblem(filePath, payload) {
  const appId = inferAppId(filePath);
  if (!appId) return;
  try {
    const { reportSaveFailure } = require("../resolve/report-helper");
    reportSaveFailure(appId, payload, appId);
  } catch {
  }
}

function atomicWriteJson(filePath, data) {
  ensureDir(filePath);
  const body = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, body, "utf8");
  try {
    fs.renameSync(tmp, filePath);
  } catch {
    fs.copyFileSync(tmp, filePath);
    try {
      fs.unlinkSync(tmp);
    } catch {
    }
  }
  try {
    fs.copyFileSync(filePath, `${filePath}.bak`);
  } catch {
  }
}

function quarantineCorrupt(filePath, raw) {
  try {
    const stamp = Date.now();
    const dest = `${filePath}.corrupt-${stamp}.bak`;
    if (raw != null) fs.writeFileSync(dest, String(raw), "utf8");
    else if (fs.existsSync(filePath)) fs.copyFileSync(filePath, dest);
    return dest;
  } catch {
    return null;
  }
}

/**
 * @returns {{ ok: true, data, fromFile: boolean, recovered?: boolean } | { ok: false, error: string, corrupt?: boolean }}
 */
function loadJsonFile(filePath, { fallback = null } = {}) {
  try {
    if (!fs.existsSync(filePath)) {
      return { ok: true, data: fallback, fromFile: false };
    }
    const raw = fs.readFileSync(filePath, "utf8");
    const hadBom = raw.charCodeAt(0) === 0xfeff;
    const text = hadBom ? raw.slice(1) : raw;
    const parsed = tryParse(text);
    if (parsed != null) {
      return { ok: true, data: parsed, fromFile: true };
    }

    quarantineCorrupt(filePath, raw);

    const bakPath = `${filePath}.bak`;
    if (fs.existsSync(bakPath)) {
      const bakRaw = fs.readFileSync(bakPath, "utf8");
      const bakParsed = tryParse(bakRaw.charCodeAt(0) === 0xfeff ? bakRaw.slice(1) : bakRaw);
      if (bakParsed != null) {
        atomicWriteJson(filePath, bakParsed);
        return { ok: true, data: bakParsed, fromFile: true, recovered: true };
      }
    }

    const failed = {
      ok: false,
      error: `${path.basename(filePath)} is corrupt and could not be recovered`,
      corrupt: true,
    };
    reportLoadProblem(filePath, failed);
    return failed;
  } catch (err) {
    if (err?.code === "ENOENT") {
      return { ok: true, data: fallback, fromFile: false };
    }
    const failed = { ok: false, error: err.message || String(err) };
    reportLoadProblem(filePath, failed);
    return failed;
  }
}


function countList(data, listKey) {
  if (!data || typeof data !== "object") return 0;
  const arr = data[listKey];
  return Array.isArray(arr) ? arr.length : 0;
}

/**
 * Refuse writing an empty list over a non-empty disk file.
 * @returns {{ ok: true } | { ok: false, error: string, kept: any }}
 */
function guardEmptyOverwrite(filePath, nextData, listKey) {
  const nextCount = countList(nextData, listKey);
  if (nextCount > 0) return { ok: true };
  if (!fs.existsSync(filePath)) return { ok: true };

  const loaded = loadJsonFile(filePath, { fallback: null });
  if (!loaded.ok || !loaded.fromFile) return { ok: true };
  const diskCount = countList(loaded.data, listKey);
  if (diskCount > 0 && nextCount === 0) {
    return {
      ok: false,
      error: `Refused to overwrite ${path.basename(filePath)}: would erase ${diskCount} ${listKey}`,
      kept: loaded.data,
    };
  }
  return { ok: true };
}

function saveJsonFile(filePath, data, { listKey = null, allowEmpty = false } = {}) {
  if (listKey && !allowEmpty) {
    const guard = guardEmptyOverwrite(filePath, data, listKey);
    if (!guard.ok) {
      reportSaveProblem(filePath, guard);
      return { ok: false, error: guard.error, data: guard.kept };
    }
  }
  try {
    atomicWriteJson(filePath, data);
    return { ok: true, data };
  } catch (err) {
    const failed = { ok: false, error: err?.message || String(err) };
    reportSaveProblem(filePath, failed);
    return failed;
  }
}

function migrateLegacyUserData() {
  const destRoot = app.getPath("userData");
  const appData = app.getPath("appData");
  const legacyRoots = [
    path.join(appData, "Electron"),
    path.join(appData, "My Space"),
  ];

  const names = [
    "builds.json",
    "builds.json.bak",
    "geography.json",
    "scripts.json",
    "day-planner.json",
    "study-deck.json",
    "contacts.json",
    "notes.json",
    "tasks.json",
    "storage-state.json",
    "themes-state.json",
    "stocks.json",
    "shell-engine.json",
    "docs.json",
    "model-flow-secrets.json",
    "model-flow-history.json",
    "model-flow-library.json",
    "mail-accounts.json",
    "hub-connections.json",
    "vault.json",
    "translate.json",
    "world-clock.json",
    "contracts.json",
    "studies.json",
    "app-settings.json",
    "chat-app.json",
    "chat-app.json.bak",
  ];

  const migrated = [];
  for (const root of legacyRoots) {
    if (!fs.existsSync(root) || path.resolve(root) === path.resolve(destRoot)) continue;
    for (const name of names) {
      const from = path.join(root, name);
      const to = path.join(destRoot, name);
      try {
        if (!fs.existsSync(from) || fs.existsSync(to)) continue;
        ensureDir(to);
        fs.copyFileSync(from, to);
        migrated.push({ from, to, name });
      } catch {
      }
    }
    const learnFrom = path.join(root, "geography-learn-cache");
    const learnTo = path.join(destRoot, "geography-learn-cache");
    try {
      if (fs.existsSync(learnFrom) && !fs.existsSync(learnTo)) {
        if (typeof fs.cpSync === "function") {
          fs.cpSync(learnFrom, learnTo, { recursive: true });
        } else {
          fs.mkdirSync(learnTo, { recursive: true });
          for (const name of fs.readdirSync(learnFrom)) {
            fs.copyFileSync(path.join(learnFrom, name), path.join(learnTo, name));
          }
        }
        migrated.push({ from: learnFrom, to: learnTo, name: "geography-learn-cache" });
      }
    } catch {
    }
  }

  try {
    const marker = path.join(destRoot, ".legacy-migrate-v1");
    if (!fs.existsSync(marker)) {
      fs.writeFileSync(
        marker,
        JSON.stringify({ at: new Date().toISOString(), migrated: migrated.map((m) => m.name) }, null, 2),
        "utf8"
      );
    }
  } catch {
  }

  return migrated;
}

module.exports = {
  atomicWriteJson,
  loadJsonFile,
  saveJsonFile,
  guardEmptyOverwrite,
  quarantineCorrupt,
  migrateLegacyUserData,
  countList,
  dataFileForApp,
  FILE_TO_APP,
};