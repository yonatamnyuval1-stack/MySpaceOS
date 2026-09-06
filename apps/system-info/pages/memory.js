window.SysInfoPages = window.SysInfoPages || {};

window.SysInfoPages.memory = (function () {
  const { escapeHtml, invoke, renderStatCards, setupSortableTable, updateSortHeaders, compare } =
    window.SysInfo;

  const page = document.getElementById("page-memory");
  const statsEl = document.getElementById("memory-stats");
  const physicalCard = document.getElementById("memory-physical-card");
  const virtualCard = document.getElementById("memory-virtual-card");
  const tbody = document.getElementById("memory-body");
  const lastScanEl = document.getElementById("memory-last-scan");
  const table = document.getElementById("memory-table");

  let topProcesses = [];
  let sortKey = "memoryBytes";
  let sortDir = "desc";
  const numericKeys = new Set(["pid", "memoryBytes", "percentOfTotal"]);

  function gaugeHtml(title, data, accentClass) {
    if (!data) return `<p class="empty-cell">No data</p>`;
    const pct = data.usagePercent ?? 0;
    return `
      <h3>${escapeHtml(title)}</h3>
      <div class="gauge-value">${pct}<span class="gauge-unit">%</span></div>
      <div class="usage-bar usage-bar--lg ${accentClass}">
        <span class="usage-bar-fill" style="width:${Math.min(100, pct)}%"></span>
      </div>
      <ul class="gauge-legend">
        <li><span class="dot used"></span> Used <strong>${escapeHtml(data.usedLabel)}</strong></li>
        <li><span class="dot free"></span> Free <strong>${escapeHtml(data.freeLabel)}</strong></li>
        <li><span class="dot total"></span> Total <strong>${escapeHtml(data.totalLabel)}</strong></li>
      </ul>`;
  }

  function renderGauges(physical, virtual) {
    physicalCard.innerHTML = gaugeHtml("Physical RAM", physical, "accent");
    virtualCard.innerHTML = gaugeHtml("Virtual memory", virtual, "virtual");
  }

  function renderTopTable() {
    const sorted = [...topProcesses].sort((a, b) =>
      compare(a, b, sortKey, sortDir, numericKeys)
    );
    updateSortHeaders(table, sortKey, sortDir);

    if (!sorted.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-cell">No process data</td></tr>`;
      return;
    }

    const max = sorted[0]?.memoryBytes || 1;
    tbody.innerHTML = sorted
      .map((p) => {
        const pctBar = Math.min(100, Math.round((p.memoryBytes / max) * 100));
        return `<tr>
          <td class="process-cell">${escapeHtml(p.name)}</td>
          <td>${p.pid}</td>
          <td>
            <span class="mono">${escapeHtml(p.memoryLabel)}</span>
            <span class="mem-bar inline"><span class="mem-bar-fill" style="width:${pctBar}%"></span></span>
          </td>
          <td>${p.percentOfTotal}%</td>
        </tr>`;
      })
      .join("");
  }

  async function scan() {
    tbody.innerHTML = `<tr><td colspan="4" class="loading-cell">Reading memory…</td></tr>`;
    const result = await invoke("memory.scan");
    const phys = result.physical;
    const virt = result.virtual;

    renderStatCards(statsEl, [
      { label: "RAM used", value: phys ? `${phys.usagePercent}%` : "—", cls: "accent", hint: phys?.usedLabel },
      { label: "RAM free", value: phys?.freeLabel ?? "—", cls: "success" },
      { label: "Total RAM", value: phys?.totalLabel ?? "—" },
      { label: "Virtual used", value: virt ? `${virt.usagePercent}%` : "—", cls: "warn", hint: virt?.usedLabel },
    ]);

    renderGauges(phys, virt);
    topProcesses = result.topProcesses || [];
    renderTopTable();

    const at = result.scannedAt ? new Date(result.scannedAt) : new Date();
    let foot = `Last scan: ${at.toLocaleTimeString()}`;
    if (result.lastBoot) {
      try {
        foot += ` · Last boot: ${new Date(result.lastBoot).toLocaleString()}`;
      } catch {
        /* ignore */
      }
    }
    lastScanEl.textContent = foot;
    if (result.note) lastScanEl.textContent += ` · ${result.note}`;
    return result;
  }

  function bind() {
    setupSortableTable(table, (key) => {
      if (sortKey === key) sortDir = sortDir === "asc" ? "desc" : "asc";
      else {
        sortKey = key;
        sortDir = "desc";
      }
      renderTopTable();
    });
  }

  return { id: "memory", page, scan, bind };
})();
