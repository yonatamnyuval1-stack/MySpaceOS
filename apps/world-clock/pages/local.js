(function (root) {
  const { analogSvg, clockAngles, formatTime24, formatDate, getOffsetLabel, localTimeZone } =
    root.ClockTime;

  const page = {
    id: "local",
    page: null,
    tickTimer: null,

    bind(ui) {
      this.page = document.getElementById("page-local");
    },

    activate() {
      this.deactivate();
      this.render();
      this.tickTimer = setInterval(() => this.render(), 1000);
    },

    deactivate() {
      if (this.tickTimer) clearInterval(this.tickTimer);
      this.tickTimer = null;
    },

    render() {
      if (!this.page) return;
      const now = new Date();
      const tz = localTimeZone();
      const angles = clockAngles(now, tz);
      const face = this.page.querySelector(".local-face");
      const timeEl = this.page.querySelector(".local-time");
      const dateEl = this.page.querySelector(".local-date");
      const metaEl = this.page.querySelector(".local-meta");
      if (face) face.innerHTML = analogSvg(angles, 220);
      if (timeEl) timeEl.textContent = formatTime24(now, tz);
      if (dateEl) dateEl.textContent = formatDate(now, tz);
      if (metaEl) metaEl.textContent = `${tz} · ${getOffsetLabel(now, tz)}`;
    },
  };

  root.ClockPages = root.ClockPages || {};
  root.ClockPages.local = page;
})(window);
