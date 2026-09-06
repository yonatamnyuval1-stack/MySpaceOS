(function () {
  async function show(initialPage, opts) {
    const page = ["apps", "about"].includes(initialPage) ? initialPage : "apps";
    if (window.MySpaceThemes?.open) {
      await window.MySpaceThemes.open({ page, appId: opts?.appId || null });
      return;
    }
    window.showMySpaceToast?.("Themes unavailable");
  }

  function hide() {}
  function toggle() {
    void show();
  }
  function isOpen() {
    return false;
  }
  function refresh() {}

  window.MySpaceThemesPanel = { show, hide, toggle, isOpen, refresh };
})();
