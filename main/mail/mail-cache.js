const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const profile = require("../myspace-profile");

const MAX_SUMMARIES = 2500;
const MAX_BODIES = 150;

function dirPath() {
  return profile.profileScopedPath("mail-cache");
}

function filePath(accountId) {
  return path.join(dirPath(), `${String(accountId || "unknown")}.json`);
}

function empty() {
  return { summaries: {}, bodies: {}, lists: {}, labels: null, updatedAt: null };
}

function load(accountId) {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath(accountId), "utf8"));
    return {
      summaries: raw?.summaries && typeof raw.summaries === "object" ? raw.summaries : {},
      bodies: raw?.bodies && typeof raw.bodies === "object" ? raw.bodies : {},
      lists: raw?.lists && typeof raw.lists === "object" ? raw.lists : {},
      labels: Array.isArray(raw?.labels) ? raw.labels : null,
      updatedAt: raw?.updatedAt || null,
    };
  } catch {
    return empty();
  }
}

function prune(cache) {
  const summaryIds = Object.keys(cache.summaries);
  if (summaryIds.length > MAX_SUMMARIES) {
    const keep = new Set(summaryIds.slice(-MAX_SUMMARIES));
    for (const id of summaryIds) {
      if (!keep.has(id)) delete cache.summaries[id];
    }
  }
  const bodyIds = Object.keys(cache.bodies);
  if (bodyIds.length > MAX_BODIES) {
    const keep = new Set(bodyIds.slice(-MAX_BODIES));
    for (const id of bodyIds) {
      if (!keep.has(id)) delete cache.bodies[id];
    }
  }
  return cache;
}

function save(accountId, cache) {
  const next = prune({
    summaries: cache.summaries || {},
    bodies: cache.bodies || {},
    lists: cache.lists || {},
    labels: cache.labels || null,
    updatedAt: new Date().toISOString(),
  });
  fs.mkdirSync(dirPath(), { recursive: true });
  fs.writeFileSync(filePath(accountId), JSON.stringify(next), "utf8");
  return next;
}

function folderKey({ labelIds = [], q = "", pageToken = "" } = {}) {
  const labels = Array.isArray(labelIds) ? labelIds.join(",") : String(labelIds || "");
  return `${labels}|${String(q || "")}|${String(pageToken || "")}`;
}

function putSummaries(accountId, messages) {
  const cache = load(accountId);
  for (const msg of messages || []) {
    if (msg?.id) cache.summaries[msg.id] = { ...cache.summaries[msg.id], ...msg };
  }
  save(accountId, cache);
}

function putBodies(accountId, message) {
  if (!message?.id) return;
  const cache = load(accountId);
  cache.bodies[message.id] = message;
  cache.summaries[message.id] = {
    ...(cache.summaries[message.id] || {}),
    id: message.id,
    threadId: message.threadId,
    subject: message.subject,
    from: message.from,
    date: message.date,
    snippet: message.snippet,
    unread: message.unread,
    labelIds: message.labelIds,
  };
  save(accountId, cache);
}

function getBody(accountId, messageId) {
  return load(accountId).bodies[String(messageId)] || null;
}

function putList(accountId, key, payload) {
  const cache = load(accountId);
  cache.lists[key] = payload;
  save(accountId, cache);
}

function getList(accountId, key) {
  return load(accountId).lists[key] || null;
}

function putLabels(accountId, labels) {
  const cache = load(accountId);
  cache.labels = labels;
  save(accountId, cache);
}

function getLabels(accountId) {
  return load(accountId).labels;
}

function hydrateIds(accountId, ids) {
  const cache = load(accountId);
  const messages = [];
  const missing = [];
  for (const id of ids || []) {
    const hit = cache.summaries[id];
    if (hit) messages.push(hit);
    else missing.push(id);
  }
  return { messages, missing, cache };
}

module.exports = {
  load,
  save,
  folderKey,
  putSummaries,
  putBodies,
  getBody,
  putList,
  getList,
  putLabels,
  getLabels,
  hydrateIds,
};