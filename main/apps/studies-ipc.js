const path = require("path");
const fs = require("fs");
const { app, shell, BrowserWindow, dialog } = require("electron");

const WM_ROOT = path.join(__dirname, "..", "..", "world-maps");
const { geminiGenerate } = require(path.join(WM_ROOT, "gemini-ipc.js"));
const {
  enrichFillsImages,
  enrichPagesImages,
} = require("./studies-images");
const { gatherStudiesMslContext } = require("./studies-msl-context");
const {
  setupLocalAuthApp,
  requireSignedIn,
  registerSingleFileMigrator,
} = require("./local-auth-app-helper");

const APP_ID = "studies";
const auth = setupLocalAuthApp(APP_ID);
registerSingleFileMigrator(APP_ID, "studies.json");

function dataPath() {
  return auth.userDataPath("data.json");
}

function signedInGuard() {
  return requireSignedIn(auth);
}

async function loadStorage() {
  try {
    const raw = await fs.promises.readFile(dataPath(), "utf8");
    const data = JSON.parse(raw);
    return { ok: true, data: normalizeStorage(data) };
  } catch (err) {
    if (err && err.code === "ENOENT") {
      return { ok: true, data: normalizeStorage({}) };
    }
    return { ok: false, error: err.message || "Failed to load" };
  }
}

async function saveStorage(args) {
  const payload = normalizeStorage(args?.data ?? args);
  await fs.promises.mkdir(path.dirname(dataPath()), { recursive: true });
  await fs.promises.writeFile(dataPath(), JSON.stringify(payload, null, 2), "utf8");
  return { ok: true };
}

function normalizeStorage(raw) {
  const docs = Array.isArray(raw?.documents) ? raw.documents.map(normalizeDoc).filter(Boolean) : [];

  return {
    subjects: [],
    documents: docs.slice(0, 500),
    settings: {
      autoSaveMs: clampInt(raw?.settings?.autoSaveMs, 1500, 500, 10000),
      fontSize: clampInt(raw?.settings?.fontSize, 16, 12, 24),
      lineHeight: Number(raw?.settings?.lineHeight) || 1.65,
    },
  };
}

function normalizeDoc(raw) {
  if (!raw || !raw.id) return null;

  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((t) => String(t).slice(0, 40)).filter(Boolean).slice(0, 8)
    : [];
  if (raw.subjectId && !tags.includes(String(raw.subjectId))) {
    tags.push(String(raw.subjectId).slice(0, 40));
  }

  const formalStyles = new Set(["academic", "business", "proposal", "letter"]);
  const formalStyle = formalStyles.has(String(raw.formalStyle || ""))
    ? String(raw.formalStyle)
    : "academic";
  const docMode = raw.docMode === "formal" ? "formal" : "visual";

  return {
    id: String(raw.id),
    title: String(raw.title || "Untitled").slice(0, 200),
    content: typeof raw.content === "string" ? raw.content : "",
    template: String(raw.template || raw.templateId || "blank").slice(0, 40),
    docMode,
    formalStyle,
    pinned: !!raw.pinned,
    tags: tags.slice(0, 8),
    slots: raw.slots && typeof raw.slots === "object" ? raw.slots : {},
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
  };
}

