const { executeTool } = require("./tools-registry");
const { needsConfirm, requestActionConfirm, describeAction } = require("./action-confirm");
const { resolveCountryRef, isKnownCountryName } = require("./country-resolve");

const APP_WORD_ALIASES = {
  שעון: "clock",
  clock: "clock",
  "world-clock": "clock",
  stocks: "stocks",
  מניות: "stocks",
  מניה: "stocks",
  translate: "translate",
  תרגום: "translate",
  builds: "builds",
  drift: "drift",
  settings: "settings",
  הגדרות: "settings",
  desktop: "desktop",
  שולחן: "desktop",
  geography: "geography",
  geo: "geography",
  גאוגרפיה: "geography",
  "model-flow": "model-flow",
  modelflow: "model-flow",
  flow: "model-flow",
  bridge: "os-bridge",
  "os-bridge": "os-bridge",
  "os bridge": "os-bridge",
  vault: "vault",
  כספת: "vault",
  chat: "chat",
  "mind chat": "chat",
  mind: "chat",
  remote: "remote-hub",
  "remote hub": "remote-hub",
  console: "shell-console",
  shell: "shell-console",
  scripts: "scripts",
  connect: "mail",
  jobs: "jobs",
  notes: "notes",
  הערות: "notes",
  maps: "world-maps",
  "world maps": "world-maps",
};

const TICKER_STOP = new Set([
  "OPEN",
  "SHOW",
  "VIEW",
  "CLOSE",
  "FOCUS",
  "HELP",
  "STOCK",
  "STOCKS",
  "THE",
  "ME",
  "A",
  "AN",
  "TO",
  "MY",
  "APP",
  "PLEASE",
  "RUN",
  "GET",
]);

function lastUserText(messages) {
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") return String(messages[i].content || "").trim();
  }
  return "";
}

function cleanTicker(raw) {
  const sym = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.^=-]/g, "");
  if (!sym || sym.length > 12) return null;
  if (TICKER_STOP.has(sym)) return null;
  if (isKnownCountryName(sym) || isKnownCountryName(String(raw || "").trim())) return null;
  if (!/^[A-Z][A-Z0-9.^=-]{0,11}$/.test(sym)) return null;
  return sym;
}

