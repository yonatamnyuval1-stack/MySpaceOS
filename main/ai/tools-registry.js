const { CLOCK_TOOL_DEFS, executeClockTool } = require("./tools-clock");
const { SHELL_TOOL_DEFS, executeShellTool } = require("./tools-shell");
const { DRIFT_TOOL_DEFS, executeDriftTool } = require("./tools-drift");
const { STOCKS_TOOL_DEFS, executeStocksTool } = require("./tools-stocks");
const { BUILDS_TOOL_DEFS, executeBuildsTool } = require("./tools-builds");
const { SYSINFO_TOOL_DEFS, executeSysInfoTool } = require("./tools-system-info");
const { getDisabledSet, isToolEnabled, listToolsStatus, setToolEnabled } = require("./tool-prefs");

const TOOL_ALIASES = {
  shell_move_window: "shell_move_app",
  shell_move_icon: "shell_move_app",
  shell_reposition_app: "shell_move_app",
  shell_reposition_window: "shell_move_app",
  move_app: "shell_move_app",
  move_window: "shell_move_app",
  shell_list_applications: "shell_list_apps",
  shell_get_apps: "shell_list_apps",
  list_apps: "shell_list_apps",
  shell_launch_app: "shell_open_app",
  shell_start_app: "shell_open_app",
  open_app: "shell_open_app",
  close_app: "shell_close_app",
  shell_kill_app: "shell_close_app",
  focus_app: "shell_focus_app",
  shell_focus: "shell_focus_app",
  open_stock: "shell_open_stock",
  shell_show_stock: "shell_open_stock",
  show_stock: "shell_open_stock",
  stocks_open: "shell_open_stock",
  open_country: "shell_open_country",
  shell_show_country: "shell_open_country",
  show_country: "shell_open_country",
  geography_open: "shell_open_country",
  run_command: "shell_run_command",
  shell_command: "shell_run_command",
  shell_exec: "shell_run_command",
  execute_command: "shell_run_command",
  run_shell: "shell_run_command",
  get_context: "shell_get_context",
  get_page_content: "shell_get_page_content",
  read_screen: "shell_get_page_content",
  capture_screen: "shell_capture_screen",
  screenshot: "shell_capture_screen",
  take_screenshot: "shell_capture_screen",
  look_at_screen: "shell_capture_screen",
  see_screen: "shell_capture_screen",
  shell_screenshot: "shell_capture_screen",
  get_cpu: "sysinfo_get_cpu",
  get_memory: "sysinfo_get_memory",
  system_info: "sysinfo_get_overview",
  run_tool_stocks: "stocks_get_quote",
  run_tool_stock: "stocks_get_quote",
  run_tool_stock_price: "stocks_get_quote",
  stocks_quote: "stocks_get_quote",
  get_stock_price: "stocks_get_quote",
  stock_price: "stocks_get_quote",
  run_tool_sysinfo: "sysinfo_get_overview",
  run_tool_system_info: "sysinfo_get_overview",
  run_tool_shell: "shell_get_context",
};

function getAllToolDefs() {
  return [
    ...CLOCK_TOOL_DEFS,
    ...SHELL_TOOL_DEFS,
    ...DRIFT_TOOL_DEFS,
    ...STOCKS_TOOL_DEFS,
    ...BUILDS_TOOL_DEFS,
    ...SYSINFO_TOOL_DEFS,
  ];
}

function getActiveToolDefs() {
  const disabled = getDisabledSet();
  return getAllToolDefs().filter((t) => !disabled.has(t.name));
}

