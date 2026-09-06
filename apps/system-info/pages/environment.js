window.SysInfoPages = window.SysInfoPages || {};

window.SysInfoPages.environment = (function () {
  const { escapeHtml, invoke, renderStatCards, setupSortableTable, updateSortHeaders, compare } =
    window.SysInfo;

  const page = document.getElementById("page-environment");
  const statsEl = document.getElementById("environment-stats");
  const pathListEl = document.getElementById("environment-path-list");
  const tbody = document.getElementById("environment-body");
  const rowCountEl = document.getElementById("environment-row-count");
  const lastScanEl = document.getElementById("environment-last-scan");
  const searchEl = document.getElementById("environment-search");
  const filterEl = document.getElementById("environment-filter");
  const table = document.getElementById("environment-table");

  let allVars = [];
  let pathEntries = [];
  let sortKey = "name";
  let sortDir = "asc";
  let selectedKey = null;
  const numericKeys = new Set(["length"]);

  function getFiltered() {
    const q = searchEl.value.trim().toLowerCase();
    const f = filterEl.value;
    return allVars.filter((v) => {
      if (f === "path" && !v.isPath) return false;
      if (f === "user" && !/^(USER|HOME|APPDATA|LOCALAPPDATA|TEMP|TMP|USERNAME)/i.test(v.name)) {
        return false;
      }
      if (!q) return true;
      return `${v.name} ${v.value}`.toLowerCase().includes(q);
    });
  }

  function renderPathList() {
    if (!pathEntries.length) {
      pathListEl.innerHTML = `<p class="section-hint">PATH is empty or not set</p>`;
      return;
    }
    pathListEl.innerHTML = pathEntries
      .map(
        (e) => `
      <div class="path-entry">
        <span class="path-index">${e.index}</span>
        <span class="path-value mono">${escapeHtml(e.path)}</span>
      </div>`
      )
      .join("");
  }

  function renderTable() {
    const filtered = getFiltered().sort((a, b) => compare(a, b, sortKey, sortDir, numericKeys));
    updateSortHeaders(table, sortKey, sortDir);

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="3" class="empty-cell">No variables match</td></tr>`;
      rowCountEl.textContent = "0 variables";
      return;
    }

    tbody.innerHTML = filtered
      .map((v) => {
        const sel = v.key === selectedKey ? " selected" : "";
        const preview =
          v.value.length > 80 ? `${v.value.slice(0, 80)}…` : v.value;
        return `<tr data-key="${escapeHtml(v.key)}" class="${sel}">
          <td class="env-name mono">${escapeHtml(v.name)}</td>
          <td class="env-value" title="${escapeHtml(v.value)}">${escapeHtml(preview)}</td>
          <td>${v.length}</td>
        </tr>`;
      })
      .join("");
    rowCountEl.textContent = `${filtered.length} of ${allVars.length} variables`;
  }

  function showDetail(v, ui) {
    if (!v) return;
    selectedKey = v.key;
    ui.shell.classList.add("detail-open");
    ui.detailPanel.classList.remove("hidden");
    ui.detailTitle.textContent = v.name;
    ui.detailBody.innerHTML = `
      <dl>
        <div class="detail-row"><dt>Name</dt><dd class="mono">${escapeHtml(v.name)}</dd></div>
        <div class="detail-row"><dt>Length</dt><dd>${v.length} characters</dd></div>
        <div class="detail-row"><dt>Value</dt><dd class="mono env-full-value">${escapeHtml(v.value)}</dd></div>
      </dl>`;
    renderTable();
  }

  async function scan() {
    tbody.innerHTML = `<tr><td colspan="3" class="loading-cell">Reading environment…</td></tr>`;
    pathListEl.innerHTML = `<p class="loading-cell">Loading…</p>`;
    const result = await invoke("environment.scan");
    allVars = result.variables || [];
    pathEntries = result.pathEntries || [];
    const s = result.summary || {};

    renderStatCards(statsEl, [
      { label: "Variables", value: s.total ?? 0, cls: "accent" },
      { label: "PATH entries", value: s.pathCount ?? 0, cls: "success" },
      { label: "User-related", value: s.userRelated ?? 0 },
    ]);

    renderPathList();
    renderTable();

    const at = result.scannedAt ? new Date(result.scannedAt) : new Date();
    lastScanEl.textContent = `Last scan: ${at.toLocaleTimeString()}`;
    if (result.note) lastScanEl.textContent += ` · ${result.note}`;
    return result;
  }

  function bind(ui) {
    setupSortableTable(table, (key) => {
      if (sortKey === key) sortDir = sortDir === "asc" ? "desc" : "asc";
      else {
        sortKey = key;
        sortDir = "asc";
      }
      renderTable();
    });

    [searchEl, filterEl].forEach((el) => {
      el.addEventListener("input", renderTable);
      el.addEventListener("change", renderTable);
    });

    tbody.addEventListener("click", (e) => {
      const row = e.target.closest("tr[data-key]");
      if (!row) return;
      const v = allVars.find((x) => x.key === row.dataset.key);
      showDetail(v, ui);
    });

    ui.detailClose.addEventListener("click", () => {
      selectedKey = null;
      ui.shell.classList.remove("detail-open");
      ui.detailPanel.classList.add("hidden");
      renderTable();
    });
  }

  return { id: "environment", page, scan, bind };
})();
