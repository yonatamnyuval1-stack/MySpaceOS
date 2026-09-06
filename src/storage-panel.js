(function () {
  async function show(initialPage) {
    const page = ["status", "apps", "large-files", "cleanup", "about"].includes(initialPage)
      ? initialPage
      : "status";
    if (window.MySpaceStorage?.open) {
      await window.MySpaceStorage.open({ page });
      return;
    }
    window.showMySpaceToast?.("Storage unavailable");
  }

  function hide() {}
  function toggle() {
    void show();
  }
  function isOpen() {
    return false;
  }
  function refresh() {}

  window.MySpaceStoragePanel = { show, hide, toggle, isOpen, refresh };
})();
