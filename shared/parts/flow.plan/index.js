const TOOL_ALIASES = {
  gmail: "email",
  mail: "email",
  inbox: "email",
  googlesheets: "sheets",
  google_sheets: "sheets",
  spreadsheet: "sheets",
  sheet: "sheets",
  notification: "notify",
  toast: "notify",
  github: "github",
  reddit: "reddit",
  composio_search: "search",
  googlesuper: "google",
  google_super: "google",
  web_search: "search",
};

const DEFAULT_TOOL_IDS = new Set([
  "model",
  "email",
  "sheets",
  "notify",
  "shell",
  "stocks",
  "translate",
  "contacts",
  "wait",
  "calendar",
  "files",
  "web",
  "github",
  "reddit",
  "search",
  "google",
]);

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function clip(text, max = 4000) {
  const s = String(text || "").trim();
  return s.length > max ? s.slice(0, max) : s;
}

function isEmailReadIntent(text) {
  const t = String(text || "");
  const lower = t.toLowerCase();
  if (/(?:שלח|send|compose|כתוב)\s+.*(?:מייל|email|mail)/i.test(t)) return false;
  if (/(?:מייל|email|mail).*(?:שלח|send)/i.test(t)) return false;
  return (
    /(?:מה|what|which|show|הצג|תראה).*(?:מייל|email|mail|inbox)/i.test(t) ||
    /(?:מייל|email|mail|inbox).*(?:אחרון|last|קיבל|received|unread|inbox|נכנס)/i.test(t) ||
    /(?:last|latest|recent).*(?:email|mail|inbox)/i.test(lower) ||
    /(?:המייל האחרון|מייל אחרון|last email|latest email)/i.test(t)
  );
}

function isSheetsIntent(text) {
  return /sheet|sheets|גיליון|גיליונות|spreadsheet|google\s*sheet/i.test(String(text || ""));
}

function isEmailSendIntent(text) {
  const t = String(text || "");
  if (isEmailReadIntent(t)) return false;
  if (isSheetsIntent(t)) return false;
  return /מייל|email|mail|שלח/.test(t.toLowerCase()) || /send\s+.*mail/i.test(t);
}

