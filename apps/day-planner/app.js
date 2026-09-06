(() => {
  const api = () => window.myApp;

  let filter = "today";
  let buckets = { today: [], tomorrow: [], later: [], done: [] };
  let today = "";
  let nowHM = "";
  let counts = { today: 0, tomorrow: 0, later: 0, done: 0, open: 0 };

  function el(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function invoke(channel, args) {
    if (!api()?.invoke) throw new Error("Today unavailable");
    return api().invoke(channel, args);
  }

  function localTodayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function localNowHM() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function addDaysLocal(iso, days) {
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return localTodayISO();
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function formatLongDate(iso) {
    try {
      const d = new Date(`${iso}T12:00:00`);
      return d.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
    } catch {
      return iso;
    }
  }
  
  function formatTimeLabel(hm) {
    if (!hm) return "Anytime";
    try {
      const [h, m] = hm.split(":").map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    } catch {
      return hm;
    }
  }

  function hourKey(hm) {
    if (!hm) return "anytime";
    return hm.slice(0, 2) + ":00";
  }

  function dueLabel(iso) {
    if (!iso) return "";
    if (iso === today) return "Today";
    if (iso === addDaysLocal(today, 1)) return "Tomorrow";
    try {
      return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    } catch {
      return iso;
    }
  }

  function priorityChip(p) {
    if (p === "urgent") return `<span class="chip chip-urgent">Urgent</span>`;
    if (p === "high") return `<span class="chip chip-high">High</span>`;
    if (p === "low") return `<span class="chip chip-low">Low</span>`;
    return "";
  }

  function dueDateForWhen(when) {
    const base = today || localTodayISO();
    if (when === "tomorrow") return addDaysLocal(base, 1);
    if (when === "later") return addDaysLocal(base, 3);
    return base;
  }

  function defaultComposerTime() {
    const d = new Date();
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    if (d.getMinutes() === 60) {
      d.setHours(d.getHours() + 1, 0, 0, 0);
    }
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function applyListResult(res) {
    if (!res?.ok) throw new Error(res?.error || "Failed to load tasks");
    today = res.today || today || localTodayISO();
    nowHM = res.now || localNowHM();
    buckets = res.buckets || buckets;
    if (res.counts) {
      counts = res.counts;
    } else if (res.buckets) {
      const b = res.buckets;
      counts = {
        today: b.today?.length || 0,
        tomorrow: b.tomorrow?.length || 0,
        later: b.later?.length || 0,
        done: b.done?.length || 0,
        open: (b.today?.length || 0) + (b.tomorrow?.length || 0) + (b.later?.length || 0),
      };
    }
    render();
    publishScreen();
  }

  async function refresh() {
    const res = await invoke("tasks.list");
    applyListResult(res);
  }

  function tasksForFilter() {
    if (filter === "all") {
      return [
        { key: "today", title: "Today", items: buckets.today },
        { key: "tomorrow", title: "Tomorrow", items: buckets.tomorrow },
        { key: "later", title: "Later", items: buckets.later },
        { key: "done", title: "Done", items: buckets.done.slice(0, 30) },
      ].filter((s) => s.items.length);
    }
    const map = {
      today: { key: "today", title: "Today", items: buckets.today },
      tomorrow: { key: "tomorrow", title: "Tomorrow", items: buckets.tomorrow },
      later: { key: "later", title: "Later", items: buckets.later },
      done: { key: "done", title: "Done", items: buckets.done },
    };
    const section = map[filter];
    return section ? [section] : [];
  }

  function groupByHour(items) {
    const groups = [];
    const map = new Map();
    for (const task of items) {
      const key = hourKey(task.dueTime);
      if (!map.has(key)) {
        const g = { key, label: key === "anytime" ? "Anytime" : formatTimeLabel(key), items: [] };
        map.set(key, g);
        groups.push(g);
      }
      map.get(key).items.push(task);
    }
    return groups;
  }

  function taskStateClass(task) {
    const classes = [];
    if (task.done) classes.push("is-done");
    if (!task.done && task.dueTime && task.dueDate === today) {
      if (task.dueTime < nowHM) classes.push("is-past");
      if (task.dueTime.slice(0, 2) === nowHM.slice(0, 2)) classes.push("is-current");
    }
    return classes.join(" ");
  }

  function renderTask(task) {
    const timeText = task.dueTime ? formatTimeLabel(task.dueTime) : "Anytime";
    return `
      <article class="task ${taskStateClass(task)}" data-id="${escapeHtml(task.id)}">
        <p class="task-time ${task.dueTime ? "" : "is-anytime"}">${escapeHtml(timeText)}</p>
        <span class="task-dot" aria-hidden="true"></span>
        <div class="task-card">
          <button type="button" class="task-check ${task.done ? "is-on" : ""}" data-toggle="${escapeHtml(task.id)}" aria-label="Mark done">${task.done ? "✓" : ""}</button>
          <div class="task-body">
            <p class="task-title">${escapeHtml(task.title)}</p>
            ${task.notes ? `<p class="task-notes">${escapeHtml(task.notes)}</p>` : ""}
            <div class="task-meta">
              <span class="chip">${escapeHtml(dueLabel(task.dueDate))}</span>
              ${priorityChip(task.priority)}
              ${task.notify && task.dueTime ? `<span class="chip chip-notify">Notify</span>` : ""}
            </div>
            ${
              task.done
                ? ""
                : `<div class="action-row">
              <button type="button" class="btn btn-ghost btn-sm" data-toggle="${escapeHtml(task.id)}">Done</button>
              <div class="snooze-menu">
                <button type="button" class="btn btn-ghost btn-sm" data-snooze-open="${escapeHtml(task.id)}">Snooze ▾</button>
                <div class="snooze-pop" id="snooze-${escapeHtml(task.id)}">
                  <button type="button" data-snooze="${escapeHtml(task.id)}" data-minutes="15">+15 min</button>
                  <button type="button" data-snooze="${escapeHtml(task.id)}" data-minutes="60">+1 hour</button>
                  <button type="button" data-snooze="${escapeHtml(task.id)}" data-preset="tomorrow">Tomorrow 9:00</button>
                </div>
              </div>
            </div>`
            }
          </div>
        </div>
        <div class="task-actions">
          <button type="button" class="icon-btn" data-edit="${escapeHtml(task.id)}" title="Edit">✎</button>
          <button type="button" class="icon-btn delete" data-delete="${escapeHtml(task.id)}" title="Delete">✕</button>
        </div>
      </article>`;
  }

  function renderAgenda(items) {
    if (filter === "done") {
      return `<div class="agenda">${items.map(renderTask).join("")}</div>`;
    }
    const groups = groupByHour(items);
    return `
      <div class="agenda">
        ${groups
          .map((g) => {
            const isNow = g.key !== "anytime" && g.key.slice(0, 2) === nowHM.slice(0, 2) && filter === "today";
            return `
            <div class="hour-block">
              <p class="hour-label ${isNow ? "is-now" : ""}">${escapeHtml(g.label)}</p>
              ${g.items.map(renderTask).join("")}
            </div>`;
          })
          .join("")}
      </div>`;
  }

  function render() {
    nowHM = localNowHM();
    el("hero-date").textContent = formatLongDate(today);
    el("nav-today").textContent = String(counts.today || 0);
    el("nav-tomorrow").textContent = String(counts.tomorrow || 0);
    el("nav-later").textContent = String(counts.later || 0);
    el("nav-done").textContent = String(counts.done || 0);

    const titles = {
      today: "Today",
      tomorrow: "Tomorrow",
      later: "Later",
      done: "Done",
      all: "Everything",
    };
    el("page-title").textContent = titles[filter] || "Today";
    const openToday = counts.today || 0;
    el("page-subtitle").textContent =
      filter === "today"
        ? openToday
          ? `${openToday} on the agenda · now ${formatTimeLabel(nowHM)}`
          : "Clear day — schedule what matters"
        : `${counts.open || 0} open overall`;

    el("btn-clear-done").hidden = filter !== "done" || !(counts.done > 0);

    document.querySelectorAll("#bucket-nav .nav-item").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.filter === filter);
    });

    const sections = tasksForFilter();
    const board = el("board");
    const empty = el("empty");
    if (!sections.length || sections.every((s) => !s.items.length)) {
      board.innerHTML = "";
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    board.innerHTML = sections
      .map(
        (s) => `
      <section class="section" data-section="${s.key}">
        <div class="section-head">
          <h2>${escapeHtml(s.title)}</h2>
          <span>${s.items.length}</span>
        </div>
        ${renderAgenda(s.items)}
      </section>`
      )
      .join("");

    bindBoard(board);
  }

  function bindBoard(board) {
    board.querySelectorAll("[data-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => toggleTask(btn.dataset.toggle));
    });
    board.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", () => deleteTask(btn.dataset.delete));
    });
    board.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const task = findTask(btn.dataset.edit);
        if (task) openEditModal(task);
      });
    });
    board.querySelectorAll("[data-snooze-open]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.dataset.snoozeOpen;
        document.querySelectorAll(".snooze-pop.open").forEach((p) => {
          if (p.id !== `snooze-${id}`) p.classList.remove("open");
        });
        el(`snooze-${id}`)?.classList.toggle("open");
      });
    });
    board.querySelectorAll("[data-snooze]").forEach((btn) => {
      btn.addEventListener("click", () => {
        snoozeTask(btn.dataset.snooze, {
          minutes: btn.dataset.minutes ? Number(btn.dataset.minutes) : undefined,
          preset: btn.dataset.preset,
        });
      });
    });
  }

  function findTask(id) {
    for (const key of ["today", "tomorrow", "later", "done"]) {
      const hit = (buckets[key] || []).find((t) => t.id === id);
      if (hit) return hit;
    }
    return null;
  }

  async function addTaskFromComposer(e) {
    e.preventDefault();
    const input = el("task-input");
    const title = input.value.trim();
    if (!title) {
      input.focus();
      return;
    }
    const when = el("task-when").value || "today";
    const dueTime = el("task-time").value || null;
    try {
      const res = await invoke("task.add", {
        title,
        dueDate: dueDateForWhen(when),
        dueTime,
        notify: Boolean(el("task-notify").checked),
        priority: el("task-priority").value,
      });
      if (!res?.ok) throw new Error(res?.error || "Could not add task");
      input.value = "";
      el("task-time").value = defaultComposerTime();
      if (filter !== "all" && ["today", "tomorrow", "later"].includes(when)) {
        filter = when;
      }
      applyListResult(res);
      input.focus();
    } catch (err) {
      alert(err?.message || String(err));
    }
  }

  async function toggleTask(id) {
    try {
      const res = await invoke("task.toggle", { id });
      applyListResult(res);
    } catch (err) {
      alert(err?.message || String(err));
    }
  }

  async function deleteTask(id) {
    try {
      const res = await invoke("task.delete", { id });
      applyListResult(res);
    } catch (err) {
      alert(err?.message || String(err));
    }
  }

  async function snoozeTask(id, opts) {
    try {
      const payload = { id };
      if (opts.preset) payload.preset = opts.preset;
      else payload.minutes = opts.minutes || 15;
      const res = await invoke("task.snooze", payload);
      if (!res?.ok) throw new Error(res?.error || "Snooze failed");
      applyListResult(res);
    } catch (err) {
      alert(err?.message || String(err));
    }
  }

  function openModal(html) {
    el("modal-card").innerHTML = html;
    el("modal").classList.remove("hidden");
  }

  function closeModal() {
    el("modal").classList.add("hidden");
    el("modal-card").innerHTML = "";
  }

  function openEditModal(task) {
    openModal(`
      <h3>Edit</h3>
      <div class="field"><label>Title</label><input id="m-title" value="${escapeHtml(task.title)}" /></div>
      <div class="field"><label>Notes</label><textarea id="m-notes">${escapeHtml(task.notes || "")}</textarea></div>
      <div class="field-row">
        <div class="field"><label>Date</label><input id="m-due" type="date" value="${escapeHtml(task.dueDate)}" /></div>
        <div class="field"><label>Time</label><input id="m-time" type="time" value="${escapeHtml(task.dueTime || "")}" /></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Priority</label>
          <select id="m-priority">
            <option value="low" ${task.priority === "low" ? "selected" : ""}>Low</option>
            <option value="normal" ${task.priority === "normal" ? "selected" : ""}>Normal</option>
            <option value="high" ${task.priority === "high" ? "selected" : ""}>High</option>
            <option value="urgent" ${task.priority === "urgent" ? "selected" : ""}>Urgent</option>
          </select>
        </div>
        <div class="field"><label>Reminder</label>
          <label class="notify-toggle" style="margin-top:4px">
            <input type="checkbox" id="m-notify" ${task.notify ? "checked" : ""} />
            <span>Notify at time</span>
          </label>
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="m-cancel">Cancel</button>
        <button type="button" class="btn btn-primary" id="m-save">Save</button>
      </div>
    `);
    el("m-cancel").onclick = closeModal;
    el("m-save").onclick = async () => {
      const title = el("m-title").value.trim();
      if (!title) return;
      try {
        const res = await invoke("task.update", {
          id: task.id,
          title,
          notes: el("m-notes").value.trim(),
          dueDate: el("m-due").value,
          dueTime: el("m-time").value || null,
          notify: Boolean(el("m-notify").checked),
          priority: el("m-priority").value,
          notifiedAt: null,
        });
        if (!res?.ok) throw new Error(res?.error || "Save failed");
        closeModal();
        applyListResult(res);
      } catch (err) {
        alert(err?.message || String(err));
      }
    };
    el("m-title").focus();
  }

  function openAiModal() {
    openModal(`
      <h3>✦ Break down a goal</h3>
      <p class="modal-lead">AI turns a goal into timed agenda items with reminders.</p>
      <div class="field"><label>Language</label>
        <select id="m-lang">
          <option value="en">English</option>
          <option value="he">עברית</option>
        </select>
      </div>
      <div class="field"><label>How many?</label>
        <select id="m-count">
          <option value="5">5</option>
          <option value="6" selected>6</option>
          <option value="8">8</option>
          <option value="10">10</option>
        </select>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="m-cancel">Cancel</button>
        <button type="button" class="btn btn-primary" id="m-save">Generate</button>
      </div>
    `);
    el("m-cancel").onclick = closeModal;
    el("m-save").onclick = async () => {
      const goal = el("m-goal").value.trim();
      if (!goal) return;
      const btn = el("m-save");
      btn.disabled = true;
      btn.textContent = "Working…";
      try {
        const res = await invoke("tasks.generate", {
          goal,
          language: el("m-lang").value,
          count: Number(el("m-count").value) || 6,
          apply: true,
        });
        if (!res?.ok) throw new Error(res?.error || "Generate failed");
        closeModal();
        filter = "today";
        applyListResult(res);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = "Generate";
        alert(err?.message || String(err));
      }
    };
    el("m-goal").focus();
  }

  function publishScreen() {
    invoke("screen.publish", {
      app: "Today",
      filter,
      today,
      counts,
      openTitles: (buckets.today || []).slice(0, 8).map((t) => ({
        title: t.title,
        time: t.dueTime,
      })),
    }).catch(() => {});
  }

  function bind() {
    el("task-time").value = defaultComposerTime();
    el("composer").addEventListener("submit", addTaskFromComposer);
    el("btn-ai").addEventListener("click", openAiModal);
    el("btn-clear-done").addEventListener("click", async () => {
      if (!confirm("Clear all completed tasks?")) return;
      const res = await invoke("tasks.clearDone");
      applyListResult(res);
    });
    el("bucket-nav").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-filter]");
      if (!btn) return;
      filter = btn.dataset.filter;
      render();
      publishScreen();
    });
    el("modal").addEventListener("click", (e) => {
      if (e.target.id === "modal") closeModal();
    });
    document.addEventListener("click", () => {
      document.querySelectorAll(".snooze-pop.open").forEach((p) => p.classList.remove("open"));
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });
    setInterval(() => {
      const next = localNowHM();
      if (next !== nowHM) {
        nowHM = next;
        if (filter === "today" || filter === "all") render();
      }
    }, 30 * 1000);
  }

  window.DayPlannerApp = {
    setPage(page) {
      const map = { home: "today", today: "today", tomorrow: "tomorrow", later: "later", done: "done", all: "all" };
      filter = map[page] || "today";
      refresh()
        .then(() => render())
        .catch(() => render());
    },
    refresh() {
      return refresh().then(() => {
        render();
        return { ok: true };
      });
    },
  };

  async function init() {
    bind();
    try {
      await refresh();
      el("task-input").focus();
    } catch (err) {
      el("board").innerHTML = `<p class="empty-state">${escapeHtml(err?.message || String(err))}</p>`;
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();