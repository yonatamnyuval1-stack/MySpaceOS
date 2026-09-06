const path = require("path");
const { app } = require("electron");
const { loadJsonFile, saveJsonFile } = require("../apps/safe-json-store");
const profile = require("../myspace-profile");

const MAX_FACTS = 200;
const DEFAULT_BLOCK_CHARS = 1200;

function memoryPath() {
  return profile.profileScopedPath("mind-memory.json");
}

function uid() {
  return `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function defaultState() {
  return {
    version: 1,
    enabled: true,
    facts: [],
    preferences: {},
    updatedAt: nowIso(),
  };
}

function normalizeTags(raw) {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : String(raw).split(/[,;|]/);
  return [...new Set(list.map((t) => String(t || "").trim().toLowerCase()).filter(Boolean))].slice(0, 8);
}

function normalizeFact(raw) {
  if (!raw || typeof raw !== "object") return null;
  const text = String(raw.text || "").trim();
  if (!text) return null;
  return {
    id: String(raw.id || uid()),
    text: text.slice(0, 800),
    tags: normalizeTags(raw.tags),
    source: String(raw.source || "manual").slice(0, 40),
    pinned: Boolean(raw.pinned),
    createdAt: raw.createdAt || nowIso(),
    updatedAt: raw.updatedAt || raw.createdAt || nowIso(),
  };
}

function loadMemory() {
  const loaded = loadJsonFile(memoryPath(), { fallback: null });
  const data = loaded.ok && loaded.data && typeof loaded.data === "object" ? loaded.data : {};
  const facts = Array.isArray(data.facts)
    ? data.facts.map(normalizeFact).filter(Boolean).slice(0, MAX_FACTS)
    : [];
  return {
    version: 1,
    enabled: data.enabled !== false,
    facts,
    preferences: data.preferences && typeof data.preferences === "object" ? { ...data.preferences } : {},
    updatedAt: data.updatedAt || nowIso(),
  };
}

function saveMemory(patch = {}) {
  const current = loadMemory();
  const next = {
    version: 1,
    enabled: patch.enabled != null ? patch.enabled !== false : current.enabled,
    facts: patch.facts != null ? patch.facts : current.facts,
    preferences: patch.preferences != null ? patch.preferences : current.preferences,
    updatedAt: nowIso(),
  };
  next.facts = next.facts.map(normalizeFact).filter(Boolean).slice(0, MAX_FACTS);
  saveJsonFile(memoryPath(), next, { listKey: "facts", allowEmpty: true });
  return next;
}

function scoreFact(fact, userText) {
  let score = fact.pinned ? 50 : 1;
  const q = String(userText || "").toLowerCase().trim();
  if (!q) return score;
  const hay = `${fact.text} ${(fact.tags || []).join(" ")}`.toLowerCase();
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  for (const w of words) {
    if (hay.includes(w)) score += 4;
  }
  for (const tag of fact.tags || []) {
    if (q.includes(tag)) score += 8;
  }
  return score;
}

function selectRelevantFacts(userText, opts = {}) {
  const state = loadMemory();
  if (!state.enabled) return [];
  const limit = Math.max(1, Math.min(12, Number(opts.limit) || 8));
  const facts = Array.isArray(opts.facts) ? opts.facts : state.facts;
  if (!facts.length) return [];

  const scored = facts
    .map((f) => ({ fact: f, score: scoreFact(f, userText) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(b.fact.updatedAt).localeCompare(String(a.fact.updatedAt));
    });

  const pinned = scored.filter((x) => x.fact.pinned).map((x) => x.fact);
  const rest = scored
    .filter((x) => !x.fact.pinned)
    .slice(0, Math.max(0, limit - pinned.length))
    .map((x) => x.fact);
  return [...pinned, ...rest].slice(0, limit);
}

function formatMemoryBlock(userText, opts = {}) {
  if (opts.includeMemory === false) return { block: "", ids: [], chars: 0 };
  const state = loadMemory();
  if (!state.enabled) return { block: "", ids: [], chars: 0 };

  const selected = selectRelevantFacts(userText, opts);
  const prefLines = Object.entries(state.preferences || {})
    .filter(([, v]) => v != null && String(v).trim())
    .map(([k, v]) => `- [${k}] ${String(v).trim().slice(0, 200)}`);

  const factLines = selected.map((f) => {
    const tagHint = f.tags?.length ? ` (${f.tags.join(", ")})` : "";
    return `- ${f.text}${tagHint}`;
  });

  if (!factLines.length && !prefLines.length) {
    return { block: "", ids: [], chars: 0 };
  }

  const lines = [
    "User memory (persistent: treat as true unless the user contradicts):",
    ...prefLines,
    ...factLines,
  ];
  let block = lines.join("\n");
  const maxChars = Number(opts.maxChars) || DEFAULT_BLOCK_CHARS;
  if (block.length > maxChars) block = `${block.slice(0, maxChars - 1)}…`;
  return { block, ids: selected.map((f) => f.id), chars: block.length };
}

function snapshot() {
  const state = loadMemory();
  return {
    ok: true,
    enabled: state.enabled,
    count: state.facts.length,
    preferences: state.preferences,
    updatedAt: state.updatedAt,
  };
}

function listFacts() {
  const state = loadMemory();
  return {
    ok: true,
    enabled: state.enabled,
    facts: state.facts,
    preferences: state.preferences,
    count: state.facts.length,
  };
}

function addFact(args = {}) {
  const text = String(args.text || "").trim();
  if (!text) return { ok: false, error: "Memory text required" };
  const state = loadMemory();
  const fact = normalizeFact({
    text,
    tags: args.tags,
    source: args.source || "manual",
    pinned: args.pinned,
  });
  const facts = [fact, ...state.facts.filter((f) => f.text !== fact.text)].slice(0, MAX_FACTS);
  saveMemory({ facts });
  return { ok: true, fact, count: facts.length };
}

function updateFact(args = {}) {
  const id = String(args.id || "").trim();
  if (!id) return { ok: false, error: "Memory id required" };
  const state = loadMemory();
  const idx = state.facts.findIndex((f) => f.id === id);
  if (idx < 0) return { ok: false, error: "Memory not found" };
  const prev = state.facts[idx];
  const next = normalizeFact({
    ...prev,
    text: args.text != null ? args.text : prev.text,
    tags: args.tags != null ? args.tags : prev.tags,
    pinned: args.pinned != null ? args.pinned : prev.pinned,
    updatedAt: nowIso(),
  });
  if (!next) return { ok: false, error: "Invalid memory text" };
  const facts = [...state.facts];
  facts[idx] = next;
  saveMemory({ facts });
  return { ok: true, fact: next };
}

function deleteFact(args = {}) {
  const id = String(args.id || "").trim();
  if (!id) return { ok: false, error: "Memory id required" };
  const state = loadMemory();
  const facts = state.facts.filter((f) => f.id !== id);
  if (facts.length === state.facts.length) return { ok: false, error: "Memory not found" };
  saveMemory({ facts });
  return { ok: true, count: facts.length };
}

function clearFacts() {
  saveMemory({ facts: [] });
  return { ok: true, count: 0 };
}

function setEnabled(enabled) {
  saveMemory({ enabled: enabled !== false });
  return { ok: true, enabled: enabled !== false };
}

function getPreferences() {
  const state = loadMemory();
  return { ok: true, preferences: state.preferences };
}

function setPreferences(args = {}) {
  const prefs = args.preferences && typeof args.preferences === "object" ? args.preferences : args;
  const state = loadMemory();
  const next = { ...state.preferences };
  for (const [k, v] of Object.entries(prefs || {})) {
    if (v == null || v === "") delete next[k];
    else next[String(k).slice(0, 40)] = String(v).slice(0, 400);
  }
  saveMemory({ preferences: next });
  return { ok: true, preferences: next };
}

async function handleMemoryInvoke(channel, args = {}) {
  const ch = String(channel || "").trim();
  switch (ch) {
    case "mind.memory.snapshot":
    case "mind.memory.status":
      return snapshot();
    case "mind.memory.list":
      return listFacts();
    case "mind.memory.add":
      return addFact(args);
    case "mind.memory.update":
      return updateFact(args);
    case "mind.memory.delete":
      return deleteFact(args);
    case "mind.memory.clear":
      return clearFacts();
    case "mind.memory.enabled":
      return setEnabled(args.enabled);
    case "mind.memory.preferences.get":
      return getPreferences();
    case "mind.memory.preferences.set":
      return setPreferences(args);
    default:
      return { ok: false, error: `Unknown Mind memory channel: ${ch}` };
  }
}

module.exports = {
  loadMemory,
  saveMemory,
  formatMemoryBlock,
  selectRelevantFacts,
  snapshot,
  listFacts,
  addFact,
  updateFact,
  deleteFact,
  clearFacts,
  setEnabled,
  getPreferences,
  setPreferences,
  handleMemoryInvoke,
};