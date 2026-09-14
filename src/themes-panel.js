(function () {
  function tt(key, fallback) {
    const I = window.MySpaceI18n;
    if (!I?.t) return fallback || key;
    const v = I.t(key);
    return v === key ? (fallback || key) : v;
  }

  async function show(initialPage, opts) {
    const page = ["apps", "about"].includes(initialPage) ? initialPage : "apps";
    if (window.MySpaceThemes?.open) {
      await window.MySpaceThemes.open({ page, appId: opts?.appId || null });
      return;
    }
    window.showMySpaceToast?.(tt("service.themes.unavailable", "Themes unavailable"));
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

  window.MySpaceThemesPanel = { show, hide, toggle, isOpen, refresh };
})();
