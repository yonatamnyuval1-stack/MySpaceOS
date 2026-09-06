window.SysInfoPages = window.SysInfoPages || {};

window.SysInfoPages.processes = (function () {
  const { escapeHtml, invoke, renderStatCards, setupSortableTable, updateSortHeaders, compare, formatTime } =
    window.SysInfo;

  const page = document.getElementById("page-processes");
  const statsEl = document.getElementById("processes-stats");
  const tbody = document.getElementById("processes-body");
  const rowCountEl = document.getElementById("processes-row-count");
  const lastScanEl = document.getElementById("processes-last-scan");
  const searchEl = document.getElementById("processes-search");
  const filterEl = document.getElementById("processes-filter");
  const table = document.getElementById("processes-table");

  let allProcesses = [];
  let sortKey = "memoryBytes";
  let sortDir = "desc";
  let selectedKey = null;
  const numericKeys = new Set(["pid", "memoryBytes", "cpuSeconds", "threads"]);

  function memBar(bytes, max) {
    const pct = max ? Math.min(100, Math.round((bytes / max) * 100)) : 0;
    return `<span class="mem-bar" title="${escapeHtml(String(bytes))}"><span class="mem-bar-fill" style="width:${pct}%"></span></span>`;
  }

  function getFiltered() {
    const q = searchEl.value.trim().toLowerCase();
    const f = filterEl.value;
    return allProcesses.filter((p) => {
      if (f === "responding" && !p.responding) return false;
      if (f === "heavy" && p.memoryBytes < 100 * 1024 * 1024) return false;
      if (!q) return true;
      return [p.name, p.pid, p.path, p.memoryLabel].join(" ").toLowerCase().includes(q);
    });
  }

  const maxMem = () => allProcesses[0]?.memoryBytes || 1;

  function renderTable() {
    const filtered = getFiltered().sort((a, b) => compare(a, b, sortKey, sortDir, numericKeys));
    updateSortHeaders(table, sortKey, sortDir);
    const max = maxMem();

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-cell">No processes match your filters</td></tr>`;
      rowCountEl.textContent = "0 rows";
      return;
    }

    tbody.innerHTML = filtered
      .map((p) => {
        const sel = p.key === selectedKey ? " selected" : "";
        const status = p.responding
          ? '<span class="state-pill listening">Running</span>'
          : '<span class="state-pill other">Not responding</span>';
        const started = p.startTime ? new Date(p.startTime).toLocaleString() : "—";
        return `<tr data-key="${escapeHtml(p.key)}" class="${sel}">
          <td class="process-cell" title="${escapeHtml(p.path || p.name)}">
            <span class="proc-name">${escapeHtml(p.name)}</span>
            ${memBar(p.memoryBytes, max)}
          </td>
          <td>${p.pid}</td>
          <td class="mono">${escapeHtml(p.memoryLabel)}</td>
          <td>${p.cpuSeconds}</td>
          <td>${p.threads}</td>
          <td>${status}</td>
          <td class="addr-cell">${escapeHtml(started)}</td>
        </tr>`;
      })
      .join("");
    rowCountEl.textContent = `${filtered.length} of ${allProcesses.length} rows`;
  }

  function showDetail(proc, ui) {
    if (!proc) return;
    selectedKey = proc.key;
    ui.shell.classList.add("detail-open");
    ui.detailPanel.classList.remove("hidden");
    ui.detailTitle.textContent = "Process details";
    ui.detailBody.innerHTML = `
      <dl>
        <div class="detail-row"><dt>Name</dt><dd>${escapeHtml(proc.name)}</dd></div>
        <div class="detail-row"><dt>PID</dt><dd class="mono">${proc.pid}</dd></div>
        <div class="detail-row"><dt>Memory (working set)</dt><dd>${escapeHtml(proc.memoryLabel)}</dd></div>
        <div class="detail-row"><dt>Private bytes</dt><dd>${escapeHtml(proc.privateBytes ? window.SysInfo.formatBytes(proc.privateBytes) : "—")}</dd></div>
        <div class="detail-row"><dt>CPU time</dt><dd>${proc.cpuSeconds}s total</dd></div>
        <div class="detail-row"><dt>Threads</dt><dd>${proc.threads}</dd></div>
        <div class="detail-row"><dt>Status</dt><dd>${proc.responding ? "Responding" : "Not responding"}</dd></div>
        <div class="detail-row"><dt>Started</dt><dd>${escapeHtml(formatTime(proc.startTime))}</dd></div>
        ${proc.path ? `<div class="detail-row"><dt>Path</dt><dd class="mono">${escapeHtml(proc.path)}</dd></div>` : ""}
      </dl>`;
    renderTable();
  }

  async function scan() {
    tbody.innerHTML = `<tr><td colspan="7" class="loading-cell">Scanning processes…</td></tr>`;
    const result = await invoke("processes.scan");
    allProcesses = result.processes || [];
    const s = result.summary || {};
    renderStatCards(statsEl, [
      { label: "Processes", value: s.total ?? 0, cls: "accent" },
      { label: "Responding", value: s.running ?? 0, cls: "success" },
      { label: "Not responding", value: s.notResponding ?? 0, cls: "warn" },
      { label: "Total working set", value: s.totalMemoryLabel ?? "—" },
    ]);
    renderTable();
    const at = result.scannedAt ? new Date(result.scannedAt) : new Date();
    lastScanEl.textContent = `Last scan: ${at.toLocaleTimeString()}`;
    return result;
  }

  function bind(ui) {
    setupSortableTable(table, (key) => {
      if (sortKey === key) sortDir = sortDir === "asc" ? "desc" : "asc";
      else {
        sortKey = key;
        sortDir = key === "name" ? "asc" : "desc";
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
      const proc = allProcesses.find((p) => p.key === row.dataset.key);
      showDetail(proc, ui);
    });
    ui.detailClose.addEventListener("click", () => {
      selectedKey = null;
      ui.shell.classList.remove("detail-open");
      ui.detailPanel.classList.add("hidden");
      renderTable();
    });
  }

  return { id: "processes", page, scan, bind };
})();
