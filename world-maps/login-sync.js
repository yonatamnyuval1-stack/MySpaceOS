(function () {
  const syncPath = document.getElementById("sync-path");
  const syncHint = document.getElementById("sync-hint");
  const btnSyncPick = document.getElementById("btn-sync-pick");
  const btnSyncClear = document.getElementById("btn-sync-clear");
  const errorEl = document.getElementById("login-error");

  if (!window.worldMaps?.syncStatus) return;

  function showError(msg) {
    if (!errorEl) return;
    if (!msg) {
      errorEl.classList.add("hidden");
      errorEl.textContent = "";
      return;
    }
    errorEl.textContent = msg;
    errorEl.classList.remove("hidden");
  }

  async function refreshSyncUi() {
    try {
      const sync = await window.worldMaps.syncStatus();
      if (!sync?.ok) return;
      if (sync.sharedEnabled && sync.sharedRoot) {
        if (syncPath) {
          syncPath.textContent = sync.sharedReachable
            ? `Linked · ${sync.accountCount} account(s): ${(sync.usernames || []).join(", ") || "—"}`
            : `Linked but unreachable: ${sync.sharedRoot}`;
          syncPath.title = sync.sharedRoot;
        }
        btnSyncClear?.classList.remove("hidden");
        if (syncHint) {
          syncHint.textContent =
            "Accounts in this folder are shared. Create an account on another PC linked to the same folder and it will show up here after refresh.";
        }
      } else {
        if (syncPath) {
          syncPath.textContent = "Not linked: accounts stay on this PC only";
          syncPath.title = "";
        }
        btnSyncClear?.classList.add("hidden");
        if (syncHint) {
          syncHint.textContent =
            "Point both PCs at the same OneDrive / network folder so new accounts appear everywhere.";
        }
      }
    } catch {
      /* optional */
    }
  }

  btnSyncPick?.addEventListener("click", async () => {
    btnSyncPick.disabled = true;
    try {
      const res = await window.worldMaps.syncPickFolder();
      if (res?.canceled) return;
      if (!res?.ok) {
        showError(res?.error || "Could not link folder");
        return;
      }
      showError("");
      await refreshSyncUi();
    } catch (err) {
      showError(err?.message || "Could not link folder");
    } finally {
      btnSyncPick.disabled = false;
    }
  });

  btnSyncClear?.addEventListener("click", async () => {
    btnSyncClear.disabled = true;
    try {
      await window.worldMaps.syncClear();
      await refreshSyncUi();
    } catch (err) {
      showError(err?.message || "Could not unlink");
    } finally {
      btnSyncClear.disabled = false;
    }
  });

  void refreshSyncUi();
})();