function canonicalizeTool(raw) {
  const id = String(raw || "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
  return TOOL_ALIASES[id] || id;
}

function defaultStepLabel(tool, config = {}) {
  const action = String(config.action || "").toLowerCase();
  switch (tool) {
    case "model":
      return "Model";
    case "email":
      return action === "send" ? "Send email" : "Read inbox";
    case "sheets":
      return action === "update" ? "Update spreadsheet" : "Create spreadsheet";
    case "notify":
      return "Notify";
    case "shell":
      return "Shell";
    case "stocks":
      return config.symbol ? `Fetch ${String(config.symbol).toUpperCase()}` : "Stocks";
    case "translate":
      return "Translate";
    case "contacts":
      return "Contacts";
    case "wait":
      return config.seconds ? `Wait ${config.seconds}s` : "Wait";
    case "calendar":
      return "Calendar";
    case "files":
      return "Files";
    case "web":
      return "Web";
    case "github":
      return "GitHub";
    case "reddit":
      return "Reddit";
    case "search":
      return "Search";
    case "google":
      return "Google";
    default:
      return tool || "Step";
  }
}

function configChips(config = {}) {
  const chips = [];
  for (const [k, v] of Object.entries(config)) {
    if (v == null || v === "") continue;
    if (k === "task" || k === "prompt" || k === "body" || k === "text") continue;
    chips.push({ key: k, value: String(v).slice(0, 48) });
  }
  return chips.slice(0, 6);
}

function localPlan(task) {
  const t = String(task || "").trim();
  const lower = t.toLowerCase();
  const steps = [];
  const wantsSheets = isSheetsIntent(t);
  const wantsEmailRead =
    isEmailReadIntent(t) || (wantsSheets && /מייל|email|mail|inbox/i.test(t));

  steps.push({
    id: uid("step"),
    tool: "model",
    label: "Understand the request",
    description: "Parse the goal and decide which general tool stages are needed.",
    config: { task: clip(t, 500) },
  });

  if (wantsEmailRead) {
    steps.push({
      id: uid("step"),
      tool: "email",
      label: "Read latest inbox mail",
      description: "Fetch the most recent message from the inbox (not send).",
      config: { action: "read", folder: "inbox", which: "last" },
    });
    if (!wantsSheets) {
      steps.push({
        id: uid("step"),
        tool: "model",
        label: "Summarize for the user",
        description: "Turn the fetched mail into a clear answer.",
        config: { prompt: "Summarize the last email for the user in their language." },
      });
    }
  } else if (isEmailSendIntent(t)) {
    const toMatch = t.match(/(?:to|אל|ל)\s+([A-Za-zא-ת][\wא-ת.@\s-]{1,40})/i);
    steps.push({
      id: uid("step"),
      tool: "model",
      label: "Draft the email",
      description: "Write subject and body from the request.",
      config: { task: clip(t, 500) },
    });
    steps.push({
      id: uid("step"),
      tool: "email",
      label: "Send email",
      description: "Deliver the drafted message.",
      config: {
        action: "send",
        to: toMatch?.[1]?.trim() || "",
        subject: "",
        body: "",
      },
    });
  }

  if (wantsSheets) {
    steps.push({
      id: uid("step"),
      tool: "sheets",
      label: "Create spreadsheet",
      description: "Create a Google Sheet and write the prepared content.",
      config: {
        action: "create",
        title: wantsEmailRead ? "Last email" : "New sheet",
        contentFrom: wantsEmailRead ? "last_email" : "task",
      },
    });
  }

  if (/מני|stock|ticker|nasdaq|aapl|quote/.test(lower) && !wantsEmailRead) {
    const sym = (t.match(/\b([A-Z]{1,5})\b/) || [])[1] || "AAPL";
    steps.push({
      id: uid("step"),
      tool: "stocks",
      label: `Fetch ${sym}`,
      description: "Pull market context for the symbol.",
      config: { symbol: sym.toUpperCase() },
    });
  }

  if (/תרג|translat/.test(lower)) {
    steps.push({
      id: uid("step"),
      tool: "translate",
      label: "Translate text",
      description: "Language conversion stage.",
      config: { text: clip(t, 400), to: /עבר|hebrew|\bhe\b/i.test(lower) ? "he" : "en" },
    });
  }

  if (/contact|איש קשר/.test(lower) && !wantsEmailRead) {
    steps.push({
      id: uid("step"),
      tool: "contacts",
      label: "Resolve contact",
      description: "Find the person in Contacts.",
      config: { query: clip(t, 80) },
    });
  }

  if (/(?:^|\s)(?:open|פתח|run |הרץ)\b/i.test(t) && !wantsEmailRead && !wantsSheets) {
    steps.push({
      id: uid("step"),
      tool: "shell",
      label: "Run shell action",
      description: "My Space shell command stage.",
      config: { command: "check running" },
    });
  }

  steps.push({
    id: uid("step"),
    tool: "notify",
    label: wantsSheets ? "Share the sheet link" : wantsEmailRead ? "Tell the user" : "Confirm completion",
    description: wantsSheets
      ? "Surface the spreadsheet title and URL."
      : wantsEmailRead
        ? "Surface the answer about the last email."
        : "Notify that the approved flow finished.",
    config: {
      message: wantsSheets ? "Sheet ready" : wantsEmailRead ? "Answer ready" : "Flow finished",
    },
  });

  let summary = "Local planner draft: model Lab builds richer flows when available.";
  if (wantsEmailRead && wantsSheets) summary = "Read inbox → create Google Sheet → share link.";
  else if (wantsEmailRead) summary = "Read inbox → summarize → answer (not send).";
  else if (wantsSheets) summary = "Create Google Sheet → share link.";

  return {
    id: uid("flow"),
    title: clip(t, 72) || "Untitled flow",
    summary,
    task: t,
    steps,
    source: "local",
  };
}

function extractJsonObject(text) {
  const raw = String(text || "").trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1].trim() : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeFlow(parsed, task, toolIds = DEFAULT_TOOL_IDS) {
  const ids = toolIds instanceof Set ? toolIds : new Set(toolIds || DEFAULT_TOOL_IDS);
  const stepsIn = Array.isArray(parsed?.steps) ? parsed.steps : [];
  let steps = stepsIn
    .map((s, i) => {
      const tool = canonicalizeTool(s.tool || s.type || "");
      if (!ids.has(tool)) return null;
      const config = s.config && typeof s.config === "object" ? { ...s.config } : {};
      if (tool === "email" && !config.action) {
        config.action = config.to || config.subject || config.body ? "send" : "read";
      }
      if (tool === "sheets" && !config.action) {
        config.action = "create";
      }
      const rawLabel = String(s.label || s.title || "").trim();
      const labelLooksWrong =
        !rawLabel ||
        (tool === "email" &&
          config.action === "read" &&
          /send|draft|prepare|שלח/i.test(rawLabel)) ||
        (tool === "sheets" && /email|mail|send|draft/i.test(rawLabel));
      return {
        id: String(s.id || uid("step")),
        tool,
        label: (labelLooksWrong ? defaultStepLabel(tool, config) : rawLabel).slice(0, 80),
        description: String(s.description || s.detail || "").slice(0, 240),
        config,
        chips: configChips(config),
        order: i,
      };
    })
    .filter(Boolean)
    .slice(0, 12);

  const wantsSheets = isSheetsIntent(task);
  const wantsEmailRead =
    isEmailReadIntent(task) || (wantsSheets && /מייל|email|mail|inbox/i.test(String(task || "")));

  if (wantsEmailRead && !wantsSheets) {
    const hasRead = steps.some(
      (s) => s.tool === "email" && String(s.config?.action || "").toLowerCase() === "read"
    );
    const looksLikeSend = steps.some(
      (s) =>
        s.tool === "email" &&
        (String(s.config?.action || "").toLowerCase() === "send" ||
          s.config?.to ||
          /prepare|send|שלח/i.test(s.label || ""))
    );
    if (!hasRead || looksLikeSend) {
      return localPlan(task);
    }
  }

  if (wantsSheets) {
    const hasSheets = steps.some((s) => s.tool === "sheets");
    const mistypedAsEmailSend = steps.some(
      (s) => s.tool === "email" && String(s.config?.action || "").toLowerCase() === "send"
    );
    if (!hasSheets || mistypedAsEmailSend) {
      return localPlan(task);
    }
  }

  if (!steps.length) return localPlan(task);

  steps = steps.map((s) => ({ ...s, chips: configChips(s.config) }));

  return {
    id: uid("flow"),
    title: String(parsed.title || clip(task, 72) || "Proposed flow").slice(0, 100),
    summary: String(parsed.summary || "").slice(0, 280),
    task: String(task || ""),
    steps,
    source: "model",
  };
}

function isAckNoise(text) {
  return /request understood|ready for tool stages|flow finished|answer ready|sheet ready|draft ready/i.test(
    String(text || "")
  );
}

function extractUrls(text) {
  const out = [];
  const re = /https?:\/\/[^\s)\]>"']+/gi;
  let m;
  while ((m = re.exec(String(text || ""))) !== null) {
    let url = m[0].replace(/[.,;:]+$/, "");
    if (!out.some((u) => u.url === url)) {
      const label = /docs\.google\.com\/spreadsheets/i.test(url)
        ? "Open sheet"
        : /mail\.google\.com/i.test(url)
          ? "Open in Gmail"
          : "Open link";
      out.push({ label, url });
    }
  }
  return out.slice(0, 4);
}

