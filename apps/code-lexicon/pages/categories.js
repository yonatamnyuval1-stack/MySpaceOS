window.LexiconPages = window.LexiconPages || {};

window.LexiconPages.categories = (function () {
  const { escapeHtml, invoke, categoryMeta } = window.Lexicon;
  const page = document.getElementById("page-categories");

  let categories = [];

  function render() {
    if (!categories.length) {
      page.innerHTML = `<p class="loading-msg">Loading categories…</p>`;
      return;
    }

    page.innerHTML = `
      <p class="page-hint">Pick a topic to browse all terms in that category.</p>
      <div class="cat-grid">${categories
        .filter((c) => c.count > 0)
        .map((c) => {
          const meta = categoryMeta(c.id);
          return `<button type="button" class="cat-card" data-cat="${escapeHtml(c.id)}">
            <span class="cat-icon">${meta.icon}</span>
            <strong>${escapeHtml(meta.label)}</strong>
            <span class="cat-count">${c.count.toLocaleString()} terms</span>
          </button>`;
        })
        .join("")}</div>`;

    page.querySelectorAll(".cat-card").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.LexiconPages.browse?.setCategory?.(btn.dataset.cat);
        document.querySelector('.nav-item[data-page="browse"]')?.click();
      });
    });
  }

  async function scan() {
    try {
      const res = await invoke("stats.get");
      categories = res.categories || [];
      render();
    } catch (err) {
      page.innerHTML = `<div class="empty-state error"><p>${escapeHtml(err.message)}</p></div>`;
    }
  }

  function bind() {}

  return { id: "categories", page, scan, bind };
})();
