const path = require("path");
const { app } = require("electron");
const { loadJsonFile, saveJsonFile } = require("./safe-json-store");
const mindEngine = require("../mind/engine");
const { normalizeTaskId } = require("../mind/tasks");
const { reportLoadFailure, reportSaveFailure } = require("../resolve/report-helper");
const {
  listModes,
  normalizeModeId,
  resolveModeRuntime,
  getMode,
  parseProbeReply,
  parseCounselReply,
} = require("./chat-modes");

const profile = require("../myspace-profile");
const DATA_FILE = () => profile.profileScopedPath("chat-app.json");

function uid(prefix = "c") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function defaultSettings() {
  return {
    mindTask: "chat",
    model: "",
    contextMessages: 20,
    systemPrompt: "You are a helpful assistant in My Space Chat. Be clear and useful.",
    temperature: 0.6,
    chatMode: "companion",
    memoryEnabled: true,
    lastConversationId: "",
  };
}

function defaultState() {
  return {
    version: 1,
    conversations: [],
    settings: defaultSettings(),
  };
}

function clampInt(n, min, max, fallback) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.round(v)));
}

function normalizeMessage(raw) {
  if (!raw || typeof raw !== "object") return null;
  const role = String(raw.role || "").toLowerCase();
  if (role !== "user" && role !== "assistant" && role !== "system") return null;
  const content = String(raw.content || raw.text || "");
  if (!content.trim() && role !== "assistant") return null;
  const msg = {
    id: String(raw.id || uid("m")),
    role,
    content,
    createdAt: raw.createdAt || nowIso(),
    model: raw.model ? String(raw.model) : "",
    task: raw.task ? String(raw.task) : "",
    tokens: Number(raw.tokens) || 0,
  };
  if (Array.isArray(raw.toolsUsed) && raw.toolsUsed.length) {
    msg.toolsUsed = raw.toolsUsed.slice(0, 12);
  }
  if (raw.probePhase === "ask" || raw.probePhase === "verdict") {
    msg.probePhase = raw.probePhase;
  }
  if (raw.counselFrame === "steady" || raw.counselFrame === "decide" || raw.counselFrame === "hold") {
    msg.counselFrame = raw.counselFrame;
  }
  if (raw.counselCall) msg.counselCall = String(raw.counselCall).slice(0, 800);
  if (raw.counselWhy) msg.counselWhy = String(raw.counselWhy).slice(0, 2000);
  if (raw.counselWatch) msg.counselWatch = String(raw.counselWatch).slice(0, 800);
  if (raw.counselReviseIf) msg.counselReviseIf = String(raw.counselReviseIf).slice(0, 800);
  return msg;
}

function titleFromMessages(messages) {
  const first = (messages || []).find((m) => m.role === "user" && m.content.trim());
  if (!first) return "New chat";
  const t = first.content.trim().replace(/\s+/g, " ");
  return t.length > 48 ? `${t.slice(0, 48)}…` : t;
}

function normalizeConversation(raw) {
  if (!raw || typeof raw !== "object") return null;
  const messages = Array.isArray(raw.messages)
    ? raw.messages.map(normalizeMessage).filter(Boolean).slice(-500)
    : [];
  const title = String(raw.title || "").trim().slice(0, 120) || titleFromMessages(messages);
  const source = String(raw.source || "").trim() === "mind-chat" ? "mind-chat" : "chat";
  return {
    id: String(raw.id || uid("c")),
    title,
    messages,
    mode: normalizeModeId(raw.mode),
    source,
    createdAt: raw.createdAt || nowIso(),
    updatedAt: raw.updatedAt || raw.createdAt || nowIso(),
    pinned: Boolean(raw.pinned),
  };
}

function normalizeSettings(raw) {
  const base = defaultSettings();
  const s = raw && typeof raw === "object" ? raw : {};
  const mindTask = normalizeTaskId(s.mindTask) || base.mindTask;
  return {
    mindTask,
    model: String(s.model || "").trim(),
    contextMessages: clampInt(s.contextMessages, 2, 100, base.contextMessages),
    systemPrompt: String(s.systemPrompt != null ? s.systemPrompt : base.systemPrompt).slice(0, 4000),
    temperature: Math.max(0, Math.min(2, Number(s.temperature) || base.temperature)),
    chatMode: normalizeModeId(s.chatMode || base.chatMode),
    memoryEnabled: s.memoryEnabled !== false,
    lastConversationId: String(s.lastConversationId || "").trim(),
  };
}

