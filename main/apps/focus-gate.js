const { BrowserWindow } = require("electron");

let state = {
  enabled: false,
  source: null,
  silenceNotifications: true,
  desktopOnly: true,
  startedAt: null,
};

function getState() {
  return { ...state };
}

function broadcast() {
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      if (!win.isDestroyed()) win.webContents.send("focus-changed", getState());
    } catch {
    }
  }
}

function enter(opts = {}) {
  state = {
    enabled: true,
    source: opts.source || "manual",
    silenceNotifications: opts.silenceNotifications !== false,
    desktopOnly: opts.desktopOnly !== false,
    startedAt: new Date().toISOString(),
  };
  broadcast();
  return { ok: true, focus: getState() };
}

function exit() {
  const was = state.enabled;
  state = {
    enabled: false,
    source: null,
    silenceNotifications: true,
    desktopOnly: true,
    startedAt: null,
  };
  if (was) broadcast();
  return { ok: true, focus: getState() };
}

function isSilenced() {
  return !!(state.enabled && state.silenceNotifications);
}

function allowNotify(opts = {}) {
  if (opts.bypassFocus) return true;
  return !isSilenced();
}

module.exports = {
  getState,
  enter,
  exit,
  isSilenced,
  allowNotify,
  broadcast,
};