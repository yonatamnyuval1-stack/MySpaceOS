(function () {
  const PAGE_META = {
    devices: { titleKey: "service.bridge.devices", subtitleKey: "service.bridge.devicesSub" },
    places: { titleKey: "service.bridge.places", subtitleKey: "service.bridge.placesSub" },
    actions: { titleKey: "service.bridge.share", subtitleKey: "service.bridge.shareSub" },
    host: { titleKey: "service.bridge.host", subtitleKey: "service.bridge.hostSub" },
  };

  const ui = {
    nav: document.getElementById("main-nav"),
    title: document.getElementById("page-title"),
    subtitle: document.getElementById("page-subtitle"),
    brandSub: document.getElementById("brand-sub"),
    sidebarStatus: document.getElementById("sidebar-status"),
  };

  let active = "devices";

  function tt(key, vars) {
    const fn = window.MySpaceI18n?.t;
    return typeof fn === "function" ? fn(key, vars) : key;
  }

  function pageEl(id) {
    return document.getElementById(`page-${id}`);
  }

  function paintPageChrome(pageId) {
    const id = PAGE_META[pageId] ? pageId : "devices";
    const meta = PAGE_META[id];
    if (ui.title) ui.title.textContent = tt(meta.titleKey);
    if (ui.subtitle) ui.subtitle.textContent = tt(meta.subtitleKey);
    if (ui.brandSub) ui.brandSub.textContent = tt(meta.titleKey);
  }

  async function setActivePage(page) {
    const id = PAGE_META[page] ? page : "devices";
    active = id;
    paintPageChrome(id);

    document.querySelectorAll(".page").forEach((el) => {
      const on = el.dataset.page === id;
      el.hidden = !on;
      el.classList.toggle("active", on);
    });
    ui.nav?.querySelectorAll(".nav-item").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.page === id);
    });

    const mount = pageEl(id);
    const pageApi = window.OsBridgePages?.[id];
    if (mount && pageApi?.mount) await pageApi.mount(mount);
    else if (pageApi?.refresh) await pageApi.refresh();
  }

  async function refreshStatus() {
    try {
      const st = await window.OsBridge.invoke("status");
      const pair = st.pair || {};
      if (ui.sidebarStatus) {
        ui.sidebarStatus.textContent = pair.running
          ? tt("service.bridge.sidebarPairing", {
              port: pair.port,
              count: pair.devices?.length || 0,
            })
          : tt("service.bridge.sidebarLocal");
      }
    } catch {
    }
  }

  function bindNav() {
    ui.nav?.addEventListener("click", (e) => {
      const btn = e.target.closest?.("[data-page]");
      if (!btn) return;
      void setActivePage(btn.dataset.page);
    });
  }

  function onI18nApplied() {
    paintPageChrome(active);
    void refreshStatus();
    const pageApi = window.OsBridgePages?.[active];
    if (pageApi?.refresh) void pageApi.refresh();
  }

  async function init() {
    bindNav();
    window.addEventListener("myspace-i18n-applied", onI18nApplied);
    await setActivePage("devices");
    await refreshStatus();
    setInterval(refreshStatus, 8000);
  }

  window.OsBridgeApp = {
    setActivePage,
    setPage: setActivePage,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
