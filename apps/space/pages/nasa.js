window.SpacePages = window.SpacePages || {};

window.SpacePages.nasa = (function () {
  const { escapeHtml, invoke } = window.Space;

  const page = document.getElementById("page-nasa");
  const tabBar = document.getElementById("nasa-tabs");
  const panels = {
    apod: document.getElementById("nasa-panel-apod"),
    missions: document.getElementById("nasa-panel-missions"),
    images: document.getElementById("nasa-panel-images"),
    neo: document.getElementById("nasa-panel-neo"),
    mars: document.getElementById("nasa-panel-mars"),
  };

  let activeTab = "apod";
  let missionsLoaded = false;

  function setTab(tab) {
    activeTab = tab;
    tabBar?.querySelectorAll("[data-nasa-tab]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.nasaTab === tab);
    });
    Object.entries(panels).forEach(([id, el]) => {
      if (el) el.hidden = id !== tab;
    });
    if (tab === "apod") loadApod();
    if (tab === "missions" && !missionsLoaded) loadMissions();
    if (tab === "images") loadImages();
    if (tab === "neo") loadNeo();
    if (tab === "mars") loadMars();
  }

  async function loadApod() {
    const el = document.getElementById("nasa-apod-content");
    if (!el) return;
    el.innerHTML = `<p class="muted">Loading NASA Astronomy Picture of the Day…</p>`;
    try {
      const res = await invoke("apod.today", {});
      const apod = res.apod;
      const imgUrl = apod.hdurl || apod.url;
      const isVideo = apod.mediaType === "video";
      el.innerHTML = `
        <article class="apod-card">
          ${res.cacheNote ? `<p class="apod-cache-note">${escapeHtml(res.cacheNote)}</p>` : ""}
          <header class="apod-head">
            <h2>${escapeHtml(apod.title)}</h2>
            <span class="apod-date">${escapeHtml(apod.date)}</span>
          </header>
          ${
            isVideo
              ? `<p><span class="wiki-link" data-url="${escapeHtml(apod.url)}">Watch video →</span></p>`
              : `<img class="apod-img" src="${escapeHtml(imgUrl)}" alt="" loading="lazy" />`
          }
          <p class="apod-text">${escapeHtml(apod.explanation)}</p>
          ${apod.copyright ? `<p class="muted">© ${escapeHtml(apod.copyright)}</p>` : ""}
        </article>`;
      el.querySelector("[data-url]")?.addEventListener("click", () => invoke("link.open", { url: apod.url }));
    } catch (err) {
      el.innerHTML = `<p class="db-err">${escapeHtml(err.message)}</p>`;
    }
  }

  function missionCard(m) {
    return `<article class="item-card nasa-mission-card" data-mission="${escapeHtml(m.id)}">
      ${
        m.image
          ? `<img class="item-thumb" src="${escapeHtml(m.image)}" alt="" loading="lazy" onerror="this.style.display='none'" />`
          : `<span class="item-thumb-ph" style="color:${escapeHtml(m.color || "#7eb8ff")}">🚀</span>`
      }
      <div class="item-body">
        <h3>${escapeHtml(m.name)}</h3>
        <span class="item-sub">${escapeHtml(m.agency)} · ${escapeHtml(m.era)} · ${escapeHtml(m.status)}</span>
        <p class="item-desc">${escapeHtml((m.summary || "").slice(0, 100))}…</p>
      </div>
    </article>`;
  }

  async function loadMissions() {
    const grid = document.getElementById("nasa-missions-grid");
    const stats = document.getElementById("nasa-missions-stats");
    const status = document.getElementById("nasa-mission-status")?.value || "all";
    const q = document.getElementById("nasa-mission-search")?.value || "";
    grid.innerHTML = `<p class="muted">Loading missions…</p>`;
    try {
      const res = await invoke("nasa.missions.list", { status, q });
      missionsLoaded = true;
      const active = res.missions.filter((m) => m.status === "active").length;
      stats.innerHTML = `
        <div class="stat-card"><span class="stat-val">${res.count}</span><span class="stat-label">Missions</span></div>
        <div class="stat-card"><span class="stat-val">${active}</span><span class="stat-label">Active</span></div>`;
      grid.innerHTML = res.missions.map(missionCard).join("") || `<p class="empty-msg">No missions match.</p>`;
      grid.querySelectorAll("[data-mission]").forEach((el) => {
        el.addEventListener("click", () => window.SpaceDetail.openMission(el.dataset.mission));
      });
    } catch (err) {
      grid.innerHTML = `<p class="db-err">${escapeHtml(err.message)}</p>`;
    }
  }

  async function loadImages() {
    const grid = document.getElementById("nasa-images-grid");
    const q = document.getElementById("nasa-image-search")?.value?.trim() || "nebula";
    grid.innerHTML = `<p class="muted">Searching NASA Image Library…</p>`;
    try {
      const res = await invoke("nasa.images.search", { q, page: 1 });
      if (res.cacheNote && !res.items.length) {
        grid.innerHTML = `<p class="apod-cache-note">${escapeHtml(res.cacheNote)}</p>`;
        return;
      }
      const cards = (res.items || [])
        .map(
          (img) => `<article class="nasa-img-card">
            ${img.thumb ? `<img src="${escapeHtml(img.thumb)}" alt="" loading="lazy" />` : ""}
            <div class="nasa-img-body">
              <h4>${escapeHtml(img.title)}</h4>
              <p class="muted">${escapeHtml(img.description)}</p>
              ${img.href ? `<span class="wiki-link" data-url="${escapeHtml(img.href)}">Open asset →</span>` : ""}
            </div>
          </article>`
        )
        .join("");
      grid.innerHTML =
        (res.cacheNote ? `<p class="apod-cache-note">${escapeHtml(res.cacheNote)}</p>` : "") +
        (cards || `<p class="empty-msg">No images found.</p>`);
      grid.querySelectorAll("[data-url]").forEach((el) => {
        el.addEventListener("click", () => invoke("link.open", { url: el.dataset.url }));
      });
    } catch (err) {
      grid.innerHTML = `<p class="db-err">${escapeHtml(err.message)}</p>`;
    }
  }

  function neoRow(date, obj) {
    const approach = obj.close_approach_data?.[0] || {};
    const diam = obj.estimated_diameter?.meters;
    const size =
      diam?.estimated_diameter_min != null
        ? `${Math.round(diam.estimated_diameter_min)}–${Math.round(diam.estimated_diameter_max)} m`
        : "—";
    const hazard = obj.is_potentially_hazardous_asteroid ? "⚠ PHA" : "";
    return `<tr>
      <td>${escapeHtml(obj.name)}</td>
      <td>${escapeHtml(date)}</td>
      <td>${escapeHtml(approach.miss_distance?.lunar || "—")} lunar</td>
      <td>${escapeHtml(approach.relative_velocity?.kilometers_per_second || "—")} km/s</td>
      <td>${escapeHtml(size)} ${hazard}</td>
      <td>${obj.nasa_jpl_url ? `<span class="wiki-link" data-url="${escapeHtml(obj.nasa_jpl_url)}">JPL</span>` : ""}</td>
    </tr>`;
  }

  async function loadNeo() {
    const wrap = document.getElementById("nasa-neo-table-wrap");
    wrap.innerHTML = `<p class="muted">Loading asteroid close approaches…</p>`;
    try {
      const res = await invoke("nasa.neo.feed", {});
      const feed = res.feed?.near_earth_objects || {};
      const rows = [];
      for (const [date, objs] of Object.entries(feed)) {
        for (const obj of objs) rows.push(neoRow(date, obj));
      }
      wrap.innerHTML = `
        ${res.cacheNote ? `<p class="apod-cache-note">${escapeHtml(res.cacheNote)}</p>` : ""}
        <p class="muted">${escapeHtml(res.startDate)} → ${escapeHtml(res.endDate)} · ${rows.length} objects</p>
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr><th>Name</th><th>Date</th><th>Miss</th><th>Velocity</th><th>Size</th><th></th></tr></thead>
            <tbody>${rows.join("") || "<tr><td colspan='6'>No data</td></tr>"}</tbody>
          </table>
        </div>`;
      wrap.querySelectorAll("[data-url]").forEach((el) => {
        el.addEventListener("click", () => invoke("link.open", { url: el.dataset.url }));
      });
    } catch (err) {
      wrap.innerHTML = `<p class="db-err">${escapeHtml(err.message)}</p>`;
    }
  }

  async function loadMars() {
    const grid = document.getElementById("nasa-mars-grid");
    const rover = document.getElementById("nasa-mars-rover")?.value || "curiosity";
    grid.innerHTML = `<p class="muted">Loading Mars rover photos…</p>`;
    try {
      const res = await invoke("nasa.mars.photos", { rover });
      if (res.cacheNote) grid.innerHTML = `<p class="apod-cache-note">${escapeHtml(res.cacheNote)}</p>`;
      const cards = (res.photos || [])
        .map(
          (p) => `<article class="nasa-img-card">
            <img src="${escapeHtml(p.img)}" alt="" loading="lazy" />
            <div class="nasa-img-body">
              <h4>Sol ${escapeHtml(p.sol)} · ${escapeHtml(p.rover)}</h4>
              <p class="muted">${escapeHtml(p.camera)} · ${escapeHtml(p.earthDate)}</p>
            </div>
          </article>`
        )
        .join("");
      grid.innerHTML = (res.cacheNote && res.photos?.length ? `<p class="apod-cache-note">${escapeHtml(res.cacheNote)}</p>` : "") + (cards || `<p class="empty-msg">No photos returned.</p>`);
    } catch (err) {
      grid.innerHTML = `<p class="db-err">${escapeHtml(err.message)}</p>`;
    }
  }

  async function refreshDemoNote() {
    const note = document.getElementById("nasa-demo-note");
    if (!note) return;
    try {
      const res = await invoke("nasa.status", {});
      if (res?.usingDemoKey) {
        note.hidden = false;
        if (res.demoKeyNote) note.textContent = res.demoKeyNote;
      } else {
        note.hidden = true;
      }
    } catch {
      note.hidden = false;
    }
  }

  function bind() {
    tabBar?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-nasa-tab]");
      if (!btn) return;
      setTab(btn.dataset.nasaTab);
    });
    document.getElementById("btn-apod-refresh")?.addEventListener("click", loadApod);
    document.getElementById("nasa-mission-search")?.addEventListener("input", () => {
      missionsLoaded = false;
      loadMissions();
    });
    document.getElementById("nasa-mission-status")?.addEventListener("change", () => {
      missionsLoaded = false;
      loadMissions();
    });
    document.getElementById("btn-nasa-images")?.addEventListener("click", loadImages);
    document.getElementById("nasa-image-search")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") loadImages();
    });
    document.getElementById("btn-nasa-mars")?.addEventListener("click", loadMars);
  }

  function scan() {
    void refreshDemoNote();
    setTab(activeTab);
  }

  return { id: "nasa", page, scan, bind };
})();