(function () {
  async function show(initialPage) {
    const page = ["status", "adapters", "ports", "about"].includes(initialPage)
      ? initialPage
      : "status";
    if (window.MySpaceNetwork?.open) {
      await window.MySpaceNetwork.open({ page });
      return;
    }
    window.showMySpaceToast?.("Network unavailable");
  }

  function hide() {}
  function toggle() {
    void show();
  }
  function isOpen() {
    return false;
  }
  function refresh() {}

  window.MySpaceNetworkPanel = { show, hide, toggle, isOpen, refresh };
})();