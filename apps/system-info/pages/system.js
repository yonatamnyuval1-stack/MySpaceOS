window.SysInfoPages = window.SysInfoPages || {};

window.SysInfoPages.system = (function () {
  const { escapeHtml, invoke, renderStatCards } = window.SysInfo;

  const page = document.getElementById("page-system");
  const statsEl = document.getElementById("system-stats");
  const gridEl = document.getElementById("system-grid");
  const lastScanEl = document.getElementById("system-last-scan");

  function card(title, rows) {
    const body = rows
      .filter((r) => r.value != null && r.value !== "")
      .map(
        (r) => `
      <div class="info-row">
        <span class="info-label">${escapeHtml(r.label)}</span>
        <span class="info-value${r.mono ? " mono" : ""}">${escapeHtml(String(r.value))}</span>
      </div>`
      )
      .join("");
    return `
      <article class="info-card">
        <h3>${escapeHtml(title)}</h3>
        ${body}
      </article>`;
  }

  function render(info) {
    renderStatCards(statsEl, [
      { label: "Computer", value: info.hostname, cls: "accent" },
      { label: "OS", value: info.osName, cls: "" },
      { label: "Uptime", value: info.uptimeLabel, cls: "success" },
      { label: "RAM", value: info.totalRamLabel },
    ]);

    gridEl.innerHTML = [
      card("Computer", [
        { label: "Hostname", value: info.hostname, mono: true },
        { label: "Domain", value: info.domain },
        { label: "User", value: info.user },
        { label: "Manufacturer", value: info.manufacturer },
        { label: "Model", value: info.model },
        { label: "System type", value: info.systemType },
      ]),
      card("Operating system", [
        { label: "Edition", value: info.osName },
        { label: "Version", value: info.osVersion, mono: true },
        { label: "Build", value: info.osBuild, mono: true },
        { label: "Architecture", value: info.osArch },
        { label: "Installed", value: info.installDateLabel },
        { label: "Serial", value: info.osSerial, mono: true },
      ]),
      card("Runtime", [
        { label: "Uptime", value: info.uptimeLabel },
        { label: "Last boot", value: info.lastBootLabel },
        { label: "Local time", value: info.localTime },
        { label: "Timezone", value: info.timezone },
        { label: "TZ ID", value: info.timezoneId, mono: true },
      ]),
      card("Hardware", [
        { label: "Processors", value: info.processors },
        { label: "Logical CPUs", value: info.logicalProcessors },
        { label: "RAM", value: info.totalRamLabel },
        { label: "BIOS vendor", value: info.biosVendor },
        { label: "BIOS version", value: info.biosVersion, mono: true },
        { label: "BIOS serial", value: info.biosSerial, mono: true },
      ]),
    ].join("");
  }

  async function scan() {
    gridEl.innerHTML = `<p class="loading-cell">Loading system info…</p>`;
    const result = await invoke("system.scan");
    if (result.info) render(result.info);
    const at = result.scannedAt ? new Date(result.scannedAt) : new Date();
    lastScanEl.textContent = `Last scan: ${at.toLocaleTimeString()}`;
    if (result.note) lastScanEl.textContent += ` · ${result.note}`;
    return result;
  }

  function bind() {}

  return { id: "system", page, scan, bind };
})();
