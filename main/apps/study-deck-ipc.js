const {
  setupLocalAuthApp,
  requireSignedIn,
  userStorageRoot,
  registerLegacyMigrator,
  registerSingleFileMigrator,
} = require("./local-auth-app-helper");

const APP_ID = "study-deck";
const auth = setupLocalAuthApp(APP_ID);
registerSingleFileMigrator(APP_ID, "study-deck.json");

const DATA_FILE = () => auth.userDataPath("data.json");

function signedInGuard() {
  return requireSignedIn(auth);
}


const path = require("path");
const fs = require("fs");
const { app } = require("electron");
const { publishScreenFacts, getScreenFacts } = require("../ai/screen-facts-store");
const { loadJsonFile, saveJsonFile } = require("./safe-json-store");
const { scheduleCard: srsScheduleCard, dueQueue } = require("../../shared/parts/cards.srs");
const { reportLoadFailure, reportSaveFailure } = require("../resolve/report-helper");

const WM_ROOT = path.join(__dirname, "..", "..", "world-maps");
const { geminiGenerate } = require(path.join(WM_ROOT, "gemini-ipc.js"));

function dataPath() {
  return path.join(app.getPath("userData"), "study-deck.json");
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const CARD_TYPES = new Set(["flash", "qa", "quiz", "truefalse", "cloze"]);

function normalizeCardType(raw) {
  const t = String(raw || "flash").toLowerCase().trim();
  if (t === "mcq" || t === "multiple" || t === "choice") return "quiz";
  if (t === "tf" || t === "true-false" || t === "boolean") return "truefalse";
  if (t === "question" || t === "qna") return "qa";
  if (CARD_TYPES.has(t)) return t;
  return "flash";
}

function normalizeCard(raw) {
  if (!raw) return null;
  const type = normalizeCardType(raw.type || raw.kind || raw.format);
  let front = String(raw.front || raw.prompt || raw.question || raw.term || raw.cloze || "").trim();
  let back = String(raw.back || raw.answer || raw.definition || raw.explanation || "").trim();
  let choices = Array.isArray(raw.choices)
    ? raw.choices.map((c) => String(c ?? "").trim()).filter(Boolean)
    : [];
  let answerIndex = Number.isFinite(Number(raw.answerIndex)) ? Number(raw.answerIndex) : -1;
  if (type === "quiz") {
    if (!choices.length && Array.isArray(raw.options)) {
      choices = raw.options.map((c) => String(c ?? "").trim()).filter(Boolean);
    }
    if (answerIndex < 0 && raw.answer != null) {
      const ans = String(raw.answer).trim();
      answerIndex = choices.findIndex((c) => c === ans);
      if (answerIndex < 0 && /^\d+$/.test(ans)) answerIndex = Number(ans);
    }
    if (answerIndex < 0) answerIndex = 0;
    if (!front) return null;
    if (choices.length < 2) {
      back = back || choices[0] || "…";
      return normalizeCard({ ...raw, type: "qa", front, back, choices: undefined });
    }
    back = back || choices[answerIndex] || choices[0];
  } else if (type === "truefalse") {
    const truth =
      raw.answer === true ||
      raw.correct === true ||
      String(raw.answer || raw.back || "").toLowerCase() === "true" ||
      String(raw.answer || "").toLowerCase() === "נכון";
    choices = ["True", "False"];
    answerIndex = truth ? 0 : 1;
    back = truth ? "True" : "False";
    if (raw.explanation) back = `${back}\n${String(raw.explanation).trim()}`;
    if (!front) return null;
  } else {
    if (!front && !back) return null;
    front = front || "…";
    back = back || "…";
  }

  return {
    id: String(raw.id || uid("card")),
    type,
    front,
    back,
    choices,
    answerIndex: type === "quiz" || type === "truefalse" ? answerIndex : -1,
    explanation: String(raw.explanation || "").trim(),
    ease: Number.isFinite(Number(raw.ease)) ? Number(raw.ease) : 2.5,
    interval: Math.max(0, Number(raw.interval) || 0),
    dueAt: String(raw.dueAt || new Date().toISOString()),
    reps: Math.max(0, Number(raw.reps) || 0),
    lapses: Math.max(0, Number(raw.lapses) || 0),
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
  };
}

function normalizeDeck(raw) {
  if (!raw?.name?.trim()) return null;
  const cards = (Array.isArray(raw.cards) ? raw.cards : []).map(normalizeCard).filter(Boolean);
  return {
    id: String(raw.id || uid("deck")),
    name: String(raw.name).trim(),
    description: String(raw.description || "").trim(),
    color: String(raw.color || "#1f6f5b").trim() || "#1f6f5b",
    language: String(raw.language || "en").toLowerCase().startsWith("he") ? "he" : "en",
    cards,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
  };
}

function normalizeStorage(raw) {
  return {
    decks: (Array.isArray(raw?.decks) ? raw.decks : []).map(normalizeDeck).filter(Boolean),
  };
}

function loadStorage() {
  const loaded = loadJsonFile(dataPath(), { fallback: {} });
  if (!loaded.ok) {
    console.error("study-deck load:", loaded.error);
    reportLoadFailure("study-deck", loaded);
    return normalizeStorage({});
  }
  return normalizeStorage(loaded.data || {});
}

function saveStorage(data) {
  const normalized = normalizeStorage(data);
  const result = saveJsonFile(dataPath(), normalized, { listKey: "decks" });
  if (!result.ok) {
    reportSaveFailure("study-deck", result);
    if (result.data) return normalizeStorage(result.data);
  }
  return normalized;
}

function parseModelJson(raw) {
  const text = String(raw || "").trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : text;
  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
    }
  }
  const oStart = candidate.indexOf("{");
  const oEnd = candidate.lastIndexOf("}");
  if (oStart >= 0 && oEnd > oStart) {
    try {
      const obj = JSON.parse(candidate.slice(oStart, oEnd + 1));
      if (Array.isArray(obj.cards)) return obj.cards;
      return obj;
    } catch {
      return null;
    }
  }
  return null;
}

