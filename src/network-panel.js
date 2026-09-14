(function () {
  function tt(key, fallback) {
    const I = window.MySpaceI18n;
    if (!I?.t) return fallback || key;
    const v = I.t(key);
    return v === key ? (fallback || key) : v;
  }

  async function show(initialPage) {
    const page = ["status", "adapters", "ports", "about"].includes(initialPage)
      ? initialPage
      : "status";
    if (window.MySpaceNetwork?.open) {
      await window.MySpaceNetwork.open({ page });
      return;
    }
    window.showMySpaceToast?.(tt("service.network.unavailable", "Network unavailable"));
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

  window.MySpaceNetworkPanel = { show, hide, toggle, isOpen, refresh };
})();
