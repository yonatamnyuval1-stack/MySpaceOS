(function () {
  function tt(key, fallback) {
    const I = window.MySpaceI18n;
    if (!I?.t) return fallback || key;
    const v = I.t(key);
    return v === key ? (fallback || key) : v;
  }

  async function show(initialPage) {
    const page = ["status", "apps", "large-files", "cleanup", "about"].includes(initialPage)
      ? initialPage
      : "status";
    if (window.MySpaceStorage?.open) {
      await window.MySpaceStorage.open({ page });
      return;
    }
    window.showMySpaceToast?.(tt("service.storage.unavailable", "Storage unavailable"));
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

  window.MySpaceStoragePanel = { show, hide, toggle, isOpen, refresh };
})();
