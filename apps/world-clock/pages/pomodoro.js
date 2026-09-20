(function (root) {
  function tt(key, fallback, vars) {
    const I = root.MySpaceI18n;
    if (!I?.t) return fallback || key;
    const v = I.t(key, vars);
    return v === key ? (fallback || key) : v;
  }

  const { formatTimerDisplay } = root.ClockUtils;
  const { notifyPomodoro } = root.ClockAudio;
  const { getPomodoro, savePomodoro, load } = root.ClockStorage;

  const PHASE = {
    work: "work",
    shortBreak: "shortBreak",
    longBreak: "longBreak",
  };

  function phaseMeta() {
    return {
      work: {
        label: tt("app.worldClock.pomo.focus", "Focus"),
        badge: tt("app.worldClock.pomo.workBadge", "Work session"),
        notifyTitle: tt("app.worldClock.pomo.focusDone", "Focus complete"),
        notifyBody: tt("app.worldClock.pomo.focusDoneBody", "Great work! Time for a break."),
        nextAuto: (s) => (s.cycleCount >= s.settings.longEvery ? PHASE.longBreak : PHASE.shortBreak),
      },
      shortBreak: {
        label: tt("app.worldClock.pomo.shortBreak", "Short break"),
        badge: tt("app.worldClock.pomo.shortBreak", "Short break"),
        notifyTitle: tt("app.worldClock.pomo.breakOver", "Break over"),
        notifyBody: tt("app.worldClock.pomo.breakOverBody", "Ready for another focus session?"),
        nextAuto: () => PHASE.work,
      },
      longBreak: {
        label: tt("app.worldClock.pomo.longBreak", "Long break"),
        badge: tt("app.worldClock.pomo.longBreak", "Long break"),
        notifyTitle: tt("app.worldClock.pomo.longOver", "Long break over"),
        notifyBody: tt("app.worldClock.pomo.longOverBody", "You earned it. Start a new focus round."),
        nextAuto: () => PHASE.work,
      },
    };
  }

  const page = {
    id: "pomodoro",
    page: null,
    tickTimer: null,
    phase: PHASE.work,
    running: false,
    totalSec: 0,
    remainingSec: 0,
    endAt: 0,
    settings: null,
    stats: null,
    cycleCount: 0,

    bind() {
      this.page = document.getElementById("page-pomodoro");
      this.page.querySelector("#pomo-start").addEventListener("click", () => this.toggleRun());
      this.page.querySelector("#pomo-skip").addEventListener("click", () => this.skip());
      this.page.querySelector("#pomo-reset").addEventListener("click", () => this.resetRound());

      const settingsPanel = this.page.querySelector("#pomo-settings");
      this.page.querySelector("#pomo-settings-toggle").addEventListener("click", () => {
        settingsPanel.hidden = !settingsPanel.hidden;
      });

      ["work", "short", "long", "every"].forEach((key) => {
        const el = this.page.querySelector(`#pomo-${key}`);
        el.addEventListener("change", () => this.applySettingsFromForm());
      });

      this.page.querySelector("#pomo-auto-break").addEventListener("change", () => this.applySettingsFromForm());
      this.page.querySelector("#pomo-auto-work").addEventListener("change", () => this.applySettingsFromForm());
    },

    async activate() {
      await load();
      const data = await getPomodoro();
      this.settings = data.settings;
      this.stats = data.stats;
      this.cycleCount = this.stats.completed % this.settings.longEvery;
      this.phase = PHASE.work;
      this.running = false;
      this.setPhaseDuration(PHASE.work);
      this.syncSettingsForm();
      this.updateUi();
      const pending = await root.ClockStorage?.consumePomodoroPendingStart?.();
      if (pending) this.start();
      const pendingPause = await root.ClockStorage?.consumePomodoroPendingPause?.();
      if (pendingPause) this.pause();
    },

    deactivate() {
      this.pause();
    },

    toggleRun() {
      if (this.running) this.pause();
      else this.start();
    },

    start() {
      if (this.remainingSec <= 0) this.setPhaseDuration(this.phase);
      if (this.remainingSec <= 0) return;
      this.running = true;
      this.endAt = Date.now() + this.remainingSec * 1000;
      this.page.classList.remove("pomo-done");
      this.updateUi();
      this.tick();
      if (this.phase === PHASE.work) {
        window.myApp?.invoke?.("focus.enter", { source: "pomodoro" }).catch?.(() => {});
      }
    },

    pause() {
      this.running = false;
      if (this.tickTimer) clearInterval(this.tickTimer);
      this.tickTimer = null;
      this.updateUi();
      if (this.phase === PHASE.work) {
        window.myApp?.invoke?.("focus.exit").catch?.(() => {});
      }
    },

    tick() {
      if (this.tickTimer) clearInterval(this.tickTimer);
      this.tickTimer = setInterval(() => {
        if (!this.running) return;
        this.remainingSec = Math.max(0, Math.ceil((this.endAt - Date.now()) / 1000));
        this.updateUi();
        if (this.remainingSec <= 0) this.onPhaseEnd();
      }, 200);
    },

    async onPhaseEnd() {
      this.pause();
      this.remainingSec = 0;
      this.page.classList.add("pomo-done");

      const meta = phaseMeta()[this.phase];
      await notifyPomodoro(meta.notifyTitle, meta.notifyBody);

      if (this.phase === PHASE.work) {
        await this.completeWorkSession();
      }

      const next =
        this.phase === PHASE.work
          ? this.stats.completed % this.settings.longEvery === 0
            ? PHASE.longBreak
            : PHASE.shortBreak
          : PHASE.work;
      const auto =
        (this.phase === PHASE.work && this.settings.autoStartBreaks) ||
        (this.phase !== PHASE.work && this.settings.autoStartWork);

      this.enterPhase(next, auto);
    },

    async completeWorkSession() {
      const today = new Date().toISOString().slice(0, 10);
      if (this.stats.date !== today) {
        this.stats = { date: today, completed: 0 };
      }
      this.stats.completed += 1;
      this.cycleCount = this.stats.completed % this.settings.longEvery;
      await savePomodoro({ settings: this.settings, stats: this.stats });
    },

    enterPhase(phase, autoStart) {
      this.phase = phase;
      if (phase === PHASE.work && this.cycleCount === 0 && this.stats.completed > 0) {
        /* new round after long break */
      }
      this.setPhaseDuration(phase);
      this.page.classList.remove("pomo-done");
      this.updateUi();
      if (autoStart) setTimeout(() => this.start(), 600);
    },

    skip() {
      this.pause();
      if (this.phase === PHASE.work) {
        const next =
          (this.stats.completed + 1) % this.settings.longEvery === 0
            ? PHASE.longBreak
            : PHASE.shortBreak;
        this.enterPhase(next, false);
      } else {
        this.enterPhase(PHASE.work, false);
      }
    },

    resetRound() {
      this.pause();
      this.phase = PHASE.work;
      this.cycleCount = this.stats.completed % this.settings.longEvery;
      this.setPhaseDuration(PHASE.work);
      this.page.classList.remove("pomo-done");
      this.updateUi();
    },

    setPhaseDuration(phase) {
      const min =
        phase === PHASE.work
          ? this.settings.workMin
          : phase === PHASE.shortBreak
            ? this.settings.shortBreakMin
            : this.settings.longBreakMin;
      this.totalSec = min * 60;
      this.remainingSec = this.totalSec;
    },

    durationMinForPhase(phase) {
      if (phase === PHASE.work) return this.settings.workMin;
      if (phase === PHASE.shortBreak) return this.settings.shortBreakMin;
      return this.settings.longBreakMin;
    },

    async applySettingsFromForm() {
      this.settings = {
        workMin: parseInt(this.page.querySelector("#pomo-work").value, 10) || 25,
        shortBreakMin: parseInt(this.page.querySelector("#pomo-short").value, 10) || 5,
        longBreakMin: parseInt(this.page.querySelector("#pomo-long").value, 10) || 15,
        longEvery: parseInt(this.page.querySelector("#pomo-every").value, 10) || 4,
        autoStartBreaks: this.page.querySelector("#pomo-auto-break").checked,
        autoStartWork: this.page.querySelector("#pomo-auto-work").checked,
      };
      await savePomodoro({ settings: this.settings, stats: this.stats });
      if (!this.running) this.setPhaseDuration(this.phase);
      this.cycleCount = this.stats.completed % this.settings.longEvery;
      this.updateUi();
    },

    syncSettingsForm() {
      const s = this.settings;
      this.page.querySelector("#pomo-work").value = s.workMin;
      this.page.querySelector("#pomo-short").value = s.shortBreakMin;
      this.page.querySelector("#pomo-long").value = s.longBreakMin;
      this.page.querySelector("#pomo-every").value = s.longEvery;
      this.page.querySelector("#pomo-auto-break").checked = s.autoStartBreaks;
      this.page.querySelector("#pomo-auto-work").checked = s.autoStartWork;
    },

    updateUi() {
      const meta = phaseMeta()[this.phase];
      this.page.dataset.phase = this.phase;

      this.page.querySelector("#pomo-display").textContent = formatTimerDisplay(this.remainingSec);
      this.page.querySelector("#pomo-phase-label").textContent = meta.label;
      this.page.querySelector("#pomo-phase-badge").textContent = meta.badge;

      const ring = this.page.querySelector("#pomo-ring-progress");
      const pct =
        this.totalSec > 0 ? ((this.totalSec - this.remainingSec) / this.totalSec) * 100 : 0;
      if (ring) ring.style.strokeDashoffset = String(283 - (283 * pct) / 100);

      const status = this.page.querySelector("#pomo-status");
      status.textContent = this.running
        ? tt("app.worldClock.pomo.inProgress", "In progress…")
        : this.remainingSec <= 0
          ? tt("app.worldClock.pomo.phaseComplete", "Phase complete")
          : tt("app.worldClock.pomo.ready", "Ready");

      const startBtn = this.page.querySelector("#pomo-start");
      startBtn.textContent = this.running
        ? tt("app.worldClock.pomo.pause", "Pause")
        : tt("app.worldClock.pomo.start", "Start");
      startBtn.classList.toggle("btn-warn", this.running);

      this.page.querySelector("#pomo-today").textContent = String(this.stats.completed);
      this.page.querySelector("#pomo-cycle").textContent = `${this.cycleCount} / ${this.settings.longEvery}`;

      const dots = this.page.querySelector("#pomo-dots");
      dots.innerHTML = "";
      for (let i = 0; i < this.settings.longEvery; i++) {
        const dot = document.createElement("span");
        dot.className = "pomo-dot";
        if (i < this.cycleCount) dot.classList.add("filled");
        if (i === this.cycleCount && this.phase === PHASE.work && this.running) dot.classList.add("active");
        dots.appendChild(dot);
      }

      const nextEl = this.page.querySelector("#pomo-next");
      if (this.phase === PHASE.work) {
        const isLong = (this.stats.completed + 1) % this.settings.longEvery === 0;
        nextEl.textContent = isLong
          ? tt("app.worldClock.pomo.afterLong", `After this: Long break (${this.settings.longBreakMin}m)`, {
              n: this.settings.longBreakMin,
            })
          : tt("app.worldClock.pomo.afterShort", `After this: Short break (${this.settings.shortBreakMin}m)`, {
              n: this.settings.shortBreakMin,
            });
      } else if (this.phase === PHASE.shortBreak) {
        nextEl.textContent = tt(
          "app.worldClock.pomo.afterFocus",
          `After this: Focus (${this.settings.workMin}m)`,
          { n: this.settings.workMin }
        );
      } else {
        nextEl.textContent = tt(
          "app.worldClock.pomo.afterNewRound",
          `After this: New round · Focus (${this.settings.workMin}m)`,
          { n: this.settings.workMin }
        );
      }
    },

    repaintI18n() {
      this.updateUi();
    },
  };

  root.ClockPages = root.ClockPages || {};
  root.ClockPages.pomodoro = page;
})(window);