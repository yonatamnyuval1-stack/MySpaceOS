(function () {
  let overlay = null;

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.className = "modal-overlay hidden";
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <header class="modal-header">
          <h2 class="modal-title"></h2>
          <button type="button" class="modal-close" aria-label="Close">×</button>
        </header>
        <div class="modal-body"></div>
        <footer class="modal-footer"></footer>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector(".modal-close").addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !overlay.classList.contains("hidden")) close();
    });

    return overlay;
  }

  function close() {
    overlay?.classList.add("hidden");
  }

  function open({ title, bodyHtml, footerButtons, wide = false }) {
    const el = ensureOverlay();
    el.querySelector(".modal").classList.toggle("modal--wide", wide);
    el.querySelector(".modal-title").textContent = title;
    el.querySelector(".modal-body").innerHTML = bodyHtml;

    const footer = el.querySelector(".modal-footer");
    footer.replaceChildren();

    footerButtons.forEach((btn) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `btn ${btn.primary ? "btn-primary" : "btn-secondary"}${btn.danger ? " btn-danger" : ""}`;
      b.textContent = btn.label;
      b.addEventListener("click", () => {
        const result = btn.onClick?.();
        if (result !== false) close();
      });
      footer.appendChild(b);
    });

    el.classList.remove("hidden");
    const firstInput = el.querySelector("input, select, textarea");
    firstInput?.focus();
  }

  function formField(label, id, options = {}) {
    const { type = "text", value = "", placeholder = "", hint = "", rows, options: selectOptions } = options;
    const inputTag =
      type === "select"
        ? `<select id="${id}" class="field-input">${selectOptions
            .map((o) => `<option value="${o.value}"${o.value === value ? " selected" : ""}>${o.label}</option>`)
            .join("")}</select>`
        : type === "textarea"
          ? `<textarea id="${id}" class="field-input" rows="${rows || 3}" placeholder="${placeholder}">${value}</textarea>`
          : `<input id="${id}" class="field-input" type="${type}" value="${value}" placeholder="${placeholder}" />`;

    return `
      <label class="field" for="${id}">
        <span class="field-label">${label}</span>
        ${inputTag}
        ${hint ? `<span class="field-hint">${hint}</span>` : ""}
      </label>
    `;
  }

  function readAppForm(prefix = "") {
    const type = document.getElementById(`${prefix}app-type`).value;
    const pathsRaw = document.getElementById(`${prefix}app-paths`)?.value?.trim();
    const inAppUrl = document.getElementById(`${prefix}app-in-app-url`)?.value?.trim();
    return {
      name: document.getElementById(`${prefix}app-name`).value,
      type,
      url: document.getElementById(`${prefix}app-url`)?.value,
      paths: pathsRaw ? pathsRaw.split("\n").map((p) => p.trim()).filter(Boolean) : [],
      inAppUrl: inAppUrl || "",
      description: document.getElementById(`${prefix}app-desc`).value,
      iconUrl: document.getElementById(`${prefix}app-icon-url`)?.value,
    };
  }

  function appFormHtml(app = {}, prefix = "") {
    const type = app.type || "external";
    const paths = (app.paths || (app.path ? [app.path] : [])).join("\n");

    return `
      ${formField("Name", `${prefix}app-name`, { value: app.name || "", placeholder: "Docker Desktop" })}
      ${formField("Type", `${prefix}app-type`, {
        type: "select",
        value: type,
        options: [
          { value: "external", label: "Program (.exe)" },
          { value: "url", label: "Website" },
        ],
      })}
      <div id="${prefix}field-url" class="field-group${type === "url" ? "" : " hidden"}">
        ${formField("URL", `${prefix}app-url`, { value: app.url || "", placeholder: "https://github.com" })}
      </div>
      <div id="${prefix}field-paths" class="field-group${type === "external" ? "" : " hidden"}">
        ${formField("Program path(s)", `${prefix}app-paths`, {
          type: "textarea",
          value: paths,
          placeholder: "C:\\Program Files\\App\\app.exe",
          hint: "One path per line. First existing path wins.",
          rows: 3,
        })}
      </div>
      <div id="${prefix}field-in-app-url" class="field-group${type === "external" ? "" : " hidden"}">
        ${formField("Open inside My Space (URL)", `${prefix}app-in-app-url`, {
          value: app.inAppUrl || "",
          placeholder: "http://localhost:9000",
          hint: "Optional. Localhost only (http://localhost:9000). ",
        })}
      </div>
      ${formField("Description (optional)", `${prefix}app-desc`, { value: app.description || "" })}
      ${formField("Custom icon URL (optional)", `${prefix}app-icon-url`, {
        value: app.iconUrl || "",
        placeholder: "https://...",
      })}
    `;
  }

  function bindTypeToggle(prefix = "") {
    const select = document.getElementById(`${prefix}app-type`);
    const urlGroup = document.getElementById(`${prefix}field-url`);
    const pathsGroup = document.getElementById(`${prefix}field-paths`);
    const inAppUrlGroup = document.getElementById(`${prefix}field-in-app-url`);
    const sync = () => {
      const isUrl = select.value === "url";
      urlGroup?.classList.toggle("hidden", !isUrl);
      pathsGroup?.classList.toggle("hidden", isUrl);
      inAppUrlGroup?.classList.toggle("hidden", isUrl);
    };
    select?.addEventListener("change", sync);
    sync();
  }

  function openAddApp(onSave) {
    open({
      title: "Add shortcut",
      bodyHtml: appFormHtml({}, "add-"),
      footerButtons: [
        { label: "Cancel", onClick: () => false },
        {
          label: "Add",
          primary: true,
          onClick: () => {
            const data = readAppForm("add-");
            if (!data.name.trim()) {
              alert("Name is required.");
              return false;
            }
            if (data.type === "url" && !data.url?.trim()) {
              alert("URL is required.");
              return false;
            }
            if (data.type === "external" && !data.paths.length) {
              alert("At least one program path is required.");
              return false;
            }
            onSave(data);
          },
        },
      ],
    });
    bindTypeToggle("add-");
  }

  function openEditApp(app, onSave) {
    open({
      title: `Edit — ${app.name}`,
      bodyHtml: appFormHtml(app, "edit-"),
      footerButtons: [
        { label: "Cancel", onClick: () => false },
        {
          label: "Save",
          primary: true,
          onClick: () => {
            const data = readAppForm("edit-");
            if (!data.name.trim()) {
              alert("Name is required.");
              return false;
            }
            if (app.type === "url" && !data.url?.trim()) {
              alert("URL is required.");
              return false;
            }
            if (app.type === "external" && !data.paths.length) {
              alert("At least one program path is required.");
              return false;
            }
            onSave(data);
          },
        },
      ],
    });
    bindTypeToggle("edit-");
    if (app.type === "builtin") {
      document.getElementById("edit-app-type")?.closest(".field")?.classList.add("hidden");
      document.getElementById("edit-field-url")?.classList.add("hidden");
      document.getElementById("edit-field-paths")?.classList.add("hidden");
      document.getElementById("edit-field-in-app-url")?.classList.add("hidden");
    }
  }

  function openConfirm({ title, message, confirmLabel = "Confirm", danger }, onConfirm) {
    open({
      title,
      bodyHtml: `<p class="modal-message">${message}</p>`,
      footerButtons: [
        { label: "Cancel", onClick: () => false },
        {
          label: confirmLabel,
          primary: true,
          danger,
          onClick: () => onConfirm(),
        },
      ],
    });
  }

  function openSettings({ settings, onSave, onResetLayout, onExport, onImport, onResetAll }) {
    open({
      title: "Settings",
      bodyHtml: `
        ${formField("Desktop title", "set-title", { value: settings.title })}
        ${formField("Subtitle", "set-subtitle", { value: settings.subtitle })}
        <div class="settings-actions">
          <button type="button" class="btn btn-secondary btn-block" id="set-reset-layout">Reset icon positions</button>
          <button type="button" class="btn btn-secondary btn-block" id="set-export">Export configuration</button>
          <label class="btn btn-secondary btn-block file-btn">
            Import configuration
            <input type="file" id="set-import" accept="application/json" hidden />
          </label>
          <button type="button" class="btn btn-danger btn-block" id="set-reset-all">Reset to defaults</button>
        </div>
      `,
      footerButtons: [
        { label: "Close", onClick: () => false },
        {
          label: "Save",
          primary: true,
          onClick: () => {
            onSave({
              title: document.getElementById("set-title").value,
              subtitle: document.getElementById("set-subtitle").value,
            });
          },
        },
      ],
    });

    document.getElementById("set-reset-layout")?.addEventListener("click", () => {
      close();
      onResetLayout();
    });
    document.getElementById("set-export")?.addEventListener("click", onExport);
    document.getElementById("set-import")?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) onImport(file);
    });
    document.getElementById("set-reset-all")?.addEventListener("click", () => {
      close();
      onResetAll();
    });
  }

  window.MySpaceModals = {
    open,
    openAddApp,
    openEditApp,
    openConfirm,
    openSettings,
    close,
  };
})();