function parseLabScaffold(text) {
  const raw = String(text || "");
  const toolkit =
    (raw.match(/\bToolkit:\s*([A-Za-z0-9_-]+)/i) || [])[1] ||
    (raw.match(/\btoolkit["']?\s*[:=]\s*["']?([A-Za-z0-9_-]+)/i) || [])[1] ||
    null;
  const action =
    (raw.match(/\bAction:\s*([A-Za-z0-9_+-]+)/i) || [])[1] ||
    (raw.match(/\baction["']?\s*[:=]\s*["']?([A-Za-z0-9_+-]+)/i) || [])[1] ||
    null;
  let summary = raw;
  const sumMatch = raw.match(/\bSummary:\s*([\s\S]*?)(?=\n(?:Next:|Prefer setting|To continue)|$)/i);
  if (sumMatch) summary = sumMatch[1].trim();
  else {
    summary = raw
      .replace(/\bOK:\s*(true|false)\b/gi, "")
      .replace(/\bToolkit:\s*[A-Za-z0-9_-]+/gi, "")
      .replace(/\bAction:\s*[A-Za-z0-9_+-]+/gi, "")
      .trim();
  }
  return { toolkit, action, summary: clip(summary, 500) };
}

const api = {
  TOOL_ALIASES,
  DEFAULT_TOOL_IDS,
  uid,
  clip,
  isEmailReadIntent,
  isEmailSendIntent,
  isSheetsIntent,
  canonicalizeTool,
  defaultStepLabel,
  configChips,
  localPlan,
  extractJsonObject,
  normalizeFlow,
  isAckNoise,
  extractUrls,
  parseLabScaffold,
};

if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.PartsFlowPlan = api;