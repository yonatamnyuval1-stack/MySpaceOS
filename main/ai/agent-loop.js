const { toolSystemPrompt, executeTool, resolveToolName } = require("./tools-registry");
const { openClockPage, shellGetContext, shellGetPageContent } = require("./tools-shell");
const { needsConfirm, requestActionConfirm, describeAction } = require("./action-confirm");
const { captureScreenForAi } = require("./screen-capture");
const { enrichPrimaryFlag } = require("./flag-countries");
const { getScreenFacts } = require("./screen-facts-store");
const { formatFlagHint, formatFlagDescribe, getVisualHint } = require("./flag-hints");

const TOOL_CALL_RE = /<<tool_call>>\s*([\s\S]*?)\s*<<\/tool_call>>/i;
const MAX_TOOL_ROUNDS = 12;
const AUTO_PAGE_CONTENT_CHARS = 7000;

function formatViewContext(context, pageContent) {
  const parts = [];
  if (context && typeof context === "object") {
    try {
      const slim = {
        ok: context.ok,
        view: context.view,
        note: context.note || undefined,
        active: context.active || null,
        openTabs: Array.isArray(context.openTabs)
          ? context.openTabs.map((t) => ({
              tabId: t.tabId,
              title: t.title,
              mode: t.mode,
              appId: t.appId,
              appName: t.appName,
              module: t.module,
              url: t.url || undefined,
              active: t.active,
            }))
          : [],
      };
      parts.push(
        "Current My Space view (auto-attached: trust this over guesses):",
        JSON.stringify(slim, null, 2)
      );
      if (context.desktop && typeof context.desktop === "object") {
        parts.push(
          "DESKTOP LAYOUT (live: you CAN answer about wallpaper and icon positions from this):",
          JSON.stringify(
            {
              wallpaperId: context.desktop.wallpaperId,
              wallpaperName: context.desktop.wallpaperName,
              wallpaperDescription: context.desktop.wallpaperDescription || undefined,
              iconCount: context.desktop.iconCount,
              icons: (context.desktop.icons || []).slice(0, 40).map((ic) => ({
                id: ic.id,
                name: ic.name,
                x: ic.x,
                y: ic.y,
                hasCustomPosition: ic.hasCustomPosition,
              })),
            },
            null,
            2
          ),
          "Coordinates are desktop pixel positions (x,y) for each app icon. null means default/auto layout."
        );
      }
    } catch {
    }
  }

  if (pageContent && typeof pageContent === "object") {
    if (pageContent.ok) {
      const meta = {
        title: pageContent.active?.pageTitle || pageContent.active?.title || null,
        url: pageContent.active?.url || null,
        activeNav: pageContent.activeNav || null,
        headings: pageContent.headings || [],
        navLabels: (pageContent.navLabels || []).slice(0, 30),
        truncated: !!pageContent.truncated,
        charCount: pageContent.charCount || 0,
      };
      parts.push(
        "Visible page content (auto-attached from the user's current tab: use this to answer what is on screen):",
        JSON.stringify(meta, null, 2),
        "--- page text start ---",
        String(pageContent.text || "").trim() || "(empty)",
        "--- page text end ---"
      );

      // Lab cannot accept real images — encode on-screen visuals as facts.
      if (pageContent.primaryFlag?.flagCountry || pageContent.primaryFlag?.flagCode) {
        const f = pageContent.primaryFlag;
        parts.push(
          "VISIBLE FLAG ON SCREEN (decoded from the live image URL: this IS what the user sees):",
          JSON.stringify(
            {
              imageUrl: f.src,
              isoCode: f.flagCode,
              country: f.flagCountry,
              countryHe: f.flagCountryHe || null,
              note:
                "If the user asks which country/flag it is, answer with this country. Do NOT say you cannot see the flag.",
            },
            null,
            2
          )
        );
      } else if (Array.isArray(pageContent.media) && pageContent.media.length) {
        parts.push(
          "Visible images on screen (URLs/metadata: Lab is text-only so images are described this way):",
          JSON.stringify(
            pageContent.media.slice(0, 8).map((m) => ({
              src: m.src,
              alt: m.alt,
              size: `${m.width}x${m.height}`,
              flagCode: m.flagCode || undefined,
              flagCountry: m.flagCountry || undefined,
            })),
            null,
            2
          )
        );
      }

      if (Array.isArray(pageContent.answerChoices) && pageContent.answerChoices.length) {
        parts.push(
          "On-screen answer choices:",
          JSON.stringify(pageContent.answerChoices, null, 2)
        );
      }
      if (Array.isArray(pageContent.buttons) && pageContent.buttons.length) {
        parts.push("Visible buttons:", JSON.stringify(pageContent.buttons.slice(0, 20), null, 2));
      }
    } else if (pageContent.error) {
      parts.push(
        "Page content could not be read automatically:",
        JSON.stringify(
          {
            error: pageContent.error,
            view: pageContent.view || undefined,
            active: pageContent.active || undefined,
          },
          null,
          2
        )
      );
    }
  }

  if (!parts.length) return "";
  return `\n\n${parts.join("\n")}`;
}

function flattenMessageContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return String(content || "");
  return content
    .map((p) => {
      if (typeof p === "string") return p;
      if (p?.type === "text") return p.text || "";
      if (p?.type === "image_url") {
        const url = p.image_url?.url || p.url || "";
        if (/^data:/i.test(url)) return "[image attached as data URL: omitted]";
        return `[image: ${url}]`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function contentForLab(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return String(content || "");
  const parts = [];
  for (const p of content) {
    if (typeof p === "string") {
      if (p) parts.push({ type: "text", text: p });
      continue;
    }
    if (p?.type === "text") {
      parts.push({ type: "text", text: String(p.text || "") });
      continue;
    }
    if (p?.type === "image_url") {
      const url = p.image_url?.url || p.url || "";
      if (!url) continue;
      parts.push({
        type: "image_url",
        image_url: { url, detail: p.image_url?.detail || "high" },
      });
    }
  }
  if (!parts.length) return "";
  if (parts.every((p) => p.type === "text")) {
    return parts.map((p) => p.text).join("\n");
  }
  return parts;
}

function messagesHaveImages(messages) {
  return (messages || []).some(
    (m) => Array.isArray(m?.content) && m.content.some((p) => p?.type === "image_url")
  );
}

function messagesForLab(system, trail) {
  return [
    { role: "system", content: flattenMessageContent(system.content) },
    ...trail.map((m) => ({
      role: m.role,
      content: contentForLab(m.content),
    })),
  ];
}

function flattenMessagesForLab(messages) {
  return (messages || []).map((m) => ({
    role: m.role,
    content: flattenMessageContent(m.content),
  }));
}

async function labChatCompletions(labFetch, { model, program, messages }) {
  const body = {
    model,
    user: program || "operating system",
    messages,
  };
  try {
    return await labFetch("/chat/completions", {
      method: "POST",
      conversationId: null,
      body,
    });
  } catch (err) {
    if (messagesHaveImages(messages) && (err.status === 400 || /invalid_json|image|multimodal|content/i.test(String(err.message || "")))) {
      return labFetch("/chat/completions", {
        method: "POST",
        conversationId: null,
        body: {
          ...body,
          messages: flattenMessagesForLab(messages),
        },
      });
    }
    throw err;
  }
}

function collectScreenImageUrls(screenshot, pageContent) {
  const urls = [];
  const add = (u) => {
    const s = String(u || "").trim();
    if (!s || !/^https?:\/\//i.test(s)) return;
    if (!urls.includes(s)) urls.push(s);
  };
  for (const img of screenshot?.images || []) add(img.url);
  for (const m of pageContent?.media || []) add(m.src || m.url);
  const flag = enrichPrimaryFlag(pageContent?.primaryFlag || pageContent?.quizFlag);
  if (flag?.src) add(flag.src);
  if (flag?.flagCode) add(`https://flagcdn.com/w320/${String(flag.flagCode).toLowerCase()}.png`);
  return urls.slice(0, 4);
}

function attachScreenUrlsToLastUser(messages, screenshot, pageContent) {
  if (!Array.isArray(messages) || !messages.length) return { messages, attached: false };
  const urls = collectScreenImageUrls(screenshot, pageContent);
  if (!urls.length) return { messages, attached: false };
  const out = messages.map((m) => ({ ...m }));
  let idx = -1;
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i]?.role === "user") {
      idx = i;
      break;
    }
  }
  if (idx < 0) return { messages, attached: false };
  const prev = flattenMessageContent(out[idx].content);
  const block =
    `\n\n[SCREEN IMAGE URL(s): open/look at these to answer visual questions:\n` +
    urls.map((u, i) => `${i + 1}. ${u}`).join("\n") +
    `\nYou can see these images. Answer the user's actual question (describe, identify, hint, etc.).]`;
  out[idx] = { role: "user", content: `${prev}${block}` };
  return { messages: out, attached: true, urls };
}

function lastUserText(messages) {
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") return flattenMessageContent(messages[i].content);
  }
  return "";
}

function looksLikeScreenOrFlagQuestion(text) {
  const s = String(text || "");
  return /flag|דגל|מדינה|איזו|which country|correct answer|what.*(on|see|screen)|what's on|מה\b|תשוב|quiz|חידון|identify|עכשיו|עכשין|התחלף|חדש|now|again|current/i.test(
    s
  );
}

function looksLikeFlagAnswerFollowUp(text) {
  const s = String(text || "").trim();
  if (!s) return false;
  return /^(מה\s*)?(ה)?תשובה|עכשיו|עכשין|התחלף|and now|what now|next|הבא|זה\??$/i.test(s) ||
    looksLikeScreenOrFlagQuestion(s);
}

