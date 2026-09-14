(function () {
  function tt(key, fallback) {
    const I = window.MySpaceI18n;
    if (!I?.t) return fallback || key;
    const v = I.t(key);
    return v === key ? (fallback || key) : v;
  }

  async function show(initialPage) {
    const page = ["status", "history", "about"].includes(initialPage) ? initialPage : "status";
    if (window.MySpaceBackup?.open) {
      await window.MySpaceBackup.open({ page });
      return;
    }
    window.showMySpaceToast?.(tt("service.backup.unavailable", "Backup unavailable"));
  }

  function hide() {}
  function toggle() {
    void show();
  }
  function isOpen() {
    return false;
  }
  function refresh() {}

  window.addEventListener("myspace-i18n-applied", () => {
    if (isOpen()) refresh();
  });

  window.MySpaceBackupPanel = { show, hide, toggle, isOpen, refresh };
})();
