const { screen } = require("electron");
const {
  isEmbedAvailable,
  isElectronEditorExe,
  hwndFromElectronHandle,
  spawnTracked,
  findPidByExePath,
  waitForProcessWindow,
  waitForProcessTreeWindow,
  embedHwnd,
  updateEmbeddedBounds,
  setEmbeddedVisible,
  focusEmbeddedHwnd,
  detachHwnd,
  isHwndAlive,
  killProcessTree,
  getDpiForHwnd,
  sleep,
} = require("./embed-window");
const { launchExternalApp } = require("./launch");
/** @type {Map<string, { id: string, path: string, pid: number|null, hwnd: any, bounds: object|null, spawned: boolean }>} */
const sessions = new Map();

function getParentHwnd(win) {
  if (!win || win.isDestroyed?.()) return null;
  try {
    return hwndFromElectronHandle(win.getNativeWindowHandle());
  } catch {
    return null;
  }
}

function scaleBounds(win, bounds) {
  let factor = 1;
  try {
    const parent = getParentHwnd(win);
    const dpi = parent != null ? getDpiForHwnd(parent) : null;
    if (dpi) {
      factor = dpi / 96;
    } else {
      const display = screen.getDisplayMatching(win.getBounds());
      factor = display.scaleFactor || 1;
    }
  } catch {
    factor = 1;
  }
  return {
    x: Math.round((bounds?.x || 0) * factor),
    y: Math.round((bounds?.y || 0) * factor),
    width: Math.max(50, Math.round((bounds?.width || 800) * factor)),
    height: Math.max(50, Math.round((bounds?.height || 600) * factor)),
  };
}

async function prepareHostForEmbed(win) {
  if (!win || win.isDestroyed?.()) return;
  try {
    if (win.isFullScreen()) {
      win.setFullScreen(false);
      await sleep(160);
    }
  } catch {
  }
}

async function resolvePid(exePath, spawnedPid) {
  if (spawnedPid) return spawnedPid;
  for (let i = 0; i < 24; i++) {
    const pid = await findPidByExePath(exePath);
    if (pid) return pid;
    await sleep(200);
  }
  return null;
}

function embedProfileForExe(exePath) {
  if (isElectronEditorExe(exePath)) {
    return { timeoutMs: 35000, minArea: 20000, intervalMs: 200 };
  }
  return { timeoutMs: 22000, minArea: 40000, intervalMs: 250 };
}

function storeSession(id, exePath, pid, hwnd, bounds, spawned) {
  sessions.set(id, {
    id,
    path: exePath,
    pid,
    hwnd,
    bounds,
    spawned: !!spawned,
  });
}

async function embedPidIntoHost(win, { id, exePath, bounds, pid, spawned, profile, useProcessTree = false, preserveFrame = false }) {
  const parent = getParentHwnd(win);
  if (!parent) {
    return { ok: false, error: "My Space window handle unavailable", suggestExternal: true };
  }

  const b = scaleBounds(win, bounds);
  const waitOpts = { ...profile, exePath };
  const waitFn = useProcessTree ? waitForProcessTreeWindow : waitForProcessWindow;
  const hwnd = await waitFn(pid, waitOpts);
  if (!hwnd) {
    if (spawned) killProcessTree(pid);
    return {
      ok: false,
      error: "Timed out waiting for program window",
      suggestExternal: true,
    };
  }

  await sleep(isElectronEditorExe(exePath) ? 500 : 350);
  const settled = await waitFn(pid, {
    ...waitOpts,
    timeoutMs: isElectronEditorExe(exePath) ? 4000 : useProcessTree ? 5000 : 2500,
  });
  const finalHwnd = settled || hwnd;
  let emb = embedHwnd(finalHwnd, parent, b, { preserveFrame });
  if (!emb.ok) {
    await sleep(400);
    const retryHwnd = await waitFn(pid, {
      ...waitOpts,
      timeoutMs: isElectronEditorExe(exePath) ? 5000 : 3000,
      minArea: Math.floor(waitOpts.minArea / 4),
    });
    if (retryHwnd) {
      emb = embedHwnd(retryHwnd, parent, b, { preserveFrame });
      if (emb.ok) {
        storeSession(id, exePath, pid, retryHwnd, b, spawned);
        focusEmbeddedHwnd(retryHwnd, parent);
        return { ok: true, id, pid: String(pid), retried: true };
      }
    }
    if (spawned) killProcessTree(pid);
    return { ...emb, suggestExternal: true };
  }

  storeSession(id, exePath, pid, finalHwnd, b, spawned);
  focusEmbeddedHwnd(finalHwnd, parent);
  return { ok: true, id, pid: String(pid) };
}

function dropDeadSession(id) {
  const session = sessions.get(id);
  if (!session) return;
  if (session.hwnd && !isHwndAlive(session.hwnd)) {
    sessions.delete(id);
  }
}