function scheduleCard(card, grade) {
  return srsScheduleCard(card, grade);
}

async function generateCards({ topic, language, count, mode }) {
  const lang = String(language || "en").toLowerCase().startsWith("he") ? "he" : "en";
  const n = Math.max(4, Math.min(30, Number(count) || 12));
  const topicText = String(topic || "").trim();
  if (!topicText) return { ok: false, error: lang === "he" ? "חסר נושא" : "Topic is required" };

  const requested = String(mode || "auto").toLowerCase();
  const modeKey = ["flash", "qa", "quiz", "truefalse", "cloze", "mixed", "auto"].includes(requested)
    ? requested
    : "auto";

  const langRule =
    lang === "he"
      ? "Write ALL player-facing text in Hebrew (prompts, choices, answers)."
      : "Write ALL player-facing text in English.";

  const formatGuide =
    `Supported card types and JSON shapes:\n` +
    `1) flash — classic flashcard: {"type":"flash","front":"term","back":"definition"}\n` +
    `2) qa — open question: {"type":"qa","front":"question","back":"model answer"}\n` +
    `3) quiz — multiple choice: {"type":"quiz","front":"question","choices":["A","B","C","D"],"answerIndex":0,"explanation":"why"}\n` +
    `4) truefalse — {"type":"truefalse","front":"statement","answer":true,"explanation":"why"}\n` +
    `5) cloze — fill blank: {"type":"cloze","front":"Sentence with _____ blank","back":"missing word"}\n`;

  let modeRule = "";
  if (modeKey === "flash") modeRule = `Create ONLY type "flash" cards.`;
  else if (modeKey === "qa") modeRule = `Create ONLY type "qa" cards.`;
  else if (modeKey === "quiz") modeRule = `Create ONLY type "quiz" cards with exactly 4 choices and a correct answerIndex.`;
  else if (modeKey === "truefalse") modeRule = `Create ONLY type "truefalse" cards.`;
  else if (modeKey === "cloze") modeRule = `Create ONLY type "cloze" cards.`;
  else if (modeKey === "mixed")
    modeRule = `Mix types (flash, qa, quiz, truefalse, cloze). Use at least 3 different types. Prefer quiz + flash + qa.`;
  else
    modeRule =
      `Choose the best mix of formats for this topic (flashcards, quiz MCQ, true/false, Q&A, cloze). ` +
      `Invent a fun but educational "card game" set — not only plain flashcards.`;

  const prompt =
    `You design a Study Deck learning set (card game / quiz / flashcards).\n` +
    `Topic / brief: ${topicText}\n` +
    `${langRule}\n` +
    `${modeRule}\n\n` +
    `${formatGuide}\n` +
    `Return ONLY JSON:\n` +
    `{"title":"optional set title","summary":"one sentence","cards":[ ... ${n} card objects ... ]}\n\n` +
    `Rules:\n` +
    `- cards.length MUST be ${n}.\n` +
    `- Every card MUST include "type".\n` +
    `- For quiz: 4 distinct choices, answerIndex 0-3, no duplicate choices.\n` +
    `- Educational, specific, no placeholders like TODO/lorem.\n` +
    `- Vary difficulty a little.`;

  let system =
    "You create study card games and quizzes. Output a single valid JSON object with a cards array. No markdown.";
  try {
    const { gatherMslAiContext } = require("../msl/ai-context");
    const msl = await gatherMslAiContext("study-deck", { label: "Study Deck" });
    if (msl.promptBlock) system += msl.promptBlock.slice(0, 8000);
  } catch {
    /* optional */
  }

  const res = await geminiGenerate({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    systemInstruction: system,
    temperature: 0.6,
    maxOutputTokens: 8192,
  });
  if (!res.ok) return res;

  const parsed = parseModelJson(String(res.text || "").trim());
  const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.cards) ? parsed.cards : [];
  const cards = list.map((c) => normalizeCard(c)).filter(Boolean).slice(0, n);

  if (!cards.length) {
    return {
      ok: false,
      error: lang === "he" ? "לא הצלחתי לייצר כרטיסיות" : "Could not generate cards",
      raw: String(res.text || "").slice(0, 400),
    };
  }

  const typeCounts = {};
  for (const c of cards) typeCounts[c.type] = (typeCounts[c.type] || 0) + 1;

  return {
    ok: true,
    cards,
    title: parsed && !Array.isArray(parsed) ? parsed.title || null : null,
    summary: parsed && !Array.isArray(parsed) ? parsed.summary || null : null,
    typeCounts,
    mode: modeKey,
    model: res.model,
  };
}

