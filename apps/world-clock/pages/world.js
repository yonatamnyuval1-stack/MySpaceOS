(function (root) {
  function tt(key, fallback, vars) {
    const I = root.MySpaceI18n;
    if (!I?.t) return fallback || key;
    const v = I.t(key, vars);
    return v === key ? (fallback || key) : v;
  }

  const { uid, escapeHtml } = root.ClockUtils;
  const { search, renderSearchResults } = root.ClockSearch;
  const { analogSvg, clockAngles, formatTime24, getOffsetLabel, zoneCityName } = root.ClockTime;
  const { getFavorites, addFavorite, removeFavorite } = root.ClockStorage;

  const page = {
    id: "world",
    page: null,
    tickTimer: null,
    favorites: [],
    searchDebounce: null,

    bind() {
      this.page = document.getElementById("page-world");
      const input = this.page.querySelector("#world-search");
      const results = this.page.querySelector("#world-search-results");

      input.addEventListener("input", () => {
        clearTimeout(this.searchDebounce);
        const q = input.value.trim();
        if (q.length < 1) {
          results.innerHTML = "";
          results.classList.remove("open");
          return;
        }
        this.searchDebounce = setTimeout(() => {
          const items = search(q, 20);
          renderSearchResults(results, items, (item) => this.pickSearch(item));
          results.classList.add("open");
        }, 120);
      });

      input.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          input.value = "";
          results.innerHTML = "";
          results.classList.remove("open");
        }
      });

      document.addEventListener("click", (e) => {
        if (!this.page.contains(e.target)) {
          results.classList.remove("open");
        }
      });
    },

    async activate() {
      this.deactivate();
      this.favorites = await getFavorites();
      this.renderGrid();
      this.tickTimer = setInterval(() => this.renderGrid(), 1000);
    },

    deactivate() {
      if (this.tickTimer) clearInterval(this.tickTimer);
      this.tickTimer = null;
    },

    async pickSearch(item) {
      const entry = {
        id: uid(),
        timezone: item.timezone,
        label: item.country || item.label,
        country: item.country || item.label,
      };
      this.favorites = await addFavorite(entry);
      const input = this.page.querySelector("#world-search");
      const results = this.page.querySelector("#world-search-results");
      input.value = "";
      results.innerHTML = "";
      results.classList.remove("open");
      this.renderGrid();
    },

    async removeTz(tz) {
      this.favorites = await removeFavorite(tz);
      this.renderGrid();
    },

    renderGrid() {
      const grid = this.page.querySelector("#world-grid");
      const empty = this.page.querySelector("#world-empty");
      if (!this.favorites.length) {
        grid.innerHTML = "";
        empty.hidden = false;
        return;
      }
      empty.hidden = true;
      const now = new Date();
      const removeLabel = tt("app.worldClock.world.remove", "Remove");
      grid.innerHTML = this.favorites
        .map((f) => {
          const angles = clockAngles(now, f.timezone);
          const city = zoneCityName(f.timezone);
          return `
        <article class="world-card" data-tz="${escapeHtml(f.timezone)}">
          <button type="button" class="world-card-remove" title="${escapeHtml(removeLabel)}" data-tz="${escapeHtml(f.timezone)}">×</button>
          <div class="world-card-face">${analogSvg(angles, 100)}</div>
          <h3 class="world-card-title">${escapeHtml(f.label || f.country)}</h3>
          <p class="world-card-city">${escapeHtml(city)}</p>
          <p class="world-card-time">${escapeHtml(formatTime24(now, f.timezone))}</p>
          <p class="world-card-meta">${escapeHtml(getOffsetLabel(now, f.timezone))}</p>
        </article>`;
        })
        .join("");

      grid.querySelectorAll(".world-card-remove").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.removeTz(btn.dataset.tz);
        });
      });
    },

    repaintI18n() {
      this.renderGrid();
    },
  };

  root.ClockPages = root.ClockPages || {};
  root.ClockPages.world = page;
})(window);
