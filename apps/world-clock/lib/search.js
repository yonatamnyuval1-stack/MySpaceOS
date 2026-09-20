(function (root) {
  const { normalizeQuery, escapeHtml } = root.ClockUtils;
  const { zoneCityName, getAllTimeZones } = root.ClockTime;

  let zoneIndex = null;

  function buildZoneIndex() {
    if (zoneIndex) return zoneIndex;
    const all = getAllTimeZones();
    zoneIndex = all.map((id) => ({
      timezone: id,
      city: zoneCityName(id),
      region: id.split("/")[0],
      norm: normalizeQuery(`${id} ${zoneCityName(id)} ${id.replace(/\//g, " ")}`),
    }));
    return zoneIndex;
  }

  function search(query, limit) {
    const q = normalizeQuery(query);
    if (!q || q.length < 1) return [];
    const max = limit || 24;
    const results = [];
    const seen = new Set();

    function push(item) {
      const key = item.timezone + "|" + item.label;
      if (seen.has(key)) return;
      seen.add(key);
      results.push(item);
    }

    (root.ClockCountryData?.list || []).forEach((entry) => {
      const countryNorm = normalizeQuery(entry.country);
      const aliasNorm = (entry.aliases || []).map(normalizeQuery).join(" ");
      const hay = `${countryNorm} ${aliasNorm}`;
      if (!hay.includes(q) && !countryNorm.startsWith(q)) return;

      entry.zones.forEach((tz) => {
        push({
          timezone: tz,
          label: entry.country,
          country: entry.country,
          city: zoneCityName(tz),
          kind: "country",
        });
      });
    });

    if (results.length < max) {
      buildZoneIndex().forEach((z) => {
        if (results.length >= max) return;
        if (z.norm.includes(q) || z.city.toLowerCase().startsWith(q)) {
          push({
            timezone: z.timezone,
            label: z.city,
            country: z.region,
            city: z.city,
            kind: "zone",
          });
        }
      });
    }

    return results.slice(0, max);
  }

  function renderSearchResults(container, items, onPick) {
    function tt(key, fallback, vars) {
      const I = root.MySpaceI18n;
      if (!I?.t) return fallback || key;
      const v = I.t(key, vars);
      return v === key ? (fallback || key) : v;
    }
    if (!items.length) {
      container.innerHTML = `<p class="search-empty">${tt(
        "app.worldClock.search.empty",
        "No matches. Try a country or city name."
      )}</p>`;
      return;
    }
    container.innerHTML = items
      .map(
        (item, i) => `
      <button type="button" class="search-result" data-idx="${i}">
        <span class="search-result-main">${escapeHtml(item.label)}</span>
        <span class="search-result-sub">${escapeHtml(item.city)} · ${escapeHtml(item.timezone)}</span>
      </button>`
      )
      .join("");

    container.querySelectorAll(".search-result").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx, 10);
        if (items[idx]) onPick(items[idx]);
      });
    });
  }

  root.ClockSearch = { search, renderSearchResults };
})(window);
