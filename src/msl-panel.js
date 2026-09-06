(function () {
  async function show(initialTab) {
    const page = ["caps", "keys", "mint", "inject", "about"].includes(initialTab)
      ? initialTab
      : "caps";
    if (window.MySpaceMsl?.open) {
      await window.MySpaceMsl.open({ page });
      return;
    }
    const res = await window.MySpaceShellBridge?.executeCommand?.(
      page === "caps" ? "msl(open)" : `msl(${page})`,
      "platform"
    );
    if (res && res.ok === false) {
      window.showMySpaceToast?.(res.error || "Could not open MSL");
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

  window.MySpaceMslPanel = { show, hide, toggle, isOpen, refresh };
})();