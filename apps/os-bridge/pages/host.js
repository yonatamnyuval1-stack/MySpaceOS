window.OsBridgePages = window.OsBridgePages || {};

window.OsBridgePages.host = (function () {
  const esc = window.OsBridge.escapeHtml;
  const toast = window.OsBridge.toast;

  let root = null;

  async function render() {
    if (!root) return;
    let links = [];
    let status = {};
    try {
      const res = await window.OsBridge.invoke("host.links");
      links = res.links || [];
      status = await window.OsBridge.invoke("status");
    } catch (err) {
      root.innerHTML = `<div class="empty"><h2>Host controls unavailable</h2><p>${esc(err.message)}</p></div>`;
      return;
    }

    root.innerHTML = `
      <div class="card">
        <h2>This PC</h2>
        <p class="muted">${esc(status.hostname || "PC")} · ${esc(status.platform || "")}</p>
        <p class="muted">Shortcuts into Windows settings — sound, display, Bluetooth, printers. Deep links, not a second Control Panel.</p>
      </div>
      <div class="host-grid">
        ${links
          .map(
            (l) => `<button type="button" class="host-tile" data-host="${esc(l.id)}">
              <strong>${esc(l.label)}</strong>
              <span>${esc(l.hint || "")}</span>
            </button>`
          )
          .join("")}
      </div>
      <div class="card note-card">
        <h2>Remote computers?</h2>
        <p class="muted">RDP, SSH, and Wake-on-LAN stay in <strong>Remote Hub</strong>: a separate app. OS Bridge is for this machine, your folders, and your phone.</p>
      </div>
    `;

    root.querySelectorAll("[data-host]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await window.OsBridge.invoke("host.open", { id: btn.getAttribute("data-host") });
        } catch (err) {
          toast(err.message);
        }
      });
    });
  }

  return {
    async mount(el) {
      root = el;
      await render();
    },
    refresh: render,
    scan: render,
  };
})();
