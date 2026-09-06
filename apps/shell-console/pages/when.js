window.ConsolePages.when = (function () {
  const { escapeHtml, invoke, filterItems } = window.Console;
  const page = document.getElementById("page-when");
  let items = [];
  let query = "";

  function filtered() {
    return filterItems(items, query, ["id", "trigger", "action"]);
  }

  function render() {
    const shown = filtered();
    page.innerHTML = `
      <div class="page-head">
        <p class="muted">${items.length} rule(s) auto-run when an event fires.</p>
        <button type="button" class="btn btn-primary btn-sm" id="when-add">+ Add rule</button>
      </div>
      <div class="toolbar">
        <input type="search" class="search" id="when-search" placeholder="Search rules…" value="${escapeHtml(query)}" />
      </div>
      <div class="item-list">${
        shown.length
          ? shown.map((r) => rowHtml(r, items.indexOf(r))).join("")
          : `<p class="empty">${items.length ? "No matches." : "No when rules yet."}</p>`
      }</div>`;

    page.querySelector("#when-add")?.addEventListener("click", () => openEditor());
    page.querySelector("#when-search")?.addEventListener("input", (e) => {
      query = e.target.value;
      render();
    });
    page.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => openEditor(items[parseInt(btn.dataset.edit, 10)]));
    });
    page.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const item = items[parseInt(btn.dataset.del, 10)];
        if (!item || !confirm(`Delete rule ${item.id}?`)) return;
        await invoke("when.remove", { id: item.id });
        await scan();
        window.ConsoleApp?.refreshStats?.();
        window.Console.showToast("Rule deleted");
      });
    });
  }

  function rowHtml(r, i) {
    if (i < 0) return "";
    return `<article class="item-row">
      <div class="item-main">
        <strong class="item-name">${escapeHtml(r.id)}</strong>
        <span class="item-meta">when <code>${escapeHtml(r.trigger)}</code> → <code>${escapeHtml(r.action)}</code></span>
      </div>
      <div class="item-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-edit="${i}">Edit</button>
        <button type="button" class="btn btn-ghost btn-sm" data-del="${i}">Delete</button>
      </div>
    </article>`;
  }

  function openEditor(existing) {
    window.ConsoleApp?.openModal?.(
      existing ? "Edit when rule" : "New when rule",
      `
      <form class="edit-form" id="when-form">
        <label><span>Trigger</span><input type="text" id="f-trigger" value="${escapeHtml(existing?.trigger || "")}" placeholder="drift(new)" required autofocus /></label>
        <label><span>Action command</span><input type="text" id="f-action" value="${escapeHtml(existing?.action || "")}" placeholder="notify" required /></label>
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" id="when-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>`
    );
    document.getElementById("when-cancel")?.addEventListener("click", () => window.ConsoleApp?.closeModal?.());
    document.getElementById("when-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const trigger = document.getElementById("f-trigger")?.value.trim();
      const action = document.getElementById("f-action")?.value.trim();
      if (existing) {
        await invoke("when.update", { id: existing.id, trigger, action });
      } else {
        await invoke("when.add", { trigger, action });
      }
      window.ConsoleApp?.closeModal?.();
      await scan();
      window.ConsoleApp?.refreshStats?.();
      window.Console.showToast("Rule saved");
    });
  }

  async function scan() {
    const res = await invoke("when.list");
    items = res.items || [];
    render();
  }

  return { id: "when", page, scan };
})();