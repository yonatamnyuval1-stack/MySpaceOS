window.SpaceDetail = (function () {
  const { escapeHtml, invoke, truncate, categoryLabel, formatDistAU } = window.Space;

  const panel = document.getElementById("detail-panel");
  const body = document.getElementById("detail-body");
  const titleEl = document.getElementById("detail-title");
  const shell = document.getElementById("app-shell");
  const closeBtn = document.getElementById("detail-close");

  let selectedId = null;

  closeBtn?.addEventListener("click", close);

  function infoItem(label, val) {
    if (val == null || val === "") return "";
    return `<div class="info-item"><span class="info-label">${escapeHtml(label)}</span><span class="info-val">${escapeHtml(String(val))}</span></div>`;
  }

  function factList(facts) {
    if (!facts?.length) return "";
    return `<ul class="fact-list">${facts.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>`;
  }

  function moonList(children) {
    if (!children?.length) return "";
    return `<div class="moon-list">
      <h4>Moons & related</h4>
      <div class="moon-chips">${children
        .map(
          (m) =>
            `<button type="button" class="moon-chip" data-open="${escapeHtml(m.id)}">${escapeHtml(m.name)}</button>`
        )
        .join("")}</div>
    </div>`;
  }

  function renderStar(bodyData, wiki) {
    const wikiBlock = wiki?.extract
      ? `<div class="wiki-block">
          <h4>📖 ${escapeHtml(wiki.title || bodyData.name)}</h4>
          ${wiki.description ? `<p class="muted">${escapeHtml(wiki.description)}</p>` : ""}
          <div class="wiki-text">${escapeHtml(truncate(wiki.extract, 5000))}</div>
          ${wiki.wikiUrl ? `<span class="wiki-link" data-url="${escapeHtml(wiki.wikiUrl)}">Full Wikipedia article →</span>` : ""}
        </div>`
      : bodyData.named
        ? `<p class="muted">No Wikipedia article loaded.</p>`
        : `<p class="muted">Faint catalog star: detailed Wikipedia page may not exist.</p>`;

    body.innerHTML = `
      <div class="detail-hero">
        <span class="hero-placeholder" style="background:${escapeHtml(bodyData.color)}33;border-color:${escapeHtml(bodyData.color)}">✦</span>
        <h3>${escapeHtml(bodyData.name)}</h3>
        <p class="detail-official">${escapeHtml(categoryLabel("star"))}${bodyData.constellation ? ` · ${escapeHtml(bodyData.constellation)}` : ""}</p>
        ${bodyData.description ? `<p class="detail-desc">${escapeHtml(bodyData.description)}</p>` : ""}
      </div>
      <div class="detail-tabs">
        <button type="button" class="tab-btn active" data-tab="overview">Overview</button>
        <button type="button" class="tab-btn" data-tab="article">Article</button>
      </div>
      <div class="tab-pane active" data-pane="overview">
        <div class="info-grid">
          ${infoItem("Distance", bodyData.distLy != null ? `${bodyData.distLy} light-years` : "")}
          ${infoItem("Magnitude", bodyData.magnitude)}
          ${infoItem("Spectral type", bodyData.spectral)}
          ${infoItem("Constellation", bodyData.constellation)}
        </div>
        ${factList(bodyData.facts)}
      </div>
      <div class="tab-pane" data-pane="article">${wikiBlock}</div>
    `;
    wireDetailInteractions(bodyData);
  }

  function wireDetailInteractions(bodyData) {
    body.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        body.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b === btn));
        body.querySelectorAll(".tab-pane").forEach((p) => {
          p.classList.toggle("active", p.dataset.pane === btn.dataset.tab);
        });
      });
    });
    body.querySelectorAll("[data-url]").forEach((el) => {
      el.addEventListener("click", () => invoke("link.open", { url: el.dataset.url }));
    });
  }

  function render(bodyData, children, wiki) {
    const images = [];
    if (bodyData.image) images.push({ url: bodyData.image, caption: bodyData.name });
    if (wiki?.images) for (const img of wiki.images) if (!images.some((i) => i.url === img.url)) images.push(img);

    const gallery =
      images.length > 0
        ? `<div class="image-gallery">${images
            .map(
              (img) =>
                `<img class="gallery-img" src="${escapeHtml(img.url)}" alt="" loading="lazy" onerror="this.style.display='none'" />`
            )
            .join("")}</div>`
        : "";

    const wikiBlock = wiki?.extract
      ? `<div class="wiki-block">
          <h4>📖 ${escapeHtml(wiki.title || bodyData.name)}</h4>
          ${wiki.description ? `<p class="muted">${escapeHtml(wiki.description)}</p>` : ""}
          <div class="wiki-text">${escapeHtml(truncate(wiki.extract, 5000))}</div>
          ${wiki.wikiUrl ? `<span class="wiki-link" data-url="${escapeHtml(wiki.wikiUrl)}">Full Wikipedia article →</span>` : ""}
        </div>`
      : `<p class="muted">Wikipedia article loading failed: facts below are from the catalog.</p>`;

    body.innerHTML = `
      <div class="detail-hero">
        ${
          bodyData.image
            ? `<img class="hero-img" src="${escapeHtml(bodyData.image)}" alt="" onerror="this.style.display='none'" />`
            : `<span class="hero-placeholder" style="background:${escapeHtml(bodyData.color)}22;border-color:${escapeHtml(bodyData.color)}">✦</span>`
        }
        <h3>${escapeHtml(bodyData.name)}</h3>
        <p class="detail-official">${escapeHtml(categoryLabel(bodyData.category))}</p>
        ${bodyData.description ? `<p class="detail-desc">${escapeHtml(bodyData.description)}</p>` : ""}
      </div>
      ${gallery}
      <div class="detail-tabs">
        <button type="button" class="tab-btn active" data-tab="overview">Overview</button>
        <button type="button" class="tab-btn" data-tab="article">Article</button>
      </div>
      <div class="tab-pane active" data-pane="overview">
        <div class="info-grid">
          ${infoItem("Distance from Sun", formatDistAU(bodyData.distAU))}
          ${infoItem("Radius", bodyData.radiusKm ? `${bodyData.radiusKm.toLocaleString()} km` : "")}
          ${infoItem("Mass", bodyData.mass)}
          ${infoItem("Gravity", bodyData.gravity)}
          ${infoItem("Day length", bodyData.dayLength)}
          ${infoItem("Year length", bodyData.yearLength)}
          ${infoItem("Temperature", bodyData.temperature)}
          ${infoItem("Moons", bodyData.moonsCount != null ? bodyData.moonsCount : "")}
          ${infoItem("Composition", bodyData.composition)}
          ${infoItem("Discovered", bodyData.discovered)}
          ${infoItem("Named after", bodyData.namedAfter)}
        </div>
        ${factList(bodyData.facts)}
        ${moonList(children)}
        ${
          bodyData.nasaUrl
            ? `<p><span class="wiki-link" data-url="${escapeHtml(bodyData.nasaUrl)}">NASA mission page →</span></p>`
            : ""
        }
      </div>
      <div class="tab-pane" data-pane="article">${wikiBlock}</div>
    `;

    body.querySelectorAll("[data-open]").forEach((btn) => {
      btn.addEventListener("click", () => open(btn.dataset.open));
    });

    wireDetailInteractions(bodyData);
  }

  async function loadWikiIntoArticle(title) {
    const pane = body.querySelector('[data-pane="article"]');
    if (!pane || !title) return;
    pane.innerHTML = `<p class="muted">Loading Wikipedia…</p>`;
    try {
      const res = await invoke("wiki.get", { title });
      const wiki = res.wiki;
      pane.innerHTML = wiki?.extract
        ? `<div class="wiki-block">
            <h4>📖 ${escapeHtml(wiki.title || title)}</h4>
            ${wiki.description ? `<p class="muted">${escapeHtml(wiki.description)}</p>` : ""}
            <div class="wiki-text">${escapeHtml(truncate(wiki.extract, 5000))}</div>
            ${wiki.wikiUrl ? `<span class="wiki-link" data-url="${escapeHtml(wiki.wikiUrl)}">Full Wikipedia article →</span>` : ""}
          </div>`
        : `<p class="muted">Wikipedia article not available.</p>`;
      pane.querySelectorAll("[data-url]").forEach((el) => {
        el.addEventListener("click", () => invoke("link.open", { url: el.dataset.url }));
      });
    } catch (err) {
      pane.innerHTML = `<p class="muted">${escapeHtml(err.message)}</p>`;
    }
  }

  function renderCreature(bodyData, wiki) {
    const { RARITY_LABELS } = window.Space;
    const wikiBlock = wiki?.extract
      ? `<div class="wiki-block">
          <h4>📖 ${escapeHtml(wiki.title || bodyData.name)}</h4>
          ${wiki.description ? `<p class="muted">${escapeHtml(wiki.description)}</p>` : ""}
          <div class="wiki-text">${escapeHtml(truncate(wiki.extract, 5000))}</div>
          ${wiki.wikiUrl ? `<span class="wiki-link" data-url="${escapeHtml(wiki.wikiUrl)}">Full Wikipedia article →</span>` : ""}
        </div>`
      : `<p class="muted">Loading species article…</p>`;

    const rarityClass = `rarity-${bodyData.rarity || "common"}`;
    body.innerHTML = `
      <div class="detail-hero">
        <span class="hero-placeholder creature-hero ${rarityClass}" style="background:${escapeHtml(bodyData.color)}33;border-color:${escapeHtml(bodyData.color)}">${escapeHtml(bodyData.emoji || "🐟")}</span>
        <h3>${escapeHtml(bodyData.name)}</h3>
        <p class="detail-official">${escapeHtml(RARITY_LABELS[bodyData.rarity] || bodyData.rarity)} · ${escapeHtml(bodyData.zoneLabel || bodyData.zone)}</p>
        ${bodyData.description ? `<p class="detail-desc">${escapeHtml(bodyData.description)}</p>` : ""}
      </div>
      <div class="detail-tabs">
        <button type="button" class="tab-btn active" data-tab="overview">Overview</button>
        <button type="button" class="tab-btn" data-tab="article">Species article</button>
      </div>
      <div class="tab-pane active" data-pane="overview">
        <div class="info-grid">
          ${infoItem("Depth", bodyData.depthM != null ? `${bodyData.depthM} m` : "")}
          ${infoItem("Rarity", RARITY_LABELS[bodyData.rarity] || bodyData.rarity)}
          ${infoItem("Zone", bodyData.zoneLabel)}
          ${infoItem("Species ID", bodyData.speciesId)}
        </div>
        ${factList(bodyData.facts)}
      </div>
      <div class="tab-pane" data-pane="article">${wikiBlock}</div>
    `;
    wireDetailInteractions(bodyData);
  }

  function openStarBody(bodyData) {
    selectedId = bodyData.id;
    shell.classList.add("detail-open");
    panel.classList.remove("hidden");
    titleEl.textContent = bodyData.name;
    renderStar(bodyData, null);
    if (bodyData.wikiTitle) loadWikiIntoArticle(bodyData.wikiTitle);
  }

  function openCreatureBody(bodyData) {
    selectedId = bodyData.id;
    shell.classList.add("detail-open");
    panel.classList.remove("hidden");
    titleEl.textContent = bodyData.name;
    renderCreature(bodyData, null);
    if (bodyData.wikiTitle) loadWikiIntoArticle(bodyData.wikiTitle);
  }

  function renderEarthEntity(bodyData, wiki) {
    const img = bodyData.image || bodyData.flag;
    const hero = img
      ? `<img class="hero-img" src="${escapeHtml(img)}" alt="" onerror="this.style.display='none'" />`
      : `<span class="hero-placeholder" style="background:#0ea5e933;border-color:#0ea5e9">🌍</span>`;
    const wikiBlock = wiki?.extract
      ? `<div class="wiki-block">
          <h4>📖 ${escapeHtml(wiki.title || bodyData.name)}</h4>
          ${wiki.description ? `<p class="muted">${escapeHtml(wiki.description)}</p>` : ""}
          <div class="wiki-text">${escapeHtml(truncate(wiki.extract, 5000))}</div>
          ${wiki.wikiUrl ? `<span class="wiki-link" data-url="${escapeHtml(wiki.wikiUrl)}">Full Wikipedia article →</span>` : ""}
        </div>`
      : `<p class="muted">Loading article…</p>`;

    body.innerHTML = `
      <div class="detail-hero">
        ${hero}
        <h3>${escapeHtml(bodyData.name)}</h3>
        <p class="detail-official">${escapeHtml(categoryLabel(bodyData.category))}${bodyData.countryName ? ` · ${escapeHtml(bodyData.countryName)}` : ""}</p>
        ${bodyData.description ? `<p class="detail-desc">${escapeHtml(bodyData.description)}</p>` : ""}
      </div>
      <div class="detail-tabs">
        <button type="button" class="tab-btn active" data-tab="overview">Overview</button>
        <button type="button" class="tab-btn" data-tab="article">Article</button>
      </div>
      <div class="tab-pane active" data-pane="overview">
        <div class="info-grid">
          ${infoItem("Population", bodyData.population ? bodyData.population.toLocaleString() : "")}
          ${infoItem("Area", bodyData.area ? `${bodyData.area.toLocaleString()} km²` : "")}
          ${infoItem("Capital", bodyData.capital)}
          ${infoItem("Region", bodyData.region)}
          ${infoItem("Coordinates", bodyData.lat != null ? `${bodyData.lat}°, ${bodyData.lon}°` : "")}
          ${infoItem("Type", bodyData.placeType)}
        </div>
        ${factList(bodyData.facts)}
      </div>
      <div class="tab-pane" data-pane="article">${wikiBlock}</div>
    `;
    wireDetailInteractions(bodyData);
  }

  async function openEarth(hit) {
    if (!hit?.id && !hit?.code) return;
    selectedId = hit.id;
    shell.classList.add("detail-open");
    panel.classList.remove("hidden");
    titleEl.textContent = "Loading…";
    body.innerHTML = `<p class="muted">Loading…</p>`;
    try {
      const res = await invoke("earth.get", {
        id: hit.id,
        code: hit.code,
        kind: hit.type,
      });
      titleEl.textContent = res.body.name;
      renderEarthEntity(res.body, res.wiki);
      if (!res.wiki && res.body.wikiTitle) loadWikiIntoArticle(res.body.wikiTitle);
    } catch (err) {
      body.innerHTML = `<p class="db-err">${escapeHtml(err.message)}</p>`;
    }
  }

  async function openCreature(id, localCreature = null) {
    if (localCreature) {
      openCreatureBody(window.Space.creatureToBody(localCreature));
      return;
    }
    selectedId = id;
    shell.classList.add("detail-open");
    panel.classList.remove("hidden");
    titleEl.textContent = "Loading…";
    body.innerHTML = `<p class="muted">Loading species…</p>`;
    try {
      const res = await invoke("ocean.get", { id });
      titleEl.textContent = res.body.name;
      renderCreature(res.body, res.wiki);
      if (!res.wiki && res.body.wikiTitle) loadWikiIntoArticle(res.body.wikiTitle);
    } catch (err) {
      body.innerHTML = `<p class="db-err">${escapeHtml(err.message)}</p>`;
    }
  }

  async function open(id, localStar = null) {
    const r = window.SpacePages?.navigate?.getRealm?.();
    if (r === "ocean") return;

    if (localStar) {
      openStarBody(window.Space.starToBody(localStar));
      return;
    }

    if (String(id).startsWith("creature_")) return;

    if (String(id).startsWith("star_")) {
      const cached = window.SpacePages?.navigate?.getStarById?.(id);
      if (cached) {
        openStarBody(window.Space.starToBody(cached));
        return;
      }
    }

    selectedId = id;
    shell.classList.add("detail-open");
    panel.classList.remove("hidden");
    titleEl.textContent = "Loading…";
    body.innerHTML = `<p class="muted">Loading…</p>`;

    try {
      const res = await invoke("catalog.get", { id, skipWiki: true });
      titleEl.textContent = res.body.name;
      if (res.body.category === "star" || id.startsWith("star_")) {
        renderStar(res.body, null);
      } else {
        render(res.body, res.children || [], null);
      }
      if (res.body.wikiTitle) loadWikiIntoArticle(res.body.wikiTitle);
    } catch (err) {
      body.innerHTML = `<p class="db-err">${escapeHtml(err.message)}</p>`;
    }
  }

  function renderMission(mission, linkedReport) {
    const phys = mission.physics || {};
    const physRows = Object.entries(phys)
      .map(([k, v]) => infoItem(k.replace(/([A-Z])/g, " $1"), v))
      .join("");
    const links = mission.links || {};
    body.innerHTML = `
      <div class="detail-hero">
        ${
          mission.image
            ? `<img class="hero-img" src="${escapeHtml(mission.image)}" alt="" onerror="this.style.display='none'" />`
            : `<span class="hero-placeholder" style="background:${escapeHtml(mission.color || "#7eb8ff")}22;border-color:${escapeHtml(mission.color || "#7eb8ff")}">🚀</span>`
        }
        <h3>${escapeHtml(mission.name)}</h3>
        <p class="detail-official">${escapeHtml(mission.agency)} · ${escapeHtml(mission.era)} · ${escapeHtml(mission.status)}</p>
        <p class="detail-desc">${escapeHtml(mission.summary)}</p>
      </div>
      <div class="info-grid">
        ${infoItem("Target", mission.target)}
        ${infoItem("Type", mission.type)}
        ${infoItem("Duration", mission.duration || "")}
      </div>
      ${physRows ? `<h4 class="section-label">Mission numbers</h4><div class="info-grid">${physRows}</div>` : ""}
      ${factList(mission.highlights)}
      ${mission.instruments?.length ? `<h4 class="section-label">Instruments</h4><p class="muted">${mission.instruments.map((i) => escapeHtml(i)).join(" · ")}</p>` : ""}
      ${
        linkedReport
          ? `<p><button type="button" class="btn btn-primary btn-sm" data-report="${escapeHtml(linkedReport.id)}">📄 ${escapeHtml(linkedReport.title)}</button></p>`
          : ""
      }
      <p class="link-row">
        ${links.nasa ? `<span class="wiki-link" data-url="${escapeHtml(links.nasa)}">NASA mission page →</span>` : ""}
        ${mission.catalogId ? `<button type="button" class="btn btn-ghost btn-sm" data-catalog="${escapeHtml(mission.catalogId)}">Open in catalog</button>` : ""}
      </p>
    `;
    body.querySelector("[data-report]")?.addEventListener("click", () => openReport(linkedReport.id));
    body.querySelector("[data-catalog]")?.addEventListener("click", () => open(body.querySelector("[data-catalog]").dataset.catalog));
    body.querySelectorAll("[data-url]").forEach((el) => {
      el.addEventListener("click", () => invoke("link.open", { url: el.dataset.url }));
    });
    if (links.wikiTitle || mission.name) loadWikiIntoArticle(links.wikiTitle || mission.name);
  }

  function renderReport(report, linkedMission) {
    body.innerHTML = `
      <div class="detail-hero">
        <h3>${escapeHtml(report.title)}</h3>
        <p class="detail-official">${escapeHtml(report.agency)} · ${report.year || ""} · ${escapeHtml(report.category)}</p>
        <p class="detail-desc">${escapeHtml(report.summary)}</p>
      </div>
      ${factList(report.highlights)}
      <div class="tag-row">${(report.tags || []).map((t) => `<span class="tag-chip">${escapeHtml(t)}</span>`).join("")}</div>
      ${
        linkedMission
          ? `<p><button type="button" class="btn btn-primary btn-sm" data-mission="${escapeHtml(linkedMission.id)}">🚀 ${escapeHtml(linkedMission.name)}</button></p>`
          : ""
      }
      <p class="link-row">
        ${report.links?.ntrs ? `<span class="wiki-link" data-url="${escapeHtml(report.links.ntrs)}">NASA NTRS →</span>` : ""}
        ${report.links?.pdf ? `<span class="wiki-link" data-url="${escapeHtml(report.links.pdf)}">PDF →</span>` : ""}
        ${report.links?.nasa ? `<span class="wiki-link" data-url="${escapeHtml(report.links.nasa)}">NASA page →</span>` : ""}
      </p>
    `;
    body.querySelector("[data-mission]")?.addEventListener("click", () => openMission(body.querySelector("[data-mission]").dataset.mission));
    body.querySelectorAll("[data-url]").forEach((el) => {
      el.addEventListener("click", () => invoke("link.open", { url: el.dataset.url }));
    });
  }

  async function openMission(id) {
    selectedId = `mission:${id}`;
    shell.classList.add("detail-open");
    panel.classList.remove("hidden");
    titleEl.textContent = "Loading…";
    body.innerHTML = `<p class="muted">Loading mission…</p>`;
    try {
      const res = await invoke("nasa.missions.get", { id });
      titleEl.textContent = res.mission.name;
      renderMission(res.mission, res.linkedReport);
    } catch (err) {
      body.innerHTML = `<p class="db-err">${escapeHtml(err.message)}</p>`;
    }
  }

  async function openReport(id) {
    selectedId = `report:${id}`;
    shell.classList.add("detail-open");
    panel.classList.remove("hidden");
    titleEl.textContent = "Loading…";
    body.innerHTML = `<p class="muted">Loading report…</p>`;
    try {
      const res = await invoke("nasa.reports.get", { id });
      titleEl.textContent = res.report.title;
      renderReport(res.report, res.linkedMission);
    } catch (err) {
      body.innerHTML = `<p class="db-err">${escapeHtml(err.message)}</p>`;
    }
  }

  function close() {
    selectedId = null;
    shell.classList.remove("detail-open");
    panel.classList.add("hidden");
  }

  function getSelectedId() {
    return selectedId;
  }

  return { open, openCreature, openEarth, openMission, openReport, close, getSelectedId };
})();
