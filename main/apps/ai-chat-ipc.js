const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const { runAgentLoop } = require("../ai/agent-loop");
const { listAiTools, setAiToolActive } = require("../ai/tools-registry");
const {
  tryLocalIntent,
  isLabInfraError,
  friendlyLabError,
  friendlyOfflineAiError,
} = require("../ai/local-intents");
const { createMindSideChat, syncMindSideChat } = require("./chat-ipc");
const { INSTALL_WIDE_DIRS } = require("../myspace-profile");
const LAB_PROGRAM = "operating system";
const LAB_BASE_URL = process.env.LAYER0_LAB_BASE_URL || "http://127.0.0.1:8080/v1";
const LAB_MODEL = "primary";
const LAB_FETCH_TIMEOUT_MS = Number(process.env.LAYER0_LAB_FETCH_TIMEOUT_MS) || 20_000;

function readLabLocalConfig() {
  try {
    const bootPath = path.join(app.getAppPath(), "config", "lab.local.json");
    if (!fs.existsSync(bootPath)) return {};
    const raw = JSON.parse(fs.readFileSync(bootPath, "utf8"));
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function getLabApiKey() {
  const local = readLabLocalConfig();
  return (
    String(process.env.LAYER0_LAB_API_KEY || "").trim() ||
    String(process.env.MODEL_FLOW_API_KEY || "").trim() ||
    String(process.env.MODEL_FLOW_PRODUCT_KEY || "").trim() ||
    String(local.apiKey || local.labApiKey || "").trim() ||
    ""
  );
}

function getLabProjectId() {
  const local = readLabLocalConfig();
  return (
    String(process.env.LAYER0_LAB_PROJECT_ID || "").trim() ||
    String(local.projectId || "").trim() ||
    "mlprj_6822a7873f13cc3a"
  );
}

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

async function labFetch(reqPath, { method = "GET", body, conversationId } = {}) {
  const apiKey = getLabApiKey();
  if (!apiKey) {
    const err = new Error(
      "Lab API key missing: set LAYER0_LAB_API_KEY or config/lab.local.json"
    );
    err.status = 0;
    throw err;
  }
  const projectId = getLabProjectId();
  const url = `${LAB_BASE_URL.replace(/\/$/, "")}${reqPath.startsWith("/") ? reqPath : `/${reqPath}`}`;
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "X-Project-Id": projectId,
    "X-Lab-Program": LAB_PROGRAM,
  };
  if (conversationId) {
    headers["X-Lab-Conversation-Id"] = conversationId;
  }
  const isChatCompletions = /\/chat\/completions\/?$/i.test(reqPath);
  const finalBody =
    body && isChatCompletions ? withLabProcess(body) : body || undefined;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(3000, LAB_FETCH_TIMEOUT_MS));
  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      signal: controller.signal,
      body: finalBody ? JSON.stringify(finalBody) : undefined,
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      const timed = new Error(
        `Model Lab timed out after ${Math.round(LAB_FETCH_TIMEOUT_MS / 1000)}s (not reachable on localhost:8080)`
      );
      timed.status = 0;
      throw timed;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
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
    if (!snap.ready && !snap.hasKey) {
      return {
        ok: false,
        error:
          "No Gemini key and local Ollama isn’t enabled. Open Mind → Setup to add a key or turn on Ollama.",
        model: "mind",
      };
    }
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
        projectId: getLabProjectId(),
        program: LAB_PROGRAM,
        model: "local-intent",
      };
    }
  } catch {
  }
  const mindFirst = await chatViaMindFallback(normalized);
  if (mindFirst?.ok) {
    persistMindChat(convId, normalized, mindFirst);
    return {
      ...mindFirst,
      conversationId: convId,
      projectId: getLabProjectId(),
      program: LAB_PROGRAM,
    };
  }
  if (mindFirst && !mindFirst.ok) {
    return {
      ok: false,
      error:
        mindFirst.error ||
        "Add a Gemini key in Mind → Setup (or enable Ollama for local tasks).",
      conversationId: convId,
      program: LAB_PROGRAM,
    };
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
      projectId: getLabProjectId(),
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
            projectId: getLabProjectId(),
            program: LAB_PROGRAM,
            model: "local-intent",
            labError: err.message || String(err),
          };
        }
      } catch {
      }
      return {
        ok: false,
        error:
          "Add a Gemini key in Mind → Setup to use Mind Chat (Lab isn’t required right now).",
        status: err.status || 0,
        conversationId: convId,
        program: LAB_PROGRAM,
      };
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
        projectId: getLabProjectId(),
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
  getLabProjectId,
  LAB_MODEL,
};