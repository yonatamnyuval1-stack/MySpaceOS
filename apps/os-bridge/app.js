(function () {
  const PAGE_META = {
    devices: { title: "Devices", subtitle: "Pair a phone on the same Wi‑Fi." },
    places: { title: "Places", subtitle: "Host folders, drives, and favorites on this PC" },
    actions: { title: "Share", subtitle: "Clipboard, paths, and open-outside actions" },
    host: { title: "Host", subtitle: "Windows sound, display, Bluetooth, printers" },
  };

  const ui = {
    nav: document.getElementById("main-nav"),
    title: document.getElementById("page-title"),
    subtitle: document.getElementById("page-subtitle"),
    brandSub: document.getElementById("brand-sub"),
    sidebarStatus: document.getElementById("sidebar-status"),
  };

  let active = "devices";

  function pageEl(id) {
    return document.getElementById(`page-${id}`);
  }

  async function setActivePage(page) {
    const id = PAGE_META[page] ? page : "devices";
    active = id;
    const meta = PAGE_META[id];
    if (ui.title) ui.title.textContent = meta.title;
    if (ui.subtitle) ui.subtitle.textContent = meta.subtitle;
    if (ui.brandSub) ui.brandSub.textContent = meta.title;

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
          ? `Pairing on :${pair.port} · ${pair.devices?.length || 0} device(s)`
          : "Local Wi‑Fi · not Remote Hub";
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

  async function init() {
    bindNav();
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