window.SysInfoPages = window.SysInfoPages || {};

window.SysInfoPages.disk = (function () {
  const { escapeHtml, invoke, renderStatCards, formatBytes, formatTime, setupSortableTable, updateSortHeaders, compare } =
    window.SysInfo;

  const page = document.getElementById("page-disk");
  const statsEl = document.getElementById("disk-stats");
  const treemapEl = document.getElementById("disk-treemap");
  const folderBody = document.getElementById("disk-folder-body");
  const filesBody = document.getElementById("disk-files-body");
  const breadcrumbEl = document.getElementById("disk-breadcrumb");
  const pathInput = document.getElementById("disk-path-input");
  const driveSelect = document.getElementById("disk-drive-select");
  const depthSelect = document.getElementById("disk-depth-select");
  const scanBtn = document.getElementById("disk-scan-btn");
  const cancelBtn = document.getElementById("disk-cancel-btn");
  const lastScanEl = document.getElementById("disk-last-scan");
  const folderTable = document.getElementById("disk-folder-table");
  const filesTable = document.getElementById("disk-files-table");

  let currentPath = "C:\\";
  let scanning = false;
  let treeData = null;
  let lastFiles = [];
  let sortKey = "sizeBytes";
  let sortDir = "desc";
  let fileSortKey = "sizeBytes";
  let fileSortDir = "desc";
  const numericKeys = new Set(["sizeBytes"]);

  function setScanning(on) {
    scanning = on;
    scanBtn.disabled = on;
    cancelBtn.disabled = !on;
    depthSelect.disabled = on;
    driveSelect.disabled = on;
  }

  function renderBreadcrumb(root) {
    const parts = root.replace(/\\+$/, "").split("\\").filter(Boolean);
    let acc = "";
    const crumbs = parts.map((part, i) => {
      if (i === 0 && part.length === 2 && part.endsWith(":")) {
        acc = `${part}\\`;
      } else {
        acc = acc.endsWith("\\") ? `${acc}${part}` : `${acc}\\${part}`;
      }
      const p = acc;
      return `<button type="button" class="crumb" data-path="${escapeHtml(p)}">${escapeHtml(part)}</button>`;
    });
    breadcrumbEl.innerHTML = crumbs.join('<span class="crumb-sep">›</span>') || escapeHtml(root);
    breadcrumbEl.querySelectorAll(".crumb").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentPath = btn.dataset.path;
        pathInput.value = currentPath;
        runScan();
      });
    });
  }

  function renderTreemap(children, totalBytes) {
    if (!children?.length) {
      treemapEl.innerHTML = `<p class="empty-cell">No folders to display</p>`;
      return;
    }
    const total = totalBytes || children.reduce((s, c) => s + (c.sizeBytes || 0), 0) || 1;
    treemapEl.innerHTML = `
      <div class="treemap-bar">
        ${children
          .map((c) => {
            const pct = Math.max(0.5, ((c.sizeBytes || 0) / total) * 100);
            const cls = pct >= 40 ? "lg" : pct >= 15 ? "md" : "sm";
            return `<button type="button" class="treemap-seg ${cls}" style="flex-grow:${pct}" data-path="${escapeHtml(c.path)}" title="${escapeHtml(c.name)} — ${escapeHtml(c.sizeLabel)}">
              <span class="treemap-name">${escapeHtml(c.name)}</span>
              <span class="treemap-size">${escapeHtml(c.sizeLabel)}</span>
            </button>`;
          })
          .join("")}
      </div>`;
    treemapEl.querySelectorAll(".treemap-seg").forEach((seg) => {
      seg.addEventListener("click", () => {
        if (seg.dataset.path) {
          currentPath = seg.dataset.path;
          pathInput.value = currentPath;
          runScan();
        }
      });
    });
  }

  function renderFolders(children) {
    const sorted = [...(children || [])].sort((a, b) => compare(a, b, sortKey, sortDir, numericKeys));
    updateSortHeaders(folderTable, sortKey, sortDir);
    if (!sorted.length) {
      folderBody.innerHTML = `<tr><td colspan="4" class="empty-cell">No items</td></tr>`;
      return;
    }
    folderBody.innerHTML = sorted
      .map((c) => {
        const type = c.type === "dir" ? "Folder" : "File";
        const nav = c.type === "dir" ? ` data-path="${escapeHtml(c.path)}" class="disk-nav-row"` : "";
        return `<tr${nav}>
          <td>${escapeHtml(type)}</td>
          <td class="process-cell">${escapeHtml(c.name)}</td>
          <td class="mono">${escapeHtml(c.sizeLabel)}</td>
          <td class="mono">${((c.sizeBytes || 0) / (treeData?.totalBytes || 1) * 100).toFixed(1)}%</td>
        </tr>`;
      })
      .join("");
    folderBody.querySelectorAll(".disk-nav-row").forEach((row) => {
      row.addEventListener("click", () => {
        currentPath = row.dataset.path;
        pathInput.value = currentPath;
        runScan();
      });
    });
  }

  function renderFiles(files) {
    const sorted = [...(files || [])].sort((a, b) => compare(a, b, fileSortKey, fileSortDir, numericKeys));
    updateSortHeaders(filesTable, fileSortKey, fileSortDir);
    if (!sorted.length) {
      filesBody.innerHTML = `<tr><td colspan="4" class="empty-cell">No large files found in this scan</td></tr>`;
      return;
    }
    filesBody.innerHTML = sorted
      .map(
        (f) => `<tr>
        <td class="process-cell" title="${escapeHtml(f.path)}">${escapeHtml(f.name)}</td>
        <td class="mono">${escapeHtml(f.sizeLabel)}</td>
        <td class="mono">${formatTime(f.modified)}</td>
        <td class="mono path-cell">${escapeHtml(f.path)}</td>
      </tr>`
      )
      .join("");
  }

  async function loadDrives() {
    const result = await invoke("disk.roots");
    const drives = result.drives || [];
    driveSelect.innerHTML = drives
      .map((d) => `<option value="${escapeHtml(d.id)}\\">${escapeHtml(d.id)} ${escapeHtml(d.name)}</option>`)
      .join("");
    if (drives.length && !drives.some((d) => currentPath.startsWith(d.id))) {
      currentPath = `${drives[0].id}\\`;
      pathInput.value = currentPath;
    }
  }

  async function runScan() {
    if (scanning) return;
    setScanning(true);
    currentPath = pathInput.value.trim() || currentPath;
    folderBody.innerHTML = `<tr><td colspan="4" class="loading-cell">Scanning folders…</td></tr>`;
    filesBody.innerHTML = `<tr><td colspan="4" class="loading-cell">Scanning…</td></tr>`;
    treemapEl.innerHTML = `<p class="loading-cell">Building map…</p>`;

    try {
      const maxDepth = parseInt(depthSelect.value, 10) || 2;
      const [tree, large] = await Promise.all([
        invoke("disk.scan", { path: currentPath, maxDepth, maxChildren: 28 }),
        invoke("disk.largeFiles", { path: currentPath, maxDepth: Math.min(maxDepth + 2, 5) }),
      ]);

      treeData = tree;
      const children = tree.children || [];
      const files = [...(tree.largeFiles || []), ...(large.largeFiles || [])];
      const seen = new Set();
      const uniqueFiles = files.filter((f) => {
        if (seen.has(f.path)) return false;
        seen.add(f.path);
        return true;
      });
      uniqueFiles.sort((a, b) => b.sizeBytes - a.sizeBytes);
      lastFiles = uniqueFiles.slice(0, 60);

      renderStatCards(statsEl, [
        { label: "Scanned path", value: tree.root || currentPath, cls: "accent" },
        { label: "Items (top level)", value: children.length },
        { label: "Visible size", value: tree.totalLabel || "—" },
        { label: "Large files", value: uniqueFiles.length, cls: "warn" },
        { label: "Visits", value: (tree.visitsUsed || 0) + (large.visitsUsed || 0) },
      ]);

      renderBreadcrumb(tree.root || currentPath);
      renderTreemap(children, tree.totalBytes);
      renderFolders(children);
      renderFiles(lastFiles);

      const at = tree.scannedAt ? new Date(tree.scannedAt) : new Date();
      let foot = `Last scan: ${at.toLocaleTimeString()}`;
      if (tree.cancelled || large.cancelled) foot += " · Cancelled (partial results)";
      lastScanEl.textContent = foot;
    } finally {
      setScanning(false);
    }
  }

  async function scan() {
    await loadDrives();
    await runScan();
  }

  function bind(ui) {
    scanBtn.addEventListener("click", runScan);
    cancelBtn.addEventListener("click", () => invoke("disk.cancel"));
    driveSelect.addEventListener("change", () => {
      currentPath = `${driveSelect.value}`;
      pathInput.value = currentPath;
    });
    pathInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") runScan();
    });

    setupSortableTable(folderTable, (key) => {
      if (sortKey === key) sortDir = sortDir === "asc" ? "desc" : "asc";
      else {
        sortKey = key;
        sortDir = "desc";
      }
      renderFolders(treeData?.children || []);
    });

    setupSortableTable(filesTable, (key) => {
      if (fileSortKey === key) fileSortDir = fileSortDir === "asc" ? "desc" : "asc";
      else {
        fileSortKey = key;
        fileSortDir = "desc";
      }
      renderFiles(lastFiles);
    });
  }

  return { id: "disk", page, scan, bind };
})();
