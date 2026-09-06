const path = require("path");
const fs = require("fs");
const { app, shell } = require("electron");
const {
  setupLocalAuthApp,
  requireSignedIn,
  registerSingleFileMigrator,
} = require("./local-auth-app-helper");

const APP_ID = "code-lexicon";
const auth = setupLocalAuthApp(APP_ID);
registerSingleFileMigrator(APP_ID, "code-lexicon.json");

const BUNDLED = () => path.join(__dirname, "..", "..", "data", "code-lexicon.json");
const USER_FILE = () => auth.userDataPath("data.json");

function signedInGuard() {
  return requireSignedIn(auth);
}

let lexiconCache = null;
let indexCache = null;

function readJson(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
  }
  return fallback;
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function loadLexicon() {
  if (lexiconCache) return lexiconCache;
  const bundled = readJson(BUNDLED(), null);
  if (!bundled?.terms?.length) {
    throw new Error("Glossary not found.");
  }
  lexiconCache = bundled;
  return bundled;
}

function buildIndex(lexicon) {
  if (indexCache) return indexCache;
  indexCache = lexicon.terms.map((t) => ({
    id: t.id,
    term: t.term,
    slug: t.slug,
    category: t.category,
    categoryLabel: t.categoryLabel,
    level: t.level,
    tags: t.tags || [],
    definitionPreview: String(t.definition || "").slice(0, 120),
  }));
  return indexCache;
}

function normalizeUser(raw) {
  return {
    settings: {
      lastCategory: String(raw?.settings?.lastCategory || "all"),
    },
  };
}

async function loadStorage() {
  const data = normalizeUser(readJson(USER_FILE(), { bookmarks: [] }));
  return { ok: true, data };
}

async function saveStorage(args) {
  const data = normalizeUser(args?.data ?? args);
  writeJson(USER_FILE(), data);
  return { ok: true, data };
}

async function getStats() {
  const lexicon = loadLexicon();
  return {
    ok: true,
    termCount: lexicon.termCount || lexicon.terms.length,
    builtAt: lexicon.builtAt,
    categories: lexicon.categories || [],
  };
}

async function listCategories() {
  const lexicon = loadLexicon();
  return { ok: true, categories: lexicon.categories || [] };
}

function matchesQuery(entry, q) {
  if (!q) return true;
  const hay = [entry.term, entry.definitionPreview, ...(entry.tags || []), entry.categoryLabel]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

async function listTerms(args) {
  const lexicon = loadLexicon();
  const index = buildIndex(lexicon);
  const q = String(args?.q || "").trim().toLowerCase();
  const category = String(args?.category || "all");
  const level = String(args?.level || "all");



  let list = index;
  if (category !== "all") list = list.filter((t) => t.category === category);
  if (level !== "all") list = list.filter((t) => t.level === level);
  if (q) list = list.filter((t) => matchesQuery(t, q));


  const sort = String(args?.sort || "name");
  if (sort === "category") {
    list = [...list].sort(
      (a, b) => a.categoryLabel.localeCompare(b.categoryLabel) || a.term.localeCompare(b.term)
    );
  } else {
    list = [...list].sort((a, b) => a.term.localeCompare(b.term, undefined, { sensitivity: "base" }));
  }

  const total = list.length;
  const offset = Math.max(0, parseInt(args?.offset, 10) || 0);
  const limit = Math.min(2000, Math.max(1, parseInt(args?.limit, 10) || 60));
  const terms = list.slice(offset, offset + limit);

  return { ok: true, terms, total, offset, limit };
}

async function getTerm(args) {
  const lexicon = loadLexicon();
  const id = String(args?.id || "").trim();
  const slug = String(args?.slug || "").trim();
  const term = lexicon.terms.find((t) => (id && t.id === id) || (slug && t.slug === slug));
  if (!term) return { ok: false, error: "Term not found" };
  return { ok: true, term };
}

async function searchTerms(args) {
  return listTerms({ ...args, limit: args?.limit || 40 });
}

async function relatedTerms(args) {
  const lexicon = loadLexicon();
  const base = lexicon.terms.find((t) => t.id === args?.id);
  if (!base) return { ok: true, terms: [] };
  const tagSet = new Set(base.tags || []);
  const related = lexicon.terms
    .filter((t) => t.id !== base.id && t.category === base.category)
    .map((t) => {
      const overlap = (t.tags || []).filter((tag) => tagSet.has(tag)).length;
      return { term: t, score: overlap };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((r) => ({
      id: r.term.id,
      term: r.term.term,
      category: r.term.category,
      level: r.term.level,
    }));
  return { ok: true, terms: related };
}

async function openLink(args) {
  const url = String(args?.url || "").trim();
  if (!url) return { ok: false, error: "URL required" };
  await shell.openExternal(url.startsWith("http") ? url : `https://www.google.com/search?q=${encodeURIComponent(url)}`);
  return { ok: true };
}

function termOfDay() {
  const lexicon = loadLexicon();
  const day = new Date().toISOString().slice(0, 10);
  let hash = 0;
  for (let i = 0; i < day.length; i += 1) {
    hash = (hash * 31 + day.charCodeAt(i)) >>> 0;
  }
  const idx = hash % lexicon.terms.length;
  return { ok: true, term: lexicon.terms[idx] };
}

const CHANNELS = {
  "stats.get": () => getStats(),
  "categories.list": () => listCategories(),
  "terms.list": (args) => listTerms(args),
  "terms.get": (args) => getTerm(args),
  "terms.search": (args) => searchTerms(args),
  "terms.related": (args) => relatedTerms(args),
  "terms.daily": () => termOfDay(),
  "storage.load": () => loadStorage(),
  "storage.save": (args) => saveStorage(args),
  "link.open": (args) => openLink(args),
};

async function handleCodeLexiconInvoke(channel, args) {
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

module.exports = { handleCodeLexiconInvoke };