function normalizeState(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const conversations = Array.isArray(raw.conversations)
    ? raw.conversations.map(normalizeConversation).filter(Boolean).slice(0, 200)
    : [];
  conversations.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return {
    version: 1,
    conversations,
    settings: normalizeSettings(raw.settings),
  };
}

let state = null;

function unwrapLoaded(loaded, fallback = null) {
  if (!loaded || loaded.ok === false) return fallback;
  let data = loaded.data !== undefined ? loaded.data : fallback;
  if (
    data &&
    typeof data === "object" &&
    data.ok === true &&
    data.data &&
    typeof data.data === "object" &&
    (Array.isArray(data.data.conversations) || data.data.settings)
  ) {
    data = data.data;
  }
  return data;
}

function tryRecoverConversations(emptyState) {
  const fs = require("fs");
  const file = DATA_FILE();
  const candidates = [`${file}.bak`];
  try {
    const dir = path.dirname(file);
    const base = path.basename(file);
    for (const name of fs.readdirSync(dir)) {
      if (name.startsWith(`${base}.corrupt-`) && name.endsWith(".bak")) {
        candidates.push(path.join(dir, name));
      }
    }
  } catch {
  }

  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const raw = fs.readFileSync(candidate, "utf8");
      const parsed = JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
      const payload =
        parsed &&
        typeof parsed === "object" &&
        parsed.ok === true &&
        parsed.data &&
        typeof parsed.data === "object"
          ? parsed.data
          : parsed;
      const recovered = normalizeState(payload);
      if (recovered.conversations.length) {
        emptyState.conversations = recovered.conversations;
        if (!emptyState.settings?.lastConversationId && recovered.settings?.lastConversationId) {
          emptyState.settings.lastConversationId = recovered.settings.lastConversationId;
        }
        return true;
      }
    } catch {
    }
  }
  return false;
}

function load() {
  if (state) return state;
  const loaded = loadJsonFile(DATA_FILE(), { fallback: null });
  if (!loaded?.ok) {
    reportLoadFailure("chat", loaded);
  }
  const rawData = loaded?.ok ? loaded.data : null;
  const wasWrapped =
    rawData &&
    typeof rawData === "object" &&
    rawData.ok === true &&
    rawData.data &&
    typeof rawData.data === "object";
  const data = unwrapLoaded(loaded, null);
  state = normalizeState(data);
  if ((wasWrapped && state.conversations.length) || (!state.conversations.length && tryRecoverConversations(state))) {
    const repaired = saveJsonFile(DATA_FILE(), state, { listKey: "conversations" });
    if (!repaired.ok) reportSaveFailure("chat", repaired);
  }
  return state;
}

function save() {
  const s = load();
  const result = saveJsonFile(DATA_FILE(), s, { listKey: "conversations" });
  if (!result.ok) reportSaveFailure("chat", result);
  return s;
}

function rememberActiveConversation(id) {
  const s = load();
  const next = String(id || "").trim();
  if (s.settings.lastConversationId === next) return;
  s.settings.lastConversationId = next;
  save();
}

function listSummary() {
  const s = load();
  const items = s.conversations.map((c) => ({
    id: c.id,
    title: c.title,
    updatedAt: c.updatedAt,
    createdAt: c.createdAt,
    pinned: c.pinned,
    mode: c.mode || "companion",
    source: c.source || "chat",
    preview: (c.messages.find((m) => m.role === "user") || c.messages[0] || {}).content || "",
    messageCount: c.messages.length,
  }));
  items.sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return String(b.updatedAt).localeCompare(String(a.updatedAt));
  });
  return items;
}

function getConversation(id) {
  const s = load();
  return s.conversations.find((c) => c.id === id) || null;
}

