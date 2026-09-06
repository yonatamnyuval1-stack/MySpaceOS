(function (root) {
  const { escapeHtml, pad2 } = root.ClockUtils;
  const { search, renderSearchResults } = root.ClockSearch;
  const { zoneCityName, localTimeZone } = root.ClockTime;
  const { getFavorites } = root.ClockStorage;
  const MP = root.ClockMeetingPlanner;

  const MAX_PARTICIPANTS = 8;

  const page = {
    id: "meetings",
    page: null,
    tickTimer: null,
    state: null,
    searchDebounce: null,
    selectedSlotStart: null,
    lastSlots: [],

    bind() {
      this.page = document.getElementById("page-meetings");
      const searchInput = this.page.querySelector("#meetings-search");
      const results = this.page.querySelector("#meetings-search-results");

      searchInput.addEventListener("input", () => {
        clearTimeout(this.searchDebounce);
        const q = searchInput.value.trim();
        if (q.length < 1) {
          results.innerHTML = "";
          results.classList.remove("open");
          return;
        }
        this.searchDebounce = setTimeout(() => {
          const items = search(q, 16);
          renderSearchResults(results, items, (item) => this.addParticipant(item));
          results.classList.add("open");
        }, 120);
      });

      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          searchInput.value = "";
          results.innerHTML = "";
          results.classList.remove("open");
        }
      });

      this.page.querySelector("#meetings-from-favorites").addEventListener("click", () => this.importFavorites());
      this.page.querySelector("#meetings-date").addEventListener("change", () => this.onConfigChange());
      this.page.querySelector("#meetings-duration").addEventListener("change", async () => {
        this.state.durationMin = parseInt(this.page.querySelector("#meetings-duration").value, 10) || 60;
        await this.persist();
        this.onConfigChange();
      });
      this.page.querySelector("#meetings-work-start").addEventListener("change", () => this.applyGlobalWorkHours());
      this.page.querySelector("#meetings-work-end").addEventListener("change", () => this.applyGlobalWorkHours());
      this.page.querySelector("#meetings-title").addEventListener("change", async () => {
        this.state.defaultTitle = this.getMeetingTitle();
        await this.persist();
      });

      document.addEventListener("click", (e) => {
        if (!this.page.contains(e.target)) results.classList.remove("open");
      });
    },

    async activate() {
      this.deactivate();
      this.state = await root.ClockStorage.getMeetingPlanner();
      if (!this.state.participants.length) {
        this.seedDefaults();
        await this.persist();
      }
      this.syncFormFromState();
      this.renderAll();
      let tick = 0;
      this.tickTimer = setInterval(() => {
        if (this.page.hidden) return;
        this.renderNowGrid();
        tick += 1;
        if (tick % 30 === 0) this.renderTimeline();
      }, 1000);
    },

    deactivate() {
      if (this.tickTimer) clearInterval(this.tickTimer);
      this.tickTimer = null;
    },

    seedDefaults() {
      const tz = localTimeZone();
      const defaults = [
        { timezone: tz, label: "You (local)" },
        { timezone: "America/New_York", label: "United States" },
        { timezone: "Europe/London", label: "United Kingdom" },
      ];
      this.state.participants = defaults.map((d) => MP.defaultParticipant(d.timezone, d.label));
    },

    syncFormFromState() {
      const s = this.state;
      const ws = this.page.querySelector("#meetings-work-start");
      const we = this.page.querySelector("#meetings-work-end");
      if (!ws.options.length) {
        ws.innerHTML = hourOptions(9);
        we.innerHTML = hourOptions(17);
      }
      this.page.querySelector("#meetings-date").value = MP.todayDateStr();
      this.page.querySelector("#meetings-duration").value = String(s.durationMin || 60);
      this.page.querySelector("#meetings-title").value = s.defaultTitle || "Meeting";
      ws.value = String(s.workStart ?? 9);
      we.value = String(s.workEnd ?? 17);
    },

    getMeetingTitle() {
      const el = this.page.querySelector("#meetings-title");
      const t = (el?.value || "").trim();
      return t || "Meeting";
    },

    getActiveSlot(slots) {
      if (!slots?.length) return null;
      if (this.selectedSlotStart) {
        const ts = this.selectedSlotStart.getTime();
        const found = slots.find((s) => s.start.getTime() === ts);
        if (found) return found;
      }
      return slots[0];
    },

    buildCalendarPayload(slot, cfg, titleOverride) {
      const title = titleOverride || this.getMeetingTitle();
      const description = MP.buildEventDescription(slot, this.state.participants, cfg.referenceTz);
      return { title, start: slot.start, durationMin: cfg.durationMin, description };
    },

    async openCalendarUrl(url) {
      if (!window.myApp) {
        window.open(url, "_blank", "noopener");
        return;
      }
      const res = await window.myApp.invoke("calendar.openUrl", { url });
      if (!res?.ok) alert(res?.error || "Could not open calendar link.");
    },

    async addToGoogle(slot, cfg) {
      const p = this.buildCalendarPayload(slot, cfg);
      const url = MP.buildGoogleCalendarUrl(p);
      await this.openCalendarUrl(url);
    },

    async addToOutlook(slot, cfg) {
      const p = this.buildCalendarPayload(slot, cfg);
      const url = MP.buildOutlookCalendarUrl(p);
      await this.openCalendarUrl(url);
    },

    downloadIcs(slot, cfg) {
      const p = this.buildCalendarPayload(slot, cfg);
      const ics = MP.buildIcsContent({ ...p, uid: `clock-${p.start.getTime()}@my-space` });
      const safe = p.title.replace(/[^\w\s-]/g, "").trim() || "meeting";
      MP.downloadIcsFile(ics, `${safe}.ics`);
    },

    async saveToApp(slot, cfg) {
      if (!this.state.scheduled) this.state.scheduled = [];
      const entry = {
        id: `mtg_${Date.now()}`,
        title: this.getMeetingTitle(),
        start: slot.start.toISOString(),
        durationMin: cfg.durationMin,
        dateStr: cfg.dateStr,
      };
      this.state.scheduled.unshift(entry);
      if (this.state.scheduled.length > 50) this.state.scheduled.length = 50;
      await this.persist();
      this.renderScheduled();
      if (window.myApp) {
        await window.myApp.invoke("notify", {
          title: "Meeting saved",
          body: `${entry.title} — open your calendar app to finish booking if needed.`,
        });
      }
    },

    bindHeroActions(slot, cfg) {
      const hero = this.page.querySelector("#meetings-hero");
      if (!hero) return;
      hero.querySelector("[data-action=google]")?.addEventListener("click", () => this.addToGoogle(slot, cfg));
      hero.querySelector("[data-action=outlook]")?.addEventListener("click", () => this.addToOutlook(slot, cfg));
      hero.querySelector("[data-action=ics]")?.addEventListener("click", () => this.downloadIcs(slot, cfg));
      hero.querySelector("[data-action=save]")?.addEventListener("click", () => this.saveToApp(slot, cfg));
      hero.querySelector("[data-action=map]")?.addEventListener("click", () => {
        const map = this.page.querySelector("#meetings-day-map");
        if (map && !map.open) map.open = true;
        this.renderTimeline();
        this.page.querySelector("#meetings-timeline")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    },

    async persist() {
      await root.ClockStorage.saveMeetingPlanner(this.state);
    },

    async addParticipant(item) {
      if (this.state.participants.length >= MAX_PARTICIPANTS) return;
      if (this.state.participants.some((p) => p.timezone === item.timezone)) return;

      this.state.participants.push(MP.defaultParticipant(item.timezone, item.country || item.label));
      await this.persist();

      const input = this.page.querySelector("#meetings-search");
      const results = this.page.querySelector("#meetings-search-results");
      input.value = "";
      results.innerHTML = "";
      results.classList.remove("open");
      this.renderAll();
    },

    async importFavorites() {
      const favs = await getFavorites();
      if (!favs.length) return;
      for (const f of favs) {
        if (this.state.participants.length >= MAX_PARTICIPANTS) break;
        if (this.state.participants.some((p) => p.timezone === f.timezone)) continue;
        this.state.participants.push(MP.defaultParticipant(f.timezone, f.label || f.country));
      }
      await this.persist();
      this.renderAll();
    },

    async removeParticipant(id) {
      this.state.participants = this.state.participants.filter((p) => p.id !== id);
      await this.persist();
      this.selectedSlotStart = null;
      this.renderAll();
    },

    async updateParticipant(id, field, value) {
      const p = this.state.participants.find((x) => x.id === id);
      if (!p) return;
      if (field === "workStart" || field === "workEnd") {
        p[field] = parseInt(value, 10);
        if (p.workEnd <= p.workStart) p.workEnd = Math.min(23, p.workStart + 1);
      }
      await this.persist();
      this.refreshResults();
    },

    async applyGlobalWorkHours() {
      const ws = parseInt(this.page.querySelector("#meetings-work-start").value, 10);
      const we = parseInt(this.page.querySelector("#meetings-work-end").value, 10);
      this.state.workStart = ws;
      this.state.workEnd = we;
      this.state.participants.forEach((p) => {
        p.workStart = ws;
        p.workEnd = we;
      });
      await this.persist();
      this.renderPerCityHours();
      this.refreshResults();
    },

    onConfigChange() {
      this.selectedSlotStart = null;
      this.refreshResults();
    },

    getFormConfig() {
      return {
        dateStr: this.page.querySelector("#meetings-date").value,
        durationMin: parseInt(this.page.querySelector("#meetings-duration").value, 10) || 60,
        referenceTz: localTimeZone(),
      };
    },

    getSlots() {
      const cfg = this.getFormConfig();
      return MP.findBestSlots({
        participants: this.state.participants,
        dateStr: cfg.dateStr,
        durationMin: cfg.durationMin,
        referenceTz: cfg.referenceTz,
      });
    },

    refreshResults() {
      this.renderChips();
      this.renderPerCityHours();
      this.renderResults();
      this.renderNowGrid();
      this.renderTimeline();
      this.renderScheduled();
    },

    renderAll() {
      this.renderChips();
      this.renderPerCityHours();
      this.renderResults();
      this.renderNowGrid();
      this.renderTimeline();
      this.renderScheduled();
    },

    renderScheduled() {
      const wrap = this.page.querySelector("#meetings-scheduled-wrap");
      const list = this.page.querySelector("#meetings-scheduled-list");
      const items = this.state.scheduled || [];
      if (!items.length) {
        wrap.hidden = true;
        list.innerHTML = "";
        return;
      }
      wrap.hidden = false;
      const refTz = localTimeZone();
      list.innerHTML = items
        .map((e) => {
          const start = new Date(e.start);
          const when = MP.formatTimeFriendly(start, refTz);
          const day = e.dateStr || start.toISOString().slice(0, 10);
          return `
        <div class="meetings-scheduled-item">
          <div>
            <strong>${escapeHtml(e.title)}</strong>
            <span class="meetings-cell-sub">${escapeHtml(day)} · ${escapeHtml(when)} · ${e.durationMin} min</span>
          </div>
          <div class="meetings-scheduled-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-scheduled-ics="${escapeHtml(e.id)}">.ics</button>
            <button type="button" class="btn btn-ghost btn-sm meetings-scheduled-remove" data-id="${escapeHtml(e.id)}">Remove</button>
          </div>
        </div>`;
        })
        .join("");

      list.querySelectorAll(".meetings-scheduled-remove").forEach((btn) => {
        btn.addEventListener("click", async () => {
          this.state.scheduled = (this.state.scheduled || []).filter((x) => x.id !== btn.dataset.id);
          await this.persist();
          this.renderScheduled();
        });
      });

      list.querySelectorAll("[data-scheduled-ics]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const e = items.find((x) => x.id === btn.dataset.scheduledIcs);
          if (!e) return;
          const slot = { start: new Date(e.start), participants: [] };
          const p = this.buildCalendarPayload(slot, { durationMin: e.durationMin, dateStr: e.dateStr, referenceTz: refTz }, e.title);
          const ics = MP.buildIcsContent({ ...p, uid: `clock-${p.start.getTime()}@my-space` });
          MP.downloadIcsFile(ics, `${(e.title || "meeting").replace(/[^\w\s-]/g, "") || "meeting"}.ics`);
        });
      });
    },

    renderChips() {
      const el = this.page.querySelector("#meetings-chips");
      const empty = this.page.querySelector("#meetings-participants-empty");
      const list = this.state.participants;

      if (!list.length) {
        el.innerHTML = "";
        empty.hidden = false;
        return;
      }
      empty.hidden = list.length >= 1;

      el.innerHTML = list
        .map(
          (p) => `
        <span class="meetings-chip" role="listitem">
          <span class="meetings-chip-label">${escapeHtml(p.label)}</span>
          <span class="meetings-chip-city">${escapeHtml(zoneCityName(p.timezone))}</span>
          <button type="button" class="meetings-chip-remove" data-id="${escapeHtml(p.id)}" title="Remove ${escapeHtml(p.label)}">×</button>
        </span>`
        )
        .join("");

      el.querySelectorAll(".meetings-chip-remove").forEach((btn) => {
        btn.addEventListener("click", () => this.removeParticipant(btn.dataset.id));
      });
    },

    renderPerCityHours() {
      const el = this.page.querySelector("#meetings-per-city");
      const list = this.state.participants;
      if (list.length < 2) {
        el.innerHTML = "";
        return;
      }

      el.innerHTML = list
        .map(
          (p) => `
        <div class="meetings-per-city-row">
          <span class="meetings-per-city-name">${escapeHtml(p.label)}</span>
          <label>
            <span class="sr-only">From</span>
            <select data-id="${escapeHtml(p.id)}" data-field="workStart" class="meetings-hour-select">
              ${hourOptions(p.workStart)}
            </select>
          </label>
          <span>to</span>
          <label>
            <span class="sr-only">To</span>
            <select data-id="${escapeHtml(p.id)}" data-field="workEnd" class="meetings-hour-select">
              ${hourOptions(p.workEnd)}
            </select>
          </label>
        </div>`
        )
        .join("");

      el.querySelectorAll(".meetings-hour-select").forEach((sel) => {
        sel.addEventListener("change", () =>
          this.updateParticipant(sel.dataset.id, sel.dataset.field, sel.value)
        );
      });
    },

    renderResults() {
      const hero = this.page.querySelector("#meetings-hero");
      const alt = this.page.querySelector("#meetings-alternatives");
      const cfg = this.getFormConfig();
      const refTz = cfg.referenceTz;
      const n = this.state.participants.length;

      if (n < 1) {
        hero.innerHTML = `
          <div class="meetings-hero-empty">
            <p>Add at least <strong>one city</strong> above to see a suggested meeting time.</p>
          </div>`;
        alt.innerHTML = "";
        return;
      }

      const slots = this.getSlots();
      this.lastSlots = slots;

      if (!slots.length) {
        hero.innerHTML = `
          <div class="meetings-hero-empty">
            <p>No comfortable time found on this date.</p>
            <p class="meetings-hint">Try another day, a shorter meeting, or wider office hours.</p>
          </div>`;
        alt.innerHTML = "";
        return;
      }

      const top = this.getActiveSlot(slots);
      if (!this.selectedSlotStart) this.selectedSlotStart = top.start;
      hero.innerHTML = this.renderHeroCard(top, cfg);
      this.bindHeroActions(top, cfg);

      const altSlots = slots.filter((s) => s.start.getTime() !== top.start.getTime());
      if (altSlots.length) {
        alt.innerHTML = `
          <h3 class="meetings-alt-title">Other times that work</h3>
          <div class="meetings-alt-list">
            ${altSlots.map((slot) => this.renderAltRow(slot, cfg)).join("")}
          </div>`;
        alt.querySelectorAll("[data-ts]").forEach((btn) => {
          btn.addEventListener("click", () => this.pickSlot(parseInt(btn.dataset.ts, 10)));
        });
      } else {
        alt.innerHTML = "";
      }
    },

    pickSlot(ts) {
      this.selectedSlotStart = new Date(ts);
      const cfg = this.getFormConfig();
      const top = this.getActiveSlot(this.lastSlots);
      if (!top) return;
      const hero = this.page.querySelector("#meetings-hero");
      hero.innerHTML = this.renderHeroCard(top, cfg);
      this.bindHeroActions(top, cfg);
      this.renderTimeline();
      const map = this.page.querySelector("#meetings-day-map");
      if (map && !map.open) map.open = true;
    },

    renderHeroCard(slot, cfg) {
      const refTz = cfg.referenceTz;
      const verdict = MP.slotVerdict(slot);
      const yourTime = MP.formatTimeFriendly(slot.start, refTz);
      const dateLine = MP.formatDateLong(cfg.dateStr, refTz);
      const people = slot.participants
        .map(
          (pp) => `
        <li>
          <strong>${escapeHtml(pp.label)}</strong>
          <span class="meetings-hero-person-time">${escapeHtml(MP.formatTimeFriendly(slot.start, pp.timezone))}</span>
          <span class="meetings-status meetings-status--${pp.score >= 100 ? "work" : pp.score >= 40 ? "awake" : "night"}">${escapeHtml(MP.friendlyStatus(pp.statusLabel))}</span>
        </li>`
        )
        .join("");

      return `
        <article class="meetings-hero-card meetings-hero-card--${verdict.level}">
          <p class="meetings-hero-kicker">${escapeHtml(verdict.title)}</p>
          <p class="meetings-hero-time">${escapeHtml(yourTime)}</p>
          <p class="meetings-hero-date">${escapeHtml(dateLine)} · your time · ${cfg.durationMin} min</p>
          <p class="meetings-hero-hint">${escapeHtml(verdict.hint)}</p>
          <ul class="meetings-hero-people">${people}</ul>
          <div class="meetings-calendar-actions">
            <p class="meetings-calendar-label">Add to your calendar:</p>
            <div class="meetings-calendar-btns">
              <button type="button" class="btn btn-primary" data-action="google">Google Calendar</button>
              <button type="button" class="btn" data-action="outlook">Outlook</button>
              <button type="button" class="btn" data-action="ics">Download .ics</button>
            </div>
            <div class="meetings-calendar-btns meetings-calendar-btns--secondary">
              <button type="button" class="btn btn-ghost" data-action="save">Save in Clock</button>
              <button type="button" class="btn btn-ghost" data-action="map">Day map</button>
            </div>
          </div>
        </article>`;
    },

    renderAltRow(slot, cfg) {
      const refTz = cfg.referenceTz;
      const verdict = MP.slotVerdict(slot);
      const yourTime = MP.formatTimeFriendly(slot.start, refTz);
      const summary = slot.participants
        .map((pp) => `${pp.label} ${MP.formatTimeFriendly(slot.start, pp.timezone)}`)
        .join(" · ");

      return `
        <button type="button" class="meetings-alt-row meetings-alt-row--${verdict.level}" data-ts="${slot.start.getTime()}">
          <span class="meetings-alt-time">${escapeHtml(yourTime)}</span>
          <span class="meetings-alt-verdict">${escapeHtml(verdict.title)}</span>
          <span class="meetings-alt-detail">${escapeHtml(summary)}</span>
        </button>`;
    },

    renderNowGrid() {
      const grid = this.page.querySelector("#meetings-now-grid");
      const now = new Date();
      const rows = MP.getLiveComparison(now, this.state.participants);

      if (!rows.length) {
        grid.innerHTML = `<p class="meetings-hint">Add cities above to see live times.</p>`;
        return;
      }

      grid.innerHTML = rows
        .map((r) => {
          const live = MP.liveStatusKind(r.status);
          const timeShort = r.time.replace(/^(\d{2}:\d{2}):\d{2}$/, "$1");
          const dstShort = r.dstLabel === "No DST" ? "No daylight saving" : r.dstLabel;
          return `
        <article class="meetings-now-card">
          <h3 class="meetings-now-name">${escapeHtml(r.label)}</h3>
          <p class="meetings-now-city">${escapeHtml(r.city)} · ${escapeHtml(r.weekday)}</p>
          <p class="meetings-now-time mono">${escapeHtml(timeShort)}</p>
          <span class="meetings-status meetings-status--${live.class}">${escapeHtml(live.pill)}</span>
          <p class="meetings-now-meta">${escapeHtml(r.offset)} · ${escapeHtml(dstShort)}</p>
          ${r.dstDetail ? `<p class="meetings-now-dst">${escapeHtml(r.dstDetail)}</p>` : ""}
        </article>`;
        })
        .join("");
    },

    renderTimeline() {
      const wrap = this.page.querySelector("#meetings-timeline");
      const cfg = this.getFormConfig();

      if (this.state.participants.length < 1) {
        wrap.innerHTML = `<p class="meetings-hint">Add a city to see the day map.</p>`;
        return;
      }

      const grid = MP.buildTimelineGrid({
        participants: this.state.participants,
        dateStr: cfg.dateStr,
        referenceTz: cfg.referenceTz,
        durationMin: cfg.durationMin,
        highlightStart: this.selectedSlotStart,
      });

      const refCity = zoneCityName(grid.referenceTz);
      let html = `<p class="meetings-timeline-caption">Rows = people on the call. Columns = hours in <strong>${escapeHtml(refCity)}</strong> (your timezone). Numbers = their local hour.</p>`;
      html += `<div class="meetings-timeline-scroll"><table class="meetings-timeline-table"><thead><tr><th class="meetings-tl-name">City</th>`;

      grid.hours.forEach((h) => {
        const short = h.replace(":00", "").replace(" · now", "*");
        html += `<th class="meetings-tl-hour" title="${escapeHtml(h)}">${escapeHtml(short)}</th>`;
      });
      html += `</tr></thead><tbody>`;

      grid.rows.forEach((row) => {
        html += `<tr><td class="meetings-tl-name"><strong>${escapeHtml(row.label)}</strong></td>`;
        row.cells.forEach((cell) => {
          const title = `${cell.localLabel} — ${MP.friendlyStatus(cell.statusLabel)}`;
          const hi = cell.highlighted ? " meetings-tl-cell--hi" : "";
          const nowMark = cell.isNow ? " meetings-tl-cell--now" : "";
          html += `<td class="meetings-tl-cell meetings-tl-cell--${cell.kind}${hi}${nowMark}" title="${escapeHtml(title)}"></td>`;
        });
        html += `</tr>`;
      });
      html += `</tbody></table></div><p class="meetings-hint meetings-hint--tight">* = current hour</p>`;
      wrap.innerHTML = html;
    },
  };

  function hourOptions(selected) {
    let html = "";
    for (let h = 0; h < 24; h++) {
      const label = `${pad2(h)}:00`;
      html += `<option value="${h}"${h === selected ? " selected" : ""}>${label}</option>`;
    }
    return html;
  }

  root.ClockPages = root.ClockPages || {};
  root.ClockPages.meetings = page;
})(window);
