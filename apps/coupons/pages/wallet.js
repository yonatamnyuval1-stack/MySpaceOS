window.CouponsPages = window.CouponsPages || {};
window.CouponsPages.wallet = (function () {
  const { escapeHtml, invoke, uid, formatDate, TYPE_META } = window.Coupons;
  const page = document.getElementById("page-wallet");
  let unlocked = false;
  let initialized = false;
  let entries = [];
  let filter = "all";
  let editingId = null;
  let pendingOpenId = null;

  function statusLabel(status) {
    if (status === "redeemed") return { text: "Used", cls: "status-used" };
    if (status === "expired") return { text: "Expired", cls: "status-expired" };
    return { text: "Active", cls: "status-active" };
  }

  async function scan() {
    const status = await invoke("coupons.status");
    initialized = Boolean(status.initialized);
    if (status.unlocked) {
      unlocked = true;
      try {
        await refreshEntries();
      } catch {
      }
      showWallet();
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
      <div class="wallet-lock card-panel">
        <span class="wallet-lock-icon">🎟️</span>
        <h2>Coupons Wallet</h2>
        <p class="muted">${
          isCreate
            ? "Choose a master password to encrypt this wallet. You will need it every time you unlock."
            : "Encrypted storage for gift codes & promos"
        }</p>
        <form id="wallet-unlock-form" class="wallet-unlock-form">
          <input type="password" id="wallet-password" class="field-input wallet-pw-input" placeholder="${
            isCreate ? "Create master password" : "Master password"
          }" autofocus />
          ${
            isCreate
              ? `<input type="password" id="wallet-password2" class="field-input wallet-pw-input" placeholder="Confirm master password" />`
              : ""
          }
          <button type="submit" class="btn btn-primary">${isCreate ? "Create wallet" : "Unlock"}</button>
        </form>
        <p class="wallet-error bad" id="wallet-unlock-error" hidden></p>
      </div>`;
    page.querySelector("#wallet-unlock-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const pw = page.querySelector("#wallet-password").value;
      const errEl = page.querySelector("#wallet-unlock-error");
      errEl.hidden = true;
      if (isCreate) {
        const pw2 = page.querySelector("#wallet-password2")?.value || "";
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
        const res = await invoke("coupons.unlock", { password: pw });
        entries = res.entries || [];
        unlocked = true;
        initialized = true;
        showWallet();
        flushPendingOpen();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.hidden = false;
      }
    });
  }

  function showWallet() {
    page.innerHTML = `
      <div class="wallet-toolbar">
        <button type="button" class="btn btn-primary" id="wallet-add">+ New coupon</button>
        <button type="button" class="btn btn-ghost" id="wallet-lock-btn">Lock</button>
        <span class="muted wallet-count" id="wallet-count">${entries.length} coupons</span>
      </div>
      <div class="wallet-filters" id="wallet-filters">
        <button type="button" class="chip ${filter === "all" ? "active" : ""}" data-filter="all">All</button>
        <button type="button" class="chip ${filter === "active" ? "active" : ""}" data-filter="active">Active</button>
        <button type="button" class="chip ${filter === "redeemed" ? "active" : ""}" data-filter="redeemed">Used</button>
        <button type="button" class="chip ${filter === "expired" ? "active" : ""}" data-filter="expired">Expired</button>
      </div>
      <div class="wallet-search-wrap">
        <input type="search" id="wallet-search" class="search" placeholder="Search retailer, code, tags…" />
      </div>
      <div class="wallet-grid" id="wallet-grid"></div>
      <aside class="wallet-editor hidden" id="wallet-editor"></aside>`;
    page.querySelector("#wallet-add").addEventListener("click", () => openEditor(null));
    page.querySelector("#wallet-lock-btn").addEventListener("click", async () => {
      await invoke("coupons.lock");
      unlocked = false;
      pendingOpenId = null;
      showLock();
    });
    page.querySelector("#wallet-search").addEventListener("input", renderGrid);
    page.querySelectorAll("[data-filter]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        filter = btn.dataset.filter || "all";
        await refreshEntries();
        showWallet();
      });
    });
    renderGrid();
  }

  async function refreshEntries() {
    const res = await invoke("coupons.list", { filter });
    entries = res.entries || [];
  }

  function filteredEntries() {
    const q = (page.querySelector("#wallet-search")?.value || "").trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      [e.title, e.retailer, e.code, e.type, e.notes, ...(e.tags || [])].join(" ").toLowerCase().includes(q)
    );
  }

  function renderGrid() {
    const grid = page.querySelector("#wallet-grid");
    if (!grid) return;
    const list = filteredEntries();
    if (!list.length) {
      grid.innerHTML = `<p class="muted empty-msg">No coupons. </p>`;
      return;
    }
    grid.innerHTML = list
      .map((e) => {
        const st = statusLabel(e.status);
        const type = TYPE_META[e.type] || TYPE_META.gift;
        const value = e.value ? `<span class="wallet-value">${escapeHtml(e.value)} ${escapeHtml(e.currency || "")}</span>` : "";
        const expiry = e.expiresAt ? `<span class="muted tiny">Expires ${escapeHtml(formatDate(e.expiresAt))}</span>` : "";
        return `<article class="wallet-card ${editingId === e.id ? "selected" : ""} ${st.cls}" data-id="${escapeHtml(e.id)}">
          <div class="wallet-card-head">
            <span class="wallet-icon">${escapeHtml(e.icon || type.icon)}</span>
            <div>
              <h3>${escapeHtml(e.title)}</h3>
              <span class="muted">${escapeHtml(e.retailer || type.label)}</span>
            </div>
            <div class="wallet-card-badges">
              ${e.favorite ? '<span class="fav">★</span>' : ""}
              <span class="status-pill ${st.cls}">${st.text}</span>
            </div>
          </div>
          <div class="wallet-code-line">
            <code>${escapeHtml(e.code || ":")}</code>
            ${value}
          </div>
          ${expiry}
          <div class="wallet-card-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-copy="${escapeHtml(e.id)}">Copy code</button>
            ${e.hasPin ? `<button type="button" class="btn btn-ghost btn-sm" data-copy-pin="${escapeHtml(e.id)}">Copy PIN</button>` : ""}
            ${e.url ? `<button type="button" class="btn btn-ghost btn-sm" data-open="${escapeHtml(e.url)}">Open</button>` : ""}
            ${e.status === "active" ? `<button type="button" class="btn btn-ghost btn-sm" data-redeem="${escapeHtml(e.id)}">Mark used</button>` : ""}
          </div>
        </article>`;
      })
      .join("");
    grid.querySelectorAll(".wallet-card[data-id]").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        openEditor(card.dataset.id);
      });
    });
    grid.querySelectorAll("[data-copy]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await invoke("coupons.copyCode", { id: btn.dataset.copy });
        btn.textContent = "Copied!";
        setTimeout(() => (btn.textContent = "Copy code"), 1500);
      });
    });
    grid.querySelectorAll("[data-copy-pin]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await invoke("coupons.copyPin", { id: btn.dataset.copyPin });
        btn.textContent = "Copied!";
        setTimeout(() => (btn.textContent = "Copy PIN"), 1500);
      });
    });
    grid.querySelectorAll("[data-open]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        invoke("links.open", { url: btn.dataset.open });
      });
    });
    grid.querySelectorAll("[data-redeem]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await invoke("coupons.redeem", { id: btn.dataset.redeem });
        await refreshEntries();
        const count = page.querySelector("#wallet-count");
        if (count) count.textContent = `${entries.length} coupons`;
        renderGrid();
      });
    });
  }

  async function openEditor(id) {
    editingId = id;
    let entry;
    if (id) {
      const res = await invoke("coupons.get", { id });
      entry = res.entry;
    } else {
      entry = {
        id: uid("cpn"),
        title: "",
        code: "",
        pin: "",
        retailer: "",
        type: "gift",
        icon: "🎁",
        value: "",
        currency: "ILS",
        url: "",
        notes: "",
        tags: [],
        favorite: false,
        expiresAt: "",
        redeemedAt: "",
      };
    }
    const editor = page.querySelector("#wallet-editor");
    editor.classList.remove("hidden");
    const typeOptions = Object.entries(TYPE_META)
      .map(
        ([k, v]) =>
          `<option value="${k}"${entry.type === k ? " selected" : ""}>${escapeHtml(v.label)}</option>`
      )
      .join("");
    editor.innerHTML = `
      <header class="wallet-editor-head">
        <h3>${id ? "Edit coupon" : "New coupon"}</h3>
        <button type="button" class="btn btn-ghost btn-sm" id="wallet-ed-close">✕</button>
      </header>
      <form id="wallet-ed-form" class="wallet-ed-form">
        <label><span>Title</span><input type="text" id="we-title" required value="${escapeHtml(entry.title)}" placeholder="e.g. Amazon gift card" /></label>
        <div class="form-row">
          <label><span>Type</span><select id="we-type">${typeOptions}</select></label>
          <label><span>Icon</span><input type="text" id="we-icon" maxlength="4" value="${escapeHtml(entry.icon)}" /></label>
        </div>
        <label><span>Retailer / store</span><input type="text" id="we-retailer" value="${escapeHtml(entry.retailer)}" placeholder="Amazon, Shufersal…" /></label>
        <label><span>Code</span><input type="text" id="we-code" value="${escapeHtml(entry.code)}" autocomplete="off" placeholder="XXXX-XXXX-XXXX" /></label>
        <label><span>PIN (optional)</span><input type="text" id="we-pin" value="${escapeHtml(entry.pin)}" autocomplete="off" /></label>
        <div class="form-row">
          <label><span>Value</span><input type="text" id="we-value" value="${escapeHtml(entry.value)}" placeholder="100" /></label>
          <label><span>Currency</span><input type="text" id="we-currency" value="${escapeHtml(entry.currency || "ILS")}" maxlength="8" /></label>
        </div>
        <label><span>Expires</span><input type="date" id="we-expires" value="${escapeHtml((entry.expiresAt || "").slice(0, 10))}" /></label>
        <label><span>Redeem URL</span><input type="url" id="we-url" value="${escapeHtml(entry.url)}" placeholder="https://…" /></label>
        <label><span>Tags</span><input type="text" id="we-tags" value="${escapeHtml((entry.tags || []).join(", "))}" placeholder="birthday, work" /></label>
        <label><span>Notes</span><textarea id="we-notes" rows="3">${escapeHtml(entry.notes)}</textarea></label>
        <label class="check-row"><input type="checkbox" id="we-fav" ${entry.favorite ? "checked" : ""} /> Favorite</label>
        ${entry.redeemedAt ? `<label class="check-row"><input type="checkbox" id="we-used" checked /> Marked as used (${escapeHtml(formatDate(entry.redeemedAt))})</label>` : `<label class="check-row"><input type="checkbox" id="we-used" /> Mark as used</label>`}
        <div class="detail-actions">
          <button type="submit" class="btn btn-primary">Save</button>
          ${id ? `<button type="button" class="btn btn-danger" id="we-delete">Delete</button>` : ""}
        </div>
      </form>`;
    editor.querySelector("#we-type").addEventListener("change", (e) => {
      const t = e.target.value;
      const meta = TYPE_META[t];
      if (meta) editor.querySelector("#we-icon").value = meta.icon;
    });
    editor.querySelector("#wallet-ed-close").addEventListener("click", () => {
      editingId = null;
      editor.classList.add("hidden");
      renderGrid();
    });
    editor.querySelector("#wallet-ed-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const type = editor.querySelector("#we-type").value;
      const saved = {
        id: entry.id,
        title: editor.querySelector("#we-title").value.trim(),
        code: editor.querySelector("#we-code").value.trim(),
        pin: editor.querySelector("#we-pin").value.trim(),
        retailer: editor.querySelector("#we-retailer").value.trim(),
        type,
        icon: editor.querySelector("#we-icon").value.trim() || TYPE_META[type]?.icon || "🎟️",
        value: editor.querySelector("#we-value").value.trim(),
        currency: editor.querySelector("#we-currency").value.trim() || "ILS",
        url: editor.querySelector("#we-url").value.trim(),
        notes: editor.querySelector("#we-notes").value.trim(),
        tags: editor
          .querySelector("#we-tags")
          .value.split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        favorite: editor.querySelector("#we-fav").checked,
        expiresAt: editor.querySelector("#we-expires").value || "",
        redeemedAt: editor.querySelector("#we-used").checked
          ? entry.redeemedAt || new Date().toISOString().slice(0, 10)
          : "",
        createdAt: entry.createdAt,
      };
      await invoke("coupons.save", { entry: saved });
      await refreshEntries();
      editingId = null;
      editor.classList.add("hidden");
      const count = page.querySelector("#wallet-count");
      if (count) count.textContent = `${entries.length} coupons`;
      renderGrid();
    });
    editor.querySelector("#we-delete")?.addEventListener("click", async () => {
      if (!confirm("Delete this coupon permanently?")) return;
      await invoke("coupons.delete", { id: entry.id });
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
    if (!page.querySelector("#wallet-editor")) showWallet();
    await openEditor(id);
    return true;
  }
  return { id: "wallet", page, scan, bind, openEntry, openEditor };
})();