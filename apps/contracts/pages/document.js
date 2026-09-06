window.ContractPages = window.ContractPages || {};

window.ContractPages.document = (function () {
  const { escapeHtml, invoke, statusLabel, statusClass } = window.Contracts;
  const page = document.getElementById("page-document");
  let contractId = "";
  let contract = null;
  let template = null;
  const pads = new Map();

  async function load(id) {
    contractId = id;
    page.classList.add("loading");
    pads.clear();
    try {
      const res = await invoke("contracts.get", { id });
      contract = res.contract;
      template = res.template;
      renderDocument(res.rendered, contract, template);
      page.querySelector("#document-error").hidden = true;
    } catch (err) {
      page.querySelector("#document-error").textContent = err.message;
      page.querySelector("#document-error").hidden = false;
    } finally {
      page.classList.remove("loading");
    }
  }

  function renderDocument(rendered, c, tpl) {
    page.querySelector("#doc-status").className = `status-pill ${statusClass(c.status)}`;
    page.querySelector("#doc-status").textContent = statusLabel(c.status);
    page.querySelector("#doc-title").textContent = rendered.title;
    const kindLabel = rendered.documentKind === "record" ? "Formal record" : tpl.category;
    page.querySelector("#doc-meta").textContent = `${kindLabel} · Dated ${c.fieldValues.effective_date || "—"}${c.expiryDate ? ` · Review by ${c.expiryDate}` : ""}`;
    const isRecord = rendered.documentKind === "record";
    page.querySelector("#legal-document")?.classList.toggle("legal-document--record", isRecord);
    const wm = page.querySelector(".legal-watermark");
    if (wm) wm.textContent = isRecord ? "OFFICIAL RECORD" : "OFFICIAL DOCUMENT";

    page.querySelector("#doc-clauses").innerHTML = rendered.clauses
      .map((cl) => {
        const heading = cl.n ? `${escapeHtml(cl.n)}. ${escapeHtml(cl.title)}` : escapeHtml(cl.title);
        const bodyClass = cl.freeform ? "clause-body clause-body--freeform" : "clause-body";
        return `<section class="clause ${cl.freeform ? "clause--freeform" : ""}">
          <h3 class="clause-n">${heading}</h3>
          <p class="${bodyClass}">${escapeHtml(cl.body)}</p>
        </section>`;
      })
      .join("");

    const sigEl = page.querySelector("#doc-signatures");
    sigEl.innerHTML = tpl.signatures
      .map((slot) => {
        const existing = c.signatures.find((s) => s.slotId === slot.id);
        const name = existing?.name || c.fieldValues[slot.nameField] || "";
        const signed = existing?.signedAt && existing?.imageData;
        const optionalTag = slot.optional ? ' <span class="sig-optional">(optional)</span>' : "";
        return `<div class="sig-block" data-slot="${escapeHtml(slot.id)}">
          <h4>${escapeHtml(slot.label)}${optionalTag}</h4>
          ${signed ? `<div class="sig-done"><img src="${existing.imageData}" alt="Signature" /><p>Signed ${new Date(existing.signedAt).toLocaleString()} · ${escapeHtml(name)}</p></div>` : `
          <input type="text" class="field-input sig-name" placeholder="Full legal name" value="${escapeHtml(name)}" data-name="${escapeHtml(slot.id)}" />
          <canvas class="sig-canvas" width="320" height="100" data-canvas="${escapeHtml(slot.id)}"></canvas>
          <div class="sig-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-clear="${escapeHtml(slot.id)}">Clear</button>
            <button type="button" class="btn btn-primary btn-sm" data-sign="${escapeHtml(slot.id)}">Apply signature</button>
          </div>`}
        </div>`;
      })
      .join("");

    tpl.signatures.forEach((slot) => {
      const canvas = sigEl.querySelector(`[data-canvas="${slot.id}"]`);
      if (canvas) initCanvas(canvas, slot.id);
    });
  }

  function initCanvas(canvas, slotId) {
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = "#1a2744";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    let drawing = false;
    let last = null;

    function pos(e) {
      const r = canvas.getBoundingClientRect();
      const t = e.touches?.[0];
      const x = (t || e).clientX - r.left;
      const y = (t || e).clientY - r.top;
      return { x: (x / r.width) * canvas.width, y: (y / r.height) * canvas.height };
    }

    function start(e) {
      e.preventDefault();
      drawing = true;
      last = pos(e);
    }
    function move(e) {
      if (!drawing) return;
      e.preventDefault();
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
    }
    function end() {
      drawing = false;
    }

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    canvas.addEventListener("mouseup", end);
    canvas.addEventListener("mouseleave", end);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end);

    pads.set(slotId, { canvas, ctx });
  }

  function bind() {
    page.querySelector("#document-back")?.addEventListener("click", () => window.ContractsApp.setPage("library"));

    page.addEventListener("click", async (e) => {
      const clear = e.target.closest("[data-clear]");
      if (clear) {
        const pad = pads.get(clear.dataset.clear);
        if (pad) pad.ctx.clearRect(0, 0, pad.canvas.width, pad.canvas.height);
        return;
      }
      const sign = e.target.closest("[data-sign]");
      if (!sign || !contract) return;
      const slotId = sign.dataset.sign;
      const block = page.querySelector(`[data-slot="${slotId}"]`);
      const name = block.querySelector(".sig-name")?.value.trim();
      const canvas = block.querySelector(".sig-canvas");
      if (!name) {
        alert("Enter the signer's full legal name.");
        return;
      }
      const ctx = canvas.getContext("2d");
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const hasInk = pixels.some((v, i) => i % 4 === 3 && v > 0);
      if (!hasInk) {
        alert("Draw your signature on the canvas first.");
        return;
      }
      const imageData = canvas.toDataURL("image/png");
      const signatures = [...(contract.signatures || [])].filter((s) => s.slotId !== slotId);
      signatures.push({ slotId, name, signedAt: new Date().toISOString(), imageData });
      contract.signatures = signatures;
      await invoke("contracts.save", { contract });
      load(contractId);
    });
  }

  function activate(id) {
    load(id);
  }

  return { id: "document", page, scan: () => {}, bind, activate };
})();