function createConversation(args = {}) {
  const s = load();
  const mode = normalizeModeId(args.mode || s.settings.chatMode);
  const conv = normalizeConversation({
    id: uid("c"),
    title: String(args.title || "").trim() || "New chat",
    messages: [],
    mode,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  s.conversations.unshift(conv);
  save();
  rememberActiveConversation(conv.id);
  return { ok: true, conversation: conv };
}

function setConversationMode(id, modeId) {
  const conv = getConversation(id);
  if (!conv) return { ok: false, error: "Chat not found" };
  const mode = normalizeModeId(modeId);
  conv.mode = mode;
  conv.updatedAt = nowIso();
  const s = load();
  s.settings.chatMode = mode;
  save();
  return { ok: true, conversation: conv, mode: getMode(mode), settings: s.settings };
}

function deleteConversation(id) {
  const s = load();
  const before = s.conversations.length;
  s.conversations = s.conversations.filter((c) => c.id !== id);
  if (s.conversations.length === before) return { ok: false, error: "Chat not found" };
  if (s.settings.lastConversationId === id) {
    s.settings.lastConversationId = s.conversations[0]?.id || "";
  }
  save();
  return { ok: true };
}

function renameConversation(id, title) {
  const conv = getConversation(id);
  if (!conv) return { ok: false, error: "Chat not found" };
  const next = String(title || "").trim().slice(0, 120);
  if (!next) return { ok: false, error: "Title required" };
  conv.title = next;
  conv.updatedAt = nowIso();
  save();
  return { ok: true, conversation: conv };
}

function pinConversation(id, pinned) {
  const conv = getConversation(id);
  if (!conv) return { ok: false, error: "Chat not found" };
  conv.pinned = pinned == null ? !conv.pinned : Boolean(pinned);
  conv.updatedAt = nowIso();
  save();
  return { ok: true, conversation: conv };
}

function clearConversation(id) {
  const conv = getConversation(id);
  if (!conv) return { ok: false, error: "Chat not found" };
  conv.messages = [];
  conv.title = "New chat";
  conv.updatedAt = nowIso();
  save();
  return { ok: true, conversation: conv };
}

function createMindSideChat(args = {}) {
  const s = load();
  const conv = normalizeConversation({
    id: uid("mc"),
    title: String(args.title || "").trim() || "Mind Chat",
    messages: [],
    mode: "companion",
    source: "mind-chat",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  s.conversations.unshift(conv);
  save();
  rememberActiveConversation(conv.id);
  return { ok: true, conversation: conv };
}

function syncMindSideChat(args = {}) {
  const s = load();
  const id = String(args.conversationId || args.id || "").trim();
  let conv = id ? s.conversations.find((c) => c.id === id) : null;
  if (!conv) {
    conv = normalizeConversation({
      id: id || uid("mc"),
      title: String(args.title || "").trim() || "Mind Chat",
      messages: [],
      mode: "companion",
      source: "mind-chat",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    s.conversations.unshift(conv);
  }

  const messages = Array.isArray(args.messages)
    ? args.messages.map(normalizeMessage).filter(Boolean).slice(-500)
    : conv.messages;

  conv.messages = messages;
  conv.source = "mind-chat";
  const derived = titleFromMessages(messages);
  if (args.title) {
    conv.title = String(args.title).trim().slice(0, 120) || derived;
  } else if (!conv.title || conv.title === "Mind Chat" || conv.title === "New chat") {
    conv.title = derived;
  }
  conv.updatedAt = nowIso();
  save();
  rememberActiveConversation(conv.id);
  return { ok: true, conversation: conv };
}

async function regenerate(args = {}) {
  const conv = getConversation(args.id || args.conversationId);
  if (!conv) return { ok: false, error: "Chat not found" };
  while (conv.messages.length && conv.messages[conv.messages.length - 1].role !== "user") {
    conv.messages.pop();
  }
  const lastUser = conv.messages[conv.messages.length - 1];
  if (!lastUser || lastUser.role !== "user") {
    return { ok: false, error: "Nothing to regenerate" };
  }
  const text = lastUser.content;
  conv.messages.pop();
  save();
  return sendMessage({
    conversationId: conv.id,
    text,
    mindTask: args.mindTask,
    model: args.model,
  });
}

function buildContextPrompt(conv, settings, userText, contextLimit) {
  const limit = contextLimit || settings.contextMessages || 20;
  const prior = conv.messages.filter((m) => m.role === "user" || m.role === "assistant").slice(-limit);
  const lines = [];
  for (const m of prior) {
    lines.push(`${m.role === "user" ? "User" : "Assistant"}: ${m.content}`);
  }
  lines.push(`User: ${userText}`);
  lines.push("Assistant:");
  return lines.join("\n\n");
}

function buildContextMessages(conv, settings, userText, contextLimit) {
  const limit = contextLimit || settings.contextMessages || 20;
  const prior = (conv.messages || [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-limit);
  const out = [];
  for (const m of prior) {
    const content = String(m.content || "").trim();
    if (!content) continue;
    out.push({ role: m.role, content });
  }
  const latest = String(userText || "").trim();
  if (latest) out.push({ role: "user", content: latest });
  return out;
}

function stripTranscriptEcho(raw) {
  let t = String(raw || "").trim();
  if (!t) return t;
  if (!/^(?:User|Assistant)\s*:/i.test(t) && !/\n\s*Assistant\s*:/i.test(t)) return t;

  const matches = [...t.matchAll(/(?:^|\n)\s*Assistant\s*:\s*/gi)];
  if (matches.length) {
    const last = matches[matches.length - 1];
    t = t.slice(last.index + last[0].length).trim();
  } else {
    t = t.replace(/^\s*(?:User|Assistant)\s*:\s*/i, "").trim();
  }
  t = t.replace(/^\s*User\s*:[\s\S]*?(?:\n\n|$)/i, "").trim();
  return t;
}

async function sendMessage(args = {}) {
  const s = load();
  let conv = args.conversationId ? getConversation(args.conversationId) : null;
  if (!conv) {
    const created = createConversation({});
    conv = created.conversation;
  }

  const text = String(args.text || args.prompt || args.message || "").trim();
  if (!text) return { ok: false, error: "Empty message" };

  const settings = { ...s.settings };
  if (args.mindTask) {
    const t = normalizeTaskId(args.mindTask);
    if (t) settings.mindTask = t;
  }
  if (args.model != null && String(args.model).trim()) settings.model = String(args.model).trim();

  const modeRuntime = resolveModeRuntime(args.mode || conv.mode || settings.chatMode, settings, {
    userText: text,
    conversation: conv,
  });
  conv.mode = modeRuntime.modeId;

  const userMsg = normalizeMessage({
    role: "user",
    content: text,
    createdAt: nowIso(),
  });
  conv.messages.push(userMsg);
  if (conv.title === "New chat") conv.title = titleFromMessages(conv.messages);
  conv.updatedAt = nowIso();
  save();

  const prompt = buildContextPrompt(
    { ...conv, messages: conv.messages.slice(0, -1) },
    settings,
    text,
    modeRuntime.contextMessages
  );
  const messages = buildContextMessages(
    { ...conv, messages: conv.messages.slice(0, -1) },
    settings,
    text,
    modeRuntime.contextMessages
  );

  let result;
  if (modeRuntime.modeId === "spacehand") {
    const { runSpacehandTurn } = require("./chat-spacehand");
    result = await runSpacehandTurn({
      text,
      prompt,
      messages,
      system: modeRuntime.system,
      temperature: modeRuntime.temperature,
      mindTask: modeRuntime.mindTask || settings.mindTask || "chat",
      model: settings.model || "",
      includeMemory: settings.memoryEnabled !== false,
    });
  } else {
    const mindArgs = {
      messages,
      prompt,
      task: modeRuntime.mindTask || settings.mindTask || "chat",
      system: modeRuntime.system,
      temperature: modeRuntime.temperature,
      includeMemory: settings.memoryEnabled !== false,
    };
    if (settings.model) mindArgs.model = settings.model;
    result = await mindEngine.complete(mindArgs);
  }

  if (!result?.ok) {
    const errMsg = normalizeMessage({
      role: "assistant",
      content: `Error: ${result?.error || "Mind request failed"}`,
      createdAt: nowIso(),
    });
    conv.messages.push(errMsg);
    conv.updatedAt = nowIso();
    save();
    return {
      ok: false,
      error: result?.error || "Mind request failed",
      conversation: conv,
    };
  }

  let replyText = stripTranscriptEcho(result.text || "");
  let probePhase = "";
  let counselMeta = null;

  if (modeRuntime.modeId === "probe") {
    const parsed = parseProbeReply(replyText);
    replyText = stripTranscriptEcho(parsed.text);
    probePhase = parsed.phase;
  } else if (modeRuntime.modeId === "counsel") {
    counselMeta = parseCounselReply(replyText);
    replyText = stripTranscriptEcho(counselMeta.text);
  }

  const assistantMsg = normalizeMessage({
    role: "assistant",
    content: replyText,
    createdAt: nowIso(),
    model: result.model || settings.model || "",
    task: result.task || modeRuntime.mindTask || settings.mindTask || "",
    tokens: result.tokens || 0,
    probePhase: probePhase || undefined,
    counselFrame: counselMeta?.frame || undefined,
    counselCall: counselMeta?.call || undefined,
    counselWhy: counselMeta?.why || undefined,
    counselWatch: counselMeta?.watch || undefined,
    counselReviseIf: counselMeta?.reviseIf || undefined,
  });
  if (result.toolsUsed?.length) {
    assistantMsg.toolsUsed = result.toolsUsed;
  }
  conv.messages.push(assistantMsg);
  conv.updatedAt = nowIso();
  save();
  rememberActiveConversation(conv.id);

  return {
    ok: true,
    conversation: conv,
    message: assistantMsg,
    mind: {
      model: result.model,
      task: result.task,
      taskLabel: result.taskLabel,
      tokens: result.tokens,
      mode: modeRuntime.modeId,
      knowledgeCards: modeRuntime.knowledgeCardIds || [],
      toolsUsed: result.toolsUsed || [],
      localIntent: !!result.localIntent,
      probePhase: probePhase || "",
      counselFrame: counselMeta?.frame || "",
    },
  };
}

async function handleChatInvoke(channel, args = {}) {
  const ch = String(channel || "").trim();
  switch (ch) {
    case "chat.list":
      return { ok: true, conversations: listSummary() };
    case "chat.get": {
      const conv = getConversation(args.id || args.conversationId);
      if (!conv) return { ok: false, error: "Chat not found" };
      rememberActiveConversation(conv.id);
      return { ok: true, conversation: conv };
    }
    case "chat.create":
      return createConversation(args);
    case "chat.delete":
      return deleteConversation(args.id || args.conversationId);
    case "chat.rename":
      return renameConversation(args.id || args.conversationId, args.title);
    case "chat.pin":
      return pinConversation(args.id || args.conversationId, args.pinned);
    case "chat.clear":
      return clearConversation(args.id || args.conversationId);
    case "chat.regenerate":
      return regenerate(args || {});
    case "chat.send":
      return sendMessage(args);
    case "chat.settings.get": {
      const snap = mindEngine.snapshot();
      const mem = require("../mind/memory").snapshot();
      return {
        ok: true,
        settings: load().settings,
        modes: listModes(),
        memory: mem,
        mind: {
          ready: snap.ready,
          hasKey: snap.hasKey,
          tasks: snap.tasks || [],
          defaultTask: snap.defaultTask,
        },
      };
    }
    case "chat.modes.list":
      return { ok: true, modes: listModes(), active: load().settings.chatMode };
    case "chat.knowledge.list": {
      const { listKnowledgeCards } = require("./chat-knowledge");
      return { ok: true, cards: listKnowledgeCards() };
    }
    case "chat.mode.set": {
      const mode = normalizeModeId(args.mode || args.id);
      const convId = args.id || args.conversationId;
      if (convId) return setConversationMode(convId, mode);
      const s = load();
      s.settings.chatMode = mode;
      save();
      return { ok: true, mode: getMode(mode), settings: s.settings };
    }
    case "chat.settings.set": {
      const s = load();
      s.settings = normalizeSettings({ ...s.settings, ...(args.settings || args || {}) });
      save();
      return { ok: true, settings: s.settings };
    }
    case "chat.memory.list":
      return require("../mind/memory").listFacts();
    case "chat.memory.add":
      return require("../mind/memory").addFact(args);
    case "chat.memory.update":
      return require("../mind/memory").updateFact(args);
    case "chat.memory.delete":
      return require("../mind/memory").deleteFact(args);
    case "chat.memory.clear":
      return require("../mind/memory").clearFacts();
    case "chat.memory.enabled": {
      const res = require("../mind/memory").setEnabled(args.enabled);
      return res;
    }
    case "chat.mind.status":
      return mindEngine.snapshot();
    default:
      return { ok: false, error: `Unknown channel: ${ch}` };
  }
}

module.exports = {
  handleChatInvoke,
  createMindSideChat,
  syncMindSideChat,
  reloadForProfileSwitch() {
    state = null;
    return { ok: true };
  },
};