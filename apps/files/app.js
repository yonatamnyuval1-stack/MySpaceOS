(function () {
  const api = () => window.myApp;

  const state = {
    cwd: "",
    parent: "",
    entries: [],
    filter: "",
    sort: "name",
    selected: null,
    history: [],
    histIdx: -1,
    places: [],
    favorites: [],
    drives: [],
    recent: [],
    busy: false,
  };

  const ui = {
    placesNav: document.getElementById("places-nav"),
    drivesNav: document.getElementById("drives-nav"),
    favNav: document.getElementById("fav-nav"),
    recentNav: document.getElementById("recent-nav"),
    crumbs: document.getElementById("crumbs"),
    fileList: document.getElementById("file-list"),
    empty: document.getElementById("empty-list"),
    status: document.getElementById("status-line"),
    brandSub: document.getElementById("brand-sub"),
    gotoInput: document.getElementById("goto-input"),
    filterInput: document.getElementById("filter-input"),
    sortSelect: document.getElementById("sort-select"),
    btnBack: document.getElementById("btn-back"),
    btnUp: document.getElementById("btn-up"),
    previewEmpty: document.getElementById("preview-empty"),
    previewBody: document.getElementById("preview-body"),
    previewName: document.getElementById("preview-name"),
    previewMeta: document.getElementById("preview-meta"),
    previewBadge: document.getElementById("preview-badge"),
    previewViewport: document.getElementById("preview-viewport"),
    toast: document.getElementById("toast"),
  };

  let toastTimer = null;

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toast(msg) {
    if (!ui.toast) return;
    ui.toast.textContent = String(msg || "");
    ui.toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.add("hidden"), 2400);
  }

  function kindIcon(kind, isDir) {
    if (isDir || kind === "folder") return "📁";
    if (kind === "image") return "🖼";
    if (kind === "code") return "</>";
    if (kind === "audio") return "♫";
    if (kind === "video") return "▶";
    if (kind === "pdf") return "📑";
    if (kind === "archive") return "📦";
    return "📄";
  }

  function formatDate(ms) {
    if (!ms) return "—";
    try {
      return new Date(ms).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  }

  async function invoke(channel, args) {
    return api()?.invoke?.(channel, args || {});
  }

  function pushHistory(dir) {
    if (!dir) return;
    if (state.histIdx >= 0 && state.history[state.histIdx] === dir) return;
    state.history = state.history.slice(0, state.histIdx + 1);
    state.history.push(dir);
    if (state.history.length > 80) state.history.shift();
    state.histIdx = state.history.length - 1;
  }

  function filteredEntries() {
    const q = state.filter.trim().toLowerCase();
    if (!q) return state.entries;
    return state.entries.filter((e) => e.name.toLowerCase().includes(q));
  }

  function paintSidebarActive() {
    const cwd = state.cwd;
    document.querySelectorAll(".nav-item[data-path]").forEach((btn) => {
      const p = btn.dataset.path || "";
      btn.classList.toggle("active", Boolean(p) && p === cwd);
    });
  }

  function paintSidebar() {
    const renderNav = (el, items, emptyLabel) => {
      if (!el) return;
      if (!items.length) {
        el.innerHTML = `<p class="nav-empty" style="margin:0.25rem 0.55rem;color:var(--muted);font-size:0.75rem">${escapeHtml(emptyLabel)}</p>`;
        return;
      }
      el.innerHTML = items
        .map(
          (p) =>
            `<button type="button" class="nav-item" data-path="${escapeHtml(p.path)}" data-id="${escapeHtml(p.id || "")}">
              <span class="ico">${escapeHtml(p.icon || "★")}</span>
              <span class="lbl">${escapeHtml(p.label || p.name || p.path)}</span>
            </button>`
        )
        .join("");
      el.querySelectorAll(".nav-item").forEach((btn) => {
        btn.addEventListener("click", () => void navigate(btn.dataset.path));
      });
    };

    renderNav(ui.placesNav, state.places, "No places");
    renderNav(ui.drivesNav, state.drives, "No drives");
    renderNav(
      ui.favNav,
      state.favorites.map((f) => ({ ...f, icon: f.icon || "★" })),
      "No favorites yet"
    );

    if (ui.recentNav) {
      if (!state.recent.length) {
        ui.recentNav.innerHTML =
          `<p class="nav-empty" style="margin:0.25rem 0.55rem;color:var(--muted);font-size:0.75rem">Nothing recent</p>`;
      } else {
        ui.recentNav.innerHTML = state.recent
          .slice(0, 10)
          .map(
            (r) =>
              `<button type="button" class="nav-item" data-path="${escapeHtml(r.path)}" data-isdir="${r.isDirectory ? "1" : "0"}">
                <span class="ico">${r.isDirectory ? "📁" : "📄"}</span>
                <span class="lbl">${escapeHtml(r.name || r.path)}</span>
              </button>`
          )
          .join("");
        ui.recentNav.querySelectorAll(".nav-item").forEach((btn) => {
          btn.addEventListener("click", async () => {
            if (btn.dataset.isdir === "1") void navigate(btn.dataset.path);
            else {
              const parent = btn.dataset.path.replace(/[/\\][^/\\]+$/, "") || btn.dataset.path;
              await navigate(parent);
              selectByPath(btn.dataset.path);
            }
          });
        });
      }
    }
    paintSidebarActive();
  }

  function paintCrumbs(crumbs) {
    if (!ui.crumbs) return;
    const list = Array.isArray(crumbs) ? crumbs : [];
    ui.crumbs.innerHTML = list
      .map((c, i) => {
        const last = i === list.length - 1;
        if (!c.path) {
          return `<span class="crumb-sep">/</span><span class="crumb is-current">${escapeHtml(c.name)}</span>`;
        }
        return `${i ? `<span class="crumb-sep">/</span>` : ""}<button type="button" class="crumb ${last ? "is-current" : ""}" data-path="${escapeHtml(c.path)}" ${last ? "disabled" : ""}>${escapeHtml(c.name)}</button>`;
      })
      .join("");
    ui.crumbs.querySelectorAll(".crumb[data-path]:not([disabled])").forEach((btn) => {
      btn.addEventListener("click", () => void navigate(btn.dataset.path));
    });
  }

  function paintList() {
    const rows = filteredEntries();
    if (ui.empty) ui.empty.classList.toggle("hidden", rows.length > 0);
    if (!ui.fileList) return;
    ui.fileList.innerHTML = rows
      .map((e) => {
        const sel = state.selected?.path === e.path ? "selected" : "";
        return `<button type="button" class="file-row ${sel}" role="listitem" data-path="${escapeHtml(e.path)}" data-dir="${e.isDirectory ? "1" : "0"}">
          <span class="name-cell">
            <span class="ico">${kindIcon(e.kind, e.isDirectory)}</span>
            <span class="name">${escapeHtml(e.name)}</span>
          </span>
          <span class="col-size">${escapeHtml(e.isDirectory ? "—" : e.sizeLabel || "")}</span>
          <span class="col-date">${escapeHtml(formatDate(e.mtime))}</span>
        </button>`;
      })
      .join("");

    ui.fileList.querySelectorAll(".file-row").forEach((row) => {
      row.addEventListener("click", () => {
        const entry = state.entries.find((e) => e.path === row.dataset.path);
        if (entry) void selectEntry(entry);
      });
      row.addEventListener("dblclick", () => {
        if (row.dataset.dir === "1") void navigate(row.dataset.path);
        else void openPath(row.dataset.path);
      });
    });

    if (ui.status) {
      const folders = rows.filter((e) => e.isDirectory).length;
      const files = rows.length - folders;
      ui.status.textContent = `${folders} folder(s) · ${files} file(s)`;
    }
    if (ui.btnBack) ui.btnBack.disabled = state.histIdx <= 0;
    if (ui.btnUp) ui.btnUp.disabled = !state.parent;
    paintSidebarActive();
  }

  function clearPreview() {
    state.selected = null;
    ui.previewEmpty?.classList.remove("hidden");
    ui.previewBody?.classList.add("hidden");
    paintList();
  }

  async function selectEntry(entry) {
    state.selected = entry;
    paintList();
    ui.previewEmpty?.classList.add("hidden");
    ui.previewBody?.classList.remove("hidden");
    if (ui.previewName) ui.previewName.textContent = entry.name;
    if (ui.previewMeta) {
      ui.previewMeta.textContent = entry.isDirectory
        ? `Folder · ${formatDate(entry.mtime)}`
        : `${entry.sizeLabel || ""} · ${formatDate(entry.mtime)}`;
    }
    if (ui.previewBadge) {
      ui.previewBadge.textContent = entry.isDirectory
        ? "FOLDER"
        : String(entry.kind || "file").toUpperCase();
    }
    if (!ui.previewViewport) return;

    if (entry.isDirectory) {
      ui.previewViewport.innerHTML = `<p class="preview-note">Double-click to open this folder.</p>`;
      return;
    }

    ui.previewViewport.innerHTML = `<p class="preview-note">Loading preview…</p>`;
    const res = await invoke("file.preview", { path: entry.path });
    if (state.selected?.path !== entry.path) return;
    if (!res?.ok) {
      ui.previewViewport.innerHTML = `<p class="preview-note">${escapeHtml(res?.error || "Preview failed")}</p>`;
      return;
    }
    if (res.image && res.dataUrl) {
      ui.previewViewport.innerHTML = `<img src="${res.dataUrl}" alt="" />`;
      return;
    }
    if (res.binary || res.content == null) {
      ui.previewViewport.innerHTML = `<p class="preview-note">Binary file — open with the system default app.</p>`;
      return;
    }
    const trunc = res.truncated
      ? `<div class="preview-trunc">Preview truncated · ${escapeHtml(res.sizeLabel || "")}</div>`
      : "";
    ui.previewViewport.innerHTML = `${trunc}<pre>${escapeHtml(res.content)}</pre>`;
  }

  function selectByPath(p) {
    const entry = state.entries.find((e) => e.path === p);
    if (entry) void selectEntry(entry);
  }

  async function navigate(dir, opts = {}) {
    const target = String(dir || "").trim();
    if (!target || state.busy) return;
    state.busy = true;
    if (ui.status) ui.status.textContent = "Loading…";
    const res = await invoke("dir.list", {
      path: target,
      sort: state.sort,
      showHidden: false,
    });
    state.busy = false;
    if (!res?.ok) {
      toast(res?.error || "Could not open folder");
      if (ui.status) ui.status.textContent = "—";
      return;
    }
    state.cwd = res.path;
    state.parent = res.parent || "";
    state.entries = res.entries || [];
    state.selected = null;
    if (!opts.skipHistory) pushHistory(res.path);
    if (ui.gotoInput) ui.gotoInput.value = res.path;
    if (ui.brandSub) ui.brandSub.textContent = res.path;
    paintCrumbs(res.crumbs);
    clearPreview();
    paintList();
  }

  async function goBack() {
    if (state.histIdx <= 0) return;
    state.histIdx -= 1;
    await navigate(state.history[state.histIdx], { skipHistory: true });
  }

  async function goUp() {
    if (!state.parent) return;
    await navigate(state.parent);
  }

  async function openPath(p) {
    const res = await invoke("file.open", { path: p });
    if (res?.ok === false) toast(res.error || "Could not open");
    else {
      toast("Opened");
      await refreshSidebar();
    }
  }

  async function refreshSidebar() {
    const home = await invoke("home");
    if (home?.ok) {
      state.places = home.places || [];
      state.favorites = home.favorites || [];
      state.drives = home.drives || [];
      state.recent = (home.recent || []).map((r) => ({
        ...r,
        isDirectory: r.kind === "folder",
      }));
    }
    const recent = await invoke("recent.list");
    if (recent?.ok) state.recent = recent.recent || [];
    paintSidebar();
  }

  function promptName(title, label, initial) {
    return new Promise((resolve) => {
      const modal = document.getElementById("prompt-modal");
      const form = document.getElementById("prompt-form");
      const input = document.getElementById("prompt-input");
      const cancel = document.getElementById("prompt-cancel");
      document.getElementById("prompt-title").textContent = title;
      document.getElementById("prompt-label").textContent = label;
      input.value = initial || "";
      const cleanup = () => {
        form.onsubmit = null;
        cancel.onclick = null;
      };
      form.onsubmit = (e) => {
        e.preventDefault();
        const v = input.value.trim();
        cleanup();
        modal.close();
        resolve(v || null);
      };
      cancel.onclick = () => {
        cleanup();
        modal.close();
        resolve(null);
      };
      modal.showModal();
      input.focus();
      input.select();
    });
  }

  function confirmAction(title, copy) {
    return new Promise((resolve) => {
      const modal = document.getElementById("confirm-modal");
      const form = document.getElementById("confirm-form");
      const cancel = document.getElementById("confirm-cancel");
      document.getElementById("confirm-title").textContent = title;
      document.getElementById("confirm-copy").textContent = copy;
      const cleanup = () => {
        form.onsubmit = null;
        cancel.onclick = null;
      };
      form.onsubmit = (e) => {
        e.preventDefault();
        cleanup();
        modal.close();
        resolve(true);
      };
      cancel.onclick = () => {
        cleanup();
        modal.close();
        resolve(false);
      };
      modal.showModal();
    });
  }

  async function newFolder() {
    if (!state.cwd) return;
    const name = await promptName("New folder", "Folder name", "New folder");
    if (!name) return;
    const res = await invoke("dir.create", { path: state.cwd, name });
    if (!res?.ok) toast(res?.error || "Could not create");
    else {
      toast("Folder created");
      await navigate(state.cwd, { skipHistory: true });
    }
  }

  async function renameSelected() {
    const entry = state.selected;
    if (!entry) return;
    const name = await promptName("Rename", "New name", entry.name);
    if (!name || name === entry.name) return;
    const res = await invoke("file.rename", { path: entry.path, name });
    if (!res?.ok) toast(res?.error || "Rename failed");
    else {
      toast("Renamed");
      await navigate(state.cwd, { skipHistory: true });
      selectByPath(res.path);
    }
  }

  async function deleteSelected() {
    const entry = state.selected;
    if (!entry) return;
    const ok = await confirmAction(
      "Move to Recycle Bin?",
      `"${entry.name}" will be moved to the Recycle Bin.`
    );
    if (!ok) return;
    const res = await invoke("file.delete", { path: entry.path });
    if (!res?.ok) toast(res?.error || "Delete failed");
    else {
      toast("Moved to Recycle Bin");
      await navigate(state.cwd, { skipHistory: true });
    }
  }

  async function copyPath() {
    const p = state.selected?.path || state.cwd;
    if (!p) return;
    try {
      await navigator.clipboard.writeText(p);
      toast("Path copied");
    } catch {
      toast("Could not copy");
    }
  }

  function bind() {
    document.getElementById("btn-back")?.addEventListener("click", () => void goBack());
    document.getElementById("btn-up")?.addEventListener("click", () => void goUp());
    document.getElementById("btn-refresh")?.addEventListener("click", () => {
      if (state.cwd) void navigate(state.cwd, { skipHistory: true });
    });
    document.getElementById("btn-new-folder")?.addEventListener("click", () => void newFolder());
    document.getElementById("btn-open-ext")?.addEventListener("click", async () => {
      if (!state.cwd) return;
      const res = await invoke("file.open", { path: state.cwd });
      if (res?.ok === false) toast(res.error || "Could not open");
    });
    document.getElementById("btn-add-fav")?.addEventListener("click", async () => {
      const res = await invoke("favorites.add", state.cwd ? { path: state.cwd } : {});
      if (res?.ok === false) toast(res.error || "Could not add");
      else {
        toast("Favorite added");
        await refreshSidebar();
      }
    });
    document.getElementById("btn-clear-recent")?.addEventListener("click", async () => {
      await invoke("recent.clear");
      await refreshSidebar();
      toast("Recent cleared");
    });

    document.getElementById("goto-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const p = ui.gotoInput?.value?.trim();
      if (p) void navigate(p);
    });

    ui.filterInput?.addEventListener("input", () => {
      state.filter = ui.filterInput.value || "";
      paintList();
    });
    ui.sortSelect?.addEventListener("change", () => {
      state.sort = ui.sortSelect.value || "name";
      if (state.cwd) void navigate(state.cwd, { skipHistory: true });
    });

    document.getElementById("btn-open")?.addEventListener("click", () => {
      if (state.selected?.isDirectory) void navigate(state.selected.path);
      else if (state.selected) void openPath(state.selected.path);
    });
    document.getElementById("btn-reveal")?.addEventListener("click", async () => {
      const p = state.selected?.path;
      if (!p) return;
      const res = await invoke("file.reveal", { path: p });
      if (res?.ok === false) toast(res.error || "Could not reveal");
    });
    document.getElementById("btn-copy-path")?.addEventListener("click", () => void copyPath());
    document.getElementById("btn-rename")?.addEventListener("click", () => void renameSelected());
    document.getElementById("btn-delete")?.addEventListener("click", () => void deleteSelected());

    document.addEventListener("keydown", (e) => {
      if (e.target?.closest?.("input, textarea, select, dialog")) return;
      if (e.key === "Backspace" && !e.altKey) {
        e.preventDefault();
        void goUp();
      } else if (e.key === "Delete" && state.selected) {
        e.preventDefault();
        void deleteSelected();
      } else if (e.key === "F2" && state.selected) {
        e.preventDefault();
        void renameSelected();
      } else if (e.key === "F5") {
        e.preventDefault();
        if (state.cwd) void navigate(state.cwd, { skipHistory: true });
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        ui.gotoInput?.focus();
        ui.gotoInput?.select();
      }
    });
  }

  async function applyRoute(route) {
    const page = route?.page;
    const pathArg = route?.path || route?.folder || "";
    if (pathArg) {
      await navigate(pathArg);
      return;
    }
    if (page === "downloads") {
      const dl = state.places.find((p) => p.id === "downloads");
      if (dl) await navigate(dl.path);
      return;
    }
    if (page === "documents") {
      const doc = state.places.find((p) => p.id === "documents");
      if (doc) await navigate(doc.path);
      return;
    }
    if (page === "recent") {
      /* stay on current; sidebar shows recent */
      return;
    }
    if (page === "favorites") {
      if (state.favorites[0]) await navigate(state.favorites[0].path);
      return;
    }
  }

  async function init() {
    bind();
    await refreshSidebar();
    const start =
      state.places.find((p) => p.id === "desktop")?.path ||
      state.places.find((p) => p.id === "home")?.path ||
      state.drives[0]?.path ||
      "";
    if (start) await navigate(start);

    window.FilesApp = {
      setActivePage: async (page) => applyRoute({ page }),
      setPage: async (page) => applyRoute({ page }),
      openPath: async (p) => navigate(p),
      navigate: async (p) => navigate(p),
      refresh: async () => {
        await refreshSidebar();
        if (state.cwd) await navigate(state.cwd, { skipHistory: true });
      },
    };

    if (window.Link) {
      window.Link.onCommand("browse", async (args) => {
        const p = String(args?.path || "").trim();
        if (!p) return { ok: false, error: "Path required" };
        await navigate(p);
        return { ok: true, path: p };
      });
    }

    // Deep-link from shell / platform route
    try {
      const prefs = window.parent?.MySpaceAppPrefs || null;
      /* route delivered via workspace — listen for custom event if present */
    } catch {
      /* ignore */
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.addEventListener("myspace-i18n-applied", () => {
    try {
      window.MySpaceI18n?.applyDom?.(document);
      void refreshSidebar();
      if (state.cwd) void navigate(state.cwd, { skipHistory: true });
    } catch {
      /* ignore */
    }
  });
})();
