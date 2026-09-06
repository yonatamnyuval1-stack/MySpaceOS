(function () {
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
      window.showMySpaceToast?.(res.error || "Could not open Resolve");
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

  window.MySpaceResolvePanel = { show, hide, toggle, isOpen, refresh };
})();