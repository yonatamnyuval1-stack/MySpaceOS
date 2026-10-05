(function () {
  function tt(key, fallback, vars) {
    const I = window.MySpaceI18n;
    if (!I?.t) return fallback || key;
    const v = I.t(key, vars);
    return v === key ? (fallback || key) : v;
  }
  const PAGES = ["queue", "active", "done", "enqueue", "capacity", "about"];
  const state = {
    page: "queue",
    jobs: [],
    capacity: null,
    stats: null,
    filter: { queue: "", active: "", done: "" },
    enqueueKind: "shell",
    enqueueText: "",
    enqueueTitle: "",
    unsub: null,
  };
  const el = {
    nav: document.getElementById("main-nav"),
    blurb: document.getElementById("sidebar-blurb"),
    status: document.getElementById("status-line"),
    statGrid: document.getElementById("stat-grid"),
    queueSearch: document.getElementById("queue-search"),
    queueMeta: document.getElementById("queue-meta"),
    queueList: document.getElementById("queue-list"),
    queueEmpty: document.getElementById("queue-empty"),
    activeSearch: document.getElementById("active-search"),
    activeList: document.getElementById("active-list"),
    activeEmpty: document.getElementById("active-empty"),
    doneSearch: document.getElementById("done-search"),
    doneList: document.getElementById("done-list"),
    doneEmpty: document.getElementById("done-empty"),
    enqueuePanel: document.getElementById("enqueue-panel"),
    capacityPanel: document.getElementById("capacity-panel"),
    btnRefresh: document.getElementById("btn-refresh"),
    btnClear: document.getElementById("btn-clear"),
    btnClearDone: document.getElementById("btn-clear-done"),
    btnCapSave: document.getElementById("btn-cap-save"),
  };

  function api() {
    return window.myApp?.jobs;
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

  function statusClass(status) {
    if (status === "running") return "is-running";
    if (status === "queued") return "is-queued";
    if (status === "succeeded") return "is-ok";
    if (status === "failed") return "is-fail";
    if (status === "cancelled") return "is-cancel";
    return "";
  }

  function statusPill(status) {
    const map = {
      running: "run",
      queued: "warn",
      succeeded: "ok",
      failed: "fail",
    };
    return map[status] || "";
  }

  function setPage(page) {
    const next = PAGES.includes(page) ? page : "queue";
    state.page = next;
    PAGES.forEach((p) => {
      document.getElementById(`view-${p}`)?.classList.toggle("hidden", p !== next);
    });
    el.nav?.querySelectorAll("[data-page]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.page === next);
    });
    paint();
  }

  function filtered(tab) {
    const q = (state.filter[tab] || "").trim().toLowerCase();
    let list = state.jobs || [];
    if (tab === "active") list = list.filter((j) => j.status === "queued" || j.status === "running");
    else if (tab === "done") {
      list = list.filter((j) => ["succeeded", "failed", "cancelled"].includes(j.status));
    }
    if (!q) return list;
    return list.filter((j) =>
      `${j.title} ${j.kind} ${j.status} ${j.source} ${j.pool || ""} ${j.error || ""}`
        .toLowerCase()
        .includes(q)
    );
  }

  function updateBlurb() {
    const s = state.stats || {};
    if (el.blurb) {
      el.blurb.textContent =
        tt("service.jobs.blurbStats", `${s.queued || 0} queued · ${s.running || 0} running`, {
          queued: s.queued || 0,
          running: s.running || 0,
        }) + (s.pausedByFocus ? tt("service.jobs.blurbPausedFocus", " · background paused by Focus") : "");
    }
  }

  function paintStats() {
    const s = state.stats || {};
    const pools = s.pools || {};
    if (!el.statGrid) return;
    const cards = [
      { label: tt("service.jobs.statQueued", "Queued"), value: s.queued || 0 },
      { label: tt("service.jobs.statRunning", "Running"), value: s.running || 0 },
      { label: tt("service.jobs.statConnect", "Connect"), value: pools.connect?.running || 0 },
      { label: tt("service.jobs.statInteractive", "Interactive"), value: pools.interactive?.running || 0 },
      { label: tt("service.jobs.statShell", "Shell"), value: pools.shell?.running || 0 },
      { label: tt("service.jobs.statBackground", "Background"), value: pools.background?.running || 0 },
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

  function paintJobList(listEl, emptyEl, tab) {
    const rows = filtered(tab);
    if (tab === "queue" && el.queueMeta) {
      el.queueMeta.textContent =
        rows.length === 1
          ? tt("service.jobs.jobCount", `${rows.length} job`, { count: rows.length })
          : tt("service.jobs.jobCountPlural", `${rows.length} jobs`, { count: rows.length });
    }
    if (!listEl) return;
    if (!rows.length) {
      listEl.innerHTML = "";
      emptyEl?.classList.remove("hidden");
      return;
    }
    emptyEl?.classList.add("hidden");
    listEl.innerHTML = rows
      .map((j) => {
        const detail =
          j.error || j.result?.message || j.payload?.command || j.payload?.scriptName || "";
        return `<article class="job-row ${statusClass(j.status)}">
          <div>
            <strong>${escapeHtml(j.title || j.kind || j.id)}</strong>
            <div class="job-meta">
              <span class="pill ${statusPill(j.status)}">${escapeHtml(j.status)}</span>
              <span class="pill">${escapeHtml(j.pool || j.kind || "")}</span>
              <span>${escapeHtml(j.kind || "")}</span>
              ${j.source ? `<span>· ${escapeHtml(j.source)}</span>` : ""}
              ${j.capacityBypass ? `<span>· ${escapeHtml(tt("service.jobs.bypass", "bypass"))}</span>` : ""}
              ${j.durationMs != null ? `<span>· ${escapeHtml(j.durationMs)}ms</span>` : ""}
            </div>
            ${detail ? `<div class="job-detail">${escapeHtml(detail)}</div>` : ""}
          </div>
          <div class="job-actions">
            ${
              j.status === "queued" || j.status === "running"
                ? `<button type="button" class="btn btn-sm btn-danger" data-cancel="${escapeHtml(j.id)}">${escapeHtml(tt("service.jobs.cancel", "Cancel"))}</button>`
                : `<button type="button" class="btn btn-sm" data-retry="${escapeHtml(j.id)}">${escapeHtml(tt("service.common.retry", "Retry"))}</button>`
            }
          </div>
        </article>`;
      })
      .join("");
    listEl.querySelectorAll("[data-cancel]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await api()?.cancel?.(btn.dataset.cancel);
        await refresh();
        setStatus(tt("service.jobs.cancelled", "Cancelled"), "ok");
      });
    });
    listEl.querySelectorAll("[data-retry]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const res = await api()?.retry?.(btn.dataset.retry);
        if (res?.ok === false) setStatus(res.error || tt("service.jobs.retryFailed", "Retry failed"), "err");
        else setStatus(tt("service.jobs.retried", "Retried"), "ok");
        await refresh();
      });
    });
  }

  function paintEnqueue() {
    if (!el.enqueuePanel) return;
    const kind = state.enqueueKind;
    const safeKind = kind === "noop" ? "shell" : kind;
    if (safeKind !== kind) state.enqueueKind = safeKind;
    const label =
      safeKind === "script"
        ? tt("service.jobs.scriptName", "Script name")
        : safeKind === "delay"
          ? tt("service.jobs.milliseconds", "Milliseconds")
          : tt("service.jobs.shellCommand", "Shell command");
    const placeholder =
      safeKind === "shell"
        ? tt("service.jobs.placeholderShell", "e.g. msl(list)")
        : safeKind === "script"
          ? tt("service.jobs.placeholderScript", "e.g. morning")
          : safeKind === "delay"
            ? "1500"
            : "";
    el.enqueuePanel.innerHTML = `
      <label class="field">
        <span>${escapeHtml(tt("service.jobs.kindLabel", "Kind"))}</span>
        <select id="enq-kind">
          <option value="shell" ${safeKind === "shell" ? "selected" : ""}>${escapeHtml(tt("service.jobs.shellCommand", "Shell command"))}</option>
          <option value="script" ${safeKind === "script" ? "selected" : ""}>${escapeHtml(tt("service.jobs.savedScript", "Saved script"))}</option>
          <option value="delay" ${safeKind === "delay" ? "selected" : ""}>${escapeHtml(tt("service.jobs.delayMs", "Delay (ms)"))}</option>
        </select>
      </label>
      <label class="field">
        <span>${escapeHtml(tt("service.jobs.titleOptional", "Title optional"))}</span>
        <input id="enq-title" type="text" value="${escapeHtml(state.enqueueTitle)}" spellcheck="false" />
      </label>
      <label class="field">
        <span>${escapeHtml(label)}</span>
        <input id="enq-text" type="text" value="${escapeHtml(state.enqueueText)}" spellcheck="false"
          placeholder="${escapeHtml(placeholder)}" />
      </label>
      <button type="button" class="btn btn-primary" id="enq-submit">${escapeHtml(tt("service.jobs.enqueue", "Enqueue"))}</button>`;
    document.getElementById("enq-kind")?.addEventListener("change", (e) => {
      const next = e.target.value === "noop" ? "shell" : e.target.value;
      state.enqueueKind = next;
      state.enqueueText = "";
      paintEnqueue();
    });
    document.getElementById("enq-title")?.addEventListener("input", (e) => {
      state.enqueueTitle = e.target.value || "";
    });
    document.getElementById("enq-text")?.addEventListener("input", (e) => {
      state.enqueueText = e.target.value || "";
    });
    document.getElementById("enq-submit")?.addEventListener("click", async () => {
      const payload = {
        kind: state.enqueueKind,
        title: state.enqueueTitle || undefined,
        source: "jobs-app",
      };
      if (state.enqueueKind === "shell") payload.command = state.enqueueText;
      if (state.enqueueKind === "script") payload.scriptName = state.enqueueText;
      if (state.enqueueKind === "delay") payload.delayMs = Number(state.enqueueText) || 1000;
      const res = await api()?.enqueue?.(payload);
      if (res?.ok === false) {
        setStatus(res.error || tt("service.jobs.enqueueFailed", "Enqueue failed"), "err");
        return;
      }
      setStatus(
        tt("service.jobs.queuedTitle", `Queued · ${res.job?.title || state.enqueueKind}`, {
          title: res.job?.title || state.enqueueKind,
        }),
        "ok"
      );
      state.enqueueText = "";
      state.enqueueTitle = "";
      setPage("queue");
      await refresh();
    });
  }

  function paintCapacity() {
    const c = state.capacity || {};
    const pools = c.pools || {};
    const poolRun = state.stats?.pools || {};
    const exceptions = Array.isArray(c.exceptions) ? c.exceptions : [];
    if (!el.capacityPanel) return;
    el.capacityPanel.innerHTML = `
      <p class="hint" style="padding-top:1rem">
        ${escapeHtml(tt("service.jobs.poolHint", "Four compute pools. Interactive and Connect are never paused by Focus or daily budget."))}
      </p>
      <div class="pool-grid">
        ${[
          ["interactive", "Interactive", 2, 12],
          ["connect", "Connect", 4, 16],
          ["shell", "Shell", 1, 12],
          ["background", "Background", 0, 8],
        ]
          .map(
            ([id, label, min, max]) => `<div class="pool-card">
            <label>
              ${escapeHtml(tt("service.jobs.poolMaxConcurrent", `${label} max concurrent`, { pool: label }))}
              <input type="number" min="${min}" max="${max}" id="pool-${id}"
                value="${escapeHtml(pools[id]?.maxConcurrent ?? (id === "connect" ? 10 : id === "interactive" ? 6 : id === "shell" ? 4 : 2))}" />
            </label>
            <div class="pool-running">${escapeHtml(tt("service.jobs.poolRunningNow", `Running now: ${poolRun[id]?.running ?? 0}`, { count: poolRun[id]?.running ?? 0 }))}</div>
          </div>`
          )
          .join("")}
      </div>
      <label class="check-row">
        <input type="checkbox" id="cap-connect-boost" ${c.connectBoost !== false ? "checked" : ""} />
        <div>
          <strong>${escapeHtml(tt("service.jobs.connectBoost", "Connect boost"))}</strong>
          <span>${escapeHtml(tt("service.jobs.connectBoostHint", "Prefer Connect / mail / browser work with a dedicated high-capacity pool."))}</span>
        </div>
      </label>
      <label class="field" style="padding:0.85rem 1.15rem;margin:0;border-bottom:1px solid var(--line-soft)">
        <span>${escapeHtml(tt("service.jobs.maxQueued", "Max queued (background/shell; interactive ignores this)"))}</span>
        <input type="number" min="20" max="300" id="cap-queued" value="${escapeHtml(c.maxQueued ?? 100)}" />
      </label>
      <label class="field" style="padding:0.85rem 1.15rem;margin:0;border-bottom:1px solid var(--line-soft)">
        <span>${escapeHtml(tt("service.jobs.dailyBudget", "Background daily budget (seconds, 0 = unlimited)"))}</span>
        <input type="number" min="0" max="86400" id="cap-budget" value="${escapeHtml(c.dailyBudgetSeconds ?? 0)}" />
      </label>
      <label class="check-row">
        <input type="checkbox" id="cap-focus" ${c.pauseWhenFocus !== false ? "checked" : ""} />
        <div>
          <strong>${escapeHtml(tt("service.jobs.pauseFocus", "Pause background while Focus is on"))}</strong>
          <span>${escapeHtml(tt("service.jobs.pauseFocusHint", "Holds the background pool during focus sessions."))}</span>
        </div>
      </label>
      <label class="check-row">
        <input type="checkbox" id="cap-notify" ${c.notifyOnDone !== false ? "checked" : ""} />
        <div>
          <strong>${escapeHtml(tt("service.jobs.notifyDone", "Notify on completions"))}</strong>
          <span>${escapeHtml(tt("service.jobs.notifyDoneHint", "Surface background completions and failures."))}</span>
        </div>
      </label>
      <div class="section-pad">${escapeHtml(tt("service.jobs.exceptions", "Exceptions"))}</div>
      <p class="hint">${escapeHtml(tt("service.jobs.exceptionsHint", "Match app id / source / title → force a pool. Max 8."))}</p>
      <div class="ex-list" id="ex-list">
        ${
          exceptions.length
            ? exceptions
                .map(
                  (ex, i) => `<div class="ex-row" data-ex-i="${i}">
              <input type="text" data-ex-match value="${escapeHtml(ex.match || "")}" placeholder="${escapeHtml(tt("service.jobs.matchPlaceholder", "match"))}" spellcheck="false" />
              <select data-ex-pool>
                <option value="interactive" ${ex.pool === "interactive" ? "selected" : ""}>Interactive</option>
                <option value="connect" ${ex.pool === "connect" ? "selected" : ""}>Connect</option>
                <option value="shell" ${ex.pool === "shell" ? "selected" : ""}>Shell</option>
                <option value="background" ${ex.pool === "background" ? "selected" : ""}>Background</option>
              </select>
              <select data-ex-priority>
                <option value="high" ${ex.priority === "high" ? "selected" : ""}>${escapeHtml(tt("service.jobs.priorityHigh", "High"))}</option>
                <option value="normal" ${ex.priority === "normal" ? "selected" : ""}>${escapeHtml(tt("service.jobs.priorityNormal", "Normal"))}</option>
                <option value="low" ${ex.priority === "low" ? "selected" : ""}>${escapeHtml(tt("service.jobs.priorityLow", "Low"))}</option>
              </select>
              <button type="button" class="btn btn-sm" data-ex-remove>${escapeHtml(tt("service.common.remove", "Remove"))}</button>
            </div>`
                )
                .join("")
            : `<p class="hint" style="padding:0">${escapeHtml(tt("service.jobs.noExceptions", "No exceptions — defaults by activity type."))}</p>`
        }
      </div>
      <div class="cap-actions">
        <button type="button" class="btn" id="ex-add">${escapeHtml(tt("service.jobs.addException", "Add exception"))}</button>
      </div>
      <p class="hint">
        ${escapeHtml(tt("service.jobs.backgroundUsedToday", `Background used today: ${c.usedBudgetSecondsToday || 0}s`, { seconds: c.usedBudgetSecondsToday || 0 }))}
        ${poolRun.background?.pausedByFocus ? ` · <strong>${escapeHtml(tt("service.jobs.backgroundPausedFocus", "Background paused by Focus"))}</strong>` : ""}
      </p>`;

    function readExceptions() {
      return [...el.capacityPanel.querySelectorAll(".ex-row")]
        .map((row) => ({
          match: row.querySelector("[data-ex-match]")?.value || "",
          pool: row.querySelector("[data-ex-pool]")?.value || "shell",
          priority: row.querySelector("[data-ex-priority]")?.value || "normal",
        }))
        .filter((ex) => String(ex.match).trim());
    }

    document.getElementById("ex-add")?.addEventListener("click", () => {
      const cur = readExceptions();
      if (cur.length >= 8) {
        setStatus(tt("service.jobs.maxExceptions", "Max 8 exceptions"), "err");
        return;
      }
      cur.push({ match: "", pool: "shell", priority: "normal" });
      state.capacity = { ...c, exceptions: cur };
      paintCapacity();
    });
    el.capacityPanel.querySelectorAll("[data-ex-remove]").forEach((btn) => {
      btn.addEventListener("click", () => btn.closest(".ex-row")?.remove());
    });
  }

  async function saveCapacity() {
    const panel = el.capacityPanel;
    if (!panel) return;
    const exceptions = [...panel.querySelectorAll(".ex-row")]
      .map((row) => ({
        match: row.querySelector("[data-ex-match]")?.value || "",
        pool: row.querySelector("[data-ex-pool]")?.value || "shell",
        priority: row.querySelector("[data-ex-priority]")?.value || "normal",
      }))
      .filter((ex) => String(ex.match).trim());
    const res = await api()?.setCapacity?.({
      pools: {
        interactive: { maxConcurrent: Number(panel.querySelector("#pool-interactive")?.value) },
        connect: { maxConcurrent: Number(panel.querySelector("#pool-connect")?.value) },
        shell: { maxConcurrent: Number(panel.querySelector("#pool-shell")?.value) },
        background: { maxConcurrent: Number(panel.querySelector("#pool-background")?.value) },
      },
      maxQueued: Number(panel.querySelector("#cap-queued")?.value),
      dailyBudgetSeconds: Number(panel.querySelector("#cap-budget")?.value),
      pauseWhenFocus: !!panel.querySelector("#cap-focus")?.checked,
      notifyOnDone: !!panel.querySelector("#cap-notify")?.checked,
      connectBoost: !!panel.querySelector("#cap-connect-boost")?.checked,
      exceptions,
      allowShell: true,
      allowScript: true,
      allowLaunch: true,
      allowProgram: true,
    });
    if (res?.ok === false) {
      setStatus(res.error || tt("service.jobs.saveFailed", "Save failed"), "err");
      return;
    }
    state.capacity = res.capacity || state.capacity;
    setStatus(tt("service.jobs.capacitySaved", "Capacity saved"), "ok");
    await refresh();
  }

  function paint() {
    updateBlurb();
    if (state.page === "queue") {
      paintStats();
      paintJobList(el.queueList, el.queueEmpty, "queue");
    } else if (state.page === "active") {
      paintJobList(el.activeList, el.activeEmpty, "active");
    } else if (state.page === "done") {
      paintJobList(el.doneList, el.doneEmpty, "done");
    } else if (state.page === "enqueue") {
      paintEnqueue();
    } else if (state.page === "capacity") {
      paintCapacity();
    }
  }

  async function refresh() {
    const jobsApi = api();
    if (!jobsApi) {
      setStatus(tt("service.jobs.bridgeUnavailable", "Jobs bridge unavailable"), "err");
      return;
    }
    const res = await jobsApi.stats();
    if (res?.ok === false) {
      setStatus(res.error || tt("service.jobs.loadFailed", "Could not load jobs"), "err");
      return;
    }
    state.jobs = res?.jobs || [];
    state.capacity = res?.capacity || state.capacity;
    state.stats = res?.stats || null;
    paint();
  }

  function applyRoute(route) {
    const raw = String(route?.page || route?.tab || "queue")
      .toLowerCase()
      .trim();
    const alias = {
      panel: "queue",
      open: "queue",
      home: "queue",
      all: "queue",
      running: "active",
      finished: "done",
      new: "enqueue",
      add: "enqueue",
      contract: "capacity",
      pools: "capacity",
    };
    setPage(alias[raw] || raw);
  }

  function ensureLive() {
    if (state.unsub || !api()?.onUpdated) return;
    state.unsub = api().onUpdated((data) => {
      state.jobs = data?.jobs || state.jobs;
      state.capacity = data?.capacity || state.capacity;
      state.stats = data?.stats || state.stats;
      paint();
    });
  }

  el.nav?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-page]");
    if (btn) setPage(btn.dataset.page);
  });
  el.btnRefresh?.addEventListener("click", () => void refresh().then(() => setStatus(tt("service.jobs.refreshed", "Refreshed"), "ok")));
  el.btnClear?.addEventListener("click", async () => {
    await api()?.clearFinished?.();
    setStatus(tt("service.jobs.clearedFinished", "Cleared finished"), "ok");
    await refresh();
  });
  el.btnClearDone?.addEventListener("click", async () => {
    await api()?.clearFinished?.();
    setStatus(tt("service.jobs.clearedFinished", "Cleared finished"), "ok");
    await refresh();
  });
  el.btnCapSave?.addEventListener("click", () => void saveCapacity());
  el.queueSearch?.addEventListener("input", () => {
    state.filter.queue = el.queueSearch.value || "";
    paintJobList(el.queueList, el.queueEmpty, "queue");
  });
  el.activeSearch?.addEventListener("input", () => {
    state.filter.active = el.activeSearch.value || "";
    paintJobList(el.activeList, el.activeEmpty, "active");
  });
  el.doneSearch?.addEventListener("input", () => {
    state.filter.done = el.doneSearch.value || "";
    paintJobList(el.doneList, el.doneEmpty, "done");
  });
  window.JobsApp = {
    setPage,
    applyRoute,
    refresh,
  };
  window.addEventListener("myspace-i18n-applied", () => paint());
  ensureLive();
  void refresh()
    .then(() => setPage("queue"))
    .catch((err) => setStatus(err?.message || String(err), "err"));
})();