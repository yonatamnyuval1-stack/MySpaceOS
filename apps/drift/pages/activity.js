window.DriftPages = window.DriftPages || {};

window.DriftPages.activity = (function () {
  const { escapeHtml, invoke, formatWhen, debounce, EVENT_FILTERS, TIME_FILTERS } = window.Drift;

  const page = document.getElementById("page-activity");
  const statsEl = document.getElementById("activity-stats");
  const timeline = document.getElementById("event-timeline");
  const resultsMeta = document.getElementById("results-meta");
  const searchInput = document.getElementById("event-search");
  const typeFilter = document.getElementById("type-filter");
  const zoneFilter = document.getElementById("zone-filter");
  const timeFilter = document.getElementById("time-filter");
  const detailPanel = document.getElementById("detail-panel");
  const detailBody = document.getElementById("detail-body");
  const detailTitle = document.getElementById("detail-title");
  const detailClose = document.getElementById("detail-close");
  const shell = document.getElementById("app-shell");
  const pager = document.getElementById("pager");
  const btnPrev = document.getElementById("btn-prev");
  const btnNext = document.getElementById("btn-next");
  const pagerLabel = document.getElementById("pager-label");

  let events = [];
  let zones = [];
  let insights = null;
  let offset = 0;
  const limit = 40;
  let lastTotal = 0;
  let selectedEvent = null;

  function initFilters() {
    typeFilter.innerHTML = EVENT_FILTERS.map(
      (f) => `<option value="${escapeHtml(f.id)}">${escapeHtml(f.label)}</option>`
    ).join("");
    timeFilter.innerHTML = TIME_FILTERS.map(
      (f) => `<option value="${f.id}">${escapeHtml(f.label)}</option>`
    ).join("");
  }

  async function loadZoneFilter() {
    try {
      const res = await invoke("zones.list");
      zones = res.zones || [];
      zoneFilter.innerHTML =
        `<option value="all">All zones</option>` +
        zones.map((z) => `<option value="${escapeHtml(z.id)}">${escapeHtml(z.label)}</option>`).join("");
    } catch {
      zoneFilter.innerHTML = `<option value="all">All zones</option>`;
    }
  }

  function renderStats() {
    const s = insights?.stats || {};
    statsEl.innerHTML = `
      <div class="stat-card"><span class="stat-val">${(s.todayEvents || 0).toLocaleString()}</span><span class="stat-label">Today</span></div>
      <div class="stat-card"><span class="stat-val">${(s.weekEvents || s.periodEvents || 0).toLocaleString()}</span><span class="stat-label">This week</span></div>
      <div class="stat-card"><span class="stat-val">${(s.totalEvents || 0).toLocaleString()}</span><span class="stat-label">Total events</span></div>
      <div class="stat-card"><span class="stat-val">${s.paused ? "Paused" : (s.enabledZones || 0)}</span><span class="stat-label">${s.paused ? "Status" : "Active zones"}</span></div>`;
  }

  function dayGroupLabel(iso) {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return "Today";
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  }

  function eventRow(e) {
    return `<article class="event-card ${selectedEvent?.id === e.id ? "selected" : ""}" data-id="${escapeHtml(e.id)}">
      <div class="event-icon">${escapeHtml(e.icon || "•")}</div>
      <div class="event-body">
        <div class="event-head">
          <h3>${escapeHtml(e.title)}</h3>
          <time>${escapeHtml(formatWhen(e.at))}</time>
        </div>
        <p class="event-summary">${escapeHtml(e.summary || e.typeLabel || "")}</p>
        <div class="event-meta">
          <span class="event-type">${escapeHtml(e.typeLabel || e.type)}</span>
          <span class="event-zone">${escapeHtml(e.zoneLabel || "")}</span>
        </div>
      </div>
    </article>`;
  }

  function renderTimeline() {
    let html = "";
    let lastGroup = null;
    for (const e of events) {
      const group = dayGroupLabel(e.at);
      if (group !== lastGroup) {
        html += `<h3 class="timeline-day">${escapeHtml(group)}</h3>`;
        lastGroup = group;
      }
      html += eventRow(e);
    }
    timeline.innerHTML = html;
    timeline.querySelectorAll(".event-card").forEach((card) => {
      card.addEventListener("click", () => openDetail(card.dataset.id));
    });
  }

  async function loadEvents() {
    timeline.innerHTML = `<p class="loading-msg">Loading timeline…</p>`;
    try {
      const sinceDays = parseInt(timeFilter?.value, 10) || 0;
      const res = await invoke("events.list", {
        q: searchInput?.value || "",
        type: typeFilter?.value || "all",
        zoneId: zoneFilter?.value || "all",
        sinceDays: sinceDays || undefined,
        offset,
        limit,
      });
      events = res.events || [];
      lastTotal = res.total;

      resultsMeta.textContent =
        lastTotal === 0
          ? "No events yet — add a watch zone and run Scan."
          : `${lastTotal.toLocaleString()} event(s) · newest first`;

      if (!events.length) {
        timeline.innerHTML = `<div class="empty-state">
          <p>No events match your filters.</p>
          <p class="muted">Go to <strong>Zones</strong>, add a folder, then click <strong>Scan now</strong>.</p>
        </div>`;
      } else {
        renderTimeline();
      }

      const hasPager = lastTotal > limit;
      pager?.classList.toggle("hidden", !hasPager);
      if (hasPager) {
        pagerLabel.textContent = `${offset + 1}–${Math.min(offset + limit, lastTotal)} of ${lastTotal}`;
        btnPrev.disabled = offset + limit >= lastTotal;
        btnNext.disabled = offset <= 0;
      }
    } catch (err) {
      timeline.innerHTML = `<div class="empty-state error"><p>${escapeHtml(err.message)}</p></div>`;
    }
  }

  function resolveFullPath(e) {
    return e.meta?.fullPath || e.path || "";
  }

  async function openDetail(id) {
    let e = events.find((x) => x.id === id);
    if (!e && id) {
      try {
        const res = await invoke("events.list", { q: "", limit: 100, offset: 0, sinceDays: 90 });
        e = (res.events || []).find((x) => x.id === id) || null;
        if (e && !events.some((x) => x.id === id)) {
          events = [e, ...events];
        }
      } catch {
      }
    }
    if (!e) return;
    selectedEvent = e;
    const fullPath = resolveFullPath(e);
    shell.classList.add("detail-open");
    detailPanel.classList.remove("hidden");
    detailTitle.textContent = e.title;
    detailBody.innerHTML = `
      <div class="detail-badges">
        <span class="type-badge">${escapeHtml(e.icon || "")} ${escapeHtml(e.typeLabel || e.type)}</span>
        <span class="zone-badge">${escapeHtml(e.zoneLabel || "")}</span>
      </div>
      <section class="detail-section">
        <h4>When</h4>
        <p>${escapeHtml(new Date(e.at).toLocaleString())}</p>
      </section>
      ${e.summary ? `<section class="detail-section"><h4>Details</h4><p>${escapeHtml(e.summary)}</p></section>` : ""}
      ${e.path ? `<section class="detail-section"><h4>Path</h4><code class="path-code">${escapeHtml(e.path)}</code></section>` : ""}
      ${fullPath ? `<section class="detail-section"><h4>Full path</h4><code class="path-code">${escapeHtml(fullPath)}</code></section>` : ""}
      <section class="detail-section detail-actions">
        ${fullPath ? `<button type="button" class="btn btn-ghost btn-sm" id="evt-reveal">Show in Explorer</button>` : ""}
        ${fullPath ? `<button type="button" class="btn btn-ghost btn-sm" id="evt-copy-path">Copy path</button>` : ""}
        <button type="button" class="btn btn-ghost btn-sm" id="evt-copy">Copy details</button>
      </section>`;

    detailBody.querySelector("#evt-copy")?.addEventListener("click", () => {
      const text = [e.title, e.summary, fullPath || e.path, e.at].filter(Boolean).join("\n");
      invoke("clipboard.copy", { text });
    });

    detailBody.querySelector("#evt-copy-path")?.addEventListener("click", () => {
      invoke("clipboard.copy", { text: fullPath });
    });

    detailBody.querySelector("#evt-reveal")?.addEventListener("click", () => {
      invoke("folder.reveal", { path: fullPath });
    });

    renderTimeline();
  }

  function closeDetail() {
    selectedEvent = null;
    shell.classList.remove("detail-open");
    detailPanel.classList.add("hidden");
  }

  const debouncedSearch = debounce(() => {
    offset = 0;
    loadEvents();
  }, 250);

  function bind() {
    initFilters();
    loadZoneFilter();
    searchInput?.addEventListener("input", debouncedSearch);
    typeFilter?.addEventListener("change", () => {
      offset = 0;
      loadEvents();
    });
    zoneFilter?.addEventListener("change", () => {
      offset = 0;
      loadEvents();
    });
    timeFilter?.addEventListener("change", () => {
      offset = 0;
      loadEvents();
    });
    detailClose?.addEventListener("click", closeDetail);
    btnPrev?.addEventListener("click", () => {
      offset = Math.min(lastTotal - limit, offset + limit);
      loadEvents();
    });
    btnNext?.addEventListener("click", () => {
      offset = Math.max(0, offset - limit);
      loadEvents();
    });
  }

  async function scan() {
    try {
      await loadZoneFilter();
      insights = await invoke("insights.get", { days: 7 });
      renderStats();
      await loadEvents();
    } catch (err) {
      timeline.innerHTML = `<div class="empty-state error"><p>${escapeHtml(err.message)}</p></div>`;
    }
  }

  return { id: "activity", page, scan, bind, closeDetail, openDetail };
})();
