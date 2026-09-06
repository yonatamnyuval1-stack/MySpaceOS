window.ContractPages = window.ContractPages || {};

window.ContractPages.editor = (function () {
  const { escapeHtml, invoke } = window.Contracts;
  const page = document.getElementById("page-editor");
  let contract = null;
  let template = null;

  async function load(id, templateId) {
    page.classList.add("loading");
    try {
      if (id) {
        const res = await invoke("contracts.get", { id });
        contract = res.contract;
        template = res.template;
      } else if (templateId) {
        const res = await invoke("templates.get", { id: templateId });
        template = res.template;
        const today = new Date().toISOString().slice(0, 10);
        const fieldValues = {};
        for (const f of template.fields) {
          fieldValues[f.key] = f.default || (f.type === "date" && f.key === "effective_date" ? today : "");
        }
        if (template.defaultExpiryMonths > 0) {
          const d = new Date(`${today}T12:00:00`);
          d.setMonth(d.getMonth() + template.defaultExpiryMonths);
          fieldValues.expiry_date = d.toISOString().slice(0, 10);
        }
        contract = {
          id: null,
          templateId: template.id,
          title: template.title,
          fieldValues,
          expiryDate: fieldValues.expiry_date || "",
          status: "draft",
          signatures: [],
        };
      }
      renderForm();
      page.querySelector("#editor-error").hidden = true;
    } catch (err) {
      page.querySelector("#editor-error").textContent = err.message;
      page.querySelector("#editor-error").hidden = false;
    } finally {
      page.classList.remove("loading");
    }
  }

  function renderForm() {
    if (!template || !contract) return;
    page.querySelector("#editor-title-input").value = contract.title;
    const fieldsEl = page.querySelector("#editor-fields");
    fieldsEl.innerHTML = template.fields
      .map((f) => {
        const val = contract.fieldValues[f.key] ?? "";
        const req = f.required ? " required" : "";
        if (f.type === "textarea") {
          const rows = f.rows || 4;
          const wide = template.documentKind === "record" ? " field-block--wide" : "";
          return `<label class="field-block${wide}">
            <span>${escapeHtml(f.label)}${f.required ? " *" : ""}</span>
            <textarea class="field-input field-textarea" data-key="${escapeHtml(f.key)}" rows="${rows}"${req}>${escapeHtml(val)}</textarea>
          </label>`;
        }
        const type = f.type === "date" ? "date" : "text";
        return `<label class="field-block">
          <span>${escapeHtml(f.label)}${f.required ? " *" : ""}</span>
          <input type="${type}" class="field-input" data-key="${escapeHtml(f.key)}" value="${escapeHtml(val)}"${req} />
        </label>`;
      })
      .join("");
  }

  function collectValues() {
    const fieldValues = { ...contract.fieldValues };
    page.querySelectorAll("#editor-fields [data-key]").forEach((el) => {
      fieldValues[el.dataset.key] = el.value.trim();
    });
    return fieldValues;
  }

  async function save() {
    const fieldValues = collectValues();
    const payload = {
      ...contract,
      title: page.querySelector("#editor-title-input").value.trim() || template.title,
      fieldValues,
      expiryDate: fieldValues.expiry_date || contract.expiryDate,
      signatures: contract.signatures || [],
    };
    const res = await invoke("contracts.save", { contract: payload });
    contract = res.contract;
    return contract;
  }

  function bind() {
    page.querySelector("#editor-back")?.addEventListener("click", () => window.ContractsApp.setPage("library"));
    page.querySelector("#btn-save-contract")?.addEventListener("click", async () => {
      try {
        await save();
        page.querySelector("#editor-saved").hidden = false;
        setTimeout(() => {
          page.querySelector("#editor-saved").hidden = true;
        }, 2000);
      } catch (err) {
        page.querySelector("#editor-error").textContent = err.message;
        page.querySelector("#editor-error").hidden = false;
      }
    });
    page.querySelector("#btn-preview-contract")?.addEventListener("click", async () => {
      const c = await save();
      window.ContractsApp.openDocument(c.id);
    });
  }

  function activate(arg) {
    if (typeof arg === "string") {
      load(arg, null);
      return;
    }
    load(arg?.id || null, arg?.templateId || null);
  }

  return { id: "editor", page, scan: () => {}, bind, activate };
})();
