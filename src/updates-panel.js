(function () {
  async function show(initialPage) {
    const page = ["pending", "history", "about"].includes(initialPage) ? initialPage : "pending";
    if (window.MySpaceUpdates?.open) {
      await window.MySpaceUpdates.open({ page });
      return;
    }
    window.showMySpaceToast?.("Updates unavailable");
  }

  function hide() {}
  function toggle() {
    void show();
  }
  function isOpen() {
    return false;
  }
  function refresh() {}

  window.MySpaceUpdatesPanel = { show, hide, toggle, isOpen, refresh };
})();