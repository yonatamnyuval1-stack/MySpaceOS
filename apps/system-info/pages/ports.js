window.SysInfoPages = window.SysInfoPages || {};

window.SysInfoPages.ports = (function () {
  const { escapeHtml, invoke, renderStatCards, setupSortableTable, updateSortHeaders, compare } =
    window.SysInfo;

  const page = document.getElementById("page-ports");
  const statsEl = document.getElementById("ports-stats");
  const tbody = document.getElementById("ports-body");
  const rowCountEl = document.getElementById("ports-row-count");
  const lastScanEl = document.getElementById("ports-last-scan");
  const searchEl = document.getElementById("ports-search");
  const filterState = document.getElementById("ports-filter-state");
  const filterProtocol = document.getElementById("ports-filter-protocol");
  const table = document.getElementById("ports-table");

  let allPorts = [];
  let sortKey = "localPort";
  let sortDir = "asc";
  let selectedKey = null;
  const numericKeys = new Set(["localPort", "pid"]);

  function stateClass(state) {
    const s = (state || "").toLowerCase();
    if (s === "listening") return "listening";
    if (s === "established") return "established";
    if (s === "time_wait") return "time_wait";
    return "other";
  }

  function getFiltered() {
    const q = searchEl.value.trim().toLowerCase();
    const state = filterState.value;
    const proto = filterProtocol.value;
    return allPorts.filter((p) => {
      if (state !== "all" && p.state !== state) return false;
      if (proto !== "all" && p.protocol !== proto) return false;
      if (!q) return true;
      return [p.localPort, p.protocol, p.state, p.processName, p.pid, p.localAddress, p.remoteAddress]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }

  function renderTable() {
    const filtered = getFiltered().sort((a, b) => compare(a, b, sortKey, sortDir, numericKeys));
    updateSortHeaders(table, sortKey, sortDir);

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-cell">No connections match your filters</td></tr>`;
      rowCountEl.textContent = "0 rows";
      return;
    }

    tbody.innerHTML = filtered
      .map((p) => {
        const remote =
          p.remotePort > 0 ? `${p.remoteAddress}:${p.remotePort}` : p.remoteAddress || "—";
        const local = `${p.localAddress}:${p.localPort}`;
        const sel = p.key === selectedKey ? " selected" : "";
        return `<tr data-key="${escapeHtml(p.key)}" class="${sel}">
          <td><span class="port-num">${p.localPort}</span></td>
          <td><span class="proto ${p.protocol.toLowerCase()}">${p.protocol}</span></td>
          <td><span class="state-pill ${stateClass(p.state)}">${escapeHtml(p.state)}</span></td>
          <td class="process-cell" title="${escapeHtml(p.processName)}">${escapeHtml(p.processName)}</td>
          <td>${p.pid || "—"}</td>
          <td class="addr-cell" title="${escapeHtml(local)}">${escapeHtml(p.localHostLabel)} · ${escapeHtml(local)}</td>
          <td class="addr-cell" title="${escapeHtml(remote)}">${escapeHtml(p.remoteHostLabel)} · ${escapeHtml(remote)}</td>
        </tr>`;
      })
      .join("");
    rowCountEl.textContent = `${filtered.length} of ${allPorts.length} rows`;
  }

  function showDetail(port, shell, panel, body, titleEl) {
    if (!port) return;
    selectedKey = port.key;
    shell.classList.add("detail-open");
    panel.classList.remove("hidden");
    titleEl.textContent = "Port details";
    const remote =
      port.remotePort > 0 ? `${port.remoteAddress}:${port.remotePort}` : port.remoteAddress || "—";
    body.innerHTML = `
      <dl>
        <div class="detail-row"><dt>Port</dt><dd class="mono">${port.localPort} (${port.protocol})</dd></div>
        <div class="detail-row"><dt>State</dt><dd>${escapeHtml(port.state)}</dd></div>
        <div class="detail-row"><dt>Process</dt><dd>${escapeHtml(port.processName)} <span class="detail-path">PID ${port.pid || "—"}</span></dd>
          ${port.processPath ? `<dd class="detail-path mono">${escapeHtml(port.processPath)}</dd>` : ""}</div>
        <div class="detail-row"><dt>Local</dt><dd class="mono">${escapeHtml(port.localAddress)}:${port.localPort}</dd><dd class="detail-path">${escapeHtml(port.localHostLabel)}</dd></div>
        <div class="detail-row"><dt>Remote</dt><dd class="mono">${escapeHtml(remote)}</dd><dd class="detail-path">${escapeHtml(port.remoteHostLabel)}</dd></div>
      </dl>`;
    renderTable();
  }

  function hideDetail(shell, panel) {
    selectedKey = null;
    shell.classList.remove("detail-open");
    panel.classList.add("hidden");
    renderTable();
  }

  async function scan() {
    tbody.innerHTML = `<tr><td colspan="7" class="loading-cell">Scanning ports…</td></tr>`;
    const result = await invoke("ports.scan");
    allPorts = result.ports || [];
    renderStatCards(statsEl, [
      { label: "Total endpoints", value: result.summary?.total ?? 0, cls: "accent" },
      { label: "Listening", value: result.summary?.listening ?? 0, cls: "success" },
      { label: "Established", value: result.summary?.established ?? 0, cls: "accent" },
      { label: "Time wait", value: result.summary?.timeWait ?? 0, cls: "warn" },
      { label: "Unique processes", value: result.summary?.uniqueProcesses ?? 0 },
    ]);
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
    [searchEl, filterState, filterProtocol].forEach((el) => {
      el.addEventListener("input", renderTable);
      el.addEventListener("change", renderTable);
    });
    tbody.addEventListener("click", (e) => {
      const row = e.target.closest("tr[data-key]");
      if (!row) return;
      const port = allPorts.find((p) => p.key === row.dataset.key);
      showDetail(port, ui.shell, ui.detailPanel, ui.detailBody, ui.detailTitle);
    });
    ui.detailClose.addEventListener("click", () => hideDetail(ui.shell, ui.detailPanel));
  }

  return { id: "ports", page, scan, bind, hideDetail };
})();
