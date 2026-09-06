(function () {
  const api = window.myApp;

  const SECONDARY_VIEWS = new Set(["someday", "upcoming", "flagged", "all", "done"]);

  const els = {
    appShell: document.getElementById("app-shell"),
    smartNav: document.getElementById("smart-nav"),
    smartNavMore: document.getElementById("smart-nav-more"),
    navMore: document.getElementById("nav-more"),
    navMoreToggle: document.getElementById("nav-more-toggle"),
    projectList: document.getElementById("project-list"),
    taskList: document.getElementById("task-list"),
    emptyList: document.getElementById("empty-list"),
    listTitle: document.getElementById("list-title"),
    listSub: document.getElementById("list-sub"),
    captureForm: document.getElementById("capture-form"),
    captureInput: document.getElementById("capture-input"),
    searchInput: document.getElementById("search-input"),
    searchToolbar: document.getElementById("search-toolbar"),
    btnSearchToggle: document.getElementById("btn-search-toggle"),
    btnSearchClose: document.getElementById("btn-search-close"),
    btnNew: document.getElementById("btn-new"),
    btnAddProject: document.getElementById("btn-add-project"),
    btnAddList: document.getElementById("btn-add-list"),
    editorPane: document.getElementById("editor-pane"),
    editor: document.getElementById("editor"),
    bucketChips: document.getElementById("bucket-chips"),
    waitingField: document.getElementById("waiting-field"),
    propsPanel: document.getElementById("props-panel"),
    btnCloseDetail: document.getElementById("btn-close-detail"),
    taskTitle: document.getElementById("task-title"),
    taskNotes: document.getElementById("task-notes"),
    taskTags: document.getElementById("task-tags"),
    taskBucket: document.getElementById("task-bucket"),
    taskProject: document.getElementById("task-project"),
    taskListSel: document.getElementById("task-list"),
    taskPriority: document.getElementById("task-priority"),
    taskDue: document.getElementById("task-due"),
    taskWaiting: document.getElementById("task-waiting"),
    checklist: document.getElementById("checklist"),
    checklistForm: document.getElementById("checklist-form"),
    checklistInput: document.getElementById("checklist-input"),
    btnFlag: document.getElementById("btn-flag"),
    btnSchedule: document.getElementById("btn-schedule"),
    btnComplete: document.getElementById("btn-complete"),
    btnDelete: document.getElementById("btn-delete"),
    saveStatus: document.getElementById("save-status"),
    editorMeta: document.getElementById("editor-meta"),
    countInbox: document.getElementById("count-inbox"),
    countToday: document.getElementById("count-today"),
    countUpcoming: document.getElementById("count-upcoming"),
    countNext: document.getElementById("count-next"),
    countWaiting: document.getElementById("count-waiting"),
    countSomeday: document.getElementById("count-someday"),
    countFlagged: document.getElementById("count-flagged"),
    countAll: document.getElementById("count-all"),
    countDone: document.getElementById("count-done"),
    projectModal: document.getElementById("project-modal"),
    projectForm: document.getElementById("project-form"),
    projectName: document.getElementById("project-name"),
    projectCancel: document.getElementById("project-cancel"),
    listModal: document.getElementById("list-modal"),
    listForm: document.getElementById("list-form"),
    listName: document.getElementById("list-name"),
    listCancel: document.getElementById("list-cancel"),
    confirmModal: document.getElementById("confirm-modal"),
    confirmForm: document.getElementById("confirm-form"),
    confirmTitle: document.getElementById("confirm-title"),
    confirmCopy: document.getElementById("confirm-copy"),
    confirmOk: document.getElementById("confirm-ok"),
    confirmCancel: document.getElementById("confirm-cancel"),
    toast: document.getElementById("toast"),
  };

  const VIEW_META = {
    inbox: { title: "Inbox", sub: "Capture & clarify" },
    today: { title: "Due today", sub: "Soft deadlines" },
    upcoming: { title: "Upcoming", sub: "Future due dates" },
    next: { title: "Next", sub: "Do now" },
    waiting: { title: "Waiting", sub: "Blocked on someone" },
    someday: { title: "Someday", sub: "Maybe later" },
    flagged: { title: "Flagged", sub: "Starred priorities" },
    all: { title: "All active", sub: "Everything open" },
    done: { title: "Completed", sub: "Finished work" },
  };

  const state = {
    projects: [],
    lists: [],
    items: [],
    counts: {},
    settings: {},
    view: "inbox",
    projectId: null,
    listId: null,
    search: "",
    selectedId: null,
    saveTimer: null,
    dirty: false,
    saving: false,
    busy: false,
    toastTimer: null,
    doneFadeTimer: null,
    confirmAction: null,
  };

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatWhen(iso) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  function parseTagsInput(raw) {
    return [
      ...new Set(
        String(raw || "")
          .split(/[,\s]+/)
          .map((t) => t.replace(/^#/, "").trim().toLowerCase())
          .filter(Boolean)
      ),
    ].slice(0, 20);
  }

  function toast(msg) {
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.classList.remove("hidden");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => els.toast.classList.add("hidden"), 2200);
  }

  function setSaveStatus(text) {
    if (els.saveStatus) els.saveStatus.textContent = text || "";
  }

  async function invoke(channel, args) {
    if (!api?.invoke) throw new Error("Tasks API unavailable");
    return api.invoke(channel, args || {});
  }

  function selectedItem() {
    return state.items.find((i) => i.id === state.selectedId) || null;
  }

  function projectById(id) {
    return state.projects.find((p) => p.id === id) || null;
  }

  function listById(id) {
    return state.lists.find((l) => l.id === id) || null;
  }

  function listsForProject(projectId) {
    return state.lists.filter((l) => l.projectId === projectId);
  }

  function applySnapshot(res) {
    if (!res?.ok) return;
    state.projects = res.projects || [];
    state.lists = res.lists || [];
    state.settings = res.settings || {};
    state.counts = res.counts || {};
    if (Array.isArray(res.items) && !res.viewFiltered) {
    }
  }

  function updateCounts() {
    const c = state.counts || {};
    const map = [
      ["countInbox", "inbox"],
      ["countToday", "today"],
      ["countUpcoming", "upcoming"],
      ["countNext", "next"],
      ["countWaiting", "waiting"],
      ["countSomeday", "someday"],
      ["countFlagged", "flagged"],
      ["countAll", "all"],
      ["countDone", "done"],
    ];
    for (const [elKey, key] of map) {
      if (els[elKey]) els[elKey].textContent = String(c[key] ?? 0);
    }
  }

  function setNavMoreOpen(open) {
    const on = Boolean(open);
    els.smartNavMore?.classList.toggle("hidden", !on);
    els.navMore?.classList.toggle("is-open", on);
    if (els.navMoreToggle) els.navMoreToggle.setAttribute("aria-expanded", on ? "true" : "false");
  }

  function syncSmartNav() {
    const inSmart = !state.projectId && !state.listId;
    const activeView = inSmart ? state.view : null;
    if (activeView && SECONDARY_VIEWS.has(activeView)) setNavMoreOpen(true);

    for (const root of [els.smartNav, els.smartNavMore]) {
      root?.querySelectorAll(".nav-item").forEach((btn) => {
        const v = btn.getAttribute("data-view");
        btn.classList.toggle("active", inSmart && state.view === v);
      });
    }
  }

  function syncDetailPanel(open) {
    const show = Boolean(open);
    els.editorPane?.classList.toggle("hidden", !show);
    els.appShell?.classList.toggle("has-detail", show);
  }

  function closeDetail() {
    state.selectedId = null;
    syncDetailPanel(false);
    renderList();
  }

  function syncHeader() {
    if (state.listId) {
      const list = listById(state.listId);
      const proj = list?.projectId ? projectById(list.projectId) : null;
      els.listTitle.textContent = list?.name || "List";
      els.listSub.textContent = proj ? `Project · ${proj.name}` : "Custom list";
    } else if (state.projectId) {
      const proj = projectById(state.projectId);
      els.listTitle.textContent = proj?.name || "Project";
      els.listSub.textContent = "All tasks in this project";
    } else {
      const meta = VIEW_META[state.view] || VIEW_META.all;
      els.listTitle.textContent = meta.title;
      els.listSub.textContent = meta.sub;
    }
    els.btnAddList.hidden = !state.projectId;
  }

  function filteredItems() {
    let list = state.items.slice();
    if (state.search) {
      const q = state.search.toLowerCase();
      list = list.filter((i) => {
        const blob = [i.title, i.notes, i.waitingOn, ...(i.tags || [])].join(" ").toLowerCase();
        return blob.includes(q);
      });
    }
    return list;
  }

  function renderProjects() {
    const root = els.projectList;
    if (!root) return;
    root.replaceChildren();
    const projects = state.projects.filter((p) => !p.archived);
    if (!projects.length) {
      const empty = document.createElement("p");
      empty.className = "sidebar-foot";
      empty.style.margin = "4px 10px";
      empty.textContent = "No projects yet";
      root.appendChild(empty);
      return;
    }

    for (const proj of projects) {
      const group = document.createElement("div");
      group.className = "proj-group";

      const head = document.createElement("button");
      head.type = "button";
      head.className = "proj-head";
      if (state.projectId === proj.id && !state.listId) head.classList.add("active");
      head.innerHTML = `<span class="proj-dot" style="background:${escapeHtml(
        proj.color || "#6eb6f7"
      )}"></span><span>${escapeHtml(proj.name)}</span>`;
      head.addEventListener("click", () => {
        state.view = "all";
        state.projectId = proj.id;
        state.listId = null;
        void refreshList();
      });
      group.appendChild(head);

      const listsWrap = document.createElement("div");
      listsWrap.className = "proj-lists";
      for (const list of listsForProject(proj.id)) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "list-item";
        if (state.listId === list.id) btn.classList.add("active");
        btn.textContent = list.name;
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          state.view = "all";
          state.projectId = proj.id;
          state.listId = list.id;
          void refreshList();
        });
        listsWrap.appendChild(btn);
      }
      group.appendChild(listsWrap);
      root.appendChild(group);
    }
  }

  function renderList() {
    const items = filteredItems();
    els.taskList.replaceChildren();
    els.emptyList.classList.toggle("hidden", items.length > 0);

    for (const item of items) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "task-row";
      row.setAttribute("role", "listitem");
      if (item.id === state.selectedId) row.classList.add("active");
      if (item.status === "done") row.classList.add("is-done");

      const check = document.createElement("button");
      check.type = "button";
      check.className = "check";
      check.setAttribute("aria-checked", item.status === "done" ? "true" : "false");
      check.title = item.status === "done" ? "Mark active" : "Complete";
      check.textContent = item.status === "done" ? "✓" : "";
      check.addEventListener("click", (e) => {
        e.stopPropagation();
        void toggleDone(item.id);
      });

      const body = document.createElement("div");
      body.className = "task-row-body";
      const title = document.createElement("div");
      title.className = "task-row-title";
      title.textContent = item.title;
      const meta = document.createElement("div");
      meta.className = "task-row-meta";
      const chips = [];

      if (item.flagged) chips.push(`<span class="flag-mark" title="Flagged">★</span>`);

      const proj = item.projectId ? projectById(item.projectId) : null;
      if (proj) {
        chips.push(
          `<span class="meta-chip meta-chip--proj"><span class="meta-dot" style="background:${escapeHtml(
            proj.color || "#6eb6f7"
          )}"></span>${escapeHtml(proj.name)}</span>`
        );
      } else if (item.dueDate && state.view !== "today" && state.view !== "upcoming") {
        chips.push(`<span class="meta-chip meta-chip--due">${escapeHtml(item.dueDate)}</span>`);
      } else if (item.waitingOn && state.view !== "waiting") {
        const short =
          item.waitingOn.length > 28 ? `${item.waitingOn.slice(0, 28)}…` : item.waitingOn;
        chips.push(`<span class="meta-chip">${escapeHtml(short)}</span>`);
      } else if ((item.checklist || []).length) {
        const done = item.checklist.filter((c) => c.done).length;
        chips.push(`<span class="meta-chip">${done}/${item.checklist.length}</span>`);
      }

      meta.innerHTML = chips.slice(0, 2).join("");
      body.append(title, meta);

      row.append(check, body);
      row.addEventListener("click", () => selectItem(item.id));
      els.taskList.appendChild(row);
    }
  }

  function fillProjectSelects(item) {
    const projSel = els.taskProject;
    const listSel = els.taskListSel;
    projSel.replaceChildren();
    const none = document.createElement("option");
    none.value = "";
    none.textContent = "— None —";
    projSel.appendChild(none);
    for (const p of state.projects.filter((x) => !x.archived)) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      projSel.appendChild(opt);
    }
    projSel.value = item?.projectId || "";

    listSel.replaceChildren();
    const inbox = state.lists.find((l) => l.id === "list_inbox") || {
      id: "list_inbox",
      name: "Inbox",
    };
    const opts = [inbox, ...listsForProject(item?.projectId || null)];
    const seen = new Set();
    for (const l of opts) {
      if (seen.has(l.id)) continue;
      seen.add(l.id);
      const opt = document.createElement("option");
      opt.value = l.id;
      opt.textContent = l.name;
      listSel.appendChild(opt);
    }
    if (item?.listId && !seen.has(item.listId)) {
      const orphan = listById(item.listId);
      if (orphan) {
        const opt = document.createElement("option");
        opt.value = orphan.id;
        opt.textContent = orphan.name;
        listSel.appendChild(opt);
      }
    }
    listSel.value = item?.listId || "list_inbox";
  }

  function renderChecklist(item) {
    els.checklist.replaceChildren();
    for (const c of item.checklist || []) {
      const li = document.createElement("li");
      if (c.done) li.classList.add("done");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "check";
      btn.setAttribute("aria-checked", c.done ? "true" : "false");
      btn.textContent = c.done ? "✓" : "";
      btn.addEventListener("click", () => void toggleChecklist(item.id, c.id));
      const span = document.createElement("span");
      span.textContent = c.text;
      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn btn-ghost btn-sm";
      del.textContent = "×";
      del.title = "Remove";
      del.addEventListener("click", () => void deleteChecklist(item.id, c.id));
      li.append(btn, span, del);
      els.checklist.appendChild(li);
    }
  }

  function syncBucketChips(bucket) {
    const b = bucket || "inbox";
    els.taskBucket.value = b;
    els.bucketChips?.querySelectorAll(".chip").forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.bucket === b);
    });
    const showWaiting = b === "waiting" || Boolean(els.taskWaiting?.value?.trim());
    els.waitingField?.classList.toggle("hidden", !showWaiting);
  }

  function syncPropsPanel(item) {
    if (!els.propsPanel || !item) return;
    const hasDetails =
      item.projectId ||
      (item.listId && item.listId !== "list_inbox") ||
      item.priority ||
      item.dueDate ||
      item.waitingOn ||
      (item.tags || []).length;
    els.propsPanel.open = Boolean(hasDetails);
  }

  function showEditor(item) {
    if (!item) {
      syncDetailPanel(false);
      return;
    }
    syncDetailPanel(true);

    els.taskTitle.value = item.title || "";
    els.taskNotes.value = item.notes || "";
    els.taskTags.value = (item.tags || []).map((t) => `#${t}`).join(" ");
    syncBucketChips(item.bucket || "inbox");
    els.taskPriority.value = String(item.priority || 0);
    els.taskDue.value = item.dueDate || "";
    els.taskWaiting.value = item.waitingOn || "";
    fillProjectSelects(item);
    renderChecklist(item);
    syncPropsPanel(item);

    els.btnFlag.textContent = item.flagged ? "Unflag" : "Flag";
    els.btnComplete.textContent = item.status === "done" ? "Reopen" : "Done";
    const metaBits = [];
    if (item.completedAt) metaBits.push(`Done ${formatWhen(item.completedAt)}`);
    else if (item.updatedAt) metaBits.push(`Updated ${formatWhen(item.updatedAt)}`);
    els.editorMeta.textContent = metaBits.join(" · ");
    setSaveStatus("");
  }

  function selectItem(id) {
    state.selectedId = id;
    const item =
      state.items.find((i) => i.id === id) ||
      null;
    showEditor(item);
    renderList();
  }

  async function refreshList() {
    syncSmartNav();
    syncHeader();
    renderProjects();
    updateCounts();

    const args = { view: state.view };
    if (state.projectId) args.projectId = state.projectId;
    if (state.listId) args.listId = state.listId;
    if (state.view === "done") {
    } else if (state.projectId || state.listId) {
      args.view = "all";
    }

    const res = await invoke("items.list", args);
    if (!res?.ok) {
      toast(res?.error || "Failed to load");
      return;
    }
    state.items = res.items || [];
    state.counts = res.counts || state.counts;
    if (res.projects) state.projects = res.projects;
    if (res.lists) state.lists = res.lists;
    updateCounts();
    renderProjects();
    renderList();

    if (state.selectedId) {
      const still = state.items.find((i) => i.id === state.selectedId);
      if (still) showEditor(still);
      else {
        state.selectedId = null;
        showEditor(null);
      }
    }
  }

  async function reloadAll() {
    const snap = await invoke("snapshot");
    if (!snap?.ok) {
      toast(snap?.error || "Failed to load Tasks");
      return;
    }
    state.projects = snap.projects || [];
    state.lists = snap.lists || [];
    state.settings = snap.settings || {};
    state.counts = snap.counts || {};
    await refreshList();
  }

  async function capture(text) {
    const line = String(text || "").trim();
    if (!line) return;
    const payload = { text: line };
    if (state.projectId) payload.projectId = state.projectId;
    if (state.listId) payload.listId = state.listId;
    if (state.view === "next" || state.view === "waiting" || state.view === "someday") {
      payload.bucket = state.view;
    }
    const res = await invoke("item.add", payload);
    if (!res?.ok) {
      toast(res?.error || "Could not add");
      return;
    }
    state.counts = res.counts || state.counts;
    els.captureInput.value = "";
    toast(`Added · ${res.item?.title || "Task"}`);
    await refreshList();
    if (res.item?.id) selectItem(res.item.id);
  }

  function scheduleSave() {
    state.dirty = true;
    setSaveStatus("Editing…");
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(() => void flushSave(), 450);
  }

  async function flushSave() {
    const item = selectedItem();
    if (!item || state.saving) return;
    state.saving = true;
    setSaveStatus("Saving…");
    try {
      const res = await invoke("item.update", {
        id: item.id,
        title: els.taskTitle.value,
        notes: els.taskNotes.value,
        tags: parseTagsInput(els.taskTags.value),
        bucket: els.taskBucket.value,
        projectId: els.taskProject.value || null,
        listId: els.taskListSel.value || "list_inbox",
        priority: Number(els.taskPriority.value) || 0,
        dueDate: els.taskDue.value || null,
        waitingOn: els.taskWaiting.value,
      });
      if (!res?.ok) {
        setSaveStatus(res?.error || "Save failed");
        toast(res?.error || "Save failed");
        return;
      }
      state.dirty = false;
      state.counts = res.counts || state.counts;
      const idx = state.items.findIndex((i) => i.id === res.item.id);
      if (idx >= 0) state.items[idx] = res.item;
      else state.items.unshift(res.item);
      updateCounts();
      renderList();
      showEditor(res.item);
      setSaveStatus("Saved");
    } finally {
      state.saving = false;
    }
  }

  async function toggleDone(id) {
    clearTimeout(state.doneFadeTimer);
    const res = await invoke("item.toggle", { id });
    if (!res?.ok) {
      toast(res?.error || "Update failed");
      return;
    }
    state.counts = res.counts || state.counts;
    updateCounts();

    const item = res.item;
    const onDoneView = state.view === "done";
    const activeOnlyView = !onDoneView && !state.projectId && !state.listId
      ? ["inbox", "today", "upcoming", "next", "waiting", "someday", "flagged", "all"].includes(state.view)
      : !onDoneView;

    if (item?.status === "done" && activeOnlyView) {
      const idx = state.items.findIndex((i) => i.id === id);
      if (idx >= 0) state.items[idx] = item;
      else state.items.unshift(item);
      state.selectedId = id;
      renderList();
      showEditor(item);
      toast("Completed — still in Completed (sidebar)");
      state.doneFadeTimer = setTimeout(() => {
        if (state.view === "done") return;
        state.items = state.items.filter((i) => i.id !== id);
        if (state.selectedId === id) {
          showEditor(item);
        }
        renderList();
      }, 1400);
      return;
    }

    if (item?.status === "active" && onDoneView) {
      toast("Reopened");
      await refreshList();
      state.view = item.bucket || "inbox";
      state.projectId = null;
      state.listId = null;
      await refreshList();
      selectItem(id);
      return;
    }

    await refreshList();
    if (item?.id) {
      const still = state.items.find((i) => i.id === item.id);
      if (still) selectItem(item.id);
      else {
        state.selectedId = item.id;
        showEditor(item);
      }
    }
  }

  async function toggleChecklist(taskId, checklistId) {
    const res = await invoke("item.checklist.toggle", { id: taskId, checklistId });
    if (!res?.ok) return toast(res?.error || "Failed");
    const idx = state.items.findIndex((i) => i.id === taskId);
    if (idx >= 0) state.items[idx] = res.item;
    if (state.selectedId === taskId) showEditor(res.item);
    renderList();
  }

  async function deleteChecklist(taskId, checklistId) {
    const res = await invoke("item.checklist.delete", { id: taskId, checklistId });
    if (!res?.ok) return toast(res?.error || "Failed");
    const idx = state.items.findIndex((i) => i.id === taskId);
    if (idx >= 0) state.items[idx] = res.item;
    if (state.selectedId === taskId) showEditor(res.item);
  }

  function askConfirm({ title, copy, okLabel }, action) {
    els.confirmTitle.textContent = title;
    els.confirmCopy.textContent = copy;
    els.confirmOk.textContent = okLabel || "Delete";
    state.confirmAction = action;
    els.confirmModal.showModal();
  }

  // ── Events ──

  function onSmartNavClick(e) {
    const btn = e.target.closest(".nav-item");
    if (!btn) return;
    state.view = btn.getAttribute("data-view") || "inbox";
    state.projectId = null;
    state.listId = null;
    void refreshList();
  }

  els.smartNav?.addEventListener("click", onSmartNavClick);
  els.smartNavMore?.addEventListener("click", onSmartNavClick);

  els.navMoreToggle?.addEventListener("click", () => {
    const open = els.smartNavMore?.classList.contains("hidden");
    setNavMoreOpen(open);
  });

  els.bucketChips?.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    syncBucketChips(chip.dataset.bucket);
    if (chip.dataset.bucket === "waiting") els.waitingField?.classList.remove("hidden");
    scheduleSave();
  });

  els.btnCloseDetail?.addEventListener("click", closeDetail);

  els.btnSearchToggle?.addEventListener("click", () => {
    els.searchToolbar?.classList.remove("hidden");
    els.searchInput?.focus();
  });

  els.btnSearchClose?.addEventListener("click", () => {
    state.search = "";
    if (els.searchInput) els.searchInput.value = "";
    els.searchToolbar?.classList.add("hidden");
    renderList();
  });

  els.captureForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    void capture(els.captureInput.value);
  });

  els.searchInput?.addEventListener("input", () => {
    state.search = els.searchInput.value.trim();
    renderList();
  });

  els.btnNew?.addEventListener("click", () => {
    els.captureInput.focus();
  });

  els.btnAddProject?.addEventListener("click", () => {
    els.projectName.value = "";
    els.projectModal.showModal();
    els.projectName.focus();
  });

  els.projectCancel?.addEventListener("click", () => els.projectModal.close());
  els.projectForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = els.projectName.value.trim();
    if (!name) return;
    const res = await invoke("project.add", { name });
    els.projectModal.close();
    if (!res?.ok) return toast(res?.error || "Failed");
    toast(`Project · ${res.project.name}`);
    state.projectId = res.project.id;
    state.listId = null;
    state.view = "all";
    await reloadAll();
  });

  els.btnAddList?.addEventListener("click", () => {
    if (!state.projectId) return;
    els.listName.value = "";
    els.listModal.showModal();
    els.listName.focus();
  });
  els.listCancel?.addEventListener("click", () => els.listModal.close());
  els.listForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = els.listName.value.trim();
    if (!name || !state.projectId) return;
    const res = await invoke("list.add", { name, projectId: state.projectId });
    els.listModal.close();
    if (!res?.ok) return toast(res?.error || "Failed");
    state.listId = res.list.id;
    await reloadAll();
  });

  ["taskTitle", "taskNotes", "taskTags", "taskWaiting"].forEach((key) => {
    els[key]?.addEventListener("input", scheduleSave);
  });
  ["taskProject", "taskListSel", "taskPriority", "taskDue"].forEach((key) => {
    els[key]?.addEventListener("change", () => {
      if (key === "taskProject") {
        fillProjectSelects({
          ...selectedItem(),
          projectId: els.taskProject.value || null,
          listId: els.taskListSel.value,
        });
      }
      scheduleSave();
    });
  });

  els.taskWaiting?.addEventListener("input", () => {
    if (els.taskWaiting.value.trim()) els.waitingField?.classList.remove("hidden");
    scheduleSave();
  });

  els.checklistForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const item = selectedItem();
    const text = els.checklistInput.value.trim();
    if (!item || !text) return;
    const res = await invoke("item.checklist.add", { id: item.id, text });
    if (!res?.ok) return toast(res?.error || "Failed");
    els.checklistInput.value = "";
    const idx = state.items.findIndex((i) => i.id === item.id);
    if (idx >= 0) state.items[idx] = res.item;
    showEditor(res.item);
    renderList();
  });

  els.btnFlag?.addEventListener("click", async () => {
    const item = selectedItem();
    if (!item) return;
    const res = await invoke("item.flag", { id: item.id });
    if (!res?.ok) return toast(res?.error || "Failed");
    state.counts = res.counts || state.counts;
    await refreshList();
    selectItem(item.id);
  });

  els.btnComplete?.addEventListener("click", async () => {
    const item = selectedItem();
    if (!item) return;
    await toggleDone(item.id);
  });

  els.btnSchedule?.addEventListener("click", async () => {
    const item = selectedItem();
    if (!item) return;
    const res = await invoke("item.scheduleToday", { id: item.id });
    if (!res?.ok) return toast(res?.error || "Could not send to Today");
    toast(`Scheduled on Today · ${item.title}`);
    await refreshList();
    selectItem(item.id);
  });

  els.btnDelete?.addEventListener("click", () => {
    const item = selectedItem();
    if (!item) return;
    askConfirm(
      {
        title: "Delete task?",
        copy: `"${item.title}" will be removed permanently.`,
        okLabel: "Delete",
      },
      async () => {
        const res = await invoke("item.delete", { id: item.id });
        if (!res?.ok) return toast(res?.error || "Delete failed");
        closeDetail();
        state.counts = res.counts || state.counts;
        await refreshList();
        toast("Deleted");
      }
    );
  });

  els.confirmCancel?.addEventListener("click", () => els.confirmModal.close());
  els.confirmForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const action = state.confirmAction;
    state.confirmAction = null;
    els.confirmModal.close();
    if (typeof action === "function") await action();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "n" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      els.captureInput?.focus();
    }
    if (e.key === "Escape" && state.selectedId) {
      closeDetail();
    }
    if (
      e.key === "Delete" &&
      state.selectedId &&
      document.activeElement?.tagName !== "INPUT" &&
      document.activeElement?.tagName !== "TEXTAREA"
    ) {
      els.btnDelete?.click();
    }
  });

  // ── Shell API ──

  function setPage(page, opts = {}) {
    const p = String(page || "inbox").toLowerCase();
    const smart = ["inbox", "today", "upcoming", "next", "waiting", "someday", "flagged", "all", "done", "home"];
    if (smart.includes(p)) {
      state.view = p === "home" ? "inbox" : p;
      state.projectId = null;
      state.listId = null;
    }
    if (opts.projectId) {
      state.projectId = opts.projectId;
      state.listId = opts.listId || null;
      state.view = "all";
    }
    if (opts.q != null) {
      state.search = String(opts.q);
      if (els.searchInput) els.searchInput.value = state.search;
    }
    void refreshList().then(() => {
      if (opts.itemId || opts.taskId) selectItem(opts.itemId || opts.taskId);
    });
  }

  function openTask(ref) {
    void (async () => {
      const res = await invoke("item.get", { ref });
      if (!res?.ok) {
        toast(res?.error || "Not found");
        return;
      }
      state.view = "all";
      state.projectId = res.item.projectId || null;
      state.listId = null;
      await refreshList();
      // Ensure item visible even if filtered out of current list
      if (!state.items.some((i) => i.id === res.item.id)) {
        state.items.unshift(res.item);
        renderList();
      }
      selectItem(res.item.id);
    })();
  }

  window.TasksApp = {
    setPage,
    openTask,
    refresh: (route) => {
      if (route && typeof route === "object") {
        if (route.page) setPage(route.page, route);
        else if (route.projectId || route.q || route.itemId || route.taskId) {
          setPage(route.page || state.view || "inbox", route);
        } else {
          void reloadAll();
        }
        return;
      }
      return reloadAll();
    },
    capture: (text) => capture(text),
  };

  void reloadAll();
})();
