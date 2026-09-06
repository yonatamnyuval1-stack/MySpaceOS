(function () {
  const PAGE_META = {
    local: {
      title: "Local time",
      subtitle: "Your system clock and timezone",
    },
    world: {
      title: "World clocks",
      subtitle: "Search countries and cities, pin clocks worldwide",
    },
    meetings: {
      title: "Meeting planner",
      subtitle: "Add cities, pick a date — see the best time to call in plain language",
    },
    timer: {
      title: "Timer",
      subtitle: "Countdown with sound and desktop alert when done",
    },
    pomodoro: {
      title: "Pomodoro",
      subtitle: "Focus sessions with short and long breaks",
    },
    stopwatch: {
      title: "Stopwatch",
      subtitle: "Precise timing with lap splits",
    },
  };

  const pages = [
    window.ClockPages.local,
    window.ClockPages.world,
    window.ClockPages.meetings,
    window.ClockPages.timer,
    window.ClockPages.pomodoro,
    window.ClockPages.stopwatch,
  ];

  const ui = {
    nav: document.getElementById("main-nav"),
    title: document.getElementById("page-title"),
    subtitle: document.getElementById("page-subtitle"),
    brandSub: document.getElementById("brand-sub"),
  };

  let activePage = pages[0];

  function setActivePage(pageId) {
    const next = pages.find((p) => p.id === pageId) || pages[0];
    if (activePage && activePage !== next && activePage.deactivate) activePage.deactivate();

    activePage = next;

    pages.forEach((p) => {
      const on = p.id === next.id;
      p.page.hidden = !on;
      p.page.classList.toggle("active", on);
    });

    ui.nav.querySelectorAll(".nav-item").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.page === next.id);
    });

    const meta = PAGE_META[next.id] || PAGE_META.local;
    ui.title.textContent = meta.title;
    ui.subtitle.textContent = meta.subtitle;
    ui.brandSub.textContent = `v1.2 · ${meta.title}`;

    if (next.activate) next.activate();
  }

  ui.nav.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-item[data-page]");
    if (!btn || btn.dataset.page === "app-settings") return;
    setActivePage(btn.dataset.page);
  });

  pages.forEach((p) => {
    if (p.bind) p.bind();
  });

  const countriesEl = document.getElementById("stat-countries");
  const zonesEl = document.getElementById("stat-zones");
  if (countriesEl && window.ClockCountryData) {
    countriesEl.textContent = `${window.ClockCountryData.list.length}+`;
  }
  if (zonesEl && window.ClockTime) {
    try {
      zonesEl.textContent = String(window.ClockTime.getAllTimeZones().length);
    } catch (_) {
      zonesEl.textContent = "400+";
    }
  }

  window.ClockStorage.load().then(() => setActivePage("local"));

  function coerceSec(value) {
    if (value == null || value === "") return null;
    if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
    const raw = String(value).trim().toLowerCase().replace(/\s+/g, "");
    if (!raw) return null;
    if (/^\d+$/.test(raw)) return parseInt(raw, 10) * 60;
    if (/^\d+:\d{2}(:\d{2})?$/.test(raw)) {
      const parts = raw.split(":").map((n) => parseInt(n, 10));
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    let total = 0;
    let matched = false;
    const re = /(\d+)(h|hr|hours?|m|min|minutes?|s|sec|seconds?)/gi;
    let m;
    while ((m = re.exec(raw))) {
      matched = true;
      const n = parseInt(m[1], 10);
      const u = m[2].toLowerCase();
      if (u.startsWith("h")) total += n * 3600;
      else if (u.startsWith("m")) total += n * 60;
      else total += n;
    }
    return matched ? total : null;
  }

  function startTimer(secOrOpts, label) {
    let sec = null;
    let lbl = label;
    if (secOrOpts && typeof secOrOpts === "object") {
      sec =
        coerceSec(secOrOpts.duration ?? secOrOpts.sec ?? secOrOpts.seconds ?? secOrOpts.param) ??
        (Number.isFinite(Number(secOrOpts.minutes)) ? Math.round(Number(secOrOpts.minutes) * 60) : null);
      lbl = secOrOpts.label ?? lbl;
    } else {
      sec = coerceSec(secOrOpts);
    }
    if (!sec || sec <= 0) return { ok: false, error: "Need a positive duration" };
    setActivePage("timer");
    const page = window.ClockPages.timer;
    if (lbl) page.label = String(lbl).slice(0, 80);
    page.setDuration(sec);
    page.start();
    return { ok: true, totalSec: sec, label: page.label };
  }

  function pauseTimer() {
    setActivePage("timer");
    window.ClockPages.timer.pause();
    return { ok: true };
  }

  function stopTimer() {
    setActivePage("timer");
    window.ClockPages.timer.reset();
    return { ok: true };
  }

  async function syncTimerFromStorage() {
    setActivePage("timer");
    await window.ClockPages.timer.applyStoredTimer();
    return { ok: true };
  }

  async function startPomodoro(opts) {
    if (opts && typeof opts === "object") {
      try {
        await window.ClockStorage?.load?.();
        const data = await window.ClockStorage?.getPomodoro?.();
        if (data?.settings) {
          if (opts.workMin != null) data.settings.workMin = Math.min(120, Math.max(1, parseInt(opts.workMin, 10) || data.settings.workMin));
          if (opts.shortBreakMin != null)
            data.settings.shortBreakMin = Math.min(60, Math.max(1, parseInt(opts.shortBreakMin, 10) || data.settings.shortBreakMin));
          if (opts.longBreakMin != null)
            data.settings.longBreakMin = Math.min(60, Math.max(1, parseInt(opts.longBreakMin, 10) || data.settings.longBreakMin));
          await window.ClockStorage?.savePomodoro?.({ settings: data.settings, stats: data.stats });
        }
      } catch {
      }
    }
    setActivePage("pomodoro");
    const page = window.ClockPages.pomodoro;
    if (!page.running) page.start();
    return { ok: true };
  }

  function pausePomodoro() {
    setActivePage("pomodoro");
    window.ClockPages.pomodoro.pause();
    return { ok: true };
  }

  function startStopwatch() {
    setActivePage("stopwatch");
    const page = window.ClockPages.stopwatch;
    if (!page.running) page.start();
    return { ok: true };
  }

  window.ClockApp = {
    setActivePage,
    openWorld: () => setActivePage("world"),
    startTimer,
    pauseTimer,
    stopTimer,
    syncTimerFromStorage,
    startPomodoro,
    pausePomodoro,
    startStopwatch,
  };

  window.MySpaceThemeRuntime?.listen?.("world-clock");
  void window.MySpaceThemeRuntime?.boot?.("world-clock");
})();