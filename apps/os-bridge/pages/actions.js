const { deduplicateJsonSchemaRequiredArrays } = require("@composio/core");
const { Tray } = require("electron/main");
const { HandHeart, DotSquare, Square } = require("lucide-static");

window.OsBridgePages = window.OsBridgePages || {};

window.OsBridgePages.actions = (function () {
  const esc = window.OsBridge.escapeHtml;
  const toast = window.OsBridge.toast;
  const fmt = window.OsBridge.formatBytes;

  let root = null;
  let unsub = null;

  function historyPreview(item) {
    if (item.kind === "image") return item.preview || "Image";
    return item.preview || item.text || "";
  }

  async function render() {
    if (!root) return;
    let clip = { text: "", hasImage: false, imageDataUrl: "" };
    let recent = [];
    let history = [];
    let devices = [];
    try {
      clip = await window.OsBridge.invoke("clipboard.read");
      const r = await window.OsBridge.invoke("recent.list");
      recent = r.recent || [];
      const h = await window.OsBridge.invoke("clipboard.history");
      history = h.items || [];
      const st = await window.OsBridge.invoke("status");
      devices = st.pair?.devices || [];
    } catch (err) {
      root.innerHTML = `<div class="empty"><h2>Share unavailable</h2><p>${esc(err.message)}</p></div>`;
      return;
    }

    const deviceOptions = [
      `<option value="">All connected phones</option>`,
      ...devices.map((d) => `<option value="${esc(d.id)}">${esc(d.name || "Phone")}</option>`),
    ].join("");

    root.innerHTML = `
      <div class="hero-grid">
        <div class="card">
          <h2>Clipboard+</h2>
          <p class="muted">Text and images between My Space, Windows, and your paired phone, with history.</p>
          ${
            clip.hasImage && clip.imageDataUrl
              ? `<div class="clip-preview"><img src="${esc(clip.imageDataUrl)}" alt="Clipboard image" /></div>`
              : ""
          }
          <textarea id="clip-area" class="textarea" rows="6" placeholder="Clipboard text">${esc(clip.text || "")}</textarea>
          <div class="btn-row wrap">
            <button type="button" class="btn btn-primary" id="btn-write-clip">Write to clipboard</button>
            <button type="button" class="btn" id="btn-read-clip">Reload</button>
            <button type="button" class="btn" id="btn-save-clip">Save as file</button>
          </div>
          <div class="field-row stack-field">
            <select id="clip-device" class="input">${deviceOptions}</select>
            <button type="button" class="btn btn-primary" id="btn-send-phone">Send to phone</button>
          </div>
        </div>
        <div class="card">
          <h2>Quick share</h2>
          <p class="muted">Pick a path, open outside My Space, or send a link to a paired phone.</p>
          <div class="stack">
            <button type="button" class="action-tile" id="btn-pick-file">
              <strong>Pick file</strong>
              <span>Copy path to clipboard</span>
            </button>
            <button type="button" class="action-tile" id="btn-pick-folder">
              <strong>Pick folder</strong>
              <span>Copy path to clipboard</span>
            </button>
            <button type="button" class="action-tile" id="btn-open-url">
              <strong>Open URL in Windows</strong>
              <span>Uses the system browser</span>
            </button>
            <button type="button" class="action-tile" id="btn-phone-url">
              <strong>Open URL on phone</strong>
              <span>Requires an active pair</span>
            </button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <h2>Clipboard history</h2>
          <button type="button" class="btn btn-sm" id="btn-clear-history" ${history.length ? "" : "disabled"}>Clear</button>
        </div>
        ${
          history.length
            ? `<ul class="list clip-history">${history
                .slice(0, 20)
                .map((item) => {
                  const from = item.from === "phone" ? "Phone" : "PC";
                  const kind = item.kind === "image" ? "Image" : "Text";
                  const thumb =
                    item.kind === "image" && item.imagePath
                      ? `<span class="chip">${kind}</span>`
                      : `<span class="chip">${kind}</span>`;
                  return `<li>
                    <div class="clip-history-main">
                      <strong>${esc(from)} · ${esc(kind)}</strong>
                      <div class="muted tiny clip-preview-line">${esc(historyPreview(item))}</div>
                      <div class="muted tiny">${esc((item.at || "").replace("T", " ").slice(0, 19))}${item.size ? ` · ${esc(fmt(item.size))}` : ""}</div>
                    </div>
                    <div class="btn-row">
                      ${thumb}
                      <button type="button" class="btn btn-sm" data-use-clip="${esc(item.id)}">Use</button>
                    </div>
                  </li>`;
                })
                .join("")}</ul>`
            : `<p class="muted">Recent clipboard items appear here. text and images from PC or phone.</p>`
        }
      </div>

      <div class="card">
        <h2>Recent</h2>
        ${
          recent.length
            ? `<ul class="list compact">${recent
                .slice(0, 12)
                .map(
                  (e) => `<li>
                    <div>
                      <strong>${esc(e.kind)}</strong>
                      <div class="muted tiny">${esc(e.path || e.url || e.id || "")}</div>
                    </div>
                    <span class="muted tiny">${esc((e.at || "").replace("T", " ").slice(0, 19))}</span>
                  </li>`
                )
                .join("")}</ul>`
            : `<p class="muted">Actions you take here show up in this list.</p>`
        }
      </div>
    `;

    root.querySelector("#btn-write-clip")?.addEventListener("click", async () => {
      try {
        const text = root.querySelector("#clip-area")?.value ?? "";
        await window.OsBridge.invoke("clipboard.write", { text });
        toast("Clipboard updated");
        await render();
      } catch (err) {
        toast(err.message);
      }
    });
    root.querySelector("#btn-read-clip")?.addEventListener("click", () => render());
    root.querySelector("#btn-save-clip")?.addEventListener("click", async () => {
      try {
        const res = await window.OsBridge.invoke("share.saveClipboard");
        toast(`Saved ${res.path}`);
        await render();
      } catch (err) {
        toast(err.message);
      }
    });
    root.querySelector("#btn-send-phone")?.addEventListener("click", async () => {
      const deviceId = root.querySelector("#clip-device")?.value || "";
      const text = root.querySelector("#clip-area")?.value ?? "";
      try {
        const res = await window.OsBridge.invoke("clipboard.sendToPhone", {
          text,
          deviceId: deviceId || undefined,
        });
        if (res.ok) toast(`Sent ${res.kind || "clipboard"} to ${res.devices || 0} device(s)`);
        else toast(res.error || "Nothing to send");
        await render();
      } catch (err) {
        toast(err.message);
      }
    });
    root.querySelector("#btn-clear-history")?.addEventListener("click", async () => {
      if (!window.confirm("Clear clipboard history?")) return;
      try {
        await window.OsBridge.invoke("clipboard.history.clear");
        toast("History cleared");
        await render();
      } catch (err) {
        toast(err.message);
      }
    });
    root.querySelectorAll("[data-use-clip]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          const res = await window.OsBridge.invoke("clipboard.history.use", {
            id: btn.getAttribute("data-use-clip"),
          });
          toast(res.kind === "image" ? "Image restored to clipboard" : "Text restored to clipboard");
          await render();
        } catch (err) {
          toast(err.message);
        }
      });
    });
    root.querySelector("#btn-pick-file")?.addEventListener("click", async () => {
      try {
        const res = await window.OsBridge.invoke("share.pickFile");
        const p = res.paths?.[0];
        if (!p) return;
        await window.OsBridge.invoke("share.copyPath", { path: p });
        toast("File path copied");
        await render();
      } catch (err) {
        if (err.message !== "Cancelled") toast(err.message);
      }
    });
    root.querySelector("#btn-pick-folder")?.addEventListener("click", async () => {
      try {
        const res = await window.OsBridge.invoke("share.pickFolder");
        await window.OsBridge.invoke("share.copyPath", { path: res.path });
        toast("Folder path copied");
        await render();
      } catch (err) {
        if (err.message !== "Cancelled") toast(err.message);
      }
    });
    root.querySelector("#btn-open-url")?.addEventListener("click", async () => {
      const url = window.prompt("URL to open in Windows");
      if (!url) return;
      try {
        await window.OsBridge.invoke("share.openExternal", { url });
        toast("Opened in Windows");
        await render();
      } catch (err) {
        toast(err.message);
      }
    });
    root.querySelector("#btn-phone-url")?.addEventListener("click", async () => {
      const url = window.prompt("URL to open on paired phone");
      if (!url) return;
      try {
        const res = await window.OsBridge.invoke("pair.openUrl", { url });
        toast(res.devices ? `Sent to ${res.devices} device(s)` : "No phone connected");
      } catch (err) {
        toast(err.message);
      }
    });
  }

  return {
    async mount(el) {
      root = el;
      if (!unsub && window.myApp?.onEvent) {
        unsub = window.myApp.onEvent((data) => {
          if (!data) return;
          if (data.type === "clipboard-from-device") void render();
        });
      }
      await render();
    },
    refresh: render,
    scan: render,
  };
})();