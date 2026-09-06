window.TranslatePages = window.TranslatePages || {};

window.TranslatePages.history = (function () {
  const { escapeHtml, invoke, langLabel, formatDate } = window.Translate;
  const page = document.getElementById("page-history");
  let filter = "all";

  async function scan() {
    page.classList.add("loading");
    try {
      const loaded = await invoke("storage.load");
      render(loaded.data?.history || []);
    } finally {
      page.classList.remove("loading");
    }
  }

  function render(items) {
    const list = page.querySelector("#history-list");
    const filtered =
      filter === "favorites" ? items.filter((h) => h.favorite) : filter === "recent" ? items.slice(0, 30) : items;

    if (!filtered.length) {
      list.innerHTML = `<p class="muted empty-msg">No translations yet. Use the Translate tab.</p>`;
      return;
    }

    list.innerHTML = filtered
      .map(
        (h) => `<article class="history-card ${h.favorite ? "fav" : ""}" data-id="${escapeHtml(h.id)}">
        <div class="history-head">
          <span class="history-langs">${escapeHtml(langLabel(h.from))} → ${escapeHtml(langLabel(h.to))}</span>
          <span class="history-date muted">${escapeHtml(formatDate(h.createdAt))}</span>
        </div>
        <p class="history-src">${escapeHtml(h.source)}</p>
        <p class="history-tr">${escapeHtml(h.translation)}</p>
        <div class="history-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-use="${escapeHtml(h.id)}">Use</button>
          <button type="button" class="btn btn-ghost btn-sm" data-copy="${escapeHtml(h.id)}">Copy</button>
          <button type="button" class="btn btn-ghost btn-sm fav-btn" data-fav="${escapeHtml(h.id)}">${h.favorite ? "★" : "☆"}</button>
          <button type="button" class="btn btn-ghost btn-sm" data-del="${escapeHtml(h.id)}">✕</button>
        </div>
      </article>`
      )
      .join("");

    const byId = Object.fromEntries(items.map((h) => [h.id, h]));

    list.querySelectorAll("[data-use]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const h = byId[btn.dataset.use];
        if (h) window.TranslateApp.openTranslate({ source: h.source, from: h.from, to: h.to });
      });
    });
    list.querySelectorAll("[data-copy]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const h = byId[btn.dataset.copy];
        if (h) await invoke("clipboard.write", { text: h.translation });
      });
    });
    list.querySelectorAll("[data-fav]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await invoke("history.toggleFavorite", { id: btn.dataset.fav });
        scan();
      });
    });
    list.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await invoke("history.delete", { id: btn.dataset.del });
        scan();
      });
    });
  }

  function bind() {
    page.querySelectorAll("[data-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        filter = btn.dataset.filter;
        page.querySelectorAll("[data-filter]").forEach((b) => b.classList.toggle("active", b === btn));
        scan();
      });
    });
    page.querySelector("#btn-clear-history")?.addEventListener("click", async () => {
      if (!confirm("Clear all history except favorites?")) return;
      await invoke("history.clear", { keepFavorites: true });
      scan();
    });
    page.querySelector("#btn-clear-all")?.addEventListener("click", async () => {
      if (!confirm("Clear entire history including favorites?")) return;
      await invoke("history.clear", {});
      scan();
    });
  }

  return { id: "history", page, bind, scan };
})();
