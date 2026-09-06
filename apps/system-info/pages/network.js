window.SysInfoPages = window.SysInfoPages || {};

window.SysInfoPages.network = (function () {
  const { escapeHtml, invoke, renderStatCards, setupSortableTable, updateSortHeaders, compare } =
    window.SysInfo;

  const page = document.getElementById("page-network");
  const statsEl = document.getElementById("network-stats");
  const cardsEl = document.getElementById("network-cards");
  const tbody = document.getElementById("network-body");
  const rowCountEl = document.getElementById("network-row-count");
  const lastScanEl = document.getElementById("network-last-scan");
  const searchEl = document.getElementById("network-search");
  const filterEl = document.getElementById("network-filter");
  const table = document.getElementById("network-table");

  let allAdapters = [];
  let sortKey = "name";
  let sortDir = "asc";
  let selectedKey = null;
  const numericKeys = new Set();

  function statusPill(connected, status) {
    if (connected) return '<span class="state-pill listening">Connected</span>';
    return `<span class="state-pill other">${escapeHtml(status)}</span>`;
  }

  function getFiltered() {
    const q = searchEl.value.trim().toLowerCase();
    const f = filterEl.value;
    return allAdapters.filter((a) => {
      if (f === "up" && !a.connected) return false;
      if (f === "down" && a.connected) return false;
      if (!q) return true;
      return [
        a.name,
        a.description,
        a.ipv4Primary,
        a.macAddress,
        a.dnsPrimary,
        a.gateway4,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }

  function renderCards() {
    const filtered = getFiltered();
    if (!filtered.length) {
      cardsEl.innerHTML = `<p class="empty-cell">No adapters match</p>`;
      return;
    }
    cardsEl.innerHTML = filtered
      .map((a) => {
        const sel = a.key === selectedKey ? " selected" : "";
        return `
        <article class="adapter-card ${sel}" data-key="${escapeHtml(a.key)}" tabindex="0">
          <header class="adapter-card-head">
            <strong>${escapeHtml(a.name)}</strong>
            ${statusPill(a.connected, a.status)}
          </header>
          <p class="adapter-desc">${escapeHtml(a.description || "—")}</p>
          <p class="adapter-ip mono">${escapeHtml(a.ipv4Primary)}</p>
          <footer class="adapter-foot">
            <span>${escapeHtml(a.linkSpeed)}</span>
            <span class="mono">${escapeHtml(a.macAddress)}</span>
          </footer>
        </article>`;
      })
      .join("");
  }

  function renderTable() {
    const filtered = getFiltered().sort((a, b) => compare(a, b, sortKey, sortDir, numericKeys));
    updateSortHeaders(table, sortKey, sortDir);

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-cell">No adapters</td></tr>`;
      rowCountEl.textContent = "0 adapters";
      return;
    }

    tbody.innerHTML = filtered
      .map((a) => {
        const sel = a.key === selectedKey ? " selected" : "";
        return `<tr data-key="${escapeHtml(a.key)}" class="${sel}">
          <td class="process-cell">${escapeHtml(a.name)}</td>
          <td>${statusPill(a.connected, a.status)}</td>
          <td class="mono addr-cell">${escapeHtml(a.ipv4Primary)}</td>
          <td class="mono addr-cell">${escapeHtml(a.gateway4)}</td>
          <td class="addr-cell">${escapeHtml(a.dnsPrimary)}</td>
          <td>${escapeHtml(a.linkSpeed)}</td>
        </tr>`;
      })
      .join("");
    rowCountEl.textContent = `${filtered.length} of ${allAdapters.length} adapters`;
  }

  function detailRow(label, value, mono) {
    if (!value || value === "—") return "";
    const cls = mono ? ' class="mono"' : "";
    return `<div class="detail-row"><dt>${escapeHtml(label)}</dt><dd${cls}>${escapeHtml(String(value))}</dd></div>`;
  }

  function showDetail(adapter, ui) {
    if (!adapter) return;
    selectedKey = adapter.key;
    ui.shell.classList.add("detail-open");
    ui.detailPanel.classList.remove("hidden");
    ui.detailTitle.textContent = adapter.name;

    ui.detailBody.innerHTML = `
      <dl>
        ${detailRow("Status", adapter.statusLabel)}
        ${detailRow("Description", adapter.description)}
        ${detailRow("MAC address", adapter.macAddress, true)}
        ${detailRow("Link speed", adapter.linkSpeed)}
        ${detailRow("IPv4", adapter.ipv4.join(", ") || "—", true)}
        ${detailRow("IPv6", adapter.ipv6.join(", ") || "—", true)}
        ${detailRow("Gateway (IPv4)", adapter.gateway4, true)}
        ${detailRow("Gateway (IPv6)", adapter.gateway6, true)}
        ${detailRow("DNS servers", adapter.dns.join(", "), true)}
      </dl>`;
    renderCards();
    renderTable();
  }

  function renderAll() {
    renderCards();
    renderTable();
  }

  async function scan() {
    tbody.innerHTML = `<tr><td colspan="6" class="loading-cell">Scanning network…</td></tr>`;
    cardsEl.innerHTML = `<p class="loading-cell">Loading…</p>`;
    const result = await invoke("network.scan");
    allAdapters = result.adapters || [];
    const s = result.summary || {};

    renderStatCards(statsEl, [
      { label: "Adapters", value: s.adapters ?? 0, cls: "accent" },
      { label: "Connected", value: s.connected ?? 0, cls: "success" },
      { label: "Primary IPv4", value: s.primaryIp ?? "—" },
    ]);

    renderAll();
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
      el.addEventListener("input", renderAll);
      el.addEventListener("change", renderAll);
    });

    const pick = (key) => {
      const adapter = allAdapters.find((a) => a.key === key);
      showDetail(adapter, ui);
    };

    tbody.addEventListener("click", (e) => {
      const row = e.target.closest("tr[data-key]");
      if (row) pick(row.dataset.key);
    });

    cardsEl.addEventListener("click", (e) => {
      const card = e.target.closest(".adapter-card[data-key]");
      if (card) pick(card.dataset.key);
    });

    ui.detailClose.addEventListener("click", () => {
      selectedKey = null;
      ui.shell.classList.remove("detail-open");
      ui.detailPanel.classList.add("hidden");
      renderAll();
    });
  }

  return { id: "network", page, scan, bind };
})();