function clampInt(val, fallback, min, max) {
  const n = parseInt(val, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

async function exportFile(args) {
  const filename = String(args?.filename || "document.html").replace(/[<>:"/\\|?*]/g, "_");
  const content = String(args?.content || "");
  const dir = path.join(app.getPath("documents"), "My Space Studies");
  await fs.promises.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  await fs.promises.writeFile(filePath, content, "utf8");
  await shell.openPath(filePath);
  return { ok: true, path: filePath };
}

async function exportDocx(args) {
  const rawName = String(args?.filename || "document.docx").replace(/[<>:"/\\|?*]/g, "_");
  const filename = rawName.toLowerCase().endsWith(".docx") ? rawName : `${rawName}.docx`;
  const base64 = String(args?.base64 || "");
  if (!base64.trim()) return { ok: false, error: "Empty document" };

  let buf;
  try {
    buf = Buffer.from(base64, "base64");
  } catch (_) {
    return { ok: false, error: "Invalid DOCX payload" };
  }
  if (!buf.length) return { ok: false, error: "Empty document" };

  const parent = BrowserWindow.getFocusedWindow();
  const save = await dialog.showSaveDialog(parent || undefined, {
    title: "Save Studies DOCX",
    defaultPath: path.join(app.getPath("downloads"), filename),
    filters: [{ name: "Word document", extensions: ["docx"] }],
  });
  if (save.canceled || !save.filePath) {
    return { ok: false, cancelled: true };
  }
  const filePath = save.filePath.toLowerCase().endsWith(".docx") ? save.filePath : `${save.filePath}.docx`;
  await fs.promises.writeFile(filePath, buf);
  await shell.openPath(filePath);
  return { ok: true, path: filePath };
}

async function exportPdf(args) {
  const rawName = String(args?.filename || "document.pdf").replace(/[<>:"/\\|?*]/g, "_");
  const filename = rawName.toLowerCase().endsWith(".pdf") ? rawName : `${rawName}.pdf`;
  const html = String(args?.html || args?.content || "");
  if (!html.trim()) return { ok: false, error: "Empty document" };

  const parent = BrowserWindow.getFocusedWindow();
  const save = await dialog.showSaveDialog(parent || undefined, {
    title: "Save Studies PDF",
    defaultPath: path.join(app.getPath("downloads"), filename),
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (save.canceled || !save.filePath) {
    return { ok: false, cancelled: true };
  }
  const filePath = save.filePath.toLowerCase().endsWith(".pdf") ? save.filePath : `${save.filePath}.pdf`;
  const tmpHtml = path.join(app.getPath("temp"), `studies-pdf-${Date.now()}-${process.pid}.html`);

  let win = null;
  try {
    await fs.promises.writeFile(tmpHtml, html, "utf8");
    win = new BrowserWindow({
      show: false,
      width: 1020,
      height: 1400,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        images: true,
        zoomFactor: 1,
      },
    });

    await win.loadFile(tmpHtml);
    try {
      await win.webContents.executeJavaScript(`
        (async () => {
          document.documentElement.style.width = "8.5in";
          document.body.style.width = "8.5in";
          const imgs = Array.from(document.images || []);
          await Promise.all(imgs.map((img) => {
            if (img.complete && img.naturalWidth) return Promise.resolve();
            return new Promise((resolve) => {
              const done = () => resolve();
              img.addEventListener("load", done, { once: true });
              img.addEventListener("error", done, { once: true });
              setTimeout(done, 5000);
            });
          }));
          await new Promise((r) => setTimeout(r, 250));
        })()
      `);
    } catch {
    }

    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      landscape: false,
      pageSize: "Letter",
      margins: { marginType: "none" },
      preferCSSPageSize: true,
    });
    await fs.promises.writeFile(filePath, pdf);
    try {
      shell.showItemInFolder(filePath);
    } catch {
    }
    return { ok: true, path: filePath };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  } finally {
    if (win && !win.isDestroyed()) win.destroy();
    try {
      await fs.promises.unlink(tmpHtml);
    } catch {
    }
  }
}

async function handleGeminiChat(args) {
  try {
    const messages = Array.isArray(args) ? args : args?.messages;
    const contents = [];
    for (const m of Array.isArray(messages) ? messages.slice(-8) : []) {
      const roleRaw = String(m?.role || "").toLowerCase();
      const role =
        roleRaw === "assistant" || roleRaw === "model"
          ? "model"
          : roleRaw === "user"
            ? "user"
            : null;
      if (!role) continue;
      const text = String(m?.content || "").trim();
      if (!text) continue;
      contents.push({ role, parts: [{ text }] });
    }
    if (!contents.length) return { ok: false, error: "Empty messages" };

    let system =
      "You are the Studies writing assistant inside My Space. Help with notes, essays, templates, outlining, and study documents. Be clear and practical. Reply in the user's language.\n" +
      "IMPORTANT: You cannot create or replace document pages from this chat. If the user asks for a multi-page project/assignment, tell them to use ✦ AI Fill → choose language → Full project → pick 5/7/10 pages → Generate. Never pretend you already wrote pages into their document.";
    if (args && !Array.isArray(args) && args.slotsSummary) {
      system +=
        "\n\nThe user has a document open with fillable layout slots:\n" +
        String(args.slotsSummary).slice(0, 4000) +
        "\nIf they ask to fill the template, respond with ONLY a JSON object: " +
        '{"title":"...","summary":"...","fills":[{"id":"slot id","type":"text|image|list|...","value":"...","items":["..."],"caption":"...","visual":{"subject":"...","context":"...","searchQuery":"precise english terms"}}]} ' +
        "Use exact slot ids. For images prefer visual.subject + visual.searchQuery (specific, not generic) + caption; value/url optional.";
    }

    try {
      const msl = await gatherStudiesMslContext();
      if (msl.promptBlock) system += msl.promptBlock.slice(0, 10000);
    } catch {
      /* MSL optional */
    }

    const res = await geminiGenerate({
      contents,
      systemInstruction: system,
    });
    if (!res.ok) return res;
    const parts = res.candidate?.content?.parts || [];
    const content = parts
      .map((p) => (typeof p?.text === "string" ? p.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim();
    if (!content) return { ok: false, error: "Empty response from Gemini" };
    return { ok: true, content, model: res.model };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

function parseModelJson(raw) {
  const text = String(raw || "").trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function handleGeminiFactCheck(args) {
  try {
    const language = String(args?.language || "en").toLowerCase().startsWith("he") ? "he" : "en";
    const title = String(args?.title || "Untitled").trim();
    const text = String(args?.text || "").trim();
    if (!text) {
      return { ok: false, error: language === "he" ? "אין טקסט לבדיקה במסמך" : "No document text to check" };
    }

    const langRule =
      language === "he"
        ? "Write the entire review in Hebrew."
        : "Write the entire review in English.";

    const prompt =
      `You are a careful fact-checker for a student Studies document.\n` +
      `Document title: ${title}\n` +
      `${langRule}\n\n` +
      `Document content:\n"""\n${text.slice(0, 14000)}\n"""\n\n` +
      `Check whether the presented information looks accurate.\n` +
      `Return ONLY JSON:\n` +
      `{"verdict":"accurate|mostly_accurate|mixed|unreliable","score":0-100,"summary":"2-4 sentences","issues":[{"claim":"...","problem":"...","suggestion":"..."}],"notes":["optional general notes"]}\n` +
      `Rules:\n` +
      `- Focus on factual claims (dates, versions, history, comparisons, science).\n` +
      `- If unsure, say so; do not invent certainty.\n` +
      `- issues can be empty if everything looks fine.\n` +
      `- Be specific and useful for a student revising the work.`;

    const res = await geminiGenerate({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      systemInstruction:
        "You fact-check student documents. Output valid JSON only with verdict, score, summary, issues, notes.",
      temperature: 0.2,
      maxOutputTokens: 4096,
    });
    if (!res.ok) return res;

    const parsed = parseModelJson(String(res.text || "").trim());
    if (!parsed) {
      return {
        ok: true,
        language,
        verdict: "mixed",
        score: null,
        summary: String(res.text || "").trim().slice(0, 2000),
        issues: [],
        notes: [],
        model: res.model,
        raw: true,
      };
    }

    return {
      ok: true,
      language,
      verdict: parsed.verdict || "mixed",
      score: typeof parsed.score === "number" ? parsed.score : null,
      summary: parsed.summary || "",
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      model: res.model,
    };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

const PROJECT_TEMPLATE_FALLBACK = [
  {
    id: "cover",
    name: "Cover page",
    description: "Hero image + title + subtitle",
    roles: [
      { role: "hero", type: "image" },
      { role: "title", type: "title" },
      { role: "subtitle", type: "subtitle" },
    ],
  },
  {
    id: "feature-left",
    name: "Feature: image left",
    description: "Image left, headline + lead + body right",
    roles: [
      { role: "feature", type: "image" },
      { role: "title", type: "title" },
      { role: "lead", type: "lead" },
      { role: "body", type: "body" },
    ],
  },
  {
    id: "feature-right",
    name: "Feature: image right",
    description: "Headline + lead + body left, image right",
    roles: [
      { role: "title", type: "title" },
      { role: "lead", type: "lead" },
      { role: "body", type: "body" },
      { role: "feature", type: "image" },
    ],
  },
  {
    id: "banner-columns",
    name: "Banner + 2 columns",
    description: "Wide banner, title, two text columns",
    roles: [
      { role: "banner", type: "image" },
      { role: "title", type: "title" },
      { role: "col-left", type: "body" },
      { role: "col-right", type: "body" },
    ],
  },
  {
    id: "sidebar",
    name: "Main + sidebar",
    description: "Main story + sidebar image/notes",
    roles: [
      { role: "title", type: "title" },
      { role: "lead", type: "lead" },
      { role: "body", type: "body" },
      { role: "body-2", type: "body" },
      { role: "aside-image", type: "image" },
      { role: "aside-title", type: "heading" },
      { role: "aside-list", type: "list" },
    ],
  },
  {
    id: "gallery-3",
    name: "Photo strip",
    description: "Title, three photos, body",
    roles: [
      { role: "title", type: "title" },
      { role: "photo-1", type: "image" },
      { role: "photo-2", type: "image" },
      { role: "photo-3", type: "image" },
      { role: "body", type: "body" },
    ],
  },
  {
    id: "magazine-spread",
    name: "Magazine spread",
    description: "Hero, quote, two image+text rows",
    roles: [
      { role: "hero", type: "image" },
      { role: "title", type: "title" },
      { role: "lead", type: "lead" },
      { role: "quote-text", type: "text" },
      { role: "quote-source", type: "text" },
      { role: "inset-1", type: "image" },
      { role: "body-1", type: "body" },
      { role: "body-2", type: "body" },
      { role: "inset-2", type: "image" },
    ],
  },
  {
    id: "profile",
    name: "Profile / bio",
    description: "Portrait + name + bio + highlights",
    roles: [
      { role: "portrait", type: "image" },
      { role: "name", type: "title" },
      { role: "role", type: "subtitle" },
      { role: "bio", type: "body" },
      { role: "highlights", type: "list" },
    ],
  },
  {
    id: "comparison",
    name: "Compare two",
    description: "Two panels with image, title, points",
    roles: [
      { role: "title", type: "title" },
      { role: "a-image", type: "image" },
      { role: "a-title", type: "heading" },
      { role: "a-list", type: "list" },
      { role: "b-image", type: "image" },
      { role: "b-title", type: "heading" },
      { role: "b-list", type: "list" },
    ],
  },
  {
    id: "process-3",
    name: "3-step process",
    description: "Three steps with image + title + body",
    roles: [
      { role: "title", type: "title" },
      { role: "step-1-image", type: "image" },
      { role: "step-1-title", type: "heading" },
      { role: "step-1-body", type: "body" },
      { role: "step-2-image", type: "image" },
      { role: "step-2-title", type: "heading" },
      { role: "step-2-body", type: "body" },
      { role: "step-3-image", type: "image" },
      { role: "step-3-title", type: "heading" },
      { role: "step-3-body", type: "body" },
    ],
  },
  {
    id: "worksheet",
    name: "Worksheet",
    description: "Instructions, figure, answer lines",
    roles: [
      { role: "title", type: "title" },
      { role: "meta", type: "subtitle" },
      { role: "instructions", type: "body" },
      { role: "figure", type: "image" },
      { role: "answer-1", type: "body" },
      { role: "answer-2", type: "body" },
      { role: "answer-3", type: "body" },
    ],
  },
  {
    id: "poster",
    name: "Poster / flyer",
    description: "Title, hero, key points, footer",
    roles: [
      { role: "title", type: "title" },
      { role: "hero", type: "image" },
      { role: "points", type: "list" },
      { role: "footer", type: "subtitle" },
    ],
  },
  {
    id: "lab-report",
    name: "Lab report page",
    description: "Objective, procedure, figure, analysis",
    roles: [
      { role: "title", type: "title" },
      { role: "meta-left", type: "text" },
      { role: "meta-right", type: "text" },
      { role: "objective", type: "body" },
      { role: "procedure", type: "list" },
      { role: "results-figure", type: "image" },
      { role: "analysis", type: "body" },
      { role: "conclusion", type: "body" },
    ],
  },
  {
    id: "lecture-slide",
    name: "Lecture board",
    description: "Title, diagram, keypoints, questions",
    roles: [
      { role: "title", type: "title" },
      { role: "meta", type: "subtitle" },
      { role: "diagram", type: "image" },
      { role: "keypoints", type: "list" },
      { role: "questions", type: "list" },
    ],
  },
];

function resolveProjectSchemas(templates) {
  const list = Array.isArray(templates) ? templates.filter((t) => t && t.id && t.id !== "blank") : [];
  if (!list.length) return PROJECT_TEMPLATE_FALLBACK;
  return list.map((t) => {
    const fallback = PROJECT_TEMPLATE_FALLBACK.find((f) => f.id === t.id);
    return {
      id: t.id,
      name: t.name || fallback?.name || t.id,
      description: t.description || fallback?.description || "",
      roles: Array.isArray(t.roles) && t.roles.length ? t.roles : fallback?.roles || [],
    };
  });
}

function clampPageCount(n, fallback = 7) {
  const num = Number(n);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(5, Math.min(10, Math.round(num)));
}

function clampFillDensity(n, fallback = 80) {
  const num = Number(n);
  if (!Number.isFinite(num)) return fallback;
  const snapped = Math.round(num / 20) * 20;
  return Math.max(40, Math.min(100, snapped));
}

function densityInstructions(density, language) {
  const d = clampFillDensity(density);
  if (language === "he") {
    if (d >= 100) {
      return (
        "צפיפות מילוי 100% (חובה):\n" +
        "- מלא את כל ה-roles ללא יוצא מן הכלל.\n" +
        "- גוף טקסט (body/col-*): 6–9 משפטים מלאים, ספציפיים ועובדתיים — לא סיסמאות.\n" +
        "- lead: 2–3 משפטים.\n" +
        "- רשימות: 5–7 פריטים עם תוכן ממשי (לא מילה אחת).\n" +
        "- כותרות מדויקות לנושא העמוד.\n" +
        "- אל תשאיר משבצות ריקות."
      );
    }
    if (d >= 80) {
      return (
        "צפיפות מילוי ~80% (חובה לעמוד מלא ויזואלית):\n" +
        "- מלא כמעט את כל ה-roles; מותר להשמיט role משני אחד בלבד (caption/quote).\n" +
        "- גוף טקסט (body/col-*): לפחות 5–7 משפטים עשירים — שמות, תקופות, עובדות, השוואות.\n" +
        "- lead: לפחות 2 משפטים ממשיים.\n" +
        "- רשימות: לפחות 4–5 פריטים מפורטים.\n" +
        "- העמוד חייב להיראות מלא (~80%), לא חצי־ריק.\n" +
        "- אסור טקסט קצר/כללי בסגנון 'דינוזאורים היו גדולים ומעניינים'."
      );
    }
    if (d >= 60) {
      return (
        "צפיפות מילוי ~60%:\n" +
        "- מלא title + lead/body או image ראשי + עוד 1–2 roles.\n" +
        "- גוף טקסט: 3–4 משפטים ספציפיים.\n" +
        "- אפשר להשאיר ~40% מה-roles מחוץ ל-fillsByRole לרווח לבן."
      );
    }
    return (
      "צפיפות מילוי ~40%:\n" +
      "- מלא רק ליבה: title + פסקה אחת חזקה + תמונה אם יש.\n" +
      "- השאר את רוב ה-roles מחוץ ל-fillsByRole."
    );
  }
  if (d >= 100) {
    return (
      "Fill density 100% (required):\n" +
      "- Fill EVERY listed role.\n" +
      "- Body/col-* text: 6–9 full, specific, factual sentences — no slogans.\n" +
      "- Lead: 2–3 sentences.\n" +
      "- Lists: 5–7 substantive items (not one-word bullets).\n" +
      "- Precise titles for the page topic.\n" +
      "- Do not leave slots empty."
    );
  }
  if (d >= 80) {
    return (
      "Fill density ~80% (page must look ~80% full visually):\n" +
      "- Fill nearly every role; omit at most ONE secondary role (caption/quote).\n" +
      "- Body/col-* text: at least 5–7 rich sentences — names, periods, facts, comparisons.\n" +
      "- Lead: at least 2 real sentences.\n" +
      "- Lists: at least 4–5 detailed items.\n" +
      "- Forbidden: thin generic filler like 'Dinosaurs were big and interesting'."
    );
  }
  if (d >= 60) {
    return (
      "Fill density ~60%:\n" +
      "- Fill title + lead/body or main image + 1–2 more roles.\n" +
      "- Body: 3–4 specific sentences.\n" +
      "- Omit ~40% of secondary roles from fillsByRole for white space."
    );
  }
  return (
    "Fill density ~40%:\n" +
    "- Fill only core: title + one strong paragraph + image if present.\n" +
    "- Omit most secondary roles from fillsByRole."
  );
}

function qualitySystemInstruction(mode) {
  const base =
    "You write polished educational Studies pages for school/college projects. " +
    "Tone: clear, factual, structured: like a good textbook or museum label, not childish chat or marketing fluff. " +
    "Use specific names, dates, classifications, mechanisms, and concrete examples. " +
    "Avoid: vague filler, repeated slogans, placeholders (.../TBD), emoji, hype words (amazing, awesome, let's explore). " +
    "Never invent impossible 'facts'; if uncertain, prefer widely accepted school-level knowledge. " +
    "Output valid JSON only.";
  if (mode === "outline") {
    return (
      base +
      " Plan distinct page purposes that cover the topic systematically (intro → core ideas → examples/comparison → deeper detail → wrap-up)."
    );
  }
  return base + " Fill fillsByRole with real paragraph-quality text that matches the density rules.";
}

function rolePriority(role) {
  const r = String(role || "").toLowerCase();
  if (/^(title|heading|h1)$/.test(r)) return 100;
  if (/^(lead|subtitle|kicker|meta|deck)$/.test(r)) return 90;
  if (/^(hero|image|img|photo|cover|diagram|visual|feature|banner)$/.test(r)) return 85;
  if (/^(body|main|content|article|text|col-)/.test(r)) return 80;
  if (/list|bullets|keypoints|points|steps/.test(r)) return 60;
  if (/quote|pullquote|cite/.test(r)) return 40;
  if (/caption|footer|note|aside/.test(r)) return 20;
  return 50;
}

function wordCountValue(v) {
  if (v == null) return 0;
  if (typeof v === "string") {
    return v
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  }
  if (Array.isArray(v)) {
    return v
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .join(" ")
      .split(/\s+/)
      .filter(Boolean).length;
  }
  if (typeof v === "object") {
    return wordCountValue(v.value || v.caption || (Array.isArray(v.items) ? v.items : ""));
  }
  return 0;
}

function listItemCount(v) {
  if (Array.isArray(v)) return v.filter((x) => String(x || "").trim().length >= 6).length;
  if (v && typeof v === "object" && Array.isArray(v.items)) {
    return v.items.filter((x) => String(x || "").trim().length >= 6).length;
  }
  return 0;
}

function countSubstantialRoles(fillsByRole, schema) {
  const roles = Array.isArray(schema?.roles) ? schema.roles : [];
  const map = fillsByRole && typeof fillsByRole === "object" ? fillsByRole : {};
  let n = 0;
  for (const r of roles) {
    const v = map[r.role];
    if (v == null || v === "") continue;
    if (typeof v === "string" && v.trim().length >= 8) n += 1;
    else if (Array.isArray(v) && v.filter((x) => String(x || "").trim().length >= 4).length >= 2) n += 1;
    else if (
      typeof v === "object" &&
      (wordCountValue(v.value) >= 3 ||
        wordCountValue(v.caption) >= 3 ||
        listItemCount(v) >= 2 ||
        v.searchQuery ||
        v.visual ||
        v.url)
    ) {
      n += 1;
    }
  }
  return n;
}

function minRolesForDensity(schema, density) {
  const total = Math.max(1, (schema?.roles || []).length);
  const d = clampFillDensity(density);
  if (d >= 100) return total;
  if (d >= 80) return Math.max(1, total - 1); // omit at most one role
  if (d >= 60) return Math.max(1, Math.ceil(total * 0.6));
  return Math.max(1, Math.ceil(total * 0.4));
}

function minBodyWordsForDensity(density) {
  const d = clampFillDensity(density);
  if (d >= 100) return 70;
  if (d >= 80) return 55;
  if (d >= 60) return 35;
  return 18;
}

function isPageFillAdequate(fillsByRole, schema, density) {
  const d = clampFillDensity(density);
  const roles = Array.isArray(schema?.roles) ? schema.roles : [];
  const fills = fillsByRole && typeof fillsByRole === "object" ? fillsByRole : {};
  if (countSubstantialRoles(fills, schema) < minRolesForDensity(schema, d)) return false;

  const minBody = minBodyWordsForDensity(d);
  const minLead = d >= 80 ? 16 : d >= 60 ? 10 : 6;
  const minList = d >= 100 ? 5 : d >= 80 ? 4 : 3;

  let bodyChecked = false;
  for (const r of roles) {
    const role = String(r.role || "").toLowerCase();
    const type = String(r.type || "").toLowerCase();
    const v = fills[r.role];
    if (v == null) continue;

    const isBody =
      type === "body" ||
      role === "body" ||
      role === "main" ||
      role === "content" ||
      role.startsWith("col-");
    const isLead = type === "lead" || role === "lead" || role === "deck";
    const isList = type === "list" || /list|bullets|points|steps|keypoints/.test(role);

    if (isBody) {
      bodyChecked = true;
      if (wordCountValue(v) < minBody) return false;
    }
    if (isLead && wordCountValue(v) < minLead) return false;
    if (isList && listItemCount(v) < minList) return false;
  }

  // If template has a body-like role but it was omitted at high density, fail.
  if (d >= 80) {
    const bodyRoles = roles.filter((r) => {
      const role = String(r.role || "").toLowerCase();
      const type = String(r.type || "").toLowerCase();
      return (
        type === "body" ||
        role === "body" ||
        role === "main" ||
        role.startsWith("col-")
      );
    });
    if (bodyRoles.length && !bodyChecked) return false;
  }
  return true;
}

function normalizeFillsByRole(raw, schema) {
  const roles = Array.isArray(schema?.roles) ? schema.roles : [];
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? { ...raw } : {};
  const out = {};
  const used = new Set();

  const aliases = {
    body: ["main", "content", "text", "article", "paragraph"],
    lead: ["intro", "deck", "summary", "blurb"],
    subtitle: ["subhead", "tagline", "kicker"],
    hero: ["image", "img", "photo", "cover", "visual", "diagram"],
    image: ["hero", "img", "photo", "visual", "diagram"],
    feature: ["image", "hero", "photo", "visual"],
    list: ["bullets", "items", "points", "keypoints"],
    title: ["heading", "headline", "h1", "name"],
  };

  for (const r of roles) {
    if (src[r.role] != null && src[r.role] !== "") {
      out[r.role] = src[r.role];
      used.add(r.role);
      continue;
    }
    const alts = aliases[r.role] || [];
    for (const alt of alts) {
      if (src[alt] != null && src[alt] !== "" && !used.has(alt)) {
        out[r.role] = src[alt];
        used.add(alt);
        break;
      }
    }
  }

  for (const [k, v] of Object.entries(src)) {
    if (out[k] != null || v == null || v === "") continue;
    if (roles.some((r) => r.role === k)) out[k] = v;
  }

  return out;
}

function trimFillsToDensity(fillsByRole, schema, density) {
  const d = clampFillDensity(density);
  if (d >= 80) return fillsByRole;

  const roles = [...(schema?.roles || [])].sort(
    (a, b) => rolePriority(b.role) - rolePriority(a.role)
  );
  const keep = minRolesForDensity(schema, d);
  const out = {};
  let kept = 0;
  for (const r of roles) {
    if (fillsByRole[r.role] == null) continue;
    if (kept >= keep && rolePriority(r.role) < 80) continue;
    out[r.role] = fillsByRole[r.role];
    kept += 1;
  }
  if (fillsByRole.title != null && out.title == null) out.title = fillsByRole.title;
  return out;
}

async function fillSinglePage({
  page,
  topic,
  docTitle,
  language,
  langRule,
  density,
  schema,
  mslBlock = "",
}) {
  const roles = schema?.roles || [];
  const roleLines = roles
    .map((r) => `- ${r.role} (${r.type || "text"}) — ${r.label || r.role}`)
    .join("\n");
  const dens = densityInstructions(density, language);
  const minRoles = minRolesForDensity(schema, density);
  const minBody = minBodyWordsForDensity(density);

  let best = {};
  let bestScore = -1;
  const maxAttempts = 2;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const retryNote =
      attempt === 0
        ? ""
        : language === "he"
          ? `\nניסיון חוזר: התוכן הקודם היה דליל מדי. חובה: לפחות ${minRoles} roles; גוף טקסט ≥${minBody} מילים; עובדות ספציפיות.\n`
          : `\nRETRY: previous fill was too thin. Required: at least ${minRoles} roles; body ≥${minBody} words; specific facts.\n`;

    const fillPrompt =
      `Fill ONE Studies document page for a serious school project.\n` +
      `Topic: ${topic}\n` +
      `Document title: ${docTitle}\n` +
      `Language rule: ${langRule}\n` +
      `${dens}\n` +
      `${retryNote}\n` +
      `Page ${page.index + 1}: template="${page.template}"\n` +
      `Purpose of THIS page only: ${page.purpose}\n` +
      `Roles (use these EXACT keys in fillsByRole):\n${roleLines || "(none)"}\n` +
      `${mslBlock ? mslBlock.slice(0, 7000) : ""}\n\n` +
      `Return ONLY JSON:\n` +
      `{"index":${page.index},"template":"${page.template}","fillsByRole":{}}\n\n` +
      `Rules:\n` +
      `- fillsByRole keys MUST match the role names above exactly.\n` +
      `- Include at least ${minRoles} roles with real content.\n` +
      `- Body/col text MUST be ≥${minBody} words of specific, useful content for "${page.purpose}".\n` +
      `- Titles: concrete and page-specific (not just the overall topic name repeated).\n` +
      `- Lists: detailed items (phrase or short sentence each), not single vague words.\n` +
      `- Images: {"caption":"...","visual":{"subject":"...","context":"...","mustInclude":["..."],"mustAvoid":["cartoon","logo"],"searchQuery":"precise english photo terms"}}\n` +
      `- Do not pad with empty praise; teach something real on this page.\n` +
      `- When MSL sources are present, ground facts in them (names, eras, details) without pasting raw JSON.`;

    const fillRes = await geminiGenerate({
      contents: [{ role: "user", parts: [{ text: fillPrompt }] }],
      systemInstruction: qualitySystemInstruction("fill"),
      temperature: attempt === 0 ? 0.4 : 0.28,
      maxOutputTokens: 4096,
      retries: 2,
    });
    if (!fillRes.ok) {
      if (attempt === maxAttempts - 1) return { fillsByRole: best, error: fillRes.error };
      continue;
    }

    const parsed = parseModelJson(String(fillRes.text || "").trim());
    const rawFills =
      parsed?.fillsByRole && typeof parsed.fillsByRole === "object"
        ? parsed.fillsByRole
        : parsed?.pages?.[0]?.fillsByRole && typeof parsed.pages[0].fillsByRole === "object"
          ? parsed.pages[0].fillsByRole
          : {};

    let fills = normalizeFillsByRole(rawFills, schema);
    fills = trimFillsToDensity(fills, schema, density);

    const roleScore = countSubstantialRoles(fills, schema);
    let words = 0;
    for (const r of roles) words += wordCountValue(fills[r.role]);
    const score = roleScore * 100 + words;
    if (score > bestScore) {
      best = fills;
      bestScore = score;
    }
    if (isPageFillAdequate(fills, schema, density)) return { fillsByRole: fills };
  }

  return { fillsByRole: best };
}

function mapPool(items, concurrency, worker) {
  const list = Array.isArray(items) ? items : [];
  const limit = Math.max(1, Math.min(concurrency || 3, list.length || 1));
  const results = new Array(list.length);
  let next = 0;

  async function runOne() {
    while (next < list.length) {
      const i = next;
      next += 1;
      results[i] = await worker(list[i], i);
    }
  }

  return Promise.all(Array.from({ length: limit }, () => runOne())).then(() => results);
}

function formatSchemaLines(schemas) {
  return schemas
    .map((t) => {
      const roles = (t.roles || [])
        .map((r) => `${r.role}:${r.type || "text"}`)
        .join(", ");
      return `- id="${t.id}" (${t.name}) — ${t.description || ""}\n  roles: ${roles || "(none)"}`;
    })
    .join("\n");
}

function pickTemplateId(raw, index, schemas, allowedIds) {
  let template = String(raw || "").trim();
  if (allowedIds.has(template)) return template;
  if (index === 0 && allowedIds.has("cover")) return "cover";
  const fallbacks = [
    "feature-left",
    "feature-right",
    "sidebar",
    "comparison",
    "lecture-slide",
    "process-3",
    "banner-columns",
    "gallery-3",
    "magazine-spread",
  ];
  for (const id of fallbacks) {
    if (allowedIds.has(id)) return id;
  }
  return schemas[Math.min(index, schemas.length - 1)]?.id || "cover";
}

function normalizeOutlinePages(rawPages, pageCount, schemas, allowedIds) {
  const src = Array.isArray(rawPages) ? rawPages.slice(0, pageCount) : [];
  const out = [];
  for (let i = 0; i < pageCount; i += 1) {
    const p = src[i] || {};
    out.push({
      index: i,
      template: pickTemplateId(p.template || p.templateId, i, schemas, allowedIds),
      purpose: String(p.purpose || p.title || `Page ${i + 1}`).slice(0, 240),
    });
  }
  const unique = new Set(out.map((p) => p.template));
  if (unique.size === 1 && pageCount > 2) {
    const rotate = [
      "cover",
      "feature-left",
      "comparison",
      "sidebar",
      "lecture-slide",
      "process-3",
      "gallery-3",
      "feature-right",
      "magazine-spread",
      "poster",
    ];
    out.forEach((p, i) => {
      p.template = pickTemplateId(rotate[i % rotate.length], i, schemas, allowedIds);
    });
  }
  return out;
}

async function generateProjectMultiPass({
  topic,
  title,
  language,
  langRule,
  pageCount,
  schemas,
  fillDensity,
  mslBlock = "",
  mslCount = 0,
}) {
  const allowedIds = new Set(schemas.map((s) => s.id));
  const tplLines = formatSchemaLines(schemas);
  const density = clampFillDensity(fillDensity, 80);

  const outlinePrompt =
    `Plan a Studies multi-page SCHOOL PROJECT (OUTLINE ONLY: no full text yet).\n` +
    `Topic: ${topic}\n` +
    `Working title: ${title}\n` +
    `Language for later content: ${language}\n` +
    `REQUIRED: exactly ${pageCount} pages.\n` +
    `Target fill density later: ~${density}% (pages must be content-rich).\n\n` +
    `Pick a template id for EACH page from this catalog:\n${tplLines}\n\n` +
    `Rules:\n` +
    `- pages.length MUST equal ${pageCount}.\n` +
    `- Page 1 should usually be "cover".\n` +
    `- Mix templates; do not repeat the same id for every page.\n` +
    `- purpose = a SPECIFIC subtopic for that page (not vague "introduction to dinosaurs"). Name what the page teaches.\n` +
    `- Cover a logical progression: overview → classification/structure → key examples → environment/behavior or comparison → significance/conclusion (adapt to topic).\n` +
    `- Do NOT include fillsByRole yet.\n` +
    `${mslBlock ? `- When MSL sources are present, shape page purposes around concrete entities/facts from those sources when they fit the topic.\n` : ""}\n` +
    `${mslBlock ? mslBlock.slice(0, 8000) + "\n\n" : ""}` +
    `Return ONLY JSON:\n` +
    `{"title":"...","summary":"1-2 sentences","pages":[{"template":"cover","purpose":"..."}]}`;

  const outlineRes = await geminiGenerate({
    contents: [{ role: "user", parts: [{ text: outlinePrompt }] }],
    systemInstruction: qualitySystemInstruction("outline"),
    temperature: 0.35,
    maxOutputTokens: 2048,
  });
  if (!outlineRes.ok) return outlineRes;

  const outline = parseModelJson(String(outlineRes.text || "").trim());
  if (!outline) {
    return {
      ok: false,
      error: language === "he" ? "לא הצלחתי לתכנן את מבנה הפרויקט" : "Could not parse project outline",
      raw: String(outlineRes.text || "").slice(0, 500),
    };
  }

  const outlinePages = normalizeOutlinePages(outline.pages, pageCount, schemas, allowedIds);
  const docTitle = String(outline.title || title || topic).trim();
  const summary = String(outline.summary || "").trim();

  // Fill pages in parallel — sequential was ~5× slower for a 5-page project.
  const filledPages = await mapPool(outlinePages, Math.min(5, outlinePages.length), async (page) => {
    const schema = schemas.find((s) => s.id === page.template) || { roles: [] };
    const { fillsByRole } = await fillSinglePage({
      page,
      topic,
      docTitle,
      language,
      langRule,
      density,
      schema,
      mslBlock,
    });
    return {
      template: page.template,
      purpose: page.purpose,
      fillsByRole: fillsByRole || {},
    };
  });

  const pagesWithImages = await enrichPagesImages(filledPages, {
    topic,
    title: docTitle,
    fast: true,
  });

  const sparse = pagesWithImages.filter((p) => {
    const schema = schemas.find((s) => s.id === p.template);
    return !isPageFillAdequate(p.fillsByRole, schema, density);
  }).length;

  return {
    ok: true,
    mode: "project",
    language,
    fillDensity: density,
    pageCount: pagesWithImages.length,
    requestedPageCount: pageCount,
    sparsePages: sparse,
    mslSources: mslCount,
    title: docTitle,
    summary:
      summary ||
      (language === "he"
        ? `נוצרו ${pagesWithImages.length} עמודים (צפיפות מילוי ~${density}%).`
        : `Created ${pagesWithImages.length} pages (fill density ~${density}%).`),
    pages: pagesWithImages,
    model: outlineRes.model,
  };
}

async function handleGeminiFillSlots(args) {
  try {
    const mode = String(args?.mode || "fill").toLowerCase() === "project" ? "project" : "fill";
    const language = String(args?.language || "en").toLowerCase().startsWith("he") ? "he" : "en";
    const topic = String(args?.topic || "").trim();
    const title = String(args?.title || "Untitled").trim();
    const slots = Array.isArray(args?.slots) ? args.slots : [];
    const templates = Array.isArray(args?.templates) ? args.templates : [];
    const pageCount = clampPageCount(args?.pageCount, 7);
    const fillDensity = clampFillDensity(args?.fillDensity, 80);

    if (!topic) return { ok: false, error: language === "he" ? "חסר נושא לעבודה" : "Topic is required" };

    const langRule =
      language === "he"
        ? "Write ALL user-facing text in Hebrew (titles, body, captions, lists). Image visual.searchQuery / subject stay in English."
        : "Write ALL user-facing text in English. Image visual.searchQuery / subject use precise English terms.";

    let mslBlock = "";
    let mslCount = 0;
    try {
      const msl = await gatherStudiesMslContext();
      mslBlock = msl.promptBlock || "";
      mslCount = msl.count || 0;
    } catch {
      /* optional */
    }

    if (mode === "project") {
      const schemas = resolveProjectSchemas(templates);
      return generateProjectMultiPass({
        topic,
        title,
        language,
        langRule,
        pageCount,
        schemas,
        fillDensity,
        mslBlock,
        mslCount,
      });
    }

    if (!slots.length) {
      return {
        ok: false,
        error:
          language === "he"
            ? "אין מקומות למילוי במסמך: הוסף תבנית או בחר Full project"
            : "No slots to fill: add a template or choose Full project",
      };
    }

    const dens = densityInstructions(fillDensity, language);
    const slotLines = slots
      .map((s, i) => {
        const cur =
          typeof s.current === "string"
            ? s.current
            : Array.isArray(s.current)
              ? s.current.join("; ")
              : JSON.stringify(s.current || {});
        return `${i + 1}. id=${s.id} type=${s.type} role=${s.role || ""} label=${s.label || s.type} current=${JSON.stringify(String(cur).slice(0, 120))}`;
      })
      .join("\n");

    const userPrompt =
      `Fill layout slots for this Studies school project document.\n` +
      `Current title: ${title}\n` +
      `Topic / instructions: ${topic}\n` +
      `Language rule: ${langRule}\n` +
      `${dens}\n\n` +
      `Slots:\n${slotLines}\n` +
      `${mslBlock ? mslBlock.slice(0, 8000) + "\n" : ""}\n` +
      `Return ONLY JSON:\n` +
      `{"title":"document title","summary":"one short sentence","fills":[{"id":"...","type":"text|image|list|title|...","value":"...","items":["for lists"],"caption":"...","visual":{"subject":"...","context":"...","mustInclude":["..."],"mustAvoid":["cartoon","logo"],"searchQuery":"precise english terms"}}]}\n` +
      `Rules: use exact ids; write specific factual content (not placeholders or hype); body text must be paragraph-length when density ≥80%; for images ALWAYS set visual.subject + visual.searchQuery tied to the topic (never generic "dinosaur" alone) + caption.` +
      (mslBlock ? ` Ground facts in the MSL sources when relevant; never paste raw JSON into slots.` : "");

    const res = await geminiGenerate({
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      systemInstruction: qualitySystemInstruction("fill"),
      temperature: 0.35,
      maxOutputTokens: 6144,
    });
    if (!res.ok) return res;

    const raw = String(res.text || "").trim();
    const parsed = parseModelJson(raw);
    if (!parsed || !Array.isArray(parsed.fills)) {
      return { ok: false, error: "Could not parse AI fill JSON", raw: raw.slice(0, 500) };
    }

    const fills = await enrichFillsImages(parsed.fills, {
      topic,
      title: parsed.title || title,
      purpose: topic,
    });

    return {
      ok: true,
      mode: "fill",
      language,
      title: parsed.title || title,
      summary: parsed.summary || `Filled ${fills.length} slots.`,
      fills,
      mslSources: mslCount,
      model: res.model,
    };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

const CHANNELS = {
  "storage.load": () => loadStorage(),
  "storage.save": (args) => saveStorage(args),
  "export.file": (args) => exportFile(args),
  "export.pdf": (args) => exportPdf(args),
  "export.docx": (args) => exportDocx(args),
  "gemini-generate": (args) => geminiGenerate(args || {}),
  "gemini-chat": (args) => handleGeminiChat(args),
  "gemini-fill-slots": (args) => handleGeminiFillSlots(args),
  "gemini-fact-check": (args) => handleGeminiFactCheck(args),
};

async function handleStudiesInvoke(channel, args) {
  const authErr = signedInGuard();
  if (authErr) return authErr;
  const handler = CHANNELS[channel];
  if (!handler) return { ok: false, error: `Unknown channel: ${channel}` };
  try {
    return await handler(args);
  } catch (err) {
    return { ok: false, error: err.message || "Request failed" };
  }
}

module.exports = { handleStudiesInvoke };