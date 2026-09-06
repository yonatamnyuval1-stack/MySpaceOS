(function (root) {
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function cssAttrEscape(s) {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(s);
    return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function ensureRoot(htmlOrEl) {
    if (htmlOrEl && htmlOrEl.nodeType === 1) return { root: htmlOrEl, isLive: true };
    const root = document.createElement("div");
    root.innerHTML = typeof htmlOrEl === "string" ? htmlOrEl : "";
    return { root, isLive: false };
  }

  function slotLabel(el) {
    const labeled = el.getAttribute("data-slot-label");
    if (labeled) return labeled;
    const type = el.getAttribute("data-slot-type") || "text";
    const ph = el.getAttribute("data-placeholder");
    if (ph) return ph;
    const map = {
      image: "Image",
      title: "Title",
      list: "List",
      quote: "Quote",
      subtitle: "Subtitle",
      thesis: "Thesis",
      heading: "Heading",
      lead: "Lead",
      body: "Body text",
    };
    return map[type] || type;
  }

  function currentValue(el) {
    const type = el.getAttribute("data-slot-type") || "text";
    if (type === "image") {
      const img = el.querySelector("[data-slot-role='img']");
      const cap = el.querySelector("[data-slot-role='caption']");
      const ph = el.querySelector("[data-slot-role='placeholder']");
      return {
        url: img && !img.hidden ? img.getAttribute("src") || "" : "",
        caption: (cap?.textContent || "").trim(),
        placeholder: (ph?.textContent || "").trim(),
      };
    }
    if (type === "list") {
      return Array.from(el.querySelectorAll(":scope > li"))
        .map((li) => (li.textContent || "").trim())
        .filter(Boolean);
    }
    return (el.textContent || "").trim();
  }

  function extractSlots(htmlOrEl) {
    const { root } = ensureRoot(htmlOrEl);
    const slots = [];
    const seen = new Set();

    root.querySelectorAll("[data-slot-type]").forEach((el) => {
      if (el.getAttribute("data-slot-role") === "caption") return;
      if (el.tagName === "LI" && el.parentElement?.getAttribute("data-slot-type") === "list") return;
      if (el.closest("figcaption") && el.getAttribute("data-slot-type") === "text") return;

      let id = el.getAttribute("data-slot-id");
      if (!id) {
        id = `slot_${slots.length + 1}_${Math.random().toString(36).slice(2, 7)}`;
        el.setAttribute("data-slot-id", id);
      }
      if (seen.has(id)) return;
      seen.add(id);

      slots.push({
        id,
        type: el.getAttribute("data-slot-type") || "text",
        role: el.getAttribute("data-slot-role") || null,
        label: slotLabel(el),
        current: currentValue(el),
      });
    });

    return { slots, html: root.innerHTML };
  }

  function setText(el, value) {
    const text = String(value ?? "");
    if (el.tagName === "UL" || el.tagName === "OL" || el.getAttribute("data-slot-type") === "list") {
      const items = Array.isArray(value)
        ? value.map(String)
        : text
            .split(/\n/)
            .map((s) => s.replace(/^[-•*\d.)\s]+/, "").trim())
            .filter(Boolean);
      el.innerHTML = (items.length ? items : [""]).map((t) => `<li>${escapeHtml(t)}</li>`).join("");
      return;
    }
    if (el.getAttribute("data-slot-type") === "quote") {
      const p = el.querySelector("p") || el;
      p.textContent = text;
      return;
    }
    el.textContent = text;
  }

  function isAllowedImageUrl(url) {
    return /^(https?:\/\/|data:image\/)/i.test(String(url || "").trim());
  }

  function applyImageFill(el, fill) {
    const img = el.querySelector("[data-slot-role='img']");
    const ph = el.querySelector("[data-slot-role='placeholder']");
    const cap = el.querySelector("[data-slot-role='caption']");
    const caption = fill.caption || fill.alt || "";
    const alt = fill.alt || caption || fill.description || fill.visual?.subject || "Image";
    let url = String(fill.url || fill.value || "").trim();
    if (url && !isAllowedImageUrl(url)) url = "";
    if (url && img) {
      img.src = url;
      img.alt = alt;
      img.hidden = false;
      if (ph) ph.hidden = true;
      el.classList.add("has-image");
      if (fill.imageMeta?.placeholder) el.classList.add("is-image-placeholder");
      else el.classList.remove("is-image-placeholder");
    } else if (ph && (fill.description || caption || fill.visual?.subject)) {
      ph.textContent = fill.description || caption || fill.visual?.subject;
      ph.hidden = false;
      if (img) img.hidden = true;
      el.classList.remove("has-image");
      el.classList.remove("is-image-placeholder");
    }
    if (cap && caption) cap.textContent = caption;
  }

  function setLocalImage(el, dataUrl, meta) {
    if (!el) return false;
    applyImageFill(el, {
      url: dataUrl,
      caption: meta?.caption,
      alt: meta?.alt || meta?.caption || "Uploaded image",
    });
    el.classList.add("tpl-slot--filled");
    return true;
  }

  function applySlotFills(htmlOrEl, fills) {
    const { root } = ensureRoot(htmlOrEl);
    const list = Array.isArray(fills) ? fills : [];
    let applied = 0;
    for (const fill of list) {
      const id = fill?.id || fill?.slot;
      if (!id) continue;
      const el = root.querySelector(`[data-slot-id="${cssAttrEscape(String(id))}"]`);
      if (!el) continue;
      const type = el.getAttribute("data-slot-type") || fill.type || "text";
      if (type === "image") applyImageFill(el, fill);
      else if (type === "list") setText(el, fill.items || fill.value || fill.text);
      else setText(el, fill.value ?? fill.text ?? "");
      el.classList.add("tpl-slot--filled");
      applied += 1;
    }
    return { html: root.innerHTML, applied };
  }

  function inventoryPrompt(slots, docTitle) {
    const lines = (slots || []).map((s, i) => {
      let cur = "";
      if (typeof s.current === "string") cur = s.current.slice(0, 100);
      else if (Array.isArray(s.current)) cur = s.current.join("; ").slice(0, 100);
      else if (s.current && typeof s.current === "object") cur = JSON.stringify(s.current).slice(0, 100);
      return `${i + 1}. id="${s.id}" type=${s.type} label="${s.label}" current=${JSON.stringify(cur)}`;
    });
    return `Document title: ${docTitle || "Untitled"}\nFillable slots (${slots.length}):\n${lines.join("\n") || "(none)"}`;
  }

  function applyFillsByRole(htmlOrEl, fillsByRole) {
    const { root } = ensureRoot(htmlOrEl);
    const map = fillsByRole && typeof fillsByRole === "object" ? fillsByRole : {};
    const aliases = {
      body: ["main", "content", "text", "article", "paragraph"],
      lead: ["intro", "deck", "summary", "blurb"],
      subtitle: ["subhead", "tagline", "kicker"],
      hero: ["image", "img", "photo", "cover", "visual", "diagram"],
      image: ["hero", "img", "photo", "visual", "diagram"],
      list: ["bullets", "items", "points", "keypoints"],
      title: ["heading", "headline", "h1", "name"],
    };

    function resolveRoleValue(role) {
      if (map[role] != null) return map[role];
      for (const alt of aliases[role] || []) {
        if (map[alt] != null) return map[alt];
      }
      return null;
    }

    const fills = [];
    root.querySelectorAll("[data-slot-type]").forEach((el) => {
      if (el.getAttribute("data-slot-role") === "caption") return;
      if (el.tagName === "LI" && el.parentElement?.getAttribute("data-slot-type") === "list") return;
      const role = el.getAttribute("data-slot-role") || el.getAttribute("data-slot-type");
      if (!role) return;
      const raw = resolveRoleValue(role);
      if (raw == null) return;
      let id = el.getAttribute("data-slot-id");
      if (!id) {
        id = `slot_${Math.random().toString(36).slice(2, 9)}`;
        el.setAttribute("data-slot-id", id);
      }
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        fills.push({ id, type: el.getAttribute("data-slot-type"), ...raw });
      } else if (Array.isArray(raw)) {
        fills.push({ id, type: "list", items: raw });
      } else {
        fills.push({ id, type: el.getAttribute("data-slot-type") || "text", value: String(raw) });
      }
    });
    return applySlotFills(root, fills);
  }

  root.StudiesSlots = {
    extractSlots,
    applySlotFills,
    applyFillsByRole,
    applyImageFill,
    setLocalImage,
    inventoryPrompt,
  };
})(window);