(function () {
  const PAGE_META = {
    dashboard: { titleKey: "page.dashboard", subKey: "page.dashboard.sub" },
    portfolio: { titleKey: "page.portfolio", subKey: "page.portfolio.sub" },
    alerts: { titleKey: "page.alerts", subKey: "page.alerts.sub" },
    buylist: { titleKey: "page.buylist", subKey: "page.buylist.sub" },
    "ai-analysis": { titleKey: "page.ai", subKey: "page.ai.sub" },
    stock: { titleKey: "page.stock", subKey: "page.stock.sub" },
  };

  const pages = [
    window.StocksPages.dashboard,
    window.StocksPages.search,
    window.StocksPages.portfolio,
    window.StocksPages.alerts,
    window.StocksPages.buylist,
    window.StocksPages.aiAnalysis,
    window.StocksPages.stock,
  ];

  const ui = {
    nav: document.getElementById("main-nav"),
    title: document.getElementById("page-title"),
    subtitle: document.getElementById("page-subtitle"),
    brandSub: document.getElementById("brand-sub"),
    modeBtn: document.getElementById("mode-btn"),
    modeBtnIcon: document.getElementById("mode-btn-icon"),
    modeBtnLabel: document.getElementById("mode-btn-label"),
    modeMenu: document.getElementById("mode-menu"),
  };

  let activePage = pages[0];
  let activeMode = "stocks";
  let modes = [];

  function t(key, fallback) {
    return window.StocksI18n?.t?.(key) || fallback || key;
  }

  async function loadModes() {
    try {
      const res = await window.Stocks.invoke("market.modes");
      modes = res.modes || [];
      activeMode = res.activeMode || "stocks";
      renderModeMenu();
      updateModeButton();
    } catch (_) {
      modes =
        window.StocksModes?.MODE_ORDER?.map((id) => {
          const m = window.StocksModes.getMode(id);
          return { id: m.id, label: m.label, icon: m.icon, subtitle: m.subtitle };
        }) || [];
    }
  }

  function updateModeButton() {
    const current = modes.find((m) => m.id === activeMode) || window.StocksModes?.getMode(activeMode);
    if (!current || !ui.modeBtnIcon) return;
    ui.modeBtnIcon.textContent = current.icon || "📊";
    ui.modeBtnLabel.textContent = current.label || "Stocks";
    if (ui.subtitle && activePage?.id === "dashboard") {
      ui.subtitle.textContent = current.subtitle || t("page.dashboard.sub");
    }
  }

  function renderModeMenu() {
    if (!ui.modeMenu) return;
    ui.modeMenu.innerHTML = modes
      .map(
        (m) =>
          `<button type="button" class="mode-option ${m.id === activeMode ? "active" : ""}" data-mode="${m.id}">
            <span class="mode-option-icon">${m.icon}</span>
            <span class="mode-option-text">
              <strong>${m.label}</strong>
              <small>${m.subtitle || ""}</small>
            </span>
          </button>`
      )
      .join("");

    ui.modeMenu.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await setMode(btn.dataset.mode);
        closeModeMenu();
      });
    });
  }

  async function setMode(modeId) {
    if (modeId === activeMode) return;
    await window.Stocks.invoke("market.setMode", { mode: modeId });
    activeMode = modeId;
    renderModeMenu();
    updateModeButton();
    if (activePage?.scan) await activePage.scan();
    else if (activePage?.activate) activePage.activate();
  }

  function toggleModeMenu() {
    if (!ui.modeMenu) return;
    const open = !ui.modeMenu.hidden;
    ui.modeMenu.hidden = open;
    ui.modeBtn?.classList.toggle("open", !open);
  }

  function closeModeMenu() {
    if (!ui.modeMenu) return;
    ui.modeMenu.hidden = true;
    ui.modeBtn?.classList.remove("open");
  }

  function applyPageMeta(pageId) {
    const meta = PAGE_META[pageId] || PAGE_META.dashboard;
    ui.title.textContent = t(meta.titleKey);
    if (pageId === "dashboard") {
      ui.subtitle.textContent =
        modes.find((m) => m.id === activeMode)?.subtitle || t(meta.subKey);
    } else {
      ui.subtitle.textContent = t(meta.subKey);
    }
    ui.brandSub.textContent = `v1.2 · ${modes.find((m) => m.id === activeMode)?.label || "Market"}`;
  }

  function setPage(pageId, arg) {
    if (pageId === "search") pageId = "dashboard";
    const next = pages.find((p) => p.id === pageId) || pages[0];
    if (activePage?.deactivate) activePage.deactivate();

    activePage = next;

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

    applyPageMeta(next.id);

    if (next.activate) next.activate(arg);
    else if (next.scan) next.scan(arg);
  }

  function openStock(symbol) {
    setPage("stock", symbol);
  }

  function openAiAnalysis(symbol) {
    setPage("ai-analysis", symbol);
  }

  function openBuyList() {
    setPage("buylist");
  }

  function applyLanguageFromSettings() {
    const lang = window.MySpaceAppLanguage?.resolve?.() || "en";
    window.StocksI18n?.applyDom?.(lang);
    window.MySpaceI18n?.setLanguage?.(lang, { force: true });
    applyPageMeta(activePage?.id || "dashboard");
  }

  function syncUiLayoutSetting(reloadIfChanged = true) {
    const layout = window.AppSettingsRuntime?.get?.("uiLayout") || "organized";
    let prev = "organized";
    try {
      prev = localStorage.getItem("myspace-stocks-ui-layout") || "organized";
      localStorage.setItem("myspace-stocks-ui-layout", layout);
    } catch (_) {
    }
    if (!reloadIfChanged || layout === prev) return;
    const wantClassic = layout === "classic";
    const onLegacy = /index\.legacy\.html$/i.test(location.pathname || location.href);
    if (wantClassic && !onLegacy) location.replace("index.legacy.html");
    else if (!wantClassic && onLegacy) location.replace("index.html");
  }

  ui.nav.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-item[data-page]");
    if (!btn || btn.dataset.page === "app-settings") return;
    setPage(btn.dataset.page);
  });

  ui.modeBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleModeMenu();
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".mode-switcher")) closeModeMenu();
  });

  pages.forEach((p) => {
    if (p.bind) p.bind(ui);
  });

  window.StocksI18n?.setOnApply?.(() => {
    applyPageMeta(activePage?.id || "dashboard");
  });

  window.AppSettingsRuntime?.onApplied?.(() => {
    applyLanguageFromSettings();
    syncUiLayoutSetting(true);
    if (activePage?.id === "dashboard" && activePage.reschedule) {
      activePage.reschedule();
    }
  });

  document.addEventListener("app-setting-changed", (e) => {
    if (e.detail?.appId !== "stocks") return;
    if (e.detail.key === "uiLanguage" || e.detail.key === "language") applyLanguageFromSettings();
    if (e.detail.key === "uiLayout") syncUiLayoutSetting(true);
    if (e.detail.key === "autoRefresh" || e.detail.key === "refreshSeconds") {
      window.StocksPages?.dashboard?.reschedule?.();
    }
  });

  window.StocksApp = { setPage, openStock, openAiAnalysis, openBuyList, setMode, getActiveMode: () => activeMode };

  loadModes().then(() => {
    applyLanguageFromSettings();
    syncUiLayoutSetting(false);
    setPage("dashboard");
  });
})();