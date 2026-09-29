/* Runtime UI - browser/webview only. NEVER add require()/import at top-level. */
(function () {
  function tt(key, fallback, vars) {
    const I = window.MySpaceI18n;
    if (!I?.t) return fallback || key;
    const v = I.t(key, vars);
    return v === key ? fallback || key : v;
  }
  const state = {
    scripts: [],
    settings: { stopOnError: true, folders: [], expandedFolders: [] },
    activeId: null,
    activeFolder: "",
    dirty: false,
    running: false,
    mode: "programs",
    session: [],
    terminalOpen: false,
    creatingFolder: null, 
    creatingFile: null,  
    renaming: null, 
    openTabIds: [],
    dirtyIds: {}, 
    savedSnap: {}, 
  };

  const MAX_SESSION = 200;
  const PROGRAM_EXT = ".msos";
  const $ = (id) => document.getElementById(id);
  const ICONS = {
    folder:
      '<svg class="tree-svg" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M1.5 3A1.5 1.5 0 0 1 3 1.5h3.172a1.5 1.5 0 0 1 1.06.44L8.5 3H13A1.5 1.5 0 0 1 14.5 4.5v8A1.5 1.5 0 0 1 13 14H3A1.5 1.5 0 0 1 1.5 12.5v-9z"/></svg>',
    folderOpen:
      '<svg class="tree-svg" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M1.5 3A1.5 1.5 0 0 1 3 1.5h3.172a1.5 1.5 0 0 1 1.06.44L8.5 3h2.25A.75.75 0 0 1 11.5 3.75V5h1.75A1.75 1.75 0 0 1 15 6.75v5.75A1.5 1.5 0 0 1 13.5 14h-11A1.5 1.5 0 0 1 1 12.5V3z"/></svg>',
    file:
      '<img class="tree-svg tree-svg-msos" src="msos-mark.png" alt="" width="14" height="14" />',
  };

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function stripProgramExt(name) {
    const n = String(name || "").trim();
    if (n.toLowerCase().endsWith(PROGRAM_EXT)) return n.slice(0, -PROGRAM_EXT.length);
    return n;
  }

  function ensureProgramExt(name) {
    let base = String(name || "").trim();
    if (!base) base = "untitled";
    base = base.replace(/[<>:"|?*\u0000-\u001f]/g, "").slice(0, 120);
    if (!base) base = "untitled";
    if (/\.[A-Za-z0-9]{1,16}$/.test(base)) return base;
    const stem = stripProgramExt(base) || "untitled";
    return `${stem}${PROGRAM_EXT}`;
  }

  function namesMatch(a, b) {
    const na = String(a || "").trim().toLowerCase();
    const nb = String(b || "").trim().toLowerCase();
    if (na === nb) return true;
    const aHasOtherExt = /\.[A-Za-z0-9]{1,16}$/.test(na) && !na.endsWith(PROGRAM_EXT);
    const bHasOtherExt = /\.[A-Za-z0-9]{1,16}$/.test(nb) && !nb.endsWith(PROGRAM_EXT);
    if (aHasOtherExt || bHasOtherExt) return false;
    return ensureProgramExt(a).toLowerCase() === ensureProgramExt(b).toLowerCase();
  }

  async function invoke(channel, args) {
    if (!window.myApp?.invoke) throw new Error("App bridge unavailable");
    return window.myApp.invoke(channel, args || {});
  }

  function activeScript() {
    return state.scripts.find((s) => s.id === state.activeId) || null;
  }

  function isScriptDirty(id) {
    return !!state.dirtyIds[String(id || "")];
  }

  function setScriptDirty(id, on) {
    const key = String(id || "");
    if (!key) return;
    if (on) state.dirtyIds[key] = true;
    else delete state.dirtyIds[key];
  }

  function rememberSaved(script) {
    if (!script?.id) return;
    state.savedSnap[script.id] = {
      name: String(script.name || ""),
      body: String(script.body || ""),
    };
  }

  function restoreSaved(id) {
    const script = state.scripts.find((s) => s.id === id);
    const snap = state.savedSnap[id];
    if (!script || !snap) return;
    script.name = snap.name;
    script.body = snap.body;
    setScriptDirty(id, false);
  }

  function openTab(id) {
    const key = String(id || "");
    if (!key || !state.scripts.some((s) => s.id === key)) return;
    if (!state.openTabIds.includes(key)) state.openTabIds.push(key);
  }

  function renderTabs() {
    ensureEditorChrome();
    const bar = $("editor-tabs");
    if (!bar) return;
    state.openTabIds = state.openTabIds.filter((id) =>
      state.scripts.some((s) => s.id === id)
    );
    if (!state.openTabIds.length) {
      bar.innerHTML = "";
      return;
    }
    bar.innerHTML = state.openTabIds
      .map((id) => {
        const script = state.scripts.find((s) => s.id === id);
        if (!script) return "";
        const active = id === state.activeId ? " is-active" : "";
        const dirty = isScriptDirty(id) ? " is-dirty" : "";
        const dirtyDot = isScriptDirty(id)
          ? `<span class="editor-tab-dirty" aria-hidden="true"></span>`
          : "";
        return `<div class="editor-tab${active}${dirty}" data-tab-id="${escapeHtml(
          id
        )}" role="tab" aria-selected="${id === state.activeId ? "true" : "false"}" title="${escapeHtml(
          script.name
        )}">
          <img class="editor-tab-icon" src="msos-mark.png" alt="" width="12" height="12" />
          <span class="editor-tab-name">${escapeHtml(script.name)}</span>
          ${dirtyDot}
          <button type="button" class="editor-tab-close" data-close-tab="${escapeHtml(
            id
          )}" title="Close" aria-label="Close">×</button>
        </div>`;
      })
      .join("");
  }

  async function closeTab(id) {
    const key = String(id || "");
    if (!key) return;
    if (key === state.activeId) readEditorIntoState();
    if (isScriptDirty(key)) {
      const ok = await confirmLeave();
      if (!ok) return;
      restoreSaved(key);
    }
    state.openTabIds = state.openTabIds.filter((x) => x !== key);
    setScriptDirty(key, false);
    if (state.activeId === key) {
      const next = state.openTabIds[state.openTabIds.length - 1] || null;
      if (next) selectScript(next);
      else {
        state.activeId = null;
        if ($("script-name")) $("script-name").value = "";
        if ($("script-body")) $("script-body").value = "";
        syncLineNumbers();
        markDirty(false);
        renderList();
        renderTabs();
      }
    } else {
      renderTabs();
      renderList();
    }
  }

  function formatWhen(iso) {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  function formatClock(ts) {
    try {
      return new Date(ts || Date.now()).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return "";
    }
  }

  function countLines(body) {
    return String(body || "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#")).length;
  }

  function normalizeFolder(raw) {
    return String(raw || "")
      .replace(/\\/g, "/")
      .split("/")
      .map((p) => p.trim())
      .filter((p) => p && p !== "." && p !== "..")
      .join("/");
  }

  function folderBasename(folder) {
    const f = normalizeFolder(folder);
    if (!f) return "";
    const parts = f.split("/");
    return parts[parts.length - 1];
  }

  function isFolderExpanded(folder) {
    return (state.settings.expandedFolders || []).includes(normalizeFolder(folder));
  }

  async function persistExpanded() {
    try {
      const res = await invoke("settings.patch", {
        expandedFolders: state.settings.expandedFolders || [],
      });
      if (res?.settings) state.settings = { ...state.settings, ...res.settings };
    } catch {
    }
  }

  function expandFolderPath(folder) {
    const f = normalizeFolder(folder);
    if (!f) return;
    const set = new Set(state.settings.expandedFolders || []);
    const parts = f.split("/");
    let acc = "";
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part;
      set.add(acc);
    }
    state.settings.expandedFolders = [...set];
  }

  async function collapseAllFolders() {
    if (!(state.settings.expandedFolders || []).length) {
      renderList();
      return;
    }
    state.settings.expandedFolders = [];
    renderList();
    await persistExpanded();
  }

  async function toggleFolder(folder) {
    const f = normalizeFolder(folder);
    if (!f) return;
    const set = new Set(state.settings.expandedFolders || []);
    if (set.has(f)) set.delete(f);
    else set.add(f);
    state.settings.expandedFolders = [...set];
    if (state.activeId) readEditorIntoState();
    state.activeFolder = f;
    state.activeId = null;
    renderList();
    renderTabs();
    await persistExpanded();
  }

  function buildTreeModel() {
    const folderSet = new Set();
    for (const f of state.settings.folders || []) {
      const n = normalizeFolder(f);
      if (!n) continue;
      const parts = n.split("/");
      let acc = "";
      for (const part of parts) {
        acc = acc ? `${acc}/${part}` : part;
        folderSet.add(acc);
      }
    }
    for (const s of state.scripts) {
      const n = normalizeFolder(s.folder);
      if (!n) continue;
      const parts = n.split("/");
      let acc = "";
      for (const part of parts) {
        acc = acc ? `${acc}/${part}` : part;
        folderSet.add(acc);
      }
    }

    const byParent = new Map();
    byParent.set("", { folders: [], files: [] });
    const folders = [...folderSet].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
    for (const folder of folders) {
      const parent = folder.includes("/") ? folder.slice(0, folder.lastIndexOf("/")) : "";
      if (!byParent.has(parent)) byParent.set(parent, { folders: [], files: [] });
      if (!byParent.has(folder)) byParent.set(folder, { folders: [], files: [] });
      byParent.get(parent).folders.push(folder);
    }
    for (const script of state.scripts) {
      const parent = normalizeFolder(script.folder);
      if (!byParent.has(parent)) byParent.set(parent, { folders: [], files: [] });
      byParent.get(parent).files.push(script);
    }
    for (const bucket of byParent.values()) {
      bucket.folders.sort((a, b) =>
        folderBasename(a).localeCompare(folderBasename(b), undefined, { sensitivity: "base" })
      );
      bucket.files.sort((a, b) =>
        String(a.name).localeCompare(String(b.name), undefined, { sensitivity: "base" })
      );
    }
    return byParent;
  }

  function treeRowsHtml(parent, depth, byParent) {
    const bucket = byParent.get(parent) || { folders: [], files: [] };
    let html = "";
    if (
      state.creatingFolder &&
      normalizeFolder(state.creatingFolder.parent) === normalizeFolder(parent)
    ) {
      html += `<div class="tree-node tree-node-draft">
        <div class="tree-row tree-row-draft" style="--tree-depth:${depth}">
          <span class="tree-spacer" aria-hidden="true"></span>
          <span class="tree-icon">${ICONS.folder}</span>
          <input type="text" class="tree-inline-input" id="tree-folder-input" spellcheck="false" autocomplete="off" />
        </div>
      </div>`;
    }
    for (const folder of bucket.folders) {
      const expanded = isFolderExpanded(folder);
      const child = byParent.get(folder) || { folders: [], files: [] };
      const count = child.folders.length + child.files.length;
      const selected =
        !state.activeId && state.activeFolder === folder ? " is-selected" : "";
      const renamingFolder =
        state.renaming?.kind === "folder" &&
        normalizeFolder(state.renaming.folder) === normalizeFolder(folder);
      html += `<div class="tree-node" data-folder="${escapeHtml(folder)}">
        <div class="tree-row tree-row-folder${selected}${
          renamingFolder ? " is-renaming" : ""
        }" data-folder="${escapeHtml(folder)}" style="--tree-depth:${depth}">
          <button type="button" class="tree-toggle" data-toggle-folder="${escapeHtml(
            folder
          )}" aria-expanded="${expanded}">${expanded ? "▾" : "▸"}</button>
          <span class="tree-icon">${expanded ? ICONS.folderOpen : ICONS.folder}</span>
          ${
            renamingFolder
              ? `<input type="text" class="tree-inline-input" id="tree-rename-input" data-rename-kind="folder" spellcheck="false" autocomplete="off" value="${escapeHtml(
                  folderBasename(folder)
                )}" />`
              : `<span class="tree-name" data-rename-target="folder">${escapeHtml(
                  folderBasename(folder)
                )}</span>`
          }
          ${!renamingFolder && count ? `<span class="tree-meta-count">${count}</span>` : ""}
        </div>`;
      if (expanded) {
        html += `<div class="tree-children">${treeRowsHtml(folder, depth + 1, byParent)}</div>`;
      }
      html += `</div>`;
    }
    if (
      state.creatingFile &&
      normalizeFolder(state.creatingFile.parent) === normalizeFolder(parent)
    ) {
      html += `<div class="tree-node tree-node-draft">
        <div class="tree-row tree-row-draft tree-row-file-draft" style="--tree-depth:${depth}">
          <span class="tree-spacer" aria-hidden="true"></span>
          <span class="tree-icon">${ICONS.file}</span>
          <input type="text" class="tree-inline-input" id="tree-file-input" spellcheck="false" autocomplete="off" placeholder=".msos" />
        </div>
      </div>`;
    }
    for (const script of bucket.files) {
      const active = script.id === state.activeId ? " is-active" : "";
      const dirty = isScriptDirty(script.id) ? " is-dirty" : "";
      const renamingFile = state.renaming?.kind === "file" && state.renaming.id === script.id;
      html += `<div class="tree-node" data-id="${escapeHtml(script.id)}">
        <div class="tree-row tree-row-file${active}${dirty}${
          renamingFile ? " is-renaming" : ""
        }" data-id="${escapeHtml(script.id)}" style="--tree-depth:${depth}">
          <span class="tree-spacer" aria-hidden="true"></span>
          <span class="tree-icon">${ICONS.file}</span>
          ${
            renamingFile
              ? `<input type="text" class="tree-inline-input" id="tree-rename-input" data-rename-kind="file" spellcheck="false" autocomplete="off" value="${escapeHtml(
                  script.name
                )}" />`
              : `<span class="tree-name" data-rename-target="file">${escapeHtml(
                  script.name
                )}</span>${
                  dirty ? `<span class="tree-dirty-dot" title="Unsaved" aria-hidden="true"></span>` : ""
                }`
          }
          ${
            !renamingFile
              ? `<span class="tree-meta-count">${countLines(script.body)}</span>`
              : ""
          }
        </div>
      </div>`;
    }
    return html;
  }

  function setTerminalOpen(open) {
    state.terminalOpen = !!open;
    const workspace = $("programs-workspace");
    const tab = $("btn-show-terminal");
    const pane = $("output-pane");
    workspace?.classList.toggle("is-terminal-closed", !state.terminalOpen);
    pane?.classList.toggle("is-closed", !state.terminalOpen);
    if (pane) pane.hidden = !state.terminalOpen;
    if (tab) {
      tab.classList.toggle("is-active", state.terminalOpen);
      tab.setAttribute("aria-selected", state.terminalOpen ? "true" : "false");
    }
  }

  function syncStopOnErrorUi(on) {
    const checked = on !== false;
    const hidden = $("stop-on-error");
    const ui = $("stop-on-error-ui");
    if (hidden) hidden.checked = checked;
    if (ui) ui.checked = checked;
  }

  function setMode(mode) {
    const next = mode === "session" ? "session" : "programs";
    state.mode = next;
    document.querySelectorAll(".mode-tab").forEach((tab) => {
      const on = tab.dataset.mode === next;
      tab.classList.toggle("is-active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
    });
    document.querySelectorAll(".mode-panel").forEach((panel) => {
      const on = panel.dataset.panel === next;
      panel.classList.toggle("is-active", on);
      if (on) panel.removeAttribute("hidden");
      else panel.setAttribute("hidden", "");
    });
    if (next === "session") renderSession();
  }

  function appendSession(entry) {
    const item = {
      id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: Date.now(),
      source: entry.source || "language",
      ok: entry.ok !== false,
      command: entry.command || "",
      message: entry.message || "",
    };
    state.session.push(item);
    if (state.session.length > MAX_SESSION) {
      state.session.splice(0, state.session.length - MAX_SESSION);
    }
    if (state.mode === "session") renderSession();
  }

  function clearSession() {
    state.session = [];
    renderSession();
  }

  function renderSession() {
    const log = $("session-log");
    if (!log) return;
    if (!state.session.length) {
      log.innerHTML = `<div class="session-empty" id="session-empty">
        <p>${escapeHtml(
          tt(
            "service.scripts.sessionEmpty",
            "Output from Language and host runs will appear here."
          )
        )}</p>
      </div>`;
      return;
    }
    log.innerHTML = state.session
      .map((e) => {
        const tagClass =
          e.source === "host" ? "is-host" : e.source === "system" ? "is-system" : "is-language";
        const tagLabel =
          e.source === "host"
            ? tt("service.scripts.tagHost", "host")
            : e.source === "system"
              ? tt("service.scripts.tagSystem", "system")
              : tt("service.scripts.tagLanguage", "language");
        return `<article class="session-entry ${e.ok ? "is-ok" : "is-err"}">
          <span class="session-tag ${tagClass}">${escapeHtml(tagLabel)}</span>
          <div class="session-entry-body">
            <div class="session-entry-head">
              <code class="session-entry-cmd">${escapeHtml(e.command || "—")}</code>
              <span class="session-entry-time">${escapeHtml(formatClock(e.at))}</span>
            </div>
            ${e.message ? `<div class="session-entry-msg">${escapeHtml(e.message)}</div>` : ""}
          </div>
        </article>`;
      })
      .join("");
    log.scrollTop = log.scrollHeight;
  }

  function detectSource(line) {
    const t = String(line || "")
      .trim()
      .toLowerCase();
    if (/^host\s*\(/.test(t)) return "host";
    if (/^(app|pack)\s*\(/.test(t)) return "system";
    return "language";
  }

  function ensureTreeToolbarButtons() {
    const actions = document.querySelector(".tree-toolbar-actions");
    if (!actions) return;
    if (!$("btn-import-file")) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tree-action";
      btn.id = "btn-import-file";
      btn.title = tt("service.scripts.importFile", "Import file");
      btn.setAttribute("aria-label", btn.title);
      btn.setAttribute("data-i18n-title", "service.scripts.importFile");
      btn.setAttribute("data-i18n-aria", "service.scripts.importFile");
      btn.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path fill="currentColor" d="M8.5 1.5v7.793l2.146-2.147.708.708L8 11.207 4.646 7.854l.708-.708L7.5 9.293V1.5h1zM3 12.5h10V14H3v-1.5z"/>
      </svg>`;
      const collapse = $("btn-collapse-all");
      if (collapse) actions.insertBefore(btn, collapse);
      else actions.appendChild(btn);
    }
    if (!$("btn-import-folder")) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tree-action";
      btn.id = "btn-import-folder";
      btn.title = tt("service.scripts.importFolder", "Import folder");
      btn.setAttribute("aria-label", btn.title);
      btn.setAttribute("data-i18n-title", "service.scripts.importFolder");
      btn.setAttribute("data-i18n-aria", "service.scripts.importFolder");
      btn.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path fill="currentColor" d="M1.5 3A1.5 1.5 0 0 1 3 1.5h3.172a1.5 1.5 0 0 1 1.06.44L8.5 3H13A1.5 1.5 0 0 1 14.5 4.5v.75H2v7.25A.5.5 0 0 0 2.5 13h11a.5.5 0 0 0 .5-.5V6H15v6.5A1.5 1.5 0 0 1 13.5 14h-11A1.5 1.5 0 0 1 1 12.5v-9z"/>
        <path fill="currentColor" d="M8.5 5.5v3.793l1.146-1.147.708.708L8 11.207 5.646 8.854l.708-.708L7.5 9.293V5.5h1z"/>
      </svg>`;
      const collapse = $("btn-collapse-all");
      if (collapse) actions.insertBefore(btn, collapse);
      else actions.appendChild(btn);
    }
    if (!$("btn-collapse-all")) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tree-action";
      btn.id = "btn-collapse-all";
      btn.title = tt("service.scripts.collapseAll", "Collapse All");
      btn.setAttribute("aria-label", btn.title);
      btn.setAttribute("data-i18n-title", "service.scripts.collapseAll");
      btn.setAttribute("data-i18n-aria", "service.scripts.collapseAll");
      btn.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path fill="currentColor" d="M1 4.5 8 1l7 3.5v1.25L8 2.25 1 5.75V4.5zm0 4L8 5.5l7 3v1.25L8 6.75 1 9.75V8.5zm0 4L8 9.5l7 3V13.75L8 10.75 1 13.75V12.5z"/>
      </svg>`;
      actions.appendChild(btn);
    }
  }

  function ensureEditorChrome() {
    const pane = document.querySelector(".editor-pane");
    const ta = $("script-body");
    if (!pane || !ta) return;
    if (!$("editor-tabs")) {
      const tabs = document.createElement("div");
      tabs.className = "editor-tabs";
      tabs.id = "editor-tabs";
      tabs.setAttribute("role", "tablist");
      tabs.setAttribute("aria-label", "Open editors");
      pane.insertBefore(tabs, pane.firstChild);
    }
    if (!$("editor-breadcrumbs")) {
      const crumbs = document.createElement("nav");
      crumbs.className = "editor-breadcrumbs";
      crumbs.id = "editor-breadcrumbs";
      crumbs.setAttribute("aria-label", "Breadcrumb");
      crumbs.hidden = true;
      const tabsEl = $("editor-tabs");
      const codeEl = $("editor-code");
      if (tabsEl && tabsEl.nextSibling) pane.insertBefore(crumbs, tabsEl.nextSibling);
      else if (codeEl) pane.insertBefore(crumbs, codeEl);
      else pane.appendChild(crumbs);
    }
    let code = $("editor-code");
    if (!code) {
      code = document.createElement("div");
      code.className = "editor-code";
      code.id = "editor-code";
      const label = pane.querySelector('label[for="script-body"]');
      if (label) code.appendChild(label);
      ta.parentElement?.insertBefore(code, ta);
      code.appendChild(ta);
    }
    ta.setAttribute("wrap", "off");
    if (!$("editor-gutter")) {
      const gutter = document.createElement("div");
      gutter.className = "editor-gutter";
      gutter.id = "editor-gutter";
      gutter.setAttribute("aria-hidden", "true");
      code.insertBefore(gutter, code.firstChild);
    }

    const workspace = $("programs-workspace");
    if (workspace && !$("editor-statusbar")) {
      const bar = document.createElement("footer");
      bar.className = "editor-statusbar";
      bar.id = "editor-statusbar";
      bar.setAttribute("role", "status");
      bar.setAttribute("aria-live", "polite");
      bar.innerHTML = `<div class="statusbar-left"><span class="statusbar-item" id="statusbar-path"></span></div>
        <div class="statusbar-right">
          <span class="statusbar-item" id="statusbar-cursor">Ln 1, Col 1</span>
          <span class="statusbar-item" id="statusbar-lang">MSOS</span>
        </div>`;
      workspace.appendChild(bar);
    }
  }

  function cursorLineCol(ta) {
    if (!ta) return { line: 1, col: 1 };
    const pos = Math.max(0, Number(ta.selectionStart) || 0);
    const before = String(ta.value || "").slice(0, pos);
    const parts = before.split("\n");
    return {
      line: parts.length || 1,
      col: String(parts[parts.length - 1] || "").length + 1,
    };
  }

  function syncBreadcrumbs() {
    ensureEditorChrome();
    const bar = $("editor-breadcrumbs");
    if (!bar) return;
    const s = activeScript();
    if (!s) {
      bar.innerHTML = "";
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    const folder = normalizeFolder(s.folder);
    const parts = folder ? folder.split("/").filter(Boolean) : [];
    let html = `<button type="button" class="breadcrumb-item" data-crumb-root="1" title="${escapeHtml(
      tt("service.scripts.treeRoot", "Programs")
    )}">${escapeHtml(tt("service.scripts.treeRoot", "Programs"))}</button>`;
    let acc = "";
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part;
      html += `<span class="breadcrumb-sep" aria-hidden="true">›</span>`;
      html += `<button type="button" class="breadcrumb-item" data-crumb-folder="${escapeHtml(
        acc
      )}" title="${escapeHtml(acc)}">${escapeHtml(part)}</button>`;
    }
    html += `<span class="breadcrumb-sep" aria-hidden="true">›</span>`;
    html += `<button type="button" class="breadcrumb-item is-current" data-crumb-file="${escapeHtml(
      s.id
    )}" title="${escapeHtml(s.name)}" disabled>
      <img class="breadcrumb-icon" src="msos-mark.png" alt="" width="12" height="12" />
      <span>${escapeHtml(s.name)}</span>
    </button>`;
    bar.innerHTML = html;
  }

  function revealCrumbFolder(folder) {
    const f = normalizeFolder(folder);
    if (f) expandFolderPath(f);
    state.activeFolder = f;
    renderList();
    void persistExpanded();
  }

  function syncStatusBar() {
    ensureEditorChrome();
    syncBreadcrumbs();
    const pathEl = $("statusbar-path");
    const cursorEl = $("statusbar-cursor");
    const langEl = $("statusbar-lang");
    const ta = $("script-body");
    const s = activeScript();
    if (pathEl) {
      if (s) {
        const folder = normalizeFolder(s.folder);
        pathEl.textContent = folder ? `${folder}/${s.name}` : s.name;
        pathEl.title = pathEl.textContent;
      } else {
        pathEl.textContent = "";
        pathEl.removeAttribute("title");
      }
    }
    if (langEl) langEl.textContent = s ? "MSOS" : "";
    if (cursorEl) {
      if (ta && s) {
        const { line, col } = cursorLineCol(ta);
        cursorEl.textContent = `Ln ${line}, Col ${col}`;
      } else {
        cursorEl.textContent = "";
      }
    }
  }

  function syncLineNumbers() {
    ensureEditorChrome();
    const ta = $("script-body");
    const gutter = $("editor-gutter");
    if (!ta || !gutter) {
      syncStatusBar();
      return;
    }
    const text = String(ta.value || "");
    const count = text.length ? text.split("\n").length : 1;
    const digits = String(count).length;
    gutter.style.minWidth = `${Math.max(2.75, 1.1 + digits * 0.65)}rem`;
    if (Number(gutter.dataset.lines || 0) !== count) {
      gutter.dataset.lines = String(count);
      let html = "";
      for (let i = 1; i <= count; i += 1) {
        html += `<span class="editor-gutter-line">${i}</span>`;
      }
      gutter.innerHTML = html;
    }
    gutter.scrollTop = ta.scrollTop;
    syncStatusBar();
  }

  function markDirty(on = true) {
    const next = !!on;
    const wasDirty = state.activeId ? isScriptDirty(state.activeId) : state.dirty;
    state.dirty = next;
    if (state.activeId) setScriptDirty(state.activeId, state.dirty);
    if (wasDirty !== next) renderTabs();
    const meta = $("script-meta");
    if (!meta) return;
    const s = activeScript();
    if (!s) {
      meta.textContent = state.activeFolder
        ? tt("service.scripts.folderSelected", `Folder: ${state.activeFolder}`, {
            folder: state.activeFolder,
          })
        : tt(
            "service.scripts.meta",
            "Command-line name: type it after right-click on the desktop"
          );
      return;
    }
    const cmd = s.name || "name";
    const folder = normalizeFolder(s.folder);
    const steps = countLines(s.body);
    const pathLabel = folder ? `${folder}/${cmd}` : cmd;
    const base = tt(
      "service.scripts.metaLine",
      `${pathLabel} · ${steps} steps · ${formatWhen(s.updatedAt)}`,
      {
        name: cmd,
        path: pathLabel,
        steps,
        when: formatWhen(s.updatedAt),
      }
    );
    meta.textContent = base;
  }

  function renderList() {
    const list = $("script-list");
    if (!list) return;
    const byParent = buildTreeModel();
    const root = byParent.get("") || { folders: [], files: [] };
    const drafting =
      !!state.creatingFolder || !!state.creatingFile || !!state.renaming;
    if (!root.folders.length && !root.files.length && !drafting) {
      list.innerHTML = `<div class="tree-empty">
        <p>${escapeHtml(tt("service.scripts.noScripts", "No programs yet."))}</p>
        <p class="tree-empty-hint">${escapeHtml(
          tt("service.scripts.treeEmptyHint", "Create a folder or a program to begin.")
        )}</p>
      </div>`;
      return;
    }
    list.innerHTML = treeRowsHtml("", 0, byParent);
    if (state.creatingFolder) {
      const input = $("tree-folder-input");
      if (input) {
        requestAnimationFrame(() => {
          input.focus();
          input.select();
        });
      }
    } else if (state.creatingFile) {
      const input = $("tree-file-input");
      if (input) {
        requestAnimationFrame(() => {
          input.focus();
        });
      }
    } else if (state.renaming) {
      const input = $("tree-rename-input");
      if (input) {
        requestAnimationFrame(() => focusRenameInput(input));
      }
    }
  }

  function cancelInlineFolder() {
    if (!state.creatingFolder) return;
    state.creatingFolder = null;
    renderList();
  }

  async function commitInlineFolder() {
    if (!state.creatingFolder) return;
    const input = $("tree-folder-input");
    const name = String(input?.value || "").trim();
    const parent = normalizeFolder(state.creatingFolder.parent);
    state.creatingFolder = null;
    if (!name) {
      renderList();
      return;
    }
    const segment = normalizeFolder(name.split(/[/\\]/).filter(Boolean).pop() || "");
    if (!segment) {
      renderList();
      return;
    }
    const folder = parent ? `${parent}/${segment}` : segment;
    try {
      const res = await invoke("folders.create", { folder });
      if (!res?.ok) {
        renderList();
        window.alert(res?.error || "Could not create folder");
        return;
      }
      state.settings = { ...state.settings, ...(res.settings || {}) };
      state.activeFolder = folder;
      state.activeId = null;
      if ($("script-name")) $("script-name").value = "";
      if ($("script-body")) $("script-body").value = "";
      syncLineNumbers();
      renderList();
      markDirty(false);
    } catch (err) {
      renderList();
      window.alert(err?.message || "Could not create folder");
    }
  }

  function focusRenameInput(input) {
    if (!input) return;
    input.focus();
    const kind = input.getAttribute("data-rename-kind");
    if (kind === "file") {
      const val = String(input.value || "");
      const m = val.match(/^(.*)(\.[A-Za-z0-9]{1,16})$/);
      const end = m ? m[1].length : stripProgramExt(val).length;
      input.setSelectionRange(0, Math.max(0, end));
    } else {
      input.select();
    }
  }

  function cancelRename() {
    if (!state.renaming) return;
    state.renaming = null;
    renderList();
  }

  function beginRenameFile(id) {
    const script = state.scripts.find((s) => s.id === id);
    if (!script) return;
    if (state.creatingFolder) cancelInlineFolder();
    if (state.creatingFile) cancelInlineFile();
    hideContextMenu();
    state.renaming = { kind: "file", id };
    state.activeId = id;
    state.activeFolder = normalizeFolder(script.folder);
    renderList();
  }

  function beginRenameFolder(folder) {
    const f = normalizeFolder(folder);
    if (!f) return;
    if (state.creatingFolder) cancelInlineFolder();
    if (state.creatingFile) cancelInlineFile();
    hideContextMenu();
    state.renaming = { kind: "folder", folder: f };
    state.activeFolder = f;
    state.activeId = null;
    renderList();
  }

  function beginRenameSelection() {
    if (state.renaming || state.creatingFolder || state.creatingFile) return;
    if (state.activeId) {
      beginRenameFile(state.activeId);
      return;
    }
    if (state.activeFolder) beginRenameFolder(state.activeFolder);
  }

  async function commitRename() {
    if (!state.renaming) return;
    const input = $("tree-rename-input");
    const raw = String(input?.value || "").trim();
    const current = state.renaming;
    state.renaming = null;
    if (!raw) {
      renderList();
      return;
    }
    try {
      if (current.kind === "file") {
        const script = state.scripts.find((s) => s.id === current.id);
        if (!script) {
          renderList();
          return;
        }
        const nextName = ensureProgramExt(raw);
        if (namesMatch(script.name, nextName)) {
          renderList();
          return;
        }
        const res = await invoke("scripts.update", {
          id: script.id,
          name: nextName,
          body: script.id === state.activeId ? $("script-body")?.value ?? script.body : script.body,
          folder: script.folder || "",
        });
        if (!res?.ok) {
          renderList();
          window.alert(res?.error || "Rename failed");
          return;
        }
        const idx = state.scripts.findIndex((x) => x.id === script.id);
        if (idx >= 0) state.scripts[idx] = res.script;
        if (state.activeId === script.id) {
          if ($("script-name")) $("script-name").value = res.script.name;
          state.dirty = false;
        }
        rememberSaved(res.script);
        setScriptDirty(res.script.id, false);
        renderList();
        renderTabs();
        markDirty(false);
        return;
      }
      const from = normalizeFolder(current.folder);
      const segment = normalizeFolder(raw.split(/[/\\]/).filter(Boolean).pop() || "");
      if (!segment || segment === folderBasename(from)) {
        renderList();
        return;
      }
      const res = await invoke("folders.rename", { from, to: segment });
      if (!res?.ok) {
        renderList();
        window.alert(res?.error || "Rename failed");
        return;
      }
      if (Array.isArray(res.scripts)) {
        state.scripts = res.scripts.map((s) => ({
          ...s,
          folder: normalizeFolder(s.folder),
        }));
      }
      if (res.settings) state.settings = { ...state.settings, ...res.settings };
      const to = normalizeFolder(res.folder || "");
      if (to) {
        state.activeFolder = to;
        expandFolderPath(to);
      }
      renderList();
      markDirty(false);
    } catch (err) {
      renderList();
      window.alert(err?.message || "Rename failed");
    }
  }
  function cancelInlineFile() {
    if (!state.creatingFile) return;
    state.creatingFile = null;
    renderList();
  }

  async function commitInlineFile() {
    if (!state.creatingFile) return;
    const input = $("tree-file-input");
    const raw = String(input?.value || "").trim();
    const parent = normalizeFolder(state.creatingFile.parent);
    state.creatingFile = null;
    if (!raw || !stripProgramExt(raw)) {
      renderList();
      return;
    }
    const name = ensureProgramExt(raw);
    try {
      const res = await invoke("scripts.create", { name, folder: parent });
      if (!res?.ok) {
        renderList();
        window.alert(res?.error || "Create failed");
        return;
      }
      if (parent) {
        expandFolderPath(parent);
        state.settings.folders = [...new Set([...(state.settings.folders || []), parent])];
      }
      if (res.settings) state.settings = { ...state.settings, ...res.settings };
      state.scripts.unshift(res.script);
      selectScript(res.script.id);
    } catch (err) {
      renderList();
      window.alert(err?.message || "Create failed");
    }
  }

  function createFolder(parentOverride) {
    if (state.renaming) cancelRename();
    if (state.creatingFile) cancelInlineFile();
    setMode("programs");
    const parent =
      parentOverride != null ? normalizeFolder(parentOverride) : normalizeFolder(state.activeFolder);
    if (parent) expandFolderPath(parent);
    state.creatingFolder = { parent };
    state.activeFolder = parent;
    state.activeId = null;
    hideContextMenu();
    renderList();
  }

  function hideContextMenu() {
    const menu = $("tree-context-menu");
    if (menu) {
      menu.hidden = true;
      menu.innerHTML = "";
    }
  }

  function placeContextMenu(x, y) {
    const menu = $("tree-context-menu");
    if (!menu) return;
    menu.hidden = false;
    const pad = 8;
    const rect = menu.getBoundingClientRect();
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth - pad) left = window.innerWidth - rect.width - pad;
    if (top + rect.height > window.innerHeight - pad) top = window.innerHeight - rect.height - pad;
    if (left < pad) left = pad;
    if (top < pad) top = pad;
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  function showContextMenu(x, y, items) {
    const menu = $("tree-context-menu");
    if (!menu || !items?.length) return;
    menu.innerHTML = items
      .map((item) => {
        if (item.sep) return `<div class="tree-menu-sep" role="separator"></div>`;
        const danger = item.danger ? " tree-menu-item--danger" : "";
        return `<button type="button" class="tree-menu-item${danger}" role="menuitem" data-action="${escapeHtml(
          item.action
        )}">${escapeHtml(item.label)}</button>`;
      })
      .join("");
    placeContextMenu(x, y);
    requestAnimationFrame(() => placeContextMenu(x, y));
  }

  async function runContextAction(action) {
    const menu = $("tree-context-menu");
    const id = menu?.dataset.id || "";
    const folder = normalizeFolder(menu?.dataset.folder || "");
    hideContextMenu();
    if (action === "new-program") {
      await createNew(folder);
      return;
    }
    if (action === "import-file") {
      await importFile(folder);
      return;
    }
    if (action === "import-folder") {
      await importFolder(folder);
      return;
    }
    if (action === "new-folder") {
      createFolder(folder);
      return;
    }
    if (action === "rename") {
      if (id) beginRenameFile(id);
      else if (folder) beginRenameFolder(folder);
      return;
    }
    if (action === "run") {
      await run(id);
      return;
    }
    if (action === "duplicate") {
      await duplicate(id);
      return;
    }
    if (action === "delete-program") {
      await remove(id);
      return;
    }
    if (action === "export") {
      if (id && id !== state.activeId) selectScript(id);
      await exportSpace();
      return;
    }
    if (action === "delete-folder") {
      await deleteFolder(folder);
    }
  }

  function openFileContextMenu(e, id) {
    e.preventDefault();
    e.stopPropagation();
    const script = state.scripts.find((s) => s.id === id);
    if (!script) return;
    state.activeFolder = normalizeFolder(script.folder);
    const menu = $("tree-context-menu");
    if (menu) {
      menu.dataset.kind = "file";
      menu.dataset.id = id;
      menu.dataset.folder = normalizeFolder(script.folder);
    }
    showContextMenu(e.clientX, e.clientY, [
      { action: "run", label: tt("service.scripts.run", "Run") },
      { sep: true },
      { action: "rename", label: tt("service.scripts.rename", "Rename") },
      { action: "duplicate", label: tt("service.scripts.duplicate", "Duplicate") },
      { action: "export", label: tt("service.scripts.export", "Export .space") },
      { sep: true },
      { action: "delete-program", label: tt("service.scripts.delete", "Delete"), danger: true },
    ]);
  }

  function openFolderContextMenu(e, folder) {
    e.preventDefault();
    e.stopPropagation();
    const f = normalizeFolder(folder);
    state.activeFolder = f;
    state.activeId = null;
    const menu = $("tree-context-menu");
    if (menu) {
      menu.dataset.kind = "folder";
      menu.dataset.id = "";
      menu.dataset.folder = f;
    }
    showContextMenu(e.clientX, e.clientY, [
      { action: "new-program", label: tt("service.scripts.new", "New program") },
      { action: "import-file", label: tt("service.scripts.importFile", "Import file…") },
      { action: "import-folder", label: tt("service.scripts.importFolder", "Import folder…") },
      { action: "new-folder", label: tt("service.scripts.newFolder", "New folder") },
      { action: "rename", label: tt("service.scripts.rename", "Rename") },
      { sep: true },
      {
        action: "delete-folder",
        label: tt("service.scripts.deleteFolder", "Delete Folder"),
        danger: true,
      },
    ]);
  }

  function openTreeBlankContextMenu(e) {
    e.preventDefault();
    state.activeFolder = "";
    const menu = $("tree-context-menu");
    if (menu) {
      menu.dataset.kind = "blank";
      menu.dataset.id = "";
      menu.dataset.folder = "";
    }
    showContextMenu(e.clientX, e.clientY, [
      { action: "new-program", label: tt("service.scripts.new", "New program") },
      { action: "import-file", label: tt("service.scripts.importFile", "Import file…") },
      { action: "import-folder", label: tt("service.scripts.importFolder", "Import folder…") },
      { action: "new-folder", label: tt("service.scripts.newFolder", "New folder") },
    ]);
  }

  async function confirmLeave() {
    return window.confirm(
      tt("service.scripts.confirmDiscard", "You have unsaved changes. Discard them?")
    );
  }

  function selectScript(id) {
    const s = state.scripts.find((x) => x.id === id);
    if (!s) return;
    if (state.activeId && state.activeId !== s.id) {
      readEditorIntoState();
    }
    openTab(s.id);
    if (!state.savedSnap[s.id]) rememberSaved(s);
    state.activeId = s.id;
    state.activeFolder = normalizeFolder(s.folder);
    if (state.activeFolder) expandFolderPath(state.activeFolder);
    const nameEl = $("script-name");
    const bodyEl = $("script-body");
    if (nameEl) nameEl.value = s.name;
    if (bodyEl) bodyEl.value = s.body;
    state.dirty = isScriptDirty(s.id);
    renderList();
    renderTabs();
    markDirty(state.dirty);
    syncLineNumbers();
    syncStatusBar();
  }

  function readEditorIntoState() {
    const s = activeScript();
    if (!s) return null;
    const raw = ($("script-name")?.value || s.name).trim() || s.name;
    s.name = ensureProgramExt(raw);
    if ($("script-name") && $("script-name").value !== s.name) {
      $("script-name").value = s.name;
    }
    s.body = $("script-body")?.value ?? s.body;
    return s;
  }

  async function refresh() {
    const res = await invoke("storage.load");
    if (!res?.ok) throw new Error(res?.error || "Load failed");
    state.scripts = (res.data.scripts || []).map((s) => ({
      ...s,
      folder: normalizeFolder(s.folder),
    }));
    state.scripts.forEach((s) => {
      if (!state.savedSnap[s.id] || !isScriptDirty(s.id)) rememberSaved(s);
    });
    state.openTabIds = state.openTabIds.filter((id) =>
      state.scripts.some((s) => s.id === id)
    );
    state.settings = {
      stopOnError: true,
      folders: [],
      expandedFolders: [],
      ...(res.data.settings || {}),
    };
    const stop = $("stop-on-error");
    if (stop) stop.checked = state.settings.stopOnError !== false;
    syncStopOnErrorUi(state.settings.stopOnError);
    if (!state.activeId || !state.scripts.some((s) => s.id === state.activeId)) {
      state.activeId = state.scripts[0]?.id || null;
    }
    if (state.activeId) {
      openTab(state.activeId);
      selectScript(state.activeId);
    } else {
      renderList();
      renderTabs();
      if ($("script-name")) $("script-name").value = "";
      if ($("script-body")) $("script-body").value = "";
      syncLineNumbers();
      markDirty(false);
    }
  }

  async function save() {
    const s = readEditorIntoState();
    if (!s) return;
    const res = await invoke("scripts.update", {
      id: s.id,
      name: s.name,
      body: s.body,
      folder: s.folder || "",
    });
    if (!res?.ok) {
      window.alert(res?.error || "Save failed");
      return;
    }
    const idx = state.scripts.findIndex((x) => x.id === s.id);
    if (idx >= 0) state.scripts[idx] = res.script;
    rememberSaved(res.script);
    setScriptDirty(res.script.id, false);
    state.dirty = false;
    renderList();
    renderTabs();
    markDirty(false);
  }

  async function importFile(parentOverride) {
    if (state.renaming) cancelRename();
    if (state.creatingFolder) cancelInlineFolder();
    if (state.creatingFile) cancelInlineFile();
    if (state.activeId) readEditorIntoState();
    setMode("programs");
    const parent =
      parentOverride != null ? normalizeFolder(parentOverride) : normalizeFolder(state.activeFolder);
    hideContextMenu();
    try {
      const res = await invoke("scripts.importFile", { folder: parent });
      if (res?.cancelled) return;
      if (!res?.ok) {
        window.alert(res?.error || tt("service.scripts.importFailed", "Import failed"));
        return;
      }
      if (res.settings) state.settings = { ...state.settings, ...res.settings };
      if (parent) {
        expandFolderPath(parent);
        state.settings.folders = [...new Set([...(state.settings.folders || []), parent])];
      }
      if (res.script) {
        const idx = state.scripts.findIndex((s) => s.id === res.script.id);
        if (idx >= 0) state.scripts[idx] = res.script;
        else state.scripts.unshift(res.script);
        selectScript(res.script.id);
      } else {
        renderList();
      }
    } catch (err) {
      window.alert(err?.message || tt("service.scripts.importFailed", "Import failed"));
    }
  }

  async function importFolder(parentOverride) {
    if (state.renaming) cancelRename();
    if (state.creatingFolder) cancelInlineFolder();
    if (state.creatingFile) cancelInlineFile();
    if (state.activeId) readEditorIntoState();
    setMode("programs");
    const parent =
      parentOverride != null ? normalizeFolder(parentOverride) : normalizeFolder(state.activeFolder);
    hideContextMenu();
    try {
      const res = await invoke("scripts.importFolder", { folder: parent });
      if (res?.cancelled) return;
      if (!res?.ok) {
        window.alert(res?.error || tt("service.scripts.importFailed", "Import failed"));
        return;
      }
      if (res.settings) state.settings = { ...state.settings, ...res.settings };
      const imported = Array.isArray(res.scripts) ? res.scripts : [];
      for (const script of imported) {
        const idx = state.scripts.findIndex((s) => s.id === script.id);
        if (idx >= 0) state.scripts[idx] = script;
        else state.scripts.unshift(script);
      }
      if (res.folder) {
        expandFolderPath(res.folder);
        state.activeFolder = normalizeFolder(res.folder);
        state.settings.folders = [
          ...new Set([...(state.settings.folders || []), res.folder]),
        ];
      }
      if (imported[0]) selectScript(imported[0].id);
      else {
        renderList();
        renderTabs();
      }
    } catch (err) {
      window.alert(err?.message || tt("service.scripts.importFailed", "Import failed"));
    }
  }

  async function createNew(parentOverride) {
    if (state.renaming) cancelRename();
    if (state.creatingFolder) cancelInlineFolder();
    if (state.activeId) readEditorIntoState();
    setMode("programs");
    const parent =
      parentOverride != null ? normalizeFolder(parentOverride) : normalizeFolder(state.activeFolder);
    if (parent) expandFolderPath(parent);
    state.creatingFile = { parent };
    state.activeFolder = parent;
    state.activeId = null;
    if ($("script-name")) $("script-name").value = "";
    if ($("script-body")) $("script-body").value = "";
    syncLineNumbers();
    hideContextMenu();
    renderList();
    renderTabs();
    markDirty(false);
  }

  async function duplicate(scriptId) {
    const id = scriptId || state.activeId;
    const s = state.scripts.find((x) => x.id === id);
    if (!s) return;
    if (state.activeId === id && state.dirty) await save();
    const res = await invoke("scripts.duplicate", { id });
    if (!res?.ok) {
      window.alert(res?.error || "Duplicate failed");
      return;
    }
    state.scripts.unshift(res.script);
    selectScript(res.script.id);
  }

  async function remove(scriptId) {
    const id = scriptId || state.activeId;
    const s = state.scripts.find((x) => x.id === id);
    if (!s) return;
    if (
      !window.confirm(
        tt("service.scripts.confirmDelete", `Delete program "${s.name}"?`, { name: s.name })
      )
    ) {
      return;
    }
    const res = await invoke("scripts.delete", { id });
    if (!res?.ok) {
      window.alert(res?.error || "Delete failed");
      return;
    }
    state.scripts = state.scripts.filter((x) => x.id !== id);
    state.openTabIds = state.openTabIds.filter((x) => x !== id);
    setScriptDirty(id, false);
    delete state.savedSnap[id];
    if (state.activeId === id) {
      state.activeId = state.openTabIds[state.openTabIds.length - 1] || state.scripts[0]?.id || null;
      state.dirty = false;
      if (state.activeId) selectScript(state.activeId);
      else {
        renderList();
        renderTabs();
        if ($("script-name")) $("script-name").value = "";
        if ($("script-body")) $("script-body").value = "";
        syncLineNumbers();
        markDirty(false);
      }
    } else {
      renderList();
      renderTabs();
    }
  }

  async function deleteFolder(folderPath) {
    const folder = normalizeFolder(folderPath);
    if (!folder) return;
    const nested = state.scripts.filter((s) => {
      const f = normalizeFolder(s.folder);
      return f === folder || f.startsWith(`${folder}/`);
    });
    const msg = nested.length
      ? tt(
          "service.scripts.confirmDeleteFolderWithPrograms",
          `Delete folder "${folderBasename(folder)}" and ${nested.length} program(s) inside?`,
          { name: folderBasename(folder), count: nested.length }
        )
      : tt(
          "service.scripts.confirmDeleteFolder",
          `Delete folder "${folderBasename(folder)}"?`,
          { name: folderBasename(folder) }
        );
    if (!window.confirm(msg)) return;
    const res = await invoke("folders.delete", { folder, deleteContents: true });
    if (!res?.ok) {
      window.alert(res?.error || "Could not delete folder");
      return;
    }
    state.settings = { ...state.settings, ...(res.settings || {}) };
    state.scripts = (res.scripts || []).map((s) => ({
      ...s,
      folder: normalizeFolder(s.folder),
    }));
    state.openTabIds = state.openTabIds.filter((id) =>
      state.scripts.some((s) => s.id === id)
    );
    Object.keys(state.dirtyIds).forEach((id) => {
      if (!state.scripts.some((s) => s.id === id)) delete state.dirtyIds[id];
    });
    Object.keys(state.savedSnap).forEach((id) => {
      if (!state.scripts.some((s) => s.id === id)) delete state.savedSnap[id];
    });
    if (state.activeFolder === folder || state.activeFolder.startsWith(`${folder}/`)) {
      state.activeFolder = "";
    }
    if (state.activeId && !state.scripts.some((s) => s.id === state.activeId)) {
      state.activeId = state.openTabIds[state.openTabIds.length - 1] || state.scripts[0]?.id || null;
      state.dirty = false;
      if (state.activeId) selectScript(state.activeId);
      else {
        if ($("script-name")) $("script-name").value = "";
        if ($("script-body")) $("script-body").value = "";
        syncLineNumbers();
        markDirty(false);
      }
    }
    renderList();
    renderTabs();
  }
  function paintLog(results, summary) {
    const log = $("output-log");
    if (!log) return;
    if (!results?.length && !summary) {
      log.innerHTML = `<p class="output-empty">${escapeHtml(
        tt("service.scripts.outputEmpty", "Run a program to see each step here.")
      )}</p>`;
      return;
    }
    if (!results?.length) {
      const sum = summary
        ? `<p class="output-summary ${summary.ok ? "is-ok" : "is-err"}">${escapeHtml(summary.text)}</p>`
        : "";
      log.innerHTML =
        sum ||
        `<p class="output-empty">${escapeHtml(
          tt("service.scripts.outputEmpty", "Run a program to see each step here.")
        )}</p>`;
      return;
    }
    const rows = results
      .map(
        (r, i) => `<div class="output-row ${r.ok ? "ok" : "err"}">
        <span class="output-idx">${r.ok ? "ok" : "err"} ${i + 1}</span>
        <code class="output-cmd">${escapeHtml(r.line)}</code>
        <span class="output-msg">${escapeHtml(r.message || "")}</span>
      </div>`
      )
      .join("");
    const sum = summary
      ? `<p class="output-summary ${summary.ok ? "is-ok" : "is-err"}">${escapeHtml(summary.text)}</p>`
      : "";
    log.innerHTML = rows + sum;
    log.scrollTop = log.scrollHeight;
  }

  function pushRunToSession(results, summary, programName) {
    if (programName) {
      appendSession({
        source: "language",
        ok: !!summary?.ok,
        command: `scripts(run ${programName})`,
        message: summary?.text || "",
      });
    }
    (results || []).forEach((r) => {
      appendSession({
        source: detectSource(r.line),
        ok: !!r.ok,
        command: r.line,
        message: r.message || "",
      });
    });
  }

  async function run(scriptId) {
    if (state.running) return;
    const targetId = String(scriptId || state.activeId || "").trim();
    if (targetId && targetId !== state.activeId) {
      selectScript(targetId);
    }
    const s = readEditorIntoState();
    if (!s) return;
    if (state.mode !== "programs") setMode("programs");
    if (state.dirty) {
      try {
        await save();
      } catch {
      }
    }
    const stopOnError = $("stop-on-error")?.checked !== false;
    state.running = true;
    const btn = $("btn-run");
    if (btn) {
      btn.disabled = true;
      btn.textContent = tt("service.scripts.running", "Running…");
    }
    paintLog([], null);
    try {
      setTerminalOpen(true);
      const res = await invoke("scripts.run", {
        id: s.id,
        name: s.name,
        body: $("script-body")?.value ?? s.body, 
        stopOnError,
      });
      const payload = res?.results != null || res?.ran != null ? res : res?.data || res || {};
      const results = Array.isArray(payload.results) ? payload.results : [];
      const done = Number(payload.ran ?? results.length) || 0;
      const total = Number(payload.total ?? results.length) || 0;
      const text =
        payload.message ||
        payload.error ||
        res?.error ||
        (payload.stopped
          ? tt("service.scripts.stoppedAfter", `Stopped after step ${done}`, {
              ran: done,
              total,
              n: done,
            })
          : tt("service.scripts.finishedSteps", `Finished ${done}/${total} steps`, {
              done,
              total,
              count: done,
            }));
      const summary = { ok: !!payload.ok, text };
      paintLog(results, summary);
      pushRunToSession(results, summary, s.name);
    } catch (err) {
      const results = [{ line: "(runner)", ok: false, message: err?.message || String(err) }];
      const summary = { ok: false, text: tt("service.scripts.runnerFailed", "Runner failed") };
      paintLog(results, summary);
      pushRunToSession(results, summary, s.name);
    } finally {
      state.running = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = tt("service.scripts.run", "Run");
      }
    }
  }

  function openScript(nameOrId) {
    const ref = String(nameOrId || "").trim();
    if (!ref) return false;
    const hit = state.scripts.find(
      (s) => s.id === ref || namesMatch(s.name, ref)
    );
    if (!hit) return false;
    setMode("programs");
    selectScript(hit.id);
    return true;
  }
  async function openAndRun(nameOrId) {
    const ok = openScript(nameOrId);
    if (!ok) return { ok: false, error: "Script not found" };
    await run();
    return { ok: true };
  }

  async function exportSpace() {
    const s = readEditorIntoState() || activeScript();
    if (!s) return;
    if (state.dirty) {
      try {
        await save();
      } catch {
      }
    }
    if (!window.spaceFile?.export) {
      const results = [
        {
          line: "(export)",
          ok: false,
          message: tt("service.scripts.exportUnavailable", "Export unavailable"),
        },
      ];
      const summary = {
        ok: false,
        text: tt("service.scripts.couldNotExport", "Could not export .space"),
      };
      paintLog(results, summary);
      pushRunToSession(results, summary, s.name);
      return;
    }
    try {
      const res = await window.spaceFile.export({
        kind: "script",
        payload: { name: s.name, body: $("script-body")?.value ?? s.body },
      });
      if (res?.cancelled) return;
      if (!res?.ok) throw new Error(res?.error || "Export failed");
      const summary = { ok: true, text: res.message || `Exported ${res.path}` };
      paintLog([], summary);
      appendSession({
        source: "system",
        ok: true,
        command: `pack(export script ${s.name})`,
        message: summary.text,
      });
    } catch (err) {
      const results = [{ line: "(export)", ok: false, message: err?.message || String(err) }];
      const summary = {
        ok: false,
        text: tt("service.scripts.couldNotExport", "Could not export .space"),
      };
      paintLog(results, summary);
      pushRunToSession(results, summary, s.name);
    }
  }

  function moveEditorLines(ta, dir) {
    if (!ta || (dir !== -1 && dir !== 1)) return false;
    const text = String(ta.value || "");
    let a = ta.selectionStart;
    let b = ta.selectionEnd;
    if (b < a) {
      const t = a;
      a = b;
      b = t;
    }
    let endPos = b;
    if (b > a && text[b - 1] === "\n") endPos = b - 1;
    const blockStart = text.lastIndexOf("\n", a - 1) + 1;
    const blockEndNl = text.indexOf("\n", endPos);
    const blockEnd = blockEndNl === -1 ? text.length : blockEndNl + 1;
    if (dir === -1) {
      if (blockStart === 0) return false;
      const prevStart = text.lastIndexOf("\n", blockStart - 2) + 1;
      const prev = text.slice(prevStart, blockStart);
      const block = text.slice(blockStart, blockEnd);
      ta.value = text.slice(0, prevStart) + block + prev + text.slice(blockEnd);
      const delta = -prev.length;
      ta.selectionStart = a + delta;
      ta.selectionEnd = b + delta;
    } else {
      if (blockEnd >= text.length) return false;
      const nextNl = text.indexOf("\n", blockEnd);
      const nextEnd = nextNl === -1 ? text.length : nextNl + 1;
      const block = text.slice(blockStart, blockEnd);
      const next = text.slice(blockEnd, nextEnd);
      ta.value = text.slice(0, blockStart) + next + block + text.slice(nextEnd);
      const delta = next.length;
      ta.selectionStart = a + delta;
      ta.selectionEnd = b + delta;
    }
    ta.dispatchEvent(new Event("input"));
    return true;
  }

  function bind() {
    ensureTreeToolbarButtons();
    $("mode-strip")?.addEventListener("click", (e) => {
      const tab = e.target.closest("[data-mode]");
      if (!tab) return;
      setMode(tab.dataset.mode);
    });
    $("btn-new")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      Promise.resolve(createNew()).catch((err) =>
        window.alert(err?.message || String(err))
      );
    });
    $("btn-new-folder")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        createFolder();
      } catch (err) {
        window.alert(err?.message || String(err));
      }
    });
    $("btn-import-file")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      Promise.resolve(importFile()).catch((err) =>
        window.alert(err?.message || String(err))
      );
    });
    $("btn-import-folder")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      Promise.resolve(importFolder()).catch((err) =>
        window.alert(err?.message || String(err))
      );
    });
    $("btn-collapse-all")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      Promise.resolve(collapseAllFolders()).catch((err) =>
        window.alert(err?.message || String(err))
      );
    });
    $("btn-clear-log")?.addEventListener("click", () => paintLog([], null));
    $("btn-clear-session")?.addEventListener("click", () => clearSession());
    const onStopChange = async (e) => {
      const on = !!e.target.checked;
      state.settings.stopOnError = on;
      syncStopOnErrorUi(on);
      await invoke("settings.patch", { stopOnError: on });
    };
    $("stop-on-error")?.addEventListener("change", onStopChange);
    $("stop-on-error-ui")?.addEventListener("change", onStopChange);
    const shell = document.getElementById("app-shell");
    shell?.addEventListener("click", (e) => {
      if (!e.target.closest("#tree-context-menu")) hideContextMenu();
      if (e.target.closest("#btn-close-terminal")) {
        e.preventDefault();
        setTerminalOpen(false);
        return;
      }
      if (e.target.closest("#btn-show-terminal")) {
        e.preventDefault();
        setTerminalOpen(!state.terminalOpen);
        return;
      }
      if (e.target.closest("#btn-collapse-all")) {
        e.preventDefault();
        e.stopPropagation();
        Promise.resolve(collapseAllFolders()).catch((err) =>
          window.alert(err?.message || String(err))
        );
        return;
      }
      if (e.target.closest("#btn-import-file")) {
        e.preventDefault();
        e.stopPropagation();
        Promise.resolve(importFile()).catch((err) =>
          window.alert(err?.message || String(err))
        );
        return;
      }
      if (e.target.closest("#btn-import-folder")) {
        e.preventDefault();
        e.stopPropagation();
        Promise.resolve(importFolder()).catch((err) =>
          window.alert(err?.message || String(err))
        );
        return;
      }
      const crumbRoot = e.target.closest("[data-crumb-root]");
      if (crumbRoot) {
        e.preventDefault();
        state.activeFolder = "";
        renderList();
        return;
      }
      const crumbFolder = e.target.closest("[data-crumb-folder]");
      if (crumbFolder) {
        e.preventDefault();
        revealCrumbFolder(crumbFolder.getAttribute("data-crumb-folder"));
        return;
      }
      const closeTabBtn = e.target.closest("[data-close-tab]");
      if (closeTabBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (state.renaming) cancelRename();
        if (state.creatingFolder) cancelInlineFolder();
        if (state.creatingFile) cancelInlineFile();
        closeTab(closeTabBtn.getAttribute("data-close-tab"));
        return;
      }
      const tabEl = e.target.closest(".editor-tab[data-tab-id]");
      if (tabEl) {
        e.preventDefault();
        if (state.renaming) cancelRename();
        if (state.creatingFolder) cancelInlineFolder();
        if (state.creatingFile) cancelInlineFile();
        if (state.mode !== "programs") setMode("programs");
        selectScript(tabEl.getAttribute("data-tab-id"));
        return;
      }

      if (
        e.target.closest("#tree-folder-input") ||
        e.target.closest("#tree-file-input") ||
        e.target.closest("#tree-rename-input") ||
        e.target.closest(".tree-row-draft") ||
        e.target.closest(".tree-row.is-renaming")
      ) {
        return;
      }
      if (state.renaming) {
        commitRename();
        return;
      }
      if (state.creatingFile) {
        commitInlineFile();
        return;
      }
      const toggle = e.target.closest("[data-toggle-folder]");
      if (toggle) {
        e.preventDefault();
        e.stopPropagation();
        if (state.creatingFolder) cancelInlineFolder();
        if (state.creatingFile) cancelInlineFile();
        toggleFolder(toggle.getAttribute("data-toggle-folder"));
        return;
      }

      const folderRow = e.target.closest(".tree-row-folder[data-folder]");
      if (folderRow) {
        e.preventDefault();
        if (state.creatingFolder) cancelInlineFolder();
        if (state.creatingFile) cancelInlineFile();
        if (state.activeId) readEditorIntoState();
        const folder = folderRow.getAttribute("data-folder");
        state.activeFolder = normalizeFolder(folder);
        state.activeId = null;
        if (!isFolderExpanded(folder)) toggleFolder(folder);
        else {
          renderList();
          renderTabs();
          markDirty(false);
        }
        return;
      }

      const fileRow = e.target.closest(".tree-row-file[data-id]");
      if (fileRow) {
        e.preventDefault();
        if (state.creatingFolder) cancelInlineFolder();
        if (state.creatingFile) cancelInlineFile();
        if (state.mode !== "programs") setMode("programs");
        selectScript(fileRow.getAttribute("data-id"));
      }
    });

    shell?.addEventListener("dblclick", (e) => {
      const nameEl = e.target.closest(".tree-name[data-rename-target]");
      if (!nameEl) return;
      e.preventDefault();
      e.stopPropagation();
      const fileRow = nameEl.closest(".tree-row-file[data-id]");
      if (fileRow) {
        beginRenameFile(fileRow.getAttribute("data-id"));
        return;
      }
      const folderRow = nameEl.closest(".tree-row-folder[data-folder]");
      if (folderRow) beginRenameFolder(folderRow.getAttribute("data-folder"));
    });

      shell?.addEventListener("contextmenu", (e) => {
      if (state.creatingFolder || state.creatingFile) return;
      const fileRow = e.target.closest(".tree-row-file[data-id]");
      if (fileRow) {
        openFileContextMenu(e, fileRow.getAttribute("data-id"));
        return;
      }
      const folderRow = e.target.closest(".tree-row-folder[data-folder]");
      if (folderRow) {
        openFolderContextMenu(e, folderRow.getAttribute("data-folder"));
        return;
      }
      if (e.target.closest("#script-list") || e.target.closest(".tree-toolbar")) {
        openTreeBlankContextMenu(e);
      }
    });
    $("tree-context-menu")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      runContextAction(btn.getAttribute("data-action"));
    });
    function cycleEditorTab(delta) {
      const ids = state.openTabIds.filter((id) => state.scripts.some((s) => s.id === id));
      if (ids.length < 2) return;
      const cur = ids.indexOf(state.activeId);
      const from = cur >= 0 ? cur : 0;
      const next = ids[(from + delta + ids.length) % ids.length];
      if (next) {
        if (state.mode !== "programs") setMode("programs");
        selectScript(next);
      }
    }

    document.addEventListener(
      "keydown",
      (e) => {
        const mod = e.ctrlKey || e.metaKey;
        const keyS = e.code === "KeyS" || e.key?.toLowerCase?.() === "s";
        const keyW = e.code === "KeyW" || e.key?.toLowerCase?.() === "w";
        const isTab = e.key === "Tab" || e.code === "Tab";
        if (mod && !e.altKey && !e.shiftKey && keyS) {
          e.preventDefault();
          e.stopPropagation();
          if (state.renaming || state.creatingFile || state.creatingFolder) return;
          if (state.mode !== "programs") setMode("programs");
          if (!activeScript()) return;
          Promise.resolve(save()).catch((err) => window.alert(err?.message || String(err)));
          return;
        }

        if (mod && !e.altKey && !e.shiftKey && keyW) {
          e.preventDefault();
          e.stopPropagation();
          if (state.renaming || state.creatingFile || state.creatingFolder) return;
          if (!state.activeId || !state.openTabIds.includes(state.activeId)) return;
          if (state.mode !== "programs") setMode("programs");
          closeTab(state.activeId);
          return;
        }
        if (mod && !e.altKey && isTab) {
          e.preventDefault();
          e.stopPropagation();
          if (state.renaming || state.creatingFile || state.creatingFolder) return;
          cycleEditorTab(e.shiftKey ? -1 : 1);
          return;
        }
        if (e.key === "Escape") {
          hideContextMenu();
          if (state.renaming) {
            e.preventDefault();
            cancelRename();
            return;
          }
          if (state.creatingFile) {
            e.preventDefault();
            cancelInlineFile();
            return;
          }
          if (state.creatingFolder) {
            e.preventDefault();
            cancelInlineFolder();
          }
          return;
        }
        if (e.key !== "F2") return;
        const tag = String(e.target?.tagName || "").toLowerCase();
        if (tag === "textarea" || (tag === "input" && e.target?.id !== "tree-rename-input")) return;
        if (state.renaming || state.creatingFolder || state.creatingFile) return;
        e.preventDefault();
        beginRenameSelection();
      },
      true
    );
    shell?.addEventListener("keydown", (e) => {
      if (e.target?.id === "tree-rename-input") {
        if (e.key === "Enter") {
          e.preventDefault();
          commitRename();
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancelRename();
        }
        return;

      }
      if (e.target?.id === "tree-file-input") {
        if (e.key === "Enter") {
          e.preventDefault();
          commitInlineFile();
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancelInlineFile();
        }
        return;
      }
      if (e.target?.id !== "tree-folder-input") return;
      if (e.key === "Enter") {
        e.preventDefault();
        commitInlineFolder();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelInlineFolder();
      }
    });
    shell?.addEventListener(
      "focusout",
      (e) => {
        if (e.target?.id === "tree-rename-input") {
          setTimeout(() => {
            if (state.renaming && $("tree-rename-input")) commitRename();
          }, 0);
          return;
        }
        if (e.target?.id === "tree-file-input") {
          setTimeout(() => {
            if (state.creatingFile && $("tree-file-input")) commitInlineFile();
          }, 0);
          return;
        }
        if (e.target?.id !== "tree-folder-input") return;
        setTimeout(() => {
          if (state.creatingFolder && $("tree-folder-input")) commitInlineFolder();
        }, 0);
      },
      true
    );
    $("script-name")?.addEventListener("input", () => {
      const s = activeScript();
      if (!s) return;
      s.name = $("script-name").value;
      markDirty(true);
      renderList();
    });
    $("script-name")?.addEventListener("blur", () => {
      const s = activeScript();
      if (!s) return;
      const next = ensureProgramExt($("script-name").value || s.name);
      if ($("script-name").value !== next) $("script-name").value = next;
      if (s.name !== next) {
        s.name = next;
        markDirty(true);
        renderList();
      }
    });
    $("script-body")?.addEventListener("input", () => {
      const s = activeScript();
      if (!s) return;
      s.body = $("script-body").value;
      markDirty(true);
      renderList();
      syncLineNumbers();
      syncStatusBar();
    });
    $("script-body")?.addEventListener("scroll", () => {
      const gutter = $("editor-gutter");
      const ta = $("script-body");
      if (gutter && ta) gutter.scrollTop = ta.scrollTop;
    });
    const syncCursor = () => syncStatusBar();
    $("script-body")?.addEventListener("keyup", syncCursor);
    $("script-body")?.addEventListener("click", syncCursor);
    $("script-body")?.addEventListener("select", syncCursor);
    $("script-body")?.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        run();
        return;
      }
      if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        (e.code === "ArrowUp" || e.code === "ArrowDown" || e.key === "ArrowUp" || e.key === "ArrowDown")
      ) {
        e.preventDefault();
        const dir = e.code === "ArrowUp" || e.key === "ArrowUp" ? -1 : 1;
        moveEditorLines(e.target, dir);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const ta = e.target;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        ta.value = `${ta.value.slice(0, start)}  ${ta.value.slice(end)}`;
        ta.selectionStart = ta.selectionEnd = start + 2;
        ta.dispatchEvent(new Event("input"));
      }
      requestAnimationFrame(syncCursor);
    });
    window.addEventListener("resize", () => {
      syncLineNumbers();
      syncStatusBar();
    });
    syncLineNumbers();
    syncStatusBar();
  }

  async function init() {
    ensureEditorChrome();
    bind();
    setMode("programs");
    setTerminalOpen(false);
    syncLineNumbers();
    syncStatusBar();
    try {
      await refresh();
    } catch (err) {
      setTerminalOpen(true);
      paintLog(
        [{ line: "(load)", ok: false, message: err?.message || String(err) }],
        { ok: false, text: tt("service.scripts.couldNotLoad", "Could not load programs") }
      );
    }
  }
  window.addEventListener("myspace-i18n-applied", () => {
    renderList();
    renderTabs();
    markDirty(state.dirty);
    const log = $("output-log");
    if (log?.querySelector(".output-empty")) paintLog([], null);
    if (state.mode === "session") renderSession();
    const runBtn = $("btn-run");
    if (runBtn && !state.running) {
      runBtn.textContent = tt("service.scripts.run", "Run");
    }
  });
  window.ScriptsApp = {
    openScript,
    openAndRun,
    run,
    save,
    refresh,
    selectScript,
    setMode,
    appendSession,
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();