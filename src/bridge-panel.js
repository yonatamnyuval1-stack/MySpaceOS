(function () {
  let root = null;
  let open = false;
  let snap = null;
  let tab = "devices";
  let unsub = null;
  let busy = false;

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toast(msg) {
    window.showMySpaceToast?.(String(msg || ""));
  }

  async function refresh() {
    const res = await window.mySpace?.osBridge?.status?.();
    if (res?.ok !== false) snap = res;
    paint();
  }

  function pair() {
    return snap?.pair || {};
  }

  function openFull(page) {
    const pageMap = { share: "actions" };
    const raw = page || tab;
    const p = ["devices", "places", "actions", "host"].includes(raw)
      ? raw
      : pageMap[raw] || "devices";
    hide();
    void window.MySpaceOsBridge?.open?.({ page: p, full: true });
  }

  function paintDevices() {
    const list = root?.querySelector("#bridge-panel-body");
    if (!list) return;
    const p = pair();
    const running = !!p.running;
    const code = p.pairCode || "————";
    const devices = p.devices || [];
    const inbox = snap?.inboxCount || 0;
    const url = p.primaryUrl || (p.urls && p.urls[0]) || "";

    list.innerHTML = `
      <div class="bridge-panel-section">
        <div class="bridge-panel-status-row">
          <span class="bridge-pill ${running ? "is-on" : ""}">${running ? "Listening" : "Stopped"}</span>
          <span class="bridge-panel-meta">${devices.length} phone(s) · inbox ${inbox}</span>
        </div>
        <p class="bridge-panel-hint">${escapeHtml(p.tip || "Same Wi‑Fi as this PC. Port 17834.")}</p>
        <div class="bridge-code">${escapeHtml(code)}</div>
        <div class="bridge-panel-actions">
          <button type="button" class="bridge-btn bridge-btn-primary" id="bridge-pair-toggle" ${busy ? "disabled" : ""}>
            ${running ? "Refresh code" : "Start pairing"}
          </button>
          <button type="button" class="bridge-btn" id="bridge-pair-stop" ${running && !busy ? "" : "disabled"}>Stop</button>
          <button type="button" class="bridge-btn" id="bridge-copy-link" ${url ? "" : "disabled"}>Copy link</button>
        </div>
        ${
          url
            ? `<p class="bridge-link-line"><code>${escapeHtml(url)}</code></p>`
            : ""
        }
      </div>
      <div class="bridge-panel-section">
        <h3>Connected</h3>
        ${
          devices.length
            ? `<ul class="bridge-device-list">${devices
                .map(
                  (d) =>
                    `<li><strong>${escapeHtml(d.name || "Phone")}</strong><span>${escapeHtml(
                      d.lastSeen ? new Date(d.lastSeen).toLocaleTimeString() : ""
                    )}</span></li>`
                )
                .join("")}</ul>`
            : `<p class="bridge-panel-empty">No phone connected: scan QR or open the link in the full app.</p>`
        }
      </div>
      <div class="bridge-panel-section bridge-panel-quick">
        <h3>Open surface</h3>
        <div class="bridge-surface-row">
          <button type="button" class="bridge-surface" data-open-page="devices">Devices</button>
          <button type="button" class="bridge-surface" data-open-page="actions">Share</button>
          <button type="button" class="bridge-surface" data-open-page="places">Places</button>
          <button type="button" class="bridge-surface" data-open-page="host">Host</button>
        </div>
      </div>`;

    list.querySelector("#bridge-pair-toggle")?.addEventListener("click", async () => {
      busy = true;
      paint();
      const res = running
        ? await window.mySpace?.osBridge?.pairRefreshCode?.()
        : await window.mySpace?.osBridge?.pairStart?.();
      busy = false;
      if (res?.ok === false) toast(res.error || "Pairing failed");
      else toast(running ? "Code refreshed" : "Pairing started");
      await refresh();
    });
    list.querySelector("#bridge-pair-stop")?.addEventListener("click", async () => {
      busy = true;
      paint();
      const res = await window.mySpace?.osBridge?.pairStop?.();
      busy = false;
      if (res?.ok === false) toast(res.error || "Could not stop");
      else toast("Pairing stopped");
      await refresh();
    });
    list.querySelector("#bridge-copy-link")?.addEventListener("click", async () => {
      if (!url) return;
      try {
        await navigator.clipboard.writeText(url);
        toast("Link copied");
      } catch {
        toast("Could not copy link");
      }
    });
    list.querySelectorAll("[data-open-page]").forEach((btn) => {
      btn.addEventListener("click", () => openFull(btn.dataset.openPage));
    });
  }

  function paintShare() {
    const list = root?.querySelector("#bridge-panel-body");
    if (!list) return;
    list.innerHTML = `
      <div class="bridge-panel-section">
        <p class="bridge-panel-hint">Clipboard+, history, and send-to-phone live in the full Share surface.</p>
        <div class="bridge-panel-actions">
          <button type="button" class="bridge-btn bridge-btn-primary" data-open-page="actions">Open Share</button>
          <button type="button" class="bridge-btn" id="bridge-clip-read">Read PC clipboard</button>
        </div>
        <pre class="bridge-clip-preview" id="bridge-clip-preview">—</pre>
      </div>`;
    list.querySelector("[data-open-page]")?.addEventListener("click", () => openFull("actions"));
    list.querySelector("#bridge-clip-read")?.addEventListener("click", async () => {
      const res = await window.mySpace?.osBridge?.clipboardRead?.();
      const box = list.querySelector("#bridge-clip-preview");
      if (!box) return;
      if (res?.ok === false) {
        box.textContent = res.error || "Could not read clipboard";
        return;
      }
      if (res?.kind === "image") {
        box.textContent = `Image (${res.mime || "image"}) · ${res.width || "?"}×${res.height || "?"}`;
      } else {
        box.textContent = res?.text || "(empty)";
      }
    });
  }

  function paintPlaces() {
    const list = root?.querySelector("#bridge-panel-body");
    if (!list) return;
    void (async () => {
      const res = await window.mySpace?.osBridge?.places?.();
      const places = res?.places || [];
      list.innerHTML = `
        <div class="bridge-panel-section">
          <p class="bridge-panel-hint">Host folders & USB: open a place or manage in the full app.</p>
          <ul class="bridge-place-list">
            ${places
              .slice(0, 8)
              .map(
                (pl) =>
                  `<li><button type="button" class="bridge-place" data-path="${escapeHtml(pl.path)}">${escapeHtml(
                    pl.label || pl.path
                  )}</button></li>`
              )
              .join("")}
          </ul>
          <button type="button" class="bridge-btn bridge-btn-primary" data-open-page="places">Open Places</button>
        </div>`;
      list.querySelector("[data-open-page]")?.addEventListener("click", () => openFull("places"));
      list.querySelectorAll(".bridge-place").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const path = btn.dataset.path;
          const r = await window.mySpace?.osBridge?.openPlace?.(path);
          if (r?.ok === false) toast(r.error || "Could not open");
        });
      });
    })();
  }

  function paint() {
    if (!root) return;
    root.querySelectorAll("[data-bridge-tab]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.bridgeTab === tab);
    });
    if (tab === "share") paintShare();
    else if (tab === "places") paintPlaces();
    else paintDevices();
  }

  function ensure() {
    if (root) return root;
    root = document.createElement("div");
    root.className = "bridge-panel hidden";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "OS Bridge");
    root.innerHTML = `
      <div class="bridge-panel-shell">
        <header class="bridge-panel-head">
          <div class="bridge-panel-brand">
            <img src="brand/atom-white.png" alt="" width="28" height="28" />
            <div>
              <h2>OS Bridge</h2>
              <p>Phone · host folders · clipboard: not Remote Hub</p>
            </div>
          </div>
          <button type="button" class="bridge-panel-close" aria-label="Close">×</button>
        </header>
        <div class="bridge-panel-toolbar">
          <div class="bridge-panel-tabs">
            <button type="button" data-bridge-tab="devices" class="is-active">Devices</button>
            <button type="button" data-bridge-tab="share">Share</button>
            <button type="button" data-bridge-tab="places">Places</button>
          </div>
          <button type="button" class="bridge-btn bridge-btn-quiet" id="bridge-open-full">Full app</button>
        </div>
        <div class="bridge-panel-body" id="bridge-panel-body"></div>
        <footer class="bridge-panel-foot">
          <span>Shell: bridge(panel) · bridge(pair) · bridge(status)</span>
        </footer>
      </div>`;
    root.querySelector(".bridge-panel-close").addEventListener("click", hide);
    root.addEventListener("click", (e) => {
      if (e.target === root) hide();
    });
    root.querySelectorAll("[data-bridge-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        tab = btn.dataset.bridgeTab;
        paint();
      });
    });
    root.querySelector("#bridge-open-full")?.addEventListener("click", () => openFull(tab === "share" ? "actions" : tab));
    document.body.appendChild(root);
    return root;
  }

  async function show(initialTab) {
    ensure();
    open = true;
    const map = { devices: "devices", places: "places", actions: "share", share: "share", host: "devices" };
    tab = map[initialTab] || "devices";
    root.classList.remove("hidden");
    if (!unsub && window.mySpace?.osBridge?.onEvent) {
      unsub = window.mySpace.osBridge.onEvent(() => {
        if (!open) return;
        void refresh();
      });
    }
    await refresh();
  }

  function hide() {
    open = false;
    root?.classList.add("hidden");
  }

  function toggle() {
    if (open) hide();
    else void show();
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) hide();
  });

  window.MySpaceBridgePanel = { show, hide, toggle, refresh, isOpen: () => open };
})();