const { handleTranslateInvoke } = require("../../apps/translate-ipc");

async function translate(input = {}) {
  const text = String(input.text || "").trim();
  if (!text) return { ok: false, error: "Missing text" };
  return handleTranslateInvoke("translate.text", {
    text,
    from: input.from || input.source || "auto",
    to: input.to || input.target || "en",
  });
}

async function listLanguages() {
  const res = await handleTranslateInvoke("languages.list", {});
  if (!res?.ok) return res;
  return {
    ok: true,
    languages: res.languages || [],
    phraseCategories: res.phraseCategories || [],
  };
}

async function detect(input = {}) {
  const text = String(input.text || "").trim();
  if (!text) return { ok: false, error: "Missing text" };
  return handleTranslateInvoke("detect.language", { text });
}

async function historyList(input = {}) {
  const res = await handleTranslateInvoke("storage.load", {});
  if (!res?.ok) return res;
  let history = Array.isArray(res.data?.history) ? res.data.history : [];
  if (input.favoritesOnly) {
    history = history.filter((h) => h && h.favorite);
  }
  const limit = Math.min(Math.max(Number(input.limit) || 40, 1), 200);
  return {
    ok: true,
    history: history.slice(0, limit),
    total: history.length,
  };
}

const CAPABILITIES = [
  {
    id: "translate.text",
    kind: "action",
    provider: "translate",
    title: "Translate text",
    description: "Translate text between languages",
    handler: translate,
  },
  {
    id: "translate.languages.list",
    kind: "query",
    provider: "translate",
    title: "List languages",
    description: "Available translation languages",
    handler: listLanguages,
  },
  {
    id: "translate.detect",
    kind: "query",
    provider: "translate",
    title: "Detect language",
    description: "Guess the language of a text sample",
    handler: detect,
  },
  {
    id: "translate.history.list",
    kind: "query",
    provider: "translate",
    title: "Translation history",
    description: "Recent translations from Translate app storage",
    handler: historyList,
  },
];

module.exports = { CAPABILITIES };
