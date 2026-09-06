const { BrowserWindow } = require("electron");
const mindEngine = require("../mind/engine");
const { parseLocalIntent, runLocalIntent } = require("../ai/local-intents");
const { executeTool } = require("../ai/tools-registry");
const { needsConfirm, requestActionConfirm, describeAction } = require("../ai/action-confirm");

function getMainWindow() {
  return (
    BrowserWindow.getFocusedWindow() ||
    BrowserWindow.getAllWindows().find((w) => !w.isDestroyed()) ||
    null
  );
}

const SAFE_SHELL =
  /^(?:run\s+)?(?:help|desktop|settings|bridge|remote|chat|mind|console|scripts|jobs|connect|stocks|clock|today|vault|notes|maps|drift|builds|translate|contacts|docs|sysinfo|system[\s-]?info)\b/i;

function looksLikeShellLine(text) {
  const t = String(text || "").trim();
  if (!t || t.length > 200) return false;
  if (/^(?:run|תריץ|בצע)\s+/i.test(t)) return true;
  if (/^[a-z][\w-]*\s*\([^)]*\)$/i.test(t)) return true;
  if (/^(?:help|desktop|settings)(?:\s|$)/i.test(t)) return true;
  return false;
}

function normalizeShellCommand(text) {
  let t = String(text || "").trim();
  t = t.replace(/^(?:תריץ|בצע)\s+/i, "run ");
  return t;
}

function parseSpacehandIntent(text) {
  const t = String(text || "").trim();
  if (!t) return null;

  const local = parseLocalIntent(t);
  if (local) return local;

  if (looksLikeShellLine(t)) {
    const command = normalizeShellCommand(t);
    const autoApprove =
      SAFE_SHELL.test(command) ||
      /^[a-z][\w-]*\s*\(\s*(?:open|list|status|help|devices|panel|pair)?/i.test(command);
    return {
      autoApprove,
      reply: `Running \`${command}\`.`,
      steps: [{ name: "shell_run_command", arguments: { command } }],
    };
  }

  if (/(?:pair|pairing|חבר|חיבור|קוד\s*זוגי)/i.test(t) && /(?:phone|טלפון|bridge|ברידג|os\s*bridge)/i.test(t)) {
    return {
      autoApprove: true,
      reply: "Opening OS Bridge · Devices for pairing.",
      steps: [{ name: "shell_run_command", arguments: { command: "bridge(devices)" } }],
    };
  }

  return null;
}

function extractActionsFromReply(text) {
  const lines = String(text || "").split(/\r?\n/);
  const actions = [];
  const kept = [];
  for (const line of lines) {
    const m = line.match(/^\s*ACTION\s*:\s*([a-z0-9_]+)\s*:\s*(.+?)\s*$/i);
    if (!m) {
      kept.push(line);
      continue;
    }
    const name = m[1].trim();
    const raw = m[2].trim();
    if (name === "shell_open_app" || name === "shell_focus_app" || name === "shell_close_app") {
      actions.push({ name, arguments: { app: raw } });
    } else if (name === "shell_open_stock") {
      actions.push({ name, arguments: { symbol: raw.toUpperCase() } });
    } else if (name === "shell_open_country") {
      actions.push({ name, arguments: { country: raw } });
    } else if (name === "shell_run_command") {
      actions.push({ name, arguments: { command: normalizeShellCommand(raw) } });
    } else if (name === "shell_open_page") {
      const [app, page] = raw.split(/[|>:/]/).map((s) => s.trim());
      if (app) actions.push({ name, arguments: { app, page: page || "home" } });
    }
  }
  const reply = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return { reply, actions: actions.slice(0, 3) };
}

async function executeSteps(steps, { autoApprove = false } = {}) {
  const ctx = { getMainWindow };
  const toolsUsed = [];

  for (const step of steps) {
    const name = step.name;
    const args = step.arguments || {};
    let result;

    if (needsConfirm(name) && !autoApprove) {
      const decision = await requestActionConfirm(getMainWindow, { name, arguments: args });
      if (!decision.approved) {
        result = {
          ok: false,
          declined: true,
          error: "User declined this action",
          label: describeAction(name, args),
        };
      } else {
        result = await executeTool(name, args, ctx);
      }
    } else {
      result = await executeTool(name, args, ctx);
    }

    toolsUsed.push({
      name,
      arguments: args,
      result:
        result && typeof result === "object"
          ? {
              ok: result.ok,
              error: result.error,
              message: result.message,
              declined: result.declined,
            }
          : result,
      label: describeAction(name, args),
      declined: !!result?.declined,
    });

    if (result?.declined || result?.ok === false) break;
  }

  return toolsUsed;
}

function stepsAreAutoSafe(actions) {
  return actions.every((a) => {
    if (a.name === "shell_open_app" || a.name === "shell_focus_app") return true;
    if (a.name === "shell_open_stock" || a.name === "shell_open_country") return true;
    if (a.name === "shell_open_page") return true;
    if (a.name === "shell_run_command") return SAFE_SHELL.test(a.arguments?.command || "");
    return false;
  });
}

const ACTION_PROTOCOL = `When the user wants you to DO something in My Space (open/close/run/focus), append up to 3 action lines AFTER your short reply. Exact format:
ACTION:shell_open_app:<app name or id>
ACTION:shell_focus_app:<app>
ACTION:shell_close_app:<app>
ACTION:shell_run_command:<shell line >
ACTION:shell_open_stock:<TICKER>
ACTION:shell_open_country:<name or code>
Rules: never invent tool names; prefer these; no ACTION lines for pure Q&A.`;

async function runSpacehandTurn({ text, system, temperature, mindTask, model, prompt, messages }) {
  const intent = parseSpacehandIntent(text);
  if (intent?.steps?.length) {
    const local = await runLocalIntent(intent, getMainWindow);
    if (local?.ok) {
      return {
        ok: true,
        text: local.content,
        toolsUsed: local.toolsUsed || [],
        model: "local-intent",
        task: mindTask || "chat",
        localIntent: true,
      };
    }
  }

  const mindArgs = {
    prompt,
    messages,
    task: mindTask || "chat",
    system: `${system}\n\n${ACTION_PROTOCOL}`,
    temperature: typeof temperature === "number" ? temperature : 0.35,
    includeMemory: args.includeMemory !== false,
  };
  if (model) mindArgs.model = model;

  const result = await mindEngine.complete(mindArgs);
  if (!result?.ok) {
    return { ok: false, error: result?.error || "Mind request failed" };
  }

  const parsed = extractActionsFromReply(result.text || "");
  let toolsUsed = [];
  if (parsed.actions.length) {
    toolsUsed = await executeSteps(parsed.actions, {
      autoApprove: stepsAreAutoSafe(parsed.actions),
    });
  }

  const textOut = (parsed.reply || result.text || "").trim();
  return {
    ok: true,
    text: textOut,
    toolsUsed,
    model: result.model,
    task: result.task,
    taskLabel: result.taskLabel,
    tokens: result.tokens,
  };
}

module.exports = {
  runSpacehandTurn,
  parseSpacehandIntent,
  extractActionsFromReply,
  getMainWindow,
};
