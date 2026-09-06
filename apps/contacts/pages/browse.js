window.ContactsPages = window.ContactsPages || {};

window.ContactsPages.browse = (function () {
  const { escapeHtml, invoke, uid, displayName, formatTime, formatBirthday, ICON_PICKS } = window.Contacts;

  const page = document.getElementById("page-browse");
  const grid = document.getElementById("contacts-grid");
  const statsEl = document.getElementById("contacts-stats");
  const searchInput = document.getElementById("contacts-search");
  const groupNav = document.getElementById("group-nav");
  const detailPanel = document.getElementById("detail-panel");
  const detailBody = document.getElementById("detail-body");
  const detailTitle = document.getElementById("detail-title");
  const detailClose = document.getElementById("detail-close");
  const shell = document.getElementById("app-shell");

  let data = { groups: [], contacts: [] };
  let filterGroup = "all";
  let filterFavorites = false;
  let selectedId = null;
  let draft = null;

  function groupById(id) {
    return data.groups.find((g) => g.id === id) || { name: "Other", icon: "📇", color: "#8b9dc3" };
  }

  function filteredContacts() {
    const q = (searchInput?.value || "").trim().toLowerCase();
    return data.contacts.filter((c) => {
      if (filterFavorites && !c.favorite) return false;
      if (filterGroup !== "all" && filterGroup !== "favorites" && c.groupId !== filterGroup) return false;
      if (!q) return true;
      const hay = [
        displayName(c),
        c.company,
        c.jobTitle,
        c.notes,
        ...(c.tags || []),
        ...(c.emails || []).map((e) => e.value),
        ...(c.phones || []).map((p) => p.value),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  function renderStats() {
    const withBday = data.contacts.filter((c) => c.birthday).length;
    const withRem = data.contacts.reduce((n, c) => n + (c.reminders?.filter((r) => r.enabled).length || 0), 0);
    statsEl.innerHTML = `
      <div class="stat-card"><span class="stat-val">${data.contacts.length}</span><span class="stat-label">Contacts</span></div>
      <div class="stat-card"><span class="stat-val">${data.contacts.filter((c) => c.favorite).length}</span><span class="stat-label">Favorites</span></div>
      <div class="stat-card"><span class="stat-val">${withBday}</span><span class="stat-label">Birthdays</span></div>
      <div class="stat-card"><span class="stat-val">${withRem}</span><span class="stat-label">Reminders</span></div>`;
  }

  function renderGroupNav() {
    const items = [
      { id: "all", name: "All contacts", icon: "📇" },
      { id: "favorites", name: "Favorites", icon: "★" },
      ...data.groups,
    ];
    groupNav.innerHTML = items
      .map((g) => {
        const active =
          (g.id === "favorites" && filterFavorites) ||
          (g.id !== "favorites" && g.id === filterGroup && !filterFavorites) ||
          (g.id === "all" && filterGroup === "all" && !filterFavorites);
        const count =
          g.id === "all"
            ? data.contacts.length
            : g.id === "favorites"
              ? data.contacts.filter((c) => c.favorite).length
              : data.contacts.filter((c) => c.groupId === g.id).length;
        return `<button type="button" class="nav-item ${active ? "active" : ""}" data-grp="${escapeHtml(g.id)}" style="${g.color ? `--cat-color:${g.color}` : ""}">
          <span class="nav-icon">${escapeHtml(g.icon || "📁")}</span>
          ${escapeHtml(g.name)} <span class="nav-count">${count}</span>
        </button>`;
      })
      .join("");

    groupNav.querySelectorAll("[data-grp]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.grp;
        if (id === "favorites") {
          filterFavorites = true;
          filterGroup = "all";
        } else {
          filterFavorites = false;
          filterGroup = id;
        }
        render();
      });
    });
  }

  function contactCard(c) {
    const grp = groupById(c.groupId);
    const primaryPhone = c.phones?.[0]?.value;
    const primaryEmail = c.emails?.[0]?.value;
    return `<article class="contact-card ${selectedId === c.id ? "selected" : ""}" data-id="${escapeHtml(c.id)}" style="--card-accent:${grp.color}">
      <div class="contact-card-head">
        <span class="contact-avatar">${escapeHtml(c.icon || "👤")}</span>
        <div>
          <h3>${escapeHtml(displayName(c))}</h3>
          <span class="contact-sub">${escapeHtml(c.company || c.jobTitle || grp.name)}</span>
        </div>
        ${c.favorite ? '<span class="contact-fav">★</span>' : ""}
      </div>
      <div class="contact-quick">
        ${primaryPhone ? `<button type="button" class="quick-btn" data-call="${escapeHtml(primaryPhone)}" title="Call">📞</button>` : ""}
        ${primaryEmail ? `<button type="button" class="quick-btn" data-mail="${escapeHtml(primaryEmail)}" title="Email">✉</button>` : ""}
        ${c.birthday ? `<span class="contact-bday" title="Birthday">🎂 ${escapeHtml(formatBirthday(c.birthday))}</span>` : ""}
      </div>
    </article>`;
  }

  function bindQuickActions(root) {
    root.querySelectorAll("[data-call]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        invoke("phone.open", { phone: btn.dataset.call });
      });
    });
    root.querySelectorAll("[data-mail]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        invoke("email.open", { email: btn.dataset.mail });
      });
    });
  }

  function renderGrid() {
    const list = filteredContacts().sort((a, b) => displayName(a).localeCompare(displayName(b)));
    if (!list.length) {
      grid.innerHTML = `<div class="empty-state"><p>No contacts yet.</p><button type="button" class="btn btn-primary" id="empty-add">+ Add contact</button></div>`;
      grid.querySelector("#empty-add")?.addEventListener("click", () => openEditor(null));
      return;
    }
    grid.innerHTML = list.map(contactCard).join("");
    grid.querySelectorAll(".contact-card[data-id]").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest(".quick-btn")) return;
        openEditor(card.dataset.id);
      });
    });
    bindQuickActions(grid);
  }

  function emailRow(e, i) {
    return `<div class="repeat-row" data-email-i="${i}">
      <input type="text" class="field-input em-label" placeholder="Label" value="${escapeHtml(e?.label || "")}" />
      <input type="email" class="field-input em-val" placeholder="email@example.com" value="${escapeHtml(e?.value || "")}" />
      <button type="button" class="btn btn-ghost btn-sm row-open-em" title="Email">✉</button>
      <button type="button" class="btn btn-ghost btn-sm row-rm">✕</button>
    </div>`;
  }

  function phoneRow(p, i) {
    return `<div class="repeat-row" data-phone-i="${i}">
      <input type="text" class="field-input ph-label" placeholder="Label" value="${escapeHtml(p?.label || "")}" />
      <input type="tel" class="field-input ph-val" placeholder="+972…" value="${escapeHtml(p?.value || "")}" />
      <button type="button" class="btn btn-ghost btn-sm row-call" title="Call">📞</button>
      <button type="button" class="btn btn-ghost btn-sm row-sms" title="SMS">💬</button>
      <button type="button" class="btn btn-ghost btn-sm row-rm">✕</button>
    </div>`;
  }

  function reminderRow(r, i) {
    return `<div class="repeat-row reminder-row" data-rem-i="${i}">
      <input type="text" class="field-input rem-title" placeholder="Reminder text" value="${escapeHtml(r?.title || "")}" />
      <input type="date" class="field-input rem-date" value="${escapeHtml(r?.date || "")}" />
      <input type="time" class="field-input rem-time" value="${escapeHtml(r?.time || "09:00")}" />
      <select class="field-input rem-repeat">
        <option value="none" ${r?.repeat === "none" ? "selected" : ""}>Once</option>
        <option value="daily" ${r?.repeat === "daily" ? "selected" : ""}>Daily</option>
        <option value="weekly" ${r?.repeat === "weekly" ? "selected" : ""}>Weekly</option>
        <option value="monthly" ${r?.repeat === "monthly" ? "selected" : ""}>Monthly</option>
        <option value="yearly" ${r?.repeat === "yearly" ? "selected" : ""}>Yearly</option>
      </select>
      <label class="check-row-sm"><input type="checkbox" class="rem-enabled" ${r?.enabled !== false ? "checked" : ""} /> On</label>
      <button type="button" class="btn btn-ghost btn-sm row-rm">✕</button>
    </div>`;
  }

  function openEditor(id) {
    selectedId = id;
    const existing = id ? data.contacts.find((c) => c.id === id) : null;
    draft = existing
      ? structuredClone(existing)
      : {
          id: uid("con"),
          firstName: "",
          lastName: "",
          displayName: "",
          icon: "👤",
          groupId: filterGroup !== "all" && filterGroup !== "favorites" ? filterGroup : "other",
          company: "",
          jobTitle: "",
          address: "",
          birthday: "",
          emails: [{ label: "Email", value: "" }],
          phones: [{ label: "Mobile", value: "" }],
          notes: "",
          tags: [],
          favorite: false,
          reminders: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

    detailTitle.textContent = existing ? displayName(draft) : "New contact";
    shell.classList.add("detail-open");
    detailPanel.classList.remove("hidden");
    renderEditor();
    renderGrid();
  }

  function closeEditor() {
    selectedId = null;
    draft = null;
    shell.classList.remove("detail-open");
    detailPanel.classList.add("hidden");
    renderGrid();
  }

  function renderEditor() {
    if (!draft) return;
    const grpOptions = data.groups
      .map((g) => `<option value="${escapeHtml(g.id)}" ${draft.groupId === g.id ? "selected" : ""}>${escapeHtml(g.icon)} ${escapeHtml(g.name)}</option>`)
      .join("");
    const iconOptions = ICON_PICKS.map(
      (ic) => `<button type="button" class="icon-pick ${draft.icon === ic ? "active" : ""}" data-icon="${escapeHtml(ic)}">${ic}</button>`
    ).join("");

    detailBody.innerHTML = `
      <form class="contact-form" id="contact-form">
        <div class="icon-picker">${iconOptions}</div>
        <div class="name-row">
          <label><span>First name</span><input type="text" id="ed-first" value="${escapeHtml(draft.firstName)}" required /></label>
          <label><span>Last name</span><input type="text" id="ed-last" value="${escapeHtml(draft.lastName)}" /></label>
        </div>
        <label><span>Display name (optional)</span><input type="text" id="ed-display" value="${escapeHtml(draft.displayName || "")}" placeholder="Overrides first + last" /></label>
        <label><span>Group</span><select id="ed-group">${grpOptions}</select></label>
        <label><span>Company</span><input type="text" id="ed-company" value="${escapeHtml(draft.company)}" /></label>
        <label><span>Job title</span><input type="text" id="ed-job" value="${escapeHtml(draft.jobTitle)}" /></label>
        <label><span>Birthday</span><input type="text" id="ed-birthday" value="${escapeHtml(draft.birthday)}" placeholder="MM-DD or YYYY-MM-DD" /></label>
        <label><span>Address</span><input type="text" id="ed-address" value="${escapeHtml(draft.address)}" /></label>
        <label class="check-row"><input type="checkbox" id="ed-fav" ${draft.favorite ? "checked" : ""} /> Favorite</label>

        <div class="form-section">
          <div class="form-section-head"><strong>Phone numbers</strong><button type="button" class="btn btn-ghost btn-sm" id="ed-add-phone">+ Add</button></div>
          <div id="ed-phones">${(draft.phones?.length ? draft.phones : [{ label: "Mobile", value: "" }]).map(phoneRow).join("")}</div>
        </div>

        <div class="form-section">
          <div class="form-section-head"><strong>Email addresses</strong><button type="button" class="btn btn-ghost btn-sm" id="ed-add-email">+ Add</button></div>
          <div id="ed-emails">${(draft.emails?.length ? draft.emails : [{ label: "Email", value: "" }]).map(emailRow).join("")}</div>
        </div>

        <div class="form-section">
          <div class="form-section-head"><strong>Reminders & notifications</strong><button type="button" class="btn btn-ghost btn-sm" id="ed-add-rem">+ Add reminder</button></div>
          <p class="form-hint">Desktop notifications show the contact's name. Birthday alerts use Settings time.</p>
          <div id="ed-reminders">${(draft.reminders || []).map(reminderRow).join("")}</div>
        </div>

        <label><span>Tags</span><input type="text" id="ed-tags" value="${escapeHtml((draft.tags || []).join(", "))}" placeholder="vip, client…" /></label>
        <label><span>Notes</span><textarea id="ed-notes" rows="4">${escapeHtml(draft.notes)}</textarea></label>

        <div class="detail-actions">
          <button type="submit" class="btn btn-primary">Save</button>
          ${selectedId && data.contacts.find((c) => c.id === selectedId) ? `<button type="button" class="btn btn-danger" id="ed-delete">Delete</button>` : ""}
          <button type="button" class="btn" id="ed-test-notify">Test notification</button>
        </div>
      </form>`;

    detailBody.querySelectorAll(".icon-pick").forEach((btn) => {
      btn.addEventListener("click", () => {
        draft.icon = btn.dataset.icon;
        renderEditor();
      });
    });

    detailBody.querySelector("#ed-add-phone")?.addEventListener("click", () => {
      draft.phones.push({ label: "Mobile", value: "" });
      renderEditor();
    });
    detailBody.querySelector("#ed-add-email")?.addEventListener("click", () => {
      draft.emails.push({ label: "Email", value: "" });
      renderEditor();
    });
    detailBody.querySelector("#ed-add-rem")?.addEventListener("click", () => {
      draft.reminders.push({ title: "", date: new Date().toISOString().slice(0, 10), time: "09:00", repeat: "none", enabled: true });
      renderEditor();
    });

    detailBody.querySelectorAll("#ed-phones .row-rm").forEach((btn, i) => {
      btn.addEventListener("click", () => {
        draft.phones.splice(i, 1);
        renderEditor();
      });
    });
    detailBody.querySelectorAll("#ed-phones .row-call").forEach((btn, i) => {
      btn.addEventListener("click", () => {
        const v = detailBody.querySelectorAll("#ed-phones .ph-val")[i]?.value;
        if (v) invoke("phone.open", { phone: v });
      });
    });
    detailBody.querySelectorAll("#ed-phones .row-sms").forEach((btn, i) => {
      btn.addEventListener("click", () => {
        const v = detailBody.querySelectorAll("#ed-phones .ph-val")[i]?.value;
        if (v) invoke("sms.open", { phone: v });
      });
    });

    detailBody.querySelectorAll("#ed-emails .row-rm").forEach((btn, i) => {
      btn.addEventListener("click", () => {
        draft.emails.splice(i, 1);
        renderEditor();
      });
    });
    detailBody.querySelectorAll("#ed-emails .row-open-em").forEach((btn, i) => {
      btn.addEventListener("click", () => {
        const v = detailBody.querySelectorAll("#ed-emails .em-val")[i]?.value;
        if (v) invoke("email.open", { email: v });
      });
    });

    detailBody.querySelectorAll("#ed-reminders .row-rm").forEach((btn, i) => {
      btn.addEventListener("click", () => {
        draft.reminders.splice(i, 1);
        renderEditor();
      });
    });

    detailBody.querySelector("#ed-test-notify")?.addEventListener("click", async () => {
      const name = displayName({
        firstName: detailBody.querySelector("#ed-first")?.value,
        lastName: detailBody.querySelector("#ed-last")?.value,
        displayName: detailBody.querySelector("#ed-display")?.value,
      });
      await invoke("notify.test", { title: name, body: "This is how reminders will appear for this contact." });
    });

    detailBody.querySelector("#ed-delete")?.addEventListener("click", async () => {
      if (!confirm("Delete this contact?")) return;
      data.contacts = data.contacts.filter((c) => c.id !== draft.id);
      await window.ContactsStorage.save(data);
      closeEditor();
      render();
    });

    detailBody.querySelector("#contact-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await saveFromForm();
      closeEditor();
      render();
    });
  }

  async function saveFromForm() {
    if (!draft) return;
    draft.firstName = detailBody.querySelector("#ed-first")?.value.trim() || "";
    draft.lastName = detailBody.querySelector("#ed-last")?.value.trim() || "";
    draft.displayName = detailBody.querySelector("#ed-display")?.value.trim() || "";
    draft.groupId = detailBody.querySelector("#ed-group")?.value || "other";
    draft.company = detailBody.querySelector("#ed-company")?.value.trim() || "";
    draft.jobTitle = detailBody.querySelector("#ed-job")?.value.trim() || "";
    draft.birthday = detailBody.querySelector("#ed-birthday")?.value.trim() || "";
    draft.address = detailBody.querySelector("#ed-address")?.value.trim() || "";
    draft.favorite = detailBody.querySelector("#ed-fav")?.checked || false;
    draft.notes = detailBody.querySelector("#ed-notes")?.value || "";
    draft.tags = (detailBody.querySelector("#ed-tags")?.value || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    draft.phones = [];
    detailBody.querySelectorAll("#ed-phones .repeat-row").forEach((row) => {
      const label = row.querySelector(".ph-label")?.value.trim();
      const value = row.querySelector(".ph-val")?.value.trim();
      if (value) draft.phones.push({ id: uid("ph"), label: label || "Mobile", value });
    });

    draft.emails = [];
    detailBody.querySelectorAll("#ed-emails .repeat-row").forEach((row) => {
      const label = row.querySelector(".em-label")?.value.trim();
      const value = row.querySelector(".em-val")?.value.trim();
      if (value) draft.emails.push({ id: uid("em"), label: label || "Email", value });
    });

    draft.reminders = [];
    detailBody.querySelectorAll("#ed-reminders .repeat-row").forEach((row) => {
      const title = row.querySelector(".rem-title")?.value.trim();
      const date = row.querySelector(".rem-date")?.value;
      if (!title && !date) return;
      draft.reminders.push({
        id: uid("rem"),
        title: title || "Reminder",
        date: date || "",
        time: row.querySelector(".rem-time")?.value || "09:00",
        repeat: row.querySelector(".rem-repeat")?.value || "none",
        enabled: row.querySelector(".rem-enabled")?.checked !== false,
      });
    });

    draft.updatedAt = new Date().toISOString();
    const idx = data.contacts.findIndex((c) => c.id === draft.id);
    if (idx >= 0) data.contacts[idx] = draft;
    else data.contacts.unshift(draft);
    await window.ContactsStorage.save(data);
    detailTitle.textContent = displayName(draft);
  }

  function render() {
    renderStats();
    renderGroupNav();
    renderGrid();
  }

  async function scan() {
    data = await window.ContactsStorage.load();
    render();
  }

  function bind(ui) {
    searchInput?.addEventListener("input", () => renderGrid());
    detailClose?.addEventListener("click", closeEditor);
    ui.btnAdd?.addEventListener("click", () => openEditor(null));
    ui.btnExport?.addEventListener("click", async () => {
      const res = await invoke("data.export");
      await invoke("clipboard.copy", { text: res.json });
      alert("Contacts copied to clipboard as JSON.");
    });
    ui.btnImport?.addEventListener("click", async () => {
      const json = prompt("Paste exported JSON:");
      if (!json) return;
      try {
        await invoke("data.import", { json });
        await scan();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  return { id: "browse", page, scan, bind, openEditor };
})();
