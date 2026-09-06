window.ProfilesPages = window.ProfilesPages || {};

window.ProfilesPages.browse = (function () {
  const { escapeHtml, invoke, uid, formatTime, ICON_PICKS } = window.Profiles;

  const page = document.getElementById("page-browse");
  const grid = document.getElementById("profiles-grid");
  const statsEl = document.getElementById("profiles-stats");
  const searchInput = document.getElementById("profiles-search");
  const categoryNav = document.getElementById("category-nav");
  const detailPanel = document.getElementById("detail-panel");
  const detailBody = document.getElementById("detail-body");
  const detailTitle = document.getElementById("detail-title");
  const detailClose = document.getElementById("detail-close");
  const shell = document.getElementById("app-shell");

  let data = { categories: [], profiles: [] };
  let filterCategory = "all";
  let filterFavorites = false;
  let selectedId = null;
  let draft = null;

  function categoryById(id) {
    return data.categories.find((c) => c.id === id) || { name: "General", icon: "📁", color: "#8b9dc3" };
  }

  function filteredProfiles() {
    const q = (searchInput?.value || "").trim().toLowerCase();
    return data.profiles.filter((p) => {
      if (filterFavorites && !p.favorite) return false;
      if (filterCategory !== "all" && filterCategory !== "favorites" && p.categoryId !== filterCategory) return false;
      if (!q) return true;
      const hay = [
        p.name,
        p.description,
        p.notes,
        ...(p.tags || []),
        ...(p.links || []).map((l) => `${l.label} ${l.url}`),
        ...(p.fields || []).map((f) => `${f.key} ${f.value}`),
        p.localPath || "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  function renderStats() {
    const total = data.profiles.length;
    const fav = data.profiles.filter((p) => p.favorite).length;
    const links = data.profiles.reduce((n, p) => n + (p.links?.length || 0), 0);
    statsEl.innerHTML = `
      <div class="stat-card"><span class="stat-val">${total}</span><span class="stat-label">Profiles</span></div>
      <div class="stat-card"><span class="stat-val">${data.categories.length}</span><span class="stat-label">Categories</span></div>
      <div class="stat-card"><span class="stat-val">${fav}</span><span class="stat-label">Favorites</span></div>
      <div class="stat-card"><span class="stat-val">${links}</span><span class="stat-label">Links</span></div>`;
  }

  function renderCategoryNav() {
    const items = [
      { id: "all", name: "All profiles", icon: "📇" },
      { id: "favorites", name: "Favorites", icon: "★" },
      ...data.categories,
    ];
    categoryNav.innerHTML = items
      .map((c) => {
        const active =
          (c.id === "favorites" && filterFavorites) ||
          (c.id !== "favorites" && c.id === filterCategory && !filterFavorites) ||
          (c.id === "all" && filterCategory === "all" && !filterFavorites);
        const count =
          c.id === "all"
            ? data.profiles.length
            : c.id === "favorites"
              ? data.profiles.filter((p) => p.favorite).length
              : data.profiles.filter((p) => p.categoryId === c.id).length;
        return `<button type="button" class="nav-item ${active ? "active" : ""}" data-cat="${escapeHtml(c.id)}" style="${c.color ? `--cat-color:${c.color}` : ""}">
          <span class="nav-icon">${escapeHtml(c.icon || "📁")}</span>
          ${escapeHtml(c.name)} <span class="nav-count">${count}</span>
        </button>`;
      })
      .join("");

    categoryNav.querySelectorAll("[data-cat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.cat;
        if (id === "favorites") {
          filterFavorites = true;
          filterCategory = "all";
        } else {
          filterFavorites = false;
          filterCategory = id;
        }
        render();
      });
    });
  }

  function profileCard(p) {
    const cat = categoryById(p.categoryId);
    const linkCount = p.links?.length || 0;
    const fieldCount = p.fields?.length || 0;
    const accent = p.color || cat.color;
    return `<article class="profile-card ${selectedId === p.id ? "selected" : ""}" data-id="${escapeHtml(p.id)}" style="--card-accent:${accent}">
      <div class="profile-card-head">
        <span class="profile-icon">${escapeHtml(p.icon || "◆")}</span>
        <div class="profile-card-titles">
          <h3>${escapeHtml(p.name)}</h3>
          <span class="profile-cat">${escapeHtml(cat.icon)} ${escapeHtml(cat.name)}</span>
        </div>
        ${p.favorite ? '<span class="profile-fav" title="Favorite">★</span>' : ""}
      </div>
      ${p.description ? `<p class="profile-desc">${escapeHtml(p.description)}</p>` : ""}
      <div class="profile-meta">
        ${linkCount ? `<span>🔗 ${linkCount}</span>` : ""}
        ${fieldCount ? `<span>▤ ${fieldCount}</span>` : ""}
        ${p.tags?.length ? `<span>${p.tags.slice(0, 2).map((t) => `#${escapeHtml(t)}`).join(" ")}</span>` : ""}
      </div>
      ${p.links?.length ? `<div class="profile-link-bar">${p.links.map((l) => linkButtonHtml(l)).join("")}</div>` : ""}
      ${p.localPath ? `<button type="button" class="btn btn-ghost btn-sm profile-folder-btn" data-open-folder="${escapeHtml(p.localPath)}">📁 Open folder</button>` : ""}
    </article>`;
  }

  function linkButtonHtml(link) {
    const label = escapeHtml(link.label || "Open link");
    const url = escapeHtml(link.url || "");
    if (!url) return "";
    const shortUrl = escapeHtml(String(link.url).replace(/^https?:\/\//i, "").slice(0, 52));
    return `<button type="button" class="link-open-btn" data-open-link="${url}" title="${url}">
      <span class="link-open-icon">↗</span>
      <span class="link-open-text">
        <span class="link-open-label">${label}</span>
        <span class="link-open-url">${shortUrl}</span>
      </span>
    </button>`;
  }

  function bindOpenLinkButtons(root) {
    root.querySelectorAll("[data-open-link]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        invoke("links.open", { url: btn.dataset.openLink });
      });
    });
  }

  function readLinksFromEditor() {
    const rows = detailBody.querySelectorAll("#ed-links .repeat-row");
    const links = [];
    rows.forEach((row) => {
      const label = row.querySelector(".link-label")?.value.trim();
      const url = row.querySelector(".link-url")?.value.trim();
      if (url) links.push({ label: label || "Link", url });
    });
    return links;
  }

  function renderLinkLaunchBar() {
    const bar = detailBody.querySelector("#link-launch-bar");
    if (!bar) return;
    const links = readLinksFromEditor();
    if (!links.length) {
      bar.innerHTML = `<p class="link-launch-empty muted">Paste a URL above.</p>`;
      return;
    }
    bar.innerHTML = `<p class="link-launch-title">Open now</p><div class="link-launch-grid">${links.map((l) => linkButtonHtml(l)).join("")}</div>`;
    bindOpenLinkButtons(bar);
  }

  function renderGrid() {
    const list = filteredProfiles();
    if (!list.length) {
      grid.innerHTML = `<div class="empty-state">
        <p>No profiles yet.</p>
        <button type="button" class="btn btn-primary" id="empty-add">+ Create your first profile</button>
      </div>`;
      grid.querySelector("#empty-add")?.addEventListener("click", () => openEditor(null));
      return;
    }
    grid.innerHTML = list.map(profileCard).join("");

    grid.querySelectorAll(".profile-card[data-id]").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-open-link]")) return;
        openEditor(card.dataset.id);
      });
    });

    bindOpenLinkButtons(grid);
    grid.querySelectorAll("[data-open-folder]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        invoke("folder.open", { path: btn.dataset.openFolder });
      });
    });
  }

  function linkRowHtml(link, i) {
    return `<div class="repeat-row link-row" data-link-i="${i}">
      <input type="text" class="field-input link-label" placeholder="Label (e.g. Website)" value="${escapeHtml(link?.label || "")}" />
      <input type="url" class="field-input link-url" placeholder="https://…" value="${escapeHtml(link?.url || "")}" />
      <button type="button" class="btn btn-primary btn-sm row-open" title="Open link">Open ↗</button>
      <button type="button" class="btn btn-ghost btn-sm row-rm" title="Remove">✕</button>
    </div>`;
  }

  function fieldRowHtml(field, i) {
    return `<div class="repeat-row" data-field-i="${i}">
      <input type="text" class="field-input field-key" placeholder="Field name" value="${escapeHtml(field?.key || "")}" />
      <input type="text" class="field-input field-val" placeholder="Value" value="${escapeHtml(field?.value || "")}" />
      <button type="button" class="btn btn-ghost btn-sm row-copy" title="Copy">⎘</button>
      <button type="button" class="btn btn-ghost btn-sm row-rm" title="Remove">✕</button>
    </div>`;
  }

  function openEditor(id) {
    selectedId = id;
    const existing = id ? data.profiles.find((p) => p.id === id) : null;
    draft = existing
      ? structuredClone(existing)
      : {
          id: uid("prof"),
          name: "",
          categoryId: filterCategory !== "all" && filterCategory !== "favorites" ? filterCategory : "general",
          icon: "◆",
          color: "",
          description: "",
          links: [],
          fields: [],
          tags: [],
          notes: "",
          favorite: false,
          localPath: "",
          relatedProfileIds: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

    detailTitle.textContent = existing ? draft.name || "Profile" : "New profile";
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
    const catOptions = data.categories
      .map((c) => `<option value="${escapeHtml(c.id)}" ${draft.categoryId === c.id ? "selected" : ""}>${escapeHtml(c.icon)} ${escapeHtml(c.name)}</option>`)
      .join("");
    const iconOptions = ICON_PICKS.map(
      (ic) => `<button type="button" class="icon-pick ${draft.icon === ic ? "active" : ""}" data-icon="${escapeHtml(ic)}">${ic}</button>`
    ).join("");

    const relatedOptions = data.profiles
      .filter((p) => p.id !== draft.id)
      .map(
        (p) =>
          `<option value="${escapeHtml(p.id)}" ${(draft.relatedProfileIds || []).includes(p.id) ? "selected" : ""}>${escapeHtml(p.name)}</option>`
      )
      .join("");

    detailBody.innerHTML = `
      <form class="profile-form" id="profile-form">
        <div class="icon-picker">${iconOptions}</div>
        <label><span>Name</span><input type="text" id="ed-name" required value="${escapeHtml(draft.name)}" placeholder="e.g. GitHub, Bank account, Client X" /></label>
        <label><span>Category</span><select id="ed-category">${catOptions}</select></label>
        <label><span>Short description</span><input type="text" id="ed-desc" value="${escapeHtml(draft.description)}" placeholder="One line summary" /></label>
        <label><span>Local folder path</span><div class="path-row"><input type="text" id="ed-local-path" value="${escapeHtml(draft.localPath || "")}" placeholder="C:\\Projects\\my-app" /><button type="button" class="btn btn-ghost btn-sm" id="ed-open-folder">Open</button></div></label>
        <label><span>Related profiles</span><select id="ed-related" multiple size="4">${relatedOptions || '<option disabled>No other profiles</option>'}</select></label>
        <label><span>Accent color</span><input type="color" id="ed-color" value="${draft.color || categoryById(draft.categoryId).color}" /></label>
        <label class="check-row"><input type="checkbox" id="ed-fav" ${draft.favorite ? "checked" : ""} /> Favorite</label>

        <div class="form-section form-section--links">
          <div class="form-section-head">
            <strong>Links</strong>
            <button type="button" class="btn btn-ghost btn-sm" id="ed-add-link">+ Add link</button>
          </div>
          <div id="ed-links">${(draft.links.length ? draft.links : [{ label: "", url: "" }]).map(linkRowHtml).join("")}</div>
          <div class="link-launch-bar" id="link-launch-bar"></div>
        </div>

        <div class="form-section">
          <div class="form-section-head">
            <strong>Custom fields</strong>
            <button type="button" class="btn btn-ghost btn-sm" id="ed-add-field">+ Add field</button>
          </div>
          <p class="form-hint">Username, password, API key, phone, folder path — anything you want stored.</p>
          <div id="ed-fields">${draft.fields.length ? draft.fields.map(fieldRowHtml).join("") : ""}</div>
        </div>

        <label><span>Tags</span><input type="text" id="ed-tags" value="${escapeHtml((draft.tags || []).join(", "))}" placeholder="work, personal, dev (comma separated)" /></label>
        <label><span>Notes</span><textarea id="ed-notes" rows="4" placeholder="Free text…">${escapeHtml(draft.notes)}</textarea></label>

        ${selectedId && data.profiles.find((p) => p.id === selectedId) ? `<p class="muted meta-line">Updated ${formatTime(draft.updatedAt)}</p>` : ""}

        <div class="detail-actions">
          <button type="submit" class="btn btn-primary">Save</button>
          ${selectedId && data.profiles.find((p) => p.id === selectedId) ? `<button type="button" class="btn btn-danger" id="ed-delete">Delete</button>` : ""}
          <button type="button" class="btn" id="ed-duplicate">Duplicate</button>
        </div>
      </form>`;

    detailBody.querySelector("#ed-open-folder")?.addEventListener("click", () => {
      const p = detailBody.querySelector("#ed-local-path")?.value.trim();
      if (p) invoke("folder.open", { path: p });
    });

    detailBody.querySelectorAll(".icon-pick").forEach((btn) => {
      btn.addEventListener("click", () => {
        draft.icon = btn.dataset.icon;
        renderEditor();
      });
    });

    detailBody.querySelector("#ed-add-link")?.addEventListener("click", () => {
      draft.links.push({ id: uid("lnk"), label: "", url: "" });
      renderEditor();
    });

    detailBody.querySelector("#ed-add-field")?.addEventListener("click", () => {
      draft.fields.push({ id: uid("fld"), key: "", value: "" });
      renderEditor();
    });

    detailBody.querySelectorAll("#ed-links .row-rm").forEach((btn, i) => {
      btn.addEventListener("click", () => {
        draft.links.splice(i, 1);
        renderEditor();
      });
    });

    detailBody.querySelectorAll("#ed-links .row-open").forEach((btn, i) => {
      btn.addEventListener("click", () => {
        const url = detailBody.querySelectorAll("#ed-links .link-url")[i]?.value;
        if (url) invoke("links.open", { url });
      });
    });

    detailBody.querySelectorAll("#ed-links .link-label, #ed-links .link-url").forEach((input) => {
      input.addEventListener("input", renderLinkLaunchBar);
    });

    renderLinkLaunchBar();

    detailBody.querySelectorAll("#ed-fields .row-rm").forEach((btn, i) => {
      btn.addEventListener("click", () => {
        draft.fields.splice(i, 1);
        renderEditor();
      });
    });

    detailBody.querySelectorAll("#ed-fields .row-copy").forEach((btn, i) => {
      btn.addEventListener("click", async () => {
        const val = detailBody.querySelectorAll("#ed-fields .field-val")[i]?.value;
        await invoke("clipboard.copy", { text: val || "" });
        btn.textContent = "✓";
        setTimeout(() => {
          btn.textContent = "⎘";
        }, 1200);
      });
    });

    detailBody.querySelector("#ed-duplicate")?.addEventListener("click", async () => {
      await saveFromForm();
      const copy = structuredClone(draft);
      copy.id = uid("prof");
      copy.name = `${copy.name} (copy)`;
      copy.createdAt = new Date().toISOString();
      data.profiles.unshift(copy);
      await window.ProfilesStorage.save(data);
      openEditor(copy.id);
      render();
    });

    detailBody.querySelector("#ed-delete")?.addEventListener("click", async () => {
      if (!confirm("Delete this profile?")) return;
      data.profiles = data.profiles.filter((p) => p.id !== draft.id);
      await window.ProfilesStorage.save(data);
      closeEditor();
      render();
    });

    detailBody.querySelector("#profile-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await saveFromForm();
      closeEditor();
      render();
    });
  }

  async function saveFromForm() {
    if (!draft) return;
    draft.name = detailBody.querySelector("#ed-name")?.value.trim() || "Untitled";
    draft.categoryId = detailBody.querySelector("#ed-category")?.value || "general";
    draft.description = detailBody.querySelector("#ed-desc")?.value.trim() || "";
    draft.color = detailBody.querySelector("#ed-color")?.value || "";
    draft.favorite = detailBody.querySelector("#ed-fav")?.checked || false;
    draft.localPath = detailBody.querySelector("#ed-local-path")?.value.trim() || "";
    draft.relatedProfileIds = [...(detailBody.querySelector("#ed-related")?.selectedOptions || [])].map((o) => o.value);
    draft.notes = detailBody.querySelector("#ed-notes")?.value || "";
    draft.tags = (detailBody.querySelector("#ed-tags")?.value || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    draft.links = [];
    detailBody.querySelectorAll("#ed-links .repeat-row").forEach((row) => {
      const label = row.querySelector(".link-label")?.value.trim();
      const url = row.querySelector(".link-url")?.value.trim();
      if (url) draft.links.push({ id: uid("lnk"), label: label || "Link", url });
    });

    draft.fields = [];
    detailBody.querySelectorAll("#ed-fields .repeat-row").forEach((row) => {
      const key = row.querySelector(".field-key")?.value.trim();
      const value = row.querySelector(".field-val")?.value || "";
      if (key) draft.fields.push({ id: uid("fld"), key, value });
    });

    draft.updatedAt = new Date().toISOString();
    const idx = data.profiles.findIndex((p) => p.id === draft.id);
    if (idx >= 0) data.profiles[idx] = draft;
    else data.profiles.unshift(draft);
    await window.ProfilesStorage.save(data);
    detailTitle.textContent = draft.name;
  }

  function render() {
    renderStats();
    renderCategoryNav();
    renderGrid();
  }

  async function scan() {
    data = await window.ProfilesStorage.load();
    render();
  }

  function bind(ui) {
    searchInput?.addEventListener("input", () => renderGrid());
    detailClose?.addEventListener("click", closeEditor);
    ui.btnAdd?.addEventListener("click", () => openEditor(null));
    ui.btnExport?.addEventListener("click", async () => {
      const res = await invoke("data.export");
      await invoke("clipboard.copy", { text: res.json });
      alert("All profiles copied to clipboard as JSON. Paste into a file to backup.");
    });
    ui.btnImport?.addEventListener("click", async () => {
      const json = prompt("Paste exported JSON:");
      if (!json) return;
      try {
        await invoke("data.import", { json });
        await scan();
        alert("Import complete.");
      } catch (err) {
        alert(err.message);
      }
    });
  }

  return { id: "browse", page, scan, bind, openEditor, render };
})();