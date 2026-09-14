(function () {
  function tt(key, fallback) {
    const I = window.MySpaceI18n;
    if (!I?.t) return fallback || key;
    const v = I.t(key);
    return v === key ? (fallback || key) : v;
  }

  async function show(initialPage) {
    const page = ["inbox", "playbooks", "about"].includes(initialPage) ? initialPage : "inbox";
    if (window.MySpaceResolve?.open) {
      await window.MySpaceResolve.open({ page });
      return;
    }
    const res = await window.MySpaceShellBridge?.executeCommand?.(
      page === "inbox" ? "resolve(open)" : `resolve(${page})`,
      "platform"
    );
    if (res && res.ok === false) {
      window.showMySpaceToast?.(res.error || tt("service.resolve.openFailed", "Could not open Resolve"));
    }
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

  window.MySpaceResolvePanel = { show, hide, toggle, isOpen, refresh };
})();