function looksLikeWrongToolUniverse(text) {
  const s = String(text || "");
  if (/\brun_tool_/i.test(s)) return true;
  if (/only (use|have|can use) the tools/i.test(s) && /run_tool_/i.test(s)) return true;
  const listsForeignTools =
    /(github|notion|gmail|youtube|google\s*sheets|google\s*calendar)/i.test(s) &&
    /(כלים|tools|ברשותי|available|יכולת|cannot|אין לי|לא יכול|not (able|have)|אינם מאפשרים)/i.test(s);
  if (listsForeignTools) return true;
  if (/cursor automations|run_tool_gmail|run_tool_github|run_tool_notion/i.test(s)) return true;
  return false;
}

function looksLikeBlindAssistantReply(text) {
  const s = String(text || "");
  return /cannot see|can't see|can not see|unable to see|no (actual )?image|upload (the )?(image|screenshot|flag)|please (describe|upload|paste|send)|לא (יכול|רואה)|אין לי (את )?היכולת|אין לי גישה|תעלה (תמונה|צילום)|אינם מאפשרים לי לראות|לא.*לזהות|לא צירפת|צרף את התמונה|תמונה חדשה|העתק.*(מסך|תמונה)|הדבק.*(מסך|תמונה)|paste.*(screen|image|flag)|צלם מסך.*שלח|screenshot.*(upload|send|paste)|אנא (העתק|שלח|תעלה)/i.test(
    s
  );
}

function looksLikeHintOnly(text) {
  const s = String(text || "");
  if (!s.trim()) return false;
  if (/^(מה\s*)?(ה)?תשובה\s*\??$/i.test(s.trim())) return false;
  if (/tell me (the )?(answer|country)|what (is|country)|איזו מדינה|מה המדינה|גלה|תגלה לי את/i.test(s) &&
      !/רמז|hint|בלי|without|don't|אל ת/i.test(s)) {
    return false;
  }
  return /רמז|hint|בלי (לגלות|לחשוף|להגיד|לספר|לגלות לי)|without (spoil|reveal|telling|saying|giving)|don'?t (tell|spoil|reveal|say)|אל ת(גלה|ספר|גיד|חשוף)|לא לגלות|רק רמז/i.test(
    s
  );
}

function looksLikeWantsScreenContent(text) {
  const s = String(text || "");
  return (
    looksLikeDesktopVisualQuestion(s) ||
    looksLikeScreenOrFlagQuestion(s) ||
    looksLikeFlagAnswerFollowUp(s) ||
    looksLikeHintOnly(s) ||
    /שאלה|question|what.*(see|on|screen)|מה.*(רואה|מסך|שאלה|תשוב)|תשובה|answer|מולך|לפניך|רואה/i.test(s)
  );
}

function mergePublishedScreenFacts(viewContext, pageContent) {
  const moduleId = String(
    viewContext?.active?.module || viewContext?.active?.appId || ""
  ).toLowerCase();
  if (!moduleId) return pageContent;
  const published = getScreenFacts(moduleId);
  if (!published) return pageContent;

  const fromDom = enrichPrimaryFlag(pageContent?.primaryFlag);
  const fromPub = enrichPrimaryFlag(published.primaryFlag);
  const primaryFlag =
    (fromDom?.flagCountry ? fromDom : null) ||
    (fromPub?.flagCountry ? fromPub : null) ||
    fromDom ||
    fromPub ||
    null;

  return {
    ok: true,
    ...(pageContent && typeof pageContent === "object" ? pageContent : {}),
    fromPublishedFacts: true,
    text: (pageContent?.text && String(pageContent.text).trim()) || published.text || "",
    answerChoices: pageContent?.answerChoices?.length
      ? pageContent.answerChoices
      : published.answerChoices || [],
    primaryFlag,
    media: pageContent?.media?.length ? pageContent.media : published.media || [],
    active: pageContent?.active || {
      pageTitle: published.page || moduleId,
      title: viewContext?.active?.appName || moduleId,
    },
  };
}

function looksLikeDescribeQuestion(text) {
  return /איך.*(נראה|נרא|נראית)|מה.*(המראה|נראה)|describe|looks?\s*like|appearance|תיאור|תאר את|תתאר/i.test(
    String(text || "")
  );
}