function extractCountry(text) {
  const t = String(text || "").trim();

  let   m = t.match(/run\s+geography\s*\(\s*([^)]+)\s*\)/i);
  if (m) {
    const inner = m[1].replace(/^(?:explore|learn|country)\s*:\s*/i, "").trim();
    const code = resolveCountryRef(inner);
    if (code) return code;
  }

  m = t.match(/geography\s*\(\s*([^)]+)\s*\)/i);
  if (m) {
    const inner = m[1].replace(/^(?:explore|learn|country)\s*:\s*/i, "").trim();
    const code = resolveCountryRef(inner);
    if (code) return code;
  }

  m = t.match(
    /(?:geography|גאוגרפיה|מדינה|country)\s*(?::|of\s+|של\s+)?\s*([A-Za-z][A-Za-z\s\-']{1,40})$/i
  );
  if (m) {
    const code = resolveCountryRef(m[1].trim());
    if (code) return code;
  }

  m = t.match(
    /(?:תראה|הצג|פתח|show|open|view)\s+(?:me\s+|לי\s+)?(?:את\s+|the\s+)?(?:המדינה\s+|country\s+)?([A-Za-z][A-Za-z\s\-']{1,40})$/i
  );
  if (m) {
    const candidate = m[1].trim();
    if (!/stock|מניה|app/i.test(candidate)) {
      const code = resolveCountryRef(candidate);
      if (code && (isKnownCountryName(candidate) || candidate.length <= 3)) return code;
    }
  }

  return null;
}

function extractTicker(text) {
  const t = String(text || "").trim();

  let m = t.match(/run\s+stocks?\s*\(\s*([A-Za-z0-9.^=-]{1,12})\s*\)/i);
  if (m) return cleanTicker(m[1]);

  m = t.match(
    /(?:תראה|הצג|פתח)\s+(?:לי\s+)?(?:את\s+)?(?:המניה\s+)([A-Za-z][A-Za-z0-9.]{0,11})\b/i
  );
  if (m) return cleanTicker(m[1]);

  m = t.match(
    /(?:show|view|open)\s+(?:me\s+)?(?:the\s+)?(?:stock\s+)([A-Za-z][A-Za-z0-9.]{0,11})\b/i
  );
  if (m) return cleanTicker(m[1]);

  m = t.match(/\b(?:stock|ticker|symbol)\b\s*(?:of\s+|for\s+|:=\s*)?([A-Za-z][A-Za-z0-9.]{0,11})\b/i);
  if (m) return cleanTicker(m[1]);

  m = t.match(/\bמניה\b\s*(?:של\s+)?([A-Za-z][A-Za-z0-9.]{0,11})\b/i);
  if (m) return cleanTicker(m[1]);

  m = t.match(/\b([A-Za-z][A-Za-z0-9.]{0,11})\b\s*(?:\bstock\b|\bמניה\b)/i);
  if (m) return cleanTicker(m[1]);

  return null;
}

function extractAppRef(text, verbs) {
  const t = String(text || "").trim();
  const verb = verbs.join("|");
  const re = new RegExp(`(?:${verb})\\s+(?:את\\s+|the\\s+)?(.+)$`, "i");
  const m = t.match(re);
  if (!m) return null;
  let ref = m[1].trim().replace(/[?.!]+$/g, "");
  ref = ref.replace(/^(?:את\s+|the\s+|app\s+|אפליקצי(?:ה|ית)\s+)/i, "").trim();
  const key = ref.toLowerCase();
  if (APP_WORD_ALIASES[key]) return APP_WORD_ALIASES[key];
  const first = ref.split(/\s+/)[0];
  if (APP_WORD_ALIASES[first.toLowerCase()]) return APP_WORD_ALIASES[first.toLowerCase()];
  return ref || null;
}

function hasVerb(text, verbs) {
  const t = String(text || "");
  return verbs.some((v) => {
    if (/[a-z]/i.test(v)) {
      return new RegExp(`(?:^|\\s)${v}(?=\\s|$)`, "i").test(t);
    }
    return new RegExp(`(?:^|\\s)${v}(?=\\s|$)`).test(t);
  });
}

/**
 * @returns {{ autoApprove: boolean, reply: string, steps: Array<{name:string,arguments:object}> } | null}
 */
function parseLocalIntent(text) {
  const t = String(text || "").trim();
  if (!t || t.length > 240) return null;

  const country = extractCountry(t);
  if (country) {
    return {
      autoApprove: true,
      reply: `Opening ${country} in Geography.`,
      steps: [{ name: "shell_open_country", arguments: { country } }],
    };
  }

  const ticker = extractTicker(t);
  if (ticker) {
    return {
      autoApprove: true,
      reply: `Opening ${ticker} in Stocks.`,
      steps: [
        {
          name: "shell_open_stock",
          arguments: { symbol: ticker },
        },
      ],
    };
  }

  if (hasVerb(t, ["close", "סגור"])) {
    if (/(?:^|\s)(?:all|הכל|הכול)(?=\s|$)/i.test(t) || /סגור\s+(?:את\s+)?הכל/.test(t)) {
      return {
        autoApprove: false,
        reply: "Closing all open apps.",
        steps: [{ name: "shell_run_command", arguments: { command: "close all" } }],
      };
    }
    const app = extractAppRef(t, ["close", "סגור"]);
    if (app && app !== "desktop") {
      return {
        autoApprove: false,
        reply: `Closing ${app}.`,
        steps: [{ name: "shell_close_app", arguments: { app } }],
      };
    }
  }

  if (hasVerb(t, ["focus"]) || /(?:^|\s)מקד(?=\s|$)/.test(t)) {
    const app = extractAppRef(t, ["focus", "מקד"]);
    if (app) {
      return {
        autoApprove: true,
        reply: `Focusing ${app}.`,
        steps: [{ name: "shell_focus_app", arguments: { app } }],
      };
    }
  }

  if (hasVerb(t, ["open", "פתח", "הפעל"])) {
    const app = extractAppRef(t, ["open", "פתח", "הפעל"]);
    if (app) {
      if (app === "desktop" || /שולחן/.test(app)) {
        return {
          autoApprove: true,
          reply: "Showing desktop.",
          steps: [{ name: "shell_run_command", arguments: { command: "desktop" } }],
        };
      }
      return {
        autoApprove: true,
        reply: `Opening ${app}.`,
        steps: [{ name: "shell_open_app", arguments: { app } }],
      };
    }
  }

  if (/(?:הצג|show)\s+(?:את\s+)?(?:ה)?(?:desktop|שולחן)/i.test(t) || /^desktop$/i.test(t)) {
    return {
      autoApprove: true,
      reply: "Showing desktop.",
      steps: [{ name: "shell_run_command", arguments: { command: "desktop" } }],
    };
  }

  return null;
}

async function runLocalIntent(plan, getMainWindow) {
  if (!plan?.steps?.length) return null;
  const ctx = { getMainWindow };
  const toolsUsed = [];

  for (const step of plan.steps) {
    const name = step.name;
    const args = step.arguments || {};
    let result;

    if (needsConfirm(name) && !plan.autoApprove) {
      const decision = await requestActionConfirm(getMainWindow, { name, arguments: args });
      if (!decision.approved) {
        result = {
          ok: false,
          declined: true,
          error: "User declined this action",
          tool: name,
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
              appId: result.appId,
              command: result.command,
            }
          : result,
      label: describeAction(name, args),
      declined: !!result?.declined,
    });

    if (result?.declined) {
      return {
        ok: true,
        content: `Skipped: ${describeAction(name, args)}.`,
        toolsUsed,
        localIntent: true,
      };
    }
    if (result && result.ok === false) {
      return {
        ok: true,
        content: `Couldn't complete that: ${result.error || result.message || "failed"}.`,
        toolsUsed,
        localIntent: true,
      };
    }
  }

  return {
    ok: true,
    content: plan.reply || "Done.",
    toolsUsed,
    localIntent: true,
  };
}

async function tryLocalIntent(messages, getMainWindow) {
  const text = lastUserText(messages);
  const plan = parseLocalIntent(text);
  if (!plan) return null;
  return runLocalIntent(plan, getMainWindow);
}

function isLabInfraError(err) {
  const msg = String(err?.message || err || "").toLowerCase();
  return (
    msg.includes("billing") ||
    msg.includes("sign out") ||
    msg.includes("unauthorized") ||
    msg.includes("401") ||
    msg.includes("402") ||
    msg.includes("403") ||
    msg.includes("econnrefused") ||
    msg.includes("fetch failed") ||
    msg.includes("network")
  );
}

function friendlyLabError(err) {
  const raw = String(err?.message || err || "Chat failed");
  if (/billing/i.test(raw)) {
    return (
      "Model Lab billing isn't available right now. " +
      "Clear actions still work offline: try: “open stocks”, “תראה לי את המניה AAPL”, or use Ctrl+K. " +
      `(${raw})`
    );
  }
  if (/fetch failed|econnrefused|econnreset|etimedout|network|enotfound|127\.0\.0\.1:8080/i.test(raw)) {
    return (
      "Model Lab isn’t running (localhost:8080), so Mind Chat can’t reach it. " +
      "Start the Lab server, or add a Gemini key in Mind → Setup so chat can fall back. " +
      `(${raw})`
    );
  }
  return raw;
}
module.exports = {
  parseLocalIntent,
  tryLocalIntent,
  runLocalIntent,
  extractTicker,
  isLabInfraError,
  friendlyLabError,
  lastUserText,
};