async function startEmbeddedSession(win, { id, path: exePath, bounds }) {
  if (!isEmbedAvailable()) {
    return { ok: false, error: "Window embedding unavailable (koffi/user32)", suggestExternal: true };
  }
  if (!exePath) return { ok: false, error: "No program path", suggestExternal: true };
  if (!id) return { ok: false, error: "Embed session id required" };
  await prepareHostForEmbed(win);

  const existing = sessions.get(id);
  if (existing?.hwnd) {
    if (!isHwndAlive(existing.hwnd)) {
      sessions.delete(id);
    } else {
      const parent = getParentHwnd(win);
      const b = scaleBounds(win, bounds);
      const emb = embedHwnd(existing.hwnd, parent, b);
      if (emb.ok) {
        existing.bounds = b;
        setEmbeddedVisible(existing.hwnd, true);
        focusEmbeddedHwnd(existing.hwnd, parent);
        return { ok: true, id, reused: true };
      }
      detachHwnd(existing.hwnd, { close: false });
      sessions.delete(id);
    }
  }

  const profile = embedProfileForExe(exePath);
  const existingPid = await findPidByExePath(exePath);
  if (existingPid) {
    const attached = await embedPidIntoHost(win, {
      id,
      exePath,
      bounds,
      pid: existingPid,
      spawned: false,
      profile: { ...profile, timeoutMs: Math.min(profile.timeoutMs, 6000), minArea: 8000 },
    });
    if (attached.ok) return { ...attached, attached: true };
  }

  const spawned = await spawnTracked(exePath);
  if (!spawned.ok) {
    return { ok: false, error: spawned.error || "Could not start program", suggestExternal: true };
  }

  const pid = await resolvePid(exePath, spawned.pid);
  if (!pid) {
    if (spawned.spawned && spawned.pid) killProcessTree(spawned.pid);
    return {
      ok: false,
      error: "Program started but its process was not found",
      suggestExternal: true,
    };
  }

  return embedPidIntoHost(win, {
    id,
    exePath,
    bounds,
    pid,
    spawned: !!spawned.spawned,
    profile,
  });
}

async function startExclusiveSpawnedSession(win, { id, path: exePath, args = [], bounds, profile = null, preserveFrame = false }) {
  if (!isEmbedAvailable()) {
    return { ok: false, error: "Window embedding unavailable (koffi/user32)", suggestExternal: true };
  }
  if (!exePath) return { ok: false, error: "No program path", suggestExternal: true };
  if (!id) return { ok: false, error: "Embed session id required" };
  await prepareHostForEmbed(win);
  const existing = sessions.get(id);
  if (existing?.hwnd) {
    if (isHwndAlive(existing.hwnd)) {
      detachHwnd(existing.hwnd, { close: true });
      if (existing.pid) killProcessTree(existing.pid);
    }
    sessions.delete(id);
  }

  const spawned = await spawnTracked(exePath, args);
  if (!spawned.ok || !spawned.pid) {
    return { ok: false, error: spawned.error || "Could not start program", suggestExternal: true };
  }

  const waitProfile = {
    timeoutMs: 30000,
    minArea: 12000,
    intervalMs: 200,
    ...(profile || {}),
  };

  return embedPidIntoHost(win, {
    id,
    exePath,
    bounds,
    pid: spawned.pid,
    spawned: true,
    profile: waitProfile,
    useProcessTree: true,
    preserveFrame,
  });
}

function updateSessionBounds(id, win, bounds) {
  const session = sessions.get(id);
  if (!session?.hwnd) return { ok: false, error: "No embed session", gone: true };
  if (!isHwndAlive(session.hwnd)) {
    sessions.delete(id);
    return { ok: false, error: "Window gone", gone: true };
  }
  const b = scaleBounds(win, bounds);
  session.bounds = b;
  const res = updateEmbeddedBounds(session.hwnd, b);
  if (res.gone) sessions.delete(id);
  return res;
}

function setSessionVisible(id, visible, win = null) {
  const session = sessions.get(id);
  if (!session?.hwnd) return { ok: false, error: "No embed session", gone: true };
  if (!isHwndAlive(session.hwnd)) {
    sessions.delete(id);
    return { ok: false, error: "Window gone", gone: true };
  }
  const res = setEmbeddedVisible(session.hwnd, visible);
  if (res.gone) sessions.delete(id);
  if (res.ok && visible && win) {
    focusEmbeddedHwnd(session.hwnd, getParentHwnd(win));
  }
  return res;
}

function focusSession(id, win) {
  const session = sessions.get(id);
  if (!session?.hwnd) return { ok: false, error: "No embed session", gone: true };
  if (!isHwndAlive(session.hwnd)) {
    sessions.delete(id);
    return { ok: false, error: "Window gone", gone: true };
  }
  setEmbeddedVisible(session.hwnd, true);
  return focusEmbeddedHwnd(session.hwnd, getParentHwnd(win));
}

function stopSession(id, { close = true } = {}) {
  const session = sessions.get(id);
  if (!session) return { ok: true };
  detachHwnd(session.hwnd, { close });
  sessions.delete(id);
  return { ok: true };
}

function stopAllSessions({ close = true } = {}) {
  for (const id of [...sessions.keys()]) {
    stopSession(id, { close });
  }
}

async function fallbackExternal(win, { id, path: exePath } = {}) {
  if (id) stopSession(id, { close: false });
  if (!exePath) return { ok: false, error: "No program path" };
  try {
    if (win && !win.isDestroyed?.() && win.isFullScreen()) {
      win.setFullScreen(false);
      await sleep(150);
    }
  } catch {
  }
  const launched = await launchExternalApp(exePath);
  if (!launched.ok) return launched;
  return { ok: true, mode: "external", path: exePath };
}

module.exports = {
  startEmbeddedSession,
  startExclusiveSpawnedSession,
  updateSessionBounds,
  setSessionVisible,
  focusSession,
  stopSession,
  stopAllSessions,
  fallbackExternal,
  isEmbedAvailable,
  dropDeadSession,
};