function buildGroundedScreenReply(viewContext, pageContent, opts = {}) {
  if (viewContext?.view === "desktop" && viewContext.desktop) {
    return formatDesktopDirectAnswer(viewContext.desktop);
  }

  const flag = enrichPrimaryFlag(pageContent?.primaryFlag || pageContent?.quizFlag);
  if (flag?.flagCountry) {
    if (opts.hintOnly || looksLikeHintOnly(opts.userText)) {
      return formatFlagHint(flag) || formatFlagDirectAnswer(flag);
    }
    if (opts.describeOnly || looksLikeDescribeQuestion(opts.userText)) {
      return formatFlagDescribe(flag) || formatFlagDirectAnswer(flag);
    }
    return formatFlagDirectAnswer(flag);
  }

  if (pageContent?.ok) {
    const lines = [];
    const app =
      viewContext?.active?.appName ||
      viewContext?.active?.module ||
      viewContext?.active?.title ||
      null;
    const title = pageContent.active?.pageTitle || pageContent.active?.title || null;
    if (app) lines.push(`פתוח עכשיו: **${app}**` + (title ? ` — ${title}` : "") + ".");
    if (pageContent.activeNav) lines.push(`ניווט פעיל: ${pageContent.activeNav}`);
    if (pageContent.headings?.length) {
      lines.push("כותרות במסך: " + pageContent.headings.slice(0, 6).join(" · "));
    }
    if (pageContent.answerChoices?.length) {
      lines.push(
        "אפשרויות תשובה על המסך: " + pageContent.answerChoices.map((c) => c.label).join(", ")
      );
    }
    const body = String(pageContent.text || "").trim();
    if (body) {
      const snippet = body.length > 900 ? `${body.slice(0, 900)}…` : body;
      lines.push("טקסט שנראה על המסך כרגע:\n" + snippet);
    }
    if (pageContent.media?.length) {
      lines.push(
        "תמונות על המסך: " +
          pageContent.media
            .slice(0, 5)
            .map((m) => m.flagCountry || m.alt || m.src)
            .join(" | ")
      );
    }
    if (lines.length) return lines.join("\n\n");
  }

  if (viewContext?.view === "workspace" && viewContext.active) {
    const a = viewContext.active;
    const url = a.url ? ` (${a.url})` : "";
    return (
      `פתוח כרגע: **${a.appName || a.module || a.title || "אפליקציה"}**${url}. ` +
      "יש אפליקציה פתוחה, אבל לא הצלחתי לשלוף את הטקסט מהמסך בסיבוב הזה. " +
      "אפשר לנסות שוב, או לבקש ממני לצלם את המסך."
    );
  }

  if (viewContext?.view === "desktop") {
    return "אתה על שולחן העבודה של My Space, אבל פרטי הרקע/האייקונים לא נטענו בסיבוב הזה.";
  }

  if (viewContext?.openTabs?.length) {
    return (
      "טאבים פתוחים: " +
      viewContext.openTabs.map((t) => t.appName || t.title || t.appId).join(", ")
    );
  }

  return null;
}

