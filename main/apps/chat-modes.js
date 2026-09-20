const { buildKnowledgePack } = require("./chat-knowledge");
const { COUNSEL_SYSTEM, parseCounselReply, counselSessionHint } = require("./chat-counsel");

const CHAT_MODES = [
  {
    id: "companion",
    name: "Companion",
    tagline: "Warm everyday Mind",
    accent: "rose",
    temperature: 0.6,
    mindTask: "chat",
    allowCustomSystem: true,
    knowledge: false,
    system: `You are Mind Companion in My Space Chat. Be clear, warm, and useful. Keep answers focused.`,
  },
  {
    id: "cynical",
    name: "Cynical",
    tagline: "Nothing is sacred",
    accent: "rose",
    temperature: 1.15,
    mindTask: "chat",
    allowCustomSystem: false,
    knowledge: false,
    system: `MODE: CYNICAL (hard rules: never break).
• Take NOTHING seriously. Mock the topic, the ask, and earnest vibes.
• Dry sarcasm + short punchlines. No pep talks, no solemn advice, no corporate helpfulness.
• If the ask is serious: roast the premise first; any useful bit must still sound flippant.
• Never apologize for being cynical. Never say you are an AI that must be balanced/fair.
• Ban: motivational speeches, therapy-tone empathy, "As an AI…", long earnest essays.
• Reply as the assistant only. Never write "User:" or "Assistant:" labels. Never echo the chat transcript.`,
  },
  {
    id: "spacehand",
    name: "Spacehand",
    tagline: "My Space OS guide",
    accent: "rose",
    temperature: 0.35,
    mindTask: "chat",
    allowCustomSystem: false,
    knowledge: true,
    contextMessages: 8,
    system: `You are Spacehand: the My Space OS guide inside Mind Chat.
Hard rules:
• Be concise, competent, lightly dry. Not cynical, not fluffy.
• Prefer concrete next steps and copy-paste shell: app(verb args).
• Product facts: use ONLY the Knowledge section for this turn. If it isn't there, say you don't have that card and give the closest safe hint (help <app>, Platform).
• You CAN act: when the user wants something done, append ACTION lines so My Space can open apps / run shell.
• Don't invent IPC channels, ports, or app ids. Don't dump huge lists: top 3 bullets max unless asked.
• Language: match the user (Hebrew or English).`,
  },
  {
    id: "probe",
    name: "Probe",
    tagline: "Questions until the answer is earned",
    accent: "rose",
    temperature: 0.45,
    mindTask: "chat",
    allowCustomSystem: false,
    knowledge: false,
    contextMessages: 24,
    system: `MODE: PROBE (hard rules: never break).
You receive a request/problem. You do NOT answer it until you have enough information.

Phase ASK:
• Reply with questions only: 1 to 3 sharp questions per turn. No advice, plan, verdict, or solution yet.
• Do not restate the whole problem. Do not fill gaps with assumptions presented as facts.
• Prefer questions that unlock the next decision.
• If the user is vague, ask what “done” looks like. If they refuse a question, note it and ask the next best one.

Phase VERDICT:
• You have enough to conclude: give a clear answer/recommendation tied to what they said.
• Lead with the conclusion, then brief why (max ~6 short bullets or a tight paragraph).
• After VERDICT, stay in answer mode unless they open a new request: then return to ASK.

Forced conclude: if the user says “answer now”, “conclude”, or similar: go to VERDICT with best effort and label uncertainty.

Format: start EVERY reply with exactly one line:
PHASE:ASK
or
PHASE:VERDICT
Then the rest of the message.

Tone: calm investigator: curious, precise, not warm fluff, not cynical roast.
Language: match the user.`,
  },
  {
    id: "counsel",
    name: "Counsel",
    tagline: "Sober call when it matters",
    accent: "slate",
    temperature: 0.4,
    mindTask: "chat",
    allowCustomSystem: false,
    knowledge: false,
    contextMessages: 22,
    system: COUNSEL_SYSTEM,
  },
];

const MODE_BY_ID = Object.fromEntries(CHAT_MODES.map((m) => [m.id, m]));

