window.DriftPages = window.DriftPages || {};

window.DriftPages.insights = (function () {
  const { escapeHtml, invoke } = window.Drift;

  const page = document.getElementById("page-insights");
  let periodDays = 7;

  function barChart(items, keyLabel, keyValue) {
    if (!items?.length) return `<p class="muted">No data for this period yet.</p>`;
    const max = Math.max(...items.map((i) => i[keyValue]), 1);
    return `<div class="bar-chart">${items
      .slice(0, 8)
      .map((item) => {
        const pct = Math.round((item[keyValue] / max) * 100);
        const label = item[keyLabel] || item.type || item.date;
        return `<div class="bar-row">
          <span class="bar-label">${escapeHtml(String(label))}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
          <span class="bar-val">${item[keyValue]}</span>
        </div>`;
      })
      .join("")}</div>`;
  }

  function changeBadge(stats) {
    if (stats.changePercent === null || stats.changePercent === undefined) return "";
    const sign = stats.changePercent >= 0 ? "+" : "";
    const cls = stats.changePercent >= 0 ? "trend-up" : "trend-down";
    return `<span class="trend-badge ${cls}">${sign}${stats.changePercent}% vs previous period</span>`;
  }

  function render(data) {
    const s = data.stats || {};
    page.innerHTML = `
      <div class="insights-toolbar">
        <label class="field-row">
          <span>Period</span>
          <select id="insights-period" class="select-sm">
            <option value="7" ${periodDays === 7 ? "selected" : ""}>Last 7 days</option>
            <option value="30" ${periodDays === 30 ? "selected" : ""}>Last 30 days</option>
            <option value="90" ${periodDays === 90 ? "selected" : ""}>Last 90 days</option>
          </select>
        </label>
        ${changeBadge(s)}
      </div>

      <div class="stats-row">
        <div class="stat-card"><span class="stat-val">${s.periodEvents || s.weekEvents || 0}</span><span class="stat-label">Events in period</span></div>
        <div class="stat-card"><span class="stat-val">${s.todayEvents || 0}</span><span class="stat-label">Today</span></div>
        <div class="stat-card"><span class="stat-val">${s.enabledZones || 0}</span><span class="stat-label">Active zones</span></div>
        <div class="stat-card"><span class="stat-val">${s.totalEvents || 0}</span><span class="stat-label">All time</span></div>
      </div>

      <div class="insights-grid">
        <section class="insight-card">
          <h3>Activity by day</h3>
          ${barChart(data.byDay, "date", "count")}
        </section>
        <section class="insight-card">
          <h3>By event type</h3>
          ${barChart(
            data.byType?.map((t) => ({ label: `${t.icon || ""} ${t.label || t.type}`, count: t.count })),
            "label",
            "count"
          )}
        </section>
        <section class="insight-card">
          <h3>By watch zone</h3>
          ${barChart(data.byZone, "label", "count")}
        </section>
      </div>

      <section class="insight-card insight-summary">
        <h3>Summary</h3>
        <p class="summary-text">${escapeHtml(buildSummary(data))}</p>
      </section>`;

    page.querySelector("#insights-period")?.addEventListener("change", (e) => {
      periodDays = parseInt(e.target.value, 10) || 7;
      scan();
    });
  }

  function buildSummary(data) {
    const s = data.stats || {};
    const days = s.periodDays || periodDays;
    if (!s.periodEvents && !s.weekEvents) {
      return `No activity in the last ${days} days. Add watch zones and run Scan to start building your timeline.`;
    }
    const count = s.periodEvents || s.weekEvents || 0;
    const topType = data.byType?.[0];
    const topZone = data.byZone?.[0];
    const parts = [`${count} events in the last ${days} days across ${s.enabledZones || 0} active zone(s).`];
    if (s.changePercent !== null && s.changePercent !== undefined) {
      parts.push(
        s.changePercent >= 0
          ? `Up ${s.changePercent}% compared to the previous ${days}-day period.`
          : `Down ${Math.abs(s.changePercent)}% compared to the previous ${days}-day period.`
      );
    }
    if (topType) parts.push(`Most common: ${topType.label || topType.type} (${topType.count}).`);
    if (topZone) parts.push(`Busiest zone: ${topZone.label} (${topZone.count}).`);
    return parts.join(" ");
  }

  async function scan() {
    page.innerHTML = `<p class="loading-msg">Loading insights…</p>`;
    try {
      const data = await invoke("insights.get", { days: periodDays });
      render(data);
    } catch (err) {
      page.innerHTML = `<div class="empty-state error"><p>${escapeHtml(err.message)}</p></div>`;
    }
  }

  function bind() {}

  return { id: "insights", page, scan, bind };
})();
