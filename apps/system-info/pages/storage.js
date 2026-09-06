window.SysInfoPages = window.SysInfoPages || {};

window.SysInfoPages.storage = (function () {
  const { escapeHtml, invoke, renderStatCards, setupSortableTable, updateSortHeaders, compare } =
    window.SysInfo;

  const page = document.getElementById("page-storage");
  const statsEl = document.getElementById("storage-stats");
  const driveGrid = document.getElementById("drive-grid");
  const tbody = document.getElementById("storage-body");
  const rowCountEl = document.getElementById("storage-row-count");
  const lastScanEl = document.getElementById("storage-last-scan");
  const table = document.getElementById("storage-table");

  let allDrives = [];
  let sortKey = "id";
  let sortDir = "asc";
  let selectedKey = null;
  const numericKeys = new Set(["sizeBytes", "usedBytes", "freeBytes", "usagePercent"]);

  function usageClass(pct) {
    if (pct >= 90) return "danger";
    if (pct >= 75) return "warn";
    return "accent";
  }

  function renderDriveCards() {
    if (!allDrives.length) {
      driveGrid.innerHTML = `<p class="empty-cell">No drives found</p>`;
      return;
    }
    driveGrid.innerHTML = allDrives
      .map((d) => {
        const cls = usageClass(d.usagePercent);
        const sel = d.key === selectedKey ? " selected" : "";
        return `
        <article class="drive-card ${sel}" data-key="${escapeHtml(d.key)}" tabindex="0">
          <header class="drive-card-head">
            <span class="drive-letter">${escapeHtml(d.id)}</span>
            <span class="drive-type">${escapeHtml(d.driveTypeLabel)}</span>
          </header>
          <h3 class="drive-name">${escapeHtml(d.name)}</h3>
          <div class="usage-bar usage-bar--lg ${cls}">
            <span class="usage-bar-fill" style="width:${Math.min(100, d.usagePercent)}%"></span>
          </div>
          <p class="drive-pct">${d.usagePercent}% used · ${escapeHtml(d.sizeLabel)}</p>
          <footer class="drive-foot">
            <span>${escapeHtml(d.usedLabel)} used</span>
            <span>${escapeHtml(d.freeLabel)} free</span>
          </footer>
        </article>`;
      })
      .join("");
  }

  function renderTable() {
    const sorted = [...allDrives].sort((a, b) => compare(a, b, sortKey, sortDir, numericKeys));
    updateSortHeaders(table, sortKey, sortDir);

    if (!sorted.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-cell">No drives</td></tr>`;
      rowCountEl.textContent = "0 drives";
      return;
    }

    tbody.innerHTML = sorted
      .map((d) => {
        const sel = d.key === selectedKey ? " selected" : "";
        const cls = usageClass(d.usagePercent);
        return `<tr data-key="${escapeHtml(d.key)}" class="${sel}">
          <td><span class="port-num">${escapeHtml(d.id)}</span></td>
          <td>${escapeHtml(d.name)}</td>
          <td class="mono">${escapeHtml(d.fileSystem)}</td>
          <td>${escapeHtml(d.driveTypeLabel)}</td>
          <td class="mono">${escapeHtml(d.sizeLabel)}</td>
          <td>${escapeHtml(d.usedLabel)}</td>
          <td>${escapeHtml(d.freeLabel)}</td>
          <td><span class="usage-pill ${cls}">${d.usagePercent}%</span></td>
        </tr>`;
      })
      .join("");
    rowCountEl.textContent = `${sorted.length} drive${sorted.length === 1 ? "" : "s"}`;
  }

  function detailRow(label, value, mono) {
    if (value == null || value === "" || value === "—") return "";
    const cls = mono ? ' class="mono"' : "";
    return `<div class="detail-row"><dt>${escapeHtml(label)}</dt><dd${cls}>${escapeHtml(String(value))}</dd></div>`;
  }

  function showDetail(drive, ui) {
    if (!drive) return;
    selectedKey = drive.key;
    const cls = usageClass(drive.usagePercent);
    ui.shell.classList.add("detail-open");
    ui.detailPanel.classList.remove("hidden");
    ui.detailTitle.textContent = `Drive ${drive.id}`;

    const serial = drive.volumeSerial
      ? String(drive.volumeSerial).replace(/(.{4})/g, "$1 ").trim()
      : null;

    ui.detailBody.innerHTML = `
      <div class="detail-usage">
        <div class="usage-bar usage-bar--lg ${cls}">
          <span class="usage-bar-fill" style="width:${Math.min(100, drive.usagePercent)}%"></span>
        </div>
        <p class="detail-usage-caption">
          <strong>${escapeHtml(drive.usedLabel)}</strong> used of
          <strong>${escapeHtml(drive.sizeLabel)}</strong>
          (${drive.usagePercent}%)
        </p>
      </div>
      <dl>
        ${detailRow("Volume label", drive.name)}
        ${detailRow("Drive letter", drive.id, true)}
        ${detailRow("File system", drive.fileSystem, true)}
        ${detailRow("Drive type", drive.driveTypeLabel)}
        ${detailRow("Capacity", drive.sizeLabel)}
        ${detailRow("Used space", `${drive.usedLabel} (${drive.usagePercent}%)`)}
        ${detailRow("Free space", drive.freeLabel)}
        ${detailRow("Size (bytes)", drive.sizeBytes.toLocaleString(), true)}
        ${detailRow("Used (bytes)", drive.usedBytes.toLocaleString(), true)}
        ${detailRow("Free (bytes)", drive.freeBytes.toLocaleString(), true)}
      </dl>
      <p class="detail-section-title">Advanced</p>
      <dl>
        ${detailRow("Volume serial", serial, true)}
        ${detailRow("Description", drive.description)}
        ${detailRow("Network path", drive.providerName, true)}
        ${detailRow("Compressed", drive.compressed ? "Yes" : "No")}
      </dl>`;
    renderDriveCards();
    renderTable();
  }

  async function scan() {
    tbody.innerHTML = `<tr><td colspan="8" class="loading-cell">Scanning drives…</td></tr>`;
    driveGrid.innerHTML = `<p class="loading-cell">Loading…</p>`;
    const result = await invoke("storage.scan");
    allDrives = result.drives || [];
    const s = result.summary || {};

    renderStatCards(statsEl, [
      { label: "Drives", value: s.drives ?? 0, cls: "accent" },
      { label: "Total capacity", value: s.totalLabel ?? "—" },
      { label: "Used", value: s.usedLabel ?? "—", cls: "warn" },
      { label: "Free", value: s.freeLabel ?? "—", cls: "success" },
      { label: "Overall usage", value: s.usagePercent != null ? `${s.usagePercent}%` : "—" },
    ]);

    renderDriveCards();
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

    const pick = (key) => {
      const drive = allDrives.find((d) => d.key === key);
      showDetail(drive, ui);
    };

    tbody.addEventListener("click", (e) => {
      const row = e.target.closest("tr[data-key]");
      if (row) pick(row.dataset.key);
    });

    driveGrid.addEventListener("click", (e) => {
      const card = e.target.closest(".drive-card[data-key]");
      if (card) pick(card.dataset.key);
    });

    driveGrid.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        const card = e.target.closest(".drive-card[data-key]");
        if (card) {
          e.preventDefault();
          pick(card.dataset.key);
        }
      }
    });

    ui.detailClose.addEventListener("click", () => {
      selectedKey = null;
      ui.shell.classList.remove("detail-open");
      ui.detailPanel.classList.add("hidden");
      renderDriveCards();
      renderTable();
    });
  }

  return { id: "storage", page, scan, bind };
})();
