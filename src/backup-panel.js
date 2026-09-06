(function () {
  async function show(initialPage) {
    const page = ["status", "history", "about"].includes(initialPage) ? initialPage : "status";
    if (window.MySpaceBackup?.open) {
      await window.MySpaceBackup.open({ page });
      return;
    }
    window.showMySpaceToast?.("Backup unavailable");
  }

  function hide() {}
  function toggle() {
    void show();
  }
  function isOpen() {
    return false;
  }
  function refresh() {}

  window.MySpaceBackupPanel = { show, hide, toggle, isOpen, refresh };
})();
