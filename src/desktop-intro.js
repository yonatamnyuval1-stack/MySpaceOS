(function () {
  const SESSION_KEY = "myspace-desktop-intro-shown-v1";
  let bound = false;
  let shownThisBoot = false;

  function tt(key, fallback) {
    try {
      const I = window.MySpaceI18n;
      if (I?.t) {
        const out = I.t(key);
        if (out && out !== key) return out;
      }
    } catch {
    }
    return fallback || key;
  }

  function splashGone() {
    if (document.documentElement.classList.contains("boot-splash-skip")) return true;
    if (!document.documentElement.classList.contains("booting")) return true;
    const splash = document.getElementById("boot-splash");
    if (!splash) return true;
    if (splash.classList.contains("is-done")) return true;
    return false;
  }

  function hide() {
    const el = document.getElementById("desktop-intro");
    if (!el) return;
    el.classList.remove("is-visible");
    el.classList.add("hidden");
    el.setAttribute("hidden", "");
  }

  async function show(opts = {}) {
    if (shownThisBoot && !opts.force) return;
    if (!splashGone() && !opts.force) return;
    const el = document.getElementById("desktop-intro");
    if (!el) {
      console.warn("[desktop-intro] #desktop-intro missing");
      return;
    }
    shownThisBoot = true;
    try {
      const builtin = document.getElementById("builtin-panel");
      const grid = document.getElementById("app-grid");
      if (builtin && !builtin.classList.contains("hidden")) {
        builtin.classList.add("hidden");
        grid?.classList.remove("hidden");
      }
      await window.MySpaceWorkspace?.minimizeToDesktop?.();
    } catch (err) {
      console.warn("[desktop-intro] minimize failed", err);
    }
    const brand = el.querySelector(".desktop-intro-brand");
    const line = el.querySelector(".desktop-intro-line");
    const enterBtn = document.getElementById("desktop-intro-enter");
    if (brand) brand.textContent = tt("shell.intro.brand", "My Space");
    if (line) {
      line.textContent = tt("shell.intro.line", "Your personal space on this computer.");
    }
    if (enterBtn) enterBtn.textContent = tt("shell.intro.enter", "Enter desktop");
    el.removeAttribute("hidden");
    el.classList.remove("hidden");
    requestAnimationFrame(() => el.classList.add("is-visible"));
    if (!bound) {
      bound = true;
      const finish = () => hide();
      el.querySelectorAll("[data-intro-dismiss]").forEach((node) => {
        node.addEventListener("click", finish);
      });
      enterBtn?.addEventListener("click", finish);
      document.addEventListener("keydown", function onIntroKey(e) {
        if (el.classList.contains("hidden")) return;
        if (e.key === "Escape" || e.key === "Enter") {
          e.preventDefault();
          finish();
        }
      });
    }
    try {
      enterBtn?.focus?.({ preventScroll: true });
    } catch {
      enterBtn?.focus?.();
    }
    try {
      sessionStorage.setItem(SESSION_KEY, String(Date.now()));
    } catch {
    }
  }

  function scheduleShow() {
    if (new URLSearchParams(location.search).get("secondary") === "1") return;
    const tryShow = () => {
      if (!splashGone()) return false;
      setTimeout(() => {
        void show();
      }, 120);
      return true;
    };

    if (tryShow()) return;
    const obs = new MutationObserver(() => {
      if (tryShow()) obs.disconnect();
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    const splash = document.getElementById("boot-splash");
    if (splash) {
      obs.observe(splash, { attributes: true, attributeFilter: ["class"] });
    }
    setTimeout(() => {
      obs.disconnect();
      void show();
    }, 8000);
  }
  window.MySpaceDesktopIntro = {
    show,
    hide,
    isOpen: () => {
      const el = document.getElementById("desktop-intro");
      return !!(el && !el.classList.contains("hidden"));
    },
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleShow);
  } else {
    scheduleShow();
  }
})();