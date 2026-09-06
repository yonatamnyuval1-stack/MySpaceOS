const { loadAccounts } = require("./mail-store");
const { syncAll } = require("./mail-service");

const SYNC_MS = 60 * 1000;
let timer = null;

function startMailSyncService() {
  if (timer) return;

  const tick = async () => {
    try {
      const accounts = loadAccounts().accounts;
      if (!accounts.some((a) => a.syncEnabled && a.status !== "revoked")) return;
      await syncAll({ notify: true });
    } catch (err) {
      console.warn("mail sync:", err?.message || err);
    }
  };

  setTimeout(tick, 8000);
  timer = setInterval(tick, SYNC_MS);
}

module.exports = { startMailSyncService };
