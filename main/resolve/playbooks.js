const fs = require("fs");
const path = require("path");
const { app } = require("electron");

function catalogPath() {
  return path.join(app.getAppPath(), "config", "resolve-playbooks.json");
}

function loadCatalog() {
  try {
    const raw = JSON.parse(fs.readFileSync(catalogPath(), "utf8"));
    const playbooks = raw?.playbooks && typeof raw.playbooks === "object" ? raw.playbooks : {};
    return { version: raw?.version || 1, playbooks };
  } catch {
    return { version: 1, playbooks: {} };
  }
}

function playbookKey(appId, code) {
  return `${String(appId || "").trim()}.${String(code || "").trim()}`;
}

function normalizeRow(id, row) {
  if (!row) return null;
  return {
    id,
    title: String(row.title || id),
    category: String(row.category || "unknown"),
    kind: row.kind ? String(row.kind) : undefined,
    steps: Array.isArray(row.steps) ? row.steps : [],
  };
}

function findPlaybook(appId, code, kind) {
  const { playbooks } = loadCatalog();
  const c = String(code || kind || "").trim();
  const k = String(kind || code || "").trim();
  const a = String(appId || "").trim();

  const candidates = [];
  if (a && c) candidates.push(playbookKey(a, c));
  if (a && k && k !== c) candidates.push(playbookKey(a, k));
  if (k) candidates.push(`*.${k}`);
  if (c && c !== k) candidates.push(`*.${c}`);
  if (k) candidates.push(k);
  if (c && c !== k) candidates.push(c);

  for (const key of candidates) {
    const row = playbooks[key];
    if (row) return normalizeRow(key, row);
  }
  return null;
}

function listPlaybooks() {
  const { playbooks } = loadCatalog();
  return Object.entries(playbooks).map(([id, row]) => ({
    id,
    title: String(row.title || id),
    category: String(row.category || "unknown"),
    kind: row.kind ? String(row.kind) : undefined,
    universal: id.startsWith("*.") || !id.includes("."),
    stepCount: Array.isArray(row.steps) ? row.steps.length : 0,
  }));
}

module.exports = {
  loadCatalog,
  findPlaybook,
  listPlaybooks,
  playbookKey,
};