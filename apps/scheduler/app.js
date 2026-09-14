(function () {
  function tt(key, fallback, vars) {
    const I = window.MySpaceI18n;
    if (!I?.t) return fallback || key;
    const v = I.t(key, vars);
    return v === key ? (fallback || key) : v;
  }

  const PAGES = ["active", "all", "history", "new", "about"];

  const state = {
    page: "active",
    schedules: [],
    history: [],
    stats: null,
    filter: { active: "", all: "", history: "" },
    form: {
      mode: "every",
      every: "1h",
      daily: "02:00",
      delay: "30m",
      at: "",
      command: "",
      via: "jobs",
      title: "",
    },
    unsub: null,
  };

  const el = {
    nav: document.getElementById("main-nav"),
    blurb: document.getElementById("sidebar-blurb"),
    status: document.getElementById("status-line"),
    statGrid: document.getElementById("stat-grid"),
    activeSearch: document.getElementById("active-search"),
    activeMeta: document.getElementById("active-meta"),
    activeList: document.getElementById("active-list"),
    activeEmpty: document.getElementById("active-empty"),
    allSearch: document.getElementById("all-search"),
    allList: document.getElementById("all-list"),
    allEmpty: document.getElementById("all-empty"),
    historySearch: document.getElementById("history-search"),
    historyList: document.getElementById("history-list"),
    historyEmpty: document.getElementById("history-empty"),
    newPanel: document.getElementById("new-panel"),
    btnRefresh: document.getElementById("btn-refresh"),
    btnClearHistory: document.getElementById("btn-clear-history"),
  };

  function api() {
    return window.myApp?.scheduler;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setStatus(msg, kind) {
    if (!el.status) return;
    el.status.textContent = msg || "";
    el.status.classList.toggle("is-ok", kind === "ok");
    el.status.classList.toggle("is-err", kind === "err");
    if (msg) {
      clearTimeout(setStatus._t);
      setStatus._t = setTimeout(() => {
        el.status.textContent = "";
        el.status.classList.remove("is-ok", "is-err");
      }, 3200);
    }
  }

  function describeTrigger(trigger) {
    if (!trigger) return "";
    if (trigger.type === "interval") {
      const ms = trigger.everyMs;
      if (ms % 86_400_000 === 0) return `every ${ms / 86_400_000}d`;
      if (ms % 3_600_000 === 0) return `every ${ms / 3_600_000}h`;
      if (ms % 60_000 === 0) return `every ${ms / 60_000}m`;
      return `every ${Math.round(ms / 1000)}s`;
    }
    if (trigger.type === "daily") return `daily ${trigger.time}`;
    if (trigger.type === "once") {
      try {
        return `at ${new Date(trigger.at).toLocaleString()}`;
      } catch {
        return `at ${trigger.at}`;
      }
    }
    return trigger.type;
  }

  function describeAction(action) {
    if (!action) return "";
    if (action.kind === "script") return `scripts(run ${action.scriptName || action.scriptId})`;
    return action.command || "";
  }

  function fmtWhen(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return String(iso);
    }
  }

  function statusPill(s) {
    if (s.enabled) return "run";
    if (s.status === "done") return "ok";
    if (s.status === "failed" || s.status === "missed") return "fail";
    return "warn";
  }

  function setPage(page) {
    const next = PAGES.includes(page) ? page : "active";
    state.page = next;
    PAGES.forEach((p) => {
      document.getElementById(`view-${p}`)?.classList.toggle("hidden", p !== next);
    });
    el.nav?.querySelectorAll("[data-page]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.page === next);
    });
    paint();
  }

  function filteredSchedules(tab) {
    const q = (state.filter[tab] || "").trim().toLowerCase();
    let list = state.schedules || [];
    if (tab === "active") list = list.filter((s) => s.enabled);
    if (!q) return list;
    return list.filter((s) =>
      `${s.title} ${describeTrigger(s.trigger)} ${describeAction(s.action)} ${s.status} ${s.id}`
        .toLowerCase()
        .includes(q)
    );
  }

  function filteredHistory() {
    const q = (state.filter.history || "").trim().toLowerCase();
    const list = state.history || [];
    if (!q) return list;
    return list.filter((h) =>
      `${h.title} ${h.message} ${h.scheduleId} ${h.jobId || ""}`.toLowerCase().includes(q)
    );
  }

  function updateBlurb() {
    const s = state.stats || {};
    if (el.blurb) {
      el.blurb.textContent =
        tt("service.scheduler.blurbStats", `${s.active || 0} active · ${s.paused || 0} paused`, {
          active: s.active || 0,
          paused: s.paused || 0,
        }) + (s.nextRunAt ? tt("service.scheduler.blurbNext", ` · next ${fmtWhen(s.nextRunAt)}`, { when: fmtWhen(s.nextRunAt) }) : "");
    }
  }

  function paintStats() {
    const s = state.stats || {};
    if (!el.statGrid) return;
    const cards = [
      { label: tt("service.scheduler.statActive", "Active"), value: s.active || 0 },
      { label: tt("service.scheduler.statPaused", "Paused"), value: s.paused || 0 },
      { label: tt("service.scheduler.statTotal", "Total"), value: s.total || 0 },
      { label: tt("service.scheduler.statHistory", "History"), value: s.historyCount || 0 },
    ];
    el.statGrid.innerHTML = cards
      .map(
        (c) => `<div class="stat">
        <span class="stat-label">${escapeHtml(c.label)}</span>
        <span class="stat-value">${escapeHtml(c.value)}</span>
      </div>`
      )
      .join("");
  }

  function rowHtml(s) {
    const detail = s.lastResult?.message || "";
    return `<article class="job-row ${s.enabled ? "is-running" : ""}">
      <div>
        <strong>${escapeHtml(s.title || s.id)}</strong>
        <div class="job-meta">
          <span class="pill ${statusPill(s)}">${escapeHtml(s.enabled ? "active" : s.status || "paused")}</span>
          <span class="pill">${escapeHtml(describeTrigger(s.trigger))}</span>
          <span>${escapeHtml(s.via || "jobs")}</span>
          ${s.nextRunAt ? `<span>· next ${escapeHtml(fmtWhen(s.nextRunAt))}</span>` : ""}
          ${s.lastRunAt ? `<span>· last ${escapeHtml(fmtWhen(s.lastRunAt))}</span>` : ""}
        </div>
        <div class="job-detail">${escapeHtml(describeAction(s.action))}</div>
        ${detail ? `<div class="job-detail">${escapeHtml(detail)}</div>` : ""}
      </div>
      <div class="job-actions">
        <button type="button" class="btn btn-sm" data-run="${escapeHtml(s.id)}">${escapeHtml(tt("service.scheduler.runNow", "Run now"))}</button>
        ${
          s.enabled
            ? `<button type="button" class="btn btn-sm" data-pause="${escapeHtml(s.id)}">${escapeHtml(tt("service.scheduler.pause", "Pause"))}</button>`
            : `<button type="button" class="btn btn-sm" data-resume="${escapeHtml(s.id)}">${escapeHtml(tt("service.scheduler.resume", "Resume"))}</button>`
        }
        <button type="button" class="btn btn-sm btn-danger" data-remove="${escapeHtml(s.id)}">${escapeHtml(tt("service.common.remove", "Remove"))}</button>
      </div>
    </article>`;
  }

  function bindRowActions(listEl) {
    listEl.querySelectorAll("[data-run]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const res = await api()?.runNow?.(btn.dataset.run);
        if (res?.ok === false) setStatus(res.error || tt("service.scheduler.runFailed", "Run failed"), "err");
        else setStatus(tt("service.scheduler.fired", "Fired"), "ok");
        await refresh();
      });
    });
    listEl.querySelectorAll("[data-pause]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await api()?.pause?.(btn.dataset.pause);
        setStatus(tt("service.scheduler.paused", "Paused"), "ok");
        await refresh();
      });
    });
    listEl.querySelectorAll("[data-resume]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await api()?.resume?.(btn.dataset.resume);
        setStatus(tt("service.scheduler.resumed", "Resumed"), "ok");
        await refresh();
      });
    });
    listEl.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm(tt("service.scheduler.confirmRemove", "Remove this schedule?"))) return;
        await api()?.remove?.(btn.dataset.remove);
        setStatus(tt("service.scheduler.removed", "Removed"), "ok");
        await refresh();
      });
    });
  }

  function paintScheduleList(listEl, emptyEl, tab) {
    const rows = filteredSchedules(tab);
    if (tab === "active" && el.activeMeta) {
      el.activeMeta.textContent =
        rows.length === 1
          ? tt("service.scheduler.scheduleCount", `${rows.length} schedule`, { count: rows.length })
          : tt("service.scheduler.scheduleCountPlural", `${rows.length} schedules`, { count: rows.length });
    }
    if (!listEl) return;
    if (!rows.length) {
      listEl.innerHTML = "";
      emptyEl?.classList.remove("hidden");
      return;
    }
    emptyEl?.classList.add("hidden");
    listEl.innerHTML = rows.map(rowHtml).join("");
    bindRowActions(listEl);
  }

  function paintHistory() {
    const rows = filteredHistory();
    if (!el.historyList) return;
    if (!rows.length) {
      el.historyList.innerHTML = "";
      el.historyEmpty?.classList.remove("hidden");
      return;
    }
    el.historyEmpty?.classList.add("hidden");
    el.historyList.innerHTML = rows
      .map(
        (h) => `<article class="job-row ${h.ok ? "is-ok" : "is-fail"}">
        <div>
          <strong>${escapeHtml(h.title || h.scheduleId)}</strong>
          <div class="job-meta">
            <span class="pill ${h.ok ? "ok" : "fail"}">${h.ok ? "ok" : "fail"}</span>
            <span>${escapeHtml(fmtWhen(h.at))}</span>
            ${h.jobId ? `<span>· job ${escapeHtml(h.jobId)}</span>` : ""}
          </div>
          ${h.message ? `<div class="job-detail">${escapeHtml(h.message)}</div>` : ""}
        </div>
      </article>`
      )
      .join("");
  }

  function paintNewForm() {
    if (!el.newPanel) return;
    const f = state.form;
    el.newPanel.innerHTML = `
      <label class="field">
        <span>${escapeHtml(tt("service.scheduler.titleOptional", "Title (optional)"))}</span>
        <input type="text" id="sch-title" value="${escapeHtml(f.title)}" placeholder="Nightly backup" />
      </label>
      <label class="field">
        <span>${escapeHtml(tt("service.scheduler.trigger", "Trigger"))}</span>
        <select id="sch-mode">
          <option value="every"${f.mode === "every" ? " selected" : ""}>${escapeHtml(tt("service.scheduler.everyInterval", "Every interval"))}</option>
          <option value="daily"${f.mode === "daily" ? " selected" : ""}>${escapeHtml(tt("service.scheduler.dailyAt", "Daily at"))}</option>
          <option value="in"${f.mode === "in" ? " selected" : ""}>${escapeHtml(tt("service.scheduler.onceIn", "Once in"))}</option>
          <option value="at"${f.mode === "at" ? " selected" : ""}>${escapeHtml(tt("service.scheduler.onceAtIso", "Once at (ISO)"))}</option>
        </select>
      </label>
      <label class="field" id="sch-every-wrap"${f.mode === "every" ? "" : " hidden"}>
        <span>${escapeHtml(tt("service.scheduler.interval", "Interval"))}</span>
        <input type="text" id="sch-every" value="${escapeHtml(f.every)}" placeholder="1h · 15m · 1d" />
      </label>
      <label class="field" id="sch-daily-wrap"${f.mode === "daily" ? "" : " hidden"}>
        <span>${escapeHtml(tt("service.scheduler.timeLocal", "Time (local)"))}</span>
        <input type="text" id="sch-daily" value="${escapeHtml(f.daily)}" placeholder="02:00" />
      </label>
      <label class="field" id="sch-delay-wrap"${f.mode === "in" ? "" : " hidden"}>
        <span>${escapeHtml(tt("service.scheduler.delay", "Delay"))}</span>
        <input type="text" id="sch-delay" value="${escapeHtml(f.delay)}" placeholder="30m" />
      </label>
      <label class="field" id="sch-at-wrap"${f.mode === "at" ? "" : " hidden"}>
        <span>${escapeHtml(tt("service.scheduler.isoDatetime", "ISO datetime"))}</span>
        <input type="text" id="sch-at" value="${escapeHtml(f.at)}" placeholder="2026-08-27T14:00:00" />
      </label>
      <label class="field">
        <span>${escapeHtml(tt("service.scheduler.commandField", "Command or scripts(run name)"))}</span>
        <input type="text" id="sch-command" value="${escapeHtml(f.command)}" placeholder="backup(status)" spellcheck="false" />
      </label>
      <label class="field">
        <span>${escapeHtml(tt("service.scheduler.via", "Via"))}</span>
        <select id="sch-via">
          <option value="jobs"${f.via === "jobs" ? " selected" : ""}>${escapeHtml(tt("service.scheduler.viaJobs", "Jobs queue (recommended)"))}</option>
          <option value="direct"${f.via === "direct" ? " selected" : ""}>${escapeHtml(tt("service.scheduler.viaDirect", "Direct shell"))}</option>
        </select>
      </label>
      <div class="form-actions">
        <button type="button" class="btn btn-primary" id="sch-create">${escapeHtml(tt("service.scheduler.createSchedule", "Create schedule"))}</button>
      </div>
      <p class="muted" style="margin-top:0.75rem;font-size:0.85rem">
        ${escapeHtml(tt("service.scheduler.shellPreview", "Equivalent shell:"))} <code id="sch-preview"></code>
      </p>`;

    const syncPreview = () => {
      const mode = document.getElementById("sch-mode")?.value || "every";
      const title = document.getElementById("sch-title")?.value?.trim();
      const via = document.getElementById("sch-via")?.value || "jobs";
      const cmd = document.getElementById("sch-command")?.value?.trim() || "<cmd>";
      let body = "";
      if (mode === "every") body = `every ${document.getElementById("sch-every")?.value || "1h"} ${cmd}`;
      else if (mode === "daily") body = `daily ${document.getElementById("sch-daily")?.value || "02:00"} ${cmd}`;
      else if (mode === "in") body = `in ${document.getElementById("sch-delay")?.value || "30m"} ${cmd}`;
      else body = `at ${document.getElementById("sch-at")?.value || "<iso>"} ${cmd}`;
      const parts = [];
      if (title) parts.push(`title "${title}"`);
      if (via === "direct") parts.push("via direct");
      parts.push(body);
      const prev = document.getElementById("sch-preview");
      if (prev) prev.textContent = `schedule(add ${parts.join(" ")})`;
    };

    const showWraps = () => {
      const mode = document.getElementById("sch-mode")?.value || "every";
      document.getElementById("sch-every-wrap")?.toggleAttribute("hidden", mode !== "every");
      document.getElementById("sch-daily-wrap")?.toggleAttribute("hidden", mode !== "daily");
      document.getElementById("sch-delay-wrap")?.toggleAttribute("hidden", mode !== "in");
      document.getElementById("sch-at-wrap")?.toggleAttribute("hidden", mode !== "at");
      syncPreview();
    };

    document.getElementById("sch-mode")?.addEventListener("change", showWraps);
    ["sch-title", "sch-every", "sch-daily", "sch-delay", "sch-at", "sch-command", "sch-via"].forEach((id) => {
      document.getElementById(id)?.addEventListener("input", syncPreview);
      document.getElementById(id)?.addEventListener("change", syncPreview);
    });
    document.getElementById("sch-create")?.addEventListener("click", async () => {
      const mode = document.getElementById("sch-mode")?.value || "every";
      const title = document.getElementById("sch-title")?.value?.trim();
      const via = document.getElementById("sch-via")?.value || "jobs";
      const cmd = document.getElementById("sch-command")?.value?.trim();
      if (!cmd) {
        setStatus(tt("service.scheduler.commandRequired", "Command required"), "err");
        return;
      }
      let body = "";
      if (mode === "every") body = `every ${document.getElementById("sch-every")?.value || "1h"} ${cmd}`;
      else if (mode === "daily") body = `daily ${document.getElementById("sch-daily")?.value || "02:00"} ${cmd}`;
      else if (mode === "in") body = `in ${document.getElementById("sch-delay")?.value || "30m"} ${cmd}`;
      else {
        const at = document.getElementById("sch-at")?.value?.trim();
        if (!at) {
          setStatus(tt("service.scheduler.isoRequired", "ISO time required"), "err");
          return;
        }
        body = `at ${at} ${cmd}`;
      }
      const parts = [];
      if (title) parts.push(`title "${title}"`);
      if (via === "direct") parts.push("via direct");
      parts.push(body);
      const res = await api()?.add?.({ spec: parts.join(" "), source: "scheduler-app" });
      if (res?.ok === false) {
        setStatus(res.error || tt("service.scheduler.createFailed", "Create failed"), "err");
        return;
      }
      state.form.command = "";
      setStatus(tt("service.scheduler.created", "Schedule created"), "ok");
      setPage("active");
      await refresh();
    });
    showWraps();
  }

  function paint() {
    updateBlurb();
    paintStats();
    if (state.page === "active") paintScheduleList(el.activeList, el.activeEmpty, "active");
    if (state.page === "all") paintScheduleList(el.allList, el.allEmpty, "all");
    if (state.page === "history") paintHistory();
    if (state.page === "new") paintNewForm();
  }

  async function refresh() {
    const apiRef = api();
    if (!apiRef) {
      setStatus(tt("service.scheduler.bridgeMissing", "Scheduler bridge missing — restart My Space"), "err");
      return;
    }
    const res = await apiRef.stats();
    if (res?.ok === false) {
      setStatus(res.error || tt("service.scheduler.loadFailed", "Could not load scheduler"), "err");
      return;
    }
    state.schedules = res?.schedules || [];
    state.history = res?.history || [];
    state.stats = res?.stats || null;
    paint();
  }

  function applyRoute(route) {
    const raw = String(route?.page || route?.tab || "active")
      .toLowerCase()
      .trim();
    const alias = {
      panel: "active",
      open: "active",
      home: "active",
      queue: "active",
      list: "all",
      schedules: "all",
      add: "new",
      enqueue: "new",
      create: "new",
      runs: "history",
      log: "history",
    };
    setPage(alias[raw] || raw);
  }

  function ensureLive() {
    if (state.unsub || !api()?.onUpdated) return;
    state.unsub = api().onUpdated((data) => {
      state.schedules = data?.schedules || state.schedules;
      state.history = data?.history || state.history;
      state.stats = data?.stats || state.stats;
      paint();
    });
  }

  el.nav?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-page]");
    if (btn) setPage(btn.dataset.page);
  });
  el.btnRefresh?.addEventListener("click", () => void refresh().then(() => setStatus(tt("service.scheduler.refreshed", "Refreshed"), "ok")));
  el.btnClearHistory?.addEventListener("click", async () => {
    await api()?.clearHistory?.();
    setStatus(tt("service.scheduler.historyCleared", "History cleared"), "ok");
    await refresh();
  });
  el.activeSearch?.addEventListener("input", () => {
    state.filter.active = el.activeSearch.value || "";
    paintScheduleList(el.activeList, el.activeEmpty, "active");
  });
  el.allSearch?.addEventListener("input", () => {
    state.filter.all = el.allSearch.value || "";
    paintScheduleList(el.allList, el.allEmpty, "all");
  });
  el.historySearch?.addEventListener("input", () => {
    state.filter.history = el.historySearch.value || "";
    paintHistory();
  });

  window.SchedulerApp = {
    setPage,
    applyRoute,
    refresh,
  };

  window.addEventListener("myspace-i18n-applied", () => paint());

  ensureLive();
  void refresh()
    .then(() => setPage("active"))
    .catch((err) => setStatus(err?.message || String(err), "err"));
})();