function isFlagQuizContext(viewContext) {
  const a = viewContext?.active || {};
  const id = String(a.module || a.appId || a.appName || "").toLowerCase();
  return /flag-?quiz|flag quiz|חידון דגל/.test(id);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function readPageFlag(ctx, retries = 2) {
  let pageContent = null;
  for (let i = 0; i <= retries; i++) {
    try {
      pageContent = await shellGetPageContent({ maxChars: AUTO_PAGE_CONTENT_CHARS }, ctx);
    } catch {
      pageContent = null;
    }
    if (pageContent?.ok) {
      if (pageContent.primaryFlag) {
        pageContent.primaryFlag = enrichPrimaryFlag(pageContent.primaryFlag);
      }
      if (!pageContent.primaryFlag?.flagCountry && Array.isArray(pageContent.media)) {
        const withFlag = pageContent.media.find((m) => m.flagCode || m.flagCountry);
        if (withFlag) pageContent.primaryFlag = enrichPrimaryFlag(withFlag);
      }
      if (pageContent.primaryFlag?.flagCountry) return pageContent;
    }
    if (i < retries) await sleep(180);
  }
  return pageContent;
}

function formatFlagDirectAnswer(flag) {
  const en = flag.flagCountry || null;
  const he = flag.flagCountryHe || null;
  const code = flag.flagCode || null;
  if (he && en) {
    return `הדגל שמוצג עכשיו על המסך הוא של **${he}** (${en}).`;
  }
  if (en) return `הדגל שמוצג עכשיו על המסך הוא של **${en}**.`;
  if (code) return `הדגל שמוצג מזוהה לפי המסך כקוד מדינה **${String(code).toUpperCase()}**.`;
  return null;
}

function looksLikeDesktopVisualQuestion(text) {
  const s = String(text || "");
  return /רקע|wallpaper|background|מיקום|position|layout|איפה|icons?|אייקונ|אפליקציות.*מסך|שולחן|desktop|מה אתה רואה|מה רואה|רואה את|see|look|מולך|לפניך/i.test(
    s
  );
}

function formatDesktopDirectAnswer(desktop) {
  if (!desktop) return null;
  const wp = desktop.wallpaperName || desktop.wallpaperId || "unknown";
  const icons = Array.isArray(desktop.icons) ? desktop.icons : [];
  const placed = icons.filter((ic) => ic.x != null || ic.y != null);
  const lines = [
    `אתה על שולחן העבודה של My Space.`,
    `הרקע הנוכחי: **${wp}**` + (desktop.wallpaperId ? ` (id: ${desktop.wallpaperId})` : "") + ".",
    `יש ${icons.length} אייקוני אפליקציות על השולחן` +
      (placed.length ? `, מתוכם ${placed.length} עם מיקום מותאם:` : "."),
  ];
  if (placed.length) {
    lines.push(
      placed
        .slice(0, 20)
        .map((ic) => `• ${ic.name}: x=${ic.x}, y=${ic.y}`)
        .join("\n")
    );
  } else if (icons.length) {
    lines.push(
      "מיקומים כרגע בפריסת ברירת מחדל. דוגמאות: " +
        icons
          .slice(0, 8)
          .map((ic) => ic.name)
          .join(", ")
    );
  }
  return lines.filter(Boolean).join("\n");
}

function formatScreenshotNote(capture) {
  if (capture?.ok && capture.images?.some((i) => i.source === "focal" && i.url)) {
    const focals = capture.images.filter((i) => i.url);
    return (
      `\n\nAlso captured focal image URL(s): ` +
      focals.map((i) => i.url).join(", ") +
      ". Prefer the VISIBLE FLAG ON SCREEN block from page content when present."
    );
  }
  return "";
}

function parseToolCall(text) {
  const raw = String(text || "");
  const m = raw.match(TOOL_CALL_RE);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[1].trim());
    const name = String(parsed?.name || parsed?.tool || "").trim();
    if (!name) return null;

    let arguments_ = {};
    if (parsed.arguments != null) {
      if (typeof parsed.arguments === "string") {
        const s = parsed.arguments.trim();
        try {
          const asJson = JSON.parse(s);
          arguments_ = typeof asJson === "object" && asJson ? asJson : { app: s };
        } catch {
          arguments_ = { app: s, value: s };
        }
      } else if (typeof parsed.arguments === "object") {
        arguments_ = { ...parsed.arguments };
      }
    }
    for (const key of [
      "app",
      "appId",
      "app_name",
      "page",
      "place",
      "x",
      "y",
      "title",
      "minutes",
      "maxChars",
      "max_chars",
    ]) {
      if (parsed[key] != null && arguments_[key] == null) {
        arguments_[key] = parsed[key];
      }
    }

    return { name, arguments: arguments_, rawBlock: m[0] };
  } catch {
    return null;
  }
}

function parseNativeToolCalls(message) {
  const calls = message?.tool_calls;
  if (!Array.isArray(calls) || !calls.length) return null;
  const first = calls[0];
  const name = String(first?.function?.name || first?.name || "").trim();
  if (!name) return null;
  let arguments_ = {};
  const rawArgs = first?.function?.arguments ?? first?.arguments;
  if (typeof rawArgs === "string" && rawArgs.trim()) {
    try {
      arguments_ = JSON.parse(rawArgs);
    } catch {
      arguments_ = { value: rawArgs };
    }
  } else if (rawArgs && typeof rawArgs === "object") {
    arguments_ = { ...rawArgs };
  }
  return { name, arguments: arguments_, rawBlock: null };
}

function stripToolCall(text) {
  return String(text || "").replace(TOOL_CALL_RE, "").trim();
}

function sanitizeToolResultForTrace(result) {
  if (!result || typeof result !== "object") return result;
  if (!result.screenshotDataUrl && !result.dataUrl && !result.screenshotImages) return result;
  const { screenshotDataUrl, dataUrl, screenshotImages, ...rest } = result;
  return {
    ...rest,
    screenshotAttached: true,
    screenshotBytes: result.bytes || undefined,
    imageCount: screenshotImages?.length || (screenshotDataUrl || dataUrl ? 1 : undefined),
  };
}

/**
 * @param {object} opts
 * @param {(path: string, init: object) => Promise<any>} opts.labFetch
 * @param {string} opts.model
 * @param {string} opts.program
 * @param {string} opts.conversationId
 * @param {Array<{role:string,content:string}>} opts.messages
 * @param {() => any} opts.getMainWindow
 */
