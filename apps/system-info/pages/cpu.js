window.SysInfoPages = window.SysInfoPages || {};

window.SysInfoPages.cpu = (function () {
  const { escapeHtml, invoke, renderStatCards, setupSortableTable, updateSortHeaders, compare } =
    window.SysInfo;

  const page = document.getElementById("page-cpu");
  const statsEl = document.getElementById("cpu-stats");
  const heroEl = document.getElementById("cpu-hero");
  const coresEl = document.getElementById("cpu-cores");
  const tbody = document.getElementById("cpu-body");
  const lastScanEl = document.getElementById("cpu-last-scan");
  const table = document.getElementById("cpu-table");

  let topProcesses = [];
  let sortKey = "cpuSeconds";
  let sortDir = "desc";
  const numericKeys = new Set(["pid", "cpuSeconds"]);

  function renderHero(processor, usage) {
    const pct = usage ?? 0;
    const cls = pct >= 85 ? "danger" : pct >= 60 ? "warn" : "accent";
    heroEl.innerHTML = `
      <article class="gauge-card gauge-card--hero">
        <h3>${escapeHtml(processor.name)}</h3>
        <div class="gauge-value">${pct}<span class="gauge-unit">%</span></div>
        <p class="gauge-sub">${escapeHtml(processor.manufacturer)} · ${processor.cores} cores · ${processor.threads} threads</p>
        <div class="usage-bar usage-bar--lg ${cls}">
          <span class="usage-bar-fill" style="width:${Math.min(100, pct)}%"></span>
        </div>
        <p class="gauge-legend-inline">
          ${escapeHtml(processor.currentClockGhz)} current · ${escapeHtml(processor.maxClockGhz)} max
        </p>
      </article>`;
  }

  function renderCores(cores) {
    if (!cores.length) {
      coresEl.innerHTML = `<p class="section-hint">Per-core usage unavailable on this system</p>`;
      return;
    }
    coresEl.innerHTML = cores
      .map((c) => {
        const cls = c.usagePercent >= 85 ? "danger" : c.usagePercent >= 60 ? "warn" : "accent";
        return `
        <div class="core-chip">
          <span class="core-label">${escapeHtml(c.label)}</span>
          <span class="core-pct">${c.usagePercent}%</span>
          <div class="usage-bar ${cls}">
            <span class="usage-bar-fill" style="width:${Math.min(100, c.usagePercent)}%"></span>
          </div>
        </div>`;
      })
      .join("");
  }

  function renderTable() {
    const sorted = [...topProcesses].sort((a, b) => compare(a, b, sortKey, sortDir, numericKeys));
    updateSortHeaders(table, sortKey, sortDir);
    if (!sorted.length) {
      tbody.innerHTML = `<tr><td colspan="3" class="empty-cell">No CPU data for processes</td></tr>`;
      return;
    }
    tbody.innerHTML = sorted
      .map(
        (p) => `<tr>
        <td class="process-cell">${escapeHtml(p.name)}</td>
        <td>${p.pid}</td>
        <td>${p.cpuSeconds}s</td>
      </tr>`
      )
      .join("");
  }

  async function scan() {
    tbody.innerHTML = `<tr><td colspan="3" class="loading-cell">Reading CPU…</td></tr>`;
    const result = await invoke("cpu.scan");
    const proc = result.processor || {};
    const usage = result.totalUsagePercent ?? 0;

    renderStatCards(statsEl, [
      { label: "CPU usage", value: `${usage}%`, cls: "accent" },
      { label: "Cores", value: proc.cores ?? "—", cls: "success" },
      { label: "Threads", value: proc.threads ?? "—" },
      { label: "Clock", value: proc.currentClockGhz ?? "—" },
    ]);

    renderHero(proc, usage);
    renderCores(result.cores || []);
    topProcesses = result.topProcesses || [];
    renderTable();

    const at = result.scannedAt ? new Date(result.scannedAt) : new Date();
    lastScanEl.textContent = `Last scan: ${at.toLocaleTimeString()}`;
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
      renderTable();
    });
  }

  return { id: "cpu", page, scan, bind };
})();
