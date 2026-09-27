const crypto = require("crypto");
const { runAgentLoop } = require("../ai/agent-loop");
const { listAiTools, setAiToolActive } = require("../ai/tools-registry");
const {
  tryLocalIntent,
  isLabInfraError,
  friendlyLabError,
} = require("../ai/local-intents");
const { createMindSideChat, syncMindSideChat } = require("./chat-ipc");

const LAB_API_KEY =
  "lab_ac8da903c9aca2075f9faaf035b39876154b8e8c096ad3ad57b42302abdfce0b";
const LAB_PROJECT_ID = "mlprj_6822a7873f13cc3a";
const LAB_PROGRAM = "operating system";
const LAB_BASE_URL = process.env.LAYER0_LAB_BASE_URL || "http://127.0.0.1:8080/v1";
const LAB_MODEL = "primary";

const MAX_MESSAGES = 40;
const MAX_CONTENT = 12000;

let getMainWindow = () => null;

function setAiChatMainWindowGetter(fn) {
  getMainWindow = typeof fn === "function" ? fn : () => null;
}

function newConversationId() {
  return `oschat_${Date.now().toString(36)}_${crypto.randomBytes(6).toString("hex")}`;
}

function clipContent(text) {
  const s = String(text || "").trim();
  if (!s) return "";
  return s.length > MAX_CONTENT ? s.slice(0, MAX_CONTENT) : s;
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  const out = [];
  for (const m of messages.slice(-MAX_MESSAGES)) {
    const role = String(m?.role || "").toLowerCase();
    if (role !== "user" && role !== "assistant" && role !== "system") continue;
    const content = clipContent(m?.content);
    if (!content) continue;
    out.push({ role, content });
  }
  return out;
}

function withLabProcess(body) {
  const payload = body && typeof body === "object" ? { ...body } : {};
  payload.user = LAB_PROGRAM;
  if (!payload.model) payload.model = LAB_MODEL;
  return payload;
}

