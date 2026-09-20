const path = require("path");
const fs = require("fs");
const os = require("os");
const { app, shell, dialog, BrowserWindow } = require("electron");
const jobsStore = require("../jobs/store");
const profile = require("../myspace-profile");

function STORE() {
  return profile.profileScopedPath("files-service.json");
}
function WORKSPACE_ROOT() {
  return profile.profileScopedPath("workspace");
}
const MAX_RECENT = 40;
const MAX_FAVORITES = 60;

const IMAGE_EXTS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif",
]);
const BINARY_EXTS = new Set([
  "exe", "dll", "so", "dylib", "bin", "dat", "o", "obj", "a", "lib", "class", "jar", "war",
  "zip", "7z", "rar", "gz", "tgz", "bz2", "xz", "tar", "iso", "dmg", "pkg",
  "pdf", "doc", "docx", "xls", "xlsx", "xlsm", "ppt", "pptx", "odt", "ods", "odp",
  "mp3", "mp4", "wav", "flac", "avi", "mkv", "mov", "webm", "ogg",
  "woff", "woff2", "ttf", "otf", "eot",
  "pdb", "ilk", "msi", "cab", "apk", "ipa", "wasm",
]);

function readStore() {
  try {
    if (fs.existsSync(STORE())) return JSON.parse(fs.readFileSync(STORE(), "utf8"));
  } catch {
  }
  return {};
}

