const { loadStorage, refreshLinkedProjectTrees } = require("./apps/builds-ipc");
const { loadAppSettings } = require("./apps/app-settings-ipc");

let timer = null;

function scheduleNext(delayMs) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    await tick();
    try {
      const appSettings = await loadAppSettings("builds");
      if (appSettings.autoRefreshEnabled === false) {
        scheduleNext(60 * 1000);
        return;
      }
      const mins = Math.min(60, Math.max(1, parseInt(appSettings.autoRefreshMinutes, 10) || 3));
      scheduleNext(mins * 60 * 1000);
    } catch {
      scheduleNext(3 * 60 * 1000);
    }
  }, delayMs);
}

async function tick() {
  try {
    const appSettings = await loadAppSettings("builds");
    if (appSettings.autoRefreshEnabled === false) return;
    await refreshLinkedProjectTrees({ auto: true });
  } catch (err) {
    console.error("Builds auto-refresh:", err.message || err);
  }
}

function startBuildsBackgroundService() {
  scheduleNext(45 * 1000);
}

module.exports = { startBuildsBackgroundService };