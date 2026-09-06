window.ContractPages = window.ContractPages || {};

window.ContractPages.expiring = (function () {
  const { escapeHtml, invoke, statusLabel, statusClass } = window.Contracts;
  const page = document.getElementById("page-expiring");

  async function scan() {
    page.classList.add("loading");
    try {
      const [upcoming, check] = await Promise.all([invoke("expiry.upcoming"), invoke("expiry.check")]);
      render(upcoming.upcoming || [], check.triggered || []);
      page.querySelector("#expiring-error").hidden = true;
    } catch (err) {
      page.querySelector("#expiring-error").textContent = err.message;
      page.querySelector("#expiring-error").hidden = false;
    } finally {
      page.classList.remove("loading");
    }
  }

  function render(upcoming, triggered) {
    const trigEl = page.querySelector("#expiring-triggered");
    if (triggered.length) {
      trigEl.hidden = false;
      trigEl.innerHTML = triggered
        .map((t) => `<div class="expiry-hit">${escapeHtml(t.title)} — ${escapeHtml(t.type)}</div>`)
        .join("");
    } else {
      trigEl.hidden = true;
    }

    const el = page.querySelector("#expiring-list");
    if (!upcoming.length) {
      el.innerHTML = `<p class="muted">No contracts expiring in the next 30 days.</p>`;
      return;
    }

    el.innerHTML = upcoming
      .map(
        (u) => `<article class="contract-row">
        <div class="contract-row-main">
          <h3>${escapeHtml(u.title)}</h3>
          <p class="muted">Expires ${escapeHtml(u.expiryDate)} · ${u.daysLeft <= 0 ? "Today / overdue" : `${u.daysLeft} days`}</p>
        </div>
        <span class="status-pill ${statusClass(u.status)}">${escapeHtml(statusLabel(u.status))}</span>
        <button type="button" class="btn btn-ghost btn-sm" data-doc="${escapeHtml(u.id)}">Open</button>
      </article>`
      )
      .join("");

    el.querySelectorAll("[data-doc]").forEach((btn) => {
      btn.addEventListener("click", () => window.ContractsApp.openDocument(btn.dataset.doc));
    });
  }

  function bind() {
    page.querySelector("#btn-check-expiry")?.addEventListener("click", scan);
  }

  return { id: "expiring", page, scan, bind };
})();
