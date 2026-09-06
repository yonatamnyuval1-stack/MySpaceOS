(function (root) {
  const { formatTimerDisplay } = root.ClockUtils;
  const { notifyTimerDone } = root.ClockAudio;

  const page = {
    id: "timer",
    page: null,
    tickTimer: null,
    totalSec: 0,
    remainingSec: 0,
    running: false,
    endAt: 0,
    label: "Timer",

    bind() {
      this.page = document.getElementById("page-timer");
      const presets = this.page.querySelectorAll("[data-preset-sec]");
      presets.forEach((btn) => {
        btn.addEventListener("click", () => {
          const sec = parseInt(btn.dataset.presetSec, 10);
          this.setDuration(sec);
        });
      });

      this.page.querySelector("#timer-start").addEventListener("click", () => this.start());
      this.page.querySelector("#timer-pause").addEventListener("click", () => this.pause());
      this.page.querySelector("#timer-reset").addEventListener("click", () => this.reset());

      ["h", "m", "s"].forEach((u) => {
        const el = this.page.querySelector(`#timer-${u}`);
        el.addEventListener("change", () => this.readInputs());
      });
    },

    start() {
      if (this.running) return;
      if (this.remainingSec <= 0) this.readInputs();
      if (this.remainingSec <= 0) return;
      this.running = true;
      this.endAt = Date.now() + this.remainingSec * 1000;
      this.updateUi();
      this.tick();
      this.persist();
    },

    pause() {
      this.running = false;
      if (this.tickTimer) clearInterval(this.tickTimer);
      this.tickTimer = null;
      this.updateUi();
      this.persist();
    },

    reset() {
      this.running = false;
      if (this.tickTimer) clearInterval(this.tickTimer);
      this.tickTimer = null;
      this.remainingSec = this.totalSec;
      this.page.classList.remove("timer-done");
      this.updateUi();
      this.persist();
    },

    setDuration(sec) {
      this.totalSec = Math.max(0, sec);
      this.remainingSec = this.totalSec;
      this.running = false;
      if (this.tickTimer) clearInterval(this.tickTimer);
      this.tickTimer = null;
      this.syncInputsFromSec();
      this.updateUi();
      this.persist();
    },

    readInputs() {
      const h = parseInt(this.page.querySelector("#timer-h").value, 10) || 0;
      const m = parseInt(this.page.querySelector("#timer-m").value, 10) || 0;
      const s = parseInt(this.page.querySelector("#timer-s").value, 10) || 0;
      const sec = h * 3600 + m * 60 + s;
      this.totalSec = sec;
      this.remainingSec = sec;
      this.updateUi();
    },

    syncInputsFromSec() {
      const t = this.totalSec;
      const h = Math.floor(t / 3600);
      const m = Math.floor((t % 3600) / 60);
      const s = t % 60;
      this.page.querySelector("#timer-h").value = h;
      this.page.querySelector("#timer-m").value = m;
      this.page.querySelector("#timer-s").value = s;
    },

    tick() {
      if (this.tickTimer) clearInterval(this.tickTimer);
      this.tickTimer = setInterval(() => {
        if (!this.running) return;
        this.remainingSec = Math.max(0, Math.ceil((this.endAt - Date.now()) / 1000));
        this.updateUi();
        if (this.remainingSec <= 0) this.finish();
      }, 200);
    },

    async finish() {
      this.running = false;
      if (this.tickTimer) clearInterval(this.tickTimer);
      this.tickTimer = null;
      this.remainingSec = 0;
      this.page.classList.add("timer-done");
      this.updateUi();
      await root.ClockStorage?.clearTimer?.();
      await notifyTimerDone(this.label);
    },

    persist() {
      const payload = {
        label: this.label || "Timer",
        totalSec: this.totalSec,
        remainingSec: this.remainingSec,
        running: this.running,
        endAt: this.running ? this.endAt : 0,
        updatedAt: Date.now(),
      };
      root.ClockStorage?.saveTimer?.(payload);
    },

    updateUi() {
      const display = this.page.querySelector("#timer-display");
      const ring = this.page.querySelector("#timer-ring-progress");
      const status = this.page.querySelector("#timer-status");
      display.textContent = formatTimerDisplay(this.remainingSec);
      const pct =
        this.totalSec > 0 ? ((this.totalSec - this.remainingSec) / this.totalSec) * 100 : 0;
      if (ring) ring.style.strokeDashoffset = String(283 - (283 * pct) / 100);
      status.textContent = this.running
        ? "Running…"
        : this.remainingSec <= 0 && this.totalSec > 0
          ? "Finished"
          : "Ready";
      this.page.querySelector("#timer-start").disabled = this.running;
      this.page.querySelector("#timer-pause").disabled = !this.running;
    },

    activate() {
      this.applyStoredTimer();
    },

    async applyStoredTimer() {
      try {
        await root.ClockStorage?.load?.();
        const stored = await root.ClockStorage?.getTimer?.();
        if (!stored || !stored.totalSec) {
          this.setDuration(5 * 60);
          return;
        }
        this.label = stored.label || "Timer";
        this.totalSec = stored.totalSec;
        if (stored.running && stored.endAt) {
          this.remainingSec = Math.max(0, Math.ceil((stored.endAt - Date.now()) / 1000));
          this.syncInputsFromSec();
          this.updateUi();
          if (this.remainingSec > 0) {
            this.running = true;
            this.endAt = stored.endAt;
            this.tick();
            this.persist();
          } else {
            await this.finish();
          }
        } else {
          this.remainingSec = stored.remainingSec || stored.totalSec;
          this.running = false;
          this.syncInputsFromSec();
          this.updateUi();
        }
      } catch {
        this.setDuration(5 * 60);
      }
    },

    deactivate() {
      if (this.running) this.persist();
      else this.pause();
    },
  };

  root.ClockPages = root.ClockPages || {};
  root.ClockPages.timer = page;
})(window);