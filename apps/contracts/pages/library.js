window.ContractPages = window.ContractPages || {};

window.ContractPages.library = (function () {
  const { escapeHtml, invoke, statusLabel, statusClass } = window.Contracts;
  const page = document.getElementById("page-library");
  let contracts = [];
  let templates = [];

  async function scan() {
    page.classList.add("loading");
    try {
      const [listRes, tplRes, upcoming] = await Promise.all([
        invoke("contracts.list"),
        invoke("templates.list"),
        invoke("expiry.upcoming"),
      ]);
      contracts = listRes.contracts || [];
      templates = tplRes.templates || [];
      render(contracts, upcoming.upcoming || []);
      renderTemplates();
      page.querySelector("#library-error").hidden = true;
    } catch (err) {
      page.querySelector("#library-error").textContent = err.message;
      page.querySelector("#library-error").hidden = false;
    } finally {
      page.classList.remove("loading");
    }
  }

  function render(list, upcoming) {
    const banner = page.querySelector("#library-expiry-banner");
    const urgent = upcoming.filter((u) => u.daysLeft <= 7);
    if (urgent.length) {
      banner.hidden = false;
      banner.innerHTML = urgent
        .map(
          (u) =>
            `<div class="expiry-hit">${escapeHtml(u.title)} — ${u.daysLeft <= 0 ? "expires today" : `${u.daysLeft} day(s) left`} (${escapeHtml(u.expiryDate)})</div>`
        )
        .join("");
    } else {
      banner.hidden = true;
    }

    const el = page.querySelector("#contract-list");
    if (!list.length) {
      el.innerHTML = `<p class="library-empty">No contracts yet. Create one from a formal template below.</p>`;
      return;
    }

    el.innerHTML = list
      .map(
        (c) => `<article class="contract-row">
        <div class="contract-row-main">
          <h3>${escapeHtml(c.title)}</h3>
          <p class="muted">${escapeHtml(c.expiryDate ? `Expires ${c.expiryDate}` : "No expiry")}</p>
        </div>
        <span class="status-pill ${statusClass(c.status)}">${escapeHtml(statusLabel(c.status))}</span>
        <div class="contract-row-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-doc="${escapeHtml(c.id)}">View / Sign</button>
          <button type="button" class="btn btn-ghost btn-sm" data-edit="${escapeHtml(c.id)}">Edit</button>
          <button type="button" class="btn btn-ghost btn-sm" data-rm="${escapeHtml(c.id)}">Delete</button>
        </div>
      </article>`
      )
      .join("");
  }

  function renderTemplates() {
    const el = page.querySelector("#template-picker");
    const sorted = [...templates].sort((a, b) => {
      if (a.category === "Documentation" && b.category !== "Documentation") return -1;
      if (b.category === "Documentation" && a.category !== "Documentation") return 1;
      return a.title.localeCompare(b.title);
    });
    el.innerHTML = sorted
      .map(
        (t) => `<button type="button" class="template-card ${t.category === "Documentation" ? "template-card--record" : ""}" data-new="${escapeHtml(t.id)}">
        <span class="template-cat">${escapeHtml(t.category)}</span>
        <strong>${escapeHtml(t.title)}</strong>
      </button>`
      )
      .join("");
  }

  function bind() {
    page.addEventListener("click", async (e) => {
      const doc = e.target.closest("[data-doc]");
      if (doc) {
        window.ContractsApp.openDocument(doc.dataset.doc);
        return;
      }
      const edit = e.target.closest("[data-edit]");
      if (edit) {
        window.ContractsApp.openEditor(edit.dataset.edit);
        return;
      }
      const rm = e.target.closest("[data-rm]");
      if (rm) {
        await invoke("contracts.delete", { id: rm.dataset.rm });
        scan();
        return;
      }
      const neu = e.target.closest("[data-new]");
      if (neu) {
        window.ContractsApp.openEditor(null, neu.dataset.new);
      }
    });
  }

  return { id: "library", page, scan, bind };
})();
