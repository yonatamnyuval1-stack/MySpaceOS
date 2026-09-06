window.BuildsPages = window.BuildsPages || {};

window.BuildsPages.browse = (function () {
  const {
    escapeHtml,
    invoke,
    uid,
    formatDate,
    formatCount,
    fileIcon,
    fileKind,
    fileKindMeta,
    attachmentKind,
    kindIconHtml,
    parseCsvPreview,
    ICON_PICKS,
    buildRunScript,
    countSubCategoryFiles,
    topLevelSubCategoryItems,
    projectIconHtml,
    hydrateProjectIcons,
    applyCachedIconsInDom,
    mslIconsEnabled,
  } = window.Builds;

  const page = document.getElementById("page-browse");
  const projectView = document.getElementById("project-view");
  const grid = document.getElementById("projects-grid");
  const statsEl = document.getElementById("builds-stats");
  const searchInput = document.getElementById("builds-search");
  const topbar = document.getElementById("topbar");
  const detailPanel = document.getElementById("detail-panel");
  const detailBody = document.getElementById("detail-body");
  const detailTitle = document.getElementById("detail-title");
  const detailClose = document.getElementById("detail-close");
  const shell = document.getElementById("app-shell");

  let data = { projects: [] };
  let filterFavorites = false;
  let activeProjectId = null;
  let draft = null;
  let expandedPaths = new Set();
  let previewPath = null;
  let activeAttachmentId = null;
  let pendingAttachments = [];
  let projectScreen = "files";
  let fileViewPath = null;
  let fileViewCopyText = "";
  let browseTreeOverride = null;
  let activeSubCategoryId = "all";
  let subCategoryAssignMode = false;
  let selectedTreePath = null;
  let selectedTreeType = null;
  let selectedTreeName = null;

  function projectRoot() {
    return draft?.rootPath || draft?.fileTree?.root || "";
  }

  function toRelativePath(absPath) {
    const root = projectRoot().replace(/[/\\]+$/, "");
    if (!root || !absPath) return "";
    const abs = String(absPath).replace(/\\/g, "/");
    const rootNorm = root.replace(/\\/g, "/");
    if (abs.toLowerCase().startsWith(rootNorm.toLowerCase())) {
      return abs.slice(rootNorm.length).replace(/^[/\\]/, "");
    }
    return abs;
  }

  function resolveFullPath(rootPath, relPath) {
    const rel = String(relPath || "")
      .trim()
      .replace(/\\/g, "/")
      .replace(/^\.\//, "");
    if (!rel) return "";
    const root = String(rootPath || "").replace(/[/\\]+$/, "");
    const useBackslash = root.includes("\\");
    return root + (useBackslash ? "\\" : "/") + rel.split("/").join(useBackslash ? "\\" : "/");
  }

  function findNodeByPath(nodes, targetPath) {
    const norm = String(targetPath || "").toLowerCase();
    for (const n of nodes || []) {
      if (String(n.path || "").toLowerCase() === norm) return n;
      if (n.type === "dir" && n.children?.length) {
        const found = findNodeByPath(n.children, targetPath);
        if (found) return found;
      }
    }
    return null;
  }

  function ensureSubCategoryItems() {
    for (const sub of draft?.subCategories || []) {
      if (!Array.isArray(sub.items)) sub.items = [];
    }
  }

  function ensureAttachments() {
    if (!draft) return;
    if (!Array.isArray(draft.attachments)) draft.attachments = [];
  }

  function attachmentById(id) {
    return (draft?.attachments || []).find((a) => a.id === id) || null;
  }

  function activeFileTree() {
    return browseTreeOverride || draft?.fileTree || null;
  }

  function showProjectScreen(screen) {
    projectScreen = screen;
    const screens = { files: "proj-screen-files", file: "proj-screen-file", code: "proj-screen-code" };
    for (const [key, id] of Object.entries(screens)) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.classList.toggle("hidden", key !== screen);
    }
  }

  function renderMarkdownBasic(text) {
    return escapeHtml(text)
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/^## (.+)$/gm, "<h2>$1</h2>")
      .replace(/^# (.+)$/gm, "<h1>$1</h1>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\n\n/g, "</p><p>")
      .replace(/^/, "<p>")
      .replace(/$/, "</p>");
  }

  function renderPreviewViewport(kind, res, fileName) {
    const ext = String(fileName || "").split(".").pop()?.toLowerCase() || "";
    if (res.image && res.dataUrl) {
      return `<div class="preview-image-wrap"><img src="${res.dataUrl}" alt="${escapeHtml(fileName)}" /></div>`;
    }
    if (typeof res.content === "string" && !res.binary) {
      const note = res.truncated
        ? `<p class="preview-trunc-note muted">Preview — showing start of ${escapeHtml(res.sizeLabel || "file")}</p>`
        : "";
      if (kind === "sheet" && (ext === "csv" || ext === "tsv")) {
        const content = ext === "tsv" ? String(res.content || "").replace(/\t/g, ",") : res.content;
        const { headers, rows } = parseCsvPreview(content);
        if (!headers.length) {
          return `<div class="preview-sheet-card"><div class="preview-sheet-icon">▦</div><p class="muted">Empty spreadsheet</p></div>`;
        }
        const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
        const body = rows
          .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
          .join("");
        return `${note}<div class="preview-sheet-wrap"><table class="preview-sheet-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
      }
      if (kind === "text" && (ext === "md" || ext === "markdown")) {
        return `${note}<div class="preview-body--md">${renderMarkdownBasic(res.content || "")}</div>`;
      }
      if (kind === "text") {
        return `${note}<pre class="preview-body--text">${escapeHtml(res.content || "")}</pre>`;
      }
      return `${note}<pre class="preview-body--code">${escapeHtml(res.content || "")}</pre>`;
    }
    if (res.binary || res.truncated) {
      const reason = res.binary ? "Binary file" : `File too large (${res.sizeLabel})`;
      return `<div class="preview-external-card">
        <div class="preview-external-icon">${fileKindMeta(fileName).iconHtml}</div>
        <h4>${escapeHtml(fileName)}</h4>
        <p class="muted">${escapeHtml(reason)} — open with your default app.</p>
        <button type="button" class="btn btn-primary btn-sm" data-open-external>Open file</button>
      </div>`;
    }
    if (kind === "sheet") {
      return `<div class="preview-sheet-card">
        <div class="preview-sheet-icon">▦</div>
        <h4>${escapeHtml(fileName)}</h4>
        <p>Spreadsheet file (${escapeHtml(ext.toUpperCase())}) — ${escapeHtml(res.sizeLabel || "")}. Open in Excel or Google Sheets to edit.</p>
        <button type="button" class="btn btn-primary btn-sm" data-open-external>Open in default app</button>
      </div>`;
    }
    if (kind === "pdf" || kind === "document" || kind === "other") {
      return `<div class="preview-external-card">
        <div class="preview-external-icon">${fileKindMeta(fileName).iconHtml}</div>
        <h4>${escapeHtml(fileName)}</h4>
        <p class="muted">${escapeHtml(fileKindMeta(fileName).label)} · ${escapeHtml(res.sizeLabel || "")}</p>
        <button type="button" class="btn btn-primary btn-sm" data-open-external>Open file</button>
      </div>`;
    }
    return `<pre class="preview-body--code"></pre>`;
  }

  function bindPreviewViewportActions(container, filePath) {
    container?.querySelector("[data-open-external]")?.addEventListener("click", () => {
      invoke("file.open", { path: filePath });
    });
  }

  async function openFileView(filePath, fileName) {
    fileViewPath = filePath;
    activeAttachmentId = null;
    showProjectScreen("file");

    const nameEl = document.getElementById("file-view-name");
    const badge = document.getElementById("file-view-badge");
    const sizeEl = document.getElementById("file-view-size");
    const body = document.getElementById("file-view-body");

    nameEl.textContent = "Loading…";
    sizeEl.textContent = "";
    body.innerHTML = "";

    const displayName = fileName || filePath.split(/[/\\]/).pop() || filePath;
    const meta = fileKindMeta(displayName);
    badge.textContent = meta.label.toUpperCase();
    badge.className = `preview-kind-badge preview-kind-badge--${meta.kind}`;

    try {
      const res = await invoke("file.read", { path: filePath });
      nameEl.textContent = res.name || displayName;
      sizeEl.textContent = res.sizeLabel || "";
      let kind = meta.kind;
      if (res.content != null && !res.binary && kind !== "sheet" && kind !== "image" && kind !== "pdf" && kind !== "document") {
        kind = "code";
        badge.textContent = "CODE";
        badge.className = "preview-kind-badge preview-kind-badge--code";
      }
      body.innerHTML = renderPreviewViewport(kind, res, res.name || displayName);
      bindPreviewViewportActions(body, filePath);
      fileViewCopyText = res.content || "";
    } catch (err) {
      nameEl.textContent = "Error";
      body.innerHTML = `<pre class="preview-body--text">${escapeHtml(err.message)}</pre>`;
      fileViewCopyText = "";
    }
  }

  async function openAttachmentView(attId) {
    const att = attachmentById(attId);
    if (!att) return;
    if (att.type === "folder") {
      activeAttachmentId = attId;
      projectScreen = "code";
      showProjectScreen("code");
      const empty = document.getElementById("folder-empty");
      const loaded = document.getElementById("code-loaded");
      const scanning = document.getElementById("scanning");
      empty?.classList.add("hidden");
      loaded?.classList.add("hidden");
      scanning?.classList.remove("hidden");
      try {
        const scan = await invoke("tree.scan", { path: att.path });
        browseTreeOverride = scan.fileTree;
        renderProjectWorkspace();
      } catch (err) {
        alert(err.message);
        browseTreeOverride = null;
        showProjectScreen("files");
      }
      return;
    }
    activeAttachmentId = attId;
    await openFileView(att.path, att.name);
  }

  function filePairCardHtml(att) {
    const meta = fileKindMeta(att);
    const label = att?.type === "folder" ? "Code folder" : meta.label;
    const kind = att?.type === "folder" ? "code" : meta.kind;
    const iconHtml = att?.type === "folder" ? kindIconHtml("code") : meta.iconHtml;
    const color = att?.type === "folder" ? "#2563eb" : meta.color;
    const gradient =
      att?.type === "folder"
        ? "linear-gradient(145deg, #1e3a8a 0%, #0f172a 100%)"
        : meta.gradient;
    const desc = att.description?.trim();
    const removeBtn = att.id
      ? `<button type="button" class="file-pair-remove" data-att-remove="${escapeHtml(att.id)}" title="Remove" aria-label="Remove">✕</button>`
      : "";
    return `<article class="file-pair-card" data-att-id="${escapeHtml(att.id || "")}" style="--att-accent:${color};--att-gradient:${gradient}">
      <div class="file-pair-tile">
        <div class="file-pair-icon">${iconHtml}</div>
        <div class="file-pair-name" title="${escapeHtml(att.name)}">${escapeHtml(att.name)}</div>
        <div class="file-pair-label">${escapeHtml(label)}</div>
      </div>
      <div class="file-pair-desc-box">
        <p class="file-pair-desc ${desc ? "" : "muted"}">${desc ? escapeHtml(desc) : "No description yet"}</p>
      </div>
      ${removeBtn}
    </article>`;
  }

  function codeFolderRowHtml() {
    const hasTree = draft?.fileTree?.children?.length > 0;
    if (!hasTree && !draft?.rootPath) return "";
    const files = draft.fileTree?.fileCount || 0;
    const dirs = draft.fileTree?.dirCount || 0;
    const chars = draft.fileTree?.characterCount || 0;
    const folderName = (draft.rootPath || draft.fileTree?.root || "").split(/[/\\]/).pop() || "Code";
    const desc = hasTree
      ? `Source code tree — ${formatCount(files)} files, ${formatCount(dirs)} folders, ${
          chars > 0 ? formatCount(chars) + " characters" : "characters counting…"
        }. Click to browse.`
      : "Linked folder — click to connect or browse source files.";
    const meta = fileKindMeta({ type: "file", name: "main.go" });
    return `<article class="file-pair-card" data-open-code style="--att-accent:${meta.color};--att-gradient:${meta.gradient}">
      <div class="file-pair-tile">
        <div class="file-pair-icon">${meta.iconHtml}</div>
        <div class="file-pair-name">${escapeHtml(folderName)}</div>
        <div class="file-pair-label">Code folder</div>
      </div>
      <div class="file-pair-desc-box">
        <p class="file-pair-desc">${escapeHtml(desc)}</p>
      </div>
    </article>`;
  }

  function renderFilesList() {
    ensureAttachments();
    const listEl = document.getElementById("files-list");
    const emptyEl = document.getElementById("files-empty");
    if (!listEl || !emptyEl) return;
    const list = draft?.attachments || [];
    const codeRow = codeFolderRowHtml();
    const hasContent = list.length > 0 || codeRow;

    if (!hasContent) {
      listEl.innerHTML = "";
      emptyEl.classList.remove("hidden");
      return;
    }

    emptyEl.classList.add("hidden");
    listEl.innerHTML = codeRow + list.map(filePairCardHtml).join("");

    listEl.querySelector("[data-open-code]")?.addEventListener("click", () => {
      browseTreeOverride = null;
      projectScreen = "code";
      showProjectScreen("code");
      renderProjectWorkspace();
    });

    listEl.querySelectorAll(".file-pair-card[data-att-id]").forEach((card) => {
      if (!card.dataset.attId) return;
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-att-remove]")) return;
        openAttachmentView(card.dataset.attId);
      });
    });
    listEl.querySelectorAll("[data-att-remove]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.dataset.attRemove;
        if (!confirm("Remove this file from the project?")) return;
        draft.attachments = (draft.attachments || []).filter((a) => a.id !== id);
        if (activeAttachmentId === id) {
          activeAttachmentId = null;
          showProjectScreen("files");
        }
        await saveDraft();
        renderFilesList();
        renderGrid();
      });
    });
  }

  function closeAttachmentModal() {
    const modal = document.getElementById("attachment-modal");
    modal?.classList.add("hidden");
    modal?.setAttribute("aria-hidden", "true");
    pendingAttachments = [];
  }

  function openAttachmentModal(items) {
    pendingAttachments = items;
    const modal = document.getElementById("attachment-modal");
    const body = document.getElementById("attachment-modal-body");
    if (!modal || !body) return;
    body.innerHTML = items
      .map((item, i) => {
        const name = item.path.split(/[/\\]/).pop() || item.path;
        const meta = fileKindMeta({ type: item.type, name });
        return `<div class="modal-file-row" data-idx="${i}" style="--att-accent:${meta.color};--att-gradient:${meta.gradient}">
          <div class="modal-file-visual file-pair-tile" style="border-radius:12px;aspect-ratio:1">
            <div class="file-pair-icon">${meta.iconHtml}</div>
            <div class="file-pair-name">${escapeHtml(name)}</div>
          </div>
          <div class="modal-file-fields">
            <label>Description <textarea data-desc-idx="${i}" placeholder="What is this? Notes, context, links…"></textarea></label>
          </div>
        </div>`;
      })
      .join("");
    modal.classList.remove("hidden");
    modal.removeAttribute("aria-hidden");
  }

  async function pickAndAddAttachments() {
    if (!draft) return;
    const res = await invoke("file.pick", {
      title: `Add files to "${draft.name || "project"}"`,
      defaultPath: draft.rootPath || "",
    });
    if (!res.paths?.length) return;
    const existing = new Set((draft.attachments || []).map((a) => a.path.toLowerCase()));
    const fresh = res.paths.filter((p) => !existing.has(p.toLowerCase()));
    if (!fresh.length) {
      alert("These files are already in the project.");
      return;
    }
    openAttachmentModal(fresh.map((p) => ({ path: p, type: "file" })));
  }

  async function pickAndAddFolder() {
    if (!draft) return;
    const res = await invoke("folder.pick", {
      title: `Add folder to "${draft.name || "project"}"`,
      defaultPath: draft.rootPath || "",
    });
    if (!res.path) return;
    const exists = (draft.attachments || []).some((a) => a.path.toLowerCase() === res.path.toLowerCase());
    if (exists) {
      alert("This folder is already in the project.");
      return;
    }
    openAttachmentModal([{ path: res.path, type: "folder" }]);
  }

  async function saveAttachmentModal() {
    const body = document.getElementById("attachment-modal-body");
    if (!body || !pendingAttachments.length) return;
    ensureAttachments();
    const foldersAdded = [];
    for (let i = 0; i < pendingAttachments.length; i += 1) {
      const item = pendingAttachments[i];
      const p = item.path;
      const name = p.split(/[/\\]/).pop() || p;
      const desc = body.querySelector(`[data-desc-idx="${i}"]`)?.value.trim() || "";
      const type = item.type === "folder" ? "folder" : "file";
      draft.attachments.push({
        id: uid("att"),
        path: p,
        name,
        type,
        description: desc,
        addedAt: new Date().toISOString(),
      });
      if (type === "folder") foldersAdded.push(p);
    }

    if ((!draft.rootPath || draft.rootMissing) && foldersAdded[0]) {
      draft.rootPath = foldersAdded[0];
      draft.rootMissing = false;
      try {
        const scan = await invoke("tree.scan", { path: foldersAdded[0] });
        if (scan?.ok && scan.fileTree) draft.fileTree = scan.fileTree;
      } catch {
      }
    }

    await saveDraft();
    closeAttachmentModal();
    renderFilesList();
    renderGrid();
    showProjectScreen(foldersAdded.length && draft.fileTree ? "code" : "files");
    if (foldersAdded.length) renderProjectWorkspace();
  }

  async function deleteProject(projectId, projectName) {
    const name = projectName || "this project";
    if (!confirm(`Delete "${name}" and all its saved data?`)) return;
    data.projects = data.projects.filter((p) => p.id !== projectId);
    await window.BuildsStorage.save(data);
    if (activeProjectId === projectId) closeProjectView();
    render();
  }

  function assignNodeToSubCategory(subId, absPath, type, name) {
    const sub = subCategoryById(subId);
    if (!sub) return;
    ensureSubCategoryItems();
    const rel = toRelativePath(absPath);
    if (!rel) {
      alert("Could not resolve file path relative to project folder.");
      return;
    }
    if (itemInSubCategory(sub, rel)) {
      removeTreeNodeFromSubCategory(subId, rel);
    } else {
      addTreeNodeToSubCategory(subId, absPath, type, name);
    }
  }

  async function afterSubCategoryItemsChanged() {
    await saveDraft();
    renderSubCategoryBar();
    renderSubCategoryCommandPanel();
    renderAssignBanner();
    renderTreeOnly();
  }

  function subCategoryById(id) {
    return (draft?.subCategories || []).find((s) => s.id === id) || null;
  }

  function activeSubCategory() {
    if (activeSubCategoryId === "all") return null;
    return subCategoryById(activeSubCategoryId);
  }

  function itemInSubCategory(sub, relPath) {
    const norm = String(relPath || "").replace(/\\/g, "/").toLowerCase();
    return (sub?.items || []).some((item) => String(item.path || "").replace(/\\/g, "/").toLowerCase() === norm);
  }

  function addTreeNodeToSubCategory(subId, absPath, type, name) {
    const sub = subCategoryById(subId);
    if (!sub) return false;
    if (!Array.isArray(sub.items)) sub.items = [];
    const rel = toRelativePath(absPath);
    if (!rel) return false;
    if (itemInSubCategory(sub, rel)) return false;
    sub.items.push({
      path: rel,
      name: name || rel.split("/").pop() || rel,
      type: type === "dir" ? "dir" : "file",
    });
    return true;
  }

  function removeTreeNodeFromSubCategory(subId, relPath) {
    const sub = subCategoryById(subId);
    if (!sub?.items?.length) return;
    const norm = String(relPath || "").replace(/\\/g, "/").toLowerCase();
    sub.items = sub.items.filter((item) => String(item.path || "").replace(/\\/g, "/").toLowerCase() !== norm);
  }

  function treeRootsForView() {
    const tree = activeFileTree();
    if (!tree?.children?.length) return [];
    if (browseTreeOverride) return tree.children;
    if (activeSubCategoryId === "all" || subCategoryAssignMode) {
      return tree.children;
    }
    const sub = activeSubCategory();
    if (!sub?.items?.length) return [];

    const roots = [];
    for (const item of sub.items) {
      const full = resolveFullPath(projectRoot(), item.path);
      const node = findNodeByPath(tree.children, full);
      if (node) {
        roots.push(node);
      } else {
        roots.push({
          name: item.name || item.path.split("/").pop() || item.path,
          path: full,
          type: item.type || "file",
          children: item.type === "dir" ? [] : undefined,
          missing: true,
        });
      }
    }
    return roots;
  }

  function projectById(id) {
    return data.projects.find((p) => p.id === id) || null;
  }

  function filteredProjects() {
    const q = (searchInput?.value || "").trim().toLowerCase();
    return data.projects.filter((p) => {
      if (filterFavorites && !p.favorite) return false;
      if (!q) return true;
      const hay = [
        p.name,
        p.description,
        p.notes,
        p.rootPath,
        ...(p.stack || []),
        ...(p.tags || []),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  function renderStats() {
    const total = data.projects.length;
    const fav = data.projects.filter((p) => p.favorite).length;
    const withTree = data.projects.filter((p) => p.fileTree?.children?.length).length;
    const linked = data.projects.filter((p) => p.rootPath || p.fileTree?.root).length;
    statsEl.innerHTML = `
      <div class="stat-card"><span class="stat-val">${total}</span><span class="stat-label">Projects</span></div>
      <div class="stat-card"><span class="stat-val">${withTree}</span><span class="stat-label">With code</span></div>
      <div class="stat-card"><span class="stat-val">${linked}</span><span class="stat-label">Linked folders</span></div>
      <div class="stat-card"><span class="stat-val">${fav}</span><span class="stat-label">Favorites</span></div>`;
    renderAutoRefreshBar();
  }

  function renderAutoRefreshBar() {
    let bar = document.getElementById("auto-refresh-bar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "auto-refresh-bar";
      bar.className = "auto-refresh-bar";
      statsEl?.insertAdjacentElement("afterend", bar);
    }
    const s = data.settings || {};
    const enabled = s.autoRefreshEnabled !== false;
    const mins = s.autoRefreshMinutes || 3;
    const last = s.lastAutoRefreshAt ? formatDate(s.lastAutoRefreshAt) : "not yet";
    bar.innerHTML = `
      <div class="auto-refresh-main">
        <label class="auto-refresh-toggle">
          <input type="checkbox" id="auto-refresh-enabled" ${enabled ? "checked" : ""} />
          Auto-refresh linked folders
        </label>
        <label class="auto-refresh-interval">
          every
          <select id="auto-refresh-mins" class="select-sm">
            ${[1, 2, 3, 5, 10, 15, 30].map((m) => `<option value="${m}" ${mins === m ? "selected" : ""}>${m}m</option>`).join("")}
          </select>
        </label>
        <button type="button" class="btn btn-ghost btn-sm" id="auto-refresh-now">↻ Refresh all now</button>
      </div>
      <p class="auto-refresh-meta muted">Last sync: ${escapeHtml(last)} · projects with a linked folder stay up to date while you work</p>`;

    bar.querySelector("#auto-refresh-enabled")?.addEventListener("change", saveAutoRefreshSettings);
    bar.querySelector("#auto-refresh-mins")?.addEventListener("change", saveAutoRefreshSettings);
    bar.querySelector("#auto-refresh-now")?.addEventListener("click", refreshAllTreesNow);
  }

  async function syncPanelSettings() {
    if (!window.AppSettings) return;
    try {
      const panel = await window.AppSettings.load();
      data.settings = data.settings || {};
      let changed = false;
      if (panel.autoRefreshEnabled !== undefined && data.settings.autoRefreshEnabled !== panel.autoRefreshEnabled) {
        data.settings.autoRefreshEnabled = panel.autoRefreshEnabled;
        changed = true;
      }
      if (panel.autoRefreshMinutes !== undefined && data.settings.autoRefreshMinutes !== panel.autoRefreshMinutes) {
        data.settings.autoRefreshMinutes = panel.autoRefreshMinutes;
        changed = true;
      }
      if (changed) await window.BuildsStorage.save(data);
    } catch (_) {
    }
  }

  async function saveAutoRefreshSettings() {
    if (!data.settings) data.settings = {};
    data.settings.autoRefreshEnabled =
      document.getElementById("auto-refresh-enabled")?.checked !== false;
    data.settings.autoRefreshMinutes = parseInt(
      document.getElementById("auto-refresh-mins")?.value,
      10
    ) || 3;
    await window.BuildsStorage.save(data);
    if (window.AppSettings) {
      try {
        await window.AppSettings.set("autoRefreshEnabled", data.settings.autoRefreshEnabled);
        await window.AppSettings.set("autoRefreshMinutes", data.settings.autoRefreshMinutes);
      } catch (_) {
      }
    }
    renderAutoRefreshBar();
  }

  async function refreshAllTreesNow() {
    const btn = document.getElementById("auto-refresh-now");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Refreshing…";
    }
    try {
      const res = await invoke("trees.refreshAll", { force: true });
      await applyTreeUpdate(res);
    } catch (err) {
      alert(err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "↻ Refresh all now";
      }
    }
  }

  async function applyTreeUpdate(payload) {
    const prevPreview = previewPath;
    data = await window.BuildsStorage.load();
    if (payload?.settings) data.settings = { ...data.settings, ...payload.settings };
    if (activeProjectId) {
      const p = projectById(activeProjectId);
      if (p) {
        draft = structuredClone(p);
        ensureSubCategoryItems();
        renderProjectWorkspace();
        if (prevPreview) await previewFile(prevPreview);
      } else {
        closeProjectView();
      }
    }
    render();
  }

  function projectCard(p) {
    const accent = p.color || "#5b9cff";
    const treeCount = p.fileTree?.fileCount || 0;
    const dirCount = p.fileTree?.dirCount || 0;
    const charCount = p.fileTree?.characterCount || 0;
    const root = p.rootPath || p.fileTree?.root || "";
    const attCount = (p.attachments || []).length;
    const subCats = (p.subCategories || [])
      .slice(0, 4)
      .map((s) => `${s.icon} ${s.name}`)
      .join(" · ");
    const statsLabel = p.rootMissing
      ? `<span class="muted" title="${escapeHtml(root)}">⚠ Folder missing — re-link to recount</span>`
      : !root
      ? `<span class="muted">No code folder</span>`
      : treeCount
        ? `<span title="${escapeHtml(root)}">🌲 ${formatCount(treeCount)} files · ${formatCount(dirCount)} folders · ${
            charCount > 0 ? formatCount(charCount) + " chars" : "chars…"
          }</span>`
        : `<span class="muted" title="${escapeHtml(root)}">Folder linked — counting…</span>`;
    return `<article class="project-card ${activeProjectId === p.id ? "selected" : ""}" data-id="${escapeHtml(p.id)}" style="--card-accent:${accent}">
      <button type="button" class="project-card-delete" data-delete-id="${escapeHtml(p.id)}" title="Delete project" aria-label="Delete project">✕</button>
      <div class="project-card-head">
        <span class="project-icon">${projectIconHtml(p)}</span>
        <div class="project-card-titles">
          <h3>${escapeHtml(p.name)}</h3>
        </div>
        ${p.favorite ? '<span class="project-fav">★</span>' : ""}
      </div>
      ${p.description ? `<p class="project-desc">${escapeHtml(p.description)}</p>` : ""}
      ${subCats ? `<p class="project-subcats-preview">${escapeHtml(subCats)}</p>` : ""}
      <div class="project-meta">
        ${p.builtAt ? `<span>📅 ${escapeHtml(formatDate(p.builtAt))}</span>` : ""}
        ${attCount ? `<span>📎 ${attCount} file${attCount === 1 ? "" : "s"}</span>` : ""}
        ${statsLabel}
      </div>
    </article>`;
  }

  function renderGrid() {
    const list = filteredProjects();
    if (!list.length) {
      grid.innerHTML = `<div class="empty-state">
        <p>No projects yet.</p>
        <button type="button" class="btn btn-primary" id="empty-add">+ New project</button>
      </div>`;
      grid.querySelector("#empty-add")?.addEventListener("click", () => createProject());
      return;
    }
    grid.innerHTML = list.map(projectCard).join("");
    grid.querySelectorAll(".project-card[data-id]").forEach((card) => {
      card.addEventListener("click", () => openProject(card.dataset.id));
    });
    grid.querySelectorAll(".project-card-delete").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.dataset.deleteId;
        const p = projectById(id);
        await deleteProject(id, p?.name);
      });
    });
    hydrateProjectIcons(list).then(() => applyCachedIconsInDom(grid));
  }

  function showListView() {
    page?.classList.remove("hidden");
    page?.removeAttribute("aria-hidden");
    if (page) page.hidden = false;
    projectView?.classList.add("hidden");
    projectView?.setAttribute("aria-hidden", "true");
    topbar?.classList.remove("hidden");
    shell.classList.remove("project-open");
  }

  function showProjectView() {
    page?.classList.add("hidden");
    page?.setAttribute("aria-hidden", "true");
    if (page) page.hidden = true;
    projectView?.classList.remove("hidden");
    projectView?.removeAttribute("aria-hidden");
    topbar?.classList.add("hidden");
    shell.classList.add("project-open");
  }

  function isProjectViewOpen() {
    return Boolean(activeProjectId);
  }

  function expandDefaults(tree) {
    expandedPaths.clear();
    if (!tree?.children) return;
    const sub = activeSubCategory();
    if (sub?.items?.length && !subCategoryAssignMode) {
      for (const item of sub.items) {
        const full = resolveFullPath(projectRoot(), item.path);
        if (full) expandedPaths.add(full);
      }
      return;
    }
    function walk(nodes, depth) {
      for (const n of nodes) {
        if (n.type === "dir" && n.path) {
          expandedPaths.add(n.path);
          if (depth < 2 && n.children?.length) walk(n.children, depth + 1);
        }
      }
    }
    if (tree.root) expandedPaths.add(tree.root);
    walk(tree.children, 0);
  }

  function runScriptForSub(sub) {
    return buildRunScript(sub, projectRoot(), resolveFullPath);
  }

  async function copySubCategoryRun(sub) {
    const text = runScriptForSub(sub);
    if (!text) return;
    await invoke("clipboard.copy", { text });
    const btn = document.getElementById("subcat-copy-run");
    if (btn) {
      const prev = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => {
        btn.textContent = prev;
      }, 1500);
    }
  }

  function handleSubCategorySelect(id) {
    if (id === "all") {
      activeSubCategoryId = "all";
      subCategoryAssignMode = false;
    } else {
      activeSubCategoryId = id;
      subCategoryAssignMode = false;
    }
    expandDefaults(draft.fileTree);
    renderSubCategoryBar();
    renderSubCategoryCommandPanel();
    renderAssignBanner();
    renderTreeOnly();
  }

  function startSubCategoryAssign() {
    if (activeSubCategoryId === "all") return;
    subCategoryAssignMode = true;
    renderSubCategoryBar();
    renderAssignBanner();
    renderTreeOnly();
  }

  function renderSubCategoryCommandPanel() {
    const panel = document.getElementById("subcat-command-panel");
    if (!panel) return;
    const sub = activeSubCategory();
    if (!sub) {
      panel.classList.add("hidden");
      panel.innerHTML = "";
      return;
    }
    const script = runScriptForSub(sub);
    const cwdLabel = sub.runCwd ? sub.runCwd : "(project root)";
    panel.classList.remove("hidden");
    panel.innerHTML = script
      ? `<div class="subcat-run-block">
          <div class="subcat-run-head">
            <span>${escapeHtml(sub.icon || "📂")} <strong>${escapeHtml(sub.name)}</strong></span>
            <button type="button" class="btn btn-primary btn-sm" id="subcat-copy-run">Copy for terminal</button>
          </div>
          <p class="subcat-run-hint muted">Paste in VS Code terminal — launches <strong>only this app</strong> (not the whole desktop)</p>
          <pre class="subcat-run-script">${escapeHtml(script)}</pre>
        </div>`
      : `<div class="subcat-run-block subcat-run-block--empty">
          <span>${escapeHtml(sub.icon || "📂")} <strong>${escapeHtml(sub.name)}</strong></span>
          <p class="muted">No run command yet — add one in Sub-categories editor.</p>
        </div>`;
    panel.querySelector("#subcat-copy-run")?.addEventListener("click", () => copySubCategoryRun(sub));
  }

  function renderAssignBanner() {
    const banner = document.getElementById("subcat-assign-banner");
    if (!banner) return;
    const sub = subCategoryAssignMode ? activeSubCategory() : null;
    if (!sub) {
      banner.classList.add("hidden");
      banner.innerHTML = "";
      return;
    }
    banner.classList.remove("hidden");
    banner.innerHTML = `
      <span class="subcat-assign-text">${escapeHtml(sub.icon || "📂")} <strong>Adding to ${escapeHtml(sub.name)}</strong> — click any file or folder in the tree. Click again to remove.</span>
      <button type="button" class="btn btn-primary btn-sm" id="subcat-assign-done">Done</button>`;
    banner.querySelector("#subcat-assign-done")?.addEventListener("click", () => {
      subCategoryAssignMode = false;
      renderSubCategoryBar();
      renderSubCategoryCommandPanel();
      renderAssignBanner();
      renderTreeOnly();
    });
  }

  function isNodeInActiveSubCategory(absPath) {
    const sub = subCategoryAssignMode ? activeSubCategory() : null;
    if (!sub) return false;
    return itemInSubCategory(sub, toRelativePath(absPath));
  }
  function treeNodeHtml(node, depth = 0) {
    const isDir = node.type === "dir";
    const hasChildren = isDir && node.children?.length;
    const expanded = expandedPaths.has(node.path);
    const icon = isDir ? (expanded ? "📂" : "📁") : fileIcon(node.name);
    const active = previewPath === node.path ? " tree-row--active" : "";
    const assigned = isNodeInActiveSubCategory(node.path) ? " tree-row--assigned" : "";
    const assignedMark = isNodeInActiveSubCategory(node.path) ? `<span class="tree-assigned">✓</span>` : "";
    const countLabel =
      isDir && (node.fileCount != null || node.dirCount != null)
        ? `<span class="tree-counts">${formatCount(node.fileCount || 0)}f · ${formatCount(node.dirCount || 0)}d${
            node.characterCount != null ? ` · ${formatCount(node.characterCount)}c` : ""
          }</span>`
        : "";

    let html = `<div class="tree-node" data-path="${escapeHtml(node.path)}" data-type="${node.type}">
      <div class="tree-row${active}${assigned}" style="padding-left:${depth * 16}px">
        ${hasChildren ? `<button type="button" class="tree-toggle" data-path="${escapeHtml(node.path)}">${expanded ? "▾" : "▸"}</button>` : `<span class="tree-spacer"></span>`}
        <span class="tree-icon">${icon}</span>
        <span class="tree-name">${escapeHtml(node.name)}</span>
        ${assignedMark}
        ${countLabel}
      </div>`;
    if (hasChildren && expanded) {
      html += `<div class="tree-children">${node.children.map((c) => treeNodeHtml(c, depth + 1)).join("")}</div>`;
    }
    html += `</div>`;
    return html;
  }

  function renderTreeOnly() {
    const panel = document.getElementById("file-tree-panel");
    const roots = treeRootsForView();
    const sub = activeSubCategory();
    if (!panel) return;
    if (!roots.length) {
      if (sub) {
        const itemNote =
          (sub.items || []).length > 0
            ? `<p class="muted">Assigned paths are missing from the current tree — try <strong>Refresh tree</strong>.</p>`
            : `<p class="muted">No files linked — this sub-category can be command-only, or use <strong>Assign files</strong>.</p>`;
        panel.innerHTML = `<div class="tree-empty-subcat">
            <p><strong>${escapeHtml(sub.icon || "📂")} ${escapeHtml(sub.name)}</strong></p>
            ${itemNote}
            <button type="button" class="btn btn-ghost btn-sm" id="subcat-start-add">Assign files from tree</button>
          </div>`;
      } else {
        panel.innerHTML = "";
      }
      panel.querySelector("#subcat-start-add")?.addEventListener("click", startSubCategoryAssign);
      return;
    }
    panel.innerHTML = roots.map((n) => treeNodeHtml(n, 0)).join("");
    bindTreeClicks(panel);
  }

  function renderSubCategoryBar() {
    const bar = document.getElementById("subcat-bar");
    const hint = document.getElementById("subcat-hint");
    if (!bar) return;
    if (browseTreeOverride) {
      bar.classList.add("hidden");
      bar.innerHTML = "";
      hint?.classList.add("hidden");
      return;
    }
    const subs = draft?.subCategories || [];
    const hasTree = draft?.fileTree?.children?.length > 0;
    hint?.classList.toggle("hidden", !subs.length);
    if (!subs.length) {
      bar.classList.add("hidden");
      bar.innerHTML = "";
      return;
    }
    bar.classList.remove("hidden");
    const showAssign =
      activeSubCategoryId !== "all" && hasTree
        ? `<button type="button" class="btn btn-ghost btn-sm subcat-assign-btn" id="subcat-assign-files">${subCategoryAssignMode ? "Done assigning" : "+ Assign files"}</button>`
        : "";
    const chips = subs.map((s) => {
      const fileCount = countSubCategoryFiles(s, draft?.fileTree?.children, projectRoot(), resolveFullPath, findNodeByPath);
      const linkCount = topLevelSubCategoryItems(s.items).length;
      const count = fileCount || linkCount;
      const hasCmd = Boolean(s.runCommand);
      const assigning = activeSubCategoryId === s.id && subCategoryAssignMode;
      const viewing = activeSubCategoryId === s.id && !subCategoryAssignMode;
      const accent = s.color ? ` style="--chip-accent:${escapeHtml(s.color)}"` : "";
      const countTitle = fileCount ? `${fileCount} files` : linkCount ? `${linkCount} linked` : "";
      const badge = count
        ? `<span class="subcat-chip-count" title="${escapeHtml(countTitle)}">${fileCount || linkCount}</span>`
        : hasCmd
          ? `<span class="subcat-chip-cmd" title="Has run command">▶</span>`
          : "";
      return `<button type="button" class="subcat-chip ${assigning ? "assigning" : viewing ? "active" : ""}" data-subcat="${escapeHtml(s.id)}"${accent}>
        <span class="subcat-chip-icon">${escapeHtml(s.icon || "📂")}</span>
        <span class="subcat-chip-label">${escapeHtml(s.name)}</span>
        ${badge}${assigning ? '<span class="subcat-chip-mode">…</span>' : ""}
      </button>`;
    });

    bar.innerHTML = `<div class="subcat-bar-top">
      ${showAssign}
      <button type="button" class="subcat-chip subcat-chip--all ${activeSubCategoryId === "all" && !subCategoryAssignMode ? "active" : ""}" data-subcat="all">All code</button>
      <span class="subcat-bar-meta muted">${subs.length} apps</span>
    </div>
    <div class="subcat-chip-grid">${chips.join("")}</div>`;
    bar.querySelector("#subcat-assign-files")?.addEventListener("click", () => {
      if (subCategoryAssignMode) {
        subCategoryAssignMode = false;
        renderSubCategoryBar();
        renderAssignBanner();
        renderTreeOnly();
      } else {
        startSubCategoryAssign();
      }
    });
    bar.querySelectorAll("[data-subcat]").forEach((btn) => {
      btn.addEventListener("click", () => handleSubCategorySelect(btn.dataset.subcat || "all"));
    });
  }

  async function previewFile(filePath) {
    previewPath = filePath;
    selectedTreePath = filePath;
    selectedTreeType = "file";
    fileViewPath = filePath;
    renderTreeOnly();

    showProjectScreen("code");
    const placeholder = document.getElementById("preview-placeholder");
    const content = document.getElementById("preview-content");
    const nameEl = document.getElementById("preview-name");
    const badge = document.getElementById("preview-badge");
    const sizeEl = document.getElementById("preview-size");
    const viewport = document.getElementById("preview-viewport");
    if (!viewport) {
      await openFileView(filePath);
      return;
    }

    placeholder?.classList.add("hidden");
    content?.classList.remove("hidden");
    const displayName = filePath.split(/[/\\]/).pop() || filePath;
    if (nameEl) nameEl.textContent = "Loading…";
    if (sizeEl) sizeEl.textContent = "";
    viewport.innerHTML = "";

    try {
      const res = await invoke("file.read", { path: filePath, maxBytes: 256 * 1024 });
      const meta = fileKindMeta(res.name || displayName);
      let kind = meta.kind;
      // Readable source → always Code badge (md/txt/json/go/js/…)
      if (res.content != null && !res.binary && kind !== "sheet" && kind !== "image" && kind !== "pdf" && kind !== "document") {
        kind = "code";
      }
      if (nameEl) nameEl.textContent = res.name || displayName;
      if (sizeEl) sizeEl.textContent = res.sizeLabel || "";
      if (badge) {
        badge.textContent = kind === "code" ? "CODE" : (meta.label || kind).toUpperCase();
        badge.className = `preview-kind-badge preview-kind-badge--${kind}`;
      }
      viewport.innerHTML = renderPreviewViewport(kind, res, res.name || displayName);
      bindPreviewViewportActions(viewport, filePath);
      fileViewCopyText = res.content || "";
    } catch (err) {
      if (nameEl) nameEl.textContent = displayName;
      if (badge) {
        badge.textContent = "ERROR";
        badge.className = "preview-kind-badge preview-kind-badge--other";
      }
      viewport.innerHTML = `<pre class="preview-body--text">${escapeHtml(err.message)}</pre>`;
      fileViewCopyText = "";
    }
  }

  function bindTreeClicks(root) {
    root.querySelectorAll(".tree-toggle").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const p = btn.dataset.path;
        if (expandedPaths.has(p)) expandedPaths.delete(p);
        else expandedPaths.add(p);
        renderTreeOnly();
      });
    });

    root.querySelectorAll(".tree-row").forEach((row) => {
      row.addEventListener("click", () => {
        const node = row.closest(".tree-node");
        const type = node?.dataset.type;
        const filePath = node?.dataset.path;
        const name = row.querySelector(".tree-name")?.textContent || "";
        if (subCategoryAssignMode && activeSubCategoryId !== "all" && filePath) {
          assignNodeToSubCategory(activeSubCategoryId, filePath, type, name);
          afterSubCategoryItemsChanged();
          return;
        }
        selectedTreePath = filePath || null;
        selectedTreeType = type || null;
        selectedTreeName = name;
        if (type === "dir" && filePath) {
          if (expandedPaths.has(filePath)) expandedPaths.delete(filePath);
          else expandedPaths.add(filePath);
          renderTreeOnly();
          return;
        }
        if (type === "file" && filePath) previewFile(filePath);
      });
    });
  }

  function renderProjectWorkspace() {
    if (!draft) return;
    ensureAttachments();

    const iconEl = document.getElementById("proj-icon");
    if (iconEl) {
      iconEl.innerHTML = projectIconHtml(draft);
      hydrateProjectIcons([draft]).then(() => applyCachedIconsInDom(iconEl));
    }
    document.getElementById("proj-name").textContent = draft.name || "Untitled";
    document.getElementById("proj-desc").textContent = draft.description || "";
    document.getElementById("proj-subcats")?.classList.add("hidden");

    renderFilesList();
    showProjectScreen(projectScreen === "file" && activeAttachmentId ? "file" : projectScreen === "code" ? "code" : "files");

    const empty = document.getElementById("folder-empty");
    const loaded = document.getElementById("code-loaded");
    const scanning = document.getElementById("scanning");
    const viewTree = activeFileTree();
    const hasTree = viewTree?.children?.length > 0;

    empty?.classList.toggle("hidden", hasTree);
    loaded?.classList.toggle("hidden", !hasTree);
    scanning?.classList.add("hidden");

    if (hasTree) {
      document.getElementById("folder-badge").textContent =
        browseTreeOverride?.root || draft.rootPath || viewTree.root || "";
      const truncNote = viewTree.truncated ? " · tree view limited" : "";
      const autoOn = !browseTreeOverride && data.settings?.autoRefreshEnabled !== false && draft.watchFolder !== false;
      const autoNote = browseTreeOverride
        ? " · attached folder"
        : autoOn
          ? ` · auto every ${data.settings?.autoRefreshMinutes || 3}m`
          : draft.watchFolder === false
            ? " · auto off for this project"
            : "";
      document.getElementById("tree-meta").textContent = `${formatCount(viewTree.fileCount || 0)} files · ${formatCount(viewTree.dirCount || 0)} folders · ${
        viewTree.characterCount > 0 ? formatCount(viewTree.characterCount) + " characters" : "characters…"
      } · ${formatDate(viewTree.scannedAt)}${truncNote}${autoNote}`;
      if (!browseTreeOverride) renderProjectWatchToggle();
      else document.getElementById("proj-watch-toggle")?.remove();
      expandDefaults(viewTree);
      renderSubCategoryBar();
      renderSubCategoryCommandPanel();
      renderAssignBanner();
      renderTreeOnly();
    } else {
      document.getElementById("subcat-bar")?.classList.add("hidden");
      document.getElementById("subcat-hint")?.classList.add("hidden");
      document.getElementById("subcat-assign-banner")?.classList.add("hidden");
    }
  }

  function renderProjectWatchToggle() {
    let el = document.getElementById("proj-watch-toggle");
    const toolbar = document.querySelector(".code-toolbar");
    if (!toolbar || !draft?.rootPath) return;
    if (!el) {
      el = document.createElement("label");
      el.id = "proj-watch-toggle";
      el.className = "proj-watch-toggle";
      toolbar.insertBefore(el, document.getElementById("proj-rescan"));
    }
    const checked = draft.watchFolder !== false;
    el.innerHTML = `<input type="checkbox" id="proj-watch-folder" ${checked ? "checked" : ""} /> Auto-sync`;
    const input = el.querySelector("#proj-watch-folder");
    if (input) {
      input.onchange = async (e) => {
        draft.watchFolder = e.target.checked;
        await saveDraft();
        renderProjectWorkspace();
      };
    }
  }

  async function saveDraft() {
    if (!draft) return;
    draft.updatedAt = new Date().toISOString();
    draft.iconId = String(draft.iconId || "").trim();
    const idx = data.projects.findIndex((p) => p.id === draft.id);
    if (idx >= 0) data.projects[idx] = draft;
    else data.projects.unshift(draft);
    const saved = await window.BuildsStorage.save(data);
    if (saved && Array.isArray(saved.projects)) {
      data = saved;
      const fresh = data.projects.find((p) => p.id === draft.id);
      if (fresh) {
        const keepIconId = draft.iconId;
        draft = fresh;
        if (keepIconId && !draft.iconId) draft.iconId = keepIconId;
      }
    }
  }

  function applyLibraryIconToDraft(picked) {
    if (!picked) return;
    if (picked.clear) {
      draft.iconId = "";
    } else if (picked.id) {
      draft.iconId = String(picked.id).trim();
      if (picked.svg) window.Builds._iconSvgCache.set(draft.iconId, picked.svg);
    }
  }

  function refreshInfoEditorIconRow() {
    const row = detailBody?.querySelector(".msl-choose-icon");
    if (!row || !draft) return;
    const cachedSvg = draft.iconId ? window.Builds._iconSvgCache.get(draft.iconId) : "";
    const preview = draft.iconId
      ? cachedSvg
        ? `<span class="msl-icon-preview">${cachedSvg}</span>`
        : `<span class="msl-icon-preview msl-icon-preview-empty">${escapeHtml(draft.iconId)}</span>`
      : `<span class="msl-icon-preview msl-icon-preview-empty">—</span>`;
    row.innerHTML = `
      ${preview}
      <button type="button" class="btn btn-ghost" id="ed-choose-icon">Choose from Icon Library…</button>
      ${draft.iconId ? `<span class="muted" id="ed-icon-id-label">${escapeHtml(draft.iconId)}</span>` : ""}`;
    row.querySelector("#ed-choose-icon")?.addEventListener("click", onChooseLibraryIcon);
    detailBody.querySelectorAll(".icon-pick").forEach((btn) => {
      btn.classList.toggle("active", draft.icon === btn.dataset.icon && !draft.iconId);
    });
  }

  async function onChooseLibraryIcon() {
    if (!draft || !mslIconsEnabled()) return;
    try {
      const picked = await window.MslIconPicker?.open?.({
        selectedId: draft.iconId || "",
        title: "Choose project icon",
      });
      if (!picked) return;
      applyLibraryIconToDraft(picked);
      refreshInfoEditorIconRow();
      await saveDraft();
      renderProjectWorkspace();
      render();
    } catch (err) {
      alert(err.message || String(err));
    }
  }

  function readInfoFormIntoDraft() {
    if (!draft || !detailBody) return;
    draft.name = detailBody.querySelector("#ed-name")?.value.trim() || draft.name;
    draft.description = detailBody.querySelector("#ed-desc")?.value.trim() || "";
    draft.builtAt = detailBody.querySelector("#ed-built")?.value || "";
    draft.repoUrl = detailBody.querySelector("#ed-repo")?.value.trim() || "";
    draft.demoUrl = detailBody.querySelector("#ed-demo")?.value.trim() || "";
    draft.notes = detailBody.querySelector("#ed-notes")?.value || "";
    draft.favorite = detailBody.querySelector("#ed-fav")?.checked || false;
    draft.stack = (detailBody.querySelector("#ed-stack")?.value || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    draft.iconId = String(draft.iconId || "").trim();
  }

  async function rescanCurrentFolder() {
    if (!draft?.rootPath) {
      await pickAndScanFolder();
      return;
    }
    const scanning = document.getElementById("scanning");
    document.getElementById("code-loaded")?.classList.add("hidden");
    scanning?.classList.remove("hidden");
    try {
      const scan = await invoke("tree.scan", { path: draft.rootPath });
      draft.fileTree = scan.fileTree;
      await saveDraft();
      renderProjectWorkspace();
    } catch (err) {
      alert(err.message);
      renderProjectWorkspace();
    }
  }

  async function pickAndScanFolder() {
    if (!draft) return;
    const res = await invoke("folder.pick", {
      defaultPath: draft.rootPath,
      title: `Select code folder for "${draft.name || "project"}"`,
    });
    if (!res.path) return;

    const empty = document.getElementById("folder-empty");
    const loaded = document.getElementById("code-loaded");
    const scanning = document.getElementById("scanning");
    empty?.classList.add("hidden");
    loaded?.classList.add("hidden");
    scanning?.classList.remove("hidden");

    try {
      const scan = await invoke("tree.scan", { path: res.path });
      draft.rootPath = res.path;
      draft.fileTree = scan.fileTree;
      if (!draft.name) {
        draft.name = res.path.split(/[/\\]/).pop() || "Untitled";
      }
      await saveDraft();
      previewPath = null;
      document.getElementById("preview-placeholder")?.classList.remove("hidden");
      document.getElementById("preview-content")?.classList.add("hidden");
      renderProjectWorkspace();
      renderGrid();
      showProjectScreen("code");
    } catch (err) {
      alert(err.message);
      renderProjectWorkspace();
    }
  }

  function openProject(id) {
    const p = projectById(id);
    if (!p) return;
    if (page?.hidden) {
      document.querySelector('.nav-item[data-page="browse"]')?.click();
    }
    draft = structuredClone(p);
    ensureSubCategoryItems();
    ensureAttachments();
    activeProjectId = id;
    activeSubCategoryId = "all";
    subCategoryAssignMode = false;
    previewPath = null;
    browseTreeOverride = null;
    activeAttachmentId = null;
    projectScreen = "files";
    fileViewPath = null;
    selectedTreePath = null;
    showProjectView();
    renderProjectWorkspace();
    renderGrid();
  }

  function closeProjectView() {
    activeProjectId = null;
    draft = null;
    previewPath = null;
    activeAttachmentId = null;
    projectScreen = "files";
    fileViewPath = null;
    browseTreeOverride = null;
    showListView();
    renderGrid();
  }

  function createProject() {
    draft = {
      id: uid("proj"),
      name: "New project",
      categoryId: "other",
      icon: "🏗️",
      iconId: "",
      color: "",
      description: "",
      stack: [],
      rootPath: "",
      repoUrl: "",
      demoUrl: "",
      links: [],
      fields: [],
      tags: [],
      notes: "",
      subCategories: [],
      attachments: [],
      fileTree: null,
      builtAt: new Date().toISOString().slice(0, 10),
      favorite: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    activeProjectId = draft.id;
    projectScreen = "files";
    data.projects.unshift(draft);
    saveDraft().then(() => {
      showProjectView();
      renderProjectWorkspace();
      render();
    });
  }

  function openInfoEditor() {
    if (!draft) return;
    detailTitle.textContent = "Edit project info";
    shell.classList.add("detail-open");
    detailPanel.classList.remove("hidden");
    const iconOptions = ICON_PICKS.map(
      (ic) => `<button type="button" class="icon-pick ${draft.icon === ic && !draft.iconId ? "active" : ""}" data-icon="${escapeHtml(ic)}">${ic}</button>`
    ).join("");
    const cachedSvg = draft.iconId ? window.Builds._iconSvgCache.get(draft.iconId) : "";
    const mslPreview = draft.iconId
      ? cachedSvg
        ? `<span class="msl-icon-preview">${cachedSvg}</span>`
        : `<span class="msl-icon-preview msl-icon-preview-empty">${escapeHtml(draft.iconId)}</span>`
      : `<span class="msl-icon-preview msl-icon-preview-empty">—</span>`;

    detailBody.innerHTML = `
      <form class="project-form" id="info-form" novalidate>
        <div class="icon-picker">${iconOptions}</div>
        <div class="msl-choose-icon">
          ${mslPreview}
          <button type="button" class="btn btn-ghost" id="ed-choose-icon">Choose from Icon Library…</button>
          ${draft.iconId ? `<span class="muted" id="ed-icon-id-label">${escapeHtml(draft.iconId)}</span>` : ""}
        </div>
        <label><span>Name</span><input type="text" id="ed-name" value="${escapeHtml(draft.name)}" /></label>
        <label><span>Description</span><input type="text" id="ed-desc" value="${escapeHtml(draft.description)}" /></label>
        <label><span>Built on</span><input type="date" id="ed-built" value="${escapeHtml((draft.builtAt || "").slice(0, 10))}" /></label>
        <label><span>Tech stack</span><input type="text" id="ed-stack" value="${escapeHtml((draft.stack || []).join(", "))}" placeholder="Electron, Python…" /></label>
        <label><span>Repository</span><input type="text" id="ed-repo" value="${escapeHtml(draft.repoUrl || "")}" placeholder="https://…" /></label>
        <label><span>Demo URL</span><input type="text" id="ed-demo" value="${escapeHtml(draft.demoUrl || "")}" placeholder="https://…" /></label>
        <label><span>Notes</span><textarea id="ed-notes" rows="5">${escapeHtml(draft.notes)}</textarea></label>
        <label class="check-row"><input type="checkbox" id="ed-fav" ${draft.favorite ? "checked" : ""} /> Favorite</label>
        <div class="detail-actions">
          <button type="button" class="btn btn-primary" id="ed-save">Save</button>
          <button type="button" class="btn btn-danger" id="ed-delete">Delete project</button>
        </div>
      </form>`;

    if (draft.iconId && !cachedSvg) {
      hydrateProjectIcons([draft]).then(() => refreshInfoEditorIconRow());
    }

    detailBody.querySelectorAll(".icon-pick").forEach((btn) => {
      btn.addEventListener("click", async () => {
        draft.icon = btn.dataset.icon;
        draft.iconId = "";
        refreshInfoEditorIconRow();
        try {
          await saveDraft();
          renderProjectWorkspace();
          render();
        } catch (err) {
          alert(err.message || String(err));
        }
      });
    });

    detailBody.querySelector("#ed-choose-icon")?.addEventListener("click", onChooseLibraryIcon);

    detailBody.querySelector("#ed-save")?.addEventListener("click", async () => {
      try {
        readInfoFormIntoDraft();
        await saveDraft();
        closeInfoEditor();
        renderProjectWorkspace();
        render();
      } catch (err) {
        alert(err.message || String(err));
      }
    });

    detailBody.querySelector("#info-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      detailBody.querySelector("#ed-save")?.click();
    });

    detailBody.querySelector("#ed-delete")?.addEventListener("click", async () => {
      await deleteProject(draft.id, draft.name);
      closeInfoEditor();
    });
  }

  function closeInfoEditor() {
    shell.classList.remove("detail-open");
    detailPanel.classList.add("hidden");
  }

  function renderSubCategoryEditorList() {
    const list = draft?.subCategories || [];
    if (!list.length) {
      return `<p class="subcats-empty">No sub-categories yet. Add one below — files are optional if you only need a run command.</p>`;
    }
    return list
      .map((s, i) => {
        const itemsHtml = (s.items || [])
          .map(
            (item, j) => `<div class="subcat-item-row">
              <span class="subcat-item-path">${escapeHtml(item.path)}</span>
              <button type="button" class="btn btn-ghost btn-sm subcat-item-remove" data-idx="${i}" data-item="${j}">✕</button>
            </div>`
          )
          .join("");
        return `<article class="subcat-edit-block" data-idx="${i}">
          <div class="subcat-edit-row">
            <span class="subcat-edit-icon" style="background:${escapeHtml(s.color || "#94a3b8")}20;color:${escapeHtml(s.color || "#94a3b8")}">${escapeHtml(s.icon || "📂")}</span>
            <input type="text" class="field-input subcat-name" value="${escapeHtml(s.name)}" />
            <input type="text" class="field-input subcat-icon" value="${escapeHtml(s.icon || "📂")}" maxlength="4" title="Emoji" />
            <input type="color" class="subcat-color" value="${escapeHtml(s.color || "#94a3b8")}" />
            <button type="button" class="btn btn-ghost btn-sm subcat-remove" data-idx="${i}">✕</button>
          </div>
          <label class="subcat-field"><span>Working folder (optional, relative to project root)</span>
            <input type="text" class="field-input subcat-cwd" value="${escapeHtml(s.runCwd || "")}" placeholder="e.g. apps/remote-hub/agent" />
          </label>
          <label class="subcat-field"><span>Run command (paste into VS Code terminal after cd)</span>
            <textarea class="field-input subcat-run" rows="2" placeholder="npm start">${escapeHtml(s.runCommand || "")}</textarea>
          </label>
          ${itemsHtml ? `<div class="subcat-items">${itemsHtml}</div>` : `<p class="subcat-items-empty muted">No files linked — optional. Use Assign files in the tree, or leave command-only.</p>`}
        </article>`;
      })
      .join("");
  }

  function openSubCategoriesEditor() {
    if (!draft) return;
    if (!Array.isArray(draft.subCategories)) draft.subCategories = [];
    detailTitle.textContent = "Sub-categories";
    shell.classList.add("detail-open");
    detailPanel.classList.remove("hidden");

    detailBody.innerHTML = `
      <div class="subcats-editor">
        <p class="subcats-help"><strong>Files are optional.</strong> Add a run command to copy into VS Code terminal, or link files via <strong>Assign files</strong> above the tree.</p>
        <div class="subcat-list" id="subcats-list">${renderSubCategoryEditorList()}</div>
        <button type="button" class="btn btn-primary btn-sm" id="subcat-add">+ Add sub-category</button>
        <div class="detail-actions">
          <button type="button" class="btn btn-primary" id="subcats-save">Save</button>
          <button type="button" class="btn btn-ghost" id="subcats-close">Close</button>
        </div>
      </div>`;

    detailBody.querySelector("#subcat-add")?.addEventListener("click", () => {
      draft.subCategories.push({
        id: uid("subcat"),
        name: "New sub-category",
        icon: "📂",
        color: "#94a3b8",
        runCommand: "",
        runCwd: "",
        items: [],
      });
      detailBody.querySelector("#subcats-list").innerHTML = renderSubCategoryEditorList();
      bindSubCategoryEditorRows();
    });

    bindSubCategoryEditorRows();

    detailBody.querySelector("#subcats-save")?.addEventListener("click", async () => {
      detailBody.querySelectorAll(".subcat-edit-block").forEach((block) => {
        const idx = parseInt(block.dataset.idx, 10);
        const sub = draft.subCategories[idx];
        if (!sub) return;
        const row = block.querySelector(".subcat-edit-row");
        sub.name = row?.querySelector(".subcat-name")?.value.trim() || sub.name;
        sub.icon = row?.querySelector(".subcat-icon")?.value.trim() || sub.icon;
        sub.color = row?.querySelector(".subcat-color")?.value || sub.color;
        sub.runCwd = block.querySelector(".subcat-cwd")?.value.trim().replace(/\\/g, "/").replace(/^\.\//, "") || "";
        sub.runCommand = block.querySelector(".subcat-run")?.value.trim() || "";
      });
      await saveDraft();
      closeInfoEditor();
      renderProjectWorkspace();
      renderGrid();
    });

    detailBody.querySelector("#subcats-close")?.addEventListener("click", closeInfoEditor);
  }

  function bindSubCategoryEditorRows() {
    detailBody.querySelectorAll(".subcat-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx, 10);
        draft.subCategories.splice(idx, 1);
        detailBody.querySelector("#subcats-list").innerHTML = renderSubCategoryEditorList();
        bindSubCategoryEditorRows();
      });
    });
    detailBody.querySelectorAll(".subcat-item-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const itemIdx = parseInt(btn.dataset.item, 10);
        const sub = draft.subCategories[idx];
        if (!sub?.items) return;
        sub.items.splice(itemIdx, 1);
        detailBody.querySelector("#subcats-list").innerHTML = renderSubCategoryEditorList();
        bindSubCategoryEditorRows();
      });
    });
  }

  function bindProjectView() {
    document.getElementById("proj-back")?.addEventListener("click", closeProjectView);
    document.getElementById("proj-delete")?.addEventListener("click", async () => {
      if (!draft) return;
      await deleteProject(draft.id, draft.name);
    });
    document.getElementById("btn-add-attachment")?.addEventListener("click", pickAndAddAttachments);
    document.getElementById("btn-add-folder")?.addEventListener("click", pickAndAddFolder);
    document.getElementById("files-empty-add")?.addEventListener("click", pickAndAddAttachments);
    document.getElementById("attachment-modal-close")?.addEventListener("click", closeAttachmentModal);
    document.getElementById("attachment-modal-cancel")?.addEventListener("click", closeAttachmentModal);
    document.getElementById("attachment-modal-save")?.addEventListener("click", saveAttachmentModal);
    document.getElementById("file-view-back")?.addEventListener("click", () => {
      activeAttachmentId = null;
      fileViewPath = null;
      showProjectScreen("files");
    });
    document.getElementById("code-screen-back")?.addEventListener("click", () => {
      browseTreeOverride = null;
      projectScreen = "files";
      showProjectScreen("files");
      renderProjectWorkspace();
    });
    document.getElementById("proj-open-code")?.addEventListener("click", () => showProjectScreen("code"));
    document.getElementById("file-view-open")?.addEventListener("click", () => {
      if (fileViewPath) invoke("file.open", { path: fileViewPath });
    });
    document.getElementById("file-view-copy")?.addEventListener("click", async () => {
      if (fileViewCopyText) await invoke("clipboard.copy", { text: fileViewCopyText });
    });
    document.getElementById("proj-pick-folder-big")?.addEventListener("click", pickAndScanFolder);
    document.getElementById("proj-rescan")?.addEventListener("click", rescanCurrentFolder);
    document.getElementById("proj-open-folder")?.addEventListener("click", () => {
      if (draft?.rootPath) invoke("folder.open", { path: draft.rootPath });
    });
    document.getElementById("proj-edit-info")?.addEventListener("click", openInfoEditor);
    document.getElementById("proj-manage-subcats")?.addEventListener("click", openSubCategoriesEditor);
    document.getElementById("preview-copy")?.addEventListener("click", async () => {
      const text =
        fileViewCopyText ||
        document.getElementById("preview-viewport")?.textContent ||
        document.getElementById("preview-body")?.textContent ||
        "";
      await invoke("clipboard.copy", { text });
    });
    document.getElementById("preview-open")?.addEventListener("click", () => {
      if (previewPath) invoke("file.open", { path: previewPath });
    });
    window.AppSettingsRuntime?.onApplied?.(() => {
      render();
      if (draft) renderProjectWorkspace();
    });
  }

  function render() {
    renderStats();
    renderGrid();
  }

  async function scan() {
    try {
      data = await window.BuildsStorage.load();
    } catch (err) {
      console.error("[Builds] load failed", err);
      data = data?.projects?.length ? data : { projects: [], categories: [], settings: {} };
      statsEl &&
        (statsEl.innerHTML = `<div class="stat-card"><span class="stat-val">!</span><span class="stat-label">${escapeHtml(
          err.message || "Load failed"
        )}</span></div>`);
      return;
    }
    await syncPanelSettings();
    if (activeProjectId) {
      const p = projectById(activeProjectId);
      if (p) {
        draft = structuredClone(p);
        ensureSubCategoryItems();
        ensureAttachments();
      } else closeProjectView();
    }
    render();
    if (draft) renderProjectWorkspace();
  }

  function bind(ui) {
    document.getElementById("btn-filter-fav")?.addEventListener("click", () => {
      filterFavorites = !filterFavorites;
      document.getElementById("btn-filter-fav")?.classList.toggle("active", filterFavorites);
      render();
    });
    searchInput?.addEventListener("input", () => renderGrid());
    detailClose?.addEventListener("click", closeInfoEditor);
    ui.btnAdd?.addEventListener("click", createProject);
    bindProjectView();
    window.myApp?.onTreeUpdate?.((payload) => {
      applyTreeUpdate(payload);
    });
    document.addEventListener("app-setting-changed", async (e) => {
      if (e.detail?.appId !== "builds") return;
      await syncPanelSettings();
      renderAutoRefreshBar();
      if (draft) renderProjectWorkspace();
    });
    ui.btnExport?.addEventListener("click", async () => {
      const res = await invoke("data.export");
      await invoke("clipboard.copy", { text: res.json });
      alert("Exported to clipboard.");
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
  return { id: "browse", page, scan, bind, openProject, closeProjectView, isProjectViewOpen, render };
})();
