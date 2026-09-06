window.HistoryDetail = (function () {
  const { escapeHtml, invoke, lifeSpan, eraLabel, truncate } = window.History;

  const panel = document.getElementById("detail-panel");
  const body = document.getElementById("detail-body");
  const titleEl = document.getElementById("detail-title");
  const shell = document.getElementById("app-shell");
  const closeBtn = document.getElementById("detail-close");

  let selectedId = null;
  let onClose = null;

  closeBtn?.addEventListener("click", close);

  function infoItem(label, val) {
    if (val == null || val === "") return "";
    return `<div class="info-item"><span class="info-label">${escapeHtml(label)}</span><span class="info-val">${escapeHtml(String(val))}</span></div>`;
  }

  function render(entity, wiki) {
    const isEvent = entity.type === "event";
    const images = [];
    if (entity.image) images.push({ url: entity.image, caption: entity.name });
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
          <h4>📖 ${escapeHtml(wiki.title || entity.name)}</h4>
          ${wiki.description ? `<p class="muted">${escapeHtml(wiki.description)}</p>` : ""}
          <div class="wiki-text">${escapeHtml(truncate(wiki.extract, 5000))}</div>
          ${wiki.wikiUrl ? `<span class="wiki-link" data-url="${escapeHtml(wiki.wikiUrl)}">Full Wikipedia article →</span>` : ""}
        </div>`
      : `<p class="muted">Wikipedia article not loaded.</p>`;

    body.innerHTML = `
      <div class="detail-hero">
        ${entity.image ? `<img class="hero-img" src="${escapeHtml(entity.image)}" alt="" onerror="this.style.display='none'" />` : `<span class="hero-placeholder">${isEvent ? "⚔" : "👤"}</span>`}
        <h3>${escapeHtml(entity.name)}</h3>
        <p class="detail-official">${escapeHtml(lifeSpan(entity))} · ${escapeHtml(eraLabel(entity.era))}</p>
        ${entity.description ? `<p class="detail-desc">${escapeHtml(entity.description)}</p>` : ""}
      </div>
      ${gallery}
      <div class="detail-tabs">
        <button type="button" class="tab-btn active" data-tab="overview">Overview</button>
        <button type="button" class="tab-btn" data-tab="article">Article</button>
      </div>
      <div class="tab-pane active" data-pane="overview">
        <div class="info-grid">
          ${isEvent ? infoItem("Year", entity.year) : infoItem("Born", entity.birthYear)}
          ${isEvent ? "" : infoItem("Died", entity.deathYear || "—")}
          ${isEvent ? infoItem("Location", entity.location) : infoItem("Occupation", entity.occupation)}
          ${isEvent ? infoItem("Type", entity.eventType) : infoItem("Country", entity.country)}
          ${infoItem("Wikidata", entity.id)}
        </div>
      </div>
      <div class="tab-pane" data-pane="article">${wikiBlock}</div>
      <div class="detail-actions">
        ${entity.wikidataUrl ? `<button type="button" class="btn btn-sm" data-url="${escapeHtml(entity.wikidataUrl)}">Wikidata</button>` : ""}
        <button type="button" class="btn btn-primary btn-sm" id="btn-save-collection">★ Save to collection</button>
      </div>`;

    body.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        body.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
        body.querySelectorAll(".tab-pane").forEach((p) => p.classList.toggle("active", p.dataset.pane === tab));
      });
    });

    body.querySelectorAll("[data-url]").forEach((el) => {
      el.addEventListener("click", () => invoke("link.open", { url: el.dataset.url }));
    });

    document.getElementById("btn-save-collection")?.addEventListener("click", () => {
      window.HistoryPages?.collection?.addBookmark(entity);
    });
  }

  async function open(id, type) {
    selectedId = id;
    panel.classList.remove("hidden");
    shell.classList.add("detail-open");
    titleEl.textContent = "Loading…";
    body.innerHTML = `<p class="loading-msg">Loading from Wikidata & Wikipedia…</p>`;

    try {
      const res = await invoke("entity.get", { id, type });
      const entity = { ...res.entity, type: res.entity?.type || type };
      titleEl.textContent = entity.name;
      render(entity, res.wiki);
      if (onClose) onClose(id);
    } catch (err) {
      body.innerHTML = `<p class="empty-msg">${escapeHtml(err.message)}</p>`;
      titleEl.textContent = "Error";
    }
  }

  function close() {
    selectedId = null;
    panel.classList.add("hidden");
    shell.classList.remove("detail-open");
    if (onClose) onClose(null);
  }

  function getSelectedId() {
    return selectedId;
  }

  function setOnClose(fn) {
    onClose = fn;
  }

  return { open, close, getSelectedId, setOnClose };
})();
