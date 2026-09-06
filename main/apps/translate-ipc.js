const path = require("path");
const fs = require("fs");
const { app, clipboard } = require("electron");
const { LANGUAGES, PHRASE_CATEGORIES, getLanguage } = require(path.join(
  __dirname,
  "../../apps/translate/lib/languages.js"
));
const {
  setupLocalAuthApp,
  requireSignedIn,
  registerSingleFileMigrator,
} = require("./local-auth-app-helper");

const APP_ID = "translate";
const auth = setupLocalAuthApp(APP_ID);
registerSingleFileMigrator(APP_ID, "translate.json");

const DATA_FILE = () => auth.userDataPath("data.json");

function signedInGuard() {
  return requireSignedIn(auth);
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const MAX_HISTORY = 500;

function uid() {
  return `tr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeLang(code) {
  if (!code || code === "auto") return "auto";
  const c = String(code).trim();
  if (!c) return "auto";
  const lower = c.toLowerCase();
  const byCode = LANGUAGES.find(
    (l) => l.code === c || String(l.code).toLowerCase() === lower
  );
  if (byCode) return byCode.code;
  const byName = LANGUAGES.find(
    (l) =>
      String(l.name || "").toLowerCase() === lower ||
      String(l.native || "").toLowerCase() === lower
  );
  if (byName) return byName.code;
  const aliases = {
    hebrew: "he",
    ivrit: "he",
    english: "en",
    french: "fr",
    german: "de",
    spanish: "es",
    arabic: "ar",
    russian: "ru",
    chinese: "zh-CN",
    "chinese simplified": "zh-CN",
    "chinese traditional": "zh-TW",
    portuguese: "pt",
    italian: "it",
    japanese: "ja",
    korean: "ko",
  };
  if (aliases[lower]) return aliases[lower];
  return c;
}

function guessDefaultTarget(text) {
  const s = String(text || "");
  const he = (s.match(/[\u0590-\u05FF]/g) || []).length;
  const latin = (s.match(/[A-Za-z]/g) || []).length;
  if (he > latin) return "en";
  return "he";
}

function flipLang(code) {
  const c = normalizeLang(code);
  if (c === "he") return "en";
  if (c === "en") return "he";
  return "en";
}

function toGoogleLang(code) {
  const c = normalizeLang(code);
  if (c === "zh-CN") return "zh-CN";
  if (c === "zh-TW") return "zh-TW";
  return c.split("-")[0];
}

function toMyMemoryLang(code) {
  const c = normalizeLang(code);
  if (c === "auto") return "auto";
  if (c.startsWith("zh")) return c === "zh-TW" ? "zh-TW" : "zh-CN";
  return c.split("-")[0];
}

async function translateGoogle(text, from, to) {
  const sl = from === "auto" ? "auto" : toGoogleLang(from);
  const tl = toGoogleLang(to);
  const url =
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}` +
    `&tl=${encodeURIComponent(tl)}&dt=t&dt=bd&dt=rm&dt=at&q=${encodeURIComponent(text)}`;

  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Translation service unavailable (${res.status})`);

  const data = await res.json();
  const segments = data?.[0] || [];
  const translated = segments.map((s) => s?.[0]).filter(Boolean).join("");
  if (!translated) throw new Error("Empty translation result");

  const detected = data?.[2] || (from !== "auto" ? from : null);
  const detectedName = detected ? getLanguage(detected)?.name || detected : null;

  const alternatives = [];
  const atData = data?.[5];
  if (Array.isArray(atData)) {
    for (const group of atData) {
      if (Array.isArray(group?.[2])) {
        for (const alt of group[2]) {
          if (alt?.[0] && alt[0] !== translated) alternatives.push(alt[0]);
        }
      }
    }
  }

  const definitions = [];
  const bdData = data?.[1];
  if (Array.isArray(bdData)) {
    for (const entry of bdData) {
      const pos = entry?.[0];
      const meanings = entry?.[1];
      if (pos && Array.isArray(meanings)) {
        definitions.push({
          pos,
          meanings: meanings.slice(0, 5).map((m) => (Array.isArray(m) ? m[0] : m)).filter(Boolean),
        });
      }
    }
  }

  let romanization = null;
  const rmData = data?.[0]?.[0]?.[3];
  if (rmData && typeof rmData === "string") romanization = rmData;

  return {
    text: translated,
    detectedLang: detected,
    detectedName,
    provider: "google",
    alternatives: [...new Set(alternatives)].slice(0, 6),
    definitions,
    romanization,
  };
}

async function translateMyMemory(text, from, to) {
  const src = toMyMemoryLang(from);
  const dst = toMyMemoryLang(to);
  const langpair = src === "auto" ? `auto|${dst}` : `${src}|${dst}`;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langpair)}`;

  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Backup translation failed (${res.status})`);

  const data = await res.json();
  const translated = data?.responseData?.translatedText;
  if (!translated || /INVALID|MYMEMORY WARNING|QUOTA/i.test(translated)) {
    throw new Error(data?.responseData?.translatedText || "Translation failed");
  }

  const detected = data?.responseData?.detectedSourceLanguage || (from !== "auto" ? from : null);

  return {
    text: translated,
    detectedLang: detected,
    detectedName: detected ? getLanguage(detected)?.name || detected : null,
    provider: "mymemory",
    alternatives: (data?.matches || [])
      .slice(1, 7)
      .map((m) => m.translation)
      .filter((t) => t && t !== translated),
    definitions: [],
    romanization: null,
    matchQuality: data?.responseData?.match,
  };
}

async function translateText(args) {
  const text = String(args?.text || "").trim();
  if (!text) return { ok: false, error: "Enter text to translate" };
  if (text.length > 10000) return { ok: false, error: "Text too long (max 10,000 characters)" };

  const from = normalizeLang(args?.from || "auto");
  const explicitTo = args?.to != null && String(args.to).trim() !== "";
  let to = normalizeLang(explicitTo ? args.to : guessDefaultTarget(text));
  if (to === "auto") to = guessDefaultTarget(text) === "he" ? "en" : "he";

  if (from !== "auto" && from === to) {
    return { ok: false, error: "Source and target languages must differ" };
  }

  async function runOnce(src, dst) {
    try {
      return await translateGoogle(text, src, dst);
    } catch (err) {
      try {
        return await translateMyMemory(text, src, dst);
      } catch (err2) {
        const error = new Error(err.message || err2.message || "Translation failed");
        error.cause = err2;
        throw error;
      }
    }
  }

  let result;
  try {
    result = await runOnce(from, to);
  } catch (err) {
    return { ok: false, error: err.message || "Translation failed" };
  }

  let actualFrom = normalizeLang(result.detectedLang || (from !== "auto" ? from : from));
  if (
    actualFrom &&
    actualFrom !== "auto" &&
    actualFrom === to &&
    from === "auto"
  ) {
    const flipped = flipLang(to);
    try {
      const retry = await runOnce(from, flipped);
      result = retry;
      to = flipped;
      actualFrom = normalizeLang(retry.detectedLang || actualFrom);
    } catch {
    }
  }

  const pairKey = `${actualFrom}|${to}`;

  return {
    ok: true,
    source: text,
    translation: result.text,
    from: actualFrom,
    fromName: getLanguage(actualFrom)?.name || actualFrom,
    to,
    toName: getLanguage(to)?.name || to,
    provider: result.provider,
    alternatives: result.alternatives || [],
    definitions: result.definitions || [],
    romanization: result.romanization,
    charCount: text.length,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    pairKey,
  };
}

async function detectLanguage(args) {
  const text = String(args?.text || "").trim();
  if (!text) return { ok: false, error: "No text" };
  try {
    const result = await translateGoogle(text.slice(0, 500), "auto", "en");
    return {
      ok: true,
      lang: result.detectedLang,
      name: result.detectedName || getLanguage(result.detectedLang)?.name,
      confidence: "high",
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function translateBatch(args) {
  const lines = String(args?.text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return { ok: false, error: "No lines to translate" };
  if (lines.length > 100) return { ok: false, error: "Max 100 lines per batch" };

  const from = normalizeLang(args?.from || "auto");
  const to = normalizeLang(args?.to || "he");

  const results = [];
  for (const line of lines) {
    const res = await translateText({ text: line, from, to });
    results.push({
      source: line,
      translation: res.ok ? res.translation : null,
      error: res.ok ? null : res.error,
    });
    await new Promise((r) => setTimeout(r, 120));
  }

  return { ok: true, results, from, to };
}

function normalizeStorage(raw) {
  const history = (Array.isArray(raw?.history) ? raw.history : [])
    .slice(0, MAX_HISTORY)
    .map((h) => ({
      id: h.id || uid(),
      source: String(h.source || ""),
      translation: String(h.translation || ""),
      from: normalizeLang(h.from || "auto"),
      to: normalizeLang(h.to || "he"),
      favorite: Boolean(h.favorite),
      provider: h.provider || "",
      createdAt: h.createdAt || new Date().toISOString(),
    }))
    .filter((h) => h.source && h.translation);

  const recentPairs = Array.isArray(raw?.recentPairs)
    ? raw.recentPairs.slice(0, 12)
    : [];

  return {
    history,
    recentPairs,
    settings: {
      fromLang: normalizeLang(raw?.settings?.fromLang || "auto"),
      toLang: normalizeLang(raw?.settings?.toLang || "he"),
      autoTranslate: raw?.settings?.autoTranslate !== false,
      saveHistory: raw?.settings?.saveHistory !== false,
      fontSize: Math.min(24, Math.max(12, parseInt(raw?.settings?.fontSize, 10) || 15)),
    },
  };
}

async function loadStorage() {
  try {
    const raw = await fs.promises.readFile(DATA_FILE(), "utf8");
    return { ok: true, data: normalizeStorage(JSON.parse(raw)) };
  } catch (err) {
    if (err?.code === "ENOENT") return { ok: true, data: normalizeStorage({}) };
    return { ok: false, error: err.message };
  }
}

async function saveStorage(args) {
  const data = normalizeStorage(args?.data ?? args);
  await fs.promises.mkdir(path.dirname(DATA_FILE()), { recursive: true });
  await fs.promises.writeFile(DATA_FILE(), JSON.stringify(data, null, 2), "utf8");
  return { ok: true, data };
}

async function addHistoryEntry(args) {
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  const data = loaded.data;
  if (!data.settings.saveHistory) return { ok: true, data };

  const entry = {
    id: uid(),
    source: String(args?.source || ""),
    translation: String(args?.translation || ""),
    from: normalizeLang(args?.from || "auto"),
    to: normalizeLang(args?.to || "he"),
    favorite: Boolean(args?.favorite),
    provider: args?.provider || "",
    createdAt: new Date().toISOString(),
  };

  if (!entry.source || !entry.translation) return { ok: false, error: "Invalid entry" };

  data.history = [entry, ...data.history.filter((h) => h.source !== entry.source || h.to !== entry.to)].slice(
    0,
    MAX_HISTORY
  );

  const pairKey = `${entry.from}|${entry.to}`;
  data.recentPairs = [pairKey, ...data.recentPairs.filter((p) => p !== pairKey)].slice(0, 12);

  await saveStorage({ data });
  return { ok: true, entry, data };
}

async function toggleFavorite(args) {
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  const data = loaded.data;
  const id = args?.id;
  const item = data.history.find((h) => h.id === id);
  if (!item) return { ok: false, error: "Not found" };
  item.favorite = !item.favorite;
  await saveStorage({ data });
  return { ok: true, item, data };
}

async function clearHistory(args) {
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  const data = loaded.data;
  if (args?.favoritesOnly) {
    data.history = data.history.filter((h) => h.favorite);
  } else if (args?.keepFavorites) {
    data.history = data.history.filter((h) => h.favorite);
  } else {
    data.history = [];
  }
  await saveStorage({ data });
  return { ok: true, data };
}

async function deleteHistoryItem(args) {
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  const data = loaded.data;
  data.history = data.history.filter((h) => h.id !== args?.id);
  await saveStorage({ data });
  return { ok: true, data };
}

function clipboardRead() {
  return { ok: true, text: clipboard.readText() };
}

function clipboardWrite(args) {
  clipboard.writeText(String(args?.text || ""));
  return { ok: true };
}

function listLanguages() {
  return { ok: true, languages: LANGUAGES, phraseCategories: PHRASE_CATEGORIES };
}

function exportData() {
  return loadStorage().then((loaded) => {
    if (!loaded.ok) return loaded;
    return { ok: true, json: JSON.stringify(loaded.data, null, 2) };
  });
}

async function importData(args) {
  try {
    const parsed = typeof args?.json === "string" ? JSON.parse(args.json) : args?.data;
    const data = normalizeStorage(parsed);
    await saveStorage({ data });
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function chunkForSpeech(text, maxLen = 180) {
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    let slice = remaining.slice(0, maxLen);
    const breakAt = Math.max(slice.lastIndexOf(" "), slice.lastIndexOf("。"), slice.lastIndexOf("."));
    if (breakAt > 40) slice = slice.slice(0, breakAt);
    chunks.push(slice.trim());
    remaining = remaining.slice(slice.length).trimStart();
  }
  return chunks.filter(Boolean);
}

async function speechSpeak(args) {
  const text = String(args?.text || "").trim();
  if (!text) return { ok: false, error: "No text to speak" };
  if (text.length > 2000) return { ok: false, error: "Text too long for speech (max 2,000 chars)" };

  const lang = toGoogleLang(args?.lang || "en");
  const chunks = chunkForSpeech(text);
  const parts = [];

  for (const chunk of chunks) {
    const url =
      `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob` +
      `&tl=${encodeURIComponent(lang)}&q=${encodeURIComponent(chunk)}`;
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`Speech service unavailable (${res.status})`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100) throw new Error("Speech audio empty");
    parts.push(buf.toString("base64"));
    if (chunks.length > 1) await new Promise((r) => setTimeout(r, 80));
  }

  return { ok: true, parts, mime: "audio/mpeg" };
}

const CHANNELS = {
  "languages.list": () => listLanguages(),
  "translate.text": (args) => translateText(args),
  "translate.batch": (args) => translateBatch(args),
  "detect.language": (args) => detectLanguage(args),
  "speech.speak": (args) => speechSpeak(args),
  "storage.load": () => loadStorage(),
  "storage.save": (args) => saveStorage(args),
  "history.add": (args) => addHistoryEntry(args),
  "history.toggleFavorite": (args) => toggleFavorite(args),
  "history.clear": (args) => clearHistory(args),
  "history.delete": (args) => deleteHistoryItem(args),
  "clipboard.read": () => clipboardRead(),
  "clipboard.write": (args) => clipboardWrite(args),
  "data.export": () => exportData(),
  "data.import": (args) => importData(args),
};

async function handleTranslateInvoke(channel, args) {
  const authErr = signedInGuard();
  if (authErr) return authErr;
  const handler = CHANNELS[channel];
  if (!handler) return { ok: false, error: `Unknown channel: ${channel}` };
  try {
    return await handler(args);
  } catch (err) {
    return { ok: false, error: err.message || "Request failed" };
  }
}

module.exports = { handleTranslateInvoke };