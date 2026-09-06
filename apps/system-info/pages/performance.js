window.SysInfoPages = window.SysInfoPages || {};

window.SysInfoPages.performance = (function () {
  const { escapeHtml, invoke, renderStatCards } = window.SysInfo;
  const { drawLineChart } = window.SysInfoCharts;

  const page = document.getElementById("page-performance");
  const statsEl = document.getElementById("performance-stats");
  const rangeSelect = document.getElementById("performance-range");
  const clearBtn = document.getElementById("performance-clear-btn");
  const lastScanEl = document.getElementById("performance-last-scan");
  const cpuCanvas = document.getElementById("chart-cpu");
  const memCanvas = document.getElementById("chart-memory");
  const diskCanvas = document.getElementById("chart-disk");

  let lastSamples = [];

  function renderCharts() {
    drawLineChart(cpuCanvas, lastSamples, "cpu", { color: "#3dd6c6", label: "CPU %", maxY: 100 });
    drawLineChart(memCanvas, lastSamples, "memory", { color: "#7fd962", label: "Memory %", maxY: 100 });
    drawLineChart(diskCanvas, lastSamples, "disk", { color: "#f0b429", label: "Disk used %", maxY: 100 });
  }

  async function scan() {
    const range = rangeSelect.value || "1h";
    const sample = await invoke("metrics.sample");
    const history = await invoke("metrics.history", { range });
    lastSamples = history.samples || [];

    const cur = sample.current || {};
    renderStatCards(statsEl, [
      { label: "CPU now", value: cur.cpu != null ? `${cur.cpu}%` : "—", cls: "accent" },
      { label: "Memory now", value: cur.memory != null ? `${cur.memory}%` : "—", cls: "success" },
      { label: "Disk used", value: cur.disk != null ? `${cur.disk}%` : "—", cls: "warn" },
      { label: "Samples", value: history.count ?? lastSamples.length, hint: `Range: ${range}` },
    ]);

    renderCharts();

    const at = new Date();
    lastScanEl.textContent = `Last sample: ${at.toLocaleTimeString()} · ${lastSamples.length} points in view`;
    return history;
  }

  function bind() {
    rangeSelect.addEventListener("change", () => scan());
    clearBtn.addEventListener("click", async () => {
      if (!confirm("Clear all performance history?")) return;
      await invoke("metrics.clear");
      lastSamples = [];
      await scan();
    });
    window.addEventListener("resize", () => {
      if (page.classList.contains("active")) renderCharts();
    });
  }

  return { id: "performance", page, scan, bind };
})();