async function labFetch(path, { method = "GET", body, conversationId } = {}) {
  const url = `${LAB_BASE_URL.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = {
    Authorization: `Bearer ${LAB_API_KEY}`,
    "Content-Type": "application/json",
    "X-Project-Id": LAB_PROJECT_ID,
    "X-Lab-Program": LAB_PROGRAM,
  };
  if (conversationId) {
    headers["X-Lab-Conversation-Id"] = conversationId;
  }

  const isChatCompletions = /\/chat\/completions\/?$/i.test(path);
  const finalBody =
    body && isChatCompletions ? withLabProcess(body) : body || undefined;

  const res = await fetch(url, {
    method,
    headers,
    body: finalBody ? JSON.stringify(finalBody) : undefined,
  });
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.message ||
      data?.error ||
      `HTTP ${res.status}`;
    const err = new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function persistMindChat(conversationId, userMessages, result) {
  try {
    const content = String(result?.content || "").trim();
    if (!content && !result?.ok) return;
    const messages = [
      ...(Array.isArray(userMessages) ? userMessages : []),
      {
        role: "assistant",
        content: content || "(empty response)",
        toolsUsed: Array.isArray(result?.toolsUsed) ? result.toolsUsed : undefined,
        model: result?.model || "",
      },
    ];
    syncMindSideChat({
      conversationId,
      messages,
    });
  } catch (err) {
    console.warn("[mind-chat] history sync failed:", err?.message || err);
  }
}

async function chatViaMindFallback(normalized) {
  try {
    const engine = require("../mind/engine");
    const snap = engine.snapshot?.() || {};
    if (!snap.ready && !snap.hasKey) return null;
    const result = await engine.chat({
      task: "chat",
      messages: normalized,
      includeMemory: true,
    });
    if (!result?.ok) {
      return {
        ok: false,
        error: result?.error || "Mind fallback failed",
        model: result?.model || "mind",
      };
    }
    return {
      ok: true,
      content: String(result.text || result.content || "").trim() || "(empty response)",
      model: result.model || "mind",
      toolsUsed: [],
      via: "mind-fallback",
    };
  } catch (err) {
    return {
      ok: false,
      error: err?.message || String(err),
      model: "mind",
    };
  }
}

async function chatCompletions(messages, conversationId, windowGetter) {
  const normalized = normalizeMessages(messages);
  if (!normalized.length) {
    return { ok: false, error: "Message required" };
  }
  let convId = String(conversationId || "").trim();
  if (!convId) {
    try {
      const created = createMindSideChat();
      convId = created.conversation?.id || newConversationId();
    } catch {
      convId = newConversationId();
    }
  }
  const resolveWindow =
    typeof windowGetter === "function"
      ? windowGetter
      : typeof getMainWindow === "function"
        ? getMainWindow
        : () => null;

  try {
    const local = await tryLocalIntent(normalized, resolveWindow);
    if (local?.ok) {
      persistMindChat(convId, normalized, local);
      return {
        ...local,
        conversationId: convId,
        projectId: LAB_PROJECT_ID,
        program: LAB_PROGRAM,
        model: "local-intent",
      };
    }
  } catch {
  }

  try {
    const result = await runAgentLoop({
      labFetch,
      model: LAB_MODEL,
      program: LAB_PROGRAM,
      messages: normalized,
      conversationId: convId,
      getMainWindow: resolveWindow,
    });
    persistMindChat(convId, normalized, result);
    return {
      ...result,
      conversationId: convId,
      projectId: LAB_PROJECT_ID,
      program: LAB_PROGRAM,
    };
  } catch (err) {
    if (isLabInfraError(err)) {
      try {
        const local = await tryLocalIntent(normalized, resolveWindow);
        if (local?.ok) {
          persistMindChat(convId, normalized, local);
          return {
            ...local,
            conversationId: convId,
            projectId: LAB_PROJECT_ID,
            program: LAB_PROGRAM,
            model: "local-intent",
            labError: err.message || String(err),
          };
        }
      } catch {
      }

      const mind = await chatViaMindFallback(normalized);
      if (mind?.ok) {
        persistMindChat(convId, normalized, mind);
        return {
          ...mind,
          conversationId: convId,
          projectId: LAB_PROJECT_ID,
          program: LAB_PROGRAM,
          labError: err.message || String(err),
        };
      }
      if (mind && !mind.ok && mind.error) {
        return {
          ok: false,
          error: `${friendlyLabError(err)} · Mind: ${mind.error}`,
          status: err.status || 0,
          conversationId: convId,
          program: LAB_PROGRAM,
        };
      }
    }
    return {
      ok: false,
      error: friendlyLabError(err),
      status: err.status || 0,
      conversationId: convId,
      program: LAB_PROGRAM,
    };
  }
}

async function listModels() {
  try {
    const data = await labFetch("/models");
    return { ok: true, models: data?.data || [], program: LAB_PROGRAM };
  } catch (err) {
    return { ok: false, error: err.message || String(err), program: LAB_PROGRAM };
  }
}

async function handleAiChatInvoke(action, args = {}, event = null) {
  const { BrowserWindow } = require("electron");
  const senderWin = event?.sender ? BrowserWindow.fromWebContents(event.sender) : null;
  const windowGetter = () => {
    if (senderWin && !senderWin.isDestroyed()) return senderWin;
    return typeof getMainWindow === "function" ? getMainWindow() : null;
  };

  switch (action) {
    case "chat":
      return chatCompletions(args.messages, args.conversationId, windowGetter);
    case "newConversation": {
      try {
        const created = createMindSideChat();
        return {
          ok: true,
          conversationId: created.conversation.id,
          program: LAB_PROGRAM,
        };
      } catch (err) {
        return {
          ok: true,
          conversationId: newConversationId(),
          program: LAB_PROGRAM,
          warn: err?.message || String(err),
        };
      }
    }
    case "models":
      return listModels();
    case "listTools":
      return listAiTools();
    case "setToolActive":
      return setAiToolActive(args.name, args.active !== false);
    case "meta":
      return {
        ok: true,
        projectId: LAB_PROJECT_ID,
        program: LAB_PROGRAM,
        model: LAB_MODEL,
        baseUrl: LAB_BASE_URL,
      };
    default:
      return { ok: false, error: `Unknown ai-chat action: ${action}` };
  }
}

module.exports = {
  handleAiChatInvoke,
  setAiChatMainWindowGetter,
  newConversationId,
  LAB_PROGRAM,
  LAB_PROJECT_ID,
  LAB_MODEL,
};
