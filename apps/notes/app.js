(function () {
  function tt(key, fallback, vars) {
    const I = window.MySpaceI18n;
    if (!I?.t) return fallback || key;
    const v = I.t(key, vars);
    return v === key ? (fallback || key) : v;
  }

  const api = window.myApp;

  const els = {
    railNav: document.getElementById("rail-nav"),
    notebookList: document.getElementById("notebook-list"),
    tagCloud: document.getElementById("tag-cloud"),
    noteList: document.getElementById("note-list"),
    emptyList: document.getElementById("empty-list"),
    listTitle: document.getElementById("list-title"),
    listSub: document.getElementById("list-sub"),
    captureForm: document.getElementById("capture-form"),
    captureInput: document.getElementById("capture-input"),
    searchInput: document.getElementById("search-input"),
    btnNew: document.getElementById("btn-new"),
    btnAddNotebook: document.getElementById("btn-add-notebook"),
    editorEmpty: document.getElementById("editor-empty"),
    editor: document.getElementById("editor"),
    noteTitle: document.getElementById("note-title"),
    noteTags: document.getElementById("note-tags"),
    noteBody: document.getElementById("note-body"),
    noteNotebook: document.getElementById("note-notebook"),
    btnPin: document.getElementById("btn-pin"),
    btnDuplicate: document.getElementById("btn-duplicate"),
    btnArchive: document.getElementById("btn-archive"),
    btnDelete: document.getElementById("btn-delete"),
    saveStatus: document.getElementById("save-status"),
    editorMeta: document.getElementById("editor-meta"),
    countAll: document.getElementById("count-all"),
    countPinned: document.getElementById("count-pinned"),
    countArchive: document.getElementById("count-archive"),
    notebookModal: document.getElementById("notebook-modal"),
    notebookForm: document.getElementById("notebook-form"),
    notebookName: document.getElementById("notebook-name"),
    notebookCancel: document.getElementById("notebook-cancel"),
    confirmModal: document.getElementById("confirm-modal"),
    confirmForm: document.getElementById("confirm-form"),
    confirmTitle: document.getElementById("confirm-title"),
    confirmCopy: document.getElementById("confirm-copy"),
    confirmOk: document.getElementById("confirm-ok"),
    confirmCancel: document.getElementById("confirm-cancel"),
    toast: document.getElementById("toast"),
    btnSignOut: document.getElementById("btn-sign-out"),
  };

  const state = {
    notebooks: [],
    notes: [],
    settings: { defaultNotebookId: "nb_inbox" },
    view: "all",
    notebookId: null,
    tag: null,
    search: "",
    selectedId: null,
    saveTimer: null,
    dirty: false,
    saving: false,
    saveToken: 0,
    busy: false,
    toastTimer: null,
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
      const diff = Date.now() - d.getTime();
      if (diff < 45_000) return tt("app.notes.justNow", "Just now");
      const mins = Math.max(1, Math.round(diff / 60_000));
      if (diff < 3_600_000) return tt("app.notes.minsAgo", `${mins}m ago`, { n: mins });
      const hours = Math.max(1, Math.round(diff / 3_600_000));
      if (diff < 86_400_000) return tt("app.notes.hoursAgo", `${hours}h ago`, { n: hours });
      const days = Math.max(1, Math.round(diff / 86_400_000));
      if (diff < 6 * 86_400_000) return tt("app.notes.daysAgo", `${days}d ago`, { n: days });
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

  function wordCount(text) {
    const t = String(text || "").trim();
    if (!t) return 0;
    return t.split(/\s+/).length;
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

  function notebookName(id) {
    return state.notebooks.find((n) => n.id === id)?.name || tt("app.notes.inboxFallback", "Inbox");
  }

  function filteredNotes() {
    let list = state.notes.slice();
    if (state.view === "archive") {
      list = list.filter((n) => n.archived);
    } else {
      list = list.filter((n) => !n.archived);
      if (state.view === "pinned") list = list.filter((n) => n.pinned);
      if (state.view === "notebook" && state.notebookId) {
        list = list.filter((n) => n.notebookId === state.notebookId);
      }
      if (state.view === "tag" && state.tag) {
        list = list.filter((n) => (n.tags || []).includes(state.tag));
      }
    }
    const q = state.search.trim().toLowerCase();
    if (q) {
      list = list.filter((n) => {
        const blob = [n.title, n.body, ...(n.tags || [])].join(" ").toLowerCase();
        return blob.includes(q);
      });
    }
    return list.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    });
  }

  function selectedNote() {
    return state.notes.find((n) => n.id === state.selectedId) || null;
  }

  function showToast(message, tone = "ok") {
    clearTimeout(state.toastTimer);
    els.toast.textContent = message;
    els.toast.className = `toast toast-${tone}`;
    state.toastTimer = setTimeout(() => {
      els.toast.classList.add("hidden");
    }, 2600);
  }

  function askConfirm({ title, copy, okLabel }) {
    okLabel = okLabel || tt("app.notes.delete", "Delete");
    return new Promise((resolve) => {
      els.confirmTitle.textContent = title;
      els.confirmCopy.textContent = copy;
      els.confirmOk.textContent = okLabel;
      const finish = (value) => {
        els.confirmForm.onsubmit = null;
        els.confirmCancel.onclick = null;
        els.confirmModal.onclose = null;
        els.confirmModal.close();
        resolve(value);
      };
      els.confirmForm.onsubmit = (e) => {
        e.preventDefault();
        finish(true);
      };
      els.confirmCancel.onclick = () => finish(false);
      els.confirmModal.onclose = () => finish(false);
      els.confirmModal.showModal();
      els.confirmOk.focus();
    });
  }

  function cancelPendingSave() {
    clearTimeout(state.saveTimer);
    state.saveTimer = null;
    state.saveToken += 1;
    state.dirty = false;
  }

  function updateCounts() {
    const active = state.notes.filter((n) => !n.archived);
    els.countAll.textContent = String(active.length);
    els.countPinned.textContent = String(active.filter((n) => n.pinned).length);
    els.countArchive.textContent = String(state.notes.filter((n) => n.archived).length);
  }

  function updateListMeta() {
    if (state.view === "pinned") {
      els.listTitle.textContent = tt("app.notes.list.pinned", "Pinned");
      els.listSub.textContent = tt("app.notes.list.pinnedSub", "Notes you keep on top");
    } else if (state.view === "archive") {
      els.listTitle.textContent = tt("app.notes.list.archive", "Archive");
      els.listSub.textContent = tt("app.notes.list.archiveSub", "Out of the way, still searchable");
    } else if (state.view === "notebook") {
      els.listTitle.textContent = notebookName(state.notebookId);
      els.listSub.textContent = tt("app.notes.list.notebookSub", "Notebook filter");
    } else if (state.view === "tag") {
      els.listTitle.textContent = `#${state.tag}`;
      els.listSub.textContent = tt("app.notes.list.tagSub", "Tagged notes");
    } else {
      els.listTitle.textContent = tt("app.notes.list.all", "All notes");
      els.listSub.textContent = tt("app.notes.list.allSub", "Capture anything, pin what matters");
    }
  }

  function renderRail() {
    els.railNav.querySelectorAll(".nav-item").forEach((btn) => {
      const v = btn.dataset.view;
      const on =
        (v === "all" && state.view === "all") ||
        (v === "pinned" && state.view === "pinned") ||
        (v === "archive" && state.view === "archive");
      btn.classList.toggle("active", on);
    });

    els.notebookList.innerHTML = state.notebooks
      .map((nb) => {
        const count = state.notes.filter((n) => !n.archived && n.notebookId === nb.id).length;
        const active = state.view === "notebook" && state.notebookId === nb.id;
        return `<button type="button" class="nav-item${active ? " active" : ""}" data-nb="${escapeHtml(nb.id)}">
          <span class="nav-icon">${escapeHtml(nb.icon || "📓")}</span>
          <span class="nb-name">${escapeHtml(nb.name)}</span>
          <em>${count}</em>
        </button>`;
      })
      .join("");

    const tagMap = new Map();
    state.notes
      .filter((n) => !n.archived)
      .forEach((n) => (n.tags || []).forEach((t) => tagMap.set(t, (tagMap.get(t) || 0) + 1)));
    const tags = [...tagMap.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 24);
    if (!tags.length) {
      els.tagCloud.innerHTML = `<span class="tag-chip is-muted">${escapeHtml(tt("app.notes.noTagsYet", "No tags yet"))}</span>`;
    } else {
      els.tagCloud.innerHTML = tags
        .map(
          ([t, c]) =>
            `<button type="button" class="tag-chip${
              state.view === "tag" && state.tag === t ? " is-active" : ""
            }" data-tag="${escapeHtml(t)}">#${escapeHtml(t)} ${c}</button>`
        )
        .join("");
    }
  }

  function renderList() {
    const notes = filteredNotes();
    updateListMeta();
    els.emptyList.classList.toggle("hidden", notes.length > 0);
    els.noteList.innerHTML = notes
      .map((n) => {
        const preview = String(n.body || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 120);
        const tags = (n.tags || [])
          .slice(0, 3)
          .map((t) => `<span class="tag">#${escapeHtml(t)}</span>`)
          .join("");
        return `<div class="note-card${n.id === state.selectedId ? " is-active" : ""}" data-id="${escapeHtml(
          n.id
        )}" role="listitem" tabindex="0">
          <button type="button" class="note-card-main" data-select="${escapeHtml(n.id)}">
            <div class="note-card-top">
              <span class="note-card-title">${escapeHtml(n.title || tt("app.notes.untitled", "Untitled"))}</span>
              ${n.pinned ? `<span class="pin-dot" title="${escapeHtml(tt("app.notes.pinned", "Pinned"))}">●</span>` : ""}
            </div>
            ${preview ? `<p class="note-card-preview">${escapeHtml(preview)}</p>` : ""}
            <div class="note-card-meta">
              <span>${escapeHtml(formatWhen(n.updatedAt))}</span>
              <span>${escapeHtml(notebookName(n.notebookId))}</span>
              ${tags}
            </div>
          </button>
          <div class="note-card-actions">
            <button type="button" class="card-action" data-pin="${escapeHtml(n.id)}" title="${escapeHtml(
          n.pinned ? tt("app.notes.unpin", "Unpin") : tt("app.notes.pin", "Pin")
        )}">${escapeHtml(n.pinned ? tt("app.notes.unpin", "Unpin") : tt("app.notes.pin", "Pin"))}</button>
            <button type="button" class="card-action card-action-danger" data-delete="${escapeHtml(
              n.id
            )}" title="${escapeHtml(tt("app.notes.delete", "Delete"))}">${escapeHtml(tt("app.notes.delete", "Delete"))}</button>
          </div>
        </div>`;
      })
      .join("");
  }

  function fillNotebookSelect(note) {
    els.noteNotebook.innerHTML = state.notebooks
      .map(
        (nb) =>
          `<option value="${escapeHtml(nb.id)}"${
            note && note.notebookId === nb.id ? " selected" : ""
          }>${escapeHtml(nb.name)}</option>`
      )
      .join("");
  }

  function showEditor(note) {
    if (!note) {
      els.editor.classList.add("hidden");
      els.editorEmpty.classList.remove("hidden");
      return;
    }
    els.editorEmpty.classList.add("hidden");
    els.editor.classList.remove("hidden");
    fillNotebookSelect(note);
    els.noteTitle.value = note.title || "";
    els.noteBody.value = note.body || "";
    els.noteTags.value = (note.tags || []).map((t) => `#${t}`).join(" ");
    els.btnPin.classList.toggle("is-on", Boolean(note.pinned));
    els.btnPin.textContent = note.pinned ? tt("app.notes.pinned", "Pinned") : tt("app.notes.pin", "Pin");
    els.btnArchive.classList.toggle("is-on", Boolean(note.archived));
    els.btnArchive.textContent = note.archived
      ? tt("app.notes.unarchive", "Unarchive")
      : tt("app.notes.archive", "Archive");
    const words = wordCount(note.body);
    const updated = formatWhen(note.updatedAt);
    const created = formatWhen(note.createdAt);
    els.editorMeta.textContent =
      words === 1
        ? tt("app.notes.wordsMeta", `1 word, Updated ${updated}, Created ${created}`, {
            n: words,
            updated,
            created,
          })
        : tt("app.notes.wordsMetaPlural", `${words} words, Updated ${updated}, Created ${created}`, {
            n: words,
            updated,
            created,
          });
    els.saveStatus.textContent = "";
    els.saveStatus.classList.remove("is-saved");
    state.dirty = false;
  }

  function render() {
    updateCounts();
    renderRail();
    renderList();
    showEditor(selectedNote());
  }

  async function load() {
    const res = await api.invoke("storage.load", {});
    if (!res?.ok) {
      showToast(res?.error || tt("app.notes.loadFailed", "Could not load notes"), "err");
      return;
    }
    state.notebooks = res.data?.notebooks || [];
    state.notes = res.data?.notes || [];
    state.settings = res.data?.settings || state.settings;
    if (state.selectedId && !state.notes.some((n) => n.id === state.selectedId)) {
      state.selectedId = null;
    }
    render();
  }

  function scheduleSave() {
    if (state.busy) return;
    state.dirty = true;
    els.saveStatus.textContent = tt("app.notes.saving", "Saving…");
    els.saveStatus.classList.remove("is-saved");
    clearTimeout(state.saveTimer);
    const token = state.saveToken;
    state.saveTimer = setTimeout(() => flushSave(token), 450);
  }

  async function flushSave(token = state.saveToken) {
    const note = selectedNote();
    if (!note || state.saving || state.busy) return false;
    if (token !== state.saveToken) return false;
    state.saving = true;
    const payload = {
      id: note.id,
      title: els.noteTitle.value,
      body: els.noteBody.value,
      tags: parseTagsInput(els.noteTags.value),
      notebookId: els.noteNotebook.value,
      pinned: note.pinned,
      archived: note.archived,
    };
    const res = await api.invoke("note.update", payload);
    state.saving = false;
    if (token !== state.saveToken) return false;
    if (!res?.ok) {
      els.saveStatus.textContent = res?.error || tt("app.notes.saveFailed", "Save failed");
      return false;
    }
    const idx = state.notes.findIndex((n) => n.id === note.id);
    if (idx >= 0) state.notes[idx] = res.note;
    state.dirty = false;
    els.saveStatus.textContent = tt("app.notes.saved", "Saved");
    els.saveStatus.classList.add("is-saved");
    const words = wordCount(res.note.body);
    const updated = formatWhen(res.note.updatedAt);
    const created = formatWhen(res.note.createdAt);
    els.editorMeta.textContent =
      words === 1
        ? tt("app.notes.wordsMeta", `1 word, Updated ${updated}, Created ${created}`, {
            n: words,
            updated,
            created,
          })
        : tt("app.notes.wordsMetaPlural", `${words} words, Updated ${updated}, Created ${created}`, {
            n: words,
            updated,
            created,
          });
    renderRail();
    renderList();
    return true;
  }

  async function createNote(seed = {}) {
    if (state.dirty) await flushSave();
    const res = await api.invoke("note.add", {
      title: seed.title || tt("app.notes.untitled", "Untitled"),
      body: seed.body || "",
      text: seed.text,
      tags: seed.tags,
      notebookId:
        seed.notebookId ||
        (state.view === "notebook" ? state.notebookId : null) ||
        state.settings.defaultNotebookId,
      pinned: seed.pinned,
    });
    if (!res?.ok) {
      showToast(res?.error || tt("app.notes.createFailed", "Could not create note"), "err");
      return null;
    }
    state.notes.unshift(res.note);
    state.selectedId = res.note.id;
    if (state.view === "archive") {
      state.view = "all";
      state.notebookId = null;
      state.tag = null;
    }
    render();
    els.noteTitle.focus();
    els.noteTitle.select();
    return res.note;
  }

  async function captureSubmit(e) {
    e.preventDefault();
    const text = els.captureInput.value.trim();
    if (!text) {
      await createNote({ title: tt("app.notes.untitled", "Untitled") });
      return;
    }
    const note = await createNote({ text });
    if (note) {
      els.captureInput.value = "";
      showToast(tt("app.notes.noteAdded", "Note added"));
    }
  }

  function setView(view, extra = {}) {
    state.view = view;
    state.notebookId = extra.notebookId || null;
    state.tag = extra.tag || null;
    render();
  }

  function selectNote(id) {
    if (state.selectedId === id) return;
    const go = async () => {
      if (state.dirty) await flushSave();
      state.selectedId = id;
      render();
    };
    go();
  }

  async function deleteNoteById(id, { skipConfirm = false } = {}) {
    const note = state.notes.find((n) => n.id === id);
    if (!note || state.busy) return false;
    if (!skipConfirm) {
      const ok = await askConfirm({
        title: tt("app.notes.deleteConfirm", "Delete note?"),
        copy: tt(
          "app.notes.deleteCopy",
          `“${note.title || tt("app.notes.untitled", "Untitled")}” will be permanently removed.`,
          { title: note.title || tt("app.notes.untitled", "Untitled") }
        ),
        okLabel: tt("app.notes.delete", "Delete"),
      });
      if (!ok) return false;
    }

    state.busy = true;
    cancelPendingSave();
    let spins = 0;
    while (state.saving && spins < 40) {
      await new Promise((r) => setTimeout(r, 50));
      spins += 1;
    }

    const list = filteredNotes();
    const idx = list.findIndex((n) => n.id === id);
    const nextId = list[idx + 1]?.id || list[idx - 1]?.id || null;

    const res = await api.invoke("note.delete", { id });
    state.busy = false;
    if (!res?.ok) {
      showToast(res?.error || tt("app.notes.deleteFailed", "Delete failed"), "err");
      return false;
    }

    state.notes = state.notes.filter((n) => n.id !== id);
    state.selectedId = state.selectedId === id ? nextId : state.selectedId;
    if (state.selectedId && !state.notes.some((n) => n.id === state.selectedId)) {
      state.selectedId = null;
    }
    render();
    showToast(tt("app.notes.noteDeleted", "Note deleted"));
    return true;
  }

  async function togglePin(id) {
    const note = state.notes.find((n) => n.id === id);
    if (!note) return;
    if (state.selectedId === id && state.dirty) await flushSave();
    const res = await api.invoke("note.pin", { id, pinned: !note.pinned });
    if (!res?.ok) {
      showToast(res?.error || tt("app.notes.pinFailed", "Pin failed"), "err");
      return;
    }
    const i = state.notes.findIndex((n) => n.id === id);
    if (i >= 0) state.notes[i] = res.note;
    render();
    showToast(res.note.pinned ? tt("app.notes.toastPinned", "Pinned") : tt("app.notes.toastUnpinned", "Unpinned"));
  }

  // Events
  els.railNav.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-item[data-view]");
    if (!btn) return;
    setView(btn.dataset.view);
  });

  els.notebookList.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-item[data-nb]");
    if (!btn) return;
    setView("notebook", { notebookId: btn.dataset.nb });
  });

  els.tagCloud.addEventListener("click", (e) => {
    const btn = e.target.closest(".tag-chip[data-tag]");
    if (!btn) return;
    setView("tag", { tag: btn.dataset.tag });
  });

  els.noteList.addEventListener("click", (e) => {
    const del = e.target.closest("[data-delete]");
    if (del) {
      e.preventDefault();
      deleteNoteById(del.dataset.delete);
      return;
    }
    const pin = e.target.closest("[data-pin]");
    if (pin) {
      e.preventDefault();
      togglePin(pin.dataset.pin);
      return;
    }
    const select = e.target.closest("[data-select]");
    if (select) {
      selectNote(select.dataset.select);
    }
  });

  els.noteList.addEventListener("keydown", (e) => {
    const card = e.target.closest(".note-card[data-id]");
    if (!card) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectNote(card.dataset.id);
    }
  });

  els.captureForm.addEventListener("submit", captureSubmit);
  els.btnNew.addEventListener("click", () => createNote({ title: tt("app.notes.untitled", "Untitled") }));

  els.searchInput.addEventListener("input", () => {
    state.search = els.searchInput.value;
    renderList();
  });

  ["input", "change"].forEach((ev) => {
    els.noteTitle.addEventListener(ev, scheduleSave);
    els.noteBody.addEventListener(ev, scheduleSave);
    els.noteTags.addEventListener(ev, scheduleSave);
    els.noteNotebook.addEventListener(ev, scheduleSave);
  });

  els.btnPin.addEventListener("click", () => {
    const note = selectedNote();
    if (note) togglePin(note.id);
  });

  els.btnDuplicate.addEventListener("click", async () => {
    const note = selectedNote();
    if (!note) return;
    if (state.dirty) await flushSave();
    const copy = await createNote({
      title: `${note.title || tt("app.notes.untitled", "Untitled")} ${tt("app.notes.copySuffix", "(copy)")}`,
      body: note.body || "",
      tags: note.tags || [],
      notebookId: note.notebookId,
    });
    if (copy) showToast(tt("app.notes.duplicated", "Duplicated"));
  });

  els.btnArchive.addEventListener("click", async () => {
    const note = selectedNote();
    if (!note) return;
    if (state.dirty) await flushSave();
    const res = await api.invoke("note.archive", { id: note.id, archived: !note.archived });
    if (!res?.ok) {
      showToast(res?.error || tt("app.notes.archiveFailed", "Archive failed"), "err");
      return;
    }
    const idx = state.notes.findIndex((n) => n.id === note.id);
    if (idx >= 0) state.notes[idx] = res.note;
    if (res.note.archived && state.view !== "archive") {
      const list = filteredNotes().filter((n) => n.id !== note.id);
      state.selectedId = list[0]?.id || null;
    }
    render();
    showToast(res.note.archived ? tt("app.notes.toastArchived", "Archived") : tt("app.notes.toastRestored", "Restored"));
  });

  els.btnDelete.addEventListener("click", () => {
    const note = selectedNote();
    if (note) deleteNoteById(note.id);
  });

  els.btnAddNotebook.addEventListener("click", () => {
    els.notebookName.value = "";
    els.notebookModal.showModal();
    els.notebookName.focus();
  });

  els.notebookCancel.addEventListener("click", () => els.notebookModal.close());

  els.notebookForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = els.notebookName.value.trim();
    if (!name) return;
    const res = await api.invoke("notebook.add", { name });
    if (!res?.ok) {
      showToast(res?.error || tt("app.notes.notebookFailed", "Could not create notebook"), "err");
      return;
    }
    state.notebooks.push(res.notebook);
    els.notebookModal.close();
    setView("notebook", { notebookId: res.notebook.id });
    showToast(tt("app.notes.notebookCreated", `Notebook “${res.notebook.name}”`, { name: res.notebook.name }));
  });

  function typingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
  }

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
      e.preventDefault();
      createNote({ title: tt("app.notes.untitled", "Untitled") });
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      flushSave();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p" && selectedNote()) {
      e.preventDefault();
      togglePin(selectedNote().id);
      return;
    }
    if (e.key === "Escape") {
      if (document.activeElement && typingTarget(document.activeElement)) {
        document.activeElement.blur();
        return;
      }
      state.selectedId = null;
      render();
      return;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && selectedNote() && !typingTarget(document.activeElement)) {
      e.preventDefault();
      deleteNoteById(selectedNote().id);
      return;
    }
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !typingTarget(document.activeElement)) {
      const list = filteredNotes();
      if (!list.length) return;
      e.preventDefault();
      const i = list.findIndex((n) => n.id === state.selectedId);
      const next =
        e.key === "ArrowDown"
          ? list[Math.min(list.length - 1, Math.max(0, i) + 1)]
          : list[Math.max(0, (i < 0 ? list.length : i) - 1)];
      if (next) selectNote(next.id);
    }
  });

  function setPage(page, opts = {}) {
    const p = String(page || "all").toLowerCase();
    if (p === "archive" || p === "archived") setView("archive");
    else if (p === "pinned") setView("pinned");
    else if (p === "notebook" && opts.notebookId) setView("notebook", { notebookId: opts.notebookId });
    else setView("all");
    if (opts.noteId || opts.id) openNote(opts.noteId || opts.id);
    if (opts.q || opts.search) {
      els.searchInput.value = opts.q || opts.search;
      state.search = els.searchInput.value;
      renderList();
    }
  }

  async function openNote(ref) {
    await load();
    if (!ref) return;
    const q = String(ref).trim().toLowerCase();
    const hit =
      state.notes.find((n) => n.id === ref || n.id.toLowerCase() === q) ||
      state.notes.find((n) => String(n.title || "").toLowerCase() === q) ||
      state.notes.find((n) => String(n.title || "").toLowerCase().includes(q));
    if (!hit) return;
    if (hit.archived) setView("archive");
    else if (state.view === "archive") setView("all");
    state.selectedId = hit.id;
    render();
  }

  async function refresh(route) {
    await load();
    if (route?.page) setPage(route.page, route);
    else if (route?.noteId || route?.id || route?.param) {
      await openNote(route.noteId || route.id || route.param);
    }
  }

  window.NotesApp = {
    setPage,
    openNote,
    refresh,
    reload: load,
  };

  if (window.Link) {
    window.Link.onCommand("open", async (args) => {
      await openNote(args?.id || args?.ref || args?.title);
      return { ok: true };
    });
  }

  if (els.btnSignOut && window.appAuth?.logout) {
    els.btnSignOut.classList.remove("hidden");
    els.btnSignOut.addEventListener("click", async () => {
      els.btnSignOut.disabled = true;
      try {
        await window.appAuth.logout();
      } catch (err) {
        showToast(err?.message || tt("app.notes.signOutFailed", "Could not sign out"));
        els.btnSignOut.disabled = false;
      }
    });
  }

  document.addEventListener("myspace-app-i18n-applied", () => {
    document.title = tt("app.notes.name", "Notes");
    render();
  });
  
  load().then(() => {
    els.captureInput.focus();
  });
})();