(function () {
  function tt(key, fallback) {
    const I = window.MySpaceI18n;
    if (!I?.t) return fallback || key;
    const v = I.t(key);
    return v === key ? (fallback || key) : v;
  }

  async function show(initialPage) {
    const page = ["catalog", "services", "apps", "external", "about"].includes(initialPage)
      ? initialPage
      : "catalog";
    if (window.MySpaceInfo?.open) {
      await window.MySpaceInfo.open({ page });
      return;
    }
    window.showMySpaceToast?.(tt("service.info.unavailable", "Info unavailable"));
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
  window.MySpaceInfoPanel = { show, hide, toggle, isOpen, refresh };
})();