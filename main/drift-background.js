const { runScan, loadStorage } = require("./apps/drift-ipc");

let timer = null;
let getMainWindow = null;

async function tick() {
  try {
    const { data } = await loadStorage();
    if (data.settings.paused) return;
    if (!data.settings.autoScanMinutes) return;

    const result = await runScan({ auto: true, background: true });
    if (!result.ok || result.skipped || !result.newEvents) return;

    const win = getMainWindow?.();
    if (win && !win.isDestroyed()) {
      win.webContents.send("drift-scan-update", {
        newEvents: result.newEvents,
        scanned: result.scanned,
      });
    }
  } catch (err) {
    console.error("Drift background scan:", err.message || err);
  }
}

function scheduleNext(delayMs) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    await tick();
    try {
      const { data } = await loadStorage();
      const mins = Math.max(15, parseInt(data.settings.autoScanMinutes, 10) || 60);
      scheduleNext(mins * 60 * 1000);
    } catch {
      scheduleNext(60 * 60 * 1000);
    }
  }, delayMs);
}

function startDriftBackgroundService(getWin) {
  getMainWindow = getWin;
  scheduleNext(30 * 1000);
}

module.exports = { startDriftBackgroundService };