(function () {
  function tt(key, fallback) {
    const I = window.MySpaceI18n;
    if (!I?.t) return fallback || key;
    const v = I.t(key);
    return v === key ? (fallback || key) : v;
  }

  async function show(initialPage) {
    const page = ["pending", "history", "about"].includes(initialPage) ? initialPage : "pending";
    if (window.MySpaceUpdates?.open) {
      await window.MySpaceUpdates.open({ page });
      return;
    }
    window.showMySpaceToast?.(tt("service.updates.unavailable", "Updates unavailable"));
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

  window.MySpaceUpdatesPanel = { show, hide, toggle, isOpen, refresh };
})();
