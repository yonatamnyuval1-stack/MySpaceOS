const fs = require("fs");
const path = require("path");

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
      /* ignore */
    }
  }
  try {
    fs.copyFileSync(filePath, `${filePath}.bak`);
  } catch {
    /* ignore */
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

    return {
      ok: false,
      error: `${path.basename(filePath)} is corrupt and could not be recovered`,
      corrupt: true,
    };
  } catch (err) {
    if (err?.code === "ENOENT") {
      return { ok: true, data: fallback, fromFile: false };
    }
    return { ok: false, error: err.message || String(err) };
  }
}

function countList(data, listKey) {
  if (!data || typeof data !== "object") return 0;
  const arr = data[listKey];
  return Array.isArray(arr) ? arr.length : 0;
}

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
      return { ok: false, error: guard.error, data: guard.kept };
    }
  }
  atomicWriteJson(filePath, data);
  return { ok: true, data };
}

module.exports = {
  tryParse,
  atomicWriteJson,
  quarantineCorrupt,
  loadJsonFile,
  countList,
  guardEmptyOverwrite,
  saveJsonFile,
};