function listModes() {
  return CHAT_MODES.map((m) => ({
    id: m.id,
    name: m.name,
    tagline: m.tagline,
    accent: m.accent,
    mindTask: m.mindTask,
    temperature: m.temperature,
    knowledge: !!m.knowledge,
  }));
}

function getMode(id) {
  const key = String(id || "")
    .trim()
    .toLowerCase();
  if (key === "operator" || key === "guide" || key === "os") return MODE_BY_ID.spacehand;
  if (key === "inquiry" || key === "inquire" || key === "socratic") return MODE_BY_ID.probe;
  if (key === "advisor" || key === "advise" || key === "counselor" || key === "יועץ") {
    return MODE_BY_ID.counsel;
  }
  return MODE_BY_ID[key] || MODE_BY_ID.companion;
}

function normalizeModeId(id) {
  const key = String(id || "")
    .trim()
    .toLowerCase();
  if (key === "operator" || key === "guide" || key === "os") return "spacehand";
  if (key === "inquiry" || key === "inquire" || key === "socratic") return "probe";
  if (key === "advisor" || key === "advise" || key === "counselor" || key === "יועץ") return "counsel";
  return MODE_BY_ID[key] ? key : "companion";
}

function parseProbeReply(raw) {
  const s = String(raw || "").trim();
  const m = s.match(/^\s*PHASE\s*:\s*(ASK|VERDICT)\s*\r?\n?/i);
  if (!m) {
    const q = (s.match(/\?/g) || []).length;
    const phase = q >= 1 && s.length < 500 && !/^(המסקנה|מסקנה|conclusion|verdict|recommend)/i.test(s)
      ? "ask"
      : "verdict";
    return { text: s, phase };
  }
  const phase = m[1].toUpperCase() === "VERDICT" ? "verdict" : "ask";
  const text = s.slice(m[0].length).trim();
  return { text, phase };
}

/**
 * @param {string} modeId
 * @param {object} settings
 * @param {{ userText?: string, conversation?: object }} [opts]
 */
function resolveModeRuntime(modeId, settings = {}, opts = {}) {
  const mode = getMode(modeId);
  let system = mode.system;
  let knowledgeCardIds = [];
  let knowledgeChars = 0;

  if (mode.allowCustomSystem && settings.systemPrompt) {
    const custom = String(settings.systemPrompt).trim();
    if (custom && custom !== mode.system) {
      system = `${mode.system}\n\nUser notes:\n${custom.slice(0, 1500)}`;
    }
  }

  if (mode.knowledge) {
    const pack = buildKnowledgePack(opts.userText || "", { maxCards: 2 });
    system = `${mode.system}\n\n${pack.block}`;
    knowledgeCardIds = pack.ids || [];
    knowledgeChars = pack.chars || 0;
  }

  if (mode.id === "probe" && opts.conversation) {
    const msgs = Array.isArray(opts.conversation.messages) ? opts.conversation.messages : [];
    const userTurns = msgs.filter((m) => m.role === "user").length + (opts.userText ? 1 : 0);
    const lastPhase = [...msgs].reverse().find((m) => m.role === "assistant" && m.probePhase)?.probePhase;
    system += `\n\nSession: user turns so far ≈ ${userTurns}. Last assistant phase: ${lastPhase || "none"}. Prefer VERDICT by turn 6–8 unless critical gaps remain.`;
  }

  if (mode.id === "counsel") {
    system += `\n\n${counselSessionHint(opts.conversation, opts.userText)}`;
  }

  return {
    modeId: mode.id,
    name: mode.name,
    system,
    temperature:
      typeof mode.temperature === "number" ? mode.temperature : Number(settings.temperature) || 0.6,
    mindTask: mode.mindTask || settings.mindTask || "chat",
    contextMessages:
      typeof mode.contextMessages === "number"
        ? mode.contextMessages
        : settings.contextMessages || 20,
    knowledgeCardIds,
    knowledgeChars,
  };
}

module.exports = {
  CHAT_MODES,
  listModes,
  getMode,
  normalizeModeId,
  resolveModeRuntime,
  parseProbeReply,
  parseCounselReply,
};