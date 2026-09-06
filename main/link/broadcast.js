const { BrowserWindow } = require("electron");

function safeSend(webContents, channel, payload) {
  if (!webContents || webContents.isDestroyed()) return false;
  try {
    webContents.send(channel, payload);
    return true;
  } catch {
    return false;
  }
}

function broadcast(channel, payload = {}) {
  let count = 0;
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    if (safeSend(win.webContents, channel, payload)) count += 1;
  }
  return count;
}

function sendToWebContents(webContents, channel, payload = {}) {
  return safeSend(webContents, channel, payload) ? 1 : 0;
}

function sendToModule(moduleId, channel, payload = {}, getWindowsForModule) {
  const rows = getWindowsForModule(moduleId);
  let count = 0;
  for (const row of rows) {
    if (sendToWebContents(row.webContents, channel, payload)) count += 1;
  }
  return count;
}

module.exports = { broadcast, sendToWebContents, sendToModule, safeSend };