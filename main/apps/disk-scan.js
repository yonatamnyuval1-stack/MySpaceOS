const fs = require("fs");
const path = require("path");
const { formatBytes } = require("./exec-utils");
const { scanStorage } = require("./storage-scan");

let cancelRequested = false;

function requestCancelDiskScan() {
  cancelRequested = true;
}

function normalizeWinPath(p) {
  if (!p) return "";
  let s = String(p).trim().replace(/\//g, "\\");
  if (/^[a-zA-Z]$/.test(s)) s = `${s.toUpperCase()}:\\`;
  if (/^[a-zA-Z]:$/.test(s)) s = `${s.toUpperCase()}:\\`;
  if (!s.endsWith("\\") && /^[A-Z]:\\/.test(s)) {
  }
  return s;
}

async function statSafe(fullPath) {
  try {
    return await fs.promises.stat(fullPath);
  } catch {
    return null;
  }
}

async function scanChildren(dirPath, depth, maxDepth, maxChildren, largeFiles, visitBudget) {
  if (cancelRequested || visitBudget.count <= 0) return [];
  visitBudget.count -= 1;

  let entries;
  try {
    entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const nodes = [];
  for (const ent of entries) {
    if (cancelRequested || visitBudget.count <= 0) break;
    const name = ent.name;
    if (name === "." || name === "..") continue;
    const full = path.join(dirPath, name);
    const st = await statSafe(full);
    if (!st) continue;

    if (st.isFile()) {
      const size = st.size;
      pushLargeFile(largeFiles, {
        path: full,
        name,
        sizeBytes: size,
        sizeLabel: formatBytes(size),
        modified: st.mtime.toISOString(),
      });
      nodes.push({
        name,
        path: full,
        type: "file",
        sizeBytes: size,
        sizeLabel: formatBytes(size),
      });
    } else if (st.isDirectory()) {
      let sizeBytes = 0;
      let children = [];
      if (depth < maxDepth) {
        children = await scanChildren(full, depth + 1, maxDepth, maxChildren, largeFiles, visitBudget);
        sizeBytes = children.reduce((s, c) => s + (c.sizeBytes || 0), 0);
      } else {
        sizeBytes = await folderSizeOneLevel(full, largeFiles, visitBudget);
      }
      nodes.push({
        name,
        path: full,
        type: "dir",
        sizeBytes,
        sizeLabel: formatBytes(sizeBytes),
        children: children.slice(0, maxChildren),
      });
    }
  }

  nodes.sort((a, b) => (b.sizeBytes || 0) - (a.sizeBytes || 0));
  return nodes.slice(0, maxChildren);
}

async function folderSizeOneLevel(dirPath, largeFiles, visitBudget) {
  let total = 0;
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    for (const ent of entries) {
      if (cancelRequested || visitBudget.count <= 0) break;
      visitBudget.count -= 1;
      const full = path.join(dirPath, ent.name);
      const st = await statSafe(full);
      if (!st) continue;
      if (st.isFile()) {
        total += st.size;
        pushLargeFile(largeFiles, {
          path: full,
          name: ent.name,
          sizeBytes: st.size,
          sizeLabel: formatBytes(st.size),
          modified: st.mtime.toISOString(),
        });
      }
    }
  } catch {
  }
  return total;
}

function pushLargeFile(heap, file) {
  heap.push(file);
  heap.sort((a, b) => b.sizeBytes - a.sizeBytes);
  if (heap.length > 80) heap.length = 80;
}

async function scanDiskTree(args) {
  cancelRequested = false;
  const scannedAt = new Date().toISOString();
  const rootPath = normalizeWinPath(args?.path || "C:\\");
  const maxDepth = Math.min(4, Math.max(1, parseInt(args?.maxDepth, 10) || 2));
  const maxChildren = Math.min(50, Math.max(8, parseInt(args?.maxChildren, 10) || 24));
  const visitBudget = { count: 12000 };

  if (process.platform !== "win32") {
    return { ok: true, scannedAt, root: rootPath, children: [], largeFiles: [], note: "Disk explorer requires Windows." };
  }

  try {
    const st = await statSafe(rootPath);
    if (!st || !st.isDirectory()) {
      return { ok: false, error: `Path not accessible: ${rootPath}` };
    }

    const largeFiles = [];
    const children = await scanChildren(rootPath, 1, maxDepth, maxChildren, largeFiles, visitBudget);
    const totalBytes = children.reduce((s, c) => s + (c.sizeBytes || 0), 0);

    largeFiles.sort((a, b) => b.sizeBytes - a.sizeBytes);

    return {
      ok: true,
      scannedAt,
      cancelled: cancelRequested,
      root: rootPath,
      totalBytes,
      totalLabel: formatBytes(totalBytes),
      maxDepth,
      children,
      largeFiles: largeFiles.slice(0, 60),
      visitsUsed: 12000 - visitBudget.count,
    };
  } catch (err) {
    return { ok: false, error: err.message || "Disk scan failed" };
  }
}

async function scanDiskLargeFiles(args) {
  cancelRequested = false;
  const rootPath = normalizeWinPath(args?.path || "C:\\");
  const maxDepth = Math.min(6, Math.max(2, parseInt(args?.maxDepth, 10) || 4));
  const visitBudget = { count: 25000 };
  const largeFiles = [];

  if (process.platform !== "win32") {
    return { ok: true, largeFiles: [], note: "Windows only" };
  }

  await walkForLargeFiles(rootPath, 0, maxDepth, largeFiles, visitBudget);
  largeFiles.sort((a, b) => b.sizeBytes - a.sizeBytes);

  return {
    ok: true,
    scannedAt: new Date().toISOString(),
    cancelled: cancelRequested,
    root: rootPath,
    largeFiles: largeFiles.slice(0, 80),
    visitsUsed: 25000 - visitBudget.count,
  };
}

async function walkForLargeFiles(dirPath, depth, maxDepth, largeFiles, visitBudget) {
  if (cancelRequested || visitBudget.count <= 0 || depth > maxDepth) return;
  visitBudget.count -= 1;

  let entries;
  try {
    entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const ent of entries) {
    if (cancelRequested || visitBudget.count <= 0) break;
    const full = path.join(dirPath, ent.name);
    if (ent.isFile()) {
      visitBudget.count -= 1;
      const st = await statSafe(full);
      if (st?.isFile()) {
        pushLargeFile(largeFiles, {
          path: full,
          name: ent.name,
          sizeBytes: st.size,
          sizeLabel: formatBytes(st.size),
          modified: st.mtime.toISOString(),
        });
      }
    } else if (ent.isDirectory() && depth < maxDepth) {
      await walkForLargeFiles(full, depth + 1, maxDepth, largeFiles, visitBudget);
    }
  }
}

async function listDiskRoots() {
  const storage = await scanStorage();
  return {
    ok: true,
    drives: storage.drives || [],
    scannedAt: storage.scannedAt,
  };
}

module.exports = {
  scanDiskTree,
  scanDiskLargeFiles,
  listDiskRoots,
  requestCancelDiskScan,
};