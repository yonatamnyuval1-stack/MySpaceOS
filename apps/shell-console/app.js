(function () {
  function tt(key, vars) {
    return window.MySpaceI18n?.t?.(key, vars) ?? key;
  }

  const PAGE_META = {
    runner: { titleKey: "service.shell.runTitle", subtitleKey: "service.shell.runSub" },
    aliases: { titleKey: "service.shell.aliasesTitle", subtitleKey: "service.shell.aliasesSub" },
    macros: { titleKey: "service.shell.macrosTitle", subtitleKey: "service.shell.macrosSub" },
    when: { titleKey: "service.shell.whenTitle", subtitleKey: "service.shell.whenSub" },
    history: { titleKey: "service.shell.historyTitle", subtitleKey: "service.shell.historySub" },
    reference: { titleKey: "service.shell.referenceTitle", subtitleKey: "service.shell.referenceSub" },
  };

  const pages = [
    window.ConsolePages.runner,
    window.ConsolePages.aliases,
    window.ConsolePages.macros,
    window.ConsolePages.when,
    window.ConsolePages.history,
    window.ConsolePages.reference,
  ];

  let activePageId = "runner";
  let lastSyncAt = null;

  const ui = {
    shell: document.getElementById("app-shell"),
    nav: document.getElementById("main-nav"),
    title: document.getElementById("page-title"),
    subtitle: document.getElementById("page-subtitle"),
    brandSub: document.getElementById("brand-sub"),
    sidebarStatus: document.getElementById("sidebar-status"),
    modalBackdrop: document.getElementById("modal-backdrop"),
    modalTitle: document.getElementById("modal-title"),
    modalBody: document.getElementById("modal-body"),
    modalClose: document.getElementById("modal-close"),
    btnSync: document.getElementById("btn-sync"),
    btnExport: document.getElementById("btn-export"),
    btnImport: document.getElementById("btn-import"),
    btnReset: document.getElementById("btn-reset"),
  };

  function formatSyncTime() {
    if (!lastSyncAt) return tt("service.shell.notSynced");
    try {
      return tt("service.shell.syncedAt", { time: new Date(lastSyncAt).toLocaleTimeString() });
    } catch {
      return tt("service.shell.sync");
    }
  }

  async function refreshStats() {
    try {
      const data = await window.ConsoleStorage.get();
      const a = Object.keys(data.aliases || {}).length;
      const m = Object.keys(data.macros || {}).length;
      const w = (data.whenRules || []).length;
      const h = (data.history || []).length;
      if (ui.sidebarStatus) {
        ui.sidebarStatus.textContent = tt("service.shell.sidebarStats", {
          aliases: a,
          macros: m,
          rules: w,
          history: h,
          sync: formatSyncTime(),
        });
      }
    } catch {
    }
  }

  async function syncAll(showFeedback = false) {
    if (ui.btnSync) {
      ui.btnSync.disabled = true;
      ui.btnSync.textContent = tt("service.shell.syncing");
    }
    try {
      window.ConsoleStorage.invalidate();
      const res = await window.ConsoleStorage.syncFromDesktop();
      lastSyncAt = Date.now();
      await refreshStats();
      pages.forEach((p) => p.scan?.());
      if (showFeedback) {
        const n = res.migrated ?? 0;
        window.Console.showToast(
          n > 0 ? `Synced ${n} item(s) from desktop shell` : "Synced with desktop shell"
        );
      }
      return res;
    } catch (err) {
      if (showFeedback) window.Console.showToast(err.message || "Sync failed");
      throw err;
    } finally {
      if (ui.btnSync) {
        ui.btnSync.disabled = false;
        ui.btnSync.textContent = tt("service.shell.sync");
      }
    }
  }

  async function refreshAll() {
    try {
      window.ConsoleStorage.invalidate();
      await window.ConsoleStorage.syncFromDesktop();
      lastSyncAt = Date.now();
    } catch {
      window.ConsoleStorage.invalidate();
    }
    await refreshStats();
    const active = pages.find((p) => p.id === activePageId);
    if (active?.scan) await active.scan();
  }

  function setActivePage(pageId) {
    const next = pages.find((p) => p.id === pageId) || pages[0];
    activePageId = next.id;
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
    const meta = PAGE_META[next.id] || PAGE_META.runner;
    ui.title.textContent = tt(meta.titleKey);
    ui.subtitle.textContent = tt(meta.subtitleKey);
    ui.brandSub.textContent = tt("service.shell.brandSub");
    closeModal();
    window.ConsoleStorage.invalidate();
    if (next.scan) next.scan();
    refreshStats();
  }

  function openModal(title, html) {
    ui.modalTitle.textContent = title;
    ui.modalBody.innerHTML = html;
    ui.modalBackdrop.classList.remove("hidden");
  }

  function closeModal() {
    ui.modalBackdrop.classList.add("hidden");
    ui.modalBody.innerHTML = "";
  }

  function openDetail(title, html) {
    openModal(title, html);
  }

  function closeDetail() {
    closeModal();
  }

  ui.nav.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-item[data-page]");
    if (!btn || btn.dataset.page === "app-settings") return;
    setActivePage(btn.dataset.page);
  });

  ui.modalClose?.addEventListener("click", closeModal);
  ui.modalBackdrop?.addEventListener("click", (e) => {
    if (e.target === ui.modalBackdrop) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  ui.btnSync?.addEventListener("click", () => syncAll(true));

  ui.btnExport?.addEventListener("click", async () => {
    const res = await window.Console.invoke("data.export");
    await navigator.clipboard.writeText(res.json);
    window.Console.showToast("Exported to clipboard");
  });

  ui.btnImport?.addEventListener("click", async () => {
    const json = prompt("Paste exported JSON:");
    if (!json) return;
    try {
      await window.Console.invoke("data.import", { json });
      window.ConsoleStorage.invalidate();
      lastSyncAt = Date.now();
      await refreshStats();
      pages.forEach((p) => p.scan?.());
      window.Console.showToast("Import complete");
    } catch (err) {
      window.Console.showToast(err.message);
    }
  });

  ui.btnReset?.addEventListener("click", async () => {
    if (!confirm("Delete ALL aliases, macros, when rules and history?")) return;
    await window.Console.invoke("storage.reset");
    window.ConsoleStorage.invalidate();
    lastSyncAt = Date.now();
    await refreshStats();
    pages.forEach((p) => p.scan?.());
    window.Console.showToast("All settings reset");
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshAll();
  });

  window.ConsoleApp = {
    setActivePage,
    openDetail,
    closeDetail,
    openModal,
    closeModal,
    refreshStats,
    refreshAll,
    syncAll,
  };

  function onI18nApplied() {
    setActivePage(activePageId);
    refreshStats();
  }
  window.addEventListener("myspace-i18n-applied", onI18nApplied);
  window.addEventListener("myspace-i18n-ready", onI18nApplied);

  (async function boot() {
    try {
      await syncAll(false);
    } catch {
      window.ConsoleStorage.invalidate();
      await refreshStats();
    }
    setActivePage("runner");
  })();
})();