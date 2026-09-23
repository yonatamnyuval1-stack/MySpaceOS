const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const {
  isEmbedAvailable,
  startExclusiveSpawnedSession,
  updateSessionBounds,
  setSessionVisible,
  focusSession,
  stopSession,
  stopAllSessions,
} = require("./embed-session");
const EDGE_CANDIDATES = [
  () =>
    path.join(
      process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)",
      "Microsoft",
      "Edge",
      "Application",
      "msedge.exe"
    ),
  () =>
    path.join(
      process.env.PROGRAMFILES || "C:\\Program Files",
      "Microsoft",
      "Edge",
      "Application",
      "msedge.exe"
    ),
  () => path.join(process.env.LOCALAPPDATA || "", "Microsoft", "Edge", "Application", "msedge.exe"),
];

function resolveEdgePath() {
  for (const make of EDGE_CANDIDATES) {
    try {
      const p = make();
      if (p && fs.existsSync(p)) return p;
    } catch {
    }
  }
  return null;
}

function isGoogleConnectHost(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.includes("google.") ||
      host.includes("gmail.") ||
      host.endsWith("google.com") ||
      host.includes("youtube.") ||
      host === "youtu.be" ||
      host.includes("gstatic.com") ||
      host.includes("googleusercontent.com")
    );
  } catch {
    return false;
  }
}

function profileDirForKey(profileKey) {
  const safe =
    String(profileKey || "browser")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "browser";
  const root = path.join(app.getPath("userData"), "connect-edge", safe);
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function edgeArgsForUrl(url, profileKey) {
  const userDataDir = profileDirForKey(profileKey);
  return [
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--new-window",
    url,
  ];
}

function available() {
  if (process.platform !== "win32") {
    return { ok: true, available: false, reason: "Windows only" };
  }
  if (!isEmbedAvailable()) {
    return { ok: true, available: false, reason: "Window embedding unavailable" };
  }
  const edgePath = resolveEdgePath();
  if (!edgePath) {
    return { ok: true, available: false, reason: "Microsoft Edge not found" };
  }
  return { ok: true, available: true, edgePath };
}

async function startConnectEdge(win, { id, url, profileKey = "browser", bounds } = {}) {
  const avail = available();
  if (!avail.available) {
    return { ok: false, error: avail.reason || "Connect Edge unavailable", suggestWebview: true };
  }
  if (!id) return { ok: false, error: "Session id required" };
  if (!url) return { ok: false, error: "URL required" };

  const res = await startExclusiveSpawnedSession(win, {
    id,
    path: avail.edgePath,
    args: edgeArgsForUrl(url, profileKey),
    bounds,
    profile: { timeoutMs: 35000, minArea: 10000, intervalMs: 200 },
    preserveFrame: true,
  });
  if (!res.ok) return { ...res, suggestWebview: true };
  return { ...res, engine: "edge-embed", url, profileKey };
}

async function navigateConnectEdge(win, { id, url, profileKey = "browser", bounds } = {}) {
  if (id) stopSession(id, { close: true });
  return startConnectEdge(win, { id, url, profileKey, bounds });
}

module.exports = {
  available,
  resolveEdgePath,
  isGoogleConnectHost,
  startConnectEdge,
  navigateConnectEdge,
  updateSessionBounds,
  setSessionVisible,
  focusSession,
  stopSession,
  stopAllSessions,
};