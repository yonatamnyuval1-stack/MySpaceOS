const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const DEFAULT_BASE_URL = process.env.MODEL_FLOW_BASE_URL || "http://127.0.0.1:8080/v1";
const DEFAULT_MODEL = "primary";
const LAB_PROGRAM = "model flow";
const LAB_PLAN = "model flow";
const PRODUCT_LAB_API_KEY =
  process.env.MODEL_FLOW_PRODUCT_KEY ||
  "lab_ac8da903c9aca2075f9faaf035b39876154b8e8c096ad3ad57b42302abdfce0b";

const WIRED_TOOL_IDS = new Set([
  "model",
  "email",
  "sheets",
  "notify",
  "shell",
  "stocks",
  "translate",
  "contacts",
  "wait",
]);

let LIVE_TOOL_IDS = new Set([
  "model",
  "email",
  "sheets",
  "notify",
  "shell",
  "stocks",
  "translate",
  "contacts",
  "wait",
]);

const BASE_TOOLS = [
  {
    id: "model",
    live: true,
    description: "General AI stage: think, draft, summarize, or transform before/after other tools",
  },
  {
    id: "email",
    live: true,
    description:
      "Email stage via Model Lab Gmail. READ inbox (last/unread) OR SEND. Always set config.action to \"read\" or \"send\".",
  },
  {
    id: "sheets",
    live: true,
    description:
      "Google Sheets stage via Model Lab. CREATE a spreadsheet or UPDATE cells. Set config.action to \"create\" or \"update\".",
  },
  {
    id: "notify",
    live: true,
    description: "Notify stage: toast / alert when a milestone completes",
  },
  {
    id: "shell",
    live: true,
    description: "Shell stage: run a My Space command (today(list), stocks(AAPL), …)",
  },
  {
    id: "stocks",
    live: true,
    description: "Stocks stage: live quotes for a symbol",
  },
  {
    id: "translate",
    live: true,
    description: "Translate stage: language conversion",
  },
  {
    id: "contacts",
    live: true,
    description: "Contacts stage: search/list people",
  },
  {
    id: "wait",
    live: true,
    description: "Wait stage: pause the flow for a few seconds before the next step",
  },
  {
    id: "calendar",
    live: false,
    description: "Calendar stage: schedule or list events",
  },
  {
    id: "files",
    live: false,
    description: "Files stage: read/write workspace files",
  },
  {
    id: "web",
    live: false,
    description: "Web stage: fetch public URL context",
  },
];

const LAB_TOOLKIT_TO_FLOW = {
  gmail: "email",
  mail: "email",
  googlesheets: "sheets",
  google_sheets: "sheets",
  spreadsheet: "sheets",
  sheet: "sheets",
  googlesuper: "google",
  google_super: "google",
  composio_search: "search",
  web_search: "search",
  search: "search",
};

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

const PROVIDER_LABELS = {
  gmail: "Gmail",
  googlesheets: "Google Sheets",
  google_sheets: "Google Sheets",
  googlesuper: "Google",
  github: "GitHub",
  reddit: "Reddit",
  composio_search: "Search",
  stocks: "Stocks",
  translate: "Translate",
  model: "Model",
};

const LAB_TOOLS_TTL_MS = 5 * 60 * 1000;
const LAB_TOOLKIT_FETCH_MS = 12_000;
const LAB_CHAT_TIMEOUT_MS = 55_000;
const LAB_TOOL_STEP_MS = 90_000;
let labToolkitsCache = { at: 0, items: [], error: null };
let mergedToolsCache = {
  at: 0,
  tools: [],
  liveIds: new Set(LIVE_TOOL_IDS),
};
let labToolsInflight = null;

/** @deprecated use mergedToolsCache — kept for module export compat */
const TOOLS = BASE_TOOLS;

const LAB_REPLY_RULES = [
  "Reply in clear human language only.",
  "Never include scaffolding like: OK:, Toolkit:, Action:, ResourceIds:, Summary:, Next:, Prefer setting action.",
  "Do not paste raw JSON or HTML.",
  "If you created a link, include the URL once on its own line.",
].join(" ");

function secretsPath() {
  return path.join(app.getPath("userData"), "model-flow-secrets.json");
}

function historyPath() {
  return path.join(app.getPath("userData"), "model-flow-history.json");
}

function libraryPath() {
  return path.join(app.getPath("userData"), "model-flow-library.json");
}

