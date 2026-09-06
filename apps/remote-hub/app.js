(function () {
  const PAGE_META = {
    machines: {
      title: "Machines",
      subtitle: "Control center: full desktop, mouse & keyboard, files, terminal",
    },
    quick: {
      title: "Quick connect",
      subtitle: "RDP, SSH, PowerShell, or files. no setup, just enter an IP",
    },
    network: {
      title: "Network scan",
      subtitle: "Find PCs on your LAN with RDP, SSH, or WinRM already open",
    },
    enable: {
      title: "Enable access",
      subtitle: "One-time scripts for the target PC: built into Windows, nothing to download",
    },
  };

  const pages = [
    window.RemoteHubPages.machines,
    window.RemoteHubPages.quick,
    window.RemoteHubPages.network,
    window.RemoteHubPages.enable,
  ];

  const ui = {
    shell: document.getElementById("app-shell"),
    nav: document.getElementById("main-nav"),
    title: document.getElementById("page-title"),
    subtitle: document.getElementById("page-subtitle"),
    brandSub: document.getElementById("brand-sub"),
    btnRefresh: document.getElementById("btn-refresh"),
    autoRefresh: document.getElementById("auto-refresh"),
    refreshInterval: document.getElementById("refresh-interval"),
    detailPanel: document.getElementById("detail-panel"),
    detailBody: document.getElementById("detail-body"),
    detailTitle: document.getElementById("detail-title"),
    detailClose: document.getElementById("detail-close"),
    topbarActions: document.getElementById("topbar-actions"),
  };

  let activePage = pages[0];
  let refreshTimer = null;
  let scanning = false;

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

    const meta = PAGE_META[next.id] || PAGE_META.machines;
    ui.title.textContent = meta.title;
    ui.subtitle.textContent = meta.subtitle;
    ui.brandSub.textContent = `v2.0 · ${meta.title}`;

    const showMachinesToolbar = next.id === "machines";
    ui.topbarActions?.classList.toggle("hidden", !showMachinesToolbar);

    if (next.id !== "machines") {
      ui.shell.classList.remove("detail-open");
      ui.detailPanel.classList.add("hidden");
    }

    scanActive().then(scheduleRefresh);
  }

  let refreshWithHologram = false;

  async function scanActive() {
    if (scanning || !activePage?.scan) return;
    scanning = true;
    ui.btnRefresh?.classList.add("loading");
    try {
      if (refreshWithHologram && window.RemoteHubHologram) {
        await window.RemoteHubHologram.play({ label: "Scanning remote nodes" });
      }
      await activePage.scan();
    } catch (err) {
      console.error(err);
      alert(err.message || "Action failed");
    } finally {
      scanning = false;
      ui.btnRefresh?.classList.remove("loading");
    }
  }

  function scheduleRefresh() {
    clearInterval(refreshTimer);
    refreshTimer = null;
    if (!ui.autoRefresh?.checked || activePage.id !== "machines") return;
    const ms = parseInt(ui.refreshInterval?.value, 10) || 15000;
    refreshTimer = setInterval(scanActive, ms);
  }

  ui.nav.addEventListener("click", async (e) => {
    const btn = e.target.closest(".nav-item[data-page]");
    if (!btn || btn.dataset.page === "app-settings") return;
    setActivePage(btn.dataset.page);
  });

  ui.btnRefresh?.addEventListener("click", () => {
    refreshWithHologram = true;
    scanActive().finally(() => {
      refreshWithHologram = false;
    });
  });
  ui.autoRefresh?.addEventListener("change", scheduleRefresh);
  ui.refreshInterval?.addEventListener("change", scheduleRefresh);

  pages.forEach((p) => {
    if (p.bind) p.bind(ui);
  });

  document.getElementById("btn-add-machine")?.addEventListener("click", async (e) => {
    e.preventDefault();
    if (activePage.id !== "machines") setActivePage("machines");
    if (window.RemoteHubHologram) {
      await window.RemoteHubHologram.play({ label: "Initialize new machine" });
    }
    window.RemoteHubPages.machines?.openEditor?.(null);
  });

  setActivePage("machines");
  window.RemoteHubApp = {
    setActivePage,
    openMachine: (id) => {
      setActivePage("machines");
      window.RemoteHubPages?.machines?.openEditor?.(id);
    },
  };
})();