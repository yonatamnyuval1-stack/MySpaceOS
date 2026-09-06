(function (root) {
  const STYLE_ID = "msl-icon-picker-styles";

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const link = document.createElement("link");
    link.id = STYLE_ID;
    link.rel = "stylesheet";
    link.href = "../shared/msl-icon-picker.css";
    document.head.appendChild(link);
  }

  function open(options = {}) {
    ensureStyles();
    const selectedId = String(options.selectedId || "").trim();
    const title = options.title || "Choose icon";

    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "msl-icon-picker-overlay";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.innerHTML = `
        <div class="msl-icon-picker-card">
          <header class="msl-icon-picker-head">
            <h3>${escapeHtml(title)}</h3>
            <button type="button" class="msl-icon-picker-close" aria-label="Close">✕</button>
          </header>
          <div class="msl-icon-picker-toolbar">
            <input type="search" class="msl-icon-picker-search" placeholder="Search icons…" autocomplete="off" />
            <span class="msl-icon-picker-meta"></span>
          </div>
          <div class="msl-icon-picker-grid" aria-live="polite"></div>
          <footer class="msl-icon-picker-foot">
            <button type="button" class="msl-icon-picker-btn ghost" data-act="clear">Clear library icon</button>
            <button type="button" class="msl-icon-picker-btn ghost" data-act="cancel">Cancel</button>
            <button type="button" class="msl-icon-picker-btn primary" data-act="confirm" disabled>Use icon</button>
          </footer>
        </div>`;

      const searchEl = overlay.querySelector(".msl-icon-picker-search");
      const gridEl = overlay.querySelector(".msl-icon-picker-grid");
      const metaEl = overlay.querySelector(".msl-icon-picker-meta");
      const confirmBtn = overlay.querySelector('[data-act="confirm"]');

      let current = selectedId ? { id: selectedId } : null;
      let timer = null;
      let closed = false;

      function finish(value) {
        if (closed) return;
        closed = true;
        overlay.remove();
        document.removeEventListener("keydown", onKey);
        resolve(value);
      }

      function onKey(e) {
        if (e.key === "Escape") finish(null);
      }

      function select(icon) {
        current = icon;
        gridEl.querySelectorAll(".msl-icon-picker-item").forEach((el) => {
          el.classList.toggle("is-active", el.dataset.id === icon?.id);
        });
        confirmBtn.disabled = !icon?.id;
      }

      async function runSearch(q) {
        gridEl.innerHTML = `<p class="msl-icon-picker-empty">Searching…</p>`;
        try {
          if (!root.Msl?.invoke) throw new Error("MSL not available");
          const res = await root.Msl.invoke("icons.search", {
            q,
            limit: 72,
            size: 28,
            color: "currentColor",
          });
          if (!res?.ok) throw new Error(res?.error || "Search failed");
          const icons = res.icons || [];
          metaEl.textContent = icons.length ? `${icons.length} shown` : "No matches";
          if (!icons.length) {
            gridEl.innerHTML = `<p class="msl-icon-picker-empty">No icons match “${escapeHtml(q)}”.</p>`;
            return;
          }
          gridEl.innerHTML = icons
            .map(
              (icon) => `<button type="button" class="msl-icon-picker-item ${
                current?.id === icon.id ? "is-active" : ""
              }" data-id="${escapeHtml(icon.id)}" title="${escapeHtml(icon.name || icon.id)}">
                <span class="msl-icon-picker-svg">${icon.svg || ""}</span>
                <span class="msl-icon-picker-label">${escapeHtml(icon.id)}</span>
              </button>`
            )
            .join("");
          gridEl.querySelectorAll(".msl-icon-picker-item").forEach((btn) => {
            btn.addEventListener("click", () => {
              const icon = icons.find((i) => i.id === btn.dataset.id);
              if (icon) select(icon);
            });
            btn.addEventListener("dblclick", () => {
              const icon = icons.find((i) => i.id === btn.dataset.id);
              if (icon) finish(icon);
            });
          });
          if (current?.id) {
            const found = icons.find((i) => i.id === current.id);
            if (found) select(found);
          }
        } catch (err) {
          metaEl.textContent = "";
          gridEl.innerHTML = `<p class="msl-icon-picker-empty">${escapeHtml(err.message || String(err))}</p>`;
        }
      }

      overlay.querySelector(".msl-icon-picker-close").addEventListener("click", () => finish(null));
      overlay.querySelector('[data-act="cancel"]').addEventListener("click", () => finish(null));
      overlay.querySelector('[data-act="clear"]').addEventListener("click", () => finish({ id: "", clear: true }));
      confirmBtn.addEventListener("click", () => {
        if (current?.id) finish(current);
      });
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) finish(null);
      });
      searchEl.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(() => runSearch(searchEl.value), 180);
      });

      document.body.appendChild(overlay);
      document.addEventListener("keydown", onKey);
      confirmBtn.disabled = !selectedId;
      searchEl.focus();
      runSearch("");
    });
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  root.MslIconPicker = { open };
})(typeof window !== "undefined" ? window : globalThis);
