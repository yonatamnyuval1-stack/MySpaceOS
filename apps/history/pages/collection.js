window.HistoryPages = window.HistoryPages || {};

window.HistoryPages.collection = (function () {
  const { escapeHtml, uid } = window.History;

  const page = document.getElementById("page-collection");
  const grid = document.getElementById("collection-grid");
  const statsEl = document.getElementById("collection-stats");

  let userData = { bookmarks: [] };

  async function addBookmark(entity) {
    userData = await window.HistoryStorage.get();
    if (userData.bookmarks.some((b) => b.entityId === entity.id)) {
      alert("Already in your collection.");
      return;
    }
    userData.bookmarks.push({
      entityId: entity.id,
      entityType: entity.type === "event" ? "event" : "figure",
      name: entity.name,
      notes: "",
    });
    userData = await window.HistoryStorage.save(userData);
    alert(`Saved "${entity.name}" to collection.`);
    if (!page.hidden) scan();
  }

  function card(b) {
    const icon = b.entityType === "event" ? "⚔" : "👤";
    return `<article class="item-card" data-id="${escapeHtml(b.entityId)}" data-type="${escapeHtml(b.entityType)}">
      <span class="item-thumb-ph">${icon}</span>
      <div class="item-body">
        <h3>${escapeHtml(b.name)}</h3>
        <span class="item-sub">${escapeHtml(b.entityType)} · ${escapeHtml(b.entityId)}</span>
        ${b.notes ? `<p class="muted" style="margin-top:6px;font-size:0.8rem">${escapeHtml(b.notes)}</p>` : ""}
      </div>
      <button type="button" class="btn btn-ghost btn-sm" data-remove="${escapeHtml(b.id)}">Remove</button>
    </article>`;
  }

  function renderStats() {
    const figs = userData.bookmarks.filter((b) => b.entityType === "figure").length;
    const evs = userData.bookmarks.filter((b) => b.entityType === "event").length;
    statsEl.innerHTML = `
      <div class="stat-card"><span class="stat-val">${userData.bookmarks.length}</span><span class="stat-label">Saved</span></div>
      <div class="stat-card"><span class="stat-val">${figs}</span><span class="stat-label">Figures</span></div>
      <div class="stat-card"><span class="stat-val">${evs}</span><span class="stat-label">Events</span></div>`;
  }

  function renderGrid() {
    const list = userData.bookmarks || [];
    if (!list.length) {
      grid.innerHTML = `<p class="empty-msg">No saved items. Open a figure or event and click ★ Save to collection.</p>`;
      return;
    }
    grid.innerHTML = list.map(card).join("");
    grid.querySelectorAll(".item-card[data-id]").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target.closest("[data-remove]")) return;
        window.HistoryDetail.open(el.dataset.id, el.dataset.type);
      });
    });
    grid.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const removeId = String(btn.dataset.remove || "").toUpperCase();
        userData.bookmarks = userData.bookmarks.filter(
          (b) => String(b.entityId || "").toUpperCase() !== removeId
        );
        await window.HistoryStorage.save(userData);
        scan();
      });
    });
  }

  async function scan() {
    userData = await window.HistoryStorage.get();
    renderStats();
    renderGrid();
  }

  function bind() {}

  return { id: "collection", page, scan, bind, addBookmark };
})();