async function runAgentLoop(opts) {
  const {
    labFetch,
    model,
    program,
    conversationId,
    messages,
    getMainWindow,
  } = opts;

  const trail = messages
    .map((m) => ({ role: m.role, content: m.content }))
    .filter((m) => !(m.role === "assistant" && looksLikeBlindAssistantReply(m.content)));
  const toolTrace = [];
  let lastUsage = null;
  let lastModel = model;

  const ctx = {
    getMainWindow,
    openClockPage: (page) => openClockPage(page, { getMainWindow }),
  };

  let viewContext = null;
  let pageContent = null;
  try {
    viewContext = await shellGetContext({}, ctx);
  } catch {
    viewContext = null;
  }

  const readable =
    viewContext?.view === "workspace" &&
    (viewContext?.active?.mode === "myapp" || viewContext?.active?.mode === "webview");
  const onFlagQuiz = isFlagQuizContext(viewContext);
  if (readable) {
    pageContent = await readPageFlag(ctx, onFlagQuiz ? 3 : 1);
  } else if (viewContext?.view === "desktop" || viewContext?.view === "external") {
    pageContent = {
      ok: false,
      error:
        viewContext.view === "desktop"
          ? "User is on the desktop — no in-app page text. Desktop wallpaper + icon positions are in the DESKTOP LAYOUT block of the view context. Use that to describe what is on the desktop."
          : "External Windows app — page text not readable from My Space. Prefer shell_capture_screen / display facts if needed.",
      view: viewContext.view,
      active: viewContext.active || null,
    };
  }

  pageContent = mergePublishedScreenFacts(viewContext, pageContent);

  let screenshot = null;
  let visionAttached = false;
  try {
    screenshot = await captureScreenForAi(getMainWindow?.(), {
      source: "auto",
      hideChat: true,
      maxWidth: 1000,
      quality: 70,
    });
    if (screenshot?.ok && pageContent?.ok && !pageContent.primaryFlag?.flagCountry) {
      const focalUrl = (screenshot.images || []).find((i) => i.url)?.url;
      if (focalUrl) {
        pageContent.primaryFlag = enrichPrimaryFlag({
          ...(pageContent.primaryFlag || {}),
          src: focalUrl,
        });
      }
    }
  } catch {
    screenshot = null;
  }

  if (onFlagQuiz && readable && !pageContent?.primaryFlag?.flagCountry) {
    const again = await readPageFlag(ctx, 2);
    if (again?.ok) pageContent = again;
    pageContent = mergePublishedScreenFacts(viewContext, pageContent);
  }

  const system = {
    role: "system",
    content:
      toolSystemPrompt() +
      formatViewContext(viewContext, pageContent) +
      formatScreenshotNote(screenshot) +
      "\n\nCRITICAL: You are ONLY the My Space OS assistant. You do NOT have GitHub, Notion, Gmail, YouTube, Google Sheets, or Google Calendar tools. " +
      "Screen facts and SCREEN IMAGE URL(s) are LIVE for THIS turn: trust them over chat history. " +
      "Answer the user's ACTUAL question freely: identify, describe appearance, give a hint without spoiling, or help with the app. " +
      "When SCREEN IMAGE URL(s) are listed, treat them as what is on screen and describe/identify from them. " +
      "If DESKTOP LAYOUT is present, use wallpaper/icon positions. " +
      "Never claim you cannot see the screen. Never ask the user to upload or paste a screenshot. " +
      "Stay strictly on-topic: do not mention stocks, other apps, or old chat topics unless the user asked about them.",
  };

  if (viewContext?.view === "desktop" && viewContext.desktop) {
    const d = viewContext.desktop;
    const topIcons = (d.icons || [])
      .filter((ic) => ic.x != null || ic.y != null)
      .slice(0, 12)
      .map((ic) => `${ic.name}@(${ic.x},${ic.y})`)
      .join(", ");
    const deskBits = [
      `LIVE DESKTOP: wallpaper="${d.wallpaperName || d.wallpaperId}"`,
      `${d.iconCount || 0} icons`,
      topIcons ? `positions: ${topIcons}` : "positions: default grid",
    ];
    for (let i = trail.length - 1; i >= 0; i--) {
      if (trail[i]?.role !== "user") continue;
      const prev = flattenMessageContent(trail[i].content);
      trail[i] = {
        role: "user",
        content: `${prev}\n\n[${deskBits.join(" · ")}]`,
      };
      break;
    }
  } else if (pageContent?.ok) {
    const bits = [];
    const flag = enrichPrimaryFlag(pageContent.primaryFlag || pageContent.quizFlag);
    if (flag?.flagCountry) {
      bits.push(
        `LIVE SCREEN FLAG: ${flag.flagCountry}` +
          (flag.flagCountryHe ? ` / ${flag.flagCountryHe}` : "") +
          ` (ISO ${flag.flagCode})`
      );
      const look = getVisualHint(flag.flagCode);
      if (look) bits.push(`LIVE FLAG APPEARANCE: ${look}`);
      pageContent.primaryFlag = flag;
    } else if (Array.isArray(pageContent.media) && pageContent.media.length) {
      bits.push(
        "LIVE SCREEN IMAGES: " +
          pageContent.media
            .slice(0, 5)
            .map((m) => m.flagCountry || m.alt || m.src)
            .join(" | ")
      );
    }
    if (pageContent.answerChoices?.length) {
      bits.push(
        "LIVE CHOICES: " + pageContent.answerChoices.map((c) => c.label).join(", ")
      );
    }
    if (bits.length) {
      for (let i = trail.length - 1; i >= 0; i--) {
        if (trail[i]?.role !== "user") continue;
        const prev = flattenMessageContent(trail[i].content);
        trail[i] = {
          role: "user",
          content: `${prev}\n\n[${bits.join(" · ")}]`,
        };
        break;
      }
    }
  }

  {
    const attached = attachScreenUrlsToLastUser(trail, screenshot, pageContent);
    if (attached.attached) {
      trail.splice(0, trail.length, ...attached.messages);
      visionAttached = true;
    }
  }

  const userQ = lastUserText(trail);
  const hintOnly = looksLikeHintOnly(userQ);

  let wrongUniverseRetries = 0;
  let blindRetries = 0;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const payloadMessages = messagesForLab(system, trail);
    const data = await labChatCompletions(labFetch, {
      model,
      program,
      messages: payloadMessages,
    });
    lastUsage = data?.usage || lastUsage;
    lastModel = data?.model || lastModel;
    const message = data?.choices?.[0]?.message || {};
    const content = message.content || "";
    const call = parseToolCall(content) || parseNativeToolCalls(message);

    if (!call) {
      const foreign = looksLikeWrongToolUniverse(content);
      const blind = looksLikeBlindAssistantReply(content);
      const freshGrounded = buildGroundedScreenReply(viewContext, pageContent, {
        userText: userQ,
        hintOnly,
        describeOnly: looksLikeDescribeQuestion(userQ),
      });

      if (blind && freshGrounded) {
        return {
          ok: true,
          content: freshGrounded,
          model: lastModel,
          usage: lastUsage,
          toolsUsed: toolTrace,
          conversationId,
          screenMediaAttached: !!visionAttached,
          correctedFromModelConfusion: true,
        };
      }

      if (blind && blindRetries < 1) {
        blindRetries += 1;
        if (readable) {
          const again = await readPageFlag(ctx, 2);
          if (again?.ok) pageContent = again;
          pageContent = mergePublishedScreenFacts(viewContext, pageContent);
        }
        const retryGrounded = buildGroundedScreenReply(viewContext, pageContent, {
          userText: userQ,
          hintOnly,
          describeOnly: looksLikeDescribeQuestion(userQ),
        });
        if (retryGrounded) {
          return {
            ok: true,
            content: retryGrounded,
            model: "myspace-screen",
            usage: lastUsage,
            toolsUsed: toolTrace,
            conversationId,
            screenMediaAttached: !!visionAttached,
            correctedFromModelConfusion: true,
          };
        }
      }

      if (foreign && wrongUniverseRetries < 2) {
        wrongUniverseRetries += 1;
        trail.push({ role: "assistant", content: content || "(confused about tools)" });
        trail.push({
          role: "user",
          content:
            "STOP. You are NOT in Cursor Automations / Gmail / GitHub / Notion / YouTube. " +
            "Those tools do not exist here. You are the My Space desktop assistant. " +
            (freshGrounded
              ? `Screen facts: ${freshGrounded.slice(0, 500)}. Answer from these facts now.`
              : "Answer using only the auto-attached My Space screen facts / tools."),
        });
        continue;
      }

      if (looksLikeBlindAssistantReply(content) && freshGrounded) {
        return {
          ok: true,
          content: freshGrounded,
          model: lastModel,
          usage: lastUsage,
          toolsUsed: toolTrace,
          conversationId,
          screenMediaAttached: true,
          correctedFromModelConfusion: true,
        };
      }

      return {
        ok: true,
        content: content || "(empty response)",
        model: lastModel,
        usage: lastUsage,
        toolsUsed: toolTrace,
        conversationId,
        screenMediaAttached: !!(
          visionAttached ||
          pageContent?.primaryFlag ||
          pageContent?.media?.length ||
          viewContext?.desktop
        ),
      };
    }

    const resolvedPre = resolveToolName(call.name);
    const confirmName = resolvedPre.name || call.name;
    let result;
    if (needsConfirm(confirmName)) {
      const decision = await requestActionConfirm(getMainWindow, {
        name: confirmName,
        arguments: call.arguments || {},
      });
      if (!decision.approved) {
        result = {
          ok: false,
          declined: true,
          error: "User declined this action",
          reason: decision.reason || "skipped",
          tool: confirmName,
          label: describeAction(confirmName, call.arguments || {}),
        };
      } else {
        result = await executeTool(call.name, call.arguments, ctx);
        if (decision.auto && result && typeof result === "object") {
          result.confirmAuto = true;
        }
      }
    } else {
      result = await executeTool(call.name, call.arguments, ctx);
    }
    const resolvedName = result?.resolvedTool || confirmName || call.name;
    toolTrace.push({
      name: call.name,
      arguments: call.arguments,
      result: sanitizeToolResultForTrace(result),
      resolvedTool: result?.resolvedTool || (resolvedName !== call.name ? resolvedName : undefined),
      label: describeAction(resolvedName, call.arguments || {}),
      declined: !!result?.declined,
    });

    const visible = stripToolCall(content);
    trail.push({
      role: "assistant",
      content: visible
        ? `${visible}\n\n(Called tool ${call.name})`
        : `(Called tool ${call.name})`,
    });

    if (result?.ok && (result.screenshotDataUrl || result.focalUrls?.length || result.primaryFlag || result.dataUrl)) {
      const flag = result.primaryFlag;
      const urls = Array.isArray(result.focalUrls) ? result.focalUrls.filter((u) => /^https?:/i.test(u)) : [];
      if (flag?.flagCode) {
        const cdn = `https://flagcdn.com/w320/${String(flag.flagCode).toLowerCase()}.png`;
        if (!urls.includes(cdn)) urls.push(cdn);
      }
      trail.push({
        role: "user",
        content:
          `Tool result for ${resolvedName}:\n` +
          JSON.stringify(
            {
              ok: true,
              source: result.source,
              width: result.width,
              height: result.height,
              focalUrls: urls.length ? urls : result.focalUrls || undefined,
              primaryFlag: flag || undefined,
              appearance: flag?.flagCode ? getVisualHint(flag.flagCode) : undefined,
              note:
                "SCREEN IMAGE URL(s) above are what is on screen. Answer the user's actual question freely.",
            },
            null,
            2
          ) +
          (urls.length
            ? `\n\nSCREEN IMAGE URL(s):\n${urls.map((u, i) => `${i + 1}. ${u}`).join("\n")}`
            : "") +
          `\n\nContinue and answer the user in plain text.`,
      });
      continue;
    }

    const roundsLeft = MAX_TOOL_ROUNDS - round - 1;
    trail.push({
      role: "user",
      content:
        `Tool result for ${call.name}:\n` +
        JSON.stringify(sanitizeToolResultForTrace(result), null, 2) +
        (roundsLeft <= 1
          ? `\n\nThis is your last tool round. Answer the user now in plain text. Do NOT call another tool.`
          : `\n\nContinue. If you already have enough to answer, reply to the user in plain text (no tool call). Only emit <<tool_call>>…<</tool_call>> if you still need another tool.`),
    });
  }

  const summaryBits = toolTrace.map((t, i) => {
    const slim =
      typeof t.result === "object"
        ? JSON.stringify(t.result).slice(0, 1200)
        : String(t.result ?? "");
    return `${i + 1}. ${t.name}(${JSON.stringify(t.arguments || {})}) → ${slim}`;
  });
  trail.push({
    role: "user",
    content:
      `You hit the tool-call limit (${MAX_TOOL_ROUNDS}). Do NOT call any more tools.\n` +
      `Answer the user now in plain text using these results:\n` +
      summaryBits.join("\n"),
  });

  try {
    const finalData = await labChatCompletions(labFetch, {
      model,
      program,
      messages: [
        {
          role: "system",
          content:
            "You are the My Space desktop assistant. Answer helpfully in plain text. Do not emit tool calls. Do not say you cannot see the screen if screen facts or images were provided.",
        },
        ...trail.map((m) => ({ role: m.role, content: contentForLab(m.content) })),
      ],
    });
    lastUsage = finalData?.usage || lastUsage;
    lastModel = finalData?.model || lastModel;
    const finalMessage = finalData?.choices?.[0]?.message || {};
    let finalContent = String(finalMessage.content || "").trim();
    finalContent = stripToolCall(finalContent);
    if (looksLikeBlindAssistantReply(finalContent)) {
      const g = buildGroundedScreenReply(viewContext, pageContent, {
        userText: userQ,
        hintOnly,
      });
      if (g) finalContent = g;
    }
    if (finalContent) {
      return {
        ok: true,
        content: finalContent,
        model: lastModel,
        usage: lastUsage,
        toolsUsed: toolTrace,
        conversationId,
        toolLimitReached: true,
      };
    }
  } catch {
  }

  const lastOk = [...toolTrace].reverse().find((t) => t?.result?.ok);
  return {
    ok: true,
    content: lastOk
      ? `I gathered data with ${toolTrace.length} tool call(s) but ran out of rounds before a full reply. Latest useful result from ${lastOk.name}:\n` +
        JSON.stringify(lastOk.result, null, 2).slice(0, 2500)
      : "I used several tools but could not finish a clear answer. Please try a more specific request.",
    model: lastModel,
    usage: lastUsage,
    toolsUsed: toolTrace,
    conversationId,
    toolLimitReached: true,
  };
}

module.exports = {
  runAgentLoop,
  parseToolCall,
  TOOL_CALL_RE,
};
