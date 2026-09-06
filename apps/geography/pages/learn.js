window.GeoPages = window.GeoPages || {};

window.GeoPages.learn = (function () {
  const { escapeHtml, invoke, formatNumber, formatArea, showFlags, richProfiles } = window.Geo;

  const page = document.getElementById("page-learn");
  const picker = document.getElementById("learn-picker");
  const content = document.getElementById("learn-content");
  const searchInput = document.getElementById("learn-country-search");
  const statusEl = document.getElementById("learn-status");
  let countries = [];
  let selectedCode = null;
  let profileCache = new Map();

  function countryOption(c) {
    const flagHtml =
      showFlags() && c.flag
        ? `<img class="learn-flag" src="${escapeHtml(c.flag)}" alt="" loading="lazy" onerror="this.style.display='none'" />`
        : "";
    return `<button type="button" class="learn-country-btn ${selectedCode === c.code ? "active" : ""}" data-code="${escapeHtml(c.code)}">
      ${flagHtml}
      <span>${escapeHtml(c.name)}</span>
    </button>`;
  }

  function renderPicker() {
    const q = (searchInput?.value || "").trim().toLowerCase();
    let list = countries;
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          (c.capital || "").toLowerCase().includes(q)
      );
    }
    picker.innerHTML =
      list.slice(0, 120).map(countryOption).join("") ||
      `<p class="muted">No countries match.</p>`;
    picker.querySelectorAll("[data-code]").forEach((btn) => {
      btn.addEventListener("click", () => loadCountry(btn.dataset.code));
    });
  }

  function renderSection(sec) {
    const facts =
      sec.facts?.length > 0
        ? `<ul class="learn-facts">${sec.facts.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>`
        : "";
    const paras =
      sec.paragraphs?.length > 0
        ? sec.paragraphs.map((p) => `<p class="learn-p">${escapeHtml(p)}</p>`).join("")
        : "";
    const places =
      sec.places?.length > 0
        ? `<div class="learn-places">${sec.places
            .map(
              (pl) =>
                `<div class="learn-place"><strong>${escapeHtml(pl.name)}</strong>${pl.description ? `<span>${escapeHtml(pl.description)}</span>` : ""}</div>`
            )
            .join("")}</div>`
        : "";
    return `<section class="learn-section" id="learn-sec-${escapeHtml(sec.id)}">
      <h3 class="learn-section-title">${escapeHtml(sec.title)}</h3>
      ${facts}${paras}${places}
    </section>`;
  }

  function renderProfile(profile) {
    const stats = profile.stats || {};
    const currs = (stats.currencies || [])
      .map((x) => `${x.name} (${x.symbol || x.code})`)
      .join(", ");
    const langs = (stats.languages || []).map((x) => x.name).join(", ");

    content.innerHTML = `
      <article class="learn-article">
        <header class="learn-hero">
          ${showFlags() && profile.flag ? `<img class="learn-hero-flag" src="${escapeHtml(profile.flag)}" alt="" />` : ""}
          <div>
            <h2>${escapeHtml(profile.name)}</h2>
            <p class="learn-summary">${escapeHtml(profile.summary || "")}</p>
            <div class="learn-hero-meta">
              ${profile.capital ? `<span class="meta-pill">🏛 ${escapeHtml(profile.capital)}</span>` : ""}
              ${profile.region ? `<span class="meta-pill">🌍 ${escapeHtml(profile.region)}</span>` : ""}
              ${stats.population ? `<span class="meta-pill">👥 ${formatNumber(stats.population)}</span>` : ""}
              ${stats.area ? `<span class="meta-pill">📐 ${formatArea(stats.area)}</span>` : ""}
              ${currs ? `<span class="meta-pill">💰 ${escapeHtml(currs)}</span>` : ""}
              ${langs ? `<span class="meta-pill">🗣 ${escapeHtml(langs)}</span>` : ""}
            </div>
          </div>
        </header>
        <nav class="learn-toc" id="learn-toc"></nav>
        <div class="learn-sections">
          ${richProfiles() ? (profile.sections || []).map(renderSection).join("") : `<p class="learn-lite-note muted">Rich profiles are off — enable <strong>Rich country profiles</strong> in Settings to load full history, culture & places.</p>`}
        </div>
        <p class="learn-foot muted">In-app country profile · sourced from structured reference data</p>
      </article>`;

    const toc = content.querySelector("#learn-toc");
    if (toc && richProfiles() && profile.sections?.length) {
      toc.innerHTML = profile.sections
        .map(
          (s) =>
            `<a href="#learn-sec-${escapeHtml(s.id)}" class="learn-toc-link">${escapeHtml(s.title)}</a>`
        )
        .join("");
      toc.querySelectorAll(".learn-toc-link").forEach((a) => {
        a.addEventListener("click", (e) => {
          e.preventDefault();
          content.querySelector(a.getAttribute("href"))?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
    }
  }

  async function loadCountry(code) {
    selectedCode = code;
    renderPicker();
    content.innerHTML = `<p class="loading-msg">Loading in-depth profile…</p>`;

    try {
      if (!richProfiles()) {
        const res = await invoke("countries.get", { code, skipWiki: true });
        const c = res.country;
        renderProfile({
          name: c.name,
          summary: `${c.officialName || c.name} — ${c.capital || "—"}, ${c.region || ""}`,
          capital: c.capital,
          region: c.region,
          flag: c.flag,
          stats: {
            population: c.population,
            area: c.area,
            currencies: c.currencies,
            languages: c.languages,
          },
          sections: [],
        });
        return;
      }

      let profile = profileCache.get(code);
      if (!profile) {
        const res = await invoke("learn.get", { code });
        profile = res.profile;
        profileCache.set(code, profile);
        if (statusEl && res.fromCache === "built") {
          statusEl.textContent = "Profile generated and saved locally for offline use.";
        }
      }
      renderProfile(profile);
    } catch (err) {
      content.innerHTML = `<p class="db-err">${escapeHtml(err.message)}</p>`;
    }
  }

  async function scan() {
    try {
      const status = await invoke("learn.status");
      if (statusEl) {
        statusEl.textContent =
          status.bundledCount > 0
            ? `${status.bundledCount} countries with bundled deep profiles · others load on first visit`
            : "Select a country — profiles load into the app (run npm run geography:build for full offline library)";
      }
      if (!countries.length) {
        const res = await invoke("countries.list", {});
        countries = res.countries || [];
      }
      renderPicker();
      if (selectedCode) await loadCountry(selectedCode);
    } catch (err) {
      if (statusEl) statusEl.textContent = err.message;
    }
  }

  function bind() {
    searchInput?.addEventListener("input", renderPicker);
  }

  return {
    id: "learn",
    page,
    scan,
    bind,
    openCountry(code) {
      selectedCode = code;
      if (!page.hidden) loadCountry(code);
    },
    getSelectedCode: () => selectedCode,
  };
})();
