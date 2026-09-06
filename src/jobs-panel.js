(function () {
  async function show(initialTab) {
    const page = ["queue", "active", "done", "enqueue", "capacity", "about"].includes(initialTab)
      ? initialTab
      : "queue";
    if (window.MySpaceJobs?.open) {
      await window.MySpaceJobs.open({ page });
      return;
    }
    const res = await window.MySpaceShellBridge?.executeCommand?.(
      page === "queue" ? "jobs(open)" : `jobs(${page})`,
      "platform"
    );
    if (res && res.ok === false) {
      window.showMySpaceToast?.(res.error || "Could not open Jobs");
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

  window.MySpaceJobsPanel = { show, hide, toggle, isOpen, refresh };
})();
