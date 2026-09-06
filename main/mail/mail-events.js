const { BrowserWindow } = require("electron");
function broadcastMailEvent(channel, payload = {}) {
  const message = { channel: String(channel || ""), ...payload };
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    try {
      win.webContents.send("mail-event", message);
    } catch {
    }
  }
}

module.exports = { broadcastMailEvent };
