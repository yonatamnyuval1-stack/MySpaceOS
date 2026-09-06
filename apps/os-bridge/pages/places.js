window.OsBridgePages = window.OsBridgePages || {};

window.OsBridgePages.places = (function () {
  const esc = window.OsBridge.escapeHtml;
  const toast = window.OsBridge.toast;
  const fmt = window.OsBridge.formatBytes;

  let root = null;

  async function render() {
    if (!root) return;
    let placesRes;
    let drivesRes;
    try {
      placesRes = await window.OsBridge.invoke("places.list");
      drivesRes = await window.OsBridge.invoke("drives.list");
    } catch (err) {
      root.innerHTML = `<div class="empty"><h2>Could not load places</h2><p>${esc(err.message)}</p></div>`;
      return;
    }

    const places = placesRes.places || [];
    const drives = drivesRes.drives || [];

    root.innerHTML = `
      <div class="card">
        <div class="card-head">
          <h2>Places on this PC</h2>
          <button type="button" class="btn btn-primary" id="btn-add-place">Add folder</button>
        </div>
        <p class="muted">Open host folders inside Windows Explorer: Desktop, Downloads, USB, and your favorites.</p>
        <ul class="list place-list">
          ${places
            .map(
              (p) => `<li>
                <div>
                  <strong>${esc(p.label)}</strong>
                  <div class="muted tiny path">${esc(p.path)}</div>
                </div>
                <div class="btn-row">
                  <button type="button" class="btn btn-sm" data-open="${esc(p.path)}">Open</button>
                  <button type="button" class="btn btn-sm" data-copy="${esc(p.path)}">Copy path</button>
                  ${
                    p.kind === "custom"
                      ? `<button type="button" class="btn btn-sm danger" data-remove="${esc(p.id)}">Remove</button>`
                      : ""
                  }
                </div>
              </li>`
            )
            .join("")}
        </ul>
      </div>

      <div class="card">
        <div class="card-head">
          <h2>Drives</h2>
          <button type="button" class="btn" id="btn-refresh-drives">Refresh</button>
        </div>
        ${
          drives.length
            ? `<ul class="list">${drives
                .map(
                  (d) => `<li>
                    <div>
                      <strong>${esc(d.label)}${d.removable ? " · USB" : ""}</strong>
                      <div class="muted tiny">${esc(fmt(d.free))} free of ${esc(fmt(d.size))}</div>
                    </div>
                    <button type="button" class="btn btn-sm" data-open="${esc(d.path)}">Open</button>
                  </li>`
                )
                .join("")}</ul>`
            : `<p class="muted">No drives listed.</p>`
        }
      </div>
    `;

    root.querySelector("#btn-add-place")?.addEventListener("click", async () => {
      try {
        await window.OsBridge.invoke("places.add", {});
        toast("Folder added");
        await render();
      } catch (err) {
        if (err.message !== "Cancelled") toast(err.message);
      }
    });
    root.querySelector("#btn-refresh-drives")?.addEventListener("click", () => render());

    root.querySelectorAll("[data-open]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await window.OsBridge.invoke("places.open", { path: btn.getAttribute("data-open") });
        } catch (err) {
          toast(err.message);
        }
      });
    });
    root.querySelectorAll("[data-copy]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await window.OsBridge.invoke("share.copyPath", { path: btn.getAttribute("data-copy") });
          toast("Path copied");
        } catch (err) {
          toast(err.message);
        }
      });
    });
    root.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await window.OsBridge.invoke("places.remove", { id: btn.getAttribute("data-remove") });
          toast("Removed");
          await render();
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
