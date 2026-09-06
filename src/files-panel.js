(function () {
  let root = null;
  let open = false;
  let snap = null;
  let tab = "browse";

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toast(msg) {
    window.showMySpaceToast?.(String(msg || ""));
  }

  async function refresh() {
    const res = await window.mySpace?.files?.home?.();
    if (res?.ok !== false) snap = res;
    paint();
  }

  function openFull(route) {
    hide();
    void window.MySpaceFiles?.open?.({ ...(route || {}), full: true });
  }

  function paintBrowse() {
    const list = root?.querySelector("#files-panel-body");
    if (!list) return;
    const places = snap?.places || [];
    const drives = snap?.drives || [];

    list.innerHTML = `
      <div class="files-panel-section">
        <form class="files-panel-goto" id="files-panel-goto">
          <input type="text" id="files-panel-path" placeholder="Go to folder path…" spellcheck="false" />
          <button type="submit" class="files-btn files-btn-primary">Go</button>
        </form>
      </div>
      <div class="files-panel-section">
        <h3>Places</h3>
        <ul class="files-place-list">
          ${
            places.length
              ? places
                  .map(
                    (p) =>
                      `<li><button type="button" class="files-place" data-path="${escapeHtml(p.path)}"><span>${escapeHtml(p.icon || "📁")}</span><strong>${escapeHtml(p.label)}</strong></button></li>`
                  )
                  .join("")
              : `<li class="files-panel-empty">No places</li>`
          }
        </ul>
      </div>
      <div class="files-panel-section">
        <h3>Drives</h3>
        <div class="files-drive-row">
          ${
            drives.length
              ? drives
                  .map(
                    (d) =>
                      `<button type="button" class="files-drive" data-path="${escapeHtml(d.path)}">${escapeHtml(d.label)}</button>`
                  )
                  .join("")
              : `<span class="files-panel-empty">—</span>`
          }
        </div>
      </div>
      <div class="files-panel-section files-panel-quick">
        <div class="files-panel-actions">
          <button type="button" class="files-btn files-btn-primary" id="files-open-full">Open Files app</button>
          <button type="button" class="files-btn" id="files-pick-folder">Pick folder…</button>
        </div>
      </div>`;

    list.querySelector("#files-panel-goto")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const path = list.querySelector("#files-panel-path")?.value?.trim();
      if (!path) return;
      openFull({ path });
    });
    list.querySelectorAll(".files-place, .files-drive").forEach((btn) => {
      btn.addEventListener("click", () => openFull({ path: btn.dataset.path }));
    });
    list.querySelector("#files-open-full")?.addEventListener("click", () => openFull({ page: "browse" }));
    list.querySelector("#files-pick-folder")?.addEventListener("click", async () => {
      const res = await window.mySpace?.files?.pickFolder?.();
      if (res?.ok === false) {
        if (res.error !== "Cancelled") toast(res.error || "Cancelled");
        return;
      }
      if (res?.path) openFull({ path: res.path });
    });
  }

  function paintRecent() {
    const list = root?.querySelector("#files-panel-body");
    if (!list) return;
    void (async () => {
      const res = await window.mySpace?.files?.recent?.();
      const recent = res?.recent || [];
      list.innerHTML = `
        <div class="files-panel-section">
          <h3>Recent</h3>
          ${
            recent.length
              ? `<ul class="files-place-list">${recent
                  .slice(0, 14)
                  .map(
                    (r) =>
                      `<li><button type="button" class="files-place" data-path="${escapeHtml(r.path)}" data-dir="${r.isDirectory ? "1" : "0"}"><span>${r.isDirectory ? "📁" : "📄"}</span><strong>${escapeHtml(r.name || r.path)}</strong></button></li>`
                  )
                  .join("")}</ul>`
              : `<p class="files-panel-empty">Nothing recent yet: open files from the full app.</p>`
          }
          <div class="files-panel-actions" style="margin-top:0.75rem">
            <button type="button" class="files-btn files-btn-primary" data-open-full="recent">Open Files</button>
            <button type="button" class="files-btn" id="files-clear-recent" ${recent.length ? "" : "disabled"}>Clear</button>
          </div>
        </div>`;
      list.querySelectorAll(".files-place").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (btn.dataset.dir === "1") openFull({ path: btn.dataset.path });
          else openFull({ path: btn.dataset.path.replace(/[/\\][^/\\]+$/, "") || btn.dataset.path });
        });
      });
      list.querySelector("[data-open-full]")?.addEventListener("click", () => openFull({ page: "recent" }));
      list.querySelector("#files-clear-recent")?.addEventListener("click", async () => {
        await window.mySpace?.files?.clearRecent?.();
        toast("Recent cleared");
        await refresh();
        paintRecent();
      });
    })();
  }

  function paintFavorites() {
    const list = root?.querySelector("#files-panel-body");
    if (!list) return;
    const favs = snap?.favorites || [];
    list.innerHTML = `
      <div class="files-panel-section">
        <h3>Favorites</h3>
        ${
          favs.length
            ? `<ul class="files-place-list">${favs
                .map(
                  (f) =>
                    `<li><button type="button" class="files-place" data-path="${escapeHtml(f.path)}"><span>★</span><strong>${escapeHtml(f.label)}</strong></button></li>`
                )
                .join("")}</ul>`
            : `<p class="files-panel-empty">Pin folders from the Files app (+ in Favorites).</p>`
        }
        <div class="files-panel-actions" style="margin-top:0.75rem">
          <button type="button" class="files-btn files-btn-primary" id="files-add-fav">Add folder…</button>
          <button type="button" class="files-btn" data-open-full="favorites">Open Files</button>
        </div>
      </div>`;
    list.querySelectorAll(".files-place").forEach((btn) => {
      btn.addEventListener("click", () => openFull({ path: btn.dataset.path }));
    });
    list.querySelector("[data-open-full]")?.addEventListener("click", () => openFull({ page: "favorites" }));
    list.querySelector("#files-add-fav")?.addEventListener("click", async () => {
      const res = await window.mySpace?.files?.addFavorite?.({});
      if (res?.ok === false) {
        if (res.error !== "Cancelled") toast(res.error || "Could not add");
        return;
      }
      toast("Favorite added");
      await refresh();
      paintFavorites();
    });
  }

  function paint() {
    if (!root) return;
    root.querySelectorAll("[data-files-tab]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.filesTab === tab);
    });
    if (tab === "recent") paintRecent();
    else if (tab === "favorites") paintFavorites();
    else paintBrowse();
  }

  function ensure() {
    if (root) return root;
    root = document.createElement("div");
    root.className = "files-panel hidden";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Files");
    root.innerHTML = `
      <div class="files-panel-shell">
        <header class="files-panel-head">
          <div class="files-panel-brand">
            <img src="brand/atom-white.png" alt="" width="28" height="28" />
            <div>
              <h2>Files</h2>
              <p>Browse this PC: places, folders &amp; preview</p>
            </div>
          </div>
          <button type="button" class="files-panel-close" aria-label="Close">×</button>
        </header>
        <div class="files-panel-toolbar">
          <div class="files-panel-tabs">
            <button type="button" data-files-tab="browse" class="is-active">Browse</button>
            <button type="button" data-files-tab="recent">Recent</button>
            <button type="button" data-files-tab="favorites">Favorites</button>
          </div>
          <button type="button" class="files-btn" id="files-panel-full">Full app</button>
        </div>
        <div class="files-panel-body" id="files-panel-body"></div>
      </div>`;
    document.body.appendChild(root);

    root.addEventListener("click", (e) => {
      if (e.target === root) hide();
    });
    root.querySelector(".files-panel-close")?.addEventListener("click", hide);
    root.querySelector("#files-panel-full")?.addEventListener("click", () => openFull({ page: tab }));
    root.querySelectorAll("[data-files-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        tab = btn.dataset.filesTab || "browse";
        paint();
      });
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && open) hide();
    });
    return root;
  }

  function show(nextTab) {
    ensure();
    if (nextTab && ["browse", "recent", "favorites", "downloads", "documents"].includes(nextTab)) {
      if (nextTab === "downloads" || nextTab === "documents") {
        openFull({ page: nextTab });
        return;
      }
      tab = nextTab;
    }
    open = true;
    root.classList.remove("hidden");
    void refresh();
  }

  function hide() {
    if (!root) return;
    open = false;
    root.classList.add("hidden");
  }

  function toggle(nextTab) {
    if (open) hide();
    else show(nextTab);
  }

  window.MySpaceFilesPanel = {
    show,
    hide,
    toggle,
    isOpen: () => open,
    refresh,
  };
})();