function loadSecrets() {
  try {
    const raw = fs.readFileSync(secretsPath(), "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveSecrets(data) {
  fs.writeFileSync(secretsPath(), JSON.stringify(data, null, 2), "utf8");
}

function getApiConfig() {
  const secrets = loadSecrets();
  const fromEnv = String(process.env.MODEL_FLOW_API_KEY || "").trim();
  const fromSecrets = String(secrets.apiKey || "").trim();
  const fromProduct = String(PRODUCT_LAB_API_KEY || "").trim();
  const apiKey = fromEnv || fromSecrets || fromProduct || null;
  const keySource = fromEnv ? "env" : fromSecrets ? "secrets" : fromProduct ? "product" : null;
  const baseUrl = String(process.env.MODEL_FLOW_BASE_URL || secrets.baseUrl || DEFAULT_BASE_URL)
    .trim()
    .replace(/\/$/, "");
  const model = String(process.env.MODEL_FLOW_MODEL || secrets.model || DEFAULT_MODEL).trim();
  return {
    apiKey,
    keySource,
    baseUrl,
    model,
    program: LAB_PROGRAM,
    plan: LAB_PLAN,
  };
}

function toolsForClient(tools = mergedToolsCache.tools) {
  const list = tools?.length ? tools : BASE_TOOLS;
  return list.map((t) => ({
    id: t.id,
    description: t.description,
    live: LIVE_TOOL_IDS.has(t.id) || t.live === true,
    labToolkit: t.labToolkit || null,
    source: t.source || "base",
  }));
}

function invalidateLabToolsCache() {
  labToolkitsCache = { at: 0, items: [], error: null };
  mergedToolsCache = { at: 0, tools: [], liveIds: new Set(WIRED_TOOL_IDS) };
  LIVE_TOOL_IDS.clear();
  for (const id of WIRED_TOOL_IDS) LIVE_TOOL_IDS.add(id);
  labToolsInflight = null;
}

function mapLabToolkitToFlowId(toolkitId) {
  const raw = String(toolkitId || "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
  return LAB_TOOLKIT_TO_FLOW[raw] || TOOL_ALIASES[raw] || raw;
}

function rebuildMergedTools(labToolkits = []) {
  const byId = new Map(BASE_TOOLS.map((t) => [t.id, { ...t, source: "base" }]));
  const liveIds = new Set(WIRED_TOOL_IDS);

  for (const tk of labToolkits) {
    const labId = String(tk?.id || tk?.name || "")
      .toLowerCase()
      .trim()
      .replace(/[\s-]+/g, "_");
    if (!labId) continue;
    const flowId = mapLabToolkitToFlowId(labId);
    const description =
      String(tk?.description || tk?.name || labId).trim() ||
      `Lab toolkit: ${labId}`;
    const prev = byId.get(flowId);
    if (prev) {
      byId.set(flowId, {
        ...prev,
        description: description || prev.description,
        live: true,
        labToolkit: labId,
        source: "lab",
      });
    } else {
      byId.set(flowId, {
        id: flowId,
        live: true,
        labToolkit: labId,
        description,
        source: "lab",
      });
    }
    liveIds.add(flowId);
  }

  const tools = [...byId.values()];
  LIVE_TOOL_IDS.clear();
  for (const id of liveIds) LIVE_TOOL_IDS.add(id);
  mergedToolsCache = { at: Date.now(), tools, liveIds: new Set(LIVE_TOOL_IDS) };
  return mergedToolsCache;
}

function extractMessageText(data) {
  const layer0Text = String(data?.layer0?.output?.text || "").trim();
  const content = data?.choices?.[0]?.message?.content;

  let fromContent = "";
  if (typeof content === "string") {
    fromContent = content.trim();
  } else if (Array.isArray(content)) {
    fromContent = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (!part || typeof part !== "object") return "";
        if (part.text) return String(part.text);
        if (part.json != null) {
          try {
            return typeof part.json === "string" ? part.json : JSON.stringify(part.json);
          } catch {
            return "";
          }
        }
        return "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  if (layer0Text && layer0Text.length >= fromContent.length) return layer0Text;
  if (fromContent) return fromContent;
  return layer0Text;
}

function summarizeLabActivity(activity) {
  if (!Array.isArray(activity) || !activity.length) return "";
  const lines = [];
  for (const a of activity.slice(0, 8)) {
    const tool = a?.tool || a?.name || a?.toolkit;
    const out = a?.output || a?.result || a?.summary || a?.message;
    if (!tool && !out) continue;
    const bit = typeof out === "string" ? out : out ? JSON.stringify(out).slice(0, 240) : "";
    lines.push(bit ? `${tool}: ${bit}` : String(tool));
  }
  return lines.join("\n").trim();
}

function parseLabToolkitsFromResponse(data) {
  const fromJson = data?.layer0?.output?.json?.toolkits;
  if (Array.isArray(fromJson) && fromJson.length) return fromJson;

  const text = extractMessageText(data);
  const parsed = extractJsonObject(text);
  if (Array.isArray(parsed?.toolkits) && parsed.toolkits.length) return parsed.toolkits;

  return [];
}

async function labHttp(cfg, { messages, temperature = 0.2, timeoutMs = LAB_CHAT_TIMEOUT_MS } = {}) {
  if (!cfg?.apiKey) throw new Error("Model Lab API key missing");
  const url = `${cfg.baseUrl}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(3000, timeoutMs));
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
        "X-Lab-Program": cfg.program || LAB_PROGRAM,
      },
      body: JSON.stringify({
        model: cfg.model || DEFAULT_MODEL,
        user: cfg.program || LAB_PROGRAM,
        plan: cfg.plan || LAB_PLAN,
        messages,
        temperature,
      }),
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(`Model Lab timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  const rawText = await res.text();
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = { raw: rawText };
  }

  if (!res.ok) {
    throw new Error(formatLabHttpError(res, data));
  }

  return data;
}

async function fetchLabToolkits(cfg) {
  if (!cfg?.apiKey) return [];
  const data = await labHttp(cfg, {
    timeoutMs: LAB_TOOLKIT_FETCH_MS,
    temperature: 0,
    messages: [
      {
        role: "user",
        content:
          'List every toolkit enabled for this plan. : {"toolkits":[{"id":"toolkit_id","name":"Name","description":"..."}]}',
      },
    ],
  });
  return parseLabToolkitsFromResponse(data);
}

function scheduleLabToolsRefresh(cfg) {
  if (labToolsInflight) return labToolsInflight;
  labToolsInflight = (async () => {
    try {
      const toolkits = await fetchLabToolkits(cfg);
      labToolkitsCache = { at: Date.now(), items: toolkits, error: null };
      return rebuildMergedTools(toolkits);
    } catch (err) {
      labToolkitsCache = {
        at: Date.now(),
        items: labToolkitsCache.items,
        error: err.message || String(err),
      };
      if (!mergedToolsCache.tools.length) rebuildMergedTools([]);
      return mergedToolsCache.tools.length ? mergedToolsCache : rebuildMergedTools([]);
    } finally {
      labToolsInflight = null;
    }
  })();
  return labToolsInflight;
}

async function ensureLabTools(cfg = getApiConfig(), { wait = false } = {}) {
  if (!cfg.apiKey) {
    return rebuildMergedTools([]);
  }

  const hasCache = mergedToolsCache.tools.length > 0 && labToolkitsCache.at > 0;
  const stale = !labToolkitsCache.at || Date.now() - labToolkitsCache.at > LAB_TOOLS_TTL_MS;

  if (hasCache && !stale) return mergedToolsCache;

  if (hasCache && stale) {
    scheduleLabToolsRefresh(cfg);
    return mergedToolsCache;
  }

  if (wait) {
    return scheduleLabToolsRefresh(cfg);
  }

  if (!mergedToolsCache.tools.length) rebuildMergedTools([]);
  scheduleLabToolsRefresh(cfg);
  return mergedToolsCache.tools.length ? mergedToolsCache : rebuildMergedTools([]);
}

function getMergedTools() {
  return mergedToolsCache.tools.length ? mergedToolsCache.tools : BASE_TOOLS;
}

function getToolIdSet() {
  return new Set(getMergedTools().map((t) => t.id));
}

function labToolkitForTool(toolId) {
  const entry = getMergedTools().find((t) => t.id === toolId);
  return entry?.labToolkit || null;
}

function isLabExecutableTool(toolId) {
  return Boolean(labToolkitForTool(toolId)) && !["notify"].includes(toolId);
}

rebuildMergedTools([]);

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function clip(text, max = 4000) {
  const s = String(text || "").trim();
  return s.length > max ? s.slice(0, max) : s;
}

function formatLabHttpError(res, data) {
  const code = data?.error?.code || data?.error?.type || "";
  const msg =
    data?.error?.message ||
    data?.message ||
    data?.error ||
    (typeof data?.raw === "string" ? data.raw.slice(0, 200) : null) ||
    `HTTP ${res.status}`;
  const text = typeof msg === "string" ? msg : JSON.stringify(msg);
  if (res.status === 402 || /insufficient|billing|quota|balance/i.test(`${code} ${text}`)) {
    return (
      "Model Lab balance is empty for plan “model flow”. " +
      "Top up that Lab key/plan, then retry."
    );
  }
  return text;
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

function isEmailSendIntent(text) {
  const t = String(text || "");
  if (isEmailReadIntent(t)) return false;
  if (isSheetsIntent(t)) return false;
  return /מייל|email|mail|שלח/.test(t.toLowerCase()) || /send\s+.*mail/i.test(t);
}

function isSheetsIntent(text) {
  return /sheet|sheets|גיליון|גיליונות|spreadsheet|google\s*sheet/i.test(String(text || ""));
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
      description: "Fetch the most recent message from the inbox.",
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

  let summary = "Local planner draft — model Lab builds richer flows when available.";
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

function normalizeFlow(parsed, task) {
  const stepsIn = Array.isArray(parsed?.steps) ? parsed.steps : [];
  const toolIds = getToolIdSet();
  let steps = stepsIn
    .map((s, i) => {
      const tool = canonicalizeTool(s.tool || s.type || "");
      if (!toolIds.has(tool)) return null;
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

async function planWithModelLab(task, cfg) {
  await ensureLabTools(cfg, { wait: true });
  const toolsList = getMergedTools()
    .map((t) => `- ${t.id}: ${t.description}${t.labToolkit ? ` (Lab: ${t.labToolkit})` : ""}`)
    .join("\n");
  let system = [
    "You are Model Flow: you DESIGN automation pipelines as ordered general tool blocks.",
    "The user only describes a goal. YOU invent the steps. Do not ask questions. Do not execute.",
    "",
    "Output ONLY valid JSON (no markdown fences) with this shape:",
    '{"title":"short name","summary":"one sentence","steps":[{"tool":"model","label":"...","description":"...","config":{}}]}',
    "",
    "How to think about steps:",
    "- Steps are GENERAL tool stages in a chain: like Zapier blocks.",
    "- Prefer 3–6 steps. Each step = one tool from the list below.",
    "- Labels must match the tool: never call a sheets step “Send email”.",
    "- Always distinguish READ vs SEND for email:",
    "  • Question like “what was my last email?” → model → email{action:\"read\", which:\"last\"} → model → notify",
    "  • “Send mail to Alex…” → model (draft) → email{action:\"send\", to, subject, body} → notify",
    "- Sheets: “create a sheet with …” → model → (email read if needed) → sheets{action:\"create\"} → notify",
    "  Example: last email into a sheet → model → email{action:\"read\"} → sheets{action:\"create\"} → notify",
    "- NEVER use email send when the user is asking what they RECEIVED or only reading mail into Sheets.",
    "- NEVER put the question text into email.to.",
    "",
    "Allowed tools (tool id must match exactly):",
    toolsList,
  ].join("\n");

  try {
    const { gatherMslAiContext } = require("../msl/ai-context");
    const msl = await gatherMslAiContext("model-flow", { label: "Model Flow" });
    if (msl.promptBlock) system += msl.promptBlock.slice(0, 8000);
  } catch {
  }

  const data = await labHttp(cfg, {
    timeoutMs: LAB_CHAT_TIMEOUT_MS,
    temperature: 0.35,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content:
          `Build a general tool-block flow for this task.\n` +
          `Return JSON only.\n\nTask:\n${task}`,
      },
    ],
  });

  const text = extractMessageText(data).trim();
  if (!text) throw new Error("Model Lab returned an empty response");
  const parsed = extractJsonObject(text);
  if (!parsed) throw new Error("Model returned no usable flow JSON");
  return normalizeFlow(parsed, task);
}

async function planFlow(task) {
  const trimmed = clip(task, 2000);
  if (!trimmed) return { ok: false, error: "Task required" };

  const cfg = getApiConfig();
  if (!cfg.apiKey) {
    return { ok: true, flow: localPlan(trimmed), mode: "local" };
  }

  await ensureLabTools(cfg, { wait: false });

  try {
    const flow = await planWithModelLab(trimmed, cfg);
    return { ok: true, flow, mode: "model-lab", program: cfg.program, plan: cfg.plan };
  } catch (err) {
    const fallback = localPlan(trimmed);
    const billing = /balance|billing|quota/i.test(String(err.message || ""));
    fallback.summary = billing
      ? `Lab out of credit: showing local plan. Approve will need Lab top-up for Gmail/Sheets. (${err.message})`
      : `Model Lab planning failed (${err.message}). Showing local draft instead.`;
    return { ok: true, flow: fallback, mode: "local-fallback", warning: err.message };
  }
}

async function labChat(messages, cfg, { temperature = 0.2, timeoutMs = LAB_CHAT_TIMEOUT_MS } = {}) {
  const data = await labHttp(cfg, { messages, temperature, timeoutMs });
  let text = extractMessageText(data).trim();
  const activity = Array.isArray(data?.layer0?.activity) ? data.layer0.activity : [];
  if (!text) {
    text = summarizeLabActivity(activity);
  }
  return { text, activity, data };
}

function isAckNoise(text) {
  return /request understood|ready for tool stages|flow finished|answer ready|sheet ready|draft ready/i.test(
    String(text || "")
  );
}

function lastAnswerFromResults(results) {
  for (let i = (results || []).length - 1; i >= 0; i--) {
    const r = results[i];
    if (!r?.ok || r.ack || r.staged) continue;
    if (r.contentPayload && !isAckNoise(r.contentPayload)) return String(r.contentPayload);
    if (r.tool === "email" || r.tool === "sheets") {
      const text = r.answer || r.display?.summary || r.message;
      if (text && !isAckNoise(text)) return String(text);
      continue;
    }
    if (r.tool === "model") {
      const text = r.answer || r.draft;
      if (text && !isAckNoise(text)) return String(text);
      continue;
    }
    if (r.answer && !isAckNoise(r.answer)) return String(r.answer);
  }
  return "";
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
      .replace(/\bResourceIds:\s*[^\n]*/gi, "")
      .replace(/\bNext:\s*[\s\S]*$/i, "")
      .replace(/\bPrefer setting action[\s\S]*$/i, "")
      .replace(/\bTo continue on this resource[\s\S]*$/i, "")
      .trim();
  }
  summary = summary.replace(/\s+/g, " ").trim();

  const newest = summary.match(
    /\[1\]\s*(?:Newest\s*\/\s*latest message:\s*)?([\s\S]*?)(?=\s*\[2\]|$)/i
  );
  if (newest) {
    summary = newest[1]
      .replace(/\bWhen the user asks[\s\S]*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  const facts = [];
  const subj = summary.match(/\bSubject:\s*([^|]+?)(?=\s+From:|$)/i);
  const from = summary.match(/\bFrom:\s*([^|]+?)(?=\s+To:|\s+Date:|$)/i);
  const date = summary.match(/\bDate:\s*([^\s|]+)/i);
  if (subj) facts.push({ key: "Subject", value: subj[1].trim().slice(0, 120) });
  if (from) facts.push({ key: "From", value: from[1].trim().slice(0, 120) });
  if (date) facts.push({ key: "Date", value: date[1].trim().slice(0, 40) });
  const title = summary.match(/\bTitle:\s*([^|]+?)(?=\s+Spreadsheet|\s+URL:|$)/i);
  if (title) facts.push({ key: "Title", value: title[1].trim().slice(0, 120) });

  return {
    toolkit: toolkit ? toolkit.toLowerCase() : null,
    action: action || null,
    summary: clip(summary, 520),
    facts,
    links: extractUrls(raw),
  };
}

function providerFromActivity(activity) {
  for (const a of activity || []) {
    const t = String(a?.tool || "").toLowerCase();
    if (/gmail/.test(t)) return "gmail";
    if (/sheet/.test(t)) return "googlesheets";
    if (/github/.test(t)) return "github";
    if (/reddit/.test(t)) return "reddit";
    if (/composio|search/.test(t)) return "composio_search";
    if (/googlesuper|google/.test(t)) return "googlesuper";
  }
  return null;
}

function buildDisplay(result, step = {}) {
  const tool = result.tool || step.tool || "step";
  const title = String(result.label || step.label || defaultStepLabel(tool, step.config)).slice(0, 80);
  const status = result.ok ? (result.staged ? "staged" : "ok") : "error";
  const rawText = String(result.error || result.message || result.answer || "");
  const parsed = parseLabScaffold(rawText);
  const provider =
    result.provider ||
    parsed.toolkit ||
    providerFromActivity(result.activity) ||
    (tool === "email" ? "gmail" : tool === "sheets" ? "googlesheets" : null);

  let summary = parsed.summary || rawText || (result.ok ? "Done" : "Failed");
  if (status === "staged" && !parsed.toolkit) {
    summary = String(result.message || "Staged: adapter not wired yet");
  }
  if (tool === "model" && /understand|ready for tool stages/i.test(summary) && !result.answer) {
    summary = String(result.message || summary);
  }
  if (tool === "notify") {
    summary = clip(String(result.notify || result.message || summary), 280);
  }

  const facts = [...(parsed.facts || [])];
  if (provider) {
    facts.unshift({
      key: "Provider",
      value: PROVIDER_LABELS[provider] || provider,
    });
  }
  if (parsed.action) facts.push({ key: "Action", value: parsed.action.replace(/_/g, " ") });

  const links = parsed.links.length ? parsed.links : extractUrls(rawText);

  return {
    status,
    tool,
    title,
    summary: clip(summary, 420),
    facts: facts.slice(0, 6),
    links,
    provider,
    action: parsed.action || result.config?.action || step.config?.action || null,
    staged: Boolean(result.staged),
  };
}

function withDisplay(result, step) {
  const display = buildDisplay(result, step);
  const cleanMessage = display.summary;
  const out = {
    ...result,
    message: cleanMessage,
    display,
  };
  if (result.ack) {
    delete out.answer;
    return out;
  }
  if (result.ok && (result.answer || result.tool === "email" || result.tool === "sheets")) {
    out.answer = display.summary;
  }
  if (result.notify) out.notify = clip(display.summary, 280);
  return out;
}

async function runEmailViaLab(step, ctx) {
  const config = step.config || {};
  const label = step.label || defaultStepLabel("email", config);
  const action = String(config.action || (config.to || config.subject ? "send" : "read")).toLowerCase();
  const cfg = getApiConfig();
  if (!cfg.apiKey) {
    return { ok: false, tool: "email", label, error: "Model Lab API key missing: cannot use Gmail tools" };
  }

  const task = String(ctx?.flow?.task || "");
  const isRead = action === "read" || action === "list" || action === "inbox";
  const prior = lastAnswerFromResults(ctx.results);

  const system = [
    "You are Model Flow executing ONE email step only.",
    isRead
      ? "Use Gmail tools to READ the latest/last inbox message. Do not send mail. Do not create Sheets."
      : "Use Gmail tools to SEND the email. Do not create Sheets unless the user explicitly asked only for send confirmation.",
    LAB_REPLY_RULES,
    "Return: from, subject, date, and a short body summary (read): or to/subject confirmation (send).",
  ].join("\n");

  let userMsg;
  if (isRead) {
    userMsg = `Fetch ONLY my last/newest received email and summarize it.\nUser task context: ${task || "(none)"}`;
  } else {
    userMsg = [
      task ? `Original task: ${task}` : null,
      prior ? `Prior draft/context:\n${prior}` : null,
      config.to ? `To: ${config.to}` : null,
      config.subject ? `Subject: ${config.subject}` : null,
      config.body ? `Body:\n${config.body}` : null,
      "Send this email with Gmail tools.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const { text, activity } = await labChat(
    [
      { role: "system", content: system },
      { role: "user", content: userMsg },
    ],
    cfg,
    { timeoutMs: LAB_TOOL_STEP_MS }
  );

  if (!text) {
    return { ok: false, tool: "email", label, error: "Model Lab returned empty Gmail result", activity };
  }

  return {
    ok: true,
    tool: "email",
    label,
    message: text,
    answer: text,
    activity,
    provider: "gmail",
    usedGmail: true,
    config: { ...config, action: isRead ? "read" : "send" },
  };
}

async function runSheetsViaLab(step, ctx) {
  const config = step.config || {};
  const label = step.label || defaultStepLabel("sheets", config);
  const cfg = getApiConfig();
  if (!cfg.apiKey) {
    return { ok: false, tool: "sheets", label, error: "Model Lab API key missing: cannot use Google Sheets" };
  }

  const task = String(ctx?.flow?.task || "");
  const priorRaw = lastAnswerFromResults(ctx.results);
  const prior = priorRaw && !isAckNoise(priorRaw) ? priorRaw : "";
  const action = String(config.action || "create").toLowerCase();

  const system = [
    "You are Model Flow executing ONE Google Sheets step only.",
    action === "update"
      ? "Use Google Sheets tools to UPDATE an existing spreadsheet the user named."
      : "Use Google Sheets tools to CREATE a NEW spreadsheet and write the requested content.",
    "Source of truth is the USER TASK (and Prior tool content if present).",
    "NEVER write protocol / status text into cells (e.g. “Request understood”, “ready for tool stages”).",
    "Do not open or quote unrelated existing sheets unless the user named them.",
    "Do not invent spreadsheet URLs: only report the real URL returned by the Sheets tool.",
    "Do not send email. Do not re-fetch Gmail unless Prior content is missing and the task requires inbox data.",
    LAB_REPLY_RULES,
    "Reply with the sheet title and the real URL only.",
  ].join("\n");

  const userMsg = [
    `Action: ${action}`,
    config.title ? `Preferred title: ${config.title}` : null,
    `USER TASK (source of truth):\n${task || "(empty)"}`,
    prior
      ? `Prior verified tool content to put in the sheet:\n${prior}`
      : "No prior tool content. Fill the sheet from the USER TASK only: not from any status messages in this chat.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const { text, activity } = await labChat(
    [
      { role: "system", content: system },
      { role: "user", content: userMsg },
    ],
    cfg,
    { timeoutMs: LAB_TOOL_STEP_MS }
  );

  if (!text) {
    return { ok: false, tool: "sheets", label, error: "Model Lab returned empty Sheets result", activity };
  }

  return {
    ok: true,
    tool: "sheets",
    label,
    message: text,
    answer: text,
    activity,
    provider: "googlesheets",
    config: { ...config, action },
  };
}

async function runModelViaLab(step, ctx) {
  const config = step.config || {};
  const label = step.label || "Model";
  const prior = lastAnswerFromResults(ctx.results);
  const prompt = String(config.prompt || config.task || "").trim();
  const task = String(ctx?.flow?.task || "");
  const cfg = getApiConfig();

  if (!cfg.apiKey) {
    if (prior && !isAckNoise(prior)) {
      return {
        ok: true,
        tool: "model",
        label,
        message: prior,
        answer: prior,
        provider: "model",
      };
    }
    return {
      ok: false,
      tool: "model",
      label,
      error: "No Lab key: open Connection, save a Model Lab API key, then retry.",
    };
  }

  const system = [
    prior
      ? "Polish the prior tool result into a clear answer for the user. Keep facts; do not invent."
      : "Reason about the flow task and produce concrete useful text for the next step (draft, extract, decide).",
    "Do not call Gmail or Sheets tools in this step unless drafting text that requires no side effects.",
    LAB_REPLY_RULES,
  ].join(" ");

  const userContent = [
    task ? `User task: ${task}` : null,
    prompt ? `Step instruction: ${prompt}` : null,
    step.description ? `Step detail: ${step.description}` : null,
    prior ? `Prior tool result:\n${prior}` : null,
    !prior && !prompt ? `Produce a short useful brief for: ${task || label}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const { text } = await labChat(
    [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ],
    cfg,
    { temperature: prior ? 0.25 : 0.4, timeoutMs: LAB_CHAT_TIMEOUT_MS }
  );

  const answer = (text && !isAckNoise(text) ? text : "") || prior || "";
  if (!answer) {
    return {
      ok: false,
      tool: "model",
      label,
      error: "Model Lab returned no usable text for this step",
    };
  }

  return {
    ok: true,
    tool: "model",
    label,
    message: answer,
    answer,
    draft: answer,
    provider: "model",
  };
}

async function runLabToolkitStep(step, ctx) {
  const tool = step.tool;
  const config = step.config || {};
  const label = step.label || defaultStepLabel(tool, config);
  const labToolkit = labToolkitForTool(tool) || tool;
  const cfg = getApiConfig();
  if (!cfg.apiKey) {
    return {
      ok: false,
      tool,
      label,
      error: `Model Lab API key missing — cannot run ${labToolkit}`,
    };
  }

  const task = String(ctx?.flow?.task || "");
  const prior = lastAnswerFromResults(ctx.results);
  const toolkitName = PROVIDER_LABELS[labToolkit] || labToolkit.replace(/_/g, " ");

  const system = [
    `You are Model Flow executing ONE ${toolkitName} (${labToolkit}) step only.`,
    "Use the toolkit tools needed for this step. Do not run unrelated toolkits.",
    LAB_REPLY_RULES,
    "Return a concise human summary of what you did.",
  ].join("\n");

  const userMsg = [
    task ? `Flow task: ${task}` : null,
    label ? `Step: ${label}` : null,
    step.description ? `Detail: ${step.description}` : null,
    prior ? `Prior step output:\n${prior}` : null,
    Object.keys(config).length ? `Step config:\n${JSON.stringify(config, null, 2)}` : null,
    `Execute this ${toolkitName} step now.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const { text, activity } = await labChat(
    [
      { role: "system", content: system },
      { role: "user", content: userMsg },
    ],
    cfg,
    { timeoutMs: LAB_TOOL_STEP_MS }
  );

  if (!text) {
    return {
      ok: false,
      tool,
      label,
      error: `Model Lab returned empty result for ${labToolkit}`,
      activity,
    };
  }

  return {
    ok: true,
    tool,
    label,
    message: text,
    answer: text,
    activity,
    provider: labToolkit,
    labLive: true,
    config,
  };
}

async function runShellStep(step) {
  const { executeInRenderer } = require("./shell-console-ipc");
  const config = step.config || {};
  const label = step.label || defaultStepLabel("shell", config);
  const command = String(config.command || config.line || "").trim();
  if (!command) {
    return { ok: false, tool: "shell", label, error: "Missing shell command" };
  }
  const res = await executeInRenderer(command, "model-flow");
  if (!res?.ok) {
    return {
      ok: false,
      tool: "shell",
      label,
      error: res?.error || "Shell command failed",
      command,
    };
  }
  const answer = String(res.message || res.result || "OK").trim();
  return {
    ok: true,
    tool: "shell",
    label,
    message: answer.slice(0, 400),
    answer,
    command,
  };
}

async function runStocksStep(step) {
  const { handleStocksInvoke } = require("./stocks-ipc");
  const config = step.config || {};
  const label = step.label || defaultStepLabel("stocks", config);
  const symbol = String(config.symbol || config.q || config.query || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.^=-]/g, "");
  if (!symbol) {
    return { ok: false, tool: "stocks", label, error: "Missing stock symbol" };
  }
  const res = await handleStocksInvoke("quote.get", { symbols: [symbol] });
  if (!res?.ok) {
    return { ok: false, tool: "stocks", label, error: res?.error || "Quote failed" };
  }
  const q = (res.quotes || [])[0];
  if (!q) {
    return { ok: false, tool: "stocks", label, error: `No quote for ${symbol}` };
  }
  const price = q.price != null ? Number(q.price) : null;
  const changePct = q.changePct != null ? Number(q.changePct) : null;
  const bits = [
    q.symbol || symbol,
    price != null ? `$${price.toFixed(2)}` : null,
    changePct != null ? `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%` : null,
    q.name && q.name !== q.symbol ? q.name : null,
  ].filter(Boolean);
  const answer = bits.join(" · ");
  return {
    ok: true,
    tool: "stocks",
    label,
    message: answer,
    answer,
    symbol: q.symbol || symbol,
    quote: q,
  };
}

async function runTranslateStep(step, ctx = {}) {
  const { handleTranslateInvoke } = require("./translate-ipc");
  const config = step.config || {};
  const label = step.label || defaultStepLabel("translate", config);
  let text = String(config.text || config.query || config.q || "").trim();
  if (!text) {
    text = String(lastAnswerFromResults(ctx.results) || "").trim();
  }
  if (!text) {
    return { ok: false, tool: "translate", label, error: "Missing text to translate" };
  }
  const to = String(config.to || config.target || "en").trim() || "en";
  const from = String(config.from || config.source || "auto").trim() || "auto";
  const res = await handleTranslateInvoke("translate.text", { text, from, to });
  if (!res?.ok) {
    return { ok: false, tool: "translate", label, error: res?.error || "Translate failed" };
  }
  const translated = String(res.text || res.translated || "").trim();
  const answer = translated || "(empty translation)";
  return {
    ok: true,
    tool: "translate",
    label,
    message: answer.slice(0, 400),
    answer,
    from: res.from || from,
    to: res.to || to,
  };
}

async function runContactsStep(step) {
  const { handleContactsInvoke } = require("./contacts-ipc");
  const config = step.config || {};
  const label = step.label || defaultStepLabel("contacts", config);
  const q = String(config.query || config.q || config.name || "").trim();
  const res = await handleContactsInvoke("storage.load", {});
  if (!res?.ok) {
    return { ok: false, tool: "contacts", label, error: res?.error || "Contacts load failed" };
  }
  let contacts = res.data?.contacts || [];
  if (q) {
    const lower = q.toLowerCase();
    contacts = contacts.filter((c) => {
      const blob = [
        c.displayName,
        c.firstName,
        c.lastName,
        c.company,
        c.notes,
        ...(c.emails || []).map((e) => e.value),
        ...(c.phones || []).map((p) => p.value),
        ...(c.tags || []),
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(lower);
    });
  }
  const top = contacts.slice(0, 10);
  const lines = top.map((c) => {
    const name =
      c.displayName || [c.firstName, c.lastName].filter(Boolean).join(" ") || "Unknown";
    const email = c.emails?.[0]?.value || "";
    return email ? `${name} <${email}>` : name;
  });
  const answer = lines.length
    ? lines.join(" · ")
    : q
      ? `No contacts matching “${q}”`
      : "No contacts";
  return {
    ok: true,
    tool: "contacts",
    label,
    message: answer,
    answer,
    contacts: top,
    total: contacts.length,
  };
}

function slugScriptName(raw) {
  return String(raw || "flow")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "flow";
}

function flowStepsToScriptBody(flow) {
  const title = String(flow?.title || "Flow").trim() || "Flow";
  const task = String(flow?.task || "").trim();
  const lines = [`# ${title}`];
  if (task) lines.push(`# task: ${task.slice(0, 160)}`);
  lines.push("");
  for (const step of flow?.steps || []) {
    const c = step.config || {};
    const tool = String(step.tool || "").toLowerCase();
    const label = String(step.label || tool || "step").trim();
    lines.push(`# ${label}`);
    if (tool === "shell") {
      const cmd = String(c.command || c.line || "").trim();
      if (cmd) lines.push(cmd);
      else lines.push("# (empty shell command)");
    } else if (tool === "stocks") {
      const symbol = String(c.symbol || c.q || "AAPL").trim().toUpperCase() || "AAPL";
      lines.push(`stocks(${symbol})`);
    } else if (tool === "translate") {
      const text = String(c.text || c.query || "").trim();
      const to = String(c.to || "en").trim() || "en";
      if (text) lines.push(`translate(${text} to ${to})`);
      else lines.push("# translate needs text");
    } else if (tool === "contacts") {
      const q = String(c.query || c.q || c.name || "").trim();
      lines.push(q ? `contacts(search ${q})` : "contacts(list)");
    } else if (tool === "notify") {
      const msg = String(c.message || "").trim();
      lines.push(msg ? `# notify: ${msg}` : "# notify");
    } else if (tool === "wait") {
      const sec = Number(c.seconds || c.sec || 2) || 2;
      lines.push(`# wait ${sec}s`);
    } else {
      lines.push(`# skip ${tool || "tool"} (Lab/local — not a shell line)`);
    }
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}

async function saveFlowAsScript(args = {}) {
  const flow = prepareFlowForRun(args.flow || args);
  if (!flow.steps.length) return { ok: false, error: "No steps to save" };
  const body = flowStepsToScriptBody(flow);
  const name = slugScriptName(args.name || flow.title || "flow");
  const { handleScriptsInvoke } = require("./scripts-ipc");
  const res = await handleScriptsInvoke("scripts.create", { name, body });
  if (!res?.ok) return res;
  return { ok: true, script: res.script, body };
}

async function runStep(step, ctx = {}) {
  const tool = step.tool;
  const config = step.config || {};
  const label = step.label || defaultStepLabel(tool, config);

  switch (tool) {
    case "model":
      return runModelViaLab(step, ctx);
    case "email":
      return runEmailViaLab(step, ctx);
    case "sheets":
      return runSheetsViaLab(step, ctx);
    case "notify": {
      const answer = lastAnswerFromResults(ctx.results);
      const msg = answer ? clip(answer, 280) : String(config.message || "Flow finished");
      return {
        ok: true,
        tool,
        label,
        message: msg,
        notify: msg,
        answer: answer || undefined,
      };
    }
    case "shell":
      return runShellStep(step);
    case "stocks":
      return runStocksStep(step);
    case "translate":
      return runTranslateStep(step, ctx);
    case "contacts":
      return runContactsStep(step);
    case "wait":
      return runWaitStep(step);
    case "calendar":
      return {
        ok: true,
        tool,
        label,
        message: "Calendar step staged",
        staged: true,
      };
    case "files":
      return {
        ok: true,
        tool,
        label,
        message: config.path ? `File step staged (${config.path})` : "File step staged",
        staged: true,
      };
    case "web":
      return {
        ok: true,
        tool,
        label,
        message: config.url ? `Fetch staged (${config.url})` : "Web fetch staged",
        staged: true,
      };
    default:
      if (isLabExecutableTool(tool)) {
        return runLabToolkitStep(step, ctx);
      }
      return { ok: false, tool, label, error: `Unknown tool: ${tool}` };
  }
}

function prepareFlowForRun(rawFlow) {
  const task = String(rawFlow?.task || "").trim();
  const normalized = normalizeFlow(
    {
      title: rawFlow?.title,
      summary: rawFlow?.summary,
      steps: Array.isArray(rawFlow?.steps) ? rawFlow.steps : [],
    },
    task
  );
  if (rawFlow?.id) normalized.id = String(rawFlow.id);
  return normalized;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWaitStep(step) {
  const config = step.config || {};
  const label = step.label || defaultStepLabel("wait", config);
  let ms = Number(config.ms);
  if (!Number.isFinite(ms) || ms <= 0) {
    const sec = Number(config.seconds || config.sec || 2);
    ms = (Number.isFinite(sec) ? sec : 2) * 1000;
  }
  ms = Math.min(Math.max(Math.round(ms), 0), 120000);
  if (ms > 0) await sleep(ms);
  const seconds = Math.round(ms / 100) / 10;
  const answer = `Waited ${seconds}s`;
  return {
    ok: true,
    tool: "wait",
    label,
    message: answer,
    answer,
    seconds,
  };
}

function loadLibrary() {
  try {
    const raw = fs.readFileSync(libraryPath(), "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveLibrary(list) {
  fs.writeFileSync(libraryPath(), JSON.stringify(list, null, 2), "utf8");
}

function cloneFlowForStore(flow) {
  const prepared = prepareFlowForRun(flow || {});
  return {
    id: prepared.id,
    title: prepared.title,
    summary: prepared.summary || "",
    task: prepared.task || "",
    steps: prepared.steps,
    source: prepared.source || "studio",
  };
}

async function saveLibraryItem(args = {}) {
  const flow = cloneFlowForStore(args.flow || args);
  if (!flow.steps.length) return { ok: false, error: "No steps to save" };
  const list = loadLibrary();
  const existingId = String(args.id || flow.id || "").trim();
  const now = new Date().toISOString();
  const idx = existingId ? list.findIndex((x) => x.id === existingId) : -1;
  const item = {
    id: idx >= 0 ? list[idx].id : uid("lib"),
    title: String(args.title || flow.title || "Untitled flow").slice(0, 80),
    task: flow.task,
    summary: flow.summary,
    at: now,
    pinned: idx >= 0 ? Boolean(list[idx].pinned) : Boolean(args.pinned),
    steps: flow.steps.length,
    flow,
  };
  if (idx >= 0) list[idx] = { ...list[idx], ...item };
  else list.unshift(item);
  saveLibrary(list.slice(0, 80));
  return { ok: true, item };
}

async function runFlow(rawFlow, opts = {}) {
  const flow = prepareFlowForRun(rawFlow);
  if (!flow?.steps?.length) return { ok: false, error: "No steps to run" };
  await ensureLabTools(getApiConfig(), { wait: false });

  const fromIndex = Math.min(
    Math.max(Number(opts.fromIndex) || 0, 0),
    flow.steps.length
  );
  const prior = Array.isArray(opts.priorResults) ? opts.priorResults.slice(0, fromIndex) : [];

  const cfg = getApiConfig();
  const remaining = flow.steps.slice(fromIndex);
  const needsLab = remaining.some((s) =>
    ["model", "email", "sheets", "github", "reddit", "search", "google"].includes(s.tool)
  );
  if (needsLab && !cfg.apiKey) {
    return {
      ok: false,
      error: "No Model Lab API key. open Connection, paste your Lab key, Save, then Approve again.",
      results: prior,
      flow,
      fromIndex,
    };
  }

  const results = prior.slice();
  const ctx = { flow, results };
  for (let i = fromIndex; i < flow.steps.length; i++) {
    const step = flow.steps[i];
    try {
      const raw = await runStep(step, ctx);
      const result = withDisplay(raw, step);
      results.push(result);
      if (!result.ok) {
        return {
          ok: false,
          error: result.display?.summary || result.error || "Step failed",
          results,
          flow,
        };
      }
    } catch (err) {
      const fail = withDisplay(
        { ok: false, tool: step.tool, label: step.label, error: err.message || String(err) },
        step
      );
      results.push(fail);
      return { ok: false, error: fail.display?.summary || fail.error, results, flow };
    }
  }

  try {
    const hist = loadHistory();
    hist.unshift({
      id: flow.id || uid("flow"),
      title: flow.title,
      task: flow.task,
      summary: flow.summary || "",
      at: new Date().toISOString(),
      steps: flow.steps.length,
      ok: true,
      flow: {
        id: flow.id,
        title: flow.title,
        summary: flow.summary,
        task: flow.task,
        steps: flow.steps,
        source: flow.source || "run",
      },
    });
    saveHistory(hist.slice(0, 40));
  } catch {
  }

  return { ok: true, results, flow };
}

function loadHistory() {
  try {
    const raw = fs.readFileSync(historyPath(), "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveHistory(list) {
  fs.writeFileSync(historyPath(), JSON.stringify(list, null, 2), "utf8");
}

async function handleModelFlowInvoke(channel, args = {}) {
  switch (channel) {
    case "flow.meta": {
      const cfg = getApiConfig();
      const merged = await ensureLabTools(cfg, { wait: Boolean(cfg.apiKey) && !labToolkitsCache.at });
      return {
        ok: true,
        hasKey: Boolean(cfg.apiKey),
        keySource: cfg.keySource,
        model: cfg.model,
        baseUrl: cfg.baseUrl,
        program: cfg.program,
        plan: cfg.plan,
        tools: toolsForClient(merged.tools),
        liveTools: [...LIVE_TOOL_IDS],
        labToolkits: labToolkitsCache.items.length,
        labToolsError: labToolkitsCache.error,
      };
    }
    case "flow.setApiKey": {
      const apiKey = String(args.apiKey || "").trim();
      if (!apiKey) return { ok: false, error: "apiKey required" };
      const secrets = loadSecrets();
      secrets.apiKey = apiKey;
      if (args.model) secrets.model = String(args.model).trim();
      if (args.baseUrl) secrets.baseUrl = String(args.baseUrl).trim();
      saveSecrets(secrets);
      invalidateLabToolsCache();
      return { ok: true, hasKey: true, keySource: "secrets" };
    }
    case "flow.clearApiKey": {
      const secrets = loadSecrets();
      delete secrets.apiKey;
      saveSecrets(secrets);
      invalidateLabToolsCache();
      return { ok: true, hasKey: false, keySource: null };
    }
    case "flow.plan":
      return planFlow(args.task);
    case "flow.normalize": {
      const flow = prepareFlowForRun(args.flow || args);
      if (!flow.steps.length) return { ok: false, error: "No valid steps after normalize" };
      return { ok: true, flow };
    }
    case "flow.run":
      return runFlow(args.flow, {
        fromIndex: args.fromIndex,
        priorResults: args.priorResults,
      });
    case "flow.saveAsScript":
      return saveFlowAsScript(args);
    case "flow.blank": {
      const flow = {
        id: uid("flow"),
        title: "Untitled flow",
        summary: "Blank studio — add steps, then approve.",
        task: String(args.task || "").trim(),
        source: "blank",
        steps: [
          {
            id: uid("step"),
            tool: "notify",
            label: "Notify",
            config: { message: "Flow finished" },
            chips: configChips({ message: "Flow finished" }),
          },
        ],
      };
      return { ok: true, flow: prepareFlowForRun(flow) };
    }
    case "flow.history":
      return { ok: true, items: loadHistory() };
    case "flow.history.get": {
      const id = String(args.id || "").trim();
      const item = loadHistory().find((h) => h.id === id);
      if (!item) return { ok: false, error: "History item not found" };
      return { ok: true, item };
    }
    case "flow.history.delete": {
      const id = String(args.id || "").trim();
      if (!id) return { ok: false, error: "Missing id" };
      const next = loadHistory().filter((h) => h.id !== id);
      saveHistory(next);
      return { ok: true, items: next };
    }
    case "flow.history.pin": {
      const id = String(args.id || "").trim();
      const list = loadHistory();
      const idx = list.findIndex((h) => h.id === id);
      if (idx < 0) return { ok: false, error: "History item not found" };
      const pinned = args.pinned != null ? Boolean(args.pinned) : !list[idx].pinned;
      list[idx] = { ...list[idx], pinned };
      list.sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
      saveHistory(list);
      return { ok: true, item: list[idx], items: list };
    }
    case "flow.library":
    case "flow.library.list":
      return { ok: true, items: loadLibrary() };
    case "flow.library.get": {
      const id = String(args.id || "").trim();
      const item = loadLibrary().find((x) => x.id === id);
      if (!item) return { ok: false, error: "Saved flow not found" };
      return { ok: true, item };
    }
    case "flow.library.save":
      return saveLibraryItem(args);
    case "flow.library.delete": {
      const id = String(args.id || "").trim();
      if (!id) return { ok: false, error: "Missing id" };
      const next = loadLibrary().filter((x) => x.id !== id);
      saveLibrary(next);
      return { ok: true, items: next };
    }
    case "flow.library.pin": {
      const id = String(args.id || "").trim();
      const list = loadLibrary();
      const idx = list.findIndex((x) => x.id === id);
      if (idx < 0) return { ok: false, error: "Saved flow not found" };
      const pinned = args.pinned != null ? Boolean(args.pinned) : !list[idx].pinned;
      list[idx] = { ...list[idx], pinned };
      list.sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
      saveLibrary(list);
      return { ok: true, item: list[idx], items: list };
    }
    case "flow.tools": {
      const cfg = getApiConfig();
      const merged = await ensureLabTools(cfg, {
        wait: Boolean(cfg.apiKey) && (!labToolkitsCache.at || Date.now() - labToolkitsCache.at > LAB_TOOLS_TTL_MS),
      });
      return {
        ok: true,
        tools: toolsForClient(merged.tools),
        liveTools: [...LIVE_TOOL_IDS],
        labToolkits: labToolkitsCache.items,
        labToolsError: labToolkitsCache.error,
      };
    }
    default:
      return { ok: false, error: `Unknown model-flow channel: ${channel}` };
  }
}

module.exports = {
  handleModelFlowInvoke,
  TOOLS,
  LIVE_TOOL_IDS,
};