(function () {
  async function show(initialPage) {
    const page = ["catalog", "services", "apps", "external", "about"].includes(initialPage)
      ? initialPage
      : "catalog";
    if (window.MySpaceInfo?.open) {
      await window.MySpaceInfo.open({ page });
      return;
    }
    window.showMySpaceToast?.("Info unavailable");
  }

  function hide() {}
  function toggle() {
    void show();
  }
  function isOpen() {
    return false;
  }
  function refresh() {}

  window.MySpaceInfoPanel = { show, hide, toggle, isOpen, refresh };
})();
