(function () {
  let focus = {
    enabled: false,
    source: null,
    silenceNotifications: true,
    desktopOnly: true,
    startedAt: null,
  };
  let banner = null;
  let unsub = null;

  function getState() {
    return { ...focus };
  }

  function isActive() {
    return !!focus.enabled;
  }

  function ensureBanner() {
    if (banner) return banner;
    banner = document.createElement("div");
    banner.className = "focus-banner hidden";
    banner.innerHTML = `
      <span class="focus-banner-label">Focus</span>
      <span class="focus-banner-meta"></span>
      <button type="button" class="focus-banner-end">End focus</button>`;
    banner.querySelector(".focus-banner-end").addEventListener("click", () => exit());
    document.querySelector(".workspace")?.appendChild(banner);
    return banner;
  }

  function applyChrome() {
    const shell = document.getElementById("desktop");
    shell?.classList.toggle("focus-mode", !!focus.enabled);
    const b = ensureBanner();
    if (!focus.enabled) {
      b.classList.add("hidden");
      return;
    }
    b.classList.remove("hidden");
    const src = focus.source === "pomodoro" ? "Pomodoro" : "Manual";
    b.querySelector(".focus-banner-meta").textContent = `${src} · notifications silenced`;
  }

  function setLocal(next) {
    focus = {
      enabled: !!next?.enabled,
      source: next?.source || null,
      silenceNotifications: next?.silenceNotifications !== false,
      desktopOnly: next?.desktopOnly !== false,
      startedAt: next?.startedAt || null,
    };
    applyChrome();
    window.__myspaceAiRefreshDesktop?.();
  }

  async function enter(opts = {}) {
    const res = await window.mySpace?.shellUx?.("focus.enter", {
      source: opts.source || "manual",
      silenceNotifications: opts.silenceNotifications !== false,
      desktopOnly: window.MySpaceConfig?.getSettings?.()?.focusDesktopOnly !== false,
    });
    if (res?.focus) setLocal(res.focus);
    else if (res?.ok) setLocal({ enabled: true, ...opts });
    window.showMySpaceToast?.("Focus on — notifications paused");
    return res;
  }

  async function exit() {
    const res = await window.mySpace?.shellUx?.("focus.exit");
    if (res?.focus) setLocal(res.focus);
    else setLocal({ enabled: false });
    window.showMySpaceToast?.("Focus ended");
    return res;
  }

  async function toggle() {
    return isActive() ? exit() : enter({ source: "manual" });
  }

  function allowedAppIds() {
    if (!focus.enabled || !focus.desktopOnly) return null;
    if (window.MySpaceConfig?.getSettings?.()?.focusDesktopOnly === false) return null;
    const ids = new Set(["day-planner"]);
    const tab = window.MySpaceWorkspace?.getActiveTab?.();
    if (tab?.appId) ids.add(tab.appId);
    if (focus.source === "pomodoro") ids.add("world-clock");
    return ids;
  }

  function init() {
    ensureBanner();
    unsub?.();
    unsub = window.mySpace?.onFocusChanged?.((data) => setLocal(data || {}));
    window.mySpace?.shellUx?.("focus.get").then((res) => {
      if (res?.focus) setLocal(res.focus);
    }).catch(() => {});
  }

  window.MySpaceFocus = {
    init,
    getState,
    isActive,
    enter,
    exit,
    toggle,
    allowedAppIds,
  };
})();