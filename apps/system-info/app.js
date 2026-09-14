(function () {
  const PAGE_META = {
    system: {
      titleKey: "service.systemInfo.system",
      subtitleKey: "service.systemInfo.systemSub",
    },
    cpu: {
      titleKey: "service.systemInfo.cpu",
      subtitleKey: "service.systemInfo.cpuSub",
    },
    memory: {
      titleKey: "service.systemInfo.memory",
      subtitleKey: "service.systemInfo.memorySub",
    },
    storage: {
      titleKey: "service.systemInfo.storage",
      subtitleKey: "service.systemInfo.storageSub",
    },
    disk: {
      titleKey: "service.systemInfo.diskExplorer",
      subtitleKey: "service.systemInfo.diskSub",
    },
    performance: {
      titleKey: "service.systemInfo.performance",
      subtitleKey: "service.systemInfo.performanceSub",
    },
    processes: {
      titleKey: "service.systemInfo.processes",
      subtitleKey: "service.systemInfo.processesSub",
    },
    network: {
      titleKey: "service.systemInfo.network",
      subtitleKey: "service.systemInfo.networkSub",
    },
    ports: {
      titleKey: "service.systemInfo.ports",
      subtitleKey: "service.systemInfo.portsSub",
    },
    environment: {
      titleKey: "service.systemInfo.environment",
      subtitleKey: "service.systemInfo.environmentSub",
    },
  };

  const REFRESH_KEY = "myspace.system-info.refreshMs";
  const DEFAULT_REFRESH_MS = 30000;
  const ALLOWED_MS = new Set([0, 15000, 30000, 60000, 120000]);
  const NO_AUTO_REFRESH = new Set(["disk"]);

  const pages = [
    window.SysInfoPages.system,
    window.SysInfoPages.cpu,
    window.SysInfoPages.memory,
    window.SysInfoPages.storage,
    window.SysInfoPages.disk,
    window.SysInfoPages.performance,
    window.SysInfoPages.processes,
    window.SysInfoPages.network,
    window.SysInfoPages.ports,
    window.SysInfoPages.environment,
  ];

  const ui = {
    shell: document.getElementById("app-shell"),
    nav: document.getElementById("main-nav"),
    title: document.getElementById("page-title"),
    subtitle: document.getElementById("page-subtitle"),
    brandSub: document.getElementById("brand-sub"),
    btnRefresh: document.getElementById("btn-refresh"),
    refreshInterval: document.getElementById("refresh-interval"),
    refreshMeta: document.getElementById("refresh-meta"),
    detailPanel: document.getElementById("detail-panel"),
    detailBody: document.getElementById("detail-body"),
    detailTitle: document.getElementById("detail-title"),
    detailClose: document.getElementById("detail-close"),
  };

  let activePage = pages[0];
  let refreshTimer = null;
  let countdownTimer = null;
  let scanning = false;
  let nextRefreshAt = 0;

  function tt(key, vars) {
    const fn = window.MySpaceI18n?.t;
    return typeof fn === "function" ? fn(key, vars) : key;
  }

  function loadRefreshMs() {
    try {
      const raw = localStorage.getItem(REFRESH_KEY);
      if (raw == null) return DEFAULT_REFRESH_MS;
      const n = Number(raw);
      return ALLOWED_MS.has(n) ? n : DEFAULT_REFRESH_MS;
    } catch {
      return DEFAULT_REFRESH_MS;
    }
  }

  function saveRefreshMs(ms) {
    try {
      localStorage.setItem(REFRESH_KEY, String(ms));
    } catch {
    }
  }

  function formatCountdown(msLeft) {
    const sec = Math.max(0, Math.ceil(msLeft / 1000));
    if (sec >= 60) {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${m}:${String(s).padStart(2, "0")}`;
    }
    return `${sec}s`;
  }

  function paintPageChrome(pageId) {
    const meta = PAGE_META[pageId] || PAGE_META.system;
    if (ui.title) ui.title.textContent = tt(meta.titleKey);
    if (ui.subtitle) ui.subtitle.textContent = tt(meta.subtitleKey);
    if (ui.brandSub) ui.brandSub.textContent = tt(meta.titleKey);
    if (ui.detailTitle) ui.detailTitle.textContent = tt("service.systemInfo.details");
  }

  function updateRefreshMeta() {
    if (!ui.refreshMeta) return;
    const ms = Number(ui.refreshInterval.value) || 0;
    if (ms <= 0) {
      ui.refreshMeta.textContent = tt("service.systemInfo.autoRefreshOff");
      return;
    }
    if (NO_AUTO_REFRESH.has(activePage?.id)) {
      ui.refreshMeta.textContent = tt("service.systemInfo.manualOnly");
      return;
    }
    if (!nextRefreshAt) {
      ui.refreshMeta.textContent = tt("service.systemInfo.everySeconds", { seconds: ms / 1000 });
      return;
    }
    const left = nextRefreshAt - Date.now();
    ui.refreshMeta.textContent = tt("service.systemInfo.nextRefreshIn", {
      time: formatCountdown(left),
    });
  }

  function setActivePage(pageId) {
    const next = pages.find((p) => p.id === pageId) || pages[0];
    activePage = next;

    pages.forEach((p) => {
      const on = p.id === next.id;
      p.page.hidden = !on;
      p.page.classList.toggle("active", on);
    });

    ui.nav.querySelectorAll(".nav-item").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.page === next.id);
    });

    paintPageChrome(next.id);

    ui.shell.classList.remove("detail-open");
    ui.detailPanel.classList.add("hidden");

    scanActive().then(scheduleRefresh);
  }

  async function scanActive() {
    if (scanning || !activePage) return;
    scanning = true;
    ui.btnRefresh?.classList.add("loading");
    ui.btnRefresh?.setAttribute("aria-busy", "true");
    try {
      await activePage.scan();
    } catch (err) {
      console.error(err);
      const msg = err?.message || "Scan failed";
      if (activePage.page) {
        const loading = activePage.page.querySelector(".loading-cell");
        if (loading) loading.textContent = msg;
      }
    } finally {
      scanning = false;
      ui.btnRefresh?.classList.remove("loading");
      ui.btnRefresh?.removeAttribute("aria-busy");
      const ms = Number(ui.refreshInterval.value) || 0;
      if (ms > 0 && !NO_AUTO_REFRESH.has(activePage?.id)) {
        nextRefreshAt = Date.now() + ms;
      }
      updateRefreshMeta();
    }
  }

  function scheduleRefresh() {
    clearInterval(refreshTimer);
    clearInterval(countdownTimer);
    refreshTimer = null;
    countdownTimer = null;

    const ms = Number(ui.refreshInterval.value);
    const interval = ALLOWED_MS.has(ms) ? ms : DEFAULT_REFRESH_MS;
    if (String(ui.refreshInterval.value) !== String(interval)) {
      ui.refreshInterval.value = String(interval);
    }
    saveRefreshMs(interval);

    if (interval <= 0 || NO_AUTO_REFRESH.has(activePage?.id)) {
      nextRefreshAt = 0;
      updateRefreshMeta();
      return;
    }

    nextRefreshAt = Date.now() + interval;
    refreshTimer = setInterval(() => {
      if (activePage && NO_AUTO_REFRESH.has(activePage.id)) return;
      void scanActive();
    }, interval);

    countdownTimer = setInterval(updateRefreshMeta, 1000);
    updateRefreshMeta();
  }

  function onI18nApplied() {
    paintPageChrome(activePage?.id || "system");
    updateRefreshMeta();
    if (activePage?.scan) void activePage.scan();
  }

  ui.nav.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-item[data-page]");
    if (!btn || btn.dataset.page === "app-settings") return;
    setActivePage(btn.dataset.page);
  });

  ui.btnRefresh.addEventListener("click", () => void scanActive().then(scheduleRefresh));
  ui.refreshInterval.addEventListener("change", scheduleRefresh);

  pages.forEach((p) => p.bind(ui));

  window.addEventListener("myspace-i18n-applied", onI18nApplied);

  ui.refreshInterval.value = String(loadRefreshMs());
  function applyRoute(route) {
    const page = String(route?.page || route?.tab || "system").toLowerCase();
    const alias = {
      home: "system",
      overview: "system",
      open: "system",
      lab: "performance",
      perf: "performance",
      env: "environment",
    };
    setActivePage(alias[page] || page);
  }
  setActivePage("system");
  window.SysInfoApp = { setActivePage, applyRoute };
})();