async function handleStudyDeckInvoke(channel, args = {}) {
  const authErr = signedInGuard();
  if (authErr) return authErr;
  switch (channel) {
    case "storage.load":
      return { ok: true, data: loadStorage() };

    case "storage.save": {
      const data = saveStorage(args?.data || args || {});
      return { ok: true, data };
    }

    case "decks.list": {
      const data = loadStorage();
      return {
        ok: true,
        decks: data.decks.map((d) => ({
          ...d,
          cardCount: d.cards.length,
          dueCount: d.cards.filter((c) => new Date(c.dueAt).getTime() <= Date.now()).length,
        })),
      };
    }

    case "deck.get": {
      const data = loadStorage();
      const deck = data.decks.find((d) => d.id === args?.id);
      if (!deck) return { ok: false, error: "Deck not found" };
      return { ok: true, deck };
    }

    case "deck.create": {
      const data = loadStorage();
      const deck = normalizeDeck({
        name: args?.name || "New deck",
        description: args?.description || "",
        color: args?.color,
        language: args?.language,
        cards: [],
      });
      data.decks.unshift(deck);
      saveStorage(data);
      return { ok: true, deck };
    }

    case "deck.update": {
      const data = loadStorage();
      const idx = data.decks.findIndex((d) => d.id === args?.id);
      if (idx < 0) return { ok: false, error: "Deck not found" };
      const prev = data.decks[idx];
      data.decks[idx] = normalizeDeck({
        ...prev,
        ...args,
        id: prev.id,
        cards: Array.isArray(args?.cards) ? args.cards : prev.cards,
        updatedAt: new Date().toISOString(),
      });
      saveStorage(data);
      return { ok: true, deck: data.decks[idx] };
    }

    case "deck.delete": {
      const data = loadStorage();
      data.decks = data.decks.filter((d) => d.id !== args?.id);
      saveStorage(data);
      return { ok: true };
    }

    case "card.add": {
      const data = loadStorage();
      const deck = data.decks.find((d) => d.id === args?.deckId);
      if (!deck) return { ok: false, error: "Deck not found" };
      const card = normalizeCard(args?.card || args);
      if (!card) return { ok: false, error: "Invalid card" };
      deck.cards.push(card);
      deck.updatedAt = new Date().toISOString();
      saveStorage(data);
      return { ok: true, card, deck };
    }

    case "card.update": {
      const data = loadStorage();
      const deck = data.decks.find((d) => d.id === args?.deckId);
      if (!deck) return { ok: false, error: "Deck not found" };
      const cIdx = deck.cards.findIndex((c) => c.id === args?.cardId || c.id === args?.id);
      if (cIdx < 0) return { ok: false, error: "Card not found" };
      const merged = {
        ...deck.cards[cIdx],
        ...(args?.card || {}),
        front: args?.front ?? args?.card?.front ?? deck.cards[cIdx].front,
        back: args?.back ?? args?.card?.back ?? deck.cards[cIdx].back,
        type: args?.type ?? args?.card?.type ?? deck.cards[cIdx].type,
        choices: args?.choices ?? args?.card?.choices ?? deck.cards[cIdx].choices,
        answerIndex: args?.answerIndex ?? args?.card?.answerIndex ?? deck.cards[cIdx].answerIndex,
        id: deck.cards[cIdx].id,
        updatedAt: new Date().toISOString(),
      };
      deck.cards[cIdx] = normalizeCard(merged);
      deck.updatedAt = new Date().toISOString();
      saveStorage(data);
      return { ok: true, card: deck.cards[cIdx], deck };
    }

    case "card.delete": {
      const data = loadStorage();
      const deck = data.decks.find((d) => d.id === args?.deckId);
      if (!deck) return { ok: false, error: "Deck not found" };
      deck.cards = deck.cards.filter((c) => c.id !== args?.cardId && c.id !== args?.id);
      deck.updatedAt = new Date().toISOString();
      saveStorage(data);
      return { ok: true, deck };
    }

    case "card.grade": {
      const data = loadStorage();
      const deck = data.decks.find((d) => d.id === args?.deckId);
      if (!deck) return { ok: false, error: "Deck not found" };
      const cIdx = deck.cards.findIndex((c) => c.id === args?.cardId);
      if (cIdx < 0) return { ok: false, error: "Card not found" };
      deck.cards[cIdx] = scheduleCard(deck.cards[cIdx], String(args?.grade || "good"));
      deck.updatedAt = new Date().toISOString();
      saveStorage(data);
      return { ok: true, card: deck.cards[cIdx], deck };
    }

    case "cards.generate":
      return generateCards(args || {});

    case "screen.publish": {
      publishScreenFacts("study-deck", args || {});
      return { ok: true };
    }

    case "screen.get":
      return { ok: true, facts: getScreenFacts("study-deck") };

    case "meta":
      return { ok: true, name: "Study Deck", version: "1.0.0" };

    default:
      return { ok: false, error: `Unknown study-deck channel: ${channel}` };
  }
}

module.exports = { handleStudyDeckInvoke };