function writeStore(data) {
  fs.mkdirSync(path.dirname(STORE()), { recursive: true });
  fs.writeFileSync(STORE(), JSON.stringify(data, null, 2), "utf8");
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function formatBytes(n) {
  const v = Number(n) || 0;
  if (v < 1024) return `${v} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let x = v;
  let i = -1;
  do {
    x /= 1024;
    i += 1;
  } while (x >= 1024 && i < units.length - 1);
  return `${x.toFixed(x >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function fileExt(filePath) {
  return path.extname(String(filePath || "")).replace(/^\./, "").toLowerCase();
}

function normalizePath(p) {
  const raw = String(p || "").trim();
  if (!raw) return "";
  try {
    return path.resolve(raw);
  } catch {
    return "";
  }
}

function isInsideRoot(full, root) {
  const rel = path.relative(root, full);
  return Boolean(rel) && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function ensureWorkspaceRoot() {
  const root = WORKSPACE_ROOT();
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function assertFileWriteAllowed() {
  const state = jobsStore.load();
  const cap = jobsStore.normalizeCapacity(state?.capacity);
  if (cap.allowFileWrite === false) {
    return {
      ok: false,
      error: "File write blocked: enable in Permissions → Jobs → Allow workspace file writes",
    };
  }
  return { ok: true };
}

function resolveWorkspacePath(input) {
  const raw = String(input || "").trim();
  if (!raw) return { ok: false, error: "Path required" };

  const root = ensureWorkspaceRoot();
  let abs;
  if (path.isAbsolute(raw)) {
    abs = path.resolve(raw);
  } else {
    if (/[<>:"|?*\x00]/.test(raw)) return { ok: false, error: "Invalid path characters" };
    abs = path.resolve(root, raw.replace(/^[/\\]+/, ""));
  }

  if (!isInsideRoot(abs, root)) {
    return {
      ok: false,
      error: "Path must be inside My Space workspace (userData/workspace)",
    };
  }

  return { ok: true, path: abs, root, relative: path.relative(root, abs) };
}

function safeStat(p) {
  try {
    return fs.statSync(p);
  } catch {
    return null;
  }
}

function tryGetPath(name) {
  try {
    const p = app.getPath(name);
    return p && fs.existsSync(p) ? p : "";
  } catch {
    return "";
  }
}

function homeFallback(folderName) {
  const home = tryGetPath("home") || os.homedir();
  if (!home) return "";
  const p = path.join(home, folderName);
  return fs.existsSync(p) ? p : "";
}

function defaultPlaces() {
  const home = tryGetPath("home") || os.homedir();
  const candidates = [
    {
      id: "desktop",
      label: "Desktop",
      icon: "🖥",
      path: tryGetPath("desktop") || homeFallback("Desktop") || homeFallback("OneDrive\\Desktop"),
      kind: "system",
    },
    {
      id: "downloads",
      label: "Downloads",
      icon: "⬇",
      path: tryGetPath("downloads") || homeFallback("Downloads"),
      kind: "system",
    },
    {
      id: "documents",
      label: "Documents",
      icon: "📄",
      path: tryGetPath("documents") || homeFallback("Documents") || homeFallback("OneDrive\\Documents"),
      kind: "system",
    },
    {
      id: "pictures",
      label: "Pictures",
      icon: "🖼",
      path: tryGetPath("pictures") || homeFallback("Pictures") || homeFallback("OneDrive\\Pictures"),
      kind: "system",
    },
    {
      id: "music",
      label: "Music",
      icon: "♫",
      path: tryGetPath("music") || homeFallback("Music"),
      kind: "system",
    },
    {
      id: "videos",
      label: "Videos",
      icon: "▶",
      path: tryGetPath("videos") || homeFallback("Videos"),
      kind: "system",
    },
    { id: "home", label: "Home", icon: "⌂", path: home, kind: "system" },
  ];
  return candidates.filter((p) => p.path);
}

function loadState() {
  const raw = readStore();
  const system = defaultPlaces();
  const favorites = Array.isArray(raw.favorites)
    ? raw.favorites
        .filter((f) => f && f.path)
        .slice(0, MAX_FAVORITES)
        .map((f) => ({
          id: f.id || uid("fav"),
          label: String(f.label || path.basename(f.path) || f.path).slice(0, 80),
          path: normalizePath(f.path),
          kind: "favorite",
          icon: f.icon || "★",
        }))
        .filter((f) => f.path)
    : [];
  const recent = Array.isArray(raw.recent)
    ? raw.recent
        .filter((r) => r && r.path)
        .slice(0, MAX_RECENT)
        .map((r) => ({
          path: normalizePath(r.path),
          name: r.name || path.basename(r.path),
          kind: r.kind || "file",
          at: r.at || 0,
        }))
        .filter((r) => r.path)
    : [];
  return { places: system, favorites, recent };
}

function saveFavorites(favorites) {
  const raw = readStore();
  writeStore({ ...raw, favorites: favorites.slice(0, MAX_FAVORITES) });
}

function pushRecent(entry) {
  const p = normalizePath(entry.path);
  if (!p) return;
  const raw = readStore();
  const next = [
    {
      path: p,
      name: entry.name || path.basename(p),
      kind: entry.kind || "file",
      at: Date.now(),
    },
    ...(Array.isArray(raw.recent) ? raw.recent : []).filter(
      (r) => normalizePath(r.path) !== p
    ),
  ].slice(0, MAX_RECENT);
  writeStore({ ...raw, recent: next });
}

function parentDir(p) {
  const n = normalizePath(p);
  const parent = path.dirname(n);
  if (!parent || parent === n) return "";
  return parent;
}

function crumbsFor(dirPath) {
  const n = normalizePath(dirPath);
  if (!n) return [];
  const parts = [];
  let cur = n;
  const seen = new Set();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    parts.unshift({ name: path.basename(cur) || cur, path: cur });
    const up = path.dirname(cur);
    if (!up || up === cur) break;
    cur = up;
  }
  if (parts.length > 8) {
    return [parts[0], { name: "…", path: "" }, ...parts.slice(-6)];
  }
  return parts;
}

function entryKind(name, isDir) {
  if (isDir) return "folder";
  const ext = fileExt(name);
  if (IMAGE_EXTS.has(ext)) return "image";
  if (["mp3", "wav", "flac", "ogg", "m4a", "aac"].includes(ext)) return "audio";
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) return "video";
  if (["pdf"].includes(ext)) return "pdf";
  if (["zip", "7z", "rar", "gz", "tar", "tgz"].includes(ext)) return "archive";
  if (
    [
      "js", "ts", "tsx", "jsx", "mjs", "cjs", "py", "rs", "go", "java", "c", "cpp", "h",
      "cs", "rb", "php", "swift", "kt", "html", "css", "scss", "json", "xml", "yml", "yaml",
      "md", "txt", "sh", "ps1", "bat", "cmd", "sql", "toml", "ini", "cfg", "env",
    ].includes(ext)
  ) {
    return "code";
  }
  return "file";
}

async function listDir(args) {
  const dir = normalizePath(args?.path);
  if (!dir) return { ok: false, error: "Path required" };
  const st = safeStat(dir);
  if (!st) return { ok: false, error: "Path not found" };
  if (!st.isDirectory()) return { ok: false, error: "Not a folder" };

  let names;
  try {
    names = await fs.promises.readdir(dir);
  } catch (err) {
    return { ok: false, error: err.message || "Cannot read folder" };
  }

  const showHidden = Boolean(args?.showHidden);
  const entries = [];
  for (const name of names) {
    if (!showHidden && (name.startsWith(".") || name === "desktop.ini" || name === "Thumbs.db")) {
      continue;
    }
    const full = path.join(dir, name);
    const s = safeStat(full);
    if (!s) continue;
    const isDir = s.isDirectory();
    entries.push({
      name,
      path: full,
      isDirectory: isDir,
      kind: entryKind(name, isDir),
      size: isDir ? 0 : s.size,
      sizeLabel: isDir ? "" : formatBytes(s.size),
      mtime: s.mtimeMs || 0,
      ext: isDir ? "" : fileExt(name),
    });
  }

  const sort = String(args?.sort || "name").toLowerCase();
  const desc = Boolean(args?.desc);
  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    let cmp = 0;
    if (sort === "size") cmp = (a.size || 0) - (b.size || 0);
    else if (sort === "mtime" || sort === "modified") cmp = (a.mtime || 0) - (b.mtime || 0);
    else cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
    return desc ? -cmp : cmp;
  });

  const parent = parentDir(dir);
  return {
    ok: true,
    path: dir,
    parent: parent && parent !== dir ? parent : "",
    crumbs: crumbsFor(dir),
    entries,
    count: entries.length,
    folders: entries.filter((e) => e.isDirectory).length,
    files: entries.filter((e) => !e.isDirectory).length,
  };
}

function decodeTextBuffer(buf) {
  if (!buf || !buf.length) return { text: "", encoding: "utf8" };
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return { text: buf.slice(2).toString("utf16le"), encoding: "utf16le" };
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.alloc(buf.length - 2);
    for (let i = 2; i + 1 < buf.length; i += 2) {
      swapped[i - 2] = buf[i + 1];
      swapped[i - 1] = buf[i];
    }
    return { text: swapped.toString("utf16le"), encoding: "utf16be" };
  }
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return { text: buf.slice(3).toString("utf8"), encoding: "utf8" };
  }
  const sample = buf.subarray(0, Math.min(buf.length, 4096));
  let oddNull = 0;
  let evenNull = 0;
  for (let i = 0; i < sample.length; i += 1) {
    if (sample[i] === 0) {
      if (i % 2 === 0) evenNull += 1;
      else oddNull += 1;
    }
  }
  const pairs = Math.floor(sample.length / 2);
  if (pairs > 8 && oddNull / pairs > 0.6 && evenNull / pairs < 0.15) {
    return { text: buf.toString("utf16le"), encoding: "utf16le" };
  }
  return { text: buf.toString("utf8"), encoding: "utf8" };
}

function looksLikeBinary(buf) {
  if (!buf || !buf.length) return false;
  const sample = buf.subarray(0, Math.min(buf.length, 8192));
  let nulls = 0;
  let weird = 0;
  for (let i = 0; i < sample.length; i += 1) {
    const b = sample[i];
    if (b === 0) nulls += 1;
    else if (b < 7 || (b > 13 && b < 32 && b !== 27)) weird += 1;
  }
  if (nulls / sample.length > 0.02 && nulls > 4) return true;
  if (weird / sample.length > 0.3) return true;
  return false;
}

async function readPreview(args) {
  const filePath = normalizePath(args?.path);
  if (!filePath) return { ok: false, error: "Path required" };
  const st = safeStat(filePath);
  if (!st?.isFile()) return { ok: false, error: "Not a file" };

  const ext = fileExt(filePath);
  const base = {
    ok: true,
    path: filePath,
    name: path.basename(filePath),
    ext,
    size: st.size,
    sizeLabel: formatBytes(st.size),
    kind: entryKind(path.basename(filePath), false),
    mtime: st.mtimeMs || 0,
  };

  if (IMAGE_EXTS.has(ext) && st.size <= 8 * 1024 * 1024) {
    const buf = await fs.promises.readFile(filePath);
    const mime =
      ext === "svg"
        ? "image/svg+xml"
        : ext === "png"
          ? "image/png"
          : ext === "gif"
            ? "image/gif"
            : ext === "webp"
              ? "image/webp"
              : ext === "bmp"
                ? "image/bmp"
                : ext === "ico"
                  ? "image/x-icon"
                  : "image/jpeg";
    return { ...base, image: true, dataUrl: `data:${mime};base64,${buf.toString("base64")}`, content: null };
  }

  if (BINARY_EXTS.has(ext) && !IMAGE_EXTS.has(ext)) {
    return { ...base, binary: true, content: null };
  }

  const maxBytes = Math.min(512 * 1024, Math.max(1024, parseInt(args?.maxBytes, 10) || 128 * 1024));
  const readLen = Math.min(st.size, maxBytes);
  const fh = await fs.promises.open(filePath, "r");
  let buf;
  try {
    buf = Buffer.alloc(readLen);
    const { bytesRead } = await fh.read(buf, 0, readLen, 0);
    buf = buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }

  const decoded = decodeTextBuffer(buf);
  if (decoded.encoding === "utf8" && looksLikeBinary(buf)) {
    return { ...base, binary: true, content: null };
  }

  return {
    ...base,
    truncated: st.size > maxBytes,
    encoding: decoded.encoding,
    content: decoded.text,
  };
}

async function listDrives() {
  const drives = [];
  if (process.platform === "win32") {
    for (let i = 65; i <= 90; i += 1) {
      const letter = String.fromCharCode(i);
      const root = `${letter}:\\`;
      if (fs.existsSync(root)) {
        drives.push({
          id: `drive-${letter}`,
          label: `${letter}:`,
          path: root,
          kind: "drive",
          icon: "▣",
        });
      }
    }
  } else {
    drives.push({ id: "root", label: "/", path: "/", kind: "drive", icon: "▣" });
  }
  return { ok: true, drives };
}

function getParentWindow() {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && !focused.isDestroyed()) return focused;
  const all = BrowserWindow.getAllWindows();
  return all.find((w) => !w.isDestroyed()) || null;
}

async function handleFilesInvoke(channel, args = {}) {
  const ch = String(channel || "").trim();

  switch (ch) {
    case "status": {
      const state = loadState();
      const workspace = ensureWorkspaceRoot();
      return {
        ok: true,
        platform: process.platform,
        hostname: os.hostname(),
        home: tryGetPath("home") || os.homedir(),
        workspace,
        places: state.places.length,
        favorites: state.favorites.length,
        recent: state.recent.length,
      };
    }

    case "places.list": {
      const state = loadState();
      return { ok: true, places: state.places, favorites: state.favorites };
    }

    case "drives.list":
      return listDrives();

    case "recent.list": {
      const state = loadState();
      const recent = state.recent
        .map((r) => {
          const st = safeStat(r.path);
          return {
            ...r,
            exists: Boolean(st),
            isDirectory: Boolean(st?.isDirectory()),
            sizeLabel: st && !st.isDirectory() ? formatBytes(st.size) : "",
          };
        })
        .filter((r) => r.exists);
      return { ok: true, recent };
    }

    case "recent.clear": {
      const raw = readStore();
      writeStore({ ...raw, recent: [] });
      return { ok: true };
    }

    case "favorites.list": {
      const state = loadState();
      return { ok: true, favorites: state.favorites };
    }

    case "favorites.add": {
      let folder = normalizePath(args.path);
      if (!folder) {
        const picked = await dialog.showOpenDialog(getParentWindow() || undefined, {
          title: "Add favorite folder",
          properties: ["openDirectory"],
        });
        if (picked.canceled || !picked.filePaths?.[0]) {
          return { ok: false, error: "Cancelled" };
        }
        folder = normalizePath(picked.filePaths[0]);
      }
      if (!folder || !fs.existsSync(folder)) return { ok: false, error: "Path not found" };
      const state = loadState();
      if (state.favorites.some((f) => normalizePath(f.path) === folder)) {
        return { ok: false, error: "Already favorited" };
      }
      const fav = {
        id: uid("fav"),
        label: String(args.label || path.basename(folder) || folder).slice(0, 80),
        path: folder,
        kind: "favorite",
        icon: "★",
      };
      saveFavorites([...state.favorites, fav]);
      return { ok: true, favorite: fav, favorites: loadState().favorites };
    }

    case "favorites.remove": {
      const id = String(args.id || "").trim();
      const targetPath = normalizePath(args.path);
      const state = loadState();
      const next = state.favorites.filter((f) => {
        if (id && f.id === id) return false;
        if (targetPath && normalizePath(f.path) === targetPath) return false;
        return true;
      });
      if (next.length === state.favorites.length) {
        return { ok: false, error: "Favorite not found" };
      }
      saveFavorites(next);
      return { ok: true, favorites: next };
    }

    case "dir.list":
      return listDir(args);

    case "file.stat": {
      const p = normalizePath(args.path);
      if (!p) return { ok: false, error: "Path required" };
      const st = safeStat(p);
      if (!st) return { ok: false, error: "Not found" };
      return {
        ok: true,
        path: p,
        name: path.basename(p),
        isDirectory: st.isDirectory(),
        size: st.size,
        sizeLabel: st.isDirectory() ? "" : formatBytes(st.size),
        mtime: st.mtimeMs || 0,
        kind: entryKind(path.basename(p), st.isDirectory()),
        parent: parentDir(p),
      };
    }

    case "file.read":
    case "file.preview":
      return readPreview(args);

    case "file.open": {
      const p = normalizePath(args.path);
      if (!p) return { ok: false, error: "Path required" };
      if (!fs.existsSync(p)) return { ok: false, error: "Not found" };
      const err = await shell.openPath(p);
      if (err) return { ok: false, error: err };
      const st = safeStat(p);
      pushRecent({
        path: p,
        name: path.basename(p),
        kind: st?.isDirectory() ? "folder" : "file",
      });
      return { ok: true };
    }

    case "file.reveal": {
      const p = normalizePath(args.path);
      if (!p) return { ok: false, error: "Path required" };
      if (!fs.existsSync(p)) return { ok: false, error: "Not found" };
      shell.showItemInFolder(p);
      pushRecent({ path: p, name: path.basename(p), kind: "file" });
      return { ok: true };
    }

    case "path.open": {
      const p = normalizePath(args.path);
      if (!p) return { ok: false, error: "Path required" };
      if (!fs.existsSync(p)) return { ok: false, error: "Not found" };
      const st = safeStat(p);
      if (st?.isDirectory()) {
        pushRecent({ path: p, name: path.basename(p) || p, kind: "folder" });
        return { ok: true, path: p, isDirectory: true };
      }
      const err = await shell.openPath(p);
      if (err) return { ok: false, error: err };
      pushRecent({ path: p, name: path.basename(p), kind: "file" });
      return { ok: true, path: p, isDirectory: false };
    }

    case "dir.create": {
      const parent = normalizePath(args.path || args.parent);
      const name = String(args.name || "").trim();
      if (!parent) return { ok: false, error: "Parent path required" };
      if (!name || /[\\/:*?"<>|]/.test(name)) return { ok: false, error: "Invalid folder name" };
      const dest = path.join(parent, name);
      if (fs.existsSync(dest)) return { ok: false, error: "Already exists" };
      await fs.promises.mkdir(dest, { recursive: false });
      return { ok: true, path: dest, name };
    }

    case "dir.mkdir": {
      const gate = assertFileWriteAllowed();
      if (!gate.ok) return gate;
      const resolved = resolveWorkspacePath(args.path);
      if (!resolved.ok) return resolved;
      const recursive = args.recursive !== false;
      await fs.promises.mkdir(resolved.path, { recursive });
      return {
        ok: true,
        path: resolved.path,
        relative: resolved.relative,
        workspace: resolved.root,
        created: true,
      };
    }

    case "file.write": {
      const gate = assertFileWriteAllowed();
      if (!gate.ok) return gate;
      const resolved = resolveWorkspacePath(args.path);
      if (!resolved.ok) return resolved;
      const content = args.content != null ? String(args.content) : "";
      const append = Boolean(args.append);
      await fs.promises.mkdir(path.dirname(resolved.path), { recursive: true });
      if (append && fs.existsSync(resolved.path)) {
        await fs.promises.appendFile(resolved.path, content, "utf8");
      } else {
        await fs.promises.writeFile(resolved.path, content, "utf8");
      }
      const st = await fs.promises.stat(resolved.path);
      return {
        ok: true,
        path: resolved.path,
        relative: resolved.relative,
        workspace: resolved.root,
        bytes: st.size,
        append,
      };
    }

    case "file.workspace.copy": {
      const gate = assertFileWriteAllowed();
      if (!gate.ok) return gate;
      const srcResolved = resolveWorkspacePath(args.path || args.src);
      if (!srcResolved.ok) return srcResolved;
      const destInput = String(args.dest || args.to || "").trim();
      if (!destInput) return { ok: false, error: "Destination required" };
      const destResolved = resolveWorkspacePath(destInput);
      if (!destResolved.ok) return destResolved;
      if (!fs.existsSync(srcResolved.path)) {
        return { ok: false, error: "Source not found" };
      }
      const st = safeStat(srcResolved.path);
      if (st?.isDirectory()) {
        await fs.promises.cp(srcResolved.path, destResolved.path, { recursive: true });
      } else {
        await fs.promises.mkdir(path.dirname(destResolved.path), { recursive: true });
        await fs.promises.copyFile(srcResolved.path, destResolved.path);
      }
      return {
        ok: true,
        from: srcResolved.relative,
        to: destResolved.relative,
        path: destResolved.path,
        workspace: srcResolved.root,
      };
    }

    case "workspace.root": {
      const root = ensureWorkspaceRoot();
      return { ok: true, path: root };
    }

    case "file.rename": {
      const p = normalizePath(args.path);
      const name = String(args.name || "").trim();
      if (!p) return { ok: false, error: "Path required" };
      if (!name || /[\\/:*?"<>|]/.test(name)) return { ok: false, error: "Invalid name" };
      if (!fs.existsSync(p)) return { ok: false, error: "Not found" };
      const dest = path.join(path.dirname(p), name);
      if (normalizePath(dest) === p) return { ok: true, path: p };
      if (fs.existsSync(dest)) return { ok: false, error: "Name already exists" };
      await fs.promises.rename(p, dest);
      return { ok: true, path: dest, name };
    }

    case "file.copy": {
      const src = normalizePath(args.path || args.src);
      const destDir = normalizePath(args.dest || args.to);
      if (!src || !destDir) return { ok: false, error: "Source and destination required" };
      if (!fs.existsSync(src)) return { ok: false, error: "Source not found" };
      if (!safeStat(destDir)?.isDirectory()) return { ok: false, error: "Destination must be a folder" };
      const base = String(args.name || path.basename(src)).trim() || path.basename(src);
      let dest = path.join(destDir, base);
      if (fs.existsSync(dest)) {
        const ext = path.extname(base);
        const stem = path.basename(base, ext);
        dest = path.join(destDir, `${stem} - copy${ext}`);
      }
      const st = safeStat(src);
      if (st?.isDirectory()) {
        await fs.promises.cp(src, dest, { recursive: true });
      } else {
        await fs.promises.copyFile(src, dest);
      }
      return { ok: true, path: dest };
    }

    case "file.move": {
      const src = normalizePath(args.path || args.src);
      const destDir = normalizePath(args.dest || args.to);
      if (!src || !destDir) return { ok: false, error: "Source and destination required" };
      if (!fs.existsSync(src)) return { ok: false, error: "Source not found" };
      if (!safeStat(destDir)?.isDirectory()) return { ok: false, error: "Destination must be a folder" };
      const dest = path.join(destDir, path.basename(src));
      if (fs.existsSync(dest)) return { ok: false, error: "Already exists in destination" };
      await fs.promises.rename(src, dest);
      return { ok: true, path: dest };
    }

    case "file.delete": {
      const p = normalizePath(args.path);
      if (!p) return { ok: false, error: "Path required" };
      if (!fs.existsSync(p)) return { ok: false, error: "Not found" };
      const permanent = Boolean(args.permanent);
      if (permanent) {
        const st = safeStat(p);
        if (st?.isDirectory()) await fs.promises.rm(p, { recursive: true, force: true });
        else await fs.promises.unlink(p);
      } else {
        try {
          await shell.trashItem(p);
        } catch (err) {
          return { ok: false, error: err.message || "Could not move to Recycle Bin" };
        }
      }
      return { ok: true };
    }

    case "folder.pick": {
      const picked = await dialog.showOpenDialog(getParentWindow() || undefined, {
        title: args.title || "Choose folder",
        defaultPath: args.path || undefined,
        properties: ["openDirectory", "createDirectory"],
      });
      if (picked.canceled || !picked.filePaths?.[0]) return { ok: false, error: "Cancelled" };
      return { ok: true, path: picked.filePaths[0] };
    }

    case "file.pick": {
      const picked = await dialog.showOpenDialog(getParentWindow() || undefined, {
        title: args.title || "Choose file",
        defaultPath: args.path || undefined,
        properties: args.multi ? ["openFile", "multiSelections"] : ["openFile"],
      });
      if (picked.canceled || !picked.filePaths?.length) return { ok: false, error: "Cancelled" };
      return {
        ok: true,
        path: picked.filePaths[0],
        paths: picked.filePaths,
      };
    }

    case "home": {
      const state = loadState();
      const drives = await listDrives();
      const workspace = ensureWorkspaceRoot();
      return {
        ok: true,
        places: state.places,
        favorites: state.favorites,
        recent: state.recent.slice(0, 12),
        drives: drives.drives || [],
        home: tryGetPath("home") || os.homedir(),
        desktop: tryGetPath("desktop"),
        downloads: tryGetPath("downloads"),
        workspace,
      };
    }

    default:
      return { ok: false, error: `Unknown channel: ${ch}` };
  }
}

module.exports = { handleFilesInvoke, resolveWorkspacePath, WORKSPACE_ROOT, ensureWorkspaceRoot };