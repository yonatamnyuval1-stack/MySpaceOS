(function () {
  function tt(key, vars) {
    return window.MySpaceI18n?.t?.(key, vars) ?? key;
  }

  const els = {
    shell: document.getElementById("app-shell"),
    nav: document.getElementById("main-nav"),
    search: document.getElementById("search-input"),
    searchMeta: document.getElementById("search-meta"),
    repoList: document.getElementById("repo-list"),
    exploreEmpty: document.getElementById("explore-empty"),
    blurb: document.getElementById("sidebar-blurb"),
    btnReload: document.getElementById("btn-reload"),
    viewExplore: document.getElementById("view-explore"),
    viewRepo: document.getElementById("view-repo"),
    viewAbout: document.getElementById("view-about"),
    viewPublish: document.getElementById("view-publish"),
    btnBack: document.getElementById("btn-back"),
    repoOrg: document.getElementById("repo-org"),
    repoName: document.getElementById("repo-name"),
    repoDesc: document.getElementById("repo-desc"),
    repoTags: document.getElementById("repo-tags"),
    adoptTarget: document.getElementById("adopt-target"),
    btnAdopt: document.getElementById("btn-adopt"),
    btnCopyUsage: document.getElementById("btn-copy-usage"),
    fileTree: document.getElementById("file-tree"),
    filePath: document.getElementById("file-path"),
    fileCode: document.getElementById("file-code"),
    btnCopyFile: document.getElementById("btn-copy-file"),
    codePanel: document.getElementById("repo-code-panel"),
    readmePanel: document.getElementById("repo-readme-panel"),
    readmeBody: document.getElementById("readme-body"),
    status: document.getElementById("status-line"),
    kindFilters: document.getElementById("kind-filters"),
    publishApp: document.getElementById("publish-app"),
    publishId: document.getElementById("publish-id"),
    publishKind: document.getElementById("publish-kind"),
    publishTitle: document.getElementById("publish-title"),
    publishSummary: document.getElementById("publish-summary"),
    publishTags: document.getElementById("publish-tags"),
    publishUsage: document.getElementById("publish-usage"),
    publishEntry: document.getElementById("publish-entry"),
    publishBody: document.getElementById("publish-body"),
    publishShared: document.getElementById("publish-shared"),
    btnPublish: document.getElementById("btn-publish"),
    publishStatus: document.getElementById("publish-status"),
    publishedList: document.getElementById("published-list"),
    btnRefreshPublished: document.getElementById("btn-refresh-published"),
  };

  const state = {
    page: "explore",
    tab: "code",
    parts: [],
    targets: [],
    search: "",
    kind: "",
    selectedId: "",
    detail: null,
    activeFile: "",
    adoptTarget: "",
    publishApp: "",
    published: [],
  };

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function api(channel, args) {
    if (!window.myApp?.invoke) {
      throw new Error("Parts could not connect. Close this tab and open Parts again from Platform.");
    }
    return window.myApp.invoke(channel, args || {});
  }

  function setStatus(msg, kind) {
    if (!els.status) return;
    els.status.textContent = msg || "";
    els.status.classList.toggle("is-ok", kind === "ok");
    els.status.classList.toggle("is-err", kind === "err");
  }

  function setPublishStatus(msg, kind) {
    if (!els.publishStatus) return;
    els.publishStatus.textContent = msg || "";
    els.publishStatus.className = "publish-status" + (kind === "ok" ? " is-ok" : kind === "err" ? " is-err" : "");
  }

  function filteredParts() {
    const q = state.search.trim().toLowerCase();
    return state.parts.filter((p) => {
      if (state.kind && p.kind !== state.kind) return false;
      if (!q) return true;
      return `${p.id} ${p.title} ${p.summary} ${(p.tags || []).join(" ")} ${(p.publishers || []).join(" ")}`
        .toLowerCase()
        .includes(q);
    });
  }

  function paintNav() {
    const navPage = state.page === "repo" ? "explore" : state.page;
    els.nav?.querySelectorAll("[data-page]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.page === navPage);
    });
  }

  function paintViews() {
    const page = state.page;
    els.viewExplore?.classList.toggle("hidden", page !== "explore");
    els.viewRepo?.classList.toggle("hidden", page !== "repo");
    els.viewAbout?.classList.toggle("hidden", page !== "about");
    els.viewPublish?.classList.toggle("hidden", page !== "publish");
    els.kindFilters?.classList.toggle("hidden", page === "publish" || page === "about");
    paintNav();
  }

  function paintExplore() {
    const rows = filteredParts();
    if (els.searchMeta) {
      els.searchMeta.textContent =
        rows.length === 1
          ? tt("service.parts.partCount", { count: rows.length })
          : tt("service.parts.partCountPlural", { count: rows.length });
    }
    if (els.blurb) {
      els.blurb.textContent = tt("service.parts.blurbForge", { count: state.parts.length });
    }
    if (!els.repoList) return;

    if (!rows.length) {
      els.repoList.innerHTML = "";
      els.exploreEmpty?.classList.remove("hidden");
      return;
    }
    els.exploreEmpty?.classList.add("hidden");

    els.repoList.innerHTML = rows
      .map((p) => {
        const pubs = (p.publishers || []).filter(Boolean);
        const pubLabel = pubs.length ? pubs.join(", ") : p.origin === "shared" ? "shared" : "—";
        const tags = (p.tags || [])
          .slice(0, 3)
          .map((t) => `<span class="pill">${escapeHtml(t)}</span>`)
          .join("");
        return `<button type="button" class="repo-row" data-id="${escapeHtml(p.id)}" role="row">
          <span>
            <span class="repo-name">${escapeHtml(p.id)}</span>
            <span class="repo-summary">${escapeHtml(p.summary || p.title || "")}</span>
            ${tags ? `<span class="repo-meta-tags">${tags}</span>` : ""}
          </span>
          <span class="kind-cell">${escapeHtml(p.kind || "—")}</span>
          <span class="pub-cell" title="${escapeHtml(pubLabel)}">${escapeHtml(pubLabel)}</span>
        </button>`;
      })
      .join("");

    els.repoList.querySelectorAll("[data-id]").forEach((row) => {
      row.addEventListener("click", () => void openPart(row.dataset.id));
    });
  }

  function paintTargets() {
    if (!els.adoptTarget) return;
    const opts = state.targets
      .map(
        (t) =>
          `<option value="${escapeHtml(t)}"${t === state.adoptTarget ? " selected" : ""}>${escapeHtml(t)}</option>`
      )
      .join("");
    els.adoptTarget.innerHTML = opts || `<option value="">${escapeHtml(tt("service.parts.noApps"))}</option>`;
  }

  function paintPublishApps() {
    if (!els.publishApp) return;
    const opts = state.targets
      .map(
        (t) =>
          `<option value="${escapeHtml(t)}"${t === state.publishApp ? " selected" : ""}>${escapeHtml(t)}</option>`
      )
      .join("");
    els.publishApp.innerHTML = opts || `<option value="">${escapeHtml(tt("service.parts.noApps"))}</option>`;
  }

  function paintPublishedList() {
    if (!els.publishedList) return;
    const rows = state.published || [];
    if (!rows.length) {
      els.publishedList.innerHTML = `<p class="empty-inline">${escapeHtml(tt("service.parts.emptyUploads"))}</p>`;
      return;
    }
    els.publishedList.innerHTML = rows
      .map(
        (p) => `<div class="published-row">
          <div>
            <button type="button" class="linkish" data-open="${escapeHtml(p.id)}">${escapeHtml(p.id)}</button>
            <span class="muted">${escapeHtml(p.summary || p.title || "")}</span>
          </div>
          <button type="button" class="btn btn-sm btn-danger" data-unpub="${escapeHtml(p.id)}">${escapeHtml(tt("service.parts.remove"))}</button>
        </div>`
      )
      .join("");

    els.publishedList.querySelectorAll("[data-open]").forEach((btn) => {
      btn.addEventListener("click", () => void openPart(btn.dataset.open));
    });
    els.publishedList.querySelectorAll("[data-unpub]").forEach((btn) => {
      btn.addEventListener("click", () => void unpublish(btn.dataset.unpub));
    });
  }

  function paintFileTree() {
    const files = Object.keys(state.detail?.files || {});
    if (!els.fileTree) return;
    if (!files.length) {
      els.fileTree.innerHTML = `<p class="file-item" style="cursor:default;color:var(--muted)">${escapeHtml(tt("service.parts.noFiles"))}</p>`;
      return;
    }
    els.fileTree.innerHTML = files
      .map((name) => {
        const on = name === state.activeFile ? " is-active" : "";
        return `<button type="button" class="file-item${on}" data-file="${escapeHtml(name)}">
          <span class="file-ico" aria-hidden="true">📄</span>
          ${escapeHtml(name)}
        </button>`;
      })
      .join("");
    els.fileTree.querySelectorAll("[data-file]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.activeFile = btn.dataset.file;
        paintFilePane();
        paintFileTree();
      });
    });
  }

  function paintFilePane() {
    const name = state.activeFile;
    const body = (state.detail?.files || {})[name] || "";
    if (els.filePath) els.filePath.textContent = name || "Select a file";
    if (els.fileCode) els.fileCode.innerHTML = `<code>${escapeHtml(body)}</code>`;
    els.btnCopyFile?.classList.toggle("hidden", !name);
  }

  function paintReadme() {
    const p = state.detail?.part;
    if (!els.readmeBody || !p) return;
    const apiRows = Object.entries(p.api || {})
      .map(([k, v]) => `<li><code>${escapeHtml(k)}</code> — ${escapeHtml(v)}</li>`)
      .join("");
    const pubs = (p.publishers || []).filter(Boolean);
    els.readmeBody.innerHTML = `
      <h2>${escapeHtml(p.title || p.id)}</h2>
      <p>${escapeHtml(p.summary || "")}</p>
      <h3>Contract</h3>
      <p><code>${escapeHtml(p.contract || p.id)}</code> · kind <code>${escapeHtml(p.kind || "")}</code> · v${escapeHtml(
        String(p.version ?? 1)
      )}</p>
      ${p.usage ? `<h3>Usage</h3><pre>${escapeHtml(p.usage)}</pre>` : ""}
      ${apiRows ? `<h3>API</h3><ul>${apiRows}</ul>` : ""}
      <h3>Portability</h3>
      <p>Source ships without host-app identifiers. Credit${
        pubs.length ? ` (${escapeHtml(pubs.join(", "))})` : ""
      } is catalog metadata only.</p>
      <h3>Adopt</h3>
      <p>Copies files to <code>apps/&lt;target&gt;/parts/${escapeHtml(p.id)}/</code></p>
    `;
  }

  function paintRepoTabs() {
    document.querySelectorAll(".repo-tab").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.tab === state.tab);
    });
    els.codePanel?.classList.toggle("hidden", state.tab !== "code");
    els.readmePanel?.classList.toggle("hidden", state.tab !== "readme");
  }

  function paintRepo() {
    const p = state.detail?.part;
    if (!p) return;
    if (els.repoOrg) els.repoOrg.textContent = "parts";
    if (els.repoName) els.repoName.textContent = p.id;
    if (els.repoDesc) els.repoDesc.textContent = p.summary || p.title || "";
    if (els.repoTags) {
      const bits = [p.kind, ...(p.tags || [])].filter(Boolean);
      els.repoTags.innerHTML = bits.map((t) => `<span class="pill">${escapeHtml(t)}</span>`).join("");
    }
    paintTargets();
    paintFileTree();
    paintFilePane();
    paintReadme();
    paintRepoTabs();
  }

  async function refreshPublished() {
    const app = state.publishApp || els.publishApp?.value;
    if (!app) {
      state.published = [];
      paintPublishedList();
      return;
    }
    const res = await api("parts.published", { app });
    state.published = res?.ok ? res.parts || [] : [];
    paintPublishedList();
  }

  async function refresh() {
    const [listRes, targetsRes] = await Promise.all([
      api("parts.list", { q: "" }),
      api("parts.targets", {}),
    ]);
    if (!listRes?.ok) throw new Error(listRes?.error || "Could not load parts");
    state.parts = listRes.parts || [];
    state.targets = targetsRes?.ok ? targetsRes.apps || [] : [];
    if (!state.adoptTarget && state.targets.length) state.adoptTarget = state.targets[0];
    if (!state.publishApp && state.targets.length) {
      state.publishApp = state.targets.includes("notes") ? "notes" : state.targets[0];
    }
    paintExplore();
    paintTargets();
    paintPublishApps();
    if (state.page === "publish") await refreshPublished();
  }

  async function openPart(id) {
    const res = await api("parts.get", { id });
    if (!res?.ok) {
      setStatus(res?.error || "Part not found", "err");
      return;
    }
    state.selectedId = id;
    state.detail = res;
    state.page = "repo";
    state.tab = "code";
    const files = Object.keys(res.files || {});
    state.activeFile = files.includes(res.part?.entry) ? res.part.entry : files[0] || "";
    setStatus("");
    paintViews();
    paintRepo();
  }

  function setPage(page) {
    const next = String(page || "explore").toLowerCase();
    if (next === "catalog" || next === "explore" || next === "home") {
      state.page = "explore";
      state.selectedId = "";
      state.detail = null;
    } else if (next === "about" || next === "info") {
      state.page = "about";
    } else if (next === "publish" || next === "upload" || next === "new") {
      state.page = "publish";
    } else if (next === "repo" || next === "detail" || next === "code") {
      state.page = state.detail ? "repo" : "explore";
    } else {
      state.page = "explore";
    }
    paintViews();
    if (state.page === "explore") paintExplore();
    if (state.page === "publish") void refreshPublished();
  }

  async function applyRoute(route) {
    const page = String(route?.page || "explore").toLowerCase();
    const id = route?.id || route?.part || route?.param;
    if (id && page !== "publish") {
      await openPart(id);
      if (page === "about" || page === "readme") {
        state.tab = "readme";
        paintRepoTabs();
      }
      return;
    }
    if (page === "about") setPage("about");
    else if (page === "publish" || page === "upload") {
      if (route?.app) {
        state.publishApp = route.app;
        paintPublishApps();
      }
      setPage("publish");
    } else setPage("explore");
  }

  async function adopt() {
    const id = state.selectedId;
    const target = state.adoptTarget || els.adoptTarget?.value;
    if (!id || !target) {
      setStatus("Pick a target app", "err");
      return;
    }
    const res = await api("parts.adopt", { id, target });
    if (!res?.ok) {
      setStatus(res?.error || "Adopt failed", "err");
      return;
    }
    setStatus(`Adopted → ${res.dest}`, "ok");
  }

  async function publish() {
    const app = els.publishApp?.value || state.publishApp;
    const id = (els.publishId?.value || "").trim();
    const entry = (els.publishEntry?.value || "index.js").trim() || "index.js";
    const body = els.publishBody?.value || "";
    if (!app) {
      setPublishStatus("Pick a publisher app", "err");
      return;
    }
    if (!id) {
      setPublishStatus("Part id required ", "err");
      return;
    }
    if (!body.trim()) {
      setPublishStatus("Paste file contents", "err");
      return;
    }

    const title = (els.publishTitle?.value || "").trim() || id;
    const summary = (els.publishSummary?.value || "").trim();
    const usage =
      (els.publishUsage?.value || "").trim() || `const mod = require('./parts/${id}');`;
    const tags = (els.publishTags?.value || "")
      .split(/[, ]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    setPublishStatus("Publishing…");
    const res = await api("parts.publish", {
      app,
      id,
      title,
      summary,
      kind: els.publishKind?.value || "util",
      tags,
      usage,
      entry,
      files: { [entry]: body },
      shared: Boolean(els.publishShared?.checked),
    });
    if (!res?.ok) {
      setPublishStatus(res?.error || "Publish failed", "err");
      return;
    }
    setPublishStatus(`Published → ${res.dest}`, "ok");
    await refresh();
    await refreshPublished();
  }

  async function unpublish(id) {
    const app = state.publishApp || els.publishApp?.value;
    if (!app || !id) return;
    if (!window.confirm(`Remove published part ${id} from ${app}?`)) return;
    const res = await api("parts.unpublish", { app, id });
    if (!res?.ok) {
      setPublishStatus(res?.error || "Unpublish failed", "err");
      return;
    }
    setPublishStatus(`Removed ${id}`, "ok");
    await refresh();
    await refreshPublished();
  }

  els.nav?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-page]");
    if (!btn) return;
    setPage(btn.dataset.page);
  });

  els.kindFilters?.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-kind]");
    if (!chip) return;
    state.kind = chip.dataset.kind || "";
    els.kindFilters.querySelectorAll("[data-kind]").forEach((c) => {
      c.classList.toggle("is-active", (c.dataset.kind || "") === state.kind);
    });
    paintExplore();
  });

  let searchTimer = null;
  els.search?.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = els.search.value || "";
      paintExplore();
    }, 120);
  });

  els.btnReload?.addEventListener("click", () => {
    void refresh()
      .then(() => setStatus(tt("service.parts.catalogRefreshed"), "ok"))
      .catch((err) => setStatus(err?.message || "Refresh failed", "err"));
  });

  els.btnBack?.addEventListener("click", () => setPage("explore"));

  els.adoptTarget?.addEventListener("change", () => {
    state.adoptTarget = els.adoptTarget.value;
  });

  els.publishApp?.addEventListener("change", () => {
    state.publishApp = els.publishApp.value;
    void refreshPublished();
  });

  els.btnPublish?.addEventListener("click", () => void publish());
  els.btnRefreshPublished?.addEventListener("click", () => void refreshPublished());

  els.btnAdopt?.addEventListener("click", () => void adopt());

  els.btnCopyUsage?.addEventListener("click", async () => {
    const text = state.detail?.part?.usage || state.detail?.part?.contract || "";
    try {
      await navigator.clipboard.writeText(text);
      setStatus(tt("service.common.copied"), "ok");
    } catch {
      setStatus(tt("service.common.copyFailed"), "err");
    }
  });

  els.btnCopyFile?.addEventListener("click", async () => {
    const body = (state.detail?.files || {})[state.activeFile] || "";
    try {
      await navigator.clipboard.writeText(body);
      setStatus(tt("service.common.copied"), "ok");
    } catch {
      setStatus(tt("service.common.copyFailed"), "err");
    }
  });

  document.querySelectorAll(".repo-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.tab = btn.dataset.tab || "code";
      paintRepoTabs();
    });
  });

  window.PartsApp = {
    setPage,
    openPart,
    refresh,
    applyRoute,
  };

  function onI18nApplied() {
    if (state.page === "explore") paintExplore();
    if (state.page === "repo") {
      paintFileTree();
      paintFilePane();
      paintTargets();
    }
    if (state.page === "publish") paintPublishedList();
  }
  window.addEventListener("myspace-i18n-applied", onI18nApplied);
  window.addEventListener("myspace-i18n-ready", onI18nApplied);

  void refresh()
    .then(() => paintViews())
    .catch((err) => {
      if (els.repoList) els.repoList.innerHTML = "";
      els.exploreEmpty?.classList.remove("hidden");
      if (els.exploreEmpty) {
        els.exploreEmpty.innerHTML = `<strong>Could not load catalog</strong><p>${escapeHtml(
          err?.message || "Unknown error"
        )}</p>`;
      }
    });
})();