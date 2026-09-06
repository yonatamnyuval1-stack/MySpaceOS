(function (root) {
  let slotSeq = 0;

  function nextSlotId(prefix) {
    slotSeq += 1;
    return `${prefix || "slot"}_${Date.now().toString(36)}_${slotSeq}`;
  }

  function stampIds(html) {
    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    wrap.querySelectorAll("[data-slot-type]").forEach((el) => {
      if (!el.getAttribute("data-slot-id")) {
        const type = el.getAttribute("data-slot-type") || "text";
        el.setAttribute("data-slot-id", nextSlotId(type));
      }
    });
    return wrap.innerHTML;
  }

  function img(label, role) {
    const r = role || "image";
    const safe = String(label || "Image").replace(/"/g, "&quot;");
    return `<figure class="tpl-slot tpl-slot--image" data-slot-type="image" data-slot-role="${r}" data-slot-label="${safe}" contenteditable="false" title="Click to choose an image from your files">
  <div class="tpl-slot-media">
    <div class="tpl-slot-placeholder" data-slot-role="placeholder">${safe} · click to upload</div>
    <img class="tpl-slot-img" data-slot-role="img" alt="" hidden />
  </div>
  <figcaption class="tpl-slot-caption" data-slot-role="caption" contenteditable="true" data-slot-type="text" data-slot-label="Caption">Caption</figcaption>
</figure>`;
  }

  function txt(tag, type, label, role) {
    const t = tag || "p";
    const safe = String(label || "").replace(/"/g, "&quot;");
    return `<${t} class="tpl-slot tpl-slot--text" data-slot-type="${type || "text"}" data-slot-role="${role || type || "text"}" data-slot-label="${safe}" data-placeholder="${safe}"></${t}>`;
  }

  function list(label, role, n) {
    const count = n || 3;
    const items = Array.from({ length: count }, () => "<li></li>").join("");
    return `<ul class="tpl-slot tpl-slot--list" data-slot-type="list" data-slot-role="${role || "list"}" data-slot-label="${label || "List"}">${items}</ul>`;
  }

  const PAGE_TEMPLATES = [
    {
      id: "blank",
      name: "Blank",
      icon: "▢",
      category: "Basic",
      description: "Empty page — insert layout blocks freely",
      preview: ["full"],
      html: () => "<p><br></p>",
    },
    {
      id: "cover",
      name: "Cover page",
      icon: "▣",
      category: "Print / poster",
      description: "Full-bleed image on top, title and subtitle centered below",
      preview: ["hero", "title", "sub"],
      html: () => `<div class="tpl-page tpl-page--cover">
  <div class="tpl-region tpl-region--hero">${img("Cover image", "hero")}</div>
  <div class="tpl-region tpl-region--cover-text">
    ${txt("h1", "title", "Cover title", "title")}
    ${txt("p", "subtitle", "Subtitle or date", "subtitle")}
  </div>
</div>`,
    },
    {
      id: "feature-left",
      name: "Feature — image left",
      icon: "◧",
      category: "Feature",
      description: "Large image on the left (~55%), headline + body on the right",
      preview: ["split-img-text"],
      html: () => `<div class="tpl-page tpl-page--feature tpl-page--feature-left">
  <div class="tpl-region tpl-region--media">${img("Feature image", "feature")}</div>
  <div class="tpl-region tpl-region--copy">
    ${txt("h1", "title", "Headline", "title")}
    ${txt("p", "lead", "Lead / dek", "lead")}
    ${txt("p", "body", "Body paragraph", "body")}
  </div>
</div>`,
    },
    {
      id: "feature-right",
      name: "Feature — image right",
      icon: "◨",
      category: "Feature",
      description: "Headline + body on the left, large image on the right",
      preview: ["split-text-img"],
      html: () => `<div class="tpl-page tpl-page--feature tpl-page--feature-right">
  <div class="tpl-region tpl-region--copy">
    ${txt("h1", "title", "Headline", "title")}
    ${txt("p", "lead", "Lead / dek", "lead")}
    ${txt("p", "body", "Body paragraph", "body")}
  </div>
  <div class="tpl-region tpl-region--media">${img("Feature image", "feature")}</div>
</div>`,
    },
    {
      id: "banner-columns",
      name: "Banner + 2 columns",
      icon: "▤",
      category: "Article",
      description: "Wide image banner, then two equal text columns underneath",
      preview: ["banner", "cols2"],
      html: () => `<div class="tpl-page tpl-page--banner-cols">
  <div class="tpl-region tpl-region--banner">${img("Banner image", "banner")}</div>
  ${txt("h1", "title", "Article title", "title")}
  <div class="tpl-region tpl-region--cols2">
    <div class="tpl-col">${txt("p", "body", "Left column", "col-left")}</div>
    <div class="tpl-col">${txt("p", "body", "Right column", "col-right")}</div>
  </div>
</div>`,
    },
    {
      id: "sidebar",
      name: "Main + sidebar",
      icon: "▥",
      category: "Article",
      description: "Wide main story on the left, narrow sidebar (image + notes) on the right",
      preview: ["main-side"],
      html: () => `<div class="tpl-page tpl-page--sidebar">
  <div class="tpl-region tpl-region--main">
    ${txt("h1", "title", "Story title", "title")}
    ${txt("p", "lead", "Introduction", "lead")}
    ${txt("p", "body", "Main body", "body")}
    ${txt("p", "body", "Continue…", "body-2")}
  </div>
  <aside class="tpl-region tpl-region--aside">
    ${img("Sidebar image", "aside-image")}
    ${txt("h3", "heading", "Sidebar heading", "aside-title")}
    ${list("Sidebar notes", "aside-list", 3)}
  </aside>
</div>`,
    },
    {
      id: "gallery-3",
      name: "Photo strip",
      icon: "▦",
      category: "Gallery",
      description: "Three images in a row, caption strip, then body text",
      preview: ["gallery3", "text"],
      html: () => `<div class="tpl-page tpl-page--gallery3">
  ${txt("h1", "title", "Gallery title", "title")}
  <div class="tpl-region tpl-region--gallery3">
    ${img("Photo 1", "photo-1")}
    ${img("Photo 2", "photo-2")}
    ${img("Photo 3", "photo-3")}
  </div>
  ${txt("p", "body", "Story under the photos", "body")}
</div>`,
    },
    {
      id: "magazine-spread",
      name: "Magazine spread",
      icon: "📰",
      category: "Magazine",
      description: "Hero image, pull-quote, then image+text and text+image rows",
      preview: ["hero", "quote", "split-img-text", "split-text-img"],
      html: () => `<div class="tpl-page tpl-page--magazine">
  <div class="tpl-region tpl-region--hero">${img("Lead photo", "hero")}</div>
  ${txt("h1", "title", "Spread headline", "title")}
  ${txt("p", "lead", "Deck / summary", "lead")}
  <blockquote class="tpl-slot tpl-slot--quote tpl-region--pullquote" data-slot-type="quote" data-slot-role="pullquote" data-slot-label="Pull quote">
    <p data-slot-type="text" data-slot-role="quote-text" data-slot-label="Quote"></p>
    <cite data-slot-type="text" data-slot-role="quote-source" data-slot-label="Source"></cite>
  </blockquote>
  <div class="tpl-region tpl-region--row-media-copy">
    <div class="tpl-col tpl-col--media">${img("Inset photo", "inset-1")}</div>
    <div class="tpl-col tpl-col--copy">${txt("p", "body", "Column text beside image", "body-1")}</div>
  </div>
  <div class="tpl-region tpl-region--row-copy-media">
    <div class="tpl-col tpl-col--copy">${txt("p", "body", "Column text beside image", "body-2")}</div>
    <div class="tpl-col tpl-col--media">${img("Inset photo", "inset-2")}</div>
  </div>
</div>`,
    },
    {
      id: "profile",
      name: "Profile / bio",
      icon: "👤",
      category: "People",
      description: "Portrait on the left, name and biography on the right",
      preview: ["profile"],
      html: () => `<div class="tpl-page tpl-page--profile">
  <div class="tpl-region tpl-region--portrait">${img("Portrait", "portrait")}</div>
  <div class="tpl-region tpl-region--bio">
    ${txt("h1", "title", "Full name", "name")}
    ${txt("p", "subtitle", "Role / affiliation", "role")}
    ${txt("p", "body", "Biography", "bio")}
    ${list("Highlights", "highlights", 3)}
  </div>
</div>`,
    },
    {
      id: "comparison",
      name: "Compare two",
      icon: "⇔",
      category: "Study",
      description: "Two side-by-side panels: image, title, and points each",
      preview: ["compare"],
      html: () => `<div class="tpl-page tpl-page--compare">
  ${txt("h1", "title", "Comparison title", "title")}
  <div class="tpl-region tpl-region--compare">
    <div class="tpl-panel">
      ${img("Option A image", "a-image")}
      ${txt("h2", "heading", "Option A", "a-title")}
      ${list("Option A points", "a-list", 4)}
    </div>
    <div class="tpl-panel">
      ${img("Option B image", "b-image")}
      ${txt("h2", "heading", "Option B", "b-title")}
      ${list("Option B points", "b-list", 4)}
    </div>
  </div>
</div>`,
    },
    {
      id: "process-3",
      name: "3-step process",
      icon: "①",
      category: "Study",
      description: "Three equal steps across the page: number, image, title, text",
      preview: ["steps3"],
      html: () => `<div class="tpl-page tpl-page--steps">
  ${txt("h1", "title", "Process title", "title")}
  <div class="tpl-region tpl-region--steps3">
    <div class="tpl-step">
      <div class="tpl-step-num" contenteditable="false">1</div>
      ${img("Step 1 visual", "step-1-image")}
      ${txt("h3", "heading", "Step 1", "step-1-title")}
      ${txt("p", "body", "Step 1 details", "step-1-body")}
    </div>
    <div class="tpl-step">
      <div class="tpl-step-num" contenteditable="false">2</div>
      ${img("Step 2 visual", "step-2-image")}
      ${txt("h3", "heading", "Step 2", "step-2-title")}
      ${txt("p", "body", "Step 2 details", "step-2-body")}
    </div>
    <div class="tpl-step">
      <div class="tpl-step-num" contenteditable="false">3</div>
      ${img("Step 3 visual", "step-3-image")}
      ${txt("h3", "heading", "Step 3", "step-3-title")}
      ${txt("p", "body", "Step 3 details", "step-3-body")}
    </div>
  </div>
</div>`,
    },
    {
      id: "worksheet",
      name: "Worksheet",
      icon: "☐",
      category: "Study",
      description: "Title, instructions, figure area, then answer lines",
      preview: ["title", "instr", "figure", "answers"],
      html: () => `<div class="tpl-page tpl-page--worksheet">
  ${txt("h1", "title", "Worksheet title", "title")}
  ${txt("p", "subtitle", "Course / date", "meta")}
  <div class="tpl-region tpl-region--instructions">
    <h2 contenteditable="false">Instructions</h2>
    ${txt("p", "body", "What the student should do", "instructions")}
  </div>
  <div class="tpl-region tpl-region--figure">${img("Figure / diagram", "figure")}</div>
  <div class="tpl-region tpl-region--answers">
    <h2 contenteditable="false">Answers</h2>
    ${txt("p", "body", "Answer 1", "answer-1")}
    ${txt("p", "body", "Answer 2", "answer-2")}
    ${txt("p", "body", "Answer 3", "answer-3")}
  </div>
</div>`,
    },
    {
      id: "poster",
      name: "Poster / flyer",
      icon: "🪧",
      category: "Print / poster",
      description: "Centered poster: title, hero image, key points, footer",
      preview: ["title", "hero", "bullets", "footer"],
      html: () => `<div class="tpl-page tpl-page--poster">
  ${txt("h1", "title", "Poster headline", "title")}
  <div class="tpl-region tpl-region--poster-hero">${img("Poster image", "hero")}</div>
  ${list("Key points", "points", 4)}
  ${txt("p", "subtitle", "Footer / call to action", "footer")}
</div>`,
    },
    {
      id: "lab-report",
      name: "Lab report page",
      icon: "🧪",
      category: "Study",
      description: "Header, objective, procedure, results figure, analysis",
      preview: ["header", "obj", "proc", "fig", "analysis"],
      html: () => `<div class="tpl-page tpl-page--lab">
  ${txt("h1", "title", "Lab title", "title")}
  <div class="tpl-region tpl-region--meta-row">
    ${txt("p", "text", "Lab # / date", "meta-left")}
    ${txt("p", "text", "Partner", "meta-right")}
  </div>
  <h2 contenteditable="false">Objective</h2>
  ${txt("p", "body", "Objective", "objective")}
  <h2 contenteditable="false">Procedure</h2>
  ${list("Procedure steps", "procedure", 4)}
  <div class="tpl-region tpl-region--lab-figure">${img("Results figure", "results-figure")}</div>
  <h2 contenteditable="false">Analysis</h2>
  ${txt("p", "body", "Analysis", "analysis")}
  <h2 contenteditable="false">Conclusion</h2>
  ${txt("p", "body", "Conclusion", "conclusion")}
</div>`,
    },
    {
      id: "lecture-slide",
      name: "Lecture board",
      icon: "📋",
      category: "Study",
      description: "Title bar, diagram on the left, key points on the right",
      preview: ["title", "split-img-text"],
      html: () => `<div class="tpl-page tpl-page--lecture">
  <div class="tpl-region tpl-region--lecture-head">
    ${txt("h1", "title", "Lecture topic", "title")}
    ${txt("p", "subtitle", "Date / course", "meta")}
  </div>
  <div class="tpl-region tpl-region--lecture-body">
    <div class="tpl-col tpl-col--media">${img("Diagram / board", "diagram")}</div>
    <div class="tpl-col tpl-col--copy">
      <h2 contenteditable="false">Key points</h2>
      ${list("Key points", "keypoints", 5)}
      <h2 contenteditable="false">Questions</h2>
      ${list("Review questions", "questions", 3)}
    </div>
  </div>
</div>`,
    },
  ];

  const LAYOUT_BLOCKS = [
    {
      id: "heading",
      name: "Title",
      icon: "H",
      description: "Page / section title",
      html: () => txt("h1", "title", "Title", "title"),
    },
    {
      id: "paragraph",
      name: "Text",
      icon: "¶",
      description: "Body paragraph",
      html: () => txt("p", "body", "Write here…", "body"),
    },
    {
      id: "image",
      name: "Image",
      icon: "🖼",
      description: "Full-width image + caption",
      html: () => img("Image", "image"),
    },
    {
      id: "image-left",
      name: "Image | Text",
      icon: "◧",
      description: "Image left, text right",
      html: () => `<div class="tpl-region tpl-region--row-media-copy">
  <div class="tpl-col tpl-col--media">${img("Image", "image")}</div>
  <div class="tpl-col tpl-col--copy">${txt("p", "body", "Text beside image", "body")}</div>
</div>`,
    },
    {
      id: "text-left",
      name: "Text | Image",
      icon: "◨",
      description: "Text left, image right",
      html: () => `<div class="tpl-region tpl-region--row-copy-media">
  <div class="tpl-col tpl-col--copy">${txt("p", "body", "Text beside image", "body")}</div>
  <div class="tpl-col tpl-col--media">${img("Image", "image")}</div>
</div>`,
    },
    {
      id: "two-cols",
      name: "Two columns",
      icon: "▥",
      description: "Equal text columns",
      html: () => `<div class="tpl-region tpl-region--cols2">
  <div class="tpl-col">${txt("p", "body", "Left column", "col-left")}</div>
  <div class="tpl-col">${txt("p", "body", "Right column", "col-right")}</div>
</div>`,
    },
    {
      id: "three-imgs",
      name: "3-image row",
      icon: "▦",
      description: "Three images side by side",
      html: () => `<div class="tpl-region tpl-region--gallery3">
  ${img("Photo 1", "photo-1")}
  ${img("Photo 2", "photo-2")}
  ${img("Photo 3", "photo-3")}
</div>`,
    },
    {
      id: "pullquote",
      name: "Pull quote",
      icon: "❝",
      description: "Centered quote band",
      html: () => `<blockquote class="tpl-slot tpl-slot--quote tpl-region--pullquote" data-slot-type="quote" data-slot-role="pullquote" data-slot-label="Pull quote">
  <p data-slot-type="text" data-slot-role="quote-text" data-slot-label="Quote"></p>
  <cite data-slot-type="text" data-slot-role="quote-source" data-slot-label="Source"></cite>
</blockquote>`,
    },
    {
      id: "bullets",
      name: "Bullet list",
      icon: "•",
      description: "List of points",
      html: () => list("List", "list", 4),
    },
    {
      id: "callout",
      name: "Callout box",
      icon: "◆",
      description: "Highlighted note with optional image",
      html: () => `<div class="tpl-region tpl-region--callout">
  ${txt("h3", "heading", "Callout title", "callout-title")}
  ${txt("p", "body", "Callout body", "callout-body")}
</div>`,
    },
  ];

  function buildBlock(blockId) {
    const block = LAYOUT_BLOCKS.find((b) => b.id === blockId);
    if (!block) return "";
    return stampIds(typeof block.html === "function" ? block.html() : block.html);
  }

  function compose(...blockIds) {
    return stampIds(blockIds.map((id) => buildBlock(id)).join("\n"));
  }

  function getTemplateHtml(tpl) {
    if (!tpl) return "<p><br></p>";
    if (typeof tpl.html === "function") return stampIds(tpl.html());
    if (tpl.html) return stampIds(tpl.html);
    if (Array.isArray(tpl.blocks)) return compose(...tpl.blocks);
    return "<p><br></p>";
  }

  function getTemplate(id) {
    const tpl = PAGE_TEMPLATES.find((t) => t.id === id) || PAGE_TEMPLATES[0];
    return {
      id: tpl.id,
      name: tpl.name,
      icon: tpl.icon,
      description: tpl.description,
      category: tpl.category || "Page",
      preview: tpl.preview || ["full"],
      kind: "page",
      html: getTemplateHtml(tpl),
    };
  }

  function getAllTemplates() {
    return PAGE_TEMPLATES.map((t) => getTemplate(t.id));
  }

  function getAllBlocks() {
    return LAYOUT_BLOCKS.map((b) => ({
      id: b.id,
      name: b.name,
      icon: b.icon,
      description: b.description,
      kind: "block",
    }));
  }

  function getBlock(id) {
    const b = LAYOUT_BLOCKS.find((x) => x.id === id);
    if (!b) return null;
    return { ...b, html: buildBlock(id), kind: "block" };
  }

  function getTemplatesForSubject() {
    return getAllTemplates();
  }

  function getTemplateSchemas() {
    return PAGE_TEMPLATES.filter((t) => t.id !== "blank").map((t) => {
      const wrap = document.createElement("div");
      wrap.innerHTML = typeof t.html === "function" ? t.html() : t.html || "";
      const roles = [];
      const seen = new Set();
      wrap.querySelectorAll("[data-slot-type]").forEach((el) => {
        if (el.getAttribute("data-slot-role") === "caption") return;
        if (el.tagName === "LI" && el.parentElement?.getAttribute("data-slot-type") === "list") return;
        if (el.closest("figcaption") && el.getAttribute("data-slot-type") === "text") return;
        const role = el.getAttribute("data-slot-role") || el.getAttribute("data-slot-type");
        if (!role || seen.has(role)) return;
        seen.add(role);
        roles.push({
          role,
          type: el.getAttribute("data-slot-type") || "text",
          label: el.getAttribute("data-slot-label") || role,
        });
      });
      return {
        id: t.id,
        name: t.name,
        description: t.description || "",
        category: t.category || "Page",
        roles,
      };
    });
  }

  root.StudiesTemplates = {
    getTemplate,
    getAllTemplates,
    getAllBlocks,
    getBlock,
    buildBlock,
    compose,
    stampIds,
    getTemplatesForSubject,
    getTemplateSchemas,
  };
})(window);