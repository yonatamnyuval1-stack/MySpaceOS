(function (root) {
  const { formatMs } = root.ClockUtils;

  const page = {
    id: "stopwatch",
    page: null,
    tickTimer: null,
    running: false,
    startTime: 0,
    elapsed: 0,
    laps: [],

    bind() {
      this.page = document.getElementById("page-stopwatch");
      this.page.querySelector("#sw-start").addEventListener("click", () => this.toggle());
      this.page.querySelector("#sw-lap").addEventListener("click", () => this.lap());
      this.page.querySelector("#sw-reset").addEventListener("click", () => this.reset());
    },

    toggle() {
      if (this.running) this.pause();
      else this.start();
    },

    start() {
      this.running = true;
      this.startTime = Date.now() - this.elapsed;
      this.tick();
      this.updateButtons();
    },

    pause() {
      this.running = false;
      this.elapsed = Date.now() - this.startTime;
      if (this.tickTimer) clearInterval(this.tickTimer);
      this.tickTimer = null;
      this.renderDisplay();
      this.updateButtons();
    },

    reset() {
      this.running = false;
      this.elapsed = 0;
      this.laps = [];
      if (this.tickTimer) clearInterval(this.tickTimer);
      this.tickTimer = null;
      this.renderDisplay();
      this.renderLaps();
      this.updateButtons();
    },

    lap() {
      if (!this.running && this.elapsed === 0) return;
      const now = this.running ? Date.now() - this.startTime : this.elapsed;
      const prev = this.laps.length ? this.laps[0].total : 0;
      this.laps.unshift({
        index: this.laps.length + 1,
        total: now,
        split: now - prev,
      });
      this.renderLaps();
    },

    tick() {
      if (this.tickTimer) clearInterval(this.tickTimer);
      this.tickTimer = setInterval(() => this.renderDisplay(), 47);
    },

    renderDisplay() {
      const t = this.running ? Date.now() - this.startTime : this.elapsed;
      this.page.querySelector("#sw-display").textContent = formatMs(t);
    },

    renderLaps() {
      const list = this.page.querySelector("#sw-laps");
      if (!this.laps.length) {
        list.innerHTML = `<p class="laps-empty">No laps yet. Press Lap while running.</p>`;
        return;
      }
      list.innerHTML = `
        <table class="laps-table">
          <thead><tr><th>#</th><th>Lap</th><th>Total</th></tr></thead>
          <tbody>
            ${this.laps
              .map(
                (lap) => `
              <tr>
                <td>${lap.index}</td>
                <td class="mono">${formatMs(lap.split)}</td>
                <td class="mono">${formatMs(lap.total)}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>`;
    },

    updateButtons() {
      const startBtn = this.page.querySelector("#sw-start");
      startBtn.textContent = this.running ? "Pause" : "Start";
      startBtn.classList.toggle("btn-warn", this.running);
      this.page.querySelector("#sw-lap").disabled = !this.running && this.elapsed === 0;
    },

    activate() {
      this.applyStoredStopwatch();
    },

    async applyStoredStopwatch() {
      try {
        await root.ClockStorage?.load?.();
        const stored = await root.ClockStorage?.getStopwatch?.();
        if (!stored) {
          this.reset();
          return;
        }
        this.laps = Array.isArray(stored.laps) ? stored.laps : [];
        this.elapsed = Math.max(0, Number(stored.elapsed) || 0);
        if (stored.running) {
          this.running = true;
          this.startTime = stored.startTime || Date.now() - this.elapsed;
          this.tick();
          this.updateButtons();
          this.renderDisplay();
          this.renderLaps();
        } else {
          this.running = false;
          this.renderDisplay();
          this.renderLaps();
          this.updateButtons();
        }
        await root.ClockStorage?.clearStopwatch?.();
      } catch {
        this.reset();
      }
    },

    deactivate() {
      this.pause();
    },
  };

  root.ClockPages = root.ClockPages || {};
  root.ClockPages.stopwatch = page;
})(window);
