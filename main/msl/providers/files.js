const { handleFilesInvoke } = require("../../apps/files-ipc");

async function listDir(input = {}) {
  const path = String(input.path || input.dir || "").trim();
  if (!path) return { ok: false, error: "Missing path" };
  return handleFilesInvoke("dir.list", { path, sort: input.sort, showHidden: input.showHidden });
}

async function openPath(input = {}) {
  const path = String(input.path || "").trim();
  if (!path) return { ok: false, error: "Missing path" };
  return handleFilesInvoke("path.open", { path });
}

async function reveal(input = {}) {
  const path = String(input.path || "").trim();
  if (!path) return { ok: false, error: "Missing path" };
  return handleFilesInvoke("file.reveal", { path });
}

async function places(input = {}) {
  return handleFilesInvoke("places.list", input);
}

async function home() {
  return handleFilesInvoke("home", {});
}

async function recent() {
  return handleFilesInvoke("recent.list", {});
}

const CAPABILITIES = [
  {
    id: "files.home",
    kind: "query",
    provider: "files",
    title: "Files home",
    description: "Places, drives, favorites and recent paths",
    handler: home,
  },
  {
    id: "files.places.list",
    kind: "query",
    provider: "files",
    title: "List places",
    description: "System places and favorites",
    handler: places,
  },
  {
    id: "files.dir.list",
    kind: "query",
    provider: "files",
    title: "List directory",
    description: "List files and folders in a path",
    handler: listDir,
  },
  {
    id: "files.recent.list",
    kind: "query",
    provider: "files",
    title: "Recent files",
    description: "Recently opened paths in Files",
    handler: recent,
  },
  {
    id: "files.path.open",
    kind: "action",
    provider: "files",
    title: "Open path",
    description: "Open a file with the system default or return a folder path",
    handler: openPath,
  },
  {
    id: "files.file.reveal",
    kind: "action",
    provider: "files",
    title: "Reveal in Explorer",
    description: "Show a path in the OS file manager",
    handler: reveal,
  },
];

module.exports = { CAPABILITIES };
