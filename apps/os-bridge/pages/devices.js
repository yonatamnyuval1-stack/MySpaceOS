window.OsBridgePages = window.OsBridgePages || {};

window.OsBridgePages.devices = (function () {
  const esc = window.OsBridge.escapeHtml;
  const toast = window.OsBridge.toast;
  const fmt = window.OsBridge.formatBytes;

  let root = null;
  let unsub = null;
  let selectedUrl = "";
  let renderSeq = 0;

  function makeQrDataUrl(text) {
    return new Promise((resolve, reject) => {
      const QR = window.QRCode;
      if (!QR || typeof QR.toCanvas !== "function") {
        reject(new Error("QR library missing"));
        return;
      }
      const canvas = document.createElement("canvas");
      QR.toCanvas(
        canvas,
        String(text || ""),
        { width: 200, margin: 1, errorCorrectionLevel: "M", color: { dark: "#0b0d10", light: "#ffffff" } },
        (err) => {
          if (err) reject(err);
          else {
            try {
              resolve(canvas.toDataURL("image/png"));
            } catch (e) {
              reject(e);
            }
          }
        }
      );
    });
  }

  async function paintQr(seq, url) {
    const box = root?.querySelector("#qr-box");
    if (!box || seq !== renderSeq) return;
    if (!url) {
      box.innerHTML = `<div class="qr-placeholder">Start pairing to show QR</div>`;
      return;
    }
    box.innerHTML = `<div class="qr-placeholder">Building QR…</div>`;
    try {
      const dataUrl = await makeQrDataUrl(url);
      if (seq !== renderSeq || !root) return;
      const imgBox = root.querySelector("#qr-box");
      if (!imgBox) return;
      imgBox.innerHTML = `<img class="qr" src="${esc(dataUrl)}" alt="QR code" width="200" height="200" />`;
    } catch (err) {
      if (seq !== renderSeq || !root) return;
      const imgBox = root.querySelector("#qr-box");
      if (!imgBox) return;
      imgBox.innerHTML = `<div class="qr-placeholder">QR failed — use Copy link<br/><span class="tiny">${esc(err?.message || "")}</span></div>`;
    }
  }

  function deviceOptions(devices, selected) {
    const opts = [`<option value="">All connected phones</option>`];
    for (const d of devices) {
      const sel = d.id === selected ? " selected" : "";
      opts.push(`<option value="${esc(d.id)}"${sel}>${esc(d.name || "Phone")}</option>`);
    }
    return opts.join("");
  }

  async function render() {
    if (!root) return;
    const seq = ++renderSeq;
    let status;
    let inbox;
    let outbox;
    try {
      status = await window.OsBridge.invoke("status");
      inbox = await window.OsBridge.invoke("inbox.list");
      outbox = await window.OsBridge.invoke("outbox.list");
    } catch (err) {
      root.innerHTML = `<div class="empty"><h2>Could not load</h2><p>${esc(err.message)}</p></div>`;
      return;
    }
    if (seq !== renderSeq) return;

    const pair = status.pair || status;
    const running = !!pair.running;
    const code = pair.pairCode || "————";
    const urls = pair.urls || [];
    const networks = pair.networks || [];
    const primary = selectedUrl && urls.includes(selectedUrl) ? selectedUrl : pair.primaryUrl || urls[0] || "";
    selectedUrl = primary;
    const devices = pair.devices || [];
    const trusted = status.trustedDevices || {};
    const connectedIds = new Set(devices.map((d) => d.id));
    const knownOffline = Object.entries(trusted)
      .filter(([id]) => !connectedIds.has(id))
      .map(([id, meta]) => ({ id, name: meta.name || "Phone", lastSeen: meta.lastSeen, offline: true }));
    const files = inbox.files || [];
    const sent = outbox.files || [];
    const tip = pair.tip || "Same Wi‑Fi as this PC. If the page won’t load, try another link.";

    root.innerHTML = `
      <div class="hero-grid">
        <div class="card pair-card">
          <div class="card-head">
            <h2>Pair phone</h2>
            <span class="pill ${running ? "is-on" : ""}">${running ? "Listening" : "Stopped"}</span>
          </div>
          <p class="muted">${esc(tip)}</p>
          <div class="pair-layout">
            <div class="pair-code-block">
              <div class="pair-label">Code</div>
              <div class="pair-code" id="pair-code">${esc(code)}</div>
              <div class="btn-row">
                <button type="button" class="btn btn-primary" id="btn-start">${running ? "Refresh code" : "Start pairing"}</button>
                <button type="button" class="btn" id="btn-stop" ${running ? "" : "disabled"}>Stop</button>
                <button type="button" class="btn" id="btn-copy-url" ${primary ? "" : "disabled"}>Copy link</button>
              </div>
            </div>
            <div class="pair-qr-block" id="qr-box">
              <div class="qr-placeholder">${running ? "Building QR…" : "Start pairing to show QR"}</div>
            </div>
          </div>
          <div class="url-list">
            ${
              urls.length
                ? urls
                    .map((u, i) => {
                      const net = networks[i];
                      const label = net ? `${net.address} · ${net.name}` : u;
                      const active = u === primary ? "is-active" : "";
                      return `<button type="button" class="url-line ${active}" data-url="${esc(u)}" title="${esc(u)}">${esc(label)}</button>`;
                    })
                    .join("")
                : `<p class="muted">No LAN address yet — check Wi‑Fi on the PC.</p>`
            }
          </div>
          <p class="muted tiny">Easiest fallback: Copy link → paste into the phone browser (Chrome/Safari). Must be <strong>http://</strong> on the same Wi‑Fi — not mobile data.</p>
        </div>

        <div class="card">
          <div class="card-head">
            <h2>Connected</h2>
            <span class="muted">${devices.length}</span>
          </div>
          ${
            devices.length
              ? `<ul class="list device-list">${devices
                  .map(
                    (d) => `<li class="device-row">
                      <div class="device-main">
                        <strong>${esc(d.name || "Phone")}</strong>
                        <div class="muted tiny">Last seen ${esc(d.lastSeen || "—")}</div>
                        <div class="device-actions">
                          <button type="button" class="btn btn-sm" data-rename="${esc(d.id)}" data-name="${esc(d.name || "Phone")}">Rename</button>
                          <button type="button" class="btn btn-sm" data-send-file="${esc(d.id)}">Send file</button>
                          <button type="button" class="btn btn-sm btn-danger" data-disconnect="${esc(d.id)}">Disconnect</button>
                        </div>
                      </div>
                    </li>`
                  )
                  .join("")}</ul>`
              : `<p class="muted">No phone paired yet.</p>`
          }
          ${
            knownOffline.length
              ? `<div class="known-devices">
                  <div class="muted tiny">Known devices (offline)</div>
                  <ul class="list compact">${knownOffline
                    .map(
                      (d) => `<li>
                        <div>
                          <strong>${esc(d.name)}</strong>
                          <div class="muted tiny">Last seen ${esc(d.lastSeen || "—")}</div>
                        </div>
                        <span class="chip">Offline</span>
                      </li>`
                    )
                    .join("")}</ul>
                </div>`
              : ""
          }
          <div class="field-row stack-field">
            <select id="target-device" class="input">${deviceOptions(devices)}</select>
            <input type="url" id="send-url" class="input" placeholder="https://… open on phone" />
            <button type="button" class="btn btn-primary" id="btn-send-url">Send link</button>
          </div>
        </div>
      </div>

      <div class="hero-grid">
        <div class="card">
          <div class="card-head">
            <h2>Bridge Send</h2>
            <span class="muted">PC → phone</span>
          </div>
          <p class="muted">Pick a file on this PC and push it to a paired phone (max 40 MB).</p>
          <div class="field-row stack-field">
            <select id="send-file-device" class="input">${deviceOptions(devices)}</select>
            <button type="button" class="btn btn-primary" id="btn-send-file">Choose file & send</button>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <h2>Outbox</h2>
            <button type="button" class="btn btn-sm" id="btn-clear-outbox" ${sent.length ? "" : "disabled"}>Clear</button>
          </div>
          ${
            sent.length
              ? `<ul class="list file-list">${sent
                  .slice(0, 8)
                  .map(
                    (f) => `<li>
                      <div>
                        <strong>${esc(f.name)}</strong>
                        <div class="muted tiny">${esc(fmt(f.size))} · staged for download</div>
                      </div>
                    </li>`
                  )
                  .join("")}</ul>`
              : `<p class="muted">Files you send to the phone are staged here until downloaded.</p>`
          }
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <h2>Inbox from phone</h2>
          <div class="btn-row">
            <button type="button" class="btn" id="btn-open-inbox">Open folder</button>
            <button type="button" class="btn" id="btn-clear-inbox" ${files.length ? "" : "disabled"}>Clear</button>
          </div>
        </div>
        ${
          files.length
            ? `<ul class="list file-list">${files
                .map(
                  (f) => `<li>
                    <div>
                      <strong>${esc(f.name)}</strong>
                      <div class="muted tiny">${esc(fmt(f.size))} · ${esc(f.mtime || "")}</div>
                    </div>
                    <button type="button" class="btn btn-sm" data-reveal="${esc(f.path)}">Show</button>
                  </li>`
                )
                .join("")}</ul>`
            : `<p class="muted">Files you upload on the phone land here.</p>`
        }
      </div>
    `;

    root.querySelector("#btn-start")?.addEventListener("click", async () => {
      try {
        if (running) await window.OsBridge.invoke("pair.refreshCode");
        else await window.OsBridge.invoke("pair.start");
        selectedUrl = "";
        toast(running ? "New pairing code" : "Pairing started");
        await render();
      } catch (err) {
        toast(err.message || "Could not start");
      }
    });
    root.querySelector("#btn-stop")?.addEventListener("click", async () => {
      try {
        await window.OsBridge.invoke("pair.stop");
        selectedUrl = "";
        toast("Pairing stopped");
        await render();
      } catch (err) {
        toast(err.message);
      }
    });
    root.querySelector("#btn-copy-url")?.addEventListener("click", async () => {
      try {
        await window.OsBridge.invoke("clipboard.write", { text: primary });
        toast("Link copied — paste in the phone browser");
      } catch (err) {
        toast(err.message);
      }
    });
    root.querySelectorAll("[data-url]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        selectedUrl = btn.getAttribute("data-url") || "";
        toast("Using this network for QR");
        await render();
      });
    });
    root.querySelector("#btn-send-url")?.addEventListener("click", async () => {
      const url = root.querySelector("#send-url")?.value?.trim();
      const deviceId = root.querySelector("#target-device")?.value || "";
      try {
        const res = await window.OsBridge.invoke("pair.openUrl", { url, deviceId: deviceId || undefined });
        toast(res.devices ? `Queued for ${res.devices} device(s)` : "No devices connected");
      } catch (err) {
        toast(err.message);
      }
    });
    root.querySelector("#btn-send-file")?.addEventListener("click", async () => {
      const deviceId = root.querySelector("#send-file-device")?.value || "";
      try {
        const res = await window.OsBridge.invoke("pair.sendFile", { deviceId: deviceId || undefined });
        if (res.ok) toast(`Sent ${res.name || "file"} to ${res.devices || 0} device(s)`);
        else toast(res.error || "Send failed");
        await render();
      } catch (err) {
        toast(err.message);
      }
    });
    root.querySelectorAll("[data-send-file]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const deviceId = btn.getAttribute("data-send-file") || "";
        try {
          const res = await window.OsBridge.invoke("pair.sendFile", { deviceId });
          if (res.ok) toast(`Sent ${res.name || "file"}`);
          else toast(res.error || "Send failed");
          await render();
        } catch (err) {
          toast(err.message);
        }
      });
    });
    root.querySelectorAll("[data-disconnect]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const deviceId = btn.getAttribute("data-disconnect") || "";
        if (!window.confirm("Disconnect this phone?")) return;
        try {
          await window.OsBridge.invoke("devices.revoke", { deviceId });
          toast("Phone disconnected");
          await render();
        } catch (err) {
          toast(err.message);
        }
      });
    });
    root.querySelectorAll("[data-rename]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const deviceId = btn.getAttribute("data-rename") || "";
        const current = btn.getAttribute("data-name") || "Phone";
        const name = window.prompt("Device name", current);
        if (!name || name === current) return;
        try {
          await window.OsBridge.invoke("devices.rename", { deviceId, name });
          toast("Device renamed");
          await render();
        } catch (err) {
          toast(err.message);
        }
      });
    });
    root.querySelector("#btn-clear-outbox")?.addEventListener("click", async () => {
      try {
        await window.OsBridge.invoke("outbox.clear");
        toast("Outbox cleared");
        await render();
      } catch (err) {
        toast(err.message);
      }
    });
    root.querySelector("#btn-open-inbox")?.addEventListener("click", async () => {
      try {
        await window.OsBridge.invoke("inbox.open");
      } catch (err) {
        toast(err.message);
      }
    });
    root.querySelector("#btn-clear-inbox")?.addEventListener("click", async () => {
      try {
        await window.OsBridge.invoke("inbox.clear");
        toast("Inbox cleared");
        await render();
      } catch (err) {
        toast(err.message);
      }
    });
    root.querySelectorAll("[data-reveal]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await window.OsBridge.invoke("places.reveal", { path: btn.getAttribute("data-reveal") });
        } catch (err) {
          toast(err.message);
        }
      });
    });

    if (running && primary) void paintQr(seq, primary);
  }

  return {
    async mount(el) {
      root = el;
      if (!unsub && window.myApp?.onEvent) {
        unsub = window.myApp.onEvent((data) => {
          if (!data) return;
          if (data.type === "file-received") toast(`Received ${data.name || "file"}`);
          if (data.type === "file-sent") toast(`Sent ${data.name || "file"} to phone`);
          if (data.type === "clipboard-from-device") toast("Clipboard updated from phone");
          if (data.type === "device-paired") {
            toast("Phone paired");
            void window.OsBridge.invoke("devices.trust", {
              deviceId: data.device?.id,
              name: data.device?.name,
            });
          }
          if (data.type === "device-revoked") toast("Phone disconnected");
          void render();
        });
      }
      await render();
    },
    async refresh() {
      await render();
    },
    scan: render,
  };
})();
