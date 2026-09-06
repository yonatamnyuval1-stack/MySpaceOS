window.BuildsPages = window.BuildsPages || {};

window.BuildsPages.timeline = (function () {
  const { escapeHtml, formatDate, formatCount, projectIconHtml, hydrateProjectIcons, applyCachedIconsInDom } = window.Builds;
  const page = document.getElementById("page-timeline");

  let data = null;

  function sortProjects() {
    return [...(data?.projects || [])].sort((a, b) => {
      const da = a.builtAt || a.createdAt || "";
      const db = b.builtAt || b.createdAt || "";
      return db.localeCompare(da);
    });
  }

  function render() {
    if (!data) return;
    const list = sortProjects();

    if (!list.length) {
      page.innerHTML = `<div class="empty-state"><p>No projects yet. Add your first build from the Projects page.</p></div>`;
      return;
    }

    const byYear = new Map();
    for (const p of list) {
      const year = (p.builtAt || p.createdAt || "").slice(0, 4) || "Unknown";
      if (!byYear.has(year)) byYear.set(year, []);
      byYear.get(year).push(p);
    }

    page.innerHTML = [...byYear.entries()]
      .map(([year, projects]) => {
        const items = projects
          .map((p) => {
            return `<article class="timeline-item" data-id="${escapeHtml(p.id)}">
              <div class="timeline-dot" style="background:${escapeHtml(p.color || "#5b9cff")}"></div>
              <div class="timeline-card">
                <div class="timeline-head">
                  <span class="timeline-icon">${projectIconHtml(p)}</span>
                  <div>
                    <h3>${escapeHtml(p.name)}</h3>
                    <span class="timeline-date">${escapeHtml(formatDate(p.builtAt || p.createdAt))}</span>
                  </div>
                </div>
                ${p.description ? `<p class="timeline-desc">${escapeHtml(p.description)}</p>` : ""}
                <div class="timeline-meta">
                  ${p.stack?.length ? `<span>${p.stack.slice(0, 4).map((s) => escapeHtml(s)).join(" · ")}</span>` : ""}
                  ${p.fileTree?.fileCount ? `<span>🌲 ${formatCount(p.fileTree.fileCount)} files · ${formatCount(p.fileTree.characterCount || 0)} chars</span>` : ""}
                </div>
              </div>
            </article>`;
          })
          .join("");

        return `<section class="timeline-year">
          <h2 class="timeline-year-label">${escapeHtml(year)}</h2>
          <div class="timeline-list">${items}</div>
        </section>`;
      })
      .join("");

    page.querySelectorAll(".timeline-item").forEach((el) => {
      el.addEventListener("click", () => {
        window.BuildsPages.browse?.openProject?.(el.dataset.id);
      });
    });

    hydrateProjectIcons(list).then(() => applyCachedIconsInDom(page));
  }

  async function scan() {
    data = await window.BuildsStorage.load();
    render();
  }

  function bind() {}

  return { id: "timeline", page, scan, bind };
})();

