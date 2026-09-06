window.StocksPages = window.StocksPages || {};

window.StocksPages.alerts = (function () {
  const { escapeHtml, invoke, formatMoney } = window.Stocks;
  const page = document.getElementById("page-alerts");
  let alerts = [];

  async function scan() {
    page.classList.add("loading");
    try {
      const res = await invoke("alerts.list");
      alerts = res.alerts || [];
      const check = await invoke("alerts.check");
      render(alerts, check.triggered || []);
    } catch (err) {
      page.querySelector("#alerts-error").textContent = err.message;
      page.querySelector("#alerts-error").hidden = false;
    } finally {
      page.classList.remove("loading");
    }
  }

  function render(list, triggered) {
    page.querySelector("#alerts-error").hidden = true;
    const enabled = list.filter((a) => a.enabled).length;
    const firedIds = new Set((triggered || []).map((t) => t.id).filter(Boolean));
    const firedCount = triggered.length || list.filter((a) => a.triggeredAt).length;

    page.querySelector("#alerts-count").textContent = String(list.length);
    page.querySelector("#alerts-on").textContent = String(enabled);
    page.querySelector("#alerts-fired-count").textContent = String(firedCount);
    page.querySelector("#alerts-list-count").textContent = String(list.length);

    const trigEl = page.querySelector("#alerts-triggered");
    if (triggered.length) {
      trigEl.hidden = false;
      trigEl.innerHTML = `<div class="alert-fired-head">Triggered now</div>${triggered
        .map(
          (t) =>
            `<div class="alert-hit"><strong>${escapeHtml(t.symbol)}</strong> — ${escapeHtml(t.reason)}${t.note ? ` · ${escapeHtml(t.note)}` : ""}</div>`
        )
        .join("")}`;
    } else {
      trigEl.hidden = true;
      trigEl.innerHTML = "";
    }

    const el = page.querySelector("#alerts-list");
    if (!list.length) {
      el.innerHTML = `<div class="empty-state">
        <strong>No alerts yet</strong>
        <p>Create an above/below price alert to get nudged when levels hit.</p>
      </div>`;
      return;
    }

    el.innerHTML = list
      .map((a) => {
        const live = firedIds.has(a.id) || Boolean(a.triggeredAt && a.enabled);
        return `<article class="alert-card ${a.enabled ? "" : "disabled"} ${live ? "is-fired" : ""}">
          <div class="alert-head">
            <div class="alert-id">
              <button type="button" class="sym-link" data-go="${escapeHtml(a.symbol)}">${escapeHtml(a.symbol)}</button>
              ${live ? `<span class="alert-live">Triggered</span>` : ""}
            </div>
            <label class="switch">
              <input type="checkbox" data-toggle="${escapeHtml(a.id)}" ${a.enabled ? "checked" : ""} />
              <span class="switch-ui" aria-hidden="true"></span>
              <span class="switch-label">${a.enabled ? "On" : "Off"}</span>
            </label>
          </div>
          <div class="alert-rules">
            ${a.above != null ? `<span class="rule-chip rule-chip--above">Above ${formatMoney(a.above)}</span>` : ""}
            ${a.below != null ? `<span class="rule-chip rule-chip--below">Below ${formatMoney(a.below)}</span>` : ""}
          </div>
          ${a.note ? `<p class="alert-note">${escapeHtml(a.note)}</p>` : ""}
          ${a.triggeredAt ? `<p class="muted alert-time">Last fired ${new Date(a.triggeredAt).toLocaleString()}</p>` : `<p class="muted alert-time">Waiting for price</p>`}
          <div class="alert-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-rm="${escapeHtml(a.id)}">Remove</button>
          </div>
        </article>`;
      })
      .join("");

    el.querySelectorAll("[data-go]").forEach((btn) => {
      btn.addEventListener("click", () => window.StocksApp.openStock(btn.dataset.go));
    });
    el.querySelectorAll("[data-rm]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        alerts = alerts.filter((a) => a.id !== btn.dataset.rm);
        await invoke("alerts.save", { alerts });
        scan();
      });
    });
    el.querySelectorAll("[data-toggle]").forEach((cb) => {
      cb.addEventListener("change", async () => {
        const item = alerts.find((a) => a.id === cb.dataset.toggle);
        if (item) item.enabled = cb.checked;
        await invoke("alerts.save", { alerts });
        const label = cb.closest(".switch")?.querySelector(".switch-label");
        if (label) label.textContent = cb.checked ? "On" : "Off";
        cb.closest(".alert-card")?.classList.toggle("disabled", !cb.checked);
      });
    });
  }

  async function addAlert(e) {
    e?.preventDefault?.();
    const symbol = page.querySelector("#alert-symbol").value.trim().toUpperCase();
    const above = page.querySelector("#alert-above").value;
    const below = page.querySelector("#alert-below").value;
    const note = page.querySelector("#alert-note").value.trim();
    if (!symbol || (!above && !below)) return;
    alerts.unshift({
      id: `al_${Date.now()}`,
      symbol,
      above: above ? parseFloat(above) : null,
      below: below ? parseFloat(below) : null,
      enabled: true,
      note,
    });
    await invoke("alerts.save", { alerts });
    page.querySelector("#alert-symbol").value = "";
    page.querySelector("#alert-above").value = "";
    page.querySelector("#alert-below").value = "";
    page.querySelector("#alert-note").value = "";
    scan();
  }

  function bind() {
    page.querySelector("#alert-form")?.addEventListener("submit", addAlert);
  }

  return { id: "alerts", page, scan, bind };
})();
