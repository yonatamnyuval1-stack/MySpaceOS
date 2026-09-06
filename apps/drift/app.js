(function () {
  const PAGE_META = {
    activity: { title: "Activity", subtitle: "Timeline of file and project changes on your PC" },
    zones: { title: "Watch zones", subtitle: "Folders Drift monitors for changes" },
    insights: { title: "Insights", subtitle: "Weekly summaries and activity patterns" },
  };

  const pages = [window.DriftPages.activity, window.DriftPages.zones, window.DriftPages.insights];

  const ui = {
    shell: document.getElementById("app-shell"),
    nav: document.getElementById("main-nav"),
    title: document.getElementById("page-title"),
    subtitle: document.getElementById("page-subtitle"),
    brandSub: document.getElementById("brand-sub"),
    topbarActions: document.getElementById("topbar-actions"),
    btnScan: document.getElementById("btn-scan"),
    sidebarStatus: document.getElementById("sidebar-status"),
  };

  let scanning = false;
  let autoScanTimer = null;
  let settings = {};

  function setSidebarStatus(text) {
    if (ui.sidebarStatus) ui.sidebarStatus.textContent = text;
  }

  async function refreshPages() {
    await window.DriftPages.activity?.scan?.();
    await window.DriftPages.zones?.scan?.();
    await window.DriftPages.insights?.scan?.();
  }

  async function loadSettings() {
    const res = await window.Drift.invoke("zones.list");
    settings = res.settings || {};
    return settings;
  }

  function clearAutoScanTimer() {
    if (autoScanTimer) {
      clearInterval(autoScanTimer);
      autoScanTimer = null;
    }
  }

  function scheduleAutoScan() {
    clearAutoScanTimer();
    const minutes = parseInt(settings.autoScanMinutes, 10) || 0;
    if (minutes <= 0 || settings.paused) return;
    autoScanTimer = setInterval(
      () => runScan({ auto: true, silent: true }),
      minutes * 60 * 1000
    );
  }

  async function runScan(opts = {}) {
    if (scanning) return null;
    scanning = true;
    if (!opts.silent) {
      ui.btnScan.textContent = "Scanning…";
      ui.btnScan.disabled = true;
    } else {
      setSidebarStatus("Auto-scanning…");
    }

    try {
      const res = await window.Drift.invoke("scan.run", {
        auto: Boolean(opts.auto),
        force: Boolean(opts.force),
      });

      if (res.skipped) {
        if (!opts.silent) setSidebarStatus("Scan skipped — ran recently");
        return res;
      }

      await refreshPages();

      if (res.newEvents > 0) {
        setSidebarStatus(`${res.newEvents} new event(s) · auto-scan on`);
      } else if (opts.auto) {
        setSidebarStatus("Auto-scan complete — no new changes");
      } else {
        setSidebarStatus("Scan complete — no new changes");
      }
      return res;
    } catch (err) {
      if (opts.silent) setSidebarStatus(err.message || "Auto-scan failed");
      else alert(err.message);
      return null;
    } finally {
      scanning = false;
      if (!opts.silent) {
        ui.btnScan.textContent = "↻ Scan now";
        ui.btnScan.disabled = false;
      }
    }
  }

  async function initAutoScan() {
    try {
      await loadSettings();
      scheduleAutoScan();
      if (settings.autoScanOnOpen && !settings.paused) {
        await runScan({ auto: true, silent: true });
      } else if (settings.autoScanMinutes > 0 && !settings.paused) {
        setSidebarStatus(`Auto-scan every ${settings.autoScanMinutes} min`);
      }
    } catch (err) {
      setSidebarStatus(err.message || "Drift failed to load");
    }
  }

  async function applySettings(next) {
    settings = { ...settings, ...next };
    scheduleAutoScan();
    if (settings.autoScanMinutes > 0 && !settings.paused) {
      setSidebarStatus(`Auto-scan every ${settings.autoScanMinutes} min`);
    } else if (settings.autoScanOnOpen && !settings.paused) {
      setSidebarStatus("Auto-scan on open");
    }
  }

  function setActivePage(pageId) {
    const next = pages.find((p) => p.id === pageId) || pages[0];

    pages.forEach((p) => {
      const on = p.id === next.id;
      if (p.page) {
        p.page.hidden = !on;
        p.page.classList.toggle("active", on);
      }
    });

    ui.nav.querySelectorAll(".nav-item[data-page]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.page === next.id);
    });

    const meta = PAGE_META[next.id] || PAGE_META.activity;
    ui.title.textContent = meta.title;
    ui.subtitle.textContent = meta.subtitle;
    ui.brandSub.textContent = meta.title;
    ui.topbarActions?.classList.toggle("hidden", next.id !== "activity" && next.id !== "zones");

    if (next.id !== "activity") window.DriftPages.activity?.closeDetail?.();
    if (next.scan) next.scan();
  }

  window.DriftApp = {
    setActivePage,
    runScan: (opts) => runScan({ ...opts, force: true }),
    applySettings,
    reloadSettings: async () => {
      await loadSettings();
      scheduleAutoScan();
    },
    openEvent: async (id) => {
      setActivePage("activity");
      const activity = window.DriftPages.activity;
      if (activity?.scan) await activity.scan();
      await activity?.openDetail?.(id);
    },
  };

  ui.nav.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-item[data-page]");
    if (!btn || btn.dataset.page === "app-settings") return;
    setActivePage(btn.dataset.page);
  });

  ui.btnScan?.addEventListener("click", () => runScan({ force: true }));

  pages.forEach((p) => {
    if (p.bind) p.bind(ui);
  });

  setActivePage("activity");
  initAutoScan();
})();