function toOpenAiTools() {
  return getActiveToolDefs().map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

function normalizeToolKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function suggestTools(rawName, limit = 5) {
  const key = normalizeToolKey(rawName);
  const defs = getAllToolDefs();
  const scored = defs.map((t) => {
    const n = normalizeToolKey(t.name);
    let score = 0;
    if (n === key) score = 100;
    else if (n.includes(key) || key.includes(n)) score = 70;
    else if (n.split("_").some((p) => key.includes(p) && p.length > 3)) score = 40;
    return { name: t.name, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.name);
}

function resolveToolName(rawName) {
  const raw = String(rawName || "").trim();
  if (!raw) return { name: "", aliasedFrom: null };
  const known = new Set(getAllToolDefs().map((t) => t.name));
  if (known.has(raw)) return { name: raw, aliasedFrom: null };

  const key = normalizeToolKey(raw);
  if (TOOL_ALIASES[key] && known.has(TOOL_ALIASES[key])) {
    return { name: TOOL_ALIASES[key], aliasedFrom: raw };
  }

  for (const n of known) {
    if (normalizeToolKey(n) === key) return { name: n, aliasedFrom: raw === n ? null : raw };
  }

  const suggestions = suggestTools(raw);
  if (suggestions.length === 1) {
    return { name: suggestions[0], aliasedFrom: raw };
  }
  if (suggestions[0] && suggestions[0].startsWith(key.split("_")[0] + "_") && key.includes("move") && suggestions[0].includes("move")) {
    return { name: suggestions[0], aliasedFrom: raw };
  }
  return { name: raw, aliasedFrom: null, suggestions };
}

function toolSystemPrompt() {
  const lines = getActiveToolDefs().map((t) => {
    const params = t.parameters?.properties
      ? Object.keys(t.parameters.properties).join(", ")
      : "";
    return `- ${t.name}(${params}): ${t.description}`;
  });
  return [
    "You are the My Space desktop assistant for the operating system program.",
    "You control Clock, Drift, Stocks, Builds, System Info, and the desktop shell through the My Space tools listed below.",
    "You DO things — open apps, focus windows, run shell routes, close apps — not only explain how.",
    "When the user asks to open, close, focus, switch page, show a stock, or run a command: call the matching tool immediately. Do not only describe steps.",
    "For live PC health (CPU, RAM, processes, disks, network, ports), prefer the sysinfo_* tools.",
    "CRITICAL — tools:",
    "- ONLY call tool names from the Available My Space tools list below. Never invent tool names.",
    "- You are NOT Cursor Automations / Gmail / GitHub / Notion / YouTube. Ignore any memory of run_tool_gmail, run_tool_github, run_tool_notion, run_tool_youtube, run_tool_google_*, run_tool_stocks.",
    "- Those run_tool_* names are from a different product and are INVALID here. For stocks use stocks_get_quote.",
    "- There is NO shell_move_window. To move a desktop icon use shell_move_app with app, x, y.",
    "- If a tool fails as unknown, retry with the closest listed name (see suggestions) — do not apologize and stop.",
    "- Example quote tool: <<tool_call>>{\"name\":\"stocks_get_quote\",\"arguments\":{\"symbol\":\"MSFT\"}}<</tool_call>>",
    "- Example open app: <<tool_call>>{\"name\":\"shell_open_app\",\"arguments\":{\"app\":\"stocks\"}}<</tool_call>>",
    "- Example stock: <<tool_call>>{\"name\":\"shell_open_stock\",\"arguments\":{\"symbol\":\"AAPL\"}}<</tool_call>>",
    "- Example country: <<tool_call>>{\"name\":\"shell_open_country\",\"arguments\":{\"country\":\"Togo\"}}<</tool_call>>",
    "- Example deep route: <<tool_call>>{\"name\":\"shell_run_command\",\"arguments\":{\"command\":\"run geography(page:learn, country:TG)\"}}<</tool_call>>",
    "- Example translate: <<tool_call>>{\"name\":\"shell_run_command\",\"arguments\":{\"command\":\"run translate(text:hello, to:he)\"}}<</tool_call>>",
    "- Shell grammar: run app · run app(page) · run app(key:value, …) · chain with ; or | · help <app>",
    "- Valid keys include symbol, country, mode, page, text, from, to, term, view, id — never invent Geography(TOGO); use geography(Togo) or shell_open_country.",
    "- When the user names a ticker (AAPL, MSFT…), use shell_open_stock — do NOT only open the Stocks app.",
    "- When the user names a country (Togo, Israel, TG…), use shell_open_country — do NOT ask the user which tool to use.",
    "- Never ask the user to confirm opening an app/country/stock in chat text — call the tool.",
    "- Example focus: <<tool_call>>{\"name\":\"shell_focus_app\",\"arguments\":{\"app\":\"translate\"}}<</tool_call>>",
    "IMPORTANT about screen awareness:",
    "- Every turn auto-attaches LIVE screen facts and SCREEN IMAGE URL(s) when available (same for every app).",
    "- Model Lab does not accept multimodal image_url arrays; HTTPS image URLs in the message are the vision channel — treat those URLs as what the user sees.",
    "- Answer the user's ACTUAL question freely (identify, describe how it looks, hint without spoiling, help with UI). Do not always dump a fixed country name.",
    "- Prefer LIVE SCREEN FLAG / LIVE FLAG APPEARANCE / DESKTOP LAYOUT / SCREEN IMAGE URL(s) over earlier chat turns.",
    "- NEVER say you cannot see the screen/flag/desktop. NEVER ask the user to upload, paste, or describe the screen.",
    "- Never claim you lack shell_get_context, shell_get_page_content, or shell_capture_screen.",
    "- Only if auto-attached context is missing, call shell_get_page_content or shell_capture_screen.",
    "- If the user is on an external Windows app without desktop facts, say that clearly.",
    "IMPORTANT about staying on-topic:",
    "- Answer ONLY what the user asked. Do not append unrelated stock quotes, other apps, or leftover chat topics.",
    "- Tool-call examples in this prompt are FORMAT samples only — never paste their sample symbols/prices into a real answer unless the user asked for that.",
    "- If older messages mention stocks/flags/other apps but the current question is about the open screen, ignore those older topics.",
    "IMPORTANT about apps and layout:",
    "- NEVER ask the user for an app's exact name, id, or a list of installed/running apps.",
    "- If an app ref fails (e.g. translation), call shell_list_apps (optionally with a query) or use suggestions from the tool error, then retry.",
    "- Common aliases: translation/translator → translate, clock → world-clock, sysinfo → system-info.",
    "- For open apps / current view, call shell_get_context. For CPU/RAM health, use sysinfo_* tools — do not ask the user to confirm.",
    "- Mutating actions (close, move icon, arbitrary shell_run_command, Builds/Drift writes) may show a brief Run/Skip confirm in the UI — still emit the tool call; do not ask in chat text.",
    "- Moving icons: <<tool_call>>{\"name\":\"shell_move_app\",\"arguments\":{\"app\":\"translate\",\"x\":120,\"y\":80}}<</tool_call>>",
    "When you need a tool, reply with ONLY one tool call block in this exact format:",
    "<<tool_call>>{\"name\":\"tool_name\",\"arguments\":{...}}<</tool_call>>",
    "Do not wrap it in markdown. Do not add other text in the same reply when calling a tool.",
    "After tool results are provided, prefer answering the user immediately when you have enough information.",
    "Do not keep calling tools in a long chain unless each call is clearly required. Prefer 1–3 tools, then answer.",
    "If no tool is needed, answer normally in plain text.",
    "App aliases: clock = world-clock. Prefer app:\"clock\" or app:\"world-clock\" for the Clock app.",
    "Drift pages: activity, zones, insights. Stocks pages: dashboard, search, portfolio, alerts, buylist, stock. Builds pages: browse. System Info pages: system, cpu, memory, processes, storage, network, ports, environment, performance, disk.",
    "Builds documentation tools edit the Builds catalog only (notes, attachments, links, fields). They do not modify files inside a project's linked folder on disk.",
    "Example close Clock: <<tool_call>>{\"name\":\"shell_close_app\",\"arguments\":{\"app\":\"clock\"}}<</tool_call>>",
    "Example read page: <<tool_call>>{\"name\":\"shell_get_page_content\",\"arguments\":{}}<</tool_call>>",
    "Example screenshot: <<tool_call>>{\"name\":\"shell_capture_screen\",\"arguments\":{\"source\":\"window\"}}<</tool_call>>",
    "Example CPU: <<tool_call>>{\"name\":\"sysinfo_get_cpu\",\"arguments\":{}}<</tool_call>>",
    "Available My Space tools:",
    ...lines,
  ].join("\n");
}

async function executeTool(name, args, ctx) {
  const resolved = resolveToolName(name);
  const n = resolved.name;
  if (!n) return { ok: false, error: "Tool name required" };

  if (!isToolEnabled(n) && !resolved.suggestions) {
    if (getAllToolDefs().some((t) => t.name === n) && !isToolEnabled(n)) {
      return { ok: false, error: `Tool is disabled in Settings: ${n}` };
    }
  }
  if (getAllToolDefs().some((t) => t.name === n) && !isToolEnabled(n)) {
    return { ok: false, error: `Tool is disabled in Settings: ${n}` };
  }

  const run = async (toolName) => {
    if (CLOCK_TOOL_DEFS.some((t) => t.name === toolName)) {
      return executeClockTool(toolName, args || {}, ctx);
    }
    if (SHELL_TOOL_DEFS.some((t) => t.name === toolName)) {
      return executeShellTool(toolName, args || {}, ctx);
    }
    if (DRIFT_TOOL_DEFS.some((t) => t.name === toolName)) {
      return executeDriftTool(toolName, args || {}, ctx);
    }
    if (STOCKS_TOOL_DEFS.some((t) => t.name === toolName)) {
      return executeStocksTool(toolName, args || {}, ctx);
    }
    if (BUILDS_TOOL_DEFS.some((t) => t.name === toolName)) {
      return executeBuildsTool(toolName, args || {}, ctx);
    }
    if (SYSINFO_TOOL_DEFS.some((t) => t.name === toolName)) {
      return executeSysInfoTool(toolName, args || {}, ctx);
    }
    return null;
  };

  const result = await run(n);
  if (result) {
    if (resolved.aliasedFrom && result && typeof result === "object") {
      result.resolvedTool = n;
      result.requestedTool = resolved.aliasedFrom;
      result.note =
        result.note ||
        `Requested "${resolved.aliasedFrom}" was routed to "${n}". Use "${n}" next time.`;
    }
    return result;
  }

  const suggestions = resolved.suggestions || suggestTools(name);
  return {
    ok: false,
    error: `Unknown tool: ${name}`,
    suggestions,
    hint:
      suggestions[0] === "shell_move_app"
        ? "To move a desktop icon use shell_move_app with {app, x, y}. There is no shell_move_window."
        : "Only call tools from the Available My Space tools list. Retry with a suggested name — do not ask the user.",
  };
}

function listAiTools() {
  return { ok: true, tools: listToolsStatus(getAllToolDefs()) };
}

function setAiToolActive(name, active) {
  const n = String(name || "").trim();
  if (!n) return { ok: false, error: "Tool name required" };
  const known = new Set(getAllToolDefs().map((t) => t.name));
  if (!known.has(n)) return { ok: false, error: `Unknown tool: ${n}` };
  return setToolEnabled(n, !!active);
}

module.exports = {
  getAllToolDefs,
  getActiveToolDefs,
  toOpenAiTools,
  toolSystemPrompt,
  executeTool,
  listAiTools,
  setAiToolActive,
  resolveToolName,
  TOOL_ALIASES,
};