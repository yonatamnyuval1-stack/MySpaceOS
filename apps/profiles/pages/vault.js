window.ProfilesPages = window.ProfilesPages || {};
window.ProfilesPages.vault = (function () {
  const { escapeHtml, invoke, uid, formatTime } = window.Profiles;
  const page = document.getElementById("page-vault");
  let unlocked = false;
  let initialized = false;
  let entries = [];
  let editingId = null;
  let pendingOpenId = null;

  async function scan() {
    const status = await invoke("vault.status");
    initialized = Boolean(status.initialized);
    if (status.unlocked) {
      unlocked = true;
      try {
        await refreshEntries();
      } catch {
      }
      showVault();
      flushPendingOpen();
    } else {
      unlocked = false;
      showLock();
    }
  }

  function flushPendingOpen() {
    if (!pendingOpenId || !unlocked) return;
    const id = pendingOpenId;
    pendingOpenId = null;
    openEditor(id);
  }

  function showLock() {
    const isCreate = !initialized;
    page.innerHTML = `
      <div class="vault-lock card-panel">
        <span class="vault-lock-icon">🔐</span>
        <h2>Password Vault</h2>
        <p class="muted">${
          isCreate
            ? "Choose a master password to encrypt this vault. You will need it every time you unlock."
            : "Encrypted storage for passwords & secrets"
        }</p>
        <form id="vault-unlock-form" class="vault-unlock-form">
          <input type="password" id="vault-password" class="field-input vault-pw-input" placeholder="${
            isCreate ? "Create master password" : "Master password"
          }" autofocus />
          ${
            isCreate
              ? `<input type="password" id="vault-password2" class="field-input vault-pw-input" placeholder="Confirm master password" />`
              : ""
          }
          <button type="submit" class="btn btn-primary">${isCreate ? "Create vault" : "Unlock"}</button>
        </form>
        <p class="vault-error bad" id="vault-unlock-error" hidden></p>
      </div>`;
    page.querySelector("#vault-unlock-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const pw = page.querySelector("#vault-password").value;
      const errEl = page.querySelector("#vault-unlock-error");
      errEl.hidden = true;
      if (isCreate) {
        const pw2 = page.querySelector("#vault-password2")?.value || "";
        if (pw.length < 6) {
          errEl.textContent = "Master password must be at least 6 characters";
          errEl.hidden = false;
          return;
        }
        if (pw !== pw2) {
          errEl.textContent = "Passwords do not match";
          errEl.hidden = false;
          return;
        }
      }
      try {
        const res = await invoke("vault.unlock", { password: pw });
        entries = res.entries || [];
        unlocked = true;
        initialized = true;
        showVault();
        flushPendingOpen();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.hidden = false;
      }
    });
  }

  function showVault() {
    page.innerHTML = `
      <div class="vault-toolbar">
        <button type="button" class="btn btn-primary" id="vault-add">+ New entry</button>
        <button type="button" class="btn btn-ghost" id="vault-lock-btn">🔒 Lock</button>
        <span class="muted vault-count">${entries.length} entries</span>
      </div>
      <div class="vault-search-wrap">
        <input type="search" id="vault-search" class="search" placeholder="Search vault…" />
      </div>
      <div class="vault-grid" id="vault-grid"></div>
      <aside class="vault-editor hidden" id="vault-editor"></aside>`;
    page.querySelector("#vault-add").addEventListener("click", () => openEditor(null));
    page.querySelector("#vault-lock-btn").addEventListener("click", async () => {
      await invoke("vault.lock");
      unlocked = false;
      pendingOpenId = null;
      showLock();
    });
    page.querySelector("#vault-search").addEventListener("input", renderGrid);
    renderGrid();
  }

  async function refreshEntries() {
    const res = await invoke("vault.list");
    entries = res.entries || [];
  }

  function sortByName(list) {
    return [...(list || [])].sort((a, b) =>
      String(a?.name || "").localeCompare(String(b?.name || ""), undefined, {
        sensitivity: "base",
        numeric: true,
      })
    );
  }

  function filteredEntries() {
    const q = (page.querySelector("#vault-search")?.value || "").trim().toLowerCase();
    const list = !q
      ? entries
      : entries.filter((e) =>
          [e.name, e.username, e.url, e.notes, ...(e.tags || [])].join(" ").toLowerCase().includes(q)
        );
    return sortByName(list);
  }

  function renderGrid() {
    const grid = page.querySelector("#vault-grid");
    const list = filteredEntries();
    if (!list.length) {
      grid.innerHTML = `<p class="muted empty-msg">No entries — click + New entry</p>`;
      return;
    }
    grid.innerHTML = list
      .map(
        (e) => `<article class="vault-card ${editingId === e.id ? "selected" : ""}" data-id="${escapeHtml(e.id)}">
        <div class="vault-card-head">
          <span class="vault-entry-icon">${escapeHtml(e.icon || "🔑")}</span>
          <div>
            <h3>${escapeHtml(e.name)}</h3>
            <span class="muted">${escapeHtml(e.username || "—")}</span>
          </div>
          ${e.favorite ? '<span class="profile-fav">★</span>' : ""}
        </div>
        ${e.url ? `<p class="vault-url muted">${escapeHtml(e.url.replace(/^https?:\/\//, ""))}</p>` : ""}
        <div class="vault-card-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-copy-pw="${escapeHtml(e.id)}">Copy password</button>
          <button type="button" class="btn btn-ghost btn-sm" data-copy-user="${escapeHtml(e.username || "")}">Copy user</button>
          ${e.url ? `<button type="button" class="btn btn-ghost btn-sm" data-open="${escapeHtml(e.url)}">Open</button>` : ""}
        </div>
      </article>`
      )
      .join("");
    grid.querySelectorAll(".vault-card[data-id]").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        openEditor(card.dataset.id);
      });
    });
    grid.querySelectorAll("[data-copy-pw]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await invoke("vault.copyPassword", { id: btn.dataset.copyPw });
        btn.textContent = "Copied!";
        setTimeout(() => (btn.textContent = "Copy password"), 1500);
      });
    });
    grid.querySelectorAll("[data-copy-user]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (btn.dataset.copyUser) await invoke("clipboard.copy", { text: btn.dataset.copyUser });
      });
    });
    grid.querySelectorAll("[data-open]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        invoke("links.open", { url: btn.dataset.open });
      });
    });
  }

  async function openEditor(id) {
    editingId = id;
    let entry;
    if (id) {
      const res = await invoke("vault.get", { id });
      entry = res.entry;
    } else {
      entry = {
        id: uid("vault"),
        name: "",
        username: "",
        password: "",
        url: "",
        notes: "",
        icon: "🔑",
        category: "general",
        tags: [],
        favorite: false,
      };
    }

    const editor = page.querySelector("#vault-editor");
    editor.classList.remove("hidden");
    editor.innerHTML = `
      <header class="vault-editor-head">
        <h3>${id ? "Edit entry" : "New entry"}</h3>
        <button type="button" class="btn btn-ghost btn-sm" id="vault-ed-close">✕</button>
      </header>
      <form id="vault-ed-form" class="vault-ed-form">
        <label><span>Name</span><input type="text" id="ve-name" required value="${escapeHtml(entry.name)}" placeholder="e.g. Gmail, Bank, WiFi" /></label>
        <label><span>Username / email</span><input type="text" id="ve-user" value="${escapeHtml(entry.username)}" /></label>
        <label><span>Password</span><input type="text" id="ve-pass" value="${escapeHtml(entry.password)}" autocomplete="off" /></label>
        <label><span>URL</span><input type="url" id="ve-url" value="${escapeHtml(entry.url)}" placeholder="https://…" /></label>
        <label><span>Icon</span><input type="text" id="ve-icon" value="${escapeHtml(entry.icon)}" maxlength="4" /></label>
        <label><span>Tags</span><input type="text" id="ve-tags" value="${escapeHtml((entry.tags || []).join(", "))}" placeholder="work, personal" /></label>
        <label><span>Notes</span><textarea id="ve-notes" rows="3">${escapeHtml(entry.notes)}</textarea></label>
        <label class="check-row"><input type="checkbox" id="ve-fav" ${entry.favorite ? "checked" : ""} /> Favorite</label>
        <div class="detail-actions">
          <button type="submit" class="btn btn-primary">Save</button>
          ${id ? `<button type="button" class="btn btn-danger" id="ve-delete">Delete</button>` : ""}
        </div>
      </form>`;
    editor.querySelector("#vault-ed-close").addEventListener("click", () => {
      editingId = null;
      editor.classList.add("hidden");
      renderGrid();
    });
    editor.querySelector("#vault-ed-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const saved = {
        id: entry.id,
        name: editor.querySelector("#ve-name").value.trim(),
        username: editor.querySelector("#ve-user").value.trim(),
        password: editor.querySelector("#ve-pass").value,
        url: editor.querySelector("#ve-url").value.trim(),
        icon: editor.querySelector("#ve-icon").value.trim() || "🔑",
        notes: editor.querySelector("#ve-notes").value.trim(),
        tags: editor
          .querySelector("#ve-tags")
          .value.split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        favorite: editor.querySelector("#ve-fav").checked,
        category: entry.category || "general",
        createdAt: entry.createdAt,
      };
      await invoke("vault.save", { entry: saved });
      await refreshEntries();
      editingId = null;
      editor.classList.add("hidden");
      page.querySelector(".vault-count").textContent = `${entries.length} entries`;
      renderGrid();
    });

    editor.querySelector("#ve-delete")?.addEventListener("click", async () => {
      if (!confirm("Delete this vault entry?")) return;
      await invoke("vault.delete", { id: entry.id });
      await refreshEntries();
      editingId = null;
      editor.classList.add("hidden");
      renderGrid();
    });
    renderGrid();
  }

  function bind() {}
  async function openEntry(id) {
    if (!id) return false;
    if (!unlocked) {
      pendingOpenId = id;
      await scan();
      return false;
    }
    try {
      if (!entries.length) await refreshEntries();
    } catch {
    }
    if (!page.querySelector("#vault-editor")) {
      showVault();
    }
    await openEditor(id);
    return true;
  }
  return { id: "vault", page, scan, bind, openEntry, openEditor };
})();